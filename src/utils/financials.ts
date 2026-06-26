// --- Motor financeiro (Fase 2) — re-exporta os módulos divididos ---
// Splits por responsabilidade (CLAUDE.md, limite 150 linhas/arquivo):
//   financials.custos.ts    → custo direto, indireto, institucional, fatores de escopo
//   financials.receita.ts   → fee + parcela do rebate
//   financials.dre.ts       → DRE completo por cliente
//   financials.pipeline.ts  → orquestrador do período

export {
  calcularCustoColaborador,
  calcularFolhaColaborador,
  buscarTetoPorPeriodo,
  resolverClientePorPeriodo,
  CAMPOS_VIGENCIA_CLIENTE,
  calcularCustoDireto,
  somarPctPorColaborador,
  calcularFatoresEscopo,
  calcularCustoInstitucional,
  calcularCustosIndiretos,
} from './financials.custos';

export { calcularReceita } from './financials.receita';
export type { ResultadoReceita } from './financials.receita';

export { calcularDRE } from './financials.dre';

export { processarPeriodo } from './financials.pipeline';

export {
  calcularPctDistribuido,
  calcularFatorSobrecarga,
  somarHorasDemanda,
  horasProdutivasMes,
  pctEfetivo,
  ocupacaoConsolidada,
  calcularFatorNormalizacao,
  calcularOciosidade,
} from './financials.alocacao';

export {
  calcularHorasReais,
  pctNormativoPorHorasReais,
} from './financials.horasReais';

// ── Utilitários estáveis (pré-Fase 2, ainda em uso) ───────────────────────
import type { RegistroPoupanca } from '../types';

// Re-export do tipo da fonte de PL — consumidores do motor importam num único lugar.
export type { RegistroPoupanca };

/**
 * NNM Real Onshore — aporte onshore bruto menos transferência interna onshore.
 * Reflete o movimento real do cliente em conta onshore, excluindo
 * apenas movimento entre contas próprias (transferência interna).
 * Tombamento NÃO é descontado (decisão de produto: tombamento é
 * entrada de capital real na Galápagos).
 */
export function nnmRealOnshore(r: RegistroPoupanca): number {
  return (r.aporte_mes_onshore ?? 0) - (r.transferencia_interna_onshore ?? 0);
}

/**
 * NNM Real Offshore — aporte offshore bruto menos transferência interna offshore.
 * Mesma semântica de nnmRealOnshore, aplicada à dimensão offshore.
 */
export function nnmRealOffshore(r: RegistroPoupanca): number {
  return (r.aporte_mes_offshore ?? 0) - (r.transferencia_interna_offshore ?? 0);
}

/** NNM real consolidado — soma das dimensões onshore e offshore.
 *  Compõe nnmRealOnshore + nnmRealOffshore para garantir fonte
 *  única: qualquer ajuste nas primitivas propaga automaticamente.
 *  NÃO lê aporte_mes_total — soma individualmente para garantir
 *  resultado correto independente do consolidado em runtime. */
export function nnmReal(r: RegistroPoupanca): number {
  return nnmRealOnshore(r) + nnmRealOffshore(r);
}

/** NNM líquido de tombamento (portabilidade) E transferência interna.
 *  Base da poupança líquida exibida nos relatórios. */
export function nnmPoupancaLiquida(registro: RegistroPoupanca): number {
  return nnmReal(registro) - (registro.nnm_tombamento ?? 0);
}
