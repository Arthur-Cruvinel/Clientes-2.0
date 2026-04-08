// --- Painel de edição de meta em lote (visão geral Poupança) ---

import { useState, useMemo } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { RegistroPoupanca } from '../../types';

interface Props {
  registrosPorCliente: Map<string, RegistroPoupanca[]>;
  mesInicio: number; anoInicio: number;
  mesFim: number; anoFim: number;
  onAplicado: () => void;
  onFechar: () => void;
}

const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ANOS = [2024, 2025, 2026, 2027];
const SEL = 'rounded-lg px-2 py-1 text-xs';
const BSEL = { border: '1px solid #e2e2e8', color: '#160F41' };

function slugify(nome: string) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function PoupancaMetaLote({ registrosPorCliente, mesInicio, anoInicio, mesFim, anoFim, onAplicado, onFechar }: Props) {
  const [mIni, setMIni] = useState(mesInicio);
  const [aIni, setAIni] = useState(anoInicio);
  const [mFim, setMFim] = useState(mesFim);
  const [aFim, setAFim] = useState(anoFim);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const nomes = useMemo(() => [...registrosPorCliente.keys()].sort(), [registrosPorCliente]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(nomes));

  const todosChecked = selecionados.size === nomes.length;
  function toggleTodos() { setSelecionados(todosChecked ? new Set() : new Set(nomes)); }
  function toggleCliente(n: string) {
    setSelecionados(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
  }

  // Contagem de meses afetados
  const mesesAfetados = useMemo(() => {
    const ini = aIni * 12 + mIni, fim = aFim * 12 + mFim;
    let total = 0;
    for (const nome of selecionados) {
      const regs = registrosPorCliente.get(nome) ?? [];
      total += regs.filter(r => { const p = r.ano * 12 + r.mes; return p >= ini && p <= fim; }).length;
    }
    return total;
  }, [selecionados, registrosPorCliente, mIni, aIni, mFim, aFim]);

  async function aplicar() {
    const meta = Number(valor.replace(',', '.'));
    if (isNaN(meta) || meta <= 0) { setErro('Valor inválido'); return; }
    if (selecionados.size === 0) { setErro('Selecione ao menos 1 cliente'); return; }

    setSalvando(true); setErro(null);
    const ini = aIni * 12 + mIni, fim = aFim * 12 + mFim;
    try {
      const promises: Promise<void>[] = [];
      for (const nome of selecionados) {
        const slug = slugify(nome);
        const regs = registrosPorCliente.get(nome) ?? [];
        for (const r of regs) {
          const p = r.ano * 12 + r.mes;
          if (p >= ini && p <= fim) {
            promises.push(updateDoc(doc(db, 'poupanca', `${slug}_${r.ano}_${r.mes}`), { meta_poupanca_mensal: meta }));
          }
        }
      }
      await Promise.all(promises);
      setToast(`Meta aplicada: ${promises.length} registros atualizados`);
      setTimeout(() => { onAplicado(); }, 1500);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4" style={{ borderColor: '#e2e2e8' }}>
      <div>
        <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>Definir Meta em Lote</h4>
        <p className="text-xs mt-0.5" style={{ color: '#6b6b8a' }}>Aplica a mesma meta para os clientes selecionados no período escolhido</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div><p className="text-[10px] font-medium mb-1" style={{ color: '#6b6b8a' }}>De:</p>
          <div className="flex gap-1">
            <select value={mIni} onChange={e => setMIni(Number(e.target.value))} className={SEL} style={BSEL}>{ML.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}</select>
            <select value={aIni} onChange={e => setAIni(Number(e.target.value))} className={SEL} style={BSEL}>{ANOS.map(a => <option key={a} value={a}>{a}</option>)}</select>
          </div>
        </div>
        <div><p className="text-[10px] font-medium mb-1" style={{ color: '#6b6b8a' }}>Até:</p>
          <div className="flex gap-1">
            <select value={mFim} onChange={e => setMFim(Number(e.target.value))} className={SEL} style={BSEL}>{ML.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}</select>
            <select value={aFim} onChange={e => setAFim(Number(e.target.value))} className={SEL} style={BSEL}>{ANOS.map(a => <option key={a} value={a}>{a}</option>)}</select>
          </div>
        </div>
        <div><p className="text-[10px] font-medium mb-1" style={{ color: '#6b6b8a' }}>Meta mensal (R$):</p>
          <input value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: 50000"
            className="rounded-lg px-2 py-1 text-xs w-32" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#160F41' }}>
          <input type="checkbox" checked={todosChecked} onChange={toggleTodos} className="rounded" />
          <span className="font-medium">Selecionar todos ({nomes.length})</span>
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-1 max-h-32 overflow-y-auto">
          {nomes.map(n => (
            <label key={n} className="flex items-center gap-1.5 text-xs cursor-pointer min-w-[200px]" style={{ color: '#160F41' }}>
              <input type="checkbox" checked={selecionados.has(n)} onChange={() => toggleCliente(n)} className="rounded" />
              {n}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={aplicar} disabled={salvando || selecionados.size === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {salvando ? 'Aplicando...' : `Aplicar em ${selecionados.size} clientes`}
        </button>
        <button onClick={onFechar} className="px-3 py-2 rounded-lg text-xs font-medium"
          style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
        <span className="text-[10px] ml-auto" style={{ color: '#6b6b8a' }}>
          {selecionados.size} clientes | {mesesAfetados} meses afetados
        </span>
      </div>

      {erro && <p className="text-xs" style={{ color: '#dc2626' }}>{erro}</p>}
      {toast && <p className="text-xs" style={{ color: '#16a34a' }}>{toast}</p>}
    </div>
  );
}
