// --- Tabela acumulada de clientes (Consolidado / Onshore / Offshore) ---
// Agrega registros por cliente com campos segmentados por visão.

import { useMemo, useState } from 'react';
import type { RegistroPoupanca } from '../../types';
import { PoupancaTabelaLinhas } from './PoupancaTabelaLinhas';
import { ExportButton } from '../../components/ui/ExportButton';
import { exportAumExcel } from '../../utils/exporters/exportExcel';
import { exportAumPdf } from '../../utils/exporters/exportPdf';
import { calcularAcumulado } from '../../utils/acumulado';
import { pickR, calcOffshore } from './DetalheTabela';
import { nnmPoupancaLiquida, nnmRealOffshore } from '../../utils/financials';

export type Visao = 'consolidado' | 'onshore' | 'offshore';

interface Props {
  registrosPorCliente: Map<string, RegistroPoupanca[]>;
  /** Para cada cliente, o registro IMEDIATAMENTE ANTERIOR ao intervalo —
   *  usado pelo cálculo de Ganho Cambial do primeiro mês (sem prev no
   *  intervalo, o cálculo zerava). Vem do hook usePoupanca. */
  registroAnteriorPorCliente?: Map<string, RegistroPoupanca | null>;
  /** nome→sigla do mapeamento_siglas (Firestore) — badge de sigla real. */
  mapaSiglas?: Map<string, string>;
  metaNNM: number | null;
  numeroMeses: number;
  clientesSemBanker?: Set<string>;
  onClienteClick: (registros: RegistroPoupanca[]) => void;
  periodoLabel?: string;
  // Revisão (pass-through pro PoupancaTabelaLinhas)
  estaMarcado?: (nome: string) => boolean;
  onToggleRevisao?: (nome: string) => void;
  // Lift de ordenação (pass-through pro PoupancaTabelaLinhas)
  onOrdenadosChange?: (nomes: string[]) => void;
}

function pNum(a: number, m: number) { return a * 12 + m; }

function safe(n: number | undefined | null) { return n ?? 0; }
// rentPct (fórmula simples ΣrentBRL/(PI+ΣNNM)) foi removida — substituída por
// twrUltimo via calcularAcumulado para alinhar com o detalhe individual.

/** Time-Weighted Return: encadeia (1 + r) mês a mês via calcularAcumulado.
 *  Retorna a rentabilidade composta do período (último elemento do acumulado).
 *  null quando não há nenhum mês com retorno informado. */
function twrUltimo(rps: (number | null)[]): number | null {
  if (rps.length === 0) return null;
  if (rps.every(r => r == null)) return null;
  const acum = calcularAcumulado(rps);
  return acum[acum.length - 1];
}

export interface LinhaTabela {
  nome: string;
  // Consolidado
  plIniCons: number; plFimCons: number; nnmCons: number; rentBrlCons: number; rentPctCons: number | null;
  // Onshore
  plIniOn: number; plFimOn: number; nnmOn: number; rentBrlOn: number; rentPctOn: number | null;
  // Offshore
  plIniOff: number; plFimOff: number; nnmOff: number; rentBrlOff: number; rentPctOff: number | null;
  // Offshore USD (para exibição de linhas secundárias)
  plIniOffUsd: number;
  plFimOffUsd: number;
  nnmOffUsd: number;
  rentBrlOffUsd: number; // rent em USD (não BRL)
  // Cambial + meta
  ganhoCambial: number | null;
  // Sinaliza GC vindo do fallback clássico por anomalia estrutural offshore
  // (mês faltando / transferência interna) — câmbio não confiável, revisar.
  gcAnomalia?: boolean;
  temOffshore: boolean;
  metaMensal: number | null;
  metaPeriodo: number | null;
  tombamentoTotal: number;
  nnmPoupancaLiquida: number;
  // Impostos pagos no período (soma de impostos_mes de todos os registros)
  // null se nenhum registro tiver o campo (cliente sem dado de impostos)
  impostosTotal: number | null;
  registros: RegistroPoupanca[];
}

