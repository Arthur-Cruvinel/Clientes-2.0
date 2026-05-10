# Sub-fase 1A — Auditoria detalhada de implementações de slug

Gerado em 2026-05-10T15-50-00. READ-ONLY.

## Sumário

- **14 implementações de slug canônico** (alvo de migração no Grupo 1)
- **1 implementação divergente** — `useColaboradores.ts` (Grupo 2, decisão pendente)
- **2 implementações escopo diferente** — exporters de filename (NÃO migrar)
- **6 normalizações inline para comparação** — não-slug (NÃO migrar; mantêm espaços ou usam UPPER)

Total de ocorrências encontradas: 23.

---

## Implementação canônica de referência

```typescript
nome.normalize('NFD')
  .replace(/[̀-ͯ]/g, '')   // ou /[̀-ͯ]/g — equivalente em runtime
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '');
```

A divergência entre `[̀-ͯ]` (escape unicode) e `[̀-ͯ]` (literal) é cosmética — produzem o mesmo regex em runtime, casando a mesma faixa de combining marks.

---

## Grupo 1 — Implementações CANÔNICAS (14 ocorrências em 13 arquivos)

### 1. `src/scripts/migrarClientesBase.ts:28-36`

Função: `slugify` (privada)

```typescript
function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo:
- linha 107: `const slug = slugify(nome);` (gera docId em `clientes_base/{slug}` no setDoc da linha 120)

---

### 2. `src/services/firebase.ts:689-700` (INLINE — não nomeada)

Função: anônima inline em `salvarClienteBase`

```typescript
export async function salvarClienteBase(cliente: Cliente): Promise<void> {
  const slug = (cliente.nome_cliente ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  try {
    await setDoc(doc(db, 'clientes_base', slug), cliente);
  } catch (error) {
    console.error('[Firebase] Erro ao salvar cliente_base:', error);
    throw error;
  }
}
```

Classificação: **CANÔNICA** (lógica idêntica, apenas inline em vez de função separada).

Pontos de uso: usado uma única vez, na própria função (linha 695, no `setDoc`).

Observação: este arquivo tem DUAS implementações canônicas distintas (esta inline + a função `clienteSlug` na linha 796 abaixo).

---

### 3. `src/services/firebase.ts:796-799`

Função: `clienteSlug` (privada)

```typescript
function clienteSlug(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo:
- linha 722: `const slug = clienteSlug(nomeCliente);` (em `salvarPerfilComplexidade`)
- linha 808: `const slug = clienteSlug(clienteNome);` (em `registrarAlteracao`)
- linha 822: `const slug = clienteSlug(clienteNome);` (em `buscarHistoricoAlteracoes`)

---

### 4. `src/services/revisao.ts:12-20`

Função: `slugify` (EXPORTADA)

```typescript
export function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo:
- linha 49: `const slug = slugify(nomeCliente);` (em `definirRevisaoCliente`)
- linha 86: `const slug = slugify(nomeCliente);` (em `definirRevisaoMes`)

⚠ Esta é a ÚNICA implementação canônica EXPORTADA do projeto. Em tese, todos os outros arquivos poderiam já estar importando dela, mas não fazem — cada um tem cópia local. **Após migração, remover o `export` daqui ou converter este arquivo em consumidor de `@/utils/slug`.**

---

### 5. `src/features/perfil/NovoClienteModal.tsx:26-29`

Função: `clienteSlug` (local)

```typescript
function clienteSlug(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA** (regex literal `[̀-ͯ]` equivale a `[̀-ͯ]` em runtime).

Pontos de uso no mesmo arquivo:
- linha 53: `const slug = clienteSlug(trimmed);` (uniqueness check + setDoc em `clientes_base/{slug}`)

---

### 6. `src/features/poupanca/DetalheLinhaEdit.tsx:20-23`

Função: `slugify` (local)

```typescript
function slugify(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo:
- linha 175: `const docId = ${slugify(r.nome_cliente)}_${r.ano}_${r.mes};` (updateDoc em `poupanca/{docId}`)

---

### 7. `src/features/poupanca/DetalheMetaLote.tsx:17-20`

Função: `slugify` (local)

```typescript
function slugify(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo:
- linha 51: `const slug = slugify(filtrados[0].nome_cliente);` (constrói docIds para batch updateDoc em `poupanca/`)

---

### 8. `src/features/poupanca/PoupancaMetaLote.tsx:22-25`

Função: `slugify` (local)

```typescript
function slugify(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo:
- linha 72: `slugify(...)` em `poupanca/${slug}_${r.ano}_${r.mes}` (updateDoc em batch)

---

### 9. `src/features/poupanca/import/useImportPoupanca.ts:152-155`

Função: `slugify` (local)

```typescript
function slugify(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo (múltiplos): usados para construir `poupanca/{slug}_{ano}_{mes}` em vários setDoc do hook (busca aproximada por `slugify(` retorna mais ocorrências — o pipeline de import é o consumidor mais intensivo).

---

### 10. `src/features/upload/GerenciarDados.tsx:56-59`

Função: `slugify` (declarada DENTRO do componente — function declaration aninhada)

```typescript
function slugify(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso: linha 345 — `const slug = slugify(cliente);` (em handler do componente).

⚠ Particularidade: declarada dentro do corpo do componente React, não no nível de módulo. Não muda a migração — basta mover o import para o topo e remover a função.

---

### 11. `src/features/upload/useUploadImport.ts:40-45`

Função: `slugify` (privada)

```typescript
/** Remove acentos, converte para snake_case. "João Silva" → "joao_silva" */
function slugify(nome: string): string {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo:
- linha 209: `const slug = slugify(String(item['nome_cliente'] ?? ''));` (gera docId em `clientes_base/`)
- linha 256: `const slug = slugify(String(item['nome_cliente'] ?? ''));` (gera docId em `poupanca/`)

---

### 12. `src/features/patrimonio/parsePatrimonioExcel.ts:23-26`

Função: `slugify` (local)

```typescript
function slugify(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
```

Classificação: **CANÔNICA**.

Pontos de uso no mesmo arquivo:
- linha 54: `const slug = slugify(nome);` (gera chave para mapeamento de patrimônio)

---

### 13. `src/features/poupanca/useRevisao.ts:29-35 e 41-47` (DUAS ocorrências INLINE)

Funções: anônimas inline (DUAS), idênticas, em callbacks separados

```typescript
// linhas 29-35 (em estaMarcado):
const slug = nomeCliente
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '');

// linhas 41-47 (em toggleCliente):
const slug = nomeCliente
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '');
```

Classificação: **CANÔNICA** (ambas idênticas).

Pontos de uso: cada uma é usada uma única vez — para verificar/manipular `clientesMarcados` Set (que armazena slugs).

⚠ Particularidade: 2 ocorrências inline no mesmo arquivo. Migração fica mais limpa — substituir as 2 por chamadas a `slug(nomeCliente)`.

---

### 14. `src/features/patrimonio/Patrimonio.tsx:47-49` (INLINE)

Função: anônima inline, ternário condicional

```typescript
const slug = c?.nome_cliente
  ? c.nome_cliente.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  : null;
```

Classificação: **CANÔNICA**.

Pontos de uso: linha 50 — passa `slug` para `usePatrimonioCrud(slug, c?.nome_cliente ?? null)`.

⚠ Particularidade: uma única expressão em uma linha (sem newlines internos). Migração: substituir por `c?.nome_cliente ? slug(c.nome_cliente) : null`.

---

## Grupo 2 — Implementação DIVERGENTE (1 ocorrência)

### 15. `src/features/colaboradores/useColaboradores.ts:45-48`

Função: `slugificar` (EXPORTADA)

```typescript
/** Slug ASCII p/ uso como id do documento Firestore. */
export function slugificar(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
```

Classificação: **DIVERGENTE**.

Diferenças vs canônica:
- Separador: usa `-` (hífen) em vez de `_` (underscore) — `replace(/\s+/g, '-')`
- Charset preservado: mantém `[a-z0-9-]` em vez de `[a-z0-9_]` — `replace(/[^a-z0-9-]/g, '')`
- Nome da função: `slugificar` (português) em vez de `slugify` (inglês)
- É a única exportada com nome diferente da canônica

Output divergente:
- canônica("João Silva") = `joao_silva`
- esta("João Silva") = `joao-silva`

Pontos de uso no mesmo arquivo:
- linha 126: `const id = novo.id ?? slugificar(novo.nome_colaborador);` — gera docId para `fechamentos/{periodo}/colaboradores/{id}` em `criarColaborador`

Pontos de uso EXTERNOS: nenhum encontrado (export interno ao módulo de colaboradores).

⚠ **Esta é a fonte do problema descrito no relatório anterior**: colaboradores criados pela UI ficam com slug-com-hífen (`joao-silva`), mas se importados via Excel viram UUID aleatório (do `escreverBatch` em `useUploadImport.ts:192`). Migrar esta para `slug` (canônica) muda apenas o formato de NOVOS colaboradores criados pela UI — não toca docs existentes em Firestore.

---

## Implementações ESCOPO DIFERENTE (NÃO migrar — uso para nome de arquivo)

### 16. `src/utils/exporters/exportExcel.ts:14-21`

```typescript
function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
```

Diferenças importantes:
- Usa `[^a-zA-Z0-9]+ → -` (qualquer não-alfanumérico vira hífen, não só espaço)
- Trim de hífens nas pontas: `^-+|-+$ → ''`
- `toLowerCase()` no FIM (depois das substituições)
- Não tem `replace(/[^a-z0-9_]/g, '')` final

Output: `slugify("Tamires Cássia D'Britto")` = `tamires-cassia-d-britto` (com hífens).

Uso: nomes de arquivo de download (Excel `.xlsx`):
- linha 258, 306, 357 — `salvarWorkbook(wb, "${slugify(...)}_aum_${Date.now()}.xlsx")`

**Não migrar** — propósito diferente (filenames precisam de hífens visualmente legíveis, não snake_case).

### 17. `src/utils/exporters/exportPdf.ts:427-432` (INLINE)

```typescript
const slugNome = nomeCliente
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();
doc.save(`${slugNome}_aum_${Date.now()}.pdf`);
```

Mesma lógica do exportExcel — **escopo filename**, não migrar.

---

## Normalizações inline para COMPARAÇÃO (NÃO são slug — NÃO migrar)

Estas normalizam nomes para casamento fuzzy, mas **mantêm espaços** (como single space ou UPPER) e **não removem caracteres** — não geram identificador estável. Não são alvo desta refatoração.

### 18. `src/services/firebase.ts:374-375` (em `renomearColaborador`)
```typescript
const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
```
Comparação de NOME: lowercase + colapsa espaços (mantém espaços).

### 19. `src/services/firebase.ts:845-846` (em `corrigirNomeClientePoupanca`)
```typescript
const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
```
Comparação de NOME: só lowercase + trim. Não remove caracteres.

### 20. `src/services/aumIntegration.ts:122`
```typescript
const nomeNormalizado = ((data.nome_cliente as string) ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
```
Comparação cross-source: UPPER + trim. Mantém espaços.

### 21. `src/utils/financials.custos.ts:179-184` (em `calcularCustoDiretoCliente`)
```typescript
const normalize = (s: string): string =>
  s.normalize('NFD')
   .replace(/[̀-ͯ]/g, '')
   .toLowerCase()
   .trim()
   .replace(/\s+/g, ' ');
```
Lookup cliente↔colaborador no motor: lowercase + colapsa espaços. Mantém espaços.

### 22. `src/state/AppContext.tsx:176-177` (em `carregarPeriodo`)
```typescript
const normNome = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
```
Detecção de Pure Asset: UPPER + trim. Mantém espaços.

### 23. `src/features/poupanca/usePoupanca.ts:906`
```typescript
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
```
Casamento `clientes_base/` × `poupanca/` no MM6: lowercase + trim. Mantém espaços.

---

## Tabela-resumo

| # | Arquivo | Linhas | Tipo | Classificação | Pontos de uso |
|---|---|---|---|---|---|
| 1 | `scripts/migrarClientesBase.ts` | 28-36 | função | CANÔNICA | 1 (linha 107) |
| 2 | `services/firebase.ts` | 689-693 | inline | CANÔNICA | 1 (mesmo bloco) |
| 3 | `services/firebase.ts` | 796-799 | função | CANÔNICA | 3 (722, 808, 822) |
| 4 | `services/revisao.ts` | 12-20 | função (export) | CANÔNICA | 2 (49, 86) |
| 5 | `features/perfil/NovoClienteModal.tsx` | 26-29 | função | CANÔNICA | 1 (53) |
| 6 | `features/poupanca/DetalheLinhaEdit.tsx` | 20-23 | função | CANÔNICA | 1 (175) |
| 7 | `features/poupanca/DetalheMetaLote.tsx` | 17-20 | função | CANÔNICA | 1 (51) |
| 8 | `features/poupanca/PoupancaMetaLote.tsx` | 22-25 | função | CANÔNICA | 1 (72) |
| 9 | `features/poupanca/import/useImportPoupanca.ts` | 152-155 | função | CANÔNICA | múltiplos |
| 10 | `features/upload/GerenciarDados.tsx` | 56-59 | função (interna) | CANÔNICA | 1 (345) |
| 11 | `features/upload/useUploadImport.ts` | 40-45 | função | CANÔNICA | 2 (209, 256) |
| 12 | `features/patrimonio/parsePatrimonioExcel.ts` | 23-26 | função | CANÔNICA | 1 (54) |
| 13a | `features/poupanca/useRevisao.ts` | 29-35 | inline | CANÔNICA | 1 |
| 13b | `features/poupanca/useRevisao.ts` | 41-47 | inline | CANÔNICA | 1 |
| 14 | `features/patrimonio/Patrimonio.tsx` | 47-49 | inline | CANÔNICA | 1 (50) |
| **15** | **`features/colaboradores/useColaboradores.ts`** | **45-48** | **função (export)** | **DIVERGENTE** | **1 (126)** |
| 16 | `utils/exporters/exportExcel.ts` | 14-21 | função | ESCOPO DIFERENTE | 3 (filenames) |
| 17 | `utils/exporters/exportPdf.ts` | 427-432 | inline | ESCOPO DIFERENTE | 1 (filename) |
| 18 | `services/firebase.ts` | 374-375 | inline | NORMALIZAÇÃO (não-slug) | comparação |
| 19 | `services/firebase.ts` | 845-846 | inline | NORMALIZAÇÃO (não-slug) | comparação |
| 20 | `services/aumIntegration.ts` | 122 | inline | NORMALIZAÇÃO (não-slug) | comparação |
| 21 | `utils/financials.custos.ts` | 179-184 | inline | NORMALIZAÇÃO (não-slug) | comparação |
| 22 | `state/AppContext.tsx` | 176-177 | inline | NORMALIZAÇÃO (não-slug) | comparação |
| 23 | `features/poupanca/usePoupanca.ts` | 906 | inline | NORMALIZAÇÃO (não-slug) | comparação |

---

## Plano de migração derivado da auditoria

**Grupo 1 (canônicas — 14 ocorrências em 13 arquivos):** migrar para `slug` de `@/utils/slug` em lote único após Sub-fase 1B.

Arquivos do Grupo 1 (lista única, deduplicada):
1. `src/scripts/migrarClientesBase.ts`
2. `src/services/firebase.ts` (DUAS substituições: inline em `salvarClienteBase` + função `clienteSlug`)
3. `src/services/revisao.ts` (REMOVER `export` — passa a importar)
4. `src/features/perfil/NovoClienteModal.tsx`
5. `src/features/poupanca/DetalheLinhaEdit.tsx`
6. `src/features/poupanca/DetalheMetaLote.tsx`
7. `src/features/poupanca/PoupancaMetaLote.tsx`
8. `src/features/poupanca/import/useImportPoupanca.ts`
9. `src/features/upload/GerenciarDados.tsx`
10. `src/features/upload/useUploadImport.ts`
11. `src/features/patrimonio/parsePatrimonioExcel.ts`
12. `src/features/poupanca/useRevisao.ts` (DOIS pontos inline)
13. `src/features/patrimonio/Patrimonio.tsx`

**Grupo 2 (DIVERGENTE — 1 ocorrência):** `useColaboradores.ts`. Decisão pendente entre 3 opções (a/b/c) após inspeção Firestore.

**Ignorar (escopo diferente):** `exportExcel.ts`, `exportPdf.ts`.

**Ignorar (não-slug):** 6 normalizações inline para comparação fuzzy de nomes.

---

Aguardando aprovação para Sub-fase 1B (criar `src/utils/slug.ts`).
