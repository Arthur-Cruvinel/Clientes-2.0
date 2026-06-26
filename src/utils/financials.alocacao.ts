// --- Distribuição automática de pct_* + fator de sobrecarga (CLAUDE.md) ---
// pct_* deixou de ser input manual primário (redesenho do modelo de alocação):
//   - calcularPctDistribuido sugere pct por proporção de horas normativas
//   - calcularFatorSobrecarga diagnostica sobrecarga por colaborador
// Override manual continua possível via UI (AlocacaoEmLote) e persistido
// no Firestore. O motor (calcularCustoDireto) lê o pct salvo, qualquer
// que seja sua origem.

import type { Cliente, Colaborador, FuncaoAlocacao } from '../types';
import type { Vinculo } from '../types/vinculo';
import { HORAS_PACOTE, HORAS_PRODUTIVAS_MES_POR_LOCALIDADE, HORAS_CLT_MES, FUNCOES_ALOCACAO } from './constants';
import { calcularHorasReais } from './financials.horasReais';

/** Horas mensais que um pct de dedicação representa — MESMA fórmula da tela de
 *  Alocação ("Horas efet."): pct × HORAS_CLT_MES × percentual_alocavel. Fonte
 *  única para o drill-down de mão de obra reusar (não recriar a fórmula). */
export function horasEfetivasMensais(pct: number, percentualAlocavel: number): number {
  return pct * HORAS_CLT_MES * percentualAlocavel;
}

// ── Dual-read de alocação (FONTE CANÔNICA) ──────────────────────────────────
// pct efetivo de (colaborador, cliente, função): vínculo com pct>0 vence;
// senão o legado cliente.pct_{funcao}. Mesma regra do pipeline
// (resolverColaboradorParaFuncao) e de toda a UI vínculo-first.

/** pct efetivo de um par (colaborador, cliente) numa função. */
export function pctEfetivo(
  colaborador: Pick<Colaborador, 'id_estavel'>,
  cliente: Cliente,
  funcao: FuncaoAlocacao,
  vinculos: Vinculo[],
): number {
  const v = (colaborador.id_estavel && cliente.id_estavel)
    ? vinculos.find(x => x.id_estavel_colaborador === colaborador.id_estavel
        && x.id_estavel_cliente === cliente.id_estavel && x.funcao === funcao)
    : undefined;
  const legado = (cliente[`pct_${funcao}` as keyof Cliente] as number | undefined) ?? 0;
  return (v && v.pct > 0) ? v.pct : legado;
}

/** pct efetivo de uma FUNÇÃO do cliente, SEM fixar colaborador: o vínculo do par
 *  (cliente, função) com pct>0 vence; senão o legado cliente.pct_{funcao}. Sibling
 *  per-função do pctEfetivo — mesma regra vínculo-first da ficha de Alocação
 *  (AlocacaoTab) e do pipeline. Fonte única dos fatores de escopo. */
export function pctEfetivoFuncao(
  cliente: Cliente, funcao: FuncaoAlocacao, vinculos: Vinculo[],
): number {
  const v = cliente.id_estavel
    ? vinculos.find(x => x.id_estavel_cliente === cliente.id_estavel && x.funcao === funcao && x.pct > 0)
    : undefined;
  return v ? v.pct : ((cliente[`pct_${funcao}` as keyof Cliente] as number | undefined) ?? 0);
}

/** Ocupação CONSOLIDADA do colaborador — Σ pctEfetivo nas 6 funções, sobre os
 *  clientes que ele atende em cada uma (membership pelo campo cliente[funcao],
 *  até a migração da lista — BACKLOG #9). Retorna o total (fração) e o detalhe
 *  por função. Fonte única da guarda de sobre-alocação e da coluna Ocupação. */
export function ocupacaoConsolidada(
  colaborador: Colaborador,
  clientes: Cliente[],
  vinculos: Vinculo[],
): { total: number; porFuncao: Record<string, number> } {
  const porFuncao: Record<string, number> = {};
  for (const f of FUNCOES_ALOCACAO) {
    let soma = 0;
    for (const cli of clientes) {
      if ((cli[f] as string | undefined) !== colaborador.nome_colaborador) continue;
      soma += pctEfetivo(colaborador, cli, f, vinculos);
    }
    if (soma > 0) porFuncao[f] = soma;
  }
  const total = Object.values(porFuncao).reduce((s, v) => s + v, 0);
  return { total, porFuncao };
}

// ── Normalização de sobre-alocação + ociosidade (regra fechada com o CFO) ───
// REGRA:
//   • Σpct > percentual_alocavel → NORMALIZAR: fatorNorm = alocavel/Σpct. Os
//     pcts viram PESOS RELATIVOS; o colaborador distribui EXATAMENTE 100% do
//     custo real (alocavel×custo) entre os clientes. NUNCA mais — não pagamos
//     hora extra.
//   • Σpct < alocavel → OCIOSIDADE = (alocavel − Σpct) × custo → pool indireto
//     geral (junto do institucional, mesma regra de rateio).
//   • INVARIANTE: folha ≡ direto + institucional + ociosidade, sempre.
// Só o FINANCEIRO normaliza: a sobrecarga continua VISÍVEL na ocupação/guardas
// (ocupacaoConsolidada não é alterada) — informação operacional preservada.

// IMPORTANTE: fatorNorm e ociosidade usam o Σpct da BASE FINANCEIRA
// (somarPctPorColaborador, em financials.custos.ts — atribuição por id_estavel,
// igual ao custo), NÃO ocupacaoConsolidada (membership por nome). As duas
// divergem no caso institucional-com-vínculo; só a do resolver fecha a
// invariante folha ≡ direto+institucional+ociosidade.

