# Mapeamento de pontos de criação Firestore — preparação Sub-fase 3D

Gerado em 2026-05-11T19:25:35Z · análise **READ-ONLY** · nenhum arquivo modificado.

## Escopo

Coleções que receberam `id_estavel` na Sub-fase 3C:

1. `clientes_base/`
2. `fechamentos/*/clientes/`
3. `fechamentos/*/colaboradores/`
4. `fechamentos/*/custosIndiretos/`

Busca em `src/` por: `setDoc(`, `addDoc(`, `writeBatch(...)`, `batch.set(`.

---

## Glossário de classificação

| Símbolo | Significado |
|---|---|
| ✅ JÁ CORRETO | Gera/passa `id_estavel` em **toda** criação nova |
| ⚠️ PARCIAL | Propaga `id_estavel` se já existe no objeto-fonte, mas **não gera** quando ausente. Funciona para cópias entre períodos pós-3C; falha para criação realmente nova |
| ❌ AUSENTE | Nunca toca `id_estavel`. Criação aqui gera doc sem o campo |
| ➖ N/A | Update parcial em doc existente (merge). `id_estavel` não se aplica diretamente — mas pode acionar bug-de-fantasma (criar doc com merge sem id_estavel) |

> **Nota:** "PARCIAL" para cópias (copiarPeriodo, fecharPeriodo, copiar base anterior) significa que a propagação está correta **agora que** todos os docs-fonte já receberam `id_estavel` na Sub-fase 3C. O problema reaparece se algum dia uma nova entidade for criada via os pontos ❌ AUSENTE sem ser corrigida.

---

## Ponto 1 — `salvarClienteBase` em `services/firebase.ts:693`

- **Operação:** `setDoc`
- **Coleção alvo:** `clientes_base`
- **Contexto:**
  ```ts
  export async function salvarClienteBase(cliente: Cliente): Promise<void> {
    const slugCliente = slug(cliente.nome_cliente ?? '');
    try {
      await setDoc(doc(db, 'clientes_base', slugCliente), cliente);
  ```
- **id_estavel presente?** ⚠️ PARCIAL — grava o objeto `cliente` inteiro; se quem chama já populou `id_estavel`, propaga; senão grava sem.
- **Observação:** API genérica usada por `NovoClienteModal` (criação) e `EditarClienteModal` (update). Refatoração precisa gerar UUID v4 quando `cliente.id_estavel` for ausente, mantendo o existente quando já presente (idempotência).

---

## Ponto 2 — ETL Excel inicial (clientes_base) em `features/upload/useUploadImport.ts:252`

- **Operação:** `setDoc` (loop)
- **Coleção alvo:** `clientes_base`
- **Contexto:**
  ```ts
  const promises = chunk.map(item => {
    const slugCliente = slug(String(item['nome_cliente'] ?? ''));
    const docRef = doc(db, 'clientes_base', slugCliente);
    return setDoc(docRef, sanitizeDoc(item));
  });
  ```
- **id_estavel presente?** ❌ AUSENTE — `sanitizeDoc(item)` propaga apenas colunas do Excel; template v23 não tem coluna `id_estavel`.
- **Observação:** ETL roda uma vez por importação. Refatoração: detectar via `getDoc` se já existe (e reusar id_estavel) ou gerar UUID novo. Padrão "Diff explícito" da Fase 6 vai cobrir isso; até lá, gerar UUID para os novos sem mexer nos antigos.

---

## Ponto 3 — Migração one-shot em `scripts/migrarClientesBase.ts:111`

- **Operação:** `setDoc` (loop)
- **Coleção alvo:** `clientes_base`
- **Contexto:**
  ```ts
  return setDoc(doc(db, 'clientes_base', slugCliente), dados)
    .then(() => { resultado.sucesso++; })
  ```
- **id_estavel presente?** ❌ AUSENTE — script de migração 2025-12 → clientes_base não gera nem propaga.
- **Observação:** Script one-shot já executado em produção. Os 49 docs criados receberam `id_estavel` posteriormente via `npm run id-estavel:apply` (Sub-fase 3C parte 1). Refatorar mesmo assim para que reexecuções (se houverem) saiam corretas — opcional pela natureza one-shot.

---

