// --- Aba Passivos — listagem + CRUD ---

import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, TrendingDown, Table2, FileUp, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import type { Passivo, TipoPassivo, SistemaAmortizacao } from '../../../types';
import { useDocumentParser } from '../parsers/useDocumentParser';
import { PROMPTS_PASSIVO } from '../parsers/parsePassivoDoc';
import type { PassivoExtraido } from '../parsers/parsePassivoDoc';
import { DocumentParserPreview } from '../parsers/DocumentParserPreview';
import type { CampoExtraido } from '../parsers/useDocumentParser';
import { TabelaAmortizacao } from './TabelaAmortizacao';

interface Props { items: Passivo[]; onSalvar: (item: Passivo) => Promise<void>; onExcluir: (id: string) => Promise<void>; loading: boolean }

const TIPOS: TipoPassivo[] = ['financiamento_imovel', 'financiamento_veiculo', 'emprestimo', 'cartao', 'outro'];
const SISTEMAS: SistemaAmortizacao[] = ['SAC', 'PRICE', 'outro'];
const LABEL_TIPO: Record<string, string> = { financiamento_imovel: 'Financ. Imóvel', financiamento_veiculo: 'Financ. Veículo', emprestimo: 'Empréstimo', cartao: 'Cartão', outro: 'Outro' };
const INP = 'rounded-lg px-3 py-2 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
const LBL = 'text-xs font-medium mb-1';

function vazio(): Passivo {
  return { tipo: 'emprestimo', credor: '', descricao: '', saldo_devedor: 0, taxa_juros_mensal: 0, sistema_amortizacao: 'SAC', parcela_atual: 0, parcelas_restantes: 0, data_inicio: '', data_fim: '' };
}

