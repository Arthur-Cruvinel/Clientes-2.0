# Sub-fase 3C — Match clientes_fechamentos × clientes_base

Gerado em 2026-05-10T22:50:11.503Z. READ-ONLY.

## Sumário

- Total em `clientes_base/`: **84** (todos com id_estavel)
- Total em `fechamentos/*/clientes/`: **438**

| Classificação | Docs | Comportamento esperado |
|---|---:|---|
| **CONFIANTE** | 406 | Herdar id_estavel do match em clientes_base/ |
| **AMBÍGUO** | 10 | Requer revisão humana — possui candidato(s) por substring |
| **SEM_MATCH** | 22 | Requer revisão humana — nenhum candidato em clientes_base/ |

### Detalhe CONFIANTE

- Match por nome exato: **406**
- Match por slug (normalizado): **0**

### AMBÍGUO — todos os casos

| Nome em fechamentos | Períodos afetados | Candidatos em clientes_base/ |
|---|---|---|
| KEVIN | 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | `kevin_santos_lopes` (KEVIN SANTOS LOPES) |
| TAMIRES | 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | `tamires_cassia_dias_de_britto` (TAMIRES CÁSSIA DIAS DE BRITTO) |

### SEM_MATCH — todos os casos

| Nome em fechamentos | Períodos afetados | Slug derivado |
|---|---|---|
| (sem nome) | 2026-01, 2026-04 | `sem_nome` |

## Decisões pendentes do usuário

Para cada AMBÍGUO: escolher qual candidato de clientes_base/ herdar (ou rejeitar).
Para cada SEM_MATCH: decidir entre:
1. Criar entrada nova em `clientes_base/` (cliente legítimo ainda não cadastrado)
2. Gerar id_estavel novo direto no doc (sem espelho em clientes_base)
3. Pular o doc (lixo/erro de dado — não migrar)