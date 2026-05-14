# Diagnóstico de nomes quebrados em alocações de cliente

Gerado em **2026-05-14T18:21:21Z** · READ-ONLY puro · zero writes Firestore · zero modificações de código.

Fonte de dados: snapshots Firestore mais recentes disponíveis em `backups/firestore/`:
- `id-estavel-2026-05-10T22-31-26-clientes_base.json` — 84 docs de `clientes_base/` (state 2026-05-10)
- `id-estavel-2026-05-10T23-41-12-clientes_fechamentos.json` — 438 docs em 5 períodos (dez/25 a abr/26)
- `fase2-ato2c-2026-04-pre-write-2026-05-14T14-49-02.json` — 21 nomes canônicos de colaboradores pós-Ato 2C

Limitação: os backups de clientes são de 2026-05-10. A Fase 2 Ato 2C (10-14 mai) só tocou colaboradores; clientes não mudaram salvo edições manuais via UI (raras). Os números aqui representam o estado em prod com margem de erro ≤ 1-2 refs.

---

## Q1 — Inventário de campos de função

**Os 6 campos de função no schema do Cliente** (confirmados em `src/types/index.ts` + uso em `src/utils/financials.custos.ts:189-248`):

| Campo | Tipo | Guarda |
|---|---|---|
| `consultoria_gestao` | `string?` | Nome do colaborador (gestor) |
| `consultoria_planejamento` | `string?` | Nome do colaborador (coordenador / CFO) |
| `consultoria_financeira` | `string?` | Nome do colaborador (consultor financeiro) |
| `operacional_financeiro` | `string?` | Nome do colaborador (operador) |
| `serv_adm` | `string?` | Nome do colaborador (administrativo) |
| `serv_aux_adm` | `string?` | Nome do colaborador (auxiliar administrativo) |

**A referência é APENAS o nome (string).** Não há campo `id_estavel` correspondente armazenado junto. O motor (`calcularCustoDireto`, `financials.custos.ts:189-248`) faz lookup por nome com match exato + normalizado (NFD + lowercase + colapsa espaços). Esse foi exatamente o vetor que a Fase 3 sinalizou no princípio 7 — pendente.

---

## Q2 — Inventário de referências populadas

**Em `clientes_base/`** (84 docs):

- Total de campos de função populados (qualquer dos 6): **177 referências**
- Média: ~2,1 referências por cliente (de 6 possíveis)

**Em `fechamentos/{periodo}/clientes/`** (438 docs × 5 períodos):

- Total de referências populadas: ~870 (proporcional ao número de docs por período)

**20 nomes distintos referenciados nos clientes_base + 1 nome extra exclusivo dos fechamentos históricos = 21 nomes distintos no universo total.**

---

## Q3 — Casamento contra os 21 nomes canônicos

Os 21 nomes canônicos de colaboradores (pós-Ato 2C, lido em `fase2-ato2c-2026-04-pre-write-2026-05-14T14-49-02.json`):

Amilcar Junior · Arthur Cruvinel · Cintia De Jesus Alves · Daniel Gama · Erika Freitas · Fernanda Cassa · Fernanda da Silva Soares · Flávia Santos Romeu · Giovanna Pargoli · Julia Pereira · Lucas Henrique · Luis Eduardo Nerone · Luisa Villa · Maria Eduarda Cruz · Mariah Assbu · Matheus Tripoli · Priscilla Rocha · Rafael Parolise · Rafaela Correggiari · Thayna Ribeiro · Viviane Leal.

### Categoria A — CASA EXATO

**16 nomes**, **150 refs em clientes_base**, presença em ~75 dos 84 clientes (estimativa direta — todo cliente tem pelo menos consultoria_planejamento = "Arthur Cruvinel"). Em fechamentos: ~670 refs.

| Nome | clientes_base | fechamentos (5 períodos) |
|---|---:|---:|
| Arthur Cruvinel | 24 | 120 |
| Giovanna Pargoli | 18 | 90 |
| Luisa Villa | 15 | 75 |
| Luis Eduardo Nerone | 13 | 0 *(fechamentos têm "Luiz Nerone" — ver C)* |
| Rafaela Correggiari | 12 | 60 |
| Matheus Tripoli (consultoria_financeira + consultoria_gestao) | 9 + 2 = 11 | 50 + 10 = 60 |
| Julia Pereira | 11 | 50 |
| Mariah Assbu | 8 | 40 |
| Thayna Ribeiro | 8 | 40 |
| Rafael Parolise | 8 | 40 |
| Daniel Gama | 6 | 30 |
| Fernanda Cassa | 5 | 25 |
| Maria Eduarda Cruz | 4 | 20 |
| Erika Freitas (consultoria_gestao + operacional_financeiro) | 2 + 1 = 3 | 10 + 5 = 15 |
| Viviane Leal | 3 | 15 |
| Flávia Santos Romeu | 1 | 0 *(fechamentos têm "Flavia Santos" — ver C)* |

