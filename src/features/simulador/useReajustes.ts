// --- Hook da aba Reajustes (Precificação) ---
// Fee sugerido por cliente existente sob a filosofia "rebate subsidia o fee".
//
// FÓRMULA CENTRAL (fechada com o CFO — EXPOSIÇÃO, motor intocado):
//   O cliente deve à casa a margem EBITDA alvo sobre o custo total servido,
//   por qualquer combinação de fee + rebate líquido:
//     receita_necessaria = custo_total ÷ (1 − aliq_imp_fat − margem_alvo)
//     fee_sugerido       = receita_necessaria − rebate_líquido
//   custo_total/rebate vêm do ResultadoCliente do pipeline real (zero recálculo);
//   aliq_imp_fat = ALIQUOTAS[regime].faturamento; rebate = receita_rebate.
//
// PRINCÍPIO (decisão CFO): cada real entra no custo por UM canal. Para cliente
// EXISTENTE o custo da mão de obra é SEMPRE o realizado (alocação por vínculos) —
// o modelo de DEMANDA nunca vira custo de cliente existente (duplicaria a mesma
// mão de obra). A demanda aqui é apenas DIAGNÓSTICO de staffing (alocadas vs
// demanda) + um "fee cenário" hipotético (se o staffing fosse refeito pela
// demanda) — rotulado como CENÁRIO, nunca como o fee de ação.

import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { ALIQUOTAS, FUNCOES_ALOCACAO } from '../../utils/constants';
import { calcularHorasReais } from '../../utils/financials';
import { custoHoraMedioPorFuncao, custoDiretoDemanda } from './precificacaoBase';
import type { Cliente, FuncaoAlocacao } from '../../types';

export type PerfilStatus = 'completo' | 'parcial' | 'ausente';
export type ReajusteBadge = 'subprecificado' | 'ok' | 'sobreprecificado' | 'rebate_cobre';
export type AtendimentoBadge = 'subatendido' | 'alinhado' | 'sobreatendido';

const LIMIAR_ATENDIMENTO = 0.20; // |Δ| ÷ demanda acima disso classifica sub/sobre

export interface StaffingFuncao { funcao: FuncaoAlocacao; demanda: number; alocada: number; }

export interface ReajusteRow {
  nome: string;
  pacote: string;
  perfilStatus: PerfilStatus;
  custoTotal: number;
  rebateLiquido: number;
  receitaNecessaria: number;
  feeAtual: number;
  feeSugerido: number;
  gap: number;
  gapPct: number | null;
  excedenteRebate: number;
  badge: ReajusteBadge;
  // ── Diagnóstico de atendimento (só com perfil; null sem perfil) ──
  horasDemanda: number | null;
  horasAlocadas: number;
  deltaAtendimento: number | null;     // alocadas − demanda
  atendimento: AtendimentoBadge | null;
  feeCenario: number | null;           // fee se a mão de obra fosse a demanda (CENÁRIO)
  staffing: StaffingFuncao[];          // por função, p/ drill-down
}

function perfilStatusDe(c?: Cliente): PerfilStatus {
  if (!c?.perfil_complexidade) return 'ausente';
  const temVol = (c.volume_movimentos_mes ?? 0) > 0
    || (c.qtd_contratacoes_mes ?? 0) > 0 || (c.qtd_recebiveis_mes ?? 0) > 0;
  return temVol ? 'completo' : 'parcial';
}

