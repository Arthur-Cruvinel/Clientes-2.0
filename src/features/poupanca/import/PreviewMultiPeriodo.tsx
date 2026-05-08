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

// NNM exibido = aporte bruto sem tombamento embutido.
// Quando nnm_linha_abertura > 0, o parser somou o tombamento DUAS vezes
// em aporte_mes_total (uma vez em E_(i), outra em E_mes) — subtrai pra
// mostrar o NNM real (= B - C = NNM bruto).
function nnmExibido(r: RegistroMensal): number {
  const tomb = r.nnm_linha_abertura ?? 0;
  return tomb > 0 ? r.aporte_mes_total - tomb : r.aporte_mes_total;
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
              <th className={TH}>Impostos</th>
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
                <td className={TD}>{formatCurrency(nnmExibido(r))}</td>
                <td className={TD} style={(r.impostos_mes ?? 0) > 0 ? { color: '#991b1b' } : undefined}>
                  {formatCurrency(r.impostos_mes ?? 0)}
                </td>
                <td className={TD}>{formatCurrency(r.rentabilidade_total)}</td>
                <td className={TD}>{(r.rentabilidade_pct * 100).toFixed(2)}%</td>
                <td className={TD}>{r.cdi_mes_pct != null ? `${(r.cdi_mes_pct * 100).toFixed(2)}%` : '—'}</td>
                <td className={TD}>{formatCurrency(r.pl_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <td className="px-3 py-2 text-xs font-bold">Total</td>
              <td className={`${TD} font-bold`}>{formatCurrency(registros.reduce((s, r) => s + r.pl_inicial_total, 0))}</td>
              <td className={`${TD} font-bold`}>{formatCurrency(registros.reduce((s, r) => s + nnmExibido(r), 0))}</td>
              <td className={`${TD} font-bold`} style={{ color: '#991b1b' }}>
                {formatCurrency(registros.reduce((s, r) => s + (r.impostos_mes ?? 0), 0))}
              </td>
              <td className={`${TD} font-bold`}>{formatCurrency(registros.reduce((s, r) => s + r.rentabilidade_total, 0))}</td>
              <td className={`${TD} font-bold`}>—</td>
              <td className={`${TD} font-bold`}>—</td>
              <td className={`${TD} font-bold`}>{formatCurrency(registros[registros.length - 1]?.pl_total ?? 0)}</td>
            </tr>
          </tfoot>
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
