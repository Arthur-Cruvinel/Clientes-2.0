// --- Componente de importação de PDFs de poupança ---
// Toggle Offshore/Onshore, dropzone, preview com totais e rentabilidade nominal.

import { useRef, useState, useMemo } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText, RefreshCw, Clock, Play, Square, Trash2 } from 'lucide-react';
import { useImportPoupanca, type TipoImport } from './useImportPoupanca';
import { useFilaRetry } from './useFilaRetry';
import { formatCurrency } from '../../../utils/formatters';
import { PreviewMultiPeriodo } from './PreviewMultiPeriodo';
import { ResolverSiglasModal } from './ResolverSiglasModal';
import { BannerQuarentena } from './BannerQuarentena';
import { useApp } from '../../../state/AppContext';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatUSD(valor: number): string {
  return valor.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function Cel({ valor, formato, usd }: { valor: unknown; formato: 'moeda' | 'pct' | 'texto'; usd?: boolean }) {
  if (valor == null || (formato !== 'texto' && typeof valor !== 'number')) {
    return <td className="px-3 py-2 text-xs text-center" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>—</td>;
  }
  const texto = formato === 'moeda'
    ? (usd ? formatUSD(valor as number) : formatCurrency(valor as number))
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
    previewMulti, nomeClienteMulti,
    processarMultiPeriodo, salvarMultiPeriodo,
    siglasNaoMapeadas, aplicarSiglasResolvidas, cancelarSiglasResolvidas,
    siglasQuarentenaOnshore } = useImportPoupanca();
  const { dadosPeriodo } = useApp();
  const nomesClientesExistentes = useMemo(
    () => Array.from(new Set((dadosPeriodo?.clientes ?? []).map(c => c.nome_cliente))).sort(),
    [dadosPeriodo],
  );
  const temCamposFaltando = preview.some(i => !i.nome_cliente);
  const isOff = tipo === 'offshore';
  const isMulti = !isOff;

  // Fila de retry para erros 529
  const filaRetry = useFilaRetry();

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

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-shrink-0 rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
          {(['offshore', 'onshore'] as TipoImport[]).map(t => (
            <button key={t} onClick={() => { setTipo(t); limpar(); }}
              className={`px-4 py-1.5 text-xs font-medium transition-all ${tipo === t ? 'bg-gradient-brand text-white' : ''}`}
              style={tipo !== t ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
              {t === 'offshore' ? 'Offshore' : 'Onshore'}
            </button>
          ))}
        </div>
        {/* Seletores de mês/ano apenas para offshore (onshore detecta automaticamente) */}
        {isOff && <>
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

      {/* Dropzone: onshore (multi-período) ou offshore */}
      {isMulti ? (
        <div onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/30"
          style={{ borderColor: '#e2e2e8' }}>
          <Upload className="mx-auto mb-2" size={28} style={{ color: '#6b6b8a' }} />
          <p className="text-sm" style={{ color: '#160F41' }}>Arraste o PDF da lâmina onshore</p>
          <p className="text-xs mt-1" style={{ color: '#6b6b8a' }}>Período detectado automaticamente • Aceita 1 ou mais meses</p>
          <input ref={inputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { if (e.target.files?.[0]) processarMultiPeriodo(e.target.files[0]); }} />
        </div>
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
      {erro && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <XCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            {erro}
            {(erro.includes('529') || erro.includes('overloaded') || erro.includes('Overloaded')) && inputRef.current?.files?.[0] && (
              <button onClick={() => {
                const file = inputRef.current?.files?.[0];
                if (file) {
                  filaRetry.adicionarNaFila(file, isOff ? 'offshore' : 'onshore', isOff ? ano : undefined, isOff ? mes : undefined);
                  filaRetry.iniciarRetry();
                  limpar();
                }
              }}
                className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' }}>
                <Clock size={11} className="inline mr-1" /> Adicionar à fila de retry
              </button>
            )}
          </div>
        </div>
      )}

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
            <table className="min-w-full text-sm" style={{ minWidth: 1100 }}>
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr>
                  <th className={`${TH} text-left min-w-[220px]`}>Cliente</th>
                  {isOff && <th className={`${TH} text-right min-w-[130px]`}>Starting (USD)</th>}
                  {!isOff && <th className={`${TH} text-right min-w-[130px]`}>AUM Anterior</th>}
                  <th className={`${TH} text-right min-w-[130px]`}>{isOff ? 'Ending (USD)' : 'AUM Onshore'}</th>
                  <th className={`${TH} text-right min-w-[130px]`}>{isOff ? 'Cash Flow (USD)' : 'Aporte'}</th>
                  <th className={`${TH} text-right min-w-[90px]`}>Rent. %</th>
                  <th className={`${TH} text-right min-w-[130px]`}>{isOff ? 'Rent. (USD)' : 'Rent. R$'}</th>
                  <th className={`${TH} text-left min-w-[180px]`}>Arquivo</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {preview.map((item, i) => {
                  const plVal = isOff ? (item.pl_offshore_usd ?? 0) : (item.pl_onshore ?? 0);
                  const rentPct = isOff ? (item.rentabilidade_offshore ?? 0) : (item.rentabilidade_onshore ?? 0);
                  const rentNom = isOff ? (plVal * rentPct / 100) : item.rendimento_nominal_brl;
                  const agregado = (item.contas_agregadas?.length ?? 0) >= 2;
                  const tombAlert = item.tombamento_suspeito === true;
                  const tombTip = tombAlert
                    ? `Cashflow USD = ${Math.abs(item.aporte_mes_offshore ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} é ${(item.tombamento_ratio ?? 0).toFixed(1)}× o PL final USD — verificar lâmina antes de confirmar (sintoma de Claude lendo a coluna errada).`
                    : undefined;
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2 text-xs text-left">
                        <div style={{ color: '#160F41' }}>{item.nome_cliente}</div>
                        {agregado && (
                          <div className="mt-0.5 text-[10px] font-medium"
                            title={`Contas combinadas: ${item.contas_agregadas!.join(', ')}`}
                            style={{ color: '#92400e' }}>
                            ↳ Agregado de {item.contas_agregadas!.length} contas
                            <span className="ml-1 font-normal" style={{ color: '#a16207' }}>
                              ({item.contas_agregadas!.join(', ')})
                            </span>
                          </div>
                        )}
                        {tombAlert && (
                          <div className="mt-0.5 text-[10px] font-bold"
                            title={tombTip}
                            style={{ color: '#b45309' }}>
                            ⚠ Tombamento suspeito ({(item.tombamento_ratio ?? 0).toFixed(1)}×)
                          </div>
                        )}
                      </td>
                      {isOff && <Cel valor={item.starting_value_usd} formato="moeda" usd />}
                      {!isOff && <Cel valor={item.pl_anterior} formato="moeda" />}
                      <Cel valor={isOff ? item.pl_offshore_usd : item.pl_onshore} formato="moeda" usd={isOff} />
                      <Cel valor={isOff ? item.aporte_mes_offshore : item.aporte_mes_onshore} formato="moeda" usd={isOff} />
                      <Cel valor={isOff ? item.rentabilidade_offshore : item.rentabilidade_onshore} formato="pct" />
                      <Cel valor={rentNom} formato="moeda" usd={isOff} />
                      <td className="px-3 py-2 text-xs truncate max-w-[260px]" title={item._arquivo} style={{ color: '#6b6b8a' }}>{item._arquivo}</td>
                    </tr>
                  );
                })}
              </tbody>
              {totais && (
                <tfoot>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <td className="px-3 py-2 text-xs font-bold text-left" style={{ color: '#160F41' }}>Total</td>
                    {isOff && <td className="px-3 py-2 text-xs font-bold text-right">{formatUSD(totais.starting)}</td>}
                    {!isOff && <td className="px-3 py-2 text-xs font-bold text-right">{formatCurrency(totais.plAnterior)}</td>}
                    <td className="px-3 py-2 text-xs font-bold text-right">{isOff ? formatUSD(totais.pl) : formatCurrency(totais.pl)}</td>
                    <td className="px-3 py-2 text-xs font-bold text-right">{isOff ? formatUSD(totais.aporte) : formatCurrency(totais.aporte)}</td>
                    <td className="px-3 py-2 text-xs font-bold text-right">{totais.rentMedia.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-xs font-bold text-right">{isOff ? formatUSD(totais.rentNom) : formatCurrency(totais.rentNom)}</td>
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

      {/* Fila de retry (visível quando há itens) */}
      {filaRetry.fila.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: '#fbbf24', backgroundColor: '#fffbeb' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} style={{ color: '#92400e' }} />
              <span className="text-sm font-medium" style={{ color: '#92400e' }}>
                Fila de processamento
                {filaRetry.pendentes > 0 && ` — ${filaRetry.pendentes} aguardando`}
                {filaRetry.concluidos > 0 && ` • ${filaRetry.concluidos} concluídos`}
                {filaRetry.falhas > 0 && ` • ${filaRetry.falhas} com falha`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {filaRetry.retryAtivo ? (
                <button onClick={filaRetry.pararRetry}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                  style={{ color: '#dc2626', border: '1px solid #fecaca' }}>
                  <Square size={11} /> Parar
                </button>
              ) : filaRetry.pendentes > 0 && (
                <button onClick={filaRetry.iniciarRetry}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                  style={{ color: '#16a34a', border: '1px solid #bbf7d0' }}>
                  <Play size={11} /> Retry
                </button>
              )}
              {filaRetry.concluidos > 0 && (
                <button onClick={filaRetry.limparConcluidos}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                  style={{ color: '#6b6b8a', border: '1px solid #e2e2e8' }}>
                  <Trash2 size={11} /> Limpar
                </button>
              )}
            </div>
          </div>
          {filaRetry.retryAtivo && (
            <p className="text-xs" style={{ color: '#92400e' }}>
              <Loader2 size={11} className="animate-spin inline mr-1" />
              Retry automatico a cada 5 minutos — API Anthropic sobrecarregada
            </p>
          )}
          <div className="space-y-1">
            {filaRetry.fila.map(item => (
              <div key={item.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded"
                style={{ backgroundColor: '#fff', border: '1px solid #e2e2e8' }}>
                <div className="flex items-center gap-2 min-w-0">
                  {item.status === 'aguardando' && <Clock size={12} style={{ color: '#f59e0b' }} />}
                  {item.status === 'processando' && <Loader2 size={12} className="animate-spin" style={{ color: '#0065FF' }} />}
                  {item.status === 'sucesso' && <CheckCircle size={12} style={{ color: '#16a34a' }} />}
                  {item.status === 'falha' && <XCircle size={12} style={{ color: '#dc2626' }} />}
                  <span className="truncate" style={{ color: '#160F41' }}>{item.arquivo.name}</span>
                  <span style={{ color: '#6b6b8a' }}>({item.tipo})</span>
                  {item.tentativas > 0 && <span style={{ color: '#6b6b8a' }}>• {item.tentativas}x</span>}
                </div>
                {(item.status === 'aguardando' || item.status === 'falha') && (
                  <button onClick={() => filaRetry.tentarAgora(item.id)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ color: '#0065FF', border: '1px solid #bfdbfe' }}>
                    Tentar agora
                  </button>
                )}
                <button onClick={() => filaRetry.removerDaFila(item.id)}
                  className="p-0.5 rounded hover:bg-gray-100" title="Remover">
                  <XCircle size={12} style={{ color: '#94a3b8' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{
          backgroundColor: toast.startsWith('Erro') ? '#fee2e2' : '#dcfce7', color: toast.startsWith('Erro') ? '#991b1b' : '#166534',
        }}><CheckCircle size={14} /> {toast}</div>
      )}

      {/* Banner persistente de siglas em quarentena (Frente 3). Aparece sozinho
          ao fim de um upload onshore que tenha gerado registros em
          status='pendente_normalizacao'. Some quando o Set esvaziar — não tem
          dismiss manual por design. */}
      <BannerQuarentena siglas={Array.from(siglasQuarentenaOnshore)} />

      {siglasNaoMapeadas.length > 0 && (
        <ResolverSiglasModal
          siglas={siglasNaoMapeadas}
          nomesClientesExistentes={nomesClientesExistentes}
          onCancelar={cancelarSiglasResolvidas}
          onConfirmar={aplicarSiglasResolvidas} />
      )}
    </div>
  );
}
