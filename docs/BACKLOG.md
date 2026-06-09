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

### 4. Import por sigla cria docId sigla-keyed em vez de agregar no slug canônico
**Contexto:** o import por sigla grava o doc de poupança com docId baseado na
sigla (`mtv_xp_2026_5`, `aae_btg_2026_5`, `rrf_glpg_2026_4`) em vez de agregar/
gravar no docId do **slug canônico** do cliente (`maria_tereza_vasconcelos_barbosa_2026_5`).
Resultado: dois docs no mesmo (cliente, ano, mês). Como o pipeline de leitura
(`usePoupanca`/harness) encadeia por `nome_cliente` ordenado por (ano,mês), os
dois docs do mesmo mês ficam consecutivos e o 2º recebe `pl_inicial = pl[1º]` →
**resíduo-fantasma** de encadeamento (MARIA gerou +9.115 espúrio). Varredura
2026-06 achou só 3 clientes afetados (MARIA, ALLAN, RAFAEL) — **não é sistêmico**,
mas a raiz é o write-path.
**Mecânica do defeito:** a identidade de `poupanca/` É o docId (`slug_ano_mes`); a
coleção não tem `id_estavel`. Import em quarentena grava `slug(sigla_bruta)_ano_mes`;
a normalização (`corrigirNomeClientePoupanca`) seta `nome_cliente` mas preserva o
docId ("Nunca alterar docId" — `useImportPoupanca.ts:600`). O fragmento sigla-keyed
fica órfão: aparece nas views (group by `nome_cliente`) mas é inalcançável por toda
op por-nome (que mira `slug(nome)`). Varredura: 30 fragmentos em 3 clientes (ALLAN
`aae_btg`, EDUARDA `esm_btg`, MARIA `mtv_xp`).

**Ação (fix de raiz — RE-KEY no write-path):** ao sair da quarentena/normalizar, em
vez de só trocar conteúdo, **re-keyar** o docId:
1. `corrigirNomeClientePoupanca` e `cadastrarSiglaNova` (`firebase.ts`): para cada doc
   sigla-keyed, computar `canon = slug(nome)_ano_mes`; se `canon` NÃO existe →
   `setDoc(canon, conteúdo)` + `deleteDoc(sigla-keyed)`; se existe → **merge** (decidir
   regra: somar contas reais vs manter o vivo) e excluir o fragmento.
2. Sempre por **docId direto** (a construção por-nome não alcança o fragmento).
**Sem esse fix, todo import por sigla recria fragmento** — é a causa-raiz, não sintoma.
**NUNCA** consertar no read-path (encadeamento) — tocaria a leitura de todos os
clientes por um problema de poucos (regressão desproporcional).

A correção dos fragmentos **existentes** é de **dados**, por docId direto, registrada
em `docs/pendencias-reconciliacao.md` (MODO 1 migrar sole-source / MODO 2 resolver
colisão). RAFAEL já corrigido.
**Gatilho:** ao tocar o fluxo de import/normalização de poupança por sigla / quando
aparecer um novo fragmento sigla-keyed.

### 5. RISCO ACEITO: import de Excel de custosIndiretos é wipe-replace destrutivo
O import de Excel de `custosIndiretos` segue **wipe-replace com docId aleatório e
sem `id_estavel`** (`useUploadImport.ts` ~264 `wipeSubcollection` + ~186
`escreverBatch` com `crypto.randomUUID()`). **Reimportar um período destrói os
valores e a identidade (docId/id_estavel) gravados pela UI** de Custos Indiretos.
**Decisão de 06/26: manter como está; a UI (Configurações → Custos Indiretos) é o
caminho principal de edição.** Os 5 docs/período já têm identidade canônica fixada
em `CATEGORIAS_CUSTO_INDIRETO` (`constants.ts`).
**Ação (quando/se o Excel voltar a ser usado para custos indiretos):** blindar o
write-path — upsert por **identidade canônica** (casar a `categoria_dre` contra as
5, gravar no docId+id_estavel canônicos da constante), em vez de wipe + UUID
aleatório.
**Gatilho:** ao reabilitar/usar o import de Excel para a aba `custos_indiretos`.

### 6. Backups sensíveis JÁ no histórico do git
~45 arquivos de backup com **dado de cliente real** (alocação, folha, poupança)
foram commitados **antes** do `.gitignore` (e5a9bb6) e do `git rm --cached`
(898e10a). O `git rm --cached` os tira do **rastreamento futuro**, mas eles
**permanecem nos commits passados** do histórico.
**Ação (remoção do histórico — git filter-repo / BFG):** só DEPOIS de:
(a) **remoto configurado** — para ter backup do repo antes de reescrever; e
(b) idealmente **repo fora do OneDrive** durante a operação.
Reescrever histórico em `.git` no OneDrive sem remoto = **risco de corrupção
sem recuperação**. **Encadeia com o item "configurar remoto"** (repo local sem
remoto — ver item 1 deste backlog / governança).
**Gatilho:** quando houver remoto privado configurado e janela dedicada.

---

## Resolvidos

_(vazio)_
