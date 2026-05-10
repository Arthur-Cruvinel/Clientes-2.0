# Auditoria de docIds — fechamentos/{periodo}/colaboradores/

Gerado em 2026-05-10T21:28:50.246Z.

Total de documentos: **126**
Colaboradores únicos (docId distinto): **30**
Cobertura média: **4.2** períodos por colaborador

## Distribuição por categoria

| Categoria | Colaboradores únicos | Docs (todos os períodos) | Origem provável |
|---|---|---|---|
| hifen | 0 | 0 | UI manual via `slugificar` (separador `-`) |
| underscore | 0 | 0 | canônica `slug()` (separador `_`) |
| uuid | 30 | 126 | Excel import via `crypto.randomUUID()` |
| misto | 0 | 0 | manual exótico ou docId compostos com ambos |
| simples | 0 | 0 | nome de palavra única (sem espaço a normalizar) |

## Exemplos por categoria

### uuid (30 únicos)

- `0377a6f5-6d86-4cf8-a29d-5f159d9daba6` — "Julia Pereira" — 5 período(s)
- `075808b4-907e-43b7-bf5c-a3583450dc09` — "Giovanna Pargoli" — 5 período(s)
- `0b531fc7-2992-4a05-bca1-47cd9f5d62d0` — "Matheus Tripoli" — 1 período(s)
- `0d7d9c99-f803-4abc-a79c-13891bba5263` — "Priscilla Rocha" — 5 período(s)
- `1ec502f6-d070-4483-ab9d-35f48c1bdea1` — "Viviane Leal" — 5 período(s)

## Notas

- Auditoria read-only: nenhuma escrita feita.
- `slugificar` em `useColaboradores.ts` produz docIds com `-`. `crypto.randomUUID()` em `useUploadImport.ts:192` produz UUIDs.
- Esta auditoria suporta a decisão entre opções (a), (b) ou (c) na Sub-fase 1C — Grupo 2.