// --- Aba Cenários — Degrau 1: ponto de equilíbrio fee/rebate da firma ---
// Tela de LEITURA. Consome dadosPeriodo via useCenarios (mesma fonte da Visão
// Geral). Reativa ao período selecionado; sem persistência; não recalcula o motor.

import { useCenarios, type CenarioEquilibrio } from './useCenarios';
import { KpiCard } from '../../components/ui/KpiCard';
import { formatCurrency, formatPercent } from '../../utils/formatters';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function periodoLabel(p: string): string {
  if (!p) return '';
  const [ano, mes] = p.split('-');
  const i = Number(mes) - 1;
  return i >= 0 && i < 12 ? `${MESES[i]}/${ano}` : p;
}

export function Cenarios() {
  const { dados, loading, periodoSelecionado } = useCenarios();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold" style={{ color: '#160F41' }}>
          Cenários — Ponto de equilíbrio
          {periodoSelecionado && (
            <span className="ml-2 text-base font-normal" style={{ color: '#6b6b8a' }}>
              — {periodoLabel(periodoSelecionado)}
            </span>
          )}
        </h2>
      </div>

      {loading ? (
        <div className="rounded-lg border p-8 text-center" style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
          Carregando dados...
        </div>
      ) : !dados ? (
        <div className="rounded-lg border p-8 text-center" style={{ borderColor: '#fbbf24', backgroundColor: '#fffbeb', color: '#92400e' }}>
          Nenhum dado encontrado para o período selecionado.
        </div>
      ) : (
        <>
          {/* Estado atual — espelha os agregados do motor (dadosPeriodo). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard titulo="Custo Total da Firma" valor={formatCurrency(dados.custoTotal)}
              subtitulo="direto + dedicado + indireto (todos os clientes)" />
            <KpiCard titulo="Receita de Fee" valor={formatCurrency(dados.receitaFee)}
              subtitulo={`Cobre ${formatPercent(dados.soFee.coberturaPct)} do custo`} />
            <KpiCard titulo="Receita de Rebate" valor={formatCurrency(dados.receitaRebate)}
              subtitulo={`Cobre ${formatPercent(dados.soRebate.coberturaPct)} do custo`} />
            <KpiCard titulo="Receita Bruta" valor={formatCurrency(dados.receitaBruta)}
              subtitulo={`Fee + rebate cobrem ${formatPercent(dados.coberturaTotalPct)} do custo`}
              cor={dados.coberturaTotalPct >= 100 ? 'text-green-700' : 'text-gray-900'} />
          </div>

          {/* Os dois equilíbrios. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PainelEquilibrio titulo="Equilíbrio só com fee" receitaLabel="fee" outraLabel="rebate"
              outraReceita={dados.receitaRebate} cen={dados.soFee} />
            <PainelEquilibrio titulo="Equilíbrio só com rebate" receitaLabel="rebate" outraLabel="fee"
              outraReceita={dados.receitaFee} cen={dados.soRebate} />
          </div>

          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Leitura direta da saída do motor financeiro do período (mesma fonte da Visão Geral) —
            sem recálculo nem persistência. Equilíbrio = receita necessária para igualar o custo total.
          </p>
        </>
      )}
    </div>
  );
}

function PainelEquilibrio({ titulo, receitaLabel, outraLabel, outraReceita, cen }: {
  titulo: string;
  receitaLabel: string;
  outraLabel: string;
  outraReceita: number;
  cen: CenarioEquilibrio;
}) {
  const VERDE = '#16a34a', VERMELHO = '#dc2626', AZUL = '#160F41', CINZA = '#6b6b8a';
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-3">
      <p className="text-sm font-bold" style={{ color: AZUL }}>{titulo}</p>

      {cen.sePaga ? (
        <>
          <p className="text-2xl font-bold" style={{ color: VERDE }}>
            +{formatCurrency(cen.folga)}
            <span className="text-sm font-normal" style={{ color: CINZA }}> /mês de folga</span>
          </p>
          <p className="text-sm leading-relaxed" style={{ color: AZUL }}>
            A firma <strong>já se paga só com {receitaLabel}</strong>. O {receitaLabel} cobre{' '}
            {formatPercent(cen.coberturaPct)} do custo, com folga de {formatCurrency(cen.folga)}/mês acima
            do custo total. Nesse cenário o <strong>{outraLabel} ({formatCurrency(outraReceita)}) é 100%
            incremental</strong>.
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold" style={{ color: VERMELHO }}>
            {formatCurrency(cen.gap)}
            <span className="text-sm font-normal" style={{ color: CINZA }}> /mês a mais de {receitaLabel}</span>
            {cen.pctAumento != null && (
              <span className="text-base font-bold" style={{ color: VERMELHO }}> (+{formatPercent(cen.pctAumento)})</span>
            )}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: AZUL }}>
            Para a firma se pagar só com {receitaLabel}, o {receitaLabel} precisa subir{' '}
            <strong>
              {formatCurrency(cen.gap)}/mês{cen.pctAumento != null ? ` (+${formatPercent(cen.pctAumento)})` : ''}
            </strong>
            . Hoje o {receitaLabel} cobre {formatPercent(cen.coberturaPct)} do custo; ao atingir o
            equilíbrio, o <strong>{outraLabel} seria 100% incremental</strong>.
            {cen.pctAumento == null && (
              <span style={{ color: CINZA }}> (Receita de {receitaLabel} atual é R$ 0 — sem base para % de aumento.)</span>
            )}
          </p>
        </>
      )}
    </div>
  );
}
