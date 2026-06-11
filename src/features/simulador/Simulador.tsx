// --- Precificação: aba Reajustes (clientes existentes) + Gerador de Propostas ---
import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { formatPeriodo } from '../../utils/formatters';
import { Reajustes } from './Reajustes';
import { GeradorProposta } from './GeradorProposta';

const ABAS = ['Reajustes', 'Gerador de Propostas'] as const;

export function Simulador() {
  const { periodoSelecionado } = useApp();
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Reajustes');

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#160F41' }}>
        <Calculator size={20} /> Precificação
        {periodoSelecionado && <span className="text-base font-normal" style={{ color: '#6b6b8a' }}>— {formatPeriodo(periodoSelecionado)}</span>}
      </h2>

      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ backgroundColor: '#f3f4f6' }}>
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${aba === a ? 'bg-white shadow-sm' : ''}`}
            style={{ color: aba === a ? '#160F41' : '#6b6b8a' }}>{a}</button>
        ))}
      </div>

      {aba === 'Reajustes' && <Reajustes />}
      {aba === 'Gerador de Propostas' && <GeradorProposta />}
    </div>
  );
}
