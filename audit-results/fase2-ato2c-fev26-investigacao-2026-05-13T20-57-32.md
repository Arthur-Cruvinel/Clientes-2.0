# Investigação Δ Fev/26 — Ato 2C Rodada 2

Gerado em **2026-05-13T20:57:32Z** · READ-ONLY puro · zero writes · zero modificações.

Script descartável: `scripts/investFev26.mjs` (removido após análise).

---

## I1+I2 — Comparativo de campos Categoria A: base vs Jan-Abr/26

Os **6 alvos** (Δ > 0 no dry-run da Rodada 2) e suas divergências em `salario_teto_cargo`:

| Slug | base | Jan/26 | **Fev/26** | Mar/26 | Abr/26 | Padrão |
|---|---:|---:|---:|---:|---:|---|
| `thayna_ribeiro` | 4.191,61 | 4.191,61 | **3.800,00** | 3.800,00 | 3.800,00 | Reduz Fev e mantém |
| `rafael_parolise` | 5.515,28 | 5.515,28 | **5.200,00** | 5.200,00 | **5.515,28** | Reduz Fev-Mar, volta Abr |
| `lucas_henrique` | 4.191,61 | 4.191,61 | **3.958,46** | 3.958,46 | 3.958,46 | Reduz Fev e mantém |
| `matheus_tripoli` | 4.023,82 | 4.023,82 | **3.800,00** | 3.800,00 | **4.023,82** | Reduz Fev-Mar, volta Abr |
| `luisa_villa` | 4.023,45 | 4.023,45 | **3.800,00** | 3.800,00 | 3.800,00 | Reduz Fev e mantém |
| `luis_eduardo_nerone` | 6.882,85 | 6.882,85 | **6.855,16** | 6.855,16 | 6.855,16 | Reduz Fev e mantém |

### Campos que NÃO divergem em nenhum dos 6 alvos

`salario_base`, `liquido_acordado`, `beneficios_fixos`, `qtd_dependentes`, `tipo_vinculo`, `localidade` — **todos idênticos** entre base e todos os 4 períodos.

A divergência é **exclusivamente em `salario_teto_cargo`**, e por consequência em todos os campos calculados (encargos, 13º/férias, custo_total_mensal).

---

## I2 cont. — Cross-check com `colaboradores_base/`

Para os 6 alvos, **base bate com Jan/26** em todos os campos. **Base diverge de Fev/26** apenas em `salario_teto_cargo`.

Significado: `colaboradores_base/` foi populado a partir de Jan/26 no Ato 1 — não tem informação sobre as edições em Fev/26.

---

## I4 — `historico_reajustes` revela inconsistência interna em Fev/26

**Cruzamento `historico_reajustes` vs `salario_teto_cargo` top-level em Fev/26:**

| Slug | `historico_reajustes` em Fev/26 | `salario_teto_cargo` top-level em Fev/26 | Consistência interna |
|---|---|---:|:---:|
| `thayna_ribeiro` | vigência 2025-12, teto **4.191,61** | **3.800,00** | ⚠️ **INCONSISTENTE** |
| `rafael_parolise` | vigência 2025-12, teto **7.000,00** | **5.200,00** | ⚠️ **INCONSISTENTE** |
| `lucas_henrique` | vigência 2025-12, teto **5.800,52** | **3.958,46** | ⚠️ **INCONSISTENTE** |
| `matheus_tripoli` | vigência 2025-12, teto **4.023,82** | **3.800,00** | ⚠️ **INCONSISTENTE** |
| `luisa_villa` | vigência 2025-12, teto **4.023,45** | **3.800,00** | ⚠️ **INCONSISTENTE** |
| `luis_eduardo_nerone` | vigência 2025-12, teto **6.855,16** | **6.855,16** | ✅ CONSISTENTE (mas diverge de Jan/26 e base) |

**Padrão claro:**

