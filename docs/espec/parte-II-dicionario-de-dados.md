# Parte II — Dicionário de Dados

> Especificação definitiva do sistema **Clientes 360** (Galácticos Capital).
> Este capítulo descreve o **estado-alvo** do modelo de persistência: o que cada
> coleção significa, seus campos, invariantes e ciclo de vida. Onde o banco atual
> guarda algo que o alvo não prevê, o campo aparece em **Legados em extinção**
> (§14) ou recebe uma **Nota de reconstrução** no local.

---

## 1. Princípios do modelo de persistência

O banco é o **Firestore** (modelo documento, SDK modular). Três eixos organizam
todas as coleções:

1. **Identidade dupla.** Toda entidade-raiz tem dois identificadores:
   - **`docId`** — chave do documento no Firestore. Para cadastros mestre é o
     **slug** do nome (legível, muda se a entidade é renomeada). Para snapshots
     de período e para propostas é o **`id_estavel`** (UUID v4).
   - **`id_estavel`** — UUID v4 imutável, gerado uma única vez. É a chave de
     **todas as referências cross-coleção** (vínculo → cliente, vínculo →
     colaborador, sigla → cliente). Nome muda; `id_estavel` nunca.

2. **Perene vs mensal.** O dado que descreve a entidade de forma estável (cadastro,
   perfil de complexidade, taxas contratuais) vive nos **cadastros mestre**
   (`clientes_base/`, `colaboradores_base/`). O dado que muda a cada fechamento
   (alocação, volumetria do mês, folha calculada, PL, custos do mês) vive sob
   **`fechamentos/{periodo}/`** ou em coleções com chave temporal
   (`poupanca/{slug}_{ano}_{mes}`).

3. **Resultado é derivado, não armazenado.** Receita, custos rateados, EBITDA,
   margens e fatores de escopo são **recalculados a cada processamento de período**
   a partir dos inputs. O alvo **não persiste resultado** no cadastro mestre — ele
   é estado de exibição, reconstruível.

**Convenção temporal.** Períodos e datas de vigência usam o formato `YYYY-MM`
(ex.: `2026-01`). Timestamps de auditoria usam ISO 8601.

**Escrita dual (vínculos).** A alocação cliente↔colaborador é lida com prioridade
do vínculo (`fechamentos/{periodo}/vinculos/`); na ausência de vínculo com
`pct > 0`, o motor recai no campo legado do cliente. A escrita de alocação ocorre
**somente** em `vinculos/`.

---

## 2. Mapa das coleções

| Coleção | Chave (docId) | Natureza | Propósito |
|---|---|---|---|
| `clientes_base/` | slug | mestre, perene | Cadastro canônico do cliente |
| `colaboradores_base/` | slug | mestre, perene | Cadastro canônico do colaborador |
| `fechamentos/{p}/clientes/` | `id_estavel` | snapshot mensal | Inputs do cliente no período |
| `fechamentos/{p}/colaboradores/` | slug | snapshot mensal | Folha do colaborador no período |
| `fechamentos/{p}/custosIndiretos/` | `id_estavel` | snapshot mensal | Custos indiretos/diretos rateáveis do período |
| `fechamentos/{p}/vinculos/` | composto | snapshot mensal | Alocação colab↔cliente×função |
| `poupanca/` | `{slug}_{ano}_{mes}` | série temporal | PL, movimentação e rentabilidade por cliente/mês |
| `mapeamento_siglas/` | código de carteira | referência | Sigla de lâmina → cliente |
| `propostas/` | `id_estavel` | snapshot imutável | Propostas comerciais (Precificação) |
| `parametros/global` | doc único | configuração | Parâmetros financeiros globais |
| `config/poupanca` | doc único | configuração | Metas de AUM/NNM |
| `periodos_status/{p}` | período | controle | Estado de fechamento do período |

Coleções **reservadas** (estrutura decidida, ainda não populada): `patrimonial/`,
`evolucao_pl/`, `historico_fluxo/` — ver §13.

---

## 3. `clientes_base/` — cadastro mestre do cliente

