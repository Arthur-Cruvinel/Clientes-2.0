// --- Modal "Projeção até Dezembro" (modelo MM6) ---
// Drilldown do card "Projeção Dez/{anoFim}" no PoupancaKpis.
// Mostra TODOS os clientes (não só em burn) com PL atual, MM6 Rent. % e
// NNM líq. médios mensais (últimos 6 meses do histórico completo), PL
// projetado por compounding mês a mês até Dez/anoFim, meta proporcional
// e gap. Filtros por categoria.
//
// Modelo de projeção (benchmark puro por dimensão):
//   PL_on[t]  = max(0, PL_on[t-1]  × (1 + cdi_proj[t])      + nnm × prop_on)
//   PL_off[t] = max(0, PL_off[t-1] × (1 + fedfunds_const)   + nnm × prop_off)
// onde nnm = mm6_nnm_liquido (cliente) e prop_on/off = pl_atual_on / pl_atual.
// `spread` continua exposto como métrica informativa (rent. histórica / CDI),
// mas não entra mais no compounding.

import { useMemo, useState } from 'react';
import { X, Target } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { HeaderOrdenavel, type OrdenacaoState } from '../../components/ui/HeaderOrdenavel';
import { ExportButton } from '../../components/ui/ExportButton';
import { formatCurrency } from '../../utils/formatters';
import { exportProjecaoExcel } from '../../utils/exporters/exportExcel';
import { exportProjecaoPdf } from '../../utils/exporters/exportPdf';
import type { MM6Cliente, ModoAUM } from './usePoupanca';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type ChaveOrd = 'nome_cliente' | 'pl_atual' | 'mm6_rent_pct' | 'mm6_nnm_liquido'
  | 'pl_projetado_fim_ano' | 'meta_individual' | 'gap_meta_individual';
type Filtro = 'todos' | 'em_burn' | 'abaixo_meta';

interface Props {
  clientes: MM6Cliente[];
  consolidado: {
    pl_total_atual: number;
    pl_total_projetado_fim_ano: number;
    meta_total: number | null;
    gap_total: number | null;
    meses_restantes: number;
    spread_medio: number;
    n_clientes: number;
    n_clientes_com_meta?: number;
  };
  periodoInicio: { mes: number; ano: number };
  periodoFim: { mes: number; ano: number };
  anoFim: number;
  modoAUM?: ModoAUM;
  onFechar: () => void;
}

interface StatusInfo { texto: string; cor: string; bg: string; }

function statusCliente(v: MM6Cliente): StatusInfo {
  if (v.em_burn) return { texto: 'Em burn', cor: '#7f1d1d', bg: '#fee2e2' };
  if (v.meta_individual == null) return { texto: 'Sem meta', cor: '#6b6b8a', bg: '#f3f4f6' };
  if ((v.gap_meta_individual ?? 0) > 0) return { texto: 'Acima da meta', cor: '#166534', bg: '#dcfce7' };
  return { texto: 'Abaixo da meta', cor: '#dc2626', bg: '#fef2f2' };
}


