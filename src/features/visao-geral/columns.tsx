// --- Definição de colunas da tabela de clientes (Visão Geral) ---

import type { ColunaConfig } from '../../components/ui/DataTable';
import type { DadosCliente, VisaoFinanceira } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/formatters';

const COR_PACOTE: Record<string, { bg: string; cor: string }> = {
  full:       { bg: '#160F41', cor: '#ffffff' },
  advanced:   { bg: '#7c3aed', cor: '#ffffff' },
  light:      { bg: '#dbeafe', cor: '#1e40af' },
  future:     { bg: '#f3f4f6', cor: '#6b7280' },
  asset_only: { bg: '#fef3c7', cor: '#92400e' },
};

const LABEL_PACOTE: Record<string, string> = {
  full: 'full', advanced: 'advanced', light: 'light', future: 'future', asset_only: 'asset',
};

function PacoteBadge({ pacote }: { pacote: string }) {
  const estilo = COR_PACOTE[pacote] ?? COR_PACOTE.future;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: estilo.bg, color: estilo.cor }}>
      {LABEL_PACOTE[pacote] ?? pacote}
    </span>
  );
}

function ResultadoBadge({ valor }: { valor: number }) {
  const lucro = valor > 0;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: lucro ? '#dcfce7' : '#fee2e2', color: lucro ? '#166534' : '#991b1b' }}>
      {lucro ? 'Lucro' : 'Prejuízo'}
    </span>
  );
}

function fmtTaxaRebate(taxa: number): string {
  return `${(taxa * 100).toFixed(2).replace('.', ',')}% a.a.`;
}

interface ColumnCallbacks {
  onClickCustoDireto: (c: DadosCliente) => void;
  onClickCustoIndireto: (c: DadosCliente) => void;
  onClickImpostos: (c: DadosCliente) => void;
  visaoFinanceira: VisaoFinanceira;
}