**Propósito.** Fonte única de verdade do cliente: identidade, taxas contratuais de
rebate, pacote de serviço, flags de serviço, perfil de complexidade (perene) e data
de entrada. Quando um período está **aberto**, o motor lê os clientes daqui.

**Chave.** `docId` = slug do `nome_cliente`; `id_estavel` = UUID v4 (referência
cross-coleção).

**Relações.** Referenciado por `vinculos.id_estavel_cliente`, por
`mapeamento_siglas.id_estavel_cliente` e por `propostas.id_estavel_cliente`. O PL
do cliente vem de `poupanca/` (casado por `nome_cliente`).

### Campos

| Campo | Tipo | Obrigatório | Semântica de negócio | Consumido em |
|---|---|---|---|---|
| `id_estavel` | string (UUID) | sim (alvo) | Identidade imutável | Todos os módulos; joins cross-coleção |
| `nome_cliente` | string | sim | Nome canônico (exibição e match) | Todos |
| `empresario` | string | não | Empresário/representante do atleta | Visão Geral, Perfil |
| `banker` | string | não | Banker Galápagos responsável | Visão Geral, AUM |
| `receita_fee` | number (BRL) | sim | Fee mensal contratado de CFO | Motor DRE, Precificação |
| `moeda_fee` | `BRL\|USD\|EUR\|GBP` | não | Moeda de contratação do fee (default BRL) | Cadastro, Perfil |
| `percentual_rebate_anual_onshore` | number (decimal a.a.) | sim | Taxa de rebate onshore (ex.: 0.006) | Motor DRE (rebate), Precificação |
| `percentual_rebate_anual_offshore` | number (decimal a.a.) | não | Taxa de rebate offshore | Motor DRE, Precificação |
| `pacote_servico` | `full\|advanced\|light\|future\|asset_only` | sim | Pacote contratado; define horas normativas por função | Motor, Alocação, Capacidade |
| `utiliza_servico_juridico` | boolean | sim | Participa do rateio jurídico | Motor (rateio direto jurídico) |
| `utiliza_conciliacao` | boolean | sim | Participa do rateio de conciliação | Motor (rateio direto conciliação) |
| `peso_juridico` | number | não | Peso relativo no rateio jurídico (default 1.0) | Motor |
| `volume_movimentos_mes` | number | não | Movimentos bancários/mês — base do rateio de conciliação e de `calcularHorasReais` | Motor, Perfil, Precificação |
| `qtd_recebiveis_mes` | number | não | Recebíveis/mês (driver de horas) | Perfil, Precificação |
| `qtd_contratacoes_mes` | number | não | Contratações de serviço/mês (driver de horas) | Perfil, Precificação |
| `custo_contabilidade_dedicado` | number (BRL) | não | Custo dedicado de contabilidade | Motor (custo dedicado) |
| `custo_pagamento_dedicado` | number (BRL) | não | Custo dedicado de plataforma de pagamento | Motor |
| `custo_administrativo_dedicado` | number (BRL) | não | Custo dedicado administrativo | Motor |
| `custo_viagem_dedicado` | number (BRL) | não | Viagem lançada no cliente que a originou | Motor |
| `perfil_complexidade` | objeto (ver §3.1) | não | Drivers fixos de complexidade (perene) | Perfil, Alocação (horas reais), Precificação |
| `data_entrada` | `YYYY-MM` | não | Mês de entrada; o cliente só aparece a partir dele | Motor (filtro temporal), Visão Geral |

#### 3.1 `perfil_complexidade` (objeto embutido — perene)

| Campo | Tipo | Semântica |
|---|---|---|
| `grupos_financeiros` | number | Nº de CPF/CNPJ/estruturas (default 1) |
| `qtd_veiculos` | number | Veículos sob gestão |
| `qtd_imoveis` | number | Imóveis sob gestão |
| `qtd_funcionarios_domesticos` | number | Funcionários domésticos |
| `planejamento_tributario` | boolean | Serviço contratado (driver de horas) |
| `revisao_contratos` | boolean | Serviço contratado (driver de horas) |
| `gestao_obra` | boolean | Gestão de obra ativa (dispara alerta se sem cobrança) |