## Ponto 4 — `NovoClienteModal` (UI cadastro manual) em `features/perfil/NovoClienteModal.tsx:81-82`

- **Operação:** `salvarClienteBase` (→ setDoc) + `setDoc` direto no período
- **Coleção alvo:** `clientes_base` + `fechamentos/{periodo}/clientes`
- **Contexto:**
  ```tsx
  const novo: Cliente = {
    nome_cliente: trimmed,
    // ... pct_*: 0, data_entrada, etc.
  };
  await salvarClienteBase(novo);
  await setDoc(doc(db, 'fechamentos', periodo, 'clientes', slugCliente), novo);
  ```
- **id_estavel presente?** ❌ AUSENTE — objeto `novo` construído inline sem `id_estavel`.
- **Observação:** UI de cadastro manual. **Ponto crítico** da Sub-fase 3D: aqui se gera o id_estavel uma vez e propaga para ambos os destinos (mestre + snapshot do período). Adicionar `id_estavel: crypto.randomUUID()` na construção de `novo`.

---

## Ponto 5 — `salvarPct` (merge parcial) em `features/colaboradores/useColaboradores.ts:108-112`

- **Operação:** `setDoc` com `merge: true`
- **Coleção alvo:** `fechamentos/{periodo}/clientes`
- **Contexto:**
  ```ts
  await setDoc(
    doc(db, 'fechamentos', periodoSelecionado, 'clientes', cliente.id),
    { [`pct_${funcao}`]: valor },
    { merge: true },
  );
  ```
- **id_estavel presente?** ➖ N/A — payload só carrega `pct_*`.
- **Observação:** **Bug arquitetural do CLAUDE.md** — `merge: true` cria doc-fantasma se o snapshot não existe no período. Já documentado em `audit-results/pendencias-fase3-descobertas.md`. Quando aciona criação, doc nasce sem `id_estavel`. Solução real: validar existência prévia (Fase 4 — Princípio 2) ou bootstrappar id_estavel a partir do `clientes_base/` antes do merge.

---

## Ponto 6 — `salvarTodos` (Alocação em Lote) em `features/perfil/useAlocacaoEmLote.ts:181-185`

- **Operação:** `batch.set` com `merge: true`
- **Coleção alvo:** `fechamentos/{periodo}/clientes`
- **Contexto:**
  ```ts
  batch.set(
    doc(db, 'fechamentos', periodoSelecionado, 'clientes', cli.id),
    { [k]: novo },
    { merge: true },
  );
  ```
- **id_estavel presente?** ➖ N/A — payload só carrega `pct_*`.
- **Observação:** Mesmo bug arquitetural de docs-fantasma do Ponto 5 (mas em lote). Mesma correção: validar existência prévia ou bootstrappar id_estavel via lookup em `clientes_base/`.

---

## Ponto 7 — "Copiar base anterior" em `features/visao-geral/VisaoGeral.tsx:113-119`

- **Operação:** `batch.set` (sem merge)
- **Coleção alvo:** `fechamentos/{periodoSelecionado}/clientes`
- **Contexto:**
  ```ts
  for (let i = 0; i < clientesAnterior.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const c of chunk) {
      const slug = c.id ?? c.nome_cliente.toLowerCase()...;
      batch.set(firestoreDoc(db, 'fechamentos', periodoSelecionado, 'clientes', slug),
                c as unknown as Record<string, unknown>);
    }
    await batch.commit();
  }
  ```
- **id_estavel presente?** ⚠️ PARCIAL — passa o objeto `c` inteiro; `id_estavel` propaga se o snapshot-fonte já tem (sempre tem pós-3C).
- **Observação:** Cópia entre períodos. Correto agora que todos os snapshots-fonte têm `id_estavel`. Risco residual: se o slug inline (`c.nome_cliente.toLowerCase().replace(/\s+/g, '_')`) divergir do `slug()` canônico de `src/utils/slug.ts` (Fase 1), pode criar doc duplicado em outra chave. Vale alinhar com a função canônica.

---

## Ponto 8 — `fecharPeriodo` em `services/firebase.ts:763`

- **Operação:** `batch.set` (sem merge)
- **Coleção alvo:** `fechamentos/{periodo}/clientes` (a partir de `clientes_base/`)
- **Contexto:**
  ```ts
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of chunk) {
      const destRef = doc(db, 'fechamentos', periodo, 'clientes', d.id);
      batch.set(destRef, d.data());
    }
    await batch.commit();
  }
  ```
