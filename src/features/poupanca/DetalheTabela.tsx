// --- Tabela histórica do detalhe (premium, por visão, CDI, edição, ordenação, filtro) ---

import { useMemo, useState, useCallback } from 'react';
import { Pencil, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { RegistroPoupanca } from '../../types';
import type { LinhaDetalhe } from './PoupancaClienteDetalhe';
import type { Visao } from './PoupancaTabela';
import { DetalheLinhaEdit } from './DetalheLinhaEdit';
import { TabelaStatusBar } from './TabelaStatusBar';
import { useOrdenacao } from './useOrdenacao';
import { ThOrdenavel } from './ThOrdenavel';
import { FiltroCheckbox } from './FiltroCheckbox';

interface Props {
  linhas: LinhaDetalhe[]; cdiPorMes: Record<string, number | null>;
  visao: Visao; editIdx: number | null;
  onEditIdx: (idx: number | null) => void;
  onSalvo: (idx: number, r: RegistroPoupanca) => void;
}

const H = 'font-bold uppercase tracking-widest';
const HS = { fontSize: 11, color: '#64748b', height: 44 };
const CS = { fontSize: 13 };
const DASH = { color: '#94a3b8' };

function cor(v: number | null) {
  if (v == null) return DASH;
  return v < 0 ? { color: '#dc2626' } : v > 0 ? { color: '#16a34a' } : { color: '#160F41' };
}
function fmtSp(v: number) { return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`; }

function pickR(r: RegistroPoupanca, v: Visao) {
  if (v === 'onshore') {
    const d = (r.pl_inicial_onshore ?? 0) + (r.aporte_mes_onshore ?? 0);
    return { pi: r.pl_inicial_onshore ?? 0, pf: r.pl_onshore ?? 0, nnm: r.aporte_mes_onshore ?? 0,
      rb: r.rentabilidade_onshore ?? 0, rp: d > 0 ? (r.rentabilidade_onshore ?? 0) / d : null };
  }
  if (v === 'offshore') {
    const d = (r.pl_inicial_offshore ?? 0) + (r.aporte_mes_offshore ?? 0);
    return { pi: r.pl_inicial_offshore ?? 0, pf: r.pl_offshore ?? 0, nnm: r.aporte_mes_offshore ?? 0,
      rb: r.rentabilidade_offshore ?? 0, rp: d > 0 ? (r.rentabilidade_offshore ?? 0) / d : null };
  }
  return { pi: r.pl_inicial_total ?? 0, pf: r.pl_total ?? 0, nnm: r.aporte_mes_total ?? 0,
    rb: r.rentabilidade_total ?? 0, rp: r.rentabilidade_pct ?? 0 };
}

function acessorDetalhe(visao: Visao, cdiPorMes: Record<string, number | null>) {
  return (l: LinhaDetalhe, col: string): number | string | null => {
    const d = pickR(l.r, visao);
    const chave = `${l.r.ano}-${String(l.r.mes).padStart(2, '0')}`;
    switch (col) {
      case 'data': return l.r.ano * 12 + l.r.mes;
      case 'pi': return d.pi;
      case 'nnm': return d.nnm;
      case 'rb': return d.rb;
      case 'rp': return d.rp;
      case 'cdi': {
        const cdi = cdiPorMes[chave] ?? null;
        const rent = l.r.rentabilidade_pct ?? 0;
        return cdi != null ? rent - cdi : null;
      }
      case 'gc': return l.ganhoCambial;
      case 'meta': return l.r.meta_poupanca_mensal ?? null;
      case 'prog': {
        const m = l.r.meta_poupanca_mensal;
        return m ? (l.r.aporte_mes_total ?? 0) / m : null;
      }
      case 'pf': return d.pf;
      default: return null;
    }
  };
}

export function DetalheTabela({ linhas, cdiPorMes, visao, editIdx, onEditIdx, onSalvo }: Props) {
  const linhasDesc = useMemo(() => [...linhas].reverse(), [linhas]);
  const mostrarGC = visao !== 'onshore';
  const numCols = mostrarGC ? 11 : 10;

  const [filtroPeriodos, setFiltroPeriodos] = useState<Set<string> | null>(null);
  const periodos = useMemo(() => linhasDesc.map(l => l.periodo), [linhasDesc]);

  const filtradas = useMemo(() =>
    filtroPeriodos ? linhasDesc.filter(l => filtroPeriodos.has(l.periodo)) : linhasDesc,
  [linhasDesc, filtroPeriodos]);

  const acessor = useCallback(acessorDetalhe(visao, cdiPorMes), [visao, cdiPorMes]);
  const { ordenados, coluna, direcao, alternar } = useOrdenacao(filtradas, acessor);

  const totais = useMemo(() => {
    let nnm = 0, rb = 0, sRp = 0, cRp = 0, gc = 0, sCdi = 0, cCdi = 0, sSp = 0, cSp = 0, meta = 0, nnmT = 0, tombT = 0;
    for (const l of ordenados) {
      const d = pickR(l.r, visao);
      nnm += d.nnm; rb += d.rb; nnmT += l.r.aporte_mes_total ?? 0;
      tombT += l.r.nnm_tombamento ?? 0;
      if (l.r.meta_poupanca_mensal) meta += l.r.meta_poupanca_mensal;
      if (d.rp) { sRp += d.rp; cRp++; }
      if (l.ganhoCambial != null) gc += l.ganhoCambial;
      const chave = `${l.r.ano}-${String(l.r.mes).padStart(2, '0')}`;
      const cdi = cdiPorMes[chave] ?? null;
      if (cdi != null) { sCdi += cdi; cCdi++; }
      const rent = l.r.rentabilidade_pct ?? 0;
      if (cdi != null && rent) { sSp += rent - cdi; cSp++; }
    }
    return { nnm, rb, rpM: cRp > 0 ? sRp / cRp : 0, gc, meta, nnmT, tombT,
      nnmLiq: nnmT - tombT, cdiM: cCdi > 0 ? sCdi / cCdi : 0, spM: cSp > 0 ? sSp / cSp : 0 };
  }, [ordenados, visao, cdiPorMes]);

  const thProps = { colunaAtiva: coluna, direcao, onAlternar: alternar };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #f1f5f9' }}>
      <table className="min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <ThOrdenavel chave="data" label="Data" className={`px-3 py-2 text-left ${H}`} {...thProps}>
              <FiltroCheckbox valores={periodos} selecionados={filtroPeriodos} onAplicar={setFiltroPeriodos} />
            </ThOrdenavel>
            <ThOrdenavel chave="pi" label="AUM Inicial" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <ThOrdenavel chave="nnm" label="NNM" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <ThOrdenavel chave="rb" label="Rent. R$" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <ThOrdenavel chave="rp" label="Rent. %" className={`px-3 py-2 text-center ${H}`} {...thProps} />
            <ThOrdenavel chave="cdi" label="vs CDI" className={`px-3 py-2 text-center ${H}`} {...thProps} />
            {mostrarGC && <ThOrdenavel chave="gc" label="G. Cambial" className={`px-3 py-2 text-right ${H}`} {...thProps} />}
            <ThOrdenavel chave="meta" label="Meta" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <ThOrdenavel chave="prog" label="Progresso" className={`px-3 py-2 text-center ${H}`} {...thProps} />
            <ThOrdenavel chave="pf" label="AUM Final" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <th style={{ ...HS, width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {ordenados.map(l => {
            const isEd = editIdx === l.idx;
            const d = pickR(l.r, visao);
            const chave = `${l.r.ano}-${String(l.r.mes).padStart(2, '0')}`;
            const cdi = cdiPorMes[chave] ?? null;
            const rent = l.r.rentabilidade_pct ?? 0;
            const spread = cdi != null ? rent - cdi : null;
            const isOff = visao === 'offshore';
            const plUsd = l.r.pl_offshore_usd;
            return [
              <tr key={l.idx}
                className={`group transition-colors duration-150 ${isEd ? '' : 'hover:bg-blue-50/40'}`}
                style={{ height: 48, borderBottom: '1px solid #f1f5f9',
                  ...(isEd ? { backgroundColor: '#eff6ff', borderLeft: '3px solid #0065FF' } : {}) }}>
                <td className="px-3 py-2 text-left font-medium" style={{ ...CS, color: '#160F41' }}>{l.periodo}</td>
                <td className="px-3 py-2 text-right" style={{ ...CS, color: d.pi ? '#160F41' : '#94a3b8' }}>{d.pi ? formatCurrency(d.pi) : '—'}</td>
                <td className="px-3 py-2 text-right" style={{ ...CS, ...cor(d.nnm) }}>
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    {formatCurrency(d.nnm)}
                    {(l.r.nnm_tombamento ?? 0) > 0 && (
                      <span title={`NNM Total: ${formatCurrency(l.r.aporte_mes_total ?? 0)} | Tombamento: ${formatCurrency(l.r.nnm_tombamento ?? 0)} | Poupança líquida: ${formatCurrency((l.r.aporte_mes_total ?? 0) - (l.r.nnm_tombamento ?? 0))}`}>
                        <Info size={12} style={{ color: '#6b6b8a' }} />
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-right" style={{ ...CS, ...cor(d.rb) }}>{formatCurrency(d.rb)}</td>
                <td className="px-3 py-2 text-center" style={CS}>{d.rp != null ? `${(d.rp * 100).toFixed(2)}%` : <span style={DASH}>—</span>}</td>
                <td className="px-3 py-2 text-center" style={{ ...CS, ...cor(spread) }}>{spread != null ? fmtSp(spread) : <span style={DASH}>—</span>}</td>
                {mostrarGC && <td className="px-3 py-2 text-right" style={{ ...CS, ...cor(l.ganhoCambial) }}>{l.ganhoCambial != null ? formatCurrency(l.ganhoCambial) : <span style={DASH}>—</span>}</td>}
                <td className="px-3 py-2 text-right" style={CS}>{l.r.meta_poupanca_mensal ? formatCurrency(l.r.meta_poupanca_mensal) : <span style={DASH}>—</span>}</td>
                <td className="px-2 py-2" style={{ width: 160 }}>
                  <TabelaStatusBar nnm={(l.r.aporte_mes_total ?? 0) - (l.r.nnm_tombamento ?? 0)} meta={l.r.meta_poupanca_mensal ?? null}
                    tombamento={(l.r.nnm_tombamento ?? 0) > 0 && ((l.r.aporte_mes_total ?? 0) - (l.r.nnm_tombamento ?? 0)) <= 0 && (l.r.aporte_mes_total ?? 0) > 0} />
                </td>
                <td className="px-3 py-2 text-right" style={{ ...CS, color: '#160F41' }}>
                  {formatCurrency(d.pf)}
                  {isOff && plUsd != null && plUsd > 0 && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {plUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                <td className="px-1 py-2 text-center">
                  <button onClick={() => onEditIdx(isEd ? null : l.idx)}
                    className={`p-1 rounded transition-colors ${isEd ? 'text-blue-500' : 'invisible group-hover:visible text-gray-400 hover:text-gray-600'}`}>
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>,
              isEd && <DetalheLinhaEdit key={`e-${l.idx}`} registro={l.r} periodo={l.periodo}
                colSpan={numCols} onSalvo={r => onSalvo(l.idx, r)} onCancelar={() => onEditIdx(null)} />,
            ];
          })}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
            <td className="px-3 py-2 text-left" style={{ ...CS, fontWeight: 700, color: '#160F41' }}>
              TOTAL / MÉDIA {filtroPeriodos ? `(${ordenados.length}/${linhas.length})` : ''}
            </td>
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...DASH }}>—</td>
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...cor(totais.nnm) }}>
              {formatCurrency(totais.nnm)}
              {totais.tombT > 0 && <span className="block text-[10px] font-normal" style={{ color: '#6b6b8a' }}>Poup. líq.: {formatCurrency(totais.nnmLiq)} | Tomb.: {formatCurrency(totais.tombT)}</span>}
            </td>
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...cor(totais.rb) }}>{formatCurrency(totais.rb)}</td>
            <td className="px-3 py-2 text-center" style={{ ...CS, fontWeight: 700 }}>{(totais.rpM * 100).toFixed(2)}%</td>
            <td className="px-3 py-2 text-center" style={{ ...CS, fontWeight: 700, ...cor(totais.spM) }}>{totais.spM ? fmtSp(totais.spM) : <span style={DASH}>—</span>}</td>
            {mostrarGC && <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...cor(totais.gc) }}>{formatCurrency(totais.gc)}</td>}
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700 }}>{totais.meta > 0 ? formatCurrency(totais.meta) : <span style={DASH}>—</span>}</td>
            <td className="px-2 py-2" style={{ width: 160 }}><TabelaStatusBar nnm={totais.nnmLiq} meta={totais.meta > 0 ? totais.meta : null} /></td>
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...DASH }}>—</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
