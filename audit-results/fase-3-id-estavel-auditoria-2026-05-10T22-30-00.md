# Sub-fase 3A — Auditoria de pré-condições para `id_estavel`

Gerado em 2026-05-10T22-30-00. READ-ONLY.

## 1. Contagem por coleção (estado atual)

| Coleção | Total | Com `id_estavel` | Sem (alvo da migração) |
|---|---:|---:|---:|
| `clientes_base/` | 84 | **0** | 84 |
| `fechamentos/*/clientes/` | 438 | **0** | 438 |
| `fechamentos/*/colaboradores/` | 126 | **0** | 126 |
| `fechamentos/*/custosIndiretos/` | 25 | **0** | 25 |
| **TOTAL** | **673** | **0** | **673** |

Nenhum doc no Firestore tem `id_estavel` ainda — confirmação esperada.

### Distribuição por período

**`fechamentos/*/clientes/`** (5 períodos, 438 docs):
- 2025-12: 83 · 2026-01: 94 · 2026-02: 83 · 2026-03: 83 · 2026-04: 95

**`fechamentos/*/colaboradores/`** (5 períodos, 126 docs, **30 colaboradores únicos**):
- 2025-12: 30 · 2026-01: 24 · 2026-02: 24 · 2026-03: 24 · 2026-04: 24

**`fechamentos/*/custosIndiretos/`** (5 períodos, 25 docs):
- todos os períodos: 5 cada

**Implicação para `copiarPeriodo` (relevante na Sub-fase 3D):** colaboradores se repetem em vários períodos (mesmo docId, dado clonado por `copiarPeriodo`). Cada um dos 30 colaboradores únicos receberá UM `id_estavel` que será preservado em todas as 5 cópias quando 3C rodar — portanto, na 3D, **`copiarPeriodo` não precisa de mudança** (ver §4 abaixo).

## 2. Tipos TypeScript afetados

Localização: `src/types/index.ts`. Nenhum dos 3 tipos tem campo `id_estavel`/`stable_id`/`uuid` ainda.

| Linha | Tipo | Campo `id` atual |
|---|---|---|
| 28 | `interface Cliente` | `id?: string;` |
| 177 | `interface Colaborador` | `id?: string;` |
| 255 | `interface CustoIndireto` | `id?: string;` |

Adicionar `id_estavel?: string` (opcional) é seguro — todas as 3 interfaces já têm pelo menos um campo opcional, então adicionar mais um não quebra construção literal nos consumers.

## 3. Pontos de criação — payload atual

### Cliente

#### 3.1 `features/perfil/NovoClienteModal.tsx:67-88` (UI manual)

Constrói objeto literal e chama `salvarClienteBase(novo)` + `setDoc(fechamentos/{periodo}/clientes/{slugCliente}, novo)`. Payload atual:

```ts
const novo: Cliente = {
  nome_cliente: trimmed,
  receita_fee, percentual_rebate_anual_onshore, percentual_rebate_anual_offshore,
  aliquota_impostos_rebate, utiliza_servico_juridico, utiliza_conciliacao,
  pacote_servico, pct_consultoria_gestao: 0, /* ...demais pct_*: 0 */,
  data_entrada: dataEntrada,
};
```

**Refatoração 3D:** adicionar `id_estavel: crypto.randomUUID()` ao objeto literal.

#### 3.2 `features/upload/useUploadImport.ts:244-260` (Excel import — bloco Clientes)

```ts
const promises = chunk.map(item => {
  const slugCliente = slug(String(item['nome_cliente'] ?? ''));
  const docRef = doc(db, 'clientes_base', slugCliente);
  return setDoc(docRef, sanitizeDoc(item));
});
```

**Refatoração 3D:** ANTES de `setDoc`, fazer `getDoc(docRef)` para preservar `id_estavel` se cliente já existe; gerar novo `crypto.randomUUID()` somente para clientes novos.

#### 3.3 `scripts/migrarClientesBase.ts:103-127` (one-shot script)

```ts
const limpo: Record<string, unknown> = {};
for (const [chave, valor] of Object.entries(data)) {
  if (!CAMPOS_CALCULADOS.has(chave) && chave !== 'id' && valor !== undefined) {
    limpo[chave] = valor;
  }
}
// ...
return setDoc(doc(db, 'clientes_base', slugCliente), dados);
```

**Refatoração 3D:** mesma lógica do upload — preservar `id_estavel` se já existe no destino, gerar novo se ausente. Como esse script já rodou em produção uma vez (commit `27dc84e`), a refatoração é defensiva para futuras execuções.

#### 3.4 `state/AppContext.tsx:190-215` (Pure Asset sintetizado)

In-memory, NÃO persistido. **Fora do escopo da Fase 3** (será refatorado em fase futura junto com persistência de Pure Asset).

#### 3.5 `features/poupanca/import/useImportPoupanca.ts` (poupanca/, não clientes_base/)

NÃO é alvo da Fase 3. Cria registros financeiros mensais em `poupanca/{slug}_{ano}_{mes}`, não cria entidade Cliente. Recebe `id_estavel` em fase futura se necessário.

### Colaborador

#### 3.6 `features/colaboradores/useColaboradores.ts:122-132` (`criarColaborador`)

```ts
const id = novo.id ?? slug(novo.nome_colaborador);
// ...
await salvarColaboradorPeriodo(periodoSelecionado, { ...novo, id });
```

`salvarColaboradorPeriodo` em `firebase.ts:73-83` faz `setDoc(fechamentos/{anoMes}/colaboradores/{colab.id}, colab)`.

