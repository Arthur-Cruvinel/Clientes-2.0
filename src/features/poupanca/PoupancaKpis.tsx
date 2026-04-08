// --- KPIs do módulo Poupança ---

import { KpiCard } from '../../components/ui/KpiCard';
import { formatCurrency } from '../../utils/formatters';
import type { TotaisPoupanca } from './usePoupanca';

interface Props {
  totais: TotaisPoupanca;
  mesInicio: number;
  anoInicio: number;
  mesFim: number;
  anoFim: number;
}

export function PoupancaKpis({ totais, mesInicio, anoInicio, mesFim, anoFim }: Props) {
  const mesUnico = mesInicio === mesFim && anoInicio === anoFim;
  const labelNNM = mesUnico ? 'NNM do Mês' : 'NNM do Período';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        titulo="AUM Total"
        valor={formatCurrency(totais.pl_total, true)}
        subtitulo="Onshore + Offshore (BRL)"
      />
      <KpiCard
        titulo={labelNNM}
        valor={formatCurrency(totais.nnm_mes, true)}
        cor={totais.nnm_mes >= 0 ? 'text-green-600' : 'text-red-600'}
        subtitulo={totais.tombamento_total > 0
          ? `Poupança líquida: ${formatCurrency(totais.nnm_poupanca_liquida_total, true)}`
          : undefined}
      />
      <KpiCard
        titulo="Rent. Média Ponderada"
        valor={`${(totais.rentabilidade_media * 100).toFixed(2)}%`}
      />
      <KpiCard
        titulo="Clientes Poupando"
        valor={`${totais.clientes_poupando} de ${totais.total_clientes}`}
        subtitulo={totais.total_clientes > 0
          ? `${((totais.clientes_poupando / totais.total_clientes) * 100).toFixed(0)}%`
          : undefined}
      />
    </div>
  );
}