- **id_estavel presente?** ⚠️ PARCIAL — copia integralmente `d.data()`; `id_estavel` propaga pois `clientes_base/` já tem (100% pós-3C parte 1).
- **Observação:** Operação de fechamento de período. Correto pós-3C. Não exige refatoração nesta sub-fase.

---

## Ponto 9 — `copiarPeriodo` em `services/firebase.ts:557`

- **Operação:** `batch.set` (sem merge)
- **Coleção alvo:** `fechamentos/{periodoDestino}/{colaboradores | custosIndiretos | clientes}` (todas as 3 sub-collections)
- **Contexto:**
  ```ts
  for (const e of etapas) {  // colaboradores, custosIndiretos, clientes
    const snap = await getDocs(collection(db, 'fechamentos', periodoOrigem, e.sub));
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) {
        batch.set(doc(db, 'fechamentos', periodoDestino, e.sub, d.id), d.data());
      }
      await batch.commit();
    }
  }
  ```
- **id_estavel presente?** ⚠️ PARCIAL — copia integral; propaga se origem já tem (sempre pós-3C).
- **Observação:** Cobre as 3 sub-collections de uma vez. Pós-3C, todos os snapshots-fonte têm `id_estavel`. Não exige refatoração imediata.

---

## Ponto 10 — `salvarColaboradorPeriodo` em `services/firebase.ts:79`

- **Operação:** `setDoc`
- **Coleção alvo:** `fechamentos/{anoMes}/colaboradores`
- **Contexto:**
  ```ts
  export async function salvarColaboradorPeriodo(
    anoMes: string, colaborador: Colaborador,
  ): Promise<void> {
    if (!colaborador.id) throw new Error('Colaborador sem id — impossível salvar.');
    try {
      await setDoc(doc(db, 'fechamentos', anoMes, 'colaboradores', colaborador.id), colaborador);
  ```
- **id_estavel presente?** ⚠️ PARCIAL — grava objeto `colaborador` inteiro; propaga se caller já tem; não gera quando ausente.
- **Observação:** API consumida por `salvarFolha` e `criarColaborador` em `useColaboradores`. Refatoração: gerar UUID quando `colaborador.id_estavel` ausente. Operação dual: pode ser **criação** (criarColaborador) ou **update** (salvarFolha) — em update, preservar id_estavel existente do snapshot.

---

## Ponto 11 — `criarColaborador` em `features/colaboradores/useColaboradores.ts:125`

- **Operação:** `salvarColaboradorPeriodo` (→ setDoc) (callsite)
- **Coleção alvo:** `fechamentos/{periodo}/colaboradores`
- **Contexto:**
  ```ts
  const criarColaborador = useCallback(async (novo: Colaborador) => {
    if (!periodoSelecionado) throw new Error('Selecione um período antes de criar.');
    if (!novo.nome_colaborador?.trim()) throw new Error('Nome obrigatório.');
    const id = novo.id ?? slug(novo.nome_colaborador);
    if (colaboradoresValidos.some(c => c.id === id || ...)) throw new Error('...');
    setSalvando(true);
    try { await salvarColaboradorPeriodo(periodoSelecionado, { ...novo, id }); recarregar(); }
  ```
- **id_estavel presente?** ❌ AUSENTE — objeto `novo` construído pela UI sem `id_estavel`.
- **Observação:** UI de criação manual de colaborador. **Ponto crítico** da 3D para colaboradores. Adicionar `id_estavel: crypto.randomUUID()` no payload spread.

---

## Ponto 12 — `salvarFolha` em `features/colaboradores/useColaboradores.ts:96`

- **Operação:** `salvarColaboradorPeriodo` (→ setDoc) (callsite)
- **Coleção alvo:** `fechamentos/{periodo}/colaboradores`
- **Contexto:**
  ```ts
  const salvarFolha = useCallback(async (atualizado: Colaborador) => {
    if (!periodoSelecionado) return;
    setSalvando(true);
    try { await salvarColaboradorPeriodo(periodoSelecionado, atualizado); recarregar(); }
  ```
