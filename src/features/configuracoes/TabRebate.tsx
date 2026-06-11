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
  const [aliqOn, setAliqOn] = useState(parametros.aliquota_rebate_onshore * 100);
  const [aliqOff, setAliqOff] = useState(parametros.aliquota_rebate_offshore * 100);

  useEffect(() => {
    setOn(parametros.taxa_rebate_onshore * 100);
    setOff(parametros.taxa_rebate_offshore * 100);
    setSplit(parametros.split_plataforma * 100);
    setAliqOn(parametros.aliquota_rebate_onshore * 100);
    setAliqOff(parametros.aliquota_rebate_offshore * 100);
  }, [parametros]);

  const salvar = () => {
    if (!confirm('Estas alíquotas e taxas são GLOBAIS — afetam o rebate de TODOS os clientes com PL. Confirmar?')) return;
    onSalvar({
      ...parametros,
      taxa_rebate_onshore: on / 100, taxa_rebate_offshore: off / 100, split_plataforma: split / 100,
      aliquota_rebate_onshore: aliqOn / 100, aliquota_rebate_offshore: aliqOff / 100,
    });
  };

  const INP = 'rounded-lg px-3 py-2 text-sm w-40';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Taxa onshore (a.a. %)</label>
        <input type="number" step="0.01" value={on} onChange={e => setOn(Number(e.target.value))} className={INP} style={BRD} />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Taxa offshore (a.a. %)</label>
        <input type="number" step="0.01" value={off} onChange={e => setOff(Number(e.target.value))} className={INP} style={BRD} />
      </div>

      {/* Alíquotas de RETENÇÃO NA ORIGEM do rebate (por perna) — o rebate chega
          já descontado; a plataforma projeta o LÍQUIDO a receber. NÃO é IRPJ/CSLL. */}
      <div className="pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
        <p className="text-xs font-bold uppercase tracking-wider mt-3 mb-1" style={{ color: '#6b6b8a' }}>
          Retenção na origem do rebate (GLOBAL)
        </p>
        <p className="text-[11px] mb-3" style={{ color: '#6b6b8a' }}>
          Quanto do rebate é retido na fonte por perna antes de chegar. Aplica-se a
          <strong> todos os clientes com PL</strong>. Não é imposto da empresa (IRPJ/CSLL).
        </p>
        <div className="space-y-2">
          <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Alíquota retenção onshore (%)</label>
          <input type="number" step="0.01" value={aliqOn} onChange={e => setAliqOn(Number(e.target.value))} className={INP} style={BRD} />
        </div>
        <div className="space-y-2 mt-3">
          <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Alíquota retenção offshore (%)</label>
          <input type="number" step="0.01" value={aliqOff} onChange={e => setAliqOff(Number(e.target.value))} className={INP} style={BRD} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Split Galácticos (%)</label>
        <input type="number" step="0.01" value={split} onChange={e => setSplit(Number(e.target.value))} className={INP} style={BRD} />
        <p className="text-xs" style={{ color: '#6b6b8a' }}>Percentual da receita de rebate retido pela Galácticos Capital.</p>
      </div>
      <button disabled={salvando} onClick={salvar}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
