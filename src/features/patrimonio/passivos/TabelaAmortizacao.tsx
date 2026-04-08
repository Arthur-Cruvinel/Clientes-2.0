// --- Tabela de amortização SAC/Price mês a mês ---

import { useMemo } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import type { Passivo } from '../../../types';

interface Props { passivo: Passivo }

interface Linha { n: number; saldoIni: number; amort: number; juros: number; parcela: number; saldoFim: number }

const TH = 'px-2 py-1.5 text-[10px] font-bold uppercase text-right';
const TD = 'px-2 py-1.5 text-[11px] text-right';

export function TabelaAmortizacao({ passivo: p }: Props) {
  const linhas = useMemo<Linha[]>(() => {
    const { saldo_devedor: sd, taxa_juros_mensal: taxa, sistema_amortizacao: sys, parcelas_restantes: n } = p;
    if (!sd || !n || n <= 0) return [];
    const result: Linha[] = [];
    let saldo = sd;

    if (sys === 'SAC') {
      const amortBase = sd / n;
      for (let i = 1; i <= n; i++) {
        const juros = saldo * taxa;
        const parcela = amortBase + juros;
        const saldoFim = saldo - amortBase;
        result.push({ n: i, saldoIni: saldo, amort: amortBase, juros, parcela, saldoFim: Math.max(saldoFim, 0) });
        saldo = Math.max(saldoFim, 0);
      }
    } else if (sys === 'PRICE') {
      const pmt = sd * (taxa * Math.pow(1 + taxa, n)) / (Math.pow(1 + taxa, n) - 1);
      for (let i = 1; i <= n; i++) {
        const juros = saldo * taxa;
        const amort = pmt - juros;
        const saldoFim = saldo - amort;
        result.push({ n: i, saldoIni: saldo, amort, juros, parcela: pmt, saldoFim: Math.max(saldoFim, 0) });
        saldo = Math.max(saldoFim, 0);
      }
    }
    return result;
  }, [p]);

  if (linhas.length === 0) {
    return <p className="text-sm py-4 text-center" style={{ color: '#6b6b8a' }}>Preencha saldo, taxa, sistema e parcelas para ver a tabela</p>;
  }

  const totAmort = linhas.reduce((s, l) => s + l.amort, 0);
  const totJuros = linhas.reduce((s, l) => s + l.juros, 0);
  const totParc = linhas.reduce((s, l) => s + l.parcela, 0);

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
      <table className="min-w-full">
        <thead className="sticky top-0" style={{ backgroundColor: '#f9f9fb' }}>
          <tr>
            <th className="px-2 py-1.5 text-[10px] font-bold uppercase text-center">Nº</th>
            <th className={TH}>Saldo Inicial</th>
            <th className={TH}>Amortização</th>
            <th className={TH}>Juros</th>
            <th className={TH}>Parcela</th>
            <th className={TH}>Saldo Final</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
          {linhas.map(l => (
            <tr key={l.n} className={l.n % 2 === 0 ? 'bg-gray-50/50' : ''}>
              <td className="px-2 py-1.5 text-[11px] text-center">{l.n}</td>
              <td className={TD}>{formatCurrency(l.saldoIni)}</td>
              <td className={TD}>{formatCurrency(l.amort)}</td>
              <td className={TD} style={{ color: '#dc2626' }}>{formatCurrency(l.juros)}</td>
              <td className={TD} style={{ fontWeight: 600 }}>{formatCurrency(l.parcela)}</td>
              <td className={TD}>{formatCurrency(l.saldoFim)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-gray-100" style={{ borderColor: '#d1d5db' }}>
            <td className="px-2 py-1.5 text-[10px] font-bold text-center">TOTAL</td>
            <td className={TD}>—</td>
            <td className={`${TD} font-bold`}>{formatCurrency(totAmort)}</td>
            <td className={`${TD} font-bold`} style={{ color: '#dc2626' }}>{formatCurrency(totJuros)}</td>
            <td className={`${TD} font-bold`}>{formatCurrency(totParc)}</td>
            <td className={TD}>—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
