# Pendências e descobertas — Fase 3 (id_estavel)

Arquivo "vivo" que acumula bugs arquiteturais e pontos a tratar identificados durante a Fase 3 da refatoração de identidade. Cada item tem status próprio; itens fora do escopo da Fase 3 ficam aqui para Fases futuras.

---

## Bug arquitetural #1 — Docs-fantasma criados por `setDoc merge` sem cadastro base

**Identificado em:** Sub-fase 3C (investigação dos 22 docs `(sem nome)` em `fechamentos/*/clientes/`).

**Descrição:**

Dois pontos do código fazem `setDoc(merge: true)` em `fechamentos/{periodo}/clientes/{slug}` gravando **APENAS o campo `pct_funcao`** quando o usuário altera alocação:

1. `features/colaboradores/useColaboradores.ts:113-117` (`salvarPct`):

```ts
await setDoc(
  doc(db, 'fechamentos', periodoSelecionado, 'clientes', cliente.id),
  { [`pct_${funcao}`]: valor },
  { merge: true },
);
```

2. `features/perfil/useAlocacaoEmLote.ts:181-185` (`salvarTodos`):

```ts
batch.set(
  doc(db, 'fechamentos', periodoSelecionado, 'clientes', cli.id),
  { [k]: novo },
  { merge: true },
);
```

Quando o cliente ainda **não tem snapshot** em `fechamentos/{periodo}/clientes/`, o `merge: true` **cria** um doc novo com apenas aquele campo — sem `nome_cliente`, `pacote_servico`, `consultoria_*`, ou qualquer outro cadastral.

**Impacto identificado em produção:**

- 22 docs-fantasma em 2 períodos (11 em 2026-01, 11 em 2026-04)
- 11 clientes únicos afetados, cada um aparecendo em 2 períodos
- Cada doc-fantasma contém **APENAS** o campo `pct_operacional_financeiro` com valor real
- 100% dos slugs batem com `clientes_base/` (validação em `audit-results/fase-3-validacao-fantasmas-2026-05-10T23-06-49.md`)

**Causa raiz:**

Design intencional. Comentário inline em `useColaboradores.ts:111-112`:

> *"setDoc com merge cria o doc se inexistente no período — robusto a clientes recém-criados ou períodos sem fechamento copiado."*

A intenção era *robustez* (não falhar quando o snapshot ainda não foi copiado). Mas o efeito colateral é o doc órfão com 1 campo só. A "população posterior" que o comentário implicitamente assume **nunca acontece automaticamente** — depende de `fecharPeriodo` ou `copiarPeriodo` rodar depois, o que pode nunca ocorrer.

**Implicações para o motor financeiro:**

O motor (`processarPeriodo` em `utils/financials.pipeline.ts`) provavelmente IGNORA esses docs ou produz cálculos incorretos quando o cliente entra sem `pacote_servico`, `consultoria_*`, etc. — comportamento não-validado nesta investigação. **Sub-item para verificar futuramente.**

**Recomendação para próximas fases:**

Tratar este caso ao implementar:

- **Princípio 2 (validação antes de criar):** verificar se cliente existe em `clientes_base/` antes de gravar pct_funcao. Se não existir, erro. Se existir mas snapshot não existir em `fechamentos/`, **copiar clientes_base/{slug} → fechamentos/{periodo}/clientes/{slug} ANTES** do merge do pct_funcao.

- **Princípio 4 (sincronização cross-coleção):** garantir que `setDoc` em snapshot só ocorre se snapshot existe OU se faz `copy de clientes_base/` antes.

**Status:** a investigar / a corrigir em Fase 4 ou Fase 5.

**Tratamento interino (Fase 3):** os 22 docs serão recuperados ao mesmo tempo que recebem `id_estavel`, herdando `nome_cliente` e `id_estavel` de `clientes_base/{docId}`. **NÃO** é a correção do bug — apenas saneamento do estado atual para que a migração id_estavel funcione. O bug em si permanece para nova rodada.

---

## Manual operacional da Fase 3

- Arquivo pendente: `docs/fase-3-implementacao-principios-tecnicos.md`
- Conteúdo: regras operacionais e restrições de código da Fase 3
  (Visão 2, classificação CONFIANTE/AMBÍGUO/FANTASMA, restrições
  de write, slugify canônico, snapshot pré-write, formato de relatório)
- Como recuperar: conteúdo gerado no chat de planejamento de
  2026-05-11 (Project GAL · Plataforma), disponível no histórico