export function PatrimonioPassivos({ items, onSalvar, onExcluir, loading }: Props) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Passivo>(vazio());
  const [salvando, setSalvando] = useState(false);
  const [amortModal, setAmortModal] = useState<Passivo | null>(null);
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const abrir = (item?: Passivo) => { setForm(item ? { ...item } : vazio()); setModal(true); setDocResult(null); };
  const salvar = async () => { setSalvando(true); await onSalvar(form); setSalvando(false); setModal(false); };

  const { parsearDocumento, parseando } = useDocumentParser();
  const [docResult, setDocResult] = useState<{ campos: PassivoExtraido; documento_tipo: string; avisos: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleDocUpload = async (file: File) => {
    const res = await parsearDocumento<PassivoExtraido>(file, PROMPTS_PASSIVO.system, PROMPTS_PASSIVO.user);
    if (res) setDocResult({ campos: res.campos, documento_tipo: res.documento_tipo, avisos: res.avisos });
  };
  const aplicarDoc = () => {
    if (!docResult) return;
    const c = docResult.campos;
    const v = (campo: CampoExtraido<unknown>) => campo.valor;
    setForm(p => ({
      ...p,
      ...(v(c.tipo) != null ? { tipo: v(c.tipo) as TipoPassivo } : {}),
      ...(v(c.credor) != null ? { credor: v(c.credor) as string } : {}),
      ...(v(c.descricao) != null ? { descricao: v(c.descricao) as string } : {}),
      ...(v(c.saldo_devedor) != null ? { saldo_devedor: v(c.saldo_devedor) as number } : {}),
      ...(v(c.taxa_juros_mensal) != null ? { taxa_juros_mensal: v(c.taxa_juros_mensal) as number } : {}),
      ...(v(c.sistema_amortizacao) != null ? { sistema_amortizacao: v(c.sistema_amortizacao) as SistemaAmortizacao } : {}),
      ...(v(c.parcela_atual) != null ? { parcela_atual: v(c.parcela_atual) as number } : {}),
      ...(v(c.parcelas_restantes) != null ? { parcelas_restantes: v(c.parcelas_restantes) as number } : {}),
      ...(v(c.data_inicio) != null ? { data_inicio: v(c.data_inicio) as string } : {}),
      ...(v(c.data_fim) != null ? { data_fim: v(c.data_fim) as string } : {}),
      ...(v(c.bem_vinculado) != null ? { bem_vinculado: v(c.bem_vinculado) as string } : {}),
    }));
    setDocResult(null);
  };

  if (loading) return <div className="py-8 text-center text-sm" style={{ color: '#6b6b8a' }}>Carregando...</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>Passivos</h4>
        <button onClick={() => abrir()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand"><Plus size={13} /> Adicionar</button>
      </div>
      {items.length === 0 && <div className="text-center py-12"><TrendingDown size={40} className="mx-auto" style={{ color: '#e2e2e8' }} /><p className="text-sm mt-2" style={{ color: '#6b6b8a' }}>Nenhum passivo cadastrado</p><button onClick={() => abrir()} className="mt-3 text-xs font-medium" style={{ color: '#0065FF' }}>Adicionar primeiro passivo</button></div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map(p => (
          <div key={p.id} className="rounded-lg border p-4 hover:shadow-md transition-shadow" style={{ borderColor: '#e2e2e8' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100" style={{ color: '#991b1b' }}>{LABEL_TIPO[p.tipo] ?? p.tipo}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100" style={{ color: '#6b6b8a' }}>{p.sistema_amortizacao}</span>
                </div>
                <p className="text-xs font-medium truncate" style={{ color: '#160F41' }}>{p.descricao}</p>
                <p className="text-[10px]" style={{ color: '#6b6b8a' }}>{p.credor}</p>
                <p className="text-lg font-bold" style={{ color: '#dc2626' }}>{formatCurrency(p.saldo_devedor)}</p>
                <p className="text-[10px]" style={{ color: '#6b6b8a' }}>Parcela: {formatCurrency(p.parcela_atual)} • {p.parcelas_restantes} restantes • até {p.data_fim}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => abrir(p)} className="p-1 rounded hover:bg-gray-100"><Pencil size={13} style={{ color: '#6b6b8a' }} /></button>
                <button onClick={() => setAmortModal(p)} className="p-1 rounded hover:bg-blue-50" title="Tabela de amortização"><Table2 size={13} style={{ color: '#0065FF' }} /></button>
                <button onClick={() => p.id && confirm('Excluir passivo?') && onExcluir(p.id)} className="p-1 rounded hover:bg-red-50"><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <Modal aberto onFechar={() => setModal(false)} titulo={form.id ? 'Editar Passivo' : 'Adicionar Passivo'}>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {!docResult && !parseando && (
              <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f2 = e.dataTransfer.files[0]; if (f2) handleDocUpload(f2); }}
                className="border border-dashed rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors" style={{ borderColor: '#e2e2e8' }}>
                <FileUp size={16} style={{ color: '#0065FF' }} />
                <div><p className="text-xs font-medium" style={{ color: '#160F41' }}>Preencher com documento</p><p className="text-[10px]" style={{ color: '#94a3b8' }}>Contrato de financiamento — arraste o PDF</p></div>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f2 = e.target.files?.[0]; if (f2) handleDocUpload(f2); }} />
              </div>
            )}
            {parseando && <div className="rounded-lg p-4 text-center" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}><Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: '#0065FF' }} /><p className="text-xs" style={{ color: '#6b6b8a' }}>Analisando contrato...</p></div>}
            {docResult && <DocumentParserPreview campos={docResult.campos as unknown as Record<string, CampoExtraido<unknown>>} documento_tipo={docResult.documento_tipo} avisos={docResult.avisos} onAplicar={aplicarDoc} onDescartar={() => setDocResult(null)} />}
            {!parseando && !docResult && <div className="flex items-center gap-2"><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /><span className="text-[10px]" style={{ color: '#94a3b8' }}>ou preencha manualmente</span><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /></div>}
            <div className="grid grid-cols-2 gap-2">
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Tipo</p><select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={INP} style={BRD}>{TIPOS.map(t => <option key={t} value={t}>{LABEL_TIPO[t]}</option>)}</select></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Credor</p><input value={form.credor} onChange={e => set('credor', e.target.value)} className={INP} style={BRD} /></div>
            </div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Descrição</p><input value={form.descricao} onChange={e => set('descricao', e.target.value)} className={INP} style={BRD} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Saldo devedor</p><input type="number" value={form.saldo_devedor} onChange={e => set('saldo_devedor', Number(e.target.value))} className={INP} style={BRD} /></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Taxa juros mensal %</p><input type="number" step="0.001" value={form.taxa_juros_mensal} onChange={e => set('taxa_juros_mensal', Number(e.target.value))} className={INP} style={BRD} /></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Sistema</p><select value={form.sistema_amortizacao} onChange={e => set('sistema_amortizacao', e.target.value)} className={INP} style={BRD}>{SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Parcela atual</p><input type="number" value={form.parcela_atual} onChange={e => set('parcela_atual', Number(e.target.value))} className={INP} style={BRD} /></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Parcelas restantes</p><input type="number" value={form.parcelas_restantes} onChange={e => set('parcelas_restantes', Number(e.target.value))} className={INP} style={BRD} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Data início</p><input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} className={INP} style={BRD} /></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Data fim</p><input type="date" value={form.data_fim} onChange={e => set('data_fim', e.target.value)} className={INP} style={BRD} /></div>
            </div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Bem vinculado</p><input value={form.bem_vinculado ?? ''} onChange={e => set('bem_vinculado', e.target.value)} className={INP} style={BRD} /></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Notas</p><textarea value={(form as unknown as Record<string, string>).notas ?? ''} onChange={e => set('notas', e.target.value)} className={INP} style={BRD} rows={2} /></div>
          </div>
          <div className="flex gap-3 justify-end mt-4 pt-4 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
      {amortModal && (
        <Modal aberto onFechar={() => setAmortModal(null)} titulo={`Amortização — ${amortModal.descricao}`}>
          <TabelaAmortizacao passivo={amortModal} />
        </Modal>
      )}
    </div>
  );
}
