// --- Hook da aba Colaboradores ---
// Calcula derivados (custo total, ocupação, status) e expõe ações de salvar.
// Fonte: AppContext.dadosPeriodo (clientes + colaboradores + período).

import { useMemo, useCallback, useState } from 'react';
import { useApp } from '../../state/AppContext';
import {
  salvarColaboradorPeriodo, deletarColaboradorPeriodo,
  deletarColaboradorPeriodosFuturos,
} from '../../services/firebase';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { calcularFolhaColaborador, ocupacaoConsolidada } from '../../utils/financials';
import { slug } from '../../utils/slug';
import type { Colaborador, FuncaoAlocacao } from '../../types';
import { compararDerivados, type Ordenacao } from './ordenacao';

export type StatusOcupacao = 'ok' | 'atencao' | 'sobrecarga';

// Subcampos de benefício editáveis em lote. Patch só carrega os campos
// PREENCHIDOS (campo vazio = não altera, preserva o valor atual do colaborador).
export type SubBeneficio = 'vale_alimentacao' | 'vale_transporte' | 'plano_saude' | 'outros_beneficios';
export type BeneficiosPatch = Partial<Record<SubBeneficio, number>>;
export interface ResultadoLote {
  atualizados: number;
  erros: Array<{ nome: string; motivo: string }>;
}

export interface ColaboradorDerivado {
  colaborador: Colaborador;
  custoTotalMensal: number;
  custoHora: number;
  custoInstitucional: number;
  custoDireto: number;
  somaPctClientes: number;
  ocupacao: number;
  statusOcupacao: StatusOcupacao;
  funcao: FuncaoAlocacao | null;
}

const MAPA_FUNCAO: Record<string, FuncaoAlocacao> = {
  Gestor: 'consultoria_gestao', Coordenador: 'consultoria_planejamento',
  Consultor: 'consultoria_financeira', Operador: 'operacional_financeiro',
  Administrativo: 'serv_adm', AuxAdm: 'serv_aux_adm',
};

function normalizarFuncao(f: string): FuncaoAlocacao | null {
  if ((FUNCOES_ALOCACAO as readonly string[]).includes(f)) return f as FuncaoAlocacao;
  return MAPA_FUNCAO[f] ?? null;
}

const statusDe = (o: number): StatusOcupacao =>
  o > 1.2 ? 'sobrecarga' : o > 1.0 ? 'atencao' : 'ok';

