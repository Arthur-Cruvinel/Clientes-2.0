# Diagnóstico — anomalia em `fechamentos/2026-04/colaboradores/` (Sub-etapa 2A.5.c)

Gerado em **2026-05-13T16:19:55Z** · READ-ONLY puro · zero writes · zero modificações de código.

Scripts descartáveis usados (removidos após esta análise):
- `scripts/diagAbr26.mjs` (5 leituras de coleção + cross-check base)
- `scripts/diagAbr26Detalhado.mjs` (re-execução com filtro `tipo_vinculo == null`)

---

## I1 — Estado dos 21 colaboradores reais em Abr/26

| Discriminante | Total |
|---|---:|
| Docs reais (não-template) em `fechamentos/2026-04/colaboradores/` | **21** |
| Pós-pipeline completo (`tipo_vinculo` populado, ~25 campos) | **18** |
| **Pré-pipeline (`tipo_vinculo == null`, ~15 campos)** | **3** |

### Os 3 docs pré-pipeline são exatamente os 3 sócios

| Slug | Nome | `tipo_vinculo` | `salario_base` | `custo_total_mensal` | Nº campos |
|---|---|---|---:|---:|---:|
| `amilcar_junior` | Amilcar Junior | **null** | 10.000 | 10.000 | 15 |
| `priscilla_rocha` | Priscilla Rocha | **null** | 10.000 | 10.000 | 15 |
| `viviane_leal` | Viviane Leal | **null** | 10.000 | 10.000 | 15 |

`custo_total_mensal = salario_base` (sem encargos, sem 13º, sem PLR) — caracteriza estado pré-pipeline.

---

## I2 — Diff Viviane Leal entre Mar/26 e Abr/26

| Métrica | Mar/26 | Abr/26 |
|---|---:|---:|
| Total de campos no doc | **25** | **15** |

### Os 10 campos presentes em Mar/26 e AUSENTES em Abr/26

Exatamente o bloco "CLT completo" que indica passagem pelo motor:

| Campo | Categoria |
|---|---|
| `tipo_vinculo` | A (discriminante) |
| `historico_reajustes` | A (perene CLT) |
| `liquido_acordado` | A (perene CLT) |
| `localidade` | A (perene CLT) |
| `qtd_dependentes` | A (semi-perene CLT) |
| `id` | A (legado) |
| `inss` | B (calculado mensal) |
| `irrf` | B (calculado mensal) |
| `complemento_plr` | B (calculado mensal) |
| `reflexos_plr_mensal` | B (calculado mensal) |

### Campos presentes em Abr/26 e ausentes em Mar/26

**Nenhum.** Abr/26 não introduziu nada novo — é estritamente um **subconjunto** dos campos de Mar/26.

### Hipótese

O snapshot de Viviane (e dos outros 2 sócios) em Abr/26 foi **gravado/regravado por um processo que NÃO passou pelo motor financeiro** — apenas o bloco mínimo de identidade + alguns calculados básicos. Pode ter sido:
- Edição manual via Firebase Console (rollback parcial)
- Importação Excel parcial sem rodar o pipeline
- Operação de `setDoc` direto que sobrescreveu mantendo apenas Categoria A mínima

A regressão é **exclusiva dos 3 sócios** — os outros 18 colaboradores em Abr/26 mantêm 25 campos. Não é um problema sistêmico do período.

---

## I3 — Padrão temporal dos snapshots

Campos de timestamp pesquisados em todos os 21 docs de Abr/26:
`data_criacao`, `data_atualizacao`, `updatedAt`, `createdAt`, `data_replicacao`.

| Métrica | Valor |
|---|---:|
| Docs com algum campo de timestamp no payload | **0** |
| Docs sem nenhum timestamp | **21** |

**Conclusão I3:** Não há rastreabilidade cronológica nos payloads. Firestore guarda `createTime`/`updateTime` nos metadados do servidor (consultáveis via Admin SDK ou via console), mas o client SDK usado aqui não expõe esses campos via `getDocs`. Não conseguimos identificar a ordem de criação/edição apenas com leitura.

---

## I4 — Cross-check `colaboradores_base/` para os 3 sócios pré-pipeline

| Slug | Existe em `colaboradores_base/`? | `tipo_vinculo` na base | `funcao_principal` na base | `cargo` na base |
|---|:---:|---|---|---|
| `amilcar_junior` | ✅ | `clt` | `institucional` | Sócio |
| `priscilla_rocha` | ✅ | `clt` | `institucional` | Sócio |
| `viviane_leal` | ✅ | `clt` | `institucional` | CEO |

Todos têm presença completa em `colaboradores_base/` (foram criados no Ato 1, atualizados no Ato 1.5).

**Conclusão I4:** A base está íntegra. O snapshot Abr/26 dos 3 sócios é que está incompleto. A Categoria A está toda disponível em `colaboradores_base/` — qualquer processo de recálculo pode reconstruir o snapshot a partir da base.

