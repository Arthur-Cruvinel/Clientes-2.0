// --- Hook do módulo Capacidade ---
// Ocupação por colaborador, capacidade de absorção por pacote e simulador de
// contratação. Bases coerentes com a Alocação em Lote:
//   - horasDisponiveis = horas produtivas mensais (≈164/localidade) × percentual_alocavel
//   - pct (ocupação) por leitura DUAL: vínculo com pct>0 senão cliente.pct_${funcao}
//   - demanda por cliente = HORAS_PACOTE[pacote][funcao]
// custo_total_mensal vem de dadosPeriodo.colaboradores (recomputado pelo motor),
// nunca de colaboradores_base/ (lá é null).

import { useMemo, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import {
  FUNCOES_ALOCACAO, HORAS_PACOTE, HORAS_CLT_MES, HORAS_PRODUTIVAS_MES_POR_LOCALIDADE,
} from '../../utils/constants';
import { normalizarFuncao } from '../perfil/utilsAlocacao';
import { pctEfetivo, calcularHorasReais } from '../../utils/financials';
import { horasEfetivasMensais } from '../../utils/financials.alocacao';
import type { Colaborador, Cliente, FuncaoAlocacao, PacoteServico } from '../../types';

// Pacotes elegíveis para absorção: asset_only não consome horas de CFO.
const PACOTES_ABSORCAO: PacoteServico[] = ['full', 'advanced', 'light', 'future'];

// Rótulos curtos das funções — compartilhados pela UI do módulo.
export const LABEL_FUNCAO: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Financeira', operacional_financeiro: 'Operacional',
  serv_adm: 'Adm.', serv_aux_adm: 'Aux. Adm.',
};

export interface ClienteAlocado {
  nome: string; pacote: PacoteServico; pct: number; horas: number;
  // Aderência ao escopo do pacote: pct_real / pct_normativo (HORAS_PACOTE/HORAS_CLT_MES).
  // > 1 = extrapola o pacote (gasta mais horas/cliente que o previsto). Infinity =
  // função fora do pacote (pacote prevê 0h nessa função, mas há alocação). 0 = sem alocação.
  fatorEscopo: number;
}
export interface UsoFuncao { horas: number; clientes: ClienteAlocado[]; }
export interface ColaboradorCapacidade {
  colaborador: Colaborador;
  horasDisponiveis: number;
  horasUsadas: number;
  ocupacaoPct: number;                 // horasUsadas / horasDisponiveis (0 se disp=0)
  extrapolaEscopo: boolean;            // algum cliente com fatorEscopo > 1
  porFuncao: Partial<Record<FuncaoAlocacao, UsoFuncao>>;
}
// ── Matriz funcionário × cliente (excesso) — Frente 1, Movimento 3 ──────────
// Responde "qual colaborador gasta, num cliente, o tempo que faltava para
// outro?". Por par (X, C) na FUNÇÃO PRINCIPAL de X:
//   REAL     = horas que X dedica a C (horasEfetivasMensais do pct efetivo —
//              mesma "Horas efet." da Alocação em Lote: pct × HORAS_CLT_MES ×
//              percentual_alocavel). Fonte do pct = pctEfetivo (vínculo-first).
//   ESPERADO = componente da FUNÇÃO de X na demanda de volume de C
//              (calcularHorasReais(C).por_funcao[fp]; sem perfil → HORAS_PACOTE,
//              mesmo gate de horasBaseClienteFuncao). NÃO o total do cliente.
//   EXCESSO  = REAL − ESPERADO. Positivo = X super-serve C (capacidade que
//              falta a outro).
export interface ExcessoCliente {
  nome_cliente: string; pacote: PacoteServico;
  real: number; esperado: number; excesso: number;
}
export interface ExcessoColaborador {
  colaborador: Colaborador;
  funcao: FuncaoAlocacao;
  label: string;
  itens: ExcessoCliente[];        // só excesso > 0, ordenado desc
  totalExcesso: number;
}

export interface CapacidadeFuncao { funcao: FuncaoAlocacao; horasLivres: number; demanda: number; capacidade: number; }
export interface PacoteCapacidade {
  pacote: PacoteServico;
  capacidade: number;                  // floor(min das funções com demanda), ≥ 0
  gargalo: FuncaoAlocacao | null;
  porFuncao: CapacidadeFuncao[];
}
export interface SimulacaoResultado {
  porPacote: PacoteCapacidade[];
  custoEstimadoMensal: number;
  totalContratacoes: number;
}

/** horas produtivas mensais cruas da localidade (sem ×percentual_alocavel). */
function horasProdMes(c: Colaborador): number {
  return HORAS_PRODUTIVAS_MES_POR_LOCALIDADE[c.localidade ?? 'SP']
    ?? HORAS_PRODUTIVAS_MES_POR_LOCALIDADE.SP;
}