- **5 colaboradores** têm `salario_teto_cargo` top-level em Fev/26 **divergente do próprio `historico_reajustes`** do mesmo doc. Histórico diz um valor, top-level diz outro.
- **1 colaborador (Nerone)** tem top-level consistente com histórico em Fev/26, mas todo o snapshot (histórico + top-level) **diverge de Jan/26 e da base** — caso já documentado na investigação Nerone anterior (audit-results/investigacao-nerone-2026-05-11T21-23-25.md).

---

## I5 — Slugs de controle (sem divergência) — confirmação

| Slug | base | Jan/26 | Fev/26 | Mar/26 | Abr/26 |
|---|---:|---:|---:|---:|---:|
| `arthur_cruvinel` | 9.000,65 | 9.000,65 | 9.000,65 | 9.000,65 | 9.000,65 |
| `flavia_santos_romeu` | 10.059,55 | 10.059,55 | 10.059,55 | 10.059,55 | 10.059,55 |
| `giovanna_pargoli` | 5.041,00 | 5.041,00 | 5.041,00 | 5.041,00 | 5.041,00 |

Confirmação: para os colaboradores **sem divergência**, `salario_teto_cargo` é idêntico entre base e todos os 4 períodos. A divergência é restrita aos 6 alvos.

---

## Hipóteses da causa

### (A) Edição manual em Fev/26 sem registro em `historico_reajustes`

**Mais provável** dada a inconsistência interna (histórico ≠ top-level em 5/6 alvos).

Cenário: alguém editou via Firebase Console ou import parcial o `salario_teto_cargo` top-level dos snapshots de Fev/26 para valores **reduzidos**, sem atualizar o `historico_reajustes`. O motor financeiro do app gerou os campos calculados (encargos, 13º/férias, custo_total) com base no top-level editado, deixando o snapshot **internamente coerente entre top-level e calculados** mas **divergente do histórico**.

Indícios de "valor padrão administrativo":
- 3 dos 5 (Thayna, Matheus, Luísa) ficaram com teto exato **R$ 3.800** — round number.
- Rafael ficou em **R$ 5.200** — round number.
- Lucas em **R$ 3.958,46** — não-round (~5,6% abaixo do original).

Pode ser **rascunho de simulação** que foi gravado por engano em produção.

### (B) Reajuste salarial real

Pouco provável dadas as inconsistências internas. Se fosse reajuste real, o `historico_reajustes` teria sido atualizado simultaneamente (como ocorreu para o reajuste do Rafael Parolise em **Abr/26** — histórico tem entrada "Reajuste automático 2026-04 teto 5.515,28").

Especificamente para Rafael, Abr/26 mostra que o **motor consegue manter histórico + top-level consistentes** quando o reajuste passa pelo fluxo da UI. As inconsistências em Fev/Mar/26 indicam que o caminho foi diferente.

### (C) Edição em período anterior que ficou "presa"

Hipótese alternativa: tetos de Fev/26 foram gravados quando o motor antigo usava `c.salario_teto_cargo` direto (sem consultar histórico). Quando o motor mudou para `buscarTetoPorPeriodo`, snapshots novos passaram a usar histórico — mas os antigos ficaram presos no estado do motor antigo.

Cronologia possível:
1. Snapshots Fev/Mar/26 criados com motor antigo (lia `salario_teto_cargo` direto)
2. Alguém editou top-level para valores reduzidos
3. Motor recalculou Categoria B usando o top-level reduzido
4. Snapshots ficaram em estado autoconsistente (top-level + calculados), mas histórico nunca foi tocado

Esta hipótese explica também o caso do Nerone (top-level consistente com histórico em Fev/26, mas ambos divergentes de Jan/26 — pode ter sido editado num momento em que o motor não sincronizava histórico↔top-level).

### (D) Caso Rafael Parolise em Abr/26 (subcaso)

Rafael tem `salario_teto_cargo` top-level = 5.515,28 em Abr/26 mas `historico_reajustes` contém **DUAS** entradas:
1. vigência 2025-12, "Entrada inicial (migração)", teto **7.000,00**
2. vigência 2026-04, "Reajuste automático" registrado em 2026-05-08, teto **5.515,28**

