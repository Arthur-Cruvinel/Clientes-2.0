# Mapeamento de identidade de entidades — 2026-05-10T15-30-00

Auditoria estática (read-only) da forma como Cliente, Colaborador e Custo Indireto são tratados nos módulos do projeto. Não modifica código, não recomenda solução — só descreve o que existe.

## Sumário executivo

- Total de pontos de criação: **11** (5 cliente · 3 colaborador · 1 custo · 2 cópia entre períodos)
- Total de pontos de leitura: **18** (8 cliente · 5 colaborador · 5 custo)
- Total de pontos de atualização: **19** (8 cliente · 6 colaborador · 1 custo · 4 sincronização cross-coleção)
- Validações cruzadas encontradas: **3** (uniqueness no `NovoClienteModal`, uniqueness no `criarColaborador`, sincronização em `renomearColaborador`)
- Inconsistências aparentes identificadas: **12+** (8 implementações de `slugify` espalhadas, divergência underscore vs hífen, dois geradores de ID coexistindo, ausência de coleção mestre para colaboradores e custos, etc.)

---

## Cliente

### Pontos de criação

#### 1. `features/perfil/NovoClienteModal.tsx` (UI manual)
- Componente: `NovoClienteModal`, função `salvar()` linhas 47-95
- Coleções: **`clientes_base/{slug}`** (cadastro mestre) **+ `fechamentos/{periodo}/clientes/{slug}`** (snapshot do período)
- Slug: `clienteSlug(nome)` local — `NFD + remove combining marks + lowercase + trim + spaces→_ + remove [^a-z0-9_]`
- Validação prévia: SIM — `getDoc(clientes_base/{slug})` antes de criar; bloqueia com erro "Já existe cliente com este nome" se documento existe (linhas 59-65).

#### 2. `features/upload/useUploadImport.ts` (import Excel)
- Função: `importar()` linhas 250-266 (bloco "Clientes")
- Coleção: **`clientes_base/{slug}`** apenas — NÃO grava em `fechamentos/{periodo}/clientes/`.
- Slug: `slugify(item['nome_cliente'])` local — implementação idêntica à do `NovoClienteModal`.
- Validação prévia: nenhuma — sobrescreve via `setDoc` sem merge.

#### 3. `state/AppContext.tsx` (síntese in-memory de Pure Asset)
- Função: `carregarPeriodo()` linhas 190-215
- Coleção: **nenhuma — sintetiza objeto Cliente em memória** quando há `aumPeriodo` sem `clientesFiltrados` correspondente.
- Slug: não aplicável — objeto não é persistido.
- Validação prévia: comparação de nome normalizado contra `nomesNoFechamento` (Set normalizado: NFD + UPPER + trim) e contra `dataEntradaPorNome` (filtro p/ não sintetizar antes da `data_entrada`).

#### 4. `scripts/migrarClientesBase.ts` (one-shot)
- Função: `migrarClientesBase()` linhas 44-141
- Coleção: **`clientes_base/{slug}`** — copia campos não-calculados de `fechamentos/2025-12/clientes/*` para o cadastro mestre.
- Slug: `slugify(nome)` local — implementação idêntica.
- Validação prévia: nenhuma — `setDoc` sem merge (sobrescreve).

#### 5. `features/poupanca/import/useImportPoupanca.ts` (cria registros financeiros, NÃO clientes)
- Funções: `salvarMultiPeriodo` (linha ~373) e `salvarNoFirestore` (linha ~608)
- Coleção: **`poupanca/{slug}_{ano}_{mes}`** — não cria cliente em `clientes_base/`, só assume que ele existe ou virá depois via síntese de Pure Asset.
- Slug: derivado via `slugify(nome_cliente)` interno + concatenação `_ano_mes`.
- Validação prévia: nenhuma sobre cliente. Há `ResolverSiglasModal` que pausa o save se a sigla não está mapeada — mas isso é sobre lâmina offshore, não sobre cliente em `clientes_base/`.

### Pontos de leitura

