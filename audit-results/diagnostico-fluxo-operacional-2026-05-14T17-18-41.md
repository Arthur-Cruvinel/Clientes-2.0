# Diagnóstico do fluxo operacional — pós Fase 2 Ato 2C

Gerado em **2026-05-14T17:18:41Z** · READ-ONLY puro · zero writes Firestore · zero modificações de código.

Objetivo: verificar se o usuário pode hoje executar o fluxo cadastrar colaboradores faltantes → propagar folha → cadastrar custos indiretos → ver resultado por cliente sem recriar as inconsistências que a Fase 2 acabou de resolver.

---

## Q1 — Cadastro de colaborador novo

**Caminho do código:** `useColaboradores.criarColaborador` (`src/features/colaboradores/useColaboradores.ts:118-133`) → `salvarColaboradorPeriodo` (`src/services/firebase.ts:78-91`).

**Onde grava:**

- `fechamentos/{periodoSelecionado}/colaboradores/{slug(nome)}` — **apenas neste período**.
- **Não existe coleção `colaboradores_base/`** — sem cadastro mestre. `grep -r "colaboradores_base"` no `src/` retornou zero matches. Os 21 colaboradores canônicos pós-Ato 2 vivem apenas como snapshots de período.

**Detalhes:**

| Pergunta | Resposta |
|---|---|
| a) Grava em base ou no snapshot? | Snapshot do período apenas — `fechamentos/{periodo}/colaboradores/{slug}` |
| b) Aparece em outros períodos? | **NÃO** — fica órfão. Para aparecer em outros meses, exige propagação manual (ver Q3) ou copiarPeriodo |
| c) docId | `slug(nome_colaborador)` — `useColaboradores.ts:121`. Bate com o esquema canônico instalado pelo Ato 2C |
| d) `funcao_principal` | **TEXT FREE** — `FolhaTab.tsx:199-200`. Campo só aparece em modo `'criar'`. Não valida contra `FUNCOES_PRINCIPAIS` (`constants.ts:217-225`). Usuário precisa digitar exatamente `consultoria_gestao`, `operacional_financeiro`, etc. |
| e) `tipo_vinculo` | Select `[clt, pro_labore]` — `FolhaTab.tsx:205-207`. **NÃO** oferece `'estagio'` (pendência Fase 5 conhecida — `pendencias-fase3-descobertas.md` itens 1–8) |

### VEREDITO Q1: RISCO — funciona, mas com 3 ressalvas operacionais

1. Colaborador novo só nasce no período atual; precisa rodar a "Propagar folha" para virar visível em outros meses.
2. Como `funcao_principal` é text free, um typo (`consultoria gestao` com espaço; `consultoriaGestao` em camelCase; sigla `Gestor`) faz o colaborador entrar mas sem casar em `FUNCOES_ALOCACAO` — o motor não considera as alocações `pct_*` e o custo direto vira 0. Cadastro inválido silencioso.
3. Estagiários precisam ser criados como `'clt'` ou `'pro_labore'` na UI; o sistema persiste como CLT mas o motor (`calcularFolhaColaborador`) trata `'estagio'` corretamente quando o campo já está no Firestore — o problema é apenas a UI não permitir digitar essa opção.

Os 3 itens não recriam a inconsistência da Fase 2 (docId continua slug; nome canônico preservado), mas exigem disciplina operacional.

---

## Q2 — Edição de colaborador existente

**Caminho do código:** `ColaboradorModal` modo `'editar'` → `FolhaTab.handleSalvar` → `onSalvarFolha` → `useColaboradores.salvarFolha` (`useColaboradores.ts:93-98`) → `salvarColaboradorPeriodo` → `setDoc(fechamentos/{periodo}/colaboradores/{id})`.

**Detalhes:**

