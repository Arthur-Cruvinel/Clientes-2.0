# Ato 2A — Validação READ-ONLY de `calcularFolhaColaborador`

Gerado em **2026-05-12T20:37:11Z** · READ-ONLY puro · nenhum arquivo modificado · zero writes.

Fontes lidas: `src/utils/financials.custos.ts`, `src/utils/financials.pipeline.ts`, `src/utils/financials.dre.ts`, `src/utils/constants.ts`, `src/types/index.ts`.

---

## V1 — Assinatura da função

**Caminho:** `src/utils/financials.custos.ts`
**Linhas:** 103-153

**Assinatura:**

```typescript
export function calcularFolhaColaborador(
  c: Colaborador,
  ano = ANO_FOLHA_VIGENTE,   // default = 2026 (constants.ts:99)
  periodo?: string,            // opcional, formato 'YYYY-MM'
): ResultadoFolha
```

**Parâmetros:**

| Nome | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `c` | `Colaborador` | sim | Objeto do colaborador. Campos consumidos: `tipo_vinculo`, `salario_teto_cargo`, `liquido_acordado`, `qtd_dependentes`, `beneficios_fixos`, `localidade`, `historico_reajustes`, `salario_base` |
| `ano` | `number` | não (default `ANO_FOLHA_VIGENTE = 2026`) | Controla qual tabela INSS/IRRF aplicar. Aceita 2025 ou 2026 hoje |
| `periodo` | `string` (`'YYYY-MM'`) | não | Se informado e `c` tem `historico_reajustes`, dispara `buscarTetoPorPeriodo` para resolver teto/líquido vigentes no mês. Sem `periodo`: usa campos diretos do `c` |

**Tipo de retorno:** `ResultadoFolha` (types/index.ts:257-281) — 13 campos:
`salario_teto_cargo`, `liquido_acordado`, `qtd_dependentes`, `inss`, `irrf`, `redutor_ir_2026`, `irrf_liquido`, `liquido_do_teto`, `complemento_plr`, `reflexos_plr_mensal`, `encargos_patronais`, `decimo_terceiro_ferias`, `custo_total_mensal`, `custo_hora`.

---

## V2 — Sensibilidade ao ano

| Item | Aplicação | Hardcoded? | Tabela por ano? | Onde |
|---|---|:---:|:---:|---|
| **INSS** | `calcularINSS(teto, ano)` lookup `TABELA_INSS[ano] ?? TABELA_INSS[2026]` | não | sim — 2025 e 2026 | `financials.custos.ts:19-32` + `constants.ts:46-59` |
| **IRRF** | `calcularIRRF(teto, inss, qtdDep, ano)` lookup `TABELA_IRRF[ano] ?? TABELA_IRRF[2026]` | não | sim — 2025 e 2026 | `financials.custos.ts:35-51` + `constants.ts:61-76` |
| **Dedução por dependente** | `DEDUCAO_DEPENDENTE_IRRF[ano] ?? 189.59` | não (fallback fixo) | sim — 2025, 2026 (ambos 189,59) | `constants.ts:93-96` |
| **Redutor IR 2026** | `if (ano === 2026) irrf -= REDUTOR_IR_2026.formula(teto)` | **sim — só 2026** | n/a | `constants.ts:83-91` + chamada em `financials.custos.ts:49` |
| **Salário mínimo** | NÃO usado | n/a | n/a | — |
| **FGTS (8% específico)** | NÃO existe no código | n/a | n/a | — (decomposição inexistente) |
| **Encargos patronais CLT** | `teto × 0.28` (28% flat) | **sim — hardcoded** | não varia por ano | `financials.custos.ts:141` |
| **Encargos patronais pró-labore** | `salario_base × 0.20` (20% flat — só INSS patronal) | **sim — hardcoded** | não varia por ano | `financials.custos.ts:114` |
| **13º + 1/3 férias CLT** | `(teto / 12) × (4/3)` — provisão mensal | **sim — hardcoded** | não varia por ano | `financials.custos.ts:142` |
| **Reflexos PLR** | `(complemento_plr / 12) × (4/3)` — 13º proporcional + 1/3 férias do PLR | **sim — hardcoded** | não varia por ano | `financials.custos.ts:140` |
| **Horas produtivas/ano (custo/hora)** | `HORAS_PRODUTIVAS_POR_LOCALIDADE[localidade ?? 'SP']` (~1.968h) | **sim — hardcoded** | não varia por ano | `constants.ts:23-28` |

