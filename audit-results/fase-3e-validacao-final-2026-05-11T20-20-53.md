# Sub-fase 3E — Validação final da Fase 3

Gerado em **2026-05-11T20:18:08Z** · análise **READ-ONLY** · nenhum arquivo modificado.

Fonte dos dados Firestore: `scripts/validarFase3.mjs` (saída JSON completa em `validar-output.json`).

---

## V1 — Cobertura de `id_estavel` no Firestore

| Coleção | Total | Ignorados (template) | Docs reais | Com `id_estavel` | Sem `id_estavel` | Cobertura |
|---|---:|---:|---:|---:|---:|---:|
| `clientes_base/` | 84 | — | 84 | **84** | 0 | **100,00 %** |
| `fechamentos/*/clientes/` | 438 | — | 438 | **438** | 0 | **100,00 %** |
| `fechamentos/*/colaboradores/` | 126 | 16 | 110 | **110** | 0 | **100,00 %** |
| `fechamentos/*/custosIndiretos/` | 25 | 0 | 25 | **25** | 0 | **100,00 %** |

**Resultado V1: ✅ APROVADO** — todos os docs reais nas 4 coleções têm `id_estavel`.

Os 16 docs ignorados em colaboradores correspondem aos templates documentados (LEGENDA, Cinza, Amarelo, À contratar × 5 períodos com ajustes pela auditoria 3C parte 3).

---

## V2 — Consistência cross-coleção (clientes)

Verificação: cada `id_estavel` em `fechamentos/*/clientes/` deve existir em algum doc de `clientes_base/`.

- Snapshots com `id_estavel` órfão: **0**
- 438 / 438 snapshots apontam para um `id_estavel` válido em `clientes_base/`.

**Resultado V2: ✅ APROVADO** — nenhum snapshot é órfão. Visão 2 do Princípio 5 está internamente consistente.

---

## V3 — Unicidade de `id_estavel` dentro de cada coleção

### V3.a — `clientes_base/` (unicidade direta)

Critério: nenhum `id_estavel` aparece em mais de um doc na coleção mestre.

- Duplicatas encontradas: **0**

### V3.b — `fechamentos/*/clientes/` (colisão por slug do nome)

Critério: o mesmo `id_estavel` não deve estar associado a dois nomes-canônicos distintos (slugs diferentes). É esperado e correto que o mesmo `id_estavel` apareça em múltiplos períodos do **mesmo** cliente.

- Colisões encontradas: **0**

### V3.c — `fechamentos/*/colaboradores/` (colisão por slug do nome)

Critério análogo ao V3.b para colaboradores.

- Colisões encontradas: **0**

### V3.d — `fechamentos/*/custosIndiretos/` (colisão por slug da descrição)

Critério análogo para custos indiretos.

- Colisões encontradas: **0**

**Resultado V3: ✅ APROVADO** — zero colisões em todas as coleções.

---

## V4 — Pontos de criação refatorados (código-fonte)

### V4.1 — `src/features/perfil/NovoClienteModal.tsx`

Linhas 62-64:
```tsx
const novo: Cliente = {
  // Princípio 5: id_estavel imutável gerado na criação. Propaga para
  // todos os snapshots em fechamentos/{periodo}/clientes/ via match.
  id_estavel: crypto.randomUUID(),
```

**Resultado:** ✅ — payload da UI de criação inclui `id_estavel`.

### V4.2 — `src/features/colaboradores/useColaboradores.ts` (criarColaborador)

Linhas 126-129:
```ts
// Princípio 5: id_estavel imutável gerado na criação. Propaga para
// todos os snapshots em fechamentos/*/colaboradores/ via match.
const id_estavel = novo.id_estavel ?? crypto.randomUUID();
await salvarColaboradorPeriodo(periodoSelecionado, { ...novo, id, id_estavel });
```

**Resultado:** ✅ — `id_estavel` gerado (ou reusado se já vier preenchido) no spread do payload.

### V4.3 — `src/services/firebase.ts` (salvarClienteBase)

