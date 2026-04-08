// --- Hook principal do módulo Poupança ---
// Busca registros, agrupa por cliente, calcula totais e gerencia meta NNM.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { RegistroPoupanca } from '../../types';
import { nnmPoupancaLiquida } from '../../utils/financials';

export interface TotaisPoupanca {
  pl_total: number;
  nnm_mes: number;
  nnm_poupanca_liquida_total: number;
  tombamento_total: number;
  rentabilidade_media: number;
  clientes_poupando: number;
  total_clientes: number;
}

export interface PontoHistorico {
  periodo: string;
  pl_total: number;
  ano: number;
  mes: number;
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function pNum(a: number, m: number) { return a * 12 + m; }

export function usePoupanca(
  mesInicio: number, anoInicio: number,
  mesFim: number, anoFim: number,
) {
  const [todosRegistros, setTodosRegistros] = useState<RegistroPoupanca[]>([]);
  const [loading, setLoading] = useState(false);
  const [metaNNM, setMetaNNMState] = useState<number | null>(null);
  // [NOVO] Contador para forçar refetch
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    getDocs(collection(db, 'poupanca')).then(snap => {
      if (!cancelado) setTodosRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() }) as RegistroPoupanca));
    }).catch(e => console.error('[Poupanca] Erro ao buscar registros:', e))
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [fetchCount]);

  // [NOVO] Força rebuscar dados do Firestore
  const recarregar = useCallback(() => setFetchCount(c => c + 1), []);

  useEffect(() => {
    getDoc(doc(db, 'config', 'poupanca')).then(snap => {
      if (snap.exists()) setMetaNNMState(snap.data().meta_nnm_mensal ?? null);
    }).catch(e => console.error('[Poupanca] Erro ao buscar meta:', e));
  }, []);

  const setMetaNNM = useCallback(async (valor: number) => {
    await setDoc(doc(db, 'config', 'poupanca'), { meta_nnm_mensal: valor }, { merge: true });
    setMetaNNMState(valor);
  }, []);

  // Filtra por intervalo
  const registrosIntervalo = useMemo(() => {
    const ini = pNum(anoInicio, mesInicio), fim = pNum(anoFim, mesFim);
    return todosRegistros.filter(r => { const p = pNum(r.ano, r.mes); return p >= ini && p <= fim; });
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

  // Série histórica (últimos 12 meses, independente do filtro)
  const historico = useMemo<PontoHistorico[]>(() => {
    const agrupado = new Map<string, { pl: number; ano: number; mes: number }>();
    for (const r of todosRegistros) {
      const chave = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      const atual = agrupado.get(chave) ?? { pl: 0, ano: r.ano, mes: r.mes };
      atual.pl += r.pl_total ?? 0;
      agrupado.set(chave, atual);
    }
    return Array.from(agrupado.entries())
      .sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([, v]) => ({ periodo: `${MESES_LABEL[v.mes - 1]}/${String(v.ano).slice(2)}`, pl_total: v.pl, ano: v.ano, mes: v.mes }));
  }, [todosRegistros]);

  // KPIs: consolidado, por cliente (mais recente do intervalo)
  const totais = useMemo<TotaisPoupanca>(() => {
    let plTotal = 0, nnm = 0, nnmLiq = 0, tomb = 0, poupando = 0;
    for (const [, regs] of registrosPorCliente) {
      const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      const ultimo = sorted[sorted.length - 1];
      plTotal += ultimo.pl_total ?? 0;
      let aporteCliente = 0, liqCliente = 0;
      for (const r of sorted) {
        aporteCliente += r.aporte_mes_total ?? 0;
        liqCliente += nnmPoupancaLiquida(r);
        tomb += r.nnm_tombamento ?? 0;
      }
      nnm += aporteCliente;
      nnmLiq += liqCliente;
      if (liqCliente > 0) poupando++;
    }
    return {
      pl_total: plTotal, nnm_mes: nnm, nnm_poupanca_liquida_total: nnmLiq,
      tombamento_total: tomb, rentabilidade_media: 0,
      clientes_poupando: poupando, total_clientes: registrosPorCliente.size,
    };
  }, [registrosPorCliente]);

  return { registrosPorCliente, historico, loading, totais, metaNNM, setMetaNNM, recarregar };
}
