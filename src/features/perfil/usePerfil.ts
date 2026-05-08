// --- Hook da aba Perfil — gerencia seleção, busca e edição de clientes ---
// Usa dados do AppContext (que auto-detecta o período mais recente).

import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import { salvarClienteBase, registrarAlteracao } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { mesclarTodos } from '../../utils/dadosClienteAdapter';
import type { DadosCliente, Cliente, FuncaoAlocacao } from '../../types';

/** Campo aceito pela atribuição em lote — banker/empresário (cadastrais)
 *  + funções de alocação (responsável por função). Todos persistem em
 *  clientes_base/ via salvarClienteBase (mesmo modelo do cadastro individual). */
export type CampoAtribuicaoLote = 'banker' | 'empresario' | FuncaoAlocacao;

// Campos monitorados para histórico de alterações
const CAMPOS_MONITORADOS: (keyof Cliente)[] = [
  'receita_fee', 'pacote_servico', 'banker', 'empresario', 'data_entrada',
  'percentual_rebate_anual_onshore', 'percentual_rebate_anual_offshore',
  'aliquota_impostos_rebate',
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

  const clientesFiltrados = useMemo(() =>
    clientes
      .filter((c: DadosCliente) => c.nome_cliente.toLowerCase().includes(busca.toLowerCase()))
      .sort((a: DadosCliente, b: DadosCliente) => a.nome_cliente.localeCompare(b.nome_cliente)),
    [clientes, busca],
  );

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
    try {
      // Detectar campos alterados e registrar no histórico
      const agora = new Date().toISOString();
      const email = usuario?.email ?? 'desconhecido';
      const clienteAnterior = clienteSelecionado as unknown as Record<string, unknown>;
      const dadosNovos = dados as Record<string, unknown>;

      for (const campo of CAMPOS_MONITORADOS) {
        if (!(campo in dadosNovos)) continue;
        const anterior = clienteAnterior[campo];
        const novo = dadosNovos[campo];
        // Comparar com stringify para lidar com undefined vs absent
        if (JSON.stringify(anterior) !== JSON.stringify(novo)) {
          registrarAlteracao(clienteSelecionado.nome_cliente, {
            campo, valor_anterior: anterior ?? null, valor_novo: novo ?? null,
            alterado_em: agora, alterado_por: email,
          });
        }
      }

      // Mescla dados existentes com alterações e salva em clientes_base/
      const clienteAtualizado = { ...clienteSelecionado, ...dados } as Cliente;
      await salvarClienteBase(clienteAtualizado);
      recarregar();
      setModalAberto(false);
    } catch (e) {
      console.error('[Perfil] Erro ao salvar:', e);
    } finally {
      setSalvando(false);
    }
  }, [clienteSelecionado, recarregar, usuario]);

  const carregar = useCallback(async () => { recarregar(); }, [recarregar]);

  const atualizarCampoEmLote = useCallback(async (
    clienteIds: string[], campo: CampoAtribuicaoLote, valor: string,
  ) => {
    // Encontrar clientes pelo id e salvar em clientes_base/. Vale para
    // banker, empresário e qualquer função de alocação — o cadastro mestre.
    const clientesParaAtualizar = clientes.filter((c: DadosCliente) => c.id && clienteIds.includes(c.id));
    await Promise.all(clientesParaAtualizar.map((c: DadosCliente) => {
      const atualizado = { ...c, [campo]: valor || undefined } as Cliente;
      return salvarClienteBase(atualizado);
    }));
  }, [clientes]);

  return {
    clientes: clientesFiltrados, clienteSelecionado, selecionar,
    busca, setBusca, modalAberto, setModalAberto,
    colaboradores, parametros, salvarCliente, salvando,
    loading, periodoLabel, bankersUnicos, empresariosUnicos,
    atualizarCampoEmLote, carregar,
  };
}
