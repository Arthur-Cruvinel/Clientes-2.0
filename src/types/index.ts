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

export type ClassificacaoCliente = 'Pure Asset' | 'Fee' | 'Híbrido' | 'Fee Isento';

export type VisaoFinanceira = 'margem_contribuicao' | 'ebitda';

// ============================================================
// Entidades de entrada (espelham documentos do Firestore)
// ============================================================

export interface Cliente {
  id?: string;
  /**
   * Identificador estável (UUID v4) imutável da entidade.
   *
   * Diferença vs docId:
   *   - docId: derivado do slug (muda se renomear)
   *   - id_estavel: gerado uma vez, nunca muda
   *
   * Use id_estavel para referências cross-coleção (cliente referenciando
   * colaborador, por exemplo). Use docId para legibilidade no console.
   *
   * Campo opcional no schema durante migração. Após Fase 3 concluída,
   * será obrigatório em novos docs.
   */
  id_estavel?: string;
  nome_cliente: string;
  empresario?: string;
  banker?: string;  // nome do banker responsável (Galápagos)

  // Receita
  receita_fee: number;

  // ── PARÂMETROS DE REBATE (taxas contratuais — estáticas) ───────────────────
  // PL usado no cálculo vem do RegistroPoupanca do período correspondente.
  // Não armazenar PL no cadastro do cliente — ele muda todo mês (CLAUDE.md).
  percentual_rebate_anual_onshore: number;
  percentual_rebate_anual_offshore?: number;
  aliquota_impostos_rebate: number;

  // Custos dedicados
  custo_contabilidade_dedicado?: number;
  custo_pagamento_dedicado?: number;
  custo_administrativo_dedicado?: number;
  custo_conciliacao_dedicado?: number;

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

  // ── PERCENTUAIS DE DEDICAÇÃO POR FUNÇÃO ────────────────────────────────────
  // Informado pelo colaborador responsável. Fração do tempo total dedicada
  // a este cliente (ex: 0.12 = 12% do mês). Pure asset → todos = 0.
  pct_consultoria_gestao: number;
  pct_consultoria_planejamento: number;
  pct_consultoria_financeira: number;
  pct_operacional_financeiro: number;
  pct_serv_adm: number;
  pct_serv_aux_adm: number;

  // ── INDICADORES DE ESCOPO (calculados pelo sistema — nunca editar) ──────────
  // fator = pct_real / pct_normativo, onde pct_normativo = HORAS_PACOTE / 168.
  // fator > 1.0 → cliente extrapolando o escopo do pacote → alerta visual.
  fator_consultoria_gestao?: number;
  fator_consultoria_planejamento?: number;
  fator_consultoria_financeira?: number;
  fator_operacional_financeiro?: number;
  fator_serv_adm?: number;
  fator_serv_aux_adm?: number;

  // Rateio de indiretos
  peso_juridico?: number;          // peso relativo para rateio jurídico (default 1.0)
  volume_movimentos_mes?: number;  // média de movimentos bancários mensais (conciliação)

  // ── VOLUMETRIA MENSAL ADICIONAL (perfil de complexidade) ──────────────────
  // Drivers do mês — alimentam calcularHorasReais. Salvos junto a
  // volume_movimentos_mes em fechamentos/{periodo}/clientes/{id}.
  qtd_recebiveis_mes?: number;
  qtd_contratacoes_mes?: number;

  // ── PERFIL DE COMPLEXIDADE (campos fixos — perene) ────────────────────────
  // Salvos em clientes_base/{slug}.perfil_complexidade. Volumetria mensal
  // (volume_movimentos_mes, qtd_recebiveis_mes, qtd_contratacoes_mes)
  // permanece em campos top-level do Cliente do período — não duplicar aqui.
  perfil_complexidade?: PerfilComplexidade;

  // Data de entrada do cliente — formato "YYYY-MM" (ex: "2025-07")
  data_entrada?: string;
}

/** Drivers de complexidade fixos (perenes) por cliente.
 *  Volumetria mensal (volume_movimentos_mes, qtd_recebiveis_mes,
 *  qtd_contratacoes_mes) NÃO está aqui — é lida direto do Cliente. */
