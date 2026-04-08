// --- Gráfico acumulado Rent vs CDI (ComposedChart) ---

import { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import type { LinhaDetalhe } from './PoupancaClienteDetalhe';
import type { Visao } from './PoupancaTabela';
import { calcularAcumulado, alinharCDI } from '../../utils/acumulado';

interface Props {
  linhas: LinhaDetalhe[];
  cdiPorMes: Record<string, number | null>;
  visao: Visao;
}

interface Ponto {
  periodo: string;
  rentAcum: number;
  cdiAcum: number | null;
  spread: number | null;
}

function retornoMensal(l: LinhaDetalhe, visao: Visao): number {
  const r = l.r;
  if (visao === 'onshore') {
    const d = (r.pl_inicial_onshore ?? 0) + (r.aporte_mes_onshore ?? 0);
    return d > 0 ? (r.rentabilidade_onshore ?? 0) / d : 0;
  }
  if (visao === 'offshore') {
    const d = (r.pl_inicial_offshore ?? 0) + (r.aporte_mes_offshore ?? 0);
    return d > 0 ? (r.rentabilidade_offshore ?? 0) / d : 0;
  }
  return r.rentabilidade_pct ?? 0;
}

export function DetalheGrafico({ linhas, cdiPorMes, visao }: Props) {
  const dados = useMemo<Ponto[]>(() => {
    const retornos = linhas.map(l => retornoMensal(l, visao));
    const rentAcum = calcularAcumulado(retornos);
    const meses = linhas.map(l => ({ ano: l.r.ano, mes: l.r.mes }));
    const cdiMensal = alinharCDI(meses, cdiPorMes);
    const cdiAcum = calcularAcumulado(cdiMensal);

    return linhas.map((l, i) => {
      const ca = cdiMensal[i] != null ? cdiAcum[i] : null;
      return {
        periodo: l.periodo,
        rentAcum: rentAcum[i],
        cdiAcum: ca,
        spread: ca != null ? rentAcum[i] - ca : null,
      };
    });
  }, [linhas, cdiPorMes, visao]);

  if (dados.length === 0) return null;

  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={dados} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
        <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b6b8a' }} />
        <YAxis tick={{ fontSize: 10, fill: '#6b6b8a' }}
          tickFormatter={(v: number) => fmtPct(v)} />
        <Tooltip
          formatter={(value, name) => {
            const v = Number(value);
            const label = name === 'rentAcum' ? 'Rent. Acumulada'
              : name === 'cdiAcum' ? 'CDI Acumulado' : 'Spread';
            const prefix = name === 'spread' && v > 0 ? '+' : '';
            return [`${prefix}${fmtPct(v)}`, label];
          }}
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }}
          formatter={(v: string) =>
            v === 'rentAcum' ? 'Rent. Acumulada'
            : v === 'cdiAcum' ? 'CDI Acumulado' : 'Spread'
          } />
        <Bar dataKey="spread" name="spread" stackId="spread" barSize={20}>
          {dados.map((d, i) => (
            <Cell key={i} fill={d.spread != null && d.spread >= 0 ? '#22c55e' : '#ef4444'} />
          ))}
        </Bar>
        <Line type="monotone" dataKey="rentAcum" name="rentAcum"
          stroke="#0065FF" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="cdiAcum" name="cdiAcum"
          stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 2 }}
          connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
