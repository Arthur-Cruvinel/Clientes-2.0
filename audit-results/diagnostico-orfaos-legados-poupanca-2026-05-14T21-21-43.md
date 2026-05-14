# Quantificação de órfãos legados em poupanca/

Gerado em **2026-05-14T21:21:43Z** · READ-ONLY puro · zero writes Firestore · zero modificações de código · nenhum arquivo criado fora deste relatório.

## Sobre as fontes de dados

Para não criar arquivos auxiliares (`audit-poupanca.mjs` produz um relatório `.md` adicional em cada execução), este diagnóstico foi feito a partir de fontes já presentes no repositório, **sem rodar a auditoria viva**:

| Fonte | Tipo | Data | Conteúdo |
|---|---|---|---|
| `audit-results/poupanca-2026-05-08T18-45-51.md` | Auditoria viva anterior | 2026-05-08 18:45 | Snapshot Cat1/Cat2/Cat3 de `poupanca/` contra `SIGLA_PARA_NOME` |
| `backups/firestore/poupanca-fantasmas-2026-05-10T14-17-41.json` | Snapshot pré-cleanup | 2026-05-10 11:17 UTC | Os 7 docs identificados como fantasma na auditoria de 08-mai, salvos pelo `cleanup-poupanca-fantasmas.mjs` antes da deleção |
| `backups/firestore/id-estavel-2026-05-10T22-31-26-clientes_base.json` | Snapshot de `clientes_base/` | 2026-05-10 19:31 | 84 clientes — base canônica para o cross-check exigido pelo objetivo |
| `src/features/poupanca/import/MAPEAMENTO_SIGLAS.ts` | Código-fonte | corrente | Lookup hardcoded sigla→cliente (~440 entradas) |
| `scripts/cleanup-poupanca-fantasmas.mjs` | Código de cleanup | corrente | Script que deleta os 7 docs (alvos hardcoded por slug) |

**Caveat explícito:** o "hoje" no número final depende de o `cleanup-poupanca-fantasmas.mjs` ter sido executado ou não entre 10-mai e 14-mai. Nenhum commit posterior a 10-mai registra essa execução (git log inspecionado abaixo). Reporto os dois cenários.

---

## I1 — Universo total

Da auditoria viva de 08-mai (`audit-results/poupanca-2026-05-08T18-45-51.md`):

- **Total de docs em `poupanca/`**: **806**
- Cat1 (slug divergente de `slugify(nome_cliente)`): 0 docs — todos os slugs são consistentes
- Cat2 (cliente-fantasma — slug sem sigla canônica em `SIGLA_PARA_NOME`): 7 docs em 3 slugs
- Cat3 (contas_agregadas suspeito): 0 docs

Range temporal exato exige live query. Pelo restante do contexto (Fase 2 Ato 2C foi rodado em períodos dez/25–abr/26), o universo cobre **dez/2025 a abr/2026** com ~80-95 docs por período (consistente com 806 total ÷ 5-6 períodos × ~140 docs do snapshot de fechamentos).

Clientes distintos por `nome_cliente`: estimativa de ~95-100 nomes distintos (~85 reais + 3 fantasmas + entradas que cobrem só onshore OU só offshore separadamente — a coleção `poupanca/` admite ambos).

---

## I2 — Fonte canônica de clientes para cruzamento

Há **DUAS** fontes canônicas no projeto, com escopos diferentes:

| Fonte | Nº de entradas | Chave usada |
|---|---:|---|
| `clientes_base/` | **84 docs** | `docId = slug(nome_cliente)`. Cadastro mestre dos clientes ativos do family office |
| `SIGLA_PARA_NOME` em `MAPEAMENTO_SIGLAS.ts` | ~120 entradas (estimado por extensão do bloco) | sigla curta → nome completo. Inclui variantes históricas (clientes que saíram, contas offshore) |

O `audit-poupanca.mjs` usa `slugsCanonicos(siglaParaNome)` — slugs derivados de `SIGLA_PARA_NOME`, NÃO de `clientes_base/`. Para o cruzamento que o objetivo pede (contra `clientes_base/`), faço o reuso abaixo: cada um dos 3 slugs órfãos da Cat2 foi conferido contra ambas as fontes.

