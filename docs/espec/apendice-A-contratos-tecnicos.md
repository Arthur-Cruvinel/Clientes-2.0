# Apêndice A — Contratos Técnicos

> Interfaces TypeScript reais das entidades do domínio (fonte:
> `src/types/index.ts` e `src/types/vinculo.ts`) e o catálogo de constantes de
> negócio com os valores vigentes. Este apêndice é o contrato de dados que a
> Parte II descreve em prosa.

---

## A.1 Tipos auxiliares

```typescript
export type FuncaoAlocacao =
  | 'consultoria_gestao'        // Gestor
  | 'consultoria_planejamento'  // Coordenador (CFO)
  | 'consultoria_financeira'    // Consultor
  | 'operacional_financeiro'    // Operador
  | 'serv_adm'                  // Administrativo
  | 'serv_aux_adm';            // Auxiliar administrativo

export type PacoteServico = 'full' | 'advanced' | 'light' | 'future' | 'asset_only';
export type MoedaFee = 'BRL' | 'USD' | 'EUR' | 'GBP';
export type RegimeTributario = 'presumido' | 'real';
export type ClassificacaoCliente = 'Pure Asset' | 'Fee' | 'Híbrido' | 'Fee Isento';
export type VisaoFinanceira = 'margem_contribuicao' | 'ebitda';
```

---

## A.2 Cliente

```typescript
export interface Cliente {
  id?: string;                  // docId quando lido (slug no cadastro mestre)
  id_estavel?: string;          // UUID v4 imutável — referência cross-coleção

  nome_cliente: string;         // nome canônico
  empresario?: string;          // empresário/representante
  banker?: string;              // banker Galápagos responsável

  receita_fee: number;          // fee mensal de CFO, em BRL

  // Taxas contratuais de rebate (estáticas). PL vem de poupanca/, nunca daqui.
  percentual_rebate_anual_onshore: number;
  percentual_rebate_anual_offshore?: number;
  /** @deprecated alíquota de rebate é global por perna (parametros) */
  aliquota_impostos_rebate?: number;

  // Custos dedicados (compõem o custo dedicado do cliente)
  custo_contabilidade_dedicado?: number;
  custo_pagamento_dedicado?: number;
  custo_administrativo_dedicado?: number;
  custo_viagem_dedicado?: number;       // viagem lançada no cliente que a originou
  custo_conciliacao_dedicado?: number;

  utiliza_servico_juridico: boolean;    // participa do rateio jurídico
  utiliza_conciliacao: boolean;         // participa do rateio de conciliação

  pacote_servico: PacoteServico;        // define horas normativas por função

  // Colaborador responsável por função (legado — alocação migrou p/ vinculos/)
  consultoria_gestao?: string;
  consultoria_planejamento?: string;
  consultoria_financeira?: string;
  operacional_financeiro?: string;
  serv_adm?: string;
  serv_aux_adm?: string;

  // Percentuais de dedicação por função (legado de leitura — fallback do motor)
  pct_consultoria_gestao: number;
  pct_consultoria_planejamento: number;
  pct_consultoria_financeira: number;
  pct_operacional_financeiro: number;
  pct_serv_adm: number;
  pct_serv_aux_adm: number;

  // Indicadores de escopo (calculados em runtime; não persistir no alvo)
  fator_consultoria_gestao?: number;
  fator_consultoria_planejamento?: number;
  fator_consultoria_financeira?: number;
  fator_operacional_financeiro?: number;
  fator_serv_adm?: number;
  fator_serv_aux_adm?: number;

  peso_juridico?: number;          // peso no rateio jurídico (default 1.0)
  volume_movimentos_mes?: number;  // movimentos/mês (rateio conciliação + horas)

  // Volumetria mensal adicional (drivers de horas)
  qtd_recebiveis_mes?: number;
  qtd_contratacoes_mes?: number;

  perfil_complexidade?: PerfilComplexidade;  // drivers perenes (clientes_base)
  data_entrada?: string;                     // 'YYYY-MM' — visibilidade temporal

  // Fee em moeda estrangeira (gravado já convertido em BRL; trilha de auditoria)
  moeda_fee?: MoedaFee;
  receita_fee_original?: number;
  moeda_fee_original?: string;
  ptax_usado?: number;
}

export interface PerfilComplexidade {
  grupos_financeiros: number;          // CPF/CNPJ/estruturas (default 1)
  qtd_veiculos: number;
  qtd_imoveis: number;
  qtd_funcionarios_domesticos: number;
  planejamento_tributario: boolean;    // driver de horas
  revisao_contratos: boolean;          // driver de horas
  gestao_obra: boolean;                // alerta se ativo sem cobrança
}
```

