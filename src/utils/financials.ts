// --- Motor de Cálculo Financeiro ---
// Modelo de pacotes: horas_direito × fator + horas_reativas.
// Juridico e conciliação são custo direto rateado (não indireto).

import type {
  Cliente, Colaborador, CustoIndireto, DadosCliente,
  ClassificacaoCliente, DetalhesCustoDireto, LinhaMaoDeObra,
  TotaisPeriodo, ResultadoProcessamento, RegimeTributario, Parametros,
} from '../types';
import { ALIQUOTAS, HORAS_CLT_MES, FATOR_TRIBUTARIO_RECEITA, FUNCOES_ALOCACAO } from './constants';

// ============================================================
// Funções unitárias
// ============================================================

export function calcularCustoHora(colaborador: Colaborador): number {
  const custoTotal = colaborador.salario_base + colaborador.beneficios_fixos
    + colaborador.encargos_patronais + colaborador.decimo_terceiro_ferias;
  return custoTotal / HORAS_CLT_MES;
}

/** Calcula mão de obra com linhas detalhadas para o modal. */
function calcularMaoDeObra(
  cliente: Cliente,
  colaboradores: Colaborador[],
  horasPacote: Record<string, number>,
): { total: number; linhas: LinhaMaoDeObra[] } {
  if (cliente.pacote_servico === 'asset_only') return { total: 0, linhas: [] };

  const mapColab = new Map<string, Colaborador>();
  for (const c of colaboradores) mapColab.set(c.nome_colaborador, c);

  const linhas: LinhaMaoDeObra[] = [];
  let total = 0;

  for (const funcao of FUNCOES_ALOCACAO) {
    const nome = cliente[funcao] as string | undefined;
    const hDireito = horasPacote[funcao] ?? 0;
    const fatorKey = `fator_${funcao}` as keyof Cliente;
    const fator = (cliente[fatorKey] as number | undefined) ?? 0;
    const hEfet = hDireito * fator;
    if (hEfet <= 0 && !nome) continue;

    const colab = nome ? mapColab.get(nome) : undefined;
    const custoHora = colab ? calcularCustoHora(colab) : 0;
    const subtotal = hEfet * custoHora;
    total += subtotal;
    linhas.push({ funcao, responsavel: nome ?? '—', horasDireito: hDireito, fator, horasEfetivas: hEfet, custoHora, total: subtotal });
  }

  // Horas reativas
  const hReativas = cliente.horas_reativas_mes ?? 0;
  if (hReativas > 0 && cliente.consultoria_gestao) {
    const gestor = mapColab.get(cliente.consultoria_gestao);
    const custoHora = gestor ? calcularCustoHora(gestor) : 0;
    const subtotal = hReativas * custoHora;
    total += subtotal;
    linhas.push({ funcao: 'consultoria_gestao', responsavel: cliente.consultoria_gestao, horasDireito: 0, fator: 0, horasEfetivas: hReativas, custoHora, total: subtotal });
  }

  return { total, linhas };
}

function calcularHorasTotais(cliente: Cliente, horasPacote: Record<string, number>): number {
  let total = 0;
  for (const funcao of FUNCOES_ALOCACAO) {
    const hDireito = horasPacote[funcao] ?? 0;
    const fatorKey = `fator_${funcao}` as keyof Cliente;
    const fator = (cliente[fatorKey] as number | undefined) ?? 0;
    total += hDireito * fator;
  }
  total += cliente.horas_reativas_mes ?? 0;
  return total;
}

// Rebate usa SEMPRE os percentuais individuais do cliente.
// Os parâmetros globais (taxa_rebate_onshore/offshore) servem apenas como
// valor sugerido na tela de Configurações — não entram no cálculo.
export function calcularRebate(cliente: Cliente, params: Parametros): number {
  const plOn = cliente.pl_onshore ?? 0;
  const taxaOn = cliente.percentual_rebate_anual_onshore ?? 0;
  const plOff = cliente.pl_offshore ?? 0;
  const taxaOff = cliente.percentual_rebate_anual_offshore ?? 0;
  const rebateBruto = (plOn * taxaOn) / 12 + (plOff * taxaOff) / 12;
  return rebateBruto * (1 - cliente.aliquota_impostos_rebate) * params.split_plataforma;
}

export function calcularImpostos(
  receita_fee: number, regime: RegimeTributario, lucro_antes_ir?: number,
): { faturamento: number; lucro: number } {
  const impostosFat = receita_fee * ALIQUOTAS[regime].faturamento;
  let impostosLucro: number;
  if (regime === 'presumido') impostosLucro = receita_fee * ALIQUOTAS.presumido.lucro;
  else { const base = lucro_antes_ir ?? 0; impostosLucro = base > 0 ? base * ALIQUOTAS.real.lucro : 0; }
  return { faturamento: impostosFat, lucro: impostosLucro };
}