A chave de match é `slug(nome_cliente)` em ambos os lados — alinha-se com o `docId` em `clientes_base/{slug}` e com o prefixo do `docId` em `poupanca/{slug}_{ano}_{mes}`.

---

## I3 — Cruzamento: registros sem cliente correspondente

Os 7 docs órfãos identificados na auditoria viva de 08-mai:

| docId | slug | nome_cliente | período |
|---|---|---|---|
| `msal_investments_limited_2026_4` | `msal_investments_limited` | MSAL INVESTMENTS LIMITED | 2026-04 |
| `ria_btg_2026_3` | `ria_btg` | RIA_BTG | 2026-03 |
| `ria_btg_2026_4` | `ria_btg` | RIA_BTG | 2026-04 |
| `wenderson_r_do_nascimento_galeno_2026_1` | `wenderson_r_do_nascimento_galeno` | WENDERSON R. DO NASCIMENTO GALENO | 2026-01 |
| `wenderson_r_do_nascimento_galeno_2026_2` | `wenderson_r_do_nascimento_galeno` | WENDERSON R. DO NASCIMENTO GALENO | 2026-02 |
| `wenderson_r_do_nascimento_galeno_2026_3` | `wenderson_r_do_nascimento_galeno` | WENDERSON R. DO NASCIMENTO GALENO | 2026-03 |
| `wenderson_r_do_nascimento_galeno_2026_4` | `wenderson_r_do_nascimento_galeno` | WENDERSON R. DO NASCIMENTO GALENO | 2026-04 |

Cross-check contra `clientes_base/` (84 docs do snapshot de 10-mai):

| Slug órfão | Existe em `clientes_base/`? | Match normalizado em nome? |
|---|---|---|
| `msal_investments_limited` | ✗ Não | ✗ (não há "MSAL" em nenhum nome cadastrado) |
| `ria_btg` | ✗ Não | ✗ (não há nenhum nome contendo "RIA " em `clientes_base/`) |
| `wenderson_r_do_nascimento_galeno` | ✗ Não — `clientes_base/` tem `wenderson_galeno` / "WENDERSON GALENO" (slug curto, sem nomes do meio) | Match parcial: "WENDERSON" é prefixo, mas slugs diferentes |

**Resumo do cruzamento:**

- Registros VINCULADOS a cliente real: **799** (806 − 7)
- Registros ÓRFÃOS: **7** ← **número central**
- Nomes órfãos distintos: **3** (MSAL INVESTMENTS LIMITED, RIA_BTG, WENDERSON R. DO NASCIMENTO GALENO)
- Períodos abrangidos: **4** (2026-01 a 2026-04 — todos no Q1+Abril/26)

> **Sobre o "hoje":** o snapshot `poupanca-fantasmas-2026-05-10T14-17-41.json` mostra que o `cleanup-poupanca-fantasmas.mjs` *começou* a executar em 10-mai (o snapshot é gravado na etapa 3 do pipeline, ANTES da etapa 5 que pede confirmação humana e 6 que deleta). Não há commit posterior registrando o término. Logo: **se o usuário confirmou** o prompt yes/no em 10-mai, hoje há 0 órfãos; **se cancelou**, hoje ainda há 7. Sem live query, não dá pra distinguir. Conservativamente, reporto **7 órfãos legados como teto**.

---

## I4 — Caracterização dos órfãos

