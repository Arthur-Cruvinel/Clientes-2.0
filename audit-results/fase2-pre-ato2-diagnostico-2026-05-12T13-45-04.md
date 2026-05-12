# Diagnóstico pré-Ato 2 — Fase 2

Gerado em **2026-05-12T13:43:20Z** · READ-ONLY · nenhum arquivo modificado · nenhum write Firestore.

Fonte de dados Firestore: `scripts/diagPreAto2.mjs` (one-shot descartável). Saída JSON em `diag-output.json` — não comitada.

---

## Q1 — Lista real dos 21 colaboradores em `colaboradores_base/`

**Total no Firestore: 21** (esperado: 21) ✅

Ordenado por `nome_colaborador` (pt-BR):

| # | docId (slug) | nome_colaborador | cargo | id_estavel | funcao_principal | cadastro_completo | alocavel | tipo_vinculo |
|---|---|---|---|---|---|---|---|---|
| 1 | `amilcar_junior` | Amilcar Junior | Sócio | `14ee0914-…` | `""` | false | false | clt |
| 2 | `arthur_cruvinel` | Arthur Cruvinel | Coordenador Financeiro | `171207fb-…` | `""` | false | true | clt |
| 3 | `cintia_de_jesus_alves` | Cintia De Jesus Alves | Assistente Administrativo | `d7becf48-…` | `""` | false | true | clt |
| 4 | `daniel_gama` | Daniel Gama | Coordenador de Gestão de Atletas | `cf38ae97-…` | `""` | false | true | clt |
| 5 | `erika_freitas` | Erika Freitas | Superintendente Administrativo | `3770fa22-…` | `""` | false | true | clt |
| 6 | `fernanda_cassa` | Fernanda Cassa | Gerente de Gestão de Atletas | `adcd1156-…` | `""` | false | true | clt |
| 7 | `fernanda_da_silva_soares` | Fernanda da Silva Soares | Assistente Administrativo | `f6d466c2-…` | `""` | false | true | clt |
| 8 | `flavia_santos_romeu` | Flávia Santos Romeu | Analista de Gestão | `a063e11b-…` | `""` | false | true | clt |
| 9 | `giovanna_pargoli` | Giovanna Pargoli | Analista Administrativo | `ed67478f-…` | `""` | false | true | clt |
| 10 | `julia_pereira` | Julia Pereira | Operador Financeiro | `9cb609bb-…` | `""` | false | true | clt |
| 11 | `lucas_henrique` | Lucas Henrique | Operador Financeiro | `a5a8437d-…` | `""` | false | true | clt |
| 12 | `luis_eduardo_nerone` | Luis Eduardo Nerone | Supervisor Financeiro | `ac6922ca-…` | `""` | false | true | clt |
| 13 | `luisa_villa` | Luisa Villa | Assistente Administrativo | `5c89d401-…` | `""` | false | true | clt |
| 14 | `maria_eduarda_cruz` | Maria Eduarda Cruz | Estágio Administrativo | `b8174275-…` | `""` | false | true | clt |
| 15 | `mariah_assbu` | Mariah Assbu | Estágio Administrativo | `88680a4d-…` | `""` | false | true | clt |
| 16 | `matheus_tripoli` | Matheus Tripoli | Assistente Financeiro | `ad77ac7e-…` | `""` | false | true | clt |
| 17 | `priscilla_rocha` | Priscilla Rocha | Sócio | `f7940cec-…` | `""` | false | false | clt |
| 18 | `rafael_parolise` | Rafael Parolise | Supervisor Financeiro | `a4409d3d-…` | `""` | false | true | clt |
| 19 | `rafaela_correggiari` | Rafaela Correggiari | Analista Administrativo | `f5e82fbf-…` | `""` | false | true | clt |
| 20 | `thayna_ribeiro` | Thayna Ribeiro | Assistente Administrativo | `aad757c6-…` | `""` | false | true | clt |
| 21 | `viviane_leal` | Viviane Leal | CEO | `233c4c24-…` | `""` | false | true | clt |

### Confirmações:

- ✅ Todos os 21 docs têm `funcao_principal = ""` (vazio, conforme schema do Ato 1)
- ✅ Todos os 21 docs têm `cadastro_completo = false` (conforme schema do Ato 1)
- ✅ Todos têm `id_estavel` herdado da Fase 3 Sub-fase 3C parte 3
- ✅ Todos têm `tipo_vinculo = "clt"` (default ou explicitamente populado)
- 2 docs com `alocavel = false`: Amilcar Junior e Priscilla Rocha (sócios institucionais)

