// --- KPIs do módulo Poupança ---

import type { ReactNode } from 'react';
import { Flame, TrendingDown, TrendingUp } from 'lucide-react';
import { KpiCard } from '../../components/ui/KpiCard';
import { formatCurrency } from '../../utils/formatters';
import type { TotaisPoupanca } from './usePoupanca';
import type { ModoAUM } from './usePoupanca';

interface ProjecaoConsolidada {
  pl_total_atual: number;
  pl_total_projetado_fim_ano: number;
  meta_total: number | null;
  gap_total: number | null;
  meses_restantes: number;
  /** Spread médio ponderado por PL (modelo MM6 — `MM6 Rent.% / MM6 CDI`).
   *  1.0 = neutro (igual ao CDI). Opcional para retrocompat. */
  spread_medio?: number;
  /** Clientes incluídos no cálculo MM6. Opcional para retrocompat. */
  n_clientes?: number;
  /** Clientes com meta individual definida (capacidade manual ou auto MM6,
   *  com `sem_capacidade_poupanca = false`). Opcional para retrocompat. */
  n_clientes_com_meta?: number;
}

interface Props {
  totais: TotaisPoupanca;
  mesInicio: number;
  anoInicio: number;
  mesFim: number;
  anoFim: number;
  modoAUM?: ModoAUM;
  aumLegadoTotal?: number;
  clientesQueimando?: number;
  rebateEmRiscoTotal?: number;
  projecao?: ProjecaoConsolidada;
  /** Quantidade de meses do intervalo — base para "média mensal" nos subtítulos. */
  mesesNoPeriodo?: number;
  /** Soma do PL inicial de cada cliente no primeiro mês do intervalo —
   *  base para "Variação do AUM" no subtítulo do card AUM. */
  aumInicialPeriodo?: number;
  /** Quando definido + onAbrirBurnDetalhe, os 2 cards de burn ficam clicáveis. */
  onAbrirBurnDetalhe?: () => void;
  /** Quando definido, o card "Projeção Dez/anoFim" fica clicável. */
  onAbrirProjecao?: () => void;
}

// Card KPI com ícone superior-direito (variação do KpiCard padrão).
// Aceita onClick opcional — quando definido, vira clicável com hover.
function KpiCardIcon(
  { titulo, valor, subtitulo, icon, cor, onClick }:
  { titulo: string; valor: string; subtitulo?: string; icon: ReactNode; cor?: string; onClick?: () => void },
) {
  const clicavel = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${clicavel ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''}`}
      title={clicavel ? 'Clique para ver detalhamento' : undefined}>
      <div className="absolute" style={{ top: 12, right: 12 }}>{icon}</div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider pr-6">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${cor ?? 'text-gray-900'}`}>{valor}</p>
      {subtitulo && <p className="text-sm text-gray-400 mt-0.5">{subtitulo}</p>}
    </div>
  );
}