| Arquivo | Função / hook | Coleção | Como referencia |
|---|---|---|---|
| `services/firebase.ts:43-52` | `buscarClientes(anoMes)` | `fechamentos/{anoMes}/clientes/` | docId (slug) + campo `id` |
| `services/firebase.ts:675-684` | `buscarClientesBase()` | `clientes_base/` | docId (slug) + campo `id` |
| `state/AppContext.tsx:120-122` | `carregarPeriodo` | escolhe entre `buscarClientes` (período fechado) e `buscarClientesBase` (aberto) | objeto `Cliente` |
| `features/perfil/usePerfil.ts:46-55` | `clientes` memo | consome `dadosPeriodo.clientes` | `cliente.id` para seleção |
| `features/colaboradores/useColaboradores.ts:56` | derivados | consome `dadosPeriodo.clientes` | `cliente.nome_cliente === col.nome_colaborador` (match por NOME) |
| `features/visao-geral/useVisaoGeral.ts:20-29` | `clientes` memo | consome `dadosPeriodo.clientes` (mescla com poupança via `mesclarTodos`) | objeto `DadosCliente` |
| `services/aumLegado.ts:23-34` | `buscarAumLegado` | itera `clientes_base/` para acessar `patrimonio/{slug}/investimentos/` | docId do `clientes_base/` é a chave do patrimônio |
| `features/poupanca/usePoupanca.ts` | dadosPeriodo.clientes | consome `dadosPeriodo.clientes` (apenas para taxa de rebate, banker etc.) | normalização local NFD+UPPER para casamento com `poupanca/` |

Fallback quando entidade não existe:
- `AppContext` sintetiza Pure Asset (cliente in-memory) quando `aumPeriodo` tem nome ausente do fechamento.
- `useColaboradores` filtra "linhas-fantasma" (sem nome+cargo+função).

### Pontos de atualização

| Arquivo | Função | Coleção tocada | Comentário |
|---|---|---|---|
| `services/firebase.ts:630-642` | `atualizarCliente(periodo, clienteId, dados)` | `fechamentos/{periodo}/clientes/{id}` | usa `cliente.id` (que para clientes via fechamento é igual ao slug) |
| `services/firebase.ts:689-700` | `salvarClienteBase(cliente)` | `clientes_base/{slug}` | re-derivação inline do slug a partir de `cliente.nome_cliente` (ignora `cliente.id`) |
| `services/firebase.ts:715-735` | `salvarPerfilComplexidade` | `clientes_base/{slug}.perfil_complexidade` + opcional `fechamentos/{periodo}/clientes/{id}` (volume) | usa `clienteSlug(nome)` E `clienteId` em campos diferentes do mesmo cliente |
| `services/firebase.ts:752-781` | `fecharPeriodo` | copia `clientes_base/*` → `fechamentos/{periodo}/clientes/*` (batches) | preserva docId entre coleções |
| `services/firebase.ts:804-814` | `registrarAlteracao` | `clientes_base/{slug}/historico_alteracoes/` (subcoleção) | derivação `clienteSlug(nome)` |
| `services/firebase.ts:841-873` | `corrigirNomeClientePoupanca(antigo, novo)` | itera `poupanca/` e atualiza campo `nome_cliente`. **Não renomeia o docId** (que mantém slug do nome antigo). | match exato + match normalizado (NFD+lowercase+trim) |
| `features/perfil/usePerfil.ts:113-115` | `salvarCliente` | `salvarClienteBase` (escreve `clientes_base/{slug}`) | mescla `clienteSelecionado` + `dados` antes de gravar |
| `features/perfil/usePerfil.ts:132-134` | `atualizarCampoEmLote` | mesma rota — itera `salvarClienteBase` | usa `c.id` apenas para filtragem |
| `features/colaboradores/useColaboradores.ts:113-117` | `salvarPct(nomeCliente, funcao, valor)` | `setDoc merge` em `fechamentos/{periodo}/clientes/{id}` | usa `cliente.id` (NÃO regenera slug) |
| `features/perfil/useAlocacaoEmLote.ts:159-185` | `salvarTodos` | `batch.set merge` em `fechamentos/{periodo}/clientes/{id}` | mesmo padrão |
| `services/firebase.ts:1005-1015` | `excluirClientePeriodo` | `deleteDoc(fechamentos/{periodo}/clientes/{id})` | apenas no período |
| `services/firebase.ts:1020-1052` | `excluirClientePermanente` | varre `collectionGroup('clientes')` + `deleteDoc(clientes_base/{id})` | irreversível |

### Validações cruzadas

1. **`NovoClienteModal.tsx:59-65`** — checagem `getDoc(clientes_base/{slug})` antes de criar. **Única validação preventiva sobre cliente existente.** Não verifica `poupanca/`, `fechamentos/`, ou normalização cross-fonte.

