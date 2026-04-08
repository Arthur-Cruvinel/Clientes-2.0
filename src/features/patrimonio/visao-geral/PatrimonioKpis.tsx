// --- 4 KPI cards do patrimônio ---

import { formatCurrency } from '../../../utils/formatters';

interface Props {
  totalAtivos: number;
  totalPassivos: number;
  patrimonioLiquido: number;
}

export function PatrimonioKpis({ totalAtivos, totalPassivos, patrimonioLiquido }: Props) {
  const cobertura = totalPassivos > 0 ? (totalAtivos / totalPassivos).toFixed(1) + 'x' : '∞';

  const cards = [
    { label: 'ATIVOS TOTAIS', valor: formatCurrency(totalAtivos), cor: undefined, borda: 'linear-gradient(90deg, #0065FF, #0ea5e9)', sub: 'patrimônio bruto' },
    { label: 'PASSIVOS', valor: formatCurrency(totalPassivos), cor: totalPassivos > 0 ? '#dc2626' : undefined, borda: '#ef4444', sub: 'dívidas e financiamentos' },
    { label: 'PATRIMÔNIO LÍQUIDO', valor: formatCurrency(patrimonioLiquido), cor: patrimonioLiquido >= 0 ? '#16a34a' : '#dc2626', borda: 'linear-gradient(90deg, #D000BB, #7c3aed)', sub: 'ativos menos passivos' },
    { label: 'COBERTURA DE PASSIVOS', valor: cobertura, cor: '#16a34a', borda: '#16a34a', sub: 'ativos / passivos' },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className="relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
          <div className="absolute top-0 left-0 w-full" style={{ height: 3, background: c.borda }} />
          <p className="uppercase tracking-wider" style={{ fontSize: 9, color: '#64748b' }}>{c.label}</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: c.cor ?? '#160F41' }}>{c.valor}</p>
          <p style={{ fontSize: 10, color: '#94a3b8' }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
