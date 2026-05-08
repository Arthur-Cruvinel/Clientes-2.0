// --- Hook de gerenciamento de marcações de revisão ---
// Centraliza o estado dos clientes marcados para revisão e expõe ações
// para marcar/desmarcar tanto cliente quanto mês individual.

import { useCallback, useEffect, useState } from 'react';
import {
  buscarClientesMarcados,
  definirRevisaoCliente,
  definirRevisaoMes,
} from '../../services/revisao';

export function useRevisao() {
  const [clientesMarcados, setClientesMarcados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);

  // Carregamento inicial
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    buscarClientesMarcados()
      .then(set => { if (!cancelado) setClientesMarcados(set); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, []);

  /** Verifica se um cliente está marcado pelo nome (não pelo slug). */
  const estaMarcado = useCallback((nomeCliente: string): boolean => {
    // O Set armazena slugs — convertemos o nome aqui
    const slug = nomeCliente
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    return clientesMarcados.has(slug);
  }, [clientesMarcados]);

  /** Toggle de marcação de cliente — atualização otimista, rollback em erro. */
  const toggleCliente = useCallback(async (nomeCliente: string): Promise<void> => {
    const slug = nomeCliente
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    const estavaMarcado = clientesMarcados.has(slug);
    const novoEstado = !estavaMarcado;

    // Otimista: atualiza UI imediatamente
    setClientesMarcados(prev => {
      const novo = new Set(prev);
      if (novoEstado) novo.add(slug); else novo.delete(slug);
      return novo;
    });

    try {
      await definirRevisaoCliente(nomeCliente, novoEstado);
    } catch (e) {
      console.error('[useRevisao] Erro ao salvar, revertendo:', e);
      // Rollback
      setClientesMarcados(prev => {
        const novo = new Set(prev);
        if (estavaMarcado) novo.add(slug); else novo.delete(slug);
        return novo;
      });
    }
  }, [clientesMarcados]);

  /**
   * Toggle de marcação de mês individual.
   * O mês fica em poupanca/{slug_ano_mes} no campo revisao_pendente.
   * NÃO atualiza estado local — o componente que chama deve atualizar o
   * registro local após a promise resolver (igual ao handleSalvo do detalhe).
   */
  const toggleMes = useCallback(async (
    nomeCliente: string,
    ano: number,
    mes: number,
    estadoAtual: boolean,
  ): Promise<boolean> => {
    const novoEstado = !estadoAtual;
    try {
      await definirRevisaoMes(nomeCliente, ano, mes, novoEstado);
      return novoEstado;
    } catch (e) {
      console.error('[useRevisao] Erro ao toggle mês:', e);
      throw e;
    }
  }, []);

  return {
    clientesMarcados,
    carregando,
    estaMarcado,
    toggleCliente,
    toggleMes,
  };
}