> **Nota de reconstrução.** A **volumetria mensal** (`volume_movimentos_mes`,
> `qtd_recebiveis_mes`, `qtd_contratacoes_mes`) **não** pertence a
> `perfil_complexidade` — ela é mensal e fica em campos top-level do cliente do
> período. O perfil guarda apenas os drivers **perenes**.

### Regras de integridade

- `id_estavel` é gravado na criação e **nunca** reescrito; o `docId` é o slug e
  **não** é re-derivado a partir do nome ao salvar (renomear não cria documento
  paralelo).
- `pacote_servico = 'asset_only'` ⇒ cliente **pure asset**: sem fee de CFO, sem
  custo direto, sem vínculos. `receita_fee` deve ser 0.
- Taxas de rebate são **estáticas** (contratuais). O PL nunca é gravado aqui.
- Uniqueness por slug na criação (cadastro novo aborta se o slug já existe).

### Ciclo de vida

1. **Criação** — cadastro novo (Perfil → Novo Cliente, ou Manutenção → Cadastrar
   Sigla com cliente novo): grava em `clientes_base/{slug}` + snapshot do período
   corrente.
2. **Edição** — alterações de cadastro persistem aqui; renome dispara propagação
   por `id_estavel` para todos os snapshots de período.
3. **Fechamento** — ao fechar um período, o cadastro mestre é copiado para
   `fechamentos/{p}/clientes/` (snapshot).

---

## 4. `colaboradores_base/` — cadastro mestre do colaborador

**Propósito.** Cadastro canônico da equipe: identidade, cargo, função principal,
vínculo trabalhista, percentuais de alocação, remuneração e histórico de reajustes.
A folha (custo total, custo/hora, encargos) é **derivada** — recalculada pelo motor.

**Chave.** `docId` = slug do `nome_colaborador`; `id_estavel` = UUID v4.

**Relações.** Referenciado por `vinculos.id_estavel_colaborador`. A folha calculada
é gravada no snapshot de período (`fechamentos/{p}/colaboradores/`).

### Campos

| Campo | Tipo | Obrigatório | Semântica | Consumido em |
|---|---|---|---|---|
| `id_estavel` | string (UUID) | sim (alvo) | Identidade imutável | Vínculos, motor de custo |
| `nome_colaborador` | string | sim | Nome canônico | Todos |
| `cargo` | string | sim | Cargo (rótulo) | Folha, Gestores |
| `localidade` | `SP\|RJ` | não | Calendário de feriados (default SP) → horas produtivas | Motor (custo/hora) |
| `funcao_principal` | `FuncaoAlocacao` | sim | Função primária do colaborador | Capacidade, Gestores |
| `funcoes_secundarias` | `FuncaoAlocacao[]` | não | Funções adicionais que exerce | Capacidade |
| `alocavel` | boolean | sim | Atende clientes (true) ou 100% institucional (false) | Motor (direto vs institucional) |
| `tipo_vinculo` | `clt\|pro_labore\|estagio` | não | Regime de encargos (default clt) | Motor (folha) |
| `percentual_alocavel` | number (decimal) | sim | Fração do tempo dedicada a clientes | Motor (normalização, ociosidade) |
| `percentual_institucional` | number (decimal) | sim | Fração institucional. **Invariante:** alocável + institucional = 1.0 | Motor (pool indireto) |
| `salario_teto_cargo` | number (BRL) | sim (CLT) | Salário em carteira — base dos encargos | Motor (folha CLT) |
| `liquido_acordado` | number (BRL) | não | Líquido-alvo; gera complemento PLR se > líquido do teto | Motor (folha CLT) |
| `qtd_dependentes` | number | não | Dedução de IRRF (default 0) | Motor (folha) |
| `salario_base` | number (BRL) | sim (pro_labore/estágio) | Base mensal direta | Motor (folha pro_labore/estágio) |
| `beneficios_fixos` | number (BRL) | sim | VT+VR+saúde+outros — fora da base de encargos | Motor (folha) |
| `vale_alimentacao` / `vale_transporte` / `plano_saude` / `outros_beneficios` | number | não | Detalhamento de `beneficios_fixos` (soma = `beneficios_fixos`) | Folha (UI) |
| `historico_reajustes` | `ReajusteSalarial[]` | não | Vigências de teto/líquido (CLT) | Motor (teto por período) |
| `ativo` | boolean | não | Ausência = ativo. Sinaliza propagação para frente (omitir no mês seguinte) | Folha, propagação |
| `data_admissao` / `data_demissao` | `YYYY-MM` | não | Ciclo de vida; o demitido permanece no mês da saída | Folha, propagação |