| Pergunta | Resposta |
|---|---|
| a) Grava onde? | **Apenas no período atual** (`fechamentos/{periodo}/colaboradores/{id}`). Mesma fonte do criar |
| b) Edição propaga para outros períodos? | **NÃO** — só o período selecionado. Outros períodos só são atualizados via "Propagar folha…" (single-colab) ou "Propagar folha em massa" (todos) |
| c) Pode alterar `funcao_principal`? | **NÃO** — `FolhaTab.tsx:195` condiciona o bloco "Cadastro" (cargo + funcao_principal) a `modo === 'criar'`. Modo `'editar'` esconde esses campos. Para corrigir uma `funcao_principal` errada, hoje precisa ir direto ao Firestore Console |

**Cobertura especial — renomear nome do colaborador:** o nome em si É editável no modo `'editar'` (`FolhaTab.tsx:193`); quando muda, `ColaboradoresVisao` dispara o `RenomearColaboradorModal` que chama `renomearColaborador` (`firebase.ts:377`) — varre clientes em todos os períodos + clientes_base + colaboradores em todos os períodos. Mecanismo presente e validado.

### VEREDITO Q2: SEGURO HOJE

Mudanças de salário, líquido acordado, dependentes, percentuais, etc., são confiáveis. O usuário NÃO consegue corromper `funcao_principal` pela UI (gap de UX, mas no fluxo atual isso é uma proteção e não um risco).

---

## Q3 — Propagação de folha

**Caminho do código:**

1. `AplicarHistoricoTodos.aplicar` (`AplicarHistoricoTodos.tsx:78-95`) → `propagarFolhaColaborador(colaborador.id, ...)` (`firebase.ts:143-199`).
2. `PropagacaoEmMassa.aplicar` (`PropagacaoEmMassa.tsx:87-103`) → `propagarFolhaTodosColaboradores(...)` (`firebase.ts:244-335`).

**Como localiza o colaborador em cada período:**

| Função | Estratégia |
|---|---|
| `propagarFolhaColaborador` (single) | `getDocs(collectionGroup('colaboradores'))` + filtro `d.id === colaboradorId` — **match por docId** (`firebase.ts:154`) |
| `propagarFolhaTodosColaboradores` (massa) | Mesmo padrão: `collectionGroup('colaboradores')` indexado por `d.id` → mapa `colabId → Map(periodo → ref)` (`firebase.ts:272-278`) |
| `buscarPeriodosDoColaborador` | `collectionGroup('colaboradores')` + filtro `d.id === colaboradorId` (`firebase.ts:96-109`) |
| `buscarDadosFolhaPorPeriodo` | `getDoc(fechamentos/{periodo}/colaboradores/{c.id})` direto (`firebase.ts:206-227`) |
| `salvarHistoricoReajustes` | `doc(fechamentos/{periodo}/colaboradores/{colaboradorId})` direto (`firebase.ts:348`) |

**Coerência com a Fase 2 Ato 2C:** o relatório `fase2-ato2c-2026-04-aplicado-2026-05-14T14-49-05.md` confirma que dez/25, jan/26, fev/26, mar/26 e abr/26 foram reescritos com docId = `slug(nome_colaborador)` (21 docs canônicos × 5 períodos). O Ato 2C nomeia explicitamente `cintia_de_jesus_alves`, `flavia_santos_romeu`, `lucas_henrique`, etc. — todos slug, sem UUID. `useColaboradores.criarColaborador` também usa `slug(nome)` (linha 121). Convergência total.

**Riscos remanescentes:**

- **Períodos fora do range do Ato 2C** (qualquer coisa antes de dez/25 ou após abr/26) podem ter colaboradores com docId UUID. O período atual (mai/26) é o caso mais relevante — se a entrada se deu via `copiarPeriodo` partindo de abr/26 (já slug), também já está slug. Se veio de upload Excel antigo, está UUID.
- **Upload Excel** (`useUploadImport.escreverBatch`, linha 186) usa `crypto.randomUUID()` para o docId de TODA inserção. Qualquer import futuro de colaboradores vai **regredir o esquema** para o estado pré-Fase 2.

