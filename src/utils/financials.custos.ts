// --- Custo direto, indireto e institucional (Fase 2) ---
// Modelo CLAUDE.md: custo direto = pct_dedicado × percentual_alocavel × custo_total_mensal.
// Custo institucional entra no pool de indiretos gerais. Pure asset não rateia.

import type { Cliente, Colaborador, CustoIndireto, FuncaoAlocacao, ResultadoFolha, ResultadoReajuste } from '../types';
import {
  FUNCOES_ALOCACAO, HORAS_CLT_MES, HORAS_PACOTE,
  HORAS_PRODUTIVAS_POR_LOCALIDADE,
  TABELA_INSS, TABELA_IRRF, REDUTOR_IR_2026, DEDUCAO_DEPENDENTE_IRRF,
  ANO_FOLHA_VIGENTE,
} from './constants';

// ============================================================
// Tabelas progressivas — INSS e IRRF
// ============================================================

/** INSS progressivo por faixas. Para salário acima do último teto da tabela
 *  retorna o INSS-teto naturalmente — a tabela não tem faixa Infinity. */
function calcularINSS(salarioBruto: number, ano: number): number {
  const tabela = TABELA_INSS[ano] ?? TABELA_INSS[2026];
  let inss = 0;
  let baseAnterior = 0;
  for (const faixa of tabela) {
    if (salarioBruto <= 0) break;
    const limiteAtual = Math.min(salarioBruto, faixa.ate);
    const baseNaFaixa = Math.max(0, limiteAtual - baseAnterior);
    inss += baseNaFaixa * faixa.aliquota;
    baseAnterior = faixa.ate;
    if (salarioBruto <= faixa.ate) break;
  }
  return Math.round(inss * 100) / 100;
}

/** IRRF com dedução por dependentes + redutor adicional 2026 (renda ≤ 7.350). */
function calcularIRRF(salarioBruto: number, inss: number, qtdDep: number, ano: number): number {
  const tabela = TABELA_IRRF[ano] ?? TABELA_IRRF[2026];
  const deducaoDep = DEDUCAO_DEPENDENTE_IRRF[ano] ?? 189.59;
  const baseCalculo = salarioBruto - inss - (qtdDep * deducaoDep);
  if (baseCalculo <= 0) return 0;

  let irrf = 0;
  for (const faixa of tabela) {
    if (baseCalculo <= faixa.ate) {
      irrf = baseCalculo * faixa.aliquota - faixa.deducao;
      break;
    }
  }
  irrf = Math.max(0, irrf);
  if (ano === 2026) irrf = Math.max(0, irrf - REDUTOR_IR_2026.formula(salarioBruto));
  return Math.round(irrf * 100) / 100;
}

// ============================================================
// Histórico de reajustes — busca do teto vigente para o período
// ============================================================

/** Retorna o teto e líquido acordado vigentes para o período informado.
 *  Sem histórico → fallback p/ os campos diretos (retrocompatibilidade).
 *  Com histórico → entrada com vigencia <= periodo mais recente.
 *  Se nenhuma vigencia <= periodo (caso raro: período anterior à 1ª entrada),
 *  usa a entrada mais antiga. */
export function buscarTetoPorPeriodo(
  colaborador: Colaborador,
  periodo: string,
): ResultadoReajuste {
  if (!colaborador.historico_reajustes || colaborador.historico_reajustes.length === 0) {
    return {
      salario_teto_cargo: colaborador.salario_teto_cargo,
      liquido_acordado: colaborador.liquido_acordado ?? 0,
      vigencia: periodo,
      fonte: 'direto',
    };
  }

  const ordenado = [...colaborador.historico_reajustes]
    .sort((a, b) => a.vigencia.localeCompare(b.vigencia));

  let resultado = ordenado[0];  // fallback: primeira entrada (período anterior à 1ª vigência)
  for (const r of ordenado) {
    if (r.vigencia <= periodo) resultado = r;
    else break;
  }

  return {
    salario_teto_cargo: resultado.salario_teto_cargo,
    liquido_acordado: resultado.liquido_acordado,
    vigencia: resultado.vigencia,
    fonte: 'historico',
  };
}

