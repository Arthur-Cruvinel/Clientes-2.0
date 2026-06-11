// --- Receita por cliente: fee + parcela do rebate (split plataforma) ---
// CLAUDE.md (decisão arquitetural):
//   PL é gerenciado pelo módulo AUM & Performance (collection poupanca/).
//   O cadastro do cliente NÃO armazena PL — vem do RegistroPoupanca do período.
//   Sem RegistroPoupanca → receita_rebate = 0 (não cair em PL do cadastro).
//
// SEMÂNTICA da alíquota de rebate (por perna, GLOBAL):
//   Modela a RETENÇÃO NA ORIGEM do rebate — o rebate chega à plataforma já
//   DESCONTADO. A plataforma projeta o LÍQUIDO A RECEBER. NÃO é imposto devido
//   pela empresa e NÃO tem relação com IRPJ/CSLL (impostos_lucro), que é outra
//   camada e fica intocada. As alíquotas são globais (Configurações → Rebate),
//   não por cliente.
//
// Fórmula (por perna, depois soma e aplica o split):
//   rebate_liq_on  = PL_on  × taxa_on  / 12 × (1 − aliq_on)
//   rebate_liq_off = PL_off × taxa_off / 12 × (1 − aliq_off)
//   receita_rebate = (rebate_liq_on + rebate_liq_off) × split_plataforma
// Sem caso especial para Pure Asset: sem PL numa perna, aquela perna é 0 por
// construção.

import type { Cliente, RegistroPoupanca } from '../types';
import {
  REBATE_DEFAULT, ALIQUOTA_REBATE_ONSHORE_DEFAULT, ALIQUOTA_REBATE_OFFSHORE_DEFAULT,
} from './constants';

export interface ResultadoReceita {
  receita_fee: number;
  receita_rebate: number;
  receita_bruta: number;
}

/** Alíquotas globais de retenção do rebate por perna. */
export interface AliquotasRebate {
  onshore: number;
  offshore: number;
}

/** Fallback defensivo: alíquota ausente/NaN cai no default constante (NUNCA 0,
 *  que infla a receita silenciosamente) e LOGA qual perna fez fallback. */
function aliqDefensiva(valor: number | undefined | null, fallback: number, perna: string): number {
  if (valor == null || Number.isNaN(valor)) {
    console.warn(`[Receita] aliquota_rebate_${perna} ausente — fallback p/ default ${(fallback * 100).toFixed(2)}% (nunca 0).`);
    return fallback;
  }
  return valor;
}

export function calcularReceita(
  cliente: Cliente,
  poupanca?: RegistroPoupanca,
  // Globais (do parametros/global via AppContext). Default = constantes iniciais
  // para chamadas isoladas (testes/simulador) — nunca 0.
  aliquotas?: AliquotasRebate,
): ResultadoReceita {
  const fee = cliente.receita_fee ?? 0;

  // PL vem do RegistroPoupanca do período. Sem registro → 0.
  const plOnshore = poupanca?.pl_onshore ?? 0;
  const plOffshore = poupanca?.pl_offshore ?? 0;

  const taxaOn = cliente.percentual_rebate_anual_onshore ?? 0;
  const taxaOff = cliente.percentual_rebate_anual_offshore ?? 0;

  const aliqOn = aliqDefensiva(aliquotas?.onshore, ALIQUOTA_REBATE_ONSHORE_DEFAULT, 'onshore');
  const aliqOff = aliqDefensiva(aliquotas?.offshore, ALIQUOTA_REBATE_OFFSHORE_DEFAULT, 'offshore');

  // Líquido por perna (retenção na origem aplicada perna a perna).
  const rebateLiqOn = (plOnshore * taxaOn) / 12 * (1 - aliqOn);
  const rebateLiqOff = (plOffshore * taxaOff) / 12 * (1 - aliqOff);
  const receitaRebate = (rebateLiqOn + rebateLiqOff) * REBATE_DEFAULT.split_plataforma;

  return {
    receita_fee: fee,
    receita_rebate: receitaRebate,
    receita_bruta: fee + receitaRebate,
  };
}
