// --- Card individual de banker ---

import { AlertTriangle } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
import type { DadosBanker } from './useBanker';

interface Props {
  b: DadosBanker;
  posicao: number;
  grande?: boolean;
  onClick: () => void;
}

const MEDALHA = ['🥇', '🥈', '🥉'];

function BarraMeta({ progresso }: { progresso: number }) {
  const pct = Math.min(Math.max(progresso * 100, 0), 150);
  const cor = progresso >= 1
    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
    : progresso > 0
    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
    : 'linear-gradient(90deg, #ef4444, #dc2626)';
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#e2e8f0' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct / 1.5}%`, background: cor }} />
    </div>
  );
}

export function BankerCard({ b, posicao, grande, onClick }: Props) {
  const semBanker = b.nome === 'Sem banker';

  return (
    <div onClick={onClick}
      className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-lg ${grande ? 'col-span-1' : ''}`}
      style={{ borderColor: semBanker ? '#fbbf24' : '#e2e8f0', backgroundColor: semBanker ? '#fffbeb' : '#fff' }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {semBanker
          ? <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
          : <span className="text-base">{MEDALHA[posicao] ?? `#${posicao + 1}`}</span>}
        <span className="text-sm font-semibold truncate" style={{ color: '#160F41' }}>{b.nome}</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gray-100" style={{ color: '#6b6b8a' }}>
          {b.totalClientes} cliente{b.totalClientes !== 1 ? 's' : ''}
        </span>
      </div>

      {semBanker && (
        <p className="text-[10px] mb-3" style={{ color: '#92400e' }}>
          Atribua bankers no módulo Perfil
        </p>
      )}

      {/* Métricas principais */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: '#64748b' }}>AUM</p>
          <p className="text-xs font-bold" style={{ color: '#160F41' }}>{formatCurrency(b.aumTotal)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: '#64748b' }}>NNM</p>
          <p className="text-xs font-bold" style={{ color: b.nnmTotal >= 0 ? '#16a34a' : '#dc2626' }}>
            {formatCurrency(b.nnmTotal)}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: '#64748b' }}>Rent. %</p>
          <p className="text-xs font-bold" style={{ color: b.rentPctPonderada >= 0 ? '#16a34a' : '#dc2626' }}>
            {formatPercent(b.rentPctPonderada * 100)}
          </p>
        </div>
      </div>

      {/* Barra de meta */}
      {b.metaAgregada > 0 && (
        <div className="mb-2">
          <BarraMeta progresso={b.progressoMeta} />
          <p className="text-[10px] mt-0.5" style={{ color: '#6b6b8a' }}>
            Meta de captação: {Math.round(b.progressoMeta * 100)}%
          </p>
        </div>
      )}

      {/* Rodapé */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px]" style={{ color: '#6b6b8a' }}>
          {b.clientesPoupando} poupando • {b.clientesSemNNM} sem NNM
        </span>
        {b.clientesSemMeta > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            {b.clientesSemMeta} sem meta
          </span>
        )}
      </div>
    </div>
  );
}
