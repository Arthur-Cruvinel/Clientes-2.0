// --- Aba Veículos — listagem + CRUD ---

import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Car, RefreshCw, FileUp, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import { useDocumentParser } from '../parsers/useDocumentParser';
import { PROMPTS_VEICULO } from '../parsers/parseVeiculoDoc';
import type { VeiculoExtraido } from '../parsers/parseVeiculoDoc';
import { DocumentParserPreview } from '../parsers/DocumentParserPreview';
import type { CampoExtraido } from '../parsers/useDocumentParser';
import type { Veiculo } from '../../../types';

interface Props { items: Veiculo[]; onSalvar: (item: Veiculo) => Promise<void>; onExcluir: (id: string) => Promise<void>; loading: boolean }

const INP = 'rounded-lg px-3 py-2 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
const LBL = 'text-xs font-medium mb-1';

function vazio(): Veiculo { return { marca: '', modelo: '', ano_modelo: new Date().getFullYear(), ano_fabricacao: new Date().getFullYear() }; }

export function PatrimonioVeiculos({ items, onSalvar, onExcluir, loading }: Props) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Veiculo>(vazio());
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const abrir = (item?: Veiculo) => { setForm(item ? { ...item } : vazio()); setModal(true); setDocResult(null); };
  const salvar = async () => { setSalvando(true); await onSalvar(form); setSalvando(false); setModal(false); };

  // Parser de documento
  const { parsearDocumento, parseando } = useDocumentParser();
  const [docResult, setDocResult] = useState<{ campos: VeiculoExtraido; documento_tipo: string; avisos: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleDocUpload = async (file: File) => {
    const res = await parsearDocumento<VeiculoExtraido>(file, PROMPTS_VEICULO.system, PROMPTS_VEICULO.user);
    if (res) setDocResult({ campos: res.campos, documento_tipo: res.documento_tipo, avisos: res.avisos });
  };
  const aplicarDoc = () => {
    if (!docResult) return;
    const c = docResult.campos;
    const v = (campo: CampoExtraido<unknown>) => campo.valor;
    setForm(p => ({
      ...p,
      ...(v(c.marca) != null ? { marca: v(c.marca) as string } : {}),
      ...(v(c.modelo) != null ? { modelo: v(c.modelo) as string } : {}),
      ...(v(c.ano_modelo) != null ? { ano_modelo: v(c.ano_modelo) as number } : {}),
      ...(v(c.ano_fabricacao) != null ? { ano_fabricacao: v(c.ano_fabricacao) as number } : {}),
      ...(v(c.placa) != null ? { placa: v(c.placa) as string } : {}),
    }));
    setDocResult(null);
  };

  if (loading) return <div className="py-8 text-center text-sm" style={{ color: '#6b6b8a' }}>Carregando...</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>Veículos</h4>
        <button onClick={() => abrir()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand"><Plus size={13} /> Adicionar</button>
      </div>
      {items.length === 0 && <div className="text-center py-12"><Car size={40} className="mx-auto" style={{ color: '#e2e2e8' }} /><p className="text-sm mt-2" style={{ color: '#6b6b8a' }}>Nenhum veículo cadastrado</p><button onClick={() => abrir()} className="mt-3 text-xs font-medium" style={{ color: '#0065FF' }}>Adicionar primeiro veículo</button></div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map(v => (
          <div key={v.id} className="rounded-lg border p-4 hover:shadow-md transition-shadow" style={{ borderColor: '#e2e2e8' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: '#160F41' }}>{v.marca} {v.modelo}</p>
                <p className="text-[10px]" style={{ color: '#6b6b8a' }}>{v.ano_fabricacao}/{v.ano_modelo}</p>
                <p className="text-lg font-bold" style={{ color: '#0ea5e9' }}>{formatCurrency(v.valor_fipe ?? v.valor_mercado_manual ?? 0)}</p>
                {v.placa && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100" style={{ color: '#6b6b8a' }}>{v.placa}</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => abrir(v)} className="p-1 rounded hover:bg-gray-100"><Pencil size={13} style={{ color: '#6b6b8a' }} /></button>
                <button onClick={() => v.id && confirm('Excluir veículo?') && onExcluir(v.id)} className="p-1 rounded hover:bg-red-50"><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <Modal aberto onFechar={() => setModal(false)} titulo={form.id ? 'Editar Veículo' : 'Adicionar Veículo'}>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {!docResult && !parseando && (
              <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f2 = e.dataTransfer.files[0]; if (f2) handleDocUpload(f2); }}
                className="border border-dashed rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors" style={{ borderColor: '#e2e2e8' }}>
                <FileUp size={16} style={{ color: '#0065FF' }} />
                <div><p className="text-xs font-medium" style={{ color: '#160F41' }}>Preencher com documento</p><p className="text-[10px]" style={{ color: '#94a3b8' }}>DUT ou CRLV — arraste o PDF</p></div>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f2 = e.target.files?.[0]; if (f2) handleDocUpload(f2); }} />
              </div>
            )}
            {parseando && <div className="rounded-lg p-4 text-center" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}><Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: '#0065FF' }} /><p className="text-xs" style={{ color: '#6b6b8a' }}>Analisando documento...</p></div>}
            {docResult && <DocumentParserPreview campos={docResult.campos as unknown as Record<string, CampoExtraido<unknown>>} documento_tipo={docResult.documento_tipo} avisos={docResult.avisos} onAplicar={aplicarDoc} onDescartar={() => setDocResult(null)} />}
            {!parseando && !docResult && <div className="flex items-center gap-2"><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /><span className="text-[10px]" style={{ color: '#94a3b8' }}>ou preencha manualmente</span><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /></div>}
            <div className="grid grid-cols-2 gap-2">
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Marca</p><input value={form.marca} onChange={e => set('marca', e.target.value)} className={INP} style={BRD} /></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Modelo</p><input value={form.modelo} onChange={e => set('modelo', e.target.value)} className={INP} style={BRD} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Ano modelo</p><input type="number" value={form.ano_modelo} onChange={e => set('ano_modelo', Number(e.target.value))} className={INP} style={BRD} /></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Ano fabricação</p><input type="number" value={form.ano_fabricacao} onChange={e => set('ano_fabricacao', Number(e.target.value))} className={INP} style={BRD} /></div>
            </div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Código FIPE</p><input value={form.fipe_codigo ?? ''} onChange={e => set('fipe_codigo', e.target.value)} className={INP} style={BRD} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Valor FIPE</p><input type="number" value={form.valor_fipe ?? ''} onChange={e => set('valor_fipe', Number(e.target.value))} className={INP} style={BRD} /></div>
              <div><p className={LBL} style={{ color: '#6b6b8a' }}>Valor mercado manual</p><input type="number" value={form.valor_mercado_manual ?? ''} onChange={e => set('valor_mercado_manual', Number(e.target.value))} className={INP} style={BRD} /></div>
            </div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Placa</p><input value={form.placa ?? ''} onChange={e => set('placa', e.target.value)} className={INP} style={BRD} /></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Notas</p><textarea value={form.notas ?? ''} onChange={e => set('notas', e.target.value)} className={INP} style={BRD} rows={2} /></div>
            <button onClick={() => alert('Em breve')} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0065FF' }}><RefreshCw size={13} /> Buscar FIPE</button>
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
