# Diagnóstico Fase 2 — Colaboradores

Gerado em **2026-05-11T20:59:21Z** · READ-ONLY · nenhum arquivo modificado · nenhum write Firestore.

Fonte: `scripts/diagnosticoColaboradoresFase2.mjs` (one-shot descartável; saída em `diag-output.json` — não comitada).

Universo: `fechamentos/*/colaboradores/` · **126 docs brutos**, **110 docs reais** (16 templates/legendas filtrados), **21 colaboradores únicos**, **5 períodos** (2025-12 → 2026-04).

---

## Q1 — Campos presentes nos snapshots

### Campos universais (100 % dos docs reais — 110/110)

São candidatos diretos a popularem `colaboradores_base/`:

| Campo | Notas |
|---|---|
| `nome_colaborador` | Identidade textual |
| `id_estavel` | UUID Fase 3 (✅ todos populados) |
| `cargo` | Texto livre |
| `funcao_principal` | Categoria (consultoria_gestao, serv_adm, …) — inclui valor "institucional" para sócios |
| `alocavel` | Boolean — assume `true` ou `false` |
| `percentual_alocavel` | Decimal 0–1 |
| `percentual_institucional` | Decimal 0–1 |
| `salario_teto_cargo` | Base CLT / pro-labore |
| `salario_base` | Sempre presente (CLT zera; pro-labore valor real) |
| `beneficios_fixos` | VT + VR + saúde |
| `custo_total_mensal` | **CALCULADO** — deve ficar só em snapshots, não em base |
| `custo_hora` | **CALCULADO** |
| `decimo_terceiro_ferias` | **CALCULADO** |
| `encargos_patronais` | **CALCULADO** |
| `diferenca_teto` | **CALCULADO** |

### Campos parciais (em 81/110 = 73,6 % dos docs reais)

Todos com a mesma frequência → **inferência**: presentes apenas em colaboradores **CLT**; ausentes em pro-labore (29 docs).

| Campo | % | Categoria |
|---|---:|---|
| `tipo_vinculo` | 73,6 | discriminador (clt vs pro_labore) |
| `historico_reajustes` | 73,6 | **perene CLT** |
| `liquido_acordado` | 73,6 | **perene CLT** |
| `localidade` | 73,6 | **perene** (SP/RJ) — afeta horas produtivas |
| `qtd_dependentes` | 73,6 | semi-perene (raramente muda) |
| `complemento_plr` | 73,6 | calculado |
| `inss` | 73,6 | calculado |
| `irrf` | 73,6 | calculado |
| `reflexos_plr_mensal` | 73,6 | calculado |
| `id` | 73,6 | duplica docId (legado) |

**Observação importante:** `tipo_vinculo` está ausente em 29 docs (pro-labore). Para a Etapa 1 da Fase 2, será necessário **inferir** `tipo_vinculo = 'pro_labore'` quando o campo está ausente, ou popular um default na migração.

### Campos únicos (em 1 doc só)

**0 ocorrências** — nenhum campo aparece exclusivamente num único snapshot. Bom indicador de uniformidade do dataset.

### Cobertura dos 14 campos perenes esperados

| Campo esperado | Presente? | Cobertura | Observação |
|---|---|---:|---|
| `salario_teto_cargo` | ✅ | 100 % | OK |
| `historico_reajustes` | ⚠️ | 73,6 % | Só CLT — fallback necessário pra pro-labore (array vazio) |
| `liquido_acordado` | ⚠️ | 73,6 % | Só CLT — fallback necessário (0 ou null) |
| `beneficios_fixos` | ✅ | 100 % | OK (não há `beneficios` simples) |
| `beneficios` | ❌ | 0 % | Não existe — usar `beneficios_fixos` |
| `data_admissao` | ❌ | 0 % | **AUSENTE em todos** — não pode ser populada da migração |
| `data_demissao` | ❌ | 0 % | **AUSENTE em todos** — não pode ser populada da migração |
| `cargo` | ✅ | 100 % | OK |
| `funcao_principal` | ✅ | 100 % | OK — valores: 6 canônicos + `institucional` (sócios) |
| `alocavel` | ✅ | 100 % | OK — boolean true/false |
| `percentual_alocavel` | ✅ | 100 % | OK |
| `percentual_institucional` | ✅ | 100 % | OK |
| `banker_responsavel` | ❌ | 0 % | **AUSENTE em todos** — campo não existe no modelo atual |
| `banker` | ❌ | 0 % | **AUSENTE em todos** |

### Conclusão Q1

