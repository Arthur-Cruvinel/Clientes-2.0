// --- Gráfico "Trajetória do AUM" ---
// Área (AUM real) + projeção (MM6 quando disponível, fallback MM3) +
// trajetória meta até fim do período. A série MM6 vem pronta do
// usePoupanca (`serieAumProjetadaMM6`), agregando o pl_projetado_por_mes
// de cada cliente — usa CDI projetado × spread + MM6 NNM (modelo definitivo).

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import type { PontoHistorico, MetaAUM, TotaisPoupanca, ModoAUM } from './usePoupanca';

interface Props {
  dados: PontoHistorico[];
  metaAUM: MetaAUM | null;
  totais: TotaisPoupanca;
  mesFim: number;
  anoFim: number;
  /** Série mês a mês de PL projetado, agregada do usePoupanca a partir do
   *  modelo MM6 com benchmark puro (CDI onshore + Fed Funds offshore).
   *  Quando vazia ou ausente, o gráfico cai no fallback MM3 antigo. */
  serieAumProjetadaMM6?: Array<{ ano: number; mes: number; pl: number }>;
  /** Modo do toggle Galápagos / Sob Gestão. Em modo Galápagos a meta exibida
   *  é descontada do AUM legado, espelhando o comportamento do PoupancaMeta. */
  modoAUM?: ModoAUM;
  /** Total de AUM legado — base do desconto da meta em modo Galápagos. */
  aumLegadoTotal?: number;
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtCompacto(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
}

function pNum(a: number, m: number) { return a * 12 + m; }

interface PontoGrafico {
  periodo: string;
  aum: number | null;           // real (null nos projetados)
  aumProjetado: number | null;  // projeção média móvel 3m
  trajetoriaMeta: number | null;
}

export function PoupancaChart({ dados, metaAUM, totais, mesFim, anoFim, serieAumProjetadaMM6, modoAUM, aumLegadoTotal }: Props) {
  // Meta ajustada conforme toggle (mesmo padrão do PoupancaMeta.tsx):
  // em Galápagos descontamos o legado p/ não inflar a referência exibida
  // contra um AUM que não inclui custódia legado. Em Sob Gestão, meta cheia.
  const metaAjustadaValor = metaAUM
    ? (modoAUM === 'galapagos' ? metaAUM.valor - (aumLegadoTotal ?? 0) : metaAUM.valor)
    : 0;
  if (dados.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-sm"
        style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
        Nenhum dado historico disponivel para o grafico.
      </div>
    );
  }

  const aumInicial = dados[0].pl_total;
  const aumFinal = dados[dados.length - 1].pl_total;
  const variacao = aumFinal - aumInicial;
  const variacaoPct = aumInicial > 0 ? (variacao / aumInicial) * 100 : 0;

  const pontos = useMemo<PontoGrafico[]>(() => {
    const periodoInicio = pNum(dados[0].ano, dados[0].mes);
    const fimPeriodo = pNum(anoFim, mesFim);
    const ultimoReal = dados[dados.length - 1];
    const ultimoRealP = pNum(ultimoReal.ano, ultimoReal.mes);

    // Calcular trajetória meta: linha reta do AUM inicial ao target.
    // Usa metaAjustadaValor (já considera modoAUM) — em Galápagos a meta é
    // descontada do legado para alinhar com o card Meta AUM ao lado.
    let incrementoMeta = 0;
    const temMeta = metaAUM && metaAjustadaValor > 0;
    if (temMeta) {
      const [anoAlvo, mesAlvo] = metaAUM.data_alvo.split('-').map(Number);
      const pAlvo = pNum(anoAlvo, mesAlvo);
      const mesesTotais = pAlvo - periodoInicio;
      if (mesesTotais > 0) incrementoMeta = (metaAjustadaValor - aumInicial) / mesesTotais;
    }

    // Indexa série MM6 por (ano, mes) para lookup O(1) na fase de projeção.
    const mm6PorChave = new Map<string, number>();
    for (const m of serieAumProjetadaMM6 ?? []) {
      mm6PorChave.set(`${m.ano}-${String(m.mes).padStart(2, '0')}`, m.pl);
    }
    const usaMM6 = mm6PorChave.size > 0;

    // Fallback MM3 — usado quando série MM6 não está disponível (ex: dados
    // ainda carregando do useEffect async). Extrapolação linear da diferença
    // média de PL dos últimos 3 pontos. Modelo simples, não decompõe NNM/rent.
    let crescMedioMM3 = 0;
    if (!usaMM6) {
      const ultimos3 = dados.slice(-3);
      if (ultimos3.length >= 2) {
        const diffs: number[] = [];
        for (let i = 1; i < ultimos3.length; i++) {
          diffs.push(ultimos3[i].pl_total - ultimos3[i - 1].pl_total);
        }
        crescMedioMM3 = diffs.reduce((s, v) => s + v, 0) / diffs.length;
      }
    }

    // Fase 1: meses realizados
    const resultado: PontoGrafico[] = dados.map(d => {
      const mesesDesdeInicio = pNum(d.ano, d.mes) - periodoInicio;
      const trajMeta = temMeta ? aumInicial + incrementoMeta * mesesDesdeInicio : null;
      return { periodo: d.periodo, aum: d.pl_total, aumProjetado: null, trajetoriaMeta: trajMeta };
    });

    // Ponto de conexão: último realizado também tem projeção
    if (ultimoRealP < fimPeriodo && resultado.length > 0) {
      resultado[resultado.length - 1].aumProjetado = aumFinal;
    }

    // Fase 2: meses projetados
    if (ultimoRealP < fimPeriodo) {
      let aumProjMM3 = aumFinal;
      for (let p = ultimoRealP + 1; p <= fimPeriodo; p++) {
        const anoP = Math.floor((p - 1) / 12);
        const mesP = ((p - 1) % 12) + 1;
        const chave = `${anoP}-${String(mesP).padStart(2, '0')}`;
        const aumProj = usaMM6
          ? (mm6PorChave.get(chave) ?? aumFinal)
          : (aumProjMM3 += crescMedioMM3, aumProjMM3);
        const mesesDesdeInicio = p - periodoInicio;
        const trajMeta = temMeta ? aumInicial + incrementoMeta * mesesDesdeInicio : null;

        resultado.push({
          periodo: `${MESES_LABEL[mesP - 1]}/${String(anoP).slice(2)}`,
          aum: null,
          aumProjetado: aumProj,
          trajetoriaMeta: trajMeta,
        });
      }
    }

    return resultado;
  }, [dados, metaAUM, metaAjustadaValor, aumInicial, aumFinal, mesFim, anoFim, serieAumProjetadaMM6]);

