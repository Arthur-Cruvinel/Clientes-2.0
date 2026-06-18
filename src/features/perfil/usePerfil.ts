// --- Hook da aba Perfil — gerencia seleção, busca e edição de clientes ---
// Usa dados do AppContext (que auto-detecta o período mais recente).

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../state/AppContext';
import { salvarClienteBase, registrarAlteracao, sincronizarVinculoFuncao, buscarPtaxDiaAnterior, buscarPrimeiroRegistroPoupanca, definirCustoDedicado } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { mesclarTodos } from '../../utils/dadosClienteAdapter';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { CAMPOS_VIGENCIA_CLIENTE } from '../../utils/financials';
import type { OrdenacaoState } from '../../components/ui/HeaderOrdenavel';
import type { DadosCliente, Cliente, FuncaoAlocacao, PacoteServico, VigenciaCliente } from '../../types';

/** Colunas ordenáveis/filtráveis da lista de clientes do Perfil. */
export type ColunaListaCliente = 'nome' | 'pacote';

// Ordem canônica dos pacotes (mais completo → menos) para opções de filtro.
const ORDEM_PACOTES: PacoteServico[] = ['full', 'advanced', 'light', 'future', 'asset_only'];

// Campos calculados pelo motor (DRE) + PL injetado pelo adapter — não pertencem
// ao cadastro mestre (clientes_base/) e devem ser removidos antes de persistir.
const CAMPOS_CALCULADOS_DRE = [
  'receita_fee_mensal', 'receita_rebate', 'receita_bruta', 'custo_direto',
  'custo_dedicado', 'custo_indireto_rateado', 'custo_total', 'impostos_faturamento',
  'impostos_lucro', 'margem_contribuicao', 'ebitda', 'margem', 'classificacao',
  'horas_totais', 'custo_direto_detalhe', 'pl_onshore', 'pl_offshore',
];

/** Devolve apenas o que pertence ao cadastro (Cliente) de um DadosCliente,
 *  descartando campos derivados (ebitda, custos, PL) — para não poluir o mestre. */
function extrairCadastro(dc: DadosCliente): Cliente {
  const cadastro = { ...dc } as Record<string, unknown>;
  for (const k of CAMPOS_CALCULADOS_DRE) delete cadastro[k];
  return cadastro as unknown as Cliente;
}

/** Campo aceito pela atribuição em lote — banker/empresário (cadastrais)
 *  + funções de alocação (responsável por função). Todos persistem em
 *  clientes_base/ via salvarClienteBase (mesmo modelo do cadastro individual). */
export type CampoAtribuicaoLote = 'banker' | 'empresario' | FuncaoAlocacao;

