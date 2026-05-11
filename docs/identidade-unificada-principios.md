# Identidade unificada de entidades — princípios arquiteturais

**Data de aprovação:** 2026-05-10
**Status:** Aprovado pelo usuário na Etapa 2 da refatoração
**Escopo:** Cliente, Colaborador, Custo Indireto

## Contexto

A rodada de limpeza offshore (concluída em 2026-05-10) revelou um problema estrutural: módulos do sistema não compartilham identidade unificada. Casos como Kevin (cadastro com slug `kevin` mas movimentos AUM em `kevin_santos_lopes`) e Tamires são sintomas. A causa raiz é que cada coleção é um silo, sem validação cruzada nem fonte única de verdade.

Este documento define os princípios arquiteturais para resolver o problema de forma estrutural. Os 7 princípios foram aprovados pelo usuário na Etapa 2 da refatoração e guiam o plano de execução em fases.

Documentação operacional da execução: `docs/fase-3-implementacao-principios-tecnicos.md` (detalhes técnicos de implementação da Fase 3) e `docs/fase-3-progresso-2026-05-10.md` (estado de execução).

## Princípios

### [1] Fonte única de slug

`src/utils/slug.ts` é a única implementação de slugify no projeto. Todos os módulos importam dali. Underscore como separador padrão. A divergente de `useColaboradores.ts:45-48` (que usava hífen) foi eliminada.

**Decisão original:** havia 14 implementações idênticas espalhadas pelo código + 1 divergente em `useColaboradores.ts` (hífen em vez de underscore). Centralizar em fonte única, eliminar divergente.

**Status:** Fase 1 ✅ COMPLETA

### [2] Validação de existência antes de criar entidade em coleção secundária

Quando entidade não existe na coleção mestre durante import, sistema cria automaticamente com flag `cadastro_completo: false`. Demais campos vazios/default. Origem registrada em campo `origem` (`import_lamina`, `import_excel`, `ui_manual`). Badge visual "⚠ Incompleto" em todos os módulos enquanto flag for false. Equipe completa via UI; ao salvar primeiro update completo, flag vira true.

**Caso especial Pure Asset:** eliminar síntese in-memory em `AppContext.tsx`. Cliente que aparece em `poupanca/` sem cadastro é criado em `clientes_base/` com `pacote_servico: 'asset_only'` e `cadastro_completo: false`. Pure Asset deixa de ser anomalia in-memory e vira cadastro real persistido, editável.

**Caso especial Excel de colaborador:** Excel passa a gerar docId via slug do nome (igual UI), com merge se entidade já existe. Elimina conflito UUID vs slug (hoje UI usa slug, Excel usa UUID — mesma pessoa em canais diferentes gera dois docs distintos).

**Decisão original sobre criação automática vs cadastro manual:** durante a discussão, foram consideradas três opções (A — criação automática silenciosa, B — pausar import exigindo cadastro manual, C — criação automática com flag incompleto). Foi aprovada a opção C (mista) por oferecer praticidade do A com visibilidade do B.

**Status:** Fase 4 (não iniciada)

### [3] Coleção mestre para todas as entidades

Criar `colaboradores_base/` e `custosIndiretos_base/` análogas a `clientes_base/`. Coleção mestre guarda dados perenes; coleção por período guarda snapshots mensais. Cada criação ou edição passa pelo mestre primeiro.

Separação proposta:

**Para colaborador:**
- `colaboradores_base/{slug}` (mestre, perene): nome, cargo, função principal, alocável, salário-teto, banker, data admissão/demissão, histórico de reajustes
- `fechamentos/{periodo}/colaboradores/{slug}` (snapshot mensal): salário do mês, encargos calculados, dados que mudam mês a mês

**Para custo indireto:**
- `custosIndiretos_base/{slug}` (mestre): descricao_custo, tipo_custo, fornecedor, data início/fim de validade, valor padrão
- `fechamentos/{periodo}/custosIndiretos/{slug}` (snapshot mensal): valor mensal específico, observações do mês

**Estado atual:** apenas cliente tem coleção mestre (`clientes_base/`). Colaborador e Custo Indireto vivem só por período. Este princípio cria simetria entre as 3 entidades.

