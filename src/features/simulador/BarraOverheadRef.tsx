// --- Barra da razão de overhead de referência (Precificação) ---
// Mostra a razão usada SEMPRE pela precificação (parametros/global) e permite
// recalcular do período corrente — com comparação + confirmação. Aviso se a
// razão nova divergir >20% da referência (período pode ter alocação incompleta).

import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { overheadRatioPeriodo } from './precificacaoBase';
import { salvarOverheadRatioReferencia } from '../../services/firebase';

const LIMIAR_DIVERGENCIA = 0.20;

export function BarraOverheadRef() {
  const { dadosPeriodo, parametros, setParametros } = useApp();
  const [nova, setNova] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const ref = parametros.overhead_ratio_referencia;

  function recalcular() {
    if (!dadosPeriodo) return;
    const { colaboradores, custosIndiretos, clientes, vinculos, resultados } = dadosPeriodo;
    setNova(overheadRatioPeriodo(colaboradores, custosIndiretos, clientes, vinculos, resultados));
  }

  async function confirmar() {
    if (nova == null) return;
    setSalvando(true);
    try {
      await salvarOverheadRatioReferencia(nova);
      setParametros({ ...parametros, overhead_ratio_referencia: nova });
      setToast(`Referência atualizada para ×${nova.toFixed(4)}`);
      setNova(null);
      setTimeout(() => setToast(null), 3500);
    } finally { setSalvando(false); }
  }

  const divergencia = nova != null && ref > 0 ? Math.abs(nova / ref - 1) : 0;
  const alerta = divergencia > LIMIAR_DIVERGENCIA;

  return (
    <div className="rounded-lg border p-3 text-sm" style={{ borderColor: '#e2e2e8' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <span style={{ color: '#6b6b8a' }}>Razão de overhead de referência:</span>
        <span className="font-bold" style={{ color: '#160F41' }}>×{ref.toFixed(4)}</span>
        <button onClick={recalcular} disabled={!dadosPeriodo}
          className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ border: '1px solid #0065FF', color: '#0065FF' }}>
          Recalcular do período corrente
        </button>
        {toast && <span className="text-xs" style={{ color: '#166534' }}>{toast}</span>}
      </div>

      {nova != null && (
        <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: alerta ? '#fef3c7' : '#f0f6ff' }}>
          <div className="flex items-center gap-4 flex-wrap">
            <span style={{ color: '#160F41' }}>Atual <strong>×{ref.toFixed(4)}</strong></span>
            <span style={{ color: '#6b6b8a' }}>→</span>
            <span style={{ color: '#160F41' }}>Período corrente <strong>×{nova.toFixed(4)}</strong></span>
            <span style={{ color: alerta ? '#92400e' : '#6b6b8a' }}>
              divergência {(divergencia * 100).toFixed(1)}%
            </span>
          </div>
          {alerta && (
            <p className="mt-2 text-xs" style={{ color: '#92400e' }}>
              ⚠ Divergência &gt; 20% — o período corrente pode estar com alocação incompleta
              (custo direto subcapturado infla a razão). Confirme só se este período está completo.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={confirmar} disabled={salvando}
              className="px-3 py-1 rounded-lg text-xs font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Confirmar e gravar'}
            </button>
            <button onClick={() => setNova(null)}
              className="px-3 py-1 rounded-lg text-xs font-medium" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
