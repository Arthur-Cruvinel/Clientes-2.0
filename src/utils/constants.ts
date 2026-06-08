// --- Constantes Financeiras ---

import type { PacoteServico, FuncaoAlocacao, Parametros } from '../types';

// ── HORAS PRODUTIVAS CLT ──────────────────────────────────────────────────
// Base: regime CLT, 44h semanais, 52 semanas/ano.
// Carnaval: ponto facultativo adotado pela Galácticos (seg + ter).
// Feriados municipais: SP (25/jan, 09/jul) e RJ (20/jan, 23/abr).
// Metodologia auditável — ver CLAUDE.md (Metodologia — Horas Produtivas CLT).

export const SEMANAS_ANO = 52;
export const HORAS_SEMANAIS_CLT = 44;
export const HORAS_DIA_UTIL = HORAS_SEMANAIS_CLT / 5;                   // 8,8h
export const HORAS_FERIAS_ANO = HORAS_SEMANAIS_CLT * (30 / 7);          // ~188h

export const FERIADOS_POR_LOCALIDADE: Record<string, number> = {
  SP: 15,   // 11 nacionais + 2 municipais (25/jan, 09/jul) + 2 carnaval
  RJ: 15,   // 11 nacionais + 2 municipais (20/jan, 23/abr) + 2 carnaval
};

export const HORAS_BRUTAS_ANO = SEMANAS_ANO * HORAS_SEMANAIS_CLT;       // 2.288h

export const HORAS_PRODUTIVAS_POR_LOCALIDADE: Record<string, number> = {
  SP: HORAS_BRUTAS_ANO - HORAS_FERIAS_ANO
      - (FERIADOS_POR_LOCALIDADE.SP * HORAS_DIA_UTIL),                  // ~1.968h
  RJ: HORAS_BRUTAS_ANO - HORAS_FERIAS_ANO
      - (FERIADOS_POR_LOCALIDADE.RJ * HORAS_DIA_UTIL),                  // ~1.968h
};

export const HORAS_PRODUTIVAS_MES_POR_LOCALIDADE: Record<string, number> = {
  SP: HORAS_PRODUTIVAS_POR_LOCALIDADE.SP / 12,
  RJ: HORAS_PRODUTIVAS_POR_LOCALIDADE.RJ / 12,
};

// ── TABELAS PREVIDENCIÁRIAS ───────────────────────────────────────────────
// Atualizar anualmente. Sempre usar a tabela do ano vigente da folha
// (ANO_FOLHA_VIGENTE). As faixas terminam no teto previdenciário —
// salários acima do teto resultam naturalmente no INSS-teto, sem precisar
// de faixa Infinity (que duplicaria a 14% acima do teto e violaria o teto).
//   INSS 2026: teto previdenciário R$ 988,09 (atinge-se em R$ 8.475,55)
//   IRRF 2026: alíquotas vigentes desde jan/2026

export interface FaixaINSS { ate: number; aliquota: number; }
export interface FaixaIRRF { ate: number; aliquota: number; deducao: number; }

export const TABELA_INSS: Record<number, FaixaINSS[]> = {
  2025: [
    { ate: 1518.00, aliquota: 0.075 },
    { ate: 2793.88, aliquota: 0.090 },
    { ate: 4190.83, aliquota: 0.120 },
    { ate: 8157.41, aliquota: 0.140 },  // teto 2025 → R$ 951,63
  ],
  2026: [
    { ate: 1621.00, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.090 },
    { ate: 4354.27, aliquota: 0.120 },
    { ate: 8475.55, aliquota: 0.140 },  // teto 2026 → R$ 988,09
  ],
};

