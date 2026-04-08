// --- Tabela comparativa de bankers ---

import { useMemo } from 'react';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
import type { DadosBanker } from './useBanker';

interface Props {
  bankers: DadosBanker[];
  onClick: (b: DadosBanker) => void;
}

const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-right';
const TD = 'px-3 py-2 text-xs text-right';

function cor(v: number) {
  return v < 0 ? { color: '#dc2626' } : v > 0 ? { color: '#16a34a' } : undefined;
}

function BarraMini({ p }: { p: number }) {
  const pct = Math.min(Math.max(p * 100, 0), 150);
  const bg = p >= 1 ? '#22c55e' : p > 0 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, backgroundColor: '#e2e8f0' }}>
        <div className="h-full rounded-full" style={{ width: `${pct / 1.5}%`, backgroundColor: bg }} />
      </div>
      <span className="text-[10px] font-semibold" style={{ color: bg }}>{Math.round(p * 100)}%</span>
    </div>
  );
}

export function BankerTabela({ bankers, onClick }: Props) {
  const totais = useMemo(() => {
    let cli = 0, aum = 0, nnm = 0, rent = 0, meta = 0, sp = 0, sw = 0;
    for (const b of bankers) {
      cli += b.totalClientes; aum += b.aumTotal; nnm += b.nnmTotal;
      rent += b.rentAbsoluta; meta += b.metaAgregada;
      if (b.aumTotal > 0) { sp += b.rentPctPonderada * b.aumTotal; sw += b.aumTotal; }
    }
    const rentM = sw > 0 ? sp / sw : 0;
    const prog = meta > 0 ? nnm / meta : 0;
    return { cli, aum, nnm, rentM, meta, prog };
  }, [bankers]);

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
      <table className="min-w-full text-sm">
        <thead style={{ backgroundColor: '#f9f9fb' }}>
          <tr>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center w-12">Pos.</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left w-40">Banker</th>
            <th className={`${TH} w-16`}>Clientes</th>
            <th className={`${TH} w-28`}>AUM Total</th>
            <th className={`${TH} w-24`}>NNM</th>
            <th className={`${TH} w-20`}>Rent. %</th>
            <th className={`${TH} w-28`}>Meta Agregada</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center w-32">Progresso</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
          {bankers.map((b, i) => {
            const semBanker = b.nome === 'Sem banker';
            return (
              <tr key={b.nome} onClick={() => onClick(b)}
                className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                style={semBanker ? { backgroundColor: '#fffbeb' } : undefined}>
                <td className="px-3 py-2 text-xs text-center font-semibold" style={{ color: '#160F41' }}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </td>
                <td className="px-3 py-2 text-xs font-medium text-left truncate" style={{ color: '#160F41' }}>
                  {b.nome}
                  {semBanker && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>alerta</span>
                  )}
                </td>
                <td className={TD}>{b.totalClientes}</td>
                <td className={TD}>{formatCurrency(b.aumTotal)}</td>
                <td className={TD} style={cor(b.nnmTotal)}>{formatCurrency(b.nnmTotal)}</td>
                <td className={TD} style={cor(b.rentPctPonderada)}>{formatPercent(b.rentPctPonderada * 100)}</td>
                <td className={TD}>{b.metaAgregada > 0 ? formatCurrency(b.metaAgregada) : '—'}</td>
                <td className="px-3 py-2" style={{ minWidth: 120 }}>
                  {b.metaAgregada > 0 ? <BarraMini p={b.progressoMeta} /> : <span className="text-xs text-center block" style={{ color: '#94a3b8' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t-2" style={{ borderColor: '#d1d5db' }}>
            <td className="px-3 py-2 text-xs font-semibold text-center" style={{ color: '#160F41' }}>—</td>
            <td className="px-3 py-2 text-xs font-semibold text-left" style={{ color: '#160F41' }}>TOTAL / MÉDIA</td>
            <td className={`${TD} font-semibold`}>{totais.cli}</td>
            <td className={`${TD} font-semibold`}>{formatCurrency(totais.aum)}</td>
            <td className={`${TD} font-semibold`} style={cor(totais.nnm)}>{formatCurrency(totais.nnm)}</td>
            <td className={`${TD} font-semibold`} style={cor(totais.rentM)}>{formatPercent(totais.rentM * 100)}</td>
            <td className={`${TD} font-semibold`}>{totais.meta > 0 ? formatCurrency(totais.meta) : '—'}</td>
            <td className="px-3 py-2" style={{ minWidth: 120 }}>
              {totais.meta > 0 ? <BarraMini p={totais.prog} /> : <span className="text-xs text-center block" style={{ color: '#94a3b8' }}>—</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