---

## A.3 Colaborador

```typescript
export interface Colaborador {
  id?: string;
  id_estavel?: string;                  // UUID v4 imutável

  nome_colaborador: string;
  cargo: string;
  localidade?: 'SP' | 'RJ';             // calendário de feriados (default SP)
  funcao_principal: string;             // FuncaoAlocacao
  alocavel: boolean;                    // atende clientes vs 100% institucional
  tipo_vinculo?: 'clt' | 'pro_labore' | 'estagio';   // default clt

  // Ciclo de vida
  ativo?: boolean;                      // ausência = ativo; sinaliza propagação
  data_admissao?: string;               // 'YYYY-MM'
  data_demissao?: string;               // 'YYYY-MM'
  funcoes_secundarias?: FuncaoAlocacao[];
  cadastro_completo?: boolean;

  // Alocação. INVARIANTE: alocavel + institucional = 1.0
  percentual_alocavel: number;
  percentual_institucional: number;

  // Remuneração
  salario_teto_cargo: number;           // CLT — base dos encargos
  liquido_acordado?: number;            // CLT — líquido-alvo (gera complemento PLR)
  qtd_dependentes?: number;             // dedução IRRF (default 0)
  beneficios_fixos: number;             // VT+VR+saúde+outros (fora dos encargos)
  vale_alimentacao?: number;            // detalhamento (soma = beneficios_fixos)
  vale_transporte?: number;
  plano_saude?: number;
  outros_beneficios?: number;
  /** @deprecated CLT usa liquido_acordado; mantido p/ pro_labore/estágio */
  salario_base: number;

  historico_reajustes?: ReajusteSalarial[];  // vigências CLT (ASC)

  // Campos calculados (derivados de calcularFolhaColaborador — nunca editar)
  inss?: number; irrf?: number;
  complemento_plr?: number; reflexos_plr_mensal?: number;
  encargos_patronais?: number;          // teto×0,28 (CLT) | base×0,20 (pro_labore)
  decimo_terceiro_ferias?: number;      // (teto/12)×1,3333 (CLT) | 0 (pro_labore)
  custo_total_mensal: number;
  custo_hora: number;
}

export interface ReajusteSalarial {
  vigencia: string;             // 'YYYY-MM' — primeiro mês de vigência
  salario_teto_cargo: number;
  liquido_acordado: number;
  observacao?: string;
  registrado_em?: string;
  registrado_por?: string;
}
```

---

## A.4 CustoIndireto e Vinculo

```typescript
export interface CustoIndireto {
  id?: string;
  id_estavel?: string;                  // UUID canônico da categoria
  descricao_custo: string;
  valor_mensal: number;
  tipo_custo: 'geral' | 'juridico' | 'conciliacao';
}

export interface Vinculo {
  id?: string;                          // docId {slug_colab}_{slug_cli}_{funcao}
  periodo: string;                      // 'YYYY-MM' | 'SANDBOX'
  id_estavel_colaborador: string;       // UUID — referência ao colaborador
  id_estavel_cliente: string;           // UUID — referência ao cliente
  nome_colaborador: string;             // denormalizado (conveniência)
  nome_cliente: string;                 // denormalizado
  funcao: FuncaoAlocacao;               // uma das 6
  pct: number;                          // intensidade (fração do tempo)
  origem: string;                       // manual | alocacao_em_lote | migracao_*
  data_criacao: string;                 // ISO timestamp
}
```

---

## A.5 RegistroPoupanca