export function useReajustes(materialidadePct: number) {
  const { dadosPeriodo, regime, parametros, periodoSelecionado, loading } = useApp();

  const aliqImpFat = ALIQUOTAS[regime].faturamento;
  const margemAlvo = parametros.margem_alvo;
  const denom = 1 - aliqImpFat - margemAlvo;

  const rows = useMemo<ReajusteRow[]>(() => {
    if (!dadosPeriodo || denom <= 0) return [];
    const { resultados, clientes, colaboradores } = dadosPeriodo;
    const cliByNome = new Map(clientes.map(c => [c.nome_cliente, c]));
    const custoHoraMedio = custoHoraMedioPorFuncao(colaboradores);
    // Razão de overhead SEMPRE da referência (parametros/global), não a do
    // período corrente — esta é hiper-sensível à completude da alocação.
    const overheadRatio = parametros.overhead_ratio_referencia;

    return resultados.map(r => {
      const custoTotal = r.custo_total;
      const rebateLiquido = r.receita_rebate;
      const feeAtual = r.receita_fee;
      const receitaNecessaria = custoTotal / denom;
      const feeSugerido = receitaNecessaria - rebateLiquido;
      const gap = feeSugerido - feeAtual;
      const gapPct = feeAtual > 0.01 ? gap / feeAtual : null;

      let badge: ReajusteBadge;
      if (feeSugerido <= 0.01) badge = 'rebate_cobre';
      else if (feeAtual <= 0.01) badge = 'subprecificado';
      else if (gapPct! > materialidadePct) badge = 'subprecificado';
      else if (gapPct! < -materialidadePct) badge = 'sobreprecificado';
      else badge = 'ok';

      // ── Diagnóstico de atendimento (horas) ──
      const cli = cliByNome.get(r.nome_cliente);
      // alocadas = Σ horas da mão de obra REALIZADA (linhas_mao_de_obra do motor).
      const horasAlocadas = (r.linhas_mao_de_obra ?? []).reduce((s, l) => s + l.horas, 0);
      const alocadaPorFuncao = {} as Record<FuncaoAlocacao, number>;
      for (const l of r.linhas_mao_de_obra ?? []) alocadaPorFuncao[l.funcao] = (alocadaPorFuncao[l.funcao] ?? 0) + l.horas;

      let horasDemanda: number | null = null, deltaAtendimento: number | null = null;
      let atendimento: AtendimentoBadge | null = null, feeCenario: number | null = null;
      let staffing: StaffingFuncao[] = [];

      if (cli?.perfil_complexidade) {
        const horas = calcularHorasReais(cli, cli.perfil_complexidade);
        horasDemanda = horas.total;
        deltaAtendimento = horasAlocadas - horasDemanda;
        const ref = horasDemanda > 0.01 ? horasDemanda : 1;
        atendimento = Math.abs(deltaAtendimento) / ref <= LIMIAR_ATENDIMENTO ? 'alinhado'
          : deltaAtendimento < 0 ? 'subatendido' : 'sobreatendido';
        staffing = FUNCOES_ALOCACAO
          .map(f => ({ funcao: f, demanda: horas.por_funcao[f] ?? 0, alocada: alocadaPorFuncao[f] ?? 0 }))
          .filter(x => x.demanda > 0.01 || x.alocada > 0.01);
        // Fee CENÁRIO: mão de obra a horas_demanda × custo_hora médio + mesmo
        // overhead proporcional; dedicado real mantido (não é mão de obra).
        const custoDirCen = custoDiretoDemanda(horas.por_funcao, custoHoraMedio);
        const custoTotalCen = custoDirCen + r.custo_dedicado + custoDirCen * overheadRatio;
        feeCenario = custoTotalCen / denom - rebateLiquido;
      }

      return {
        nome: r.nome_cliente, pacote: r.pacote_servico,
        perfilStatus: perfilStatusDe(cli),
        custoTotal, rebateLiquido, receitaNecessaria, feeAtual, feeSugerido,
        gap, gapPct, excedenteRebate: feeSugerido <= 0 ? rebateLiquido - receitaNecessaria : 0, badge,
        horasDemanda, horasAlocadas, deltaAtendimento, atendimento, feeCenario, staffing,
      };
    });
  }, [dadosPeriodo, denom, materialidadePct, parametros.overhead_ratio_referencia]);

  const dinheiroNaMesa = useMemo(
    () => rows.filter(r => r.badge === 'subprecificado').reduce((s, r) => s + Math.max(0, r.gap), 0),
    [rows]);
  const nSubatendidos = rows.filter(r => r.atendimento === 'subatendido').length;
  const nSobreatendidos = rows.filter(r => r.atendimento === 'sobreatendido').length;

  return { rows, dinheiroNaMesa, nSubatendidos, nSobreatendidos, margemAlvo, aliqImpFat, denomInvalido: denom <= 0, periodoSelecionado, loading };
}
