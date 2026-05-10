// --- Gráfico "Dinâmica do Crescimento" — 3 visões via toggle ---

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import type { PontoMetaCumprimento, MetaAUM } from './usePoupanca';

interface SeriePontoPL { ano: number; mes: number; pl: number }

interface Props {
  dados: PontoMetaCumprimento[];
  metaAUM: MetaAUM | null;
  // ── Aba Projeção: 3 cenários estratégicos ──────────────────────
  // Todos vêm prontos do usePoupanca, calculados em benchmark puro
  // (CDI onshore + Fed Funds offshore). Aqui só agregamos junto da
  // série histórica de orgânico para alimentar o ComposedChart.
  serieAumOrganicoEsperado: SeriePontoPL[];   // Cenário 1 — capacidade + fallback MM6
  serieAumRitmoAtual: SeriePontoPL[];         // Cenário 3 — MM6 NNM líquido
  serieMetaTrajetoria: SeriePontoPL[];        // Cenário 2 — interpolação linear até a meta
  coberturaCapacidade: { x: number; y: number; pct: number };
}

type VisaoGrafico = 'mensal' | 'acumulado' | 'projecao';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtCompacto(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
}

// ============================================================
// Dados por visão
// ============================================================

interface PontoMensal { periodo: string; nnm: number; rentabilidade: number; meta: number | null; }
interface PontoAcumulado { periodo: string; nnmAcum: number; metaAcum: number | null; organicoAcum: number; }
// Visão Projeção: 4 séries plotadas mês a mês (uma linha sólida + 3 cenários).
interface PontoProjecaoCenarios {
  periodo: string;
  historico: number | null;          // PL real (linha sólida)
  cenarioOrganico: number | null;    // Cenário 1 (azul)
  cenarioMeta: number | null;        // Cenário 2 (cinza)
  cenarioRitmo: number | null;       // Cenário 3 (vermelho)
}

