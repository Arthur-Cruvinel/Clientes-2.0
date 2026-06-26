# Apêndice B — Motor Técnico

> Assinaturas reais das funções do motor (`src/utils/financials.*` e
> `src/features/simulador/precificacaoBase.ts`), o pipeline em pseudocódigo fiel e
> as fórmulas com os valores vigentes dos parâmetros. Complementa a Parte III.

---

## B.1 Mapa dos módulos

| Arquivo | Responsabilidade |
|---|---|
| `financials.pipeline.ts` | Orquestração do período (`processarPeriodo`) |
| `financials.custos.ts` | Folha, custo direto, resolução de vínculos, indireto, institucional |
| `financials.alocacao.ts` | Normalização, ociosidade, pct efetivo, distribuição, ocupação |
| `financials.receita.ts` | Receita (fee + rebate por perna) |
| `financials.dre.ts` | DRE por cliente (cascata até lucro líquido) |
| `financials.horasReais.ts` | Demanda (catálogo de atividades → horas) |
| `precificacaoBase.ts` | Custo/hora médio, razão de overhead, custo de demanda |

---

## B.2 Assinaturas reais

### Orquestração — `financials.pipeline.ts`
```typescript
processarPeriodo(
  clientes: Cliente[], colaboradores: Colaborador[], custosIndiretos: CustoIndireto[],
  registrosPoupanca: RegistroPoupanca[], regime: RegimeTributario,
  vinculos: Vinculo[] = [], aliquotasRebate?: AliquotasRebate,
): ResultadoCliente[]
```

### DRE — `financials.dre.ts`
```typescript
calcularDRE(
  cliente: Cliente, colaboradores: Colaborador[], todosClientes: Cliente[],
  todosCustosDiretos: Record<string, number>, custosIndiretos: CustoIndireto[],
  regime: RegimeTributario, poupanca?: RegistroPoupanca, vinculos: Vinculo[] = [],
  fatorNorm: Record<string, number> = {}, poolNaoAlocado?: number,
  aliquotasRebate?: AliquotasRebate,
): ResultadoCliente
```

### Receita — `financials.receita.ts`
```typescript
calcularReceita(
  cliente: Cliente, poupanca?: RegistroPoupanca, aliquotas?: AliquotasRebate,
): ResultadoReceita   // { receita_fee, receita_rebate, receita_bruta }
```

### Custos / folha — `financials.custos.ts`
```typescript
buscarTetoPorPeriodo(colaborador: Colaborador, periodo: string): ResultadoReajuste
calcularFolhaColaborador(c: Colaborador, ano = ANO_FOLHA_VIGENTE, periodo?: string): ResultadoFolha
calcularCustoColaborador(c: Colaborador, periodo?: string): { custo_total_mensal; custo_hora }
calcularCustoDireto(cliente: Cliente, colaboradores: Colaborador[], vinculos: Vinculo[] = [],
                    fatorNormPorColab: Record<string, number> = {}): number
detalharMaoDeObra(cliente: Cliente, colaboradores: Colaborador[], vinculos: Vinculo[] = [],
                  fatorNormPorColab: Record<string, number> = {}): LinhaMaoDeObra[]
somarPctPorColaborador(clientes: Cliente[], colaboradores: Colaborador[], vinculos: Vinculo[]): Record<string, number>
somarPctPorFuncaoColaborador(clientes: Cliente[], colaboradores: Colaborador[], vinculos: Vinculo[]):
                  Record<FuncaoAlocacao, Record<string, number>>
calcularFatoresEscopo(cliente: Cliente, vinculos: Vinculo[] = []): Record<FuncaoAlocacao, number>
calcularCustoInstitucional(colaboradores: Colaborador[]): number
calcularCustosIndiretos(cliente: Cliente, custoDiretoCliente: number, todosClientes: Cliente[],
                  todosCustosDiretos: Record<string, number>, custosIndiretos: CustoIndireto[],
                  poolNaoAlocado: number): { geral: number; juridico: number; conciliacao: number }
```

