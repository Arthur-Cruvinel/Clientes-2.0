// --- Preview da tabela multi-período (import onshore) ---

import { formatCurrency } from '../../../utils/formatters';
import type { RegistroMensal } from './parsers/parseMultiPeriodoComClaude';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const TH = 'px-3 py-2 text-xs font-bold uppercase text-right';
const TD = 'px-3 py-2 text-xs text-right';

interface Props {
  registros: RegistroMensal[];
  nomeCliente: string;
  salvando: boolean;
  onSalvar: () => void;
  onLimpar: () => void;
}

export function PreviewMultiPeriodo({ registros, nomeCliente, salvando, onSalvar, onLimpar }: Props) {
  if (registros.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium" style={{ color: '#160F41' }}>
        {nomeCliente} — {registros.length} meses extraídos
      </p>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
        <table className="min-w-full text-sm">
          <thead style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              <th className={`${TH} text-left`}>Mês/Ano</th>
              <th className={TH}>AUM Inicial</th>
              <th className={TH}>NNM</th>
              <th className={TH}>Rent. R$</th>
              <th className={TH}>Rent. %</th>
              <th className={TH}>CDI %</th>
              <th className={TH}>AUM Final</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {registros.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-xs font-medium">{MESES[r.mes - 1]}/{r.ano}</td>
                <td className={TD}>{formatCurrency(r.pl_inicial_total)}</td>
                <td className={TD}>{formatCurrency(r.aporte_mes_total)}</td>
                <td className={TD}>{formatCurrency(r.rentabilidade_total)}</td>
                <td className={TD}>{(r.rentabilidade_pct * 100).toFixed(2)}%</td>
                <td className={TD}>{r.cdi_mes_pct != null ? `${(r.cdi_mes_pct * 100).toFixed(2)}%` : '—'}</td>
                <td className={TD}>{formatCurrency(r.pl_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3">
        <button onClick={onSalvar} disabled={salvando}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
          {salvando ? 'Salvando...' : `Salvar ${registros.length} meses`}
        </button>
        <button onClick={onLimpar} className="px-4 py-2 rounded-lg text-sm"
          style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Limpar</button>
      </div>
    </div>
  );
}
