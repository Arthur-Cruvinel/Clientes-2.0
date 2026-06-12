# Parte III — Motor Financeiro

> Especificação do motor de cálculo do **Clientes 360**, cálculo a cálculo, em
> linguagem agnóstica de implementação. Cada cálculo tem **propósito · entradas ·
> fórmula · saídas · casos de borda · invariante**. As assinaturas reais e o
> pipeline em pseudocódigo fiel estão no **Apêndice B**.

**Convenções de notação.** Períodos `p = YYYY-MM`. Somatórios `Σ` percorrem o
universo indicado. `pct` é fração decimal do tempo (0,12 = 12%). Custos em BRL/mês,
salvo indicação. "Cliente pure asset" = `pacote_servico = asset_only`.

---

## 1. Orquestração do período

**Propósito.** Produzir, para um período, o resultado financeiro (DRE) de cada
cliente, garantindo que o rateio de indiretos use a base correta e que 100% da
folha seja capturada.

### 1.1 Universo de clientes

O universo combina duas origens:

1. **Cadastro** — clientes do período. Se o período está **aberto**, os cadastros
   mestre (`clientes_base/`); se **fechado**, o snapshot (`fechamentos/{p}/clientes/`).
   Filtra-se por visibilidade temporal:
   ```
   visível(c) ⇔ ¬c.data_entrada ∨ mês(c.data_entrada) ≤ mês(p)
   ```
2. **Síntese de pure assets do AUM** — para cada cliente presente em `poupanca/` do
   mês mas **ausente** do cadastro (comparação por nome normalizado: NFD + sem
   acento + maiúsculas), sintetiza-se um cliente mínimo com `pacote_servico =
   asset_only`, `receita_fee = 0` e taxas de rebate globais. Não se sintetiza se o
   cadastro correspondente tem `data_entrada` futura.

`universo = clientes_visíveis ∪ pure_assets_sintetizados`.

### 1.2 Ordem das etapas (pré-passe → DRE)

```
0. Pré-passe por colaborador (uma vez):
     somaPct      = Σpct por colaborador (resolver vínculo-first, por id_estavel)
     fatorNorm    = normalização de sobre-alocação por colaborador
     ociosidade   = folga de capacidade convertida em custo
     poolNaoAlocado = institucional + ociosidade
1. Custo direto por cliente (já normalizado) → mapa {cliente → custo_direto}
2. Indexar poupança por nome_cliente (lookup O(1) do PL)
3. DRE por cliente (usa custo direto pré-calculado + pool + poupança + parâmetros)
4. Ordenar por lucro líquido desc.
```

### 1.3 Derivado vs lido

| Lido (entrada) | Derivado (saída) |
|---|---|
| Cadastros (cliente, colaborador), vínculos, custos indiretos, poupança, parâmetros globais | Custo direto, normalização, ociosidade, pool, rateios, receita, impostos, EBITDA, margens, fatores de escopo |

**Invariante de orquestração.** O pré-passe é computado **uma vez** e propagado a
todos os clientes; o custo direto é pré-calculado **antes** do rateio de indiretos
(o rateio precisa do Σ custo direto do universo).

---

## 2. Custo direto

### 2.1 Resolução (cliente, função) → colaborador

**Propósito.** Decidir qual colaborador atende cada função de cada cliente, e com
que intensidade (`pct`), de forma estável a renomeações.

**Fórmula (leitura dual).**
```
resolver(cliente, função):
   se ∃ vínculo v com v.id_estavel_cliente = cliente.id_estavel
        ∧ v.funcao = função ∧ v.pct > 0:
        colab ← colaborador por v.id_estavel_colaborador
        retorna (colab, v.pct, fonte=vínculo)
   senão (fallback legado):
        nome  ← cliente[função]                 (campo de nome no cliente)
        colab ← match exato, senão normalizado
        retorna (colab, cliente.pct_função, fonte=cliente)
```

**Casos de borda.** Vínculo aponta para `id_estavel` inexistente (placeholder) →
cai no fallback. Nome no cliente sem correspondência no cadastro → função sem
custo (sinalizada para reatribuição).

**Invariante.** A atribuição do custo, da base de normalização e da decomposição de
mão de obra usam **o mesmo resolver** — nunca uma via paralela.

