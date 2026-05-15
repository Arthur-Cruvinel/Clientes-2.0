# Correção Estrutural — Tratamento de Siglas Órfãs na Poupança / AUM

> **Status:** planejada, não iniciada
> **Posição:** correção de causa raiz no módulo AUM & Performance (`features/poupanca/`)
> **Relação com o roadmap:** independente da Fase 2.5; pode ser priorizada à parte
> **Documento gerado em:** sessão de design (Claude.ai, arquiteto/planejador)

---

## 1. Por que esta correção existe

O módulo AUM & Performance recebe dados de poupança de várias fontes. Cada registro precisa ser atribuído a um cliente — a ligação é feita pela **sigla** do cliente, resolvida contra o `MAPEAMENTO_SIGLAS`.

O diagnóstico `diagnostico-sigla-orfa-poupanca-2026-05-14T20-39-04.md` revelou que **não existe um procedimento único** para "sigla nova sem cliente cadastrado" — existem três comportamentos divergentes:

| Fluxo | Arquivo | Comportamento com sigla órfã |
|---|---|---|
| **Offshore** (lâminas Galápagos/Andbanc/JPM) | `parsers/parseComClaude.ts` → `parseOffshoreComClaude` | **Proteção completa.** Item não entra em `registros[]`, vai para `siglas_nao_mapeadas[]`, fluxo pausa, abre `ResolverSiglasModal`, usuário cadastra, grava no Firestore, re-roda upload. |
| **Onshore single-period** | `parsers/parseComClaude.ts` → `parseOnshoreComClaude` | **Cliente fantasma silencioso.** Lookup inline simples, sem consultar Firestore. Fallback final: `item.nome_cliente` (nome bruto). Cria registro sem aviso, sem pausa. |
| **Onshore multi-período** | `useImportPoupanca.ts` → `processarMultiPeriodo` | **Cliente fantasma silencioso, pior.** Fallback final: a **própria sigla bruta** vira `nome_cliente` (ex: `XYZ_C`). Gera N docs (um por mês). Sem aviso, sem pausa. |
| Upload Excel | `upload/parseExcel.ts` → `parsePoupanca` | Não usa sigla — lê `nome_cliente` direto. Fora do escopo deste problema. |

O offshore foi feito **certo** — tem a função canônica `resolverSigla(codigo, nome?)` (5 caminhos de lookup, consulta o complemento Firestore `mapeamento_siglas/`), e o comentário no código (`parseComClaude.ts:227`) confirma a intenção: *"evita cliente fantasma silenciosamente nos dados."*

Os dois fluxos onshore têm **lookup inline simplificado** que ignora a fonte canônica. Esta correção é, na essência, uma **lacuna de paridade**: dar ao onshore a proteção que o offshore já tem.

### Impacto comprovado

O diagnóstico `diagnostico-orfaos-legados-poupanca-2026-05-14T21-21-43.md` quantificou o estrago:

- Órfãos legados criados em produção: poucos em volume, mas com efeitos reais — incluindo **duplicação de ~R$ 15M de AUM** (o caso "Wenderson fantasma" + "Wenderson real" coexistindo), e **rebate fictício no DRE/EBITDA** (o `AppContext` sintetiza o órfão como Pure Asset e gera receita que não existe).
- O **vazamento está ativo**: o lixo de teste `RIA_BTG` cresceu de 2 para 13 documentos entre 08-mai e 14-mai — 11 docs novos em poucos dias, gerados por upload onshore enquanto a causa raiz não estava corrigida.

O legado já foi limpo (commit `366d7f0`). Esta correção trata a **causa raiz** — para o vazamento parar.

---

## 2. O modelo escolhido pelo CFO

Durante o design, o CFO definiu explicitamente o comportamento desejado para o onshore — que **não é** o modelo do offshore (pausar e resolver na hora) nem o silêncio atual. É um terceiro modelo: **importar e reconciliar depois.**

As quatro decisões fechadas:

### Decisão 1 — A importação onshore não para

Diferente do offshore, o fluxo onshore **roda até o fim sem interrupção**. Sigla não resolvida não pausa o import.

Justificativa: o CFO trabalha com importações que podem ter muitas siglas; parar a cada sigla nova quebraria o fluxo. Ele prefere importar tudo e reconciliar num segundo momento.

### Decisão 2 — Sigla não resolvida vai para quarentena (não é descartada, não vira fantasma)

