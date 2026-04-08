// --- Aba Investimentos — listagem + CRUD ---

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Briefcase, Loader2, ArrowRight } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import type { InvestimentoExterno, CustodiaExterna, TipoInvestimento } from '../../../types';
import type { CarteiraGalapagos } from '../usePatrimonioCrud';

interface Props {
  items: InvestimentoExterno[];
  onSalvar: (item: InvestimentoExterno) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  loading: boolean;
  carteiraGalapagos?: CarteiraGalapagos | null;
}

const COR_CUST: Record<string, { bg: string; cor: string }> = {
  morgan_stanley: { bg: '#160F41', cor: '#fff' }, xp: { bg: '#fef3c7', cor: '#92400e' },
  btg: { bg: '#dbeafe', cor: '#1e40af' }, bradesco: { bg: '#fee2e2', cor: '#991b1b' },
  outro: { bg: '#f3f4f6', cor: '#6b7280' },
};
const CUSTODIAS: CustodiaExterna[] = ['morgan_stanley', 'xp', 'btg', 'bradesco', 'outro'];
const TIPOS: TipoInvestimento[] = ['renda_fixa', 'renda_variavel', 'fundo', 'previdencia', 'outro'];
const MOEDAS = ['BRL', 'USD', 'EUR'] as const;
const LABEL_TIPO: Record<string, string> = { renda_fixa: 'Renda Fixa', renda_variavel: 'Renda Variável', fundo: 'Fundos', previdencia: 'Previdência', outro: 'Outros' };

const INP = 'rounded-lg px-3 py-2 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
const LBL = 'text-xs font-medium mb-1';

function vazio(): InvestimentoExterno {
  return { custodia: 'outro', descricao: '', tipo: 'outro', valor: 0, moeda: 'BRL', data_referencia: '' };
}