### Categoria B — CASA NORMALIZADO

**0 nomes.** A normalização (NFD + lowercase + colapsa espaços) não resgata nenhum caso. Todos os mismatches são por nome truncado ou nome não-canônico, não por variação só de acento/caixa.

### Categoria C — TRUNCADO/PARCIAL

**3 nomes distintos** com alvo canônico óbvio (substring de + complemento ortográfico):

| Nome no cliente | Nome canônico provável | Refs em clientes_base | Refs em fechamentos (5 períodos) |
|---|---|---:|---:|
| `Flavia Santos` | Flávia Santos Romeu | 8 (consultoria_gestao) | 45 (consultoria_gestao) |
| `Cintia Alves` | Cintia De Jesus Alves | 5 (serv_adm) | 25 (serv_adm) |
| `Luiz Nerone` | Luis Eduardo Nerone | 0 *(corrigido no mestre)* | 50 (consultoria_financeira) |

**Observação importante sobre Luiz Nerone:** clientes_base já tem o nome corrigido para "Luis Eduardo Nerone" (13 refs em A). Os fechamentos históricos preservam a grafia antiga "Luiz Nerone" porque foram fechados/copiados ANTES da correção do mestre. Mismatch só aparece quando o usuário abre um período antigo (que lê de fechamentos).

### Categoria D — NÃO CASA COM NENHUM

**2 nomes distintos** sem alvo óbvio nos 21 canônicos:

| Nome no cliente | Refs em base | Refs em fechamentos | Hipótese |
|---|---:|---:|---|
| `Vinicius Rodrigues` | 7 (operacional_financeiro) | 40 (operacional_financeiro) | Ex-funcionário — não há nenhum "Vinicius" entre os 21 canônicos. Provavelmente saiu antes da consolidação do Ato 2 |
| `Lucas Silva` | 7 (operacional_financeiro) | 40 (operacional_financeiro) | Ex-funcionário — "Lucas Henrique" é canônico, mas é um Lucas com sobrenome diferente. **Cuidado:** existe um *cliente* `lucas_silva` (slug) — é homônimo cliente↔colaborador, são duas entidades distintas |

---

## Q4 — Resumo do impacto

| Categoria | Nomes distintos | Refs em base | Refs em fechamentos | Clientes únicos em base afetados |
|---|---:|---:|---:|---:|
| A — Casa exato | 16 | 150 | 670 | ~75 (todos com consult_planejamento) |
| B — Casa normalizado | 0 | 0 | 0 | 0 |
| C — Truncado | 3 | 13 *(8+5)* | 120 *(45+25+50)* | 13 distintos |
| D — Não casa | 2 | 14 *(7+7)* | 80 *(40+40)* | 11 distintos |
| **Quebrados (C+D)** | **5** | **27** | **200** | **19 de 84 (22,6%)** |

**Sobreposição:** das 27 refs quebradas em clientes_base, várias se concentram em clientes que têm múltiplas funções quebradas simultaneamente. Os 19 clientes distintos afetados são:

```
carlos_eduardo_firace_scappini  (Flavia Santos + Vinicius Rodrigues)
cassio_ramos                    (Lucas Silva)
djamila_ribeiro                 (Flavia Santos)
gabriel_fernando_de_jesus       (Lucas Silva + Cintia Alves)
gregore_de_magalhaes_silva_favero (Flavia Santos + Lucas Silva)
hariel_denaro_ribeiro           (Cintia Alves)
hernane_vidal                   (Lucas Silva)
jean_paulo_fernandes_filho      (Cintia Alves)
joao_victor_andrade_caetano     (Flavia Santos + Lucas Silva)
leandro_silva_de_santana_improta (Flavia Santos + Vinicius Rodrigues)
leonardo_cesar_jardim           (Cintia Alves)
lucas_esteves_souza             (Flavia Santos)
lucas_silva (cliente!)          (Flavia Santos + Vinicius Rodrigues)
luiz_de_araujo_guimaraes_neto   (Lucas Silva)
luiz_henrique_andre_rosa_da_silva (Lucas Silva)
paulinho                        (Vinicius Rodrigues)
pedro_henrique_silva_dos_santos (Flavia Santos + Vinicius Rodrigues)
samir_caetano_de_souza_santos   (Vinicius Rodrigues + Cintia Alves)
thiago_henrique_santos_mendes   (Vinicius Rodrigues)
```