### Comparação com relatórios:

| Comparação | Resultado |
|---|---|
| Firestore vs `fase2-ato1-dry-run-2026-05-11T22-35-53.md` | ✅ **IDÊNTICA** (21=21, mesmos docId/nome/id_estavel) |
| Firestore vs `fase2-ato1-aplicado-2026-05-12T12-20-02.md` | n/a (relatório do apply contém apenas agregados `{total, criados, erros, snapshot}`, não a lista detalhada; não cabe comparação item-a-item) |

**Conclusão Q1:** ✅ APROVADO — lista real bate exatamente com o que foi planejado no dry-run.

---

## Q2 — Estado dos snapshots de colaboradores

| Período | Total docs | Reais | Ignorados | Tem doc `6fcc0862-…`? |
|---|---:|---:|---:|:---:|
| 2025-12 | **30** | 26 | 4 | ⚠️ **SIM** |
| 2026-01 | 24 | 21 | 3 | NÃO |
| 2026-02 | 24 | 21 | 3 | NÃO |
| 2026-03 | 24 | 21 | 3 | NÃO |
| 2026-04 | 24 | 21 | 3 | NÃO |

### Observações:

- **2025-12 ainda tem 30 docs** (vs. 24 dos demais períodos). 26 reais sugerem que a base de Dez/25 inclui colaboradores que **não** estão em Jan/26 — possíveis candidatos: doc duplicado `6fcc0862-…` (Luiz Nerone) confirmado presente, mais outros que sairão na limpeza do Ato 2.
- **Ato 2 vai resolver:** sua etapa (a) é deletar TODOS os docs de 2025-12 e replicar os 21 de `colaboradores_base/`. Esse processo elimina o doc `6fcc0862-…` e qualquer outro doc obsoleto.
- 4 ignorados em Dez/25 vs. 3 nos demais: Dez/25 ainda tem o template `a_contratar` que foi descontinuado a partir de Jan/26.

### `clientes_base/`:

- Total: **84 docs** (esperado: 84) ✅
- **Não foi tocado** pelo Ato 1.

**Conclusão Q2:** Estado consistente. 2025-12 precisa do Ato 2 para alinhar com os demais períodos.

---

## Q3 — UI de Colaboradores: estado atual e gap para edição de `funcao_principal`

Análise consolidada (leitura de `src/features/colaboradores/`).

### Inventário dos 15 arquivos

