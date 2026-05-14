# Procedimento atual: sigla nova sem cliente cadastrado

Gerado em **2026-05-14T20:39:04Z** · READ-ONLY puro · zero writes Firestore · zero modificações de código.

Pergunta: quando o módulo AUM & Performance recebe uma sigla nova — uma que não está em `MAPEAMENTO_SIGLAS` e não corresponde a nenhum cliente cadastrado — o que acontece?

Resposta curta antecipada: **depende do fluxo**. Há proteção robusta no offshore (modal interativo) e proteção zero nos dois fluxos onshore (cria registro silenciosamente com a sigla/nome bruto como nome do cliente).

---

## I1 — Pontos de entrada de sigla

| # | Caminho | Arquivo | Função / hook |
|---|---|---|---|
| 1 | **Offshore (lâminas Galápagos / Andbanc / JP Morgan)** — upload de PDF com tabela "Assets by Account" | `src/features/poupanca/import/parsers/parseComClaude.ts` | `parseOffshoreComClaude()` chamado por `useImportPoupanca.processarArquivos` |
| 2 | **Onshore single-period (extrato individual)** — upload de 1 PDF por cliente/mês | `parseComClaude.ts` | `parseOnshoreComClaude()` chamado por `useImportPoupanca.processarArquivos` |
| 3 | **Onshore multi-período (Comdinheiro)** — 1 PDF com vários meses do mesmo cliente | `useImportPoupanca.ts:208-247` + `parsers/parseMultiPeriodoComClaude.ts` | `processarMultiPeriodo()` — resolução de sigla acontece no hook, ANTES do parser |
| 4 | **Upload Excel** (aba `poupanca` do template) | `src/features/upload/parseExcel.ts:205-238` | `parsePoupanca()` — **NÃO usa sigla**: lê `nome_cliente` direto da planilha |

Os caminhos 1-3 envolvem sigla. O caminho 4 não — é fora do escopo desta investigação.

UI única que dispara qualquer dos 3 primeiros: `src/features/poupanca/import/ImportPoupanca.tsx`. Toggle `offshore` vs `onshore`. Onshore decide internamente entre single-period (PDF curto, 1 mês) e multi-período (PDF longo, vários meses) — controlado pela variável `isMulti = !isOff` em `ImportPoupanca.tsx:46`.

---

## I2 — Resolução sigla → cliente

**Fontes de mapeamento (duas):**

1. **Hardcoded** — `src/features/poupanca/import/MAPEAMENTO_SIGLAS.ts` (~440 entradas).
   - `MAPEAMENTO_SIGLAS: Record<string, string>` — código bruto → sigla curta (ex: `'ABJ_C': 'ABJ'`, `'7206822': 'ABJ'`).
   - `SIGLA_PARA_NOME: Record<string, string>` — sigla → nome completo (ex: `'ABJ': 'ADEMILSON BRAGA BISPO JUNIOR'`).

2. **Firestore** — `mapeamento_siglas/{codigoSanitizado}` (entradas criadas por usuários via `ResolverSiglasModal` em sessões anteriores).
   - Estrutura `EntradaMapeamentoSigla` em `services/firebase.ts:902-909`: `{ codigo, sigla, nome_cliente, registrado_em, registrado_por?, atualizado_em? }`.
   - Lido por `buscarMapeamentoSiglas()` em `services/firebase.ts:918-931` (retorna `Record<codigo_original, EntradaMapeamentoSigla>`).

**Função canônica de lookup:** `resolverSigla(codigo, nomeCliente?)` em `parseComClaude.ts:94-117`. Tenta 5 caminhos na ordem:

1. **`codigo_exato`** — `MAPEAMENTO_SIGLAS[codigo]`.
2. **`codigo_limpo`** — remove ellipsis/ponto/whitespace trailing e tenta de novo.
3. **`codigo_C`** — tenta `{limpo}_C` (sufixo Comdinheiro).
4. **`nome`** — se passou `nomeCliente`, tenta `MAPEAMENTO_SIGLAS[nomeCliente]`. *Inseridos antes do prefix-match para corrigir o bug TAW01…→MLM em Jan/26.*
5. **`prefix_match`** — restritivo: `limpo.length ≥ 6 && chave.length ≥ 6 && limpo.startsWith(chave)`. Dispara warning quando dispara.

**Retorno quando NÃO encontra:** `{ sigla: null, metodo: 'nao_encontrado' }`.

