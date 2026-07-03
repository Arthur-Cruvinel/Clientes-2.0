// --- Mockup ILUSTRATIVO de módulo (Vitrine 360) ---
// Layout reutilizável: selo "DADOS ILUSTRATIVOS" (sempre) + KPIs + gráfico + tabela.
// Mockups custom (kanban, chat, documento) entram pelo slot `grafico` (ReactNode).
// TODOS os dados são FICTÍCIOS — nenhum cliente real. Presentation-only.

import type { ReactNode } from 'react';

interface Props {
  kpis?: { label: string; valor: string }[];
  grafico?: ReactNode;
  tabela?: { colunas: string[]; linhas: ReactNode[][] };
}

export function SeloIlustrativo() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
      ● Dados ilustrativos
    </span>
  );
}

export function MockupModulo({ kpis, grafico, tabela }: Props) {
  return (
    <div className="rounded-xl border p-5 relative" style={{ borderColor: '#e2e2e8', backgroundColor: '#fff' }}>
      <div className="absolute top-3 right-3"><SeloIlustrativo /></div>

      {kpis && kpis.length > 0 && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, minmax(0,1fr))` }}>
          {kpis.map(k => (
            <div key={k.label} className="rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
              <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b6b8a' }}>{k.label}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: '#160F41' }}>{k.valor}</p>
            </div>
          ))}
        </div>
      )}

      {grafico && <div>{grafico}</div>}

      {tabela && (
        <table className="min-w-full text-sm mt-3">
          <thead style={{ backgroundColor: '#f9f9fb' }}>
            <tr>{tabela.colunas.map((col, i) => (
              <th key={i} className={`px-2 py-1.5 text-[10px] font-bold uppercase ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: '#6b6b8a' }}>{col}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {tabela.linhas.map((linha, r) => (
              <tr key={r}>{linha.map((cel, i) => (
                <td key={i} className={`px-2 py-1.5 ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: '#160F41' }}>{cel}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