#### 4.1 `historico_reajustes[]` (CLT)

| Campo | Tipo | Semântica |
|---|---|---|
| `vigencia` | `YYYY-MM` | Primeiro mês de vigência |
| `salario_teto_cargo` | number | Teto a partir da vigência |
| `liquido_acordado` | number | Líquido acordado a partir da vigência |
| `observacao` | string? | Ex.: "Reajuste anual", "Promoção" |
| `registrado_em` / `registrado_por` | string? | Auditoria do registro |

### Regras de integridade

- `percentual_alocavel + percentual_institucional = 1.0`.
- **Demissão** = `ativo:false` **e** `data_demissao` juntos; o colaborador
  permanece no mês da saída (custo real do fechamento) e some dos meses
  **posteriores** (propagação para frente). `ativo` **não** é filtro do período
  corrente.
- Histórico de reajustes ordenado ASC por `vigencia`; `salario_teto_cargo` /
  `liquido_acordado` top-level espelham a entrada de maior vigência.
- Pro_labore e estágio ignoram o histórico (motor lê `salario_base` direto).

### Ciclo de vida

Criação/edição via Folha; renome propaga por `id_estavel`/nome para clientes e
snapshots. Reajustes podem ser **propagados** em massa ou por intervalo de períodos.
No fechamento, o cadastro é copiado para `fechamentos/{p}/colaboradores/` com a
folha já calculada.

---

## 5. `fechamentos/{periodo}/clientes/` — snapshot mensal do cliente

**Propósito.** Congelar os **inputs** do cliente naquele mês (pacote, taxas, flags,
volumetria, custos dedicados). Quando o período está **fechado**, o motor lê daqui
em vez de `clientes_base/`.

**Chave.** `docId` = **`id_estavel`** (UUID) do cliente. Difere de `clientes_base/`,
cujo `docId` é o slug.

**Relações.** Mesmo `id_estavel` do cadastro mestre; alocação vem de `vinculos/` do
mesmo período; PL vem de `poupanca/` do mês.

### Campos

Subconjunto de `Cliente` relevante ao período: `id_estavel`, `nome_cliente`,
`pacote_servico`, `receita_fee`, `percentual_rebate_anual_onshore/offshore`,
`utiliza_servico_juridico`, `utiliza_conciliacao`, `peso_juridico`,
`volume_movimentos_mes`, `qtd_recebiveis_mes`, `qtd_contratacoes_mes`,
`custo_*_dedicado`, `banker`.

### Regras de integridade

- O snapshot guarda **inputs**, não resultado. Receita, custos rateados, EBITDA e
  margens são recalculados a cada leitura.
- A alocação do período **não** vive no documento do cliente — vive em `vinculos/`.

### Ciclo de vida

Criado na cópia de período (replicação mês-a-mês) ou no fechamento. Editável
enquanto o período está aberto (espelha a edição do cadastro mestre).

> **Nota de reconstrução.** O snapshot de cliente do período deve conter apenas
> inputs. Campos de resultado (`ebitda`, `margem`, `custo_*`) e o PL
> (`pl_onshore`, `pl_offshore`, `pl_offshore_usd`, `ptax_fechamento`) **não**
> pertencem aqui no alvo — ver §14.

---

## 6. `fechamentos/{periodo}/colaboradores/` — folha do colaborador no período

**Propósito.** Snapshot do colaborador com a **folha calculada** do mês (custo
total, custo/hora e a decomposição de encargos/PLR), para auditoria e leitura
rápida. O motor sempre recalcula a folha a partir dos inputs ao processar.

**Chave.** `docId` = slug do colaborador; `id_estavel` para joins.

### Campos