2. **`renomearColaborador` em `firebase.ts:369-494`** — sincroniza nome do colaborador através de:
   - `fechamentos/{periodo}/clientes/{id}` (6 campos de função)
   - `clientes_base/{slug}` (mesmos 6 campos)
   - `fechamentos/{periodo}/colaboradores/{id}` (campo `nome_colaborador`)

3. **Síntese de Pure Asset em `AppContext.tsx:176-215`** — comparação normalizada (NFD + UPPER + trim) entre `aumPeriodo` (de `poupanca/`) e `clientesFiltrados` (de `clientes_base/` ou `fechamentos/`). Não escreve nada — só evita duplicar Pure Asset.

Nenhuma validação cruzada existe entre:
- `clientes_base/` ↔ `poupanca/` (slugs podem divergir; foi exatamente o caso Kevin/Tamires)
- `clientes_base/` ↔ `mapeamento_siglas/`
- `clientes_base/` ↔ `patrimonio/{slug}/`
- Cliente sintetizado Pure Asset ↔ qualquer cadastro persistido

### Inconsistências aparentes

1. **Múltiplos `slugify` para cliente, todos idênticos funcionalmente, em arquivos diferentes:**
   - `services/firebase.ts:796-799` (função `clienteSlug` privada)
   - `services/firebase.ts:690-693` (inline em `salvarClienteBase` — duplicação literal da `clienteSlug`)
   - `features/perfil/NovoClienteModal.tsx:26-29` (`clienteSlug` local)
   - `scripts/migrarClientesBase.ts:28-36` (`slugify` local)
   - `features/upload/useUploadImport.ts:40-45` (`slugify` local)
   - `services/revisao.ts:12-20` (`slugify` exportada)
   - `features/poupanca/DetalheMetaLote.tsx:17-20` (`slugify` local)
   - `features/poupanca/DetalheLinhaEdit.tsx:20-23` (`slugify` local)
   - `features/upload/GerenciarDados.tsx:56` (`slugify` local)
   - `features/poupanca/PoupancaMetaLote.tsx` (provável — ver Apêndice)
   - `features/patrimonio/parsePatrimonioExcel.ts:23` (`slugify` local)
   - `utils/exporters/exportExcel.ts:14` (`slugify` para nome de arquivo, escopo diferente — não cria docId)

2. **`useUploadImport` cria cliente em `clientes_base/` mas NÃO em `fechamentos/{periodo}/clientes/`.** O `NovoClienteModal` cria nas duas. Resultado: cliente importado via Excel só aparece em períodos abertos (que leem `clientes_base/`) — em períodos fechados (que leem `fechamentos/`) ele só aparece se for `fecharPeriodo` posterior.

3. **`useImportPoupanca` cria docs em `poupanca/{slug}_{ano}_{mes}` derivando o slug do `nome_cliente` da lâmina, sem checar se cliente existe em `clientes_base/`.** O slug do `poupanca/` pode divergir do slug do `clientes_base/` se o nome diferir minimamente (acentos, caixa, espaços) — foi a causa concreta do problema Kevin/Tamires.

4. **`AppContext.sintetizarPureAsset` cria cliente em memória sem persistir.** O objeto não tem `id` (campo) e a maior parte do código de update (`atualizarCliente`, `salvarPct`, etc.) depende de `c.id` para escrever — então um Pure Asset não é editável até alguém criar manualmente em `clientes_base/`.

5. **`corrigirNomeClientePoupanca` atualiza o campo `nome_cliente` mas mantém o `docId` antigo.** Cliente continua acessível pelo slug do nome antigo. Renomear de "Tamires" para "Tamires Cassia Dias de Britto" não move o doc de `tamires_2025_01` para `tamires_cassia_dias_de_britto_2025_01`.

6. **`clienteSlug` privada em `firebase.ts:796` E inline em `salvarClienteBase:690`** — mesma lógica declarada duas vezes no MESMO arquivo.

7. **`AlocacaoEmLote` e `useColaboradores.salvarPct` usam `cliente.id` direto** sem regenerar slug. Funciona enquanto `id === slug`, mas quebra silenciosamente se houver inconsistência (cliente com `id` armazenado de uma rodada e slug atual diferente).

8. **`fecharPeriodo` em `firebase.ts:752-781` copia `clientes_base/{slug}` para `fechamentos/{periodo}/clientes/{id}` usando o mesmo `slug`** — preserva consistência DENTRO desse período, mas não verifica se o `slug` atual em `clientes_base/` é o mesmo de `fechamentos/{periodo-1}/clientes/` (período anterior). Se o slug mudar entre fechamentos, fica histórico fragmentado.

