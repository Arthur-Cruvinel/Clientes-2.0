// --- Interfaces TypeScript do domínio Galácticos CFO ---
// Fonte da verdade: CLAUDE.md — modelo de pacotes com fatores por função.

// ============================================================
// Tipos auxiliares
// ============================================================

export type FuncaoAlocacao =
  | 'consultoria_gestao'
  | 'consultoria_planejamento'
  | 'consultoria_financeira'
  | 'operacional_financeiro'
  | 'serv_adm'
  | 'serv_aux_adm';

export type PacoteServico = 'full' | 'advanced' | 'light' | 'future' | 'asset_only';

export type RegimeTributario = 'presumido' | 'real';

export type ClassificacaoCliente = 'Pure Asset' | 'Fee' | 'Híbrido';

export type VisaoFinanceira = 'margem_contribuicao' | 'ebitda';

// ============================================================
// Entidades de entrada (espelham documentos do Firestore)
// ============================================================

export interface Cliente {
  id?: string;
  nome_cliente: string;
  empresario?: string;
  banker?: string;  // nome do banker responsável (Galápagos)

  // Receita
  receita_fee: number;

  // Patrimônio onshore
  pl_onshore: number;
  percentual_rebate_anual_onshore: number;

  // Patrimônio offshore
  pl_offshore?: number;
  pl_offshore_usd?: number;
  ptax_fechamento?: number;
  percentual_rebate_anual_offshore?: number;
  aliquota_impostos_rebate: number;

  // Custos dedicados
  custo_contabilidade_dedicado?: number;
  custo_pagamento_dedicado?: number;
  custo_administrativo_dedicado?: number;

  // Flags de serviço
  utiliza_servico_juridico: boolean;
  utiliza_conciliacao: boolean;

  // Pacote de serviço — define horas-direito por função
  pacote_servico: PacoteServico;

  // Colaborador responsável por função
  consultoria_gestao?: string;
  consultoria_planejamento?: string;
  consultoria_financeira?: string;
  operacional_financeiro?: string;
  serv_adm?: string;
  serv_aux_adm?: string;

  // Fator de utilização por função (0.0 a 2.0)
  fator_consultoria_gestao: number;
  fator_consultoria_planejamento: number;
  fator_consultoria_financeira: number;
  fator_operacional_financeiro: number;
  fator_serv_adm: number;
  fator_serv_aux_adm: number;

  // Horas reativas do mês (atribuídas à consultoria_gestao)
  horas_reativas_mes?: number;

  // Rateio de indiretos
  peso_juridico?: number;          // peso relativo para rateio jurídico (default 1.0)
  volume_movimentos_mes?: number;  // média de movimentos bancários mensais (conciliação)
}

export interface Colaborador {
  id?: string;
  nome_colaborador: string;
  cargo: string;
  funcao_principal: string;
  alocavel: boolean;

  // Percentuais de alocação
  percentual_alocavel: number;
  percentual_institucional: number;

  // Composição salarial
  salario_base: number;
  beneficios_fixos: number;
  encargos_patronais: number;
  decimo_terceiro_ferias: number;

  // Campos calculados — nunca editar diretamente
  custo_total_mensal: number;
  custo_hora: number;

  // Teto salarial
  salario_teto_cargo: number;
  diferenca_teto: number;
}

export interface CustoIndireto {
  id?: string;
  descricao_custo: string;
  valor_mensal: number;
  tipo_custo: 'geral' | 'juridico' | 'conciliacao';
}

export interface RegistroPoupanca {
  id?: string;
  nome_cliente: string;
  ano: number;
  mes: number;

  // PL atual em BRL
  pl_onshore: number;
  pl_offshore: number;
  pl_total: number;

  // PL inicial (saldo de abertura do mês)
  pl_inicial_onshore?: number;
  pl_inicial_offshore?: number;
  pl_inicial_total?: number;

  // Valores offshore originais
  pl_offshore_usd?: number;
  ptax_fechamento?: number;

  // Movimentação
  aporte_mes_onshore: number;
  aporte_mes_offshore: number;
  aporte_mes_total: number;

  // Rentabilidade
  rentabilidade_onshore?: number;    // percentual decimal (ex: 0.003054)
  rentabilidade_offshore?: number;   // percentual decimal
  rentabilidade_total?: number;      // valor absoluto em BRL (ex: 142748.55)
  rentabilidade_pct?: number;        // percentual decimal consolidado

  // Tombamento (portabilidade)
  nnm_tombamento?: number;  // parcela do aporte que é portabilidade

  // Metas
  sem_capacidade_poupanca: boolean;
  capacidade_poupanca_mensal?: number;
  meta_poupanca_mensal?: number;
}

// ============================================================
// Parâmetros globais configuráveis
// ============================================================

export interface Parametros {
  custo_juridico_mensal: number;
  custo_conciliacao_mensal: number;
  taxa_rebate_onshore: number;
  taxa_rebate_offshore: number;
  split_plataforma: number;
  horas_pacote: Record<PacoteServico, Record<FuncaoAlocacao, number>>;
}

// ============================================================
// Detalhamento de custo direto por cliente
// ============================================================

export interface LinhaMaoDeObra {
  funcao: FuncaoAlocacao;
  responsavel: string;
  horasDireito: number;
  fator: number;
  horasEfetivas: number;
  custoHora: number;
  total: number;
}

