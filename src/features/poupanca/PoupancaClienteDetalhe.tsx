// --- Detalhe por cliente (CDI acumulado, toggle visão, edição inline) ---

import { useMemo, useEffect, useState, useCallback } from 'react';
import { X, Loader2, Target, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Flag, AlertTriangle } from 'lucide-react';
import type { RegistroPoupanca } from '../../types';
import { buscarCDIMensal } from '../../services/cdi';
import { buscarFedFundsRate } from '../../services/fedFundsRate';
import { ultimoDiaDoMes } from '../../services/diasUteis';
import { calcularAcumulado, alinharCDI } from '../../utils/acumulado';
import { pickR, calcOffshore } from './DetalheTabela';
import { siglaReal, formatCurrency } from '../../utils/formatters';
import { DetalheGrafico } from './DetalheGrafico';
import { DetalheTabela } from './DetalheTabela';
import { DetalheMetaLote } from './DetalheMetaLote';
import type { Visao } from './PoupancaTabela';
import { ExportButton } from '../../components/ui/ExportButton';
import { exportClienteAumExcel } from '../../utils/exporters/exportExcel';
import { exportClienteAumPdf } from '../../utils/exporters/exportPdf';
import { nnmRealOnshore, nnmRealOffshore } from '../../utils/financials';

interface Props {
  registros: RegistroPoupanca[];
  /** nome→sigla do mapeamento_siglas (Firestore) — sigla real do badge. */
  mapaSiglas?: Map<string, string>;
  onFechar: () => void;
  // Navegação entre clientes na ordem da tabela
  temAnterior?: boolean;
  temProximo?: boolean;
  posicaoTexto?: string;  // ex: "5/70"
  onNavegar?: (direcao: 'anterior' | 'proximo') => void;
  // Marcação de revisão (cliente-level)
  marcadoRevisao?: boolean;
  onToggleRevisaoCliente?: () => void;
  // Toggle de mês individual (passa pra DetalheTabela)
  onToggleRevisaoMes?: (ano: number, mes: number, estadoAtual: boolean) => Promise<boolean>;
}

export interface LinhaDetalhe {
  periodo: string; r: RegistroPoupanca; idx: number; ganhoCambial: number | null;
  // Sinaliza quando o GC veio do fallback clássico por anomalia estrutural
  // (mês faltando / transferência interna) — câmbio não confiável, revisar.
  gcAnomalia?: boolean; gcAnomaliaReason?: string | null;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function PoupancaClienteDetalhe({
  registros: registrosIniciais,
  mapaSiglas,
  onFechar,
  temAnterior = false,
  temProximo = false,
  posicaoTexto = '',
  onNavegar,
  marcadoRevisao = false,
  onToggleRevisaoCliente,
  onToggleRevisaoMes,
}: Props) {
  const [registrosLocal, setRegistrosLocal] = useState(registrosIniciais);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cdiPorMes, setCdiPorMes] = useState<Record<string, number | null>>({});
  const [fedPorMes, setFedPorMes] = useState<Record<string, number | null>>({});
  // Valores "cheios" do mês (para tooltip de comparação pro-rata vs mês cheio).
  const [cdiCheioPorMes, setCdiCheioPorMes] = useState<Record<string, number | null>>({});
  const [fedCheioPorMes, setFedCheioPorMes] = useState<Record<string, number | null>>({});
  const [cdiLoading, setCdiLoading] = useState(false);
  const [visao, setVisao] = useState<Visao>('consolidado');
  const [mostrarMetaLote, setMostrarMetaLote] = useState(false);
  const aberto = registrosLocal.length > 0;
  const nome = aberto ? registrosLocal[0].nome_cliente : '';
  const sigla = aberto ? siglaReal(nome, mapaSiglas) : null;
  // Verifica se o cliente tem dados offshore/onshore em algum mês
  const temOffshore = registrosLocal.some(r =>
    (r.pl_offshore ?? 0) > 0.01 || (r.pl_offshore_usd ?? 0) > 0.01,
  );
  const temOnshore = registrosLocal.some(r =>
    (r.pl_onshore ?? 0) > 0.01 || (r.pl_inicial_onshore ?? 0) > 0.01,
  );

