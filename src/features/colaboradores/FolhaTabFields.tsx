// --- Inputs reutilizados pela FolhaTab ---

const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;

interface CampoProps {
  label: string;
  valor: string | number;
  tipo: 'text' | 'number';
  step?: number;
  placeholder?: string;
  onText?: (v: string) => void;
  onNum?: (v: number) => void;
}
export function Campo(props: CampoProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{props.label}</label>
      <input type={props.tipo} step={props.step} value={props.valor} placeholder={props.placeholder}
        onChange={e => props.tipo === 'number'
          ? props.onNum?.(Number(e.target.value))
          : props.onText?.(e.target.value)}
        className={INP} style={BRD} />
    </div>
  );
}

interface SelectProps {
  label: string;
  valor: string;
  opcoes: [string, string][];
  onChange: (v: string) => void;
}
export function SelectField({ label, valor, opcoes, onChange }: SelectProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label}</label>
      <select value={valor} onChange={e => onChange(e.target.value)} className={INP} style={BRD}>
        {opcoes.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
      </select>
    </div>
  );
}
