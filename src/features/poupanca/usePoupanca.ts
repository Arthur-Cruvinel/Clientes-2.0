// --- Hook principal do módulo Poupança ---
// Busca registros, agrupa por cliente, calcula totais e gerencia meta NNM.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { RegistroPoupanca, Cliente } from '../../types';
import { nnmPoupancaLiquida, nnmReal, nnmRealOnshore, nnmRealOffshore } from '../../utils/financials';
import { calcOffshore, pickR } from './DetalheTabela';
import { buscarAumLegado, invalidarCacheAumLegado } from '../../services/aumLegado';
import { buscarCDIMensal } from '../../services/cdi';
import { buscarCDIProjetado } from '../../services/cdiProjetado';

export type ModoAUM = 'galapagos' | 'sob_gestao';

export interface TotaisPoupanca {
  pl_total: number;
  nnm_mes: number;
  nnm_poupanca_liquida_total: number;
  tombamento_total: number;
  rentabilidade_media: number;
  clientes_poupando: number;
  total_clientes: number;
  rent_total_brl: number;
}

export interface MetaAUM {
  valor: number;          // ex: 1_300_000_000
  data_alvo: string;      // "YYYY-MM" ex: "2026-12"
}

export interface MetaPeriodo {
  ano: number;
  valor_aum: number;
  data_alvo: string;      // "YYYY-MM"
  nnm_mensal: number;     // NNM derivado
}

export interface DadosProjecao {
  mediaOrganicoMensal: number;     // média (poupLiq + rent) dos meses realizados
  capacidadePoupancaTotal: number; // Σ capacidade de poupança de todos os clientes
  aumAtual: number;                // último AUM real
  ultimoMesRealizado: { ano: number; mes: number };
}

export interface PontoHistorico {
  periodo: string;
  pl_total: number;
  ano: number;
  mes: number;
}

export interface PontoMetaCumprimento {
  periodo: string;
  ano: number;
  mes: number;
  nnm: number;             // NNM total (captação bruta)
  tombamento: number;      // Tombamento (portabilidade)
  poupancaLiquida: number; // NNM - tombamento
  rentabilidade: number;   // Rendimento de mercado (BRL)
  meta: number;            // Meta NNM mensal (0 para meses passados)
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function pNum(a: number, m: number) { return a * 12 + m; }

/** Mediana de uma lista de números — robusta a outliers. Um mês com resgate
 *  massivo (rentabilidade muito negativa pontual) NÃO distorce a mediana,
 *  ao contrário da média aritmética. Vazia → 0. */
function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[meio - 1] + sorted[meio]) / 2
    : sorted[meio];
}

/** Mediana com filtro de outliers (>2σ da média aritmética). Combina robustez
 *  da mediana + descarte de eventos extremos pontuais (aporte excepcional,
 *  resgate único). Útil para projetar NNM "esperado" a partir do histórico
 *  de aportes regulares.
 *
 *  Retorna `{ valor, kept, excluded }` para auditoria — o consumidor expõe
 *  `nnm_meses_historico = kept` e `nnm_meses_excluidos = excluded`.
 *
 *  Casos-limite:
 *   - lista vazia → { 0, 0, 0 }
 *   - 1 valor → sem média/desvio, retorna o próprio valor
 *   - desvio = 0 (todos iguais) → não filtra
 *   - filtro removeu tudo → fallback para mediana da lista original */
function medianaSemOutliers(valores: number[]): { valor: number; kept: number; excluded: number } {
  if (valores.length === 0) return { valor: 0, kept: 0, excluded: 0 };
  if (valores.length === 1) return { valor: valores[0], kept: 1, excluded: 0 };
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const variancia = valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length;
  const desvio = Math.sqrt(variancia);
  const filtrados = desvio > 0
    ? valores.filter(v => Math.abs(v - media) <= 2 * desvio)
    : valores;
  const lista = filtrados.length > 0 ? filtrados : valores;
  return {
    valor: mediana(lista),
    kept: lista.length,
    excluded: valores.length - lista.length,
  };
}

/** Detalhamento de cliente com critério de burn baseado em RENTABILIDADE real
 *  (média das `pickR(...).rp` mensais — TWR-style), não em variação de PL.
 *  Mais preciso: rentabilidade negativa = perda real de mercado, distinto de
 *  resgates do cliente (que reduzem PL mas não são "burn"). Alimenta o
 *  BurnRateModal e o ProjecaoModal. */
export interface VariacaoPLCliente {
  nome_cliente: string;
  // Médias do período — base do critério de burn e da projeção.
  taxa_media_mensal: number;         // média das rentabilidades % mensais (decimal)
  rent_brl_media_mensal: number;     // média da rentabilidade BRL mensal
  pl_atual: number;                  // PL no último mês do intervalo
  // NNM esperado mensal — base para a parcela linear da projeção.
  // Mediana com filtro de outliers (>2σ) sobre o HISTÓRICO COMPLETO de
  // poupança líquida do cliente (não restrito ao intervalo selecionado).
  // `meta_poupanca_mensal` do último mês sobrescreve o cálculo automático.
  nnm_esperado_mensal: number;
  nnm_fonte: 'manual' | 'automatico';
  nnm_meses_historico: number;       // meses considerados no cálculo (após filtro)
  nnm_meses_excluidos: number;       // meses descartados como outlier (>2σ)
  // Projeção até Dez/anoFim — compounding mensal × pl_atual + nnm × meses.
  pl_projetado_fim_ano: number;
  meses_para_fim_ano: number;
  // Meta proporcional ao PL atual (distribuição da meta global).
  meta_aum: number | null;
  gap_meta: number | null;           // pl_projetado - meta_aum
  // Classificação.
  em_burn: boolean;                  // taxa_media_mensal < 0
  severidade: 'leve' | 'moderado' | 'critico' | null;
  rebate_em_risco: number;           // anual, baseado em |rent_brl_media_mensal|
}

/** Severidade do burn por taxa média mensal (decimal): leve > -1%/mês,
 *  moderado entre -3% e -1%, crítico ≤ -3%. */
function severidadeBurn(taxa: number): 'leve' | 'moderado' | 'critico' | null {
  if (taxa >= 0) return null;
  if (taxa > -0.01) return 'leve';
  if (taxa > -0.03) return 'moderado';
  return 'critico';
}

// ============================================================
// MM6 — Modelo definitivo de projeção
// ============================================================
//
// MM6 = média dos últimos 6 meses do HISTÓRICO COMPLETO do cliente
// (não do intervalo selecionado). Se cliente tem < 6 meses, usa todos.
//
// Métricas MM6 alimentam:
//   - Burn rate: variacao_mm6 = mm6_nnm_liquido + mm6_rent_brl < 0
//   - Projeção mês a mês até Dez/anoFim:
//       PL[t] = PL[t-1] × (1 + cdi_proj[t] × spread) + mm6_nnm_liquido
//   - Rebate em risco: Σ PL[t] × taxa × (1 − alíq) × 0.5 (só se em burn)
//   - Meta: meta_poupanca_mensal manual ou mm6_nnm_liquido auto
//
// O `spread` é calculado uma vez por cliente (mm6_rent_pct / mm6_cdi_pct).
// Permite extrapolar a performance relativa ao CDI realizado para o CDI
// projetado dos meses futuros (curva SELIC Focus do BCB).