export const TABELA_IRRF: Record<number, FaixaIRRF[]> = {
  2025: [
    { ate: 2259.20,  aliquota: 0,     deducao: 0      },
    { ate: 2826.65,  aliquota: 0.075, deducao: 169.44 },
    { ate: 3751.05,  aliquota: 0.150, deducao: 381.44 },
    { ate: 4664.68,  aliquota: 0.225, deducao: 662.77 },
    { ate: Infinity, aliquota: 0.275, deducao: 896.00 },
  ],
  2026: [
    { ate: 2428.80,  aliquota: 0,     deducao: 0      },
    { ate: 2826.65,  aliquota: 0.075, deducao: 182.16 },
    { ate: 3751.05,  aliquota: 0.150, deducao: 394.16 },
    { ate: 4664.68,  aliquota: 0.225, deducao: 675.49 },
    { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
  ],
};

// Redutor adicional IRRF 2026 — isenção até R$ 5.000 por mês.
// Fonte: gov.br/secom (vigente desde jan/2026).
//   renda ≤ 5.000      → R$ 312,89
//   5.000 < renda ≤ 7.350 → max(0, 978,62 − 0,133145 × renda)
//   renda > 7.350      → 0
export const REDUTOR_IR_2026 = {
  ate_5000: 312.89,
  formula: (renda: number): number =>
    renda <= 5000
      ? 312.89
      : renda <= 7350
        ? Math.max(0, 978.62 - 0.133145 * renda)
        : 0,
};

export const DEDUCAO_DEPENDENTE_IRRF: Record<number, number> = {
  2025: 189.59,
  2026: 189.59,
};

// Ano vigente da folha — atualizar todo janeiro.
export const ANO_FOLHA_VIGENTE = 2026;

// Compatibilidade — HORAS_CLT_MES segue sendo usado em HORAS_PACOTE (pct_normativo).
// Para custo/hora usar HORAS_PRODUTIVAS_POR_LOCALIDADE.
export const HORAS_CLT_MES = 168;

// ── CATEGORIAS DE CUSTO INDIRETO (DRE) ─────────────────────────────────────
// FONTE ÚNICA de vocabulário E identidade dos custos indiretos. As 5 categorias
// são canônicas e fixas (todas tipo_custo='geral'); a tela de Custos Indiretos
// só edita o valor_mensal de cada uma no período aberto — nunca cria/exclui.
//
// Cada categoria carrega seu par (docId, id_estavel) CANÔNICO — os mesmos já
// gravados em produção nos 5 períodos (Dez/25–Abr/26). id_estavel é propriedade
// da CATEGORIA, não do período: "Marketing" tem o mesmo id_estavel em todo mês.
//
// Por que fixar AMBOS (docId + id_estavel), e não só o id_estavel: os 5 docs de
// produção têm docId ≠ id_estavel. Se o seed usasse docId = id_estavel, períodos
// novos divergiriam dos atuais e a propagação criaria docs paralelos (bifurcação
// de identidade). Com o docId canônico fixo aqui, TODO período — presente ou
// futuro semeado — usa o mesmo par por categoria, sem bifurcar.
//
// Seed: setDoc em custosIndiretos/{docId} com id_estavel da constante e
//       valor_mensal:0 (idempotente — re-semear sobrescreve o mesmo doc).
// Propagação: casa por id_estavel canônico; grava no docId canônico do destino.
// Edição: updateDoc pelo docId real do doc carregado, só valor_mensal.
export const CATEGORIAS_CUSTO_INDIRETO = [
  { descricao_custo: 'Administrativo/Predial', tipo_custo: 'geral',
    id_estavel: '06ce4059-c281-4c05-8e20-1fbf40c5c5e2', docId: 'd00823cf-b021-45f3-9959-525711cd1644' },
  { descricao_custo: 'Contabilidade', tipo_custo: 'geral',
    id_estavel: 'a4653825-ebf5-4a03-ab9e-d622f76b109f', docId: 'fa1d1acc-c588-46c2-8de3-a21c8165039f' },
  { descricao_custo: 'Marketing', tipo_custo: 'geral',
    id_estavel: '3fa4c944-1761-489c-b7a5-1bb470474a86', docId: '100016b9-9741-4676-8328-536aadb459d2' },
  { descricao_custo: 'Tecnologia', tipo_custo: 'geral',
    id_estavel: '419d664c-fb49-44e0-83f4-6935916c104d', docId: '283a1d93-c334-4ba7-b204-f457e7723cf6' },
  { descricao_custo: 'Viagens', tipo_custo: 'geral',
    id_estavel: '50d49df4-323e-4e11-8abb-f924c6d3db64', docId: '8d2f70e9-881f-4553-a9b1-cec88ef3ebfe' },
] as const;

// ── PACOTES DE SERVIÇO ─────────────────────────────────────────────────────
// Horas de referência normativa por função para cada pacote.
// Usadas exclusivamente para o indicador de escopo (fator_):
//   pct_normativo = horas_pacote[funcao] / HORAS_CLT_MES
//   fator         = pct_dedicado_real / pct_normativo
// NÃO são a base do cálculo de custo direto — esse usa pct_ × custo_total_mensal.
// Fonte: planilha de Processos e Atividades (Galácticos Capital, 2024).

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

/**
 * Funções principais dos colaboradores no Galácticos CFO.
 *
 * Vinculadas aos 6 tipos de serviço oferecidos + 'institucional'
 * para sócios (papel principal é institucional, mas podem ter
 * alocação parcial em clientes específicos via campos pct_* do cliente).
 *
 * Esta lista é fechada e canônica. Qualquer mudança aqui exige
 * coordenação com Princípio 7 (cliente refere colaborador por id_estavel)
 * e com a lógica de alocação em Perfil/Colaboradores.
 */
export const FUNCOES_PRINCIPAIS = [
  'consultoria_gestao',
  'consultoria_planejamento',
  'consultoria_financeira',
  'operacional_financeiro',
  'serv_adm',
  'serv_aux_adm',
  'institucional',
] as const;

export type FuncaoPrincipal = typeof FUNCOES_PRINCIPAIS[number];