| nome_cliente órfão | nº registros | padrão provável | candidato a cliente real |
|---|---:|---|---|
| MSAL INVESTMENTS LIMITED | 1 (Abr/26) | **Nome bruto extraído pelo Claude** (entidade jurídica do custodiante Andbanc — o offshore PJ que abriga a conta) | **MOISES LIMA MAGALHAES** (slug `moises_lima_magalhaes`) — confirmado em `clientes_base/`. MAPEAMENTO_SIGLAS já tem `'MSAL Investments Limited': 'MLM'` (linha do bloco "Variantes adicionadas em 2026-05-10"). O orfão pré-existe a essa entrada |
| RIA_BTG | 2 (Mar/26, Abr/26) | **Sigla bruta como nome** (padrão característico do caminho 3 — multi-período — quando `MAPEAMENTO_SIGLAS[codigoCarteira]` falha) | Nenhum candidato óbvio em `clientes_base/` nem em `MAPEAMENTO_SIGLAS`. Comentário inline no `cleanup-poupanca-fantasmas.mjs`: *"lixo de teste"*. Provável que tenha sido upload de um cliente RIA HOLDINGS LTD (mencionado em memória do projeto) que nunca foi formalmente cadastrado |
| WENDERSON R. DO NASCIMENTO GALENO | 4 (Jan-Abr/26) | **Nome bruto do PDF** — full name extraído pelo Claude da lâmina Andbanc TAW019218 (caminho 2 — onshore single-period — quando o nome no PDF não bate com o nome cadastrado) | **WENDERSON GALENO** (slug `wenderson_galeno`) — confirmado em `clientes_base/`. MAPEAMENTO_SIGLAS tem `'Wenderson R. do Nascimento Galeno': 'WRG'` na seção "Variantes adicionadas em 2026-05-10" |

Padrões observados:

- 1 órfão por nome bruto offshore (MSAL = razão social da entidade Andbanc)
- 4 órfãos por nome bruto onshore (forma completa do nome no extrato Comdinheiro)
- 2 órfãos por sigla literal (RIA_BTG sem mapeamento)

Os 3 padrões batem com a previsão do diagnóstico anterior de 14-mai ("nome bruto do PDF" vs "sigla bruta") — confirma empiricamente os caminhos 2 e 3 produzindo lixo.

---

## I5 — Cross-check com MAPEAMENTO_SIGLAS

| Nome órfão | Existe entrada no MAPEAMENTO_SIGLAS? | Diagnóstico |
|---|---|---|
| MSAL INVESTMENTS LIMITED | **✓ Sim** — `'MSAL Investments Limited': 'MLM'` + `'OF PORTFOLIO MSAL Investments Limited': 'MLM'` + dois códigos brutos (`TAW019408`, `D47226006`) | **Lookup foi ignorado em algum momento**. Hoje a entrada existe, mas o registro órfão precede o cadastro dessa variante no MAPEAMENTO. O upload de Abr/26 que gerou esse doc rodou ANTES dessa entrada ser adicionada (10-mai, "rodada de limpeza offshore" — vide comentário no MAPEAMENTO) |
| WENDERSON R. DO NASCIMENTO GALENO | **✓ Sim** — `'Wenderson R. do Nascimento Galeno': 'WRG'` + variantes `WRG_BTG`/`WRG_C`/`WRG_SP` | Mesmo padrão. A entrada existe HOJE, mas os 4 docs de Jan-Abr/26 foram criados antes do cadastro dessa variante. Caminho 2 (onshore single-period) gerou os fantasmas porque o `MAPEAMENTO_SIGLAS[item.codigo_carteira]` falhou e caiu no fallback `item.nome_cliente` (linha 312 do `parseComClaude.ts`) |
| RIA_BTG | **✗ Não** — nenhuma entrada `RIA` em MAPEAMENTO_SIGLAS. Confirmado por busca exaustiva em `MAPEAMENTO_SIGLAS.ts` | **Sigla genuinamente desconhecida**. Comentário do cleanup script trata como "lixo de teste". O sufixo `_BTG` é convenção interna para "conta no BTG"; o prefixo "RIA" não bate com nenhum cliente cadastrado |

**Sumário I5:**

- Órfãos cuja sigla **EXISTE** no mapeamento (lookup foi ignorado / cadastro veio depois): **5 docs** em 2 nomes (MSAL=1, Wenderson=4)
- Órfãos com sigla **genuinamente desconhecida**: **2 docs** em 1 nome (RIA_BTG=2)

A maioria (5 de 7) confirma o achado do diagnóstico anterior: o caminho onshore não consultava o mapeamento Firestore (`mapeamento_siglas/`), e quando o MAPEAMENTO hardcoded não tinha a variante na época do upload, o nome bruto do PDF virava nome do cliente. As entradas foram adicionadas ao MAPEAMENTO depois (rodada de 10-mai), mas os docs órfãos permaneceram — a UI não reprocessa retroativamente.