**Implicações:**

1. INSS/IRRF têm cobertura **explícita para 2025 e 2026**. Qualquer outro ano (ex: 2024, 2027) cai no fallback `TABELA_INSS[2026]` — pode produzir resultado tecnicamente incorreto sem aviso.
2. Encargos patronais consolidados em 28% — **não decompõe** FGTS (8%) + INSS patronal (20%) + RAT (1-3%) + sistema S (~5,8%). Total tipicamente ~28-30%; o valor único 28% é coerente com a média.
3. `REDUTOR_IR_2026` aplica APENAS quando `ano === 2026`. Para 2025: redutor = 0 (correto — o redutor entrou em vigor em jan/2026).

---

## V3 — Cobertura para 2025

**Resultado: SIM, FUNCIONA INTEGRALMENTE.**

Detalhes para `calcularFolhaColaborador(c, 2025, '2025-12')`:

- `TABELA_INSS[2025]` ✅ existe (constants.ts:47-52) — 4 faixas até teto 8.157,41 (INSS-teto 951,63)
- `TABELA_IRRF[2025]` ✅ existe (constants.ts:62-68) — 5 faixas, dedução máxima 896,00
- `DEDUCAO_DEPENDENTE_IRRF[2025]` ✅ existe (189,59)
- `REDUTOR_IR_2026` **não aplica** (condicional `ano === 2026` em `financials.custos.ts:136` evita)
- `buscarTetoPorPeriodo(c, '2025-12')` resolve corretamente para `historico_reajustes` quando presente; senão fallback para campos diretos
- Encargos patronais (28% CLT, 20% pró-labore), 13º/férias, reflexos PLR: independentes de ano — usam o teto do período

**Comportamento para anos não cobertos** (ex: 2024 ou 2027):

```typescript
const tabela = TABELA_INSS[ano] ?? TABELA_INSS[2026];  // fallback silencioso
```

**Nenhuma exceção é lançada.** Para 2024, o motor usaria tabela 2026 — silenciosamente incorreto. Esse não é o caso da Fase 2 (Dez/25 está coberto), mas é uma vulnerabilidade a anotar.

---

## V4 — 13º, PLR, férias, diferença teto

| Item | Cálculo na função | Observação |
|---|---|---|
| **13º + 1/3 férias CLT** | `decimo_terceiro_ferias = (teto / 12) * (4/3)` — provisão mensal (linha 142). Inclui 13º (`teto/12`) **+** 1/3 férias (`teto/12 ÷ 3`). | Modelo de **acúmulo mensal**, não semestral. Cada mês provisiona 1/12 do 13º + 1/12 do (1/3 das férias) |
| **PLR (complemento)** | `complemento_plr = max(0, liquido_acordado - liquido_do_teto)` (linha 139). | Aplicado **mensalmente** como diferença entre líquido desejado e líquido do teto. Sem lógica semestral |
| **Reflexos PLR** | `reflexos_plr_mensal = (complemento_plr / 12) * (4/3)` (linha 140). | 13º proporcional + 1/3 férias do complemento — provisão mensal |
| **Férias propriamente ditas** | Não calculadas separadamente — embutidas no `decimo_terceiro_ferias` como 1/3 férias mensalizadas | Não há controle de gozo de férias; é provisão linear |
| **`diferenca_teto`** | **NÃO existe no `ResultadoFolha`** atual (types/index.ts:257-281) | Campo presente em snapshots Firestore mas **legado**. Comentário em `Colaborador.liquido_acordado` (types:223) explicita: "Substitui `diferenca_teto` como input (CLT)". O motor antigo gerava o campo; o atual não. Confirma que `diferenca_teto` em snapshots é vestigial — Categoria C do diagnóstico anterior é resolvida: **legado, não recalcular** |

**Conclusão V4:** Cobertura completa. `diferenca_teto` formalmente descontinuado — o `complemento_plr` é o sucessor.

---

## V5 — Comportamento para sócios (pró-labore)

### Lógica da função

Linha 110: `if (c.tipo_vinculo === 'pro_labore')` — único discriminante.

