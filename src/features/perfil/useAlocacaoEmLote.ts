// --- Hook do painel "Alocação em Lote" (redesenho 2026) ---
// pct_* deixa de ser input primário: distribuição automática proporcional
// às horas normativas dos pacotes, com override manual por cliente. Cliente
// editado entra em "travados"; não-travados redistribuem o espaço restante.

import { useState, useMemo, useCallback, useEffect } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
// batch.set com { merge: true } cria o doc se ainda não existir no período —
// evita falha quando o cliente é alocado num período sem fechamento prévio.
import { useApp } from '../../state/AppContext';
import { db, salvarClienteBase, sincronizarVinculoFuncao } from '../../services/firebase';
import {
  calcularPctDistribuido, calcularFatorSobrecarga,
  somarHorasNormativas, horasProdutivasMes,
} from '../../utils/financials';
import { slug } from '../../utils/slug';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { compararClientes, type OrdenacaoAlocacao } from './ordenacaoAlocacao';
import { redistribuir } from './utilsAlocacao';
import type { Colaborador, Cliente, FuncaoAlocacao } from '../../types';
import type { Vinculo } from '../../types/vinculo';

// Seleção (colaborador × função) persistida em nível de módulo como chave
// composta "nome|funcao". recarregar() liga loading=true → Perfil.tsx desmonta
// o painel (early return de "Carregando…"), o que destruiria o useState.
// Persistir aqui faz a seleção sobreviver ao unmount/remount disparado por
// salvarTodos/removerCliente — restaura sozinho no init do useState abaixo.
let selPersistida: string | null = null;