export function criarColunas(cb: ColumnCallbacks): ColunaConfig<DadosCliente>[] {
  const isMC = cb.visaoFinanceira === 'margem_contribuicao';

  // Valor principal conforme visão: margem contribuição ou EBITDA
  const valorResultado = (c: DadosCliente) => isMC ? c.margem_contribuicao : c.ebitda;
  const margemResultado = (c: DadosCliente) => {
    const v = valorResultado(c);
    return c.receita_bruta > 0 ? v / c.receita_bruta : 0;
  };

  const cols: ColunaConfig<DadosCliente>[] = [
    {
      chave: 'nome_cliente', titulo: 'Cliente', alinhamento: 'left', ordenavel: true,
      render: (c) => <span className="font-medium" style={{ color: '#160F41' }}>{c.nome_cliente}</span>,
    },
    {
      chave: 'banker', titulo: 'Banker', alinhamento: 'left', ordenavel: true,
      render: (c) => c.banker
        ? <span className="text-xs" style={{ color: '#160F41' }}>{c.banker}</span>
        : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Sem banker</span>,
    },
    {
      chave: 'pacote_servico', titulo: 'Pacote', alinhamento: 'center', ordenavel: true,
      render: (c) => <PacoteBadge pacote={c.pacote_servico} />,
    },
    {
      chave: 'receita_fee_mensal', titulo: 'Fee', alinhamento: 'right', ordenavel: true,
      render: (c) => c.receita_fee_mensal > 0 ? formatCurrency(c.receita_fee_mensal) : <span style={{ color: '#d1d5db' }}>-</span>,
    },
    {
      chave: 'receita_rebate', titulo: 'Rebate', alinhamento: 'right', ordenavel: true,
      render: (c) => {
        if (c.receita_rebate <= 0) return <span style={{ color: '#d1d5db' }}>-</span>;
        const taxaOn = c.percentual_rebate_anual_onshore ?? 0;
        const taxaOff = c.percentual_rebate_anual_offshore ?? 0;
        const partes: string[] = [];
        if (c.pl_onshore > 0 && taxaOn > 0) partes.push(`${fmtTaxaRebate(taxaOn)} on`);
        if ((c.pl_offshore ?? 0) > 0 && taxaOff > 0) partes.push(`${fmtTaxaRebate(taxaOff)} off`);
        return (
          <div className="text-right">
            <div>{formatCurrency(c.receita_rebate)}</div>
            {partes.length > 0 && <div className="text-[10px]" style={{ color: '#6b6b8a' }}>{partes.join(' · ')}</div>}
          </div>
        );
      },
    },
    {
      chave: 'custo_direto', titulo: 'Custo Direto', alinhamento: 'right', ordenavel: true,
      render: (c) => (
        <span className="cursor-pointer hover:underline" onClick={() => cb.onClickCustoDireto(c)}>
          {formatCurrency(c.custo_direto)}
        </span>
      ),
    },
  ];

  // Custo Dedicado: contabilidade + pagamento + administrativo
  cols.push({
    chave: 'custo_dedicado', titulo: 'Custo Dedicado', alinhamento: 'right', ordenavel: true,
    render: (c) => {
      const val = c.custo_direto_detalhe.contabilidade + c.custo_direto_detalhe.pagamento + c.custo_direto_detalhe.administrativo;
      return val > 0 ? (
        <span className="cursor-pointer hover:underline" onClick={() => cb.onClickCustoDireto(c)}>
          {formatCurrency(val)}
        </span>
      ) : <span style={{ color: '#d1d5db' }}>-</span>;
    },
  });

  // Custo Indireto: ocultar valor na visão margem de contribuição
  cols.push({
    chave: 'custo_indireto_rateado', titulo: 'Custo Indireto', alinhamento: 'right', ordenavel: !isMC,
    render: (c) => isMC
      ? <span style={{ color: '#d1d5db' }}>—</span>
      : (
        <span className="cursor-pointer hover:underline" onClick={() => cb.onClickCustoIndireto(c)}>
          {formatCurrency(c.custo_indireto_rateado)}
        </span>
      ),
  });

  cols.push(
    {
      chave: 'impostos_faturamento', titulo: 'Impostos', alinhamento: 'right', ordenavel: true,
      render: (c) => (
        <span className="cursor-pointer hover:underline" onClick={() => cb.onClickImpostos(c)}>
          {formatCurrency(c.impostos_faturamento + c.impostos_lucro)}
        </span>
      ),
    },
    {
      chave: isMC ? 'margem_contribuicao' : 'ebitda',
      titulo: isMC ? 'Mg. Contrib.' : 'EBITDA',
      alinhamento: 'right', ordenavel: true,
      render: (c) => {
        const v = valorResultado(c);
        return <span style={{ color: v >= 0 ? '#166534' : '#991b1b' }}>{formatCurrency(v)}</span>;
      },
    },
    {
      chave: 'margem', titulo: 'Margem', alinhamento: 'right', ordenavel: true,
      render: (c) => {
        const m = margemResultado(c);
        return <span style={{ color: m >= 0 ? '#166534' : '#991b1b' }}>{formatPercent(m * 100)}</span>;
      },
    },
    {
      chave: 'resultado', titulo: 'Resultado', alinhamento: 'center',
      render: (c) => <ResultadoBadge valor={valorResultado(c)} />,
    },
  );

  return cols;
}

/** Extrai valor textual de uma coluna para uso nos filtros (checkbox list). */
export function valorTextoColuna(c: DadosCliente, chave: string, isMC: boolean): string {
  switch (chave) {
    case 'nome_cliente': return c.nome_cliente;
    case 'banker': return c.banker ?? 'Sem banker';
    case 'pacote_servico': return LABEL_PACOTE[c.pacote_servico] ?? c.pacote_servico;
    case 'receita_fee_mensal': return c.receita_fee_mensal > 0 ? formatCurrency(c.receita_fee_mensal) : '-';
    case 'receita_rebate': return c.receita_rebate > 0 ? formatCurrency(c.receita_rebate) : '-';
    case 'custo_direto': return formatCurrency(c.custo_direto);
    case 'custo_dedicado': return formatCurrency(c.custo_direto_detalhe.contabilidade + c.custo_direto_detalhe.pagamento + c.custo_direto_detalhe.administrativo);
    case 'custo_indireto_rateado': return isMC ? '—' : formatCurrency(c.custo_indireto_rateado);
    case 'impostos_faturamento': return formatCurrency(c.impostos_faturamento + c.impostos_lucro);
    case 'margem_contribuicao': return formatCurrency(c.margem_contribuicao);
    case 'ebitda': return formatCurrency(c.ebitda);
    case 'margem': {
      const v = isMC ? c.margem_contribuicao : c.ebitda;
      const m = c.receita_bruta > 0 ? v / c.receita_bruta : 0;
      return formatPercent(m * 100);
    }
    case 'resultado': return (isMC ? c.margem_contribuicao : c.ebitda) > 0 ? 'Lucro' : 'Prejuízo';
    default: return String((c as unknown as Record<string, unknown>)[chave] ?? '');
  }
}