O registro de uma sigla não resolvida **não é descartado** e **não vira cliente fantasma**. Ele é gravado, mas marcado com um **estado de quarentena** que o identifica como "pendente de normalização".

Justificativa: descartar perderia o dado (a lâmina é real); virar fantasma é o problema atual. A quarentena preserva o dado sem contaminar nada.

### Decisão 3 — Ao fim da importação, um relatório de pendências

Terminada a importação, o sistema apresenta um **relatório** listando as siglas que caíram em quarentena. É a partir desse relatório que o CFO faz a normalização.

### Decisão 4 — Quarentena = fora dos agregados até ser normalizado (Leitura A)

Esta é a decisão mais importante para a integridade dos números. Um registro em quarentena **não conta** em nenhum agregado: nem AUM total, nem NNM, nem rentabilidade média, nem rebate, nem EBITDA, nem na tabela de clientes da Visão Geral. Ele está em **limbo**.

Só quando o CFO normaliza a sigla (aponta para o cliente correto / cadastra o cliente) é que o registro **sai da quarentena** e passa a contar.

Justificativa: o CFO escolheu, entre "AUM faltando um pedaço identificado, mas correto no que mostra" e "AUM completo, mas contaminado", a primeira opção. É coerente com a diretriz "qualidade do resultado em primeiro lugar". A Visão Geral mostra só o que está resolvido; a presença de pendências é sinalizada, mas os números exibidos são confiáveis.

**O "limbo" é um estado, não um lugar.** O registro vive em `poupanca/` como qualquer outro — apenas com um campo de status que o exclui dos cálculos. Todo consumidor de dados de poupança passa a filtrar esse estado.

---

## 3. Escopo da correção — 3 frentes

> O escopo foi **calibrado pelos números**. O volume real de órfãos é baixo (poucos casos ao longo de meses, a maioria resolvível mecanicamente). Por isso a Frente 3 é deliberadamente enxuta — não há justificativa para construir uma tela de reconciliação dedicada para ~2 casos/mês. Mesma disciplina anti-over-engineering aplicada na Fase 2.5.

> Cada frente segue o padrão de trabalho consolidado: diagnóstico/dry-run antes de apply, snapshot prévio antes de write destrutivo, validação, commit de escopo cirúrgico.

### Frente 1 — Resolução canônica + quarentena nos fluxos onshore

O coração da correção. Os dois fluxos onshore (`parseOnshoreComClaude` e `processarMultiPeriodo`) passam a:

1. Usar a função canônica `resolverSigla(codigo, nome?)` — a mesma do offshore — em vez do lookup inline simplificado. Isso, sozinho, já resolve o caso em que a sigla **existe** no `mapeamento_siglas/` do Firestore mas o onshore não estava consultando (foi o que aconteceu com MSAL e Wenderson — siglas mapeadas, ignoradas pelo onshore).
2. Quando `resolverSigla` retorna `{sigla: null, metodo: 'nao_encontrado'}` — em vez do fallback atual (nome bruto / sigla bruta como `nome_cliente`), o registro é marcado com o **estado de quarentena** e gravado assim.
3. Acumular as siglas não resolvidas para o relatório (Frente 3).

Esta frente **elimina o "fallback para fantasma"**. O fallback passa a ser a quarentena.

### Frente 2 — Filtro de quarentena em todos os consumidores

A rede de segurança. Todo código que lê `poupanca/` para compor agregados precisa **excluir** registros em quarentena. O diagnóstico nomeou os pontos:

- `usePoupanca` — a tabela de clientes e os agregados de poupança
- `aumIntegration` — a integração de AUM
- O `AppContext` — que hoje sintetiza o órfão como **Pure Asset** e gera **rebate fictício no DRE**. Este é o ponto mais crítico: é onde o órfão vira receita que não existe.
- Qualquer outro consumidor de `poupanca/` que apareça na investigação inicial

Atenção: o filtro atual existente (`usePoupanca.ts:489` — descartar se `|pl|+|plIni|+|nnm|+|rent| < R$ 1`) é **insuficiente** e não deve ser confundido com o filtro de quarentena. Uma lâmina real raramente zera tudo; o filtro de valor não pega órfão com patrimônio real. O filtro de quarentena é por **estado**, não por valor.

Se um único consumidor for esquecido nesta frente, o vazamento volta. A investigação inicial (Seção 6) precisa enumerar **todos** os consumidores antes de a frente começar.

### Frente 3 — Relatório de pendências (enxuto)

Ao fim da importação onshore, exibir um relatório das siglas que caíram em quarentena: qual sigla bruta, quantos registros gerou, quais períodos.