### VEREDITO Q3: FUNCIONA para os períodos cobertos pelo Ato 2C (dez/25–abr/26)

Riscos: (a) períodos fora desse range podem quebrar a propagação se ainda têm UUIDs; (b) usar Upload Excel para colaboradores RECRIA O PROBLEMA — não use essa rota até o `useUploadImport` ser corrigido para usar slug.

---

## Q4 — Bug arquitetural #1 (docs-fantasma via setDoc merge)

**Status do código:** **AINDA PRESENTE — não foi corrigido.**

**Locais ativos do bug:**

1. `useColaboradores.salvarPct` (`useColaboradores.ts:100-115`):
   ```ts
   await setDoc(
     doc(db, 'fechamentos', periodoSelecionado, 'clientes', cliente.id),
     { [`pct_${funcao}`]: valor },
     { merge: true },
   );
   ```
2. `useAlocacaoEmLote.salvarTodos` (`useAlocacaoEmLote.ts:178-186`):
   ```ts
   batch.set(
     doc(db, 'fechamentos', periodoSelecionado, 'clientes', cli.id),
     { [k]: novo },
     { merge: true },
   );
   ```

Ambos com comentário explícito reconhecendo a intenção de robustez (`merge: true cria o doc se inexistente no período`). É o mesmo padrão flagrado em `audit-results/pendencias-fase3-descobertas.md` (Bug arquitetural #1).

**Mitigações em vigor (nenhuma corrige a causa raiz):**

- AppContext (`AppContext.tsx:102-110`) tenta detectar período vazio + copiar do anterior automaticamente. Funciona quando o usuário entra primeiro no período vazio E o anterior tem dados. Não funciona se a alocação é a primeira ação no período.
- Pure Assets sintetizados em `AppContext.tsx:191-215` não recebem `id`, então `useAlocacaoEmLote.salvarTodos` os pula em `if (!cli.id)` (linha 168). Não geram fantasmas — mas qualquer cliente vindo de `clientes_base/` tem `id = slug` e cai no fluxo vulnerável.

### VEREDITO Q4: RECRIA INCONSISTÊNCIA quando alocação em lote roda num período sem snapshot copiado

Em fluxo normal (usuário entra no período → modal "Copiar do anterior" → faz alocação) não dispara. Em fluxo atalho (usuário pula a cópia e edita alocação direto) recria o problema dos 22 docs-fantasma resolvido na Fase 3.

---

## Q5 — Cadastro de custos indiretos

**Duas rotas distintas, ambas funcionais e independentes da estrutura de colaboradores:**

| Rota | Caminho | Persistência |
|---|---|---|
| **Upload Excel** | `UploadImport` → `useUploadImport.importar` (`useUploadImport.ts:262-269`) | Wipe-and-replace em `fechamentos/{periodo}/custosIndiretos`. DocId = `crypto.randomUUID()`. Substitui tudo do período |
| **Configurações → Custos Diretos** | `TabCustos` (`TabCustos.tsx`) → `useConfiguracoes.salvar` | Atualiza **parâmetros globais** em `parametros/global` (campos `custo_juridico_mensal`, `custo_conciliacao_mensal`). NÃO escreve em `fechamentos/{periodo}/custosIndiretos` |

**Detalhes:**

| Pergunta | Resposta |
|---|---|
| a) Onde grava? | Upload: `fechamentos/{periodo}/custosIndiretos`. TabCustos: `parametros/global` |
| b) Acoplado a colaboradores? | **NÃO** — pool independente. Custo institucional dos colaboradores é somado ao pool em runtime (`financials.custos.ts:270-274`), mas o cadastro do custo indireto em si não toca colaborador |
| c) Riscos conhecidos? | **Não há rota de UI para cadastrar UM custo indireto avulso direto no período.** Só via Upload Excel (substitui tudo) ou TabCustos (afeta jurídico/conciliação globais). Para inserir um novo item sem destruir os outros, hoje exige Firestore Console ou novo upload com lista completa |

