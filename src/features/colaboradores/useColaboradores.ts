// --- Hook da aba Colaboradores ---
// Calcula derivados (custo total, ocupação, status) e expõe ações de salvar.
// Fonte: AppContext.dadosPeriodo (clientes + colaboradores + período).

import { useMemo, useCallback, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useApp } from '../../state/AppContext';
import {
  salvarColaboradorPeriodo, deletarColaboradorPeriodo,
  deletarColaboradorPeriodosFuturos, resolverDocIdClientePorIdEstavel, db,
} from '../../services/firebase';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { slug } from '../../utils/slug';
import type { Colaborador, Cliente, FuncaoAlocacao } from '../../types';
import { compararDerivados, type Ordenacao } from './ordenacao';

export type StatusOcupacao = 'ok' | 'atencao' | 'sobrecarga';

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

  // Linhas fantasma (sem nome/cargo/função) ficam fora dos cálculos e da UI.
  const colaboradoresValidos = useMemo(() => todosColaboradores.filter(
    c => c.nome_colaborador?.trim() && c.cargo?.trim() && c.funcao_principal,
  ), [todosColaboradores]);

  // custo_total_mensal/custo_hora vêm enriquecidos do AppContext (single source of truth).
  const derivados = useMemo<ColaboradorDerivado[]>(() => colaboradoresValidos.map(col => {
    const funcao = normalizarFuncao(col.funcao_principal);
    let somaPctClientes = 0;
    if (funcao) {
      for (const c of clientes) {
        if ((c[funcao] as string | undefined) !== col.nome_colaborador) continue;
        somaPctClientes += (c[`pct_${funcao}` as keyof Cliente] as number | undefined) ?? 0;
      }
    }
    const ocupacao = col.percentual_alocavel > 0 ? somaPctClientes / col.percentual_alocavel : 0;
    return {
      colaborador: col,
      custoTotalMensal: col.custo_total_mensal,
      custoHora: col.custo_hora,
      custoInstitucional: col.custo_total_mensal * col.percentual_institucional,
      custoDireto: col.custo_total_mensal * col.percentual_alocavel,
      somaPctClientes, ocupacao, statusOcupacao: statusDe(ocupacao), funcao,
    };
  }), [colaboradoresValidos, clientes]);

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

  const salvarPct = useCallback(async (nomeCliente: string, funcao: FuncaoAlocacao, valor: number) => {
    if (!periodoSelecionado) return;
    const cliente = clientes.find(c => c.nome_cliente === nomeCliente);
    if (!cliente?.id) return;
    setSalvando(true);
    try {
      // Bug Arquitetural #1: cliente.id pode vir de clientes_base/ (docId=slug)
      // enquanto o snapshot do período tem docId=UUID. Antes do setDoc, resolve
      // o docId canônico do período via id_estavel — evita criar doc-sombra
      // com slug em períodos onde já existe doc UUID. Fallback para cliente.id
      // quando period não tem snapshot ainda (cliente novo).
      const docIdCanonico = await resolverDocIdClientePorIdEstavel(
        periodoSelecionado, cliente.id_estavel, cliente.id,
      );
      // setDoc com merge cria o doc se inexistente no período — robusto a
      // clientes recém-criados ou períodos sem fechamento copiado.
      await setDoc(
        doc(db, 'fechamentos', periodoSelecionado, 'clientes', docIdCanonico),
        { [`pct_${funcao}`]: valor },
        { merge: true },
      );
      recarregar();
    } finally { setSalvando(false); }
  }, [clientes, periodoSelecionado, recarregar]);

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
    periodo: periodoSelecionado, clientes,
    ordenacao, setOrdenarPor,
    salvarFolha, salvarPct, criarColaborador, excluirColaborador, salvando,
  };
}
