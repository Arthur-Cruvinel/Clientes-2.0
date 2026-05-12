# Diagnóstico Fase 2 — colaboradores_base/ (preparação)

Gerado em **2026-05-11T22:20:12Z** · READ-ONLY · nenhum arquivo modificado · nenhum write Firestore.

Fonte de dados Firestore: `scripts/investigarPreFase2.mjs` (one-shot descartável). Fonte de análise de fórmulas: `src/utils/financials.custos.ts` + CLAUDE.md.

---

## Q1 — Campos Jan/26 vs Dez/25

Doc representativo: **Julia Pereira** (mesmo `id_estavel` `9cb609bb-2746-479a-96d9-233e2d150cd5` nos 2 períodos), docId `0377a6f5-6d86-4cf8-a29d-5f159d9daba6` em ambos.

| Métrica | Dez/25 | Jan/26 |
|---|---:|---:|
| Total de campos | 15 | 25 |

### Campos só em Jan/26 (10)

Ausentes em Dez/25, todos populados em Jan/26 — coincidem com os campos do bloco "CLT completo" (folha + histórico):

| Campo | Categoria |
|---|---|
| `tipo_vinculo` | discriminador (perene) |
| `historico_reajustes` | perene CLT |
| `liquido_acordado` | perene CLT |
| `localidade` | perene |
| `qtd_dependentes` | semi-perene CLT |
| `inss` | calculado mensal |
| `irrf` | calculado mensal |
| `complemento_plr` | calculado mensal |
| `reflexos_plr_mensal` | calculado mensal |
| `id` | legado (duplica docId) |

**Implicação:** os snapshots de Dez/25 são **incompletos** — não passaram pelo pipeline de cálculo da folha CLT. Provavelmente foram importados via Excel (ETL inicial) sem que `calcularFolhaColaborador` rodasse. A partir de Jan/26 (primeiro fechamento real?), todos os campos foram populados.

### Campos só em Dez/25

**0 campos.** Tudo que existe em Dez/25 também existe em Jan/26.

### Campos comuns com valores diferentes (3)

Todos calculados, com variações ínfimas — provavelmente arredondamento ou diferença de versão da função de cálculo:

| Campo | Dez/25 | Jan/26 | Δ |
|---|---:|---:|---:|
| `custo_total_mensal` | 6 713,04 | 6 713,05 | +0,01 |
| `custo_hora` | 39,9586 | 40,9451 | +0,99 |
| `decimo_terceiro_ferias` | 422,2117 | 422,2222 | +0,01 |

`custo_hora` mudou 0,99 (~2,5 %) — provavelmente porque a constante `HORAS_PRODUTIVAS_POR_LOCALIDADE` foi introduzida com a Fase 2 do CLAUDE.md (segregação por localidade SP/RJ), e Dez/25 ainda usava o valor antigo. A diferença é compatível com a migração de `HORAS_CLT_MES` (168 × 12 = 2016) para `HORAS_PRODUTIVAS_POR_LOCALIDADE.SP` (~1968).

### Conclusão Q1

O snapshot de Dez/25 representa um estado **pré-pipeline completo**. Os snapshots a partir de Jan/26 são completos. **Para a Etapa 1 da Fase 2 (extrair perenes para `colaboradores_base/`), o snapshot mais recente (2026-04) é a fonte preferencial** — não Dez/25.

---

## Q2 — Doc duplicado 6fcc0862 (busca por FK literal)

**Valores buscados como literais em todos os campos de todas as coleções:**

- `docId` literal: `6fcc0862-5042-438e-95fe-e51a174b0f78`
- `id_estavel` literal: `ac6922ca-d464-4743-b125-51e8d0ec26c1`

**Coleções varridas:**

- Top-level: `clientes_base`, `poupanca`, `mapeamento_siglas`, `parametros`, `periodos_status`, `config`, `historico_fluxo`, `evolucao_pl`, `patrimonial`, `patrimonio`, `usuarios` (algumas podem não existir — varredura tolerante a 404)
- collectionGroups: `clientes`, `colaboradores` (exceto o próprio doc `6fcc0862-...`), `custosIndiretos`

**Notas técnicas da busca:**
- O campo `id_estavel` do próprio doc `8aba1578-...` (outro snapshot do Nerone) contém o valor buscado — isto é esperado (mesma entidade lógica). A busca excluiu o campo `id_estavel` quando estava nesse contexto.
- Referências ao **nome** "Luis Eduardo Nerone" em campos de alocação de cliente **não foram contadas** (são vínculos legítimos por nome, não por FK).

### Resultado

| Busca | Hits |
|---|---:|
| Referências ao docId literal `6fcc0862-...` | **0** |
| Referências ao id_estavel literal `ac6922ca-...` (excluindo o próprio campo) | **0** |

### Conclusão Q2: **SEGURO DELETAR**