export interface PerfilComplexidade {
  // ── VOLUMETRIA ESTRUTURAL (raramente muda) ─────────────────────────────
  grupos_financeiros: number;          // CPF/CNPJ/outros (default 1)

  // ── PATRIMÔNIO ─────────────────────────────────────────────────────────
  qtd_veiculos: number;
  qtd_imoveis: number;
  qtd_funcionarios_domesticos: number;

  // ── SERVIÇOS CONTRATADOS ───────────────────────────────────────────────
  planejamento_tributario: boolean;
  revisao_contratos: boolean;
  gestao_obra: boolean;                // dispara alerta se ativo sem cobrança
}

/** Saída de calcularHorasReais — distribuição por função + diagnósticos. */
export interface HorasReaisCalculadas {
  por_funcao: Record<FuncaoAlocacao, number>;
  total: number;
  alertas: string[];
  detalhes: Array<{
    atividade: string;
    horas: number;
    funcao: FuncaoAlocacao;
    driver_valor: number;
  }>;
}

export interface PeriodoStatus {
  periodo: string;         // "2026-03"
  fechado: boolean;
  fechado_em?: string;     // ISO string
  fechado_por?: string;    // email
  reaberto_em?: string;
  reaberto_por?: string;
  total_clientes: number;
  receita_total: number;
}

export interface AlteracaoCliente {
  campo: string;
  valor_anterior: unknown;
  valor_novo: unknown;
  alterado_em: string;    // ISO string
  alterado_por: string;   // email do usuário
}

/** Reajuste salarial registrado para um colaborador.
 *  Histórico ordenado ASC por vigencia. O motor seleciona a entrada mais
 *  recente cuja vigencia <= periodo processado (buscarTetoPorPeriodo). */
export interface ReajusteSalarial {
  vigencia: string;             // 'YYYY-MM' — primeiro mês de vigência
  salario_teto_cargo: number;   // novo teto CLT a partir desta vigência
  liquido_acordado: number;     // novo líquido acordado a partir desta vigência
  observacao?: string;          // ex: "Promoção", "Reajuste anual"
  registrado_em?: string;       // ISO timestamp do registro
  registrado_por?: string;      // nome do usuário que registrou
}

/** Resultado da busca de teto vigente para um período.
 *  fonte = 'historico' quando o valor veio de historico_reajustes;
 *  fonte = 'direto' quando caiu no fallback dos campos diretos. */
export interface ResultadoReajuste {
  salario_teto_cargo: number;
  liquido_acordado: number;
  vigencia: string;
  fonte: 'historico' | 'direto';
}

export interface Colaborador {
  id?: string;
  /**
   * Identificador estável (UUID v4) imutável da entidade.
   *
   * Diferença vs docId:
   *   - docId: derivado do slug (muda se renomear)
   *   - id_estavel: gerado uma vez, nunca muda
   *
   * Use id_estavel para referências cross-coleção (cliente referenciando
   * colaborador, por exemplo). Use docId para legibilidade no console.
   *
   * Campo opcional no schema durante migração. Após Fase 3 concluída,
   * será obrigatório em novos docs.
   */
  id_estavel?: string;
  nome_colaborador: string;
  cargo: string;
  localidade?: 'SP' | 'RJ';             // default tratado como 'SP' quando ausente
  funcao_principal: string;
  alocavel: boolean;
  tipo_vinculo?: 'clt' | 'pro_labore';  // default tratado como 'clt' quando ausente

  // Percentuais de alocação
  percentual_alocavel: number;
  percentual_institucional: number;

  // ── REMUNERAÇÃO ──────────────────────────────────────────────────────────
  // Salário CLT registrado em carteira — base dos encargos patronais.
  salario_teto_cargo: number;
  // Valor líquido acordado com o colaborador. O complemento PLR é calculado:
  // complemento = max(0, liquido_acordado − (teto − INSS − IRRF)).
  // Substitui diferenca_teto como input (CLT). Para pro_labore: ignorado
  // (motor usa salario_base direto).
  liquido_acordado?: number;
  // Número de dependentes para cálculo do IRRF (default 0).
  qtd_dependentes?: number;
  // VT/VR/plano de saúde — valor fixo, fora da base de encargos.
  beneficios_fixos: number;

