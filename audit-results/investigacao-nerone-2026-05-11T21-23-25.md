# Investigação — Luis Eduardo Nerone: divergência cross-período

Gerado em **2026-05-11T21:21:39Z** · READ-ONLY · nenhum arquivo modificado · nenhum write Firestore.

Fonte: `scripts/investigarNerone.mjs` (one-shot descartável). Busca por substring `nerone` em `nome_colaborador`, case+acento-insensitive, sobre `collectionGroup('colaboradores')`.

---

## Resumo executivo

**6 snapshots encontrados em 5 períodos.** Há **2 documentos físicos distintos no mesmo período 2025-12** com cargos e salários diferentes:

- `6fcc0862-...` — cargo "Analista Financeiro", teto R$ 6.882,85
- `8aba1578-...` — cargo "Supervisor Financeiro", teto R$ 6.855,16

Os 4 períodos seguintes (2026-01 a 2026-04) usam apenas o doc `8aba1578-...` (Supervisor Financeiro), mas o salário oscila: **6.882,85** em 2026-01 e volta para **6.855,16** em 2026-02 a 2026-04.

`id_estavel` está unificado em **`ac6922ca-d464-4743-b125-51e8d0ec26c1`** em todos os 6 docs (Fase 3 parte 3 + operações subsequentes funcionaram).

**Conclusão:** Não é promoção real — é **inconsistência cross-período no histórico de cargo e salário**. Há também uma divergência no `historico_reajustes` entre 2026-01 e 2026-02+.

---

## Tabela completa dos 6 snapshots

| Período | docId | id_estavel | cargo | tipo_vinculo | teto | salário base | líquido | beneficios | custo total |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| 2025-12 | `6fcc0862…` | `ac6922ca…` | **Analista Financeiro** | (null) | 6.882,85 | 6.882,85 | (null) | 1.426,83 | 11.001,62 |
| 2025-12 | `8aba1578…` | `ac6922ca…` | **Supervisor Financeiro** | (null) | 6.855,16 | 6.855,16 | (null) | 1.426,83 | 10.963,10 |
| 2026-01 | `8aba1578…` | `ac6922ca…` | Supervisor Financeiro | clt | 6.882,85 | 6.855,16 | 0 | 1.426,83 | 11.001,64 |
| 2026-02 | `8aba1578…` | `ac6922ca…` | Supervisor Financeiro | clt | 6.855,16 | 6.855,16 | 0 | 1.426,83 | 10.963,12 |
| 2026-03 | `8aba1578…` | `ac6922ca…` | Supervisor Financeiro | clt | 6.855,16 | 6.855,16 | 0 | 1.426,83 | 10.963,12 |
| 2026-04 | `8aba1578…` | `ac6922ca…` | Supervisor Financeiro | clt | 6.855,16 | 6.855,16 | 0 | 1.426,83 | 10.963,12 |

`funcao_principal` = `consultoria_financeira` em todos os 6 (consistente).
`alocavel` = `true`, `percentual_alocavel` = 1, `percentual_institucional` = 0 (consistente).
`qtd_dependentes` = 0 onde existe; null nos dois snapshots de 2025-12.

---

## Análise de divergências

### Divergência 1 — Dois docs físicos em 2025-12

Ambos com mesmo `id_estavel`, mas docIds distintos (`6fcc0862-...` e `8aba1578-...`). Esta é a "duplicata convivendo" residual da fase pré-Sub-fase 3C parte 3:

