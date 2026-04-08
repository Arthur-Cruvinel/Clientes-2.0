// --- Aba Excel & Dados — layout 2 colunas ---

import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Loader2, CheckCircle, XCircle, AlertTriangle, BarChart3 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useUploadImport } from './useUploadImport';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ANOS = [2024, 2025, 2026];

export function UploadImport() {
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    mes, setMes, ano, setAno, periodo,
    etapa, preview, loteInfo, logs, erro,
    mostrarConfirmacao, setMostrarConfirmacao,
    lerArquivo, importar, resetar,
  } = useUploadImport();

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* COLUNA ESQUERDA */}
      <div className="col-span-5">
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5" style={{ borderColor: '#e2e2e8' }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: '#160F41' }}>Importar Template Excel</h3>
            <p className="text-sm mt-0.5" style={{ color: '#6b6b8a' }}>Clientes, colaboradores e custos indiretos</p>
          </div>
          <div className="border-t" style={{ borderColor: '#e2e2e8' }} />
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Período de destino</p>
            <div className="flex gap-3">
              <select value={mes} onChange={e => setMes(Number(e.target.value))} disabled={etapa === 'importando'}
                className="flex-1 rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
                {MESES.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
              <select value={ano} onChange={e => setAno(Number(e.target.value))} disabled={etapa === 'importando'}
                className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="border-t" style={{ borderColor: '#e2e2e8' }} />
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Arquivo</p>
            <div onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50/20"
              style={{ borderColor: '#e2e2e8' }}>
              <FileSpreadsheet className="mx-auto mb-2" size={32} style={{ color: '#0065FF' }} />
              <p className="text-sm font-medium" style={{ color: '#160F41' }}>Arraste o template aqui</p>
              <p className="text-xs mt-1" style={{ color: '#6b6b8a' }}>ou clique para selecionar &bull; .xlsx</p>
              <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }} />
            </div>
          </div>
          {etapa === 'preview' && preview && (
            <button onClick={() => setMostrarConfirmacao(true)}
              className="w-full px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-brand">
              Importar Dados para {mes}/{ano}
            </button>
          )}
        </div>
      </div>

      {/* COLUNA DIREITA */}
      <div className="col-span-7">
        {etapa === 'selecao' && !erro && (
          <div className="rounded-xl border flex flex-col items-center justify-center h-96"
            style={{ borderColor: '#e2e2e8', backgroundColor: '#f8f9fc' }}>
            <BarChart3 size={48} style={{ color: '#e2e2e8' }} />
            <p className="text-sm mt-3" style={{ color: '#6b6b8a' }}>Selecione um arquivo para visualizar o preview</p>
          </div>
        )}
        {erro && (
          <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 text-red-700 text-sm">
            <XCircle size={16} className="mt-0.5 flex-shrink-0" /> {erro}
          </div>
        )}
        {preview && etapa === 'preview' && (
          <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: '#e2e2e8' }}>
            <p className="text-sm font-medium" style={{ color: '#160F41' }}>
              <CheckCircle size={14} className="inline -mt-0.5 mr-1" style={{ color: '#16a34a' }} />
              {preview.colaboradores.length} colaboradores &bull; {preview.clientes.length} clientes
              &bull; {preview.custosIndiretos.length} custos &bull; {preview.poupanca.length} poupança
            </p>
            {preview.abasAusentes.length > 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-800 text-xs">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Abas não encontradas: {preview.abasAusentes.join(', ')}
              </div>
            )}
          </div>
        )}
        {etapa === 'importando' && (
          <div className="rounded-xl border p-5" style={{ borderColor: '#e2e2e8' }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: '#160F41' }}>
              <Loader2 className="animate-spin" size={16} /> Enviando lote {loteInfo.loteAtual} de {loteInfo.loteTotal}...
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-gradient-brand transition-all"
                style={{ width: `${loteInfo.loteTotal ? (loteInfo.loteAtual / loteInfo.loteTotal) * 100 : 0}%` }} />
            </div>
          </div>
        )}
        {etapa === 'concluido' && (
          <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: '#e2e2e8' }}>
            <p className="text-sm font-medium flex items-center gap-2" style={{ color: '#16a34a' }}>
              <CheckCircle size={16} /> Importação concluída — {periodo}
            </p>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
              {logs.map((log, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm"
                  style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9fb', borderTop: i > 0 ? '1px solid #e2e2e8' : undefined }}>
                  {log.status === 'ok' ? <CheckCircle size={14} style={{ color: '#16a34a' }} /> : <XCircle size={14} style={{ color: '#dc2626' }} />}
                  <span className="font-medium" style={{ color: '#160F41', minWidth: 130 }}>{log.colecao}</span>
                  <span style={{ color: log.status === 'ok' ? '#6b6b8a' : '#dc2626' }}>{log.mensagem}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => nav('/visao-geral')} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">Ir para Visão Geral</button>
              <button onClick={resetar} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Nova importação</button>
            </div>
          </div>
        )}
      </div>

      <Modal aberto={mostrarConfirmacao} onFechar={() => setMostrarConfirmacao(false)} titulo="Confirmar importação">
        <p className="text-sm mb-4" style={{ color: '#160F41' }}>
          Isso vai substituir todos os dados do período <strong>{mes}/{ano}</strong>. Continuar?
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setMostrarConfirmacao(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
          <button onClick={importar} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">Confirmar</button>
        </div>
      </Modal>
    </div>
  );
}
