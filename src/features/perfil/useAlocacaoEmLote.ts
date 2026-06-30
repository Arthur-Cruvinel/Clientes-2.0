// --- Hook do painel "Alocação em Lote" (redesenho 2026) ---
// pct_* deixa de ser input primário: distribuição automática proporcional
// às horas normativas dos pacotes, com override manual por cliente. Cliente
// editado entra em "travados"; não-travados redistribuem o espaço restante.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../state/AppContext';
import { salvarClienteBase, sincronizarVinculoFuncao, salvarVinculosPct } from '../../services/firebase';
import {
  calcularPctDistribuido,
  ocupacaoConsolidada as calcOcupacaoConsolidada,
} from '../../utils/financials';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { compararClientes, type OrdenacaoAlocacao } from './ordenacaoAlocacao';
import { redistribuir } from './utilsAlocacao';
import type { Colaborador, Cliente, FuncaoAlocacao } from '../../types';

// Seleção (colaborador × função) persistida em nível de módulo como chave
// composta "nome|funcao". recarregar() liga loading=true → Perfil.tsx desmonta
// o painel (early return de "Carregando…"), o que destruiria o useState.
// Persistir aqui faz a seleção sobreviver ao unmount/remount disparado por
// salvarTodos/removerCliente — restaura sozinho no init do useState abaixo.
let selPersistida: string | null = null;