### 2.2 Custo direto do cliente

**Entradas.** Cliente, colaboradores, vínculos, `fatorNorm`.

**Fórmula.**
```
custo_direto(cliente) = Σ_{função}  custo_total_mensal(colab) × pct × fatorNorm(colab)
```
onde `(colab, pct)` vêm do resolver. `pct` já é fração do tempo **total** do
colaborador (não se multiplica de novo por `percentual_alocavel`).

**Caso de borda.** `pacote_servico = asset_only` → `custo_direto = 0` por definição.

### 2.3 Base por pessoa (Σpct) e normalização de sobre-alocação

**Propósito.** Garantir que um colaborador distribua no máximo 100% do seu custo
real, mesmo que a soma das alocações exceda sua capacidade.

**Fórmula.**
```
Σpct(colab) = Σ_{cliente, função}  pct        (resolver, agregado por id_estavel)

fatorNorm(colab) =  alocável / Σpct       se Σpct > alocável
                    1                      caso contrário
```
Os `pct` viram **pesos relativos**: o colaborador sobre-alocado distribui
exatamente `alocável × custo` entre seus clientes. Colaborador 100% institucional
(`alocável = 0`) com vínculos → `fatorNorm = 0` (custo vai inteiro para o pool
institucional, sem dupla contagem).

### 2.4 Ociosidade e institucional

**Ociosidade** (folga de capacidade vira custo do pool geral):
```
ociosidade = Σ_{colab}  max(0, alocável − Σpct(colab)) × custo_total_mensal(colab)
```
**Institucional** (parcela não-alocável de toda a folha):
```
institucional = Σ_{colab}  custo_total_mensal(colab) × percentual_institucional(colab)
```

### 2.5 Invariante da folha

```
folha total ≡ Σ custo_direto(normalizado) + institucional + ociosidade
```
Decorre de `alocável + institucional = 1` por colaborador: a parte alocável vira
custo direto (normalizado), a institucional vira pool, e a folga alocável não usada
vira ociosidade. **Nenhum real de folha some nem é contado duas vezes.**

---

## 3. Custos dedicados

**Propósito.** Custos atribuíveis diretamente a um cliente, somados ao **custo
dedicado** (não ao indireto rateado).

**Composição.**
```
custo_dedicado(cliente) = custo_contabilidade_dedicado
                        + custo_pagamento_dedicado
                        + custo_administrativo_dedicado
                        + custo_viagem_dedicado
                        + rateio_juridico
                        + rateio_conciliacao
```

**Rateio jurídico** (entre clientes com `utiliza_servico_juridico`):
```
rateio_juridico(c) = TotalJurídico × peso_juridico(c) / Σ peso_juridico
```
**Rateio conciliação** (entre clientes com `utiliza_conciliacao` e `volume > 0`):
```
rateio_conciliacao(c) = TotalConciliação × volume_movimentos_mes(c) / Σ volume
```
`TotalJurídico` e `TotalConciliação` são os valores das categorias `juridico` e
`conciliacao` em `custosIndiretos`.

**Componentes anuais.** Os custos dedicados manuais são **mensais**. Componentes de
natureza anual são mensalizados na origem (÷12) antes de entrar no cálculo — o motor
não anualiza (a única razão a.a.→mensal viva no motor é a do rebate, §5; e a
provisão de 13º/férias da folha, ×4/3÷12).

**Caso de borda.** Cliente sem flag/peso/volume na categoria → rateio = 0 naquela
categoria.

**Invariante.** Jurídico e conciliação compõem o **dedicado** (despesa direta), não
o indireto rateado — coerente com a DRE contábil (Consultoria & Legal é despesa
direta).

---

## 4. Custos indiretos (pool geral)

**Propósito.** Distribuir o overhead da casa entre os clientes que consomem
estrutura.

**Pool geral.**
```
poolGeral = Σ categorias 'geral' + institucional + ociosidade
```

**Rateio proporcional ao custo direto.**
```
ΣDireto = Σ_{c ∈ universo}  max(0, custo_direto(c))
indireto(c) = poolGeral × custo_direto(c) / ΣDireto      se custo_direto(c) > 0
              0                                            caso contrário
```