export interface MM6Cliente {
  nome_cliente: string;
  // ── Médias MM6 (histórico completo, últimos 6 meses) ─────────────
  mm6_nnm_liquido: number;        // R$/mês — NNM bruto − tombamento (base do PL projetado)
  mm6_nnm_bruto: number;          // R$/mês — média de nnmReal(r) (aporte − transferência interna; sem subtrair tomb)
  mm6_tombamento: number;         // R$/mês — média de (tomb_on + tomb_off), fallback legado
  mm6_rent_brl: number;           // R$/mês — rentabilidade BRL
  mm6_rent_pct: number;           // decimal/mês — média simples de pickR.rp
  mm6_cdi_pct: number;            // decimal/mês — CDI realizado dos mesmos 6 meses
  spread: number;                 // mm6_rent_pct / mm6_cdi_pct (1.0 quando neutro)
  variacao_mm6: number;           // R$/mês — mm6_nnm_liquido + mm6_rent_brl
  n_meses: number;                // quantos meses históricos foram usados
  // ── Burn rate (critério MM6) ─────────────────────────────────────
  em_burn: boolean;               // variacao_mm6 < 0
  severidade: 'leve' | 'moderado' | 'critico' | null;
                                  // % do PL: > -1% leve, > -3% moderado, ≤ -3% crítico
  // ── PL ───────────────────────────────────────────────────────────
  pl_atual: number;
  ultimo_mes: { ano: number; mes: number };
  // ── Projeção mês a mês até Dez/anoFim (usa mm6_nnm_liquido) ──────
  pl_projetado_por_mes: Array<{
    ano: number;
    mes: number;
    pl: number;
    rent_proj: number;            // cdi_proj × spread (decimal/mês)
    cdi_proj: number;             // CDI projetado do mês (decimal/mês)
  }>;
  pl_projetado_fim_ano: number;
  // ── Capacidade esperada e meta individual ────────────────────────
  // Capacidade = quanto o cliente pode poupar mês a mês (manual ou auto MM6).
  // Meta individual = projeção do PL futuro USANDO a capacidade no lugar do
  // mm6_nnm_liquido. Quando capacidade é automática (MM6), meta_individual ≈
  // pl_projetado_fim_ano (gap próximo de zero). Quando capacidade é manual,
  // o gap mostra a diferença entre o que se ESPERA (manual) e o que se
  // PROJETA pela tendência (mm6_nnm_liquido).
  capacidade_esperada: number;
  capacidade_fonte: 'manual' | 'automatico';
  meta_individual: number | null;       // null se sem_capacidade_poupanca = true
  gap_meta_individual: number | null;   // meta_individual − pl_projetado_fim_ano
  // ── Meta NNM mensal (informativo, usado pelo BurnRateModal) ──────
  meta_mensal: number | null;     // R$/mês — manual (meta_poupanca_mensal) ou auto (mm6_liq)
  meta_fonte: 'manual' | 'automatico' | null;
  // ── Rebate em risco ──────────────────────────────────────────────
  rebate_em_risco: number;        // R$ — perda anual projetada se em burn
}

/** Calcula as médias MM6 (NNM líquido, rentabilidade BRL, rentabilidade %) sobre
 *  os últimos 6 meses do histórico do cliente. CDI fica fora — alimentado depois
 *  via fetch async (precisa I/O). `regAnterior` é o registro imediatamente
 *  anterior à janela (para que o offshore consiga calcular variação cambial
 *  no primeiro mês via prev). */
function mm6PorCliente(
  todosRegsCliente: RegistroPoupanca[],
  regAnterior: RegistroPoupanca | null,
): {
  ultimos6: RegistroPoupanca[];
  mm6_nnm_liquido: number;
  mm6_nnm_bruto: number;
  mm6_tombamento: number;
  mm6_rent_brl: number;
  mm6_rent_pct: number;
  variacao_mm6: number;
  n_meses: number;
} {
  const sorted = [...todosRegsCliente].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
  const ultimos6 = sorted.slice(-6);
  if (ultimos6.length === 0) {
    return { ultimos6: [], mm6_nnm_liquido: 0, mm6_nnm_bruto: 0, mm6_tombamento: 0,
      mm6_rent_brl: 0, mm6_rent_pct: 0, variacao_mm6: 0, n_meses: 0 };
  }
  const n = ultimos6.length;
  // NNM líquido (média) — descarta tombamento.
  const nnms = ultimos6.map(r => nnmPoupancaLiquida(r));
  const mm6_nnm_liquido = nnms.reduce((a, b) => a + b, 0) / n;
  // NNM "bruto real" = média de nnmReal(r) (aporte_on + aporte_off − transferência
  // interna). Subtrair transferência aqui evita inflar a capacidade esperada
  // automática quando o cliente movimentou dinheiro entre contas próprias.
  const brutos = ultimos6.map(r => nnmReal(r));
  const mm6_nnm_bruto = brutos.reduce((a, b) => a + b, 0) / n;
  // Tombamento por mês: prefere campos por dimensão (quando algum > 0); senão
  // fallback ao legado consolidado. Evita dupla contagem porque o usePoupanca
  // recomputa nnm_tombamento como soma das dimensões quando elas existem.
  const tombs = ultimos6.map(r => {
    const on = r.nnm_tombamento_onshore ?? 0;
    const off = r.nnm_tombamento_offshore ?? 0;
    if (on > 0 || off > 0) return on + off;
    return r.nnm_tombamento ?? 0;
  });
  const mm6_tombamento = tombs.reduce((a, b) => a + b, 0) / n;
  // Rent BRL e % via pickR — prev correto encadeia janela
  let somaRb = 0, somaRp = 0, contRp = 0;
  for (let i = 0; i < ultimos6.length; i++) {
    const prev = i > 0 ? ultimos6[i - 1] : regAnterior;
    const d = pickR(ultimos6[i], 'consolidado', prev);
    somaRb += d.rb;
    if (d.rp != null) { somaRp += d.rp; contRp++; }
  }
  const mm6_rent_brl = somaRb / n;
  const mm6_rent_pct = contRp > 0 ? somaRp / contRp : 0;
  return {
    ultimos6,
    mm6_nnm_liquido,
    mm6_nnm_bruto,
    mm6_tombamento,
    mm6_rent_brl,
    mm6_rent_pct,
    variacao_mm6: mm6_nnm_liquido + mm6_rent_brl,
    n_meses: n,
  };
}

/** Severidade MM6 — % do PL atual (não % de rentabilidade).
 *  Regra: variacao_mm6 / pl_atual. */