A Etapa 1 da Fase 2 consegue popular `colaboradores_base/` com **12 dos 14 campos perenes** desejados a partir dos snapshots. **4 ausências críticas** que NÃO podem vir dos snapshots:

1. `data_admissao` — não existe no schema atual
2. `data_demissao` — não existe no schema atual
3. `banker_responsavel` (ou `banker`) — não existe no schema atual
4. `historico_reajustes` / `liquido_acordado` para colaboradores pro-labore — campos não se aplicam ao tipo de vínculo

**Decisão recomendada para Fase 2 Etapa 1:** popular `colaboradores_base/` com os 12 campos disponíveis, deixar os 4 ausentes como `undefined` ou `null`, e tratar em Etapa 2 (UI de cadastro de colaborador permite preencher manualmente data_admissao/banker; data_demissao só ao desligar).

---

## Q2 — Cobertura temporal por colaborador

### Visão agregada

| Categoria | N | Detalhe |
|---|---:|---|
| Total único | **21** | (via `id_estavel`) |
| Aparece em **todos** os 5 períodos | **21** | 100 % |
| Aparece só em períodos antigos (saiu) | **0** | — |
| Aparece só em períodos recentes (entrou) | **0** | — |
| Intermitente (entrou-saiu-entrou) | **0** | — |

**Último período disponível: 2026-04** ✅

### Lista completa dos 21 colaboradores

Todos aparecem em todos os 5 períodos (2025-12 → 2026-04).

| Slug | Nome | Cargo | Função principal |
|---|---|---|---|
| `amilcar_junior` | Amilcar Junior | Sócio | institucional |
| `arthur_cruvinel` | Arthur Cruvinel | Coordenador Financeiro | consultoria_planejamento |
| `cintia_de_jesus_alves` | Cintia De Jesus Alves | Assistente Administrativo | serv_adm |
| `daniel_gama` | Daniel Gama | Coordenador de Gestão de Atletas | consultoria_gestao |
| `erika_freitas` | Erika Freitas | Superintendente Administrativo | consultoria_gestao |
| `fernanda_cassa` | Fernanda Cassa | Gerente de Gestão de Atletas | consultoria_gestao |
| `fernanda_da_silva_soares` | Fernanda da Silva Soares | Assistente Administrativo | serv_adm |
| `flavia_santos_romeu` | Flávia Santos Romeu | Analista de Gestão | consultoria_gestao |
| `giovanna_pargoli` | Giovanna Pargoli | Analista Administrativo | consultoria_gestao |
| `julia_pereira` | Julia Pereira | Operador Financeiro | operacional_financeiro |
| `lucas_henrique` | Lucas Henrique | Operador Financeiro | operacional_financeiro |
| `luis_eduardo_nerone` | Luis Eduardo Nerone | Analista Financeiro | consultoria_financeira |
| `luisa_villa` | Luisa Villa | Assistente Administrativo | serv_adm |
| `maria_eduarda_cruz` | Maria Eduarda Cruz | Estágio Administrativo | serv_aux_adm |
| `mariah_assbu` | Mariah Assbu | Estágio Administrativo | serv_aux_adm |
| `matheus_tripoli` | Matheus Tripoli | Supervisor Financeiro | consultoria_financeira |
| `priscilla_rocha` | Priscilla Rocha | Sócio | consultoria_gestao |
| `rafael_parolise` | Rafael Parolise | Supervisor Financeiro | consultoria_financeira |
| `rafaela_correggiari` | Rafaela Correggiari | Analista Administrativo | consultoria_gestao |
| `thayna_ribeiro` | Thayna Ribeiro | Assistente Administrativo | serv_adm |
| `viviane_leal` | Viviane Leal | CEO | consultoria_gestao |

### Conclusão Q2

A regra **"snapshot mais recente vence" (2026-04)** captura **100 % dos colaboradores únicos** atualmente. Não há colaboradores presentes só em períodos antigos. A Etapa 1 da Fase 2 não precisa de lógica de merge cross-período para esta migração — basta ler o snapshot de 2026-04 de cada colaborador.

**Nota de transição:** Quando colaboradores forem demitidos no futuro, eles deixarão de aparecer em períodos novos. Para preservar histórico (folha do período em que ainda existiam), `colaboradores_base/` precisará de campo `data_demissao` ou `ativo=false`. Q3 confirma essa lacuna.

**Sub-observação técnica (fora do escopo):** `Luis Eduardo Nerone` aparece com cargo "Analista Financeiro" no diagnóstico, mas a auditoria de colaboradores (`audit-results/auditoria-colaboradores-nomes-2026-05-11T00-29-16.md`) registra "Supervisor Financeiro" no período 2025-12. Pode ser uma mudança contratual real ou inconsistência cross-período — não afeta a Fase 2 (escolha do snapshot mais recente já resolve), mas pode merecer registro futuro.

