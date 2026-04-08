// --- Aba Outros Bens — listagem + CRUD ---

import { useState } from 'react';
import { Plus, Pencil, Trash2, Gem, Sparkles } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import type { OutroBem, TipoOutroBem } from '../../../types';

interface Props { items: OutroBem[]; onSalvar: (item: OutroBem) => Promise<void>; onExcluir: (id: string) => Promise<void>; loading: boolean }

const TIPOS: TipoOutroBem[] = ['arte', 'joias', 'participacao_societaria', 'direitos', 'criptoativo', 'outro'];
const LABEL_TIPO: Record<string, string> = { arte: 'Arte', joias: 'Joias', participacao_societaria: 'Participação Societária', direitos: 'Direitos', criptoativo: 'Criptoativo', outro: 'Outros' };
const INP = 'rounded-lg px-3 py-2 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
const LBL = 'text-xs font-medium mb-1';

function vazio(): OutroBem { return { descricao: '', tipo: 'outro', valor_estimado: 0, metodo_estimativa: 'manual' }; }

export function PatrimonioOutrosBens({ items, onSalvar, onExcluir, loading }: Props) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<OutroBem>(vazio());
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const abrir = (item?: OutroBem) => { setForm(item ? { ...item } : vazio()); setModal(true); };
  const salvar = async () => { setSalvando(true); await onSalvar(form); setSalvando(false); setModal(false); };

  if (loading) return <div className="py-8 text-center text-sm" style={{ color: '#6b6b8a' }}>Carregando...</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>Outros Bens</h4>
        <button onClick={() => abrir()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand"><Plus size={13} /> Adicionar</button>
      </div>
      {items.length === 0 && <div className="text-center py-12"><Gem size={40} className="mx-auto" style={{ color: '#e2e2e8' }} /><p className="text-sm mt-2" style={{ color: '#6b6b8a' }}>Nenhum bem cadastrado</p><button onClick={() => abrir()} className="mt-3 text-xs font-medium" style={{ color: '#0065FF' }}>Adicionar primeiro bem</button></div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map(o => (
          <div key={o.id} className="rounded-lg border p-4 hover:shadow-md transition-shadow" style={{ borderColor: '#e2e2e8' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100" style={{ color: '#92400e' }}>{LABEL_TIPO[o.tipo] ?? o.tipo}</span>
                  {o.metodo_estimativa === 'claude_ai' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100" style={{ color: '#7c3aed' }}>IA</span>}
                </div>
                <p className="text-xs font-medium truncate" style={{ color: '#160F41' }}>{o.descricao}</p>
                <p className="text-lg font-bold" style={{ color: '#f59e0b' }}>{formatCurrency(o.valor_estimado)}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => abrir(o)} className="p-1 rounded hover:bg-gray-100"><Pencil size={13} style={{ color: '#6b6b8a' }} /></button>
                <button onClick={() => o.id && confirm('Excluir bem?') && onExcluir(o.id)} className="p-1 rounded hover:bg-red-50"><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <Modal aberto onFechar={() => setModal(false)} titulo={form.id ? 'Editar Bem' : 'Adicionar Bem'}>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Descrição</p><input value={form.descricao} onChange={e => set('descricao', e.target.value)} className={INP} style={BRD} /></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Tipo</p><select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={INP} style={BRD}>{TIPOS.map(t => <option key={t} value={t}>{LABEL_TIPO[t]}</option>)}</select></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Valor estimado</p><input type="number" value={form.valor_estimado} onChange={e => set('valor_estimado', Number(e.target.value))} className={INP} style={BRD} /></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Método estimativa</p>
              <div className="flex gap-4 mt-1">
                {(['manual', 'claude_ai'] as const).map(m => (
                  <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#160F41' }}>
                    <input type="radio" name="metodo" checked={form.metodo_estimativa === m} onChange={() => set('metodo_estimativa', m)} /> {m === 'manual' ? 'Manual' : 'Claude AI'}
                  </label>
                ))}
              </div>
            </div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Data estimativa</p><input type="date" value={form.data_estimativa ?? ''} onChange={e => set('data_estimativa', e.target.value)} className={INP} style={BRD} /></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Notas</p><textarea value={form.notas ?? ''} onChange={e => set('notas', e.target.value)} className={INP} style={BRD} rows={2} /></div>
            <button onClick={() => alert('Em breve')} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#7c3aed' }}><Sparkles size={13} /> Estimar com Claude AI</button>
          </div>
          <div className="flex gap-3 justify-end mt-4 pt-4 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
