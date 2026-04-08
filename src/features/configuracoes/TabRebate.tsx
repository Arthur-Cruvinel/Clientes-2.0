// --- Aba Rebate das Configurações ---

import { useState, useEffect } from 'react';
import type { Parametros } from '../../types';

interface Props {
  parametros: Parametros;
  onSalvar: (p: Parametros) => Promise<void>;
  salvando: boolean;
}

export function TabRebate({ parametros, onSalvar, salvando }: Props) {
  const [on, setOn] = useState(parametros.taxa_rebate_onshore * 100);
  const [off, setOff] = useState(parametros.taxa_rebate_offshore * 100);
  const [split, setSplit] = useState(parametros.split_plataforma * 100);

  useEffect(() => {
    setOn(parametros.taxa_rebate_onshore * 100);
    setOff(parametros.taxa_rebate_offshore * 100);
    setSplit(parametros.split_plataforma * 100);
  }, [parametros]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Taxa onshore (a.a. %)</label>
        <input type="number" step="0.01" value={on} onChange={e => setOn(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm w-40" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Taxa offshore (a.a. %)</label>
        <input type="number" step="0.01" value={off} onChange={e => setOff(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm w-40" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Split Galácticos (%)</label>
        <input type="number" step="0.01" value={split} onChange={e => setSplit(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm w-40" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
        <p className="text-xs" style={{ color: '#6b6b8a' }}>Percentual da receita de rebate retido pela Galácticos Capital.</p>
      </div>
      <button disabled={salvando}
        onClick={() => onSalvar({ ...parametros, taxa_rebate_onshore: on / 100, taxa_rebate_offshore: off / 100, split_plataforma: split / 100 })}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
