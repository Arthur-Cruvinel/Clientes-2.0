// --- Modal "Clientes com Burn Rate Ativo" (modelo MM6) ---
// Drilldown dos cards "Clientes Queimando" / "Rebate em Risco" no
// PoupancaKpis. Critério: variacao_mm6 < 0 — soma do NNM líquido médio dos
// últimos 6 meses + rentabilidade BRL média dos últimos 6 meses (do
// histórico completo do cliente, não restrito ao intervalo selecionado).

import { useMemo, useState } from 'react';
import { X, Flame } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { HeaderOrdenavel, type OrdenacaoState } from '../../components/ui/HeaderOrdenavel';
import { ExportButton } from '../../components/ui/ExportButton';
import { formatCurrency } from '../../utils/formatters';
import { exportBurnRateExcel } from '../../utils/exporters/exportExcel';
import { exportBurnRatePdf } from '../../utils/exporters/exportPdf';
import type { MM6Cliente } from './usePoupanca';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type ChaveOrd =
  | 'nome_cliente' | 'pl_atual' | 'mm6_rent_brl' | 'mm6_rent_pct'
  | 'mm6_nnm_liquido' | 'variacao_mm6'
  | 'pl_projetado_fim_ano' | 'gap_meta_individual' | 'severidade';

interface Props {
  clientes: MM6Cliente[];
  periodoInicio: { mes: number; ano: number };
  periodoFim: { mes: number; ano: number };
  anoFim: number;
  onFechar: () => void;
}

function corSeveridade(s: MM6Cliente['severidade']): { bg: string; fg: string; label: string } {
  if (s === 'critico') return { bg: '#fee2e2', fg: '#7f1d1d', label: 'Crítico' };
  if (s === 'moderado') return { bg: '#fed7aa', fg: '#9a3412', label: 'Moderado' };
  if (s === 'leve') return { bg: '#fef3c7', fg: '#854d0e', label: 'Leve' };
  return { bg: '#f3f4f6', fg: '#6b6b8a', label: '—' };
}

function severidadePeso(s: MM6Cliente['severidade']): number {
  if (s === 'critico') return 3;
  if (s === 'moderado') return 2;
  if (s === 'leve') return 1;
  return 0;
}

