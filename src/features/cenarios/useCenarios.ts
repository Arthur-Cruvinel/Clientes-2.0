// --- Hook do Módulo de Cenários — Degrau 1: ponto de equilíbrio fee/rebate ---
// Conta DETERMINÍSTICA e de LEITURA: espelha a saída do motor (dadosPeriodo),
// NÃO recalcula o pipeline. Fontes (todas de dadosPeriodo, igual à Visão Geral):
//   custo_total  = dadosPeriodo.totais.custo_total      (pré-agregado pelo motor)
//   receita_bruta= dadosPeriodo.totais.receita_bruta    (pré-agregado; = fee+rebate)
//   receita_fee  = Σ dadosPeriodo.resultados.receita_fee     (somar o array)
//   receita_rebate = Σ dadosPeriodo.resultados.receita_rebate
// Armadilhas obedecidas (ver diagnóstico): NÃO usar o tipo morto TotaisPeriodo
// (campos *_total nunca são populados); somar de `resultados`. Usar
// resultados.receita_fee (canônico), não o alias receita_fee_mensal. Pure assets
// entram no custo (≈0) e não no fee — correto para o equilíbrio consolidado.

import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';

/** Resultado do equilíbrio de UMA receita (só-fee ou só-rebate) contra o custo. */
export interface CenarioEquilibrio {
  receitaAtual: number;        // receita atual desta perna (fee ou rebate)
  gap: number;                 // custo_total − receitaAtual (>0 falta; ≤0 já cobre)
  sePaga: boolean;             // gap ≤ 0 → a firma já se paga só com esta receita
  folga: number;              // quando sePaga: receitaAtual − custo_total (≥0)
  pctAumento: number | null;   // gap/receitaAtual×100 quando falta E base>0; null se base=0
  coberturaPct: number;        // receitaAtual/custo_total×100 (quanto desta receita cobre o custo)
}

export interface CenariosDegrau1 {
  custoTotal: number;
  receitaBruta: number;
  receitaFee: number;
  receitaRebate: number;
  coberturaTotalPct: number;   // receita_bruta/custo_total×100 (fee+rebate juntos)
  soFee: CenarioEquilibrio;
  soRebate: CenarioEquilibrio;
}

export interface UseCenariosResult {
  dados: CenariosDegrau1 | null;
  loading: boolean;
  periodoSelecionado: string;
}

export function useCenarios(): UseCenariosResult {
  const { dadosPeriodo, loading, periodoSelecionado } = useApp();

  const dados = useMemo<CenariosDegrau1 | null>(() => {
    if (!dadosPeriodo) return null;

    const custoTotal = dadosPeriodo.totais.custo_total;
    const receitaBruta = dadosPeriodo.totais.receita_bruta;
    const receitaFee = dadosPeriodo.resultados.reduce((s, r) => s + r.receita_fee, 0);
    const receitaRebate = dadosPeriodo.resultados.reduce((s, r) => s + r.receita_rebate, 0);

    // Equilíbrio de uma perna: quanto dela faria a firma se pagar sozinha.
    const equilibrio = (receitaAtual: number): CenarioEquilibrio => {
      const gap = custoTotal - receitaAtual;
      const sePaga = gap <= 0;
      return {
        receitaAtual,
        gap,
        sePaga,
        folga: sePaga ? receitaAtual - custoTotal : 0,
        // % de aumento só faz sentido com base > 0 e quando ainda falta.
        pctAumento: gap > 0 && receitaAtual > 0 ? (gap / receitaAtual) * 100 : null,
        coberturaPct: custoTotal > 0 ? (receitaAtual / custoTotal) * 100 : 0,
      };
    };

    return {
      custoTotal,
      receitaBruta,
      receitaFee,
      receitaRebate,
      coberturaTotalPct: custoTotal > 0 ? (receitaBruta / custoTotal) * 100 : 0,
      soFee: equilibrio(receitaFee),
      soRebate: equilibrio(receitaRebate),
    };
  }, [dadosPeriodo]);

  return { dados, loading, periodoSelecionado };
}