**Casos de borda.** Pure asset (`custo_direto = 0`) é **excluído** do rateio.
`ΣDireto = 0` → indireto = 0 (evita divisão por zero).

**Invariante.** A razão efetiva `indireto/direto = poolGeral/ΣDireto` é **uniforme**
entre todos os clientes com custo direto. (Esta razão alimenta a referência da
Precificação — §9.)

---

## 5. Receita

**Propósito.** Receita bruta do cliente = fee + parcela líquida do rebate retida
pela plataforma.

**Entradas.** Cliente (fee, taxas de rebate), registro de poupança do período (PL),
alíquotas globais de retenção.

**Fórmula.**
```
PL_on  = poupança.pl_onshore  ?? 0
PL_off = poupança.pl_offshore ?? 0

rebate_liq_on  = PL_on  × taxa_on  / 12 × (1 − aliq_on)
rebate_liq_off = PL_off × taxa_off / 12 × (1 − aliq_off)
receita_rebate = (rebate_liq_on + rebate_liq_off) × split_plataforma

receita_bruta  = receita_fee + receita_rebate
```
A taxa de rebate é **anual** → `÷ 12` (dilução 1/12). `aliq_*` modela a **retenção
na origem** (o rebate chega líquido); não é IRPJ/CSLL. `split_plataforma = 0,5`
(fração retida pela Galápagos).

**Fallbacks nunca-zero.** Alíquota de rebate ausente/NaN cai no **default
constante** (não 0, que inflaria a receita) e registra a perna que fez fallback.
Sem registro de poupança → `receita_rebate = 0` (jamais usar PL do cadastro).

**Caso de borda.** Pure asset sem PL numa perna → aquela perna é 0 por construção
(sem ramo especial).

**Invariante.** PL provém **exclusivamente** do registro de poupança do período.

---

## 6. DRE por cliente

**Propósito.** Cascata da receita ao lucro líquido, por regime tributário.

**Fórmula (cascata).**
```
impostos_faturamento = receita_bruta × alíq_faturamento[regime]

custo_total          = custo_direto + custo_dedicado + indireto

margem_contribuicao  = receita_bruta − impostos_faturamento − custo_direto − custo_dedicado
EBITDA               = receita_bruta − impostos_faturamento − custo_total

impostos_lucro       = receita_bruta × 0,0768          (presumido)
                       max(0, EBITDA) × 0,34           (real)

lucro_liquido        = EBITDA − impostos_lucro
margem_ebitda        = EBITDA / receita_bruta          (0 se receita = 0)
margem_liquida       = lucro_liquido / receita_bruta
```
Alíquotas de faturamento: **presumido 0,0865** (PIS/COFINS/ISS); **real 0,1425**.

**Perfil do cliente** (classificação):
```
asset_only                      → pure_asset
fee = 0 ∧ rebate > 0            → fee_isento
fee > 0 ∧ rebate = 0            → fee_based
fee > 0 ∧ rebate > 0            → hibrido
caso contrário                  → fee_based
```

**Casos de borda.** Receita 0 → margens 0 (divisão segura). Regime real: imposto de
lucro só incide sobre EBITDA **positivo**.

**Invariante contábil.** `margem_contribuicao ≡ EBITDA + indireto`. O EBITDA **não**
desconta IRPJ/CSLL (esses entram só abaixo, no lucro líquido).

---

## 7. Demanda (régua de horas)

A demanda é **régua** (diagnóstico de staffing e base de proposta para prospect),
**nunca** custo de cliente existente — para este, a mão de obra entra só pela
alocação real (§2).

### 7.1 Horas reais estimadas (`calcularHorasReais`)

**Propósito.** Estimar a carga de horas por função aplicando o catálogo de
atividades aos drivers do cliente (perfil + volumetria do mês).

**Fórmula por atividade** (catálogo completo no Apêndice B; `vol = volume_movimentos_mes`):

| Driver | Horas geradas |
|---|---|
| `fixo` | `horas_base` |
| `boolean` | `horas_base` se a flag do perfil estiver ligada, senão 0 |
| `vol_movimentos` (geral) | `horas_base × (vol / driver_base)` |
| `vol_movimentos` (fluxo de caixa) | `vol × 0,5 / 60` (fórmula especial) |
| `qtd_veiculos` / `qtd_imoveis` / `qtd_func_domesticos` | `horas_base × contagem do perfil` |
| `qtd_recebiveis` / `qtd_contratacoes` | `horas_base × volumetria do mês` |
| `grupos_financeiros` | reservado (sem atividade ativa) |

