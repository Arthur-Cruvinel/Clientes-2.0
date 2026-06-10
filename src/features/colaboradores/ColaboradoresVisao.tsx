// --- Aba Colaboradores (dentro de Configurações) ---
// KPIs de folha + tabela com linhas expansíveis + modal de edição/criação.
// Botão "Adicionar" e exclusão restritos a admin (useAuth).

import { useState, useEffect } from 'react';
import { Users, AlertTriangle, Plus, Share2, Loader2, Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { KpiCard } from '../../components/ui/KpiCard';
import { useAuth } from '../../state/AuthContext';
import { useColaboradores, type ColaboradorDerivado } from './useColaboradores';
import type { Colaborador } from '../../types';
import { CHAVE_ORD } from './ordenacao';
import { HeaderOrdenavel } from '../../components/ui/HeaderOrdenavel';
import { ColaboradorCard } from './ColaboradorCard';
import { ColaboradorModal } from './ColaboradorModal';
import { BeneficiosLoteModal } from './BeneficiosLoteModal';
import { PropagacaoEmMassa } from './PropagacaoEmMassa';
import { RenomearColaboradorModal } from './RenomearColaboradorModal';
import { COLUNAS } from './columns';
import { buscarPeriodosDoColaborador } from '../../services/firebase';

type ModalState =
  | { tipo: 'editar'; derivado: ColaboradorDerivado }
  | { tipo: 'criar' }
  | null;

export function ColaboradoresVisao() {
  const {
    derivados, totais, algumSobrecarga, periodo, clientes, vinculos,
    ordenacao, setOrdenarPor,
    salvarFolha, criarColaborador, excluirColaborador, salvando,
    salvarBeneficiosEmLote,
  } = useColaboradores();
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';

  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [propagacaoMassa, setPropagacaoMassa] = useState<{ periodos: string[] } | null>(null);
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(false);
  // Aberto quando o usuário renomeou o colaborador no Salvar Folha — propaga
  // o novo nome para todos os clientes em todos os períodos.
  const [renomearInfo, setRenomearInfo] = useState<{ antigo: string; novo: string } | null>(null);

  // ── Seleção múltipla para edição de benefícios em lote ──────────────────
  // Set de ids de colaborador. Limpa ao trocar de período (benefício vigora
  // por mês; uma seleção de outro período não faz sentido aqui).
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteAberto, setLoteAberto] = useState(false);
  useEffect(() => { setSelecionados(new Set()); }, [periodo]);

  const idsVisiveis = derivados.map(d => d.colaborador.id).filter(Boolean) as string[];
  const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every(id => selecionados.has(id));

  function toggleUm(id?: string) {
    if (!id) return;
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(idsVisiveis));
  }

  // Pré-busca os períodos disponíveis (usa o 1º colaborador como referência —
  // todos têm cobertura igual no fluxo normal de fechamento de período).
  async function abrirPropagacaoMassa() {
    const referencia = derivados[0]?.colaborador;
    if (!referencia?.id) {
      flash('Erro: nenhum colaborador disponível como referência.');
      return;
    }
    setCarregandoPeriodos(true);
    try {
      const periodos = await buscarPeriodosDoColaborador(referencia.id);
      setPropagacaoMassa({ periodos });
    } catch (e) {
      flash(`Erro: ${e instanceof Error ? e.message : 'falha ao listar períodos'}`);
    } finally {
      setCarregandoPeriodos(false);
    }
  }

  const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // Persiste a folha + dispara rename quando o nome muda. NÃO fecha nem navega
  // — quem chama decide o pós-save (fechar no Salvar normal, avançar na
  // navegação). Retorna sucesso. Caminho de gravação inalterado (salvarFolha).
  async function persistirFolha(atualizado: Colaborador, antigoNome?: string): Promise<boolean> {
    const novo = atualizado.nome_colaborador?.trim();
    try {
      await salvarFolha(atualizado);
      flash('Folha atualizada.');
      if (antigoNome && novo && antigoNome !== novo) setRenomearInfo({ antigo: antigoNome, novo });
      return true;
    } catch (e) {
      flash(`Erro: ${e instanceof Error ? e.message : 'falha ao salvar'}`);
      return false;
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
            <Users size={18} /> Colaboradores
            {algumSobrecarga && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                <AlertTriangle size={11} /> Sobrecarga detectada
              </span>
            )}
          </h3>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Período: {periodo || '—'}</p>
        </div>
        {isAdmin && periodo && (
          <div className="flex items-center gap-2">
            <button onClick={abrirPropagacaoMassa} disabled={carregandoPeriodos || derivados.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
              style={{ border: '1px solid #160F41', color: '#160F41' }}>
              {carregandoPeriodos ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
              {carregandoPeriodos ? 'Carregando…' : 'Propagar folha em massa'}
            </button>
            <button onClick={() => setModal({ tipo: 'criar' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-gradient-brand">
              <Plus size={12} /> Adicionar Colaborador</button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard titulo="Total Folha" valor={formatCurrency(totais.folha)} />
        <KpiCard titulo="Custo Direto Total" valor={formatCurrency(totais.direto)} />
        <KpiCard titulo="Custo Institucional Total" valor={formatCurrency(totais.institucional)} />
      </div>

      <p className="text-xs text-gray-400">Campos em cinza são calculados automaticamente.</p>

      {/* Barra de ações em lote — só admin, só com seleção ativa */}
      {isAdmin && selecionados.size > 0 && (
        <div className="flex items-center justify-between rounded-lg px-4 py-2"
          style={{ backgroundColor: '#eef2ff', border: '1px solid #c7d2fe' }}>
          <span className="text-sm font-medium" style={{ color: '#3730a3' }}>
            {selecionados.size} selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelecionados(new Set())}
              className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ color: '#6b6b8a' }}>
              Limpar seleção
            </button>
            <button onClick={() => setLoteAberto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">
              <Wallet size={12} /> Editar benefícios em lote
            </button>
          </div>
        </div>
      )}

      {/* Tabela — largura total do container, scroll horizontal só se preciso */}
      <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
        <table className="w-full table-fixed">
          <thead style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              {/* Coluna de seleção — largura explícita (table-fixed). */}
              <th className={`${TH} w-10 text-center`}>
                <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos}
                  aria-label="Selecionar todos" className="cursor-pointer" />
              </th>
              {COLUNAS.map(col => {
                const chaveOrd = CHAVE_ORD[col.chave];
                const align = col.alinhamento ?? 'left';
                return (
                  <th key={col.chave} className={`${TH} ${col.classe ?? ''}`}
                    style={{ color: '#6b6b8a', textAlign: align }}>
                    {chaveOrd
                      ? <HeaderOrdenavel titulo={col.titulo} chave={chaveOrd}
                          alinhamento={align} ordenacao={ordenacao} onOrdenar={setOrdenarPor} />
                      : col.titulo}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {derivados.length === 0 && (
              <tr>
                <td colSpan={COLUNAS.length + 1} className="px-3 py-6 text-center text-xs"
                    style={{ color: '#6b6b8a' }}>
                  Nenhum colaborador no período {periodo || '—'}.
                </td>
              </tr>
            )}
            {derivados.map(d => (
              <ColaboradorCard key={d.colaborador.id ?? d.colaborador.nome_colaborador}
                derivado={d} clientes={clientes} vinculos={vinculos}
                onAbrirModal={() => setModal({ tipo: 'editar', derivado: d })}
                selecionado={!!d.colaborador.id && selecionados.has(d.colaborador.id)}
                onToggleSelecao={() => toggleUm(d.colaborador.id)} />
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm shadow-lg z-50"
          style={{
            backgroundColor: toast.startsWith('Erro') ? '#fee2e2' : '#dcfce7',
            color: toast.startsWith('Erro') ? '#991b1b' : '#166534',
          }}>{toast}</div>
      )}

      {/* Modais (editar/criar) */}
      {modal?.tipo === 'editar' && periodo && (() => {
        // Vizinhos na MESMA ordenação da tabela (derivados já vem ordenado).
        // Match por id (slug docId); fallback ao nome para docs sem id.
        const chaveDe = (d: ColaboradorDerivado) =>
          d.colaborador.id ?? d.colaborador.nome_colaborador;
        const chaveAtual = chaveDe(modal.derivado);
        const idx = derivados.findIndex(d => chaveDe(d) === chaveAtual);
        const anterior = idx > 0 ? derivados[idx - 1] : null;
        const proximo = idx >= 0 && idx < derivados.length - 1 ? derivados[idx + 1] : null;
        return (
          <ColaboradorModal key={chaveAtual} modo="editar" derivado={modal.derivado}
            clientes={clientes} periodo={periodo}
            salvando={salvando} onFechar={() => setModal(null)}
            anterior={anterior} proximo={proximo}
            onNavegar={(destino) => setModal({ tipo: 'editar', derivado: destino })}
            onSalvarFolha={async (atualizado) => {
              // Captura nome antigo ANTES do save — depois do recarregar() o
              // derivado.colaborador já reflete o nome novo.
              const antigo = modal.derivado.colaborador.nome_colaborador?.trim();
              if (await persistirFolha(atualizado, antigo)) setModal(null);
            }}
            onSalvarFolhaEAvancar={async (atualizado, destino) => {
              const antigo = modal.derivado.colaborador.nome_colaborador?.trim();
              // Persiste e navega para o destino (em vez de fechar).
              if (await persistirFolha(atualizado, antigo)) setModal({ tipo: 'editar', derivado: destino });
            }}
            onAlterarStatus={async (ativo, dataDemissao) => {
              // Desligar/reativar grava no doc do período aberto via salvarFolha
              // (mesmo mecanismo: salvarColaboradorPeriodo + recarregar). Reativar
              // remove data_demissao (setDoc full-replace omite a chave).
              const base = modal.derivado.colaborador;
              const atualizado: Colaborador = { ...base, ativo };
              if (ativo) delete atualizado.data_demissao;
              else atualizado.data_demissao = dataDemissao;
              try {
                await salvarFolha(atualizado);
                flash(ativo ? 'Colaborador reativado.' : `Colaborador desligado em ${dataDemissao}.`);
                // Reflete o novo status no modal sem fechar (key=id não remonta).
                setModal({ tipo: 'editar', derivado: { ...modal.derivado, colaborador: atualizado } });
              } catch (e) {
                flash(`Erro: ${e instanceof Error ? e.message : 'falha ao alterar status'}`);
              }
            }}
            onExcluir={async (id, futuros) => {
              try {
                const r = await excluirColaborador(id, futuros);
                flash(futuros ? `Removido do período + ${r.periodosFuturos} futuros.` : 'Removido do período.');
                return r;
              } catch (e) {
                flash(`Erro: ${e instanceof Error ? e.message : 'falha ao excluir'}`);
                return { periodosFuturos: 0 };
              }
            }} />
        );
      })()}
      {renomearInfo && (
        <RenomearColaboradorModal
          nomeAntigo={renomearInfo.antigo}
          nomeNovo={renomearInfo.novo}
          onFechar={() => setRenomearInfo(null)} />
      )}

      {propagacaoMassa && periodo && (
        <PropagacaoEmMassa
          colaboradores={derivados.map(d => d.colaborador)}
          periodosDisponiveis={propagacaoMassa.periodos}
          periodoAtual={periodo}
          onFechar={() => setPropagacaoMassa(null)} />
      )}

      {loteAberto && periodo && (
        <BeneficiosLoteModal
          selecionados={derivados.filter(d => d.colaborador.id && selecionados.has(d.colaborador.id))}
          periodo={periodo}
          salvando={salvando}
          onAplicar={(patch) => salvarBeneficiosEmLote([...selecionados], patch)}
          onFechar={() => { setLoteAberto(false); setSelecionados(new Set()); }} />
      )}

      {modal?.tipo === 'criar' && periodo && (
        <ColaboradorModal modo="criar" clientes={clientes} periodo={periodo}
          salvando={salvando} onFechar={() => setModal(null)}
          onCriar={async (novo) => {
            try { await criarColaborador(novo); flash('Colaborador criado.'); setModal(null); }
            catch (e) { flash(`Erro: ${e instanceof Error ? e.message : 'falha ao criar'}`); }
          }} />
      )}
    </div>
  );
}
