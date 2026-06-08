# Pendências de Reconciliação — identidade do AUM (poupança)

Placar único: `scripts/reconciliacao-harness.mjs` (read-only). Rode após qualquer
onda de correção. Este documento nomeia o que **não zerou** e a decisão de cada item.

Identidade por visão (mês a mês, encadeado como a tela):
- **onshore** = `pl_fim − pl_ini − NNM_real − Rent + Imp`
- **offshore** = `pl_fim − pl_ini − NNM_real − Rent − GC`
- **consolidado** = onshore + offshore

> ⚠️ **Materialidade = RELATIVA, não piso absoluto.** A identidade usa o BRL.
> Um resíduo só é pendência se passar de **R$1k absoluto E 0,05% do PL** do cliente.
> R$2k contra PL de R$37M é fronteira (ruído de arredondamento), não erro. O harness
> reporta as duas métricas lado a lado e separa "FRONTEIRA por relativo".

> ⚠️ **Regra de medição:** qualquer gate/script DEVE reusar o pipeline VERBATIM do
> harness (auto-repair de `pl_onshore`, encadeamento read-time, ghost filter,
> `impostos_mes`). Script naïve mede diferente da tela e inventa resíduos telescópicos.
> Nunca gateie mês cujo cliente já fecha no acumulado.

---

## Placar (pós-import + reclassificação relativa)

| Período | Onshore | Offshore | Consolidado |
|---|---|---|---|
| Mês corrente (2026-06) | **0,00** ✅ | **0,00** ✅ | **0,00** ✅ |
| **2026 YTD** | **−69.285,83** | **0,00** ✅ | −69.285,83 |
| Base completa (2025→) | −211.854,78 | **0,00** ✅ | −211.854,78 |

> **Offshore 100% fechado. Jun/26 100% fechado.** O resíduo onshore −69.285 do 2026 YTD
> = **3 materiais reais + 1 entrada + fronteira aceita** (77 clientes somando só R$5.344,
> todos < 0,05% do PL).

---

## LISTA MÍNIMA REAL

### 🔴 Materiais 2026 — problema em APORTE/MOVIMENTO (não rent)
O viés de rent% (campo `pct` vs BRL) explica só 16-24% do resíduo; o grosso (~80%)
está no **movimento líquido** (aporte/resgate) mal dimensionado. **Conferir a coluna
de movimentação da lâmina** contra o aporte-alvo — não o rendimento.

| Cliente | Mês | Resíduo | % PL | aporte ATUAL | **aporte-ALVO** | falta |
|---|---|---|---|---|---|---|
| **ALAN KARDEC** | Mai/26 | −41.580 | 0,523% | −289.143,73 | **−330.724,60** | resgate R$41.580 a mais |
| **MOISES LIMA** | Abr/26 | −30.940 | 0,266% | −187.288,36 | **−218.228,97** | resgate R$30.940 a mais |
| **FLORENCE** | Mai/26 | −12.208 | 0,408% | +733,51 | **−11.474,54** | era resgate, não aporte |

> aporte-alvo = `pl − pl_inicial − rent + imp`. Ao abrir a lâmina, compare a coluna de
> movimento líquido (aporte/resgate) com este número — confirma o saque faltando sem caçar.
>
> **ALAN** não é import_faltante clássico (é onshore-puro; o flag vem do dummy R$1,00 de
> Mar/26). Mai/26 é o 1º mês normal pós-entrada (Abr/26 = tombamento R$8,1M).

### 🔵 Entrada — MARIA TEREZA (NÃO é backfill determinístico)
**Duplicata multi-conta no mesmo mês**, não capital de abertura ausente:

| docId | pl_inicial | pl | aporte |
|---|---|---|---|
| `maria_tereza_vasconcelos_barbosa_2026_5` | 14.497,75 | 5.382,08 | −9.015,63 |
| `mtv_xp_2026_5` | 14.497,75 | 14.538,61 | −0,01 |

Os **dois** docs são 2026-05 (conta principal + conta XP), ambos com pl_inicial de Abril.
O pipeline encadeia os dois como meses consecutivos (`pl_ini[2º] = pl[1º] = 5.382`) →
fantasma **+9.115**. **Decisão do Arthur:** são 2 contas reais (→ agregar os PLs:
total Mai = R$19.920) ou duplicata de re-import (→ excluir uma)? Resolver na lâmina/cadastro.
**Não é gate, não é rent, não é backfill de entrada.**

### 🟡 2025 — entradas (capital de abertura)
| Cliente | Mês | Resíduo |
|---|---|---|
| PEDRO H. SILVA (PSS) | Jul/25 | −123.641 |
| PEDRO H. ALMEIDA (PHB) | Mar/25 | −9.992 |
| GABRIEL NATHAN | Mar/25 | −7.940 |

### ⚪ Fronteira ACEITA (não é pendência — < 0,05% do PL)
| Cliente | Resíduo | % PL |
|---|---|---|
| ARTUR VICTOR | +2.248 | 0,006% |
| RONALDO | +1.724 | 0,007% |
| LEONARDO | +1.179 | 0,016% |
| + cauda (74 clientes) | +192 | todos < 0,05% |

---

## Resumo executivo
- **Falta zerar 3 lâminas materiais** (ALAN Mai, MOISES Abr, FLORENCE Mai) — foco na
  **coluna de movimento**, alvo já calculado.
- **1 decisão de cadastro** (MARIA: agregar XP ou excluir duplicata).
- **3 entradas de 2025** (PSS, PHB, GABRIEL).
- Resto é fronteira aceita.

> **Possível padrão a investigar depois:** MARIA revelou multi-conta no mesmo mês
> (`mtv_xp` + slug canônico) não-agregado pelo pipeline. Vale uma varredura de
> clientes com >1 doc poupança por mês — pode haver outros fantasmas de encadeamento.

---

## Histórico das ondas (resolvido)
- **GC offshore** = resíduo cambial + guard (`4d14769`); rent primeiroMes (`5af7875`);
  bug de entrada offshore na raiz (`723be8b`).
- **Harness permanente** (`27439ac`) + check de classificação + **materialidade relativa**.
- **Correções:** ponte Maio (7), LOTE A/B, RAFAEL Jul/25, 7 entradas offshore 2025,
  lote final (5 tombamento + 3 gate), gate estendido (+4). Todas com identidade pós-write.
- **Pós-import Mai/Abr/Jan-26:** MARCO + GABRIEL(2026) fecharam. Reclassificação relativa
  tirou ARTUR/RONALDO/LEONARDO da lista. **Offshore 100% fechado; Jun/26 100% fechado.**