As horas de cada atividade são somadas na **função** que a atividade serve.

**Saídas.** `por_funcao[função]`, `total`, `alertas[]`, `detalhes[]` (atividade,
horas, função, valor do driver).

**Casos de borda.** `gestao_obra` ativo sem cobrança → alerta (sem horas).
`revisao_contratos` ativo sem pacote jurídico → alerta.

### 7.2 Fator de demanda (`calcularFatorEscopoReal`)

```
fator_demanda(função) = horas_reais(função) / horas_normativas_pacote(função)
```
`> 1` → cliente consome além do pacote (candidato a reajuste). 0 quando a função não
tem horas normativas no pacote.

### 7.3 Distribuição automática de pct (`calcularPctDistribuido`)

**Propósito.** Sugerir o `pct` de cada cliente para um colaborador numa função,
proporcional às horas-base, somando 100% da capacidade alocável.

**Fórmula.**
```
horas_base(c) =  horas_reais(c, função)        se c tem perfil_complexidade
                 horas_normativas_pacote(c)     caso contrário        (fallback)

pct(c) = horas_base(c) / Σ horas_base × percentual_alocavel(colab)
```

**Invariante.** `Σ pct = percentual_alocavel` (100% da folha alocável capturada). O
gate é por **presença** do objeto perfil, não por valores — evita zerar `pct` de
clientes sem perfil configurado.

---

## 8. Custo/hora médio por função

**Propósito.** Custo/hora de referência da função para o custo de **demanda**
(proposta/cenário), refletindo quem de fato exerce a função.

**Fórmula (ponderação por vínculo).**
```
peso(colab, função) = Σpct do colaborador naquela função (resolver vínculo-first)

custo_hora_médio(função) =  Σ custo_hora(colab) × peso(colab, função)
                            ────────────────────────────────────────
                                    Σ peso(colab, função)
```

**Fallback.** Função sem nenhum vínculo no período → média ponderada por
`percentual_alocavel` dos colaboradores cuja `funcao_principal` é essa função
(garante custo/hora não-zero).

**Casos de borda.** Função sem representantes em nenhuma das duas vias → 0.

---

## 9. Precificação

### 9.1 Fee sugerido (rebate-subsídio)

**Propósito.** Preço que atinge a margem EBITDA alvo, já descontado o que o rebate
subsidia.

**Fórmula.**
```
denom               = 1 − alíq_faturamento[regime] − margem_alvo
receita_necessaria  = custo_total / denom
fee_sugerido        = receita_necessaria − rebate_liquido
```
`custo_total` = custo direto + dedicado + indireto. Se `fee_sugerido ≤ 0`, o rebate
cobre o custo (cliente rentável só pelo rebate); o excedente é
`rebate_liquido − receita_necessaria`.

**Casos de borda.** `denom ≤ 0` (margem + imposto ≥ 100%) → cenário inválido,
sinalizado na UI (sem fee).

### 9.2 Razão de overhead de referência

**Propósito.** Estabilizar a Precificação contra a sensibilidade do período.

A razão `poolGeral/ΣDireto` (§4) é **hiper-sensível** à completude da alocação:
quando muito custo direto fica não-capturado, o pool (folha-driven, estável)
dividido por uma base pequena infla a razão. Por isso a Precificação usa **sempre**
`overhead_ratio_referencia` (parâmetro global de um período validado), não a razão do
período corrente. A UI permite recalcular a referência do período corrente, com
aviso se a nova razão divergir > 20% (sinal de alocação incompleta).

### 9.3 Custo de cenário e gerador de prospect

**Cenário (cliente existente, diagnóstico):** recalcula a mão de obra às
horas-demanda, mantendo o dedicado real:
```
custo_direto_cen = Σ horas_demanda(função) × custo_hora_médio(função)
custo_total_cen  = custo_direto_cen + custo_dedicado_real + custo_direto_cen × overhead_ref
fee_cenario      = custo_total_cen / denom − rebate_liquido
```