export function PoupancaTabela({
  registrosPorCliente, registroAnteriorPorCliente, mapaSiglas, metaNNM, numeroMeses, clientesSemBanker, onClienteClick, periodoLabel = '',
  estaMarcado, onToggleRevisao, onOrdenadosChange,
}: Props) {
  const [visao, setVisao] = useState<Visao>('consolidado');

  const linhas = useMemo<LinhaTabela[]>(() => {
    const resultado: LinhaTabela[] = [];
    for (const [nome, regs] of registrosPorCliente) {
      const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      const pri = sorted[0], ult = sorted[sorted.length - 1];
      let nnmOn = 0, rOn = 0, tomb = 0;
      let imp = 0, temImp = false;

      // Offshore: acumular por mês via calcOffshore (fonte única, mesma do detalhe)
      let nnmOffBrl = 0, rentOffBrl = 0, nnmOffUsdTotal = 0, rentOffUsdTotal = 0;
      let gcOff = 0, temGcOff = false, gcAnomaliaOff = false;
      // Registro anterior AO intervalo (de fora) — prev do 1º mês p/ câmbio/
      // encadeamento offshore. Sem isso, o 1º mês do filtro zerava o câmbio.
      const regAnterior = registroAnteriorPorCliente?.get(nome) ?? null;
      // Arrays de retornos mensais (decimais) p/ TWR via calcularAcumulado.
      // Mesma fórmula do detalhe individual — fim da divergência entre
      // tabela (pseudo-rent simples inflada) e detalhe (TWR composta).
      const rpsOn: (number | null)[] = [];
      const rpsOff: (number | null)[] = [];
      const rpsCons: (number | null)[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : (regAnterior ?? null);
        // Coleta retornos mensais via pickR (fonte única, mesma do detalhe).
        rpsOn.push(pickR(r, 'onshore', prev).rp);
        rpsCons.push(pickR(r, 'consolidado', prev).rp);

        // Onshore: NNM real = aporte − transferência interna (movimentos
        // entre contas próprias do cliente não são poupança).
        nnmOn += safe(r.aporte_mes_onshore) - safe(r.transferencia_interna_onshore);
        rOn += safe(r.rentabilidade_onshore);
        tomb += safe(r.nnm_tombamento);
        if (r.impostos_mes != null) { imp += r.impostos_mes; temImp = true; }

        // Offshore: fonte ÚNICA calcOffshore (fim da duplicação do recálculo
        // inline). nnm/rent/gc idênticos ao detalhe individual. GC = resíduo
        // que fecha a identidade BRL, com guard estrutural contra anomalias.
        const off = calcOffshore(r, prev);
        const ptaxAtual = r.ptax_fechamento ?? 1;
        const transOffUsd = ptaxAtual > 0 ? safe(r.transferencia_interna_offshore) / ptaxAtual : 0;
        rpsOff.push(off.rp);
        nnmOffBrl += nnmRealOffshore(r);                 // já desconta transferência
        rentOffBrl += off.rentBrl;
        nnmOffUsdTotal += off.nnmUsdCalc - transOffUsd;
        rentOffUsdTotal += off.rentUsd;
        if (off.gcBrl != null) { gcOff += off.gcBrl; temGcOff = true; }
        if (off.gcAnomalia) gcAnomaliaOff = true;
      }

      // Consolidado: onshore + offshore corrigido (não usar campos _total do DB)
      const nnmC = nnmOn + nnmOffBrl;
      const rC = rOn + rentOffBrl;

      const piC = safe(pri.pl_inicial_total), piOn = safe(pri.pl_inicial_onshore);

      // AUM Inicial offshore BRL: usar ptaxAnterior (ou ptax do próprio mês se primeiro)
      // Não temos o registro anterior ao período, então estimamos
      // Usar pl_inicial_offshore do Firestore como AUM Ini BRL (já gravado com ptax correta no import)
      const piOff = safe(pri.pl_inicial_offshore);
      const ptaxPri = pri.ptax_fechamento ?? 1;
      const piOffUsd = piOff > 0.01 && ptaxPri > 0 ? piOff / ptaxPri : 0;
      const plFimOffUsd = safe(ult.pl_offshore_usd);

      // Rent % por visão = TWR (retorno composto mês a mês). Substitui a
      // antiga fórmula simples ΣrentBRL/(PI+ΣNNM), que inflava o resultado
      // quando havia grandes resgates (denominador artificialmente menor).
      const rentPctConsTwr = twrUltimo(rpsCons);
      const rentPctOnTwr = twrUltimo(rpsOn);
      const rentPctOffTwr = twrUltimo(rpsOff);

      resultado.push({
        nome,
        plIniCons: piC, plFimCons: safe(ult.pl_total), nnmCons: nnmC, rentBrlCons: rC, rentPctCons: rentPctConsTwr,
        plIniOn: piOn, plFimOn: safe(ult.pl_onshore), nnmOn, rentBrlOn: rOn, rentPctOn: rentPctOnTwr,
        plIniOff: piOff, plFimOff: safe(ult.pl_offshore), nnmOff: nnmOffBrl, rentBrlOff: rentOffBrl, rentPctOff: rentPctOffTwr,
        plIniOffUsd: piOffUsd, plFimOffUsd, nnmOffUsd: nnmOffUsdTotal, rentBrlOffUsd: rentOffUsdTotal,
        ganhoCambial: temGcOff ? gcOff : null,
        gcAnomalia: gcAnomaliaOff,
        temOffshore: sorted.some(r => (r.pl_offshore ?? 0) > 0 || (r.pl_offshore_usd ?? 0) > 0),
        // Meta: usa meta individual se definida, senão auto-fill (média NNM líquido)
        metaMensal: (() => {
          if (ult.meta_poupanca_mensal != null) return ult.meta_poupanca_mensal;
          if (ult.sem_capacidade_poupanca) return null;
          // Auto-fill: média NNM líquido do cliente (helper já desconta
          // tombamento E transferência interna).
          let somaLiq = 0, mesesComDado = 0;
          for (const r of sorted) {
            const liq = nnmPoupancaLiquida(r);
            if (Math.abs(liq) > 0.01) { somaLiq += liq; mesesComDado++; }
          }
          return mesesComDado > 0 ? somaLiq / mesesComDado : null;
        })(),
        metaPeriodo: (() => {
          let mensal: number | null = ult.meta_poupanca_mensal ?? null;
          if (mensal == null && !ult.sem_capacidade_poupanca) {
            let somaLiq = 0, mesesComDado = 0;
            for (const r of sorted) {
              const liq = nnmPoupancaLiquida(r);
              if (Math.abs(liq) > 0.01) { somaLiq += liq; mesesComDado++; }
            }
            mensal = mesesComDado > 0 ? somaLiq / mesesComDado : null;
          }
          return mensal != null ? mensal * numeroMeses : null;
        })(),
        tombamentoTotal: tomb,
        nnmPoupancaLiquida: nnmC - tomb,
        impostosTotal: temImp ? imp : null,
        registros: sorted,
      });
    }
    return resultado.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [registrosPorCliente, registroAnteriorPorCliente, metaNNM, numeroMeses]);

  if (linhas.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-sm"
        style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
        Nenhum registro de poupança para este período.
      </div>
    );
  }

  const TABS: { id: Visao; label: string }[] = [
    { id: 'consolidado', label: 'Consolidado' },
    { id: 'onshore', label: 'Onshore' },
    { id: 'offshore', label: 'Offshore' },
  ];

  // ── Exportação ─────────────────────────────────────────────
  // Mapeia LinhaTabela para o formato esperado pelos exporters,
  // selecionando os campos da visão atual.
  const visaoLabel = visao === 'consolidado' ? 'Consolidado' : visao === 'onshore' ? 'Onshore' : 'Offshore';

  function pickAgregados() {
    return linhas.map(l => {
      const aumIni = visao === 'onshore' ? l.plIniOn : visao === 'offshore' ? l.plIniOff : l.plIniCons;
      const aumFim = visao === 'onshore' ? l.plFimOn : visao === 'offshore' ? l.plFimOff : l.plFimCons;
      const nnm = visao === 'onshore' ? l.nnmOn : visao === 'offshore' ? l.nnmOff : l.nnmCons;
      const rentBrl = visao === 'onshore' ? l.rentBrlOn : visao === 'offshore' ? l.rentBrlOff : l.rentBrlCons;
      const rentPct = visao === 'onshore' ? l.rentPctOn : visao === 'offshore' ? l.rentPctOff : l.rentPctCons;
      const progressoPct = l.metaPeriodo && l.metaPeriodo > 0 ? (l.nnmPoupancaLiquida / l.metaPeriodo) * 100 : 0;
      return {
        nome_cliente: l.nome,
        aum_inicial: aumIni,
        nnm,
        tombamento: l.tombamentoTotal,
        nnm_liquido: l.nnmPoupancaLiquida,
        rent_rs: rentBrl,
        impostos: l.impostosTotal ?? 0,
        rent_pct: (rentPct ?? 0) * 100,
        cdi_pct: 0,
        spread: 0,
        // null = indisponível (cliente onshore-only ou primeiro mês sem prev);
        // 0 = calculado e zero (PTAX inalterada). Exporter trata null como
        // célula vazia para distinguir os dois casos.
        ganho_cambial: l.ganhoCambial,
        aum_final: aumFim,
        meta: l.metaPeriodo ?? 0,
        progresso_pct: progressoPct,
      };
    });
  }

  function pickTotais() {
    let aumTotal = 0, nnmTotal = 0, somaRent = 0, comRent = 0, poupando = 0;
    let impTotal = 0, temImp = false;
    for (const l of linhas) {
      const aumFim = visao === 'onshore' ? l.plFimOn : visao === 'offshore' ? l.plFimOff : l.plFimCons;
      const nnm = visao === 'onshore' ? l.nnmOn : visao === 'offshore' ? l.nnmOff : l.nnmCons;
      const rentPct = visao === 'onshore' ? l.rentPctOn : visao === 'offshore' ? l.rentPctOff : l.rentPctCons;
      aumTotal += aumFim;
      nnmTotal += nnm;
      if (rentPct != null) { somaRent += rentPct * 100; comRent++; }
      if (l.nnmPoupancaLiquida > 0) poupando++;
      if (l.impostosTotal != null) { impTotal += l.impostosTotal; temImp = true; }
    }
    return {
      aumTotal,
      nnmTotal,
      rentMedia: comRent > 0 ? somaRent / comRent : 0,
      clientesPoupando: poupando,
      impostosTotal: temImp ? impTotal : null,
    };
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-lg overflow-hidden w-fit" style={{ border: '1px solid #e2e2e8' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setVisao(t.id)}
              className={`px-4 py-1.5 text-xs font-medium transition-all ${visao === t.id ? 'bg-gradient-brand text-white' : ''}`}
              style={visao !== t.id ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
              {t.label}
            </button>
          ))}
        </div>
        <ExportButton
          onExportExcel={() => exportAumExcel(pickAgregados(), periodoLabel, visaoLabel)}
          onExportPdf={() => exportAumPdf(pickAgregados(), periodoLabel, visaoLabel, pickTotais())}
        />
      </div>
      <PoupancaTabelaLinhas
        linhas={linhas}
        visao={visao}
        mapaSiglas={mapaSiglas}
        clientesSemBanker={clientesSemBanker}
        onClienteClick={onClienteClick}
        estaMarcado={estaMarcado}
        onToggleRevisao={onToggleRevisao}
        onOrdenadosChange={onOrdenadosChange}
      />
    </div>
  );
}
