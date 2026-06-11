// --- Adapter Cliente + ResultadoCliente (+ RegistroPoupanca) → DadosCliente legacy ---
// Consumidores legacy (Perfil, VisaoGeral, AgenteValidacao) esperam um único
// objeto com cadastro + DRE + PL. O motor separa em três fontes (Fase 2 + decisão
// arquitetural sobre AUM); este helper mescla sem reintroduzir nada no motor.
//
// PL vem do RegistroPoupanca do período (CLAUDE.md): a interface Cliente não
// tem mais pl_onshore/pl_offshore — eles ficam em DadosClienteComPoupanca
// como campos opcionais para consumo na UI.

import type {
  Cliente, ResultadoCliente, DadosCliente, ClassificacaoCliente, RegistroPoupanca,
} from '../types';

const PERFIL_PARA_CLASSIFICACAO: Record<ResultadoCliente['perfil'], ClassificacaoCliente> = {
  fee_based: 'Fee',
  pure_asset: 'Pure Asset',
  hibrido: 'Híbrido',
  fee_isento: 'Fee Isento',
};

/** DadosCliente enriquecido com PL do período (lido de RegistroPoupanca). */
export type DadosClienteComPoupanca = DadosCliente & {
  pl_onshore?: number;
  pl_offshore?: number;
};

export function mesclarClienteResultado(
  cliente: Cliente,
  resultado: ResultadoCliente | undefined,
  poupanca?: RegistroPoupanca,
): DadosClienteComPoupanca {
  return {
    ...cliente,
    receita_fee_mensal: cliente.receita_fee,
    receita_rebate: resultado?.receita_rebate ?? 0,
    receita_bruta: resultado?.receita_bruta ?? 0,
    custo_direto: resultado?.custo_direto ?? 0,
    custo_dedicado: resultado?.custo_dedicado ?? 0,
    custo_indireto_rateado: resultado?.custo_indireto_rateado ?? 0,
    custo_total: resultado?.custo_total ?? 0,
    impostos_faturamento: resultado?.impostos_faturamento ?? 0,
    impostos_lucro: resultado?.impostos_lucro ?? 0,
    margem_contribuicao: resultado
      ? resultado.receita_bruta - resultado.impostos_faturamento
        - resultado.custo_direto - resultado.custo_dedicado
      : 0,
    ebitda: resultado?.ebitda ?? 0,
    margem: resultado?.margem_ebitda ?? 0,
    lucro_liquido: resultado?.lucro_liquido ?? 0,
    margem_liquida: resultado?.margem_liquida ?? 0,
    classificacao: resultado ? PERFIL_PARA_CLASSIFICACAO[resultado.perfil] : 'Pure Asset',
    horas_totais: 0,
    // Detalhamento: mão de obra = custo direto agregado; jurídico/conciliação
    // agora vêm dos rateios DIRETOS do motor; dedicados manuais por componente.
    custo_direto_detalhe: {
      maoDeObra: resultado?.custo_direto ?? 0,
      juridico: resultado?.custo_dedicado_juridico ?? 0,
      conciliacao: resultado?.custo_dedicado_conciliacao ?? 0,
      contabilidade: resultado?.custo_dedicado_contabilidade ?? 0,
      pagamento: resultado?.custo_dedicado_pagamento ?? 0,
      administrativo: resultado?.custo_dedicado_administrativo ?? 0,
      viagem: resultado?.custo_dedicado_viagem ?? 0,
      total: resultado?.custo_total ?? 0,
      linhasMaoDeObra: resultado?.linhas_mao_de_obra ?? [],
    },
    pl_onshore: poupanca?.pl_onshore,
    pl_offshore: poupanca?.pl_offshore,
  };
}

export function mesclarTodos(
  clientes: Cliente[],
  resultados: ResultadoCliente[],
  registrosPoupanca: RegistroPoupanca[] = [],
): DadosClienteComPoupanca[] {
  const mapResultado = new Map(resultados.map(r => [r.nome_cliente, r]));
  const mapPoupanca = new Map(registrosPoupanca.map(p => [p.nome_cliente, p]));
  return clientes.map(c => mesclarClienteResultado(
    c, mapResultado.get(c.nome_cliente), mapPoupanca.get(c.nome_cliente),
  ));
}
