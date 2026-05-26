// --- Painel de Alocação em Lote (redesenho 2026) ---
// Distribuição automática + override manual; fator = sobrecarga por colaborador.

import { useState } from 'react';
import { Loader2, AlertTriangle, Save, RotateCcw, RefreshCw, CheckCircle2, Trash2, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useAlocacaoEmLote } from './useAlocacaoEmLote';
import { useCapacidade } from '../capacidade/useCapacidade';
import { CapacidadeDrillDown } from '../capacidade/CapacidadeDrillDown';
import { ReplicarAlocacaoModal } from './ReplicarAlocacaoModal';
import { useAuth } from '../../state/AuthContext';
import { HORAS_CLT_MES, HORAS_PACOTE } from '../../utils/constants';
import { HeaderOrdenavel } from '../../components/ui/HeaderOrdenavel';
import type { ChaveOrdAlocacao } from './ordenacaoAlocacao';

function corFator(f: number): string {
  if (f < 0.8) return '#dc2626';
  if (f < 1.0) return '#ea580c';
  return '#16a34a';
}

// Rótulos curtos p/ o breakdown do KPI consolidado de ocupação.
const LABEL_FUNCAO_CURTA: Record<string, string> = {
  consultoria_gestao: 'gestão', consultoria_planejamento: 'planejamento',
  consultoria_financeira: 'financeira', operacional_financeiro: 'operacional',
  serv_adm: 'adm', serv_aux_adm: 'aux adm',
};