export function useAlocacaoEmLote(selecaoInicial?: { nome: string; funcao?: string } | null) {
  const { dadosPeriodo, periodoSelecionado, periodoFechado, recarregar } = useApp();
  const [sel, setSelState] = useState<string | null>(() => selPersistida);
  const setSel = useCallback((s: string | null) => {
    selPersistida = s;
    setSelState(s);
  }, []);
  const [pctEditado, setPctEditado] = useState<Record<string, number>>({});
  // pctOriginal vira state (não useMemo) para que recalcularTudo possa zerá-lo
  // e forçar todos os clientes como "alterados" (alteracoes > 0). É sincronizado
  // com o snapshot do Firestore via useEffect quando clientes/funcao mudam.
  const [pctOriginal, setPctOriginal] = useState<Record<string, number>>({});
  const [travados, setTravados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  // Nome do cliente em remoção (loading por linha); null = nenhuma em curso.
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [ordenacao, setOrdenarPor] = useState<OrdenacaoAlocacao>(
    { coluna: 'nome_cliente', direcao: 'asc' });

  // Mesmo gate canônico de useColaboradores.ts (nome + cargo + função) +
  // restrição de alocáveis — exclui linhas-fantasma do Firestore.
  const colaboradores: Colaborador[] = (dadosPeriodo?.colaboradores ?? [])
    .filter(c => c.alocavel && c.nome_colaborador?.trim() && c.cargo?.trim() && c.funcao_principal);
  const todosClientes: Cliente[] = dadosPeriodo?.clientes ?? [];
  // Fase 2.5 — Peça 6: vínculos são a fonte primária de pct.
  const vinculos = dadosPeriodo?.vinculos ?? [];

  // Seleção composta "nome|funcao" → colaborador + função selecionados.
  const nomeSel = sel ? sel.split('|')[0] : null;
  const funcaoSel = sel ? sel.split('|')[1] : null;
  const colaboradorSelecionado = useMemo(
    () => colaboradores.find(c => c.nome_colaborador === nomeSel) ?? null,
    [colaboradores, nomeSel]);
  const funcao = useMemo<FuncaoAlocacao | null>(
    () => (funcaoSel && (FUNCOES_ALOCACAO as readonly string[]).includes(funcaoSel))
      ? funcaoSel as FuncaoAlocacao : null,
    [funcaoSel]);

  // Por colaborador, quais funções ele tem ≥1 cliente. Fonte = campo legado
  // cliente[funcao]===nome (mesma de clientesDoColaborador) → toda função
  // listada abre lista não-vazia. Alimenta o dropdown (nomes) + abas de função.
  const colaboradoresComFuncoes = useMemo<Record<string, FuncaoAlocacao[]>>(() => {
    const out: Record<string, FuncaoAlocacao[]> = {};
    for (const colab of colaboradores) {
      for (const f of FUNCOES_ALOCACAO) {
        if (todosClientes.some(c => (c[f] as string | undefined) === colab.nome_colaborador)) {
          const arr = out[colab.nome_colaborador];
          if (arr) arr.push(f); else out[colab.nome_colaborador] = [f];
        }
      }
    }
    return out;
  }, [colaboradores, todosClientes]);

  const nomesColaboradores = useMemo(
    () => Object.keys(colaboradoresComFuncoes).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [colaboradoresComFuncoes]);

  // Seletores que mantêm a chave composta interna. Ao trocar de colaborador,
  // seleciona automaticamente a 1ª função dele (auto-seleção quando há só uma).
  const selecionarColaborador = useCallback((nome: string | null) => {
    if (!nome) { setSel(null); return; }
    const funcs = colaboradoresComFuncoes[nome] ?? [];
    setSel(funcs.length > 0 ? `${nome}|${funcs[0]}` : null);
  }, [colaboradoresComFuncoes, setSel]);
  const selecionarFuncao = useCallback((f: FuncaoAlocacao) => {
    if (nomeSel) setSel(`${nomeSel}|${f}`);
  }, [nomeSel, setSel]);

  // Deep-link (Capacidade → "Editar alocação"): aplica a seleção inicial UMA
  // vez, quando colaboradoresComFuncoes já está carregado. funcao do link tem
  // prioridade; ausente/ inválida → primeira função do colaborador. Guard por
  // ref para o usuário poder trocar de seleção depois sem voltar ao deep-link.
  const deepLinkAplicado = useRef(false);
  useEffect(() => {
    if (deepLinkAplicado.current || !selecaoInicial?.nome) return;
    const funcs = colaboradoresComFuncoes[selecaoInicial.nome];
    if (!funcs || funcs.length === 0) return;   // aguarda dados do período
    const f = (selecaoInicial.funcao && (funcs as string[]).includes(selecaoInicial.funcao))
      ? selecaoInicial.funcao : funcs[0];
    setSel(`${selecaoInicial.nome}|${f}`);
    deepLinkAplicado.current = true;
  }, [selecaoInicial, colaboradoresComFuncoes, setSel]);

  const clientesDoColaborador = useMemo<Cliente[]>(() => {
    if (!colaboradorSelecionado || !funcao) return [];
    return todosClientes
      .filter(c => (c[funcao] as string | undefined) === colaboradorSelecionado.nome_colaborador)
      .sort((a, b) => a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR'));
  }, [todosClientes, colaboradorSelecionado, funcao]);

  // Sincroniza pctOriginal com o snapshot do Firestore. Roda quando clientes
  // ou função mudam (mudança de colaborador selecionado / recarregar do
  // AppContext após save). Não roda quando recalcularTudo zera pctOriginal.
  //
  // Fase 2.5 — Peça 6: pct vem do vínculo correspondente em vinculos/. Match
  // por (id_estavel_colaborador, id_estavel_cliente, funcao). Quando o vínculo
  // existe e tem pct > 0, é a fonte primária. Caso contrário (pct=0, vínculo
  // ainda não criado, ou id_estavel ausente), cai no campo legado do cliente —
  // simétrico ao fallback do pipeline da Peça 5.
  useEffect(() => {
    if (!funcao) { setPctOriginal({}); return; }
    const r: Record<string, number> = {};
    const k = `pct_${funcao}` as keyof Cliente;
    const idEstColab = colaboradorSelecionado?.id_estavel;
    for (const c of clientesDoColaborador) {
      const v = (idEstColab && c.id_estavel)
        ? vinculos.find(x =>
            x.id_estavel_colaborador === idEstColab
            && x.id_estavel_cliente === c.id_estavel
            && x.funcao === funcao)
        : undefined;
      const pctLegado = (c[k] as number | undefined) ?? 0;
      r[c.nome_cliente] = (v && v.pct > 0) ? v.pct : pctLegado;
    }
    setPctOriginal(r);
  }, [clientesDoColaborador, funcao, vinculos, colaboradorSelecionado]);

  // Sugestão automática (proporcional às horas normativas).
  const pctSugerido = useMemo<Record<string, number>>(
    () => (funcao && colaboradorSelecionado)
      ? calcularPctDistribuido(clientesDoColaborador, funcao, colaboradorSelecionado) : {},
    [clientesDoColaborador, funcao, colaboradorSelecionado]);

  // Init: cliente com pct>0 no Firestore = manual (travado); demais = sugestão.
  useEffect(() => {
    const inicial: Record<string, number> = {};
    const trav = new Set<string>();
    for (const c of clientesDoColaborador) {
      const orig = pctOriginal[c.nome_cliente] ?? 0;
      if (orig > 0) { inicial[c.nome_cliente] = orig; trav.add(c.nome_cliente); }
      else inicial[c.nome_cliente] = pctSugerido[c.nome_cliente] ?? 0;
    }
    setPctEditado(inicial); setTravados(trav);
  }, [clientesDoColaborador, pctOriginal, pctSugerido]);

  const percentualAlocavel = colaboradorSelecionado?.percentual_alocavel ?? 0;

  // Edita: trava + redistribui não-travados proporcionalmente.
  const setPct = useCallback((nome: string, valor: number) => {
    setTravados(prev => new Set(prev).add(nome));
    setPctEditado(prev => redistribuir(
      { ...prev, [nome]: valor }, new Set([...travados, nome]),
      clientesDoColaborador, percentualAlocavel,
    ));
  }, [travados, clientesDoColaborador, percentualAlocavel]);

  // Reseta: destrava + recoloca não-travados na sugestão normalizada.
  const resetCliente = useCallback((nome: string) => {
    const novos = new Set(travados); novos.delete(nome);
    setTravados(novos);
    setPctEditado(prev => {
      const base = { ...prev };
      for (const c of clientesDoColaborador) {
        if (!novos.has(c.nome_cliente)) base[c.nome_cliente] = pctSugerido[c.nome_cliente] ?? 0;
      }
      return redistribuir(base, novos, clientesDoColaborador, percentualAlocavel);
    });
  }, [travados, clientesDoColaborador, pctSugerido, percentualAlocavel]);

  // Aplica pctSugerido nos editados E zera pctOriginal — assim a comparação
  // contra o snapshot fica sempre `> 0` e o botão Salvar Alocação detecta
  // todos como alterados. Operação síncrona (não persiste); usuário precisa
  // clicar Salvar para gravar.
  const recalcularTudo = useCallback(() => {
    setPctEditado({ ...pctSugerido });
    setPctOriginal({});
    setTravados(new Set());
  }, [pctSugerido]);

  const ocupacaoTotal = useMemo(
    () => Object.values(pctEditado).reduce((s, v) => s + (v ?? 0), 0), [pctEditado]);

  // Ocupação CONSOLIDADA — soma o pct do colaborador selecionado em TODAS as 6
  // funções (não só a funcao_principal do painel). Espelha a leitura dual do
  // motor (resolverColaboradorParaFuncao): vínculo com pct>0 tem prioridade,
  // senão cai no campo legado cliente.pct_${f}. Detecta sobre-alocação cruzando
  // funções — invisível no resto do painel, que é mono-função.
  const ocupacaoConsolidada = useMemo(
    () => colaboradorSelecionado
      ? calcOcupacaoConsolidada(colaboradorSelecionado, todosClientes, vinculos)
      : { total: 0, porFuncao: {} as Record<string, number> },
    [colaboradorSelecionado, todosClientes, vinculos]);
  const clientesOrdenados = useMemo<Cliente[]>(() => [...clientesDoColaborador].sort(
    compararClientes(ordenacao, { pctEditado, pctOriginal }),
  ), [clientesDoColaborador, ordenacao, pctEditado, pctOriginal]);
  const alteracoes = useMemo(() => Object.keys(pctEditado).reduce(
    (n, k) => n + (Math.abs((pctEditado[k] ?? 0) - (pctOriginal[k] ?? 0)) > 1e-9 ? 1 : 0), 0,
  ), [pctEditado, pctOriginal]);


  const salvarTodos = useCallback(async (): Promise<number> => {
    if (!periodoSelecionado || !funcao || alteracoes === 0) return 0;
    if (!colaboradorSelecionado?.id_estavel) return 0;
    setSalvando(true);
    try {
      // Escrita via FONTE ÚNICA (salvarVinculosPct) — mesma gravação que a ficha
      // do colaborador usa. docId determinístico, merge p/ existente, payload
      // completo p/ novo (lógica encapsulada no serviço).
      const edicoes = clientesDoColaborador
        .filter(cli => cli.id_estavel
          && Math.abs((pctEditado[cli.nome_cliente] ?? 0) - (pctOriginal[cli.nome_cliente] ?? 0)) > 1e-9)
        .map(cli => ({ cliente: cli, funcao, pct: pctEditado[cli.nome_cliente] ?? 0 }));
      const mudou = await salvarVinculosPct({
        periodo: periodoSelecionado, colaborador: colaboradorSelecionado,
        edicoes, vinculosExistentes: vinculos,
      });
      recarregar();
      return mudou;
    } catch (err) {
      console.error('[salvarTodos] erro ao salvar:', err);
      throw err;
    } finally { setSalvando(false); }
  }, [periodoSelecionado, funcao, alteracoes, clientesDoColaborador, pctEditado, pctOriginal, recarregar, colaboradorSelecionado, vinculos]);

  // Remove o vínculo direto de um cliente com o colaborador selecionado:
  // (1) limpa cliente[funcao] + zera pct_funcao em clientes_base/ (deleteField
  // via salvarClienteBase; pct zerado evita % de dedicação órfão — paridade com
  // EditarClienteModal); (2) deleta o vínculo do período via
  // sincronizarVinculoFuncao (nomeColabNovo undefined = só remover);
  // (3) recarrega — o cliente sai da lista (filtro c[funcao] === nome).
  // Bloqueado em período fechado: a lista vem do snapshot, não de clientes_base.
  const removerCliente = useCallback(async (cliente: Cliente): Promise<void> => {
    if (!funcao || !periodoSelecionado || periodoFechado) return;
    setRemovendo(cliente.nome_cliente);
    try {
      const atualizado = { ...cliente } as Cliente;
      const rec = atualizado as unknown as Record<string, unknown>;
      rec[funcao] = undefined;
      rec[`pct_${funcao}`] = 0;
      await salvarClienteBase(atualizado);
      await sincronizarVinculoFuncao({
        cliente,
        funcao,
        nomeColabNovo: undefined,
        nomeColabAntigo: colaboradorSelecionado?.nome_colaborador,
        colaboradores,
        periodo: periodoSelecionado,
        vinculos,
      });
      recarregar();
    } finally {
      setRemovendo(null);
    }
  }, [funcao, periodoSelecionado, periodoFechado, colaboradorSelecionado, colaboradores, vinculos, recarregar]);

  return {
    colaboradores, colaboradorSelecionado, todosClientes, vinculos,
    colaboradoresComFuncoes, nomesColaboradores,
    nomeColabSelecionado: nomeSel, selecionarColaborador, selecionarFuncao,
    funcao, clientesOrdenados,
    pctEditado, pctOriginal, pctSugerido, travados,
    setPct, resetCliente, recalcularTudo,
    alteracoes, ocupacaoTotal, ocupacaoConsolidada, percentualAlocavel,
    ordenacao, setOrdenarPor, salvando, salvarTodos, periodo: periodoSelecionado,
    removerCliente, removendo, periodoFechado,
  };
}