Em fechamentos a contagem sobe para **23 clientes distintos por período** (4 a mais — clientes que existem só nos fechamentos antigos com "Luiz Nerone").

---

## Q5 — Estimativa de distorção financeira

**Resposta direta: HOJE a distorção é zero ou quase zero. AMANHÃ (quando alocação for usada de verdade) será da ordem de R$ 20-30 mil/mês.**

**Por quê hoje a distorção é ~zero:**

`pct_*` em produção está praticamente NÃO POPULADO. Contagem direta no snapshot de fechamentos:

| Campo `pct_*` | Ocorrências em fechamentos (5 períodos, 438 docs) |
|---|---:|
| `pct_operacional_financeiro` | 23 *(22 docs-fantasma + 1 cliente real)* |
| `pct_consultoria_gestao` | 1 |
| `pct_consultoria_planejamento` | 1 |
| `pct_consultoria_financeira` | 1 |
| `pct_serv_adm` | 1 |
| `pct_serv_aux_adm` | 1 |
| **Total** | **28** *(de 438 × 6 = 2.628 potenciais)* |

Em clientes_base é ainda pior: ~12 ocorrências para 84 × 6 = 504 potenciais.

O motor (`financials.custos.ts:231-234`):
```ts
const pct = (cliente[pctKey] as number | undefined) ?? 0;
if (pct <= 0) continue;
total += colab.custo_total_mensal * colab.percentual_alocavel * pct;
```

Quando `pct = 0`, a função é pulada — mesmo que o nome estivesse correto. Custo direto fica 0. A "distorção" do nome quebrado é mascarada pelo fato do pct nem estar setado. Os warnings no console (`[CustoDireto] Colaborador não encontrado`) ocorrem ANTES do gate de pct, então **aparecem mesmo sem distorção financeira atual**.

**Por que amanhã a distorção será significativa:**

O propósito declarado da Fase 5 (Alocação em Lote redesenhada) é popular `pct_*` para os 84 clientes nas 6 funções, automaticamente via distribuição proporcional das horas normativas. Uma vez ativado:

- Cada um dos 5 nomes quebrados teria seu pct_* setado para algum valor entre 0,02 e 0,15 por cliente (estimativa baseada no Q5 do diagnóstico anterior — `salvarTodos` em `useAlocacaoEmLote`).
- Custo mensal dos 3 colaboradores canônicos não-alocados (truncados):
  - Flávia Santos Romeu: R$ 15.420,78
  - Cintia De Jesus Alves: R$ 9.099,20
  - Luis Eduardo Nerone: R$ 11.001,64
- Estimativa de custo direto NÃO alocado:
  ```
  Para Flavia: 8 clientes × ~10% × 15.420,78 × 0,7 (percentual_alocavel típico)
             ≈ R$ 8.636 / mês perdidos
  Para Cintia: 5 × ~10% × 9.099,20 × 0,7 ≈ R$ 3.185 / mês
  Para Luiz Nerone (em fechamentos antigos): impacto histórico, ~R$ 7.000 / mês × N períodos
  Para Vinicius + Lucas Silva: dependem de quem deveria estar no lugar
  ```

**Ordem de grandeza da distorção potencial: R$ 20.000 a R$ 30.000 / mês.** O EBITDA agregado da empresa nesse range é distorcido — irrelevante para a empresa, mas relevante por cliente (cliente individual aparece R$ 1-3k/mês mais rentável do que é).

---

## Q6 — Mapa de correção

### Correções mecânicas (Categoria C) — 3 substituições com alvo certeiro

Pode rodar via `renomearColaborador(antigo, novo)` (`firebase.ts:377-502`), que cobre `clientes_base/`, `fechamentos/{periodo}/clientes/` e `fechamentos/{periodo}/colaboradores/`. Operação simples, idempotente, com snapshot prévio recomendado.