Essa função é chamada APENAS no fluxo offshore (caminho 1). Os caminhos 2 e 3 usam lookup direto inline em `MAPEAMENTO_SIGLAS` sem passar pela função canônica.

---

## I3 — CAMINHO DA SIGLA ÓRFÃ — passo a passo (resposta central)

Três caminhos com comportamentos COMPLETAMENTE DIFERENTES.

### Caminho 1 — Offshore (proteção completa) ✓

`parseComClaude.ts:140-257` + `useImportPoupanca.ts:384-495` + `ResolverSiglasModal.tsx`.

1. Claude API extrai `nome_cliente` (bruto) e `codigo_conta` do PDF.
2. `resolverSigla(item.codigo_conta, item.nome_cliente)` é chamada — retorna `{ sigla: null, metodo: 'nao_encontrado' }`.
3. Fallback Firestore: `mapeamentoFirestore[item.codigo_conta]` — `null` se também não cadastrado.
4. Como `sigla` final = `null`, o item NÃO entra em `registros[]`. Em vez disso, é empurrado para `siglas_nao_mapeadas[]` com `{ codigo, nome_bruto, periodo }`. Comentário inline em `parseComClaude.ts:226-227`:

   > *"Sigla nova — adiciona à lista de pendências em vez de criar cliente com nome bruto (evita cliente fantasma silenciosamente nos dados)."*

5. `processarArquivos` recebe `siglas_nao_mapeadas` acumuladas, deduplica por código (`useImportPoupanca.ts:428-436`) e **pausa o fluxo**:
   - `setSiglasNaoMapeadas([...])` expõe a lista para a UI.
   - `setArquivosPendentes({ files, anoRef, mesRef })` salva o input para retry.
   - `setProcessando(false)` + `return` — não chega no preview.

6. UI renderiza `<ResolverSiglasModal>` (`ImportPoupanca.tsx:355-361`). Cada linha tem código bruto, nome bruto do PDF e dois inputs editáveis (nome do cliente, sigla curta sugerida pelas iniciais).

7. Usuário escolhe:
   - **Confirmar** → `aplicarSiglasResolvidas` (`useImportPoupanca.ts:629-646`):
     - Para cada resolução, chama `salvarEntradaMapeamento({...})` que faz `setDoc(mapeamento_siglas/{codigoSanitizado})` em paralelo (`Promise.all`).
     - Limpa estados (`setArquivosPendentes(null)`, `setSiglasNaoMapeadas([])`).
     - **Re-executa `processarArquivos(files, anoRef, mesRef)`** com o cache de arquivos. Como o `buscarMapeamentoSiglas` é chamado no início (`useImportPoupanca.ts:393`), os mapeamentos recém-gravados são lidos e resolvem na 2ª passada.
   - **Cancelar** → `cancelarSiglasResolvidas` apenas zera os estados. Nenhum dado é gravado. Upload abortado.

**Desfecho offshore:** registro nunca chega ao Firestore até o usuário cadastrar a sigla. Zero criação silenciosa. Único caminho seguro dos três.

### Caminho 2 — Onshore single-period (proteção zero) ✗

`parseOnshoreComClaude` em `parseComClaude.ts:279-330`.

1. Claude API extrai `codigo_carteira`, `nome_cliente`, etc.
2. Resolução INLINE (linhas 309-312):
   ```ts
   const sigla = MAPEAMENTO_SIGLAS[item.codigo_carteira]
     ?? MAPEAMENTO_SIGLAS[item.codigo_carteira.replace(/_C$/, '')]
     ?? item.codigo_carteira;
   const nomeCompleto = SIGLA_PARA_NOME[sigla] ?? item.nome_cliente ?? sigla;
   ```
3. **Quando órfã:** `sigla = item.codigo_carteira` (o próprio código bruto, ex: `XYZ_C`). `SIGLA_PARA_NOME[sigla]` é undefined → fallback para `item.nome_cliente` (nome bruto extraído pelo Claude do PDF).
4. **NÃO consulta** `mapeamento_siglas/` no Firestore — só MAPEAMENTO_SIGLAS hardcoded.
5. **NÃO produz `siglas_nao_mapeadas`** — não há esse tipo de retorno na função.
6. **NÃO pausa o fluxo.** O resultado entra direto em `preview` como item válido.
7. Usuário clica "Confirmar e Salvar" → `salvarNoFirestore` (`useImportPoupanca.ts:497-616`):
   - `slugCliente = slug(item.nome_cliente ?? 'desconhecido')` (linha 513).
   - `docId = slugCliente_{ano}_{mes}`.
   - `setDoc(doc(db, 'poupanca', docId), {...}, { merge: true })`.
