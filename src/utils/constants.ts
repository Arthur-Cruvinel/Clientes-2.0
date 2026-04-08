// --- Constantes Financeiras ---

import type { PacoteServico, FuncaoAlocacao, Parametros } from '../types';

export const HORAS_CLT_MES = 168;

// ── PACOTES DE SERVIÇO ─────────────────────────────────────────────────────
// Horas-direito por função para cada pacote.
// São as horas que o cliente TEM DIREITO mensalmente — não as horas efetivas.
// Horas efetivas = horas_direito × fator_utilizacao + horas_reativas
// Fonte: planilha de Processos e Atividades (Galácticos Capital, 2024)
// Revisão: conforme redesenho de produto — não alterar sem decisão formal.

export const HORAS_PACOTE: Record<PacoteServico, Record<FuncaoAlocacao, number>> = {
  full: {
    consultoria_gestao:       16,
    consultoria_planejamento:  4,
    consultoria_financeira:   20,
    operacional_financeiro:   36,
    serv_adm:                 20,
    serv_aux_adm:              8,
  },
  advanced: {
    consultoria_gestao:       10,
    consultoria_planejamento:  2,
    consultoria_financeira:   12,
    operacional_financeiro:   22,
    serv_adm:                 12,
    serv_aux_adm:              4,
  },
  light: {
    consultoria_gestao:        6,
    consultoria_planejamento:  1,
    consultoria_financeira:    6,
    operacional_financeiro:    8,
    serv_adm:                  4,
    serv_aux_adm:              0,
  },
  future: {
    consultoria_gestao:        4,
    consultoria_planejamento:  1,
    consultoria_financeira:    3,
    operacional_financeiro:    2,
    serv_adm:                  0,
    serv_aux_adm:              0,
  },
  asset_only: {
    consultoria_gestao:        0,
    consultoria_planejamento:  0,
    consultoria_financeira:    0,
    operacional_financeiro:    0,
    serv_adm:                  0,
    serv_aux_adm:              0,
  },  // cliente pure asset — custo direto sempre zero
} as const;

// ── ALÍQUOTAS TRIBUTÁRIAS ─────────────────────────────────────────────────
export const ALIQUOTAS = {
  presumido: {
    faturamento: 0.0865,   // PIS/COFINS/ISS
    lucro: 0.0768,         // IRPJ+CSLL (base presumida 32% × 24%)
  },
  real: {
    faturamento: 0.1425,   // PIS/COFINS não-cumulativo + ISS
    lucro: 0.34,           // IRPJ+CSLL sobre lucro real positivo
  },
} as const;

// Usado nos simuladores: equivale a 1 - (0.0865 + 0.0768) = 1 - 0.1633
export const FATOR_TRIBUTARIO_RECEITA = 0.8367;

export const REBATE_DEFAULT = {
  taxa_onshore: 0.006,    // 0,60% a.a.
  taxa_offshore: 0.006,   // 0,60% a.a.
  split_plataforma: 0.5,  // Galácticos retém 50%
} as const;

export const BATCH_LIMIT = 400; // margem sobre limite de 500 do Firestore

export const PLR = {
  percentual: 0.30,                   // 30% do EBITDA acumulado Jan–Dez
  provisionamento_mensal: 0.30 / 12,  // 1/12 provisionado por mês
} as const;

export const TETO_SALARIAL_PAGAMENTO_MESES = [2, 8] as const; // Fev e Ago

// ── PARÂMETROS GLOBAIS DEFAULT ─────────────────────────────────────────
export const PARAMETROS_DEFAULT: Parametros = {
  custo_juridico_mensal: 0,
  custo_conciliacao_mensal: 6500,
  taxa_rebate_onshore: 0.006,
  taxa_rebate_offshore: 0.006,
  split_plataforma: 0.5,
  horas_pacote: HORAS_PACOTE as Record<PacoteServico, Record<FuncaoAlocacao, number>>,
};

// Lista de funções de alocação (usada em iterações)
export const FUNCOES_ALOCACAO: FuncaoAlocacao[] = [
  'consultoria_gestao',
  'consultoria_planejamento',
  'consultoria_financeira',
  'operacional_financeiro',
  'serv_adm',
  'serv_aux_adm',
];