// ============================================================
// Folha mensal completa
// ============================================================

export interface CustoColaboradorCalculado { custo_total_mensal: number; custo_hora: number; }

/** Folha mensal completa com auditoria do PLR (CLT) ou cálculo simplificado
 *  (pro_labore). Para CLT: complemento PLR = max(0, líquido_acordado − líquido
 *  gerado pelo teto). Reflexos PLR = complemento × 1,3333 / 12 (13º + 1/3 férias).
 *  Se `periodo` informado e o colaborador tem historico_reajustes, usa o teto
 *  vigente naquele mês (buscarTetoPorPeriodo). Sem período: usa campos diretos. */
export function calcularFolhaColaborador(
  c: Colaborador,
  ano = ANO_FOLHA_VIGENTE,
  periodo?: string,
): ResultadoFolha {
  const horasProd = HORAS_PRODUTIVAS_POR_LOCALIDADE[c.localidade ?? 'SP'] ?? HORAS_PRODUTIVAS_POR_LOCALIDADE.SP;

  if (c.tipo_vinculo === 'pro_labore') {
    // Pro-labore: sem PLR, sem 13º/férias; encargo simplificado 20% INSS patronal.
    // Histórico de reajustes não se aplica — pro_labore usa salario_base direto.
    const base = c.salario_base ?? 0;
    const encargos = base * 0.20;
    const custoMensal = base + (c.beneficios_fixos ?? 0) + encargos;
    return {
      salario_teto_cargo: 0, liquido_acordado: 0, qtd_dependentes: 0,
      inss: 0, irrf: 0, redutor_ir_2026: 0, irrf_liquido: 0,
      liquido_do_teto: 0, complemento_plr: 0, reflexos_plr_mensal: 0,
      encargos_patronais: encargos, decimo_terceiro_ferias: 0,
      custo_total_mensal: custoMensal, custo_hora: (custoMensal * 12) / horasProd,
    };
  }

  // CLT — resolve teto/líquido vigentes (histórico ou fallback direto).
  const reajuste = periodo
    ? buscarTetoPorPeriodo(c, periodo)
    : { salario_teto_cargo: c.salario_teto_cargo ?? 0, liquido_acordado: c.liquido_acordado ?? 0,
        vigencia: '', fonte: 'direto' as const };
  const teto = reajuste.salario_teto_cargo;
  const liquidoAcordado = reajuste.liquido_acordado;
  const qtdDep = c.qtd_dependentes ?? 0;

  const inss = calcularINSS(teto, ano);
  const irrf = calcularIRRF(teto, inss, qtdDep, ano);
  const redutor = ano === 2026 ? REDUTOR_IR_2026.formula(teto) : 0;
  const irrfLiquido = irrf;
  const liquidoDoTeto = teto - inss - irrfLiquido;
  const complementoPLR = Math.max(0, liquidoAcordado - liquidoDoTeto);
  const reflexosPLR = (complementoPLR / 12) * (4 / 3);  // 13º proporcional + 1/3 férias
  const encargos = teto * 0.28;
  const decimoFerias = (teto / 12) * (4 / 3);
  const custoMensal = teto + (c.beneficios_fixos ?? 0) + encargos + decimoFerias
    + complementoPLR + reflexosPLR;

  return {
    salario_teto_cargo: teto, liquido_acordado: liquidoAcordado, qtd_dependentes: qtdDep,
    inss, irrf: irrfLiquido, redutor_ir_2026: redutor, irrf_liquido: irrfLiquido,
    liquido_do_teto: liquidoDoTeto, complemento_plr: complementoPLR, reflexos_plr_mensal: reflexosPLR,
    encargos_patronais: encargos, decimo_terceiro_ferias: decimoFerias,
    custo_total_mensal: custoMensal, custo_hora: (custoMensal * 12) / horasProd,
  };
}

/** Compatibilidade — wrapper enxuto para callers que só precisam de custo total e custo/hora.
 *  Se `periodo` informado, deriva o ano e repassa para resolver o teto vigente. */
