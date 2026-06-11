// --- Hook da aba Reajustes (Precificação) ---
// Fee sugerido por cliente existente sob a filosofia "rebate subsidia o fee".
//
// FÓRMULA CENTRAL (fechada com o CFO — EXPOSIÇÃO, motor intocado):
//   O cliente deve à casa a margem EBITDA alvo sobre o custo total servido,
//   por qualquer combinação de fee + rebate líquido:
//     EBITDA = receita − impostos_fat − custo_total ; margem_alvo = EBITDA/receita
//     ⇒ receita(1 − aliq_imp_fat − margem_alvo) = custo_total
//     receita_necessaria = custo_total ÷ (1 − aliq_imp_fat − margem_alvo)
//     fee_sugerido       = receita_necessaria − rebate_líquido
//   - custo_total e rebate_líquido vêm do ResultadoCliente do pipeline real.
//   - aliq_imp_fat = ALIQUOTAS[regime].faturamento (mesmo do motor).
//   - rebate_líquido = ResultadoCliente.receita_rebate (já por perna, pós-
//     retenção e pós-split — mesma conta do motor).
//   fee_sugerido ≤ 0 → o rebate já cobre a margem alvo (excedente comercial).

import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { ALIQUOTAS } from '../../utils/constants';
import type { Cliente } from '../../types';

export type PerfilStatus = 'completo' | 'parcial' | 'ausente';
export type ReajusteBadge = 'subprecificado' | 'ok' | 'sobreprecificado' | 'rebate_cobre';

export interface ReajusteRow {
  nome: string;
  pacote: string;
  perfilStatus: PerfilStatus;
  custoTotal: number;
  rebateLiquido: number;
  receitaNecessaria: number;
  feeAtual: number;
  feeSugerido: number;
  gap: number;          // fee_sugerido − fee_atual (R$)
  gapPct: number | null;// gap ÷ fee_atual (null quando fee_atual = 0)
  excedenteRebate: number; // quando rebate cobre: rebate − receita_necessaria
  badge: ReajusteBadge;
}

function perfilStatusDe(c?: Cliente): PerfilStatus {
  if (!c?.perfil_complexidade) return 'ausente';
  const temVol = (c.volume_movimentos_mes ?? 0) > 0
    || (c.qtd_contratacoes_mes ?? 0) > 0 || (c.qtd_recebiveis_mes ?? 0) > 0;
  return temVol ? 'completo' : 'parcial';
}

/** materialidadePct: limiar |gap%| acima do qual classifica sub/sobre (decimal). */
export function useReajustes(materialidadePct: number) {
  const { dadosPeriodo, regime, parametros, periodoSelecionado, loading } = useApp();

  const aliqImpFat = ALIQUOTAS[regime].faturamento;
  const margemAlvo = parametros.margem_alvo;
  const denom = 1 - aliqImpFat - margemAlvo;  // fração da receita que sobra p/ cobrir o custo

  const rows = useMemo<ReajusteRow[]>(() => {
    if (!dadosPeriodo || denom <= 0) return [];
    const cliByNome = new Map(dadosPeriodo.clientes.map(c => [c.nome_cliente, c]));
    return dadosPeriodo.resultados.map(r => {
      const custoTotal = r.custo_total;
      const rebateLiquido = r.receita_rebate;
      const feeAtual = r.receita_fee;
      const receitaNecessaria = custoTotal / denom;
      const feeSugerido = receitaNecessaria - rebateLiquido;
      const gap = feeSugerido - feeAtual;
      const gapPct = feeAtual > 0.01 ? gap / feeAtual : null;

      let badge: ReajusteBadge;
      if (feeSugerido <= 0.01) badge = 'rebate_cobre';
      else if (feeAtual <= 0.01) badge = 'subprecificado';           // cobra 0, devia cobrar
      else if (gapPct! > materialidadePct) badge = 'subprecificado';  // devia cobrar mais
      else if (gapPct! < -materialidadePct) badge = 'sobreprecificado';
      else badge = 'ok';

      return {
        nome: r.nome_cliente, pacote: r.pacote_servico,
        perfilStatus: perfilStatusDe(cliByNome.get(r.nome_cliente)),
        custoTotal, rebateLiquido, receitaNecessaria, feeAtual, feeSugerido,
        gap, gapPct, excedenteRebate: feeSugerido <= 0 ? rebateLiquido - receitaNecessaria : 0,
        badge,
      };
    });
  }, [dadosPeriodo, denom, materialidadePct]);

  // "Dinheiro na mesa": Σ gap positivo dos subprecificados (independe do filtro de exibição).
  const dinheiroNaMesa = useMemo(
    () => rows.filter(r => r.badge === 'subprecificado').reduce((s, r) => s + Math.max(0, r.gap), 0),
    [rows]);

  return { rows, dinheiroNaMesa, margemAlvo, aliqImpFat, denomInvalido: denom <= 0, periodoSelecionado, loading };
}
