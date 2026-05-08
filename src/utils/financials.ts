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
  calcularCustoDireto,
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
  somarHorasNormativas,
  horasProdutivasMes,
} from './financials.alocacao';

export {
  calcularHorasReais,
  calcularFatorEscopoReal,
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

/** NNM "real" do mês — aporte bruto descontando transferência interna entre
 *  contas do mesmo cliente (movimentos que NÃO são poupança nem tombamento,
 *  apenas reorganização). Soma onshore e offshore individualmente em vez de
 *  ler `aporte_mes_total` para garantir resultado correto mesmo quando o
 *  consumidor não recomputa o consolidado em runtime. */
export function nnmReal(registro: RegistroPoupanca): number {
  const aporteOn = registro.aporte_mes_onshore ?? 0;
  const aporteOff = registro.aporte_mes_offshore ?? 0;
  const transOn = registro.transferencia_interna_onshore ?? 0;
  const transOff = registro.transferencia_interna_offshore ?? 0;
  return (aporteOn + aporteOff) - (transOn + transOff);
}

/** NNM líquido de tombamento (portabilidade) E transferência interna.
 *  Base da poupança líquida exibida nos relatórios. */
export function nnmPoupancaLiquida(registro: RegistroPoupanca): number {
  return nnmReal(registro) - (registro.nnm_tombamento ?? 0);
}
