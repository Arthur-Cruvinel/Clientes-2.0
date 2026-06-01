// --- Preview da tabela multi-período (import onshore) ---

import { AlertTriangle } from 'lucide-react';
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

// NNM exibido = aporte CHEIO (= B − C, inclui a abertura). Regra de mês de
// entrada: o tombamento de abertura é informação PARALELA (nnm_linha_abertura),
// NÃO sai do NNM. Coerente com salvarMultiPeriodo e pickR (mês de entrada).
function nnmExibido(r: RegistroMensal): number {
  return r.aporte_mes_total;
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
            {registros.map((r, i) => {
              const corrigido = r._corrigido_por_identidade === true;
              const quebrado = r._encadeamento_quebrado === true;
              const tooltipCorrecao = corrigido
                ? `NNM ajustado pela identidade contábil. Valor lido na importação: `
                  + `${formatCurrency(r._aporte_original_llm ?? 0)}. Valor corrigido: `
                  + `${formatCurrency(r.aporte_mes_total)}. Confira antes de salvar.`
                : undefined;
              const tooltipEncadeamento = quebrado
                ? `AUM inicial (${formatCurrency(r.pl_inicial_total)}) não bate com o AUM final `
                  + `do mês anterior (${formatCurrency(r._pl_inicial_esperado ?? 0)}). Pode ser gap de `
                  + `meses, movimentação entre contas ou leitura suspeita. O NNM NÃO foi alterado por isso — confira.`
                : undefined;
              // Cor da linha: encadeamento quebrado (vermelho claro) tem prioridade
              // sobre correção por identidade (âmbar).
              const bgLinha = quebrado ? '#fee2e2' : corrigido ? '#fef3c7' : undefined;
              return (
              <tr key={i} style={bgLinha ? { backgroundColor: bgLinha } : undefined}>
                <td className="px-3 py-2 text-xs font-medium">
                  {corrigido && (
                    <AlertTriangle size={12} className="inline mr-1 align-text-bottom" style={{ color: '#d97706' }} />
                  )}
                  {MESES[r.mes - 1]}/{r.ano}
                </td>
                <td className={TD} title={tooltipEncadeamento}
                  style={quebrado ? { color: '#b91c1c', fontWeight: 600, cursor: 'help' } : undefined}>
                  {quebrado && (
                    <AlertTriangle size={12} className="inline mr-1 align-text-bottom" style={{ color: '#dc2626' }} />
                  )}
                  {formatCurrency(r.pl_inicial_total)}
                </td>
                <td className={TD} title={tooltipCorrecao}
                  style={corrigido ? { color: '#b45309', fontWeight: 600, cursor: 'help' } : undefined}>
                  {formatCurrency(nnmExibido(r))}
                  {corrigido && ' ⚠'}
                </td>
                <td className={TD} style={(r.impostos_mes ?? 0) > 0 ? { color: '#991b1b' } : undefined}>
                  {formatCurrency(r.impostos_mes ?? 0)}
                </td>
                <td className={TD}>{formatCurrency(r.rentabilidade_total)}</td>
                <td className={TD}>{(r.rentabilidade_pct * 100).toFixed(2)}%</td>
                <td className={TD}>{r.cdi_mes_pct != null ? `${(r.cdi_mes_pct * 100).toFixed(2)}%` : '—'}</td>
                <td className={TD}>{formatCurrency(r.pl_total)}</td>
              </tr>
              );
            })}
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