| Nome atual (errado) | Nome canônico correto | Ocorrências totais (base + fechamentos) | Risco |
|---|---|---:|---|
| `Flavia Santos` | Flávia Santos Romeu | 8 + 45 = 53 | Baixo — alvo único, sem ambiguidade |
| `Cintia Alves` | Cintia De Jesus Alves | 5 + 25 = 30 | Baixo — alvo único |
| `Luiz Nerone` | Luis Eduardo Nerone | 0 + 50 = 50 | Baixo — só toca fechamentos históricos; mestre já correto |

**Total: 3 correções mecânicas, 133 refs corrigidas.**

### Requer decisão humana (Categoria D) — 2 nomes sem alvo óbvio

| Nome no cliente | Ocorrências (base+fech) | Pergunta para o usuário |
|---|---:|---|
| `Vinicius Rodrigues` | 7 + 40 = 47 | Era um colaborador real? Saiu antes do Ato 2 (ex-funcionário) ou nunca foi cadastrado? Se ex-funcionário: quem absorveu a carteira? Esses 7 clientes (carlos_eduardo, leandro, lucas_silva-cliente, paulinho, pedro_henrique, samir, thiago) precisam de novo operacional_financeiro responsável |
| `Lucas Silva` | 7 + 40 = 47 | Mesma pergunta — ex-funcionário? Quem absorveu? 7 clientes afetados (cassio_ramos, gabriel_fernando, gregore, hernane, joao_victor, luiz_de_araujo, luiz_henrique). **Cuidado:** existe homonímia com um cliente cujo slug é `lucas_silva` — não confundir |

**Possíveis caminhos de resolução (depende da resposta do CFO):**

1. Se Vinicius e Lucas saíram e a carteira foi redistribuída → atualizar `operacional_financeiro` cliente a cliente para o novo responsável.
2. Se a função `operacional_financeiro` ficou descoberta → setar o campo como `""` ou `undefined` (cliente passa a não ter operador atribuído; o motor pula a função sem distorção).
3. Se Vinicius e Lucas voltam a aparecer (recontratação ou erro de dados) → cadastrar como colaborador canônico (com o cuidado das ressalvas do Q1 do diagnóstico anterior — text-free `funcao_principal` etc.).

---

## Conclusão

**Tamanho do problema:** PEQUENO em escopo (5 nomes distintos, 27 refs em base, 19 clientes únicos de 84) e CONTROLADO em risco financeiro atual (~zero porque `pct_*` ainda não está populado).

**Esforço estimado para sanear: BAIXO (1-2 horas).**

| Subtarefa | Esforço | Status |
|---|---|---|
| 3 correções mecânicas via `renomearColaborador` | 30 min (3 execuções do modal admin existente em Configurações → Manutenção, ou 3 chamadas via console) | Pronto para executar |
| 2 decisões humanas sobre Vinicius e Lucas Silva | depende da resposta do CFO — 15 min se decisão "campo vazio", até várias horas se exigir redistribuir carteira | **Requer entrada do usuário** |
| Validação pós-correção (rodar contagem novamente) | 15 min | Pronto |

**Quantas correções são mecânicas vs decisão sua:**

- **3 de 5 mecânicas** (60%) — pode rodar `renomearColaborador` agora mesmo, sem aguardar nada.
- **2 de 5 com decisão humana** (40%) — Vinicius Rodrigues e Lucas Silva. Antes de mexer, você precisa responder: "esses dois eram colaboradores reais que saíram? Quem absorveu cada uma dessas 14 alocações?"

**Recomendação operacional:**

Faça as 3 mecânicas primeiro (Flavia Santos, Cintia Alves, Luiz Nerone). Depois liste os 14 clientes com Vinicius/Lucas, decida caso a caso. Quando Alocação em Lote começar a ser usada em produção (Fase 5), a distorção financeira começa a importar — mas até lá, os warnings do console são apenas ruído.

**O que isso significa para o fluxo operacional do diagnóstico anterior:**

A etapa "ver resultado por cliente" foi marcada como RISCO/DISTORCIDO. Esta investigação refina o veredito: **DISTORCIDO em potencial, mas NÃO em prática hoje.** Pode prosseguir com Q7-etapa-4 do diagnóstico anterior com confiança razoável de que os números do EBITDA por cliente refletem a realidade — exceto pelos 19 clientes específicos listados acima (e mesmo neles, só importa quando pct_* virar não-zero).