export function calcularCustoColaborador(
  c: Colaborador,
  periodo?: string,
): CustoColaboradorCalculado {
  const ano = periodo ? parseInt(periodo.split('-')[0]) : ANO_FOLHA_VIGENTE;
  const r = calcularFolhaColaborador(c, ano, periodo);
  return { custo_total_mensal: r.custo_total_mensal, custo_hora: r.custo_hora };
}

/** Custo direto do cliente: Σ por função de pct × percentual_alocavel × custo_total_mensal.
 *
 *  Lookup do colaborador é tolerante a variações de grafia: tenta match exato
 *  primeiro; cai em match normalizado (sem acento, lowercase, espaços
 *  colapsados) quando o nome salvo no cliente difere do cadastro
 *  (ex: "Flavia Santos" → "Flávia Santos Romeu"). Evita zerar o custo
 *  direto por mismatch de grafia. */
export function calcularCustoDireto(cliente: Cliente, colaboradores: Colaborador[]): number {
  // Só pure asset genuíno (sem serviço prestado) tem custo direto zero.
  // Clientes com fee isento por volume/cortesia (receita_fee = 0 mas pacote ≠ asset_only)
  // continuam consumindo estrutura — custo direto deve ser calculado normalmente.
  if (cliente.pacote_servico === 'asset_only') return 0;

  const normalize = (s: string): string =>
    s.normalize('NFD')
     .replace(/[̀-ͯ]/g, '')   // remove acentos (combining marks)
     .toLowerCase()
     .trim()
     .replace(/\s+/g, ' ');             // colapsa espaços múltiplos

  // Mapa primário: nome exato (prioridade — match preferido).
  const mapExato = new Map<string, Colaborador>();
  // Mapa secundário: nome normalizado (fallback p/ tolerância).
  const mapNorm = new Map<string, Colaborador>();
  for (const c of colaboradores) {
    mapExato.set(c.nome_colaborador, c);
    mapNorm.set(normalize(c.nome_colaborador), c);
  }

  // Acumulador p/ relatório consolidado dos nomes a corrigir via Atribuição
  // em Lote ao final desta passada.
  const naoEncontrados: Array<{ cliente: string; funcao: string; nome: string }> = [];

  let total = 0;
  for (const funcao of FUNCOES_ALOCACAO) {
    const nome = cliente[funcao] as string | undefined;
    if (!nome) continue;
    const colab = mapExato.get(nome) ?? mapNorm.get(normalize(nome));
    if (!colab) {
      console.warn(
        `[CustoDireto] Colaborador não encontrado: "${nome}"`,
        `cliente: ${cliente.nome_cliente}`,
        `função: ${funcao}`,
        '— verificar se nome no cliente bate com cadastro',
      );
      naoEncontrados.push({ cliente: cliente.nome_cliente, funcao, nome });
      continue;
    }

    const pctKey = `pct_${funcao}` as keyof Cliente;
    const pct = (cliente[pctKey] as number | undefined) ?? 0;
    if (pct <= 0) continue;

    total += colab.custo_total_mensal * colab.percentual_alocavel * pct;
  }
  // Fator de sobrecarga é monitorado por colaborador (calcularFatorSobrecarga).
  if (total > 0) console.log(`[CustoDireto] ${cliente.nome_cliente}: custo=${total.toFixed(2)}`);
  // Relatório consolidado: facilita identificar quais clientes precisam de
  // reatribuição via Perfil → Atribuição em Lote.
  if (naoEncontrados.length > 0) {
    console.warn(
      '[CustoDireto] Nomes a corrigir via Atribuição em Lote:\n'
      + naoEncontrados.map(n => `${n.cliente} → ${n.funcao}: "${n.nome}"`).join('\n'),
    );
  }
  return total;
}