// ============================================================
// Rateio de custos indiretos — apenas tipo 'geral' + institucional
// ============================================================

function ratearCustosIndiretos(
  custos: CustoIndireto[], clientes: Cliente[], custosMaoDeObra: Map<string, number>,
): Map<string, number> {
  const resultado = new Map<string, number>();
  for (const c of clientes) resultado.set(c.nome_cliente, 0);

  // Apenas custos tipo 'geral' (juridico e conciliação agora são custo direto)
  const totalGeral = custos.filter(ci => ci.tipo_custo === 'geral').reduce((s, ci) => s + ci.valor_mensal, 0);
  if (totalGeral <= 0) return resultado;

  const somaMaoDeObra = clientes.reduce((s, c) => s + (custosMaoDeObra.get(c.nome_cliente) ?? 0), 0);
  if (somaMaoDeObra <= 0) return resultado;

  for (const c of clientes) {
    const mdo = custosMaoDeObra.get(c.nome_cliente) ?? 0;
    resultado.set(c.nome_cliente, totalGeral * (mdo / somaMaoDeObra));
  }
  return resultado;
}

// ============================================================
// Pipeline completo
// ============================================================

function classificarCliente(fee: number, rebate: number): ClassificacaoCliente {
  if (fee <= 0 && rebate > 0) return 'Pure Asset';
  if (fee > 0 && rebate <= 0) return 'Fee';
  return 'Híbrido';
}