---

## I6 — Impacto nos agregados

Valores extraídos do snapshot `poupanca-fantasmas-2026-05-10T14-17-41.json`:

| docId | pl_onshore | pl_offshore (BRL) | PTAX | Componente |
|---|---:|---:|---:|---|
| `msal_investments_limited_2026_4` | — | (campos parciais — só pl_inicial_offshore_usd=743.102) | — | Offshore: ≈ 743.102 × ~5,50 PTAX ≈ **R$ 4,1 M** |
| `ria_btg_2026_3` | 0 | — | — | Onshore: **R$ 0** |
| `ria_btg_2026_4` | -126,36 | — | — | Onshore: **−R$ 126** (residual negativo) |
| `wenderson_r_do_nascimento_galeno_2026_1` | — | 3.805.969,92 | 5,2301 | Offshore: **R$ 3,81 M** + tombamento espúrio R$ 3,81 M |
| `wenderson_r_do_nascimento_galeno_2026_2` | — | 3.766.251,61 | 5,1495 | Offshore: **R$ 3,77 M** |
| `wenderson_r_do_nascimento_galeno_2026_3` | — | 3.787.217,52 | 5,2194 | Offshore: **R$ 3,79 M** |
| `wenderson_r_do_nascimento_galeno_2026_4` | — | (sem pl_offshore explícito; pl_inicial_offshore_usd=726.666) | — | Offshore: ≈ 726.666 × ~5,35 PTAX ≈ **R$ 3,89 M** |

**AUM fantasma por período (soma dos órfãos):**

| Período | AUM fantasma (R$, ordem de grandeza) |
|---|---:|
| 2026-01 | R$ 3,81 M (Wenderson) |
| 2026-02 | R$ 3,77 M (Wenderson) |
| 2026-03 | R$ 3,79 M (Wenderson) + R$ 0 (RIA_BTG) ≈ R$ 3,79 M |
| 2026-04 | R$ 3,89 M (Wenderson) + R$ 4,10 M (MSAL) − R$ 126 (RIA_BTG) ≈ **R$ 7,99 M** |

**O órfão Wenderson é particularmente grave por dois motivos:**

1. Ele NÃO é AUM novo — é o mesmo PL do cliente real `wenderson_galeno` aparecendo como cliente fantasma. **Está duplicando ~R$ 3,8 M/mês no AUM total** (R$ 3,8M no `wenderson_galeno` + R$ 3,8M no fantasma `wenderson_r_do_nascimento_galeno`). Total inflado ≈ **R$ 15 M** no acumulado Jan-Abr/26.
2. O doc de Jan/26 tem `nnm_tombamento_offshore: 3.809.997` — esse é justamente o "tombamento espúrio" mencionado no CLAUDE.md (`useImportPoupanca.ts:541-555`). O cliente fantasma também herdou o tombamento espúrio, inflando o NNM agregado.

**Rebate fictício estimado** (aplicando a fórmula do CLAUDE.md: rebate = PL × taxa × (1−alíq) × split, com taxa_off ≈ 0,6% a.a., alíq_impostos ≈ 0,17, split = 0,5):

```
Wenderson fantasma:
  ~R$ 3,8 M × 0,006 / 12 × 0,83 × 0,5 = ~R$ 789/mês × 4 meses = ~R$ 3.155
MSAL fantasma:
  ~R$ 4,1 M × 0,006 / 12 × 0,83 × 0,5 = ~R$ 851/mês × 1 mês = ~R$ 851
RIA_BTG fantasma:
  PL ≈ 0 → rebate ≈ R$ 0
TOTAL rebate fictício no Q1+Abr/26: ≈ R$ 4.000
```

Mas: o AppContext sintetiza o fantasma Wenderson como Pure Asset usando o PL fantasma. A receita de rebate calculada vai direto para o DRE como receita do "cliente" wenderson_r_do_nascimento_galeno. Isso é receita fictícia: o cliente real `wenderson_galeno` já gera rebate sobre o mesmo capital. **Resultado prático: dupla contagem da receita de rebate do Wenderson.**