```typescript
export interface RegistroPoupanca {
  id?: string;
  nome_cliente: string;
  ano: number; mes: number;

  // Quarentena de sigla órfã (ausência de status = ativo)
  status?: 'ativo' | 'pendente_normalizacao';
  sigla_bruta_origem?: string;

  // PL atual em BRL
  pl_onshore: number; pl_offshore: number; pl_total: number;
  // PL inicial (saldo de abertura)
  pl_inicial_onshore?: number; pl_inicial_offshore?: number; pl_inicial_total?: number;
  // Offshore em USD + PTAX (decomposição cambial)
  pl_offshore_usd?: number; pl_inicial_offshore_usd?: number; ptax_fechamento?: number;

  // Movimentação
  aporte_mes_onshore: number; aporte_mes_offshore: number; aporte_mes_total: number;
  transferencia_interna_onshore?: number;   // default 0 (subtraída do NNM real)
  transferencia_interna_offshore?: number;

  // Rentabilidade
  rentabilidade_onshore?: number;       // decimal mensal
  rentabilidade_offshore?: number;      // BRL
  rentabilidade_pct_offshore?: number;  // decimal da lâmina
  rentabilidade_total?: number;         // BRL consolidado
  rentabilidade_pct?: number;           // decimal consolidado
  impostos_mes?: number;                // IR/IOF/come-cotas do mês
  cdi_mes_pct?: number;                 // CDI realizado do mês (benchmark)

  revisao_pendente?: boolean;

  // Tombamento (portabilidade)
  nnm_tombamento?: number;              // legado consolidado
  nnm_tombamento_onshore?: number;
  nnm_tombamento_offshore?: number;

  // Metas
  sem_capacidade_poupanca: boolean;
  capacidade_poupanca_mensal?: number;
  meta_poupanca_mensal?: number;

  // Período parcial (benchmark justo)
  dia_inicio?: number | null;
  dia_corte?: number | null;
}
```

> `cdi_mes_pct` é persistido nos documentos de poupança (benchmark realizado do
> mês); alimenta o cálculo de spread e a janela MM6 no módulo AUM.

---

## A.6 Parametros (globais) e Propostas

```typescript
export interface Parametros {
  custo_juridico_mensal: number;
  custo_conciliacao_mensal: number;
  taxa_rebate_onshore: number;
  taxa_rebate_offshore: number;
  aliquota_rebate_onshore: number;      // retenção na origem (perna onshore)
  aliquota_rebate_offshore: number;
  margem_alvo: number;                  // margem EBITDA alvo (fee sugerido)
  split_plataforma: number;             // fração do rebate retida
  overhead_ratio_referencia: number;    // pool geral ÷ Σ custo direto (referência)
  horas_pacote: Record<PacoteServico, Record<FuncaoAlocacao, number>>;
}

export interface PropostaInputs {
  pacote: PacoteServico; regime: RegimeTributario;
  qtd_veiculos: number; qtd_imoveis: number; grupos_financeiros: number; qtd_funcionarios_domesticos: number;
  planejamento_tributario: boolean; revisao_contratos: boolean; gestao_obra: boolean;
  utiliza_servico_juridico: boolean; utiliza_conciliacao: boolean;
  volume_movimentos_mes: number; qtd_contratacoes_mes: number; qtd_recebiveis_mes: number;
  qtd_contas_bancarias: number;
  pl_onshore: number; pl_offshore: number;
  taxa_rebate_onshore: number; taxa_rebate_offshore: number;   // % a.a.
  dedic_contabilidade: number; dedic_pagamento: number; dedic_administrativo: number; dedic_viagem: number;
  texto_introducao: string; imagem_capa_url: string; texto_escopo_adicional: string;
  validade_dias: number;            // default 15
  dia_vencimento: number;           // 1–28 (default 10)
  valor_proposto: number; fee_atual: number;
}

export interface PropostaLinhaFuncao { funcao: FuncaoAlocacao; horas: number; custoHora: number; custo: number; }
export interface PropostaOutputs {
  porFuncao: PropostaLinhaFuncao[];
  custoDireto: number; dedicados: number; overhead: number; custoTotal: number;
  rebate: number; receitaNecessaria: number; feeSugerido: number;
}

export interface DadosProposta {
  id?: string;
  id_estavel: string;
  criado_em: string; atualizado_em: string;
  status: 'rascunho' | 'enviada' | 'aceita' | 'recusada';
  tipo: 'prospect' | 'cliente_existente';
  nome_prospect: string;
  id_estavel_cliente?: string;
  inputs: PropostaInputs; outputs: PropostaOutputs;
  valor_proposto: number;
}
```

