# Cleanup órfãos legados RIA_BTG — 2026-05-14T21:55:39.955Z

Decisão CFO: Caminho A — lixo de teste, deletar todos.
Escopo: 13 docs RIA_BTG em poupanca/ (slug do docId = "ria_btg").
Causa raiz NÃO corrigida nesta rodada — limpeza de legado apenas.

## Snapshot prévio

`C:\Users\arthur.cruvinel\OneDrive - GALAPAGOS CAPITAL\Área de Trabalho\Tecnologia\VS Code\Clientes 2.0\galacticos-cfo\backups\firestore\poupanca-ria-btg-pre-delete-2026-05-14T21-55-39.json`

## Docs deletados

Total: **13** de 13 alvo(s)

| # | docId | período | pl_onshore | aporte_mes_total |
|---|---|---|---:|---:|
| 1 ✓ | `ria_btg_2025_3` | 2025-03 | R$ 0,00 | R$ 0,00 |
| 2 ✓ | `ria_btg_2025_4` | 2025-04 | -R$ 126,36 | R$ 0,00 |
| 3 ✓ | `ria_btg_2025_5` | 2025-05 | R$ 0,00 | R$ 126,36 |
| 4 ✓ | `ria_btg_2025_6` | 2025-06 | R$ 0,00 | R$ 0,00 |
| 5 ✓ | `ria_btg_2025_7` | 2025-07 | R$ 0,00 | R$ 0,00 |
| 6 ✓ | `ria_btg_2025_8` | 2025-08 | R$ 0,00 | R$ 0,00 |
| 7 ✓ | `ria_btg_2025_9` | 2025-09 | R$ 0,00 | R$ 0,00 |
| 8 ✓ | `ria_btg_2025_10` | 2025-10 | R$ 0,00 | R$ 0,00 |
| 9 ✓ | `ria_btg_2025_11` | 2025-11 | R$ 0,00 | R$ 0,00 |
| 10 ✓ | `ria_btg_2025_12` | 2025-12 | R$ 0,00 | R$ 0,00 |
| 11 ✓ | `ria_btg_2026_3` | 2026-03 | R$ 0,00 | R$ 0,00 |
| 12 ✓ | `ria_btg_2026_4` | 2026-04 | -R$ 126,36 | R$ 0,00 |
| 13 ✓ | `ria_btg_2026_5` | 2026-05 | R$ 0,00 | R$ 126,36 |


## Validação pós-delete

**V1 — Nenhum doc com slug `ria_btg` em poupanca/:** ✓ OK

**V2 — Total de poupanca/ = antes (913) − deletados (13):** ✓ OK (900)

**V3 — Spot-check imutabilidade de clientes reais:** ✓ OK

| Slug | Antes | Depois | Status |
|---|---:|---:|---|
| `wenderson_galeno` | 14 | 14 | ✓ |
| `moises_lima_magalhaes` | 17 | 17 | ✓ |
| `ademilson_braga_bispo_junior` | 17 | 17 | ✓ |

## Resumo

- Total LIVE antes:  **913**
- Total LIVE depois: **900**
- Docs deletados:    **13**
- Erros:             **0**
- V1: ✓ · V2: ✓ · V3: ✓

## LIMPEZA DO LEGADO CONCLUÍDA ✓

## Notas

- A constante `ESPERADOS = { ria_btg: 2 }` em `scripts/cleanup-poupanca-fantasmas.mjs` está desatualizada (eram 13 docs); cosmético, não corrigido nesta rodada.
- MSAL e Wenderson fantasmas já haviam sido deletados em 10-mai (cleanup parcial). Esta rodada finaliza o legado.
- Causa raiz dos órfãos (caminhos onshore single e multi-período ignorando `mapeamento_siglas/`) permanece. Documentado em `audit-results/diagnostico-sigla-orfa-poupanca-2026-05-14T20-39-04.md`. Correção estrutural fica para fase própria.