**Status:** Fase 2 (não iniciada)

### [4] Sincronização cross-coleção via batch quando entidade muda

Categorização de campos por estratégia de propagação:

- **Categoria A (sempre propagar):** nome, slug, sigla, status ativo. Atualiza em todas as coleções, todos os períodos.
- **Categoria B (propagar para abertos):** pacote de serviço, salário-teto, banker associado, fatores padrão, valor-padrão do custo. Atualiza só em períodos não fechados.
- **Categoria C (não propagar):** receita_fee do mês, salário recebido do mês, valor lançado do custo no mês, horas reativas do mês. Específico do snapshot, pertence ao mês.

**Período fechado é imutável por padrão.** Botão "reabrir período" explícito permite correção em casos excepcionais; ao reabrir, re-aplicar propagações pendentes via Categoria B.

**Decisão original sobre imutabilidade:** durante a discussão, foram consideradas três opções (1 — fechado totalmente imutável, 2 — propagação atinge fechados também, 3 — fechado imutável por padrão com botão reabrir). Foi aprovada a opção 3 (mista) para preservar auditoria sem perder a via de escape para correções legítimas.

**Padrão de referência:** função `renomearColaborador` em `services/firebase.ts:369-494` é o exemplo correto de propagação cross-coleção. Foi a única função no projeto que já implementava esse padrão de forma robusta. Servirá de modelo para a refatoração.

**Status:** Fase 5 (não iniciada)

### [5] DocId híbrido — id_estavel separado do docId

- `docId` visível = slug (legibilidade no console Firebase)
- campo `id_estavel` = UUID v4 (gerado uma vez, imutável)
- Referências cross-coleção usam `id_estavel`, nunca slug ou docId
- Renomear entidade: criar novo doc com slug novo, copiar todos os campos (incluindo `id_estavel`), deletar antigo

Aplicado às 3 entidades: cliente, colaborador, custo indireto.

**Visão 2 da identidade (decisão final):** `id_estavel` representa a entidade lógica (a pessoa, o cargo, o custo), não o documento Firestore. Snapshots em `fechamentos/` herdam o `id_estavel` da coleção mestre via match por nome. Para um mesmo colaborador que aparece em 5 períodos, todos os snapshots têm o mesmo `id_estavel`.

**Decisão original sobre estratégia:** durante a discussão, foram consideradas três opções (A — slug puro, B — UUID puro, C — sigla canônica, D — híbrido). Foi aprovada a opção híbrida (slug visível + id_estavel UUID) para combinar legibilidade de debug com estabilidade arquitetural. Esta decisão tem custo extra de implementação aceito conscientemente.

**Status:** Fase 3 — em andamento
- Sub-fase 3A (auditoria): ✅
- Sub-fase 3B (tipos TypeScript): ✅
- Sub-fase 3C parte 1 (`clientes_base/`): ✅
- Sub-fase 3C parte 2 (`clientes_fechamentos/`): em execução
- Sub-fase 3C partes 3 e 4 (colaboradores e custos): pendentes (aguardam auditoria de decisões anteriores sobre colaboradores)
- Sub-fases 3D (refatoração de pontos de criação) e 3E (validação final): pendentes

### [6] Diff explícito com preview em todos os imports

Wipe-and-replace silencioso é eliminado. Substituído por diff explícito:

1. Sistema lê coleção atual
2. Compara com Excel sendo importado (chave de comparação: `id_estavel`)
3. Mostra preview classificado em 3 grupos:
   - **Criar:** itens novos no Excel que não existem no banco
   - **Atualizar:** itens existentes com campo alterado (mostra antes/depois)
   - **Órfãos:** itens no banco que sumiram do Excel — usuário decide entre deletar, manter ou ignorar
4. Aplica em batch após confirmação

Aplicado às 3 entidades.

**Estado atual:** import de Excel de custos indiretos faz wipe-and-replace silencioso — apaga toda a coleção do período antes de gravar a nova. Se vier uma linha a menos no Excel, perde silenciosamente. Mesmo padrão em outros pontos.

**Decisão original:** aprovada a aplicação do diff explícito nas 3 entidades para padrão único de UX e coerência arquitetural com Princípio 5 (identidade durável via `id_estavel`).