/** Indicador de escopo por função: pct_real / pct_normativo. Não entra no custo. */
export function calcularFatoresEscopo(cliente: Cliente): Record<FuncaoAlocacao, number> {
  const fatores = {} as Record<FuncaoAlocacao, number>;
  // Mesmo gate de calcularCustoDireto: pure asset genuíno não tem fatores.
  // fee_isento (fee=0 mas pacote real) ainda consome estrutura → calcula fatores.
  if (cliente.pacote_servico === 'asset_only') {
    for (const f of FUNCOES_ALOCACAO) fatores[f] = 0;
    return fatores;
  }
  const horasPacote = HORAS_PACOTE[cliente.pacote_servico];
  for (const funcao of FUNCOES_ALOCACAO) {
    const pctNormativo = (horasPacote?.[funcao] ?? 0) / HORAS_CLT_MES;
    const pctReal = (cliente[`pct_${funcao}` as keyof Cliente] as number | undefined) ?? 0;
    fatores[funcao] = pctNormativo > 0 ? pctReal / pctNormativo : 0;
  }
  return fatores;
}

/** Pool institucional: Σ custo_total_mensal × percentual_institucional. Vai p/ rateio geral. */
export function calcularCustoInstitucional(colaboradores: Colaborador[]): number {
  return colaboradores.reduce(
    (s, c) => s + c.custo_total_mensal * c.percentual_institucional, 0,
  );
}

/** Soma somente itens de um tipo específico do array de custos indiretos. */
function somarPorTipo(custos: CustoIndireto[], tipo: CustoIndireto['tipo_custo']): number {
  return custos.filter(ci => ci.tipo_custo === tipo).reduce((s, ci) => s + ci.valor_mensal, 0);
}

/** Rateio dos três pools (geral, jurídico, conciliação) para um cliente. */
export function calcularCustosIndiretos(
  cliente: Cliente,
  custoDiretoCliente: number,
  todosClientes: Cliente[],
  todosCustosDiretos: Record<string, number>,
  custosIndiretos: CustoIndireto[],
  colaboradores: Colaborador[],
): number {
  // Pool geral = itens 'geral' + custo institucional. Rateio proporcional ao custo direto.
  // Pure asset (custo direto = 0) é EXCLUÍDO do rateio.
  const poolGeral = somarPorTipo(custosIndiretos, 'geral')
    + calcularCustoInstitucional(colaboradores);

  const somaCustoDireto = todosClientes.reduce(
    (s, c) => s + Math.max(0, todosCustosDiretos[c.nome_cliente] ?? 0), 0,
  );

  let parcelaGeral = 0;
  if (custoDiretoCliente > 0 && somaCustoDireto > 0) {
    parcelaGeral = poolGeral * (custoDiretoCliente / somaCustoDireto);
  }

  // Jurídico: rateado por peso_juridico entre clientes com utiliza_servico_juridico.
  let parcelaJuridico = 0;
  if (cliente.utiliza_servico_juridico) {
    const totalJuridico = somarPorTipo(custosIndiretos, 'juridico');
    const totalPesos = todosClientes
      .filter(c => c.utiliza_servico_juridico)
      .reduce((s, c) => s + (c.peso_juridico ?? 1.0), 0);
    if (totalPesos > 0) {
      parcelaJuridico = totalJuridico * ((cliente.peso_juridico ?? 1.0) / totalPesos);
    }
  }

  // Conciliação: rateado por volume_movimentos_mes entre clientes com utiliza_conciliacao.
  let parcelaConciliacao = 0;
  if (cliente.utiliza_conciliacao && (cliente.volume_movimentos_mes ?? 0) > 0) {
    const totalConciliacao = somarPorTipo(custosIndiretos, 'conciliacao');
    const totalVolume = todosClientes
      .filter(c => c.utiliza_conciliacao && (c.volume_movimentos_mes ?? 0) > 0)
      .reduce((s, c) => s + (c.volume_movimentos_mes ?? 0), 0);
    if (totalVolume > 0) {
      parcelaConciliacao = totalConciliacao * ((cliente.volume_movimentos_mes ?? 0) / totalVolume);
    }
  }

  return parcelaGeral + parcelaJuridico + parcelaConciliacao;
}