Todos os de `colaboradores_base/` **mais** os campos calculados (nunca editados à
mão): `inss`, `irrf`, `irrf_liquido`, `redutor_ir_2026`, `liquido_do_teto`,
`complemento_plr`, `reflexos_plr_mensal`, `encargos_patronais`,
`decimo_terceiro_ferias`, `custo_total_mensal`, `custo_hora`. Metadados de
replicação: `replicado_de`, `data_replicacao`.

### Regras de integridade

- Campos calculados são **derivados** de `calcularFolhaColaborador`; persistidos só
  para exibição. A fonte de verdade são os inputs.
- O teto vigente do mês respeita `historico_reajustes` (entrada com
  `vigencia ≤ periodo` mais recente).

### Ciclo de vida

Criado por replicação/fechamento; a folha é recomputada a cada carregamento do
período (tabelas de INSS/IRRF mudam por ano).

---

## 7. `fechamentos/{periodo}/custosIndiretos/` — custos rateáveis do período

**Propósito.** Os custos da casa que o motor rateia: pool geral (indireto) e os dois
rateios **diretos** (jurídico e conciliação).

**Chave.** `docId` = `id_estavel` canônico da categoria (ver Apêndice A —
`CATEGORIAS_CUSTO_INDIRETO`).

### Campos

| Campo | Tipo | Obrigatório | Semântica | Consumido em |
|---|---|---|---|---|
| `id_estavel` | string (UUID) | sim | Identidade canônica da categoria | Motor, Configurações |
| `descricao_custo` | string | sim | Nome da categoria (ex.: "Contabilidade") | Configurações, exportações |
| `tipo_custo` | `geral\|juridico\|conciliacao` | sim | Define o destino do rateio | Motor |
| `valor_mensal` | number (BRL) | sim | Valor da categoria no mês | Motor (rateio) |

### Regras de integridade

- **`geral`** → pool indireto, rateado proporcional ao custo direto (pure asset
  excluído).
- **`juridico`** → rateio direto por `peso_juridico`; **compõe o custo dedicado**.
- **`conciliacao`** → rateio direto por `volume_movimentos_mes`; compõe o dedicado.
- As categorias são **canônicas** (id_estavel fixo); a semeadura é idempotente e
  nunca duplica.

### Ciclo de vida

Semeadas (valor 0) num período sem elas; valor editado em Configurações → Custos.
Replicadas mês-a-mês.

---

## 8. `fechamentos/{periodo}/vinculos/` — alocação colab↔cliente×função

**Propósito.** A alocação é uma **entidade própria** por período: um documento por
combinação (colaborador, cliente, função). Substitui a alocação que vivia dentro do
documento de cliente.

**Chave.** `docId` determinístico = `{slug_colab}_{slug_cli}_{funcao}`. O mesmo trio
nunca gera dois vínculos no período.

**Relações.** `id_estavel_colaborador` → `colaboradores_base/`;
`id_estavel_cliente` → `clientes_base/`. Nomes denormalizados são conveniência, não
fonte de verdade.

### Campos

| Campo | Tipo | Obrigatório | Semântica | Consumido em |
|---|---|---|---|---|
| `periodo` | `YYYY-MM`\|`SANDBOX` | sim | Período do snapshot | Motor, Alocação |
| `id_estavel_colaborador` | string (UUID) | sim | Referência ao colaborador | Motor (custo direto) |
| `id_estavel_cliente` | string (UUID) | sim | Referência ao cliente | Motor |
| `funcao` | `FuncaoAlocacao` | sim | Uma das 6 funções | Motor, Capacidade |
| `pct` | number (decimal) | sim | Intensidade (fração do tempo do colaborador). Σ por colaborador ≤ `percentual_alocavel` | Motor, Alocação em Lote |
| `nome_colaborador` / `nome_cliente` | string | sim (denormalizado) | Conveniência de listagem/log | UI |
| `origem` | string | sim | Rastreabilidade (`manual`, `alocacao_em_lote`, `migracao_fase_2_5`, `sandbox`) | Auditoria |
| `data_criacao` | ISO | sim | Timestamp de criação | Auditoria |

### Regras de integridade

- **Leitura dual:** o motor usa o vínculo com `pct > 0` para `(cliente, função)`;
  na ausência, recai no campo legado do cliente. A migração para vínculo é
  automática quando `pct > 0`.
