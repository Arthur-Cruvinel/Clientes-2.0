// --- Barra de progresso NNM vs Meta (premium) ---

import { formatCurrency } from '../../utils/formatters';

interface Props {
  nnm: number;
  meta: number | null;              // meta do período (mensal × nMeses)
  metaMensal?: number | null;       // meta de 1 mês (para tooltip)
  tombamento?: boolean;             // true = só tombamento (badge especial)
  capacidade?: number | null;       // capacidade_poupanca_mensal declarada (pode ser < 0)
  semCapacidade?: boolean;          // flag sem_capacidade_poupanca
}

export function TabelaStatusBar({ nnm, meta, metaMensal, tombamento, capacidade, semCapacidade }: Props) {
  const temMeta = meta != null && meta > 0;
  const pctRaw = temMeta ? (nnm / meta!) * 100 : 0;
  const pctCapped = Math.min(Math.max(pctRaw, 0), 150);
  const pctLabel = temMeta ? Math.round(pctRaw) : 0;

  // Condição estrutural: capacidade declarada negativa → cliente queima caixa.
  // Sobrepõe o badge de NNM realizado (pode ter entrado dinheiro pontual).
  const queimando = capacidade != null && capacidade < 0;

  const grad = queimando
    ? 'linear-gradient(90deg, #991b1b, #7f1d1d)'  // vermelho escuro (burn)
    : nnm <= 0
    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
    : temMeta && nnm >= meta!
    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
    : temMeta
    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
    : 'linear-gradient(90deg, #22c55e, #16a34a)';

  const corTexto = queimando ? '#7f1d1d'
    : pctRaw >= 100 ? '#16a34a' : pctRaw > 0 ? '#ca8a04' : '#dc2626';
  const marcador100 = temMeta ? (100 / 150) * 100 : 0;
  const acimaMeta = nnm >= (meta ?? 0) && temMeta;

  // Tooltip detalhado com meta mensal e número de meses
  const nMeses = temMeta && metaMensal && metaMensal > 0
    ? Math.round(meta! / metaMensal) : null;
  const tituloBase = temMeta
    ? `NNM: ${formatCurrency(nnm)} | Meta período: ${formatCurrency(meta!)}` +
      (nMeses != null && metaMensal ? ` (${formatCurrency(metaMensal)} × ${nMeses} ${nMeses === 1 ? 'mês' : 'meses'})` : '') +
      ` | ${pctLabel}%`
    : `NNM: ${formatCurrency(nnm)} (sem meta)`;
  const titulo = queimando
    ? `${tituloBase} | Capacidade: ${formatCurrency(capacidade!)}/mês (queima estrutural)`
    : tituloBase;

  // Badge de status — ordem de prioridade:
  // 1. Só tombamento (mês especial)
  // 2. Capacidade < 0 → "Queimando" (condição estrutural)
  // 3. NNM liq ≤ 0 e flag sem_capacidade=false → "Sem NNM"
  // 4. NNM > 0 com meta atingida → "Acima da meta"
  // 5. NNM > 0 abaixo da meta → "Abaixo"
  // 6. NNM > 0 sem meta → "Positivo"
  const badge = tombamento
    ? 'Só tombamento'
    : queimando
    ? 'Queimando'
    : nnm <= 0 && !semCapacidade
    ? 'Sem NNM'
    : temMeta && nnm >= meta!
    ? 'Acima da meta'
    : temMeta
    ? 'Abaixo'
    : nnm > 0
    ? 'Positivo'
    : 'Sem NNM';

  const corTextoFinal = tombamento ? '#64748b' : corTexto;

  return (
    <div title={titulo} className="w-full">
      <div className="relative w-full rounded-full overflow-hidden" style={{ height: 10, backgroundColor: '#e2e8f0' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pctCapped / 1.5}%`, background: grad }} />
        {temMeta && (
          <div className="absolute top-0 h-full"
            style={{
              left: `${marcador100}%`, width: 2,
              backgroundColor: acimaMeta ? '#f59e0b' : '#ffffff',
              boxShadow: acimaMeta ? '0 0 4px rgba(245,158,11,0.8)' : 'none',
            }} />
        )}
      </div>
      <p className="mt-0.5 text-center" style={{ fontSize: 11, fontWeight: 700, color: corTextoFinal }}>
        {(tombamento || queimando) ? badge : temMeta ? `${pctLabel}%` : badge}
      </p>
    </div>
  );
}
