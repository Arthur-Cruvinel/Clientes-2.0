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
| **2026 YTD** | **−78.400,52** | **0,00** ✅ | −78.400,52 |
| Base completa (2025→) | −220.969,47 | **0,00** ✅ | −220.969,47 |

> **Offshore 100% fechado. Jun/26 100% fechado.** O 2026 YTD foi de −69.285 → **−78.400**
> após recuperar MARIA: o +9.115 que ela tinha era **fantasma de colisão** que *mascarava*
> o resíduo (fazia o livro parecer menos negativo). Removido, aparece o número honesto =
> **3 materiais reais (ALAN/MOISES/FLORENCE) + fronteira aceita**. MARIA agora fecha 0,00.

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

## Identidade fragmentada — classe de defeito (varredura completa)

**A identidade da poupança É o docId** (`slug_ano_mes`). A coleção **não tem
`id_estavel`** — varri 1.057 docs: **0** têm. Toda operação de escrita/exclusão
(`GerenciarDados`, `DetalheLinhaEdit`, `DetalheMetaLote`, `revisao`, `PoupancaMetaLote`)
monta `slug(nome_cliente)_ano_mes`. As views (`usePoupanca`) agrupam por `nome_cliente`.

**Raiz:** import por sigla em quarentena grava docId `slug(sigla_bruta)_ano_mes`
(ex. `aae_btg_2026_5`). A normalização (`corrigirNomeClientePoupanca`) seta
`nome_cliente` mas **"Nunca alterar docId"** → o docId fica sigla-keyed para sempre.
Consequência: o doc **aparece** nas views (group by nome) mas é **inalcançável por
toda op por-nome** (que mira `slug(nome)`). `deleteDoc` em docId inexistente é no-op
silencioso → UI diz "excluído" e o fragmento sobrevive; em colisão, exclui o canônico
(o bom) e deixa o fragmento. **Correção só funciona por docId DIRETO.**

### Mapa — fragmentos por cliente

| Cliente | Frags | slug-keyed | Meses | Colisão | pl_max | Status |
|---|---|---|---|---|---|---|
| **ALLAN ANDRADE ELIAS** | 13 | `aae_btg` | 2025-03 → 2026-05 | só 2026-05 | 201.770 | ⏳ 12 sole-source p/ migrar + 1 colisão (lâmina) |
| **EDUARDA DA SILVA MINUTTI** | 14 | `esm_btg` | 2025-02 → 2026-04 | nenhuma | **R$ 5,36** | ⏳ sole-source, **imaterial** (poeira) |
| **MARIA TEREZA** | ~~3~~ 0 | ~~`mtv_xp`~~ | — | — | — | ✅ **RESOLVIDA** (ver abaixo) |
| **RAFAEL RICIERI FACI** | ~~2~~ 0 | ~~`rrf_glpg`~~ | — | — | — | ✅ excluído (dummies R$1) |

**✅ MARIA TEREZA — recuperada (dado perdido pela UI + reimport):** a tentativa de
exclusão pela UI mirou `slug(nome)` e **apagou a série canônica VIVA** (Mai 5.382 com
resgate −9.016 → Jun 5.390), deixando o `mtv_xp` stale (14.538). Recuperação: Arthur
**reimportou a lâmina XP** → como `MTV_XP` está mapeado, aterrissou no docId **canônico**
`maria_tereza_vasconcelos_barbosa_2026_3/4/5/6` (Mai 5.382,08 c/ resgate −9.016,63
confirmado na lâmina). Os 3 `mtv_xp` stale **excluídos por docId direto**. Harness:
Mar→Jun fecha R_on=0,00 cada mês; fantasma +9.115 eliminado; MARIA agora gerenciável
pela UI (docId canônico). **Prova viva do BACKLOG #4: sem o re-key no write-path, a UI
apaga o doc certo.**

> `aae_btg` é a série **contínua e ÚNICA** do ALLAN por 14 meses → **é a história real
> dele**, NÃO stale (corrige a leitura do turno anterior). O canônico
> `allan_andrade_elias_2026_5` é o recém-chegado. Em 2026-05 a dúvida é qual Maio é o
> certo; os outros 12 `aae_btg` **devem ser preservados**.

**Materialidade:** nenhuma distorção material escondida além do **+9.115 da MARIA**
(já conhecido). ALLAN −446 e EDUARDA R$5 imateriais. Os 12 meses sole-source do ALLAN
são história real exibida corretamente. **O −69k/−202k NÃO vem de fragmento.**

### Plano de correção (por docId direto)
- **MODO 1 — MIGRAR (sole-source, determinístico):** copiar conteúdo do fragmento para
  `slug(nome)_ano_mes`, excluir o sigla-keyed. Sem perda, sem merge. Pré-condição:
  destino canônico NÃO existe (senão é colisão → modo 2). Aplica a **EDUARDA (14)** e
  **ALLAN 12 meses sole-source** (exceto 2026-05).
- **MODO 2 — RESOLVER COLISÃO (aguarda fonte externa):** **MARIA** (excluir série
  `mtv_xp` após a lâmina XP confirmar qual Maio fecha — 5.382 vs 14.538); **ALLAN
  2026-05** (lâmina/extrato — qual Maio é o vivo; preservar os outros 12).
- **RAFAEL** (`rrf_glpg_2026_4/5`, dummies R$1): ✅ já excluído por docId direto
  (ausente na re-varredura — confirma que persistiu).

> **NÃO mexer no read-path.** Correção é de dados, por docId direto. Prevenção da
> recriação = re-key no write-path (BACKLOG #4).

---

## Histórico das ondas (resolvido)
- **GC offshore** = resíduo cambial + guard (`4d14769`); rent primeiroMes (`5af7875`);
  bug de entrada offshore na raiz (`723be8b`).
- **Harness permanente** (`27439ac`) + check de classificação + **materialidade relativa**.
- **Correções:** ponte Maio (7), LOTE A/B, RAFAEL Jul/25, 7 entradas offshore 2025,
  lote final (5 tombamento + 3 gate), gate estendido (+4). Todas com identidade pós-write.
- **Pós-import Mai/Abr/Jan-26:** MARCO + GABRIEL(2026) fecharam. Reclassificação relativa
  tirou ARTUR/RONALDO/LEONARDO da lista. **Offshore 100% fechado; Jun/26 100% fechado.**
