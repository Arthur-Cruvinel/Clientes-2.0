# Pendências de Reconciliação — identidade do AUM (poupança)

Placar único: `scripts/reconciliacao-harness.mjs` (read-only). Rode após qualquer
onda de correção. Este documento nomeia o que **não zerou** e a decisão de cada item.

Identidade por visão (mês a mês, encadeado como a tela):
- **onshore** = `pl_fim − pl_ini − NNM_real − Rent + Imp`
- **offshore** = `pl_fim − pl_ini − NNM_real − Rent − GC` (GC = resíduo cambial com guard)
- **consolidado** = onshore + offshore

---

## Placar (atualizar a cada onda)

| Período | Onshore | Offshore | Consolidado |
|---|---|---|---|
| **2026 YTD** | **+1.590,66** ✅ | **−0,00** ✅ | **+1.590,66** ✅ |
| Base completa (2025→) | −133.039,01 | −579.335,35 | −712.374,36 |

> **2026 está fechado.** A cauda é toda 2025. Check de classificação (rent > 50% do PL): **0**.

---

## 1. Entradas onshore 2025 — SEM backfill determinístico

Investigados RAFAEL / TIAGO / PSS / GFJ. **Nenhum** se encaixa no padrão "capital de
abertura ausente" (ARTUR/LEANDRO) — então **não há backfill determinístico**:

| Cliente | Situação | Decisão |
|---|---|---|
| RAFAEL SILVA | offshore-only; entrada Jul/25 **já corrigida** (decomposição fina) | ✅ resolvido |
| TIAGO MACHADO | entrada Jun/25 **fecha** (resíduo −0,00). O −144k é **chain gap em 2025-07** (resgate Jun→Jul não registrado) | ⏳ aguarda lâmina onshore **Jul/25** |
| PEDRO H. SILVA (PSS) | entrada Jul/25 resíduo **−123.641** (negativo = aporte sobre-registrado / resgate, NÃO capital ausente) | ⏳ aguarda lâmina onshore **Jul/25** |
| GABRIEL F. DE JESUS (GFJ) | offshore-only (ver item 2) | ⏳ ver item 2 |

---

## 2. FX offshore 2025

- **FX estrutural que FECHA (legítimo, já na coluna G. Cambial): Σ ≈ −2.324.755** — é o
  efeito cambial sobre o PL de abertura (`pl_ini_usd × ΔPTAX`). **Nada a fazer — aceito.**
- **7 células que NÃO fecham (Σ −579.433), TODAS entradas offshore (1º mês)** com
  mis-decomposição do import antigo (capital de abertura mal separado de rent — variante
  branda do bug RAFAEL, abaixo do limiar de 50%):

| Cliente | Mês | Resíduo | Decisão |
|---|---|---|---|
| ADEMILSON BRAGA | 2025-04 | −371.985,45 | **Reimport** (código novo decompõe certo) |
| GABRIEL F. DE JESUS | 2025-05 | −120.652,34 | **Reimport** |
| LUIZ DE ARAUJO | 2025-06 | −82.287,50 | **Reimport** |
| WESLEY RIBEIRO | 2025-04 | −3.450,52 | **Reimport** |
| MAYCON | 2025-06 | −1.236,07 | **Reimport** |
| VICTOR ALEXANDER | 2025-05 | +795,10 | **Reimport** |
| ARTUR VICTOR | 2025-11 | −616,70 | **Reimport** |

> **Decisão:** reimportar esses meses de **entrada offshore** com o código atual
> (deploy `723be8b` decompõe a entrada como NNM cheio + tombamento). Alternativa
> determinística (sem lâmina): aplicar `aporteUsd = ending/(1+rent%)` ao dado gravado —
> disponível se o reimport não for viável. **Não fazer via LLM.**

---

## 3. Fronteira Jan/25

**Σ = R$ 0,00** (nenhum cliente com |resíduo| > R$ 1.000). Os ~−108k citados em análises
antigas **já foram resolvidos** pelos reimports/encadeamento. **Nada pendente.**

---

## Resumo das pendências (o que falta)

| # | Item | Valor | O que falta | Decisão |
|---|---|---|---|---|
| 1 | PSS onshore Jul/25 | −123.641 | lâmina onshore Jul/25 | aguarda documento |
| 2 | TIAGO onshore Jul/25 (chain gap) | −144.485 | lâmina onshore Jul/25 | aguarda documento |
| 3 | 7 entradas offshore 2025 | −579.433 | reimport (código novo) | reimportar em lote |
| — | FX offshore estrutural | −2,32 mi | — | **estrutural aceito** (em G. Cambial) |
| — | Fronteira Jan/25 | 0 | — | **fechado** |

**2026: fechado.** A base completa fecha 100% após: (1) reimport das 7 entradas offshore;
(2) lâminas onshore Jul/25 de PSS e TIAGO. O FX estrutural (−2,32 mi) permanece na coluna
de Ganho Cambial por construção — não é resíduo a corrigir.
