// --- Atividades de serviço — drivers e horas-base por atividade ---
// Fonte: R9_Modelo_Precificação (Processos e Atividades, Galácticos 2024).
// Usadas por calcularHorasReais para estimar horas reais por cliente.
//
// Convenção de drivers:
//   fixo               → horas constantes, independente de volume
//   boolean            → flag liga/desliga (boolean_campo aponta para PerfilComplexidade)
//   vol_movimentos     → escala por cliente.volume_movimentos_mes ÷ driver_base
//   qtd_*              → escala linearmente por contagem (perfil.qtd_*)
//   grupos_financeiros → reservado para uso futuro (sem atividade ativa hoje)
// gestao_obra é tratado FORA do loop em calcularHorasReais (alerta puro,
// sem horas-base normativas) — por isso não consta neste record.

import type { FuncaoAlocacao, PerfilComplexidade } from '../types';

export type DriverAtividade =
  | 'fixo'
  | 'boolean'
  | 'vol_movimentos'
  | 'qtd_veiculos'
  | 'qtd_imoveis'
  | 'qtd_func_domesticos'
  | 'qtd_recebiveis'
  | 'qtd_contratacoes'
  | 'grupos_financeiros';

export interface AtividadeServico {
  horas_base: number;
  driver: DriverAtividade;
  driver_base?: number;
  funcao: FuncaoAlocacao;
  boolean_campo?: keyof PerfilComplexidade;
  alerta?: string;
}

// Volume padrão de movimentos (denominador do driver vol_movimentos).
export const VOLUME_MOVIMENTOS_PADRAO = 350;

export const ATIVIDADES_SERVICO: Record<string, AtividadeServico> = {
  // ── OPERACIONAL FINANCEIRO ──────────────────────────────────────────────
  pagamento_contas: {
    horas_base: 33.88, driver: 'vol_movimentos', driver_base: VOLUME_MOVIMENTOS_PADRAO,
    funcao: 'operacional_financeiro',
  },
  // Fórmula especial em calcularHorasReais: horas = volume × 0,5 / 60.
  fluxo_caixa: {
    horas_base: 0, driver: 'vol_movimentos', driver_base: 1,
    funcao: 'operacional_financeiro',
  },
  gestao_recebiveis: {
    horas_base: 0.5, driver: 'qtd_recebiveis', driver_base: 1,
    funcao: 'operacional_financeiro',
  },
  gestao_despesas: {
    horas_base: 6.20, driver: 'fixo', funcao: 'operacional_financeiro',
  },

  // ── SERV. ADMINISTRATIVO ────────────────────────────────────────────────
  gestao_veiculos: {
    horas_base: 2.81, driver: 'qtd_veiculos', driver_base: 1, funcao: 'serv_adm',
  },
  gestao_imoveis: {
    horas_base: 3.94, driver: 'qtd_imoveis', driver_base: 1, funcao: 'serv_adm',
  },
  gestao_funcionarios_domesticos: {
    horas_base: 2.00, driver: 'qtd_func_domesticos', driver_base: 1, funcao: 'serv_adm',
  },
  gestao_documentos: {
    horas_base: 2.62, driver: 'fixo', funcao: 'serv_adm',
  },
  organizacao_documental: {
    horas_base: 2.33, driver: 'fixo', funcao: 'serv_adm',
  },
  contratacao_servicos: {
    horas_base: 3.50, driver: 'qtd_contratacoes', driver_base: 1, funcao: 'serv_adm',
  },
  acompanhamento_dividas: {
    horas_base: 2.69, driver: 'fixo', funcao: 'serv_adm',
  },

  // ── CONSULTORIA FINANCEIRA ──────────────────────────────────────────────
  relatorio_financeiro: {
    horas_base: 2.03, driver: 'fixo', funcao: 'consultoria_financeira',
  },
  planejamento_tributario: {
    horas_base: 13.00, driver: 'boolean', boolean_campo: 'planejamento_tributario',
    funcao: 'consultoria_financeira',
  },
  orcamento_anual: {
    horas_base: 0.33, driver: 'fixo', funcao: 'consultoria_financeira',
  },
  revisao_contratos: {
    horas_base: 6.17, driver: 'boolean', boolean_campo: 'revisao_contratos',
    funcao: 'consultoria_financeira',
    alerta: 'Revisão de contratos ativa sem pacote jurídico — verificar cobrança',
  },

  // ── CONSULTORIA GESTÃO ──────────────────────────────────────────────────
  assessoria_patrimonial: {
    horas_base: 3.17, driver: 'fixo', funcao: 'consultoria_gestao',
  },
  solicitacoes_emergencia: {
    horas_base: 6.67, driver: 'fixo', funcao: 'consultoria_gestao',
  },
} as const;
