// --- 4 cards de métricas do detalhe do banker ---

import { formatCurrency, formatPercent } from '../../../utils/formatters';
import type { DadosBanker } from './useBanker';

interface Props { b: DadosBanker; nMeses: number }

export function BankerDetalheMetricas({ b, nMeses }: Props) {
  const varAum = b.aumInicial > 0 ? (b.aumTotal - b.aumInicial) / b.aumInicial : 0;
  const pctMeta = b.metaAgregada > 0 ? (b.nnmTotal / b.metaAgregada) * 100 : null;

  return (
    <div className="mx-6 mt-4 mb-0 grid grid-cols-2 xl:grid-cols-4 gap-3">
      {/* Card 1 — AUM Total */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
        <div className="absolute top-0 left-0 w-full" style={{ height: 3, background: 'linear-gradient(90deg, #0065FF, #0ea5e9)' }} />
        <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>AUM Total</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: '#160F41' }}>{formatCurrency(b.aumTotal)}</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: varAum >= 0 ? '#16a34a' : '#dc2626' }}>
          {varAum >= 0 ? '+' : ''}{formatPercent(varAum * 100)} vs início
        </p>
        <p style={{ fontSize: 10, color: '#94a3b8' }}>{b.totalClientes} clientes</p>
      </div>

      {/* Card 2 — NNM Total */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
        <div className="absolute top-0 left-0 w-full" style={{ height: 3, background: b.nnmTotal >= 0 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #ef4444, #dc2626)' }} />
        <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>NNM Total</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: b.nnmTotal >= 0 ? '#16a34a' : '#dc2626' }}>
          {formatCurrency(b.nnmTotal)}
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: pctMeta != null ? (pctMeta >= 100 ? '#16a34a' : '#ca8a04') : '#94a3b8' }}>
          {pctMeta != null ? `${pctMeta.toFixed(1)}% da meta` : 'Sem meta'}
        </p>
        <p style={{ fontSize: 10, color: '#94a3b8' }}>{b.clientesPoupando} poupando</p>
      </div>

      {/* Card 3 — Rent. Acumulada */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
        <div className="absolute top-0 left-0 w-full" style={{ height: 3, background: 'linear-gradient(90deg, #D000BB, #7c3aed)' }} />
        <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>Rent. Acumulada</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: b.rentPctPonderada >= 0 ? '#16a34a' : '#dc2626' }}>
          {formatPercent(b.rentPctPonderada * 100)}
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: b.rentAbsoluta >= 0 ? '#16a34a' : '#dc2626' }}>
          {formatCurrency(b.rentAbsoluta)}
        </p>
        <p style={{ fontSize: 10, color: '#94a3b8' }}>ponderada por AUM</p>
      </div>

      {/* Card 4 — % do CDI / Spread */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
        <div className="absolute top-0 left-0 w-full" style={{ height: 3, backgroundColor: '#9ca3af' }} />
        <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>% do CDI</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>
          {b.cdiAcumulado != null ? formatPercent((b.rentPctPonderada / b.cdiAcumulado) * 100) : '—'}
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: b.spreadVsCdi != null ? (b.spreadVsCdi >= 0 ? '#16a34a' : '#dc2626') : '#94a3b8' }}>
          {b.spreadVsCdi != null ? `Spread: ${b.spreadVsCdi >= 0 ? '+' : ''}${formatPercent(b.spreadVsCdi * 100)}` : 'CDI indisponível'}
        </p>
        <p style={{ fontSize: 11, color: '#94a3b8' }}>Período: {nMeses} {nMeses === 1 ? 'mês' : 'meses'}</p>
      </div>
    </div>
  );
}
