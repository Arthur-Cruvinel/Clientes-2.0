// --- Modal de detalhamento do Custo Indireto rateado para um cliente ---
// Decompõe o rateio por tipo (geral / juridico / conciliacao) para auditoria.
// Reproduz a fórmula do motor (financials.custos.ts:96-145) — incluindo o
// pool institucional dos colaboradores na parcela 'geral'.

import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { useApp } from '../../state/AppContext';
import { calcularCustoInstitucional, calcularOciosidade, somarPctPorColaborador } from '../../utils/financials';
import type { DadosCliente, CustoIndireto } from '../../types';

interface Props {
  cliente: DadosCliente;
  todosClientes: DadosCliente[];
  custosIndiretos: CustoIndireto[];
  custosDiretos: Map<string, number>;
  onFechar: () => void;
}

const LABEL_TIPO: Record<string, string> = {
  geral: 'Geral',
  juridico: 'Jurídico',
  conciliacao: 'Conciliação',
};

export function CustoIndiretoModal({ cliente, todosClientes, custosIndiretos, custosDiretos, onFechar }: Props) {
  const { dadosPeriodo } = useApp();
  const colaboradores = dadosPeriodo?.colaboradores ?? [];
  // Pool da folha NÃO-ALOCADA = institucional + ociosidade — entra no pool
  // 'geral' do motor; incluir aqui para o detalhamento bater ao centavo.
  const custoInstitucional = calcularCustoInstitucional(colaboradores);
  const somaPct = somarPctPorColaborador(
    dadosPeriodo?.clientes ?? [], colaboradores, dadosPeriodo?.vinculos ?? []);
  const ociosidade = calcularOciosidade(colaboradores, somaPct);
  const poolNaoAlocado = custoInstitucional + ociosidade;

  // Denominador do rateio geral (proporcional ao custo direto).
  const somaCustoDireto = todosClientes.reduce((s, c) => s + (custosDiretos.get(c.nome_cliente) ?? 0), 0);

  // Agrupa custos por tipo. Pool 'geral' soma também o institucional dos
  // colaboradores — alinhado com financials.custos.ts:99-100.
  const custosPorTipo = { geral: poolNaoAlocado, juridico: 0, conciliacao: 0 };
  const descricoesPorTipo: Record<string, CustoIndireto[]> = { geral: [], juridico: [], conciliacao: [] };
  for (const ci of custosIndiretos) {
    custosPorTipo[ci.tipo_custo] += ci.valor_mensal;
    descricoesPorTipo[ci.tipo_custo].push(ci);
  }
  if (custoInstitucional > 0) {
    descricoesPorTipo.geral.push({
      descricao_custo: 'Custo Institucional (folha)',
      valor_mensal: custoInstitucional,
      tipo_custo: 'geral',
    });
  }
  if (ociosidade > 0) {
    descricoesPorTipo.geral.push({
      descricao_custo: 'Ociosidade (folha não-alocada)',
      valor_mensal: ociosidade,
      tipo_custo: 'geral',
    });
  }

  type Linha = { descricao: string; tipo: string; valorTotal: number; baseRateio: string; pctCliente: number; alocado: number };
  const linhas: Linha[] = [];
  let somaAlocado = 0;

  const custoDiretoCliente = custosDiretos.get(cliente.nome_cliente) ?? 0;

  // Só 'geral' é custo INDIRETO. Jurídico/conciliação foram reclassificados
  // como custo DIRETO (compõem o dedicado) — aparecem no CustoDiretoModal.
  {
    const total = custosPorTipo.geral;
    const pct = somaCustoDireto > 0 ? custoDiretoCliente / somaCustoDireto : 0;
    const alocado = total * pct;
    somaAlocado += alocado;
    if (total > 0) {
      const desc = descricoesPorTipo.geral.map(ci => ci.descricao_custo).join(', ');
      linhas.push({ descricao: desc, tipo: LABEL_TIPO.geral, valorTotal: total, baseRateio: 'Custo direto', pctCliente: pct, alocado });
    }
  }

  const TH = 'px-3 py-2 text-xs font-bold uppercase tracking-wider text-left';
  const TD = 'px-3 py-2 text-sm';

  return (
    <Modal aberto onFechar={onFechar} titulo={`Custo Indireto — ${cliente.nome_cliente}`}>
      {linhas.length === 0 ? (
        <p className="text-sm" style={{ color: '#6b6b8a' }}>Nenhum custo indireto alocado a este cliente.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: '#f9f9fb' }}>
              <tr>
                <th className={TH}>Descrição</th>
                <th className={TH}>Tipo</th>
                <th className={`${TH} text-right`}>Valor Total</th>
                <th className={TH}>Base Rateio</th>
                <th className={`${TH} text-right`}>% Cliente</th>
                <th className={`${TH} text-right`}>Alocado</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
              {linhas.map((l, i) => (
                <tr key={i}>
                  <td className={`${TD} max-w-[200px] truncate`} title={l.descricao}>{l.descricao}</td>
                  <td className={TD}>{l.tipo}</td>
                  <td className={`${TD} text-right`}>{formatCurrency(l.valorTotal)}</td>
                  <td className={TD} style={{ color: '#6b6b8a' }}>{l.baseRateio}</td>
                  <td className={`${TD} text-right`}>{formatPercent(l.pctCliente * 100)}</td>
                  <td className={`${TD} text-right font-medium`}>{formatCurrency(l.alocado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <td colSpan={5} className={`${TD} font-bold`}>TOTAL</td>
                <td className={`${TD} text-right font-bold`}>{formatCurrency(somaAlocado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}
