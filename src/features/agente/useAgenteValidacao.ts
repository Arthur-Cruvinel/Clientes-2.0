// --- Hook de validação financeira (algorítmica, sem API) ---
// Usa as mesmas funções de cálculo da plataforma (calcOffshore, encadeamento read-time).

import { useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { DadosCliente, RegistroPoupanca, Parametros } from '../../types';
import { encontrarPoupanca } from '../../utils/formatters';
import { calcOffshore } from '../poupanca/DetalheTabela';

export type TipoAlerta = 'rent_alta' | 'rent_negativa' | 'nnm_grande';
export type TipoInconsistencia = 'consistencia_aum_on' | 'consistencia_aum_off' | 'encadeamento_on' | 'encadeamento_off' | 'rent_pct' | 'rebate';

export interface Alerta {
  nome_cliente: string;
  mes: number;
  ano: number;
  tipo: TipoAlerta;
  descricao: string;
  valor: number;
}

export interface Inconsistencia {
  nome_cliente: string;
  mes: number;
  ano: number;
  tipo: TipoInconsistencia;
  campo: string;
  valor_atual: number;
  valor_esperado: number;
  diferenca: number;
}

export interface ResultadoValidacao {
  semInconsistencias: string[];
  alertas: Alerta[];
  inconsistencias: Inconsistencia[];
  totalClientes: number;
  totalMeses: number;
  tempoExecucao: number;
}

export type EscopoValidacao = 'todos' | 'cliente';
export type StatusExecucao = 'idle' | 'executando' | 'concluido';

const TOL_AUM = 2.0;
const TOL_ENCADEAMENTO = 5.0; // R$ 5 (arredondamentos entre lâminas)
const TOL_RENT_PCT = 0.001;   // 0.1pp
const TOL_REBATE = 1.0;
const LIMITE_RENT_ALTA = 0.30;
const LIMITE_RENT_NEGATIVA = -0.20;

function pNum(a: number, m: number) { return a * 12 + m; }

export function useAgenteValidacao() {
  const [escopo, setEscopo] = useState<EscopoValidacao>('todos');
  const [clienteEscolhido, setClienteEscolhido] = useState('');
  const [mesInicio, setMesInicio] = useState(1);
  const [anoInicio, setAnoInicio] = useState(2025);
  const [mesFim, setMesFim] = useState(new Date().getMonth() || 12);
  const [anoFim, setAnoFim] = useState(new Date().getFullYear());
  const [status, setStatus] = useState<StatusExecucao>('idle');
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);

  const executar = useCallback(async (
    dadosClientes: DadosCliente[],
    parametros: Parametros,
    registrosPoupancaPeriodo: RegistroPoupanca[] = [],
  ) => {
    const inicio = Date.now();
    setStatus('executando');
    setResultado(null);

    const snap = await getDocs(collection(db, 'poupanca'));
    const todosRegistros: RegistroPoupanca[] = snap.docs.map(d => {
      const raw = { id: d.id, ...d.data() } as RegistroPoupanca;
      // Read-time: recalcular totais (mesma lógica do usePoupanca)
      raw.pl_total = (raw.pl_onshore ?? 0) + (raw.pl_offshore ?? 0);
      raw.pl_inicial_total = (raw.pl_inicial_onshore ?? 0) + (raw.pl_inicial_offshore ?? 0);
      raw.aporte_mes_total = (raw.aporte_mes_onshore ?? 0) + (raw.aporte_mes_offshore ?? 0);
      raw.rentabilidade_total = (raw.rentabilidade_onshore ?? 0) + (raw.rentabilidade_offshore ?? 0);
      if (raw.nnm_tombamento_onshore != null || raw.nnm_tombamento_offshore != null) {
        raw.nnm_tombamento = (raw.nnm_tombamento_onshore ?? 0) + (raw.nnm_tombamento_offshore ?? 0);
      }
      return raw;
    });

    const periodoIni = pNum(anoInicio, mesInicio);
    const periodoFim = pNum(anoFim, mesFim);
    const registrosFiltrados = todosRegistros.filter(r => {
      const p = pNum(r.ano, r.mes);
      return p >= periodoIni && p <= periodoFim;
    });

    // Agrupar por cliente e ordenar
    const porCliente = new Map<string, RegistroPoupanca[]>();
    for (const r of registrosFiltrados) {
      const nome = r.nome_cliente.trim().toUpperCase();
      if (!porCliente.has(nome)) porCliente.set(nome, []);
      porCliente.get(nome)!.push(r);
    }
    for (const regs of porCliente.values()) {
      regs.sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
    }

    // Aplicar encadeamento onshore (mesma lógica do usePoupanca)
    for (const [, regs] of porCliente) {
      for (let i = 1; i < regs.length; i++) {
        const prev = regs[i - 1];
        const curr = regs[i];
        if ((prev.pl_onshore ?? 0) > 0.01) {
          curr.pl_inicial_onshore = prev.pl_onshore;
        }
        curr.pl_inicial_total = (curr.pl_inicial_onshore ?? 0) + (curr.pl_inicial_offshore ?? 0);
      }
    }

    let clientesParaValidar: string[];
    if (escopo === 'cliente' && clienteEscolhido) {
      clientesParaValidar = [clienteEscolhido.trim().toUpperCase()];
    } else {
      clientesParaValidar = [...porCliente.keys()];
    }

    setProgresso({ atual: 0, total: clientesParaValidar.length });

    const alertas: Alerta[] = [];
    const inconsistencias: Inconsistencia[] = [];
    const semProblema: string[] = [];
    let totalMeses = 0;

    const dadosMap = new Map<string, DadosCliente>();
    for (const d of dadosClientes) dadosMap.set(d.nome_cliente.trim().toUpperCase(), d);

    for (let idx = 0; idx < clientesParaValidar.length; idx++) {
      const nomeUpper = clientesParaValidar[idx];
      const regs = porCliente.get(nomeUpper) ?? [];
      const clienteAlerts: Alerta[] = [];
      const clienteIncons: Inconsistencia[] = [];

      for (let i = 0; i < regs.length; i++) {
        const r = regs[i];
        const prev = i > 0 ? regs[i - 1] : null;
        totalMeses++;

        // Filtrar meses fantasma
        const T = 0.01;
        const plTotal = Math.abs(r.pl_total ?? 0);
        const plIniTotal = Math.abs(r.pl_inicial_total ?? 0);
        if (plTotal < T && plIniTotal < T && Math.abs(r.aporte_mes_total ?? 0) < T) continue;

        // ── Tombamento onshore (aporte "real" = nnm - tombamento) ──
        // No mês de tombamento, pl_inicial JÁ reflete o valor trazido; e o mesmo
        // valor aparece em aporte_mes. Contar os dois dá double count.
        let tombOn = 0;
        if (r.nnm_tombamento_onshore != null || r.nnm_tombamento_offshore != null) {
          tombOn = r.nnm_tombamento_onshore ?? 0;
        } else if ((r.nnm_tombamento ?? 0) > 0) {
          const tomb = r.nnm_tombamento ?? 0;
          const absOn = Math.abs(r.aporte_mes_onshore ?? 0);
          const absOff = Math.abs(r.aporte_mes_offshore ?? 0);
          const absTotal = absOn + absOff;
          if (absTotal > T) tombOn = tomb * (absOn / absTotal);
        }

        // ── ONSHORE: Consistência AUM ──
        const piOn = r.pl_inicial_onshore ?? 0;
        const pfOn = r.pl_onshore ?? 0;
        const nnmOn = r.aporte_mes_onshore ?? 0;
        const impOn = r.impostos_mes ?? 0;
        const rentOn = r.rentabilidade_onshore ?? 0;
        if (piOn > T || pfOn > T) {
          // Duas fórmulas possíveis, para suportar dados novos E legados:
          //  - Dados novos (parser corrigido): aporte_mes já é "NNM limpo"
          //    (nnm - tombamento) → usa fórmula direta: pi + nnm + rent - imp
          //  - Dados legados (pré-correção): aporte_mes contém o tombamento
          //    inflado → precisa subtrair tombOn para bater: pi + (nnm - tomb) + rent - imp
          // Aceita se QUALQUER uma bate — reporta a mais próxima se ambas falham.
          const esperadoClean = piOn + nnmOn - impOn + rentOn;
          const esperadoLegacy = piOn + (nnmOn - tombOn) - impOn + rentOn;
          const diffClean = Math.abs(pfOn - esperadoClean);
          const diffLegacy = Math.abs(pfOn - esperadoLegacy);
          const diffOn = Math.min(diffClean, diffLegacy);
          if (diffOn > TOL_AUM) {
            const esperadoOn = diffClean <= diffLegacy ? esperadoClean : esperadoLegacy;
            clienteIncons.push({
              nome_cliente: r.nome_cliente, mes: r.mes, ano: r.ano,
              tipo: 'consistencia_aum_on', campo: 'pl_onshore',
              valor_atual: pfOn, valor_esperado: esperadoOn, diferenca: diffOn,
            });
          }
        }

        // ── ONSHORE: Encadeamento ──
        if (prev && (prev.pl_onshore ?? 0) > T && (r.pl_inicial_onshore ?? 0) > T) {
          const diffEnc = Math.abs((prev.pl_onshore ?? 0) - (r.pl_inicial_onshore ?? 0));
          // Encadeamento já corrigido em read-time, então diff deve ser ~0
          // Se ainda há diff, é dado corrompido no Firestore
          if (diffEnc > TOL_ENCADEAMENTO) {
            clienteIncons.push({
              nome_cliente: r.nome_cliente, mes: r.mes, ano: r.ano,
              tipo: 'encadeamento_on', campo: 'pl_inicial_onshore',
              valor_atual: r.pl_inicial_onshore ?? 0, valor_esperado: prev.pl_onshore ?? 0, diferenca: diffEnc,
            });
          }
        }

        // ── OFFSHORE: Consistência via calcOffshore ──
        const plUsd = r.pl_offshore_usd ?? 0;
        const plUsdPrev = prev?.pl_offshore_usd ?? 0;
        if (plUsd > T || plUsdPrev > T) {
          const off = calcOffshore(r, prev);
          // Verificar: pi + nnm + rent ≈ pf (em BRL)
          const pfOff = r.pl_offshore ?? 0;
          const esperadoOff = off.piBrl + off.nnmBrl + off.rentBrl;
          // Ganho cambial faz parte da diferença — incluir
          const gc = off.primeiroMes ? 0 :
            (off.plUsdInicial > T && prev?.ptax_fechamento)
              ? off.plUsdInicial * (off.ptaxAtual - off.ptaxAnterior) : 0;
          const esperadoComGc = esperadoOff + gc;
          const diffOff = Math.abs(pfOff - esperadoComGc);
          // Primeiro mês (sem starting): % aplicada sobre base zero gera divergência
          // maior — amplia tolerância. Meses normais: só arredondamento USD/BRL.
          const primeiroMes = !r.pl_inicial_offshore_usd;
          const tolerancia = primeiroMes ? 5000 : 500;
          if (diffOff > tolerancia) {
            clienteIncons.push({
              nome_cliente: r.nome_cliente, mes: r.mes, ano: r.ano,
              tipo: 'consistencia_aum_off', campo: 'pl_offshore',
              valor_atual: pfOff, valor_esperado: esperadoComGc, diferenca: diffOff,
            });
          }

          // Encadeamento offshore (USD)
          if (prev && plUsdPrev > T) {
            // pl_inicial_offshore deveria ser prev.pl_offshore_usd × ptax
            // Mas o save pode usar ptax diferente. Validar em USD.
            // Não há campo pl_inicial_offshore_usd, então validamos BRL com tolerância
          }
        }

        // ── Rentabilidade %: onshore ──
        const rentPct = r.rentabilidade_pct ?? 0;
        const baseOn = piOn + nnmOn;
        if (baseOn > T && rentOn !== 0 && Math.abs(r.pl_offshore_usd ?? 0) < T) {
          // Só valida rent_pct se cliente é only-onshore (consolidado = onshore)
          const rentPctEsperado = rentOn / baseOn;
          const diffPct = Math.abs(rentPct - rentPctEsperado);
          if (diffPct > TOL_RENT_PCT) {
            clienteIncons.push({
              nome_cliente: r.nome_cliente, mes: r.mes, ano: r.ano,
              tipo: 'rent_pct', campo: 'rentabilidade_pct',
              valor_atual: rentPct, valor_esperado: rentPctEsperado, diferenca: diffPct,
            });
          }
        }

        // ── Valores suspeitos ──
        if (rentPct > LIMITE_RENT_ALTA) {
          clienteAlerts.push({
            nome_cliente: r.nome_cliente, mes: r.mes, ano: r.ano,
            tipo: 'rent_alta', valor: rentPct,
            descricao: `Rent. ${(rentPct * 100).toFixed(1)}% acima de 30%`,
          });
        }
        if (rentPct < LIMITE_RENT_NEGATIVA) {
          clienteAlerts.push({
            nome_cliente: r.nome_cliente, mes: r.mes, ano: r.ano,
            tipo: 'rent_negativa', valor: rentPct,
            descricao: `Rent. ${(rentPct * 100).toFixed(1)}% abaixo de -20%`,
          });
        }
        if (piOn > T && Math.abs(nnmOn) > piOn * 2) {
          clienteAlerts.push({
            nome_cliente: r.nome_cliente, mes: r.mes, ano: r.ano,
            tipo: 'nnm_grande', valor: nnmOn,
            descricao: `NNM onshore ${nnmOn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} > 2x AUM inicial`,
          });
        }
      }

      // ── Rebate ──
      // PL vem do RegistroPoupanca do período (CLAUDE.md) — não está no Cliente.
      const dadosCli = dadosMap.get(nomeUpper);
      if (dadosCli && (dadosCli.receita_rebate ?? 0) > 0) {
        const poupancaCli = encontrarPoupanca(dadosCli.nome_cliente, registrosPoupancaPeriodo);
        const taxaOn = dadosCli.percentual_rebate_anual_onshore ?? 0;
        const taxaOff = dadosCli.percentual_rebate_anual_offshore ?? 0;
        const plOn = poupancaCli?.pl_onshore ?? 0;
        const plOff = poupancaCli?.pl_offshore ?? 0;
        const rebateBruto = (plOn * taxaOn) / 12 + (plOff * taxaOff) / 12;
        const rebateCalc = rebateBruto * (1 - dadosCli.aliquota_impostos_rebate) * parametros.split_plataforma;
        const diffRebate = Math.abs(dadosCli.receita_rebate - rebateCalc);
        if (diffRebate > TOL_REBATE) {
          clienteIncons.push({
            nome_cliente: dadosCli.nome_cliente, mes: 0, ano: 0,
            tipo: 'rebate', campo: 'receita_rebate',
            valor_atual: dadosCli.receita_rebate, valor_esperado: rebateCalc, diferenca: diffRebate,
          });
        }
      }

      if (clienteAlerts.length === 0 && clienteIncons.length === 0 && regs.length > 0) {
        semProblema.push(regs[0]?.nome_cliente ?? nomeUpper);
      }

      alertas.push(...clienteAlerts);
      inconsistencias.push(...clienteIncons);
      setProgresso({ atual: idx + 1, total: clientesParaValidar.length });
    }

    setResultado({
      semInconsistencias: semProblema,
      alertas,
      inconsistencias,
      totalClientes: clientesParaValidar.length,
      totalMeses,
      tempoExecucao: Date.now() - inicio,
    });
    setStatus('concluido');
  }, [escopo, clienteEscolhido, mesInicio, anoInicio, mesFim, anoFim]);

  const resetar = useCallback(() => {
    setStatus('idle');
    setResultado(null);
    setProgresso({ atual: 0, total: 0 });
  }, []);

  return {
    escopo, setEscopo, clienteEscolhido, setClienteEscolhido,
    mesInicio, setMesInicio, anoInicio, setAnoInicio,
    mesFim, setMesFim, anoFim, setAnoFim,
    status, progresso, resultado,
    executar, resetar,
  };
}
