// --- Custo direto, indireto e institucional (Fase 2) ---
// Modelo CLAUDE.md: custo direto = pct_dedicado × custo_total_mensal.
// pct_dedicado já é fração do tempo TOTAL (Σ por colaborador = percentual_alocavel
// via calcularPctDistribuido) — não escalar de novo por percentual_alocavel.
// Custo institucional entra no pool de indiretos gerais. Pure asset não rateia.

import type { Cliente, Colaborador, CustoIndireto, FuncaoAlocacao, LinhaMaoDeObra, ResultadoFolha, ResultadoReajuste } from '../types';
import type { Vinculo } from '../types/vinculo';
import {
  FUNCOES_ALOCACAO, HORAS_CLT_MES, HORAS_PACOTE,
  HORAS_PRODUTIVAS_POR_LOCALIDADE,
  TABELA_INSS, TABELA_IRRF, REDUTOR_IR_2026, DEDUCAO_DEPENDENTE_IRRF,
  ANO_FOLHA_VIGENTE,
} from './constants';
import { horasEfetivasMensais, pctEfetivoFuncao } from './financials.alocacao';

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

  // Estagiário (Lei 11.788/2008): sem encargos patronais, sem 13º/férias,
  // sem PLR, sem INSS/IRRF (bolsa isenta). Custo total = bolsa + benefícios.
  // Cast temporário: `tipo_vinculo` ainda é 'clt' | 'pro_labore' no tipo
  // (sub-etapa 2A.5.b vai alargar para incluir 'estagio' formalmente).
  if ((c.tipo_vinculo as string) === 'estagio') {
    const base = c.salario_base ?? 0;
    const custoMensal = base + (c.beneficios_fixos ?? 0);
    return {
      salario_teto_cargo: 0, liquido_acordado: 0, qtd_dependentes: 0,
      inss: 0, irrf: 0, redutor_ir_2026: 0, irrf_liquido: 0,
      liquido_do_teto: base, complemento_plr: 0, reflexos_plr_mensal: 0,
      encargos_patronais: 0, decimo_terceiro_ferias: 0,
      custo_total_mensal: custoMensal, custo_hora: (custoMensal * 12) / horasProd,
    };
  }

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

// ============================================================
// Resolução cliente×função → colaborador (Fase 2.5 — Peça 5)
// ============================================================

/** Resolve `(cliente, funcao)` em `(colaborador, pct, fonte)` via leitura dual:
 *
 *    1. Tenta resolver via vínculo (fechamentos/{periodo}/vinculos/) — se houver
 *       vínculo para esse (cliente, função) com `pct > 0`, usa o colaborador
 *       referenciado por `id_estavel_colaborador`.
 *    2. Fallback: comportamento legado — lê o nome do colaborador no campo
 *       `cliente[funcao]` (ex: `cliente.consultoria_gestao = "Arthur Cruvinel"`)
 *       e o pct em `cliente.pct_${funcao}`. Match tolerante a grafia.
 *
 *  Condição de migração automática para vínculos: basta o pct ser > 0 num
 *  vínculo. Hoje (pré-Peça 6) todos os 860 vínculos têm pct=0 → fallback sempre
 *  dispara → comportamento idêntico ao legado. Quando Peça 6 popular pct via
 *  Alocação em Lote, esse cliente×função migra para o vínculo sem nenhuma
 *  alteração de código adicional.
 *
 *  Retorno: { colaborador, pct, fonte }. fonte indica a origem do dado para
 *  logging/debug — não é exposta na UI nesta peça. */