---

## Colaborador

### Pontos de criação

#### 1. `features/colaboradores/useColaboradores.ts:123-132` (UI manual via `criarColaborador`)
- Hook: `useColaboradores`, função `criarColaborador(novo)` linhas 123-132
- Coleção: **`fechamentos/{periodoSelecionado}/colaboradores/{slug}`** apenas (não há coleção mestre).
- Slug: `slugificar(nome_colaborador)` em linhas 45-48 — `NFD + lower + trim + spaces→- + remove [^a-z0-9-]`. **Usa hífen, não underscore.**
- Validação prévia: SIM — verifica se já existe colaborador com mesmo `id` ou mesmo `nome_colaborador` no período (linha 127). Se existir, lança erro.

#### 2. `features/upload/useUploadImport.ts:243-244` (import Excel)
- Função: `importar()` no bloco "Colaboradores"
- Coleção: **`fechamentos/{periodo}/colaboradores/{UUID}`** — usa `crypto.randomUUID()` em `escreverBatch` linha 192.
- Slug: **NÃO usa slug. Usa UUID aleatório.**
- Validação prévia: nenhuma — wipe-and-replace (deleta tudo do período antes de gravar).

#### 3. `services/firebase.ts:536-571` (cópia entre períodos)
- Função: `copiarPeriodo(origem, destino)` (referenciada no `AppContext` como auto-cópia quando o período está vazio)
- Coleção: copia `fechamentos/{origem}/colaboradores/*` → `fechamentos/{destino}/colaboradores/*` preservando docId.

### Pontos de leitura

| Arquivo | Função | Coleção | Como referencia |
|---|---|---|---|
| `services/firebase.ts:58-67` | `buscarColaboradores(anoMes)` | `fechamentos/{anoMes}/colaboradores/` | docId + campo `id` |
| `services/firebase.ts:88-101` | `buscarPeriodosDoColaborador(id)` | `collectionGroup('colaboradores')` filtrado por `d.id === colaboradorId` | docId puro |
| `services/firebase.ts:198-219` | `buscarDadosFolhaPorPeriodo` | `fechamentos/{periodo}/colaboradores/{id}` para múltiplos colabs em paralelo | `c.id` |
| `state/AppContext.tsx:122` | `buscarColaboradores` no `Promise.all` do load | (idem `buscarColaboradores`) | enriquecido com `calcularFolhaColaborador` antes de expor |
| `features/colaboradores/useColaboradores.ts` | consome `dadosPeriodo.colaboradores` | (já carregado) | objeto `Colaborador` |

Fallback quando entidade não existe:
- `useColaboradores` filtra "linhas-fantasma" — `c.nome_colaborador?.trim() && c.cargo?.trim() && c.funcao_principal` (linha 60).
- Cliente referencia colaborador por NOME no campo `consultoria_gestao`, etc. — match por nome literal, sem dereference de docId.

### Pontos de atualização

| Arquivo | Função | Coleção | Comentário |
|---|---|---|---|
| `services/firebase.ts:73-83` | `salvarColaboradorPeriodo(anoMes, colab)` | `setDoc(fechamentos/{anoMes}/colaboradores/{colab.id})` | exige `colab.id` (lança erro se ausente) |
| `services/firebase.ts:332-350` | `salvarHistoricoReajustes` | `updateDoc(fechamentos/{periodo}/colaboradores/{id})` campos `historico_reajustes`, `salario_teto_cargo`, `liquido_acordado` | espelho do reajuste mais recente |
| `services/firebase.ts:135-191` | `propagarFolhaColaborador` | varre `collectionGroup('colaboradores')` filtrando `d.id === colaboradorId` + filtro de períodos + batch update | reaplica `historico_reajustes` em vários períodos |
| `services/firebase.ts:236-327` | `propagarFolhaTodosColaboradores` | mesma rota mas para todos os colabs simultaneamente — fixa `salario_teto_cargo`/`liquido_acordado` direto sem reaplicar histórico | snapshot do período-base |
| `services/firebase.ts:369-494` | `renomearColaborador` | atualiza nome em `fechamentos/{periodo}/clientes/*` (6 campos) + `clientes_base/*` + `fechamentos/{periodo}/colaboradores/*` (campo `nome_colaborador`). NÃO renomeia o docId. | match exato OU normalizado |
| `services/firebase.ts:497-571` | `deletarColaboradorPeriodo`, `deletarColaboradorPeriodosFuturos` | `deleteDoc` em períodos selecionados | escopado por período |

