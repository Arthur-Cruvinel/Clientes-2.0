// --- Distribuição automática de pct_* + fator de sobrecarga (CLAUDE.md) ---
// pct_* deixou de ser input manual primário (redesenho do modelo de alocação):
//   - calcularPctDistribuido sugere pct por proporção de horas normativas
//   - calcularFatorSobrecarga diagnostica sobrecarga por colaborador
// Override manual continua possível via UI (AlocacaoEmLote) e persistido
// no Firestore. O motor (calcularCustoDireto) lê o pct salvo, qualquer
// que seja sua origem.

import type { Cliente, Colaborador, FuncaoAlocacao } from '../types';
import { HORAS_PACOTE, HORAS_PRODUTIVAS_MES_POR_LOCALIDADE } from './constants';
import { calcularHorasReais } from './financials.horasReais';

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
 *    fator = horasProdutivasMes / somaHorasNormativas
 *    < 1.0 → colaborador não tem capacidade pra atender no nível dos pacotes
 *    ≥ 1.0 → capacidade ok, podendo absorver mais clientes */
export function calcularFatorSobrecarga(
  clientes: Cliente[],
  funcao: FuncaoAlocacao,
  colaborador: Colaborador,
): number {
  const somaHoras = clientes.reduce(
    (s, c) => s + (HORAS_PACOTE[c.pacote_servico]?.[funcao] ?? 0), 0,
  );
  if (somaHoras === 0) return 0;
  return horasProdMesDe(colaborador) / somaHoras;
}

/** Soma das horas normativas dos pacotes dos clientes na função. */
export function somarHorasNormativas(
  clientes: Cliente[], funcao: FuncaoAlocacao,
): number {
  return clientes.reduce(
    (s, c) => s + (HORAS_PACOTE[c.pacote_servico]?.[funcao] ?? 0), 0,
  );
}

/** Horas produtivas mensais do colaborador (atalho exposto p/ UI). */
export function horasProdutivasMes(colaborador: Colaborador): number {
  return horasProdMesDe(colaborador);
}
