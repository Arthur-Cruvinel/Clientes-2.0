// --- Painel de ações da alocação em lote (banker + empresário) ---

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';

interface Props {
  count: number;
  bankersUnicos: string[];
  empresariosUnicos: string[];
  salvando: boolean;
  onAplicar: (campo: 'banker' | 'empresario', valor: string) => void;
  onLimpar: () => void;
}

export function AlocacaoLoteAcoes({ count, bankersUnicos, empresariosUnicos, salvando, onAplicar, onLimpar }: Props) {
  const [banker, setBanker] = useState('');
  const [empresario, setEmpresario] = useState('');

  const INP = 'rounded-lg px-2 py-1.5 text-xs w-40';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
  const BTN = 'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50';

  return (
    <div className="sticky bottom-0 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.06)] p-4 -mx-5 -mb-5 rounded-b-lg"
      style={{ borderColor: '#e2e2e8' }}>
      <div className="flex flex-wrap items-end gap-4">
        <p className="text-xs font-medium" style={{ color: '#160F41' }}>
          Aplicar para {count} cliente{count !== 1 ? 's' : ''} selecionado{count !== 1 ? 's' : ''}:
        </p>

        {/* Bloco Banker */}
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] font-medium block mb-0.5" style={{ color: '#6b6b8a' }}>Banker</label>
            <input value={banker} onChange={e => setBanker(e.target.value)} list="lote-bankers"
              placeholder="Nome do banker..." className={INP} style={BRD} />
            <datalist id="lote-bankers">
              {bankersUnicos.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>
          <button disabled={salvando || !banker.trim()} className={`${BTN} bg-blue-600 hover:bg-blue-700`}
            onClick={() => onAplicar('banker', banker)}>
            {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Aplicar Banker
          </button>
        </div>

        {/* Divider */}
        <div className="h-8 w-px" style={{ backgroundColor: '#e2e2e8' }} />

        {/* Bloco Empresário */}
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] font-medium block mb-0.5" style={{ color: '#6b6b8a' }}>Empresário</label>
            <input value={empresario} onChange={e => setEmpresario(e.target.value)} list="lote-empresarios"
              placeholder="Nome do empresário..." className={INP} style={BRD} />
            <datalist id="lote-empresarios">
              {empresariosUnicos.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>
          <button disabled={salvando || !empresario.trim()} className={`${BTN} bg-blue-600 hover:bg-blue-700`}
            onClick={() => onAplicar('empresario', empresario)}>
            {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Aplicar Empresário
          </button>
        </div>

        {/* Limpar */}
        <button onClick={onLimpar} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ml-auto"
          style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
          <X size={12} /> Limpar seleção
        </button>
      </div>
    </div>
  );
}