Nenhum doc em nenhuma coleção referencia o docId ou o id_estavel literal do snapshot duplicado. O doc `6fcc0862-...` em `fechamentos/2025-12/colaboradores/` é **órfão de referências** — pode ser deletado sem quebrar FK em outros lugares.

Lembrete: a regra absoluta da Fase 3 proibiu `deleteDoc`. Esta conclusão de "seguro deletar" é informativa para Fases futuras (5/6) que tratam de saneamento — **não autoriza delete imediato**.

---

## Q3 — Campos por categoria + estratégia de tratamento

Análise baseada em `src/utils/financials.custos.ts` e nos campos observados nos snapshots.

### Categoria A — PERENES (replicar diretamente)

Não variam mês a mês para o mesmo colaborador. Seguros para extrair para `colaboradores_base/`:

| Campo | Comentário |
|---|---|
| `nome_colaborador` | Texto livre — perene |
| `id_estavel` | UUID Fase 3 — perene por definição |
| `cargo` | Perene; muda em promoção (evento raro) |
| `funcao_principal` | Perene; muda em mudança de função |
| `alocavel` | Boolean — perene |
| `percentual_alocavel` | Decimal 0–1 — perene |
| `percentual_institucional` | Decimal 0–1 — perene (soma com alocavel = 1) |
| `tipo_vinculo` | 'clt' / 'pro_labore' — perene |
| `salario_teto_cargo` | Base CLT — perene até reajuste |
| `salario_base` | Base pro-labore — perene até reajuste |
| `liquido_acordado` | CLT — perene até reajuste |
| `beneficios_fixos` | VT + VR + saúde — perene |
| `qtd_dependentes` | CLT — semi-perene |
| `localidade` | SP / RJ — perene |
| `historico_reajustes` | Lista acumulativa — perene |
| `id` | Legado (duplica docId) — perene |

### Categoria B — CALCULADOS POR MÊS (não replicar sem decisão)

Função canônica: **`calcularFolhaColaborador(c, ano, periodo)` em `src/utils/financials.custos.ts:103-153`**.

**A função existe, é a fonte de verdade do motor financeiro, e recalcula 100 % dos campos B a partir dos campos A.**

| Campo | Fórmula | Dependências (Cat A) |
|---|---|---|
| `custo_total_mensal` | CLT: `teto + benefícios + encargos + 13º/férias + complemento_plr + reflexos_plr` | salario_teto_cargo, liquido_acordado, beneficios_fixos, qtd_dependentes, tipo_vinculo, localidade |
| `custo_total_mensal` (pro-labore) | `salario_base + benefícios + (salario_base × 0,20)` | salario_base, beneficios_fixos, tipo_vinculo |
| `custo_hora` | `(custo_total_mensal × 12) / HORAS_PRODUTIVAS_POR_LOCALIDADE[localidade]` | custo_total_mensal, localidade |
| `encargos_patronais` | CLT: `teto × 0,28` \| pro-labore: `salario_base × 0,20` | salario_teto_cargo / salario_base, tipo_vinculo |
| `decimo_terceiro_ferias` | CLT: `(teto / 12) × (4/3)` \| pro-labore: 0 | salario_teto_cargo, tipo_vinculo |
| `inss` | Tabela INSS progressiva sobre teto, por ano | salario_teto_cargo, ano da folha |
| `irrf` | Tabela IRRF progressiva sobre (teto − inss − dep), + redutor 2026 | salario_teto_cargo, qtd_dependentes, ano, inss |
| `complemento_plr` | `max(0, liquido_acordado − liquido_do_teto)` | liquido_acordado, salario_teto_cargo (via inss/irrf → liquido_do_teto) |
| `reflexos_plr_mensal` | `(complemento_plr / 12) × (4/3)` | complemento_plr |
| `redutor_ir_2026` | `REDUTOR_IR_2026.formula(teto)` se ano=2026 | salario_teto_cargo |
| `liquido_do_teto` | `teto − inss − irrf` | salario_teto_cargo, inss, irrf |

### Categoria C — Incerto

| Campo | Hipótese | Razão |
|---|---|---|
| `diferenca_teto` | provavelmente calculado: `liquido_acordado − liquido_do_teto` (mesma base do `complemento_plr` mas sem o max) ou similar | Aparece em todos os snapshots reais, mas não vejo fórmula direta em `financials.custos.ts`. Pode ser derivado em outro arquivo. **Verificar antes de classificar definitivamente.** |
| `id` | provavelmente perene (legado que duplica docId) | Aparece em 73,6 % dos docs. Quando aparece, valor = docId. Provável artefato de pipeline antigo. |

### Análise de estratégia para Categoria B

#### (a) PRESERVAR — replicação toca apenas Categoria A