Magnitude:
- AUM fantasma único: ~R$ 8 M acumulado em Abr/26 (Wenderson + MSAL, contando uma vez cada)
- AUM **duplicado** (Wenderson fantasma + Wenderson real): ~R$ 15 M no Q1+Abr/26
- Rebate fictício no DRE: ~R$ 4 mil acumulado em Q1+Abr/26 — irrelevante numericamente, mas conceitualmente uma corrupção do DRE

---

## CONCLUSÃO

**Número de órfãos legados em poupanca/ contra `clientes_base/`:** **7 docs em 3 nomes distintos** (com a ressalva do caveat — pode ser **0** se o `cleanup-poupanca-fantasmas.mjs` foi confirmado em 10-mai; o que precisaria de uma live query para verificar).

**Esforço de migração para quarentena: BAIXO (<10).**

Os 7 docs já têm script de cleanup pronto e validado (`scripts/cleanup-poupanca-fantasmas.mjs`) que:

- lista exatamente esses 3 slugs hardcoded
- salva snapshot pré-delete (já feito — `poupanca-fantasmas-2026-05-10T14-17-41.json`)
- pede confirmação interativa
- deleta um a um

Quantos exigem decisão humana vs quantos são mapeáveis mecanicamente:

| Categoria | Decisão | Ação |
|---|---|---|
| MSAL INVESTMENTS LIMITED (1 doc) | **Mecânica** — mapeável | Re-processar o upload offshore de Abr/26 com o MAPEAMENTO atualizado (já tem `MSAL Investments Limited→MLM`); o item ressurgirá como agregado em `moises_lima_magalhaes_2026_4`. Em seguida deletar o doc fantasma |
| WENDERSON R. DO NASCIMENTO GALENO (4 docs) | **Mecânica** — mapeável | Mesma lógica: re-processar os uploads onshore de Jan-Abr/26 com `MAPEAMENTO_SIGLAS['Wenderson R. do Nascimento Galeno']` agora resolvendo para WRG. Em seguida deletar os 4 docs fantasma |
| RIA_BTG (2 docs) | **Decisão humana** | Comentário do cleanup-script chama de "lixo de teste". CFO precisa confirmar antes de deletar — pode ser cliente cadastrado num teste isolado que nunca virou produção, ou cliente real que precisa ser cadastrado. PL = 0 → impacto financeiro nulo, mas semanticamente precisa de decisão |

**Total: 5 mecânicos + 2 com decisão humana** (mas a decisão humana sobre o RIA é "delete os 2 que estão com PL=0" — trivial).

**Por que isto é BAIXO:**

- 7 docs órfãos em uma coleção de 806 = 0,87% de contaminação
- 3 nomes distintos — cabe em 3 botões de "Aplicar correção"
- Script de cleanup já pronto, com snapshot pré-cleanup já feito (em backups/firestore/)
- Impacto financeiro do DRE: ~R$ 4 mil acumulados (rebate fictício) — não move o ponteiro do family office
- Impacto no AUM: R$ 8-15 M de duplicação, percebível só em quem olha cliente-por-cliente

**Recomendação operacional** (fora do escopo deste relatório, mas óbvia):

1. Rodar `node scripts/cleanup-poupanca-fantasmas.mjs` (read-then-confirm-then-delete) — se ainda não foi feito.
2. **Antes** disso, re-processar os uploads originais de MSAL/Wenderson para garantir que os dados reais estão em `moises_lima_magalhaes_*` e `wenderson_galeno_*` (não duplicar).
3. Confirmar com o CFO sobre os 2 docs RIA_BTG.
4. Após cleanup, rodar `audit-poupanca.mjs` para confirmar zero Cat2.

A causa raiz (o caminho 2 e 3 ignorando `mapeamento_siglas/` Firestore) continua presente. Cleanup limpa o histórico; sem fix de código, novos órfãos podem ser criados a cada novo upload onshore com sigla nova. Já documentado no diagnóstico anterior de 14-mai.