### VEREDITO Q5: SEGURO HOJE — com restrição de fluxo

Funciona, mas o caminho mais granular (adicionar 1 custo sem mexer nos demais) não existe na UI. Para corrigir custos faltantes do mês atual o operador precisa: exportar lista atual, adicionar linha no Excel, reimportar — ou editar `parametros/global` se o custo for jurídico/conciliação.

---

## Q6 — Pipeline de resultado por cliente

**Caminho do código:** `AppContext.carregarPeriodo` (`AppContext.tsx:89-255`) → `processarPeriodo` (`financials.pipeline.ts:12-57`) → `calcularDRE` per cliente, com `calcularCustoDireto` (`financials.custos.ts:189-248`).

**Detalhes:**

| Pergunta | Resposta |
|---|---|
| a) Lê colaboradores de onde? | **Sempre** `fechamentos/{periodo}/colaboradores/` (`AppContext.tsx:122`). Clientes: `clientes_base/` se aberto, `fechamentos/{periodo}/clientes/` se fechado |
| b) De que campos depende o custo direto? | `pct_funcao × percentual_alocavel × custo_total_mensal`. Depende de: (i) `cliente[funcao]` apontando para um colaborador existente; (ii) `cliente.pct_funcao > 0`; (iii) `colaborador.percentual_alocavel`; (iv) `colaborador.custo_total_mensal` (recalculado em runtime via `calcularFolhaColaborador`) |
| c) Matching cliente↔colaborador | **Por NOME** — `calcularCustoDireto` (linha 219): `mapExato.get(nome) ?? mapNorm.get(normalize(nome))`. Normalização tolera acento/caixa/espaços. **NÃO usa `id_estavel`** apesar do princípio 7 estar no CLAUDE.md |
| d) Refs quebradas | Logs `[CustoDireto] Colaborador não encontrado` ocorrem quando o nome em `cliente[funcao]` não casa nem exato nem normalizado. "Flavia Santos" vs "Flávia Santos Romeu" é **nome incompleto**, não variação de grafia — a normalização não corrige. Esses clientes têm o custo direto da função correspondente IGNORADO (não somado) |

**Como o motor reage a refs quebradas (linhas 220-229):**

```ts
const colab = mapExato.get(nome) ?? mapNorm.get(normalize(nome));
if (!colab) {
  console.warn('[CustoDireto] Colaborador não encontrado: ...');
  naoEncontrados.push(...);
  continue;  // pula essa função, segue calculando as outras
}
```

Impacto: o custo direto do cliente fica **subestimado** (parcela da função quebrada é zero), o que **infla artificialmente o EBITDA** do cliente. O cliente aparece mais rentável do que é.

### VEREDITO Q6: DISTORCIDO — clientes com refs quebradas têm EBITDA inflado

Sem o número exato de quantos clientes têm refs quebradas (precisaria de query Firestore), os logs do console (`Flavia Santos`, `Vinicius Rodrigues`, `Lucas Silva`, `Cintia Alves`) sugerem que pelo menos 4 nomes referenciados nos clientes não casam com nenhum dos 21 colaboradores canônicos do Ato 2 — provavelmente nomes truncados que sobraram do período pré-Ato 2.

Saneamento sugerido (fora do escopo deste diagnóstico): rodar o `RenomearColaboradorModal` ou um script auxiliar para alinhar os 4 nomes truncados aos nomes canônicos.

---

## Q7 — Fluxo ponta a ponta