export interface DetalhesCustoDireto {
  maoDeObra: number;
  juridico: number;
  conciliacao: number;
  contabilidade: number;
  pagamento: number;
  administrativo: number;
  total: number;
  linhasMaoDeObra: LinhaMaoDeObra[];
}

// ============================================================
// Resultado do processamento financeiro
// ============================================================

/** Resultado calculado para cada cliente após o processamento financeiro */
export interface DadosCliente extends Cliente {
  // Receitas
  receita_fee_mensal: number;
  receita_rebate: number;
  receita_bruta: number;

  // Custos
  custo_direto: number;
  custo_dedicado: number;
  custo_indireto_rateado: number;
  custo_total: number;

  // Impostos
  impostos_faturamento: number;
  impostos_lucro: number;

  // Resultado
  margem_contribuicao: number;  // Receita - Impostos - CustoDireto - CustoDedicado
  ebitda: number;               // MargemContribuicao - CustoIndireto
  margem: number;

  // Classificação
  classificacao: ClassificacaoCliente;

  // Detalhamento
  horas_totais: number;
  custo_direto_detalhe: DetalhesCustoDireto;
}

/** Totais agregados do período */
export interface TotaisPeriodo {
  receita_bruta_total: number;
  receita_fee_total: number;
  receita_rebate_total: number;
  custo_direto_total: number;
  custo_dedicado_total: number;
  custo_indireto_total: number;
  impostos_faturamento_total: number;
  impostos_lucro_total: number;
  margem_contribuicao_total: number;
  ebitda_total: number;
  margem_media: number;
  total_clientes: number;
  clientes_positivos: number;
  clientes_negativos: number;
}

/** Resultado completo do processamento de um período */
export interface ResultadoProcessamento {
  dados: DadosCliente[];
  totais: TotaisPeriodo;
  colaboradores: Colaborador[];
  custosIndiretos: CustoIndireto[];
  parametros: Parametros;
  metadata: {
    periodo: string;
    regime: RegimeTributario;
    processado_em: Date;
  };
}

// ============================================================
// Patrimônio
// ============================================================

export type CustodiaExterna = 'morgan_stanley' | 'xp' | 'btg' | 'bradesco' | 'outro';
export type TipoInvestimento = 'renda_fixa' | 'renda_variavel' | 'fundo' | 'previdencia' | 'outro';
export type TipoImovel = 'residencial' | 'comercial' | 'rural' | 'terreno';
export type TipoPassivo = 'financiamento_imovel' | 'financiamento_veiculo' | 'emprestimo' | 'cartao' | 'outro';
export type SistemaAmortizacao = 'SAC' | 'PRICE' | 'outro';
export type TipoOutroBem = 'arte' | 'joias' | 'participacao_societaria' | 'direitos' | 'criptoativo' | 'outro';

export interface InvestimentoExterno {
  id?: string;
  custodia: CustodiaExterna;
  instituicao?: string;
  descricao: string;
  tipo: TipoInvestimento;
  valor: number;
  moeda: 'BRL' | 'USD' | 'EUR';
  valor_brl?: number;
  data_referencia: string;
  rentabilidade_anual?: number;
  notas?: string;
}

export interface Imovel {
  id?: string;
  descricao: string;
  tipo: TipoImovel;

  // Localização
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf: string;
  cep?: string;

  // Características físicas
  area_total_m2?: number;
  area_privativa_m2?: number;
  quartos?: number;
  banheiros?: number;
  vagas_garagem?: number;
  andar?: number;
  padrao_acabamento?: 'simples' | 'medio' | 'alto' | 'luxo';

  // Estado
  ano_construcao?: number;
  estado_conservacao?: 'otimo' | 'bom' | 'regular' | 'ruim';

  // Uso
  uso_atual?: 'proprio' | 'alugado' | 'vazio' | 'temporada';

  // Valores
  valor_mercado: number;
  valor_compra?: number;
  data_compra?: string;
  valor_aluguel?: number;
  valor_contabil?: number;

  // Outros
  planejamento_sucessorio?: string;
  notas?: string;

  // Estimativa IA
  metodo_estimativa_imovel?: 'manual' | 'claude_ai';
  estimativa_claude?: {
    valor: number;
    faixa_min: number;
    faixa_max: number;
    justificativa: string;
    data: string;
  };
}

export interface Veiculo {
  id?: string;
  marca: string;
  modelo: string;
  ano_modelo: number;
  ano_fabricacao: number;
  fipe_codigo?: string;
  fipe_referencia?: string;
  valor_fipe?: number;
  valor_mercado_manual?: number;
  placa?: string;
  notas?: string;
}

export interface OutroBem {
  id?: string;
  descricao: string;
  tipo: TipoOutroBem;
  valor_estimado: number;
  metodo_estimativa: 'manual' | 'claude_ai';
  prompt_usado?: string;
  notas?: string;
  data_estimativa?: string;
}

export interface Passivo {
  id?: string;
  tipo: TipoPassivo;
  credor: string;
  descricao: string;
  saldo_devedor: number;
  taxa_juros_mensal: number;
  sistema_amortizacao: SistemaAmortizacao;
  parcela_atual: number;
  parcelas_restantes: number;
  data_inicio: string;
  data_fim: string;
  bem_vinculado?: string;
}

export interface PatrimonioCliente {
  cliente_nome: string;
  cliente_slug: string;
  investimentos: InvestimentoExterno[];
  imoveis: Imovel[];
  veiculos: Veiculo[];
  outros_bens: OutroBem[];
  passivos: Passivo[];
  atualizado_em?: string;
}