- Impacto: nenhum — não bloqueia execução das fases futuras

---

## Pendência Fase 5 — Suporte completo a `tipo_vinculo='estagio'` na UI

**Contexto:** Sub-etapa 2A.5.b ampliou o tipo `Colaborador.tipo_vinculo`
para incluir `'estagio'`. Para manter o build TypeScript funcionando
sem refatorar a UI agora (decisão consciente para manter momentum
no Ato 2), foram aplicados narrowings em 2 lugares (`ColaboradorCard`
e `FolhaTab`) que mapeiam `'estagio'` silenciosamente para `'clt'`.

**Trabalhos pendentes para Fase 5:**

1. `src/features/colaboradores/columns.ts:27` — expandir `COR_VINCULO`
   adicionando entrada `'estagio'` com cor própria.
2. `src/features/colaboradores/ColaboradorCard.tsx:20-22` — reverter
   narrowing, usar `tipo` direto após expansão de `COR_VINCULO`.
3. `src/features/colaboradores/FolhaTab.tsx:28` — expandir
   `FolhaForm.tipo_vinculo` de `'clt' | 'pro_labore'` para
   `'clt' | 'pro_labore' | 'estagio'`.
4. `src/features/colaboradores/FolhaTab.tsx:61, 92` — reverter
   narrowings, usar `tipo_vinculo` direto.
5. `src/features/colaboradores/FolhaTab.tsx:205-207` — adicionar
   opção `['estagio', 'Estágio']` no select, remover cast.
6. `src/features/colaboradores/ColaboradorModal.tsx:41` — revisar
   default; manter `'clt'` provavelmente OK, mas avaliar se há contexto
   onde deveria iniciar como `'estagio'` (ex: novo colaborador de
   estágio).
7. `src/features/upload/useUploadImport.ts` — adicionar suporte de
   parsing `'estagio'` no Excel se necessário.
8. Considerar campos visuais adicionais para estagiário (ex: data
   início do estágio, instituição de ensino, etc. — não obrigatório).

**Status:** pendência arquitetural conhecida, não bloqueia operação
atual (no Firestore não há colaborador com `tipo_vinculo='estagio'`
ainda — os 2 estagiários serão atualizados em sub-etapa 2A.5.d
e a UI continuará mostrando-os como CLT até refatoração da Fase 5).

---

## Pendência infraestrutura — duplicação de lógica de folha em scripts `.mjs`

**Origem:** Sub-etapa 2A.5.c (Fase 2 Ato 2A.5).

**Problema:** O script `scripts/corrigirTipoVinculo.mjs` replica inline a
lógica de `calcularFolhaColaborador` (`src/utils/financials.custos.ts`)
em vez de importar a função canônica. Também aplicável a outros
scripts em `scripts/` que façam recálculo de folha (verificar pelo
menos `scripts/seedFuncaoPrincipal.mjs`).

**Causa provável:** scripts `.mjs` (Node ESM puro) não importam diretamente
arquivos `.ts` (TypeScript) sem build intermediário. Solução adotada
foi duplicação inline da lógica.

**Estado atual:** tabelas INSS, IRRF, encargos patronais e fórmulas
estão sincronizadas entre função canônica e cópias nos scripts
(validado por amostragem na Sub-etapa 2A.5.c).

**Risco:** divergência futura silenciosa. Se alguém atualizar tabelas
fiscais ou regras de cálculo em `src/utils/financials.custos.ts` sem
auditar os scripts, motor financeiro e scripts de correção produzirão
resultados diferentes para o mesmo input.

**Mitigação imediata:** ao mexer em `calcularFolhaColaborador`, fazer
audit nos arquivos do diretório `scripts/` que façam recálculo de
folha. Procurar por palavras-chave: `TABELA_INSS`, `TABELA_IRRF`,
`DEDUCAO_DEPENDENTE_IRRF`, `REDUTOR_IR`, `encargos_patronais`.

**Resolução estrutural** (a decidir em Fase 5 ou após):

- (i) Migrar scripts para `.ts` + transpilação via `tsx` ou `ts-node`
- (ii) Extrair lógica de folha para módulo compartilhado em `.mjs`
  que tanto função canônica `.ts` quanto scripts `.mjs` importem
- (iii) Build intermediário que gere `.mjs` a partir de `.ts`

**Prioridade:** BAIXA enquanto tabelas estiverem sincronizadas.
Sobe para ALTA quando uma das tabelas fiscais for atualizada.

---
