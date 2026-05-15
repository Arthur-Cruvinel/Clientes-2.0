# Investigação Inicial — Correção de Siglas Órfãs na Poupança

Gerado em **2026-05-15T12:25:06Z**. Read-only puro: nenhum write em Firestore, nenhuma modificação em código de aplicação. Único arquivo criado: este relatório.

Fonte de dados:
- Firestore live: `poupanca/` (900 docs) + `clientes_base/` (84 docs)
- Código-fonte: estado atual do repo (último commit: `4086d7f` — *docs(plano): planos da Fase 2.5 (vínculos) e da correção de siglas órfãs*)
- Plano de referência: `docs/correcao-siglas-orfas-poupanca-plano.md`

---

## Ponto 1 — Consumidores de `poupanca/`

### Leituras agregadoras (alvo principal da Frente 2 — filtro de quarentena)

| # | Arquivo:linha | Papel | Filtros existentes |
|---|---|---|---|
| 1 | `src/features/poupanca/usePoupanca.ts:354` | Hook principal do módulo Poupança. Carrega `todosRegistros`, agrupa por cliente, calcula AUM, NNM, rentabilidade, séries históricas, projeções MM6, burn rate, meta. Alimenta `PoupancaTabela`, `PoupancaKpis`, `BurnRateModal`, `ProjecaoModal`, `PoupancaMetaChart`. | **Filtro de valor** (`usePoupanca.ts:489`): descarta se `\|pl\|+\|plIni\|+\|nnm\|+\|rent\| < R$ 1` — é filtro de "mês fantasma" pelo VALOR, não pelo estado. Nenhum filtro por estado. |
| 2 | `src/services/aumIntegration.ts:56` | Constrói `Map<nomeNormalizado, AumCliente>` por período. Fonte do `aumMap` no `AppContext`. **Crítico**: é o vetor pelo qual o órfão vira Pure Asset sintetizado e gera rebate fictício no DRE. | Nenhum filtro por estado. Filtra apenas por ano+mes do período solicitado (where). |
| 3 | `src/services/firebase.ts:625` (`buscarRegistrosPoupancaPorPeriodo`) | Query por (ano, mes). Chamada pelo `AppContext.carregarPeriodo` (linha 124) — alimenta `dadosPeriodo.registrosPoupanca` que vai para `processarPeriodo` (`financials.pipeline.ts`) e dali para o cálculo de **rebate** por cliente. | Nenhum filtro por estado. |
| 4 | `src/scripts/migrarClientesBase.ts:56` | Script de migração: lê toda `poupanca/` para descobrir `data_entrada` mais antiga de cada Pure Asset. One-shot, baixo risco — mas a inferência de `data_entrada` a partir de órfão é semanticamente errada. | Nenhum filtro. |
| 5 | `src/features/agente/useAgenteValidacao.ts:75` | Lê toda `poupanca/`, recalcula totais em tempo de leitura, filtra por intervalo de período, agrupa por cliente normalizado e roda validação automatizada. Provavelmente alimenta o agente de QA / aba Agente. | **Filtro de intervalo** (período), nenhum filtro de estado. Recalcula `pl_total`, `aporte_mes_total`, etc. — mesmo padrão do `usePoupanca`. |
| 6 | `src/features/patrimonio/usePatrimonioCrud.ts:97` | Lê toda `poupanca/`, filtra por `nome_cliente === clienteNome`, ordena DESC e pega o registro mais recente para mostrar **"Carteira Galápagos"** no Patrimonial do cliente. Consumidor "lateral" não nomeado no diagnóstico anterior. | Filtra por `nome_cliente` exato. Sem filtro de estado nem normalização — vulnerável a divergência de grafia. |
| 7 | `src/features/upload/GerenciarDados.tsx:42` | Lista todos os `nome_cliente` distintos em `poupanca/` para popular o dropdown de filtros da página "Gerenciar Dados" (admin). Não compõe agregados financeiros, mas mostra o órfão como cliente selecionável. | Nenhum filtro. |
| 8 | `src/features/configuracoes/Configuracoes.tsx:178` (`corrigirEntradaOffshore`) | Lê toda `poupanca/`, agrupa por cliente, ordena por período, detecta "mês de entrada offshore" mal classificado e corrige (write). Operação manutenção, admin-only. | Nenhum filtro de estado; só lógica de detecção interna. |

### Leituras por docId (não agregam, mas precisam ser citadas)