export function BurnRateModal({ clientes, periodoInicio, periodoFim, anoFim, onFechar }: Props) {
  // Default: variacao_mm6 ASC = mais negativo primeiro.
  const [ordenacao, setOrdenacao] = useState<OrdenacaoState<ChaveOrd>>(
    { coluna: 'variacao_mm6', direcao: 'asc' });

  const periodoLabel = `${MESES_LABEL[periodoInicio.mes - 1]}/${periodoInicio.ano} até ${MESES_LABEL[periodoFim.mes - 1]}/${periodoFim.ano}`;

  const ordenados = useMemo(() => {
    const copia = [...clientes];
    const dir = ordenacao.direcao === 'asc' ? 1 : -1;
    copia.sort((a, b) => {
      const k = ordenacao.coluna;
      if (k === 'nome_cliente') return a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR') * dir;
      if (k === 'severidade') return (severidadePeso(a.severidade) - severidadePeso(b.severidade)) * dir;
      if (k === 'gap_meta_individual') {
        const av = a.gap_meta_individual ?? Number.POSITIVE_INFINITY;
        const bv = b.gap_meta_individual ?? Number.POSITIVE_INFINITY;
        return (av - bv) * dir;
      }
      return ((a[k] as number) - (b[k] as number)) * dir;
    });
    return copia;
  }, [clientes, ordenacao]);

  const totais = useMemo(() => clientes.reduce((acc, c) => ({
    pl: acc.pl + c.pl_atual,
    rentMensal: acc.rentMensal + c.mm6_rent_brl,
    nnmMensal: acc.nnmMensal + c.mm6_nnm_liquido,
    variacao: acc.variacao + c.variacao_mm6,
    plProj: acc.plProj + c.pl_projetado_fim_ano,
    gap: acc.gap + (c.gap_meta_individual ?? 0),
    rebate: acc.rebate + c.rebate_em_risco,
  }), { pl: 0, rentMensal: 0, nnmMensal: 0, variacao: 0, plProj: 0, gap: 0, rebate: 0 }), [clientes]);

  const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
  const TIP_MM6 = 'Média dos últimos 6 meses do histórico completo do cliente';

  return (
    <Modal aberto onFechar={onFechar} titulo="Clientes com Burn Rate Ativo" largura="7xl">
      <div className="space-y-3">
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#6b6b8a' }}>
          <Flame size={12} style={{ color: '#dc2626' }} />
          Período de visualização: <strong style={{ color: '#160F41' }}>{periodoLabel}</strong>
          <span className="ml-2">·</span>
          <span><strong style={{ color: '#160F41' }}>{clientes.length}</strong> cliente{clientes.length === 1 ? '' : 's'} com Variação MM6 negativa (NNM líq. + Rent. BRL &lt; 0)</span>
        </p>

        {clientes.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: '#6b6b8a' }}>
            Nenhum cliente em burn rate (MM6).
          </p>
        ) : (
          <>
            <div className="overflow-auto rounded-lg border" style={{ borderColor: '#e2e2e8', maxHeight: '50vh' }}>
              <table className="min-w-full text-sm">
                <thead className="sticky top-0" style={{ backgroundColor: '#f9f9fb' }}>
                  <tr>
                    <th className={`${TH} text-left`}><HeaderOrdenavel titulo="Cliente" chave="nome_cliente" alinhamento="left" ordenacao={ordenacao} onOrdenar={setOrdenacao} /></th>
                    <th className={`${TH} text-right`}><HeaderOrdenavel titulo="PL Atual" chave="pl_atual" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} /></th>
                    <th className={`${TH} text-right`}><HeaderOrdenavel titulo="Rent. MM6" chave="mm6_rent_brl" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip={`Rent. R$/mês — ${TIP_MM6}`} /></th>
                    <th className={`${TH} text-right`}><HeaderOrdenavel titulo="Taxa MM6" chave="mm6_rent_pct" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip={`Taxa %/mês — ${TIP_MM6}`} /></th>
                    <th className={`${TH} text-right`}><HeaderOrdenavel titulo="NNM MM6" chave="mm6_nnm_liquido" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip={`NNM líq./mês — ${TIP_MM6}`} /></th>
                    <th className={`${TH} text-right`}><HeaderOrdenavel titulo="Var. MM6" chave="variacao_mm6" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip="Variação MM6 = NNM líq. + Rent. BRL — base do critério de burn" /></th>
                    <th className={`${TH} text-right`}><HeaderOrdenavel titulo="PL Proj." chave="pl_projetado_fim_ano" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip={`PL Projetado Dez/${anoFim} — PL[t] = PL[t-1] × (1 + CDI_proj × spread) + MM6 NNM`} /></th>
                    <th className={`${TH} text-right`}><HeaderOrdenavel titulo="Gap" chave="gap_meta_individual" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip="Gap Meta Individual — Meta individual (= projeção com capacidade esperada) − PL projetado" /></th>
                    <th className={`${TH} text-center`}><HeaderOrdenavel titulo="Severidade" chave="severidade" alinhamento="center" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip="% do PL: > -1% leve, > -3% moderado, ≤ -3% crítico" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                  {ordenados.map(c => {
                    const sev = corSeveridade(c.severidade);
                    const gapCor = c.gap_meta_individual == null ? '#9ca3af'
                      : c.gap_meta_individual >= 0 ? '#16a34a' : '#dc2626';
                    const corNnm = c.mm6_nnm_liquido > 0 ? '#16a34a'
                      : c.mm6_nnm_liquido < 0 ? '#dc2626' : '#6b6b8a';
                    const tipMeses = `MM6 baseado em ${c.n_meses} mese${c.n_meses === 1 ? '' : 's'} históricos · spread ${c.spread.toFixed(2)}× CDI`;
                    return (
                      <tr key={c.nome_cliente}>
                        <td className="px-3 py-2 text-xs font-medium" title={tipMeses} style={{ color: '#160F41' }}>{c.nome_cliente}</td>
                        <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: '#160F41' }}>{formatCurrency(c.pl_atual, true)}</td>
                        <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: c.mm6_rent_brl < 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(c.mm6_rent_brl, true)}</td>
                        <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: c.mm6_rent_pct < 0 ? '#dc2626' : '#16a34a' }}>{(c.mm6_rent_pct * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: corNnm }}>{formatCurrency(c.mm6_nnm_liquido, true)}</td>
                        <td className="px-3 py-2 text-xs text-right tabular-nums font-semibold" style={{ color: c.variacao_mm6 < 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(c.variacao_mm6, true)}</td>
                        <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: c.pl_projetado_fim_ano < 0.5 ? '#7f1d1d' : '#160F41' }}>
                          {c.pl_projetado_fim_ano < 0.5 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              style={{ backgroundColor: '#fee2e2', color: '#7f1d1d' }}
                              title="Projeção atinge zero antes de Dez — cliente projeta consumir todo o patrimônio até o fim do horizonte">
                              PL zerado
                            </span>
                          ) : formatCurrency(c.pl_projetado_fim_ano, true)}
                        </td>
                        <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: gapCor }}>
                          {c.gap_meta_individual == null ? '—' : formatCurrency(c.gap_meta_individual, true)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={{ backgroundColor: sev.bg, color: sev.fg }}>{sev.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg p-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs" style={{ backgroundColor: '#f9f9fb' }}>
              <Linha label="Total clientes em burn (MM6)" valor={String(clientes.length)} />
              <Linha label="PL atual total" valor={formatCurrency(totais.pl, true)} />
              <Linha label="MM6 Rent. mensal total" valor={formatCurrency(totais.rentMensal, true)} cor={totais.rentMensal < 0 ? '#dc2626' : '#160F41'} />
              <Linha label="MM6 NNM líq. mensal total" valor={formatCurrency(totais.nnmMensal, true)} cor={totais.nnmMensal < 0 ? '#dc2626' : '#160F41'} />
              <Linha label="Variação MM6 mensal total" valor={formatCurrency(totais.variacao, true)} cor={totais.variacao < 0 ? '#dc2626' : '#160F41'} />
              <Linha label={`PL total projetado Dez/${anoFim}`} valor={formatCurrency(totais.plProj, true)} />
              <Linha label="Gap total (meta individual)" valor={formatCurrency(totais.gap, true)} cor={totais.gap >= 0 ? '#16a34a' : '#dc2626'} />
              <Linha label="Rebate total em risco (até Dez)" valor={formatCurrency(totais.rebate, true)} cor="#ea580c" />
            </div>
          </>
        )}

        <div className="flex justify-between gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
          <button onClick={onFechar} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
            <X size={14} /> Fechar
          </button>
          {clientes.length > 0 && (
            <ExportButton
              onExportExcel={() => exportBurnRateExcel(ordenados, periodoLabel, anoFim)}
              onExportPdf={() => exportBurnRatePdf(ordenados, periodoLabel, anoFim)}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function Linha({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span style={{ color: '#6b6b8a' }}>{label}</span>
      <span className="font-medium tabular-nums" style={{ color: cor ?? '#160F41' }}>{valor}</span>
    </div>
  );
}
