// --- Base compartilhada da Precificação (motor ÚNICO) ---
// PRINCÍPIO (decisão CFO): cada real entra no custo por UM canal. Para cliente
// EXISTENTE a mão de obra entra só pela alocação real (vínculos) — o modelo de
// DEMANDA nunca vira custo de cliente existente (duplicaria a mesma mão de obra).
// A demanda é RÉGUA: diagnóstico de staffing (Parte 1) e base de proposta para
// PROSPECT (Parte 2, onde não há alocação). Estes helpers são a fonte única do
// "custo de demanda" — usados tanto no cenário da Parte 1 quanto no gerador.

import type { Colaborador, CustoIndireto, Cliente, FuncaoAlocacao, ResultadoCliente } from '../../types';
import type { Vinculo } from '../../types/vinculo';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { somarPctPorColaborador, calcularCustoInstitucional } from '../../utils/financials.custos';
import { calcularOciosidade } from '../../utils/financials.alocacao';

/** Custo/hora MÉDIO por função — média ponderada por percentual_alocavel dos
 *  colaboradores alocáveis da função. Base do custo de DEMANDA (proposta/cenário). */
export function custoHoraMedioPorFuncao(colaboradores: Colaborador[]): Record<FuncaoAlocacao, number> {
  const out = {} as Record<FuncaoAlocacao, number>;
  for (const f of FUNCOES_ALOCACAO) {
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
