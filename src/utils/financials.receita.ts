// --- Receita por cliente: fee + parcela do rebate (split plataforma) ---
// CLAUDE.md (decisão arquitetural):
//   PL é gerenciado pelo módulo AUM & Performance (collection poupanca/).
//   O cadastro do cliente NÃO armazena PL — vem do RegistroPoupanca do período.
//   Sem RegistroPoupanca → receita_rebate = 0 (não cair em PL do cadastro).
//
// Fórmula:
//   rebate_bruto    = (PL_on × taxa_on / 12) + (PL_off × taxa_off / 12)
//   rebate_liquido  = rebate_bruto × (1 - aliquota_impostos_rebate)
//   receita_rebate  = rebate_liquido × split_plataforma  (Galácticos retém 50%)

import type { Cliente, RegistroPoupanca } from '../types';
import { REBATE_DEFAULT } from './constants';

export interface ResultadoReceita {
  receita_fee: number;
  receita_rebate: number;
  receita_bruta: number;
}

export function calcularReceita(
  cliente: Cliente,
  poupanca?: RegistroPoupanca,
): ResultadoReceita {
  const fee = cliente.receita_fee ?? 0;

  // PL vem do RegistroPoupanca do período. Sem registro → 0.
  const plOnshore = poupanca?.pl_onshore ?? 0;
  const plOffshore = poupanca?.pl_offshore ?? 0;

  const taxaOn = cliente.percentual_rebate_anual_onshore ?? 0;
  const taxaOff = cliente.percentual_rebate_anual_offshore ?? 0;

  const rebateBruto = (plOnshore * taxaOn) / 12 + (plOffshore * taxaOff) / 12;
  const aliquota = cliente.aliquota_impostos_rebate ?? 0;
  const rebateLiquido = rebateBruto * (1 - aliquota);
  const receitaRebate = rebateLiquido * REBATE_DEFAULT.split_plataforma;

  return {
    receita_fee: fee,
    receita_rebate: receitaRebate,
    receita_bruta: fee + receitaRebate,
  };
}
