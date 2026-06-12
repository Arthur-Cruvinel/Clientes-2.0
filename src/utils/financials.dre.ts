// --- DRE completo por cliente (Fase 2) ---
// receita - imp.fat - custos = EBITDA - imp.lucro = lucro líquido.

import type {
  Cliente, Colaborador, CustoIndireto, ResultadoCliente, RegimeTributario,
  RegistroPoupanca, PacoteServico,
} from '../types';
import type { Vinculo } from '../types/vinculo';
import { ALIQUOTAS } from './constants';
import {
  calcularCustoDireto, calcularCustosIndiretos, calcularFatoresEscopo,
  calcularCustoInstitucional, detalharMaoDeObra,
} from './financials.custos';
import { calcularReceita, type AliquotasRebate } from './financials.receita';

/** asset_only é o gate definitivo de pure asset (cliente sem serviço prestado).
 *  fee_isento: cliente que usa estrutura mas teve fee descontado (cortesia/volume).
 *  Distinguir esses dois casos é crítico para análise de rentabilidade. */
function definirPerfil(
  fee: number, rebate: number, pacote: PacoteServico,
): ResultadoCliente['perfil'] {
  if (pacote === 'asset_only') return 'pure_asset';
  if (fee === 0 && rebate > 0) return 'fee_isento';
  if (fee > 0 && rebate === 0) return 'fee_based';
  if (fee > 0 && rebate > 0) return 'hibrido';
  return 'fee_based';  // fallback: sem receita nem rebate
}

function divisaoSegura(num: number, den: number): number {
  return den !== 0 ? num / den : 0;
}

export function calcularDRE(
  cliente: Cliente,
  colaboradores: Colaborador[],
  todosClientes: Cliente[],
  todosCustosDiretos: Record<string, number>,
  custosIndiretos: CustoIndireto[],
  regime: RegimeTributario,
  poupanca?: RegistroPoupanca,
  // Vínculos do período (Fase 2.5 — Peça 5). Propagados para calcularCustoDireto
  // no fallback de chamadas isoladas. Default [] = comportamento legado.
  vinculos: Vinculo[] = [],
  // Normalização de sobre-alocação (pré-passe do pipeline). Opcionais para
  // retrocompat de chamadas isoladas: sem fatorNorm → sem normalização;
  // sem poolNaoAlocado → cai no institucional puro (sem ociosidade).
  fatorNorm: Record<string, number> = {},
  poolNaoAlocado?: number,
  // Alíquotas globais de retenção do rebate por perna (parametros/global).
  // Sem isto, calcularReceita cai nos defaults constantes (nunca 0).
  aliquotasRebate?: AliquotasRebate,
): ResultadoCliente {
  const { receita_fee, receita_rebate, receita_bruta } = calcularReceita(cliente, poupanca, aliquotasRebate);
  const perfil = definirPerfil(receita_fee, receita_rebate, cliente.pacote_servico);

  const impostos_faturamento = receita_bruta * ALIQUOTAS[regime].faturamento;

  // Reaproveita o custo direto pré-calculado pelo pipeline; cai p/ cálculo
  // direto em chamadas isoladas (testes, simulador), preservando idempotência.
  const custo_direto = todosCustosDiretos[cliente.nome_cliente]
    ?? calcularCustoDireto(cliente, colaboradores, vinculos, fatorNorm);
  // Decomposição por colaborador (exposição; Σ valor ≡ custo_direto). Mesmo
  // fatorNorm/resolver do custo — nunca uma via paralela.
  const linhas_mao_de_obra = detalharMaoDeObra(cliente, colaboradores, vinculos, fatorNorm);

  // Pool não-alocado pré-computado (institucional + ociosidade). Fallback p/
  // chamadas isoladas: institucional puro (sem ociosidade — não há contexto).
  const pool = poolNaoAlocado ?? calcularCustoInstitucional(colaboradores);
  // Rateios separados por tipo. juridico/conciliacao são DIRETOS (compõem o
  // dedicado — decisão CFO); só `geral` é custo_indireto_rateado.
  const rateios = calcularCustosIndiretos(
    cliente, custo_direto, todosClientes, todosCustosDiretos,
    custosIndiretos, pool,
  );

  const custo_dedicado_contabilidade = cliente.custo_contabilidade_dedicado ?? 0;
  const custo_dedicado_pagamento = cliente.custo_pagamento_dedicado ?? 0;
  const custo_dedicado_administrativo = cliente.custo_administrativo_dedicado ?? 0;
  const custo_dedicado_viagem = cliente.custo_viagem_dedicado ?? 0;
  const custo_dedicado_juridico = rateios.juridico;
  const custo_dedicado_conciliacao = rateios.conciliacao;
  const custo_dedicado = custo_dedicado_contabilidade
    + custo_dedicado_pagamento
    + custo_dedicado_administrativo
    + custo_dedicado_viagem
    + custo_dedicado_juridico
    + custo_dedicado_conciliacao;

  const custo_indireto_rateado = rateios.geral;

  const custo_total = custo_direto + custo_dedicado + custo_indireto_rateado;
  // Margem de contribuição: ANTES do overhead rateado (≡ ebitda + custo_indireto_rateado).
  const margem_contribuicao = receita_bruta - impostos_faturamento - custo_direto - custo_dedicado;
  const ebitda = receita_bruta - impostos_faturamento - custo_total;

  // Presumido: imposto sobre receita. Real: 34% sobre EBITDA positivo.
  const impostos_lucro = regime === 'presumido'
    ? receita_bruta * ALIQUOTAS.presumido.lucro
    : Math.max(0, ebitda) * ALIQUOTAS.real.lucro;

  const lucro_liquido = ebitda - impostos_lucro;
  const fatores_escopo = calcularFatoresEscopo(cliente, vinculos);
  const algum_fator_acima_limite = Object.values(fatores_escopo).some(f => f > 1.0);

  return {
    nome_cliente: cliente.nome_cliente,
    pacote_servico: cliente.pacote_servico,
    perfil,
    receita_fee, receita_rebate, receita_bruta,
    fee_potencial: 0,  // alimentado por Propostas no futuro
    impostos_faturamento, impostos_lucro,
    custo_direto, custo_dedicado,
    custo_dedicado_contabilidade, custo_dedicado_pagamento, custo_dedicado_administrativo,
    custo_dedicado_viagem, custo_dedicado_juridico, custo_dedicado_conciliacao,
    custo_indireto_rateado, custo_total,
    linhas_mao_de_obra,
    margem_contribuicao,
    ebitda,
    margem_ebitda: divisaoSegura(ebitda, receita_bruta),
    lucro_liquido,
    margem_liquida: divisaoSegura(lucro_liquido, receita_bruta),
    fatores_escopo,
    algum_fator_acima_limite,
  };
}
