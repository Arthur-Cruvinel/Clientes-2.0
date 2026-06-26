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

// Moeda em que o fee do cliente é contratado. Fee em moeda estrangeira é
// convertido para BRL na gravação (PTAX do dia anterior) — o pipeline de DRE
// sempre lê receita_fee já em BRL.
export type MoedaFee = 'BRL' | 'USD' | 'EUR' | 'GBP';

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
  /** @deprecated A alíquota de retenção do rebate agora é GLOBAL e por perna
   *  (parametros.aliquota_rebate_onshore/offshore). Este campo por cliente está
   *  APOSENTADO — o motor não o lê mais. Permanece opcional/inerte no banco até
   *  uma limpeza dedicada (BACKLOG). Nenhuma UI escreve nele. */
  aliquota_impostos_rebate?: number;

  // Custos dedicados
  custo_contabilidade_dedicado?: number;
  custo_pagamento_dedicado?: number;
  custo_administrativo_dedicado?: number;
  custo_viagem_dedicado?: number;       // gasto de viagem lançado no cliente que o originou
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

  // ── FEE EM MOEDA ESTRANGEIRA ──────────────────────────────────────────────
  // moeda_fee = moeda em que o fee foi contratado (default BRL). Quando ≠ BRL,
  // receita_fee é gravado já convertido em BRL (PTAX do dia anterior) — o
  // pipeline de DRE nunca precisa converter. Os campos *_original + ptax_usado
  // preservam a trilha de auditoria da conversão para reedição/exibição.
  moeda_fee?: MoedaFee;
  receita_fee_original?: number;   // fee na moeda original, antes da conversão
  moeda_fee_original?: string;     // moeda aplicada na conversão gravada
  ptax_usado?: number;             // PTAX (venda) do dia da gravação usada na conversão

  // ── VIGÊNCIA FORWARD-ONLY DOS CAMPOS CONTRATUAIS (Tier A) ────────────────────
  // Histórico de vigências dos campos que mudam por reajuste (fee, moeda+trilha,
  // taxas de rebate, contabilidade, pagamento). Vive no master clientes_base/;
  // resolvido na LEITURA por resolverClientePorPeriodo (overlay no AppContext).
  // Vazio → tudo cai nos campos diretos acima (retrocompat TOTAL — sem migração).
  // NÃO inclui custo_administrativo_dedicado (já é por período em custosDedicados/)
  // nem Tier B (pacote_servico, flags). Ver VigenciaCliente.
  historico_vigencia_cliente?: VigenciaCliente[];
}

/** Entrada de vigência forward-only dos campos contratuais (Tier A) do cliente.
 *  Espelha ReajusteSalarial: cada entrada vale A PARTIR de `vigencia` ('YYYY-MM')
 *  e segue valendo até a próxima entrada que REDEFINA aquele campo. Resolução POR
 *  CAMPO (resolverClientePorPeriodo): a vigência mais recente <= período que
 *  DEFINE o campo vence; sem entrada que o defina <= período → cai no campo
 *  direto do cliente (baseline). Bundle, não escalar: uma entrada pode mudar só o
 *  fee, ou fee+rebate juntos. Diferente da folha, NÃO há materialização por
 *  período — o cliente tem master único; o snapshot de período fechado carrega o
 *  array via fecharPeriodo. */
export interface VigenciaCliente {
  vigencia: string;                          // 'YYYY-MM' — primeiro mês de vigência
  receita_fee?: number;                      // já em BRL (mesma semântica do campo direto)
  moeda_fee?: MoedaFee;
  receita_fee_original?: number;
  moeda_fee_original?: string;
  ptax_usado?: number;
  percentual_rebate_anual_onshore?: number;
  percentual_rebate_anual_offshore?: number;
  custo_contabilidade_dedicado?: number;
  custo_pagamento_dedicado?: number;
  observacao?: string;
  registrado_em?: string;
  registrado_por?: string;
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
  /** Período 'YYYY-MM' da alteração. Preenchido para campos que viraram
   *  VARIÁVEIS por período (ex.: custo_administrativo_dedicado) — sem isso o
   *  histórico ficaria órfão (não diria a qual mês a mudança se refere).
   *  Ausente para campos cadastrais perenes (continuam mono-instância). */
  periodo?: string;
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
  tipo_vinculo?: 'clt' | 'pro_labore' | 'estagio';  // default tratado como 'clt' quando ausente