export function PatrimonioInvestimentos({ items, onSalvar, onExcluir, loading, carteiraGalapagos }: Props) {
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<InvestimentoExterno>(vazio());
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const abrir = (item?: InvestimentoExterno) => { setForm(item ? { ...item } : vazio()); setModal(true); };
  const salvar = async () => { setSalvando(true); await onSalvar(form); setSalvando(false); setModal(false); };
  const excluir = async (id: string) => { if (confirm('Excluir investimento?')) await onExcluir(id); };

  if (loading) return <div className="py-8 text-center text-sm" style={{ color: '#6b6b8a' }}>Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>Investimentos Externos</h4>
        <button onClick={() => abrir()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12">
          <Briefcase size={40} className="mx-auto" style={{ color: '#e2e2e8' }} />
          <p className="text-sm mt-2" style={{ color: '#6b6b8a' }}>Nenhum investimento cadastrado</p>
          <button onClick={() => abrir()} className="mt-3 text-xs font-medium" style={{ color: '#0065FF' }}>Adicionar primeiro investimento</button>
        </div>
      )}

      {carteiraGalapagos && carteiraGalapagos.pl_total > 0 && (
        <div className="rounded-lg border-2 p-4" style={{ borderImage: 'linear-gradient(90deg, #0065FF, #D000BB) 1' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded font-bold text-white" style={{ background: 'linear-gradient(90deg, #0065FF, #D000BB)' }}>Galápagos Capital</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100" style={{ color: '#6b6b8a' }}>Atualizado: {carteiraGalapagos.periodo_label}</span>
          </div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#160F41' }}>Carteira Galápagos</p>
          <div className="flex gap-6 mb-2">
            <div><p className="text-[9px] uppercase" style={{ color: '#64748b' }}>Onshore</p><p className="text-sm font-bold" style={{ color: '#0065FF' }}>{formatCurrency(carteiraGalapagos.pl_onshore)}</p></div>
            <div><p className="text-[9px] uppercase" style={{ color: '#64748b' }}>Offshore</p><p className="text-sm font-bold" style={{ color: '#7c3aed' }}>{formatCurrency(carteiraGalapagos.pl_offshore)}</p></div>
            <div><p className="text-[9px] uppercase" style={{ color: '#64748b' }}>Total</p><p className="text-lg font-bold" style={{ color: '#16a34a' }}>{formatCurrency(carteiraGalapagos.pl_total)}</p></div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px]" style={{ color: '#94a3b8' }}>Dados sincronizados do módulo AUM & Performance</p>
            <button onClick={() => navigate('/poupanca')} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#0065FF' }}>
              Ver detalhes <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map(i => {
          const cc = COR_CUST[i.custodia] ?? COR_CUST.outro;
          return (
            <div key={i.id} className="rounded-lg border p-4 hover:shadow-md transition-shadow" style={{ borderColor: '#e2e2e8' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: cc.bg, color: cc.cor }}>{i.custodia}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100" style={{ color: '#6b6b8a' }}>{LABEL_TIPO[i.tipo] ?? i.tipo}</span>
                  </div>
                  <p className="text-xs font-medium truncate" style={{ color: '#160F41' }}>{i.descricao}</p>
                  <p className="text-lg font-bold" style={{ color: '#16a34a' }}>{formatCurrency(i.valor_brl ?? i.valor)}</p>
                  {i.moeda !== 'BRL' && <p className="text-[10px]" style={{ color: '#6b6b8a' }}>{i.moeda} {i.valor.toLocaleString()}</p>}
                  <p className="text-[10px]" style={{ color: '#94a3b8' }}>{i.data_referencia}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrir(i)} className="p-1 rounded hover:bg-gray-100"><Pencil size={13} style={{ color: '#6b6b8a' }} /></button>
                  <button onClick={() => i.id && excluir(i.id)} className="p-1 rounded hover:bg-red-50"><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal aberto onFechar={() => setModal(false)} titulo={form.id ? 'Editar Investimento' : 'Adicionar Investimento'}>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Custódia</p><select value={form.custodia} onChange={e => set('custodia', e.target.value)} className={INP} style={BRD}>{CUSTODIAS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            {form.custodia === 'outro' && <div><p className={LBL} style={{ color: '#6b6b8a' }}>Instituição</p><input value={form.instituicao ?? ''} onChange={e => set('instituicao', e.target.value)} className={INP} style={BRD} /></div>}
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Descrição</p><input value={form.descricao} onChange={e => set('descricao', e.target.value)} className={INP} style={BRD} /></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Tipo</p><select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={INP} style={BRD}>{TIPOS.map(t => <option key={t} value={t}>{LABEL_TIPO[t]}</option>)}</select></div>
            <div className="grid grid-cols-3 gap-2">
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Valor</p><input type="number" value={form.valor} onChange={e => set('valor', Number(e.target.value))} className={INP} style={BRD} /></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Moeda</p><select value={form.moeda} onChange={e => set('moeda', e.target.value)} className={INP} style={BRD}>{MOEDAS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              {form.moeda !== 'BRL' && <div><p className={LBL} style={{ color: '#6b6b8a' }}>Valor BRL</p><input type="number" value={form.valor_brl ?? ''} onChange={e => set('valor_brl', Number(e.target.value))} className={INP} style={BRD} /></div>}
            </div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Data referência</p><input type="date" value={form.data_referencia} onChange={e => set('data_referencia', e.target.value)} className={INP} style={BRD} /></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Rentabilidade anual %</p><input type="number" step="0.01" value={form.rentabilidade_anual ?? ''} onChange={e => set('rentabilidade_anual', Number(e.target.value))} className={INP} style={BRD} /></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Notas</p><textarea value={form.notas ?? ''} onChange={e => set('notas', e.target.value)} className={INP} style={BRD} rows={2} /></div>
          </div>
          <div className="flex gap-3 justify-end mt-4 pt-4 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? <><Loader2 size={13} className="inline animate-spin mr-1" />Salvando...</> : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
