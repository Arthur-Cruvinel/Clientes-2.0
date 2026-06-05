# Pendências de Reconciliação — identidade do AUM (poupança)

Placar único: `scripts/reconciliacao-harness.mjs` (read-only). Rode após qualquer
onda de correção. Este documento nomeia o que **não zerou** e a decisão de cada item.

Identidade por visão (mês a mês, encadeado como a tela):
- **onshore** = `pl_fim − pl_ini − NNM_real − Rent + Imp`
- **offshore** = `pl_fim − pl_ini − NNM_real − Rent − GC`
- **consolidado** = onshore + offshore

---

## Placar (pós gate estendido)

| Período | Onshore | Offshore | Consolidado |
|---|---|---|---|
| **2026 YTD** | **−67.912,92** | **0,00** ✅ | −67.912,92 |
| Base completa (2025→) | −202.542,58 | **0,00** ✅ | −202.542,58 |

> **Offshore: fechado em toda a história.** Check de classificação (rent > 50% do PL): **0**.
> O resíduo onshore restante é **100% atribuível** aos itens abaixo — todos com **rent
> suspeito (gate reprovado)** ou **entrada 2025**, ou seja, o **mínimo irredutível** que só
> fecha com a lâmina correta. Nada mais é backfillável deterministicamente.

---

## LISTA MÍNIMA DEFINITIVA DE LÂMINAS (o que falta para zerar o livro)

### Maio/2026 onshore (6 clientes — rent% diverge do gravado)
| Cliente | Resíduo | Δ rent% |
|---|---|---|
| ALAN KARDEC | −41.580 | −8,3 bps |
| FLORENCE | −12.208 | −9,7 bps |
| MARIA TEREZA | +9.115 | +48,4 bps |
| ARTUR VICTOR | +2.248 | −7,9 bps |
| RONALDO | +1.724 | −10,2 bps |
| LEONARDO CESAR | +1.179 | −7,2 bps |

### Abril/2026 onshore (2 clientes)
| Cliente | Resíduo | Δ rent% |
|---|---|---|
| MOISES LIMA | −30.940 | −5,8 bps |
| MARCO ANTONIO | +9.217 | −23,2 bps |

### Janeiro/2026 onshore (1 cliente)
| Cliente | Resíduo | Δ rent% |
|---|---|---|
| GABRIEL NATHAN | −7.939 | −15,7 bps |

### 2025 onshore (2 clientes — entrada)
| Cliente | Mês | Resíduo |
|---|---|---|
| PEDRO H. SILVA (PSS) | 2025-07 | −121.789 |
| PEDRO H. ALMEIDA (PHB) | 2025-03 | −9.992 |

**Total: 11 client-meses.** Consolidando por PDF a juntar:
`Maio/26` (ALAN, FLORENCE, MARIA TEREZA, ARTUR, RONALDO, LEONARDO) ·
`Abril/26` (MOISES, MARCO) · `Janeiro/26` (GABRIEL NATHAN) ·
`Julho/25` (PSS) · `Março/25` (PHB).

---

## Histórico das ondas (resolvido)
- **GC offshore** = resíduo cambial + guard (deploy `4d14769`); rent gravada primeiroMes
  (`5af7875`); **bug de entrada offshore na raiz + sanity + check** (`723be8b`).
- **Harness permanente** (`27439ac`) com check de classificação.
- **Correções de dado:** lote ponte Maio (7), LOTE A/B (chain + backfill), RAFAEL Jul/25
  (entrada offshore), 7 entradas offshore 2025 (reimport), lote final onshore
  (5 tombamento + 3 gate) e gate estendido (+4). Todas com identidade pós-write.
- **Offshore: 100% fechado.** Onshore: só o mínimo irredutível acima (11 lâminas).

> **Mecânica de fechamento dos pendentes:** com a lâmina correta do mês, o gate confirma
> rent (F) e/ou corrige aporte (E); identidade fecha. Os reprovados têm **rent suspeito**
> — provavelmente o parser LLM leu o Rendimento Nominal (F) com erro > 5 bps. A lâmina
> resolve qual de E/F está errado.
