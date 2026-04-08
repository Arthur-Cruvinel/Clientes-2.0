// --- Hook da Visão Geral ---
// Consome dados processados via AppContext. Gerencia estado dos modais de detalhamento.

import { useMemo, useState, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import type { DadosCliente } from '../../types';

interface ModalState {
  tipo: 'custo_direto' | 'custo_indireto' | 'impostos';
  cliente: DadosCliente;
}

export function useVisaoGeral() {
  const { dadosPeriodo, loading, regime } = useApp();

  const clientes = dadosPeriodo?.dados ?? [];
  const totais = dadosPeriodo?.totais ?? null;
  const colaboradores = dadosPeriodo?.colaboradores ?? [];
  const custosIndiretos = dadosPeriodo?.custosIndiretos ?? [];

  const clientesAtivos = useMemo(() =>
    clientes.filter(c =>
      c.receita_fee > 0 || c.pl_onshore > 0 || (c.pl_offshore ?? 0) > 0
    ).length,
    [clientes],
  );

  const [modal, setModal] = useState<ModalState | null>(null);

  const abrirCustoDireto = useCallback((c: DadosCliente) => {
    setModal({ tipo: 'custo_direto', cliente: c });
  }, []);

  const abrirCustoIndireto = useCallback((c: DadosCliente) => {
    setModal({ tipo: 'custo_indireto', cliente: c });
  }, []);

  const abrirImpostos = useCallback((c: DadosCliente) => {
    setModal({ tipo: 'impostos', cliente: c });
  }, []);

  const fecharModal = useCallback(() => setModal(null), []);

  return {
    clientes, clientesAtivos, totais, loading, regime,
    colaboradores, custosIndiretos,
    modal, abrirCustoDireto, abrirCustoIndireto, abrirImpostos, fecharModal,
  };
}