O top-level (5.515,28) bate com a entrada mais recente do histórico (2026-04). `buscarTetoPorPeriodo('2026-04')` retornaria 5.515,28 — consistente.

Porém a entrada "Entrada inicial (migração)" tem teto **7.000** — valor que NÃO bate com base nem com Jan/26 (5.515,28). Isso sugere que em algum momento o Rafael teve teto registrado como 7.000 em Dez/25 (que pode ser o que estava no Excel original?). Inconsistência adicional ortogonal.

---

## Resumo da análise

| Diagnóstico | Confirmação |
|---|:---:|
| Divergência é exclusivamente em `salario_teto_cargo` | ✅ |
| 5/6 alvos têm `historico_reajustes` ≠ `salario_teto_cargo` em Fev/26 | ✅ |
| 1/6 (Nerone) tem inconsistência diferente (top-level=histórico, mas ambos ≠ Jan/26) | ✅ |
| Padrão "valor padrão" em alguns (R$ 3.800, R$ 5.200 round numbers) | ✅ |
| Slugs de controle (não-alvos) consistentes em todos os períodos | ✅ |
| `colaboradores_base/` reflete o estado de Jan/26 (não Fev/26) | ✅ |

**Causa mais provável: (A) edição manual em Fev/Mar/26 sem registro de reajuste formal.**

Os valores reduzidos não parecem ter origem operacional contratual:
- Lucas e Thayna são CLT padrão sem histórico de reajuste para baixo
- Os valores 3.800 / 5.200 são round numbers (típicos de "valor padrão de cargo")
- O histórico desses 5 colaboradores **não contém nenhuma entrada que justifique** o teto reduzido (todas as entradas trazem o teto original)

---

## Recomendação sobre o `--apply` da Rodada 2

**APPLY SEGURO COM RESSALVAS.**

### Argumentos a favor do apply

1. **Corrige inconsistência interna** dos snapshots de Fev/26 (histórico ≠ top-level em 5/6).
2. **Restaura coerência com Jan/26**, que reflete a base canônica do Ato 1.
3. **Sem perda documental:** o `historico_reajustes` atual dos 6 docs **não traz nenhuma justificativa** para o teto reduzido. Não há "informação de redução salarial" sendo apagada — só uma divergência não-documentada.
4. **Snapshot pré-write** já gravado em `backups/firestore/fase2-ato2c-2026-02-pre-write-...json` — reversão possível se necessário.
5. **Δ é pequeno** (R$ 1.968,42 = 0,85 % do Custo total Fev/26).

### Argumentos contra (ou pontos de atenção)

1. Se os valores reduzidos refletirem **redução salarial real não documentada formalmente** (ex: férias proporcionais em Fev/26), o apply perde essa informação. **Improvável** dada a ausência de qualquer indício no histórico, mas merece confirmação humana.

2. Caso Rafael em **Abr/26** já tem `historico_reajustes` adicionando entrada "Reajuste automático 2026-04 teto 5.515,28". Após Ato 2C Rodada 4 (Abr/26), Rafael deve ficar com teto 5.515,28 (≅ base), o que apaga implicitamente a transição "5.200 em Fev/Mar → 5.515 em Abr" se essa transição refletir algo.

3. Mar/26 e Abr/26 (Rodadas 3 e 4 futuras) apresentarão **divergências similares**. O apply do Ato 2C em todos os 4 períodos vai uniformizar tudo com base/Jan/26.

### Sugestão operacional

1. **Antes do apply de Fev/26 (Rodada 2):** confirmação humana de que os tetos divergentes não refletem redução salarial real.
2. **Se confirmação for "são erros de cadastro":** apply em Fev/26 + Mar/26 + Abr/26 normaliza tudo.
3. **Se confirmação for "houve reduções reais":** pausar Ato 2C ou marcar os 6 colaboradores como exceções (não tocar `salario_teto_cargo` no apply, apenas docId/metadados).

---

**Fim da investigação.**