---

## A.7 ResultadoCliente (saída do motor — DRE por cliente)

```typescript
export interface ResultadoCliente {
  nome_cliente: string;
  pacote_servico: string;
  perfil: 'fee_based' | 'pure_asset' | 'hibrido' | 'fee_isento';

  // Receita
  receita_fee: number; receita_rebate: number; receita_bruta: number;
  fee_potencial?: number;               // reservado (análise de desconto)

  // Impostos
  impostos_faturamento: number;         // PIS/COFINS/ISS (acima do EBITDA)
  impostos_lucro: number;               // IRPJ/CSLL (abaixo do EBITDA)

  // Custos
  custo_direto: number;                 // mão de obra alocada
  custo_dedicado: number;               // dedicados + rateios diretos (jur/concil)
  custo_dedicado_contabilidade: number;
  custo_dedicado_pagamento: number;
  custo_dedicado_administrativo: number;
  custo_dedicado_viagem: number;
  custo_dedicado_juridico: number;      // rateio direto jurídico
  custo_dedicado_conciliacao: number;   // rateio direto conciliação
  custo_indireto_rateado: number;       // pool geral rateado
  custo_total: number;
  linhas_mao_de_obra: LinhaMaoDeObra[]; // decomposição; Σ valor ≡ custo_direto

  // Resultado
  margem_contribuicao: number;          // receita − imp.fat − direto − dedicado
  ebitda: number;                       // receita − imp.fat − custo_total
  margem_ebitda: number;
  lucro_liquido: number;                // ebitda − imp.lucro
  margem_liquida: number;

  // Escopo
  fatores_escopo: Record<FuncaoAlocacao, number>;
  algum_fator_acima_limite: boolean;
}
```

> Identidade contábil: `margem_contribuicao ≡ ebitda + custo_indireto_rateado`.

---

## A.8 Catálogo de constantes de negócio

### A.8.1 `CATEGORIAS_CUSTO_INDIRETO` (identidade canônica)

| Descrição | tipo_custo | id_estavel | docId |
|---|---|---|---|
| Administrativo/Predial | geral | `06ce4059-c281-4c05-8e20-1fbf40c5c5e2` | `d00823cf-…-525711cd1644` |
| Contabilidade | geral | `a4653825-ebf5-4a03-ab9e-d622f76b109f` | `fa1d1acc-…-a21c8165039f` |
| Marketing | geral | `3fa4c944-1761-489c-b7a5-1bb470474a86` | `100016b9-…-536aadb459d2` |
| Tecnologia | geral | `419d664c-fb49-44e0-83f4-6935916c104d` | `283a1d93-…-f457e7723cf6` |
| Viagens | geral | `50d49df4-323e-4e11-8abb-f924c6d3db64` | `8d2f70e9-…-cec88ef3ebfe` |
| Consultoria & Legal (Jurídico) | juridico | `9ca8b49e-6ee8-4a4b-a7ec-78e01681b647` | `0ad49e8c-…-e025708b790d` |
| Conciliação | conciliacao | `b0781783-0cb0-4cd4-98bf-cc10516fd19f` | `3fa2655d-…-d549274ddfdd` |

As 5 primeiras (`geral`) compõem o pool indireto; `juridico` e `conciliacao` são
rateios **diretos** (compõem o custo dedicado do cliente).

### A.8.2 `HORAS_PACOTE` — horas normativas por pacote × função

| Função | full | advanced | light | future | asset_only |
|---|--:|--:|--:|--:|--:|
| consultoria_gestao | 16 | 10 | 6 | 4 | 0 |
| consultoria_planejamento | 4 | 2 | 1 | 1 | 0 |
| consultoria_financeira | 20 | 12 | 6 | 3 | 0 |
| operacional_financeiro | 36 | 22 | 8 | 2 | 0 |
| serv_adm | 20 | 12 | 4 | 0 | 0 |
| serv_aux_adm | 8 | 4 | 0 | 0 | 0 |
| **Total** | **104** | **62** | **25** | **10** | **0** |