export function useColaboradores() {
  const { dadosPeriodo, periodoSelecionado, recarregar } = useApp();
  const [salvando, setSalvando] = useState(false);
  const [ordenacao, setOrdenarPor] = useState<Ordenacao>({ coluna: 'nome_colaborador', direcao: 'asc' });

  const todosColaboradores = dadosPeriodo?.colaboradores ?? [];
  const clientes = dadosPeriodo?.clientes ?? [];
  const vinculos = dadosPeriodo?.vinculos ?? [];

  // Linhas fantasma (sem nome/cargo/função) ficam fora dos cálculos e da UI.
  //
  // ⚠ NÃO filtrar por `ativo` aqui (regra de modelo do CFO): o demitido
  // PERMANECE no mês da saída — o custo dele é real no fechamento desse mês.
  // Filtrar por ativo zeraria esse custo e quebraria o fechamento. O filtro de
  // "OMITIR INATIVO" pertence à PROPAGAÇÃO PARA FRENTE (Passo 4 — ainda não
  // implementado), em `propagarFolhaTodosColaboradores` (services/firebase.ts):
  // ao replicar para o próximo período, pular colaboradores com `ativo===false`.
  // Aqui (período corrente) o status é apenas informativo.
  const colaboradoresValidos = useMemo(() => todosColaboradores.filter(
    c => c.nome_colaborador?.trim() && c.cargo?.trim() && c.funcao_principal,
  ), [todosColaboradores]);

  // custo_total_mensal/custo_hora vêm enriquecidos do AppContext (single source of truth).
  const derivados = useMemo<ColaboradorDerivado[]>(() => colaboradoresValidos.map(col => {
    const funcao = normalizarFuncao(col.funcao_principal);
    // Ocupação vínculo-first CONSOLIDADA (6 funções) via helper único — mesma
    // fonte/lógica da guarda de sobre-alocação. Substitui o legado mono-função
    // que lia cliente.pct_* (dado morto). `somaPctClientes` agora é o total
    // consolidado (todas as funções), não só a principal.
    const { total: somaPctClientes } = ocupacaoConsolidada(col, clientes, vinculos);
    const ocupacao = col.percentual_alocavel > 0 ? somaPctClientes / col.percentual_alocavel : 0;
    return {
      colaborador: col,
      custoTotalMensal: col.custo_total_mensal,
      custoHora: col.custo_hora,
      custoInstitucional: col.custo_total_mensal * col.percentual_institucional,
      custoDireto: col.custo_total_mensal * col.percentual_alocavel,
      somaPctClientes, ocupacao, statusOcupacao: statusDe(ocupacao), funcao,
    };
  }), [colaboradoresValidos, clientes, vinculos]);

  const derivadosOrdenados = useMemo<ColaboradorDerivado[]>(
    () => [...derivados].sort(compararDerivados(ordenacao)),
    [derivados, ordenacao],
  );

  const totais = useMemo(() => ({
    folha: derivados.reduce((s, d) => s + d.custoTotalMensal, 0),
    direto: derivados.reduce((s, d) => s + d.custoDireto, 0),
    institucional: derivados.reduce((s, d) => s + d.custoInstitucional, 0),
  }), [derivados]);

  const algumSobrecarga = useMemo(
    () => derivados.some(d => d.statusOcupacao === 'sobrecarga'), [derivados]);

  const salvarFolha = useCallback(async (atualizado: Colaborador) => {
    if (!periodoSelecionado) return;
    setSalvando(true);
    try { await salvarColaboradorPeriodo(periodoSelecionado, atualizado); recarregar(); }
    finally { setSalvando(false); }
  }, [periodoSelecionado, recarregar]);

  // Edição de benefícios em lote — ESCREVE EXCLUSIVAMENTE no período ativo.
  // Para cada colaborador selecionado: aplica só os subcampos preenchidos do
  // patch (vazios preservam o valor atual), recalcula beneficios_fixos = soma
  // e o custo via o MOTOR REAL (calcularFolhaColaborador, mesmo do save
  // individual), e persiste via salvarColaboradorPeriodo (mesmo mecanismo).
  // Nunca itera períodos nem toca colaboradores_base. Erros não abortam o lote.
  const salvarBeneficiosEmLote = useCallback(async (
    ids: string[], patch: BeneficiosPatch,
  ): Promise<ResultadoLote> => {
    if (!periodoSelecionado) throw new Error('Sem período ativo na tela.');
    const ano = parseInt(periodoSelecionado.split('-')[0], 10);
    const erros: ResultadoLote['erros'] = [];
    let atualizados = 0;
    setSalvando(true);
    try {
      for (const id of ids) {
        const col = colaboradoresValidos.find(c => c.id === id);
        if (!col) { erros.push({ nome: id, motivo: 'colaborador não encontrado no período ativo' }); continue; }
        try {
          // Campo no patch (preenchido, inclusive 0) sobrescreve; ausente preserva.
          const va = patch.vale_alimentacao ?? col.vale_alimentacao ?? 0;
          const vt = patch.vale_transporte ?? col.vale_transporte ?? 0;
          const ps = patch.plano_saude ?? col.plano_saude ?? 0;
          const ob = patch.outros_beneficios ?? col.outros_beneficios ?? 0;
          const beneficios_fixos = va + vt + ps + ob;
          const novo: Colaborador = {
            ...col, vale_alimentacao: va, vale_transporte: vt, plano_saude: ps,
            outros_beneficios: ob, beneficios_fixos,
          };
          // Motor real, period-aware (resolve teto vigente via histórico) — espelha
          // exatamente o custo que o save individual gravaria. NÃO reimplementado.
          const r = calcularFolhaColaborador(novo, ano, periodoSelecionado);
          const payload: Colaborador = {
            ...novo,
            custo_total_mensal: r.custo_total_mensal, custo_hora: r.custo_hora,
            inss: r.inss, irrf: r.irrf_liquido,
            complemento_plr: r.complemento_plr, reflexos_plr_mensal: r.reflexos_plr_mensal,
            encargos_patronais: r.encargos_patronais, decimo_terceiro_ferias: r.decimo_terceiro_ferias,
          };
          await salvarColaboradorPeriodo(periodoSelecionado, payload);
          atualizados++;
        } catch (e) {
          erros.push({ nome: col.nome_colaborador, motivo: e instanceof Error ? e.message : 'falha ao salvar' });
        }
      }
      recarregar();
      return { atualizados, erros };
    } finally { setSalvando(false); }
  }, [periodoSelecionado, colaboradoresValidos, recarregar]);

  // (salvarPct legado removido — a aba Alocação da ficha agora grava em
  // fechamentos/{periodo}/vinculos/ via salvarVinculosPct, fonte única.)

  /** Cria documento em fechamentos/{periodo}/colaboradores/{slug}. */
  const criarColaborador = useCallback(async (novo: Colaborador) => {
    if (!periodoSelecionado) throw new Error('Selecione um período antes de criar.');
    if (!novo.nome_colaborador?.trim()) throw new Error('Nome obrigatório.');
    const id = novo.id ?? slug(novo.nome_colaborador);
    if (colaboradoresValidos.some(c => c.id === id || c.nome_colaborador === novo.nome_colaborador))
      throw new Error('Já existe um colaborador com esse nome no período.');
    setSalvando(true);
    try {
      // Princípio 5: id_estavel imutável gerado na criação. Propaga para
      // todos os snapshots em fechamentos/*/colaboradores/ via match.
      const id_estavel = novo.id_estavel ?? crypto.randomUUID();
      await salvarColaboradorPeriodo(periodoSelecionado, { ...novo, id, id_estavel });
      recarregar();
    }
    finally { setSalvando(false); }
  }, [periodoSelecionado, colaboradoresValidos, recarregar]);

  const excluirColaborador = useCallback(async (
    colaboradorId: string, removerFuturos: boolean,
  ): Promise<{ periodosFuturos: number }> => {
    if (!periodoSelecionado) throw new Error('Sem período selecionado.');
    setSalvando(true);
    try {
      await deletarColaboradorPeriodo(periodoSelecionado, colaboradorId);
      const periodosFuturos = removerFuturos
        ? await deletarColaboradorPeriodosFuturos(colaboradorId, periodoSelecionado) : 0;
      recarregar();
      return { periodosFuturos };
    } finally { setSalvando(false); }
  }, [periodoSelecionado, recarregar]);

  return {
    derivados: derivadosOrdenados, totais, algumSobrecarga,
    periodo: periodoSelecionado, clientes, vinculos,
    ordenacao, setOrdenarPor,
    salvarFolha, criarColaborador, excluirColaborador, salvando,
    salvarBeneficiosEmLote,
  };
}