- **O relatório: sim.** É barato e é o instrumento que o CFO pediu (Decisão 3).
- **Tela de reconciliação dedicada: não.** O volume real não justifica. A normalização **reaproveita o que já existe** — `corrigirNomeClientePoupanca` em Configurações → Manutenção. O relatório aponta o CFO para lá.
- A normalização precisa ter um efeito claro: ao corrigir a sigla/nome, o registro **sai do estado de quarentena** e passa a contar nos agregados. Verificar se `corrigirNomeClientePoupanca` já faz isso ou se precisa de um ajuste mínimo para também limpar o estado de quarentena.

Se, depois de operar por um tempo, o CFO sentir que a reconciliação via Manutenção é insuficiente, uma tela dedicada pode ser desenhada **então** — informada por uso real, não por projeção.

---

## 4. Decisões para o início da execução

Não decididas nesta sessão de design. Ficam para o começo da execução, com o código na mão:

1. **Nome e forma do estado de quarentena.** Um campo `status: 'pendente_normalizacao'` no `RegistroPoupanca`? Um booleano `pendente_normalizacao`? Afeta a interface `RegistroPoupanca` (definida no CLAUDE.md) e precisa ser type-safe. Recomendação preliminar: um campo de status explícito é mais legível e extensível que um booleano.

2. **O que o registro em quarentena guarda.** Ele precisa preservar a **sigla bruta original** (e talvez o nome bruto) em algum campo, para o relatório saber o que mostrar e para a normalização saber o que está resolvendo. Hoje, o fluxo escreve o nome/sigla bruta em `nome_cliente` — na correção, isso deve ir para um campo próprio (ex: `sigla_bruta_origem`), deixando `nome_cliente` vazio ou nulo enquanto pendente.

3. **Onde a normalização acontece.** Confirmado o reaproveitamento de `corrigirNomeClientePoupanca` (Configurações → Manutenção). Verificar no código se essa função, ao corrigir, também limpa o estado de quarentena — se não, é um ajuste mínimo dentro desta correção.

4. **Tratamento de multi-período na quarentena e na normalização.** Uma sigla órfã em multi-período gera N registros (um por mês). Decidir: ao normalizar a sigla **uma vez**, os N registros saem da quarentena **juntos**? Provavelmente sim — a normalização deve operar por sigla, não por documento. Precisa ser desenhado.

5. **Migração dos órfãos legados para o estado de quarentena formal — ou não.** O legado de órfãos *atual* já foi **deletado** (commit `366d7f0`), não migrado. Então, em princípio, **não há legado a migrar** — a coleção está limpa. Confirmar no início da execução que nenhum órfão remanescente escapou; se a investigação encontrar algum, decidir entre deletar (como foi feito) ou colocar no estado de quarentena formal.

---

## 5. Sequenciamento

```
[Concluído] Diagnóstico da causa raiz (diagnostico-sigla-orfa-poupanca)
[Concluído] Quantificação do legado (diagnostico-orfaos-legados-poupanca)
[Concluído] Limpeza do legado — 13 docs RIA_BTG deletados (commit 366d7f0)
   │
   ▼
Correção Estrutural — Tratamento de Siglas Órfãs
   │   Investigação inicial (Seção 6) — enumerar TODOS os consumidores de
   │     poupanca/; confirmar coleção limpa; identificar a origem dos
   │     uploads que geraram os 11 RIA_BTG
   │   Frente 1 (resolução canônica + quarentena nos fluxos onshore)
   │   Frente 2 (filtro de quarentena em todos os consumidores)
   │   Frente 3 (relatório de pendências — enxuto, reaproveita Manutenção)
   │
   ▼
Onshore deixa de gerar fantasmas; órfãos ficam em quarentena visível e
fora dos agregados até serem normalizados pelo CFO
```

**Relação com a Fase 2.5 e a validação mês-a-mês:** esta correção é **independente** da Fase 2.5 (vínculos de colaborador). Mas há uma sobreposição de prioridade a considerar: o CFO vai cadastrar/importar dados de poupança como parte da validação de Janeiro/26. Enquanto a causa raiz não estiver corrigida, cada importação onshore de poupança pode gerar novos fantasmas. Logo, esta correção deveria preceder — ou ao menos acompanhar — a fase de importação pesada de dados de poupança. Não é tão estritamente bloqueante quanto a Fase 2.5 é para a validação de Janeiro, mas quanto mais cedo, menos lixo a limpar depois.

