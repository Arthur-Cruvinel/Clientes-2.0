// --- Detalhe por cliente (CDI acumulado, toggle visão, edição inline) ---

import { useMemo, useEffect, useState, useCallback } from 'react';
import { X, Loader2, Target, TrendingUp, TrendingDown } from 'lucide-react';
import type { RegistroPoupanca } from '../../types';
import { buscarCDIMensal } from '../../services/cdi';
import { calcularAcumulado, alinharCDI } from '../../utils/acumulado';
import { formatCurrency } from '../../utils/formatters';
import { DetalheGrafico } from './DetalheGrafico';
import { DetalheTabela } from './DetalheTabela';
import { DetalheMetaLote } from './DetalheMetaLote';
import type { Visao } from './PoupancaTabela';
import { ExportButton } from '../../components/ui/ExportButton';
import { exportClienteAumExcel } from '../../utils/exporters/exportExcel';
import { exportClienteAumPdf } from '../../utils/exporters/exportPdf';

interface Props { registros: RegistroPoupanca[]; onFechar: () => void; }

export interface LinhaDetalhe {
  periodo: string; r: RegistroPoupanca; idx: number; ganhoCambial: number | null;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function PoupancaClienteDetalhe({ registros: registrosIniciais, onFechar }: Props) {
  const [registrosLocal, setRegistrosLocal] = useState(registrosIniciais);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cdiPorMes, setCdiPorMes] = useState<Record<string, number | null>>({});
  const [cdiLoading, setCdiLoading] = useState(false);
  const [visao, setVisao] = useState<Visao>('consolidado');
  const [mostrarMetaLote, setMostrarMetaLote] = useState(false);
  const aberto = registrosLocal.length > 0;
  const nome = aberto ? registrosLocal[0].nome_cliente : '';
  const temOffshore = registrosLocal.some(r => (r.pl_offshore ?? 0) > 0);

  useEffect(() => { setRegistrosLocal(registrosIniciais); setEditIdx(null); setVisao('consolidado'); }, [registrosIniciais]);
  useEffect(() => {
    if (aberto) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCdiLoading(true);
    const meses = [...new Set(registrosLocal.map(r => `${r.ano}-${String(r.mes).padStart(2, '0')}`))];
    Promise.allSettled(
      meses.map(async chave => {
        const [a, m] = chave.split('-').map(Number);
        return { chave, val: await buscarCDIMensal(a, m) };
      }),
    ).then(results => {
      if (cancelado) return;
      const mapa: Record<string, number | null> = {};
      for (const r of results) if (r.status === 'fulfilled') mapa[r.value.chave] = r.value.val;
      setCdiPorMes(mapa);
    }).finally(() => { if (!cancelado) setCdiLoading(false); });
    return () => { cancelado = true; };
  }, [registrosLocal, aberto]);

  const sortedAsc = useMemo(() =>
    [...registrosLocal].sort((a, b) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes)),
  [registrosLocal]);

  const linhas = useMemo<LinhaDetalhe[]>(() =>
    sortedAsc.map((r, i) => {
      const periodo = `${MESES[r.mes - 1]}/${String(r.ano).slice(2)}`;
      const prev = i > 0 ? sortedAsc[i - 1] : null;
      const gc = (r.ptax_fechamento && prev?.ptax_fechamento && prev?.pl_offshore_usd != null)
        ? prev.pl_offshore_usd * (r.ptax_fechamento - prev.ptax_fechamento) : null;
      return { periodo, r, idx: i, ganhoCambial: gc };
    }),
  [sortedAsc]);

  // Métricas resumidas (rent acumulada, CDI acumulado, spread, rent absoluta)
  const metricas = useMemo(() => {
    if (sortedAsc.length === 0) return null;
    const retornos = sortedAsc.map(r => r.rentabilidade_pct ?? 0);
    const rentAcum = calcularAcumulado(retornos);
    const rentAcumulada = rentAcum[rentAcum.length - 1];

    const meses = sortedAsc.map(r => ({ ano: r.ano, mes: r.mes }));
    const cdiMensal = alinharCDI(meses, cdiPorMes);
    const cdiAcum = calcularAcumulado(cdiMensal);
    const cdiAcumulado = cdiMensal.some(v => v != null) ? cdiAcum[cdiAcum.length - 1] : null;

    const spread = cdiAcumulado != null ? rentAcumulada - cdiAcumulado : null;
    const rentAbsoluta = sortedAsc.reduce((s, r) => s + (r.rentabilidade_total ?? 0), 0);
    const cdiAbsoluto = sortedAsc.reduce((acc, r) => {
      const chave = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      return acc + ((cdiPorMes[chave] ?? 0) * (r.pl_inicial_total ?? 0));
    }, 0);
    const spreadAbsoluto = cdiAbsoluto > 0 ? rentAbsoluta - cdiAbsoluto : null;
    const pctCdi = cdiAcumulado != null && cdiAcumulado !== 0 ? (rentAcumulada / cdiAcumulado) * 100 : null;
    const numeroMeses = sortedAsc.length;

    return { rentAcumulada, cdiAcumulado, spread, rentAbsoluta, cdiAbsoluto, spreadAbsoluto, pctCdi, numeroMeses };
  }, [sortedAsc, cdiPorMes]);

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
    { id: 'onshore', label: 'Onshore', show: true },
    { id: 'offshore', label: 'Offshore', show: temOffshore },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-white shadow-2xl ring-1 ring-black/5 w-[96vw] max-w-[1500px] mx-4 max-h-[96vh] flex flex-col"
        style={{ borderRadius: 16 }}>
        {/* HEADER — dark brand */}
        <div className="flex items-center justify-between shrink-0" style={{ backgroundColor: '#160F41', borderRadius: '16px 16px 0 0', padding: '20px 28px' }}>
          <div>
            <h2 className="text-white" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>{nome}</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{periodoInfo}</p>
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
            {metricas && (
              <ExportButton
                variant="dark"
                onExportExcel={() => exportClienteAumExcel(nome, registrosLocal, periodoInfo)}
                onExportPdf={() => exportClienteAumPdf(nome, registrosLocal, periodoInfo, {
                  rentAcumulada: metricas.rentAcumulada,
                  cdiAcumulado: metricas.cdiAcumulado,
                  spread: metricas.spread,
                  rentAbsoluta: metricas.rentAbsoluta,
                })}
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
                <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>CDI Acumulado</p>
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
                  {metricas.spread != null ? (metricas.spread >= 0 ? 'acima do CDI' : 'abaixo do CDI') : '—'}
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
                  {metricas.pctCdi != null ? `% do CDI: ${metricas.pctCdi.toFixed(1)}%` : '% do CDI: —'}
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8' }}>
                  Período: {metricas.numeroMeses} {metricas.numeroMeses === 1 ? 'mês' : 'meses'}
                </p>
              </div>
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
              <span className="text-xs" style={{ color: '#6b6b8a' }}>vs CDI</span>
            </div>
            <DetalheGrafico linhas={linhas} cdiPorMes={cdiPorMes} visao={visao} />
          </div>
          <div className="mx-6 mb-6">
            <DetalheTabela linhas={linhas} cdiPorMes={cdiPorMes} visao={visao}
              editIdx={editIdx} onEditIdx={setEditIdx} onSalvo={handleSalvo} />
          </div>
        </div>
      </div>
    </div>
  );
}