### Validações cruzadas

1. **`useColaboradores.ts:127`** — antes de criar, verifica `colaboradoresValidos.some(c => c.id === id || c.nome_colaborador === novo.nome_colaborador)`. Apenas dentro do período atual.

2. **`renomearColaborador`** — varredura tripla descrita acima. **Mais robusta validação cruzada do sistema.** Atualiza `nome_colaborador` em todos os pontos onde o nome é usado como referência (clientes em fechamentos, clientes_base, próprio doc do colaborador em todos os períodos).

### Inconsistências aparentes

1. **Dois geradores de docId coexistindo:**
   - UI manual (`criarColaborador`) usa `slugificar(nome)` com **hífen** (`-`).
   - Excel import (`escreverBatch`) usa `crypto.randomUUID()`.
   - Resultado: o mesmo colaborador "João Silva" criado pela UI vira `joao-silva`; importado via Excel vira `a1b2c3d4-...`. Lookups por docId não casam entre origens.

2. **Cliente referencia colaborador por NOME, não por ID.** Os 6 campos de função (`consultoria_gestao`, etc.) armazenam o `nome_colaborador` literal. Renomear o colaborador exige varredura completa para atualizar todas as referências (é o que `renomearColaborador` faz).

3. **Não existe coleção mestre `colaboradores_base/`** análoga a `clientes_base/`. Todo write é por período; não há fonte única de verdade. `propagarFolhaTodosColaboradores` usa um período-base como referência, mas isso é parametrizado, não estrutural.

4. **`renomearColaborador` atualiza `nome_colaborador` mas não migra docId.** Se o nome muda, o docId continua sendo o slug do nome antigo; novos períodos copiados via `copiarPeriodo` herdam o docId antigo.

5. **`slugificar` em `useColaboradores.ts:45-48` diverge de TODOS os outros slugify do projeto:**
   - Cliente (e tudo mais): `spaces → _`, mantém `[a-z0-9_]`.
   - Colaborador: `spaces → -`, mantém `[a-z0-9-]`.
   Função tem nome diferente também (`slugificar` vs `slugify`/`clienteSlug`).

---

## Custo Indireto

### Pontos de criação

#### 1. `features/upload/useUploadImport.ts:271` (import Excel)
- Função: `importar()` no bloco "Custos Indiretos"
- Coleção: **`fechamentos/{periodo}/custosIndiretos/{UUID}`** via `escreverBatch` (linha 192) — UUID aleatório.
- Slug: NÃO USA — `crypto.randomUUID()`.
- Validação prévia: nenhuma — wipe-and-replace (`wipeSubcollection` antes de gravar).

#### 2. `services/firebase.ts:536-571` (cópia entre períodos)
- Função: `copiarPeriodo` — copia `fechamentos/{origem}/custosIndiretos/*` → `fechamentos/{destino}/custosIndiretos/*`.

**Não há UI de cadastro manual de Custo Indireto.** Não foi encontrado componente análogo a `NovoClienteModal` ou `ColaboradorModal` para custos.

### Pontos de leitura

| Arquivo | Função | Coleção | Como referencia |
|---|---|---|---|
| `services/firebase.ts:597-606` | `buscarCustosIndiretos(anoMes)` | `fechamentos/{anoMes}/custosIndiretos/` | docId (UUID) + campo `id` |
| `state/AppContext.tsx:123` | `buscarCustosIndiretos` no `Promise.all` | (idem) | objeto `CustoIndireto` |
| `features/visao-geral/useVisaoGeral.ts:32` | consome `dadosPeriodo.custosIndiretos` | — | iterado por `tipo_custo` (geral/juridico/conciliacao) |
| `features/visao-geral/CustoIndiretoModal.tsx:26-92` | **modal de DETALHAMENTO**, não de cadastro | — | agrupa por `tipo_custo` para exibir o rateio para um cliente |
| `utils/financials.custos.ts`, `utils/financials.dre.ts`, `utils/financials.pipeline.ts` | motor de DRE | — | itera para calcular pool e ratear |
| `features/metodologia/Metodologia.tsx` | exibe metodologia | — | apresentação |
| `components/ui/ModalCopiarPeriodo.tsx` | modal cópia | — | conta itens para o resumo |