- A **escrita** de alocação ocorre **somente** aqui (Alocação em Lote / ficha do
  colaborador).
- Pure asset (`asset_only`) **não** gera vínculos.
- `SANDBOX` é período de teste, ignorado pelo motor.

### Ciclo de vida

Criados pela alocação em lote ou por migração; copiados na replicação mês-a-mês.

---

## 9. `poupanca/` — AUM, movimentação e rentabilidade por cliente/mês

**Propósito.** Série temporal financeira do cliente: PL onshore/offshore, aportes,
rentabilidade, tombamentos e metas. É a **fonte única de PL** para o cálculo de
rebate e a base do módulo AUM & Performance.

**Chave.** `docId` = `{slug(nome_cliente)}_{ano}_{mes}` (ou
`{slug(sigla_bruta)}_{ano}_{mes}` em quarentena).

### Campos (principais)

| Campo | Tipo | Semântica | Consumido em |
|---|---|---|---|
| `nome_cliente` | string | Casamento com o cadastro (por nome) | Motor (rebate), AUM |
| `ano` / `mes` | number | Período do registro | AUM, motor |
| `status` | `ativo\|pendente_normalizacao` | Quarentena de sigla órfã; ausência = ativo | Agregadores (filtro) |
| `sigla_bruta_origem` | string? | Código de carteira bruto (quando em quarentena) | Manutenção |
| `pl_onshore` / `pl_offshore` / `pl_total` | number (BRL) | PL de fechamento do mês | Motor (rebate), AUM |
| `pl_inicial_*` | number (BRL) | Saldo de abertura | AUM (rentabilidade) |
| `pl_offshore_usd` / `pl_inicial_offshore_usd` | number (USD) | PL offshore em USD (decomposição cambial) | AUM |
| `ptax_fechamento` | number | PTAX venda do último dia útil | AUM (conversão) |
| `aporte_mes_onshore/offshore/total` | number (BRL) | Movimentação do mês | AUM (NNM), projeção |
| `transferencia_interna_onshore/offshore` | number (BRL) | Reorganização entre contas próprias (subtraída do NNM real) | AUM (MM6, burn) |
| `rentabilidade_onshore` | number (decimal) | Rentabilidade % onshore do mês | AUM |
| `rentabilidade_offshore` / `rentabilidade_pct_offshore` | number | Rentabilidade offshore (BRL / % da lâmina) | AUM |
| `rentabilidade_total` / `rentabilidade_pct` | number | Rentabilidade consolidada (BRL / %) | AUM |
| `impostos_mes` | number (BRL) | IR/IOF/come-cotas retidos no mês | AUM |
| `cdi_mes_pct` | number (decimal) | CDI realizado do mês (benchmark) | AUM (spread, MM6) |
| `nnm_tombamento_onshore/offshore` (+ `nnm_tombamento` legado) | number | Portabilidade de carteira (não é poupança) | AUM |
| `sem_capacidade_poupanca` | boolean | Cliente sem capacidade de poupar | Projeção/metas |
| `capacidade_poupanca_mensal` / `meta_poupanca_mensal` | number | Capacidade e meta mensais | Projeção/metas |
| `dia_inicio` / `dia_corte` | number\|null | Mês parcial (abertura/último dado) | AUM (benchmark justo) |
| `revisao_pendente` | boolean | Marca de revisão manual (preservada no merge) | AUM |

### Regras de integridade

- Registros `pendente_normalizacao` **não** alimentam nenhum agregado financeiro
  (rebate, AUM, NNM) até serem normalizados.
- `docId` **nunca** é alterado; a normalização muda apenas o conteúdo.
- Contas distintas que mapeiam ao mesmo cliente são **agregadas** antes da gravação
  (soma de PL/aporte; média ponderada de rentabilidade) — um único documento por
  cliente/mês.
- O **NNM real** desconta a transferência interna do aporte bruto.

### Ciclo de vida

Importação por lâminas (Upload/AUM); edição mensal manual (tombamento,
transferência interna, metas). Normalização de sigla órfã em Manutenção.

---

## 10. `mapeamento_siglas/` — sigla de lâmina → cliente

