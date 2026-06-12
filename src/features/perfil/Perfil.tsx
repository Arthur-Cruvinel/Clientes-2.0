// --- Aba Perfil — visualização e edição de clientes ---

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, UserPlus } from 'lucide-react';
import { formatCurrency, formatPercent, encontrarPoupanca } from '../../utils/formatters';
import { FUNCOES_ALOCACAO, HORAS_CLT_MES } from '../../utils/constants';
import type { Vinculo } from '../../types/vinculo';
import { calcularFatoresEscopo } from '../../utils/financials';
import { useApp } from '../../state/AppContext';
import { useAuth } from '../../state/AuthContext';
import { usePerfil, type ColunaListaCliente } from './usePerfil';
import { ListaClientesTabela } from './ListaClientesTabela';
import { EditarClienteModal } from './EditarClienteModal';
import { NovoClienteModal } from './NovoClienteModal';
import { AlocacaoLote } from './AlocacaoLote';
import { AlocacaoEmLote } from './AlocacaoEmLote';
import type { FuncaoAlocacao, DadosCliente, RegistroPoupanca } from '../../types';

const LABEL_F: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Consultoria Gestão', consultoria_planejamento: 'Cons. Planejamento',
  consultoria_financeira: 'Cons. Financeira', operacional_financeiro: 'Oper. Financeiro',
  serv_adm: 'Serv. Administrativos', serv_aux_adm: 'Aux. Administrativo',
};
const ABAS = ['Resumo', 'Alocação', 'Configuração', 'Cadastral'] as const;