### Pontos de atualização

**Nenhum ponto de atualização individual encontrado no código.** A única forma de modificar custos indiretos é:
- Re-importar o Excel inteiro (wipe-and-replace) via `useUploadImport`.
- `copiarPeriodo` (copia de outro período).

### Validações cruzadas

**Nenhuma validação cruzada encontrada.** Não há coleção mestre, não há checagem entre períodos, não há referência cruzada com cliente/colaborador.

### Inconsistências aparentes

1. **Sem UI de cadastro/edição.** Toda mudança exige re-import Excel completo. O `CustoIndiretoModal` é apenas detalhamento read-only.

2. **DocId é UUID aleatório.** Re-importar regenera todos os IDs — não há identidade estável entre rodadas. Comparar custo entre meses só funciona via `descricao_custo` (texto livre).

3. **Wipe-and-replace silencioso.** `useUploadImport.ts:270-272` apaga toda a subcoleção do período antes de gravar a nova versão. Se algum doc tiver sido escrito por outro caminho ou se o Excel tiver linha menos, perde sem aviso.

4. **Não há coleção mestre `custosIndiretos_base/`** análoga a `clientes_base/`. Cada período é independente; herança entre períodos é só via `copiarPeriodo`.

---

## Padrões transversais (observados nas 3 entidades)

### Implementações de slugify

12+ ocorrências em arquivos diferentes do projeto. Lista completa:

| Arquivo : linha | Nome da função | Output em "João Silva" | Diferença |
|---|---|---|---|
| `services/firebase.ts:796-799` | `clienteSlug` (privada) | `joao_silva` | canônica |
| `services/firebase.ts:690-693` | inline em `salvarClienteBase` | `joao_silva` | duplicação literal da `clienteSlug` |
| `features/perfil/NovoClienteModal.tsx:26-29` | `clienteSlug` local | `joao_silva` | idêntica à canônica |
| `scripts/migrarClientesBase.ts:28-36` | `slugify` local | `joao_silva` | idêntica |
| `features/upload/useUploadImport.ts:40-45` | `slugify` local | `joao_silva` | idêntica |
| `services/revisao.ts:12-20` | `slugify` exportada | `joao_silva` | idêntica |
| `features/poupanca/DetalheMetaLote.tsx:17-20` | `slugify` local | `joao_silva` | idêntica |
| `features/poupanca/DetalheLinhaEdit.tsx:20-23` | `slugify` local | `joao_silva` | idêntica |
| `features/upload/GerenciarDados.tsx:56` | `slugify` local | `joao_silva` | idêntica (assumido — não foi inspecionada in extenso) |
| `features/poupanca/PoupancaMetaLote.tsx` | `slugify` local | `joao_silva` | provável — referenciada como write em poupanca |
| `features/patrimonio/parsePatrimonioExcel.ts:23` | `slugify` local | `joao_silva` | idêntica |
| **`features/colaboradores/useColaboradores.ts:45-48`** | **`slugificar`** | **`joao-silva`** | **DIVERGENTE — usa hífen, não underscore** |
| `utils/exporters/exportExcel.ts:14` | `slugify` (nome de arquivo) | `joao_silva` | escopo diferente (nome de download), não gera docId |

Observação adicional: `scripts/_helpers.mjs` (Node ESM, fora de `src/`) tem `slugify` exportada — usada apenas pelas auditorias offline.

### Convenção de nomenclatura de coleção

| Entidade | Coleção mestre | Coleção por período | Subcoleções |
|---|---|---|---|
| Cliente | `clientes_base/{slug}` | `fechamentos/{periodo}/clientes/{id}` | `clientes_base/{slug}/historico_alteracoes/{auto-id}` |
| Colaborador | **(não existe)** | `fechamentos/{periodo}/colaboradores/{id}` | — |
| Custo Indireto | **(não existe)** | `fechamentos/{periodo}/custosIndiretos/{UUID}` | — |

Notas:
- `custosIndiretos` em camelCase (não snake_case como o nome no Excel `custos_indiretos`).
- `clientes_base/` é a única entidade com cadastro mestre; clientes em `fechamentos/{periodo}/clientes/` são snapshots criados via `fecharPeriodo`.
- `poupanca/` (top-level, não por período) usa docId composto `{slug}_{ano}_{mes}` — referencia cliente por slug, mas não é tecnicamente "cadastro".
- `mapeamento_siglas/` (top-level) é índice de tradução, não cadastro de entidade.
- `patrimonio/{slug}/{categoria}/{id}` usa o slug do `clientes_base/` como hierarquia.