| # | Arquivo:linha | Papel |
|---|---|---|
| 9 | `src/services/revisao.ts:78` (`definirRevisaoMes`) | `updateDoc` por docId — escreve `revisao_pendente: boolean`. Não lê para agregado. |
| 10 | `src/features/poupanca/import/useImportPoupanca.ts:543` | `getDoc` por docId — busca registro do mês anterior do mesmo cliente para encadear AUM offshore. Não agrega. |

### Writes (não consumidores, mas pontos onde a quarentena precisa ser ESCRITA)

| # | Arquivo:linha | Papel |
|---|---|---|
| 11 | `src/features/upload/useUploadImport.ts:75, 112, 205` | Upload Excel (`parsePoupanca`). Fora do escopo de sigla — usa `nome_cliente` direto. |
| 12 | `src/features/poupanca/import/useImportPoupanca.ts:370` | `setDoc` da `salvarMultiPeriodo` — **alvo da Frente 1.2** (gravar registro em quarentena). |
| 13 | `src/features/poupanca/import/useImportPoupanca.ts:605` | `setDoc` da `salvarNoFirestore` (onshore single + offshore). **Alvo da Frente 1.2** (apenas o ramo onshore). |
| 14 | `src/features/poupanca/PoupancaMetaLote.tsx:68` / `DetalheMetaLote.tsx:50` / `DetalheLinhaEdit.tsx:172` | Edição manual de campos específicos (`meta_poupanca_mensal`, transferência interna). `updateDoc` por docId. |
| 15 | `src/services/firebase.ts:859` (`corrigirNomeClientePoupanca`) | **Função-alvo da Frente 3** (normalização). Renomeia `nome_cliente` em massa. Precisa também limpar o estado de quarentena. |
| 16 | `src/services/firebase.ts:889` (`corrigirRegistroPoupanca`) | Update parcial por docId — admin-only. |
| 17 | `src/services/firebase.ts:985` (`zerarCampoTombamento`) | Manutenção pontual de tombamento espúrio. |

### Scripts `.mjs` (fora do bundle Vite — não afetam UI, mas leem dados)

```
scripts/audit-poupanca.mjs:18
scripts/auditoria-moises.mjs:49
scripts/cleanup-ria-btg-orfaos.mjs:70, 154
scripts/cleanup-poupanca-fantasmas.mjs:58
scripts/inspect-clientes-base-duplicatas.mjs:30
scripts/passo0-diagnostico-orfaos-live.mjs:40
```

Esses não fazem parte da Frente 2 (não compõem agregados nem afetam UI). Anotar para uma rodada futura de modernização: quando eles auditarem, devem reportar quarentenados separadamente.

### Comparação com o diagnóstico anterior