export function AlocacaoEmLote({ selecaoInicial }: { selecaoInicial?: { nome: string; funcao?: string } | null } = {}) {
  const {
    colaboradorSelecionado, colaboradoresComFuncoes, nomesColaboradores,
    nomeColabSelecionado, selecionarColaborador, selecionarFuncao,
    funcao, clientesOrdenados, pctEditado, pctOriginal, travados,
    setPct, resetCliente, recalcularTudo,
    alteracoes, ocupacaoConsolidada, percentualAlocavel,
    horasNormativasTotais, horasProdutivas, fatorSobrecarga, capacidadeLivreHoras, emSobrecarga,
    ordenacao, setOrdenarPor, salvando, salvarTodos, periodo,
    removerCliente, removendo, periodoFechado,
  } = useAlocacaoEmLote(selecaoInicial);
  const [toast, setToast] = useState<string | null>(null);
  const [verCapacidade, setVerCapacidade] = useState(false);
  const [replicarAberto, setReplicarAberto] = useState(false);
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';
  // Drill-down de capacidade do colaborador selecionado (dados já carregados).
  const { porColaborador } = useCapacidade();
  const capDado = porColaborador.find(p => p.colaborador.nome_colaborador === nomeColabSelecionado) ?? null;

  const Ord = ({ chave, titulo, align }: { chave: ChaveOrdAlocacao; titulo: string; align: 'left' | 'right' | 'center' }) =>
    <HeaderOrdenavel titulo={titulo} chave={chave} alinhamento={align} ordenacao={ordenacao} onOrdenar={setOrdenarPor} />;
  const handleSalvar = async () => {
    try {
      const n = await salvarTodos();
      setToast(`${n} cliente${n === 1 ? '' : 's'} atualizado${n === 1 ? '' : 's'}.`);
    } catch (err) {
      console.error('[AlocacaoEmLote] erro ao salvar:', err);
      setToast(`Erro: ${err instanceof Error ? err.message : 'falha ao salvar'}`);
    }
    setTimeout(() => setToast(null), 3500);
  };
  const handleRecalcular = () => {
    if (confirm('Isso vai substituir todos os valores manuais. Confirmar?')) recalcularTudo();
  };

  const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
  const TD = 'px-3 py-2 text-xs';
  const horasLightLivre = funcao ? Math.floor(capacidadeLivreHoras / (HORAS_PACOTE.light[funcao] || 1)) : 0;
  const horasFullLivre = funcao ? Math.floor(capacidadeLivreHoras / (HORAS_PACOTE.full[funcao] || 1)) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>Alocação em Lote</h3>
        <p className="text-xs" style={{ color: '#6b6b8a' }}>Distribuição automática proporcional ao pacote — override manual permitido. Período: {periodo || '—'}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={nomeColabSelecionado ?? ''}
          onChange={e => selecionarColaborador(e.target.value || null)}
          className="rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
          <option value="">Selecione um colaborador...</option>
          {nomesColaboradores.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {colaboradorSelecionado && (
          <button onClick={handleRecalcular} type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
            <RefreshCw size={12} /> Recalcular tudo
          </button>
        )}
        {isAdmin && periodo && (
          <button onClick={() => setReplicarAberto(true)} type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ml-auto"
            style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
            <Copy size={12} /> Replicar para...
          </button>
        )}
      </div>

      {replicarAberto && periodo && (
        <ReplicarAlocacaoModal periodoOrigem={periodo} onFechar={() => setReplicarAberto(false)} />
      )}

      {/* Abas de função — só quando o colaborador atende em mais de uma função.
          Com uma só, já vem auto-selecionada (selecionarColaborador). */}
      {colaboradorSelecionado && (colaboradoresComFuncoes[nomeColabSelecionado ?? ''] ?? []).length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(colaboradoresComFuncoes[nomeColabSelecionado ?? ''] ?? []).map(f => {
            const ativo = f === funcao;
            return (
              <button key={f} type="button" onClick={() => selecionarFuncao(f)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={ativo
                  ? { backgroundColor: '#160F41', color: '#fff' }
                  : { border: '1px solid #e2e2e8', color: '#6b6b8a', backgroundColor: '#fff' }}>
                {LABEL_FUNCAO_CURTA[f] ?? f}
              </button>
            );
          })}
        </div>
      )}

      {colaboradorSelecionado && (
        <div className="text-xs" style={{ color: '#6b6b8a' }}>
          Total alocado (todas as funções):{' '}
          <strong style={{ color: ocupacaoConsolidada.total > percentualAlocavel + 1e-9 ? '#dc2626' : '#16a34a' }}>
            {(ocupacaoConsolidada.total * 100).toFixed(1)}%
          </strong>{' '}
          de {(percentualAlocavel * 100).toFixed(1)}% disponíveis
          {Object.keys(ocupacaoConsolidada.porFuncao).length > 1 && (
            <span className="ml-1" style={{ color: '#9ca3af' }}>
              ({Object.entries(ocupacaoConsolidada.porFuncao)
                .map(([f, p]) => `${LABEL_FUNCAO_CURTA[f] ?? f} ${(p * 100).toFixed(0)}%`)
                .join(' · ')})
            </span>
          )}
        </div>
      )}

      {/* Drill-down de capacidade do colaborador (colapsável) — dados do useCapacidade. */}
      {colaboradorSelecionado && capDado && (
        <div className="rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
          <button type="button" onClick={() => setVerCapacidade(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium"
            style={{ color: '#160F41' }}>
            <span>{verCapacidade ? 'Ocultar' : 'Ver'} capacidade do colaborador</span>
            {verCapacidade ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {verCapacidade && (
            <div className="px-3 pb-3 border-t pt-3" style={{ borderColor: '#e2e2e8' }}>
              <CapacidadeDrillDown dado={capDado} mostrarBarraTotal />
            </div>
          )}
        </div>
      )}

      {!colaboradorSelecionado && <p className="text-sm py-6 text-center italic" style={{ color: '#6b6b8a' }}>Selecione um colaborador para listar os clientes atendidos.</p>}
      {colaboradorSelecionado && !funcao && <p className="text-sm py-4 italic" style={{ color: '#dc2626' }}>Função "{colaboradorSelecionado.funcao_principal}" não mapeada.</p>}
      {colaboradorSelecionado && funcao && clientesOrdenados.length === 0 && <p className="text-sm py-6 text-center italic" style={{ color: '#6b6b8a' }}>Nenhum cliente alocado a este colaborador no período.</p>}

      {colaboradorSelecionado && funcao && clientesOrdenados.length > 0 && (
        <>
          <div className="overflow-y-auto rounded-lg border" style={{ borderColor: '#e2e2e8', maxHeight: 'calc(100vh - 460px)' }}>
            <table className="min-w-full">
              <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f9f9fb' }}>
                <tr style={{ color: '#6b6b8a' }}>
                  <th className={`${TH} text-left`}><Ord chave="nome_cliente" titulo="Cliente" align="left" /></th>
                  <th className={`${TH} text-left`}><Ord chave="pacote_servico" titulo="Pacote" align="left" /></th>
                  <th className={`${TH} text-right`} title="Percentual normativo do pacote para esta função">Pct ref.</th>
                  <th className={`${TH} text-right`}><Ord chave="pct_atual" titulo="Pct atual" align="right" /></th>
                  <th className={`${TH} text-center`}>Origem</th>
                  <th className={`${TH} text-right`}><Ord chave="novo_pct" titulo="% dedicação" align="right" /></th>
                  <th className={`${TH} text-right`}><Ord chave="horas_efetivas" titulo="Horas efet." align="right" /></th>
                  <th className={`${TH} text-center`}>Fator</th>
                  <th className={`${TH} text-center`}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {clientesOrdenados.map(cli => {
                  const novo = pctEditado[cli.nome_cliente] ?? 0;
                  const original = pctOriginal[cli.nome_cliente] ?? 0;
                  const alterado = Math.abs(novo - original) > 1e-9;
                  const manual = travados.has(cli.nome_cliente);
                  const horasEfet = novo * HORAS_CLT_MES * percentualAlocavel;
                  const pctRef = (HORAS_PACOTE[cli.pacote_servico]?.[funcao] ?? 0) / HORAS_CLT_MES;
                  return (
                    <tr key={cli.id ?? cli.nome_cliente}>
                      <td className={TD} style={{ color: '#160F41' }}>{cli.nome_cliente}</td>
                      <td className={TD} style={{ color: '#6b6b8a' }}>{cli.pacote_servico}</td>
                      <td className={`${TD} text-right text-gray-400`}>{(pctRef * 100).toFixed(1)}%</td>
                      <td className={`${TD} text-right`} style={{ color: '#9ca3af' }}>{(original * 100).toFixed(1)}%</td>
                      <td className={`${TD} text-center`}>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={manual ? { backgroundColor: '#dbeafe', color: '#1e40af' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                          {manual ? 'Manual' : 'Auto'}
                        </span>
                        {manual && (
                          <button onClick={() => resetCliente(cli.nome_cliente)} type="button" title="Voltar para automático"
                            className="ml-1.5 align-middle" style={{ color: '#6b6b8a' }}><RotateCcw size={11} /></button>
                        )}
                      </td>
                      <td className={`${TD} text-right`}>
                        <input type="number" step="0.1" min={0} max={100} value={Number((novo * 100).toFixed(1))}
                          onChange={e => setPct(cli.nome_cliente, Number(e.target.value) / 100)}
                          className="w-20 rounded px-2 py-1 text-xs text-right"
                          style={{ border: '1px solid #e2e2e8', color: '#160F41', backgroundColor: alterado ? '#fef3c7' : '#fff' }} />
                      </td>
                      <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{horasEfet.toFixed(1)}h</td>
                      <td className={`${TD} text-center font-medium`} style={{ color: corFator(fatorSobrecarga) }}>{fatorSobrecarga.toFixed(2)}</td>
                      <td className={`${TD} text-center`}>
                        <button type="button"
                          title={periodoFechado ? 'Período fechado — remoção indisponível' : 'Remover da carteira'}
                          disabled={periodoFechado || removendo !== null}
                          onClick={async () => {
                            if (!window.confirm(`Remover ${cli.nome_cliente} da carteira de ${colaboradorSelecionado?.nome_colaborador}?`)) return;
                            await removerCliente(cli);
                          }}
                          className="align-middle disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ color: '#dc2626' }}>
                          {removendo === cli.nome_cliente
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: '#f9f9fb' }}>
            <p className="text-xs" style={{ color: '#160F41' }}>
              Horas normativas: <strong>{horasNormativasTotais.toFixed(0)}h</strong> de <strong>{horasProdutivas.toFixed(0)}h</strong> disponíveis/mês
            </p>
            {emSobrecarga ? (
              <p className="flex items-center gap-1 text-xs" style={{ color: '#dc2626' }}>
                <AlertTriangle size={12} /> Sobrecarga: <strong>{(horasNormativasTotais - horasProdutivas).toFixed(0)}h</strong> acima da capacidade — nível de serviço comprometido (fator {fatorSobrecarga.toFixed(2)})
              </p>
            ) : (
              <p className="flex items-center gap-1 text-xs" style={{ color: '#166534' }}>
                <CheckCircle2 size={12} /> Capacidade livre: <strong>{capacidadeLivreHoras.toFixed(0)}h</strong> (~{horasLightLivre} clientes light ou {horasFullLivre} clientes full)
              </p>
            )}
          </div>

          {toast && <div className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700">{toast}</div>}

          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={handleSalvar} disabled={salvando || alteracoes === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {salvando ? 'Salvando...' : 'Salvar Alocação'}</button>
          </div>
        </>
      )}
    </div>
  );
}
