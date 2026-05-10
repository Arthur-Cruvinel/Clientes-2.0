# Fase 3 (Princípio 5 — id_estavel) — Progresso em 2026-05-10

## Status geral

Fase 3 PAUSADA durante Sub-fase 3C (migração de dados existentes).
Motivo: usuário pediu para retomar dentro do Project (Galácticos CFO)
para validar contra decisões anteriores sobre lógica de colaboradores
que estão em chats do Project não acessíveis fora dele.

## O que foi concluído

### Fase 1 — Princípio 1 (slug único) ✅ COMPLETA

- `src/utils/slug.ts` criado (41 linhas)
- 14 implementações locais migradas para canônica
- Divergente `useColaboradores.ts` (hífen) eliminada
- Build limpo
- Saldo: -76 linhas líquidas em 14 arquivos
- Relatório final em `audit-results/fase-1-slug-final-{timestamp}.md`

### Fase 3 Sub-fase 3A — Auditoria ✅ COMPLETA

Achados:
- 673 docs sem id_estavel distribuídos em 4 coleções (84 + 438 + 126 + 25)
- Tipos TS sem id_estavel: Cliente, Colaborador, CustoIndireto
- 5 pontos de criação confirmados (mapa anterior bate com código)
- `copiarPeriodo` já preserva campos automaticamente via `d.data()`
- Snapshots em `fechamentos/{periodo}/clientes/` usam UUID como docId
  (não slug), enquanto `clientes_base/` usa slug

Relatório: `audit-results/fase-3-id-estavel-auditoria-2026-05-10T22-30-00.md`

### Fase 3 Sub-fase 3B — Tipos TypeScript ✅ COMPLETA

- Adicionado `id_estavel?: string` em 3 interfaces (src/types/index.ts):
  - Cliente
  - Colaborador
  - CustoIndireto
- JSDoc didático em cada
- Build limpo

### Fase 3 Sub-fase 3C — Migração de dados — EM ANDAMENTO

**3C parte 1 — clientes_base/ ✅ CONCLUÍDA**

- 84 docs migrados, cada um com UUID v4 único
- Validação pós-write: 0 docs sem id_estavel
- Snapshot JSON: `backups/firestore/id-estavel-2026-05-10T22-31-26-clientes_base.json`
- Tempo de execução: 63 segundos (1 batch)

**3C parte 2 — clientes_fechamentos/ — PAUSADA AQUI**

Investigação completou, mas APPLY NÃO foi executado.

Achados:
- 438 docs total
- 406 docs CONFIANTE (match exato por nome com clientes_base/) — 92.7%
- 10 docs AMBÍGUO (Kevin e Tamires nomes antigos pré-rodada offshore) — 2.3%
- 22 docs SEM MATCH (sem nome_cliente no payload) — 5.0%

Investigação dos 22 docs SEM MATCH revelou:
- Foram criados por `salvarPct` (Perfil) ou `salvarTodos`
  (AlocacaoEmLote) via `setDoc({...}, {merge: true})`
- Quando snapshot não existia, o merge criou doc novo com APENAS o
  campo de função (pct_operacional_financeiro), sem nome_cliente
- 11 docs em 2026-01 + 11 em 2026-04 = 22 docs total
- Bug arquitetural: comentário em useColaboradores.ts:111-112 prevê
  o caso, mas população posterior nunca acontece
- DocIds dos 22 docs SÃO slugs que batem com `clientes_base/`
  (validação em audit-results/fase-3-validacao-fantasmas-2026-05-10T23-06-49.md)

**3C parte 3 — colaboradores_fechamentos/ — NÃO INICIADA**
- 126 docs em 30 colaboradores únicos
- Plano: agrupar por nome_colaborador, gerar 1 UUID por colaborador
  único, aplicar a todos os snapshots dele

**3C parte 4 — custos_fechamentos/ — NÃO INICIADA**
- 25 docs
- Plano: agrupar por descricao_custo (texto livre — pode ter
  ambiguidades)

## Decisões já tomadas nesta sessão

### Princípio 5 — DocId híbrido

- docId visível = slug (legibilidade)
- campo id_estavel = UUID v4 (imutável)
- Aplicado às 3 entidades: cliente, colaborador, custo indireto
- UUID separado do docId, mesmo quando docId já é UUID

### Visão de identidade — Visão 2 (final)

`id_estavel` representa a **entidade lógica** (a pessoa Kevin, a
colaboradora Giovanna), não o documento Firestore. Snapshots em
fechamentos/ herdam o id_estavel da coleção mestre (clientes_base/)
via match por nome.

**ATENÇÃO:** clientes_base/ já foi migrado com 84 UUIDs únicos por
doc. Esses UUIDs SÃO a "identidade lógica" — devem ser propagados
para os snapshots em fechamentos/{periodo}/clientes/ via match.

### Match por nome em clientes_fechamentos

- Match exato em nome_cliente: CONFIANTE
- Match exato após slug() (normalização): CONFIANTE
- Não bate exato nem via slug: AMBÍGUO ou SEM MATCH
- Casos não-CONFIANTE pedem revisão humana antes de aplicar

### copiarPeriodo

NÃO modificar. Já preserva id_estavel automaticamente via
`batch.set(doc(...), d.data())`. Apenas adicionar comentário inline
documentando.

### Sobre AMBÍGUO (Kevin/Tamires) — DECISÃO 1b