| Etapa | Classificação | Justificativa |
|---|---|---|
| **1 · Cadastrar colaboradores faltantes** | **RISCO** | `criarColaborador` grava com slug (Q1 OK) mas só no período atual. `funcao_principal` é text free — typo silencioso zera custo direto. Estagiário entra como CLT na UI (custo divergente do correto se o usuário não saber editar depois) |
| **2 · Propagar folha (single ou em massa)** | **SEGURO** dentro de dez/25–abr/26; **RISCO** para mai/26 e além se a entrada veio de upload Excel | Funções de propagação localizam por docId; Ato 2C deixou docIds = slug. Period novo criado via UI também usa slug. Period criado via Upload Excel usa UUID — quebra |
| **3 · Cadastrar custos indiretos faltantes** | **RISCO operacional, SEGURO tecnicamente** | Não há UI para adicionar UM item avulso ao período. Para o operador, opções viáveis são: (a) reimportar Excel com lista completa, (b) ajustar `parametros/global` se for jurídico/conciliação, (c) Firestore Console. Nada quebra a Fase 2; problema é só UX |
| **4 · Ver resultado (DRE) por cliente** | **RISCO — número não confiável** | Pipeline roda, mas custo direto está subestimado em N clientes com `cliente[funcao]` apontando para nome incompleto/desatualizado (Q6). EBITDA por cliente desses casos vai aparecer mais alto do que o real. Outros clientes (refs OK) saem corretos |

---

## Conclusão

**O que o usuário pode fazer com SEGURANÇA hoje:**

- Editar dados de folha (salário, líquido, dependentes, %) dos 21 colaboradores canônicos via modal Editar — Q2 OK.
- Propagar essas edições para outros períodos via "Propagar folha…" (single) ou "Propagar folha em massa" — Q3 OK dentro de dez/25–abr/26.
- Atualizar custos indiretos pelo Upload Excel (substitui tudo do período) ou parâmetros globais de jurídico/conciliação — Q5 OK.
- Consultar resultado por cliente — **com a ressalva** de que clientes com refs de colaborador quebradas (Q6) terão EBITDA inflado.

**O que está com RISCO (funciona mas pede disciplina):**

- Cadastrar colaborador novo (Q1): exige digitar `funcao_principal` exatamente como o enum (sem espaços, sem PT-BR), preferir CLT para estagiário (e editar depois no Firestore), e rodar propagação manual para os outros meses.
- Alocação em Lote / salvarPct (Q4): só fazer depois que o período tem snapshot copiado (`copiarPeriodo` ou Upload Excel rodou antes). O modal "Copiar do anterior" do AppContext cobre esse caso quando o usuário não pula.

**O que está BLOQUEADO ou recria a inconsistência da Fase 2:**

- **Usar Upload Excel para colaboradores** — o `useUploadImport.escreverBatch` (linha 186) usa `crypto.randomUUID()` para o docId. Isso quebra o Ato 2C imediatamente: o próximo upload reintroduz UUIDs nos snapshots. Não use até trocar para `slug(nome_colaborador)` como docId.
- **Confiar no EBITDA por cliente** sem antes corrigir as refs quebradas em `cliente[funcao]` — pelo menos 4 nomes truncados aparecem nos logs.

**Caminho mínimo para desbloquear, em ordem de prioridade:**

1. Sanear refs quebradas em `cliente[funcao]` (rodar `RenomearColaboradorModal` para `Flavia Santos → Flávia Santos Romeu`, etc.) — desbloqueia Q6.
2. Trocar `crypto.randomUUID()` por `slug(item.nome_colaborador)` em `useUploadImport.escreverBatch` quando a subcoleção for `colaboradores` — desbloqueia Q1/Q3 para fluxos futuros de import.
3. Adicionar campo SELECT (em vez de text) para `funcao_principal` no `FolhaTab` modo `'criar'` — desbloqueia Q1 contra typos.
4. Bug arquitetural #1 (Q4): substituir `setDoc merge` por uma operação que copia `clientes_base/{slug}` para `fechamentos/{periodo}/clientes/{slug}` antes de aplicar o `pct_funcao` — fecha o último vetor de docs-fantasma.

Nada disso bloqueia a operação imediata desde que o operador siga a disciplina acima. A Fase 2 Ato 2C resolveu o esquema dos colaboradores em produção; o que falta é blindar a UI para que novas operações não regridam.
