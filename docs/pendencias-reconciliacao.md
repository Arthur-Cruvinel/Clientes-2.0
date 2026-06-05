# Pendências de Reconciliação — identidade do AUM (poupança)

Placar único: `scripts/reconciliacao-harness.mjs` (read-only). Rode após qualquer
onda de correção. Este documento nomeia o que **não zerou** e a decisão de cada item.

Identidade por visão (mês a mês, encadeado como a tela):
- **onshore** = `pl_fim − pl_ini − NNM_real − Rent + Imp`
- **offshore** = `pl_fim − pl_ini − NNM_real − Rent − GC` (GC = resíduo cambial com guard)
- **consolidado** = onshore + offshore

---

## Placar (pós-reimport de 2025 + Maio fechado)

| Período | Onshore | Offshore | Consolidado |
|---|---|---|---|
| Mês corrente (2026-05) | −36.202,30 | 0,00 | −36.202,30 |
| **2026 YTD** | **+1.590,66** | **0,00** ✅ | **+1.590,66** |
| Base completa (2025→) | −133.039,00 | **0,00** ✅ | −133.039,00 |

> **Offshore: FECHADO em toda a história (0,00).** As 7 entradas offshore de 2025 e o FX
> foram resolvidos pelo reimport (código `723be8b`). Check de classificação (rent > 50% do PL): **0**.

---

## 1. Entradas offshore 2025 — RESOLVIDAS ✅

As 7 entradas que não fechavam (−579.433) foram **reimportadas com o código novo** e
agora fecham. Nenhuma aparece mais como resíduo.

| Cliente | Mês | Antes | Depois |
|---|---|---|---|
| ADEMILSON BRAGA | 2025-04 | −371.985,45 | ✅ fecha |
| GABRIEL F. DE JESUS | 2025-05 | −120.652,34 | ✅ fecha |
| LUIZ DE ARAUJO | 2025-06 | −82.287,50 | ✅ fecha |
| WESLEY RIBEIRO | 2025-04 | −3.450,52 | ✅ fecha |
| MAYCON | 2025-06 | −1.236,07 | ✅ fecha |
| VICTOR ALEXANDER | 2025-05 | +795,10 | ✅ fecha |
| ARTUR VICTOR | 2025-11 | −616,70 | ✅ fecha |

FX offshore estrutural: agora capturado integralmente pelo GC → resíduo offshore **0,00**.

---

## 2. Onshore 2025 — pendente

| Cliente | Mês | Valor | O que falta |
|---|---|---|---|
| PEDRO H. SILVA (PSS) | 2025-07 | −121.789 | lâmina onshore Jul/25 (aporte sobre-registrado / resgate) |
| PEDRO H. ALMEIDA (PHB) | 2025-03 | −9.992 | lâmina onshore Mar/25 (entrada ~−10k, capital não registrado) |

> **TIAGO Jul/25 (−144k): RESOLVIDO** pelo reimport — saiu da lista.

---

## 3. Onshore 2026 — NET fechado (+1.590), mas com resíduos por cliente que se cancelam

O reimport (Maio fechado) **redistribuiu** os resíduos: o total de 2026 segue **+1.590,66**,
mas vários clientes têm resíduo individual material que se compensa. Carecem de revisão
por lâmina do mês indicado (não zeram individualmente):

| Cliente | Mês | Resíduo |
|---|---|---|
| ALAN KARDEC | 2026-05 | −41.580 (resgate de Maio não capturado; reimport reduziu de −50.882) |
| ARTUR VICTOR | 2026-04 | +35.903 |
| WESLEY RIBEIRO | 2026-02 | +31.223 |
| MOISES LIMA | 2026-04 | −29.957 |
| FLORENCE | 2026-05 | −12.208 |
| WENDERSON | 2026-01 | +10.222 |
| MARCO ANTONIO | 2026-04 | +9.565 |
| MARIA TEREZA | 2026-05 | +9.116 (entrada) |
| JOAO FELIPE | 2026-01 | −8.084 |
| GABRIEL NATHAN | 2026-01 | −7.939 |
| ARTHUR MENDONÇA | 2026-04 | −4.107 |
| + ~5 entre R$1k e R$2,3k | 2026-01/04/05 | — |

> Esses se cancelam no total (+1.590), então a **tela consolidada de 2026 está fechada**,
> mas o detalhe por cliente tem inconsistências de lâmina (Maio/Abril) a reconciliar
> cliente a cliente quando houver tempo — não distorcem o agregado.

---

## Resumo — o que falta para a BASE fechar 100% por cliente

| # | Item | Valor | O que falta |
|---|---|---|---|
| 1 | PSS onshore Jul/25 | −121.789 | lâmina Jul/25 |
| 2 | PHB onshore Mar/25 | −9.992 | lâmina Mar/25 |
| 3 | Resíduos 2026 por cliente (offset) | net +1.590 | revisão por lâmina (Maio/Abril) cliente a cliente |
| ✅ | 7 entradas offshore 2025 | — | **resolvido (reimport)** |
| ✅ | TIAGO Jul/25 | — | **resolvido (reimport)** |
| ✅ | FX offshore estrutural | — | **fechado (GC)** |
| ✅ | Fronteira Jan/25 | 0 | **fechado** |

**Estado:** offshore 100% fechado; onshore consolidado de 2026 fechado (+1.590); resta a
cauda onshore 2025 (PSS + PHB, 2 lâminas) e a reconciliação fina por cliente de 2026
(resíduos que se compensam no agregado).
