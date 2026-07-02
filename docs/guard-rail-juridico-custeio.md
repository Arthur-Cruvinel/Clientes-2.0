# Guard-rail — jurídico consultivo: custeio vs venda

**Contexto.** A unificação "revisão de contratos → demanda" mexeu na **VENDA**
(proposta/orçador), **não** no **CUSTEIO** (DRE). O checkbox "Revisão de contratos"
saiu do form da proposta; o driver `revisao_contratos` no catálogo de custeio
(`ATIVIDADES_SERVICO`) e o dado gravado nos clientes **permanecem intocados**.

## ⚠️ NÃO re-rodar Alocação em Lote com SAVE em período FECHADO

O driver `revisao_contratos` injeta 6,17h de `consultoria_financeira` em
`calcularHorasReais` → `calcularPctDistribuido` (sugestão de rateio). O
`custo_direto` da DRE lê o `pct_*` **salvo**, não recomputa horas — então o fechado
2026-01 (Σ custo_direto = 134.376,84) está **congelado e seguro**.

**Mas:** se a **Alocação em Lote** for re-executada e **re-salva** para um período
já fechado, os **12 clientes** com `revisao_contratos=true` (ARTHUR MENDONÇA CABRAL,
CASSIO RAMOS, GABRIEL FERNANDO DE JESUS, HARIEL DENARO RIBEIRO, LEANDRO IMPROTA,
LEONARDO JARDIM, LUIZ HENRIQUE, PAULINHO, RICHARLISON, ROGER GUEDES, SAMIR SANTOS,
THIAGO MENDES) perderiam 6,17h de demanda estimada → o `pct` se redistribui → o
`custo_direto` fechado **se moveria** no save.

**Regra:** re-distribuição de Alocação em Lote com save **só em período aberto**. O
driver permanece no custeio justamente para preservar o fechado até um
re-fechamento deliberado.

## Fonte do custo por demanda (venda)

Custo jurídico por demanda = `pool_mensal_juridico ÷ capacidade_demandas_mes` quando
ambos > 0 (Configurações → Jurídico); senão fallback `tempo × custo_hora × fator`
(≈R$207). Fonte única em `precificacaoBase.custoDemandaJuridicaEfetivo` /
`custoHoraJuridicoEfetivo`, consumida por `calcularFee` (parcela N×custo) e pela 7ª
rubrica do Orçador. Defaults 0 = comportamento atual byte a byte.
