// --- Gráficos da visão geral patrimonial (Barras + Donut) ---

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend } from 'recharts';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

interface PropsBarras { dados: { categoria: string; valor: number }[] }
interface PropsDonut { dados: { nome: string; valor: number; pct: number; cor: string }[] }

const CORES_BARRAS = ['#0065FF', '#ef4444', '#16a34a'];

export function GraficoBarras({ dados }: PropsBarras) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc' }}>
      <p className="text-sm font-semibold mb-3" style={{ color: '#160F41' }}>Ativos x Passivos x Patrimônio Líquido</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={dados} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
          <XAxis dataKey="categoria" tick={{ fontSize: 11, fill: '#6b6b8a' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b6b8a' }} tickFormatter={(v: number) => formatCurrency(v)} width={90} />
          <Tooltip formatter={(v) => [formatCurrency(Number(v)), '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 10, formatter: (v) => formatCurrency(Number(v)) }}>
            {dados.map((_, i) => {
              const cor = i === 2 && dados[2].valor < 0 ? '#dc2626' : CORES_BARRAS[i];
              return <Cell key={i} fill={cor} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoDonut({ dados }: PropsDonut) {
  const temDados = dados.some(d => d.valor > 0);
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc' }}>
      <p className="text-sm font-semibold mb-3" style={{ color: '#160F41' }}>Composição dos Ativos</p>
      {!temDados ? (
        <div className="flex items-center justify-center h-[280px]">
          <p className="text-xs" style={{ color: '#94a3b8' }}>Sem ativos cadastrados</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={dados.filter(d => d.valor > 0)} dataKey="valor" nameKey="nome"
              cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
              {dados.filter(d => d.valor > 0).map((d, i) => <Cell key={i} fill={d.cor} />)}
            </Pie>
            <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }}
              formatter={(name) => {
                const item = dados.find(d => d.nome === name);
                return `${name} — ${item ? formatPercent(item.pct * 100) : ''}`;
              }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
