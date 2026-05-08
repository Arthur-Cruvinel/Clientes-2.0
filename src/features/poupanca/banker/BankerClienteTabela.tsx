// --- Tabela de clientes do banker (mesma estrutura PoupancaTabela filtrada) ---

import { useMemo } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import type { RegistroPoupanca } from '../../../types';
import { TabelaStatusBar } from '../TabelaStatusBar';
import { nnmReal } from '../../../utils/financials';

interface Props {
  nomes: string[];
  registrosPorCliente: Map<string, RegistroPoupanca[]>;
  nMeses: number;
  onClienteClick: (registros: RegistroPoupanca[]) => void;
}

function pNum(a: number, m: number) { return a * 12 + m; }
function safe(v: number | undefined | null) { return v ?? 0; }

const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-right';
const TD = 'px-3 py-2 text-xs text-right';
function cor(v: number | null) {
  if (v == null) return undefined;
  return v < 0 ? { color: '#dc2626' } : v > 0 ? { color: '#16a34a' } : undefined;
}

interface Linha {
  nome: string; pi: number; pf: number; nnm: number; rentR: number;
  rentPct: number | null; metaPeriodo: number | null; metaMensal: number | null;
  registros: RegistroPoupanca[];
}

export function BankerClienteTabela({ nomes, registrosPorCliente, nMeses, onClienteClick }: Props) {
  const linhas = useMemo<Linha[]>(() => {
    const res: Linha[] = [];
    for (const nc of nomes) {
      const regs = registrosPorCliente.get(nc);
      if (!regs || regs.length === 0) continue;
      const sorted = [...regs].sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
      const pri = sorted[0], ult = sorted[sorted.length - 1];
      let nnm = 0, rentR = 0;
      for (const r of sorted) {
        // NNM Real consolidado (desconta transferências internas)
        nnm += nnmReal(r);
        rentR += safe(r.rentabilidade_total);
      }
      const pi = safe(pri.pl_inicial_total);
      const d = pi + nnm;
      const metaMensal = ult.meta_poupanca_mensal ?? null;
      res.push({
        nome: nc, pi, pf: safe(ult.pl_total), nnm, rentR,
        rentPct: d > 0 ? rentR / d : null,
        metaPeriodo: metaMensal != null ? metaMensal * nMeses : null,
        metaMensal, registros: sorted,
      });
    }
    return res.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [nomes, registrosPorCliente, nMeses]);

  const totais = useMemo(() => {
    let pi = 0, pf = 0, nnm = 0, rentR = 0, meta = 0, srp = 0, sp = 0;
    for (const l of linhas) {
      pi += l.pi; pf += l.pf; nnm += l.nnm; rentR += l.rentR;
      if (l.metaPeriodo) meta += l.metaPeriodo;
      if (l.rentPct != null && l.pf > 0) { srp += l.rentPct * l.pf; sp += l.pf; }
    }
    return { pi, pf, nnm, rentR, meta, rpM: sp > 0 ? srp / sp : 0 };
  }, [linhas]);

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
      <table className="min-w-full text-sm">
        <thead style={{ backgroundColor: '#f9f9fb' }}>
          <tr>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left w-44">Cliente</th>
            <th className={`${TH} w-28`}>AUM Inicial</th>
            <th className={`${TH} w-24`}>NNM</th>
            <th className={`${TH} w-28`}>Rent. R$</th>
            <th className={`${TH} w-20`}>Rent. %</th>
            <th className={`${TH} w-28`}>AUM Final</th>
            <th className={`${TH} w-28`}>Meta Período</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center w-28">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
          {linhas.map(l => (
            <tr key={l.nome} onClick={() => onClienteClick(l.registros)}
              className="cursor-pointer hover:bg-blue-50/40 transition-colors">
              <td className="px-3 py-2 text-xs font-medium text-left truncate" style={{ color: '#160F41' }}>{l.nome}</td>
              <td className={TD}>{l.pi ? formatCurrency(l.pi) : '—'}</td>
              <td className={TD} style={cor(l.nnm)}>{formatCurrency(l.nnm)}</td>
              <td className={TD} style={cor(l.rentR)}>{formatCurrency(l.rentR)}</td>
              <td className={TD} style={l.rentPct != null && l.rentPct < 0 ? { color: '#dc2626' } : undefined}>
                {l.rentPct != null ? `${(l.rentPct * 100).toFixed(2)}%` : '—'}
              </td>
              <td className={TD}>{formatCurrency(l.pf)}</td>
              <td className={TD}>{l.metaPeriodo ? formatCurrency(l.metaPeriodo) : '—'}</td>
              <td className="px-2 py-2">
                <TabelaStatusBar nnm={l.nnm} meta={l.metaPeriodo} metaMensal={l.metaMensal}
                  capacidade={l.registros[l.registros.length - 1]?.capacidade_poupanca_mensal}
                  semCapacidade={l.registros[l.registros.length - 1]?.sem_capacidade_poupanca} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t-2" style={{ borderColor: '#d1d5db' }}>
            <td className="px-3 py-2 text-xs font-semibold text-left" style={{ color: '#160F41' }}>TOTAL / MÉDIA</td>
            <td className={`${TD} font-semibold`}>{formatCurrency(totais.pi)}</td>
            <td className={`${TD} font-semibold`} style={cor(totais.nnm)}>{formatCurrency(totais.nnm)}</td>
            <td className={`${TD} font-semibold`} style={cor(totais.rentR)}>{formatCurrency(totais.rentR)}</td>
            <td className={`${TD} font-semibold`}>{(totais.rpM * 100).toFixed(2)}%</td>
            <td className={`${TD} font-semibold`}>{formatCurrency(totais.pf)}</td>
            <td className={`${TD} font-semibold`}>{totais.meta > 0 ? formatCurrency(totais.meta) : '—'}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