- **id_estavel presente?** ⚠️ PARCIAL — propaga se `atualizado` já tem (sempre pós-3C); update normal preserva.
- **Observação:** Edição via modal de Folha. Caso de **update**, não criação. Quando o snapshot já tem id_estavel (cenário atual pós-3C), nada quebra. Risco: se o objeto `atualizado` for construído sem incluir o `id_estavel` do snapshot original, sobrescreve com undefined → `setDoc` apaga campo. **Verificar** se `AppContext` carrega `id_estavel` no objeto Colaborador e a UI preserva no save.

---

## Ponto 13 — ETL Excel (colaboradores) em `features/upload/useUploadImport.ts:237-238`

- **Operação:** `escreverBatch('colaboradores')` (→ `batch.set` em loop com `crypto.randomUUID()` como docId)
- **Coleção alvo:** `fechamentos/{periodo}/colaboradores`
- **Contexto:**
  ```ts
  for (const item of chunk) {
    const docRef = doc(ref, crypto.randomUUID());
    batch.set(docRef, sanitizeDoc(item));
  }
  ```
- **id_estavel presente?** ❌ AUSENTE — gera UUID v4 para o **docId**, mas não para `id_estavel` no payload.
- **Observação:** Inconsistente com o pacto pós-3C (docId visível = slug, id_estavel = UUID separado). Aqui o docId já é UUID — quebra o Princípio 5 que prevê docId = slug legível + id_estavel separado. Refatoração 3D dupla aqui: (a) mudar docId para `slug(item.nome_colaborador)` e (b) adicionar `id_estavel: crypto.randomUUID()` no payload.

---

## Ponto 14 — ETL Excel (custosIndiretos) em `features/upload/useUploadImport.ts:264-265`

- **Operação:** `escreverBatch('custosIndiretos')` (→ `batch.set` com `crypto.randomUUID()` como docId)
- **Coleção alvo:** `fechamentos/{periodo}/custosIndiretos`
- **Contexto:** Mesma função `escreverBatch` do Ponto 13.
- **id_estavel presente?** ❌ AUSENTE — mesmo problema do Ponto 13.
- **Observação:** Mesma refatoração dupla: (a) docId = `slug(item.descricao_custo)` (b) `id_estavel: crypto.randomUUID()`.

---

## Sumário de classificação

| # | Arquivo | Coleção alvo | Classificação |
|---|---|---|---|
| 1 | `services/firebase.ts:693` (salvarClienteBase) | clientes_base | ⚠️ PARCIAL |
| 2 | `features/upload/useUploadImport.ts:252` (ETL) | clientes_base | ❌ AUSENTE |
| 3 | `scripts/migrarClientesBase.ts:111` (one-shot) | clientes_base | ❌ AUSENTE |
| 4 | `features/perfil/NovoClienteModal.tsx:81-82` (UI manual) | clientes_base + clientes_fech | ❌ AUSENTE |
| 5 | `features/colaboradores/useColaboradores.ts:108` (salvarPct) | clientes_fech | ➖ N/A (bug-fantasma) |
| 6 | `features/perfil/useAlocacaoEmLote.ts:181` (salvarTodos) | clientes_fech | ➖ N/A (bug-fantasma) |
| 7 | `features/visao-geral/VisaoGeral.tsx:113-119` (copiar base) | clientes_fech | ⚠️ PARCIAL |
| 8 | `services/firebase.ts:763` (fecharPeriodo) | clientes_fech | ⚠️ PARCIAL |
| 9 | `services/firebase.ts:557` (copiarPeriodo) | clientes_fech + colab_fech + custos_fech | ⚠️ PARCIAL |
| 10 | `services/firebase.ts:79` (salvarColaboradorPeriodo) | colaboradores_fech | ⚠️ PARCIAL |
| 11 | `features/colaboradores/useColaboradores.ts:125` (criarColaborador) | colaboradores_fech | ❌ AUSENTE |
| 12 | `features/colaboradores/useColaboradores.ts:96` (salvarFolha) | colaboradores_fech | ⚠️ PARCIAL |
| 13 | `features/upload/useUploadImport.ts:237-238` (ETL colab) | colaboradores_fech | ❌ AUSENTE |
| 14 | `features/upload/useUploadImport.ts:264-265` (ETL custos) | custosIndiretos_fech | ❌ AUSENTE |

