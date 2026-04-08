// --- Card de meta NNM mensal (editável inline) ---

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  metaNNM: number | null;
  setMetaNNM: (valor: number) => Promise<void>;
}

export function PoupancaMeta({ metaNNM, setMetaNNM }: Props) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  function iniciarEdicao() {
    setValor(metaNNM ? String(metaNNM) : '');
    setEditando(true);
  }

  async function salvar() {
    const num = Number(valor);
    if (isNaN(num) || num <= 0) return;
    setSalvando(true);
    try {
      await setMetaNNM(num);
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-4"
      style={{ borderColor: '#e2e2e8' }}>
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
          Meta NNM Mensal
        </p>
        {editando ? (
          <div className="flex items-center gap-2 mt-1">
            <input type="number" value={valor} onChange={e => setValor(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-sm w-48"
              style={{ borderColor: '#e2e2e8', color: '#160F41' }}
              placeholder="Ex: 500000" autoFocus />
            <button onClick={salvar} disabled={salvando}
              className="p-1.5 rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={() => setEditando(false)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
              <X size={14} />
            </button>
          </div>
        ) : (
          <p className="text-lg font-bold mt-0.5" style={{ color: '#160F41' }}>
            {metaNNM != null ? formatCurrency(metaNNM) : 'Clique para definir a meta'}
          </p>
        )}
      </div>
      {!editando && (
        <button onClick={iniciarEdicao}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#6b6b8a' }}>
          <Pencil size={16} />
        </button>
      )}
    </div>
  );
}