### Outros padrões dignos de nota

- **Cliente é referenciado por NOME em campos de cliente** (`consultoria_gestao`, `consultoria_planejamento`, etc. armazenam `nome_colaborador` literal). Não há FK estrutural.
- **`buscarPeriodosDoColaborador` em `firebase.ts:88-101` confia que docId do colaborador é estável entre períodos.** Funciona quando o cadastro foi propagado via `copiarPeriodo` ou `propagarFolha*`.
- **Normalização de nome em runtime** acontece em pelo menos 4 lugares com regex levemente diferentes:
  - `AppContext.tsx:176` — `NFD + remove combining + UPPER + trim`
  - `firebase.ts:374` (`renomearColaborador`) — `NFD + remove combining + lowercase + trim + colapsa espaços`
  - `firebase.ts:845` (`corrigirNomeClientePoupanca`) — `NFD + remove combining + lowercase + trim`
  - `MAPEAMENTO_SIGLAS.ts` — convenções implícitas no parser de sigla
- **`useImportPoupanca` tem agregação por slug** (`agregarItensPorCliente`) que assume que duas contas com siglas distintas resolvem para o mesmo cliente. Bug histórico (Moisés Lima) gerou docs duplicados quando a agregação não rodou.
- **Pure Asset sintetizado in-memory** em `AppContext.tsx` é a única "criação implícita" de cliente — sem persistência. Detectável apenas dentro do mesmo carregamento de período.

---

## Apêndice — Arquivos de referência

Lista bruta de todos os arquivos consultados durante esta auditoria.

```
src/services/firebase.ts
src/services/aumLegado.ts
src/services/aumIntegration.ts
src/services/revisao.ts
src/state/AppContext.tsx
src/types/index.ts
src/utils/financials.custos.ts
src/utils/financials.dre.ts
src/utils/financials.pipeline.ts
src/utils/exporters/exportExcel.ts
src/scripts/migrarClientesBase.ts
src/features/perfil/NovoClienteModal.tsx
src/features/perfil/EditarClienteModal.tsx
src/features/perfil/usePerfil.ts
src/features/perfil/useAlocacaoEmLote.ts
src/features/perfil/AlocacaoLote.tsx
src/features/perfil/AlocacaoEmLote.tsx
src/features/perfil/AlocacaoLoteAcoes.tsx
src/features/perfil/Perfil.tsx
src/features/perfil/ClienteCard.tsx
src/features/perfil/PerfilComplexidadeTab.tsx
src/features/perfil/perfilComplexidadeUI.tsx
src/features/perfil/ordenacaoAlocacao.ts
src/features/perfil/utilsAlocacao.ts
src/features/colaboradores/ColaboradoresVisao.tsx
src/features/colaboradores/useColaboradores.ts
src/features/colaboradores/PropagacaoEmMassa.tsx
src/features/colaboradores/RenomearColaboradorModal.tsx
src/features/colaboradores/ColaboradorCard.tsx
src/features/colaboradores/columns.ts
src/features/visao-geral/CustoIndiretoModal.tsx
src/features/visao-geral/useVisaoGeral.ts
src/features/visao-geral/VisaoGeral.tsx
src/features/upload/useUploadImport.ts
src/features/upload/parseExcel.ts
src/features/upload/UploadImport.tsx
src/features/upload/GerenciarDados.tsx
src/features/upload/PatrimonioImportTab.tsx
src/features/poupanca/usePoupanca.ts
src/features/poupanca/DetalheLinhaEdit.tsx
src/features/poupanca/DetalheMetaLote.tsx
src/features/poupanca/PoupancaMetaLote.tsx
src/features/poupanca/import/useImportPoupanca.ts
src/features/poupanca/import/parsers/parseComClaude.ts
src/features/poupanca/import/MAPEAMENTO_SIGLAS.ts
src/features/configuracoes/Configuracoes.tsx
src/features/metodologia/Metodologia.tsx
src/features/patrimonio/parsePatrimonioExcel.ts
src/features/patrimonio/usePatrimonioCrud.ts
src/components/ui/ModalCopiarPeriodo.tsx
src/components/ui/Modal.tsx
```

— Fim do relatório.