- **Viabilidade:** sempre possível
- **Risco:** se a "replicação" do contexto Fase 2 significa apenas extrair Cat A para `colaboradores_base/` (sem tocar nos snapshots), o risco é **zero** — os snapshots continuam exatamente como estão, e Cat B segue válida para cada período onde foi calculada.
- **Risco se a "replicação" é cópia snapshot → novo snapshot:** Cat B do mês fonte vira Cat B do mês destino sem recálculo. Erro potencial: tabelas INSS/IRRF mudam de ano (Jan/26 → Jan/27); preservar `inss` do ano anterior gera DRE incorreta.

#### (b) RECALCULAR — após replicação, reroda `calcularFolhaColaborador` para Cat B

- **Viabilidade técnica:** ✅ **ALTA**. A função existe (`src/utils/financials.custos.ts:103`), é isolada, recebe `Colaborador + ano + periodo` e retorna o `ResultadoFolha` completo. Já é a fonte de verdade do motor financeiro (`processarPeriodo`).
- **Risco:** baixíssimo — usa a mesma função que o motor financeiro consulta em runtime. Diferenças possíveis vs valor original do snapshot: ínfimas (arredondamento ou se as tabelas INSS/IRRF foram corrigidas).
- **Custo de implementação:** baixo — basta importar `calcularFolhaColaborador`, chamar e gravar o resultado.

#### (c) ZERAR — Categoria B fica `null` após replicação

- **Viabilidade:** sempre possível
- **Risco:** DRE do período fica **incompleta** até script de recálculo manual rodar. Anti-padrão dado que (b) está disponível trivialmente.
- **Quando faria sentido:** se a função de recálculo fosse instável ou em refatoração — não é o caso atual.

### Recomendação

**Opção (b) RECALCULAR.**

Justificativa:
1. A função `calcularFolhaColaborador` existe, é estável, é a fonte de verdade do motor financeiro.
2. Recalcular garante consistência cross-período mesmo quando: tabelas INSS/IRRF mudam de ano, `localidade` foi corrigida no cadastro, `historico_reajustes` foi atualizado.
3. Custo de implementação trivial — uma chamada de função após copiar o objeto.
4. Elimina divergência observada no caso Nerone (Q1: `custo_hora` divergiu entre Dez/25 e Jan/26 porque a fórmula de horas produtivas mudou; recalcular harmoniza).

Se for por algum motivo necessário **preservar valores históricos exatos** do mês de origem (ex: relatórios já assinados), considerar uma estratégia híbrida: preservar Cat B no doc replicado **e** armazenar Cat B recalculada em um campo separado (ex: `custo_total_mensal_recalculado`). Não recomendado de saída — adiciona complexidade sem ganho operacional claro.

---

## Q4 — Conflito de campos `data_replicacao` e `replicado_de`

Varredura de todos os 126 docs em `fechamentos/*/colaboradores/`:

| Campo | Ocorrências |
|---|---:|
| `data_replicacao` | **0** |
| `replicado_de` | **0** |

**Conclusão Q4:** os 2 campos propostos **não existem** em nenhum snapshot atual. Não há conflito de significado. Estão livres para uso na Fase 2.

---

## Conclusão geral

**Modelo de replicação viável: SIM, COM AJUSTES.**

### Ajustes/decisões necessárias

1. **Fonte preferencial para extrair Categoria A é o snapshot mais recente (2026-04)** — Dez/25 é incompleto (faltam `tipo_vinculo`, `historico_reajustes`, `liquido_acordado`, `localidade`, `qtd_dependentes`).

2. **Para colaboradores pro-labore**, inferir `tipo_vinculo: 'pro_labore'` quando o campo não está populado no snapshot fonte. Os 29 docs sem `tipo_vinculo` no diagnóstico anterior (Fase 2) estão todos em Dez/25 ou subset.

3. **Categoria B: recalcular após replicação** via `calcularFolhaColaborador(c, ano, periodo)`. A função é confiável e cobre 100 % dos campos calculados.

4. **Doc duplicado `6fcc0862-...` em Dez/25 é seguro deletar** (Q2: 0 FK órfãs). A regra absoluta da Fase 3 ainda proíbe delete; tópico para Fases 5+ ou saneamento manual.

5. **Campos novos `data_replicacao` e `replicado_de` estão livres** — sem conflito de nomenclatura.

6. **`diferenca_teto` em Categoria C precisa ser verificada** antes da migração — buscar fórmula no código (provavelmente derivada em outro arquivo que não `financials.custos.ts`). Se for calculada, vai para Categoria B; se for input, vai para Categoria A.

### Não-ajustes (validações que passaram)

- Os 21 colaboradores únicos cobertos em 5 períodos contínuos (sem buracos)
- `id_estavel` consistente em todos os snapshots
- 0 referências FK ao doc duplicado em nenhum lugar do Firestore
- Função de recálculo `calcularFolhaColaborador` existe e está pronta para uso

---

**Fim do diagnóstico.**
