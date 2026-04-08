// --- Tabela acumulada de clientes (Consolidado / Onshore / Offshore) ---
// Agrega registros por cliente com campos segmentados por visão.

import { useMemo, useState } from 'react';
import type { RegistroPoupanca } from '../../types';
import { PoupancaTabelaLinhas } from './PoupancaTabelaLinhas';
import { ExportButton } from '../../components/ui/ExportButton';
import { exportAumExcel } from '../../utils/exporters/exportExcel';
import { exportAumPdf } from '../../utils/exporters/exportPdf';

export type Visao = 'consolidado' | 'onshore' | 'offshore';

interface Props {
  registrosPorCliente: Map<string, RegistroPoupanca[]>;
  metaNNM: number | null;
  numeroMeses: number;
  clientesSemBanker?: Set<string>;
  onClienteClick: (registros: RegistroPoupanca[]) => void;
  periodoLabel?: string;
}

function pNum(a: number, m: number) { return a * 12 + m; }

function safe(n: number | undefined | null) { return n ?? 0; }
function rentPct(brl: number, ini: number, nnm: number) {
  const d = ini + nnm; return d > 0 ? brl / d : null;
}

function calcGC(sorted: RegistroPoupanca[]): number | null {
  let total = 0, tem = false;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], curr = sorted[i];
    if (prev.ptax_fechamento && curr.ptax_fechamento && prev.pl_offshore_usd != null) {
      total += prev.pl_offshore_usd * (curr.ptax_fechamento - prev.ptax_fechamento);
      tem = true;
    }
  }
  return tem ? total : null;
}

export interface LinhaTabela {
  nome: string;
  // Consolidado
  plIniCons: number; plFimCons: number; nnmCons: number; rentBrlCons: number; rentPctCons: number | null;
  // Onshore
  plIniOn: number; plFimOn: number; nnmOn: number; rentBrlOn: number; rentPctOn: number | null;
  // Offshore
  plIniOff: number; plFimOff: number; nnmOff: number; rentBrlOff: number; rentPctOff: number | null;
  // Cambial + meta
  ganhoCambial: number | null;
  temOffshore: boolean;
  metaMensal: number | null;
  metaPeriodo: number | null;
  tombamentoTotal: number;
  nnmPoupancaLiquida: number;
  registros: RegistroPoupanca[];
}

export function PoupancaTabela({ registrosPorCliente, metaNNM, numeroMeses, clientesSemBanker, onClienteClick, periodoLabel = '' }: Props) {
  const [visao, setVisao] = useState<Visao>('consolidado');

  const linhas = useMemo<LinhaTabela[]>(() => {
    const resultado: LinhaTabela[] = [];
    for (const [nome, regs] of registrosPorCliente) {
      const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      const pri = sorted[0], ult = sorted[sorted.length - 1];
      let nnmC = 0, nnmOn = 0, nnmOff = 0, rC = 0, rOn = 0, rOff = 0, tomb = 0;
      for (const r of sorted) {
        nnmC += safe(r.aporte_mes_total); nnmOn += safe(r.aporte_mes_onshore); nnmOff += safe(r.aporte_mes_offshore);
        rC += safe(r.rentabilidade_total); rOn += safe(r.rentabilidade_onshore); rOff += safe(r.rentabilidade_offshore);
        tomb += safe(r.nnm_tombamento);
      }
      const piC = safe(pri.pl_inicial_total), piOn = safe(pri.pl_inicial_onshore), piOff = safe(pri.pl_inicial_offshore);
      resultado.push({
        nome,
        plIniCons: piC, plFimCons: safe(ult.pl_total), nnmCons: nnmC, rentBrlCons: rC, rentPctCons: rentPct(rC, piC, nnmC),
        plIniOn: piOn, plFimOn: safe(ult.pl_onshore), nnmOn, rentBrlOn: rOn, rentPctOn: rentPct(rOn, piOn, nnmOn),
        plIniOff: piOff, plFimOff: safe(ult.pl_offshore), nnmOff, rentBrlOff: rOff, rentPctOff: rentPct(rOff, piOff, nnmOff),
        ganhoCambial: calcGC(sorted), temOffshore: safe(ult.pl_offshore) > 0,
        metaMensal: ult.meta_poupanca_mensal ?? metaNNM,
        metaPeriodo: (ult.meta_poupanca_mensal ?? metaNNM) != null
          ? (ult.meta_poupanca_mensal ?? metaNNM)! * numeroMeses : null,
        tombamentoTotal: tomb,
        nnmPoupancaLiquida: nnmC - tomb,
        registros: sorted,
      });
    }
    return resultado.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [registrosPorCliente, metaNNM, numeroMeses]);

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
        rent_pct: (rentPct ?? 0) * 100,
        cdi_pct: 0,
        spread: 0,
        ganho_cambial: l.ganhoCambial ?? 0,
        aum_final: aumFim,
        meta: l.metaPeriodo ?? 0,
        progresso_pct: progressoPct,
      };
    });
  }

  function pickTotais() {
    let aumTotal = 0, nnmTotal = 0, somaRent = 0, comRent = 0, poupando = 0;
    for (const l of linhas) {
      const aumFim = visao === 'onshore' ? l.plFimOn : visao === 'offshore' ? l.plFimOff : l.plFimCons;
      const nnm = visao === 'onshore' ? l.nnmOn : visao === 'offshore' ? l.nnmOff : l.nnmCons;
      const rentPct = visao === 'onshore' ? l.rentPctOn : visao === 'offshore' ? l.rentPctOff : l.rentPctCons;
      aumTotal += aumFim;
      nnmTotal += nnm;
      if (rentPct != null) { somaRent += rentPct * 100; comRent++; }
      if (l.nnmPoupancaLiquida > 0) poupando++;
    }
    return {
      aumTotal,
      nnmTotal,
      rentMedia: comRent > 0 ? somaRent / comRent : 0,
      clientesPoupando: poupando,
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
      <PoupancaTabelaLinhas linhas={linhas} visao={visao} clientesSemBanker={clientesSemBanker} onClienteClick={onClienteClick} />
    </div>
  );
}
