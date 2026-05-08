// --- Modal de Validacao Financeira ---
// Valida consistencia AUM, encadeamento, rentabilidade e rebate.

import { useMemo, useState } from 'react';
import { ShieldCheck, X, AlertTriangle, XCircle, CheckCircle, Copy, Loader2, ExternalLink } from 'lucide-react';
import { useAgenteValidacao, type Inconsistencia } from './useAgenteValidacao';
import { useApp } from '../../state/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { mesclarTodos } from '../../utils/dadosClienteAdapter';
import { siglaPorNome } from '../poupanca/import/MAPEAMENTO_SIGLAS';
import type { DadosCliente } from '../../types';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const TIPO_LABEL: Record<string, string> = {
  consistencia_aum_on: 'AUM Onshore',
  consistencia_aum_off: 'AUM Offshore',
  encadeamento_on: 'Encad. Onshore',
  encadeamento_off: 'Encad. Offshore',
  rent_pct: 'Rentabilidade %',
  rebate: 'Rebate',
  rent_alta: 'Rent. muito alta',
  rent_negativa: 'Rent. muito negativa',
  nnm_grande: 'NNM desproporcional',
};

function fmtPeriodo(mes: number, ano: number): string {
  if (mes === 0 && ano === 0) return 'Geral';
  return `${MESES[mes - 1]}/${ano}`;
}

function SiglaBadge({ nome, theme }: { nome: string; theme: 'success' | 'warn' | 'error' }) {
  const sigla = siglaPorNome(nome);
  if (!sigla) return null;
  const bg = theme === 'success' ? '#bbf7d0' : theme === 'warn' ? '#fde68a' : '#fecaca';
  const color = theme === 'success' ? '#14532d' : theme === 'warn' ? '#78350f' : '#7f1d1d';
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider"
      style={{ backgroundColor: bg, color }}>
      {sigla}
    </span>
  );
}

interface Props {
  onFechar: () => void;
  // Abre a ficha individual do cliente (AUM & Performance). Quando ausente, os
  // nomes/meses aparecem sem link — usado em telas sem acesso ao modal de detalhe.
  onAbrirCliente?: (nome: string) => void;
}

