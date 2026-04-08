// --- Hook da aba Perfil — gerencia seleção, busca e edição de clientes ---
// Usa dados do AppContext (que auto-detecta o período mais recente).

import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import { atualizarCliente } from '../../services/firebase';
import type { DadosCliente, Cliente } from '../../types';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function usePerfil() {
  const { dadosPeriodo, periodoSelecionado, loading, recarregar } = useApp();
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const clientes = dadosPeriodo?.dados ?? [];
  const colaboradores = dadosPeriodo?.colaboradores ?? [];
  const parametros = dadosPeriodo?.parametros ?? { horas_pacote: {} };

  // Label do período para exibição
  const periodoLabel = useMemo(() => {
    if (!periodoSelecionado) return '';
    const [a, m] = periodoSelecionado.split('-').map(Number);
    return `${MESES_LABEL[m - 1]}/${a}`;
  }, [periodoSelecionado]);

  const bankersUnicos = useMemo(() =>
    [...new Set(clientes.map(c => c.banker).filter((b): b is string => !!b))].sort(),
  [clientes]);

  const empresariosUnicos = useMemo(() =>
    [...new Set(clientes.map(c => c.empresario).filter((e): e is string => !!e))].sort(),
  [clientes]);

  const clientesFiltrados = useMemo(() =>
    clientes
      .filter(c => c.nome_cliente.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => a.nome_cliente.localeCompare(b.nome_cliente)),
    [clientes, busca],
  );

  const clienteSelecionado = useMemo(() =>
    clientes.find(c => c.id === clienteSelecionadoId) ?? null,
    [clientes, clienteSelecionadoId],
  );

  const selecionar = useCallback((c: DadosCliente) => {
    setClienteSelecionadoId(c.id ?? null);
  }, []);

  const salvarCliente = useCallback(async (dados: Partial<Cliente>) => {
    if (!clienteSelecionado?.id || !periodoSelecionado) return;
    setSalvando(true);
    try {
      await atualizarCliente(periodoSelecionado, clienteSelecionado.id, dados);
      recarregar();
      setModalAberto(false);
    } catch (e) {
      console.error('[Perfil] Erro ao salvar:', e);
    } finally {
      setSalvando(false);
    }
  }, [clienteSelecionado, periodoSelecionado, recarregar]);

  const carregar = useCallback(async () => { recarregar(); }, [recarregar]);

  const atualizarCampoEmLote = useCallback(async (
    clienteIds: string[], campo: 'banker' | 'empresario', valor: string,
  ) => {
    if (!periodoSelecionado) return;
    await Promise.all(clienteIds.map(id => atualizarCliente(periodoSelecionado, id, { [campo]: valor || undefined })));
  }, [periodoSelecionado]);

  return {
    clientes: clientesFiltrados, clienteSelecionado, selecionar,
    busca, setBusca, modalAberto, setModalAberto,
    colaboradores, parametros, salvarCliente, salvando,
    loading, periodoLabel, bankersUnicos, empresariosUnicos,
    atualizarCampoEmLote, carregar,
  };
}