export function Perfil() {
  const {
    clientes, clienteSelecionado, selecionar, busca, setBusca,
    modalAberto, setModalAberto, colaboradores, parametros, salvarCliente, salvando,
    loading, periodoLabel, bankersUnicos, empresariosUnicos, atualizarCampoEmLote, carregar,
    ordenacaoLista, setOrdenacaoLista, filtroNomeColuna, setFiltroNomeColuna,
    filtroPacotes, setFiltroPacotes, pacotesDisponiveis, limparFiltrosColuna,
  } = usePerfil();
  const [dropdownFiltro, setDropdownFiltro] = useState<ColunaListaCliente | null>(null);
  const { dadosPeriodo, periodoSelecionado } = useApp();
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';
  const registrosPoupanca = dadosPeriodo?.registrosPoupanca ?? [];
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Resumo');

  // Deep-link da Capacidade: ?visao=lote_aloc&colaborador=X&funcao=Y. Capturado
  // uma vez no mount (ref preserva após limpar a URL); a função é opcional.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkRef = useRef<{ nome: string; funcao?: string } | null>(
    searchParams.get('colaborador')
      ? { nome: searchParams.get('colaborador')!, funcao: searchParams.get('funcao') ?? undefined }
      : null,
  );
  const [visao, setVisao] = useState<'individual' | 'lote' | 'lote_aloc'>(
    searchParams.get('visao') === 'lote_aloc' ? 'lote_aloc' : 'individual');
  // Limpa os params da URL para não persistirem na navegação subsequente.
  useEffect(() => {
    if (searchParams.toString()) setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const c = clienteSelecionado;
  const poupancaCliente = c ? encontrarPoupanca(c.nome_cliente, registrosPoupanca) : undefined;
  const bankers = useMemo(() =>
    [...new Set(clientes.map((cl: DadosCliente) => cl.banker).filter((b): b is string => !!b))].sort(),
  [clientes]);

  if (loading) return <div className="p-8 text-center" style={{ color: '#6b6b8a' }}>Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Toggle Individual / Atribuição (banker/empresário) / Alocação (pct_*) */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
          {([
            ['individual', '👤 Individual'],
            ['lote', '👥 Atribuição em Lote'],
            ['lote_aloc', '🎯 Alocação em Lote'],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => { setVisao(id); setBusca(''); }}
              className={`px-4 py-1.5 text-xs font-medium transition-all ${visao === id ? 'bg-gradient-brand text-white' : ''}`}
              style={visao !== id ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
              {label}
            </button>
          ))}
        </div>
        {isAdmin && periodoSelecionado && (
          <button onClick={() => setNovoClienteAberto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">
            <UserPlus size={12} /> Novo Cliente
          </button>
        )}
      </div>

      {toast && (
        <div className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700">{toast}</div>
      )}

      {novoClienteAberto && periodoSelecionado && (
        <NovoClienteModal periodo={periodoSelecionado}
          onFechar={() => setNovoClienteAberto(false)}
          onCriado={(nome) => {
            setNovoClienteAberto(false);
            setToast(`Cliente "${nome}" criado com sucesso.`);
            setTimeout(() => setToast(null), 3500);
            carregar();
          }} />
      )}

      {visao === 'lote' && (
        <div className="bg-white rounded-lg border p-5 h-[calc(100vh-190px)] flex flex-col" style={{ borderColor: '#e2e2e8' }}>
          <AlocacaoLote clientes={clientes} colaboradores={colaboradores}
            bankersUnicos={bankersUnicos} empresariosUnicos={empresariosUnicos}
            onAplicar={atualizarCampoEmLote} onRecarregar={carregar} />
        </div>
      )}

      {visao === 'lote_aloc' && (
        <div className="bg-white rounded-lg border p-5" style={{ borderColor: '#e2e2e8' }}>
          <AlocacaoEmLote selecaoInicial={deepLinkRef.current} />
        </div>
      )}

      {visao === 'individual' && (
    <div className="flex gap-6 h-[calc(100vh-190px)]">
      {/* Painel esquerdo — lista em tabela com filtros e ordenação */}
      <ListaClientesTabela
        clientes={clientes} selecionadoId={c?.id} onSelecionar={selecionar}
        busca={busca} setBusca={setBusca} periodoLabel={periodoLabel}
        ordenacao={ordenacaoLista} setOrdenacao={setOrdenacaoLista}
        filtroNomeColuna={filtroNomeColuna} setFiltroNomeColuna={setFiltroNomeColuna}
        filtroPacotes={filtroPacotes} setFiltroPacotes={setFiltroPacotes}
        pacotesDisponiveis={pacotesDisponiveis} limparFiltros={limparFiltrosColuna}
        dropdown={dropdownFiltro} setDropdown={setDropdownFiltro} />

      {/* Painel direito — detalhe */}
      <div className="flex-1 min-w-0">
        {!c ? (
          <div className="h-full flex items-center justify-center rounded-lg border" style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
            <p className="text-sm">Selecione um cliente na lista</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: '#160F41' }}>{c.nome_cliente}</h3>
              <button onClick={() => setModalAberto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">
                <Pencil size={12} /> Editar
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#f3f4f6' }}>
              {ABAS.map(a => (
                <button key={a} onClick={() => setAba(a)}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${aba === a ? 'bg-white shadow-sm' : ''}`}
                  style={{ color: aba === a ? '#160F41' : '#6b6b8a' }}>{a}</button>
              ))}
            </div>

            {/* Conteúdo */}
            <div className="rounded-lg border p-5" style={{ borderColor: '#e2e2e8' }}>
              {aba === 'Resumo' && <ResumoTab c={c} />}
              {aba === 'Alocação' && <AlocacaoTab c={c} hp={parametros.horas_pacote} vinculos={dadosPeriodo?.vinculos ?? []} />}
              {aba === 'Configuração' && <ConfigTab c={c} vinculos={dadosPeriodo?.vinculos ?? []} />}
              {aba === 'Cadastral' && <CadastralTab c={c} poupanca={poupancaCliente} />}
            </div>
          </div>
        )}
      </div>

      {/* Modal edição */}
      {modalAberto && c && (
        <EditarClienteModal cliente={c} poupanca={poupancaCliente}
          colaboradores={colaboradores} bankers={bankers}
          vinculos={dadosPeriodo?.vinculos ?? []}
          periodo={periodoSelecionado}
          onSalvar={salvarCliente}
          onExcluido={() => {
            setToast(`Cliente "${c.nome_cliente}" removido.`);
            setTimeout(() => setToast(null), 3500);
            carregar();
          }}
          salvando={salvando} onFechar={() => setModalAberto(false)} />
      )}
    </div>
      )}
    </div>
  );
}

// --- Sub-componentes das abas (somente leitura) ---

function ResumoTab({ c }: { c: import('../../types').DadosCliente }) {
  const kpis = [
    ['Receita Total', formatCurrency(c.receita_bruta)],
    ['Custo Direto', formatCurrency(c.custo_direto)],
    ['Custo Dedicado', formatCurrency(c.custo_dedicado)],
    ['Custo Indireto', formatCurrency(c.custo_indireto_rateado)],
    ['EBITDA', formatCurrency(c.ebitda)],
    ['Margem', formatPercent(c.margem * 100)],
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {kpis.map(([label, valor]) => (
        <div key={label as string} className="rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b6b8a' }}>{label}</p>
          <p className="text-sm font-bold mt-1" style={{ color: '#160F41' }}>{valor}</p>
        </div>
      ))}
    </div>
  );
}

function AlocacaoTab({ c, hp, vinculos }: { c: import('../../types').DadosCliente; hp: Record<string, Record<string, number>>; vinculos: Vinculo[] }) {
  const pacoteHoras = hp[c.pacote_servico] ?? {};
  // Leitura dual (Fase 2.5 — Peça 6): pct vem do vínculo com pct>0; senão do
  // campo legado cliente.pct_${funcao}. calcularFatoresEscopo (motor) lê só o
  // legado, então o Fator/H.Efet são calculados inline aqui para refletir a
  // alocação real dos vínculos. Função intacta — usada noutros pontos.
  const TH = 'px-2 py-1.5 text-[10px] font-bold uppercase text-left';
  const TD = 'px-2 py-1.5 text-sm';
  return (
    <table className="min-w-full text-sm">
      <thead style={{ backgroundColor: '#f9f9fb' }}>
        <tr><th className={TH}>Função</th><th className={TH}>Responsável</th><th className={`${TH} text-right`} title="Horas normativas do pacote (HORAS_PACOTE) — não é hora alocada">H. Pacote</th>
          <th className={`${TH} text-right`} title="pct alocado ÷ pct normativo do pacote">Escopo</th><th className={`${TH} text-right`}>H. Efet.</th></tr>
      </thead>
      <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
        {FUNCOES_ALOCACAO.map(f => {
          const resp = (c as unknown as Record<string, unknown>)[f] as string ?? '—';
          const hDir = pacoteHoras[f] ?? 0;
          const vinculo = c.id_estavel
            ? vinculos.find(v => v.id_estavel_cliente === c.id_estavel && v.funcao === f && v.pct > 0)
            : undefined;
          const pctReal = vinculo?.pct ?? ((c as unknown as Record<string, number>)[`pct_${f}`] ?? 0);
          const pctNormativo = hDir / HORAS_CLT_MES;
          const fator = pctNormativo > 0 ? pctReal / pctNormativo : 0;
          const hEf = hDir * fator;
          return (
            <tr key={f}>
              <td className={TD}>{LABEL_F[f]}</td><td className={TD}>{resp}</td>
              <td className={`${TD} text-right`}>{hDir}h</td>
              <td className={`${TD} text-right`} style={{ color: fator > 1 ? '#dc2626' : '#16a34a' }}>{fator.toFixed(2)}</td>
              <td className={`${TD} text-right`}>{hEf.toFixed(1)}h</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Par({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b" style={{ borderColor: '#f3f4f6' }}>
      <span className="text-xs" style={{ color: '#6b6b8a' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: '#160F41' }}>{valor}</span>
    </div>
  );
}

function corFator(fator: number): string {
  if (fator > 1.5) return '#dc2626';   // vermelho — extrapolando muito
  if (fator > 1.0) return '#ea580c';   // laranja — acima do escopo
  return '#16a34a';                    // verde — dentro do escopo
}

function ParFator({ funcao, fator }: { funcao: FuncaoAlocacao; fator: number }) {
  return (
    <div className="flex justify-between py-1.5 border-b" style={{ borderColor: '#f3f4f6' }}>
      <span className="text-xs" style={{ color: '#6b6b8a' }}>Escopo {LABEL_F[funcao]}</span>
      <span className="text-sm font-medium" style={{ color: corFator(fator) }}>{fator.toFixed(2)}</span>
    </div>
  );
}

function ConfigTab({ c, vinculos }: { c: import('../../types').DadosCliente; vinculos: Vinculo[] }) {
  const fatores = calcularFatoresEscopo(c, vinculos);
  return (
    <div>
      <Par label="Pacote de serviço" valor={c.pacote_servico} />
      <Par label="Peso jurídico" valor={(c.peso_juridico ?? 1.0).toFixed(1)} />
      <Par label="Volume movimentos/mês" valor={String(c.volume_movimentos_mes ?? 0)} />
      <Par label="Utiliza serviço jurídico" valor={c.utiliza_servico_juridico ? 'Sim' : 'Não'} />
      <Par label="Utiliza conciliação" valor={c.utiliza_conciliacao ? 'Sim' : 'Não'} />
      <Par label="Taxa rebate onshore" valor={`${((c.percentual_rebate_anual_onshore ?? 0) * 100).toFixed(2)}% a.a.`} />
      <Par label="Taxa rebate offshore" valor={`${((c.percentual_rebate_anual_offshore ?? 0) * 100).toFixed(2)}% a.a.`} />
      {FUNCOES_ALOCACAO.map(f => <ParFator key={f} funcao={f} fator={fatores[f]} />)}
    </div>
  );
}

function CadastralTab({ c, poupanca }: { c: DadosCliente; poupanca?: RegistroPoupanca }) {
  return (
    <div>
      <Par label="Nome completo" valor={c.nome_cliente} />
      <Par label="Empresário" valor={c.empresario ?? '—'} />
      <Par label="Banker Responsável" valor={c.banker ?? '—'} />
      <Par label="Receita fee" valor={formatCurrency(c.receita_fee)} />
      {/* PL vem do RegistroPoupanca do período (CLAUDE.md). */}
      <Par label="AUM Onshore" valor={formatCurrency(poupanca?.pl_onshore ?? 0)} />
      <Par label="AUM Offshore" valor={formatCurrency(poupanca?.pl_offshore ?? 0)} />
      <Par label="Custo contabilidade dedicado" valor={formatCurrency(c.custo_contabilidade_dedicado ?? 0)} />
      <Par label="Custo pagamento dedicado" valor={formatCurrency(c.custo_pagamento_dedicado ?? 0)} />
      <Par label="Custo administrativo dedicado" valor={formatCurrency(c.custo_administrativo_dedicado ?? 0)} />
    </div>
  );
}