- **Se `tipo_vinculo === 'pro_labore'`:**
  - Custo total = `salario_base + beneficios_fixos + (salario_base × 0,20)`
  - Encargos = 20% INSS patronal sobre `salario_base`
  - INSS/IRRF do funcionário = 0
  - 13º/férias = 0
  - Complemento PLR = 0
  - Reflexos PLR = 0
  - **Histórico de reajustes NÃO usado** (usa `salario_base` direto)

- **Se `tipo_vinculo !== 'pro_labore'` (incl. `'clt'` e qualquer outro valor):**
  - Calculado como CLT padrão (encargos 28%, 13º/férias, INSS/IRRF, PLR completo)

### Estado atual dos 3 sócios em `colaboradores_base/`

Conforme diagnóstico do Ato 1.5 (commit `2c6530f`):

| Nome | `tipo_vinculo` | `salario_teto_cargo` | `salario_base` | `liquido_acordado` |
|---|---|---:|---:|---:|
| Amilcar Junior | **`clt`** | 13.466,10 | 10.000 | 0 |
| Priscilla Rocha | **`clt`** | 13.466,10 | 10.000 | 0 |
| Viviane Leal | **`clt`** | 13.466,10 | 10.000 | 0 |

**Todos os 3 estão `tipo_vinculo='clt'`** — serão calculados como CLT padrão. Comparação de custos:

| Hipótese | Cálculo (Amilcar) | Custo aprox./mês |
|---|---|---:|
| Tratado como CLT (estado atual) | `13466.10 + 0.28×13466.10 + (13466.10/12)×1,333 + benefícios` | **~R$ 18.734** + benefícios |
| Tratado como pró-labore (operacional real) | `10000 + 0.20×10000 + benefícios` | **~R$ 12.000** + benefícios |
| Δ | | **~R$ 6.700/mês** |

**Para 3 sócios: divergência operacional ~R$ 20 mil/mês a mais.**

### Risco para Ato 2B

Importante: **os snapshots de Jan/26 a Abr/26 já operam com `tipo_vinculo='clt'`** para os 3 sócios (confirmado pelo diagnóstico Q1 do Ato 1). O Ato 2B vai apenas **replicar a mesma lógica para Dez/25** — não introduz divergência nova.

**Risco para Ato 2B: BAIXO**

A inconsistência (sócios tratados como CLT) **já existe em produção**. Replicar para Dez/25 mantém **paridade de status quo**. Não piora nem corrige.

**Risco para correção futura: MÉDIO**

A migração eventual dos 3 para `tipo_vinculo='pro_labore'` impacta todos os 5 períodos (Dez/25 a Abr/26), recalculando o custo institucional e o pool de indiretos. Tópico para Ato 2C ou Fase 4 (Princípio 2 — validação + correção de cadastro).

---

## V6 — Comportamento para estagiários

### Lógica da função

A função **não tem ramo para estagiários**. Existem só dois ramos:

```typescript
if (c.tipo_vinculo === 'pro_labore') { ... }   // 20% INSS patronal, sem 13º/férias/PLR
// else: trata como CLT padrão (28% encargos, 13º/férias, INSS/IRRF, PLR)
```

Não distingue por `cargo`, não tem `tipo_vinculo='estagio'`, não tem ajuste por idade ou situação acadêmica.

### Estado atual dos 2 estagiários em `colaboradores_base/`

| Nome | Cargo | `tipo_vinculo` | `salario_teto_cargo` | `liquido_acordado` |
|---|---|---|---:|---:|
| Maria Eduarda Cruz | Estágio Administrativo | **`clt`** | 2.300 | 0 |
| Mariah Assbu | Estágio Administrativo | **`clt`** | 2.300 | 0 |

Como `tipo_vinculo='clt'`, são calculados como CLT padrão:

- INSS sobre 2.300 (faixa 7,5% em 2025, 7,5% em 2026) ≈ R$ 172,50
- IRRF = 0 (isento — abaixo do mínimo tributável)
- Encargos patronais 28% × 2.300 = R$ 644
- 13º/férias provisionados ≈ R$ 256
- Custo total ≈ R$ 2.300 + 1.426,83 (benef.) + 644 + 256 ≈ **R$ 4.627/mês**

Realidade contratual de estagiário (Lei 11.788/2008):
- Sem FGTS (mas Galácticos pode oferecer voluntariamente)
- Sem INSS patronal obrigatório
- Sem 13º obrigatório (mas pode haver gratificação)
- Recesso remunerado opcional (não é "1/3 férias")
- Custo real ≈ salário + auxílio-transporte + (opcional: seguro/alimentação)

