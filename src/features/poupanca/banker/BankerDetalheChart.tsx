// --- Gráfico de evolução AUM agregado do banker ---

import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { RegistroPoupanca } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';

interface Props {
  nomes: string[];
  registrosPorCliente: Map<string, RegistroPoupanca[]>;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Ponto { periodo: string; aum: number }

export function BankerDetalheChart({ nomes, registrosPorCliente }: Props) {
  const dados = useMemo<Ponto[]>(() => {
    // Agrupa PL por mês para todos os clientes do banker
    const mapa = new Map<string, { periodo: string; aum: number; ord: number }>();
    for (const nc of nomes) {
      const regs = registrosPorCliente.get(nc);
      if (!regs) continue;
      for (const r of regs) {
        const chave = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
        const periodo = `${MESES[r.mes - 1]}/${String(r.ano).slice(2)}`;
        const atual = mapa.get(chave) ?? { periodo, aum: 0, ord: r.ano * 12 + r.mes };
        atual.aum += r.pl_total ?? 0;
        mapa.set(chave, atual);
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.ord - b.ord);
  }, [nomes, registrosPorCliente]);

  if (dados.length === 0) return null;

  return (
    <div className="mx-6 mt-4 mb-2 rounded-xl p-4" style={{ backgroundColor: '#f8fafc' }}>
      <p className="text-sm font-semibold mb-2" style={{ color: '#160F41' }}>
        Evolução AUM — Carteira do Banker
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dados} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
          <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b6b8a' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b6b8a' }}
            tickFormatter={(v: number) => formatCurrency(v)} width={90} />
          <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'AUM Total']}
            contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Line type="monotone" dataKey="aum" stroke="#0065FF" strokeWidth={2}
            dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
