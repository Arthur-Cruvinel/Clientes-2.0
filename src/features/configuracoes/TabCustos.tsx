// --- Aba Custos Diretos das Configurações ---

import { useState, useEffect } from 'react';
import type { Parametros } from '../../types';

interface Props {
  parametros: Parametros;
  onSalvar: (p: Parametros) => Promise<void>;
  salvando: boolean;
}

export function TabCustos({ parametros, onSalvar, salvando }: Props) {
  const [juridico, setJuridico] = useState(parametros.custo_juridico_mensal);
  const [conciliacao, setConciliacao] = useState(parametros.custo_conciliacao_mensal);

  useEffect(() => {
    setJuridico(parametros.custo_juridico_mensal);
    setConciliacao(parametros.custo_conciliacao_mensal);
  }, [parametros]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Jurídico (mensal)</label>
        <input type="number" step="0.01" value={juridico} onChange={e => setJuridico(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm w-64" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
        <p className="text-xs" style={{ color: '#6b6b8a' }}>
          Valor fixo mensal do escritório jurídico, rateado entre clientes com serviço jurídico ativo pelo peso de cada um.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Conciliação (mensal)</label>
        <input type="number" step="0.01" value={conciliacao} onChange={e => setConciliacao(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm w-64" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
        <p className="text-xs" style={{ color: '#6b6b8a' }}>
          Valor fixo mensal da plataforma de conciliação, rateado entre clientes com pacote full pelo volume de movimentos.
        </p>
      </div>

      <button disabled={salvando} onClick={() => onSalvar({ ...parametros, custo_juridico_mensal: juridico, custo_conciliacao_mensal: conciliacao })}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
