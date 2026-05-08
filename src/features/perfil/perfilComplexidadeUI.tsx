// --- Subcomponentes da aba Complexidade ---
// Pequenos blocos de UI reutilizáveis: seção colapsável, input numérico
// rotulado, checkbox com badge de alerta opcional.

import { AlertTriangle } from 'lucide-react';

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details open className="rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
      <summary className="px-3 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
        style={{ backgroundColor: '#f9f9fb', color: '#160F41' }}>{titulo}</summary>
      <div className="p-3 space-y-2">{children}</div>
    </details>
  );
}

export function Campo({ label, value, onChange, step }: {
  label: string; value: number; onChange: (v: number) => void; step: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs" style={{ color: '#6b6b8a' }}>{label}</label>
      <input type="number" step={step} min={0} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="rounded px-2 py-1.5 text-sm w-32"
        style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
    </div>
  );
}

export function Check({ label, checked, onChange, badge }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; badge?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#160F41' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
      {label}
      {badge && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
          style={{ backgroundColor: '#fed7aa', color: '#9a3412' }}>
          <AlertTriangle size={10} /> {badge}
        </span>
      )}
    </label>
  );
}