function resolverColaboradorParaFuncao(
  cliente: Cliente,
  funcao: FuncaoAlocacao,
  vinculos: Vinculo[],
  mapExato: Map<string, Colaborador>,
  mapNorm: Map<string, Colaborador>,
  mapPorIdEstavel: Map<string, Colaborador>,
  normalize: (s: string) => string,
): { colaborador: Colaborador | null; pct: number; fonte: 'vinculo' | 'cliente' } {
  // 1) Vínculo com pct > 0 para esse (cliente, função).
  // id_estavel_cliente do vínculo bate com cliente.id_estavel.
  // Match estrito: id_estavel não tem normalização — é UUID.
  if (cliente.id_estavel) {
    const vinculo = vinculos.find(v =>
      v.id_estavel_cliente === cliente.id_estavel
      && v.funcao === funcao
      && v.pct > 0,
    );
    if (vinculo) {
      const colab = mapPorIdEstavel.get(vinculo.id_estavel_colaborador) ?? null;
      if (colab) {
        return { colaborador: colab, pct: vinculo.pct, fonte: 'vinculo' };
      }
      // id_estavel não encontrado em colaboradores_base/ (ex: 'vinicius_rodrigues_ex'
      // — placeholder intencional da migração da Peça 2). Logar e cair no fallback.
      console.warn(
        `[CustoDireto] Vínculo com id_estavel_colaborador não encontrado em colaboradores: `
        + `"${vinculo.id_estavel_colaborador}" `
        + `(cliente: ${cliente.nome_cliente}, função: ${funcao}). Fallback p/ campo do cliente.`,
      );
    }
  }

  // 2) Fallback — comportamento legado: nome no campo do cliente.
  const nome = cliente[funcao] as string | undefined;
  if (!nome) return { colaborador: null, pct: 0, fonte: 'cliente' };
  const colab = mapExato.get(nome) ?? mapNorm.get(normalize(nome));
  const pctKey = `pct_${funcao}` as keyof Cliente;
  const pct = (cliente[pctKey] as number | undefined) ?? 0;
  return { colaborador: colab ?? null, pct, fonte: 'cliente' };
}

/** Custo direto do cliente: Σ por função de pct × custo_total_mensal.
 *
 *  Leitura dual (Fase 2.5 — Peça 5): tenta resolver colaborador via vínculos
 *  com pct > 0 primeiro; senão, fallback no campo do cliente (comportamento
 *  legado). `vinculos` é opcional (default []) para retrocompat com chamadas
 *  isoladas (testes, simulador, debug).
 *
 *  Lookup do colaborador no fallback é tolerante a variações de grafia:
 *  tenta match exato; cai em match normalizado (sem acento, lowercase, espaços
 *  colapsados) quando o nome salvo no cliente difere do cadastro
 *  (ex: "Flavia Santos" → "Flávia Santos Romeu"). */