  // ── CICLO DE VIDA / STATUS ───────────────────────────────────────────────
  // ativo/funcoes_secundarias/cadastro_completo já existem nos dados desde a
  // migração Fase 2 — declarados aqui para deixarem de ser órfãos (a Fase 3B
  // de tipos para colaboradores ficou pendente). Todos OPCIONAIS: ausência de
  // `ativo` = tratado como ATIVO (retrocompat com docs pré-migração / criados
  // sem o campo).
  //
  // MODELO (fechado com o CFO — NÃO violar): demissão = `ativo:false` +
  // `data_demissao` (os dois juntos). O demitido PERMANECE no mês da saída
  // (custo real do fechamento) e some só dos meses POSTERIORES. Por isso
  // `ativo` NÃO é filtro do cálculo do período corrente — é sinal para a
  // PROPAGAÇÃO PARA FRENTE (omitir inativo no próximo mês — Passo 4).
  ativo?: boolean;
  data_admissao?: string;   // 'YYYY-MM' (convenção do projeto — ver Cliente.data_entrada)
  data_demissao?: string;   // 'YYYY-MM'
  funcoes_secundarias?: FuncaoAlocacao[];
  cadastro_completo?: boolean;

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

  // ── DETALHAMENTO DE BENEFÍCIOS (opcional) ────────────────────────────────
  // INVARIANTE: beneficios_fixos = vale_alimentacao + vale_transporte
  //           + plano_saude + outros_beneficios.
  // Só `beneficios_fixos` entra no custo (o motor lê apenas ele); os 4 abaixo
  // são detalhamento e são derivados na UI (beneficios_fixos = soma, read-only).
  // Opcionais para retrocompat com docs legados que só têm beneficios_fixos —
  // herança: vale_alimentacao recebe o total, demais = 0.
  vale_alimentacao?: number;
  vale_transporte?: number;
  plano_saude?: number;
  outros_beneficios?: number;

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

/**
 * Custo dedicado VARIÁVEL POR PERÍODO de um cliente.
 *
 * Mora em `fechamentos/{periodo}/custosDedicados/{id_estavel_cliente}` — sub-coleção
 * própria, PARALELA a `custosIndiretos` (não dentro dele): custo dedicado é custo
 * DIRETO do cliente, não entra no pool de rateio dos indiretos.
 *
 * Motivação: `custo_administrativo_dedicado` era mono-instância no master
 * (`clientes_base/`) — editar um mês sobrescrevia todos. Agora cada período tem o
 * seu próprio valor. O campo antigo no doc de cliente permanece (ainda lido pelo
 * pipeline) até a virada de leitura ser feita num passo futuro.
 *
 * Identidade: `docId = id_estavel_cliente` (UUID v4), NUNCA o slug — evita a
 * bifurcação UUID-vs-slug de `clientes/`. `nome_cliente` é só conveniência de
 * leitura/console; a FONTE DA VERDADE da identidade é `id_estavel`, e em qualquer
 * divergência de grafia o nome canônico de `clientes_base/` prevalece.
 *
 * Escopo atual: SOMENTE `custo_administrativo_dedicado`. Contabilidade e pagamento
 * não entram aqui por ora (decisão explícita).
 */
export interface CustoDedicado {
  id?: string;                          // docId quando lido (== id_estavel_cliente)
  id_estavel_cliente: string;           // UUID v4 — chave canônica (Decisão 3: nunca por nome)
  nome_cliente: string;                 // denormalizado p/ leitura; clientes_base/ é o canônico
  custo_administrativo_dedicado: number;
}

export interface RegistroPoupanca {
  id?: string;
  nome_cliente: string;
  ano: number;
  mes: number;

