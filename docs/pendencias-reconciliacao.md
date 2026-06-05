# Pendências de Reconciliação — identidade do AUM (poupança)

Placar único: `scripts/reconciliacao-harness.mjs` (read-only). Rode após qualquer
onda de correção. Este documento nomeia o que **não zerou** e a decisão de cada item.

Identidade por visão (mês a mês, encadeado como a tela):
- **onshore** = `pl_fim − pl_ini − NNM_real − Rent + Imp`
- **offshore** = `pl_fim − pl_ini − NNM_real − Rent − GC`
- **consolidado** = onshore + offshore

---

## Placar (pós-lote final onshore)

| Período | Onshore | Offshore | Consolidado |
|---|---|---|---|
| **2026 YTD** | **−60.517,64** | **0,00** ✅ | −60.517,64 |
| Base completa (2025→) | −195.147,30 | **0,00** ✅ | −195.147,30 |

> O 2026 antes mostrava **+1.590 (ilusório)** — positivos compensando negativos. O lote
> fechou os 8 itens determináveis (5 tombamento + 3 gate), removendo as compensações e
> **expondo o resíduo real −60.517**, agora 100% atribuível a itens que precisam de lâmina.
> Offshore: fechado em toda a história. Check de classificação (rent > 50% do PL): **0**.

---

## Resolvido neste lote (8 escritas, identidade pós-write ✓)

**ETAPA 1 — tombamento fora do aporte (NNM cheio inclui tombamento):** 5 re-entradas Jan/26
| Cliente | Mês | aporte += | identidade |
|---|---|---|---|
| WENDERSON | 2026-01 | +10.222,01 | ✓ |
| LUIZ DE ARAUJO | 2026-01 | +2.309,93 | ✓ |
| PEDRO H. SILVA | 2026-01 | +1.851,80 | ✓ |
| MATHEUS ISAIAS | 2026-01 | +596,56 | ✓ |
| WILLIAM BENTO | 2026-01 | +182,81 | ✓ |

**ETAPA 2 — gate (rent confirmado pelo rent% independente, <5 bps) → aporte = identidade:** 3
| Cliente | Mês | Δ rent% | aporte → |
|---|---|---|---|
| ARTUR VICTOR | 2026-04 | −2,8 bps | 39.389,66 |
| WESLEY | 2026-02 | −5,0 bps | 280.314,59 |
| JOAO FELIPE | 2026-01 | −4,7 bps | 191.914,97 |

---

## Pendências — precisam de lâmina

### Gate REPROVADO (rent% diverge > 5 bps — F suspeito, NÃO backfillar às cegas)
| Cliente | Mês | Resíduo | Δ rent% | Lâmina |
|---|---|---|---|---|
| ALAN KARDEC | 2026-05 | −41.580 | −8,3 bps | onshore Mai/26 |
| MOISES LIMA | 2026-04 | −29.957 | −5,8 bps | onshore Abr/26 |
| FLORENCE | 2026-05 | −12.208 | −9,7 bps | onshore Mai/26 |
| MARCO ANTONIO | 2026-04 | +9.565 | −23,2 bps | onshore Abr/26 |
| GABRIEL NATHAN | 2026-01 | −7.939 | −15,7 bps | onshore Jan/26 |

### Outros 2026 (meses fora dos 8; rodar gate estendido ou lâmina)
WESLEY Abr/26 (~+9,8k) · ARTUR Mai/26 (+2,2k) · ARTHUR MENDONÇA Abr/26 (−4,1k) ·
ADEMILSON Mai/26 (+2,1k) · RONALDO Mai/26 (+1,7k) · LEONARDO Mai/26 (+1,2k) ·
MARIA TEREZA (entrada Mar/26, +9,1k).

### Onshore 2025
| Cliente | Mês | Valor | Lâmina |
|---|---|---|---|
| PEDRO H. SILVA (PSS) | 2025-07 | −121.789 | onshore Jul/25 |
| PEDRO H. ALMEIDA (PHB) | 2025-03 | −9.992 | onshore Mar/25 |

---

## Resumo
- ✅ **Offshore: 100% fechado.**
- ✅ **8 itens onshore 2026 fechados** (5 tombamento + 3 gate).
- ⏳ **Onshore restante (−60.517 em 2026 + cauda 2025):** todos com **rent suspeito (gate
  reprovado)** ou entrada 2025 → **precisam de lâmina** para confirmar aporte/rent corretos.
  Nenhum é backfillável às cegas sem risco de mascarar erro de rent.
- **Próximo passo:** rodar o **gate estendido** a TODOS os meses 2026 com |R_on|>R$1k
  (fecha os rent-confirmados restantes), e juntar as lâminas dos reprovados + 2025.