**Refatoração 3D:** adicionar `id_estavel: crypto.randomUUID()` ao spread antes do `salvarColaboradorPeriodo`.

#### 3.7 `features/upload/useUploadImport.ts:235-238` (Excel import — bloco Colaboradores)

```ts
await wipeSubcollection(periodo, 'colaboradores');
await escreverBatch('colaboradores', preview.colaboradores as unknown as Record<string, unknown>[]);
```

`escreverBatch` em linha 175-194 faz `doc(ref, crypto.randomUUID())` — UUID já é gerado, mas como **docId**, não como campo `id_estavel`.

**Observação importante:** colaboradores criados via Excel já têm UUID como docId (vide auditoria de docids — 30/30 são UUIDs). Se o id_estavel for igual ao docId, é redundante. **Decisão necessária do usuário (recomendo perguntar antes da 3D):**
- (i) Geramos id_estavel **igual ao docId UUID** atual? Simples mas torna campo redundante para colaboradores criados via Excel.
- (ii) Geramos id_estavel **separado do docId** (segundo UUID novo)? Mantém princípio "docId visível, id_estavel referência cross-coleção" mesmo quando docId já é UUID.

A Sub-fase 3C (script de migração) precisa decidir antes — vou sinalizar de novo na entrega de 3C.

#### 3.8 `services/firebase.ts:537-567` (`copiarPeriodo`)

```ts
batch.set(doc(db, 'fechamentos', periodoDestino, e.sub, d.id), d.data());
```

Copia o doc INTEIRO via `d.data()` — **se o doc origem tem `id_estavel`, ele é preservado automaticamente**. Após a Sub-fase 3C rodar (todos os docs ganham id_estavel), nenhuma mudança em `copiarPeriodo` é necessária na Sub-fase 3D.

**Recomendação:** não tocar em `copiarPeriodo` na 3D. Adicionar comentário explicando que a preservação é automática via `d.data()`. Confirmação extra do usuário desnecessária por esse caminho — a única mudança seria documentação inline.

### Custo Indireto

#### 3.9 `features/upload/useUploadImport.ts:262-275` (Excel import — bloco custosIndiretos)

```ts
await wipeSubcollection(periodo, 'custosIndiretos');
await escreverBatch('custosIndiretos', preview.custosIndiretos as unknown as Record<string, unknown>[]);
```

Mesmo padrão dos colaboradores — `escreverBatch` gera UUID como docId. Mesma decisão (i) ou (ii) do colaborador se aplica aqui.

#### 3.10 `services/firebase.ts:copiarPeriodo` (mesma análise do colaborador)

Preservação automática via `d.data()`. Sem mudança necessária na 3D.

## 4. Pontos de leitura críticos

Procurei por padrões que poderiam quebrar com adição de campo opcional:

```
Object.keys(cliente)|Object.keys(colaborador)|Object.keys(custo)
Object.values(...)
JSON.stringify(...)  (em loop de validação)
hasOwnProperty
```

**Resultado:** zero matches em `src/`. Nenhum código valida estrutura estrita das 3 entidades. Adicionar `id_estavel?: string` é **completamente seguro** — TypeScript permite construção literal sem o campo (é opcional), e nenhum consumer compara o doc inteiro contra schema fechado.

Observação: `usePerfil.ts` usa `JSON.stringify(anterior) !== JSON.stringify(novo)` mas só sobre VALORES de campos individuais (em `CAMPOS_MONITORADOS`), não sobre objeto inteiro. Adicionar `id_estavel` não está em `CAMPOS_MONITORADOS`, então não vai gerar entrada de histórico — comportamento correto (id_estavel é imutável, não deveria gerar histórico).

## 5. Total esperado para a migração

Sub-fase 3C precisará adicionar `id_estavel` em **673 docs** distribuídos em 4 coleções:

- 84 em `clientes_base/`
- 438 em `fechamentos/*/clientes/`
- 126 em `fechamentos/*/colaboradores/`
- 25 em `fechamentos/*/custosIndiretos/`

Em batches de até 500 docs (limite do Firestore writeBatch), isso são ~3 batches por coleção.

## 6. Decisões pendentes do usuário (BLOQUEADORES PARA 3C)

### 6.1 Para Colaboradores e Custos Indiretos: id_estavel separado do docId UUID?

Hoje colaboradores (30 únicos) e custos (5 por período) já têm UUID como docId. Opções:

- **(i) `id_estavel` = docId atual:** copiar `d.id` para `data.id_estavel`. Trivial, mas o campo fica redundante para essas duas coleções.
- **(ii) `id_estavel` separado (UUID novo):** gerar UUID novo para o campo, distinto do docId. Mantém o princípio "docId visível, id_estavel = referência cross-coleção" mesmo quando docId já é UUID. Refencias futuras (ex: cliente referenciando colaborador) usam id_estavel.

**Recomendação:** opção (ii) — princípio fica claro e uniforme entre as 3 entidades. Mas o usuário decide.

### 6.2 Para `copiarPeriodo`: deixar inalterado?

Como `batch.set(doc(...), d.data())` preserva o doc inteiro, `id_estavel` é preservado automaticamente após 3C. **Recomendação:** não tocar em `copiarPeriodo` — apenas adicionar comentário inline na 3D documentando a preservação automática.

---

Aguardando aprovação para Sub-fase 3B (atualização de tipos TypeScript) + decisão sobre 6.1 e 6.2.