export function ProjecaoModal({ clientes, consolidado, periodoInicio, periodoFim, anoFim, modoAUM, onFechar }: Props) {
  // Label espelha o ajuste de meta_total no usePoupanca: em Galápagos a
  // meta vem descontada do legado; em Sob Gestão é cheia. Sem modoAUM
  // (compat) cai em "Meta Total" genérico.
  const labelMeta = modoAUM === 'galapagos' ? 'META GALÁPAGOS'
    : modoAUM === 'sob_gestao' ? 'META SOB GESTÃO' : 'META TOTAL';
  // Default: GAP ASC = mais distantes da meta no topo. Sem meta vão p/ o fim.
  const [ordenacao, setOrdenacao] = useState<OrdenacaoState<ChaveOrd>>(
    { coluna: 'gap_meta_individual', direcao: 'asc' });
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const periodoLabel = `${MESES_LABEL[periodoInicio.mes - 1]}/${periodoInicio.ano} até ${MESES_LABEL[periodoFim.mes - 1]}/${periodoFim.ano}`;

  const filtrados = useMemo(() => {
    if (filtro === 'em_burn') return clientes.filter(c => c.em_burn);
    if (filtro === 'abaixo_meta') return clientes.filter(c => c.gap_meta_individual != null && c.gap_meta_individual < 0);
    return clientes;
  }, [clientes, filtro]);

  const ordenados = useMemo(() => {
    const copia = [...filtrados];
    const dir = ordenacao.direcao === 'asc' ? 1 : -1;
    copia.sort((a, b) => {
      const k = ordenacao.coluna;
      if (k === 'nome_cliente') return a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR') * dir;
      if (k === 'gap_meta_individual' || k === 'meta_individual') {
        const av = (a[k] as number | null) ?? Number.POSITIVE_INFINITY;
        const bv = (b[k] as number | null) ?? Number.POSITIVE_INFINITY;
        return (av - bv) * dir;
      }
      return ((a[k] as number) - (b[k] as number)) * dir;
    });
    return copia;
  }, [filtrados, ordenacao]);

  const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
  const TIP_MM6 = 'Média dos últimos 6 meses do histórico completo do cliente';
  const corGap = consolidado.gap_total == null ? '#9ca3af'
    : consolidado.gap_total >= 0 ? '#16a34a' : '#dc2626';

  return (
    <Modal aberto onFechar={onFechar} titulo={`Projeção até Dezembro/${anoFim}`} largura="7xl">
      <div className="space-y-3">
        <div className="text-xs space-y-1" style={{ color: '#6b6b8a' }}>
          <p className="flex items-center gap-1.5">
            <Target size={12} style={{ color: '#160F41' }} />
            <span>Período de visualização: <strong style={{ color: '#160F41' }}>{periodoLabel}</strong></span>
            <span className="ml-1">·</span>
            <span><strong style={{ color: '#160F41' }}>{consolidado.meses_restantes}</strong> mês{consolidado.meses_restantes === 1 ? '' : 'es'} de projeção</span>
          </p>
          <p className="pl-[18px]">
            <strong style={{ color: '#160F41' }}>PL projetado:</strong> mês a mês em benchmark puro por dimensão — onshore capitaliza pelo CDI projetado,
            offshore pelo Fed Funds (último realizado, premissa simplificadora). NNM mensal = MM6 NNM líquido.
            <strong style={{ color: '#160F41' }}> Meta individual:</strong> mesma fórmula, substituindo o NNM pela <em>capacidade esperada</em> do cliente
            (manual em <code>capacidade_poupanca_mensal</code> quando cadastrada; senão MM6 NNM bruto − MM6 tombamento).
            <strong style={{ color: '#160F41' }}> Gap:</strong> meta − projeção.
          </p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <CardResumo titulo="AUM Atual" valor={formatCurrency(consolidado.pl_total_atual, true)} />
          <CardResumo titulo={`AUM Projetado Dez/${anoFim}`} valor={formatCurrency(consolidado.pl_total_projetado_fim_ano, true)} />
          <CardResumo titulo={labelMeta} valor={consolidado.meta_total != null ? formatCurrency(consolidado.meta_total, true) : '—'} />
          <CardResumo titulo="Gap Total" valor={consolidado.gap_total != null ? formatCurrency(consolidado.gap_total, true) : '—'} cor={corGap} />
        </div>

        {/* Filtro rápido */}
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#f3f4f6' }}>
          {([
            ['todos', `Todos (${clientes.length})`],
            ['em_burn', `Em burn (${clientes.filter(c => c.em_burn).length})`],
            ['abaixo_meta', `Abaixo da meta (${clientes.filter(c => (c.gap_meta_individual ?? 0) < 0).length})`],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)}
              className={`px-3 py-1 rounded text-[11px] font-medium ${filtro === id ? 'bg-white shadow-sm' : ''}`}
              style={{ color: filtro === id ? '#160F41' : '#6b6b8a' }}>{label}</button>
          ))}
        </div>

        {ordenados.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: '#6b6b8a' }}>
            Nenhum cliente atende ao filtro selecionado.
          </p>
        ) : (
          <div className="overflow-auto rounded-lg border" style={{ borderColor: '#e2e2e8', maxHeight: '50vh' }}>
            <table className="min-w-full text-sm">
              <thead className="sticky top-0" style={{ backgroundColor: '#f9f9fb' }}>
                <tr>
                  <th className={`${TH} text-left`}><HeaderOrdenavel titulo="Cliente" chave="nome_cliente" alinhamento="left" ordenacao={ordenacao} onOrdenar={setOrdenacao} /></th>
                  <th className={`${TH} text-right`}><HeaderOrdenavel titulo="PL Atual" chave="pl_atual" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} /></th>
                  <th className={`${TH} text-right`}><HeaderOrdenavel titulo="Rent. MM6" chave="mm6_rent_pct" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip={`Rent. %/mês — ${TIP_MM6}`} /></th>
                  <th className={`${TH} text-right`}><HeaderOrdenavel titulo="NNM MM6" chave="mm6_nnm_liquido" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip="MM6 NNM líquido — NNM bruto − tombamento − transferência interna" /></th>
                  <th className={`${TH} text-right`}><HeaderOrdenavel titulo="PL Proj." chave="pl_projetado_fim_ano" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip={`PL Projetado Dez/${anoFim} — benchmark puro: PL_on × (1 + CDI_proj) + PL_off × (1 + Fed Funds) + MM6 NNM`} /></th>
                  <th className={`${TH} text-right`}><HeaderOrdenavel titulo="Meta" chave="meta_individual" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip="Meta Individual — projeção do PL usando capacidade esperada como NNM mensal" /></th>
                  <th className={`${TH} text-right`}><HeaderOrdenavel titulo="Gap" chave="gap_meta_individual" alinhamento="right" ordenacao={ordenacao} onOrdenar={setOrdenacao} tooltip="Gap = Meta − PL Projetado. Verde = vai superar a meta" /></th>
                  <th className={`${TH} text-center`}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {ordenados.map(c => {
                  const st = statusCliente(c);
                  const corRent = c.mm6_rent_pct < 0 ? '#dc2626' : '#16a34a';
                  const corNnm = c.mm6_nnm_liquido > 0 ? '#16a34a'
                    : c.mm6_nnm_liquido < 0 ? '#dc2626' : '#6b6b8a';
                  const corGapRow = c.gap_meta_individual == null ? '#9ca3af'
                    : c.gap_meta_individual >= 0 ? '#16a34a' : '#dc2626';
                  const tipNnm = `MM6 baseado em ${c.n_meses} mese${c.n_meses === 1 ? '' : 's'} históricos`
                    + ` · fonte do alvo NNM/mês: ${c.meta_fonte ?? 'sem meta'}`;
                  const tipRent = `MM6 Rent.: ${(c.mm6_rent_pct * 100).toFixed(2)}%/mês`
                    + ` · MM6 CDI: ${(c.mm6_cdi_pct * 100).toFixed(2)}%/mês`
                    + ` · spread informativo: ${c.spread.toFixed(2)}× CDI (não usado no compounding — projeção em benchmark puro)`;
                  // Tooltip da Meta — explica composição da capacidade.
                  const fmtBRL = (v: number) => v.toLocaleString('pt-BR',
                    { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
                  const tipMeta = c.meta_individual == null
                    ? 'Cliente marcado como sem capacidade de poupança (sem_capacidade_poupanca = true)'
                    : `Baseado em capacidade ${c.capacidade_fonte}: `
                      + `${fmtBRL(c.capacidade_esperada)}/mês. `
                      + `Projetado mês a mês com CDI × spread ${c.spread.toFixed(2)}.`;
                  return (
                    <tr key={c.nome_cliente}>
                      <td className="px-3 py-2 text-xs font-medium" style={{ color: '#160F41' }}>{c.nome_cliente}</td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: '#160F41' }}>{formatCurrency(c.pl_atual, true)}</td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums" title={tipRent} style={{ color: corRent }}>{(c.mm6_rent_pct * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums" title={tipNnm} style={{ color: corNnm }}>
                        <div>{formatCurrency(c.mm6_nnm_liquido, true)}</div>
                        {c.meta_fonte && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: c.meta_fonte === 'manual' ? '#dbeafe' : '#f3f4f6',
                              color: c.meta_fonte === 'manual' ? '#1e3a8a' : '#6b6b8a',
                            }}>{c.meta_fonte === 'manual' ? 'Manual' : 'Auto'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: c.pl_projetado_fim_ano < 0.5 ? '#7f1d1d' : '#160F41' }}>
                        {c.pl_projetado_fim_ano < 0.5 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                            style={{ backgroundColor: '#fee2e2', color: '#7f1d1d' }}
                            title="Projeção atinge zero antes de Dez — cliente projeta consumir todo o patrimônio até o fim do horizonte">
                            PL zerado
                          </span>
                        ) : formatCurrency(c.pl_projetado_fim_ano, true)}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums" title={tipMeta}
                        style={{ color: c.meta_individual == null ? '#9ca3af' : '#160F41' }}>
                        {c.meta_individual == null ? (
                          <span>—</span>
                        ) : (
                          <>
                            <div>{formatCurrency(c.meta_individual, true)}</div>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: c.capacidade_fonte === 'manual' ? '#dbeafe' : '#f3f4f6',
                                color: c.capacidade_fonte === 'manual' ? '#1e3a8a' : '#6b6b8a',
                              }}>
                              {c.capacidade_fonte === 'manual' ? 'Manual' : 'Auto MM6'}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums" style={{ color: corGapRow }}>
                        {c.gap_meta_individual == null ? '—' : formatCurrency(c.gap_meta_individual, true)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap"
                          style={{ backgroundColor: st.bg, color: st.cor }}>{st.texto}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
          <button onClick={onFechar} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
            <X size={14} /> Fechar
          </button>
          {ordenados.length > 0 && (
            <ExportButton
              onExportExcel={() => exportProjecaoExcel(ordenados, periodoLabel, anoFim)}
              onExportPdf={() => exportProjecaoPdf(ordenados, periodoLabel, anoFim, {
                pl_total_atual: consolidado.pl_total_atual,
                pl_total_projetado_fim_ano: consolidado.pl_total_projetado_fim_ano,
                meta_total: consolidado.meta_total,
                gap_total: consolidado.gap_total,
              })}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function CardResumo({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b6b8a' }}>{titulo}</p>
      <p className="text-sm font-bold mt-0.5 tabular-nums" style={{ color: cor ?? '#160F41' }}>{valor}</p>
    </div>
  );
}
