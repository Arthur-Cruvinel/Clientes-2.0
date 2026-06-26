// --- Aba Reajuste das Configurações ---
// Política GLOBAL de reajuste por volume excedente. Estes 3 parâmetros NÃO
// entram no cálculo do fee — alimentam apenas a CLÁUSULA escrita no documento
// de proposta (seção "Excedentes" das Condições Gerais). A redação derivada é
// exibida ao vivo (read-only) para o CFO conferir o texto que vai ao cliente.

import { useState, useEffect } from 'react';
import type { Parametros } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  parametros: Parametros;
  onSalvar: (p: Parametros) => Promise<void>;
  salvando: boolean;
}

export function TabReajuste({ parametros, onSalvar, salvando }: Props) {
  const [tolerancia, setTolerancia] = useState(parametros.tolerancia_volume_pct);
  const [periodicidade, setPeriodicidade] = useState(parametros.periodicidade_medicao_meses);
  const [valorFaixa, setValorFaixa] = useState(parametros.valor_faixa_excedente);

  useEffect(() => {
    setTolerancia(parametros.tolerancia_volume_pct);
    setPeriodicidade(parametros.periodicidade_medicao_meses);
    setValorFaixa(parametros.valor_faixa_excedente);
  }, [parametros]);

  // Redação derivada ao vivo — espelha exatamente a cláusula montada no template.
  const clausula = `Tolerância de ${tolerancia.toLocaleString('pt-BR')}% sobre o volume contratado. Acima disso, acréscimo de ${formatCurrency(valorFaixa)} a cada ${tolerancia.toLocaleString('pt-BR')}% adicionais. Medição a cada ${periodicidade.toLocaleString('pt-BR')} meses, não retroativo.`;

  const salvar = () => {
    if (!confirm('Estes parâmetros são GLOBAIS — definem a cláusula de reajuste por volume excedente em TODAS as propostas novas. Confirmar?')) return;
    onSalvar({
      ...parametros,
      tolerancia_volume_pct: tolerancia,
      periodicidade_medicao_meses: periodicidade,
      valor_faixa_excedente: valorFaixa,
    });
  };

  const INP = 'rounded-lg px-3 py-2 text-sm w-40';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs mb-4" style={{ color: '#6b6b8a' }}>
          Política de <strong>reajuste por volume excedente</strong> escrita na proposta (seção
          Excedentes das Condições Gerais). <strong>Não afeta o cálculo do fee</strong> — é só a
          redação contratual. A volumetria contratada (pagamentos, movimentações, recebíveis) é a
          definida em cada proposta.
        </p>

        <div className="space-y-2">
          <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Tolerância sobre o volume (%)</label>
          <input type="number" step="1" value={tolerancia} onChange={e => setTolerancia(Number(e.target.value))} className={INP} style={BRD} />
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Padrão: 20%. Folga sobre o volume contratado antes de qualquer reajuste.</p>
        </div>

        <div className="space-y-2 mt-4">
          <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Valor por faixa adicional (R$)</label>
          <input type="number" step="0.01" value={valorFaixa} onChange={e => setValorFaixa(Number(e.target.value))} className={INP} style={BRD} />
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Padrão: R$ 500. Acréscimo ao fee a cada faixa de {tolerancia.toLocaleString('pt-BR')}% adicional de volume.</p>
        </div>

        <div className="space-y-2 mt-4">
          <label className="block text-sm font-medium" style={{ color: '#160F41' }}>Periodicidade de medição (meses)</label>
          <input type="number" step="1" value={periodicidade} onChange={e => setPeriodicidade(Number(e.target.value))} className={INP} style={BRD} />
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Padrão: 3 meses (trimestral). A medição não é retroativa.</p>
        </div>
      </div>

      {/* Cláusula derivada read-only — recalcula ao vivo conforme edita os 3 campos. */}
      <div className="rounded-lg border p-4" style={{ borderColor: '#0065FF', backgroundColor: '#f0f6ff' }}>
        <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Cláusula no documento (derivada)</p>
        <p className="text-sm mt-1" style={{ color: '#160F41' }}>{clausula}</p>
      </div>

      <button disabled={salvando} onClick={salvar}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