export function processarDados(
  clientes: Cliente[], colaboradores: Colaborador[], custos: CustoIndireto[],
  regime: RegimeTributario, params: Parametros, periodo = '',
): ResultadoProcessamento {
  const horasPacoteAtual = params.horas_pacote;

  // 1. Denominadores para rateio de jurídico e conciliação
  const totalPesoJuridico = clientes
    .filter(c => c.utiliza_servico_juridico)
    .reduce((s, c) => s + (c.peso_juridico ?? 1.0), 0);
  const totalVolumeConciliacao = clientes
    .filter(c => c.pacote_servico === 'full' && (c.volume_movimentos_mes ?? 0) > 0)
    .reduce((s, c) => s + (c.volume_movimentos_mes ?? 0), 0);

  // 2. Custo de mão de obra por cliente (para rateio de indiretos)
  const custosMaoDeObra = new Map<string, number>();
  const detalhesMap = new Map<string, DetalhesCustoDireto>();

  for (const cliente of clientes) {
    const hp = horasPacoteAtual[cliente.pacote_servico] ?? horasPacoteAtual.light;
    const mdo = calcularMaoDeObra(cliente, colaboradores, hp);

    // Jurídico rateado por peso
    let custoJuridico = 0;
    if (cliente.utiliza_servico_juridico && totalPesoJuridico > 0) {
      custoJuridico = params.custo_juridico_mensal * ((cliente.peso_juridico ?? 1.0) / totalPesoJuridico);
    }

    // Conciliação rateada por volume (só pacote full)
    let custoConciliacao = 0;
    if (cliente.pacote_servico === 'full' && totalVolumeConciliacao > 0) {
      const vol = cliente.volume_movimentos_mes ?? 0;
      if (vol > 0) custoConciliacao = params.custo_conciliacao_mensal * (vol / totalVolumeConciliacao);
    }

    const contabilidade = cliente.custo_contabilidade_dedicado ?? 0;
    const pagamento = cliente.custo_pagamento_dedicado ?? 0;
    const administrativo = cliente.custo_administrativo_dedicado ?? 0;

    const totalDireto = mdo.total + custoJuridico + custoConciliacao + contabilidade + pagamento + administrativo;

    custosMaoDeObra.set(cliente.nome_cliente, mdo.total);
    detalhesMap.set(cliente.nome_cliente, {
      maoDeObra: mdo.total, juridico: custoJuridico, conciliacao: custoConciliacao,
      contabilidade, pagamento, administrativo, total: totalDireto, linhasMaoDeObra: mdo.linhas,
    });
  }

  // 3. Custo institucional + rateio indireto (apenas tipo 'geral')
  const custoInstitucionalTotal = colaboradores
    .filter(c => c.alocavel)
    .reduce((soma, c) => soma + (c.custo_total_mensal * c.percentual_institucional), 0);

  const custosGeralComInstitucional: CustoIndireto[] = [
    ...custos.filter(ci => ci.tipo_custo === 'geral'),
    { descricao_custo: 'Custo Institucional (Folha)', valor_mensal: custoInstitucionalTotal, tipo_custo: 'geral' },
  ];

  const custosIndiretos = ratearCustosIndiretos(custosGeralComInstitucional, clientes, custosMaoDeObra);

  // 4. Processar cada cliente
  const dados: DadosCliente[] = clientes.map(cliente => {
    const fee = cliente.receita_fee ?? 0;
    const rebate = calcularRebate(cliente, params);
    const receitaBruta = fee + rebate;
    const detalhe = detalhesMap.get(cliente.nome_cliente)!;

    // Custo direto = mão de obra + jurídico + conciliação
    const custoDireto = detalhe.maoDeObra + detalhe.juridico + detalhe.conciliacao;
    // Custo dedicado = contabilidade + pagamento + administrativo
    const custoDedicado = detalhe.contabilidade + detalhe.pagamento + detalhe.administrativo;
    const custoIndireto = custosIndiretos.get(cliente.nome_cliente) ?? 0;
    const custoTotal = custoDireto + custoDedicado + custoIndireto;

    const impostosFat = fee * ALIQUOTAS[regime].faturamento;
    const margemContribuicao = receitaBruta - impostosFat - custoDireto - custoDedicado;
    const ebitda = margemContribuicao - custoIndireto;
    const { lucro: impostosLucro } = calcularImpostos(fee, regime, ebitda);
    const margem = receitaBruta > 0 ? ebitda / receitaBruta : 0;
    const hp = horasPacoteAtual[cliente.pacote_servico] ?? horasPacoteAtual.light;

    return {
      ...cliente, receita_fee_mensal: fee, receita_rebate: rebate, receita_bruta: receitaBruta,
      custo_direto: custoDireto, custo_dedicado: custoDedicado, custo_indireto_rateado: custoIndireto,
      custo_total: custoTotal, impostos_faturamento: impostosFat, impostos_lucro: impostosLucro,
      margem_contribuicao: margemContribuicao, ebitda, margem,
      classificacao: classificarCliente(fee, rebate),
      horas_totais: calcularHorasTotais(cliente, hp),
      custo_direto_detalhe: detalhe,
    };
  });

  // 5. Totais
  const totais: TotaisPeriodo = {
    receita_bruta_total: 0, receita_fee_total: 0, receita_rebate_total: 0,
    custo_direto_total: 0, custo_dedicado_total: 0, custo_indireto_total: 0,
    impostos_faturamento_total: 0, impostos_lucro_total: 0,
    margem_contribuicao_total: 0, ebitda_total: 0, margem_media: 0,
    total_clientes: dados.length, clientes_positivos: 0, clientes_negativos: 0,
  };
  for (const d of dados) {
    totais.receita_bruta_total += d.receita_bruta;
    totais.receita_fee_total += d.receita_fee_mensal;
    totais.receita_rebate_total += d.receita_rebate;
    totais.custo_direto_total += d.custo_direto;
    totais.custo_dedicado_total += d.custo_dedicado;
    totais.custo_indireto_total += d.custo_indireto_rateado;
    totais.impostos_faturamento_total += d.impostos_faturamento;
    totais.impostos_lucro_total += d.impostos_lucro;
    totais.margem_contribuicao_total += d.margem_contribuicao;
    totais.ebitda_total += d.ebitda;
    if (d.ebitda >= 0) totais.clientes_positivos++; else totais.clientes_negativos++;
  }
  totais.margem_media = totais.receita_bruta_total > 0 ? totais.ebitda_total / totais.receita_bruta_total : 0;

  return {
    dados, totais, colaboradores, custosIndiretos: custosGeralComInstitucional,
    parametros: params, metadata: { periodo, regime, processado_em: new Date() },
  };
}

// ============================================================
// Funções auxiliares
// ============================================================

export function calcularPrecoVenda(custoTotal: number, margemDesejada: number): number | null {
  const denominador = FATOR_TRIBUTARIO_RECEITA - margemDesejada;
  if (denominador <= 0) return null;
  return custoTotal / denominador;
}

export function calcularBreakeven(custoTotal: number): number {
  return custoTotal / FATOR_TRIBUTARIO_RECEITA;
}

// ── Poupança — Tombamento ──────────────────────────────────────────────
import type { RegistroPoupanca } from '../types';

/** NNM líquido de tombamento (portabilidade). */
export function nnmPoupancaLiquida(registro: RegistroPoupanca): number {
  return (registro.aporte_mes_total ?? 0) - (registro.nnm_tombamento ?? 0);
}
