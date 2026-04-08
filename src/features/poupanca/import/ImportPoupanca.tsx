// --- Componente de importação de PDFs de poupança ---
// Toggle Offshore/Onshore, dropzone, preview com totais e rentabilidade nominal.

import { useRef, useState, useMemo } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText, RefreshCw } from 'lucide-react';
import { useImportPoupanca, type TipoImport, type ModoImport } from './useImportPoupanca';
import { formatCurrency } from '../../../utils/formatters';
// [NOVO] Preview multi-período
import { PreviewMultiPeriodo } from './PreviewMultiPeriodo';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function Cel({ valor, formato }: { valor: unknown; formato: 'moeda' | 'pct' | 'texto' }) {
  if (valor == null || (formato !== 'texto' && typeof valor !== 'number')) {
    return <td className="px-3 py-2 text-xs text-center" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>—</td>;
  }
  const texto = formato === 'moeda' ? formatCurrency(valor as number)
    : formato === 'pct' ? `${(valor as number).toFixed(2)}%` : String(valor);
  return <td className="px-3 py-2 text-xs text-right">{texto}</td>;
}

export function ImportPoupanca() {
  const inputRef = useRef<HTMLInputElement>(null);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const { tipo, setTipo, preview, processando, salvando, erro, toast, processarArquivos, salvarNoFirestore, limpar,
    ptaxAtual, ptaxData, ptaxLoading, ptaxErro, buscarPTAX,
    // [NOVO] Multi-período
    modoImport, setModoImport, previewMulti, nomeClienteMulti,
    processarMultiPeriodo, salvarMultiPeriodo } = useImportPoupanca();
  const temCamposFaltando = preview.some(i => !i.nome_cliente);
  const isOff = tipo === 'offshore';
  // [NOVO] Flag multi-período (apenas onshore)
  const isMulti = !isOff && modoImport === 'multiplo';

  const totais = useMemo(() => {
    if (preview.length === 0) return null;
    let starting = 0, plAnterior = 0, pl = 0, aporte = 0, rentNom = 0, somaPlRent = 0, somaPl = 0;
    for (const item of preview) {
      const plVal = isOff ? (item.pl_offshore_usd ?? 0) : (item.pl_onshore ?? 0);
      const aporteVal = isOff ? (item.aporte_mes_offshore ?? 0) : (item.aporte_mes_onshore ?? 0);
      const rentVal = isOff ? (item.rentabilidade_offshore ?? 0) : (item.rentabilidade_onshore ?? 0);
      starting += item.starting_value_usd ?? 0;
      plAnterior += item.pl_anterior ?? 0;
      pl += plVal;
      aporte += aporteVal;
      // Onshore: usar rendimento_nominal_brl extraído do PDF; offshore: calcular
      const itemRentNom = isOff ? (plVal * rentVal / 100) : (item.rendimento_nominal_brl ?? 0) as number;
      rentNom += itemRentNom;
      if (plVal > 0) { somaPlRent += plVal * rentVal; somaPl += plVal; }
    }
    return { starting, plAnterior, pl, aporte, rentMedia: somaPl > 0 ? somaPlRent / somaPl : 0, rentNom };
  }, [preview, isOff]);

  const TH = 'px-3 py-2 text-xs font-bold uppercase';

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
        <FileText size={18} /> Importar PDFs de Poupança
      </h3>

      <div className="flex items-center gap-4">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
          {(['offshore', 'onshore'] as TipoImport[]).map(t => (
            <button key={t} onClick={() => { setTipo(t); limpar(); }}
              className={`px-4 py-1.5 text-xs font-medium transition-all ${tipo === t ? 'bg-gradient-brand text-white' : ''}`}
              style={tipo !== t ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
              {t === 'offshore' ? 'Offshore' : 'Onshore'}
            </button>
          ))}
        </div>
        {/* [NOVO] Toggle mês único / multi-período (apenas onshore) */}
        {!isOff && (
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
            {(['unico', 'multiplo'] as ModoImport[]).map(m => (
              <button key={m} onClick={() => { setModoImport(m); limpar(); }}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${modoImport === m ? 'bg-gradient-brand text-white' : ''}`}
                style={modoImport !== m ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
                {m === 'unico' ? 'Mês único' : 'Multi-período'}
              </button>
            ))}
          </div>
        )}
        {/* [NOVO] Ocultar seletores de mês/ano no modo multi-período */}
        {!isMulti && <>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
            {MESES_LABEL.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            className="rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </>}
        {isOff && (
          <>
            <button onClick={() => buscarPTAX(ano, mes)} disabled={ptaxLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
              <RefreshCw size={13} className={ptaxLoading ? 'animate-spin' : ''} />
              {ptaxLoading ? 'Buscando...' : 'Buscar PTAX'}
            </button>
            {ptaxAtual != null && ptaxData && (
              <span className="text-xs font-medium" style={{ color: '#16a34a' }}>
                PTAX: {ptaxAtual.toFixed(4)} ({ptaxData.split('-').reverse().join('/')})
              </span>
            )}
            {ptaxErro && (
              <span className="text-xs font-medium" style={{ color: '#dc2626' }}>{ptaxErro}</span>
            )}
          </>
        )}
      </div>

      {/* [NOVO] Dropzone multi-período */}
      {isMulti ? (
        <>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            O período será detectado automaticamente do PDF.
          </p>
          <div onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/30"
            style={{ borderColor: '#e2e2e8' }}>
            <Upload className="mx-auto mb-2" size={28} style={{ color: '#6b6b8a' }} />
            <p className="text-sm" style={{ color: '#160F41' }}>Arraste o PDF do período completo</p>
            <p className="text-xs mt-1" style={{ color: '#6b6b8a' }}>Aceita 1 arquivo .pdf por vez</p>
            <input ref={inputRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { if (e.target.files?.[0]) processarMultiPeriodo(e.target.files[0]); }} />
          </div>
        </>
      ) : (
        <div onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/30"
          style={{ borderColor: '#e2e2e8' }}>
          <Upload className="mx-auto mb-2" size={28} style={{ color: '#6b6b8a' }} />
          <p className="text-sm" style={{ color: '#160F41' }}>
            Clique para selecionar PDFs {isOff ? '(US Performance Report)' : '(Extratos individuais)'}
          </p>
          <p className="text-xs mt-1" style={{ color: '#6b6b8a' }}>Aceita múltiplos arquivos .pdf</p>
          {/* [NOVO] Passa ano/mes para auto-fetch PTAX no offshore */}
          <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) processarArquivos(e.target.files, ano, mes); }} />
        </div>
      )}

      {processando && <div className="flex items-center gap-2 text-sm" style={{ color: '#160F41' }}><Loader2 className="animate-spin" size={16} /> Extraindo dados dos PDFs...</div>}
      {erro && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm"><XCircle size={16} className="mt-0.5 flex-shrink-0" /> {erro}</div>}

      {/* [NOVO] Preview multi-período */}
      {isMulti && <PreviewMultiPeriodo registros={previewMulti} nomeCliente={nomeClienteMulti}
        salvando={salvando} onSalvar={salvarMultiPeriodo} onLimpar={limpar} />}

      {!isMulti && preview.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: '#160F41' }}>{preview.length} registros extraídos</p>
          {/* [NOVO] Status PTAX auto-buscado no offshore */}
          {isOff && ptaxLoading && (
            <p className="text-xs flex items-center gap-1" style={{ color: '#6b6b8a' }}>
              <Loader2 size={12} className="animate-spin" /> Buscando PTAX...
            </p>
          )}
          {isOff && ptaxAtual != null && ptaxData && (
            <p className="text-xs font-medium" style={{ color: '#16a34a' }}>
              PTAX: {ptaxAtual.toFixed(4)} ({ptaxData.split('-').reverse().join('/')}) — será incluído ao salvar
            </p>
          )}
          {isOff && ptaxErro && (
            <p className="text-xs font-medium" style={{ color: '#ca8a04' }}>
              {ptaxErro}
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr>
                  <th className={`${TH} text-right`}>Cliente</th>
                  {isOff && <th className={`${TH} text-right`}>Starting Value</th>}
                  {!isOff && <th className={`${TH} text-right`}>AUM Anterior</th>}
                  <th className={`${TH} text-right`}>{isOff ? 'AUM USD' : 'AUM Onshore'}</th>
                  <th className={`${TH} text-right`}>Aporte</th>
                  <th className={`${TH} text-right`}>Rent. %</th>
                  <th className={`${TH} text-right`}>Rent. {isOff ? 'USD' : 'R$'}</th>
                  <th className={`${TH} text-left`}>Arquivo</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {preview.map((item, i) => {
                  const plVal = isOff ? (item.pl_offshore_usd ?? 0) : (item.pl_onshore ?? 0);
                  const rentPct = isOff ? (item.rentabilidade_offshore ?? 0) : (item.rentabilidade_onshore ?? 0);
                  const rentNom = isOff ? (plVal * rentPct / 100) : item.rendimento_nominal_brl;
                  return (
                    <tr key={i}>
                      <Cel valor={item.nome_cliente} formato="texto" />
                      {isOff && <Cel valor={item.starting_value_usd} formato="moeda" />}
                      {!isOff && <Cel valor={item.pl_anterior} formato="moeda" />}
                      <Cel valor={isOff ? item.pl_offshore_usd : item.pl_onshore} formato="moeda" />
                      <Cel valor={isOff ? item.aporte_mes_offshore : item.aporte_mes_onshore} formato="moeda" />
                      <Cel valor={isOff ? item.rentabilidade_offshore : item.rentabilidade_onshore} formato="pct" />
                      <Cel valor={rentNom} formato="moeda" />
                      <td className="px-3 py-2 text-xs truncate max-w-[120px]" style={{ color: '#6b6b8a' }}>{item._arquivo}</td>
                    </tr>
                  );
                })}
              </tbody>
              {totais && (
                <tfoot>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <td className="px-3 py-2 text-xs font-bold text-right" style={{ color: '#160F41' }}>Total</td>
                    {isOff && <td className="px-3 py-2 text-xs font-bold text-right">{formatCurrency(totais.starting)}</td>}
                    {!isOff && <td className="px-3 py-2 text-xs font-bold text-right">{formatCurrency(totais.plAnterior)}</td>}
                    <td className="px-3 py-2 text-xs font-bold text-right">{formatCurrency(totais.pl)}</td>
                    <td className="px-3 py-2 text-xs font-bold text-right">{formatCurrency(totais.aporte)}</td>
                    <td className="px-3 py-2 text-xs font-bold text-right">{totais.rentMedia.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-xs font-bold text-right">{formatCurrency(totais.rentNom)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => salvarNoFirestore(ano, mes)} disabled={salvando || temCamposFaltando}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Confirmar e Salvar'}
            </button>
            <button onClick={limpar} className="px-4 py-2 rounded-lg text-sm"
              style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Limpar</button>
          </div>
          {temCamposFaltando && <p className="text-xs" style={{ color: '#dc2626' }}>Campos em vermelho precisam ser preenchidos antes de salvar.</p>}
        </div>
      )}

      {toast && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{
          backgroundColor: toast.startsWith('Erro') ? '#fee2e2' : '#dcfce7', color: toast.startsWith('Erro') ? '#991b1b' : '#166534',
        }}><CheckCircle size={14} /> {toast}</div>
      )}
    </div>
  );
}