export function PoupancaMetaChart({ dados, serieAumOrganicoEsperado, serieAumRitmoAtual, serieMetaTrajetoria, coberturaCapacidade }: Props) {
  const [visao, setVisao] = useState<VisaoGrafico>('mensal');

  // ── Dados MENSAL ──
  const dadosMensal = useMemo<PontoMensal[]>(() =>
    dados.map(d => ({ periodo: d.periodo, nnm: d.nnm, rentabilidade: d.rentabilidade, meta: d.meta || null })),
  [dados]);

  // ── Dados ACUMULADO ──
  const dadosAcumulado = useMemo<PontoAcumulado[]>(() => {
    let acumNnm = 0, acumMeta = 0, acumOrg = 0;
    return dados.map(d => {
      acumNnm += d.nnm;
      acumMeta += d.meta || 0;
      acumOrg += d.poupancaLiquida + d.rentabilidade;
      return { periodo: d.periodo, nnmAcum: acumNnm, metaAcum: d.meta ? acumMeta : null, organicoAcum: acumOrg };
    });
  }, [dados]);

  // ── Dados PROJEÇÃO ──
  // Constrói a tabela de pontos por mês unificando as 4 séries:
  //   - histórico: AUM real reconstruído mês a mês como acumOrg + AUM_inicial
  //     (não vem direto, mas o gráfico mostra apenas a curva de PL — então
  //     usaremos os pontos de cenarioMeta no histórico como base do AUM real
  //     porque a meta ALINHA com o início do período + alvo).
  //
  // Para evitar reconstrução frágil, exibimos só as 3 curvas projetadas — o
  // histórico do AUM já está no PoupancaChart logo acima. Esta aba foca nos
  // cenários estratégicos forward-looking.
  const dadosProjecaoCenarios = useMemo<PontoProjecaoCenarios[]>(() => {
    // Indexa cada cenário por chave "YYYY-MM" para união O(1).
    const idx = (s: SeriePontoPL[]) => {
      const m = new Map<string, number>();
      for (const p of s) m.set(`${p.ano}-${String(p.mes).padStart(2, '0')}`, p.pl);
      return m;
    };
    const iOrg = idx(serieAumOrganicoEsperado);
    const iMeta = idx(serieMetaTrajetoria);
    const iRitmo = idx(serieAumRitmoAtual);
    // União das chaves de todos os cenários — garante que o eixo X cubra
    // qualquer cenário ativo (cenário 2 começa no início do período; 1 e 3
    // começam no AUM atual).
    const chaves = new Set<string>([...iOrg.keys(), ...iMeta.keys(), ...iRitmo.keys()]);
    const ordenadas = Array.from(chaves).sort();
    return ordenadas.map(chave => {
      const [a, m] = chave.split('-').map(Number);
      return {
        periodo: `${MESES_LABEL[m - 1]}/${String(a).slice(2)}`,
        historico: null,
        cenarioOrganico: iOrg.get(chave) ?? null,
        cenarioMeta: iMeta.get(chave) ?? null,
        cenarioRitmo: iRitmo.get(chave) ?? null,
      };
    });
  }, [serieAumOrganicoEsperado, serieMetaTrajetoria, serieAumRitmoAtual]);

  // ── Resumo ──
  const resumo = useMemo(() => {
    const meses = dados.length;
    const nnmTotal = dados.reduce((s, d) => s + d.nnm, 0);
    const tombTotal = dados.reduce((s, d) => s + d.tombamento, 0);
    const poupLiqTotal = dados.reduce((s, d) => s + d.poupancaLiquida, 0);
    const rentTotal = dados.reduce((s, d) => s + d.rentabilidade, 0);
    const organicoTotal = poupLiqTotal + rentTotal;
    const nnmMedia = meses > 0 ? nnmTotal / meses : 0;
    const metaTotalAcum = dados.reduce((s, d) => s + (d.meta || 0), 0);
    const pctMeta = metaTotalAcum > 0 ? (nnmTotal / metaTotalAcum) * 100 : null;
    return { meses, nnmTotal, tombTotal, poupLiqTotal, rentTotal, organicoTotal, nnmMedia, metaTotalAcum, pctMeta };
  }, [dados]);

  const temMeta = dados.some(d => d.meta > 0);
  const temProjecao = dadosProjecaoCenarios.length > 0;
  // Cor do badge de cobertura — gradação por faixa de pct.
  const corCobertura = coberturaCapacidade.pct >= 80
    ? { bg: '#dcfce7', fg: '#15803d' }
    : coberturaCapacidade.pct >= 50
      ? { bg: '#fef3c7', fg: '#b45309' }
      : { bg: '#fee2e2', fg: '#b91c1c' };

  if (dados.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-sm"
        style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
        Nenhum dado disponivel para o periodo selecionado.
      </div>
    );
  }

  const VISOES: { id: VisaoGrafico; label: string }[] = [
    { id: 'mensal', label: 'Mensal' },
    { id: 'acumulado', label: 'Acumulado' },
    { id: 'projecao', label: 'Projecao' },
  ];

  return (
    <div className="bg-white rounded-lg border p-5" style={{ borderColor: '#e2e2e8' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>Dinamica do Crescimento</h4>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            {visao === 'mensal' && 'NNM + Rentabilidade vs Meta mensal'}
            {visao === 'acumulado' && 'NNM acumulado vs Meta acumulada + Organico'}
            {visao === 'projecao' && '3 cenarios estrategicos: Organico Esperado, Trajetoria da Meta, Ritmo Atual'}
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
          {VISOES.map(v => (
            <button key={v.id} onClick={() => setVisao(v.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${visao === v.id ? 'bg-gradient-brand text-white' : ''}`}
              style={visao !== v.id ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo contextualizado */}
      <div className="flex flex-wrap gap-3 mb-3">
        {visao === 'mensal' && (
          <>
            <span className="text-xs" style={{ color: '#6b6b8a' }}>NNM medio: <strong style={{ color: '#160F41' }}>{formatCurrency(resumo.nnmMedia, true)}/mes</strong></span>
            {temMeta && resumo.pctMeta != null && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: resumo.pctMeta >= 100 ? '#dcfce7' : '#fee2e2', color: resumo.pctMeta >= 100 ? '#16a34a' : '#dc2626' }}>
                {resumo.pctMeta.toFixed(0)}% da meta NNM
              </span>
            )}
          </>
        )}
        {visao === 'acumulado' && (
          <>
            <span className="text-xs" style={{ color: '#6b6b8a' }}>NNM acum.: <strong style={{ color: '#0065FF' }}>{formatCurrency(resumo.nnmTotal, true)}</strong></span>
            {temMeta && <span className="text-xs" style={{ color: '#6b6b8a' }}>Meta acum.: <strong style={{ color: '#f59e0b' }}>{formatCurrency(resumo.metaTotalAcum, true)}</strong></span>}
            <span className="text-xs" style={{ color: '#6b6b8a' }}>Organico: <strong style={{ color: '#7c3aed' }}>{formatCurrency(resumo.organicoTotal, true)}</strong></span>
          </>
        )}
        {visao === 'projecao' && (
          <>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: corCobertura.bg, color: corCobertura.fg }}
              title="Capacidade cadastrada manualmente em cada cliente. Quando ausente, a projeção usa MM6 NNM líquido como fallback.">
              Capacidade cadastrada: {coberturaCapacidade.x} de {coberturaCapacidade.y} clientes ({coberturaCapacidade.pct.toFixed(0)}%)
            </span>
            {temProjecao && (
              <>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>Organico Esperado</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>Trajetoria da Meta</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>Ritmo Atual</span>
              </>
            )}
          </>
        )}
      </div>

      {/* ── VISÃO MENSAL ── */}
      {visao === 'mensal' && (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dadosMensal} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
            <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b6b8a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b6b8a' }} tickFormatter={fmtCompacto} />
            <Tooltip formatter={(value, name) => {
              if (value == null) return ['-', ''];
              const l: Record<string, string> = { nnm: 'NNM', rentabilidade: 'Rent.', meta: 'Meta NNM' };
              return [formatCurrency(Number(value)), l[name as string] ?? name];
            }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => ({ nnm: 'NNM', rentabilidade: 'Rentabilidade', meta: 'Meta NNM/mes' }[v] ?? v)} />
            <Bar dataKey="nnm" stackId="cresc" fill="#0065FF" radius={[0, 0, 0, 0]} />
            <Bar dataKey="rentabilidade" stackId="cresc" fill="#16a34a" radius={[4, 4, 0, 0]} />
            {temMeta && (
              <Line type="monotone" dataKey="meta" stroke="#f59e0b" strokeWidth={2} strokeDasharray="8 4" dot={false} connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* ── VISÃO ACUMULADO ── */}
      {visao === 'acumulado' && (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dadosAcumulado} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
            <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b6b8a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b6b8a' }} tickFormatter={fmtCompacto} />
            <Tooltip formatter={(value, name) => {
              if (value == null) return ['-', ''];
              const l: Record<string, string> = { nnmAcum: 'NNM acumulado', metaAcum: 'Meta acumulada', organicoAcum: 'Organico acum.' };
              return [formatCurrency(Number(value)), l[name as string] ?? name];
            }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => ({ nnmAcum: 'NNM acum.', metaAcum: 'Meta acum.', organicoAcum: 'Organico acum.' }[v] ?? v)} />
            <Line type="monotone" dataKey="nnmAcum" stroke="#0065FF" strokeWidth={2.5} dot={{ r: 3, fill: '#0065FF' }} />
            {temMeta && (
              <Line type="monotone" dataKey="metaAcum" stroke="#f59e0b" strokeWidth={2} strokeDasharray="8 4" dot={false} connectNulls />
            )}
            <Line type="monotone" dataKey="organicoAcum" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2, fill: '#7c3aed' }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* ── VISÃO PROJEÇÃO ── */}
      {visao === 'projecao' && (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dadosProjecaoCenarios} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
            <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b6b8a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b6b8a' }} tickFormatter={fmtCompacto} />
            <Tooltip formatter={(value, name) => {
              if (value == null) return ['-', ''];
              const l: Record<string, string> = {
                cenarioOrganico: 'Organico Esperado',
                cenarioMeta: 'Trajetoria da Meta',
                cenarioRitmo: 'Ritmo Atual',
              };
              return [formatCurrency(Number(value)), l[name as string] ?? name];
            }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => ({
              cenarioOrganico: 'Organico Esperado',
              cenarioMeta: 'Trajetoria da Meta',
              cenarioRitmo: 'Ritmo Atual',
            }[v] ?? v)} />
            {/* Cenário 1 — Orgânico Esperado (azul, tracejada) */}
            <Line type="monotone" dataKey="cenarioOrganico" stroke="#3b82f6" strokeWidth={2}
              strokeDasharray="6 3" dot={{ r: 2, fill: '#3b82f6' }} connectNulls />
            {/* Cenário 2 — Trajetória da Meta (cinza, pontilhada) */}
            <Line type="monotone" dataKey="cenarioMeta" stroke="#9ca3af" strokeWidth={2}
              strokeDasharray="2 4" dot={false} connectNulls />
            {/* Cenário 3 — Ritmo Atual (vermelho, tracejada) */}
            <Line type="monotone" dataKey="cenarioRitmo" stroke="#ef4444" strokeWidth={2}
              strokeDasharray="6 3" dot={{ r: 2, fill: '#ef4444' }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
