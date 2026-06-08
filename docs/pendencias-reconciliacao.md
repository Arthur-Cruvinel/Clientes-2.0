# Pendências de Reconciliação — identidade do AUM (poupança)

Placar único: `scripts/reconciliacao-harness.mjs` (read-only). Rode após qualquer
onda de correção. Este documento nomeia o que **não zerou** e a decisão de cada item.

Identidade por visão (mês a mês, encadeado como a tela):
- **onshore** = `pl_fim − pl_ini − NNM_real − Rent + Imp`
- **offshore** = `pl_fim − pl_ini − NNM_real − Rent − GC`
- **consolidado** = onshore + offshore

> ⚠️ **Regra de medição (aprendida na marra):** qualquer gate/script de correção
> DEVE reusar o pipeline VERBATIM do harness — auto-repair de `pl_onshore`,
> encadeamento read-time (`pl_inicial = pl[t-1]`), ghost filter e `impostos_mes`.
> Um script naïve que lê campos crus mede DIFERENTE da tela e inventa resíduos
> telescópicos (ex.: viu −118k no LUIZ que na tela fecha em 0). **Nunca gateie um
> mês cujo cliente já fecha no acumulado** — só o MÊS-CARREGADOR de clientes com
> `|resOn por-cliente| > R$1k`.

---

## Placar (pós-import Mai/Abr/Jan-26 + gate por-cliente)

| Período | Onshore | Offshore | Consolidado |
|---|---|---|---|
| Mês corrente (2026-06) | **0,00** ✅ | **0,00** ✅ | **0,00** ✅ |
| **2026 YTD** | **−69.285,83** | **0,00** ✅ | −69.285,83 |
| Base completa (2025→) | −211.854,78 | **0,00** ✅ | −211.854,78 |

> **Offshore: fechado em toda a história.** Check de classificação (rent > 50% do PL): **0**.
> **Jun/26 fecha 100%.** O resíduo onshore é **100% atribuível** a 7 clientes em 2026
> + 3 entradas de 2025. Gate por-cliente (rent% implícito vs `rentabilidade_pct`, 5 bps):
> **0 PASSAM / 7 REPROVAM** — o re-import trouxe dados novos mas o rent ainda é
> inconsistente. Nenhum é backfillável deterministicamente.

---

## Os 9 que dependiam de lâmina nova — status pós-import

| Cliente | Mês | Antes | Agora | Fechou? |
|---|---|---|---|---|
| MARCO ANTONIO | Abr/26 | +9.217 | −95 / +348 | ✅ **fechou** (re-import resolveu) |
| GABRIEL NATHAN | Jan/26 | −7.939 | 2026 = 0 | ✅ **2026 fechou** (resíduo real é 2025-03 entrada) |
| ALAN KARDEC | Mai/26 | −41.580 | −41.580 | ❌ rent suspeito (Δ −8,3 bps) |
| MOISES LIMA | Abr/26 | −30.940 | −29.957 | ❌ rent suspeito (Δ −5,8 bps) |
| FLORENCE | Mai/26 | −12.208 | −12.208 | ❌ rent suspeito (Δ −9,7 bps) |
| MARIA TEREZA | Mai/26 | +9.115 | +9.115 | ❌ **entrada** (plIni R$5.382, aporte 0) — Δ +48,4 bps |
| ARTUR VICTOR | Mai/26 | +2.248 | +2.248 | ❌ rent suspeito (Δ −7,9 bps) |
| RONALDO | Mai/26 | +1.724 | +1.724 | ❌ rent suspeito (Δ −10,2 bps) |
| LEONARDO | Mai/26 | +1.179 | +1.179 | ❌ rent suspeito (Δ −7,2 bps) |

### 🔎 Padrão sistemático em Maio/26 (campo F)
6 dos 7 (todos exceto MARIA) têm **rent% implícito ABAIXO do `rentabilidade_pct`
gravado**, de forma consistente — não é aleatório:

| Cliente | rent% implícito | rent% gravado | plIni | aporte onshore |
|---|---|---|---|---|
| ALAN Mai | 0,747% | 0,830% | 8.219.988 | −289.144 |
| MOISES Abr | 0,912% | 0,970% | 8.408.953 | −187.288 |
| FLORENCE Mai | 0,533% | 0,630% | 2.990.834 | +734 |
| ARTUR Mai | 1,111% | 1,190% | 36.808.449 | +238.451 |
| RONALDO Mai | 1,378% | 1,480% | 19.386.780 | +3.826.011 |
| LEONARDO Mai | 1,278% | 1,350% | 7.045.066 | +197.528 |

→ O BRL `rentabilidade_onshore` (campo F, Rendimento Nominal) **não fecha com o %
gravado em NENHUMA base** (testado plIni e plIni+aporte). Um dos dois está errado
na leitura da lâmina. **Ação:** conferir o campo F (Rendimento Nominal R$) das
lâminas de Maio/26 desses 6 clientes — provável parser lendo célula errada/parcial.

---

## LISTA MÍNIMA DEFINITIVA DE LÂMINAS A CONFERIR

**2026 — rent inconsistente (campo F):**
- **Maio/26** (6): ALAN, FLORENCE, ARTUR VICTOR, RONALDO, LEONARDO, MARIA TEREZA*
- **Abril/26** (1): MOISES
  - *MARIA = caso de entrada (plIni R$5.382): decidir se é capital de entrada (aceitar) ou re-decompor.

**2025 — entradas:**
- **Jul/25**: PEDRO H. SILVA (PSS) −123.641
- **Mar/25**: PEDRO H. ALMEIDA (PHB) −9.992
- **Mar/25**: GABRIEL NATHAN −7.940 (entrada — migrou de Jan/26 ao encadear)

**Total: 10 client-meses** (7 de 2026 + 3 de 2025).

> ⚠️ **ALAN** reclassifica como `import_faltante` na base completa — investigar se
> tem mês só-offshore (onshore não importado, tipo WESLEY). Pode ser a raiz do −41.580.

---

## Histórico das ondas (resolvido)
- **GC offshore** = resíduo cambial + guard (`4d14769`); rent gravada primeiroMes
  (`5af7875`); **bug de entrada offshore na raiz + sanity + check** (`723be8b`).
- **Harness permanente** (`27439ac`) com check de classificação.
- **Correções:** lote ponte Maio (7), LOTE A/B, RAFAEL Jul/25, 7 entradas offshore
  2025, lote final (5 tombamento + 3 gate), gate estendido (+4). Todas com identidade
  pós-write.
- **Pós-import Mai/Abr/Jan-26:** MARCO + GABRIEL fecharam; gate por-cliente confirmou
  os 7 restantes como **rent suspeito** (0 backfills). **Offshore 100% fechado;
  Jun/26 100% fechado.**

> **Mecânica de fechamento dos 7:** com o campo F correto da lâmina, o gate confirma
> rent (PASS) ou corrige aporte; identidade fecha. Enquanto o BRL e o % não baterem,
> qualquer backfill seria chutar qual dos dois está certo — proibido (correção sempre
> determinística).