  const usaMM6 = (serieAumProjetadaMM6?.length ?? 0) > 0;

  const temMeta = pontos.some(p => p.trajetoriaMeta != null);
  const temProjecao = pontos.some(p => p.aumProjetado != null);
  const aumProjetadoFinal = pontos[pontos.length - 1]?.aumProjetado;

  return (
    <div className="bg-white rounded-lg border p-5" style={{ borderColor: '#e2e2e8' }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>Trajetoria do AUM</h4>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            Evolucao patrimonial + projecao ({usaMM6 ? 'MM6 + CDI projetado' : 'media movel 3m'})
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 my-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#94a3b8' }} />
          <span className="text-xs" style={{ color: '#6b6b8a' }}>
            Inicio: <strong style={{ color: '#160F41' }}>{formatCurrency(aumInicial, true)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0065FF' }} />
          <span className="text-xs" style={{ color: '#6b6b8a' }}>
            Atual: <strong style={{ color: '#160F41' }}>{formatCurrency(aumFinal, true)}</strong>
          </span>
        </div>
        <span className="text-xs font-bold" style={{ color: variacao >= 0 ? '#16a34a' : '#dc2626' }}>
          {variacao >= 0 ? '+' : ''}{formatCurrency(variacao, true)} ({variacaoPct >= 0 ? '+' : ''}{variacaoPct.toFixed(1)}%)
        </span>
        {temProjecao && aumProjetadoFinal != null && (
          <span className="text-xs" style={{ color: '#6b6b8a' }}>
            Proj. fim: <strong style={{ color: '#7c3aed' }}>{formatCurrency(aumProjetadoFinal, true)}</strong>
          </span>
        )}
        {metaAUM && (
          <span className="text-xs" style={{ color: '#6b6b8a' }}>
            Meta: <strong style={{ color: '#D000BB' }}>{formatCurrency(metaAjustadaValor, true)}</strong>
            <span className="ml-1">(faltam {formatCurrency(Math.max(0, metaAjustadaValor - aumFinal), true)})</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
          NNM: {formatCurrency(totais.nnm_mes, true)}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
          Rent: {formatCurrency(totais.rent_total_brl, true)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={pontos} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="aumGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0065FF" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#0065FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
          <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b6b8a' }} />
          <YAxis tick={{ fontSize: 11, fill: '#6b6b8a' }} tickFormatter={fmtCompacto} />
          <Tooltip
            formatter={(value, name) => {
              if (value == null) return ['-', ''];
              const labels: Record<string, string> = { aum: 'AUM Real', aumProjetado: 'AUM Projetado', trajetoriaMeta: 'Trajetoria Meta' };
              return [formatCurrency(Number(value)), labels[name as string] ?? name];
            }}
            labelStyle={{ color: '#160F41', fontWeight: 600 }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }}
            formatter={(v: string) => {
              const labels: Record<string, string> = {
                aum: 'AUM Real',
                aumProjetado: usaMM6 ? 'Proj. (MM6)' : 'Proj. (MM3)',
                trajetoriaMeta: 'Meta',
              };
              return labels[v] ?? v;
            }} />
          <Area type="monotone" dataKey="aum" name="aum"
            stroke="#0065FF" strokeWidth={2.5} fill="url(#aumGradient)"
            dot={{ r: 3, fill: '#0065FF' }} activeDot={{ r: 5 }} connectNulls={false} />
          {temProjecao && (
            <Line type="monotone" dataKey="aumProjetado" name="aumProjetado"
              stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3"
              dot={{ r: 2, fill: '#7c3aed' }} connectNulls />
          )}
          {temMeta && (
            <Line type="monotone" dataKey="trajetoriaMeta" name="trajetoriaMeta"
              stroke="#D000BB" strokeWidth={2} strokeDasharray="8 4"
              dot={false} connectNulls />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
