// --- Aba Patrimônio da Central de Importação ---

import { useState, useRef, useCallback } from 'react';
import { Building2, Loader2, AlertTriangle, CheckCircle, X, ChevronDown, ChevronRight } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { parsePatrimonioExcel } from '../patrimonio/parsePatrimonioExcel';
import type { ParseResult } from '../patrimonio/parsePatrimonioExcel';
import { PatrimonioImportPreview } from './PatrimonioImportPreview';

const CATS = ['investimentos', 'imoveis', 'veiculos', 'outros_bens', 'passivos'] as const;

export function PatrimonioImportTab() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ParseResult | null>(null);
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [instrAberto, setInstrAberto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File | null) => {
    setArquivo(f); setResultado(null); setToast(null);
  }, []);

  const processar = useCallback(async () => {
    if (!arquivo) return;
    setProcessando(true);
    try {
      const buf = await arquivo.arrayBuffer();
      const res = parsePatrimonioExcel(buf);
      setResultado(res);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Erro ao processar', ok: false });
    } finally { setProcessando(false); }
  }, [arquivo]);

  const importar = useCallback(async () => {
    if (!resultado) return;
    setImportando(true);
    let totalRegs = 0;
    try {
      for (const c of resultado.clientes.values()) {
        for (const cat of CATS) {
          const items = (c as unknown as Record<string, unknown[]>)[cat] ?? [];
          for (const item of items) {
            await addDoc(collection(db, 'patrimonio', c.slug, cat), item as Record<string, unknown>);
            totalRegs++;
          }
        }
      }
      setToast({ msg: `Patrimônio importado: ${resultado.clientes.size} clientes, ${totalRegs} registros`, ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Erro ao importar', ok: false });
    } finally { setImportando(false); }
  }, [resultado]);

  const limpar = () => { setArquivo(null); setResultado(null); setToast(null); };

  const clientes = resultado ? [...resultado.clientes.values()] : [];
  const temErrosCriticos = resultado ? resultado.erros.length > 0 : false;

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* COLUNA ESQUERDA */}
      <div className="col-span-5 space-y-4">
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4" style={{ borderColor: '#e2e2e8' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>Importar Patrimônio</h3>
            <p className="text-xs mt-0.5" style={{ color: '#6b6b8a' }}>Investimentos, imóveis, veículos e outros bens</p>
          </div>

          <div className="border-t" style={{ borderColor: '#e2e2e8' }} />

          {/* Instrução colapsável */}
          <button onClick={() => setInstrAberto(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium w-full text-left" style={{ color: '#6b6b8a' }}>
            {instrAberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Estrutura do template
          </button>
          {instrAberto && (
            <div className="text-[10px] space-y-1 pl-5" style={{ color: '#6b6b8a' }}>
              <p><strong>investimentos:</strong> custodia, descricao, tipo, valor, moeda, data_referencia</p>
              <p><strong>imoveis:</strong> descricao, uf, tipo, valor_mercado</p>
              <p><strong>veiculos:</strong> marca, modelo, ano_modelo, ano_fabricacao</p>
              <p><strong>outros_bens:</strong> descricao, tipo, valor_estimado</p>
              <p><strong>passivos:</strong> tipo, credor, descricao, saldo_devedor, taxa, sistema, parcelas...</p>
            </div>
          )}

          {/* Dropzone */}
          <div onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0] ?? null); }}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            style={{ borderColor: arquivo ? '#22c55e' : '#e2e2e8' }}>
            <Building2 size={32} className="mx-auto mb-2" style={{ color: '#0065FF' }} />
            {arquivo ? (
              <div className="flex items-center justify-center gap-2">
                <p className="text-xs font-medium" style={{ color: '#160F41' }}>{arquivo.name}</p>
                <button onClick={e => { e.stopPropagation(); handleFile(null); }}
                  className="text-gray-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium" style={{ color: '#160F41' }}>Arraste o template patrimonial aqui</p>
                <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>ou clique para selecionar • .xlsx</p>
              </>
            )}
            <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
              onChange={e => handleFile(e.target.files?.[0] ?? null)} />
          </div>

          <button onClick={processar} disabled={!arquivo || processando}
            className="w-full py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
            {processando ? <><Loader2 size={14} className="inline animate-spin mr-1" /> Processando...</> : 'Processar'}
          </button>
        </div>

        {toast && (
          <div className={`text-xs font-medium px-3 py-2 rounded-lg ${toast.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {toast.ok ? <CheckCircle size={13} className="inline mr-1" /> : <AlertTriangle size={13} className="inline mr-1" />}
            {toast.msg}
          </div>
        )}
      </div>

      {/* COLUNA DIREITA */}
      <div className="col-span-7 space-y-4">
        {!resultado && (
          <div className="rounded-xl border flex flex-col items-center justify-center h-64"
            style={{ borderColor: '#e2e2e8', backgroundColor: '#f8f9fc' }}>
            <Building2 size={48} style={{ color: '#e2e2e8' }} />
            <p className="text-sm mt-3" style={{ color: '#6b6b8a' }}>Selecione o template para preview</p>
          </div>
        )}

        {resultado && (
          <>
            {resultado.erros.length > 0 && (
              <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
                <p className="text-xs font-semibold text-red-700">Erros ({resultado.erros.length})</p>
                {resultado.erros.slice(0, 10).map((e, i) => <p key={i} className="text-[10px] text-red-600">{e}</p>)}
                {resultado.erros.length > 10 && <p className="text-[10px] text-red-500">...e mais {resultado.erros.length - 10}</p>}
              </div>
            )}
            {resultado.avisos.length > 0 && (
              <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: '#fde68a', backgroundColor: '#fffbeb' }}>
                <p className="text-xs font-semibold text-amber-700">Avisos ({resultado.avisos.length})</p>
                {resultado.avisos.map((a, i) => <p key={i} className="text-[10px] text-amber-600">{a}</p>)}
              </div>
            )}

            <PatrimonioImportPreview clientes={clientes} />

            <div className="flex gap-3">
              {!temErrosCriticos && clientes.length > 0 && (
                <button onClick={importar} disabled={importando}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                  {importando ? <><Loader2 size={14} className="inline animate-spin mr-1" /> Importando...</>
                    : `Importar ${clientes.length} cliente${clientes.length > 1 ? 's' : ''}`}
                </button>
              )}
              <button onClick={limpar} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
                Limpar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
