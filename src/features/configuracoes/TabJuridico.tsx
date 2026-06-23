// --- Aba Jurídico das Configurações ---
// Parâmetros GLOBAIS da precificação do jurídico consultivo (por demanda).
// custo_demanda = tempo × custo_hora × fator — derivado exibido ao vivo (read-only).
// N (demandas/mês) NÃO mora aqui: é por proposta, no Gerador de Propostas.

import { useState, useEffect } from 'react';
import type { Parametros } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  parametros: Parametros;
  onSalvar: (p: Parametros) => Promise<void>;
  salvando: boolean;
}

export function TabJuridico({ parametros, onSalvar, salvando }: Props) {
  const [tempo, setTempo] = useState(parametros.tempo_demanda_juridica_horas);
  const [custoHora, setCustoHora] = useState(parametros.custo_hora_juridico);
  const [fator, setFator] = useState(parametros.fator_demanda_juridica);

  useEffect(() => {
    setTempo(parametros.tempo_demanda_juridica_horas);
    setCustoHora(parametros.custo_hora_juridico);
    setFator(parametros.fator_demanda_juridica);
  }, [parametros]);

  // Derivado ao vivo — espelha exatamente a conta usada no fee da proposta.
  const custoDemanda = tempo * custoHora * fator;

  const salvar = () => {
    if (!confirm('Estes parâmetros são GLOBAIS — afetam o custo do jurídico consultivo em TODAS as propostas novas. Confirmar?')) return;
    onSalvar({
      ...parametros,
      tempo_demanda_juridica_horas: tempo,
      custo_hora_juridico: custoHora,
      fator_demanda_juridica: fator,
    });
  };

  const INP = 'rounded-lg px-3 py-2 text-sm w-40';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs mb-4" style={{ color: '#6b6b8a' }}>
          Custo de uma demanda jurídica <strong>consultiva incluída</strong> = tempo × salário-hora ×
          fator. Entra no fee da proposta como custo direto (puxa overhead + imposto + margem).
          O número de demandas/mês (N) é definido <strong>por proposta</strong>, no Gerador de Propostas.
        </p>

        <div className="space-y-2">
          <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Tempo por demanda (horas)</label>
          <input type="number" step="0.1" value={tempo} onChange={e => setTempo(Number(e.target.value))} className={INP} style={BRD} />
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Padrão: 2,5h (1,5 analisar + 1 elaborar). Direcionar/monitorar escritório externo é extraordinário — não conta aqui.</p>
        </div>

        <div className="space-y-2 mt-4">
          <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Salário-hora do jurídico (R$)</label>
          <input type="number" step="0.01" value={custoHora} onChange={e => setCustoHora(Number(e.target.value))} className={INP} style={BRD} />
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Salário-hora cru (média da planilha de origem). É sobre ele que incide o overhead.</p>
        </div>

        <div className="space-y-2 mt-4">
          <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Fator de calibração</label>
          <input type="number" step="0.05" value={fator} onChange={e => setFator(Number(e.target.value))} className={INP} style={BRD} />
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Multiplicador de ajuste fino (padrão 1,0).</p>
        </div>
      </div>

      {/* Derivado read-only — recalcula ao vivo conforme edita os 3 campos. */}
      <div className="rounded-lg border p-4" style={{ borderColor: '#0065FF', backgroundColor: '#f0f6ff' }}>
        <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Custo por demanda (derivado)</p>
        <p className="text-2xl font-bold" style={{ color: '#160F41' }}>{formatCurrency(custoDemanda)}</p>
        <p className="text-[11px] mt-1" style={{ color: '#6b6b8a' }}>
          {tempo.toLocaleString('pt-BR')}h × {formatCurrency(custoHora)} × {fator.toLocaleString('pt-BR')}
        </p>
      </div>

      <button disabled={salvando} onClick={salvar}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
