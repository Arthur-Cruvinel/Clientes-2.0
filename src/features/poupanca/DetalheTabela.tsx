// --- Tabela histórica do detalhe (premium, por visão, CDI, edição, ordenação, filtro) ---

import { useMemo, useState, useCallback } from 'react';
import { Pencil, Info, Flag, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { RegistroPoupanca } from '../../types';
import type { LinhaDetalhe } from './PoupancaClienteDetalhe';
import type { Visao } from './PoupancaTabela';
import { DetalheLinhaEdit } from './DetalheLinhaEdit';
import { TabelaStatusBar } from './TabelaStatusBar';
import { useOrdenacao } from './useOrdenacao';
import { ThOrdenavel } from './ThOrdenavel';
import { FiltroCheckbox } from './FiltroCheckbox';
import { ultimoDiaDoMes, diasUteisEntre, diasUteisNoMes } from '../../services/diasUteis';
import { nnmRealOnshore, nnmRealOffshore } from '../../utils/financials';

interface Props {
  linhas: LinhaDetalhe[]; cdiPorMes: Record<string, number | null>;
  fedPorMes?: Record<string, number | null>;
  // Valores mês-cheio para tooltip quando o benchmark está sendo pro-rateado.
  cdiCheioPorMes?: Record<string, number | null>;
  fedCheioPorMes?: Record<string, number | null>;
  visao: Visao; editIdx: number | null;
  metaAutoFillGlobal?: number | null;
  onEditIdx: (idx: number | null) => void;
  onSalvo: (idx: number, r: RegistroPoupanca) => void;
  onToggleRevisaoMes?: (ano: number, mes: number, estadoAtual: boolean) => void | Promise<void>;
}

const H = 'font-bold uppercase tracking-widest';
const HS = { fontSize: 11, color: '#64748b', height: 44 };
const CS = { fontSize: 13 };
const DASH = { color: '#94a3b8' };

function cor(v: number | null) {
  if (v == null) return DASH;
  return v < 0 ? { color: '#dc2626' } : v > 0 ? { color: '#16a34a' } : { color: '#160F41' };
}
function fmtSp(v: number) { return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`; }

// ── Cálculo offshore unificado ──────────────────────────────────
// Usado por pickR (offshore e consolidado) e PoupancaTabela.
// Regras:
//   1. startingUsd vem de prev.pl_offshore_usd OU do próprio registro
//      (pl_inicial_offshore / ptax_fechamento) quando prev não existe
//   2. Se startingUsd > 0: rentUsd = startingUsd × rentPctLamina
//   3. Se startingUsd = 0 (primeiro mês): rentUsd = endingUsd - cashflowUsd (residual)
//      NNM = cashflow (tombamento), rent % = da lâmina
//   4. Mesma fórmula para individual e geral — MANDATÓRIO
export function calcOffshore(r: RegistroPoupanca, prev: RegistroPoupanca | null | undefined) {
  const plUsdFinal = r.pl_offshore_usd ?? 0;
  const ptaxAtual = r.ptax_fechamento ?? 1;
  const rentPctLamina = r.rentabilidade_pct_offshore ?? 0;

  const ptaxAnterior = prev?.ptax_fechamento ?? ptaxAtual;

  // Basis para AUM Inicial BRL e ganho cambial = PL USD do fechamento anterior.
  // NÃO usar pl_inicial_offshore_usd (starting da lâmina atual inclui accrued
  // interest; o accrued já está em aporte_mes_offshore como cashflow).
  // Prioridade: prev.pl_offshore_usd → pl_inicial_offshore BRL / ptaxAnterior (fallback).
  let plUsdInicial = prev?.pl_offshore_usd ?? 0;
  if (plUsdInicial <= 0.01 && (r.pl_inicial_offshore ?? 0) > 0.01 && ptaxAnterior > 0) {
    plUsdInicial = (r.pl_inicial_offshore ?? 0) / ptaxAnterior;
  }
  const primeiroMes = plUsdInicial <= 0.01; // cliente sem posição anterior

  let rentUsd: number;
  let rentBrl: number;
  let rp: number | null;
  let nnmBrl: number;
  let nnmUsdCalc: number;

  if (primeiroMes) {
    // Primeiro mês (tombamento): determinar NNM e rent
    const cashBrl = r.aporte_mes_offshore ?? 0;
    const temCashflow = Math.abs(cashBrl) > 0.01;

    if (temCashflow) {
      // Caso 1: cashflow informado na lâmina → NNM = cashflow, rent = NNM × %
      nnmBrl = cashBrl;
      nnmUsdCalc = ptaxAtual > 0 ? nnmBrl / ptaxAtual : plUsdFinal;
      rentUsd = nnmUsdCalc * rentPctLamina;
    } else if (rentPctLamina > 0 && plUsdFinal > 0.01) {
      // Caso 2: cashflow = 0 mas rent% > 0 → derivar NNM do ending e rent%
      // ending = nnm × (1 + pct), logo: rent = ending × pct / (1 + pct)
      rentUsd = plUsdFinal * rentPctLamina / (1 + rentPctLamina);
      nnmUsdCalc = plUsdFinal - rentUsd;
      nnmBrl = nnmUsdCalc * ptaxAtual;
    } else {
      // Caso 3: sem cashflow e sem rent% → tudo é NNM
      nnmUsdCalc = plUsdFinal;
      nnmBrl = plUsdFinal * ptaxAtual;
      rentUsd = 0;
    }

    rentBrl = rentUsd * ptaxAtual;
    // Preferir a rentabilidade GRAVADA quando presente (≠ 0). Em re-entradas
    // (round-trip de transferência entre contas), a rent gravada/corrigida
    // fecha a lâmina exatamente, enquanto o recálculo por rent% acumula um
    // pequeno erro de arredondamento (conversão USD→%). Espelha o ramo de mês
    // normal, que já prioriza o valor gravado. Entradas genuínas têm rent
    // gravada = 0 → cai no recálculo (comportamento inalterado).
    const rentSavedPM = r.rentabilidade_offshore ?? 0;
    if (rentSavedPM !== 0) {
      rentBrl = rentSavedPM;
      rentUsd = ptaxAtual > 0 ? rentBrl / ptaxAtual : rentUsd;
    }
    rp = rentPctLamina || null;
  } else {
    // Mês normal: priorizar rentabilidade_offshore gravado (residual que fecha o saldo).
    // Fallback: starting × %_lâmina (dados legados sem valor gravado).
    const rentBrlSaved = r.rentabilidade_offshore ?? 0;
    if (rentBrlSaved !== 0) {
      rentBrl = rentBrlSaved;
      rentUsd = ptaxAtual > 0 ? rentBrl / ptaxAtual : 0;
    } else {
      rentUsd = plUsdInicial * rentPctLamina;
      rentBrl = rentUsd * ptaxAtual;
    }
    rp = rentPctLamina;
    nnmBrl = r.aporte_mes_offshore ?? 0;
    nnmUsdCalc = ptaxAtual > 0 ? nnmBrl / ptaxAtual : 0;
  }

  const piBrl = primeiroMes ? 0 : plUsdInicial * ptaxAnterior;

  // ── Ganho cambial = RESÍDUO que fecha a identidade BRL por construção ──────
  // GC = pl_BRL_final − pl_BRL_inicial − NNM_real_BRL − Rent_BRL.
  // Captura, além do câmbio sobre o PL de abertura (pl_ini_usd × ΔPTAX), os
  // termos cruzados de fluxo intra-mês que a fórmula simples ignora.
  //
  // GUARD ESTRUTURAL: quando a cadeia offshore está inconsistente — gap de
  // competência (mês faltando) ou transferência interna no mês — a residual
  // absorveria o erro de dado como "câmbio fantasma". Nesses casos mantém a
  // fórmula clássica (startUsd × ΔPTAX) e SINALIZA (gcAnomalia) para revisão,
  // em vez de inventar câmbio. Entrada real (primeiroMes) NÃO é anomalia:
  // GC = null (não havia posição anterior).
  const prevTemPosicao = (prev?.pl_offshore_usd ?? 0) > 0.01;
  const mesFaltando = prev != null && prevTemPosicao
    && ((r.ano * 12 + r.mes) - (prev.ano * 12 + prev.mes) > 1);
  const temTransfOff = Math.abs(r.transferencia_interna_offshore ?? 0) > 0.01;
  const gcAnomalia = !primeiroMes && (mesFaltando || temTransfOff);
  const gcAnomaliaReason: string | null = !gcAnomalia ? null
    : mesFaltando ? 'mes_faltando' : 'transferencia_interna';

  const gcSimples = (plUsdInicial > 0.01 && ptaxAtual > 0 && ptaxAnterior > 0)
    ? plUsdInicial * (ptaxAtual - ptaxAnterior) : null;
  const plOffFinalBrl = r.pl_offshore ?? (plUsdFinal * ptaxAtual);
  const gcResidual = plOffFinalBrl - piBrl
    - ((r.aporte_mes_offshore ?? 0) - (r.transferencia_interna_offshore ?? 0)) - rentBrl;
  const gcBrl = primeiroMes ? null : (gcAnomalia ? gcSimples : gcResidual);

  return {
    plUsdInicial, plUsdFinal, ptaxAtual, ptaxAnterior, primeiroMes,
    rentUsd, rentBrl, rp, nnmBrl, nnmUsdCalc, piBrl,
    gcBrl, gcAnomalia, gcAnomaliaReason,
  };
}

export function pickR(r: RegistroPoupanca, v: Visao, prev?: RegistroPoupanca | null) {
  if (v === 'onshore') {
    const piOn = r.pl_inicial_onshore ?? 0;
    if (piOn <= 0.01) {
      // Mês de entrada (espelha calcOffshore.primeiroMes): não havia capital
      // exposto antes do mês, então a rent% vem do % da lâmina — NÃO se divide
      // rentBRL pelo NNM (isso inflaria a rent%, bug do Eduardo). NNM fica cheio.
      return { pi: 0, pf: r.pl_onshore ?? 0, nnm: nnmRealOnshore(r),
        rb: r.rentabilidade_onshore ?? 0, rp: r.rentabilidade_pct ?? null };
    }
    // d (denominador da rent%) usa o capital BRUTO exposto durante o mês —
    // transferência interna não muda o capital exposto, portanto fica bruto.
    const d = piOn + (r.aporte_mes_onshore ?? 0);
    return { pi: piOn, pf: r.pl_onshore ?? 0, nnm: nnmRealOnshore(r),
      rb: r.rentabilidade_onshore ?? 0, rp: d > 0 ? (r.rentabilidade_onshore ?? 0) / d : null };
  }
  if (v === 'offshore') {
    const off = calcOffshore(r, prev);
    return { pi: off.piBrl, pf: r.pl_offshore ?? 0, nnm: nnmRealOffshore(r),
      rb: off.rentBrl, rp: off.rp,
      piUsd: off.plUsdInicial, rentUsd: off.rentUsd, nnmUsd: off.nnmUsdCalc,
      gc: off.gcBrl, gcAnomalia: off.gcAnomalia, gcAnomaliaReason: off.gcAnomaliaReason,
      ptaxIni: off.ptaxAnterior !== off.ptaxAtual ? off.ptaxAnterior : null, ptaxFin: off.ptaxAtual };
  }
  // Consolidado: onshore + offshore (mesma fórmula)
  const off = calcOffshore(r, prev);
  const rentOnshore = r.rentabilidade_onshore ?? 0;
  const rbCons = rentOnshore + off.rentBrl;
  // NNM consolidado = soma de NNM Real onshore + NNM Real offshore.
  const nnmCons = nnmRealOnshore(r) + nnmRealOffshore(r);
  const piOn = r.pl_inicial_onshore ?? 0;
  const piOffBrl = r.pl_inicial_offshore ?? 0;

  let rpCons: number | null;
  if (piOn <= 0.01 && (piOffBrl > 0.01 || off.plUsdFinal > 0.01)) {
    // Only offshore
    rpCons = off.rp;
  } else if (off.plUsdFinal <= 0.01 && piOn > 0.01) {
    // Only onshore (mês normal)
    const dOn = piOn + (r.aporte_mes_onshore ?? 0);
    rpCons = dOn > 0 ? rentOnshore / dOn : null;
  } else if (piOn <= 0.01 && off.plUsdFinal <= 0.01 && piOffBrl <= 0.01) {
    // Mês de entrada puramente onshore (sem posição offshore): espelha o ramo
    // primeiroMes onshore — rent% da lâmina, não rentBRL/NNM.
    rpCons = r.rentabilidade_pct ?? null;
  } else {
    // Ambos
    const baseCons = (r.pl_inicial_total ?? 0) + nnmCons;
    rpCons = baseCons > 0 ? rbCons / baseCons : null;
  }

  return { pi: r.pl_inicial_total ?? 0, pf: r.pl_total ?? 0, nnm: nnmCons,
    rb: rbCons, rp: rpCons };
}

function acessorDetalhe(visao: Visao, cdiPorMes: Record<string, number | null>, todasLinhas: LinhaDetalhe[]) {
  return (l: LinhaDetalhe, col: string): number | string | null => {
    const prevIdx = todasLinhas.findIndex(x => x.idx === l.idx) - 1;
    const prev = prevIdx >= 0 ? todasLinhas[prevIdx]?.r : null;
    const d = pickR(l.r, visao, prev);
    const chave = `${l.r.ano}-${String(l.r.mes).padStart(2, '0')}`;
    switch (col) {
      case 'data': return l.r.ano * 12 + l.r.mes;
      case 'pi': return d.pi;
      case 'nnm': return d.nnm;
      case 'rb': return d.rb;
      case 'imp': return l.r.impostos_mes ?? null;
      case 'rp': return d.rp;
      case 'cdi': {
        const cdi = cdiPorMes[chave] ?? null;
        const rent = l.r.rentabilidade_pct ?? 0;
        return cdi != null ? rent - cdi : null;
      }
      case 'gc': return l.ganhoCambial;
      case 'meta': return l.r.meta_poupanca_mensal ?? null;
      case 'prog': {
        const m = l.r.meta_poupanca_mensal;
        if (!m) return null;
        // Progresso usa poupança líquida (aporte - tombamento), não o bruto.
        // Tomb por dimensão: espelha a lógica de tombVisao do componente.
        // Prioridade = valor gravado > 0; fallback = campo legado.
        const r = l.r;
        const tombOn = r.nnm_tombamento_onshore ?? 0;
        const tombOff = r.nnm_tombamento_offshore ?? 0;
        let tomb = 0;
        if (tombOn > 0 || tombOff > 0) {
          if (visao === 'onshore') tomb = tombOn;
          else if (visao === 'offshore') tomb = tombOff;
          else tomb = tombOn + tombOff;
        } else {
          tomb = r.nnm_tombamento ?? 0;
        }
        return (d.nnm - tomb) / m;
      }
      case 'pf': return d.pf;
      default: return null;
    }
  };
}

/** Tombamento por visão: PRIORIDADE = valor gravado (manual ou auto do import).
 *  Só cai no cálculo automático quando não há tombamento salvo positivo.
 *  Exportado para reuso pelos exportadores (Excel/PDF). */
export function tombVisao(r: RegistroPoupanca, visao: Visao): number {
  const tombOn = r.nnm_tombamento_onshore ?? 0;
  const tombOff = r.nnm_tombamento_offshore ?? 0;
  if (tombOn > 0 || tombOff > 0) {
    if (visao === 'onshore') return tombOn;
    if (visao === 'offshore') return tombOff;
    return tombOn + tombOff;
  }
  const tomb = r.nnm_tombamento ?? 0;
  if (tomb <= 0) return 0;
  const nnmOn = Math.abs(r.aporte_mes_onshore ?? 0);
  const nnmOff = Math.abs(r.aporte_mes_offshore ?? 0);
  const total = nnmOn + nnmOff;
  if (total < 0.01) return visao === 'consolidado' ? tomb : 0;
  if (visao === 'onshore') return tomb * (nnmOn / total);
  if (visao === 'offshore') return tomb * (nnmOff / total);
  return tomb;
}

/** Recorte do mês quando dia_inicio > 1 ou dia_corte definido. null = mês completo. */
function recortePeriodo(r: RegistroPoupanca): { diaIni: number; diaFim: number; diasPeriodo: number; diasMes: number } | null {
  const ult = ultimoDiaDoMes(r.ano, r.mes);
  const diaIni = r.dia_inicio != null && r.dia_inicio > 1 ? r.dia_inicio : 1;
  const diaFim = r.dia_corte != null && r.dia_corte > 0 && r.dia_corte < ult ? r.dia_corte : ult;
  if (diaIni === 1 && diaFim === ult) return null;
  return {
    diaIni, diaFim,
    diasPeriodo: diasUteisEntre(r.ano, r.mes, diaIni, diaFim),
    diasMes: diasUteisNoMes(r.ano, r.mes),
  };
}

export function DetalheTabela({ linhas, cdiPorMes, fedPorMes, cdiCheioPorMes, fedCheioPorMes, visao, metaAutoFillGlobal, editIdx, onEditIdx, onSalvo, onToggleRevisaoMes }: Props) {
  const linhasDesc = useMemo(() => [...linhas].reverse(), [linhas]);
  const mostrarGC = visao !== 'onshore';
  const mostrarImp = visao !== 'offshore';

  // Meta auto-fill: vem do pai (calculada sobre TODOS os registros, não filtrados por visão)
  const metaAutoFill = metaAutoFillGlobal ?? null;
  const numCols = (mostrarGC ? 12 : 11) - (mostrarImp ? 0 : 1);

  const [filtroPeriodos, setFiltroPeriodos] = useState<Set<string> | null>(null);
  const periodos = useMemo(() => linhasDesc.map(l => l.periodo), [linhasDesc]);

  const filtradas = useMemo(() =>
    filtroPeriodos ? linhasDesc.filter(l => filtroPeriodos.has(l.periodo)) : linhasDesc,
  [linhasDesc, filtroPeriodos]);

  // Offshore usa Fed Funds como benchmark; onshore/consolidado usa CDI
  const benchmarkPorMes = visao === 'offshore' && fedPorMes ? fedPorMes : cdiPorMes;
  const benchmarkCheioPorMes = visao === 'offshore' && fedCheioPorMes ? fedCheioPorMes : cdiCheioPorMes;
  const benchmarkNome = visao === 'offshore' ? 'Fed Funds' : 'CDI';
  const benchmarkLabel = visao === 'offshore' ? 'vs Fed Funds' : 'vs CDI';

  const acessor = useCallback(acessorDetalhe(visao, benchmarkPorMes, linhas), [visao, benchmarkPorMes, linhas]);
  const { ordenados, coluna, direcao, alternar } = useOrdenacao(filtradas, acessor);

  const totais = useMemo(() => {
    let nnm = 0, rb = 0, sRp = 0, cRp = 0, gc = 0, sCdi = 0, cCdi = 0, sSp = 0, cSp = 0, meta = 0, nnmT = 0, tombT = 0;
    let imp = 0, temImp = false;
    for (const l of ordenados) {
      const origIdx = linhas.findIndex(x => x.idx === l.idx);
      const prevR = origIdx > 0 ? linhas[origIdx - 1]?.r : null;
      const d = pickR(l.r, visao, prevR);
      nnm += d.nnm; rb += d.rb; nnmT += d.nnm;
      tombT += tombVisao(l.r, visao);
      meta += l.r.meta_poupanca_mensal ?? metaAutoFill ?? 0;
      if (d.rp) { sRp += d.rp; cRp++; }
      if (l.ganhoCambial != null) gc += l.ganhoCambial;
      if (mostrarImp && l.r.impostos_mes != null) { imp += l.r.impostos_mes; temImp = true; }
      const chave = `${l.r.ano}-${String(l.r.mes).padStart(2, '0')}`;
      const bm = benchmarkPorMes[chave] ?? null;
      if (bm != null) { sCdi += bm; cCdi++; }
      const rent = d.rp ?? (l.r.rentabilidade_pct ?? 0);
      if (bm != null && rent) { sSp += rent - bm; cSp++; }
    }
    return { nnm, rb, rpM: cRp > 0 ? sRp / cRp : 0, gc, meta, nnmT, tombT,
      nnmLiq: nnmT - tombT, cdiM: cCdi > 0 ? sCdi / cCdi : 0, spM: cSp > 0 ? sSp / cSp : 0,
      imp, temImp };
  }, [ordenados, visao, benchmarkPorMes, linhas, metaAutoFill]);

  const thProps = { colunaAtiva: coluna, direcao, onAlternar: alternar };

  return (
    <div className="rounded-xl overflow-auto" style={{ border: '1px solid #f1f5f9', maxHeight: '55vh' }}>
      <table className="min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <ThOrdenavel chave="data" label="Data" className={`px-3 py-2 text-left ${H}`} {...thProps}>
              <FiltroCheckbox valores={periodos} selecionados={filtroPeriodos} onAplicar={setFiltroPeriodos} />
            </ThOrdenavel>
            <ThOrdenavel chave="pi" label="AUM Inicial" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <ThOrdenavel chave="nnm" label="NNM" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <ThOrdenavel chave="rb" label="Rent. R$" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            {mostrarImp && <ThOrdenavel chave="imp" label="Impostos" className={`px-3 py-2 text-right ${H}`} {...thProps} />}
            <ThOrdenavel chave="rp" label="Rent. %" className={`px-3 py-2 text-center ${H}`} {...thProps} />
            <ThOrdenavel chave="cdi" label={benchmarkLabel} className={`px-3 py-2 text-center ${H}`} {...thProps} />
            {mostrarGC && <ThOrdenavel chave="gc" label="G. Cambial" className={`px-3 py-2 text-right ${H}`} {...thProps} />}
            <ThOrdenavel chave="meta" label="Meta" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <ThOrdenavel chave="prog" label="Progresso" className={`px-3 py-2 text-center ${H}`} {...thProps} />
            <ThOrdenavel chave="pf" label="AUM Final" className={`px-3 py-2 text-right ${H}`} {...thProps} />
            <th style={{ ...HS, width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {ordenados.map((l) => {
            const isEd = editIdx === l.idx;
            // Encontrar registro anterior na ordem original (linhas asc) para pickR offshore
            const origIdx = linhas.findIndex(x => x.idx === l.idx);
            const prevR = origIdx > 0 ? linhas[origIdx - 1]?.r : null;
            const d = pickR(l.r, visao, prevR);
            const chave = `${l.r.ano}-${String(l.r.mes).padStart(2, '0')}`;
            const benchmark = benchmarkPorMes[chave] ?? null;
            const benchmarkCheio = benchmarkCheioPorMes?.[chave] ?? null;
            const rent = d.rp ?? (l.r.rentabilidade_pct ?? 0);
            const spread = benchmark != null && rent != null ? rent - benchmark : null;
            const isOff = visao === 'offshore';
            const plUsd = l.r.pl_offshore_usd;
            const marcadoMes = l.r.revisao_pendente === true;
            // Recorte de período parcial (tombamento ou lâmina incompleta).
            const recorte = recortePeriodo(l.r);
            const periodoTooltip = recorte
              ? `Período parcial: dias ${recorte.diaIni} a ${recorte.diaFim} do mês (${recorte.diasPeriodo} de ${recorte.diasMes} dias úteis)`
              : null;
            const benchmarkTooltip = recorte && benchmark != null && benchmarkCheio != null
              ? `${benchmarkNome} pro-rata: ${(benchmark * 100).toFixed(2)}% (${recorte.diasPeriodo}/${recorte.diasMes} dias úteis) vs mês cheio: ${(benchmarkCheio * 100).toFixed(2)}%`
              : null;
            return [
              <tr key={l.idx}
                className={`group transition-colors duration-150 ${isEd ? '' : 'hover:bg-blue-50/40'}`}
                style={{
                  height: 48,
                  borderBottom: '1px solid #f1f5f9',
                  ...(isEd
                    ? { backgroundColor: '#eff6ff', borderLeft: '3px solid #0065FF' }
                    : marcadoMes
                      ? { backgroundColor: '#fef3c7', borderLeft: '3px solid #f59e0b' }
                      : {}),
                }}>
                <td className="px-3 py-2 text-left font-medium" style={{ ...CS, color: '#160F41' }}>{l.periodo}</td>
                <td className="px-3 py-2 text-right" style={{ ...CS, color: d.pi ? '#160F41' : '#94a3b8' }}>
                  {d.pi ? formatCurrency(d.pi) : '—'}
                  {isOff && 'piUsd' in d && (d as { piUsd: number }).piUsd > 0 && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {(d as { piUsd: number }).piUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right" style={{ ...CS, ...cor(d.nnm) }}>
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    {formatCurrency(d.nnm)}
                    {tombVisao(l.r, visao) > 0 && (
                      <span title={`NNM: ${formatCurrency(d.nnm)} | Tombamento: ${formatCurrency(tombVisao(l.r, visao))} | Poup. liq.: ${formatCurrency(d.nnm - tombVisao(l.r, visao))}`}>
                        <Info size={12} style={{ color: '#6b6b8a' }} />
                      </span>
                    )}
                  </span>
                  {isOff && 'nnmUsd' in d && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {(d as { nnmUsd: number }).nnmUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right" style={{ ...CS, ...cor(d.rb) }}>
                  {formatCurrency(d.rb)}
                  {isOff && 'rentUsd' in d && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {(d as { rentUsd: number }).rentUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                {mostrarImp && (
                  <td className="px-3 py-2 text-right" style={{ ...CS, color: l.r.impostos_mes != null ? '#dc2626' : '#94a3b8' }}>
                    {l.r.impostos_mes != null ? formatCurrency(l.r.impostos_mes) : '—'}
                  </td>
                )}
                <td className="px-3 py-2 text-center" style={CS}>
                  {d.rp != null ? (
                    <span className="inline-flex items-center gap-0.5 justify-center" title={periodoTooltip ?? undefined}>
                      {`${(d.rp * 100).toFixed(2)}%`}
                      {periodoTooltip && <Info size={11} style={{ color: '#6b6b8a' }} />}
                    </span>
                  ) : <span style={DASH}>—</span>}
                </td>
                <td className="px-3 py-2 text-center" style={{ ...CS, ...cor(spread) }}>
                  {spread != null ? (
                    <span className="inline-flex items-center gap-0.5 justify-center" title={benchmarkTooltip ?? undefined}>
                      {fmtSp(spread)}
                      {benchmarkTooltip && <Info size={11} style={{ color: '#6b6b8a' }} />}
                    </span>
                  ) : <span style={DASH}>—</span>}
                </td>
                {mostrarGC && (
                  <td className="px-3 py-2 text-right" style={{ ...CS, ...cor(l.ganhoCambial) }}>
                    <span className="inline-flex items-center gap-0.5 justify-end">
                      {l.ganhoCambial != null ? formatCurrency(l.ganhoCambial) : <span style={DASH}>—</span>}
                      {l.gcAnomalia && (
                        <span title="Cadeia offshore inconsistente (mês faltando ou transferência interna) — câmbio pelo método clássico, não confiável. Revisar a lâmina.">
                          <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
                        </span>
                      )}
                    </span>
                    {isOff && 'ptaxIni' in d && 'ptaxFin' in d && (d as { ptaxFin: number | null }).ptaxFin && (
                      <>
                        {(d as { ptaxIni: number | null }).ptaxIni != null && (
                          <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>PTAX ini: {((d as { ptaxIni: number }).ptaxIni).toFixed(4)}</span>
                        )}
                        <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>PTAX fin: {((d as { ptaxFin: number }).ptaxFin).toFixed(4)}</span>
                      </>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 text-right" style={CS}>
                  {l.r.meta_poupanca_mensal
                    ? formatCurrency(l.r.meta_poupanca_mensal)
                    : metaAutoFill != null
                      ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }} title="Capacidade auto: media NNM liquido">{formatCurrency(metaAutoFill)}</span>
                      : <span style={DASH}>—</span>}
                </td>
                <td className="px-2 py-2" style={{ width: 160 }}>
                  <TabelaStatusBar nnm={d.nnm - tombVisao(l.r, visao)} meta={l.r.meta_poupanca_mensal ?? metaAutoFill ?? null}
                    tombamento={tombVisao(l.r, visao) > 0 && (d.nnm - tombVisao(l.r, visao)) <= 0 && d.nnm > 0}
                    capacidade={l.r.capacidade_poupanca_mensal}
                    semCapacidade={l.r.sem_capacidade_poupanca} />
                </td>
                <td className="px-3 py-2 text-right" style={{ ...CS, color: '#160F41' }}>
                  {formatCurrency(d.pf)}
                  {isOff && plUsd != null && plUsd > 0 && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {plUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                <td className="px-1 py-2 text-center whitespace-nowrap">
                  {onToggleRevisaoMes && (
                    <button onClick={() => onToggleRevisaoMes(l.r.ano, l.r.mes, marcadoMes)}
                      title={marcadoMes ? 'Desmarcar revisão deste mês' : 'Marcar este mês para revisão'}
                      className={`p-1 rounded transition-colors ${marcadoMes ? 'text-orange-500' : 'invisible group-hover:visible text-gray-400 hover:text-gray-600'}`}>
                      <Flag size={14} style={{ fill: marcadoMes ? '#fbbf24' : 'transparent' }} />
                    </button>
                  )}
                  <button onClick={() => onEditIdx(isEd ? null : l.idx)}
                    className={`p-1 rounded transition-colors ${isEd ? 'text-blue-500' : 'invisible group-hover:visible text-gray-400 hover:text-gray-600'}`}>
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>,
              isEd && <DetalheLinhaEdit key={`e-${l.idx}`} registro={l.r} periodo={l.periodo}
                colSpan={numCols} visao={visao} onSalvo={r => onSalvo(l.idx, r)} onCancelar={() => onEditIdx(null)} />,
            ];
          })}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
            <td className="px-3 py-2 text-left" style={{ ...CS, fontWeight: 700, color: '#160F41' }}>
              TOTAL / MÉDIA {filtroPeriodos ? `(${ordenados.length}/${linhas.length})` : ''}
            </td>
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...DASH }}>—</td>
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...cor(totais.nnm) }}>
              {formatCurrency(totais.nnm)}
              {totais.tombT > 0 && <span className="block text-[10px] font-normal" style={{ color: '#6b6b8a' }}>Poup. líq.: {formatCurrency(totais.nnmLiq)} | Tomb.: {formatCurrency(totais.tombT)}</span>}
            </td>
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...cor(totais.rb) }}>{formatCurrency(totais.rb)}</td>
            {mostrarImp && (
              <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, color: totais.temImp ? '#dc2626' : '#94a3b8' }}>
                {totais.temImp ? formatCurrency(totais.imp) : '—'}
              </td>
            )}
            <td className="px-3 py-2 text-center" style={{ ...CS, fontWeight: 700 }}>{(totais.rpM * 100).toFixed(2)}%</td>
            <td className="px-3 py-2 text-center" style={{ ...CS, fontWeight: 700, ...cor(totais.spM) }}>{totais.spM ? fmtSp(totais.spM) : <span style={DASH}>—</span>}</td>
            {mostrarGC && <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...cor(totais.gc) }}>{formatCurrency(totais.gc)}</td>}
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700 }}>{totais.meta > 0 ? formatCurrency(totais.meta) : <span style={DASH}>—</span>}</td>
            <td className="px-2 py-2" style={{ width: 160 }}><TabelaStatusBar nnm={totais.nnmLiq} meta={totais.meta > 0 ? totais.meta : null} /></td>
            <td className="px-3 py-2 text-right" style={{ ...CS, fontWeight: 700, ...DASH }}>—</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