function severidadeMM6(variacaoBrl: number, plAtual: number): 'leve' | 'moderado' | 'critico' | null {
  if (variacaoBrl >= 0 || plAtual <= 0) return null;
  const pct = variacaoBrl / plAtual;
  if (pct > -0.01) return 'leve';
  if (pct > -0.03) return 'moderado';
  return 'critico';
}

/**
 * Capacidade de poupança efetiva por cliente — fonte única para qualquer consumo.
 *
 * Ordem de resolução:
 *   1. campo `capacidade_poupanca_mensal` gravado (qualquer sinal) → usa direto.
 *   2. flag `sem_capacidade_poupanca=true` → retorna null (cliente excluído).
 *   3. auto-fill: média NNM líq. dos meses com movimento (|liq| > R$0,01).
 *      Sem histórico significativo → null.
 *
 * Retorno null = cliente não contribui para projeção nem métricas de burn.
 */
function capacidadeEfetiva(regs: RegistroPoupanca[]): number | null {
  if (regs.length === 0) return null;
  const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
  const ultimo = sorted[sorted.length - 1];
  if (ultimo.capacidade_poupanca_mensal != null) {
    return ultimo.capacidade_poupanca_mensal;
  }
  if (ultimo.sem_capacidade_poupanca) return null;
  let somaLiq = 0, mesesComDado = 0;
  for (const r of sorted) {
    const liq = nnmPoupancaLiquida(r);
    if (Math.abs(liq) > 0.01) { somaLiq += liq; mesesComDado++; }
  }
  return mesesComDado > 0 ? somaLiq / mesesComDado : null;
}