// Campos monitorados para histórico de alterações
const CAMPOS_MONITORADOS: (keyof Cliente)[] = [
  'receita_fee', 'moeda_fee', 'pacote_servico', 'banker', 'empresario', 'data_entrada',
  'percentual_rebate_anual_onshore', 'percentual_rebate_anual_offshore',
  'pct_consultoria_gestao', 'pct_consultoria_planejamento',
  'pct_consultoria_financeira', 'pct_operacional_financeiro',
  'pct_serv_adm', 'pct_serv_aux_adm',
  'consultoria_gestao', 'consultoria_planejamento',
  'consultoria_financeira', 'operacional_financeiro',
  'serv_adm', 'serv_aux_adm',
  'peso_juridico', 'volume_movimentos_mes',
  'utiliza_servico_juridico', 'utiliza_conciliacao',
  // PL é gerenciado pelo módulo AUM — histórico fica lá, não no Perfil.
  'custo_contabilidade_dedicado', 'custo_pagamento_dedicado', 'custo_administrativo_dedicado',
];

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function usePerfil() {
  const { dadosPeriodo, parametros, periodoSelecionado, loading, recarregar } = useApp();
  const { usuario } = useAuth();
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Aviso não-bloqueante do save (ex.: cliente sem id_estavel → administrativo
  // não gravado na estrutura por período). Exibido pela tela do Perfil.
  const [avisoSalvar, setAvisoSalvar] = useState<string | null>(null);

  // Estado de ordenação + filtros de coluna da lista (CLAUDE.md: estado de
  // ordenação vive no hook da feature, não no componente).
  const [ordenacaoLista, setOrdenacaoLista] = useState<OrdenacaoState<ColunaListaCliente>>(
    { coluna: 'nome', direcao: 'asc' });
  const [filtroNomeColuna, setFiltroNomeColuna] = useState('');
  const [filtroPacotes, setFiltroPacotes] = useState<PacoteServico[]>([]);

  // Mescla cadastro + DRE + PL (poupança) para que as abas tenham tudo em um
  // único objeto, como antes. PL é injetado pelo adapter a partir do
  // RegistroPoupanca do período.
  const clientes = useMemo<DadosCliente[]>(() =>
    dadosPeriodo
      ? mesclarTodos(
          dadosPeriodo.clientes,
          dadosPeriodo.resultados,
          dadosPeriodo.registrosPoupanca,
        )
      : [],
    [dadosPeriodo],
  );
  const colaboradores = dadosPeriodo?.colaboradores ?? [];

  // ── Backfill silencioso de data_entrada para Pure Assets ──────────────────
  // Pure Assets entram via lâmina (poupanca/) e em geral não têm cadastro com
  // data de entrada. Aqui, para cada Pure Asset (pacote_servico='asset_only')
  // sem data_entrada, buscamos o registro de poupança mais antigo e gravamos
  // data_entrada = 'YYYY-MM' desse registro em clientes_base/. Sem feedback ao
  // usuário; nunca sobrescreve data_entrada existente; roda no máximo uma vez
  // por cliente por sessão (ref) — duas camadas contra reprocessamento + loop.
  const pureAssetsProcessados = useRef<Set<string>>(new Set());
  useEffect(() => {
    const alvos = clientes.filter(c =>
      c.pacote_servico === 'asset_only'
      && !c.data_entrada
      && !pureAssetsProcessados.current.has(c.nome_cliente));
    if (alvos.length === 0) return;
    let cancelado = false;
    (async () => {
      let algumSalvo = false;
      for (const c of alvos) {
        pureAssetsProcessados.current.add(c.nome_cliente);
        try {
          const primeiro = await buscarPrimeiroRegistroPoupanca(c.nome_cliente);
          if (!primeiro) continue;
          const dataEntrada = `${primeiro.ano}-${String(primeiro.mes).padStart(2, '0')}`;
          await salvarClienteBase({ ...extrairCadastro(c), data_entrada: dataEntrada });
          algumSalvo = true;
        } catch { /* silencioso — backfill best-effort */ }
      }
      // Recarrega só se algo mudou, para o data_entrada novo refletir na UI
      // (e o filtro de visibilidade do AppContext reavaliar). Já-salvos não
      // reentram (passam a ter data_entrada); sem-histórico ficam no ref.
      if (algumSalvo && !cancelado) recarregar();
    })();
    return () => { cancelado = true; };
  }, [clientes, recarregar]);

  // Label do período para exibição
  const periodoLabel = useMemo(() => {
    if (!periodoSelecionado) return '';
    const [a, m] = periodoSelecionado.split('-').map(Number);
    return `${MESES_LABEL[m - 1]}/${a}`;
  }, [periodoSelecionado]);

  const bankersUnicos = useMemo(() =>
    [...new Set(clientes.map((c: DadosCliente) => c.banker).filter((b): b is string => !!b))].sort(),
  [clientes]);

  const empresariosUnicos = useMemo(() =>
    [...new Set(clientes.map((c: DadosCliente) => c.empresario).filter((e): e is string => !!e))].sort(),
  [clientes]);

  // Pacotes presentes na carteira atual, em ordem canônica — opções do filtro
  // de coluna "Pacote". Derivado do conjunto completo (não do já filtrado), p/
  // as opções não sumirem conforme o usuário marca/desmarca.
  const pacotesDisponiveis = useMemo<PacoteServico[]>(() => {
    const presentes = new Set(clientes.map((c: DadosCliente) => c.pacote_servico));
    return ORDEM_PACOTES.filter(p => presentes.has(p));
  }, [clientes]);

  // Lista final: busca geral + filtro de coluna (nome texto, pacote checkboxes)
  // + ordenação. Todos compostos em AND. Ordenação alfabética 'pt-BR' por nome
  // como base; para a coluna 'pacote', ordena por pacote com desempate por nome.
  const clientesFiltrados = useMemo(() => {
    const buscaLower = busca.toLowerCase();
    const nomeColLower = filtroNomeColuna.toLowerCase();
    const lista = clientes.filter((c: DadosCliente) => {
      if (buscaLower && !c.nome_cliente.toLowerCase().includes(buscaLower)) return false;
      if (nomeColLower && !c.nome_cliente.toLowerCase().includes(nomeColLower)) return false;
      if (filtroPacotes.length > 0 && !filtroPacotes.includes(c.pacote_servico)) return false;
      return true;
    });
    const dir = ordenacaoLista.direcao === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (ordenacaoLista.coluna === 'pacote') {
        const cmp = a.pacote_servico.localeCompare(b.pacote_servico, 'pt-BR');
        if (cmp !== 0) return cmp * dir;
        return a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR') * dir;
      }
      return a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR') * dir;
    });
  }, [clientes, busca, filtroNomeColuna, filtroPacotes, ordenacaoLista]);

  const limparFiltrosColuna = useCallback(() => {
    setFiltroNomeColuna('');
    setFiltroPacotes([]);
  }, []);

  const clienteSelecionado = useMemo(() =>
    clientes.find((c: DadosCliente) => c.id === clienteSelecionadoId) ?? null,
    [clientes, clienteSelecionadoId],
  );

  const selecionar = useCallback((c: DadosCliente) => {
    setClienteSelecionadoId(c.id ?? null);
  }, []);

  const salvarCliente = useCallback(async (dados: Partial<Cliente>) => {
    if (!clienteSelecionado) return;
    setSalvando(true);
    setAvisoSalvar(null);
    // custo_administrativo_dedicado virou VARIÁVEL por período: o valor que vem
    // do modal NÃO vai mais para o master — é roteado para definirCustoDedicado
    // (mês selecionado) mais abaixo. Capturamos aqui antes de qualquer mexida.
    const temAdmin = 'custo_administrativo_dedicado' in dados;
    const adminValor = Number(dados.custo_administrativo_dedicado ?? 0);
    try {
      // ── Conversão de fee em moeda estrangeira → BRL ─────────────────────
      // Quando moeda_fee ≠ BRL, o valor que chega em dados.receita_fee está na
      // moeda original. Buscamos a PTAX (venda) do dia anterior, convertemos
      // para BRL — que é o que o pipeline de DRE lê em receita_fee — e
      // preservamos a trilha de auditoria (receita_fee_original / moeda_fee_
      // original / ptax_usado). moeda_fee = BRL limpa esses campos de uma
      // conversão anterior. PTAX indisponível (0): mantém o valor sem converter
      // e não marca auditoria (não quebra o save).
      const dadosFinal: Partial<Cliente> = { ...dados };
      if ('receita_fee' in dados || 'moeda_fee' in dados) {
        const moeda = dados.moeda_fee ?? clienteSelecionado.moeda_fee ?? 'BRL';
        const feeOriginal = dados.receita_fee ?? clienteSelecionado.receita_fee ?? 0;
        if (moeda !== 'BRL') {
          const ptaxes = await buscarPtaxDiaAnterior();
          const ptax = ptaxes[moeda];
          if (ptax > 0) {
            dadosFinal.receita_fee = feeOriginal * ptax;
            dadosFinal.receita_fee_original = feeOriginal;
            dadosFinal.moeda_fee = moeda;
            dadosFinal.moeda_fee_original = moeda;
            dadosFinal.ptax_usado = ptax;
          } else {
            console.warn(`[Perfil] PTAX indisponível para ${moeda} — fee mantido sem conversão.`);
          }
        } else {
          dadosFinal.moeda_fee = 'BRL';
          dadosFinal.receita_fee_original = undefined;
          dadosFinal.moeda_fee_original = undefined;
          dadosFinal.ptax_usado = undefined;
        }
      }

      // Detectar campos alterados e registrar no histórico
      const agora = new Date().toISOString();
      const email = usuario?.email ?? 'desconhecido';
      const clienteAnterior = clienteSelecionado as unknown as Record<string, unknown>;
      const dadosNovos = dadosFinal as Record<string, unknown>;

      for (const campo of CAMPOS_MONITORADOS) {
        if (!(campo in dadosNovos)) continue;
        const anterior = clienteAnterior[campo];
        const novo = dadosNovos[campo];
        // Comparar com stringify para lidar com undefined vs absent
        if (JSON.stringify(anterior) !== JSON.stringify(novo)) {
          registrarAlteracao(clienteSelecionado.nome_cliente, {
            campo, valor_anterior: anterior ?? null, valor_novo: novo ?? null,
            alterado_em: agora, alterado_por: email,
            // Campo por período (administrativo) ou de vigência (Tier A) carrega o
            // mês — sem isso o histórico ficaria órfão (não diria a qual mês a
            // mudança se refere).
            ...((campo === 'custo_administrativo_dedicado'
              || (CAMPOS_VIGENCIA_CLIENTE as readonly string[]).includes(campo))
              ? { periodo: periodoSelecionado } : {}),
          });
        }
      }

      // ── Vigência Tier A (forward-only) ────────────────────────────────────────
      // fee/moeda/rebate/contabilidade/pagamento NÃO vão mais para o write direto
      // do master: viram entradas de vigência. Compara cada campo Tier A do save
      // com o VIGENTE no período (clienteSelecionado já vem RESOLVIDO pelo overlay
      // do AppContext). Se mudou, injeta/atualiza a entrada com vigencia =
      // periodoSelecionado (substitui a do mesmo mês, mesclando campos). O campo
      // direto do master fica como baseline (delete da chave + merge:true).
      let historicoVigencia = clienteSelecionado.historico_vigencia_cliente
        ? [...clienteSelecionado.historico_vigencia_cliente]
        : undefined;
      if (periodoSelecionado) {
        const vigenteAtual = clienteSelecionado as unknown as Record<string, unknown>;
        const novos = dadosFinal as Record<string, unknown>;
        const mudancas: Partial<VigenciaCliente> = {};
        for (const campo of CAMPOS_VIGENCIA_CLIENTE) {
          if (!(campo in novos) || novos[campo] === undefined) continue;
          if (JSON.stringify(novos[campo]) !== JSON.stringify(vigenteAtual[campo])) {
            (mudancas as Record<string, unknown>)[campo] = novos[campo];
          }
        }
        if (Object.keys(mudancas).length > 0) {
          const base = historicoVigencia ?? [];
          const existente = base.find(v => v.vigencia === periodoSelecionado);
          const entrada: VigenciaCliente = {
            ...(existente ?? {}),
            ...mudancas,
            vigencia: periodoSelecionado,
            observacao: 'Reajuste automático',
            registrado_em: agora,
            registrado_por: email,
          };
          historicoVigencia = [...base.filter(v => v.vigencia !== periodoSelecionado), entrada];
        }
      }

      // Mescla dados existentes com alterações e salva em clientes_base/.
      const clienteAtualizado = { ...clienteSelecionado, ...dadosFinal } as Cliente;
      // custo_administrativo_dedicado → custosDedicados/ (por período, abaixo).
      // Deletar a CHAVE (não setar undefined) p/ merge:true preservar o master.
      delete clienteAtualizado.custo_administrativo_dedicado;
      // Tier A → vigência: remove as chaves do write p/ merge:true PRESERVAR os
      // campos diretos do master como baseline (não reescrever com o resolvido).
      // Sem período: cai no comportamento antigo (Tier A vai ao master direto).
      if (periodoSelecionado) {
        for (const campo of CAMPOS_VIGENCIA_CLIENTE) {
          delete (clienteAtualizado as Record<string, unknown>)[campo];
        }
        if (historicoVigencia) clienteAtualizado.historico_vigencia_cliente = historicoVigencia;
      }
      await salvarClienteBase(clienteAtualizado);

      // Sincroniza vinculos/ para cada função cujo colaborador mudou.
      // Sem isto, clientes_base/ fica com nome_novo mas o vínculo do período
      // continua apontando para o colab antigo — pipeline (Peça 5) usa o
      // vínculo e ignora a troca. Único caller que tinha esse gap até hoje;
      // atualizarCampoEmLote ganha o mesmo tratamento no commit seguinte.
      if (periodoSelecionado) {
        const vinculosPeriodo = dadosPeriodo?.vinculos ?? [];
        const colaboradoresPeriodo = dadosPeriodo?.colaboradores ?? [];
        const dadosNovosRec = dadosFinal as Record<string, unknown>;
        const anteriorRec = clienteSelecionado as unknown as Record<string, unknown>;
        for (const funcao of FUNCOES_ALOCACAO) {
          if (!(funcao in dadosNovosRec)) continue;
          const novo = dadosNovosRec[funcao] as string | undefined;
          const antigo = anteriorRec[funcao] as string | undefined;
          if (novo === antigo) continue;
          await sincronizarVinculoFuncao({
            cliente: clienteAtualizado,
            funcao,
            nomeColabNovo: novo || undefined,
            nomeColabAntigo: antigo || undefined,
            colaboradores: colaboradoresPeriodo,
            periodo: periodoSelecionado,
            vinculos: vinculosPeriodo,
          });
        }
      }

      // ── Custo administrativo dedicado → estrutura por período ────────────────
      // Grava SÓ no mês selecionado (custosDedicados/{id_estavel}), NUNCA no
      // master. id_estavel ausente (ex.: Pure Asset sintetizado): definirCustoDedicado
      // recusa — capturamos e avisamos sem bloquear o resto do save. Esses clientes
      // têm administrativo 0 por natureza.
      if (temAdmin && periodoSelecionado) {
        try {
          await definirCustoDedicado(periodoSelecionado, {
            id_estavel_cliente: clienteSelecionado.id_estavel ?? '',
            nome_cliente: clienteSelecionado.nome_cliente,
            custo_administrativo_dedicado: adminValor,
          });
        } catch (e) {
          console.warn('[Perfil] custo administrativo não gravado:', e);
          setAvisoSalvar(
            `Cliente "${clienteSelecionado.nome_cliente}" sem id_estável: custo administrativo não gravado neste mês.`,
          );
        }
      }

      recarregar();
      setModalAberto(false);
    } catch (e) {
      console.error('[Perfil] Erro ao salvar:', e);
    } finally {
      setSalvando(false);
    }
  }, [clienteSelecionado, recarregar, usuario, periodoSelecionado, dadosPeriodo]);

  const carregar = useCallback(async () => { recarregar(); }, [recarregar]);

  const atualizarCampoEmLote = useCallback(async (
    clienteIds: string[], campo: CampoAtribuicaoLote, valor: string,
  ) => {
    // Encontrar clientes pelo id e salvar em clientes_base/. Vale para
    // banker, empresário e qualquer função de alocação — o cadastro mestre.
    const clientesParaAtualizar = clientes.filter((c: DadosCliente) => c.id && clienteIds.includes(c.id));
    const isFuncao = (FUNCOES_ALOCACAO as readonly string[]).includes(campo);
    const vinculosPeriodo = dadosPeriodo?.vinculos ?? [];
    const colaboradoresPeriodo = dadosPeriodo?.colaboradores ?? [];

    await Promise.all(clientesParaAtualizar.map(async (c: DadosCliente) => {
      const atualizado = { ...c, [campo]: valor || undefined } as Cliente;
      await salvarClienteBase(atualizado);
      // Para banker/empresário não há vínculo a sincronizar — só campos do
      // cadastro mestre. Funções de alocação têm vínculo correspondente em
      // fechamentos/{periodo}/vinculos/ que precisa acompanhar a troca.
      if (isFuncao && periodoSelecionado) {
        const nomeAntigo = (c as unknown as Record<string, unknown>)[campo] as string | undefined;
        await sincronizarVinculoFuncao({
          cliente: atualizado,
          funcao: campo as FuncaoAlocacao,
          nomeColabNovo: valor || undefined,
          nomeColabAntigo: nomeAntigo,
          colaboradores: colaboradoresPeriodo,
          periodo: periodoSelecionado,
          vinculos: vinculosPeriodo,
        });
      }
    }));
  }, [clientes, periodoSelecionado, dadosPeriodo]);

  return {
    clientes: clientesFiltrados, clienteSelecionado, selecionar,
    busca, setBusca, modalAberto, setModalAberto,
    colaboradores, parametros, salvarCliente, salvando,
    avisoSalvar, setAvisoSalvar,
    loading, periodoLabel, bankersUnicos, empresariosUnicos,
    atualizarCampoEmLote, carregar,
    // Ordenação + filtros de coluna da lista de clientes (tabela do Perfil)
    ordenacaoLista, setOrdenacaoLista,
    filtroNomeColuna, setFiltroNomeColuna,
    filtroPacotes, setFiltroPacotes,
    pacotesDisponiveis, limparFiltrosColuna,
  };
}