8. **Cliente fantasma criado silenciosamente.** O `nome_cliente` gravado é o nome do PDF (que pode ter qualquer grafia/erro de OCR do Claude). Se nem mesmo o nome veio (`undefined`), o slug vira `'desconhecido'` literal.

**Desfecho onshore single:** registro órfão entra na coleção `poupanca/` com nome bruto do PDF, sem nenhum sinal para o usuário de que a sigla era nova.

### Caminho 3 — Onshore multi-período (proteção zero, ainda pior) ✗

`processarMultiPeriodo` em `useImportPoupanca.ts:208-247`.

1. Texto do PDF é extraído. Sigla via regex: `matchCarteira = texto.match(/Carteira:\s*(\S+)/i)` (linha 218).
2. Resolução INLINE (linhas 220-223):
   ```ts
   const sigla = MAPEAMENTO_SIGLAS[codigoCarteira]
     ?? MAPEAMENTO_SIGLAS[codigoCarteira.replace(/_C$/, '')]
     ?? codigoCarteira;
   const nomeCompleto = SIGLA_PARA_NOME[sigla] ?? sigla;
   ```
3. **Quando órfã:** `sigla = codigoCarteira` (bruto). `SIGLA_PARA_NOME[sigla]` é undefined. `nomeCompleto = sigla` — ou seja, **o código bruto da carteira vira o nome do cliente** (ex: `XYZ_C`).
4. *Pior que o caminho 2*: no caminho 2 o fallback final é o `item.nome_cliente` extraído pelo Claude (uma string "humana", ainda que com erros). No caminho 3 não há fallback para nome — usa o próprio código de carteira como nome.
5. `setNomeClienteMulti(nomeCompleto)` — esse valor aparece no preview da UI.
6. **NÃO consulta** `mapeamento_siglas/`. **NÃO produz lista de não-mapeadas.** **NÃO pausa o fluxo.**
7. `salvarMultiPeriodo` (linhas 250-381) grava com `slugCliente = slug(nomeClienteMulti)` → cria docs `poupanca/{slug_do_codigo_bruto}_{ano}_{mes}` para cada mês do PDF.

**Desfecho multi-período:** N registros órfãos por upload (um por mês do PDF), todos com a SIGLA BRUTA (ou código de carteira) como `nome_cliente`. Visível no preview ANTES do save, mas só se o usuário prestar atenção — não há badge de alerta nem aviso textual.

---

## I4 — Consistência entre pontos de entrada

**DIVERGENTE.** Os três caminhos tratam sigla órfã de forma completamente diferente. Resumo:

| Característica | Offshore | Onshore single | Multi-período |
|---|:---:|:---:|:---:|
| Consulta `MAPEAMENTO_SIGLAS` hardcoded | ✓ | ✓ | ✓ |
| Consulta `mapeamento_siglas/` Firestore | ✓ | ✗ | ✗ |
| Usa `resolverSigla()` canônica (5 caminhos) | ✓ | ✗ (lookup inline simples) | ✗ (lookup inline simples) |
| Produz `siglas_nao_mapeadas[]` | ✓ | ✗ | ✗ |
| Pausa fluxo para usuário resolver | ✓ (ResolverSiglasModal) | ✗ | ✗ |
| Persiste mapeamento novo após resolução | ✓ | ✗ | ✗ |
| Cria registro órfão silenciosamente | ✗ | ✓ (nome bruto do PDF) | ✓ (sigla bruta como nome) |
| Warning no console | n/a (não cria) | ✗ | ✗ |

Há também inconsistência interna entre offshore e onshore quando uma sigla foi cadastrada via modal: o offshore lê `mapeamento_siglas/` (`useImportPoupanca.ts:393`) e resolve corretamente nas sessões seguintes; o onshore (caminhos 2 e 3) ignora completamente essa coleção mesmo quando ela tem a entrada certa. Resultado prático: o mesmo cliente pode ser reconhecido no upload offshore e virar registro órfão no upload onshore na mesma sessão.

---

## I5 — Impacto em cálculos

Um registro órfão (criado pelos caminhos 2 e 3) entra em `poupanca/{slug_bruto}_{ano}_{mes}` e é lido sem filtro pelos dois consumidores principais:

1. **`usePoupanca`** — `getDocs(collection(db, 'poupanca'))` (`usePoupanca.ts:354`) → carrega tudo em `todosRegistros`.
2. **`buscarAumPorPeriodo`** em `aumIntegration.ts:43-141` — mesma query (sem filtro por cliente cadastrado).

