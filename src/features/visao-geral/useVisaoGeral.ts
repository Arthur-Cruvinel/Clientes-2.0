// --- Hook da Visão Geral ---
// Consome dados processados via AppContext. Gerencia estado dos modais de detalhamento.

import { useMemo, useState, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import { mesclarTodos, type DadosClienteComPoupanca } from '../../utils/dadosClienteAdapter';

// PL é injetado no merge a partir do RegistroPoupanca do período (CLAUDE.md).
type DadosCliente = DadosClienteComPoupanca;

interface ModalState {
  tipo: 'custo_direto' | 'custo_dedicado' | 'custo_indireto' | 'impostos';
  cliente: DadosCliente;
}

export function useVisaoGeral() {
  const { dadosPeriodo, loading, regime } = useApp();

  // Tabela e modais consomem cadastro + DRE + PL — mescla via adapter.
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
  const totais = dadosPeriodo?.totais ?? null;
  const colaboradores = dadosPeriodo?.colaboradores ?? [];
  const custosIndiretos = dadosPeriodo?.custosIndiretos ?? [];

  const clientesAtivos = useMemo(() =>
    clientes.filter((c: DadosCliente) =>
      c.receita_fee > 0
      || (c.pl_onshore ?? 0) > 0
      || (c.pl_offshore ?? 0) > 0
      || c.receita_rebate > 0
    ).length,
    [clientes],
  );

  const [modal, setModal] = useState<ModalState | null>(null);

  const abrirCustoDireto = useCallback((c: DadosCliente) => {
    setModal({ tipo: 'custo_direto', cliente: c });
  }, []);

  const abrirCustoDedicado = useCallback((c: DadosCliente) => {
    setModal({ tipo: 'custo_dedicado', cliente: c });
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
    modal, abrirCustoDireto, abrirCustoDedicado, abrirCustoIndireto, abrirImpostos, fecharModal,
  };
}