- O doc `6fcc0862-...` foi originalmente cadastrado como **"Luiz Nerone"** (nome curto) com cargo "Analista Financeiro".
- O doc `8aba1578-...` foi cadastrado como **"Luis Eduardo Nerone"** (nome canônico) com cargo "Supervisor Financeiro".
- Na Sub-fase 3C parte 3, o doc `6fcc0862-...` foi reescrito via mapeamento AMBÍGUO (`luiz_nerone` → `luis_eduardo_nerone`) — `nome_colaborador` virou "Luis Eduardo Nerone".
- **O cargo, teto e salário base do doc `6fcc0862-...` NÃO foram reescritos** (a Sub-fase 3C parte 3 só tocou `nome_colaborador` e `id_estavel`, não cargo/salário — comportamento esperado pelo escopo da fase).
- Resultado: convivem dois docs com o mesmo nome mas cargos e tetos diferentes em 2025-12.

> **Observação sobre id_estavel:** O relatório da Sub-fase 3C parte 3 (`audit-results/fase-3c-aplicacao-2026-05-11T15-17-27.md`) mostrou que o doc `6fcc0862-...` recebeu id_estavel `44cf0384-65c0-472d-8af0-6d52d815e141`. Mas o estado atual mostra `ac6922ca-...`. Houve **propagação posterior** (possivelmente uma operação manual ou re-execução de migração que unificou os UUIDs do mesmo colaborador lógico). Este diagnóstico não tem acesso a logs Firestore para reconstruir essa operação.

### Divergência 2 — Teto oscila 6.882,85 → 6.855,16 entre 2026-01 e 2026-02

| Período | teto | salário base |
|---|---:|---:|
| 2025-12 (doc 6fcc) | 6.882,85 | 6.882,85 |
| 2025-12 (doc 8aba) | 6.855,16 | 6.855,16 |
| **2026-01** | **6.882,85** | 6.855,16 |
| 2026-02 | 6.855,16 | 6.855,16 |
| 2026-03 | 6.855,16 | 6.855,16 |
| 2026-04 | 6.855,16 | 6.855,16 |

O teto sobe **R$ 27,69** em 2026-01 e desce R$ 27,69 em 2026-02. Mudança ínfima — não é reajuste contratual normal.

**Hipótese mais provável:** salvamento manual no modal de Folha em janeiro de 2026 usou o teto do doc `6fcc0862-...` (Analista, 6.882,85) por engano, criando uma entrada de `historico_reajustes` com vigência 2026-01. Em fevereiro, alguma operação reverteu o teto para 6.855,16 e reescreveu o histórico com "Entrada inicial (migração)" de 2025-12.

### Divergência 3 — `historico_reajustes` inconsistente entre 2026-01 e 2026-02+

**Em 2026-01:**
```json
[
  {
    "vigencia": "2026-01",
    "salario_teto_cargo": 6882.85,
    "liquido_acordado": 0,
    "observacao": "Reajuste automático",
    "registrado_em": "2026-05-08T10:56:05.212Z",
    "registrado_por": "Arthur Cruvinel"
  }
]
```

**Em 2026-02, 2026-03 e 2026-04:**
```json
[
  {
    "vigencia": "2025-12",
    "salario_teto_cargo": 6855.16,
    "liquido_acordado": 0,
    "observacao": "Entrada inicial (migração)"
  }
]
```

Os dois históricos são **mutuamente incompatíveis**:

- O de 2026-01 sugere que houve um **reajuste automático em 2026-01** levando o teto para 6.882,85. Se válido, deveria persistir nos meses seguintes.
- O de 2026-02+ sugere que o **único reajuste é a entrada inicial de migração** com teto 6.855,16. A entrada de 2026-01 foi apagada.

Possibilidade técnica: a propagação de folha (`propagarFolhaColaborador` em `firebase.ts`) pode ter sido rodada após o salvamento de 2026-01, sobrescrevendo o `historico_reajustes` apenas dos períodos `>= período-base` selecionado, deixando 2026-01 "órfão" com uma entrada que não persiste cross-período.

### Divergência 4 — Tipo_vinculo ausente em 2025-12

