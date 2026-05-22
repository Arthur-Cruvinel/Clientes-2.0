// --- Hook do painel "Alocação em Lote" (redesenho 2026) ---
// pct_* deixa de ser input primário: distribuição automática proporcional
// às horas normativas dos pacotes, com override manual por cliente. Cliente
// editado entra em "travados"; não-travados redistribuem o espaço restante.

import { useState, useMemo, useCallback, useEffect } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
// batch.set com { merge: true } cria o doc se ainda não existir no período —
// evita falha quando o cliente é alocado num período sem fechamento prévio.
import { useApp } from '../../state/AppContext';
import { db, resolverDocIdClientePorIdEstavel } from '../../services/firebase';
import {
  calcularPctDistribuido, calcularFatorSobrecarga,
  somarHorasNormativas, horasProdutivasMes,
} from '../../utils/financials';
import { compararClientes, type OrdenacaoAlocacao } from './ordenacaoAlocacao';
import { normalizarFuncao, redistribuir } from './utilsAlocacao';
import type { Colaborador, Cliente, FuncaoAlocacao } from '../../types';

export function useAlocacaoEmLote() {
  const { dadosPeriodo, periodoSelecionado, recarregar } = useApp();
  const [nomeSel, setNomeSel] = useState<string | null>(null);
  const [pctEditado, setPctEditado] = useState<Record<string, number>>({});
  // pctOriginal vira state (não useMemo) para que recalcularTudo possa zerá-lo
  // e forçar todos os clientes como "alterados" (alteracoes > 0). É sincronizado
  // com o snapshot do Firestore via useEffect quando clientes/funcao mudam.
  const [pctOriginal, setPctOriginal] = useState<Record<string, number>>({});
  const [travados, setTravados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [ordenacao, setOrdenarPor] = useState<OrdenacaoAlocacao>(
    { coluna: 'nome_cliente', direcao: 'asc' });

  // Mesmo gate canônico de useColaboradores.ts (nome + cargo + função) +
  // restrição de alocáveis — exclui linhas-fantasma do Firestore.
  const colaboradores: Colaborador[] = (dadosPeriodo?.colaboradores ?? [])
    .filter(c => c.alocavel && c.nome_colaborador?.trim() && c.cargo?.trim() && c.funcao_principal);
  const todosClientes: Cliente[] = dadosPeriodo?.clientes ?? [];
  // Fase 2.5 — Peça 6: vínculos são a fonte primária de pct.
  const vinculos = dadosPeriodo?.vinculos ?? [];

  const colaboradorSelecionado = useMemo(
    () => colaboradores.find(c => c.nome_colaborador === nomeSel) ?? null,
    [colaboradores, nomeSel]);
  const funcao = useMemo<FuncaoAlocacao | null>(
    () => colaboradorSelecionado ? normalizarFuncao(colaboradorSelecionado.funcao_principal) : null,
    [colaboradorSelecionado]);

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
    // [DIAG] ponto 1: a função foi chamada?
    console.log('[salvarTodos] start', {
      periodoSelecionado, funcao, alteracoes,
      totalClientes: clientesDoColaborador.length,
    });
    // [DIAG] ponto 5 + ponto 1 (early return)
    if (!periodoSelecionado || !funcao || alteracoes === 0) {
      console.warn('[salvarTodos] EARLY RETURN', {
        semPeriodo: !periodoSelecionado,
        semFuncao: !funcao,
        alteracoes_zero: alteracoes === 0,
      });
      return 0;
    }
    // [DIAG] ponto 2: pctEditado vs pctOriginal completos
    console.log('[salvarTodos] estados', {
      pctEditado: { ...pctEditado },
      pctOriginal: { ...pctOriginal },
    });
    setSalvando(true);
    try {
      const batch = writeBatch(db);
      const k = `pct_${funcao}`;
      let mudou = 0;
      let pulados = 0;
      // Bug Arquitetural #1: cli.id pode vir de clientes_base/ (docId=slug)
      // enquanto o snapshot do período tem docId=UUID. Resolve antes do batch
      // para gravar no doc canônico do período (e não criar doc-sombra). Faz
      // 1 lookup por cliente alterado — não impacta performance perceptivelmente
      // já que o painel só dispara salvarTodos em ações pontuais do usuário.
      for (const cli of clientesDoColaborador) {
        const novo = pctEditado[cli.nome_cliente] ?? 0;
        const orig = pctOriginal[cli.nome_cliente] ?? 0;
        const diff = Math.abs(novo - orig);
        // [DIAG] ponto 6: cliente sem id é pulado silenciosamente?
        if (!cli.id) {
          console.warn('[salvarTodos] cliente SEM ID — pulado', cli.nome_cliente);
          pulados++;
          continue;
        }
        if (diff <= 1e-9) {
          console.log('[salvarTodos] sem mudança — pulado', { cliente: cli.nome_cliente, novo, orig });
          pulados++;
          continue;
        }
        const docIdCanonico = await resolverDocIdClientePorIdEstavel(
          periodoSelecionado, cli.id_estavel, cli.id,
        );
        // [DIAG] ponto 3: batch.set por cliente (com path completo)
        const path = `fechamentos/${periodoSelecionado}/clientes/${docIdCanonico}`;
        console.log('[salvarTodos] batch.set', { cliente: cli.nome_cliente, id_original: cli.id, docIdCanonico, novo, orig, campo: k, path });
        batch.set(
          doc(db, 'fechamentos', periodoSelecionado, 'clientes', docIdCanonico),
          { [k]: novo },
          { merge: true },
        );
        mudou++;
      }
      console.log('[salvarTodos] resumo pré-commit', {
        mudou, pulados, totalClientes: clientesDoColaborador.length,
      });
      // [DIAG] ponto 4: commit?
      console.log('[salvarTodos] batch.commit() iniciando…');
      await batch.commit();
      console.log('[salvarTodos] batch.commit() OK');
      recarregar();
      console.log('[salvarTodos] recarregar() chamado');
      return mudou;
    } catch (err) {
      // [DIAG] ponto 7: erros propagam (não engolimos)
      console.error('[salvarTodos] ERRO', err);
      throw err;
    } finally { setSalvando(false); }
  }, [periodoSelecionado, funcao, alteracoes, clientesDoColaborador, pctEditado, pctOriginal, recarregar]);

  return {
    colaboradores, colaboradorSelecionado, setColaboradorSelecionado: setNomeSel,
    funcao, clientesOrdenados,
    pctEditado, pctOriginal, pctSugerido, travados,
    setPct, resetCliente, recalcularTudo,
    alteracoes, ocupacaoTotal, percentualAlocavel,
    horasNormativasTotais, horasProdutivas, fatorSobrecarga, capacidadeLivreHoras, emSobrecarga,
    ordenacao, setOrdenarPor, salvando, salvarTodos, periodo: periodoSelecionado,
  };
}