Usadas para o indicador de escopo (`pct_normativo = horas_pacote ÷ HORAS_CLT_MES`,
`HORAS_CLT_MES = 168`) e como base de distribuição automática de alocação quando o
cliente não tem perfil de complexidade.

### A.8.3 `ATIVIDADES_SERVICO` — coeficientes de horas por atividade

`VOLUME_MOVIMENTOS_PADRAO = 350` (denominador do driver `vol_movimentos`).

| Atividade | horas_base | Driver | Função |
|---|--:|---|---|
| pagamento_contas | 33,88 | vol_movimentos (÷350) | operacional_financeiro |
| fluxo_caixa | — | vol_movimentos (fórmula: `vol×0,5÷60`) | operacional_financeiro |
| gestao_recebiveis | 0,50 | qtd_recebiveis | operacional_financeiro |
| gestao_despesas | 6,20 | fixo | operacional_financeiro |
| gestao_veiculos | 2,81 | qtd_veiculos | serv_adm |
| gestao_imoveis | 3,94 | qtd_imoveis | serv_adm |
| gestao_funcionarios_domesticos | 2,00 | qtd_func_domesticos | serv_adm |
| gestao_documentos | 2,62 | fixo | serv_adm |
| organizacao_documental | 2,33 | fixo | serv_adm |
| contratacao_servicos | 3,50 | qtd_contratacoes | serv_adm |
| acompanhamento_dividas | 2,69 | fixo | serv_adm |
| relatorio_financeiro | 2,03 | fixo | consultoria_financeira |
| planejamento_tributario | 13,00 | boolean | consultoria_financeira |
| orcamento_anual | 0,33 | fixo | consultoria_financeira |
| revisao_contratos | 6,17 | boolean | consultoria_financeira |
| assessoria_patrimonial | 3,17 | fixo | consultoria_gestao |
| solicitacoes_emergencia | 6,67 | fixo | consultoria_gestao |

`grupos_financeiros` é um driver reservado (sem atividade ativa). `gestao_obra` é
tratado fora do catálogo (alerta puro, sem horas normativas).

### A.8.4 `EntradaMapeamentoSigla` — estrutura

```typescript
interface EntradaMapeamentoSigla {
  codigo: string;          // ex.: 'AAE_BTG' (código completo da carteira)
  sigla: string;           // ex.: 'AAE' (exibição)
  nome_cliente: string;    // cliente canônico
  id_estavel_cliente?: string;  // UUID — join estável
  criado_via?: string;     // ex.: 'manutencao_cfo'
  registrado_em?: string;
  registrado_por?: string;
}
```

O mapeamento tem uma camada hardcoded (`MAPEAMENTO_SIGLAS` + `SIGLA_PARA_NOME`, ~440
entradas, fonte primária do parser offshore) e a coleção Firestore
`mapeamento_siglas/` (entradas adicionadas em runtime). A estrutura é a acima; o
conteúdo extenso não é reproduzido aqui.

### A.8.5 `parametros/global` — valores vigentes

| Parâmetro | Valor vigente |
|---|--:|
| `taxa_rebate_onshore` | 0,006 (0,60% a.a.) |
| `taxa_rebate_offshore` | 0,006 (0,60% a.a.) |
| `aliquota_rebate_onshore` | 0,1653 (16,53%) |
| `aliquota_rebate_offshore` | 0,21 (21%) |
| `split_plataforma` | 0,5 (50%) |
| `margem_alvo` | 0,20 (20%) |
| `overhead_ratio_referencia` | 1,3116 |
| `custo_juridico_mensal` | R$ 61.100,00 |
| `custo_conciliacao_mensal` | R$ 6.747,65 |

### A.8.6 Constantes de horas produtivas

| Constante | Valor |
|---|--:|
| `HORAS_CLT_MES` | 168 |
| `HORAS_SEMANAIS_CLT` | 44 |
| `SEMANAS_ANO` | 52 |
| Feriados/localidade (SP, RJ) | 15 |
| `HORAS_PRODUTIVAS_POR_LOCALIDADE` (SP/RJ) | ~1.968 h/ano (~164 h/mês) |

O custo/hora do colaborador é `(custo_total_mensal × 12) ÷ horas produtivas da
localidade`.