Os 2 docs de 2025-12 têm `tipo_vinculo = null`. A partir de 2026-01, todos têm `tipo_vinculo = "clt"`. `localidade` segue o mesmo padrão (null em 2025-12, "SP" depois). Isso é o padrão geral dos snapshots de 2025-12 (ver Q1 do diagnóstico Fase 2: campos `tipo_vinculo`, `liquido_acordado`, `localidade`, `qtd_dependentes` aparecem em 73,6 % dos docs — os 29 que faltam são todos de 2025-12 ou subset).

---

## Histórico de cargo formal — não existe

O campo `historico_cargos` é **null** em todos os 6 snapshots. **Não há registro formal** de quando o cargo mudou de "Analista" para "Supervisor".

Os únicos vestígios da mudança são:
- O doc `6fcc0862-...` (Analista, 2025-12) que sobreviveu sem ser sobrescrito.
- O doc `8aba1578-...` (Supervisor, do mesmo 2025-12 em diante).

Esses dois convivendo sugerem que houve uma **promoção real** registrada como **criação de um novo cadastro** em vez de edição do antigo. Hipótese: o usuário criou um novo registro de colaborador "Luis Eduardo Nerone" como Supervisor (provavelmente para refletir promoção) em dezembro, mas o registro antigo "Luiz Nerone" (Analista) **não foi removido**.

---

## Conclusão proposta

**Não foi promoção real registrada corretamente.** Foi uma combinação de:

1. **Duplicidade histórica residual** — dois docs físicos do mesmo colaborador convivem em 2025-12 ("Luiz Nerone" Analista e "Luis Eduardo Nerone" Supervisor). A Sub-fase 3C parte 3 unificou o `id_estavel` e `nome_colaborador` mas preservou os campos divergentes (cargo, teto) como esperado pelo escopo.

2. **Inconsistência cross-período no teto** — 2026-01 tem teto 6.882,85 (igual ao doc "Analista") e os outros meses têm 6.855,16 (igual ao doc "Supervisor"). Provavelmente erro de digitação ou operação de salvamento que confundiu os dois docs.

3. **Inconsistência no historico_reajustes** — 2026-01 contém uma entrada "Reajuste automático" que não aparece em 2026-02+; estes contêm uma entrada "Entrada inicial (migração)" que não aparece em 2026-01. Os dois históricos descrevem mundos diferentes.

### Recomendação operacional (fora do escopo da Fase 3)

Estas inconsistências devem ser tratadas na **Fase 2 — Princípio 3 (criação de `colaboradores_base/`)**, especificamente na Etapa 1 da migração. Decisões necessárias:

1. **Qual é o cargo canônico atual?** Provável: "Supervisor Financeiro" (4 dos 6 snapshots, e é o mais recente).
2. **Qual é o teto canônico atual?** Provável: 6.855,16 (4 dos 6 snapshots e os 3 mais recentes).
3. **O que fazer com o doc 6fcc0862 em 2025-12?**
   - Opção A: deletar (mas regra absoluta da Fase 3 proíbe — pode ficar para Fase 5 ou ser sanado manualmente).
   - Opção B: deixar conviver — `colaboradores_base/` adota a versão "Supervisor" e ignora o doc duplicado.
4. **O que fazer com a oscilação 2026-01 → 2026-02?**
   - Confirmar manualmente com Arthur Cruvinel se o teto de 2026-01 foi reajuste real (mantém 6.882,85) ou erro (corrige para 6.855,16).
   - Se erro: edição manual no modal de Folha para 2026-01, com `historico_reajustes` consistente.

Confirmação humana é necessária para itens 1-4. Este relatório fornece os dados; **não toma decisões**.

---

## Sobre id_estavel

Apesar das inconsistências de cargo e teto, **o `id_estavel` está consistente** em todos os 6 snapshots (`ac6922ca-d464-4743-b125-51e8d0ec26c1`). A Visão 2 do Princípio 5 sobreviveu — todos os 6 snapshots apontam para a mesma entidade lógica.

---

**Fim da investigação.**