**Propósito.** Resolver o código/sigla de carteira que aparece nas lâminas
(custodiantes) para o cliente canônico, sem depender do nome do PDF.

**Chave.** `docId` = código de carteira (ex.: `AAE_BTG`).

### Campos

| Campo | Tipo | Semântica |
|---|---|---|
| `codigo` | string | Código completo da carteira (como na lâmina) |
| `sigla` | string | Sigla curta (exibição) |
| `nome_cliente` | string | Cliente canônico resolvido |
| `id_estavel_cliente` | string (UUID)? | Join estável ao cadastro |
| `criado_via` | string? | Origem (ex.: `manutencao_cfo`) |
| `registrado_em` / `registrado_por` | string? | Auditoria |

### Ciclo de vida

Criado durante o upload (modal de resolução de sigla) ou em Manutenção (cadastrar
sigla nova). Corrigível por Manutenção. O parser indexa por `codigo`.

---

## 11. `propostas/` — propostas comerciais (Precificação)

**Propósito.** Snapshot **imutável** de uma proposta: os inputs do formulário e os
outputs calculados **da época**. Reabrir mostra os valores de quando foi salva.

**Chave.** `docId` = `id_estavel` (UUID).

### Campos

| Campo | Tipo | Semântica |
|---|---|---|
| `id_estavel` | string (UUID) | Identidade da proposta |
| `tipo` | `prospect\|cliente_existente` | Origem (prospecção ou upsell) |
| `nome_prospect` | string | Nome do prospect/cliente |
| `id_estavel_cliente` | string? | Cliente vinculado (upsell) |
| `status` | `rascunho\|enviada\|aceita\|recusada` | Estado comercial |
| `criado_em` / `atualizado_em` | ISO | Auditoria |
| `inputs` | `PropostaInputs` | Formulário (pacote, volumetria, taxas, dedicados, campos do template) |
| `outputs` | `PropostaOutputs` | Custo direto, overhead, rebate, fee sugerido — calculados na gravação |
| `valor_proposto` | number (BRL) | Preço comercial final |

Estrutura completa de `inputs`/`outputs` no Apêndice A.

### Regras de integridade

- O snapshot é imutável por natureza — recalcular só por ação explícita.
- A proposta **não** altera nada em `clientes_base/` nem em fees reais.

---

## 12. `parametros/global` e `config/poupanca` — configuração

### 12.1 `parametros/global` (documento único)

Parâmetros financeiros globais usados pelo motor e pela Precificação.

| Campo | Tipo | Vigente | Semântica |
|---|---|---|---|
| `taxa_rebate_onshore` / `taxa_rebate_offshore` | number (decimal a.a.) | 0.006 / 0.006 | Taxa de rebate default por perna |
| `aliquota_rebate_onshore` / `aliquota_rebate_offshore` | number (decimal) | 0.1653 / 0.21 | Retenção na origem do rebate por perna |
| `split_plataforma` | number (decimal) | 0.5 | Fração do rebate retida pela Galápagos |
| `margem_alvo` | number (decimal) | 0.20 | Margem EBITDA alvo (base do fee sugerido) |
| `overhead_ratio_referencia` | number | 1.3116 | Razão de overhead de referência (pool geral ÷ Σ custo direto) — usada sempre pela Precificação |
| `custo_juridico_mensal` | number (BRL) | 61100 | Referência de custo jurídico |
| `custo_conciliacao_mensal` | number (BRL) | 6747.65 | Referência de custo de conciliação |
| `horas_pacote` | objeto | — | Espelho de `HORAS_PACOTE` (Apêndice A) |

> **Nota de reconstrução.** Os valores operativos de jurídico/conciliação que o
> motor rateia vêm de `fechamentos/{p}/custosIndiretos/`; `custo_juridico_mensal` e
> `custo_conciliacao_mensal` em `parametros/global` são referências de configuração.

### 12.2 `config/poupanca` (documento único)

Metas de captação do módulo AUM & Performance.

| Campo | Tipo | Vigente | Semântica |
|---|---|---|---|
| `meta_aum_valor` | number (BRL) | 1.300.000.000 | Meta global de AUM |
| `meta_aum_data_alvo` | `YYYY-MM` | 2026-12 | Data-alvo da meta de AUM |
| `meta_nnm_mensal` | number (BRL) | 58.811.936 | Meta global de NNM mensal |
| `metas_periodo` | array | — | Histórico de metas por período `{ano, data_alvo, valor_aum, nnm_mensal}` |

