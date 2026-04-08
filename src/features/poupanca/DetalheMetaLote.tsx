// --- Painel de edição de meta em lote ---

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { RegistroPoupanca } from '../../types';

interface Props {
  registros: RegistroPoupanca[];
  onAplicado: (atualizados: RegistroPoupanca[]) => void;
  onFechar: () => void;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function slugify(nome: string) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function DetalheMetaLote({ registros, onAplicado, onFechar }: Props) {
  const sorted = [...registros].sort((a, b) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes));
  const primeiro = sorted[0];
  const ultimo = sorted[sorted.length - 1];

  const [mesIni, setMesIni] = useState(primeiro.mes);
  const [anoIni, setAnoIni] = useState(primeiro.ano);
  const [mesFim, setMesFim] = useState(ultimo.mes);
  const [anoFim, setAnoFim] = useState(ultimo.ano);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aplicar() {
    const meta = Number(valor.replace(',', '.'));
    if (isNaN(meta) || meta <= 0) { setErro('Valor inválido'); return; }

    const ini = anoIni * 12 + mesIni;
    const fim = anoFim * 12 + mesFim;
    const filtrados = sorted.filter(r => {
      const p = r.ano * 12 + r.mes;
      return p >= ini && p <= fim;
    });

    if (filtrados.length === 0) { setErro('Nenhum mês no intervalo'); return; }

    setSalvando(true);
    setErro(null);
    try {
      const slug = slugify(filtrados[0].nome_cliente);
      await Promise.all(filtrados.map(r => {
        const docId = `${slug}_${r.ano}_${r.mes}`;
        return updateDoc(doc(db, 'poupanca', docId), { meta_poupanca_mensal: meta });
      }));
      const atualizados = filtrados.map(r => ({ ...r, meta_poupanca_mensal: meta }));
      onAplicado(atualizados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  const SEL = 'rounded-lg px-2 py-1 text-xs';
  const BSEL = { border: '1px solid #e2e2e8', color: '#160F41' };

  return (
    <div className="bg-blue-50/50 border rounded-lg p-3 flex flex-wrap items-end gap-3"
      style={{ borderColor: '#bfdbfe' }}>
      <div>
        <p className="text-[10px] font-medium mb-1" style={{ color: '#6b6b8a' }}>De:</p>
        <div className="flex gap-1">
          <select value={mesIni} onChange={e => setMesIni(Number(e.target.value))} className={SEL} style={BSEL}>
            {MESES.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
          </select>
          <select value={anoIni} onChange={e => setAnoIni(Number(e.target.value))} className={SEL} style={BSEL}>
            {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-medium mb-1" style={{ color: '#6b6b8a' }}>Até:</p>
        <div className="flex gap-1">
          <select value={mesFim} onChange={e => setMesFim(Number(e.target.value))} className={SEL} style={BSEL}>
            {MESES.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
          </select>
          <select value={anoFim} onChange={e => setAnoFim(Number(e.target.value))} className={SEL} style={BSEL}>
            {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-medium mb-1" style={{ color: '#6b6b8a' }}>Meta mensal (R$):</p>
        <input value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: 50000"
          className="rounded-lg px-2 py-1 text-xs w-28" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
      </div>
      <button onClick={aplicar} disabled={salvando}
        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
        {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Aplicar
      </button>
      <button onClick={onFechar} className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100">
        <X size={12} />
      </button>
      {erro && <span className="text-[10px] font-medium" style={{ color: '#dc2626' }}>{erro}</span>}
    </div>
  );
}