  // Auto-selecionar visão ao abrir: offshore-only abre em offshore, senão consolidado
  useEffect(() => {
    setRegistrosLocal(registrosIniciais);
    setEditIdx(null);
    if (registrosIniciais.length > 0) {
      const hasOn = registrosIniciais.some(r => (r.pl_onshore ?? 0) > 0.01 || (r.pl_inicial_onshore ?? 0) > 0.01);
      const hasOff = registrosIniciais.some(r => (r.pl_offshore ?? 0) > 0.01 || (r.pl_offshore_usd ?? 0) > 0.01);
      if (!hasOn && hasOff) setVisao('offshore');
      else setVisao('consolidado');
    } else {
      setVisao('consolidado');
    }
  }, [registrosIniciais]);
  useEffect(() => {
    if (aberto) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCdiLoading(true);

    // Recorte por mês: usa dia_inicio/dia_corte do registro para pro-rata justo.
    // Mês cheio mantém comportamento original (sem diaIni/diaFim).
    const info = new Map<string, { a: number; m: number; diaIni?: number; diaFim?: number; parcial: boolean }>();
    for (const r of registrosLocal) {
      const chave = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      if (info.has(chave)) continue;
      const ult = ultimoDiaDoMes(r.ano, r.mes);
      const diaIni = r.dia_inicio != null && r.dia_inicio > 1 ? r.dia_inicio : undefined;
      const diaFim = r.dia_corte != null && r.dia_corte < ult ? r.dia_corte : undefined;
      info.set(chave, { a: r.ano, m: r.mes, diaIni, diaFim, parcial: diaIni != null || diaFim != null });
    }

    const cdiPromise = Promise.allSettled(
      [...info.entries()].map(async ([chave, { a, m, diaIni, diaFim, parcial }]) => {
        const cheio = await buscarCDIMensal(a, m);
        const val = parcial ? await buscarCDIMensal(a, m, diaIni, diaFim) : cheio;
        return { chave, val, cheio };
      }),
    );
    const fedPromise = Promise.allSettled(
      [...info.entries()].map(async ([chave, { a, m, diaIni, diaFim, parcial }]) => {
        const cheio = await buscarFedFundsRate(a, m);
        const val = parcial ? await buscarFedFundsRate(a, m, diaIni, diaFim) : cheio;
        return { chave, val, cheio };
      }),
    );

    Promise.all([cdiPromise, fedPromise]).then(([cdiResults, fedResults]) => {
      if (cancelado) return;
      const mapaCdi: Record<string, number | null> = {};
      const mapaCdiCheio: Record<string, number | null> = {};
      for (const r of cdiResults) if (r.status === 'fulfilled') {
        mapaCdi[r.value.chave] = r.value.val;
        mapaCdiCheio[r.value.chave] = r.value.cheio;
      }
      setCdiPorMes(mapaCdi);
      setCdiCheioPorMes(mapaCdiCheio);

      const mapaFed: Record<string, number | null> = {};
      const mapaFedCheio: Record<string, number | null> = {};
      for (const r of fedResults) if (r.status === 'fulfilled') {
        mapaFed[r.value.chave] = r.value.val;
        mapaFedCheio[r.value.chave] = r.value.cheio;
      }
      setFedPorMes(mapaFed);
      setFedCheioPorMes(mapaFedCheio);
    }).finally(() => { if (!cancelado) setCdiLoading(false); });
    return () => { cancelado = true; };
  }, [registrosLocal, aberto]);

