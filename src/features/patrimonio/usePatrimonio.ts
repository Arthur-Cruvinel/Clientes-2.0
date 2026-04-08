// --- Hook central do módulo Patrimônio ---

import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import type { DadosCliente } from '../../types';

export function usePatrimonio() {
  const { dadosPeriodo, loading: loadingApp } = useApp();
  const [busca, setBusca] = useState('');
  const [clienteSlug, setClienteSlug] = useState<string | null>(null);
  const [modoConsolidado, setModoConsolidado] = useState(false);

  const todosClientes = dadosPeriodo?.dados ?? [];

  const clientesFiltrados = useMemo(() =>
    todosClientes
      .filter(c => c.nome_cliente.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => a.nome_cliente.localeCompare(b.nome_cliente)),
  [todosClientes, busca]);

  const clienteSelecionado = useMemo(() =>
    todosClientes.find(c => c.id === clienteSlug) ?? null,
  [todosClientes, clienteSlug]);

  const selecionar = useCallback((c: DadosCliente) => {
    setClienteSlug(c.id ?? null);
    setModoConsolidado(false);
  }, []);

  const irParaConsolidado = useCallback(() => {
    setClienteSlug(null);
    setModoConsolidado(true);
  }, []);

  return {
    clientes: clientesFiltrados,
    clienteSelecionado,
    selecionar,
    busca, setBusca,
    modoConsolidado, irParaConsolidado,
    loading: loadingApp,
  };
}
