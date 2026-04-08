// --- Gráfico de evolução do PL total (últimos 12 meses) ---

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import type { PontoHistorico } from './usePoupanca';

interface Props {
  dados: PontoHistorico[];
}

export function PoupancaChart({ dados }: Props) {
  if (dados.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-sm"
        style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
        Nenhum dado histórico disponível para o gráfico.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#e2e2e8' }}>
      <h4 className="text-sm font-semibold mb-3" style={{ color: '#160F41' }}>
        Evolução do AUM Total (últimos 12 meses)
      </h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={dados} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
          <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#6b6b8a' }} />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b6b8a' }}
            tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), 'AUM Total']}
            labelStyle={{ color: '#160F41', fontWeight: 600 }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line
            type="monotone"
            dataKey="pl_total"
            stroke="#0065FF"
            strokeWidth={2}
            dot={{ r: 3, fill: '#0065FF' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
