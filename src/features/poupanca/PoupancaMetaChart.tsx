// --- Gráfico "Dinâmica do Crescimento" — 3 visões via toggle ---

import { useMemo, useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import type { PontoMetaCumprimento, DadosProjecao, MetaAUM } from './usePoupanca';
import { buscarCDIProjetado } from '../../services/cdiProjetado';

interface Props {
  dados: PontoMetaCumprimento[];
  dadosProjecao: DadosProjecao | null;
  metaAUM: MetaAUM | null;
  mesFim: number;
  anoFim: number;
}

type VisaoGrafico = 'mensal' | 'acumulado' | 'projecao';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtCompacto(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
}

function pNum(a: number, m: number) { return a * 12 + m; }

// ============================================================
// Dados por visão
// ============================================================

interface PontoMensal { periodo: string; nnm: number; rentabilidade: number; meta: number | null; }
interface PontoAcumulado { periodo: string; nnmAcum: number; metaAcum: number | null; organicoAcum: number; }
interface PontoProjecao { periodo: string; organicoAcum: number; projConservadora: number | null; projPotencial: number | null; projetado: boolean; }

export function PoupancaMetaChart({ dados, dadosProjecao, mesFim, anoFim }: Props) {
  const [visao, setVisao] = useState<VisaoGrafico>('mensal');
  const [cdiProjetados, setCdiProjetados] = useState<Map<string, number>>(new Map());

  // Buscar CDI projetado para meses futuros (só para projeção)
  useEffect(() => {
    if (!dadosProjecao) return;
    let cancelado = false;
    const { ultimoMesRealizado } = dadosProjecao;
    const fimPeriodo = pNum(anoFim, mesFim);
    const inicioProj = pNum(ultimoMesRealizado.ano, ultimoMesRealizado.mes) + 1;
    const mesesFuturos: { ano: number; mes: number }[] = [];
    for (let p = inicioProj; p <= fimPeriodo; p++) {
      mesesFuturos.push({ ano: Math.floor((p - 1) / 12), mes: ((p - 1) % 12) + 1 });
    }
    if (mesesFuturos.length === 0) return;
    Promise.allSettled(
      mesesFuturos.map(async ({ ano, mes }) => {
        const val = await buscarCDIProjetado(ano, mes);
        return { chave: `${ano}-${String(mes).padStart(2, '0')}`, val };
      }),
    ).then(results => {
      if (cancelado) return;
      const mapa = new Map<string, number>();
      for (const r of results) if (r.status === 'fulfilled') mapa.set(r.value.chave, r.value.val);
      setCdiProjetados(mapa);
    });
    return () => { cancelado = true; };
  }, [dadosProjecao, mesFim, anoFim]);

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
  const dadosProjecaoGrafico = useMemo<PontoProjecao[]>(() => {
    if (dados.length === 0) return [];

    let acumOrg = 0;
    const realizados: PontoProjecao[] = dados.map(d => {
      acumOrg += d.poupancaLiquida + d.rentabilidade;
      return { periodo: d.periodo, organicoAcum: acumOrg, projConservadora: null, projPotencial: null, projetado: false };
    });

    if (!dadosProjecao) return realizados;
    const { ultimoMesRealizado, mediaOrganicoMensal, capacidadePoupancaTotal, aumAtual } = dadosProjecao;
    const fimPeriodo = pNum(anoFim, mesFim);
    const ultimoRealP = pNum(ultimoMesRealizado.ano, ultimoMesRealizado.mes);
    if (ultimoRealP >= fimPeriodo) return realizados;

    // Ponto de conexão
    if (realizados.length > 0) {
      realizados[realizados.length - 1].projConservadora = acumOrg;
      realizados[realizados.length - 1].projPotencial = acumOrg;
    }

    let acumCons = acumOrg, acumPot = acumOrg, aumProj = aumAtual;
    const projetados: PontoProjecao[] = [];
    for (let p = ultimoRealP + 1; p <= fimPeriodo; p++) {
      const anoP = Math.floor((p - 1) / 12);
      const mesP = ((p - 1) % 12) + 1;
      const chave = `${anoP}-${String(mesP).padStart(2, '0')}`;
      const cdiMes = cdiProjetados.get(chave) ?? 0.01;
      acumCons += mediaOrganicoMensal;
      const rentPot = aumProj * cdiMes;
      acumPot += capacidadePoupancaTotal + rentPot;
      aumProj += capacidadePoupancaTotal + rentPot;
      projetados.push({
        periodo: `${MESES_LABEL[mesP - 1]}/${String(anoP).slice(2)}`,
        organicoAcum: acumCons,
        projConservadora: acumCons,
        projPotencial: acumPot,
        projetado: true,
      });
    }
    return [...realizados, ...projetados];
  }, [dados, dadosProjecao, cdiProjetados, mesFim, anoFim]);

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
  const temProjecao = dadosProjecaoGrafico.some(p => p.projetado);

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
            {visao === 'projecao' && 'Organico acumulado + projecoes (conservadora vs potencial)'}
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
            <span className="text-xs" style={{ color: '#6b6b8a' }}>Organico atual: <strong style={{ color: '#7c3aed' }}>{formatCurrency(resumo.organicoTotal, true)}</strong></span>
            {temProjecao && (
              <>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}>Conservadora: media historica</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>Potencial: cap. poupanca + CDI</span>
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
          <ComposedChart data={dadosProjecaoGrafico} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
            <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b6b8a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b6b8a' }} tickFormatter={fmtCompacto} />
            <Tooltip formatter={(value, name) => {
              if (value == null) return ['-', ''];
              const l: Record<string, string> = { organicoAcum: 'Organico acum.', projConservadora: 'Proj. conservadora', projPotencial: 'Proj. potencial' };
              return [formatCurrency(Number(value)), l[name as string] ?? name];
            }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => ({ organicoAcum: 'Organico', projConservadora: 'Conservadora', projPotencial: 'Potencial' }[v] ?? v)} />
            <Line type="monotone" dataKey="organicoAcum" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 2, fill: '#7c3aed' }} connectNulls />
            {temProjecao && (
              <Line type="monotone" dataKey="projConservadora" stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
            )}
            {temProjecao && (
              <Line type="monotone" dataKey="projPotencial" stroke="#059669" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
