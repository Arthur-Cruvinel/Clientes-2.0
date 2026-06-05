# BACKLOG — Pendências Técnicas

Arquivo único e acumulativo de dívidas técnicas e pendências do Clientes 360.
Adicionar novos itens ao final; mover concluídos para a seção "Resolvidos" com
a data. Cada item: contexto, ação esperada e gatilho (quando endereçar).

---

## Abertos

### 1. Scripts `.mjs` da Fase 2 não conhecem os 4 subcampos de benefício
**Contexto:** os 4 scripts `.mjs` da Fase 2 (`fase2ColaboradoresBase`,
`fase2ColaboradoresAto2B`, `fase2ColaboradoresAto2C`, `corrigirTipoVinculo`)
têm listas explícitas de campos **sem** os 4 subcampos de benefício
(`vale_alimentacao`, `vale_transporte`, `plano_saude`, `outros_beneficios`).
Se algum for re-executado, os subcampos são descartados (o custo permanece
correto via `beneficios_fixos`, que eles preservam).
**Ação:** incluir os 4 campos nesses payloads antes de qualquer reuso.
**Gatilho:** ao re-executar qualquer um desses scripts.

### 2. `table-fixed` exige largura explícita em todas as colunas
**Contexto:** regra de UI estabelecida no fix da coluna Nome (tabela de
Colaboradores). Sob `table-fixed`, toda coluna deve ter largura explícita —
coluna sem largura colapsa para ~0px em viewport estreito (notebook ~1366px),
sobrepondo a coluna seguinte.
**Ação:** verificar as tabelas bespoke de **Matriz** e **Capacidade** (que não
usam o `DataTable` compartilhado) quando forem tocadas, garantindo largura
explícita por coluna.
**Gatilho:** ao editar as tabelas de Matriz/Capacidade.

### 3. `backups/firestore/` versionado no git — retenção
**Contexto:** snapshots pré-write de migrações são commitados em
`backups/firestore/` (hoje ~200 KB no total). Útil para auditoria/rollback,
mas cresce a cada migração.
**Ação:** avaliar `.gitignore` da pasta + estratégia de retenção externa
(ex. bucket/Drive) quando passar de alguns MB.
**Gatilho:** quando a pasta ultrapassar alguns MB.

---

## Resolvidos

_(vazio)_