| Consumidor nomeado no diagnóstico | Status |
|---|---|
| `usePoupanca` | ✓ Confirmado (Ponto 1, item #1) |
| `aumIntegration` | ✓ Confirmado (item #2) |
| `AppContext` | ✓ Confirmado como **consumidor indireto** — não lê `poupanca/` direto; recebe via `aumIntegration.buscarAumPorPeriodo` + `firebase.buscarRegistrosPoupancaPorPeriodo`. A Frente 2 pode atacá-lo nos dois consumidores diretos (#2 e #3) e o AppContext herda a proteção. |

**Novos consumidores não previstos pelo diagnóstico:**

- `useAgenteValidacao` (item #5) — leitura agregadora idêntica à do `usePoupanca`. **Precisa do filtro de quarentena**.
- `usePatrimonioCrud` (item #6) — lê para exibir "Carteira Galápagos" no Patrimonial. **Precisa do filtro de quarentena** (senão um órfão vai aparecer no Patrimonial de algum cliente como se fosse a carteira dele).
- `GerenciarDados` (item #7) — popula dropdown admin. Discutível se precisa filtrar (admin deveria ver os órfãos para gerenciá-los) — talvez seja **o lugar certo** para mostrar a fila de quarentena.
- `Configuracoes.corrigirEntradaOffshore` (item #8) — operação one-shot de manutenção. **Precisa pular quarentenados** para não tentar corrigir um registro que está em limbo.

**Total: 5 consumidores agregadores diretos** que precisam ser tocados pela Frente 2 (usePoupanca, aumIntegration, buscarRegistrosPoupancaPorPeriodo, useAgenteValidacao, usePatrimonioCrud). O diagnóstico anterior nomeou apenas 2 dos 5 (deixava de fora useAgenteValidacao, usePatrimonioCrud, e tratava AppContext como direto quando ele é indireto).

---

## Ponto 2 — Estado atual de `poupanca/`

- Total LIVE `poupanca/`: **900 docs**
- Total LIVE `clientes_base/`: **84 docs**
- Slugs únicos em `clientes_base/`: 84 (sem duplicatas)
- Nomes normalizados (NFD + lowercase + sem acento + trim) em `clientes_base/`: 84 (1:1 com slugs)

**Órfãos detectados: 55 docs em 5 slugs distintos.**

> **A coleção NÃO está limpa.** O cleanup de 14-mai pegou apenas os 3 slugs RIA_BTG / WRG_fantasma / MSAL_fantasma (script `cleanup-poupanca-fantasmas.mjs` tem alvos hardcoded). Os outros órfãos ficaram. Em adição, novos uploads onshore podem ter criado órfãos entre 14-mai e hoje (15-mai) — a Decisão #5 do plano (*"não há legado a migrar"*) precisa ser revisada.

### Tabela completa por slug

| # | Slug | nome_cliente | Docs | Períodos | PL total não-zero? | Classificação |
|---|---|---|---:|---|---|---|
| 1 | `aae_btg` | `AAE_BTG` | 3 | 2026-03 a 2026-05 | Não (pl=0 em todos) | **Sigla bruta** (underline + sufixo `_BTG`) |
| 2 | `alan_kardec` | `ALAN KARDEC` | 14 | 2025-03 a 2025-12, 2026-02 a 2026-05 | Não (pl=0 em todos) | **Nome humano** (formato de pessoa) |
| 3 | `esm_btg` | `ESM_BTG` | 15 | 2025-02 a 2025-12, 2026-02 a 2026-05 | Não (pl=0 em todos) | **Sigla bruta** |
| 4 | `lucas_evangelista` | `LUCAS EVANGELISTA` | 6 | 2025-12, 2026-01 a 2026-05 | **SIM** — 2025-12 com **R$ 1.504.851** de PL | **Nome humano com PL real** |
| 5 | `matheus_bonifacio_saldanha` | `MATHEUS BONIFACIO SALDANHA` | 17 | 2025-01 a 2025-12, 2026-01 a 2026-05 | **SIM** — 5 docs com PL entre R$ 2.236-2.393 | **Nome humano com PL pequeno mas real** |

### Cross-check com MAPEAMENTO_SIGLAS

| Slug órfão | Sigla canônica existe? | Conclusão |
|---|---|---|
| `aae_btg` | ✗ Não há `AAE` em MAPEAMENTO_SIGLAS | **Sigla genuinamente desconhecida** — exige cadastro humano |
| `alan_kardec` | ✓ Sim — sigla `AKS`, com variantes `AKS_BTG`, `AKS_C`, `AKS_GLPG`; `SIGLA_PARA_NOME[AKS] = 'ALAN KARDEC'` | **Lookup foi ignorado** — o onshore não consultou o mapeamento. Resolução mecânica disponível. |
| `esm_btg` | ✗ Não há `ESM` em MAPEAMENTO_SIGLAS | **Sigla genuinamente desconhecida** |
| `lucas_evangelista` | ✓ Sim — sigla `LEV`, com `LEV_BTG`, `LEV_C`, `LEV_GLPG`; `SIGLA_PARA_NOME[LEV] = 'LUCAS EVANGELISTA'` | **Lookup foi ignorado** — resolução mecânica. **Cuidado:** 2025-12 tem R$ 1,5 M. |
| `matheus_bonifacio_saldanha` | ✓ Sim — sigla `MBS`, com `MBS_BTG`, `MBS_C`; `SIGLA_PARA_NOME[MBS] = 'MATHEUS BONIFACIO SALDANHA'` | **Lookup foi ignorado** — resolução mecânica. |

3 dos 5 (`alan_kardec`, `lucas_evangelista`, `matheus_bonifacio_saldanha`) confirmam o achado central do plano: o onshore não consulta o `MAPEAMENTO_SIGLAS` mesmo quando a sigla está lá. Esses não são órfãos "porque a sigla é nova" — são órfãos "porque o onshore ignorou o lookup".

Os 2 (`aae_btg`, `esm_btg`) são candidatos a sigla genuinamente nova. Decisão humana sobre eles depende de o CFO confirmar se são clientes reais ou lixo de teste (padrão de pl=0 sugere fortemente lixo, mas o padrão é diferente do RIA_BTG — não há ping-pongue de centavos, é zero puro).

**Importante para a Decisão #5 do plano:** os PL não-nulos de `lucas_evangelista_2025_12` (R$ 1,5 M) e `matheus_bonifacio_saldanha_*` (R$ 2,2-2,4 K em 5 meses) são **dados reais que não podem ser deletados sem normalização**. Esses órfãos não são "lixo a deletar" — são "registros pendentes de mapeamento" e precisam virar quarentena formal OU ser renomeados antes da Frente 1 começar.

---

## Ponto 3 — Origem dos 11 RIA_BTG novos (+ confirmação dos atuais 55)

### a) Fluxos candidatos

Os dois fluxos onshore têm comportamentos distintos:

- **`parseOnshoreComClaude`** (single-period): quando o lookup falha, fallback final é `item.nome_cliente` — o **nome bruto extraído pelo Claude do PDF**. Tipicamente nome de pessoa (ex: "LUCAS EVANGELISTA", "MATHEUS BONIFACIO SALDANHA").
- **`processarMultiPeriodo`** (multi-período): quando o lookup falha, fallback final é `codigoCarteira` — a **própria sigla bruta** (ex: "RIA_BTG", "AAE_BTG", "ESM_BTG").

### b) Trecho `parseOnshoreComClaude` (`src/features/poupanca/import/parsers/parseComClaude.ts:308-312`)

```ts
// Resolve sigla e depois nome completo via SIGLA_PARA_NOME
const sigla = MAPEAMENTO_SIGLAS[item.codigo_carteira]
  ?? MAPEAMENTO_SIGLAS[item.codigo_carteira.replace(/_C$/, '')]
  ?? item.codigo_carteira;
const nomeCompleto = SIGLA_PARA_NOME[sigla] ?? item.nome_cliente ?? sigla;
```

Lookup inline simplificado: tenta `MAPEAMENTO_SIGLAS[codigo_carteira]`, depois `MAPEAMENTO_SIGLAS[codigo_sem_C]`, e finalmente faz fallback para `codigo_carteira` (a própria string). Em seguida, `SIGLA_PARA_NOME[sigla]` busca o nome completo; se não achar, cai em `item.nome_cliente` (nome bruto do PDF). **Não consulta `mapeamento_siglas/` no Firestore.**

### c) Trecho `processarMultiPeriodo` (`src/features/poupanca/import/useImportPoupanca.ts:217-223`)

```ts
// Resolver sigla do texto (busca "Carteira: XXX_C")
const matchCarteira = texto.match(/Carteira:\s*(\S+)/i);
const codigoCarteira = matchCarteira?.[1] ?? '';
const sigla = MAPEAMENTO_SIGLAS[codigoCarteira]
  ?? MAPEAMENTO_SIGLAS[codigoCarteira.replace(/_C$/, '')]
  ?? codigoCarteira;
const nomeCompleto = SIGLA_PARA_NOME[sigla] ?? sigla;
setNomeClienteMulti(nomeCompleto);
```

Mesmo padrão: tenta `MAPEAMENTO_SIGLAS[codigoCarteira]`, `MAPEAMENTO_SIGLAS[codigo_sem_C]`, e finalmente faz fallback para `codigoCarteira` (a própria sigla bruta). Como o `SIGLA_PARA_NOME[codigoCarteira]` também não vai existir (a sigla é justamente a desconhecida), `nomeCompleto = sigla = codigoCarteira` literal — vira `nome_cliente` em `setNomeClienteMulti`.

**Diferença crítica versus single-period:** o multi-período **não tem o fallback adicional** `?? item.nome_cliente` (porque o nome do cliente não é extraído pelo Claude — só o código). Por isso o multi-período cai DIRETO na sigla bruta, sem nem mesmo passar pelo nome humano.

### d) Conclusão sobre o gerador

`RIA_BTG`, `AAE_BTG`, `ESM_BTG` têm o padrão `XXX_BTG` (formato "sigla curta + sufixo de custodiante", convenção interna). Não são nome de pessoa. Portanto:

- **Os 11 RIA_BTG novos foram gerados pelo `processarMultiPeriodo`** (multi-período). É o único fluxo cujo fallback usa a sigla bruta direta sem passar pelo Claude.
- O mesmo se aplica a `AAE_BTG` (3 docs) e `ESM_BTG` (15 docs) que estão LIVE agora: também multi-período.
- Os 3 nomes humanos (`alan_kardec`, `lucas_evangelista`, `matheus_bonifacio_saldanha`) que aparecem como nomes completos vieram do **`parseOnshoreComClaude`** (single-period — fallback usa `item.nome_cliente` extraído pelo Claude).

**Implicação para a Frente 1:** o multi-período é o vetor mais "puro" do bug (sigla bruta → sigla bruta) e o mais simples de testar. O single-period adiciona a camada do nome humano. Os dois precisam de proteção, mas o multi-período deve ser priorizado no teste end-to-end por ser o caso mais limpo de demonstrar.

---

## Ponto 4 — `resolverSigla` e reuso no onshore

**Localização:** `src/features/poupanca/import/parsers/parseComClaude.ts:94-117`

**Assinatura completa:**
```ts
type MetodoResolucao =
  | 'codigo_exato'
  | 'codigo_limpo'
  | 'codigo_C'
  | 'nome'
  | 'prefix_match'
  | 'nao_encontrado';

function resolverSigla(codigo: string, nomeCliente?: string): {
  sigla: string | null;
  metodo: MetodoResolucao;
}
```

**Visibilidade:** **não exportada.** Atualmente é função local do módulo. Para a Frente 1.1 (reuso pelo onshore), precisará receber `export`.

**Como consulta `mapeamento_siglas/` (Firestore):** **não consulta diretamente.** A função `resolverSigla` é **pura** — depende apenas do `MAPEAMENTO_SIGLAS` hardcoded (importado de `MAPEAMENTO_SIGLAS.ts`). Ela retorna `{sigla: null, metodo: 'nao_encontrado'}` quando o lookup hardcoded falha.

A consulta ao Firestore é feita pelo **chamador** — `parseOffshoreComClaude` (`parseComClaude.ts:220-223`):
```ts
const entradaFs = !resultado.sigla
  ? (mapeamentoFirestore[item.codigo_conta] ?? null)
  : null;
const sigla = resultado.sigla ?? entradaFs?.sigla ?? null;
```

E o `mapeamentoFirestore` chega como parâmetro do `parseOffshoreComClaude` (assinatura: `parseOffshoreComClaude(textoBruto, mapeamentoFirestore = {}, periodo?)`), que por sua vez é alimentado por `buscarMapeamentoSiglas()` chamado uma vez em `useImportPoupanca.ts:393`.

**Suposições internas offshore-específicas:** **nenhuma.** A função não toca USD, ptax, lâmina offshore, OffshoreItem, nada. É genérica — recebe `codigo: string` + `nomeCliente?: string`, retorna `{sigla, metodo}`. O nome "resolver sigla" reflete a generalidade.

**Veredito:** **reusável direto pelo onshore.** Sem refactor. Só precisa:
1. Adicionar `export` à função (`export function resolverSigla(...)`)
2. O onshore chamar `resolverSigla(codigo_carteira, nome_cliente_do_pdf)` em vez do lookup inline.
3. O onshore aplicar o mesmo padrão de fallback Firestore que o offshore (passar o `mapeamentoFirestore` como parâmetro ao parser, e cair nele quando `resolverSigla` retornar `null`).

A função `buscarMapeamentoSiglas` em `firebase.ts:918-931` também já é genérica — pode ser reutilizada no fluxo onshore sem alteração.

---

## Ponto 5 — `RegistroPoupanca` e pontos de construção

**Definição atual:** `src/types/index.ts:304-372`

### Campos atuais (todos)

```ts
interface RegistroPoupanca {
  id?: string;
  nome_cliente: string;
  ano: number;
  mes: number;

  // PL atual em BRL
  pl_onshore: number;
  pl_offshore: number;
  pl_total: number;

  // PL inicial (saldo de abertura do mês)
  pl_inicial_onshore?: number;
  pl_inicial_offshore?: number;
  pl_inicial_total?: number;

  // Valores offshore originais
  pl_offshore_usd?: number;
  pl_inicial_offshore_usd?: number;  // Starting Value USD (inclui accrued)
  ptax_fechamento?: number;

  // Movimentação
  aporte_mes_onshore: number;
  aporte_mes_offshore: number;
  aporte_mes_total: number;

  // Rentabilidade
  rentabilidade_onshore?: number;
  rentabilidade_offshore?: number;
  rentabilidade_pct_offshore?: number;
  rentabilidade_total?: number;
  rentabilidade_pct?: number;

  // Impostos pagos no mês
  impostos_mes?: number;

  // Revisão pendente (NÃO confundir com quarentena — é flag manual)
  revisao_pendente?: boolean;

  // Tombamento
  nnm_tombamento?: number;
  nnm_tombamento_onshore?: number;
  nnm_tombamento_offshore?: number;

  // Transferência interna
  transferencia_interna_onshore?: number;
  transferencia_interna_offshore?: number;

  // Metas
  sem_capacidade_poupanca: boolean;
  capacidade_poupanca_mensal?: number;
  meta_poupanca_mensal?: number;

  // Período parcial
  dia_inicio?: number | null;
  dia_corte?: number | null;
}
```

### Divergência com CLAUDE.md

CLAUDE.md (na seção `Interface RegistroPoupanca`) mostra uma versão **simplificada** com 11 campos básicos. O código real tem **muito mais** campos (~30). Sinais de drift:

- CLAUDE.md não menciona: `pl_inicial_*`, `pl_inicial_offshore_usd`, `rentabilidade_pct_offshore`, `impostos_mes`, `revisao_pendente`, `nnm_tombamento_*`, `transferencia_interna_*`, `dia_inicio`, `dia_corte`.
- A divergência é por incompletude, não por contradição — todos os campos extras estão documentados em outras seções do CLAUDE.md (ex: "Tombamento offshore espúrio", "Transferência interna entre contas"), mas não foram refletidos na declaração de interface.

**Recomendação:** quando os campos de quarentena forem adicionados, atualizar tanto `src/types/index.ts` quanto a seção `Interface RegistroPoupanca` do CLAUDE.md em um único commit. Aproveitar para fechar a divergência atual.

### Pontos de construção e leitura tipada — onde a quarentena precisa ser pensada

Grep por `RegistroPoupanca` retornou **35 arquivos**. Destes, classifiquei por papel:

#### Pontos de CONSTRUÇÃO (criam objetos que viram docs em `poupanca/`)

| # | Arquivo:linha | Papel | Toca pela Frente 1? |
|---|---|---|---|
| 1 | `src/features/upload/parseExcel.ts:213` (`parsePoupanca`) | Constrói `RegistroPoupanca[]` a partir do Excel (literal completo). Fora do escopo de sigla — `nome_cliente` vem direto da planilha. | Não (Excel não usa sigla — mas convém marcar `status: 'ativo'` ao construir, para alinhar com a quarentena por consistência) |
| 2 | `src/features/poupanca/import/parsers/parseComClaude.ts:314-325` (`parseOnshoreComClaude` retorno) | Constrói `OnshoreResult` (parcial). Aqui é onde o nome bruto vira `nome_cliente`. **Frente 1.1 vai mudar isso.** | **Sim** |
| 3 | `src/features/poupanca/import/parsers/parseComClaude.ts:241-249` (`parseOffshoreComClaude` retorno) | Constrói `OffshoreResult` (parcial). Já tem proteção contra órfão (vai para `siglas_nao_mapeadas[]`). | Não (já correto) |
| 4 | `src/features/poupanca/import/parsers/parseMultiPeriodoComClaude.ts` (interface `RegistroMensal`) | Constrói `RegistroMensal[]` (parcial, sem `nome_cliente` — é definido depois no hook). | Não (não toca nome) |
| 5 | `src/features/poupanca/import/useImportPoupanca.ts:342-369` (`salvarMultiPeriodo`, objeto `dados`) | **Constrói o objeto que vai pro setDoc.** `nome_cliente: nomeClienteMulti`. **Frente 1.2 vai mudar para gravar quarentena.** | **Sim** |
| 6 | `src/features/poupanca/import/useImportPoupanca.ts:517-603` (`salvarNoFirestore`, objeto `dados`) | **Constrói o objeto que vai pro setDoc** (ramo offshore + ramo onshore single). `nome_cliente: item.nome_cliente`. **Frente 1.2 vai mudar o ramo onshore.** | **Sim (ramo onshore)** |

#### Pontos de LEITURA tipada como `RegistroPoupanca` (estes já estão cobertos pela enumeração do Ponto 1)

Os outros ~29 arquivos com `RegistroPoupanca` apenas usam o tipo para parâmetros/retornos de funções consumidoras (componentes, hooks, utils financeiros). Esses não constroem novos registros — eles consomem. Vão para a Frente 2 (filtro de quarentena).

### Resumo Ponto 5

**Pontos de construção a atualizar quando os campos de quarentena forem adicionados: 4** (parseOnshoreComClaude, salvarMultiPeriodo, salvarNoFirestore-ramo-onshore, parseExcel — este último opcional, só por consistência).

Os campos a adicionar (Decisões de início #1 e #2 do plano):
- `status?: 'ativo' | 'pendente_normalizacao'` — recomendação preliminar do plano. Opcional para retrocompatibilidade (ausente = `'ativo'`).
- `sigla_bruta_origem?: string` — preserva sigla/nome bruto original quando em quarentena.

Considerar também:
- `nome_bruto_origem?: string` — separar sigla de nome bruto (no caso do single-period o "bruto" é nome humano, no multi-período é sigla).
- `quarentena_motivo?: string` — opcional, free-text para auditoria ("sigla AAE não encontrada no mapeamento").

Essas decisões finais ficam para a Frente 1.1.

---

## Conclusão — pronto para Frente 1?

### Checklist

- [x] **Lista de consumidores é exaustiva** → identificados **8 consumidores agregadores** (3 nomeados pelo diagnóstico + 5 novos: `useAgenteValidacao`, `usePatrimonioCrud`, `GerenciarDados`, `Configuracoes.corrigirEntradaOffshore`, `buscarRegistrosPoupancaPorPeriodo`). Frente 2 pode começar **com escopo redimensionado** (não 3, mas 5-8 alvos).
- [ ] **`poupanca/` está limpa** → **NÃO.** 55 docs órfãos em 5 slugs. **A Decisão #5 do plano precisa ser revisada antes da Frente 1.** Há dados reais (Lucas Evangelista R$ 1,5 M, Matheus Bonifacio Saldanha R$ 2-2,4 K) que não podem ser deletados — exigem normalização ou migração para quarentena formal.
- [x] **Origem do vazamento confirmada** → multi-período (`processarMultiPeriodo`) gera órfãos com sigla bruta (`AAE_BTG`, `ESM_BTG`, `RIA_BTG`); single-period (`parseOnshoreComClaude`) gera órfãos com nome humano (`ALAN KARDEC`, `LUCAS EVANGELISTA`, `MATHEUS BONIFACIO SALDANHA`). Ambos os fluxos estão ativos.
- [x] **`resolverSigla` reusável** → sim, sem refactor. Só precisa de `export`. Frente 1.1 sem refactor pesado.
- [x] **Pontos de construção mapeados** → 4 pontos identificados (parseOnshoreComClaude retorno, salvarMultiPeriodo objeto `dados`, salvarNoFirestore ramo onshore, parseExcel opcional). Frente 1.2 sabe onde tocar.

### Bloqueios encontrados

**Um bloqueio:** os 55 órfãos legados (Ponto 2) precisam de tratamento antes da Frente 1 começar. Razões:

1. Se a Frente 1 começar com eles presentes, o filtro de quarentena (Frente 2) os excluirá dos agregados — mas eles não estão *formalmente* em quarentena (não têm o campo `status`). Comportamento ambíguo: estariam invisíveis nos agregados (por nome inválido) mas também invisíveis na fila de quarentena (por falta do flag).
2. 3 dos 5 nomes (`alan_kardec`, `lucas_evangelista`, `matheus_bonifacio_saldanha`) são clientes reais já mapeados — a resolução é **mecânica via `corrigirNomeClientePoupanca`** (renomear para o nome canônico do SIGLA_PARA_NOME). Não precisa virar quarentena formal.
3. 2 dos 5 (`aae_btg`, `esm_btg`) são siglas genuinamente desconhecidas — precisam de decisão humana CFO (cadastrar como cliente novo, ou deletar como lixo se for confirmado como teste).

### Próximo passo recomendado

**Antes da Frente 1.1, fazer um sub-passo de saneamento de legado** (escopo cirúrgico, 1 sessão):

1. **Mecânico** — usar `corrigirNomeClientePoupanca` (existente em Configurações → Manutenção) para renomear:
   - `ALAN KARDEC` → nome canônico que bate com `clientes_base/` (verificar qual entrada existe; se não existe, cadastrar antes)
   - `LUCAS EVANGELISTA` → idem
   - `MATHEUS BONIFACIO SALDANHA` → idem

   Confirma que esses 3 nomes existem em `clientes_base/` (senão, primeiro cadastrar). Se já existem com grafia ligeiramente diferente, a renomeação resolve.

2. **Decisão humana** — perguntar ao CFO:
   - `AAE_BTG` (3 docs, todos pl=0): cliente real (qual?) ou lixo de teste?
   - `ESM_BTG` (15 docs, todos pl=0): idem.

   Se ambos forem lixo: usar o padrão do `cleanup-ria-btg-orfaos.mjs` (snapshot + delete + validação). Se algum for cliente real: cadastrar em `clientes_base/`, adicionar entrada em `MAPEAMENTO_SIGLAS`, renomear via `corrigirNomeClientePoupanca`.

3. **Verificação final** — rerunar este mesmo scan inline; confirmar zero órfãos antes da Frente 1.1.

Depois disso, a Frente 1 começa em terreno limpo e as 5 decisões de início (Seção 4 do plano) podem ser fechadas com dados na mão. A Decisão #5 vira simplesmente "não há legado — coleção foi saneada na sub-rodada".

### Achado bônus relevante para o plano

A função `resolverSigla` consulta `MAPEAMENTO_SIGLAS` hardcoded mas o **fallback Firestore (`mapeamento_siglas/`) é responsabilidade do CALLER**. Isso significa que a Frente 1.1 precisa:

- Não só fazer o onshore chamar `resolverSigla`, mas também
- Passar o `mapeamentoFirestore` (resultado de `buscarMapeamentoSiglas`) como parâmetro aos parsers onshore, e
- Aplicar o mesmo padrão de fallback Firestore que o offshore já faz.

Sem esse segundo passo, o onshore vai conseguir resolver `ALAN KARDEC` (que está no hardcoded) mas continuará falhando em siglas que só foram cadastradas via `ResolverSiglasModal` (Firestore). A correção precisa ser completa.

---

## Saneamento de legado — 2026-05-15T12:52:31Z

Decisão CFO após análise do dry-run: 52 deletes, 3 mantidos.

### Snapshot prévio

`backups/firestore/orfaos-pre-saneamento-2026-05-15T12-52-31.json` (55 docs órfãos, payload integral, reversibilidade total).

### Bloqueios identificados no dry-run

1. **Os 3 nomes humanos** (Alan Kardec, Lucas Evangelista, Matheus Bonifacio Saldanha) cuja sigla canônica existe em SIGLA_PARA_NOME **não tinham entrada correspondente em clientes_base/**. Logo, não havia "nome canônico" para o qual renomear. CFO decidiu deletar — reimportar pelo fluxo novo após Frente 1 (que vai gravar em quarentena formal até o cliente ser cadastrado).
2. **AAE_BTG tem PL onshore real** (R$ 200.724 e R$ 201.273 em Abr/26 e Mai/26 — `pl_total` salvo no Firestore aparecia como 0 porque é calculado em runtime, mas `pl_onshore` direto tem o valor). Não é lixo de teste como RIA_BTG. CFO decidiu **manter os 3 docs AAE_BTG** aguardando confirmação do nome do cliente para cadastro + renomeação.
3. **ESM_BTG** continua com perfil de lixo (resíduos de −R$ 5,36 em 2 períodos, zero no resto). Delete confirmado.

### Operações realizadas

| Slug | nome_cliente | Docs | Ação |
|---|---|---:|---|
| `alan_kardec` | ALAN KARDEC | 14 | DELETE |
| `lucas_evangelista` | LUCAS EVANGELISTA | 6 | DELETE |
| `matheus_bonifacio_saldanha` | MATHEUS BONIFACIO SALDANHA | 17 | DELETE |
| `esm_btg` | ESM_BTG | 15 | DELETE |
| `aae_btg` | AAE_BTG | 3 | MANTIDO (aguardando cadastro de cliente) |

Total deletados: **52 docs** em 1 writeBatch. 0 erros.

### Validação pós-write

| # | Verificação | Resultado |
|---|---|---|
| V1 | Deletes 52/52 confirmados | ✓ |
| V2 | Total poupanca/ 900 → 848 (delta exato 52, sem efeito colateral) | ✓ |
| V3 | Órfãos remanescentes = 3 (esperado) | ✓ |
| V4 | Os 3 remanescentes são exclusivamente `aae_btg` | ✓ |

### Estado atual e próximo passo

- `poupanca/` tem 848 docs. 845 vinculados a `clientes_base/`. 3 docs `aae_btg` em estado órfão consciente, aguardando decisão CFO sobre cadastro.
- A Decisão #5 do plano original (*"não há legado a migrar"*) volta a valer **com uma única exceção**: os 3 docs AAE_BTG. Decisão suspensa, não bloqueante.
- A Frente 1 pode começar com terreno limpo. Quando o estado de quarentena for implementado, o AAE_BTG é o primeiro candidato a entrar — naturalmente, sem migração retroativa.

### Pendência aberta

**AAE_BTG (3 docs, ~R$ 400 K combinados em Abr+Mai/26):** CFO precisa confirmar o nome do cliente. Caminho:
1. Cadastrar o cliente em `clientes_base/` com o nome canônico
2. Adicionar entrada `AAE_BTG → AAE` em `MAPEAMENTO_SIGLAS.ts` (sigla nova)
3. Adicionar `AAE → <nome>` em `SIGLA_PARA_NOME`
4. Renomear via `corrigirNomeClientePoupanca` em Configurações → Manutenção
5. Confirmar zero órfãos no scan final

Após isso, a Frente 1 começa em poupanca/ com 0 órfãos.