**Filtros aplicados depois (insuficientes para detectar órfão):**

- `registrosIntervalo` (`usePoupanca.ts:475-492`) descarta apenas "mês fantasma" — soma `|pl| + |plIni| + |nnm| + |rent| < R$ 1`. Um órfão com qualquer valor real (que é o caso típico, vindo de uma lâmina real) passa pelo filtro.

**Propagação do órfão pelos agregados:**

| Consumidor | Comportamento com órfão |
|---|---|
| `historico` (série de AUM) — `usePoupanca.ts:506-525` | Soma `pl_total` do órfão no AUM total do mês |
| `historicoMetaCumprimento` (NNM mensal) — `usePoupanca.ts:528-...` | Soma `aporte_mes_total`, rentabilidade, tombamento do órfão |
| `registrosPorCliente` (Map agrupado por nome) — `usePoupanca.ts:495-503` | Cria entrada própria com nome bruto/sigla — aparece como cliente na PoupancaTabela |
| `PoupancaKpis` (cards AUM/NNM/Rentabilidade) | Soma do órfão entra nos totais — Distorção |
| `buscarAumPorPeriodo` → AppContext (DRE/EBITDA) | `aumMap.set(nomeNormalizado, ...)`. Como o nome não bate com `clientes_base`, o AppContext SINTETIZA um Pure Asset (`AppContext.tsx:190-215`) e calcula rebate sobre o PL do órfão — entra no DRE como receita |
| `processarPeriodo` (pipeline financeiro) | Pure Asset sintetizado tem receita_rebate calculada pelo PL órfão — distorce EBITDA agregado |

**Resumo de I5:** o registro órfão polui (a) AUM total, (b) NNM agregado, (c) rentabilidade média, (d) lista de clientes na tabela de poupança, (e) PureAssets sintetizados no AppContext, (f) receita de rebate no DRE. Não é descartado em momento algum — não há filtro `cliente existe?` antes de somar.

A única salvaguarda é o filtro de mês fantasma (PL < R$ 1), que falha por design: lâmina de cliente real raramente tem PL zerado.

---

## CONCLUSÃO

**Em uma frase:** uma sigla nova é tratada como cidadã de primeira no fluxo offshore (modal pausa o upload e exige cadastro antes de prosseguir) e como cliente fantasma silencioso nos dois fluxos onshore (cria registro com nome bruto / sigla bruta como `nome_cliente` e polui todos os agregados).

**Risco / comportamento inesperado:**

1. **Inconsistência mata o contrato.** O usuário aprende com o fluxo offshore que "sigla nova abre modal pra cadastrar". Ao usar onshore, espera o mesmo comportamento — e na verdade está criando lixo silenciosamente.

2. **A sigla vira o nome do cliente no multi-período.** Caminho 3 é o mais grave: `nome_cliente = "XYZ_C"` (código bruto da carteira) vira o registro permanente. Mesmo que o usuário descubra depois, vai precisar do `corrigirNomeClientePoupanca` em Configurações → Manutenção para reparar — ou edição manual no Firestore.

3. **Distorção nos relatórios financeiros (DRE).** O órfão é convertido em Pure Asset sintetizado pelo AppContext e gera receita de rebate fictícia. Não há trilha que avise — só os logs `[AumIntegration]` mostram o `aumMap.size` total, sem distinguir órfãos de legítimos.

4. **Não há reconciliação automática.** Nenhum job/script periódico compara `poupanca/{nome_cliente}` contra `clientes_base/{slug}` para flaggar nomes órfãos. A correção depende de a equipe notar visualmente um cliente "estranho" na tabela.

5. **A função canônica `resolverSigla` existe e está madura** (5 caminhos, fallback Firestore, warnings auditáveis), mas está sub-aproveitada — usada SÓ no offshore. Caminhos 2 e 3 reimplementam um lookup inline mais fraco, sem consultar o Firestore.

**Caminho mínimo de remediação** (fora do escopo deste relatório, mas óbvio): refatorar os caminhos 2 e 3 para usar `resolverSigla()` + retornar `siglas_nao_mapeadas` no mesmo padrão do offshore, e reusar `ResolverSiglasModal` na UI. Como o modal já está pronto e o `aplicarSiglasResolvidas` re-roda o upload, o esforço é mecânico: troca o lookup inline pela função canônica + propaga o array de pendências até o hook.