  // @deprecated CLT — usar liquido_acordado. Mantido para pro_labore (base
  // mensal direta, sem complemento PLR) e para retrocompatibilidade do
  // Firestore (registros antigos ainda vivem com salario_base).
  salario_base: number;

  // ── HISTÓRICO DE REAJUSTES ───────────────────────────────────────────────
  // Lista ordenada por vigencia ASC. O motor (buscarTetoPorPeriodo) usa a
  // entrada com vigencia <= periodo processado mais recente. Se ausente,
  // cai no fallback dos campos diretos (salario_teto_cargo / liquido_acordado)
  // — retrocompatibilidade com colaboradores ainda sem histórico.
  historico_reajustes?: ReajusteSalarial[];

  // ── CAMPOS CALCULADOS (nunca editar diretamente) ─────────────────────────
  // Derivados de calcularFolhaColaborador(). Persistidos no Firestore para
  // auditoria/exibição rápida; o motor sempre recalcula a partir dos inputs.
  inss?: number;
  irrf?: number;
  complemento_plr?: number;
  reflexos_plr_mensal?: number;
  encargos_patronais?: number;          // teto × 0,28 (CLT) ou base × 0,20 (pro_labore)
  decimo_terceiro_ferias?: number;      // (teto / 12) × 1,3333 (CLT) ou 0 (pro_labore)
  custo_total_mensal: number;
  custo_hora: number;
}

/** Saída detalhada de calcularFolhaColaborador — auditoria completa do mês. */
export interface ResultadoFolha {
  // Inputs
  salario_teto_cargo: number;
  liquido_acordado: number;
  qtd_dependentes: number;

  // INSS / IRRF sobre o teto CLT
  inss: number;
  irrf: number;
  redutor_ir_2026: number;
  irrf_liquido: number;

  // Complemento PLR
  liquido_do_teto: number;
  complemento_plr: number;
  reflexos_plr_mensal: number;

  // Encargos patronais sobre o teto CLT
  encargos_patronais: number;
  decimo_terceiro_ferias: number;

  // Custo total
  custo_total_mensal: number;
  custo_hora: number;
}

export interface CustoIndireto {
  id?: string;
  /**
   * Identificador estável (UUID v4) imutável da entidade.
   *
   * Diferença vs docId:
   *   - docId: derivado do slug (muda se renomear)
   *   - id_estavel: gerado uma vez, nunca muda
   *
   * Use id_estavel para referências cross-coleção (cliente referenciando
   * colaborador, por exemplo). Use docId para legibilidade no console.
   *
   * Campo opcional no schema durante migração. Após Fase 3 concluída,
   * será obrigatório em novos docs.
   */
  id_estavel?: string;
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
  pl_inicial_offshore_usd?: number;
  // Starting Value USD direto da lâmina offshore.
  // Diferente de pl_offshore_usd (que é o ending).
  // Inclui accrued interest do mês anterior.
  ptax_fechamento?: number;

  // Movimentação
  aporte_mes_onshore: number;
  aporte_mes_offshore: number;
  aporte_mes_total: number;

  // Rentabilidade
  rentabilidade_onshore?: number;    // percentual decimal (ex: 0.003054)
  rentabilidade_offshore?: number;   // valor absoluto em BRL
  rentabilidade_pct_offshore?: number; // percentual decimal da lâmina (coluna MONTH, ex: 0.0041)
  rentabilidade_total?: number;      // valor absoluto em BRL (ex: 142748.55)
  rentabilidade_pct?: number;        // percentual decimal consolidado

  // Impostos pagos no mês (coluna D da lâmina Comdinheiro onshore)
  // Valor positivo em BRL — IR, IOF, come-cotas etc. retidos no mês.
  impostos_mes?: number;