  // Estado de quarentena (Frente 1 — correção de siglas órfãs).
  // Quando o onshore não resolve a sigla via resolverSigla, o registro é
  // gravado com status='pendente_normalizacao' + sigla_bruta_origem (código
  // de carteira bruto do PDF). Ausência de status = 'ativo' (retrocompat).
  // Filtro de quarentena é aplicado por consumidor agregador (Frente 2).
  status?: 'ativo' | 'pendente_normalizacao';
  sigla_bruta_origem?: string;

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

// ── PROPOSTAS (Precificação) ────────────────────────────────────────────────
// Snapshot IMUTÁVEL de uma proposta — inputs do formulário + outputs calculados
// DA ÉPOCA. Reabrir mostra os valores de quando foi salva; recalcular só por
// ação explícita do usuário. Persistido em propostas/{id_estavel}.
export interface PropostaInputs {
  pacote: PacoteServico;
  regime: RegimeTributario;
  qtd_veiculos: number; qtd_imoveis: number; grupos_financeiros: number; qtd_funcionarios_domesticos: number;
  planejamento_tributario: boolean; revisao_contratos: boolean; gestao_obra: boolean;
  utiliza_servico_juridico: boolean; utiliza_conciliacao: boolean;
  qtd_demandas_juridicas_mes: number;   // N demandas consultivas/mês contratadas (default 0)
  volume_movimentos_mes: number; qtd_contratacoes_mes: number; qtd_recebiveis_mes: number;
  qtd_contas_bancarias: number;                                // nº de contas (escopo financeiro)
  pl_onshore: number; pl_offshore: number;
  taxa_rebate_onshore: number; taxa_rebate_offshore: number;   // % a.a.
  dedic_contabilidade: number; dedic_pagamento: number; dedic_administrativo: number; dedic_viagem: number;
  // Campos do template HTML.
  texto_introducao: string;
  imagem_capa_url: string;
  texto_escopo_adicional: string;   // ressalvas específicas do cliente (após blocos gerados)
  titularidades?: string;           // texto livre (ex.: "1 PF + 1 PJ"); só descrição, não no cálculo
  validade_dias: number;            // validade da proposta em dias (default 15)
  dia_vencimento: number;           // dia do vencimento do boleto, 1–28 (default 10)
  valor_proposto: number;   // preço comercial (editável; âncora = fee sugerido)
  fee_atual: number;        // composição aditiva (cliente_existente)
  // ── CONTABILIDADE (camada de EXIBIÇÃO — NÃO entra no motor calcularFee) ─────
  // O CFO informa o valor; aparece no documento e soma no total MOSTRADO. Só o
  // mensal soma no total mensal; 13º (=mensal), IR e fechamento são à parte.
  // Versão integrada (catálogo/motor/PF-PJ) = revisão de fundação, não é isto.
  contabilidade_mensal?: number;       // R$/mês; vazio/0 = contabilidade não aparece
  contabilidade_ir?: number;           // R$ — imposto de renda à parte (opcional)
  contabilidade_fechamento?: number;   // R$ — fechamento anual à parte (opcional)
  contabilidade_tipo?: string;         // texto livre (ex.: "PF"/"PJ") — só descrição
}

export interface PropostaLinhaFuncao { funcao: FuncaoAlocacao; horas: number; custoHora: number; custo: number; }
export interface PropostaOutputs {
  porFuncao: PropostaLinhaFuncao[];
  custoDireto: number; dedicados: number; overhead: number; custoTotal: number;
  rebate: number; receitaNecessaria: number; feeSugerido: number;
  parcela_juridica?: number;   // N × custo_demanda (jurídico consultivo); ausente = snapshot pré-feature
}

export interface DadosProposta {
  id?: string;
  id_estavel: string;
  criado_em: string;
  atualizado_em: string;
  status: 'rascunho' | 'enviada' | 'aceita' | 'recusada';
  tipo: 'prospect' | 'cliente_existente';
  nome_prospect: string;
  id_estavel_cliente?: string;
  inputs: PropostaInputs;
  outputs: PropostaOutputs;
  valor_proposto: number;
}

// ============================================================
// ORÇAMENTO EXTRAORDINÁRIO (serviços avulsos/pontuais — fora do fee)
// ============================================================
// Ferramenta SELETORA de valor fixo (faixa editável) por tipo. As cláusulas
// percentuais (success fee / % da causa) são INFORMATIVAS — texto, NÃO entram
// em cálculo (a mais-valia/resultado é futuro). Não toca o motor do fee.

export type TipoExtraordinario =
  | 'juridico_elaboracao_simples'
  | 'juridico_elaboracao_complexa'
  | 'juridico_parecer'
  | 'juridico_representacao'
  | 'juridico_contencioso'
  | 'ma'
  | 'valuation'
  | 'viabilidade';

export interface ItemOrcamento {
  tipo: TipoExtraordinario;
  descricao: string;                 // descrição livre do serviço (default = label do catálogo)
  valor: number;                     // valor fixo escolhido dentro da faixa (editável)
  clausula_pct?: number;             // % escolhido dentro da faixa % (representação/contencioso)
  clausula_informativa?: string;     // texto da cláusula derivado do % escolhido; só exibição
}

export interface DadosOrcamento {
  id?: string;
  id_estavel: string;
  criado_em: string;
  atualizado_em: string;
  status: 'rascunho' | 'enviado' | 'aceito' | 'recusado';
  nome_cliente: string;
  id_estavel_cliente?: string;
  itens: ItemOrcamento[];
  valor_total: number;               // Σ dos itens.valor
  validadeDias: number;              // validade do orçamento em dias (default 15)
  observacoes?: string;              // texto livre adicional
}

// Faixas/percentuais editáveis por tipo (Configurações → Extraordinário).
// faixa_min/max delimitam o valor sugerido; clausula_pct/minimo alimentam a
// cláusula informativa (texto). ma/valuation/viabilidade nascem zerados.
export interface FaixaExtraordinario {
  faixa_min: number;
  faixa_max: number;
  clausula_pct_min?: number;  // faixa % informativa — mínimo (success fee / % da causa)
  clausula_pct_max?: number;  // faixa % informativa — máximo
  clausula_minimo?: number;   // R$ mínimo (contencioso)
}

export interface Parametros {
  custo_juridico_mensal: number;
  custo_conciliacao_mensal: number;
  taxa_rebate_onshore: number;
  taxa_rebate_offshore: number;
  // Retenção na origem do rebate por perna (globais). Não é IRPJ/CSLL.
  aliquota_rebate_onshore: number;
  aliquota_rebate_offshore: number;
  // Margem EBITDA alvo sobre a receita total — base do fee sugerido (Precificação).
  margem_alvo: number;
  split_plataforma: number;
  // Razão de overhead de REFERÊNCIA (pool geral ÷ Σ custo direto) de um período
  // validado. A precificação usa SEMPRE esta razão (não a do período corrente),
  // que é hiper-sensível à completude da alocação. Recalculável via UI.
  overhead_ratio_referencia: number;
  horas_pacote: Record<PacoteServico, Record<FuncaoAlocacao, number>>;
  // ── Precificação do JURÍDICO CONSULTIVO (por demanda) ──────────────────────
  // custo_demanda = tempo_demanda_juridica_horas × custo_hora_juridico × fator.
  // O fee da proposta absorve N × custo_demanda como custo direto (puxa overhead
  // + imposto + margem). N (demandas/mês) é POR PROPOSTA, não global. Os 3
  // parâmetros abaixo são globais e ajustáveis (Configurações → Jurídico).
  tempo_demanda_juridica_horas: number;   // horas por demanda consultiva (default 2,5)
  custo_hora_juridico: number;            // salário-hora cru do jurídico (default 82,88)
  fator_demanda_juridica: number;         // multiplicador de calibração (default 1,0)
  // ── POLÍTICA DE REAJUSTE POR VOLUME EXCEDENTE (só redação da proposta) ──────
  // Estes 3 NÃO entram no cálculo do fee — alimentam apenas a cláusula de
  // excedente escrita no documento. Globais e ajustáveis (Configurações →
  // Reajuste).
  tolerancia_volume_pct: number;          // folga % sobre o volume contratado (default 20)
  periodicidade_medicao_meses: number;    // periodicidade de medição em meses (default 3)
  valor_faixa_excedente: number;          // R$ a cada faixa de {tolerância}% adicional (default 500)
  // ── ORÇAMENTO EXTRAORDINÁRIO (faixas/percentuais por tipo — só Orçador) ─────
  // Faixas editáveis de valor sugerido + percentuais informativos. NÃO entram
  // no motor do fee. Globais e ajustáveis (Configurações → Extraordinário).
  extraordinario: Record<TipoExtraordinario, FaixaExtraordinario>;
}

// ============================================================
// Detalhamento de custo direto por cliente
// ============================================================

export interface LinhaMaoDeObra {
  funcao: FuncaoAlocacao;
  responsavel: string;   // colaborador que atende a função
  pct: number;           // pct EFETIVO (resolvido × fatorNorm) — o que dirige o custo
  horas: number;         // pct_efetivo × HORAS_CLT_MES × percentual_alocavel (= "Horas efet." da Alocação)
  valor: number;         // pct_efetivo × custo_total_mensal (compõe o custo_direto)
}

export interface DetalhesCustoDireto {
  maoDeObra: number;
  juridico: number;
  conciliacao: number;
  contabilidade: number;
  pagamento: number;
  administrativo: number;
  viagem: number;
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
  ebitda: number;               // Receita - impostos_faturamento - custo_total (SEM IRPJ/CSLL)
  margem: number;               // margem_ebitda
  lucro_liquido: number;        // EBITDA - impostos_lucro (IRPJ/CSLL)
  margem_liquida: number;       // lucro_liquido / receita_bruta

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
  custo_dedicado_viagem: number;
  // Rateios DIRETOS (Consultoria & Legal / Conciliação) — compõem o dedicado.
  custo_dedicado_juridico: number;
  custo_dedicado_conciliacao: number;
  custo_indireto_rateado: number;
  custo_total: number;
  // Decomposição do custo_direto por colaborador (mesma base/fatorNorm do motor).
  // Σ linhas_mao_de_obra.valor ≡ custo_direto.
  linhas_mao_de_obra: LinhaMaoDeObra[];

  // Margem de contribuição — receita − imp.fat − custo_direto − custo_dedicado,
  // ANTES do overhead rateado. Leitura (não método): MC > 0 = cliente cobre o
  // próprio custo direto/dedicado e contribui p/ o pool; o déficit (se houver)
  // vem do rateio. Identidade: margem_contribuicao ≡ ebitda + custo_indireto_rateado.
  margem_contribuicao: number;

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

  // Vínculos cliente↔colaborador do período (Fase 2.5). Consumidos pelo
  // pipeline de custo direto via leitura dual: se há vínculo com pct > 0
  // para (cliente, função), usa o vínculo; senão, fallback no campo do cliente.
  // Hoje (pré-Peça 6) todos têm pct=0 — fallback sempre dispara, comportamento
  // idêntico ao legado. Estrutura pronta para ativação quando Peça 6 popular pct.
  vinculos: import('./vinculo').Vinculo[];

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