### Agregado por classificação

- ✅ JÁ CORRETO: **0 pontos**
- ⚠️ PARCIAL: **6 pontos** — propagação OK pós-3C, mas **não gera** quando ausente. Cópias entre coleções/períodos.
- ❌ AUSENTE: **6 pontos** — criação real sem id_estavel. **Foco da Sub-fase 3D.**
- ➖ N/A (merge parcial / bug-fantasma): **2 pontos** — exigem Princípio 2 (Fase 4) para correção definitiva.

---

## Recomendação de ordem de execução para Sub-fase 3D

Prioridade alta — pontos que CRIAM entidades novas (foco principal):

1. **Ponto 4 — `NovoClienteModal`** (UI cadastro cliente): adicionar `id_estavel: crypto.randomUUID()` no objeto `novo`.
2. **Ponto 11 — `criarColaborador`** (UI cadastro colaborador): adicionar `id_estavel: crypto.randomUUID()` no spread.
3. **Ponto 1 — `salvarClienteBase`** (helper genérico): defensive — gerar UUID se ausente, manter se existente.
4. **Ponto 10 — `salvarColaboradorPeriodo`** (helper genérico): mesma lógica defensiva.
5. **Ponto 2 — ETL `clientes_base`**: gerar UUID na importação (ou via diff do Princípio 6, na Fase 6).
6. **Ponto 13 — ETL colaboradores**: mudar docId para `slug(nome_colaborador)` e adicionar `id_estavel`.
7. **Ponto 14 — ETL custosIndiretos**: mudar docId para `slug(descricao_custo)` e adicionar `id_estavel`.

Prioridade baixa — pontos PARCIAIS já funcionais pós-3C:

8. Pontos 7, 8, 9 — cópias entre períodos. Já funcionam corretamente. Refatoração opcional para alinhar slugify (Ponto 7).
9. Ponto 12 — `salvarFolha`. Verificar se objeto Colaborador no AppContext já carrega `id_estavel` para evitar sobrescrita com undefined.

Fora do escopo 3D — exigem outras fases:

10. Pontos 5 e 6 — bug arquitetural de docs-fantasma. Correção definitiva via Princípio 2 (Fase 4).
11. Ponto 3 — script one-shot, já executado em produção. Refatorar apenas se for reexecutado.

---

## Bugs descobertos durante o mapeamento

### Bug A: ETL gera docId UUID em vez de slug (Pontos 13 e 14)

`escreverBatch` em `useUploadImport.ts:186` faz `doc(ref, crypto.randomUUID())` — gera **docId UUID** para colaboradores e custosIndiretos importados via Excel. Isso quebra o Princípio 5 ("docId visível = slug, id_estavel = UUID separado") e contradiz o Princípio 2 ("Excel passa a gerar docId via slug").

Sintoma observável: alguns docs em `fechamentos/*/colaboradores/` têm docId UUID v4 (visível nos artefatos da Sub-fase 3C parte 3 — `f656e3c3-eb8a-4050-b339-62c40e22ddf7`, `6fcc0862-5042-438e-95fe-e51a174b0f78`, `35f7fe61-031e-4548-ba3a-5fb742a4905b`, etc.) em vez de `slug(nome_colaborador)`. Foram aceitos por compatibilidade.

Decisão sugerida: Fase 3D **não** renomeia docs existentes (regra absoluta: NUNCA alterar docId). A correção é prospectiva — novos imports usam slug. Migração eventual dos docs antigos para slug é tópico da Fase 2 (`colaboradores_base/`) ou Fase 6 (diff de imports).

### Bug B: Slug inline divergente em "Copiar base anterior" (Ponto 7)

`VisaoGeral.tsx:116` usa `c.nome_cliente.toLowerCase().replace(/\s+/g, '_')` — fallback quando `c.id` é null. Não normaliza acentos nem remove `[^a-z0-9_]`, divergindo do `slug()` canônico de `src/utils/slug.ts`. Risco baixo se `c.id` for sempre populado, mas fallback pode criar docs em chaves divergentes (ex: `josé_da_silva` em vez de `jose_da_silva`).

Decisão sugerida: substituir o fallback inline pelo `slug()` canônico já existente. Mudança de 1 linha; baixo risco; cabe na 3D.

---

**Fim do mapeamento.**