---

## 6. Investigação inicial (primeiro passo da execução, antes de qualquer código)

Antes de tocar qualquer arquivo, um diagnóstico read-only que feche três pontos:

1. **Enumerar TODOS os consumidores de `poupanca/`.** A Frente 2 depende disso ser exaustivo. O diagnóstico nomeou `usePoupanca`, `aumIntegration`, `AppContext` — confirmar que não há outros (outras features que leiam poupança, exports, o sub-módulo Banker, etc.). Um consumidor esquecido = vazamento que volta.

2. **Confirmar que a coleção `poupanca/` está limpa.** O legado foi deletado, mas o vazamento estava ativo. Confirmar que nenhum órfão novo apareceu entre a limpeza (commit `366d7f0`) e o início da execução. Se houver, decidir o tratamento (deletar ou quarentena formal).

3. **Identificar a origem dos 11 docs RIA_BTG novos** (criados entre 08-mai e 14-mai). Saber **qual upload** e **qual fluxo** (onshore single ou multi-período) os gerou ajuda a confirmar qual caminho está mais ativo no vazamento — e a priorizar o teste da Frente 1.

---

## 7. Riscos e pontos de atenção

- **Frente 2 é exaustiva por natureza.** O risco principal de toda a correção é esquecer um consumidor de `poupanca/`. A investigação inicial precisa enumerar todos antes de a frente começar; a validação da frente precisa confirmar que cada um filtra o estado de quarentena.
- **Não confundir o filtro de quarentena com o filtro de valor existente.** `usePoupanca.ts:489` descarta por valor (`< R$ 1`) — é insuficiente e independente. O filtro novo é por estado.
- **`corrigirNomeClientePoupanca` pode precisar de ajuste.** Se ela não limpar o estado de quarentena ao corrigir, o registro normalizado continuaria invisível nos agregados. Verificar e ajustar se necessário — é parte da Frente 3.
- **A função `resolverSigla` é compartilhada.** Ao fazer o onshore usá-la, confirmar que nenhuma suposição interna dela é específica do offshore. Se houver, isolar a parte genérica.
- **`RegistroPoupanca` é interface no CLAUDE.md.** Adicionar o campo de status (e o campo de sigla bruta) exige atualizar a interface e o CLAUDE.md, e garantir type-safety em todos os pontos que constroem um `RegistroPoupanca`.
- **Tombamento espúrio herdado.** O diagnóstico notou que um fantasma carregava `nnm_tombamento_offshore` espúrio — o mesmo problema já mencionado no CLAUDE.md. Não é causado por esta correção, mas se aparecer em registros de quarentena durante a execução, registrar (não necessariamente corrigir aqui).
- **Upload Excel fora do escopo.** `parsePoupanca` não usa sigla — não é tocado por esta correção. Mas vale lembrar que o Upload Excel tem outro problema conhecido (usa `crypto.randomUUID()` para colaboradores), não relacionado a este, registrado no plano da Fase 2.5.

---

## 8. Definição de pronto

A correção está concluída quando:

1. Os dois fluxos onshore (`parseOnshoreComClaude` e `processarMultiPeriodo`) usam `resolverSigla` canônica — siglas que já existem no `mapeamento_siglas/` passam a ser resolvidas corretamente pelo onshore.
2. Sigla não resolvida no onshore gera registro em **estado de quarentena**, com a sigla bruta preservada em campo próprio — nunca mais um `nome_cliente` com nome/sigla bruta.
3. Todos os consumidores de `poupanca/` (enumerados na investigação inicial) filtram o estado de quarentena — registros pendentes não entram em AUM, NNM, rentabilidade, rebate, EBITDA, nem na tabela da Visão Geral.
4. O `AppContext` não sintetiza registro em quarentena como Pure Asset — zero rebate fictício a partir de órfãos.
5. Ao fim de uma importação onshore, o sistema apresenta o relatório de siglas em quarentena.
6. A normalização via `corrigirNomeClientePoupanca` (Configurações → Manutenção) tira o registro da quarentena e ele passa a contar nos agregados.
7. Um teste end-to-end: importar uma lâmina onshore com uma sigla deliberadamente desconhecida → o import termina sem parar → o registro fica em quarentena → não aparece em nenhum agregado → o relatório o lista → normalizar → o registro passa a contar.

A partir daí: o onshore tem a mesma proteção que o offshore, com o modelo "importar e reconciliar depois" que o CFO definiu.