**Status:** Fase 6 (não iniciada)

### [7] Cliente referencia colaborador por `id_estavel`

Substituir referência por nome literal nos 6 campos de função do cliente:

```typescript
// antes
cliente.consultoria_gestao = "Giovanna Pargoli"

// depois
cliente.consultoria_gestao_id = "uuid-da-giovanna"
cliente.consultoria_gestao_nome_cache = "Giovanna Pargoli"
```

Os 6 campos de função afetados:

- consultoria_gestao
- consultoria_planejamento
- consultoria_financeira
- operacional_financeiro
- serv_adm
- serv_aux_adm

Cache de nome (`*_nome_cache`) é atualizado automaticamente quando colaborador é renomeado, via Princípio 4 (sincronização cross-coleção).

**Estado atual:** cliente referencia colaborador apenas por nome literal (string). Renomear colaborador exige varredura completa para atualizar todas as referências em todos os clientes em todos os períodos (`renomearColaborador` faz isso). Qualquer divergência de nome (acento, abreviação, espaço) quebra a ligação.

**Decisão original:** aprovada a opção de referência por `id_estavel` em vez de manter por nome com sincronização forte. Razão: aproveitar o investimento do Princípio 5 (UUIDs já existem) para chaves estrangeiras formais; coerência arquitetural; eliminação de fragilidade.

**Migração:** varrer clientes existentes, fazer match por nome para vincular `id_estavel` correspondente. Casos sem match óbvio viram "ação humana necessária" (mesmo padrão da rodada offshore).

**Status:** Fase 7 (não iniciada — última do plano)

## Plano de execução em fases

Ordem natural baseada em dependências:

1. **Fase 1 — Princípio 1** (slug único) — independente, refatoração mecânica de baixo risco
2. **Fase 3 — Princípio 5** (id_estavel) — pré-requisito das Fases 4, 6, 7. **Executada antes da Fase 2** por decisão arquitetural: criar `id_estavel` em `clientes_base/` antes de propagar para `colaboradores_base/` e `custosIndiretos_base/` evita dupla migração de dados
3. **Fase 2 — Princípio 3** (coleções mestre) — pré-requisito da Fase 4. Cria `colaboradores_base/` e `custosIndiretos_base/` já com `id_estavel` herdado
4. **Fase 4 — Princípio 2** (validação + cadastro_completo) — depende de Fases 1, 2, 3
5. **Fase 5 — Princípio 4** (sincronização cross-coleção) — depende de Fases 2, 3
6. **Fase 6 — Princípio 6** (diff em imports) — depende de Fase 3 (`id_estavel` como chave de comparação)
7. **Fase 7 — Princípio 7** (refs por id) — última, depende de tudo

Cada fase tem auditoria + plano detalhado + sub-fases com checkpoint humano. Cada sub-fase tem dry-run obrigatório antes de qualquer apply, snapshot JSON antes de qualquer write, e validação pós-execução.

## Pendências relacionadas (de outras rodadas)

- Migração das siglas legacy (`'GABRIEL JESUS'`, `'GABRIEL PIPINO'` no formato com espaço) para convenção de 3 letras
- Backlog de siglas canônicas para 13 clientes em `clientes_base/` sem sigla
- Reimport das lâminas Mar-Abr/2026 para popular MLM offshore corretamente
- Melhoria do `ResolverSiglasModal` (associar sigla a cliente existente em vez de só criar entrada nova)
- Bug arquitetural de docs-fantasma por `setDoc merge` em `fechamentos/` (documentado em `audit-results/pendencias-fase3-descobertas.md`). Saneado pontualmente na Sub-fase 3C; correção definitiva planejada para Fase 4 ou 5

## Histórico

- 2026-05-10: Rodada de limpeza offshore concluída (correções do `resolverSigla`, limpeza de fantasmas, migração de duplicatas Kevin/Tamires)
- 2026-05-10: Princípios arquiteturais aprovados pelo usuário (Etapa 2)
- 2026-05-10: Fase 1 (Princípio 1) concluída
- 2026-05-10: Fase 3 (Princípio 5) iniciada — Sub-fases 3A, 3B, 3C parte 1 concluídas