Linhas 697-705:
```ts
 * Princípio 5 (geração defensiva): se o objeto não tiver `id_estavel`,
 * gera UUID v4 antes de gravar — garante que nenhum cliente nasça sem
 * identidade lógica por qualquer caminho de código.
 */
export async function salvarClienteBase(cliente: Cliente): Promise<void> {
  const slugCliente = slug(cliente.nome_cliente ?? '');
  const dados = cliente.id_estavel
    ? cliente
    : { ...cliente, id_estavel: crypto.randomUUID() };
```

**Resultado:** ✅ — geração defensiva. Preserva `id_estavel` existente (idempotência) e gera quando ausente.

### V4.4 — `src/services/firebase.ts` (salvarColaboradorPeriodo)

Linhas 74-84:
```ts
 * Princípio 5 (geração defensiva): se o objeto não tiver `id_estavel`,
 * gera UUID v4 antes de gravar — garante que nenhum doc nasça sem o campo
 * por qualquer caminho de código que chegue aqui.
 */
export async function salvarColaboradorPeriodo(
  anoMes: string, colaborador: Colaborador,
): Promise<void> {
  if (!colaborador.id) throw new Error('Colaborador sem id — impossível salvar.');
  const dados = colaborador.id_estavel
    ? colaborador
    : { ...colaborador, id_estavel: crypto.randomUUID() };
```

**Resultado:** ✅ — geração defensiva análoga.

### V4.5 — `src/features/visao-geral/VisaoGeral.tsx` (Bug B)

Linha 24: `import { slug } from '../../utils/slug';`

Linha 120: `const docId = c.id ?? slug(c.nome_cliente);`

**Resultado:** ✅ — `slug()` canônico de `src/utils/slug.ts` em vez do slugify inline divergente. Bug B corrigido.

**Resultado V4: ✅ 5/5 pontos aprovados.**

---

## V5 — Slug único (Fase 1)

### V5.1 — Existência do canônico

`src/utils/slug.ts` existe e exporta a função `slug(texto: string): string` única.

**Resultado:** ✅

### V5.2 — Busca por implementações inline alternativas

Busca em `src/` por:
1. Declarações `function (slug|slugify)\s*\(` ou `const (slug|slugify)\s*=`
2. Padrão de slugify inline `.normalize('NFD')` em cadeia com lowercase + replace

#### Outras declarações de função `slug`/`slugify` encontradas

| Arquivo | Linha | Natureza | Status |
|---|---:|---|---|
| `src/utils/slug.ts` | 27 | função canônica `slug(texto)` | ✅ ÚNICA |
| `src/utils/exporters/exportExcel.ts` | 16 | `function slugify(texto)` — filename-only, preserva hífens | ⚠️ exceção legítima documentada |
| `src/utils/exporters/exportPdf.ts` | 657, 768 | `const slug = periodoLabel.replace(/[\s/]/g, '_')` — sanitiza label, não é slug completa | ⚠️ exceção legítima (nome de arquivo) |
| `src/services/aumLegado.ts` | 40 | `const slug = clienteDoc.id` — variável local que **recebe** docId | ➖ não é função slugify (falso positivo do regex) |

#### Cadeias `.normalize('NFD')` encontradas (10 ocorrências)

Classificadas por uso semântico:

| Arquivo:Linha | Padrão | Categoria | Conflito? |
|---|---|---|---|
| `src/utils/slug.ts:29` | NFD + lowercase + `\s→_` + `[^a-z0-9_]→` | **slug canônico** | ÚNICO |
| `src/state/AppContext.tsx:177` | NFD + toUpperCase + trim | normalização para matching cross-source (documentado em CLAUDE.md) | NÃO |
| `src/services/aumIntegration.ts:122` | NFD + toUpperCase + trim | matching cross-source | NÃO |
| `src/utils/financials.custos.ts:180` | NFD + lowercase + trim + `\s→ ` (espaço simples) | matching colaborador→cliente | NÃO |
| `src/services/firebase.ts:383` | NFD + lowercase + trim + `\s→ ` (espaço simples) | match interno em `renomearColaborador` | NÃO |
| `src/services/firebase.ts:854` | NFD + lowercase + trim | match interno em renomeação de cliente | NÃO |
| `src/features/poupanca/usePoupanca.ts:906` | NFD + lowercase + trim | helper `norm` local para matching | NÃO |
| `src/utils/exporters/exportPdf.ts:571` | NFD + `[^a-zA-Z0-9]+→-` (preserva hífen) | filename PDF — exceção documentada | NÃO |
| `src/utils/exporters/exportExcel.ts:18` | NFD + `[^a-zA-Z0-9]+→-` (preserva hífen) | filename Excel — exceção documentada | NÃO |
| `src/utils/exporters/exportPdf.ts` (anteriormente removido) | — | — | — |