export function calcularCustoDireto(
  cliente: Cliente,
  colaboradores: Colaborador[],
  vinculos: Vinculo[] = [],
  // Fator de normalização por colaborador (id_estavel → fator). Quando o
  // colaborador está sobre-alocado (Σpct>alocavel), seu pct é escalado por
  // alocavel/Σpct → distribui no máximo 100% do custo real. Ausência de mapa
  // (ou colaborador fora dele) = fator 1 = SEM normalização — é o caso das
  // chamadas ISOLADAS (simulador/what-if mono-cliente), que não têm o contexto
  // cross-cliente da normalização. NÃO "consertar": é intencional.
  fatorNormPorColab: Record<string, number> = {},
): number {
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
  // Mapa terciário: por id_estavel — usado pela resolução via vínculo.
  const mapPorIdEstavel = new Map<string, Colaborador>();
  for (const c of colaboradores) {
    mapExato.set(c.nome_colaborador, c);
    mapNorm.set(normalize(c.nome_colaborador), c);
    if (c.id_estavel) mapPorIdEstavel.set(c.id_estavel, c);
  }

  // Acumulador p/ relatório consolidado dos nomes a corrigir via Atribuição
  // em Lote ao final desta passada.
  const naoEncontrados: Array<{ cliente: string; funcao: string; nome: string }> = [];

  let total = 0;
  let usouVinculo = false;
  for (const funcao of FUNCOES_ALOCACAO) {
    const { colaborador: colab, pct, fonte } = resolverColaboradorParaFuncao(
      cliente, funcao, vinculos, mapExato, mapNorm, mapPorIdEstavel, normalize,
    );
    if (!colab) {
      // Só registra warning se o fallback chegou ao ponto de procurar nome
      // (vínculo não cobriu) E o nome existia no cliente.
      if (fonte === 'cliente') {
        const nome = cliente[funcao] as string | undefined;
        if (nome) {
          console.warn(
            `[CustoDireto] Colaborador não encontrado: "${nome}"`,
            `cliente: ${cliente.nome_cliente}`,
            `função: ${funcao}`,
            '— verificar se nome no cliente bate com cadastro',
          );
          naoEncontrados.push({ cliente: cliente.nome_cliente, funcao, nome });
        }
      }
      continue;
    }
    if (pct <= 0) continue;
    if (fonte === 'vinculo') usouVinculo = true;
    // pct já representa fração do tempo total do colaborador dedicada a este
    // cliente — não escalar por percentual_alocavel (que já está incorporado
    // no pct via calcularPctDistribuido). fatorNorm escala os pcts a pesos
    // quando o colaborador está sobre-alocado (≤1; fallback 1 = sem mudança).
    const fatorNorm = fatorNormPorColab[colab.id_estavel ?? ''] ?? 1;
    total += colab.custo_total_mensal * pct * fatorNorm;
  }
  // Fator de sobrecarga é monitorado por colaborador (calcularFatorSobrecarga).
  if (total > 0) {
    console.log(
      `[CustoDireto] ${cliente.nome_cliente}: custo=${total.toFixed(2)}`
      + (usouVinculo ? ' (fonte: vinculo)' : ''),
    );
  }
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

/** Decompõe o custo_direto do cliente por colaborador — EXPOSIÇÃO, não recálculo.
 *  Espelha EXATAMENTE o laço de calcularCustoDireto (mesmo resolverColaborador-
 *  ParaFuncao por id_estavel + mesmo fatorNorm do pipeline). Por construção,
 *  Σ linhas.valor ≡ calcularCustoDireto(...) ao centavo. pct exposto = pct
 *  EFETIVO (resolvido × fatorNorm); valor = pct_efetivo × custo_total_mensal. */
export function detalharMaoDeObra(
  cliente: Cliente,
  colaboradores: Colaborador[],
  vinculos: Vinculo[] = [],
  fatorNormPorColab: Record<string, number> = {},
): LinhaMaoDeObra[] {
  if (cliente.pacote_servico === 'asset_only') return [];

  const normalize = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const mapExato = new Map<string, Colaborador>();
  const mapNorm = new Map<string, Colaborador>();
  const mapPorIdEstavel = new Map<string, Colaborador>();
  for (const c of colaboradores) {
    mapExato.set(c.nome_colaborador, c);
    mapNorm.set(normalize(c.nome_colaborador), c);
    if (c.id_estavel) mapPorIdEstavel.set(c.id_estavel, c);
  }

  const linhas: LinhaMaoDeObra[] = [];
  for (const funcao of FUNCOES_ALOCACAO) {
    const { colaborador: colab, pct } = resolverColaboradorParaFuncao(
      cliente, funcao, vinculos, mapExato, mapNorm, mapPorIdEstavel, normalize,
    );
    if (!colab || pct <= 0) continue;
    const fatorNorm = fatorNormPorColab[colab.id_estavel ?? ''] ?? 1;
    const pctEfetivo = pct * fatorNorm;
    linhas.push({
      funcao,
      responsavel: colab.nome_colaborador,
      pct: pctEfetivo,
      horas: horasEfetivasMensais(pctEfetivo, colab.percentual_alocavel ?? 0),
      valor: colab.custo_total_mensal * pctEfetivo,
    });
  }
  return linhas;
}

/** Σpct por colaborador (id_estavel → soma) com a MESMA atribuição que
 *  calcularCustoDireto usa (resolverColaboradorParaFuncao: vínculo por
 *  id_estavel, senão legado por nome). É a BASE CANÔNICA do fatorNorm e da
 *  ociosidade — garante a invariante folha ≡ direto+institucional+ociosidade.
 *
 *  ⚠ NÃO usar ocupacaoConsolidada aqui: aquela conta por membership de NOME
 *  (cliente[funcao]===nome), que diverge da atribuição do custo quando um
 *  vínculo (id_estavel) aponta para colaborador diferente do nome no cliente
 *  (caso institucional-com-vínculo). A base financeira é a do resolver. */
export function somarPctPorColaborador(
  clientes: Cliente[],
  colaboradores: Colaborador[],
  vinculos: Vinculo[],
): Record<string, number> {
  const normalize = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const mapExato = new Map<string, Colaborador>();
  const mapNorm = new Map<string, Colaborador>();
  const mapPorIdEstavel = new Map<string, Colaborador>();
  for (const c of colaboradores) {
    mapExato.set(c.nome_colaborador, c);
    mapNorm.set(normalize(c.nome_colaborador), c);
    if (c.id_estavel) mapPorIdEstavel.set(c.id_estavel, c);
  }
  const soma: Record<string, number> = {};
  for (const cliente of clientes) {
    if (cliente.pacote_servico === 'asset_only') continue;  // mesmo gate do custo
    for (const funcao of FUNCOES_ALOCACAO) {
      const { colaborador: colab, pct } = resolverColaboradorParaFuncao(
        cliente, funcao, vinculos, mapExato, mapNorm, mapPorIdEstavel, normalize,
      );
      if (!colab || pct <= 0) continue;
      const key = colab.id_estavel ?? '';
      soma[key] = (soma[key] ?? 0) + pct;
    }
  }
  return soma;
}


/** Indicador de escopo por função: pct_real / pct_normativo. Não entra no custo.
 *  pct_real = pct EFETIVO (vínculo-first via pctEfetivoFuncao; legado só fallback)
 *  — mesma fonte do custo e da ficha de Alocação. Sem vínculos → legado puro
 *  (retrocompat). Só a FONTE do pct muda; a fórmula é a mesma. */
export function calcularFatoresEscopo(
  cliente: Cliente, vinculos: Vinculo[] = [],
): Record<FuncaoAlocacao, number> {
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
    const pctReal = pctEfetivoFuncao(cliente, funcao, vinculos);
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

/** Rateio dos três pools para um cliente, RETORNADO SEPARADO por tipo.
 *  - geral: pool indireto (5 categorias + institucional + ociosidade).
 *  - juridico/conciliacao: rateios DIRETOS — o DRE os soma ao custo DEDICADO
 *    do cliente (decisão CFO: Consultoria & Legal é despesa direta), NÃO ao
 *    custo_indireto_rateado. As fórmulas de rateio (peso/volume) são intocadas;
 *    só o destino da soma muda (feito em calcularDRE). */
export function calcularCustosIndiretos(
  cliente: Cliente,
  custoDiretoCliente: number,
  todosClientes: Cliente[],
  todosCustosDiretos: Record<string, number>,
  custosIndiretos: CustoIndireto[],
  // Pool da folha NÃO distribuída ao cliente — institucional + ociosidade —
  // pré-computado UMA vez pelo pipeline (calcularCustoInstitucional +
  // calcularOciosidade). Entra no pool geral, mesma regra de rateio.
  poolNaoAlocado: number,
): { geral: number; juridico: number; conciliacao: number } {
  // Pool geral = itens 'geral' + (institucional + ociosidade). Rateio
  // proporcional ao custo direto. Pure asset (custo direto = 0) é EXCLUÍDO.
  const poolGeral = somarPorTipo(custosIndiretos, 'geral') + poolNaoAlocado;

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

  return { geral: parcelaGeral, juridico: parcelaJuridico, conciliacao: parcelaConciliacao };
}