---

## I5 — Comparação com Dez/25 a Mar/26 (filtro `tipo_vinculo == null`)

| Período | Total docs reais | Pré-pipeline (`tipo_vinculo == null`) |
|---|---:|---:|
| **2025-12** | **26** | **26 (100%)** |
| 2026-01 | 21 | 0 ✓ |
| 2026-02 | 21 | 0 ✓ |
| 2026-03 | 21 | 0 ✓ |
| **2026-04** | 21 | **3 (apenas sócios)** |

### Observação sobre Dez/25

Os 26 docs reais de Dez/25 incluem **5 slugs duplicados** detectados na query (mesmo slug aparecendo 2x, com docIds UUIDs diferentes):

- `giovanna_pargoli`
- `luis_eduardo_nerone`
- `luisa_villa`
- `matheus_tripoli`
- `thayna_ribeiro`

O caso `luis_eduardo_nerone` já foi documentado na investigação Nerone (2026-05-11) — dois docs (`6fcc0862-...` e `8aba1578-...`) com cargos divergentes. Os outros 4 slugs duplicados são novos achados deste diagnóstico — provavelmente mesmo padrão de "novo cadastro em vez de edição" do Excel original. Todos serão sanados pelo Ato 2 (delete + replicação a partir de `colaboradores_base/`).

### Padrão temporal observado

- **Dez/25:** estado original do Excel — nenhum doc passou pelo motor financeiro
- **Jan-Mar/26:** estado pós-pipeline completo — motor rodou em todos
- **Abr/26:** estado pós-pipeline para 18 colaboradores **mas regressão isolada dos 3 sócios**

---

## Conclusão diagnóstica

### Causa provável

Os 3 sócios em Abr/26 sofreram uma operação de write que apagou os 10 campos do bloco "CLT completo" — provavelmente **edição manual ou rerun parcial de import** que sobrescreveu apenas a Categoria A mínima sem deixar o motor financeiro recalcular. Esse evento foi específico para Abr/26 e específico para os 3 sócios.

Não há corrupção sistêmica — o evento é localizado.

### Escopo do problema

**Limitado a 3 docs (Abr/26 × 3 sócios).** Jan/26, Fev/26 e Mar/26 estão íntegros. Dez/25 está em estado pré-pipeline para todos os 26 (incluindo 5 duplicatas) — comportamento esperado, será sanado pelo Ato 2.

### Implicação para Sub-etapa 2A.5.c

O dry-run reportou:
- Diff "antes 10.000 → depois 12.000" para os 3 sócios em Abr/26 (e em Dez/25, pelo mesmo motivo)
- Esses "+R$ 2.000" não são **piora** real — são **correção do cálculo** que estava ausente (encargos patronais de 20% sobre R$ 10.000 = R$ 2.000)

O Ato 2A.5.c **CORRIGE** o estado pré-pipeline dos sócios em Abr/26 ao mesmo tempo em que aplica `pro_labore`. **Não há razão para excluir Abr/26 do escopo do apply.**

### Implicação para Ato 2 (replicação Dez/25)

Os 26 docs de Dez/25 (incluindo 5 duplicatas) **serão removidos pelo Ato 2** quando ele rodar. Será criado 1 doc por slug a partir de `colaboradores_base/` com Categoria B recalculada via `calcularFolhaColaborador` para o período 2025-12. Isso vai sanar a anomalia de Dez/25 também.

Os 3 docs pré-pipeline de Abr/26 podem ser corrigidos de **duas formas**, ambas válidas:
1. **Pelo Sub-etapa 2A.5.c** (já em curso): o script aplica `pro_labore` + recalcula Categoria B via `calcularFolhaColaborador`. Funciona porque base tem todos os campos necessários.
2. **Pelo Ato 2 futuro** (se for estendido para também sanitizar Abr/26): substituiria o snapshot atual pelo replicado a partir de `colaboradores_base/`.

A opção 1 é a que está em andamento. Após o `--apply` da Sub-etapa 2A.5.c, os 3 sócios em Abr/26 estarão com 25 campos populados e Categoria B recalculada.

### Recomendação para o `--apply` da Sub-etapa 2A.5.c

**Prosseguir nos 5 períodos (Dez/25 a Abr/26).** O apply:
- Em Dez/25 e Abr/26 (estado pré-pipeline): **adiciona** os campos faltantes via cálculo completo de `pro_labore`. Custo passa de R$ 10.000 a R$ 12.000 — correção do cálculo, não piora.
- Em Jan/26, Fev/26, Mar/26 (estado pós-pipeline CLT): **substitui** o cálculo CLT por `pro_labore`. Custo passa de ~R$ 18.732 a R$ 12.000 — economia real.
- Economia agregada total: **R$ 48.595,57** (combinando ambas as operações).

Pendência colateral (não bloqueia o apply): os 5 slugs duplicados em Dez/25 serão tratados pelo Ato 2.

---

**Fim do diagnóstico.**