export function AgenteValidacao({ onFechar, onAbrirCliente }: Props) {
  const { dadosPeriodo, parametros } = useApp();
  // O agente lê tanto cadastro (PL, taxa rebate, alíquota) quanto DRE
  // (receita_rebate apurada). Mescla numa estrutura legacy DadosCliente.
  const clientes = useMemo<DadosCliente[]>(() =>
    dadosPeriodo
      ? mesclarTodos(dadosPeriodo.clientes, dadosPeriodo.resultados)
      : [],
    [dadosPeriodo],
  );
  const nomes = useMemo(() => clientes.map((c: DadosCliente) => c.nome_cliente).sort(), [clientes]);
  const [toastCopy, setToastCopy] = useState<string | null>(null);

  const {
    escopo, setEscopo, clienteEscolhido, setClienteEscolhido,
    mesInicio, setMesInicio, anoInicio, setAnoInicio,
    mesFim, setMesFim, anoFim, setAnoFim,
    status, progresso, resultado,
    executar,
  } = useAgenteValidacao();

  function handleExecutar() {
    executar(clientes, parametros, dadosPeriodo?.registrosPoupanca ?? []);
  }

  async function copiarParaClipboard(inc: Inconsistencia) {
    const texto = `Inconsistencia no parser: cliente ${inc.nome_cliente}, ${fmtPeriodo(inc.mes, inc.ano)}, campo ${inc.campo}. Valor atual: ${inc.valor_atual.toFixed(2)}, esperado: ${inc.valor_esperado.toFixed(2)}, diferenca: ${inc.diferenca.toFixed(2)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        // Fallback para contextos sem Clipboard API (HTTP, iframe sem permissão)
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setToastCopy('Copiado!');
    } catch {
      setToastCopy('Falha ao copiar');
    }
    setTimeout(() => setToastCopy(null), 2000);
  }

  function handleAbrir(nome: string) {
    if (!onAbrirCliente) return;
    onAbrirCliente(nome);
  }

  const SEL = 'rounded-lg px-2 py-1.5 text-sm';
  const SBRD = { border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.1)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 space-y-3" style={{ backgroundColor: '#160F41' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck size={18} />
              <span className="text-sm font-semibold">Validacao Financeira</span>
            </div>
            <button onClick={onFechar} className="text-white/60 hover:text-white"><X size={18} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
              {(['todos', 'cliente'] as const).map(e => (
                <button key={e} onClick={() => setEscopo(e)}
                  className={`px-3 py-1.5 text-xs font-medium ${escopo === e ? 'bg-white/20 text-white' : 'text-white/60'}`}>
                  {e === 'todos' ? 'Todos os clientes' : 'Cliente especifico'}
                </button>
              ))}
            </div>
            {escopo === 'cliente' && (
              <input list="val-clientes" value={clienteEscolhido} onChange={e => setClienteEscolhido(e.target.value)}
                placeholder="Buscar cliente..." className={`${SEL} w-48 text-xs`} style={SBRD} />
            )}
            <datalist id="val-clientes">
              {nomes.map(n => <option key={n} value={n} />)}
            </datalist>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/60">De:</span>
              <select value={mesInicio} onChange={e => setMesInicio(Number(e.target.value))} className={`${SEL} text-xs`} style={SBRD}>
                {MESES.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
              <select value={anoInicio} onChange={e => setAnoInicio(Number(e.target.value))} className={`${SEL} text-xs`} style={SBRD}>
                {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/60">Ate:</span>
              <select value={mesFim} onChange={e => setMesFim(Number(e.target.value))} className={`${SEL} text-xs`} style={SBRD}>
                {MESES.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
              <select value={anoFim} onChange={e => setAnoFim(Number(e.target.value))} className={`${SEL} text-xs`} style={SBRD}>
                {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button onClick={handleExecutar} disabled={status === 'executando'}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand disabled:opacity-50">
              {status === 'executando' ? 'Executando...' : 'Executar Validacao'}
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#6b6b8a' }}>
              <ShieldCheck size={48} style={{ color: '#e2e2e8' }} />
              <p className="text-sm mt-3">Configure o escopo e execute a validacao</p>
            </div>
          )}

          {status === 'executando' && (
            <div className="space-y-3 py-8">
              <div className="flex items-center gap-2 text-sm" style={{ color: '#160F41' }}>
                <Loader2 size={16} className="animate-spin" />
                Analisando {progresso.atual} de {progresso.total} clientes...
              </div>
              <div className="h-2 rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-gradient-brand transition-all"
                  style={{ width: `${progresso.total ? (progresso.atual / progresso.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {status === 'concluido' && resultado && (
            <>
              {/* Resumo */}
              <div className="flex items-center gap-4 text-xs" style={{ color: '#6b6b8a' }}>
                <span>{resultado.totalClientes} clientes</span>
                <span>{resultado.totalMeses} meses</span>
                <span>{resultado.tempoExecucao}ms</span>
              </div>

              {/* Sem inconsistencias */}
              {resultado.semInconsistencias.length > 0 && (
                <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: '#f0fdf4' }}>
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#166534' }}>
                    <CheckCircle size={16} /> {resultado.semInconsistencias.length} clientes validados sem problemas
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {resultado.semInconsistencias.map(n => {
                      const sigla = siglaPorNome(n);
                      const conteudo = (
                        <>
                          {sigla && (
                            <span className="text-[10px] font-bold tracking-wider" style={{ color: '#14532d' }}>{sigla}</span>
                          )}
                          {n}
                        </>
                      );
                      return onAbrirCliente ? (
                        <button key={n} onClick={() => handleAbrir(n)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs hover:underline"
                          style={{ backgroundColor: '#dcfce7', color: '#166534' }}
                          title="Abrir ficha individual">
                          {conteudo}
                        </button>
                      ) : (
                        <span key={n} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                          {conteudo}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Alertas */}
              {resultado.alertas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#92400e' }}>
                    <AlertTriangle size={16} /> {resultado.alertas.length} alertas
                  </div>
                  {resultado.alertas.map((a, i) => (
                    <div key={i} className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                      <div className="flex items-center gap-3">
                        <SiglaBadge nome={a.nome_cliente} theme="warn" />
                        {onAbrirCliente ? (
                          <button onClick={() => handleAbrir(a.nome_cliente)}
                            className="flex items-center gap-1 font-medium hover:underline" title="Abrir ficha individual">
                            {a.nome_cliente}
                            <ExternalLink size={10} style={{ opacity: 0.6 }} />
                          </button>
                        ) : (
                          <span className="font-medium">{a.nome_cliente}</span>
                        )}
                        <span>{fmtPeriodo(a.mes, a.ano)}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#fde68a' }}>
                          {TIPO_LABEL[a.tipo] ?? a.tipo}
                        </span>
                      </div>
                      <p className="mt-1">{a.descricao}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Inconsistencias */}
              {resultado.inconsistencias.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#991b1b' }}>
                    <XCircle size={16} /> {resultado.inconsistencias.length} inconsistencias
                  </div>
                  {resultado.inconsistencias.map((inc, i) => (
                    <div key={i} className="rounded-lg border p-3 text-xs space-y-2" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
                      <div className="flex items-center gap-3">
                        <SiglaBadge nome={inc.nome_cliente} theme="error" />
                        {onAbrirCliente ? (
                          <button onClick={() => handleAbrir(inc.nome_cliente)}
                            className="flex items-center gap-1 font-medium hover:underline"
                            style={{ color: '#991b1b' }} title="Abrir ficha individual">
                            {inc.nome_cliente}
                            <ExternalLink size={10} style={{ opacity: 0.6 }} />
                          </button>
                        ) : (
                          <span className="font-medium" style={{ color: '#991b1b' }}>{inc.nome_cliente}</span>
                        )}
                        <span style={{ color: '#991b1b' }}>{fmtPeriodo(inc.mes, inc.ano)}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                          {TIPO_LABEL[inc.tipo] ?? inc.tipo}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2" style={{ color: '#6b6b8a' }}>
                        <div><span className="font-medium">Campo:</span> {inc.campo}</div>
                        <div><span className="font-medium">Atual:</span> {formatCurrency(inc.valor_atual)}</div>
                        <div><span className="font-medium">Esperado:</span> {formatCurrency(inc.valor_esperado)}</div>
                        <div><span className="font-medium">Diff:</span> <span style={{ color: '#991b1b' }}>{formatCurrency(inc.diferenca)}</span></div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => copiarParaClipboard(inc)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium"
                          style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
                          <Copy size={10} /> Copiar descricao
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resultado.alertas.length === 0 && resultado.inconsistencias.length === 0 && resultado.semInconsistencias.length === 0 && (
                <div className="text-center py-8" style={{ color: '#6b6b8a' }}>
                  <p className="text-sm">Nenhum dado de poupanca encontrado para o periodo selecionado.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {toastCopy && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-white"
          style={{ backgroundColor: toastCopy === 'Copiado!' ? '#16a34a' : '#dc2626' }}>
          {toastCopy}
        </div>
      )}
    </div>
  );
}