### Alocação — `financials.alocacao.ts`
```typescript
horasEfetivasMensais(pct: number, percentualAlocavel: number): number
pctEfetivo(colaborador, cliente, funcao, vinculos): number
pctEfetivoFuncao(cliente, funcao, vinculos): number
ocupacaoConsolidada(colaborador, clientes, vinculos): { total: number; porFuncao: Record<string, number> }
calcularFatorNormalizacao(colaboradores, somaPctPorColab): Record<string, number>
calcularOciosidade(colaboradores, somaPctPorColab): number
calcularPctDistribuido(clientes, funcao, colaborador): Record<string, number>
calcularFatorSobrecarga(clientes, funcao, colaborador): number
somarHorasDemanda(clientes, funcao): number
horasProdutivasMes(colaborador): number
```

### Demanda — `financials.horasReais.ts`
```typescript
calcularHorasReais(cliente: Cliente, perfil: PerfilComplexidade): HorasReaisCalculadas
calcularFatorEscopoReal(horasReais: HorasReaisCalculadas, cliente: Cliente): Record<FuncaoAlocacao, number>
pctNormativoPorHorasReais(horasReais: HorasReaisCalculadas, funcao: FuncaoAlocacao): number
```

### Precificação — `features/simulador/precificacaoBase.ts`
```typescript
custoHoraMedioPorFuncao(colaboradores: Colaborador[], clientes: Cliente[] = [], vinculos: Vinculo[] = []):
                  Record<FuncaoAlocacao, number>
overheadRatioPeriodo(colaboradores, custosIndiretos, clientes, vinculos, resultados): number
custoDiretoDemanda(horasPorFuncao: Record<FuncaoAlocacao, number>,
                   custoHoraMedio: Record<FuncaoAlocacao, number>): number
```

---

## B.3 Pipeline em pseudocódigo fiel

### `processarPeriodo`
```
entrada: clientes, colaboradores, custosIndiretos, registrosPoupanca, regime, vinculos, aliquotasRebate

# 0. Pré-passe por colaborador
somaPct        ← somarPctPorColaborador(clientes, colaboradores, vinculos)
fatorNorm      ← calcularFatorNormalizacao(colaboradores, somaPct)
ociosidade     ← calcularOciosidade(colaboradores, somaPct)
poolNaoAlocado ← calcularCustoInstitucional(colaboradores) + ociosidade

# 1. Custo direto por cliente (normalizado)
para cada c em clientes:
    todosCustosDiretos[c.nome_cliente] ← calcularCustoDireto(c, colaboradores, vinculos, fatorNorm)

# 2. Índice de poupança
poupancaPorNome ← Map(registrosPoupanca por nome_cliente)

# 3. DRE por cliente
resultados ← clientes.map(c =>
    calcularDRE(c, colaboradores, clientes, todosCustosDiretos, custosIndiretos,
                regime, poupancaPorNome[c.nome_cliente], vinculos,
                fatorNorm, poolNaoAlocado, aliquotasRebate))

# 4. Ordena por lucro líquido desc.
retorna resultados.sort(lucro_liquido desc)
```

