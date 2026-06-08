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

### 🔵 MARIA TEREZA — duplicata (não é entrada, não é 2ª conta real)
Varredura da timeline completa **re-diagnosticou**: `mtv_xp` e o slug canônico são
**a MESMA conta importada duas vezes** (duplicata), não duas contas reais:

| Mês | canônico `maria_..._barbosa` | `mtv_xp` | Veredito |
|---|---|---|---|
| 2026-03 | pl 14.857 | pl 14.857 (idêntico) | duplicata |
| 2026-04 | pl 14.497 | pl 14.497 (idêntico) | duplicata |
| 2026-05 | pl 5.382 (aporte −9.016) | pl 14.538 (aporte 0) | **divergem** |
| 2026-06 | pl 5.390 | **(não existe)** | só canônico continua |

Mar/Abr **idênticos** = mesma conta. Em Mai divergem: o canônico capturou o resgate
de −9.016 (→5.382), o `mtv_xp` ficou **stale** (14.538, perdeu o resgate) e **parou**.
Jun/26 só tem o canônico (5.390), **provando que a série canônica é a viva**.
→ **Correção determinística: excluir a série `mtv_xp` (3 docs: 2026-03/04/05).**
Mata o fantasma +9.115. (Reservado à confirmação do Arthur, mas a evidência de Junho
torna inequívoco.)

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

---

## Mapa multi-conta (varredura completa — NÃO sistêmico)
Varredura da base inteira por >1 doc poupança no mesmo (cliente, ano, mês):
**4 case-months, 3 clientes.** Raiz: import por sigla cria docId sigla-keyed em vez
de agregar no slug canônico (BACKLOG #4 — corrigir no write-path, não no read-path).

| Cliente | Veredito | docs | Fantasma | Correção |
|---|---|---|---|---|
| **RAFAEL** | DUPLICATA (dummies R$1) | `rrf_glpg_2026_4/5` | −1 (imaterial) | excluir `rrf_glpg` (canônico R$1 permanece) — **determinístico** |
| **MARIA** | DUPLICATA (canônico vivo, `mtv_xp` stale) | `mtv_xp_2026_3/4/5` | **+9.115** | excluir série `mtv_xp` — **determinístico** (Jun prova) |
| **ALLAN** | **AMBÍGUO** (ver abaixo) | `aae_btg` (Abr/25→Mai/26) + `allan_andrade_elias_2026_5` | −446 (imaterial) | **decisão do Arthur** |

**Fantasma total de encadeamento: +R$8.668** — quase todo MARIA. **Não distorce o
−69k/−202k** (esse é erro de dado real); o +9.115 da MARIA era até *positivo* (fazia o
livro parecer melhor). Removendo-o, o onshore 2026 vai a −78.400 = os 3 materiais.

### ALLAN ANDRADE ELIAS — por que é ambíguo
`aae_btg` tem histórico **contínuo e congelado** (201.770,71 **inalterado** de Mai a
Nov/25 — cara de série stale/carregada), depois 200.724 (Abr/26) → 201.171 (Mai/26,
aporte +36). Já `allan_andrade_elias_2026_5` **só aparece em Mai/26**, fresco, com
movimento real (pl 152.601, **aporte −50.000**, rent 2.033). Não são idênticos.

- Se forem **2 contas reais** → agregar (total Mai = 353.772) — mas o `pl_inicial`
  somaria 401.449 (2×200.724), o que **duplica** se o canônico não existia em Abril
  (e não existe: não há `allan_andrade_elias_2026_4`).
- Se for **duplicata** (mesma conta, 2 leituras de Mai) → o `aae_btg` (201.171) está
  **stale** (não capturou o −50k) e o canônico (152.601) é a leitura viva → **excluir
  `aae_btg_2026_5`**, NÃO agregar (agregar inflaria o AUM para 353k).

Sem Junho para desempatar (ALLAN para em Mai/26) nem lâmina, **não dá para decidir
deterministicamente.** Hipótese forte: o `aae_btg` congelado por 7 meses é stale →
o canônico 152.601 é o vivo. **Aguardar Arthur** antes de qualquer escrita.

> **NÃO mexer no read-path.** A correção dos 3 é de dados (caso a caso). A prevenção
> (write-path do import) está no BACKLOG #4.

---

## Histórico das ondas (resolvido)
- **GC offshore** = resíduo cambial + guard (`4d14769`); rent primeiroMes (`5af7875`);
  bug de entrada offshore na raiz (`723be8b`).
- **Harness permanente** (`27439ac`) + check de classificação + **materialidade relativa**.
- **Correções:** ponte Maio (7), LOTE A/B, RAFAEL Jul/25, 7 entradas offshore 2025,
  lote final (5 tombamento + 3 gate), gate estendido (+4). Todas com identidade pós-write.
- **Pós-import Mai/Abr/Jan-26:** MARCO + GABRIEL(2026) fecharam. Reclassificação relativa
  tirou ARTUR/RONALDO/LEONARDO da lista. **Offshore 100% fechado; Jun/26 100% fechado.**