export function useAlocacaoEmLote() {
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

  // Opções do dropdown: um par (colaborador × função) por função onde o
  // colaborador tem ≥1 cliente. Fonte = campo legado cliente[funcao]===nome
  // (mesma de clientesDoColaborador) → toda opção abre lista não-vazia.
  const opcoes = useMemo<{ key: string; nome: string; funcao: FuncaoAlocacao }[]>(() => {
    const out: { key: string; nome: string; funcao: FuncaoAlocacao }[] = [];
    for (const colab of colaboradores) {
      for (const f of FUNCOES_ALOCACAO) {
        if (todosClientes.some(c => (c[f] as string | undefined) === colab.nome_colaborador)) {
          out.push({ key: `${colab.nome_colaborador}|${f}`, nome: colab.nome_colaborador, funcao: f });
        }
      }
    }
    return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.funcao.localeCompare(b.funcao));
  }, [colaboradores, todosClientes]);

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
  const ocupacaoConsolidada = useMemo(() => {
    if (!colaboradorSelecionado) return { total: 0, porFuncao: {} as Record<string, number> };
    const idEst = colaboradorSelecionado.id_estavel;
    const nome = colaboradorSelecionado.nome_colaborador;
    const porFuncao: Record<string, number> = {};
    for (const f of FUNCOES_ALOCACAO) {
      let soma = 0;
      for (const cli of todosClientes) {
        if ((cli[f] as string | undefined) !== nome) continue;
        const v = (idEst && cli.id_estavel)
          ? vinculos.find(x => x.id_estavel_colaborador === idEst
              && x.id_estavel_cliente === cli.id_estavel && x.funcao === f)
          : undefined;
        const pctLegado = (cli[`pct_${f}` as keyof Cliente] as number | undefined) ?? 0;
        soma += (v && v.pct > 0) ? v.pct : pctLegado;
      }
      if (soma > 0) porFuncao[f] = soma;
    }
    const total = Object.values(porFuncao).reduce((s, v) => s + v, 0);
    return { total, porFuncao };
  }, [colaboradorSelecionado, todosClientes, vinculos]);
  const clientesOrdenados = useMemo<Cliente[]>(() => [...clientesDoColaborador].sort(
    compararClientes(ordenacao, { funcao, pctEditado, pctOriginal, percentualAlocavel }),
  ), [clientesDoColaborador, ordenacao, funcao, pctEditado, pctOriginal, percentualAlocavel]);
  const alteracoes = useMemo(() => Object.keys(pctEditado).reduce(
    (n, k) => n + (Math.abs((pctEditado[k] ?? 0) - (pctOriginal[k] ?? 0)) > 1e-9 ? 1 : 0), 0,
  ), [pctEditado, pctOriginal]);

  // Diagnóstico de capacidade.
  const horasNormativasTotais = useMemo(
    () => funcao ? somarHorasNormativas(clientesDoColaborador, funcao) : 0,
    [clientesDoColaborador, funcao]);
  const horasProdutivas = colaboradorSelecionado ? horasProdutivasMes(colaboradorSelecionado) : 0;
  const fatorSobrecarga = useMemo(
    () => (funcao && colaboradorSelecionado)
      ? calcularFatorSobrecarga(clientesDoColaborador, funcao, colaboradorSelecionado) : 0,
    [clientesDoColaborador, funcao, colaboradorSelecionado]);
  const capacidadeLivreHoras = horasProdutivas - horasNormativasTotais;
  const emSobrecarga = horasNormativasTotais > horasProdutivas;

  const salvarTodos = useCallback(async (): Promise<number> => {
    if (!periodoSelecionado || !funcao || alteracoes === 0) return 0;
    setSalvando(true);
    try {
      const batch = writeBatch(db);
      let mudou = 0;
      // Fase 2.5 — Peça 6: a escrita vai para fechamentos/{periodo}/vinculos/.
      // Bug Arquitetural #1 fecha lateralmente — docId do vínculo é
      // {slug_colab}_{slug_cli}_{funcao}, determinístico, sem query. Quando o
      // vínculo já existe (todos os 860 da migração Peça 2 têm), usa-se o
      // próprio v.id (zero risco de mismatch). Cenário sem vínculo prévio
      // (cliente novo ainda não migrado) cai no fallback de construção via
      // slug(nome), simétrico ao 2º branch de resolverSlugCliente em
      // scripts/fase25-peca2-apply.mjs.
      if (!colaboradorSelecionado?.id_estavel) return 0;
      const idEstColab = colaboradorSelecionado.id_estavel;
      const slugColab = slug(colaboradorSelecionado.nome_colaborador);
      for (const cli of clientesDoColaborador) {
        const novo = pctEditado[cli.nome_cliente] ?? 0;
        const orig = pctOriginal[cli.nome_cliente] ?? 0;
        const diff = Math.abs(novo - orig);
        if (!cli.id_estavel) continue;
        if (diff <= 1e-9) continue;
        const vinculoExistente = vinculos.find(v =>
          v.id_estavel_colaborador === idEstColab
          && v.id_estavel_cliente === cli.id_estavel
          && v.funcao === funcao);
        const docIdVinculo = vinculoExistente?.id
          ?? `${slugColab}_${slug(cli.nome_cliente)}_${funcao}`;
        const refVinc = doc(db, 'fechamentos', periodoSelecionado, 'vinculos', docIdVinculo);
        if (vinculoExistente) {
          // Vínculo já tem campos identificadores (id_estavel_*, nome_*, funcao,
          // origem). merge:true atualiza só pct e preserva o resto.
          batch.set(refVinc, { pct: novo }, { merge: true });
        } else {
          // Vínculo não existe — payload completo. Sem merge para evitar doc
          // órfão (causa-raiz da 1ª iteração da Peça 6: setDoc({pct}, merge:true)
          // criava doc só com pct, sem identificadores → pipeline Peça 5 nunca
          // encontrava o vínculo no filtro por id_estavel_cliente).
          const novoVinculo: Vinculo = {
            id: docIdVinculo,
            periodo: periodoSelecionado,
            id_estavel_colaborador: idEstColab,
            id_estavel_cliente: cli.id_estavel,
            nome_colaborador: colaboradorSelecionado.nome_colaborador,
            nome_cliente: cli.nome_cliente,
            funcao,
            pct: novo,
            origem: 'manual',
            data_criacao: new Date().toISOString(),
          };
          batch.set(refVinc, novoVinculo);
        }
        mudou++;
      }
      await batch.commit();
      recarregar();
      return mudou;
    } catch (err) {
      console.error('[salvarTodos] erro ao salvar:', err);
      throw err;
    } finally { setSalvando(false); }
  }, [periodoSelecionado, funcao, alteracoes, clientesDoColaborador, pctEditado, pctOriginal, recarregar, colaboradorSelecionado, vinculos, nomeSel]);

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
    colaboradores, colaboradorSelecionado, opcoes, selecaoKey: sel, setSelecao: setSel,
    funcao, clientesOrdenados,
    pctEditado, pctOriginal, pctSugerido, travados,
    setPct, resetCliente, recalcularTudo,
    alteracoes, ocupacaoTotal, ocupacaoConsolidada, percentualAlocavel,
    horasNormativasTotais, horasProdutivas, fatorSobrecarga, capacidadeLivreHoras, emSobrecarga,
    ordenacao, setOrdenarPor, salvando, salvarTodos, periodo: periodoSelecionado,
    removerCliente, removendo, periodoFechado,
  };
}