### `calcularDRE`
```
(receita_fee, receita_rebate, receita_bruta) ← calcularReceita(cliente, poupanca, aliquotasRebate)
perfil ← definirPerfil(receita_fee, receita_rebate, pacote)

impostos_faturamento ← receita_bruta × ALIQUOTAS[regime].faturamento

custo_direto ← todosCustosDiretos[cliente.nome] ?? calcularCustoDireto(...)        # reaproveita pré-passe
linhas       ← detalharMaoDeObra(cliente, colaboradores, vinculos, fatorNorm)

pool   ← poolNaoAlocado ?? calcularCustoInstitucional(colaboradores)               # fallback isolado
rateios ← calcularCustosIndiretos(cliente, custo_direto, todosClientes,
                                   todosCustosDiretos, custosIndiretos, pool)

custo_dedicado ← custo_contabilidade_dedicado + custo_pagamento_dedicado
               + custo_administrativo_dedicado + custo_viagem_dedicado
               + rateios.juridico + rateios.conciliacao
custo_indireto_rateado ← rateios.geral

custo_total         ← custo_direto + custo_dedicado + custo_indireto_rateado
margem_contribuicao ← receita_bruta − impostos_faturamento − custo_direto − custo_dedicado
ebitda              ← receita_bruta − impostos_faturamento − custo_total

impostos_lucro ← (regime = presumido) ? receita_bruta × 0,0768 : max(0, ebitda) × 0,34
lucro_liquido  ← ebitda − impostos_lucro
fatores_escopo ← calcularFatoresEscopo(cliente, vinculos)
```

### `calcularFolhaColaborador` (CLT)
```
teto, liquido ← buscarTetoPorPeriodo(c, periodo)         # ou campos diretos sem período
inss   ← INSS progressivo(teto)
irrf   ← IRRF progressivo(teto − inss − dependentes×dedução)  [− redutor 2026]
liquido_do_teto ← teto − inss − irrf
complemento_plr ← max(0, liquido − liquido_do_teto)
reflexos_plr    ← (complemento_plr / 12) × (4/3)         # 13º proporcional + 1/3 férias
encargos        ← teto × 0,28
decimo_ferias   ← (teto / 12) × (4/3)
custo_total_mensal ← teto + beneficios_fixos + encargos + decimo_ferias + complemento_plr + reflexos_plr
custo_hora ← (custo_total_mensal × 12) / horas_produtivas(localidade)
```
Pro_labore: `encargos = base × 0,20`; `custo_total = base + beneficios + encargos`; sem PLR/13º.
Estágio: `custo_total = bolsa + beneficios`; sem encargos/PLR/13º.

---

## B.4 Fórmulas com valores vigentes

### Alíquotas tributárias
| Regime | Faturamento | Lucro |
|---|--:|--:|
| Presumido | 0,0865 | 0,0768 (sobre receita) |
| Real | 0,1425 | 0,34 (sobre EBITDA positivo) |

### Receita de rebate
```
receita_rebate = (PL_on × 0,006/12 × (1 − 0,1653) + PL_off × 0,006/12 × (1 − 0,21)) × 0,5
```
Taxas de rebate vigentes 0,006 a.a. (ambas as pernas); retenção na origem 16,53%
(onshore) / 21% (offshore); split de plataforma 0,5.

### Fee sugerido (precificação)
```
denom              = 1 − ALIQUOTAS[regime].faturamento − 0,20        # margem_alvo = 0,20
receita_necessaria = custo_total / denom
fee_sugerido       = receita_necessaria − rebate_liquido
overhead           = custo_direto × 1,3116                           # overhead_ratio_referencia
```
Exemplo (presumido): `denom = 1 − 0,0865 − 0,20 = 0,7135`.

### Folha — encargos e provisões
| Componente | CLT | Pro_labore | Estágio |
|---|---|---|---|
| Encargos patronais | teto × 0,28 | base × 0,20 | 0 |
| 13º + férias (provisão) | (teto/12) × 4/3 | 0 | 0 |
| Reflexos PLR | (complemento/12) × 4/3 | 0 | 0 |
| custo/hora | (custo_mensal × 12) / horas produtivas | idem | idem |

### Horas produtivas
`HORAS_CLT_MES = 168` (base do escopo normativo). Horas produtivas por localidade
≈ 1.968 h/ano (~164 h/mês), líquidas de férias e feriados (15 por localidade).

### Indireto e referência
```
poolGeral = Σ categorias 'geral' + institucional + ociosidade
indireto(c) = poolGeral × custo_direto(c) / Σ custo_direto    (pure asset excluído)
razão de referência (parametros/global) = 1,3116
```