**Gerador (prospect, sem alocação):**
```
custo_direto = Σ horas_reais(função) × custo_hora_médio(função)
overhead     = custo_direto × overhead_ratio_referencia
custo_total  = custo_direto + dedicados_estimados + overhead
fee_sugerido = custo_total / denom − rebate_estimado
```
O custo de cliente existente **jamais** usa o modelo de demanda (duplicaria a mão de
obra já capturada pela alocação real).

**Invariante.** Cada real entra no custo por **um** canal: alocação real para
cliente existente; demanda para prospect/cenário.

---

## 10. Gestores ("o gestor se paga?")

**Propósito.** Medir se a carteira de um gestor cobre o custo cheio do gestor.

**Carteira.** Gestor = colaborador com vínculo `consultoria_gestao` e `pct > 0`. A
carteira são os clientes desses vínculos (fonte: vínculos, nunca o campo legado).

**Margem antes do gestor (com devolução de dupla contagem).**
```
ebitda_carteira = Σ EBITDA(c)            c ∈ carteira
custo_alocado   = Σ linha consultoria_gestao do gestor em c   (pct × custo × fatorNorm)

# 1ª ordem: o EBITDA já descontou o custo direto do gestor → devolvê-lo
# 2ª ordem: a auto-ociosidade do gestor volta via rateio à própria carteira
ociosidade_gestor = max(0, alocável − Σpct(gestor)) × custo_total(gestor)
fatia_devolvida   = ociosidade_gestor × (Σ custo_direto da carteira / ΣDireto total)

margem_antes = ebitda_carteira + custo_alocado + fatia_devolvida
cobertura    = margem_antes / custo_total_mensal(gestor)        (denominador CHEIO)
se_paga      ⇔ cobertura ≥ 1
```
A ociosidade **dos outros** colaboradores rateada à carteira **não** é devolvida — é
overhead legítimo. Só a auto-ociosidade do próprio gestor é viés circular.

**Multi-gestor.** Um cliente com dois vínculos `consultoria_gestao` (pct > 0)
pertenceria a duas carteiras; o tratamento-alvo é ratear o EBITDA do cliente pelo
`pct` de cada gestor. (Hoje não há multi-gestor.)

**Invariante.** A aba Gestores é **exposição** — nunca recalcula o motor; usa
`EBITDA` e as linhas de mão de obra já produzidas pelo pipeline.

---

## 11. Detalhamentos (exposição validada)

### 11.1 Decomposição de mão de obra (`detalharMaoDeObra`)

Por função alocada: `(função, responsável, pct_efetivo, horas, valor)`, onde
`pct_efetivo = pct × fatorNorm`, `horas = pct_efetivo × HORAS_CLT_MES ×
percentual_alocavel`, `valor = pct_efetivo × custo_total_mensal`.

**Invariante.** `Σ valor das linhas ≡ custo_direto` ao centavo — mesma base, mesmo
resolver, mesmo `fatorNorm` do motor.

### 11.2 Indireto por categoria

A exposição do indireto rateado decompõe o `poolGeral` em suas origens (5 categorias
`geral` + institucional + ociosidade), aplicando a mesma proporção
`custo_direto(c)/ΣDireto` do rateio. A soma das parcelas por cliente reconstrói o
`indireto(c)` do motor.

**Invariante geral dos detalhamentos.** Toda decomposição é uma **vista** do mesmo
cálculo do motor; reconstrói o agregado correspondente sem recomputar por uma via
paralela.

---

## 12. Mapa de invariantes do motor

1. Folha ≡ direto(normalizado) + institucional + ociosidade.
2. `Σ pct distribuído = percentual_alocavel` (captura 100% da folha alocável).
3. Razão de indireto uniforme: `indireto/direto = poolGeral/ΣDireto`.
4. `margem_contribuicao ≡ EBITDA + indireto`.
5. PL só vem do registro de poupança do período.
6. Cada real de custo entra por um canal (alocação real **ou** demanda).
7. `Σ linhas de mão de obra ≡ custo_direto`.
8. Pure asset: custo direto 0, excluído do rateio geral.
9. Alíquota de rebate nunca cai a 0 por ausência (fallback ao default).