/** Capacidade por pacote dado o mapa de horas livres por função (gargalo = min). */
function capacidadePorPacote(horasLivres: Record<string, number>): PacoteCapacidade[] {
  return PACOTES_ABSORCAO.map(pacote => {
    const porFuncao: CapacidadeFuncao[] = [];
    let minCap = Infinity;
    let gargalo: FuncaoAlocacao | null = null;
    for (const funcao of FUNCOES_ALOCACAO) {
      const demanda = HORAS_PACOTE[pacote][funcao];
      if (demanda <= 0) continue;                       // função sem demanda nesse pacote
      const livres = horasLivres[funcao] ?? 0;
      const cap = livres / demanda;
      porFuncao.push({ funcao, horasLivres: livres, demanda, capacidade: cap });
      if (cap < minCap) { minCap = cap; gargalo = funcao; }
    }
    const capacidade = minCap === Infinity ? 0 : Math.max(0, Math.floor(minCap));
    return { pacote, capacidade, gargalo, porFuncao };
  });
}

export function useCapacidade() {
  const { dadosPeriodo, loading } = useApp();

  const colaboradores: Colaborador[] = useMemo(() =>
    (dadosPeriodo?.colaboradores ?? [])
      .filter(c => c.alocavel && c.nome_colaborador?.trim() && c.funcao_principal),
    [dadosPeriodo]);
  const clientes: Cliente[] = useMemo(() => dadosPeriodo?.clientes ?? [], [dadosPeriodo]);
  const vinculos = useMemo(() => dadosPeriodo?.vinculos ?? [], [dadosPeriodo]);

  // Índices O(1): vínculo pct por (colab|cli|funcao) e clientes por (funcao|nomeColab).
  const indices = useMemo(() => {
    const vincPct = new Map<string, number>();
    for (const v of vinculos) vincPct.set(`${v.id_estavel_colaborador}|${v.id_estavel_cliente}|${v.funcao}`, v.pct);
    const cliPorFuncaoColab = new Map<string, Cliente[]>();
    for (const cli of clientes) {
      for (const f of FUNCOES_ALOCACAO) {
        const nome = cli[f] as string | undefined;
        if (!nome || !nome.trim()) continue;
        const key = `${f}|${nome}`;
        const arr = cliPorFuncaoColab.get(key);
        if (arr) arr.push(cli); else cliPorFuncaoColab.set(key, [cli]);
      }
    }
    return { vincPct, cliPorFuncaoColab };
  }, [vinculos, clientes]);

  // Ocupação por colaborador (leitura dual).
  const porColaborador = useMemo<ColaboradorCapacidade[]>(() => {
    const { vincPct, cliPorFuncaoColab } = indices;
    return colaboradores.map(colab => {
      const horasProd = horasProdMes(colab);
      const horasDisponiveis = horasProd * (colab.percentual_alocavel ?? 0);
      const porFuncao: Partial<Record<FuncaoAlocacao, UsoFuncao>> = {};
      let horasUsadas = 0;
      let extrapolaEscopo = false;
      for (const f of FUNCOES_ALOCACAO) {
        const clis = cliPorFuncaoColab.get(`${f}|${colab.nome_colaborador}`) ?? [];
        if (clis.length === 0) continue;
        const lista: ClienteAlocado[] = [];
        let horasFuncao = 0;
        for (const cli of clis) {
          const vinc = (colab.id_estavel && cli.id_estavel)
            ? vincPct.get(`${colab.id_estavel}|${cli.id_estavel}|${f}`) : undefined;
          const legado = (cli[`pct_${f}` as keyof Cliente] as number | undefined) ?? 0;
          const pct = (vinc !== undefined && vinc > 0) ? vinc : legado;
          const horas = pct * horasProd;
          horasFuncao += horas;
          // Escopo: pct real vs normativo do pacote nessa função.
          const pctNormativo = (HORAS_PACOTE[cli.pacote_servico]?.[f] ?? 0) / HORAS_CLT_MES;
          const fatorEscopo = pctNormativo > 0 ? pct / pctNormativo : (pct > 0 ? Infinity : 0);
          if (fatorEscopo > 1) extrapolaEscopo = true;
          lista.push({ nome: cli.nome_cliente, pacote: cli.pacote_servico, pct, horas, fatorEscopo });
        }
        porFuncao[f] = { horas: horasFuncao, clientes: lista };
        horasUsadas += horasFuncao;
      }
      const ocupacaoPct = horasDisponiveis > 0 ? horasUsadas / horasDisponiveis : 0;
      return { colaborador: colab, horasDisponiveis, horasUsadas, ocupacaoPct, extrapolaEscopo, porFuncao };
    }).sort((a, b) => b.ocupacaoPct - a.ocupacaoPct);
  }, [colaboradores, indices]);

  // Horas livres por função (Σ disponíveis − usadas dos colabs cuja funcao_principal = f).
  const horasLivresPorFuncao = useMemo<Record<string, number>>(() => {
    const acc: Record<string, number> = {};
    for (const f of FUNCOES_ALOCACAO) acc[f] = 0;
    for (const cc of porColaborador) {
      const f = normalizarFuncao(cc.colaborador.funcao_principal);
      if (!f) continue;
      acc[f] += cc.horasDisponiveis - cc.horasUsadas;
    }
    return acc;
  }, [porColaborador]);

  // Custo médio mensal por função (base do simulador). Fallback: média geral.
  const custoMedioPorFuncao = useMemo<Record<string, number>>(() => {
    const soma: Record<string, { total: number; n: number }> = {};
    let totalGeral = 0; let nGeral = 0;
    for (const cc of porColaborador) {
      const f = normalizarFuncao(cc.colaborador.funcao_principal);
      const custo = cc.colaborador.custo_total_mensal ?? 0;
      totalGeral += custo; nGeral += 1;
      if (!f) continue;
      const s = soma[f] ?? { total: 0, n: 0 };
      s.total += custo; s.n += 1; soma[f] = s;
    }
    const mediaGeral = nGeral > 0 ? totalGeral / nGeral : 0;
    const out: Record<string, number> = {};
    for (const f of FUNCOES_ALOCACAO) out[f] = soma[f]?.n ? soma[f].total / soma[f].n : mediaGeral;
    return out;
  }, [porColaborador]);

  // Matriz de excesso por colaborador (Movimento 3). Itera os pares (X, C) e
  // mantém só os clientes onde X super-serve (excesso > 0) na sua função
  // principal. Reuso: pctEfetivo (real, vínculo-first), horasEfetivasMensais
  // (mesma "Horas efet." da Alocação em Lote), calcularHorasReais (esperado).
  const excessoPorColaborador = useMemo<ExcessoColaborador[]>(() => {
    const out: ExcessoColaborador[] = [];
    for (const colab of colaboradores) {
      const fp = normalizarFuncao(colab.funcao_principal);
      if (!fp) continue;
      const alocavel = colab.percentual_alocavel ?? 0;
      const itens: ExcessoCliente[] = [];
      for (const cli of clientes) {
        const pct = pctEfetivo(colab, cli, fp, vinculos);
        if (pct <= 0) continue;                       // X não atende C nesta função
        const real = horasEfetivasMensais(pct, alocavel);
        // ESPERADO: componente da função fp na demanda de volume de C. Mesmo
        // gate de horasBaseClienteFuncao — horas reais quando há perfil, senão
        // a norma do pacote (evita ÷ perfil ausente).
        const esperado = cli.perfil_complexidade
          ? (calcularHorasReais(cli, cli.perfil_complexidade).por_funcao[fp] ?? 0)
          : (HORAS_PACOTE[cli.pacote_servico]?.[fp] ?? 0);
        const excesso = real - esperado;
        if (excesso > 0.01) {
          itens.push({ nome_cliente: cli.nome_cliente, pacote: cli.pacote_servico, real, esperado, excesso });
        }
      }
      if (itens.length === 0) continue;
      itens.sort((a, b) => b.excesso - a.excesso);
      out.push({
        colaborador: colab, funcao: fp, label: LABEL_FUNCAO[fp],
        itens, totalExcesso: itens.reduce((s, i) => s + i.excesso, 0),
      });
    }
    return out.sort((a, b) => b.totalExcesso - a.totalExcesso);
  }, [colaboradores, clientes, vinculos]);

  const absorcaoPorPacote = useMemo(
    () => capacidadePorPacote(horasLivresPorFuncao), [horasLivresPorFuncao]);

  // Simulador: novas contratações por função (percentual_alocavel padrão 1.0).
  const HORAS_NOVO_PADRAO = HORAS_PRODUTIVAS_MES_POR_LOCALIDADE.SP; // 1 contratação 100% alocável
  const simular = useCallback((novas: Partial<Record<FuncaoAlocacao, number>>): SimulacaoResultado => {
    const livres: Record<string, number> = { ...horasLivresPorFuncao };
    let custo = 0; let total = 0;
    for (const f of FUNCOES_ALOCACAO) {
      const n = novas[f] ?? 0;
      if (n <= 0) continue;
      livres[f] = (livres[f] ?? 0) + n * HORAS_NOVO_PADRAO;
      custo += n * (custoMedioPorFuncao[f] ?? 0);
      total += n;
    }
    return { porPacote: capacidadePorPacote(livres), custoEstimadoMensal: custo, totalContratacoes: total };
  }, [horasLivresPorFuncao, custoMedioPorFuncao, HORAS_NOVO_PADRAO]);

  return { porColaborador, excessoPorColaborador, absorcaoPorPacote, horasLivresPorFuncao, custoMedioPorFuncao, simular, loading };
}