**Diferença bruta: ~R$ 900-1.300/mês de custo excessivo por estagiário se não há benefícios CLT formais.**

### Risco para Ato 2B

Mesma análise dos sócios: **os snapshots Jan/26-Abr/26 já operam com `tipo_vinculo='clt'`** para os 2 estagiários. Ato 2B replica o status quo para Dez/25.

**Risco para Ato 2B: BAIXO**

**Risco para correção futura: MÉDIO**

Requer (a) introduzir `tipo_vinculo='estagio'` ou (b) usar `cargo` como discriminante; (c) decidir se Galácticos paga FGTS/13º voluntariamente; (d) novo ramo na função `calcularFolhaColaborador`. Tópico para Ato 2C ou Fase 4+.

---

## V7 — Recomendação para Ato 2B

### A função está PRONTA para uso direto?

**SIM**, com as ressalvas abaixo.

**O que funciona:**
- ✅ `ano=2025` totalmente coberto (TABELA_INSS[2025] e TABELA_IRRF[2025] existem)
- ✅ Sócios serão calculados como CLT — **mantendo paridade** com o que já está em Jan/26-Abr/26
- ✅ Estagiários serão calculados como CLT — **mantendo paridade** com o que já está em Jan/26-Abr/26
- ✅ `historico_reajustes` será respeitado via `buscarTetoPorPeriodo('2025-12')`
- ✅ Resultado bate com `ResultadoFolha` esperado (13 campos)

**O que NÃO precisa ser ajustado para o Ato 2B:**

A função replica o status quo. Como os snapshots existentes (Jan/26-Abr/26) já usam a função sem distinção de sócios/estagiários, **o Ato 2B vai produzir resultados consistentes com o histórico**. Mudar o tratamento de sócios/estagiários AGORA criaria divergência entre Dez/25 (corrigido) e Jan/26-Abr/26 (não corrigido) — pior que o status quo.

### Precisa de validação manual (cross-check com folha real)?

**Sim — recomendado, não-bloqueante.**

Validação proposta:
- Antes do Ato 2B apply: rodar `calcularFolhaColaborador(c, 2026, '2026-01')` para 2-3 colaboradores e comparar com `custo_total_mensal` já gravado em `fechamentos/2026-01/colaboradores/`.
- Esperado: diferenças zero ou ínfimas (~R$ 0,01 — arredondamento) para a maioria.
- Diferenças até **R$ 1** podem ocorrer pelas variações já documentadas no diagnóstico Q1 anterior (transição `HORAS_CLT_MES` → `HORAS_PRODUTIVAS_POR_LOCALIDADE`).
- Diferenças >R$ 5 sinalizariam inconsistência a investigar **antes** do Ato 2B.

### Pendências a registrar (para Ato 2C ou Fase 4+)

1. **Sócios** (Amilcar, Priscilla, Viviane) com `tipo_vinculo='clt'` mas operacionalmente são pró-labore. Custo divergente ~R$ 6.700/mês cada. Decisão de cadastro pendente.
2. **Estagiários** (Maria Eduarda, Mariah) com `tipo_vinculo='clt'` mas tratamento contratual diferente. Custo divergente ~R$ 900-1.300/mês cada. Requer (a) novo enum `'estagio'`, (b) novo ramo na função, (c) decisão sobre FGTS/13º voluntários.
3. **Vulnerabilidade silenciosa para anos não cobertos**: ano=2024 ou 2027 cai em fallback `TABELA_INSS[2026]` sem aviso. Sugerir `console.warn` ou throw para anos ausentes.
4. **`diferenca_teto` em snapshots Firestore é legado** — não recalcular, não persistir. Categoria C do diagnóstico anterior fica resolvida.
5. **Encargos patronais 28% flat** — não decompõe FGTS, RAT, INSS patronal, sistema S. Se Galácticos precisar relatório segregado por componente, requer refatoração.

---

**Veredito final:** A função `calcularFolhaColaborador` está apta para uso direto no Ato 2B com ano=2025. **Recomendo prosseguir** com a replicação para Dez/25 após cross-check manual com 2-3 colaboradores de Jan/26.

**Pendências de cadastro (sócios, estagiários) não bloqueiam o Ato 2B** — devem ser tratadas em Ato 2C ou Fase 4 para evitar divergência cross-período.

---

**Fim da validação.**
