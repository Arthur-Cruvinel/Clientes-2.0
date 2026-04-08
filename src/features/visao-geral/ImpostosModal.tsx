// --- Modal de detalhamento dos Impostos de um cliente ---
// Exibe a composição tributária conforme o regime ativo (Presumido ou Real).

import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { ALIQUOTAS } from '../../utils/constants';
import type { DadosCliente, RegimeTributario } from '../../types';

interface Props {
  cliente: DadosCliente;
  regime: RegimeTributario;
  onFechar: () => void;
}

const TH = 'px-3 py-2 text-xs font-bold uppercase tracking-wider text-left';
const TD = 'px-3 py-2 text-sm';

export function ImpostosModal({ cliente, regime, onFechar }: Props) {
  const fee = cliente.receita_fee_mensal;
  const receitaBruta = cliente.receita_bruta;

  // Impostos sobre faturamento — incidem sobre a receita bruta (fee)
  const aliqFat = ALIQUOTAS[regime].faturamento;
  const impostoFat = fee * aliqFat;

  // Impostos sobre lucro
  let aliqLucro: number;
  let baseLucro: number;
  let impostoLucro: number;
  let notaLucro: string | null = null;

  if (regime === 'presumido') {
    aliqLucro = ALIQUOTAS.presumido.lucro;
    baseLucro = fee;
    impostoLucro = fee * aliqLucro;
  } else {
    aliqLucro = ALIQUOTAS.real.lucro;
    baseLucro = cliente.ebitda;
    if (baseLucro <= 0) {
      impostoLucro = 0;
      notaLucro = 'Não incide — resultado negativo';
    } else {
      impostoLucro = baseLucro * aliqLucro;
    }
  }

  const total = impostoFat + impostoLucro;

  return (
    <Modal aberto onFechar={onFechar} titulo={`Impostos — ${cliente.nome_cliente}`}>
      <p className="text-xs font-medium mb-3 px-1" style={{ color: '#6b6b8a' }}>
        Regime: <span className="font-bold" style={{ color: '#160F41' }}>{regime === 'presumido' ? 'Lucro Presumido' : 'Lucro Real'}</span>
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              <th className={TH}>Imposto</th>
              <th className={TH}>Base de Cálculo</th>
              <th className={`${TH} text-right`}>Alíquota</th>
              <th className={`${TH} text-right`}>Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {/* PIS/COFINS/ISS */}
            <tr>
              <td className={TD}>PIS/COFINS/ISS</td>
              <td className={TD}>{formatCurrency(receitaBruta)}</td>
              <td className={`${TD} text-right`}>{formatPercent(aliqFat * 100, 2)}</td>
              <td className={`${TD} text-right font-medium`}>{formatCurrency(impostoFat)}</td>
            </tr>
            {/* IRPJ+CSLL */}
            <tr>
              <td className={TD}>
                IRPJ+CSLL
                {notaLucro && <span className="block text-[10px]" style={{ color: '#d97706' }}>{notaLucro}</span>}
              </td>
              <td className={TD}>
                {regime === 'presumido'
                  ? formatCurrency(baseLucro)
                  : <span>{formatCurrency(baseLucro)} <span className="text-[10px]" style={{ color: '#6b6b8a' }}>(lucro real)</span></span>
                }
              </td>
              <td className={`${TD} text-right`}>{formatPercent(aliqLucro * 100, 2)}</td>
              <td className={`${TD} text-right font-medium`}>{formatCurrency(impostoLucro)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <td colSpan={3} className={`${TD} font-bold`}>TOTAL</td>
              <td className={`${TD} text-right font-bold`}>{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}