export function PoupancaKpis({ totais, mesInicio, anoInicio, mesFim, anoFim, modoAUM, aumLegadoTotal, clientesQueimando, rebateEmRiscoTotal, projecao, mesesNoPeriodo, aumInicialPeriodo, onAbrirBurnDetalhe, onAbrirProjecao }: Props) {
  const mesUnico = mesInicio === mesFim && anoInicio === anoFim;
  const labelNNM = mesUnico ? 'NNM do Mês' : 'NNM do Período';
  const sobGestao = modoAUM === 'sob_gestao';
  // Variação AUM = AUM final − AUM inicial (do primeiro mês do intervalo).
  // Sem aumInicialPeriodo (compat) cai no subtítulo antigo.
  const aumFinalDisplay = totais.pl_total + (sobGestao ? (aumLegadoTotal ?? 0) : 0);
  const variacaoAum = aumInicialPeriodo != null ? aumFinalDisplay - aumInicialPeriodo : null;
  // Subtítulo do AUM: prefere mostrar variação (↑/↓ comunicam direção sem
  // depender de cor — KpiCard só colore o valor principal). Modo sob_gestao
  // mantém o split antigo p/ não esconder Legado/Galápagos.
  const subAum = sobGestao && aumLegadoTotal
    ? `Galapagos: ${formatCurrency(totais.pl_total, true)} + Legado: ${formatCurrency(aumLegadoTotal, true)}`
    : variacaoAum != null
      ? `${variacaoAum >= 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(variacaoAum), true)} no período`
      : 'Onshore + Offshore (BRL)';
  // Média mensal do NNM (subtítulo extra além de "Poupança líquida").
  const meses = Math.max(1, mesesNoPeriodo ?? 1);
  const subNNM = mesesNoPeriodo
    ? `Média: ${formatCurrency(totais.nnm_mes / meses, true)}/mês`
        + (totais.tombamento_total > 0
          ? ` · Líq.: ${formatCurrency(totais.nnm_poupanca_liquida_total, true)}` : '')
    : (totais.tombamento_total > 0
        ? `Poupança líquida: ${formatCurrency(totais.nnm_poupanca_liquida_total, true)}`
        : undefined);
  // Média % mensal aproximada (linear) — informativo, não-composto.
  const subRent = mesesNoPeriodo
    ? `Média: ${((totais.rentabilidade_media * 100) / meses).toFixed(2)}%/mês`
    : undefined;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        titulo={sobGestao ? 'AUM sob Gestao' : 'AUM Total'}
        valor={formatCurrency(aumFinalDisplay, true)}
        subtitulo={subAum}
        cor={variacaoAum != null && !sobGestao
          ? (variacaoAum >= 0 ? 'text-green-600' : 'text-red-600')
          : undefined}
      />
      <KpiCard
        titulo={labelNNM}
        valor={formatCurrency(totais.nnm_mes, true)}
        cor={totais.nnm_mes >= 0 ? 'text-green-600' : 'text-red-600'}
        subtitulo={subNNM}
      />
      <KpiCard
        titulo="Rent. Média Ponderada"
        valor={`${(totais.rentabilidade_media * 100).toFixed(2)}%`}
        subtitulo={subRent}
      />
      <KpiCard
        titulo="Clientes Poupando"
        valor={`${totais.clientes_poupando} de ${totais.total_clientes}`}
        subtitulo={totais.total_clientes > 0
          ? `${((totais.clientes_poupando / totais.total_clientes) * 100).toFixed(0)}%`
          : undefined}
      />
      <KpiCardIcon
        titulo="Clientes Queimando"
        valor={String(clientesQueimando ?? 0)}
        subtitulo="queda média de PL"
        icon={<Flame size={16} style={{ color: '#dc2626' }} />}
        cor={(clientesQueimando ?? 0) > 0 ? 'text-red-700' : undefined}
        onClick={(clientesQueimando ?? 0) > 0 ? onAbrirBurnDetalhe : undefined}
      />
      <KpiCardIcon
        titulo="Rebate em Risco"
        valor={formatCurrency(rebateEmRiscoTotal ?? 0, true)}
        subtitulo="perda projetada até Dez"
        icon={<TrendingDown size={16} style={{ color: '#dc2626' }} />}
        cor={(rebateEmRiscoTotal ?? 0) > 0 ? 'text-red-700' : undefined}
        onClick={(rebateEmRiscoTotal ?? 0) > 0 ? onAbrirBurnDetalhe : undefined}
      />
      {projecao && (
        <div className="sm:col-span-2 lg:col-span-2">
          <ProjecaoCard projecao={projecao} anoFim={anoFim} onAbrir={onAbrirProjecao} />
        </div>
      )}
    </div>
  );
}

/** Card de projeção até Dezembro do anoFim (MM6 + CDI projetado).
 *  Renderizado com largura dupla (col-span-2 no PoupancaKpis). Subtítulos:
 *    1. Gap vs meta GLOBAL (metaAUM.valor) — orientação top-down.
 *    2. N clientes com meta individual definida (capacidade não-nula). */
function ProjecaoCard(
  { projecao, anoFim, onAbrir }:
  { projecao: ProjecaoConsolidada; anoFim: number; onAbrir?: () => void },
) {
  const gap = projecao.gap_total;
  const semMeta = projecao.meta_total == null;
  const positivo = !semMeta && (gap ?? 0) >= 0;
  const subGap = semMeta
    ? 'Meta global não definida'
    : `Meta global: ${formatCurrency(projecao.meta_total ?? 0, true)} · `
      + `Gap: ${positivo ? '↑' : '↓'} ${formatCurrency(Math.abs(gap ?? 0), true)}`;
  const corValor = semMeta ? 'text-gray-900'
    : positivo ? 'text-green-700' : 'text-red-700';
  const Icon = semMeta || positivo ? TrendingUp : TrendingDown;
  const iconCor = semMeta ? '#9ca3af' : positivo ? '#16a34a' : '#dc2626';
  const clicavel = !!onAbrir;
  // Subtítulo 2: clientes com meta individual definida.
  const nComMeta = projecao.n_clientes_com_meta;
  const nTotal = projecao.n_clientes;
  const subMeta = nComMeta != null && nTotal != null
    ? `${nComMeta} de ${nTotal} cliente${nTotal === 1 ? '' : 's'} com meta individual definida`
    : null;
  return (
    <div
      onClick={onAbrir}
      className={`relative bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full ${clicavel ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''}`}
      title={clicavel ? 'Clique para ver detalhamento por cliente' : undefined}>
      <div className="absolute" style={{ top: 12, right: 12 }}>
        <Icon size={16} style={{ color: iconCor }} />
      </div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider pr-6">
        Projeção Dez/{anoFim}
      </p>
      <p className={`text-3xl font-bold mt-1 ${corValor}`}>
        {formatCurrency(projecao.pl_total_projetado_fim_ano, true)}
      </p>
      <p className="text-sm text-gray-500 mt-0.5">{subGap}</p>
      {subMeta && (
        <p className="text-xs text-gray-400 mt-1">{subMeta}</p>
      )}
    </div>
  );
}