export function usePoupanca(
  mesInicio: number, anoInicio: number,
  mesFim: number, anoFim: number,
  clientes?: Cliente[],
) {
  const [todosRegistros, setTodosRegistros] = useState<RegistroPoupanca[]>([]);
  const [loading, setLoading] = useState(false);
  const [metaNNM, setMetaNNMState] = useState<number | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [modoAUM, setModoAUM] = useState<ModoAUM>('sob_gestao');
  const [aumLegadoPorMes, setAumLegadoPorMes] = useState<Map<string, number>>(new Map());
  const [aumLegadoTotal, setAumLegadoTotal] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    getDocs(collection(db, 'poupanca')).then(snap => {
      if (cancelado) return;
      // Computa TODOS os campos consolidados (*_total) em tempo de leitura.
      // Garante consistência independente da ordem de import (onshore antes
      // de offshore ou vice-versa). Cada import grava apenas os campos do
      // seu tipo; merge preserva os do outro. A soma acontece aqui.
      //
      // AUTO-REPARO: se pl_onshore === 0 mas pl_inicial_onshore > 0, o
      // campo foi corrompido por um import offshore antigo que gravava
      // pl_onshore: 0 indevidamente. Recalcula a partir dos componentes.
      const registros = snap.docs.map(d => {
        const raw = { id: d.id, ...d.data() } as RegistroPoupanca;

        // Auto-reparo de pl_onshore corrompido
        if ((raw.pl_onshore ?? 0) === 0 && (raw.pl_inicial_onshore ?? 0) > 0) {
          raw.pl_onshore = (raw.pl_inicial_onshore ?? 0)
            + (raw.aporte_mes_onshore ?? 0)
            + (raw.rentabilidade_onshore ?? 0)
            - (raw.impostos_mes ?? 0);
        }

        raw.pl_total = (raw.pl_onshore ?? 0) + (raw.pl_offshore ?? 0);
        raw.pl_inicial_total = (raw.pl_inicial_onshore ?? 0) + (raw.pl_inicial_offshore ?? 0);
        raw.aporte_mes_total = (raw.aporte_mes_onshore ?? 0) + (raw.aporte_mes_offshore ?? 0);
        raw.rentabilidade_total = (raw.rentabilidade_onshore ?? 0) + (raw.rentabilidade_offshore ?? 0);
        // Tombamento: consolidar a partir dos campos separados (se existem)
        // Fallback para campo legado nnm_tombamento
        if (raw.nnm_tombamento_onshore != null || raw.nnm_tombamento_offshore != null) {
          raw.nnm_tombamento = (raw.nnm_tombamento_onshore ?? 0) + (raw.nnm_tombamento_offshore ?? 0);
        }
        return raw;
      });
      // AUTO-REPARO: encadeamento do saldo inicial onshore.
      // O parser pode importar pl_inicial errado para o primeiro mês
      // (pega a linha seguinte da tabela em vez da linha (i)).
      // Correção: pl_inicial[t] = pl_final[t-1] para registros consecutivos.
      const porCliente = new Map<string, RegistroPoupanca[]>();
      for (const r of registros) {
        const lista = porCliente.get(r.nome_cliente) ?? [];
        lista.push(r);
        porCliente.set(r.nome_cliente, lista);
      }
      for (const [, regs] of porCliente) {
        regs.sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
        for (let i = 1; i < regs.length; i++) {
          const prev = regs[i - 1];
          const curr = regs[i];
          // Onshore: pl_inicial = pl_final do mês anterior
          // (corrige bug do parser Comdinheiro que pega saldo pós-movimentação do dia 1)
          if ((prev.pl_onshore ?? 0) > 0.01) {
            curr.pl_inicial_onshore = prev.pl_onshore;
          }
          // Offshore: NÃO encadear pl_inicial_offshore aqui.
          // O offshore usa pl_offshore_usd (USD) como referência via calcOffshore.
          // Encadear BRL corromperia o cálculo quando PTAX muda entre meses.

          // Recalcular totais
          curr.pl_inicial_total = (curr.pl_inicial_onshore ?? 0) + (curr.pl_inicial_offshore ?? 0);
        }
      }

      setTodosRegistros(registros);
      // Buscar AUM legado (invalidar cache para dados atualizados)
      invalidarCacheAumLegado();
      buscarAumLegado().then(({ porMes, total }) => {
        if (!cancelado) { setAumLegadoPorMes(porMes); setAumLegadoTotal(total); }
      });
    }).catch(e => console.error('[Poupanca] Erro ao buscar registros:', e))
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [fetchCount]);

  // [NOVO] Força rebuscar dados do Firestore
  const recarregar = useCallback(() => setFetchCount(c => c + 1), []);

  const [metaAUM, setMetaAUMState] = useState<MetaAUM | null>(null);
  const [metasPeriodo, setMetasPeriodoState] = useState<MetaPeriodo[]>([]);

  useEffect(() => {
    getDoc(doc(db, 'config', 'poupanca')).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setMetaNNMState(data.meta_nnm_mensal ?? null);
        if (data.meta_aum_valor && data.meta_aum_data_alvo) {
          setMetaAUMState({ valor: data.meta_aum_valor, data_alvo: data.meta_aum_data_alvo });
        }
        if (Array.isArray(data.metas_periodo)) {
          setMetasPeriodoState(data.metas_periodo);
        }
      }
    }).catch(e => console.error('[Poupanca] Erro ao buscar config:', e));
  }, []);

  const setMetaNNM = useCallback(async (valor: number) => {
    await setDoc(doc(db, 'config', 'poupanca'), { meta_nnm_mensal: valor }, { merge: true });
    setMetaNNMState(valor);
  }, []);

  const setMetaAUM = useCallback(async (meta: MetaAUM) => {
    await setDoc(doc(db, 'config', 'poupanca'), {
      meta_aum_valor: meta.valor,
      meta_aum_data_alvo: meta.data_alvo,
    }, { merge: true });
    setMetaAUMState(meta);
  }, []);

  const setMetasPeriodo = useCallback(async (metas: MetaPeriodo[]) => {
    await setDoc(doc(db, 'config', 'poupanca'), { metas_periodo: metas }, { merge: true });
    setMetasPeriodoState(metas);
  }, []);

  // Filtra por intervalo + remove meses fantasma.
  // Meses fantasma = registros onde o cliente não existia ainda (tudo zero).
  // Acontece quando a lâmina multi-período inclui linhas zeradas pra meses
  // anteriores à entrada do cliente. Se não filtrar, distorce o cálculo de
  // rentabilidade acumulada e spread vs CDI (comparar 0% com CDI = spread negativo).
  const registrosIntervalo = useMemo(() => {
    const ini = pNum(anoInicio, mesInicio), fim = pNum(anoFim, mesFim);
    return todosRegistros.filter(r => {
      const p = pNum(r.ano, r.mes);
      if (p < ini || p > fim) return false;
      // Mês fantasma: cliente não existia (todos os valores irrelevantes).
      // Usa threshold de R$ 1 em vez de zero exato porque a lâmina
      // Comdinheiro pode ter centavos residuais (juros sobre saldo zero,
      // arredondamento, taxa mínima) que fariam o filtro falhar.
      const abs = Math.abs;
      const pl = abs(r.pl_total ?? 0);
      const plIni = abs(r.pl_inicial_total ?? 0);
      const nnm = abs(r.aporte_mes_total ?? 0);
      const rent = abs(r.rentabilidade_total ?? 0);
      if (pl < 1 && plIni < 1 && nnm < 1 && rent < 1) return false;
      return true;
    });
  }, [todosRegistros, mesInicio, anoInicio, mesFim, anoFim]);

  // Agrupa por cliente
  const registrosPorCliente = useMemo(() => {
    const mapa = new Map<string, RegistroPoupanca[]>();
    for (const r of registrosIntervalo) {
      const lista = mapa.get(r.nome_cliente) ?? [];
      lista.push(r);
      mapa.set(r.nome_cliente, lista);
    }
    return mapa;
  }, [registrosIntervalo]);

  // Série histórica de AUM Total — respeita período do filtro + modo AUM
  const historico = useMemo<PontoHistorico[]>(() => {
    const agrupado = new Map<string, { pl: number; ano: number; mes: number }>();
    for (const r of registrosIntervalo) {
      const chave = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      const atual = agrupado.get(chave) ?? { pl: 0, ano: r.ano, mes: r.mes };
      atual.pl += r.pl_total ?? 0;
      agrupado.set(chave, atual);
    }
    return Array.from(agrupado.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, v]) => {
        const legado = modoAUM === 'sob_gestao' ? (aumLegadoPorMes.get(chave) ?? 0) : 0;
        return {
        periodo: `${MESES_LABEL[v.mes - 1]}/${String(v.ano).slice(2)}`,
        pl_total: v.pl + legado,
        ano: v.ano,
        mes: v.mes,
      };
      });
  }, [registrosIntervalo, modoAUM, aumLegadoPorMes]);

  // Série de NNM + Rentabilidade + Meta por mês — usa calcOffshore para offshore
  const historicoMetaCumprimento = useMemo<PontoMetaCumprimento[]>(() => {
    // Agrupar por mês, mas precisamos de prev por cliente para calcOffshore
    // Primeiro: agrupar registros por cliente+mês para ter contexto de prev
    const porClienteMes = new Map<string, RegistroPoupanca[]>();
    for (const r of registrosIntervalo) {
      const lista = porClienteMes.get(r.nome_cliente) ?? [];
      lista.push(r);
      porClienteMes.set(r.nome_cliente, lista);
    }

    // Para cada cliente, calcular NNM, tombamento e rent corrigidos por mês
    const agrupado = new Map<string, { nnm: number; tomb: number; rent: number; ano: number; mes: number }>();
    for (const [, regs] of porClienteMes) {
      const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : null;
        const off = calcOffshore(r, prev);
        // NNM "real" do mês — desconta transferência interna do bruto.
        // calcOffshore.nnmBrl tem ajustes especiais para o primeiro mês
        // (tombamento), então subtraímos transferência aqui em cima do total.
        const transOn = r.transferencia_interna_onshore ?? 0;
        const transOff = r.transferencia_interna_offshore ?? 0;
        const nnmMes = (r.aporte_mes_onshore ?? 0) + off.nnmBrl - (transOn + transOff);
        const rentMes = (r.rentabilidade_onshore ?? 0) + off.rentBrl;
        const tombMes = r.nnm_tombamento ?? 0;
        const chave = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
        const atual = agrupado.get(chave) ?? { nnm: 0, tomb: 0, rent: 0, ano: r.ano, mes: r.mes };
        atual.nnm += nnmMes;
        atual.tomb += tombMes;
        atual.rent += rentMes;
        agrupado.set(chave, atual);
      }
    }

    // Meta NNM: buscar da metaPeriodo do ano correspondente, ou metaNNM global
    return Array.from(agrupado.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => {
        const poupLiq = v.nnm - v.tomb;
        // Buscar meta do período do ano deste mês
        const metaDoPeriodo = metasPeriodo.find(m => m.ano === v.ano);
        const metaMes = metaDoPeriodo?.nnm_mensal ?? (metaNNM ?? 0);
        return {
          periodo: `${MESES_LABEL[v.mes - 1]}/${String(v.ano).slice(2)}`,
          ano: v.ano,
          mes: v.mes,
          nnm: v.nnm,
          tombamento: v.tomb,
          poupancaLiquida: poupLiq,
          rentabilidade: v.rent,
          meta: metaMes,
        };
      });
  }, [registrosIntervalo, metaNNM, metasPeriodo]);

  // Sugestão de meta baseada no histórico — média NNM dos últimos N meses
  // disponíveis em todosRegistros (ignora o filtro de período pra pegar o máximo
  // de história). Exposta pra PoupancaMeta usar como base + % de crescimento.
  const mediaNNMHistorica = useMemo(() => {
    const porMes = new Map<string, number>();
    for (const r of todosRegistros) {
      const chave = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      // Usa nnmReal (subtrai transferência interna) para a sugestão de meta —
      // não infla a média histórica com movimentos entre contas próprias.
      porMes.set(chave, (porMes.get(chave) ?? 0) + nnmReal(r));
    }
    const meses = Array.from(porMes.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (meses.length === 0) return null;
    // Retorna médias pra diferentes janelas
    const avg = (arr: [string, number][]) => arr.reduce((s, [, v]) => s + v, 0) / arr.length;
    return {
      ultimos3: meses.length >= 3 ? avg(meses.slice(-3)) : null,
      ultimos6: meses.length >= 6 ? avg(meses.slice(-6)) : null,
      ultimos12: meses.length >= 12 ? avg(meses.slice(-12)) : null,
      totalMeses: meses.length,
    };
  }, [todosRegistros]);

  // KPIs: consolidado, por cliente — usa calcOffshore para offshore (mesma fórmula da tabela)
  const totais = useMemo<TotaisPoupanca>(() => {
    let plTotal = 0, nnm = 0, nnmLiq = 0, tomb = 0, poupando = 0;
    let rentTotalBrl = 0;
    let somaRentPond = 0, somaPesoRent = 0;

    for (const [, regs] of registrosPorCliente) {
      const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      const ultimo = sorted[sorted.length - 1];
      plTotal += ultimo.pl_total ?? 0;

      let nnmOnCliente = 0, nnmOffBrlCliente = 0;
      let rentOnCliente = 0, rentOffBrlCliente = 0;
      let tombCliente = 0, liqCliente = 0;

      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : null;

        // Onshore: NNM Real (desconta transferência interna onshore)
        nnmOnCliente += nnmRealOnshore(r);
        rentOnCliente += r.rentabilidade_onshore ?? 0;
        tombCliente += r.nnm_tombamento ?? 0;
        liqCliente += nnmPoupancaLiquida(r);

        // Offshore: NNM Real (desconta transferência interna offshore).
        // off.nnmBrl pode incluir conversão por PTAX e accrued interest;
        // a transferência interna está em BRL no doc, então usar nnmRealOffshore
        // garante que a subtração ocorre na grandeza correta.
        const off = calcOffshore(r, prev);
        nnmOffBrlCliente += nnmRealOffshore(r);
        rentOffBrlCliente += off.rentBrl;
      }

      const aporteCliente = nnmOnCliente + nnmOffBrlCliente;
      const rentBrlCliente = rentOnCliente + rentOffBrlCliente;
      nnm += aporteCliente;
      nnmLiq += liqCliente;
      tomb += tombCliente;
      rentTotalBrl += rentBrlCliente;
      if (liqCliente > 0) poupando++;

      // Rent. ponderada: retorno % do período, ponderado pelo AUM final
      const piTotal = sorted[0].pl_inicial_total ?? 0;
      const base = piTotal + aporteCliente;
      const aumFim = ultimo.pl_total ?? 0;
      if (base > 0 && aumFim > 0) {
        somaRentPond += (rentBrlCliente / base) * aumFim;
        somaPesoRent += aumFim;
      }
    }

    return {
      pl_total: plTotal, nnm_mes: nnm, nnm_poupanca_liquida_total: nnmLiq,
      tombamento_total: tomb, rent_total_brl: rentTotalBrl,
      rentabilidade_media: somaPesoRent > 0 ? somaRentPond / somaPesoRent : 0,
      clientes_poupando: poupando, total_clientes: registrosPorCliente.size,
    };
  }, [registrosPorCliente]);

  // Dados para projeção do gráfico
  const dadosProjecao = useMemo<DadosProjecao | null>(() => {
    if (historico.length === 0) return null;
    const ult = historico[historico.length - 1];

    // Média do crescimento orgânico mensal (poupança líquida + rent)
    // Usar dados do historicoMetaCumprimento
    const mesesRealizados = historicoMetaCumprimento.length;
    let somaOrganico = 0;
    for (const d of historicoMetaCumprimento) {
      somaOrganico += d.poupancaLiquida + d.rentabilidade;
    }
    const mediaOrg = mesesRealizados > 0 ? somaOrganico / mesesRealizados : 0;

    // Capacidade total = Σ capacidadeEfetiva(cliente). Helper trata todas as
    // regras (gravado vs auto-fill vs exclusão). Zero exato não contribui.
    let capTotal = 0;
    for (const [, regs] of registrosPorCliente) {
      const cap = capacidadeEfetiva(regs);
      if (cap != null && cap !== 0) capTotal += cap;
    }

    return {
      mediaOrganicoMensal: mediaOrg,
      capacidadePoupancaTotal: capTotal,
      aumAtual: ult.pl_total,
      ultimoMesRealizado: { ano: ult.ano, mes: ult.mes },
    };
  }, [historico, historicoMetaCumprimento, registrosPorCliente]);

  // ── Memos de infraestrutura (usados por variacaoPLPorCliente abaixo) ────

  // Quantidade de meses do intervalo selecionado — usado para "média mensal"
  // nos KPIs (NNM/mês, Rent/mês). Mín 1 para evitar divisão por zero.
  const mesesNoPeriodo = useMemo(
    () => Math.max(1, pNum(anoFim, mesFim) - pNum(anoInicio, mesInicio) + 1),
    [mesInicio, anoInicio, mesFim, anoFim],
  );

  // PL inicial do PRIMEIRO mês de cada cliente dentro do intervalo. Base para
  // "Variação do AUM" no card principal (aum_final − aum_inicial).
  const aumInicialPeriodo = useMemo(() => {
    let total = 0;
    for (const [, regs] of registrosPorCliente) {
      const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      total += sorted[0]?.pl_total ?? 0;
    }
    return total;
  }, [registrosPorCliente]);

  // Para cada cliente do intervalo, encontra o registro IMEDIATAMENTE ANTERIOR
  // ao início do intervalo. Usado pela tabela para corrigir Ganho Cambial do
  // primeiro mês E pelo variacaoPLPorCliente para resolver `prev` no i=0.
  const registroAnteriorPorCliente = useMemo(() => {
    const ini = pNum(anoInicio, mesInicio);
    const mapa = new Map<string, RegistroPoupanca | null>();
    const porNome = new Map<string, RegistroPoupanca[]>();
    for (const r of todosRegistros) {
      const lista = porNome.get(r.nome_cliente) ?? [];
      lista.push(r);
      porNome.set(r.nome_cliente, lista);
    }
    for (const nome of registrosPorCliente.keys()) {
      const candidatos = porNome.get(nome) ?? [];
      let melhor: RegistroPoupanca | null = null;
      let melhorP = -1;
      for (const r of candidatos) {
        const p = pNum(r.ano, r.mes);
        if (p >= ini) continue;
        if (p > melhorP) { melhorP = p; melhor = r; }
      }
      mapa.set(nome, melhor);
    }
    return mapa;
  }, [todosRegistros, registrosPorCliente, anoInicio, mesInicio]);

  // Rentabilidade real por cliente — fonte única para burn, projeção e meta.
  // taxa_media_mensal = média das `pickR(...).rp` mensais (mesma lógica do
  // detalhe individual e da coluna Rent.% da tabela). Captura perda real de
  // mercado, distinto de resgates/aportes do cliente.
  const variacaoPLPorCliente = useMemo<VariacaoPLCliente[]>(() => {
    const lista: VariacaoPLCliente[] = [];
    const porNome = new Map<string, Cliente>();
    for (const c of clientes ?? []) porNome.set(c.nome_cliente, c);

    // Total atual global — usado para distribuir a meta proporcional ao
    // peso atual de cada cliente no AUM. Fica null por cliente quando não
    // há meta global configurada.
    let plTotalAtualGlobal = 0;
    for (const [, regs] of registrosPorCliente) {
      const sortedX = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      plTotalAtualGlobal += sortedX[sortedX.length - 1]?.pl_total ?? 0;
    }
    const metaGlobal = metaAUM?.valor ?? null;
    const fimAnoP = pNum(anoFim, 12);

    // Pré-indexa todosRegistros por cliente para o cálculo do NNM histórico
    // (precisa varrer ALÉM do intervalo selecionado — captura toda a vida do
    // cliente para uma amostra estatística decente).
    const todosPorNome = new Map<string, RegistroPoupanca[]>();
    for (const r of todosRegistros) {
      const lista = todosPorNome.get(r.nome_cliente) ?? [];
      lista.push(r);
      todosPorNome.set(r.nome_cliente, lista);
    }

    for (const [nome, regs] of registrosPorCliente) {
      const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));

      // Coleta retornos mensais (rp = % decimal, rb = BRL) via pickR — mesma
      // fonte usada pela tabela e pelo detalhe individual. prev no i=0 vem
      // do registro IMEDIATAMENTE ANTERIOR ao intervalo (corrige offshore
      // que precisa do PL_USD anterior; sem isso, primeiro mês ficava sem
      // base de comparação).
      const rps: (number | null)[] = [];
      const rbs: number[] = [];
      const regAntCliente = registroAnteriorPorCliente.get(nome) ?? null;
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : regAntCliente;
        const d = pickR(r, 'consolidado', prev);
        rps.push(d.rp);
        rbs.push(d.rb);
      }

      // taxa_media_mensal = MEDIANA das rentabilidades % mensais informadas
      // (ignora null = mês sem dado). Mediana é robusta a outliers — um mês
      // de resgate massivo não distorce a tendência de longo prazo, o que
      // tornaria a projeção exponencial irrealista. Captura retorno real de
      // mercado, não saídas/aportes do cliente.
      const rpsValidos = rps.filter((x): x is number => x !== null);
      const taxa_media_mensal = mediana(rpsValidos);
      // rent_brl_media_mensal = MEDIANA da rentabilidade BRL mensal (todos os
      // meses, incluindo zero). Usado pelo BurnRateModal e como base do
      // rebate em risco. Mediana pelos mesmos motivos acima.
      const rent_brl_media_mensal = mediana(rbs);

      const ultimo = sorted[sorted.length - 1];
      const pl_atual = ultimo?.pl_total ?? 0;
      const ultimoP = pNum(ultimo?.ano ?? anoFim, ultimo?.mes ?? 12);
      const meses_para_fim_ano = Math.max(0, fimAnoP - ultimoP);

      // ── NNM esperado mensal ──────────────────────────────────────────
      // Mediana do histórico COMPLETO de poupança líquida (NNM bruto −
      // tombamento) com filtro de outliers (>2σ da média). Histórico todo
      // (não só intervalo) porque queremos uma amostra robusta do
      // comportamento de aporte regular do cliente.
      // Filtra |liq| > 0,01: meses com movimento real (descarta mês fantasma
      // e meses absolutamente zerados).
      const todosRegsCliente = (todosPorNome.get(nome) ?? [])
        .slice().sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      const nnmHistorico = todosRegsCliente
        .map(r => nnmPoupancaLiquida(r))
        .filter(v => Math.abs(v) > 0.01);
      const nnmStats = medianaSemOutliers(nnmHistorico);
      // Meta manual do último mês do intervalo sobrescreve o cálculo
      // automático — operador comunicou um alvo explícito para esse cliente.
      const metaManual = ultimo?.meta_poupanca_mensal;
      const nnm_esperado_mensal = metaManual != null ? metaManual : nnmStats.valor;
      const nnm_fonte: 'manual' | 'automatico' = metaManual != null ? 'manual' : 'automatico';

      // Cap em -99% para evitar PL negativo via Math.pow (cliente nunca chega
      // exatamente a 0 nem cai abaixo dele numa projeção exponencial).
      const taxaCapped = Math.max(taxa_media_mensal, -0.99);
      // Projeção = compounding (rentabilidade) + parcela linear (NNM × meses).
      // Modelo aditivo simples: NNM entra todo mês e o stock antigo cresce
      // pela rent. (Refinamento futuro: capitalizar cada NNM mensal pelos
      // meses restantes — irrelevante p/ horizontes curtos.)
      const pl_projetado_fim_ano = meses_para_fim_ano === 0
        ? pl_atual
        : pl_atual * Math.pow(1 + taxaCapped, meses_para_fim_ano)
          + nnm_esperado_mensal * meses_para_fim_ano;

      // Meta por cliente = fração proporcional do peso atual no AUM total.
      const meta_aum = metaGlobal != null && plTotalAtualGlobal > 0
        ? metaGlobal * (pl_atual / plTotalAtualGlobal) : null;
      const gap_meta = meta_aum != null ? pl_projetado_fim_ano - meta_aum : null;

      const em_burn = taxa_media_mensal < 0;
      const sev = severidadeBurn(taxa_media_mensal);

      // Rebate em risco anual = |rent_brl mensal| × 12 × taxa_rebate ×
      // (1 − alíquota) × split. Usa rent BRL como proxy de "perda mensal de
      // capital" — anualizado dá a queda esperada do PL no ano, multiplicada
      // pela taxa de rebate dá a perda projetada de receita.
      const c = porNome.get(nome);
      const on = c?.percentual_rebate_anual_onshore ?? 0;
      const off = c?.percentual_rebate_anual_offshore ?? null;
      const taxaRebMedia = off != null ? (on + off) / 2 : on;
      const aliquota = c?.aliquota_impostos_rebate ?? 0;
      const rebate_em_risco = (em_burn && c)
        ? Math.abs(rent_brl_media_mensal) * 12 * taxaRebMedia * (1 - aliquota) * 0.5
        : 0;

      lista.push({
        nome_cliente: nome,
        taxa_media_mensal, rent_brl_media_mensal,
        nnm_esperado_mensal, nnm_fonte,
        nnm_meses_historico: nnmStats.kept,
        nnm_meses_excluidos: nnmStats.excluded,
        pl_atual, pl_projetado_fim_ano, meses_para_fim_ano,
        meta_aum, gap_meta,
        em_burn, severidade: sev, rebate_em_risco,
      });
    }
    return lista;
  }, [registrosPorCliente, registroAnteriorPorCliente, todosRegistros, clientes, metaAUM, anoFim]);

  const clientesEmBurnNovo = useMemo<VariacaoPLCliente[]>(
    () => variacaoPLPorCliente.filter(v => v.em_burn),
    [variacaoPLPorCliente]);

  // ── MM6 — modelo definitivo (assíncrono, depende de fetch CDI) ──────────
  // Substitui variacaoPLPorCliente como source de truth para burn/projeção/
  // rebate em risco. variacaoPLPorCliente continua exposto como legado para
  // não quebrar consumers que ainda referenciam a interface antiga.

  const [mm6Clientes, setMm6Clientes] = useState<MM6Cliente[]>([]);

  useEffect(() => {
    if (registrosPorCliente.size === 0 || todosRegistros.length === 0) {
      setMm6Clientes([]);
      return;
    }
    let cancelado = false;

    // Pré-indexa todosRegistros por nome — mesma estrutura do memo
    // variacaoPLPorCliente, replicada aqui porque o useEffect tem escopo
    // próprio (e não há ganho mensurável em memoizar separado).
    const todosPorNome = new Map<string, RegistroPoupanca[]>();
    for (const r of todosRegistros) {
      const lista = todosPorNome.get(r.nome_cliente) ?? [];
      lista.push(r);
      todosPorNome.set(r.nome_cliente, lista);
    }

    const fimAnoP = pNum(anoFim, 12);

    // Normalização de nome para casamento cross-source (clientes_base vs poupanca)
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const clientesPorNomeNorm = new Map<string, Cliente>();
    for (const c of clientes ?? []) clientesPorNomeNorm.set(norm(c.nome_cliente), c);

    (async () => {
      const resultado: MM6Cliente[] = [];

      for (const [nome, regsIntervalo] of registrosPorCliente) {
        const sortedInterval = [...regsIntervalo].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
        const ultimo = sortedInterval[sortedInterval.length - 1];
        if (!ultimo) continue;

        const todosRegs = todosPorNome.get(nome) ?? [];
        const regAnt = registroAnteriorPorCliente.get(nome) ?? null;
        const mm6 = mm6PorCliente(todosRegs, regAnt);

        // CDI realizado dos MESMOS 6 meses do mm6 (paralelo). Usado apenas
        // para calcular `spread = mm6_rent_pct / mm6_cdi_pct`. Quando o CDI
        // base é 0 (mês não fechado, falha de fetch), spread = 1.0 (neutro).
        const cdiPromessas = mm6.ultimos6.map(r => buscarCDIMensal(r.ano, r.mes).catch(() => 0));
        const cdis = await Promise.all(cdiPromessas);
        if (cancelado) return;
        const validCdis = cdis.filter(v => v > 0);
        const mm6_cdi_pct = validCdis.length > 0
          ? validCdis.reduce((a, b) => a + b, 0) / validCdis.length
          : 0;
        const spread = mm6_cdi_pct > 0 && mm6.mm6_rent_pct !== 0
          ? mm6.mm6_rent_pct / mm6_cdi_pct
          : 1;

        // Cap conservador no spread (-10×, +10×) — cliente com mês de pico
        // pode gerar spread enorme e projeção sem sentido.
        const spreadCap = Math.max(-10, Math.min(10, spread));
        const pl_atual = ultimo.pl_total ?? 0;
        const ultimoP = pNum(ultimo.ano, ultimo.mes);

        // ── Capacidade esperada e fonte ────────────────────────────────
        // Manual sobrescreve auto. Manual = capacidade_poupanca_mensal do
        // registro mais recente (qualquer sinal). Quando sem_capacidade_
        // poupanca = true, capacidade_manual = null e meta_individual fica
        // null no fim (operador sinalizou que cliente não tem capacidade).
        const regMaisRecente = [...todosRegs]
          .sort((a, b) => pNum(b.ano, b.mes) - pNum(a.ano, a.mes))[0] ?? ultimo;
        const semCap = regMaisRecente?.sem_capacidade_poupanca === true;
        const capacidadeManual = semCap ? null
          : (regMaisRecente?.capacidade_poupanca_mensal ?? null);
        // Auto = MM6 NNM bruto − MM6 tombamento (matematicamente igual a
        // mm6_nnm_liquido — média da soma = soma das médias). Mantenho a
        // forma "bruto − tombamento" porque expõe os dois termos para
        // auditoria/exibição.
        const capacidadeAuto = mm6.mm6_nnm_bruto - mm6.mm6_tombamento;
        const capacidade_esperada = capacidadeManual ?? capacidadeAuto;
        const capacidade_fonte: 'manual' | 'automatico' = capacidadeManual != null
          ? 'manual' : 'automatico';

        // ── Projeção mês a mês até Dez/anoFim ──────────────────────────
        // Single loop com 2 trilhas:
        //   pl_projetado: usa mm6_nnm_liquido (tendência histórica).
        //   pl_meta:      usa capacidade_esperada (alvo).
        // Ambas: PL[t] = max(0, PL[t-1] × (1 + CDI_proj × spread) + nnm_t)
        // Floor zero — patrimônio não pode ficar negativo no modelo. Cliente
        // cuja projeção atinge zero E NNM é negativo nunca recupera, então
        // paramos a iteração e preenchemos meses restantes com zero (evita
        // chamadas extras a buscarCDIProjetado em caso degenerado).
        const pl_projetado_por_mes: MM6Cliente['pl_projetado_por_mes'] = [];
        let plAnt = pl_atual;
        let plMetaAnt = pl_atual;
        let plMetaFim = pl_atual;
        for (let p = ultimoP + 1; p <= fimAnoP; p++) {
          const ano = Math.floor((p - 1) / 12);
          const mes = ((p - 1) % 12) + 1;
          const cdi_proj = await buscarCDIProjetado(ano, mes).catch(() => 0);
          if (cancelado) return;
          const rent_proj = cdi_proj * spreadCap;
          const pl = Math.max(0, plAnt * (1 + rent_proj) + mm6.mm6_nnm_liquido);
          pl_projetado_por_mes.push({ ano, mes, pl, rent_proj, cdi_proj });
          plAnt = pl;
          // Trilha da meta — mesma rentabilidade projetada, NNM diferente.
          plMetaAnt = Math.max(0, plMetaAnt * (1 + rent_proj) + capacidade_esperada);
          plMetaFim = plMetaAnt;

          // Early-break: ambas as trilhas zeradas E nenhuma capaz de
          // recuperar (NNM/capacidade ≤ 0). Preenche meses restantes com 0.
          const nuncaRecupera = mm6.mm6_nnm_liquido <= 0 && capacidade_esperada <= 0;
          if (pl === 0 && plMetaAnt === 0 && nuncaRecupera) {
            for (let q = p + 1; q <= fimAnoP; q++) {
              const anoQ = Math.floor((q - 1) / 12);
              const mesQ = ((q - 1) % 12) + 1;
              pl_projetado_por_mes.push({ ano: anoQ, mes: mesQ, pl: 0, rent_proj: 0, cdi_proj: 0 });
            }
            break;
          }
        }
        const pl_projetado_fim_ano = pl_projetado_por_mes.length > 0
          ? pl_projetado_por_mes[pl_projetado_por_mes.length - 1].pl
          : pl_atual;
        // Meta individual: null quando o usuário sinalizou explicitamente
        // sem capacidade. Caso contrário, é a projeção com capacidade_esperada.
        const meta_individual: number | null = semCap ? null
          : (pl_projetado_por_mes.length > 0 ? plMetaFim : pl_atual);
        const gap_meta_individual: number | null = meta_individual != null
          ? meta_individual - pl_projetado_fim_ano : null;

        // Burn rate — variação BRL contra PL atual (% do patrimônio).
        const em_burn = mm6.variacao_mm6 < 0;
        const severidade = severidadeMM6(mm6.variacao_mm6, pl_atual);

        // Rebate em risco — soma dos meses projetados (PL × taxa × split).
        // Só faz sentido para clientes em burn que têm cadastro completo
        // (taxas de rebate vêm do clientes_base/).
        const c = clientesPorNomeNorm.get(norm(nome));
        const on = c?.percentual_rebate_anual_onshore ?? 0;
        const off = c?.percentual_rebate_anual_offshore ?? null;
        const taxaReb = off != null ? (on + off) / 2 : on;
        const aliq = c?.aliquota_impostos_rebate ?? 0;
        const rebate_em_risco = (em_burn && c)
          ? pl_projetado_por_mes.reduce(
            (acc, m) => acc + m.pl * taxaReb / 12 * (1 - aliq) * 0.5, 0)
          : 0;

        // meta_mensal informativa (R$/mês) — usada por consumers legados:
        // manual de meta_poupanca_mensal sobrescreve, senão MM6 líquido.
        const metaPoupMensalManual = regMaisRecente?.meta_poupanca_mensal;
        const meta_mensal: number | null = metaPoupMensalManual != null
          ? metaPoupMensalManual
          : (semCap ? null : mm6.mm6_nnm_liquido);
        const meta_fonte: 'manual' | 'automatico' | null = metaPoupMensalManual != null
          ? 'manual'
          : (semCap ? null : 'automatico');

        resultado.push({
          nome_cliente: nome,
          mm6_nnm_liquido: mm6.mm6_nnm_liquido,
          mm6_nnm_bruto: mm6.mm6_nnm_bruto,
          mm6_tombamento: mm6.mm6_tombamento,
          mm6_rent_brl: mm6.mm6_rent_brl,
          mm6_rent_pct: mm6.mm6_rent_pct,
          mm6_cdi_pct,
          spread: spreadCap,
          variacao_mm6: mm6.variacao_mm6,
          n_meses: mm6.n_meses,
          em_burn, severidade,
          pl_atual,
          ultimo_mes: { ano: ultimo.ano, mes: ultimo.mes },
          pl_projetado_por_mes,
          pl_projetado_fim_ano,
          capacidade_esperada, capacidade_fonte,
          meta_individual, gap_meta_individual,
          meta_mensal, meta_fonte,
          rebate_em_risco,
        });
      }
      if (!cancelado) setMm6Clientes(resultado);
    })();

    return () => { cancelado = true; };
  }, [registrosPorCliente, registroAnteriorPorCliente, todosRegistros, clientes, metaAUM, anoFim]);

  // Derivados MM6 — substituem o pipeline antigo (variacao mediana de pickR).
  const clientesEmBurnMM6 = useMemo(
    () => mm6Clientes.filter(v => v.em_burn),
    [mm6Clientes]);

  const rebateEmRiscoTotalMM6 = useMemo(
    () => clientesEmBurnMM6.reduce((s, v) => s + v.rebate_em_risco, 0),
    [clientesEmBurnMM6]);

  const projecaoConsolidadaMM6 = useMemo(() => {
    let pl_total_atual = 0;
    let pl_total_projetado_fim_ano = 0;
    let somaSpread = 0, somaPesoSpread = 0;
    let n_clientes_com_meta = 0;
    for (const v of mm6Clientes) {
      pl_total_atual += v.pl_atual;
      pl_total_projetado_fim_ano += v.pl_projetado_fim_ano;
      if (v.meta_individual != null) n_clientes_com_meta++;
      // Spread médio ponderado por PL atual — para exibição agregada nos KPIs.
      if (v.pl_atual > 0) {
        somaSpread += v.spread * v.pl_atual;
        somaPesoSpread += v.pl_atual;
      }
    }
    const meta_total = metaAUM?.valor ?? null;
    const gap_total = meta_total != null ? pl_total_projetado_fim_ano - meta_total : null;
    const meses_restantes = Math.max(0, pNum(anoFim, 12) - pNum(anoFim, mesFim));
    const spread_medio = somaPesoSpread > 0 ? somaSpread / somaPesoSpread : 1;
    return {
      pl_total_atual, pl_total_projetado_fim_ano,
      meta_total, gap_total, meses_restantes,
      spread_medio,
      n_clientes: mm6Clientes.length,
      n_clientes_com_meta,
    };
  }, [mm6Clientes, metaAUM, anoFim, mesFim]);

  // Série agregada de PL projetado mês a mês — alimenta a linha "Proj. (MM6)"
  // do PoupancaChart. Soma os pl_projetado_por_mes individuais por (ano, mes).
  const serieAumProjetadaMM6 = useMemo(() => {
    const agreg = new Map<string, { ano: number; mes: number; pl: number }>();
    for (const v of mm6Clientes) {
      for (const m of v.pl_projetado_por_mes) {
        const chave = `${m.ano}-${String(m.mes).padStart(2, '0')}`;
        const existente = agreg.get(chave);
        if (existente) existente.pl += m.pl;
        else agreg.set(chave, { ano: m.ano, mes: m.mes, pl: m.pl });
      }
    }
    return Array.from(agreg.values())
      .sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
  }, [mm6Clientes]);

  return {
    registrosPorCliente,
    historico,
    historicoMetaCumprimento,
    loading,
    totais,
    metaNNM,
    setMetaNNM,
    metaAUM,
    setMetaAUM,
    metasPeriodo,
    setMetasPeriodo,
    mediaNNMHistorica,
    dadosProjecao,
    // KPIs/cards/modais consomem MM6 — substituem o pipeline antigo.
    clientesQueimando: clientesEmBurnMM6.length,
    rebateEmRiscoTotal: rebateEmRiscoTotalMM6,
    mm6Clientes,
    clientesEmBurnMM6,
    projecaoConsolidada: projecaoConsolidadaMM6,
    serieAumProjetadaMM6,
    // Legado mantido para retrocompat — não recomendado para novos consumers.
    variacaoPLPorCliente,
    clientesEmBurnNovo,
    capacidadeNegativaTotal: clientesEmBurnMM6.reduce((s, v) => s + Math.abs(v.mm6_rent_brl), 0),
    mesesNoPeriodo,
    aumInicialPeriodo,
    registroAnteriorPorCliente,
    modoAUM,
    setModoAUM,
    aumLegadoTotal,
    recarregar,
  };
}
