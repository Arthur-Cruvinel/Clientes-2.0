// --- Hook central do módulo Patrimônio ---

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApp } from '../../state/AppContext';
import type { Cliente } from '../../types';

export function usePatrimonio() {
  const { dadosPeriodo, loading: loadingApp } = useApp();
  const [busca, setBusca] = useState('');
  // Identidade pelo nome_cliente (único e sempre presente).
  // Usar c.id quebra com clientes Pure Asset, criados sem id no AppContext.
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [modoConsolidado, setModoConsolidado] = useState(false);

  const todosClientes: Cliente[] = dadosPeriodo?.clientes ?? [];

  const clientesFiltrados = useMemo(() =>
    todosClientes
      .filter((c: Cliente) => c.nome_cliente.toLowerCase().includes(busca.toLowerCase()))
      .sort((a: Cliente, b: Cliente) => a.nome_cliente.localeCompare(b.nome_cliente)),
  [todosClientes, busca]);

  const clienteSelecionado = useMemo(() =>
    todosClientes.find((c: Cliente) => c.nome_cliente === clienteNome) ?? null,
  [todosClientes, clienteNome]);

  // Auto-selecionar primeiro cliente quando carrega
  useEffect(() => {
    if (!clienteNome && !modoConsolidado && clientesFiltrados.length > 0) {
      setClienteNome(clientesFiltrados[0].nome_cliente);
    }
  }, [clientesFiltrados, clienteNome, modoConsolidado]);

  const selecionar = useCallback((c: Cliente) => {
    setClienteNome(c.nome_cliente);
    setModoConsolidado(false);
  }, []);

  const irParaConsolidado = useCallback(() => {
    setClienteNome(null);
    setModoConsolidado(true);
  }, []);

  // Navegação por teclado: ArrowUp/ArrowDown para trocar cliente
  const navegarCliente = useCallback((direcao: 'anterior' | 'proximo') => {
    if (modoConsolidado || clientesFiltrados.length === 0) return;
    const idx = clientesFiltrados.findIndex((c: Cliente) => c.nome_cliente === clienteNome);
    const novoIdx = direcao === 'proximo'
      ? Math.min(idx + 1, clientesFiltrados.length - 1)
      : Math.max(idx - 1, 0);
    const novo = clientesFiltrados[novoIdx];
    if (novo) setClienteNome(novo.nome_cliente);
  }, [clientesFiltrados, clienteNome, modoConsolidado]);

  return {
    clientes: clientesFiltrados,
    clienteSelecionado,
    selecionar,
    busca, setBusca,
    modoConsolidado, irParaConsolidado,
    navegarCliente,
    loading: loadingApp,
  };
}
