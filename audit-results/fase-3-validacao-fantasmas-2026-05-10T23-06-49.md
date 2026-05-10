# Validação dos 22 docs fantasma — hipótese de recuperação via clientes_base/

Gerado em 2026-05-10T23:06:49.813Z. READ-ONLY.

## Sumário

- Slugs únicos fantasma: **11** (cada um em 2 períodos = 22 docs)
- Recuperáveis via clientes_base/: **11** slugs (22 docs)
- Não recuperáveis (sem base): **0** slugs

## Tabela detalhada

| Slug (docId fantasma) | Períodos | Status | Nome canônico | id_estavel canônico |
|---|---|---|---|---|
| `ademilson_braga_bispo_junior` | 2026-01, 2026-04 | OK_RECUPERAVEL | ADEMILSON BRAGA BISPO JUNIOR | `98bc6fc9-7e55-4f63-bb65-35e23c2cd7ec` |
| `allan` | 2026-01, 2026-04 | OK_RECUPERAVEL | ALLAN | `411fb05d-2696-4d93-bd1c-e24d91e5d5c5` |
| `arthur_mendonca_cabral` | 2026-01, 2026-04 | OK_RECUPERAVEL | ARTHUR MENDONÇA CABRAL | `620cd05a-36b2-4176-bc52-ce228783ed73` |
| `djamila_ribeiro` | 2026-01, 2026-04 | OK_RECUPERAVEL | DJAMILA RIBEIRO | `ba4c8f36-8ed4-463f-92dd-7c75e414739e` |
| `fundacao_fenomenos` | 2026-01, 2026-04 | OK_RECUPERAVEL | FUNDAÇÃO FENOMENOS | `1248d942-62f8-477f-8be8-8f1846f83828` |
| `hariel_denaro_ribeiro` | 2026-01, 2026-04 | OK_RECUPERAVEL | HARIEL DENARO RIBEIRO | `06e031f1-f727-48f4-9308-1b3b0e8203d5` |
| `jean_paulo_fernandes_filho` | 2026-01, 2026-04 | OK_RECUPERAVEL | JEAN PAULO FERNANDES FILHO | `12aade2f-6024-408f-9a2f-4992563b99ab` |
| `leonardo_cesar_jardim` | 2026-01, 2026-04 | OK_RECUPERAVEL | LEONARDO CESAR JARDIM | `ebb96757-9d88-4d3c-ac10-1a0fb1aa9def` |
| `luan_guilherme_de_jesus_vieira` | 2026-01, 2026-04 | OK_RECUPERAVEL | LUAN GUILHERME DE JESUS VIEIRA | `ccab1469-530e-4637-ac9e-5b3cacc7b78b` |
| `rede_ronaldo` | 2026-01, 2026-04 | OK_RECUPERAVEL | REDE RONALDO | `7ba75589-7a36-4731-8f82-bd4c3efde141` |
| `ronald_domingues_nazario_de_lima` | 2026-01, 2026-04 | OK_RECUPERAVEL | RONALD DOMINGUES NAZARIO DE LIMA | `4a5423ee-42af-482b-8f36-2d85ec73411f` |

## Conclusão

✓ Hipótese confirmada 100%. Todos os 22 docs podem ser recuperados via caminho (b).

Para cada fantasma, aplicar via `updateDoc`:
- `nome_cliente` = `clientes_base/{docId}.nome_cliente`
- `id_estavel` = `clientes_base/{docId}.id_estavel`

Os demais campos (pacote, consultoria_*, etc.) NÃO são populados nesta rodada — fora do escopo.