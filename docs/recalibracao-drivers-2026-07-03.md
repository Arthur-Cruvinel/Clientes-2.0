# Recalibração de drivers de horas — 2026-07-03

Mudança de RÉGUA das horas-base do catálogo `ATIVIDADES_SERVICO`. Afeta a demanda
estimada (`calcularHorasReais`) → **fee sugerido da Reajustes** e **"esperado" da
matriz de capacidade** mudam de propósito. **NÃO** move o custo_direto FECHADO
(a DRE lê `pct_*` salvo, não recomputa horas — `financials.custos.ts:285-286`).

Guard-rail vigente: **não re-rodar Alocação em Lote com save em período fechado** —
a redistribuição de pct sob a nova régua moveria o custo_direto no save.

## Antes → Depois

| Atividade | Função | Antes | Depois | Commit |
|---|---|---|---|---|
| gestao_veiculos | serv_adm | 2,81h/veículo | **1,0h** | Commit 1 |
| gestao_imoveis | serv_adm | 3,94h/imóvel | **1,5h** | Commit 1 |
| grupos_financeiros (nova atividade) | serv_adm | 0h (sem atividade) | **2,5h/grupo** | Commit 2 |
| contas_bancarias (novo driver completo) | operacional_financeiro | — (não precificava) | **1,5h/conta** | Commit 2 |

## Efeito esperado (antes/depois)
- **Reajustes:** fee sugerido dos clientes com veículos/imóveis **cai** (menos horas);
  clientes com grupos/contas passam a ter demanda maior.
- **Matriz de capacidade:** o "esperado" cai para veículos/imóveis → o "excesso"
  (real − esperado) **sobe**; grupos/contas passam a somar esperado.
- **Fechado (2026-01):** inalterado — Σ custo_direto = 134.376,84 / Σ EBITDA = −4.424,03.
