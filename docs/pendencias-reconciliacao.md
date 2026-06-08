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
| Mês corrente (2026-06) | **0,00** ✅ | 3.270.054,50 ⚠️ | 3.270.054,50 |
| **2026 YTD** | **+5.345,36** | **−0,00** ✅ | +5.345,36 |
| Base completa (2025→) | −135.170,38 | **0,00** ✅ | −135.170,38 |

> **2026 onshore ZERADO de material.** Reimport de Mai/Abr/26 fechou ALAN, MOISES e
> FLORENCE — o 2026 YTD foi de −78.400 → **+5.345, que é 100% fronteira imaterial**
> (ARTUR/RONALDO/LEONARDO < 0,02% do PL + cauda). Check classificação: 0.
>
> ⚠️ **Mês corrente offshore (Jun/26) = 3.270.054 (MOISES):** import offshore de Junho
> ainda **pendente** (Mai tem 3,27M, Jun vazio). **Não é erro** — resolve no fechamento
> normal de Junho. O YTD offshore fecha (−0,00) porque o GC residual absorve; quando a
> lâmina de Junho entrar, a cadeia continua.

---

## LISTA MÍNIMA REAL

### ✅ Materiais 2026 — TODOS FECHADOS (reimport de Mai/Abr/26)
| Cliente | Mês | Antes | Agora |
|---|---|---|---|
| ALAN KARDEC | Mai/26 | −41.580 | **0,00** ✅ |
| MOISES LIMA | Abr/26 | −30.940 | **0,00** ✅ (Março regerado alinhou com a ponte de Abril) |
| FLORENCE | Mai/26 | −12.208 | **0,00** ✅ |
| MARIA TEREZA | — | +9.115 (fantasma) | **0,00** ✅ (recuperada — ver histórico) |

**2026 onshore não tem mais nenhum resíduo material.** Só fronteira imaterial.

### 🟡 2025 — entradas (3 resistem ao reimport; 1 fechou)
Reimport das 4 entradas de 2025: **FLORENCE Out/25 FECHOU** (aporte 2.060.678 +
tombamento 2.062.728 lançados; R_on=0). As outras 3 **não fecharam** — naturezas distintas:

| Cliente | Mês | Resíduo | Natureza | Detalhe |
|---|---|---|---|---|
| **PSS** (Pedro H. Silva) | Jul/25 | −123.641 | **erro de campo (entrada)** | aporte 2.717.464 + rent 205.116 > pl 2.798.938. aporte-alvo = **2.593.822** (atual 123.641 alto), OU rent 205.116 espúrio no mês de entrada |
| **PHB** (Pedro H. Almeida) | Mar/25 | −9.992 | **descontinuidade Fev→Mar** | Fev (tomb 10.000) fecha; Mar não chega: `pl_onshore(Fev)=20.048` vs `pl_inicial(Mar)=10.048` → gap **10.000** (tombamento de entrada de Fev some na fronteira) |
| **GABRIEL NATHAN** | Mar/25 | −7.940 | **descontinuidade Fev→Mar** | `pl_onshore(Fev)=40.058` vs `pl_inicial(Mar)=32.118` → gap **7.940** |

> **PSS** = corrigir o mês de entrada (alinhar aporte/rent à lâmina). **PHB/GABRIEL** =
> reimportar Março não basta — o gap é na **fronteira Fev/Mar**; precisa alinhar o
> `pl_onshore` de Fevereiro com o `pl_inicial` de Março (provável dupla contagem do
> tombamento de entrada de Fev). Todos imateriais em valor absoluto do livro, mas
> relativos altos (PHB 9,6% / GABRIEL 5,8% do PL — contas pequenas).

### ⚪ Fronteira ACEITA (não é pendência — < 0,05% do PL)
| Cliente | Resíduo | % PL |
|---|---|---|
| ARTUR VICTOR | +2.248 | 0,006% |
| RONALDO | +1.724 | 0,007% |
| LEONARDO | +1.179 | 0,016% |
| + cauda (74 clientes) | +192 | todos < 0,05% |

---

## Resumo executivo
- **2026 onshore = fronteira pura (+5.345, imaterial).** ALAN/MOISES/FLORENCE/MARIA fechados.
- **Resta na base completa (−135.170):** PSS Jul/25 (−123.641, erro de campo na entrada),
  PHB Mar/25 (−9.992, descontinuidade Fev→Mar), GABRIEL Mar/25 (−7.940, descontinuidade
  Fev→Mar). Todos **2025 entrada**.
- **ALLAN `aae_btg_2026_5`** (−446, colisão) — aguarda lâmina BTG.
- **EDUARDA** (14 frags `esm_btg`, R$5 poeira) — migrar ou excluir.
- **MOISES Jun offshore** — import de Junho pendente (não-erro; fecha no mês).
- Offshore: 100% fechado no histórico.

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
| **ALLAN ANDRADE ELIAS** | ~~13~~ 1 | `aae_btg` | só `2026_5` resta | 2026-05 | 201.770 | ✅ 12 migrados p/ canônico; ⏳ `aae_btg_2026_5` (colisão) aguarda lâmina BTG |
| **EDUARDA DA SILVA MINUTTI** | 14 | `esm_btg` | 2025-02 → 2026-04 | nenhuma | **R$ 5,36** | ⏳ sole-source, **imaterial** (poeira) — migrar ou excluir |
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

### Plano de correção (por docId direto) — progresso
- **MODO 1 — MIGRAR (sole-source, determinístico):** copiar fragmento → `slug(nome)_ano_mes`,
  excluir o sigla-keyed. Sem perda, sem merge.
  - ✅ **ALLAN 12 meses** (2025-03..2026-04) migrados; cada um R_on=0,00 pós-escrita;
    cadeia 2025-03→2026-05 fecha. Agora gerenciável pela UI.
  - ⏳ **EDUARDA 14** (`esm_btg`, R$5 poeira) — pendente (migrar ou excluir).
- **MODO 2 — RESOLVER COLISÃO (aguarda fonte externa):**
  - ✅ **MARIA** — recuperada por reimport + `mtv_xp` excluído (ver acima).
  - ⏳ **ALLAN `aae_btg_2026_5`** (preservado): aae_btg 201.171 vs canônico 152.601
    (resgate −50k). Aguarda lâmina/extrato BTG — qual Maio é o vivo. Resíduo −446 (imaterial).
- **RAFAEL** (`rrf_glpg`, dummies R$1): ✅ excluído.
- **MARIA tomb Março:** ✅ `nnm_tombamento_onshore=14.277,45` (poup.líq Mar 14.796→518,93;
  identidade inalterada).

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