---

## 13. `periodos_status/{periodo}` e coleções reservadas

### `periodos_status/{periodo}`

Controle de fechamento. O documento **só existe** depois que o período é fechado;
sua ausência significa **período aberto** (o motor lê dos cadastros mestre).

| Campo | Tipo | Semântica |
|---|---|---|
| `periodo` | `YYYY-MM` | Período |
| `fechado` | boolean | Estado de fechamento |
| `fechado_em` / `fechado_por` | string | Auditoria do fechamento |
| `reaberto_em` / `reaberto_por` | string | Auditoria de reabertura |
| `total_clientes` / `receita_total` | number | Resumo do fechamento |

### Coleções reservadas (estrutura decidida, ainda não populada)

`patrimonial/`, `evolucao_pl/`, `historico_fluxo/` — previstas para os módulos de
Evolução e Planejamento Patrimonial. A estrutura é reservada; o capítulo do módulo
correspondente (Parte V) define o schema quando a implementação começar.

---

## 14. Legados em extinção

Campos presentes no banco que **não** pertencem ao modelo-alvo. Permanecem inertes
(nenhuma UI escreve neles; o motor não os lê) até uma limpeza dedicada.

| Campo / local | Onde aparece | Destino |
|---|---|---|
| `aliquota_impostos_rebate` | `clientes_base/`, snapshot de cliente | Aposentado — a alíquota de rebate é global por perna (`parametros`). Remover. |
| `fator_consultoria_*`, `fator_serv_*`, `fator_operacional_*` | cliente (base e snapshot) | Indicadores de escopo são **calculados em runtime**, não persistidos. Remover. |
| `pl_onshore`, `pl_offshore`, `pl_offshore_usd`, `ptax_fechamento` | `clientes_base/`, snapshot de cliente | PL é por-período em `poupanca/`. O cadastro/snapshot do cliente não guarda PL. Remover. |
| `ebitda`, `margem`, `margem_contribuicao`, `custo_direto`, `custo_dedicado`, `custo_indireto_rateado`, `custo_total`, `receita_bruta`, `receita_rebate`, `receita_fee_mensal`, `impostos_*`, `classificacao`, `horas_totais`, `custo_direto_detalhe` | `clientes_base/` | Resultado é **derivado**; o cadastro mestre guarda só inputs. Remover do mestre. |
| `pct_consultoria_*`, `pct_serv_*`, `pct_operacional_*` + campos de nome de função (`consultoria_gestao`, etc.) | cliente | Alocação migrou para `vinculos/`. Leitura legada apenas como fallback; nenhuma escrita nova. |
| `horas_reativas_mes` | cliente (base e snapshot) | Campo inerte (sem consumidor). Remover. |
| `nnm_tombamento` (consolidado) | `poupanca/` | Substituído por `nnm_tombamento_onshore/offshore`. Mantido só para compatibilidade de leitura. |
| `salario_base` (para CLT) | `colaboradores_base/` | CLT usa `liquido_acordado`; `salario_base` permanece só para pro_labore/estágio. |
| `migrado_em`, `data_extracao`, `slug` (campo) | cadastros | Metadados de migração — inertes. |

---

## 15. Resumo das invariantes de escrita

1. `id_estavel` é imutável; `docId` de cadastro mestre é o slug e não é re-derivado
   ao salvar.
2. `percentual_alocavel + percentual_institucional = 1.0` (colaborador).
3. `asset_only` ⇒ sem fee, sem custo direto, sem vínculos.
4. Alocação só é escrita em `vinculos/`; o motor lê vínculo-first.
5. PL só vive em `poupanca/`; nunca no cadastro do cliente.
6. Resultado (DRE) é derivado; não se persiste no cadastro mestre.
7. Registro de poupança em quarentena não alimenta agregados.
8. Categorias de custo indireto são canônicas (id_estavel fixo, semeadura
   idempotente).
9. Proposta é snapshot imutável; não altera fees reais.
