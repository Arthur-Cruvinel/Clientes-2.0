// --- Seção 3 do módulo Capacidade: absorção por pacote + simulador ---
import { useMemo, useState } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { LABEL_FUNCAO, type PacoteCapacidade, type SimulacaoResultado } from './useCapacidade';
import type { FuncaoAlocacao } from '../../types';

type FuncaoAlocacaoNovas = Partial<Record<FuncaoAlocacao, number>>;

interface Props {
  absorcao: PacoteCapacidade[];
  simular: (novas: Partial<Record<FuncaoAlocacao, number>>) => SimulacaoResultado;
}

function CardPacote({ p, comparado }: { p: PacoteCapacidade; comparado?: number }) {
  const ganho = comparado != null ? comparado - p.capacidade : 0;
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: '#e2e2e8' }}>
      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b6b8a' }}>{p.pacote}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: '#160F41' }}>
        {p.capacidade}
        {comparado != null && ganho > 0 && <span className="text-xs font-semibold ml-1" style={{ color: '#16a34a' }}>→ {comparado} (+{ganho})</span>}
      </p>
      <p className="text-[11px]" style={{ color: '#9ca3af' }}>clientes novos</p>
      {p.gargalo && (
        <p className="text-[10px] mt-1" style={{ color: '#ea580c' }}>Gargalo: {LABEL_FUNCAO[p.gargalo]}</p>
      )}
    </div>
  );
}

export function CapacidadeAbsorcao({ absorcao, simular }: Props) {
  const [novas, setNovas] = useState<FuncaoAlocacaoNovas>({});
  const totalNovas = FUNCOES_ALOCACAO.reduce((s, f) => s + (novas[f] ?? 0), 0);
  const sim = useMemo(() => (totalNovas > 0 ? simular(novas) : null), [novas, totalNovas, simular]);
  const capSimPorPacote = useMemo(() => {
    const m: Record<string, number> = {};
    if (sim) for (const p of sim.porPacote) m[p.pacote] = p.capacidade;
    return m;
  }, [sim]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>Capacidade de absorção por pacote</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {absorcao.map(p => <CardPacote key={p.pacote} p={p} comparado={sim ? capSimPorPacote[p.pacote] : undefined} />)}
      </div>

      <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
        <p className="text-xs font-semibold" style={{ color: '#160F41' }}>Simulador de contratação</p>
        <p className="text-[11px]" style={{ color: '#6b6b8a' }}>Quantas contratações por função (100% alocável) e o impacto na capacidade.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {FUNCOES_ALOCACAO.map(f => (
            <label key={f} className="text-[11px]" style={{ color: '#6b6b8a' }}>
              {LABEL_FUNCAO[f]}
              <input type="number" min={0} step={1} value={novas[f] ?? 0}
                onChange={e => setNovas(prev => ({ ...prev, [f]: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full mt-0.5 rounded px-2 py-1 text-xs" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
            </label>
          ))}
        </div>
        {sim && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs pt-1" style={{ color: '#160F41' }}>
            <span><strong>{sim.totalContratacoes}</strong> contratação(ões)</span>
            <span>Custo mensal estimado: <strong style={{ color: '#dc2626' }}>{formatCurrency(sim.custoEstimadoMensal)}</strong></span>
            <span style={{ color: '#9ca3af' }}>(anual ≈ {formatCurrency(sim.custoEstimadoMensal * 12)})</span>
          </div>
        )}
      </div>
    </div>
  );
}
