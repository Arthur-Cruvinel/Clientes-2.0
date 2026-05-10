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
