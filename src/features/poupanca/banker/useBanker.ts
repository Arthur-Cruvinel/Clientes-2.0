// --- Hook de agregação por banker para o módulo Poupança ---

import { useState, useMemo, useCallback } from 'react';
import type { RegistroPoupanca } from '../../../types';
import { nnmReal } from '../../../utils/financials';

// ── Interfaces ───────────────────────────────────────────────────────────

export interface DadosBanker {
  nome: string;
  clientes: string[];
  totalClientes: number;

  // AUM
  aumTotal: number;
  aumInicial: number;

  // NNM
  nnmTotal: number;
  metaAgregada: number;
  progressoMeta: number;
  clientesSemMeta: number;

  // Rentabilidade
  rentAbsoluta: number;
  rentPctPonderada: number;
  cdiAcumulado: number | null;
  spreadVsCdi: number | null;

  // Status
  clientesPoupando: number;
  clientesSemNNM: number;
  rankingAUM: number;
  rankingNNM: number;
  rankingRent: number;
}

type CriterioOrdenacao = 'aum' | 'nnm' | 'rentabilidade';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Mapa nome_cliente → banker a partir de dados já carregados */
export interface ClienteComBanker { nome_cliente: string; banker?: string }

function pNum(a: number, m: number) { return a * 12 + m; }
function safe(v: number | undefined | null) { return v ?? 0; }

/** Agrega registros de um cliente no período */
function agregarCliente(regs: RegistroPoupanca[], nMeses: number) {
  const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
  const pri = sorted[0];
  const ult = sorted[sorted.length - 1];

  let nnm = 0, rentAbs = 0;
  for (const r of sorted) {
    // NNM Real consolidado (desconta transferências internas)
    nnm += nnmReal(r);
    rentAbs += safe(r.rentabilidade_total);
  }

  const aumInicial = safe(pri.pl_inicial_total);
  const aumFinal = safe(ult.pl_total);
  const metaMensal = ult.meta_poupanca_mensal ?? null;
  const metaPeriodo = metaMensal != null ? metaMensal * nMeses : 0;
  const temMeta = metaMensal != null && metaMensal > 0;

  // Rent % simples: rentAbs / (aumInicial + nnm) — mesma fórmula do restante
  const denom = aumInicial + nnm;
  const rentPct = denom > 0 ? rentAbs / denom : 0;

  return { aumInicial, aumFinal, nnm, rentAbs, rentPct, metaPeriodo, temMeta };
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useBanker(
  registrosPorCliente: Map<string, RegistroPoupanca[]>,
  clientesComBanker: ClienteComBanker[],
  mesInicio: number, anoInicio: number,
  mesFim: number, anoFim: number,
): {
  bankers: DadosBanker[];
  loading: boolean;
  criterioOrdenacao: CriterioOrdenacao;
  setCriterioOrdenacao: (c: CriterioOrdenacao) => void;
  bankerOrdenados: DadosBanker[];
} {
  const loading = false;
  const [criterioOrdenacao, setCriterioOrdenacao] = useState<CriterioOrdenacao>('aum');

  const nMeses = useMemo(
    () => (anoFim * 12 + mesFim) - (anoInicio * 12 + mesInicio) + 1,
    [mesInicio, anoInicio, mesFim, anoFim],
  );

  // Mapa nome_cliente → banker (dados do AppContext)
  const mapaBanker = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientesComBanker) {
      m.set(c.nome_cliente, c.banker ?? '');
    }
    return m;
  }, [clientesComBanker]);

  // Agregar por banker
  const bankers = useMemo<DadosBanker[]>(() => {
    // Agrupa nomes de clientes por banker
    const grupos = new Map<string, string[]>();
    for (const nome of registrosPorCliente.keys()) {
      const banker = mapaBanker.get(nome) || '';
      const label = banker || 'Sem banker';
      const lista = grupos.get(label) ?? [];
      lista.push(nome);
      grupos.set(label, lista);
    }

    // Calcula métricas por grupo
    const resultado: DadosBanker[] = [];
    for (const [nomeBanker, nomesClientes] of grupos) {
      let aumTotal = 0, aumInicial = 0, nnmTotal = 0, metaAgregada = 0;
      let rentAbsoluta = 0, somaRentPond = 0, somaAumPond = 0;
      let clientesSemMeta = 0, clientesPoupando = 0, clientesSemNNM = 0;

      for (const nc of nomesClientes) {
        const regs = registrosPorCliente.get(nc);
        if (!regs || regs.length === 0) continue;

        const agg = agregarCliente(regs, nMeses);
        aumTotal += agg.aumFinal;
        aumInicial += agg.aumInicial;
        nnmTotal += agg.nnm;
        metaAgregada += agg.metaPeriodo;
        rentAbsoluta += agg.rentAbs;

        // Ponderação pela AUM final
        if (agg.aumFinal > 0) {
          somaRentPond += agg.rentPct * agg.aumFinal;
          somaAumPond += agg.aumFinal;
        }

        if (!agg.temMeta) clientesSemMeta++;
        if (agg.nnm > 0) clientesPoupando++;
        else clientesSemNNM++;
      }

      const rentPctPonderada = somaAumPond > 0 ? somaRentPond / somaAumPond : 0;
      const progressoMeta = metaAgregada > 0 ? nnmTotal / metaAgregada : 0;

      resultado.push({
        nome: nomeBanker,
        clientes: nomesClientes.sort(),
        totalClientes: nomesClientes.length,
        aumTotal,
        aumInicial,
        nnmTotal,
        metaAgregada,
        progressoMeta,
        clientesSemMeta,
        rentAbsoluta,
        rentPctPonderada,
        cdiAcumulado: null,   // calculado na view quando CDI disponível
        spreadVsCdi: null,
        clientesPoupando,
        clientesSemNNM,
        rankingAUM: 0,
        rankingNNM: 0,
        rankingRent: 0,
      });
    }

    // Calcular rankings
    const porAum = [...resultado].sort((a, b) => b.aumTotal - a.aumTotal);
    const porNnm = [...resultado].sort((a, b) => b.nnmTotal - a.nnmTotal);
    const porRent = [...resultado].sort((a, b) => b.rentPctPonderada - a.rentPctPonderada);
    for (const b of resultado) {
      b.rankingAUM = porAum.findIndex(x => x.nome === b.nome) + 1;
      b.rankingNNM = porNnm.findIndex(x => x.nome === b.nome) + 1;
      b.rankingRent = porRent.findIndex(x => x.nome === b.nome) + 1;
    }

    return resultado;
  }, [registrosPorCliente, mapaBanker, nMeses]);

  // Ordenação pelo critério ativo
  const bankerOrdenados = useMemo(() => {
    const copia = [...bankers];
    switch (criterioOrdenacao) {
      case 'aum': return copia.sort((a, b) => b.aumTotal - a.aumTotal);
      case 'nnm': return copia.sort((a, b) => b.nnmTotal - a.nnmTotal);
      case 'rentabilidade': return copia.sort((a, b) => b.rentPctPonderada - a.rentPctPonderada);
    }
  }, [bankers, criterioOrdenacao]);

  const setCriterio = useCallback((c: CriterioOrdenacao) => setCriterioOrdenacao(c), []);

  return { bankers, loading, criterioOrdenacao, setCriterioOrdenacao: setCriterio, bankerOrdenados };
}