---

## Q3 — Suporte para diagnóstico de inativos

### Campos pesquisados

Nenhum campo de inativação está presente nos snapshots:

| Campo | Presente? |
|---|---|
| `data_demissao` | ❌ |
| `status_ativo` | ❌ |
| `ativo` | ❌ |
| `inativo` | ❌ |
| `demitido` | ❌ |
| `status` | ❌ |
| `situacao` | ❌ |
| `desligamento` | ❌ |
| `data_saida` | ❌ |

### Colaboradores com data_demissao preenchida

**0** (campo nem existe).

### Como o sistema diferencia ativo de inativo hoje?

**Não diferencia formalmente.** Os mecanismos existentes:

1. **`alocavel: boolean`** — assume `true` e `false` em produção. Não é flag de ativo/inativo, é flag de "atende clientes". Amilcar Junior (Sócio, funcao_principal=`institucional`) provavelmente tem `alocavel=false`, mas continua ativo e custando — vai 100 % para pool de indiretos.

2. **`percentual_alocavel` + `percentual_institucional`** somam 1.0. Colaboradores 100 % institucionais têm `percentual_alocavel=0`. De novo, não é flag de inativo.

3. **Presença/ausência em snapshots futuros** — única forma indireta. Quando um colaborador é demitido, ele **deixa de ser incluído** no próximo upload de Excel ou no Excel é removido. Não há marca explícita de "saiu em X mês".

### Conclusão Q3

**Não há mecanismo formal de inativação.** A Fase 2 (Etapa 1) precisará introduzir um campo de status em `colaboradores_base/` para suportar:

- Distinção entre "colaborador ativo" vs "colaborador histórico" (que existiu em períodos passados mas foi demitido)
- Cálculos retroativos quando um período antigo é reprocessado
- UI de "Colaboradores" sem incluir ex-funcionários nas listas de seleção atuais

**Sugestão de campo** (decisão da Fase 2):

```ts
interface ColaboradorBase {
  // ...
  ativo: boolean;              // default true
  data_admissao?: string;      // YYYY-MM-DD ou YYYY-MM
  data_demissao?: string | null; // null = ativo, string = data de saída
}
```

Como nenhum dos 21 colaboradores atuais tem `data_demissao` preenchida (campo nem existe), a migração inicial pode setar `ativo: true` para todos os 21 e deixar `data_admissao`/`data_demissao` como `undefined`. Preenchimento histórico de admissão é trabalho manual posterior pela área de RH/CFO.

---

## Resumo executivo para planejamento Fase 2

### O que **está pronto** para migrar (Etapa 1)

- ✅ 21 colaboradores únicos identificáveis por `id_estavel`
- ✅ Snapshot mais recente (2026-04) cobre 100 % dos colaboradores ativos
- ✅ 12/14 campos perenes disponíveis: nome, cargo, função principal, alocável, percentuais, salário teto, salário base, benefícios fixos, e (para CLT) histórico de reajustes + líquido + localidade + dependentes + tipo_vinculo

### O que **precisa decisão** na Etapa 1

- Campo `tipo_vinculo` ausente em 29 docs pro-labore → **inferir** `'pro_labore'` quando ausente, ou inserir no script de migração antes do write
- Campo `data_admissao` ausente em todos → criar como `undefined`, popular via UI depois
- Campo `data_demissao` ausente em todos → criar como `null`, popular ao desligar pessoa
- Campo `banker_responsavel` ausente em todos → criar como `undefined`, popular se/quando regra entrar em escopo
- Campo `ativo` não existe → criar com default `true` para todos os 21

### O que **fica para Etapas 2+**

- UI de cadastro/edição de colaborador (Configurações > Colaboradores) — adicionar campos `data_admissao`, `data_demissao`, `ativo`, `banker_responsavel`
- Lógica de inativação (`ativo = false` em vez de deletar) — preserva snapshots históricos
- Renomeação de campo: confirmar que `beneficios_fixos` permanece e descartar `beneficios` como possibilidade

### Custos calculados (não migram para base)

Os 5 campos calculados a manter SOMENTE em snapshots (`custo_total_mensal`, `custo_hora`, `decimo_terceiro_ferias`, `encargos_patronais`, `diferenca_teto`) já são derivados em tempo de cálculo pelo motor (`calcularFolhaColaborador`). A base não precisa armazená-los.

---

**Fim do diagnóstico.**
