// --- Base compartilhada da Precificação (motor ÚNICO) ---
// PRINCÍPIO (decisão CFO): cada real entra no custo por UM canal. Para cliente
// EXISTENTE a mão de obra entra só pela alocação real (vínculos) — o modelo de
// DEMANDA nunca vira custo de cliente existente (duplicaria a mesma mão de obra).
// A demanda é RÉGUA: diagnóstico de staffing (Parte 1) e base de proposta para
// PROSPECT (Parte 2, onde não há alocação). Estes helpers são a fonte única do
// "custo de demanda" — usados tanto no cenário da Parte 1 quanto no gerador.

import type { Colaborador, CustoIndireto, Cliente, FuncaoAlocacao, ResultadoCliente, Parametros } from '../../types';
import type { Vinculo } from '../../types/vinculo';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { somarPctPorColaborador, somarPctPorFuncaoColaborador, calcularCustoInstitucional } from '../../utils/financials.custos';
import { calcularOciosidade } from '../../utils/financials.alocacao';

// ── Custo do jurídico consultivo — fonte ÚNICA (fee da proposta + 7ª rubrica) ──
// Quando pool E capacidade > 0 → custo por demanda = pool ÷ capacidade. Senão,
// FALLBACK ao cálculo por hora (tempo × custo_hora × fator ≈ R$207). Com os dois
// defaults 0, devolve exatamente o valor atual (byte a byte).
export function custoDemandaJuridicaEfetivo(p: Parametros): number {
  if (p.pool_mensal_juridico > 0 && p.capacidade_demandas_mes > 0) {
    return p.pool_mensal_juridico / p.capacidade_demandas_mes;
  }
  return p.tempo_demanda_juridica_horas * p.custo_hora_juridico * p.fator_demanda_juridica;
}
// Salário-hora efetivo do jurídico (7ª rubrica do Orçador): custo_demanda ÷ tempo
// quando derivado por pool; senão o custo_hora cru (fallback 82,88, byte a byte).
export function custoHoraJuridicoEfetivo(p: Parametros): number {
  if (p.pool_mensal_juridico > 0 && p.capacidade_demandas_mes > 0) {
    return custoDemandaJuridicaEfetivo(p) / (p.tempo_demanda_juridica_horas || 1);
  }
  return p.custo_hora_juridico;
}

/** Custo/hora MÉDIO por função — ponderado pelos VÍNCULOS reais: peso = Σpct dos
 *  colaboradores que ATENDEM a função no período (mesma atribuição do custo
 *  realizado). Reflete quem de fato exerce a função, inclusive multi-função.
 *  Fallback: função sem nenhum vínculo no período → média por funcao_principal
 *  (comportamento legado), garantindo custo/hora não-zero para a demanda. */
export function custoHoraMedioPorFuncao(
  colaboradores: Colaborador[], clientes: Cliente[] = [], vinculos: Vinculo[] = [],
): Record<FuncaoAlocacao, number> {
  const pctMap = somarPctPorFuncaoColaborador(clientes, colaboradores, vinculos);
  const porId = new Map<string, Colaborador>();
  for (const c of colaboradores) if (c.id_estavel) porId.set(c.id_estavel, c);

  const out = {} as Record<FuncaoAlocacao, number>;
  for (const f of FUNCOES_ALOCACAO) {
    const pesos = pctMap[f] ?? {};
    const ids = Object.keys(pesos);
    let num = 0, den = 0;
    for (const id of ids) {
      const c = porId.get(id);
      if (!c) continue;
      num += (c.custo_hora ?? 0) * pesos[id];
      den += pesos[id];
    }
    if (den > 0) { out[f] = num / den; continue; }
    // Fallback legado: nenhuma alocação por vínculo na função.
    const aloc = colaboradores.filter(c => c.alocavel && c.funcao_principal === f && (c.percentual_alocavel ?? 0) > 0);
    const peso = aloc.reduce((s, c) => s + (c.percentual_alocavel ?? 0), 0);
    out[f] = peso > 0 ? aloc.reduce((s, c) => s + (c.custo_hora ?? 0) * (c.percentual_alocavel ?? 0), 0) / peso : 0;
  }
  return out;
}

/** Proporção de overhead = pool geral ÷ Σ custo direto do período — a MESMA do
 *  rateio real do motor (custo_indireto_rateado = custo_direto × esta razão). */
export function overheadRatioPeriodo(
  colaboradores: Colaborador[], custosIndiretos: CustoIndireto[],
  clientes: Cliente[], vinculos: Vinculo[], resultados: ResultadoCliente[],
): number {
  const somaPct = somarPctPorColaborador(clientes, colaboradores, vinculos);
  const poolGeral = custosIndiretos.filter(c => c.tipo_custo === 'geral').reduce((s, c) => s + c.valor_mensal, 0)
    + calcularCustoInstitucional(colaboradores) + calcularOciosidade(colaboradores, somaPct);
  const sumDireto = resultados.reduce((s, r) => s + r.custo_direto, 0);
  return sumDireto > 0 ? poolGeral / sumDireto : 0;
}

/** Custo direto de DEMANDA: Σ horas_função × custo_hora médio da função. */
export function custoDiretoDemanda(
  horasPorFuncao: Record<FuncaoAlocacao, number>, custoHoraMedio: Record<FuncaoAlocacao, number>,
): number {
  return FUNCOES_ALOCACAO.reduce((s, f) => s + (horasPorFuncao[f] ?? 0) * (custoHoraMedio[f] ?? 0), 0);
}

// ── Precificação de LINHA CALCULADA (extraordinário por esforço) ────────────
// Irmão do calcularFee que reusa as MESMAS entranhas (custoHoraMedioPorFuncao +
// custoDiretoDemanda + overhead + gross-up), mas recebe HORAS por função direto
// (não deriva de volume) e trata o jurídico como 7ª rubrica (custo_hora_juridico).
// SEM rebate (o rebate subsidia o fee mensal, não o serviço avulso). Margem é POR
// LINHA. NÃO chama calcularFee (o contrato de entrada dele — volume — fica intocado).
export interface LinhaCalculadaInputs {
  colaboradores: Colaborador[]; clientes: Cliente[]; vinculos: Vinculo[];
  horasPorFuncao: Record<FuncaoAlocacao, number>;
  horasJuridicas: number; custoHoraJuridico: number; fatorJuridico: number;
  overheadRatio: number; margem: number; aliqFat: number;
}
export interface LinhaCalculadaResult {
  custoDireto: number; custoJuridico: number; overhead: number;
  custoTotal: number; preco: number; denomInvalido: boolean;
}
export function precificarLinhaCalculada(i: LinhaCalculadaInputs): LinhaCalculadaResult {
  const custoHoraMedio = custoHoraMedioPorFuncao(i.colaboradores, i.clientes, i.vinculos);
  const custoFuncoes = custoDiretoDemanda(i.horasPorFuncao, custoHoraMedio);
  const custoJuridico = i.horasJuridicas * i.custoHoraJuridico * i.fatorJuridico;
  const custoDireto = custoFuncoes + custoJuridico;
  const overhead = custoDireto * i.overheadRatio;
  const custoTotal = custoDireto + overhead;
  const denom = 1 - i.aliqFat - i.margem;
  const preco = denom > 0 ? custoTotal / denom : 0;
  return { custoDireto, custoJuridico, overhead, custoTotal, preco, denomInvalido: denom <= 0 };
}