**Análise:**

- Há **1 implementação** da função slug canônica para docIds Firestore (`src/utils/slug.ts`).
- As 2 funções `slugify` em `exportExcel.ts` / `exportPdf.ts` são **exceções legítimas documentadas** no JSDoc de `slug.ts`:
  > "NÃO use para: nomes de arquivo de download (use a slugify específica de exportExcel.ts/exportPdf.ts, que preserva hífens p/ legibilidade)"
- As 7 cadeias `.normalize('NFD')` remanescentes são **normalizadores de matching cross-source**, semanticamente distintos de slug (mantêm espaços e/ou usam toUpperCase, sem filtrar `[^a-z0-9_]`). Função distinta, propósito distinto.

**Resultado V5: ✅ APROVADO** — função slug canônica é única para o propósito de docId Firestore. Exceções remanescentes têm propósitos semânticos distintos (filename, matching) e são documentadas.

---

## Resultado geral

| Verificação | Resultado |
|---|---|
| V1 — Cobertura Firestore (4 coleções) | ✅ APROVADO (100 % em todas) |
| V2 — Consistência cross-coleção (clientes) | ✅ APROVADO (0 órfãos) |
| V3 — Unicidade de `id_estavel` | ✅ APROVADO (0 duplicatas/colisões) |
| V4 — Pontos de criação refatorados | ✅ APROVADO (5/5) |
| V5 — Slug único | ✅ APROVADO |

### **APROVADO** — Fase 3 (Princípio 5 — `id_estavel`) concluída.

#### Cobertura final
- 657 documentos reais nas 4 coleções, todos com `id_estavel` UUID v4
- 16 docs de template em colaboradores corretamente classificados como IGNORADO
- 84 clientes lógicos compartilhando UUID entre mestre e snapshots
- 22 colaboradores únicos (1 UUID por colaborador, propagado em 110 snapshots)
- 5 custos indiretos únicos (1 UUID por custo, propagado em 25 snapshots)

#### Pontos abertos (fora do escopo da Fase 3)

Documentados explicitamente em `docs/fase-3-progresso-2026-05-10.md` ao final da seção Sub-fase 3D — Escopo definido:

1. **Bug A** (UUID como docId no Excel) — ETL Excel ainda gera docId UUID v4 para colaboradores e custosIndiretos. Adiado para Fase 4 (Princípio 2 — validação antes de criar) ou Fase 6 (diff explícito de imports).
2. **Bug Arquitetural #1** (docs-fantasma por `setDoc` com `merge: true` em snapshot inexistente) — pontos `salvarPct` (useColaboradores.ts) e `salvarTodos` (useAlocacaoEmLote.ts). Correção definitiva via Fase 4 (Princípio 2).
3. **ETL Excel sem `id_estavel`** (useUploadImport.ts pontos 2, 13, 14) — canal eventual/emergencial, sem fluxo primário hoje. Será revisto na Fase 6 (diff explícito).

Esses 3 pontos não comprometem a Fase 3: clientes e colaboradores criados via **UI** (canal primário declarado pela decisão de 2026-05-11) já nascem com `id_estavel`.

---

## Próximos passos sugeridos

1. **Fase 2 — Princípio 3** — criar `colaboradores_base/` e `custosIndiretos_base/` (símiles a `clientes_base/`), herdando os UUIDs já gerados na Sub-fase 3C partes 3 e 4.
2. **Fase 4 — Princípio 2** — validação de existência antes de criar entidade em coleção secundária + flag `cadastro_completo`. Resolve Bug Arquitetural #1 e Bug A.
3. **Fase 5 — Princípio 4** — sincronização cross-coleção via batch quando entidade muda.
4. **Fase 6 — Princípio 6** — diff explícito em imports (resolve ETL Excel sem `id_estavel`).
5. **Fase 7 — Princípio 7** — referências entre entidades por `id_estavel` em vez de nome.

---

**Fim da validação da Fase 3.**