/** Fator de normalização por colaborador (keyed por id_estavel). Σpct ≤ alocavel
 *  → 1 (sem mudança). Σpct > alocavel → alocavel/Σpct (escala os pcts a pesos).
 *  Colaborador 100% institucional (alocavel=0) com vínculos → fator 0 (zera o
 *  direto; custo vai 100% institucional — corrige a dupla contagem).
 *  `somaPctPorColab`: id_estavel → Σpct, de somarPctPorColaborador. */
export function calcularFatorNormalizacao(
  colaboradores: Colaborador[],
  somaPctPorColab: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of colaboradores) {
    if (!c.id_estavel) continue;
    const palocavel = c.percentual_alocavel ?? 0;
    const soma = somaPctPorColab[c.id_estavel] ?? 0;
    out[c.id_estavel] = soma > palocavel ? palocavel / soma : 1;
  }
  return out;
}

/** Ociosidade de capacidade: Σ por colaborador de (alocavel − Σpct) × custo,
 *  quando positivo. Vai para o pool indireto geral. Over-alocado (Σpct>alocavel)
 *  → 0 (já normalizado). Não-alocável (alocavel=0) → 0 natural (max(0, −Σpct)). */
export function calcularOciosidade(
  colaboradores: Colaborador[],
  somaPctPorColab: Record<string, number>,
): number {
  let total = 0;
  for (const c of colaboradores) {
    const palocavel = c.percentual_alocavel ?? 0;
    const soma = (c.id_estavel ? somaPctPorColab[c.id_estavel] : 0) ?? 0;
    total += Math.max(0, palocavel - soma) * (c.custo_total_mensal ?? 0);
  }
  return total;
}

function horasProdMesDe(colaborador: Colaborador): number {
  return HORAS_PRODUTIVAS_MES_POR_LOCALIDADE[colaborador.localidade ?? 'SP']
    ?? HORAS_PRODUTIVAS_MES_POR_LOCALIDADE.SP;
}

/** Horas-base do cliente para a função: usa horas reais quando o cliente
 *  tem perfil_complexidade preenchido; senão cai para HORAS_PACOTE.
 *  Gate por presença do objeto — não por valores específicos — para evitar
 *  zerar pct_* de clientes sem perfil ainda configurado. */
function horasBaseClienteFuncao(c: Cliente, funcao: FuncaoAlocacao): number {
  if (c.perfil_complexidade) {
    return calcularHorasReais(c, c.perfil_complexidade).por_funcao[funcao] ?? 0;
  }
  return HORAS_PACOTE[c.pacote_servico]?.[funcao] ?? 0;
}

/** Distribui pct_* automaticamente — proporcional às horas-base dos clientes
 *  (reais quando há perfil de complexidade, normativas do pacote como fallback).
 *  Soma resultante = percentual_alocavel (100% da folha alocável). */
export function calcularPctDistribuido(
  clientes: Cliente[],
  funcao: FuncaoAlocacao,
  colaborador: Colaborador,
): Record<string, number> {
  const horasBase: Record<string, number> = {};
  for (const c of clientes) horasBase[c.nome_cliente] = horasBaseClienteFuncao(c, funcao);
  const somaHoras = Object.values(horasBase).reduce((s, h) => s + h, 0);

  const resultado: Record<string, number> = {};
  for (const c of clientes) {
    resultado[c.nome_cliente] = somaHoras === 0
      ? 0
      : (horasBase[c.nome_cliente] / somaHoras) * colaborador.percentual_alocavel;
  }
  return resultado;
}

/** Fator de sobrecarga POR COLABORADOR (não por cliente):
 *    fator = horasProdutivasMes(colab) / somaHorasDemanda
 *    onde horasProdutivasMes já escala por percentual_alocavel (horas
 *    DISPONÍVEIS PARA CLIENTES, não o tempo integral da localidade).
 *    A demanda usa horas REAIS de volume (horasBaseClienteFuncao — mesma base
 *    de calcularPctDistribuido: calcularHorasReais quando há perfil, HORAS_PACOTE
 *    como fallback). Caminho 1: a sobrecarga reflete carga real, não a norma do
 *    tier.
 *    < 1.0 → colaborador não tem capacidade pra atender a demanda real
 *    ≥ 1.0 → capacidade ok, podendo absorver mais clientes */
export function calcularFatorSobrecarga(
  clientes: Cliente[],
  funcao: FuncaoAlocacao,
  colaborador: Colaborador,
): number {
  const somaHoras = clientes.reduce(
    (s, c) => s + horasBaseClienteFuncao(c, funcao), 0,
  );
  if (somaHoras === 0) return 0;
  return horasProdutivasMes(colaborador) / somaHoras;
}

/** Soma das horas de DEMANDA dos clientes na função — base de volume real
 *  (horasBaseClienteFuncao: horas reais quando há perfil, HORAS_PACOTE fallback). */
export function somarHorasNormativas(
  clientes: Cliente[], funcao: FuncaoAlocacao,
): number {
  return clientes.reduce(
    (s, c) => s + horasBaseClienteFuncao(c, funcao), 0,
  );
}

/** Horas produtivas mensais do colaborador DISPONÍVEIS PARA CLIENTES — escala
 *  as horas produtivas da localidade pelo percentual_alocavel (fração do tempo
 *  dedicada a clientes; o restante é institucional). Sem o campo → assume 1.0
 *  (retrocompat). Usado no diagnóstico de capacidade da Alocação em Lote. */
export function horasProdutivasMes(colaborador: Colaborador): number {
  return horasProdMesDe(colaborador) * (colaborador.percentual_alocavel ?? 1);
}