  const sortedAsc = useMemo(() => {
    const sorted = [...registrosLocal].sort((a, b) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes));
    // Filtrar meses vazios conforme a visão ativa (usa apenas campos da visão)
    const T = 0.01;
    return sorted.filter(r => {
      if (visao === 'offshore') {
        return Math.abs(r.pl_offshore_usd ?? 0) > T
          || Math.abs(r.pl_inicial_offshore ?? 0) > T
          || Math.abs(r.aporte_mes_offshore ?? 0) > T;
      }
      if (visao === 'onshore') {
        return Math.abs(r.pl_onshore ?? 0) > T
          || Math.abs(r.pl_inicial_onshore ?? 0) > T
          || Math.abs(r.aporte_mes_onshore ?? 0) > T;
      }
      // Consolidado
      return Math.abs(r.pl_total ?? 0) > T
        || Math.abs(r.pl_inicial_total ?? 0) > T
        || Math.abs(r.aporte_mes_total ?? 0) > T;
    });
  }, [registrosLocal, visao]);

  // CDI ajustado: neutraliza o mês de entrada parcial do cliente.
  // Quando o cliente entra no meio do mês (pl_inicial ≈ 0 mas aporte > 0),
  // sua rentabilidade cobre menos dias que o CDI cheio → comparação injusta.
  // Setamos CDI = null nesse mês → spread mostra "—" em vez de negativo artificial.
  const cdiPorMesAjustado = useMemo(() => {
    if (sortedAsc.length === 0) return cdiPorMes;
    const primeiro = sortedAsc[0];
    const ehEntradaParcial =
      Math.abs(primeiro.pl_inicial_total ?? 0) < 1 &&
      Math.abs(primeiro.aporte_mes_total ?? 0) > 1;
    if (!ehEntradaParcial) return cdiPorMes;
    const chave = `${primeiro.ano}-${String(primeiro.mes).padStart(2, '0')}`;
    return { ...cdiPorMes, [chave]: null };
  }, [cdiPorMes, sortedAsc]);

  const linhas = useMemo<LinhaDetalhe[]>(() =>
    sortedAsc.map((r, i) => {
      const periodo = `${MESES[r.mes - 1]}/${String(r.ano).slice(2)}`;
      const prev = i > 0 ? sortedAsc[i - 1] : null;
      // Ganho cambial = resíduo que fecha a identidade BRL (com guard estrutural),
      // fonte única em calcOffshore — mesma do pickR e da tabela geral.
      const off = calcOffshore(r, prev);
      return { periodo, r, idx: i, ganhoCambial: off.gcBrl,
        gcAnomalia: off.gcAnomalia, gcAnomaliaReason: off.gcAnomaliaReason };
    }),
  [sortedAsc]);

  // Meta auto-fill por visão:
  // Usa todos os meses fechados (exclui mês atual + meses de tombamento puro).
  const metaAutoFillGlobal = useMemo(() => {
    const todos = [...registrosLocal].sort((a, b) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes));
    const hoje = new Date();
    const periodoAtual = hoje.getFullYear() * 12 + (hoje.getMonth() + 1);

    let somaLiqOn = 0, mesesOn = 0;
    let somaLiqOff = 0, mesesOff = 0;

    for (const r of todos) {
      // Excluir mês atual (não fechou)
      if (r.ano * 12 + r.mes >= periodoAtual) continue;

      // Excluir meses fantasma (todos os campos zerados)
      const T = 0.01;
      const plOn = Math.abs(r.pl_onshore ?? 0);
      const plOff = Math.abs(r.pl_offshore_usd ?? 0);
      const plIniOn = Math.abs(r.pl_inicial_onshore ?? 0);
      const plIniOff = Math.abs(r.pl_inicial_offshore ?? 0);
      const nnmOnR = Math.abs(r.aporte_mes_onshore ?? 0);
      const nnmOffR = Math.abs(r.aporte_mes_offshore ?? 0);
      if (plOn < T && plOff < T && plIniOn < T && plIniOff < T && nnmOnR < T && nnmOffR < T) continue;

      // NNM Real por dimensão (desconta transferência interna)
      const nnmOn = nnmRealOnshore(r);
      const nnmOff = nnmRealOffshore(r);

      // Tombamento por dimensão
      let tombOn: number, tombOff: number;
      if (r.nnm_tombamento_onshore != null || r.nnm_tombamento_offshore != null) {
        tombOn = r.nnm_tombamento_onshore ?? 0;
        tombOff = r.nnm_tombamento_offshore ?? 0;
      } else {
        const tomb = r.nnm_tombamento ?? 0;
        const absOn = Math.abs(nnmOn), absOff = Math.abs(nnmOff);
        const absTotal = absOn + absOff;
        tombOn = tomb > 0 && absTotal > 0.01 ? tomb * (absOn / absTotal) : 0;
        tombOff = tomb > 0 && absTotal > 0.01 ? tomb * (absOff / absTotal) : 0;
      }

      const ehTombOn = tombOn > 0 && Math.abs(nnmOn) > 0.01 && tombOn > Math.abs(nnmOn) * 0.8;
      const ehTombOff = tombOff > 0 && Math.abs(nnmOff) > 0.01 && tombOff > Math.abs(nnmOff) * 0.8;

      // Conta o mês na dimensão APENAS se tem atividade nessa dimensão
      const temOn = Math.abs(r.pl_onshore ?? 0) > T || Math.abs(r.pl_inicial_onshore ?? 0) > T || Math.abs(nnmOn) > T;
      const temOff = Math.abs(r.pl_offshore_usd ?? 0) > T || Math.abs(r.pl_inicial_offshore ?? 0) > T || Math.abs(nnmOff) > T;

      if (temOn && !ehTombOn) { somaLiqOn += nnmOn - tombOn; mesesOn++; }
      if (temOff && !ehTombOff) { somaLiqOff += nnmOff - tombOff; mesesOff++; }
    }

    const metaOn = mesesOn > 0 ? somaLiqOn / mesesOn : null;
    const metaOff = mesesOff > 0 ? somaLiqOff / mesesOff : null;
    if (visao === 'offshore') return metaOff;
    if (visao === 'onshore') return metaOn;
    if (metaOn != null && metaOff != null) return metaOn + metaOff;
    return metaOn ?? metaOff ?? null;
  }, [registrosLocal, visao]);

  // Benchmark muda conforme visao: offshore usa Fed Funds, demais usa CDI
  const benchmarkAtivo = visao === 'offshore' ? fedPorMes : cdiPorMesAjustado;
  const benchmarkNome = visao === 'offshore' ? 'Fed Funds' : 'CDI';

  // Métricas dos cards — usa pickR (mesma função da tabela) para garantir coerência
  const metricas = useMemo(() => {
    if (linhas.length === 0) return null;

    const retornos: (number | null)[] = [];
    let rentAbsoluta = 0;
    let bmAbsoluto = 0;

    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      const prevR = i > 0 ? linhas[i - 1].r : null;
      const d = pickR(l.r, visao, prevR);
      const chave = `${l.r.ano}-${String(l.r.mes).padStart(2, '0')}`;
      const bmMes = benchmarkAtivo[chave] ?? 0;

      retornos.push(d.rp);
      rentAbsoluta += d.rb;
      bmAbsoluto += bmMes * d.pi;
    }

    const rentAcum = calcularAcumulado(retornos);
    const rentAcumulada = rentAcum[rentAcum.length - 1];

    const meses = linhas.map(l => ({ ano: l.r.ano, mes: l.r.mes }));
    const bmMensal = alinharCDI(meses, benchmarkAtivo);
    const bmAcum = calcularAcumulado(bmMensal);
    const bmAcumulado = bmMensal.some(v => v != null) ? bmAcum[bmAcum.length - 1] : null;

    const spread = bmAcumulado != null ? rentAcumulada - bmAcumulado : null;
    const spreadAbsoluto = bmAbsoluto > 0 ? rentAbsoluta - bmAbsoluto : null;
    const pctBm = bmAcumulado != null && bmAcumulado !== 0 ? (rentAcumulada / bmAcumulado) * 100 : null;

    return { rentAcumulada, cdiAcumulado: bmAcumulado, spread, rentAbsoluta, cdiAbsoluto: bmAbsoluto, spreadAbsoluto, pctCdi: pctBm, numeroMeses: linhas.length };
  }, [linhas, benchmarkAtivo, visao]);

  // Meses até PL zerar (aplicável só quando capacidade < 0 e PL > 0).
  const mesesAteZerar = useMemo<number | null>(() => {
    if (sortedAsc.length === 0) return null;
    const ultimo = sortedAsc[sortedAsc.length - 1];
    const cap = ultimo.capacidade_poupanca_mensal;
    const pl = ultimo.pl_total ?? 0;
    if (cap == null || cap >= 0 || pl <= 0) return null;
    return Math.ceil(pl / Math.abs(cap));
  }, [sortedAsc]);

  // Info do período
  const periodoInfo = useMemo(() => {
    if (sortedAsc.length === 0) return '';
    const p = sortedAsc[0], u = sortedAsc[sortedAsc.length - 1];
    return `${MESES[p.mes - 1]}/${p.ano} — ${MESES[u.mes - 1]}/${u.ano} • ${sortedAsc.length} meses`;
  }, [sortedAsc]);

  const handleMetaLote = useCallback((atualizados: RegistroPoupanca[]) => {
    setRegistrosLocal(prev => prev.map(r => {
      const upd = atualizados.find(u => u.ano === r.ano && u.mes === r.mes);
      return upd ? { ...r, meta_poupanca_mensal: upd.meta_poupanca_mensal } : r;
    }));
    setMostrarMetaLote(false);
    setToast(`Meta aplicada em ${atualizados.length} meses`);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSalvo = useCallback((_idx: number, atualizado: RegistroPoupanca) => {
    setRegistrosLocal(prev => prev.map(r =>
      r.ano === atualizado.ano && r.mes === atualizado.mes && r.nome_cliente === atualizado.nome_cliente
        ? atualizado : r));
    setEditIdx(null);
    setToast('Registro atualizado');
    setTimeout(() => setToast(null), 3000);
  }, []);

  if (!aberto) return null;

  const TABS: { id: Visao; label: string; show: boolean }[] = [
    { id: 'consolidado', label: 'Consolidado', show: true },
    { id: 'onshore', label: 'Onshore', show: temOnshore },
    { id: 'offshore', label: 'Offshore', show: temOffshore },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-white shadow-2xl ring-1 ring-black/5 w-[96vw] max-w-[1500px] mx-4 max-h-[96vh] flex flex-col"
        style={{ borderRadius: 16 }}>
        {/* HEADER — dark brand */}
        <div className="flex items-center justify-between shrink-0" style={{ backgroundColor: '#160F41', borderRadius: '16px 16px 0 0', padding: '20px 28px' }}>
          <div className="flex items-center gap-4">
            {/* Setas de navegação anterior/próximo cliente */}
            {onNavegar && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onNavegar('anterior')}
                  disabled={!temAnterior}
                  title="Cliente anterior (na ordem da tabela)"
                  className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                  onMouseEnter={(e) => { if (temAnterior) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => onNavegar('proximo')}
                  disabled={!temProximo}
                  title="Próximo cliente (na ordem da tabela)"
                  className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                  onMouseEnter={(e) => { if (temProximo) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <div>
              <h2 className="text-white flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
                {sigla && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    color: '#94a3b8',
                  }}>
                    {sigla}
                  </span>
                )}
                {nome}
                {marcadoRevisao && (
                  <span title="Marcado para revisão" className="inline-flex">
                    <Flag size={14} style={{ color: '#fca5a5', fill: '#fca5a5' }} />
                  </span>
                )}
              </h2>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                {periodoInfo}
                {posicaoTexto && <span style={{ marginLeft: 8 }}>• {posicaoTexto}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle visão */}
            <div className="flex rounded-full p-1" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              {TABS.filter(t => t.show).map(t => (
                <button key={t.id} onClick={() => setVisao(t.id)}
                  className="px-3.5 py-1 rounded-full text-xs transition-all"
                  style={visao === t.id
                    ? { backgroundColor: '#fff', color: '#160F41', fontWeight: 600 }
                    : { color: 'rgba(255,255,255,0.7)' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={() => setMostrarMetaLote(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
              <Target size={13} /> Metas
            </button>
            {onToggleRevisaoCliente && (
              <button onClick={onToggleRevisaoCliente}
                title={marcadoRevisao ? 'Desmarcar revisão' : 'Marcar para revisão'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  backgroundColor: marcadoRevisao ? 'rgba(220,38,38,0.25)' : undefined,
                }}>
                <Flag size={13} style={{ fill: marcadoRevisao ? '#fca5a5' : 'transparent' }} />
                {marcadoRevisao ? 'Em revisão' : 'Revisão'}
              </button>
            )}
            {metricas && (
              <ExportButton
                variant="dark"
                onExportExcel={() => exportClienteAumExcel(
                  nome, linhas, periodoInfo, visao, benchmarkAtivo, metaAutoFillGlobal,
                )}
                onExportPdf={() => exportClienteAumPdf(
                  nome, linhas, periodoInfo, visao, benchmarkAtivo, metaAutoFillGlobal,
                  {
                    rentAcumulada: metricas.rentAcumulada,
                    cdiAcumulado: metricas.cdiAcumulado,
                    spread: metricas.spread,
                    rentAbsoluta: metricas.rentAbsoluta,
                  },
                )}
              />
            )}
            {cdiLoading && <Loader2 size={14} className="animate-spin" style={{ color: '#94a3b8' }} />}
            {toast && <span className="text-xs font-medium" style={{ color: toast.startsWith('Erro') ? '#fca5a5' : '#86efac' }}>{toast}</span>}
            <button onClick={onFechar} className="rounded-lg p-1 transition-colors hover:bg-white/10">
              <X size={20} style={{ color: '#fff' }} />
            </button>
          </div>
        </div>

        {/* BODY — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* MÉTRICAS RESUMIDAS */}
          {metricas && (
            <div className="mx-6 mt-4 mb-0 grid grid-cols-2 xl:grid-cols-4 gap-3">
              {/* Card 1 — Rent. Acumulada */}
              <div className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                <div className="absolute top-0 left-0 w-full" style={{ height: 3, background: 'linear-gradient(90deg, #0065FF, #0ea5e9)' }} />
                <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>Rent. Acumulada</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: metricas.rentAcumulada >= 0 ? '#16a34a' : '#dc2626' }}>
                  {(metricas.rentAcumulada * 100).toFixed(2)}%
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: metricas.rentAbsoluta >= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatCurrency(metricas.rentAbsoluta)}
                </p>
                <p style={{ fontSize: 10, color: '#94a3b8' }}>período completo</p>
                <div className="mt-2 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: '#e2e8f0' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(Math.abs(metricas.rentAcumulada) / 0.3, 1) * 100}%`, backgroundColor: '#0065FF' }} />
                </div>
              </div>

              {/* Card 2 — CDI Acumulado */}
              <div className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                <div className="absolute top-0 left-0 w-full" style={{ height: 3, backgroundColor: '#9ca3af' }} />
                <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>{benchmarkNome} Acumulado</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>
                  {metricas.cdiAcumulado != null ? `${(metricas.cdiAcumulado * 100).toFixed(2)}%` : '—'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                  {metricas.cdiAbsoluto > 0 ? formatCurrency(metricas.cdiAbsoluto) : '—'}
                </p>
                <p style={{ fontSize: 10, color: '#94a3b8' }}>benchmark do período</p>
                {metricas.cdiAcumulado != null && (
                  <div className="mt-2 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: '#e2e8f0' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(Math.abs(metricas.cdiAcumulado) / 0.3, 1) * 100}%`, backgroundColor: '#9ca3af' }} />
                  </div>
                )}
              </div>

              {/* Card 3 — Spread */}
              <div className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                <div className="absolute top-0 left-0 w-full" style={{ height: 3, backgroundColor: metricas.spread != null && metricas.spread >= 0 ? '#16a34a' : '#dc2626' }} />
                {metricas.spread != null && (
                  <div className="absolute" style={{ top: 12, right: 12 }}>
                    {metricas.spread >= 0
                      ? <TrendingUp size={14} style={{ color: '#16a34a' }} />
                      : <TrendingDown size={14} style={{ color: '#dc2626' }} />}
                  </div>
                )}
                <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>Spread</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: metricas.spread != null ? (metricas.spread >= 0 ? '#16a34a' : '#dc2626') : '#94a3b8' }}>
                  {metricas.spread != null ? `${metricas.spread >= 0 ? '+' : ''}${(metricas.spread * 100).toFixed(2)}%` : '—'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: metricas.spreadAbsoluto != null ? (metricas.spreadAbsoluto >= 0 ? '#16a34a' : '#dc2626') : '#94a3b8' }}>
                  {metricas.spreadAbsoluto != null
                    ? `${metricas.spreadAbsoluto >= 0 ? '+ ' : '- '}${formatCurrency(Math.abs(metricas.spreadAbsoluto))}`
                    : '—'}
                </p>
                <p style={{ fontSize: 10, color: '#94a3b8' }}>
                  {metricas.spread != null ? (metricas.spread >= 0 ? `acima do ${benchmarkNome}` : `abaixo do ${benchmarkNome}`) : '—'}
                </p>
              </div>

              {/* Card 4 — Rent. Absoluta */}
              <div className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                <div className="absolute top-0 left-0 w-full" style={{ height: 3, background: 'linear-gradient(90deg, #D000BB, #7c3aed)' }} />
                <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>Rent. Absoluta</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: metricas.rentAbsoluta >= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatCurrency(metricas.rentAbsoluta)}
                </p>
                <p style={{ fontSize: 10, color: '#94a3b8' }}>rendimento nominal acumulado</p>
                <p className="mt-1" style={{ fontSize: 12, fontWeight: 700, color: metricas.pctCdi != null ? (metricas.pctCdi >= 100 ? '#16a34a' : '#dc2626') : '#94a3b8' }}>
                  {metricas.pctCdi != null ? `% do ${benchmarkNome}: ${metricas.pctCdi.toFixed(1)}%` : `% do ${benchmarkNome}: —`}
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8' }}>
                  Período: {metricas.numeroMeses} {metricas.numeroMeses === 1 ? 'mês' : 'meses'}
                </p>
              </div>

              {/* Card 5 — Meses até zerar (só quando cliente queima) */}
              {mesesAteZerar != null && (
                <div className="relative overflow-hidden" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px' }}>
                  <div className="absolute top-0 left-0 w-full" style={{ height: 3, backgroundColor: '#991b1b' }} />
                  <div className="absolute" style={{ top: 12, right: 12 }}>
                    <AlertTriangle size={14} style={{ color: '#dc2626' }} />
                  </div>
                  <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#991b1b' }}>Meses até zerar</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#991b1b' }}>{mesesAteZerar}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#7f1d1d' }}>
                    {mesesAteZerar === 1 ? 'mês' : 'meses'}
                  </p>
                  <p style={{ fontSize: 10, color: '#94a3b8' }}>no ritmo atual</p>
                </div>
              )}
            </div>
          )}

          {mostrarMetaLote && (
            <div className="px-6 pt-4">
              <DetalheMetaLote registros={registrosLocal}
                onAplicado={handleMetaLote} onFechar={() => setMostrarMetaLote(false)} />
            </div>
          )}
          <div className="mx-6 mt-5 mb-2 rounded-xl p-4" style={{ backgroundColor: '#f8fafc' }}>
            <div className="mb-2">
              <span className="text-sm font-semibold" style={{ color: '#160F41' }}>Performance Acumulada </span>
              <span className="text-xs" style={{ color: '#6b6b8a' }}>vs {visao === 'offshore' ? 'Fed Funds' : 'CDI'}</span>
            </div>
            <DetalheGrafico linhas={linhas} cdiPorMes={visao === 'offshore' ? fedPorMes : cdiPorMesAjustado} visao={visao} />
          </div>
          <div className="mx-6 mb-6">
            <DetalheTabela
              linhas={linhas}
              cdiPorMes={cdiPorMesAjustado}
              fedPorMes={fedPorMes}
              cdiCheioPorMes={cdiCheioPorMes}
              fedCheioPorMes={fedCheioPorMes}
              visao={visao}
              metaAutoFillGlobal={metaAutoFillGlobal}
              editIdx={editIdx}
              onEditIdx={setEditIdx}
              onSalvo={handleSalvo}
              onToggleRevisaoMes={async (ano, mes, estadoAtual) => {
                if (!onToggleRevisaoMes) return;
                try {
                  const novoEstado = await onToggleRevisaoMes(ano, mes, estadoAtual);
                  // Atualiza estado local com o novo valor
                  setRegistrosLocal(prev => prev.map(r =>
                    r.ano === ano && r.mes === mes
                      ? { ...r, revisao_pendente: novoEstado }
                      : r,
                  ));
                  setToast(novoEstado ? 'Mês marcado para revisão' : 'Marcação removida');
                  setTimeout(() => setToast(null), 2500);
                } catch (e) {
                  setToast('Erro ao salvar marcação');
                  setTimeout(() => setToast(null), 3000);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