Herdar id_estavel canônico (`kevin_santos_lopes`,
`tamires_cassia_dias_de_britto`) E atualizar `nome_cliente` nos
snapshots para o nome canônico (KEVIN SANTOS LOPES, TAMIRES CÁSSIA
DIAS DE BRITTO). Aplicar nas 5 períodos de cada.

### Sobre SEM MATCH (22 docs fantasma) — DECISÃO 2b

Investigação concluída. Os 22 docIds existem em clientes_base/ e o
caminho (b) é seguro:
- updateDoc adicionando nome_cliente herdado de clientes_base/
- updateDoc adicionando id_estavel herdado de clientes_base/
- Outros campos cadastrais NÃO populamos nesta rodada (escopo Fase 3)

Validação completa em:
`audit-results/fase-3-validacao-fantasmas-2026-05-10T23-06-49.md`

## Pendências críticas anotadas

### Bug arquitetural — Docs-fantasma por setDoc merge

Documentado em `audit-results/pendencias-fase3-descobertas.md`.

Funções afetadas:
- `useColaboradores.salvarPct` em useColaboradores.ts (linha ~113-117)
- `useAlocacaoEmLote.salvarTodos` em useAlocacaoEmLote.ts (~159-185)
- Provavelmente outras `setDoc merge` em fechamentos/

Impacto identificado: 22 docs em 2026-01 e 2026-04

Recomendação: tratar este caso ao implementar Princípio 2
(validação antes de criar) ou Princípio 4 (sincronização
cross-coleção). Garantir que setDoc em snapshot só ocorre se
snapshot existe OU se faz copy de clientes_base/ antes.

Status: a corrigir em Fase 4 ou 5

### Dívida da rodada offshore

Snapshots de fechamentos/*/clientes/ ainda têm `nome_cliente`
antigo para Kevin e Tamires (não foram atualizados na rodada de
limpeza offshore — só o clientes_base/ foi). Decisão 1b acima
trata isso.

## Estado atual do Firestore

- `clientes_base/`: 84/84 com id_estavel ✓ (apply executado)
- `fechamentos/*/clientes/`: 0/438 com id_estavel (apply pendente)
- `fechamentos/*/colaboradores/`: 0/126 (pendente)
- `fechamentos/*/custosIndiretos/`: 0/25 (pendente)

## Arquivos importantes desta sessão

### Scripts criados (em scripts/)

- `adicionarIdEstavel.mjs` — migração de id_estavel
  (apenas clientes_base aplicado)
- `matchClientesFechamentos.mjs` — análise de match (read-only)
- `investigarDocsSemNome.mjs` — investigação dos 22 fantasmas
- `validarFantasmas.mjs` — validação dos docIds em clientes_base/

### Relatórios em audit-results/

- `fase-1-slug-final-{timestamp}.md` — Fase 1 final
- `fase-3-id-estavel-auditoria-2026-05-10T22-30-00.md` — auditoria 3A
- `fase-3-match-clientes-2026-05-10T22-50-11.md` — análise de match
- `fase-3-investigacao-sem-nome-2026-05-10T22-55-52.md` — bug arquitetural
- `fase-3-validacao-fantasmas-2026-05-10T23-06-49.md` — validação de match
- `pendencias-fase3-descobertas.md` — bug arquitetural documentado

### Snapshots Firestore em backups/firestore/

- `id-estavel-2026-05-10T22-23-02-clientes_base.json` — dry-run
- `id-estavel-2026-05-10T22-31-26-clientes_base.json` — apply executado
- `id-estavel-2026-05-10T22-36-21-clientes_fechamentos.json` — dry-run

## Próximos passos quando retomar no Project

1. **Auditar decisões anteriores sobre colaboradores** (chats do
   Project) que possam conflitar com Fase 3 ou subsequentes
2. Validar se há conflito com Visão 2 ou com decisões 1b/2b
3. **Refatorar `scripts/adicionarIdEstavel.mjs` para Visão 2**
   (herdar id_estavel via match) para clientes_fechamentos
4. Aplicar com checkpoint humano
5. Repetir padrão para colaboradores_fechamentos (agrupar por nome)
6. Repetir padrão para custos_fechamentos (agrupar por descrição)
7. Sub-fase 3D (refatorar pontos de criação)
8. Sub-fase 3E (validação final)

## Documento dos 7 princípios

Conteúdo dos 7 princípios consolidados em
`docs/identidade-unificada-principios.md` (a criar se ainda não
existe — ver memória da sessão original).

## Sub-fase 3C — CONCLUÍDA (2026-05-10)

**Resultado da aplicação:**
- CONFIANTE: 406 ✓
- AMBÍGUO: 10 ✓ (Kevin → kevin_santos_lopes, Tamires → tamires_cassia_dias_de_britto)
- FANTASMA: 22 ✓ (recuperados via cross-ref docId)
- IRRECUPERÁVEL: 0 ✓
- Total: 438 docs
- Validação pós-write: 438/438 ✓
- Snapshot: backups/firestore/id-estavel-2026-05-10T23-41-12-clientes_fechamentos.json
- Relatório: audit-results/fase-3c-aplicacao-2026-05-10T23-41-13.md

**Pendências abertas (fora do escopo desta Sub-fase):**
- colaboradores_fechamentos: rodada futura (exige auditoria de
  regras de match por nome antes de executar)
- custosIndiretos_fechamentos: rodada futura (junto com colaboradores)
- Bug arquitetural #1 (docs-fantasma por setDoc merge): corrigir
  em Fase 4 ou Fase 5

**Próximo passo da Fase 3:**
Criar docs/identidade-unificada-principios.md consolidando
os 7 princípios aprovados da Etapa 2.