  // Marca de revisão pendente para este mês específico (true/false).
  // Usado para destacar registros que precisam ser revisados manualmente.
  // Preservado pelo merge do Firestore mesmo após reimport da lâmina.
  revisao_pendente?: boolean;

  // Tombamento (portabilidade)
  nnm_tombamento?: number;           // consolidado (legado, mantido por compatibilidade)
  nnm_tombamento_onshore?: number;   // tombamento onshore
  nnm_tombamento_offshore?: number;  // tombamento offshore

  // Transferência interna entre contas do MESMO cliente (ex: conta A → conta B
  // offshore). Não é poupança, não é tombamento, não é rentabilidade — é
  // reorganização. Subtraída do `aporte_mes_*` para chegar ao NNM real
  // (alimentação do MM6, burn rate, projeção). Manual via DetalheLinhaEdit.
  // Convenção: positivo = saída da conta visível na lâmina, negativo = entrada.
  transferencia_interna_onshore?: number;   // default 0 quando ausente
  transferencia_interna_offshore?: number;  // default 0 quando ausente

  // Metas
  sem_capacidade_poupanca: boolean;
  capacidade_poupanca_mensal?: number;
  meta_poupanca_mensal?: number;

  // Período parcial (para comparação justa com benchmark)
  dia_inicio?: number | null;  // dia do mês em que a carteira abriu (tombamento).
                               // null = começou no dia 1.
  dia_corte?: number | null;   // último dia com dado disponível (lâmina parcial).
                               // null = mês completo.
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

/** Resultado da nova engine (Fase 2) — DRE clean por cliente */
export interface ResultadoCliente {
  nome_cliente: string;
  pacote_servico: string;
  perfil: 'fee_based' | 'pure_asset' | 'hibrido' | 'fee_isento';

  // Receita
  receita_fee: number;
  receita_rebate: number;
  receita_bruta: number;
  // Para clientes fee_isento: fee de referência para análise de rentabilidade
  // do desconto concedido. Por ora = 0 (pendente integração com Propostas).
  fee_potencial?: number;

  // Impostos
  impostos_faturamento: number;
  impostos_lucro: number;

  // Custos
  custo_direto: number;
  custo_dedicado: number;
  // Detalhamento do custo dedicado por componente — usado pelos consumidores
  // legacy (CustoDiretoModal, coluna "Custo Dedicado" da Visão Geral).
  custo_dedicado_contabilidade: number;
  custo_dedicado_pagamento: number;
  custo_dedicado_administrativo: number;
  custo_indireto_rateado: number;
  custo_total: number;

  // Resultado
  ebitda: number;
  margem_ebitda: number;
  lucro_liquido: number;
  margem_liquida: number;

  // Indicadores de escopo
  fatores_escopo: Record<FuncaoAlocacao, number>;
  algum_fator_acima_limite: boolean;
}

/** Wrapper exposto pelo AppContext: motor + dados de referência + totais agregados. */
export interface DadosPeriodo {
  // Resultados calculados pelo motor financeiro
  resultados: ResultadoCliente[];

  // Dados de referência (necessários para consumidores)
  clientes: Cliente[];
  colaboradores: Colaborador[];
  custosIndiretos: CustoIndireto[];

  // Fonte de PL do período (CLAUDE.md — decisão arquitetural).
  registrosPoupanca: RegistroPoupanca[];

  // Totais consolidados (calculados uma vez no pipeline)
  totais: {
    receita_bruta: number;
    custo_total: number;
    ebitda: number;
    lucro_liquido: number;
    margem_ebitda: number;
    margem_liquida: number;
  };

  // Metadados do período
  parametros: {
    periodo: string;
    regime: 'presumido' | 'real';
  };
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
  moeda: 'BRL' | 'USD' | 'EUR' | 'GBP';
  valor_brl?: number;
  data_referencia: string;   // "YYYY-MM-DD"
  rentabilidade_anual?: number;
  notas?: string;
  gestao_galaticos?: boolean; // true = sob gestão Galácticos (compõe AUM sob Gestão)
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