| Arquivo | Resumo (1 linha) | Lê de | Escreve em |
|---|---|---|---|
| `useColaboradores.ts` | Hook principal: carrega derivados, expõe ações de salvar/criar/excluir | `dadosPeriodo.colaboradores` (do AppContext, vem de `fechamentos/{periodo}/colaboradores/`) | `fechamentos/{periodo}/colaboradores/{id}` via `salvarColaboradorPeriodo`; `fechamentos/{periodo}/clientes/{id}` via `salvarPct` |
| `ColaboradoresVisao.tsx` | Tela em Configurações: KPIs + tabela + modal | Hook | — |
| `ColaboradorCard.tsx` | Linha expansível da tabela | `derivado.colaborador` | — |
| `ColaboradorModal.tsx` | Container do modal (abas Folha + Alocação) | Props | — |
| `FolhaTab.tsx` | Form da folha: edita perenes + recalcula em tempo real | `inicial: Colaborador` (snapshot do período) | `fechamentos/{periodo}/colaboradores/{id}` via `onSalvar` |
| `FolhaTabFields.tsx` | Inputs reutilizáveis (`Campo`, `SelectField`) | — | — |
| `FolhaCalculadosResumo.tsx` | Painel read-only de campos calculados | `ResultadoFolha` | — |
| `ColaboradorAlocacao.tsx` | Edita `pct_funcao` por cliente | `derivado.colaborador` | `fechamentos/{periodo}/clientes/{id}` via `onSalvarPct` (Bug Arquitetural #1) |
| `HistoricoReajustes.tsx` | Log auditável; permite excluir entradas não-vigentes | `historico_reajustes` (de Colaborador) | Alteração local — persiste só via FolhaTab save |
| `AplicarHistoricoTodos.tsx` | Wizard de propagação de folha **single-colab** | Snapshot via `buscarTetoPorPeriodo` | `fechamentos/*/colaboradores/{id}` em massa via `propagarFolhaColaborador` |
| `PropagacaoEmMassa.tsx` | Wizard de propagação em massa (todos os colabs) | Snapshots | `fechamentos/*/colaboradores/{id}` em massa |
| `RenomearColaboradorModal.tsx` | Modal automático após renomear no Salvar Folha | Nome antigo/novo | `clientes_base/`, `fechamentos/*/clientes/`, `fechamentos/*/colaboradores/` via `renomearColaborador` |
| `ConfirmacaoExclusao.tsx` | Diálogo de 2 etapas para excluir colaborador | Props | — (delega via `onConfirmar`) |
| `columns.ts` | Definição das 9 colunas + cores dos badges | — | — |
| `ordenacao.ts` | Comparator de ordenação | — | — |

### Resposta direta às perguntas

#### Existe modal de edição de colaborador?

**Sim** — `ColaboradorModal.tsx` é o modal único com 2 modos:
- **`modo="editar"`** — para colaboradores existentes; oferece abas Folha + Alocação; botão Excluir (admin)
- **`modo="criar"`** — para novo cadastro; só aba Folha; campos `cargo` e `funcao_principal` ganham inputs

#### No modo CRIAR, `funcao_principal` aparece como campo editável?

**Sim** — em `FolhaTab.tsx:199-201`:
```tsx
<Campo label="Função principal (consultoria_gestao, operacional_financeiro, …)"
  tipo="text" valor={form.funcao_principal} onText={v => set('funcao_principal', v)} />
```

Tipo: **input text livre** (sem dropdown, sem validação de valor canônico — usuário pode digitar qualquer string).

#### No modo EDITAR, `funcao_principal` aparece como campo editável?

**Não.** O campo só está envolto pela condicional `{modo === 'criar' && (...)}` em `FolhaTab.tsx:195-202`. No modo editar, o valor é apenas inicializado no `useState` (`inicial.funcao_principal`) e mantido transparente — não há input para alterá-lo, mas o valor passa intacto via `colabCalc` ao salvar.

#### Quais campos são editáveis hoje em modo edição?

**Editáveis no modo editar (FolhaTab):**

- `nome_colaborador`
- `tipo_vinculo` (select clt / pro_labore)
- `localidade` (select SP / RJ)
- `percentual_alocavel` (number)
- `percentual_institucional` (number)
- `salario_teto_cargo` (CLT, number)
- `liquido_acordado` (CLT, number)
- `qtd_dependentes` (CLT, number)
- `salario_base` (pro-labore, number)
- `beneficios_fixos` (number)

**Editáveis APENAS em modo criar:**
- `cargo`
- `funcao_principal`

**Não-editáveis em UI nenhuma:**
- `alocavel` (boolean)
- `ativo` (boolean — campo novo da Fase 2)
- `data_admissao`, `data_demissao` (campos novos)
- `banker_responsavel`, `funcoes_secundarias` (campos novos)
- `cadastro_completo` (flag novo)

#### O que precisaria ser modificado para suportar edição de `funcao_principal` em `colaboradores_base/`?

Lista priorizada por impacto:

1. **`FolhaTab.tsx`**: remover a condicional `modo === 'criar'` ao redor do input de `funcao_principal` (linhas 195-202). Substituir o input text livre por um `SelectField` com as 6 opções canônicas (`FUNCOES_ALOCACAO` de `utils/constants.ts`) + opção "institucional" para sócios. Valor `""` (vazio) deve ser válido enquanto `cadastro_completo = false`, mas o save deve **exigir** valor preenchido para flipar `cadastro_completo = true`.

2. **`useColaboradores.ts`**: refatorar `salvarFolha` para distinguir Categoria A vs B. Mudanças em `funcao_principal`/`cargo`/`alocavel`/`percentual_*`/etc. **devem ir para `colaboradores_base/{slug}`** via `salvarClienteBase`-análogo (`salvarColaboradorBase`); mudanças em `salario_teto_cargo`/`liquido_acordado`/`historico_reajustes` continuam no snapshot mensal (mas idealmente sincronizadas via Princípio 4). A função `salvarColaboradorPeriodo` precisa ser dividida em duas: uma para perenes (base) e outra para período.

3. **`AppContext.tsx`** (fora de `colaboradores/`, mas dependente): carregar `colaboradores_base/` em paralelo com os snapshots e fazer merge dos campos (base = canonical para Categoria A; snapshot = canonical para Categoria B). Mudança ortogonal à da Fase 2 — exige decisão de arquitetura.

4. **Validação de `funcao_principal`**: usar `MAPA_FUNCAO` de `useColaboradores.ts:31-35` para garantir que só valores válidos sejam aceitos. Adicionar suporte explícito a `"institucional"` (sócios). Considerar exportar `FUNCOES_ALOCACAO` como `readonly tuple` em `constants.ts` para tipagem do SelectField.

5. **Estado `cadastro_completo`**: definir critério (provavelmente `funcao_principal !== ""`). Quando virar `true`, mostrar badge "Completo" na tabela; quando `false`, badge âmbar "Cadastro pendente". Hoje a UI **filtra silenciosamente** colaboradores sem `funcao_principal` (em `useColaboradores.ts:54-56`: `colaboradoresValidos`), o que faria os 21 desaparecerem da listagem após Ato 1 — **impacto crítico** que precisa ser tratado antes do Ato 2.

### ⚠️ Atenção crítica entre Ato 1 e Ato 2

`useColaboradores.ts:54-56` faz:
```ts
const colaboradoresValidos = useMemo(() => todosColaboradores.filter(
  c => c.nome_colaborador?.trim() && c.cargo?.trim() && c.funcao_principal,
), [todosColaboradores]);
```

Quando o Ato 2 replicar os 21 colaboradores para Dez/25 com `funcao_principal = ""` (vindo de `colaboradores_base/`), eles passarão a aparecer **vazios** nos snapshots. A UI atual **vai filtrá-los e a tabela vai esvaziar** se o motor ler Dez/25 sem que `colaboradores_base/` esteja preenchido.

**Decisões necessárias antes do Ato 2:**

- **Opção A:** Preencher `funcao_principal` em `colaboradores_base/` ANTES do Ato 2 (via UI ou script). Quando o Ato 2 replicar para Dez/25, o valor já estará populado.
- **Opção B:** Modificar o filtro `colaboradoresValidos` para aceitar `funcao_principal = ""` quando `cadastro_completo === false`, exibindo com badge de pendência.
- **Opção C:** Para o Ato 2 inicial, copiar `funcao_principal` do snapshot atual (Jan/26) em vez de pegar de `colaboradores_base/` (que está vazio). Não é o desenho original do Ato 2, mas evita a "quebra visual".

A opção (a) é a mais alinhada com o desenho (usuário preenche via UI entre os atos) — mas requer um modo de edição que ainda não existe no `colaboradores/`.

---

## Q4 — Validação cruzada do bug arquitetural

Todos os 21 docs em `colaboradores_base/` foram inspecionados.

| Campo Cat B buscado | Docs onde aparece |
|---|---:|
| `encargos_patronais` | 0 |
| `inss` | 0 |
| `irrf` | 0 |
| `irrf_liquido` | 0 |
| `redutor_ir_2026` | 0 |
| `liquido_do_teto` | 0 |
| `complemento_plr` | 0 |
| `reflexos_plr_mensal` | 0 |
| `decimo_terceiro_ferias` | 0 |
| `custo_total_mensal` | 0 |
| `custo_hora` | 0 |
| `diferenca_teto` | 0 |

**Resultado: ✅ todos os 21 docs estão limpos.**

Total de campos por doc: **21** (consistente em todos). Composição esperada do Ato 1:
- 16 campos perenes (Cat A) + 1 `id_estavel` + 1 `slug`
- 3 flags (`ativo`, `cadastro_completo`, `origem`)
- 1 timestamp (`data_extracao`)
- = 22, mas algumas chaves opcionais (`data_admissao`, `data_demissao`) saem com `undefined` e o Firestore (com `ignoreUndefinedProperties: true`) as omite. Total efetivo = **21 ✓**.

**Conclusão Q4:** Bug arquitetural NÃO se materializou. `colaboradores_base/` contém SOMENTE Categoria A.

---

## Conclusão geral

| Verificação | Resultado |
|---|---|
| Q1 — 21 docs corretos em colaboradores_base/ | ✅ APROVADO |
| Q2 — Estado dos snapshots e clientes_base intactos | ✅ APROVADO (com Dez/25 pendente do Ato 2) |
| Q3 — UI atual lê de snapshots; precisa de refatoração | ⚠️ DECISÃO NECESSÁRIA antes do Ato 2 |
| Q4 — Categoria B ausente em colaboradores_base/ | ✅ APROVADO |

### Decisões pendentes antes do Ato 2

1. **Como `funcao_principal` será preenchida em `colaboradores_base/`?** Opções A/B/C acima.
2. **Quando `useColaboradores` passará a ler de `colaboradores_base/`?** Pré ou pós Ato 2?
3. **Como a UI vai exibir cadastros incompletos** (`cadastro_completo=false`)?

Nenhum write Firestore foi feito. Nenhum arquivo-fonte foi modificado.

---

**Fim do diagnóstico.**
