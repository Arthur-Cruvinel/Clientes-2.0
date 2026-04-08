// --- Visão agregada por banker — cards de ranking + tabela comparativa ---

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { RegistroPoupanca } from '../../../types';
import { useBanker } from './useBanker';
import type { DadosBanker, ClienteComBanker } from './useBanker';
import { BankerCard } from './BankerCard';
import { BankerTabela } from './BankerTabela';
import { BankerDetalhe } from './BankerDetalhe';

interface BankerVisaoProps {
  registrosPorCliente: Map<string, RegistroPoupanca[]>;
  clientesComBanker: ClienteComBanker[];
  mesInicio: number; anoInicio: number;
  mesFim: number; anoFim: number;
}

type Criterio = 'aum' | 'nnm' | 'rentabilidade';
const TABS: { id: Criterio; icon: string; label: string }[] = [
  { id: 'aum', icon: '📊', label: 'Por AUM' },
  { id: 'nnm', icon: '📈', label: 'Por Captação' },
  { id: 'rentabilidade', icon: '💰', label: 'Por Rentabilidade' },
];

export function BankerVisao({ registrosPorCliente, clientesComBanker, mesInicio, anoInicio, mesFim, anoFim }: BankerVisaoProps) {
  const { bankerOrdenados, loading, criterioOrdenacao, setCriterioOrdenacao } = useBanker(
    registrosPorCliente, clientesComBanker, mesInicio, anoInicio, mesFim, anoFim,
  );
  const [detalheBanker, setDetalheBanker] = useState<DadosBanker | null>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: '#160F41' }}>
        <Loader2 className="animate-spin" size={16} /> Carregando dados por banker...
      </div>
    );
  }

  if (bankerOrdenados.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-sm"
        style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
        Nenhum dado disponível para o período.
      </div>
    );
  }

  const top3 = bankerOrdenados.slice(0, 3);
  const demais = bankerOrdenados.slice(3);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>
          Performance por Banker
        </h3>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setCriterioOrdenacao(t.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                criterioOrdenacao === t.id ? 'bg-gradient-brand text-white' : ''
              }`}
              style={criterioOrdenacao !== t.id ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards — top 3 maiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {top3.map((b, i) => (
          <BankerCard key={b.nome} b={b} posicao={i} grande
            onClick={() => setDetalheBanker(b)} />
        ))}
      </div>

      {/* Cards — demais */}
      {demais.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {demais.map((b, i) => (
            <BankerCard key={b.nome} b={b} posicao={i + 3}
              onClick={() => setDetalheBanker(b)} />
          ))}
        </div>
      )}

      {/* Tabela comparativa */}
      <div>
        <h4 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
          Comparativo
        </h4>
        <BankerTabela bankers={bankerOrdenados} onClick={setDetalheBanker} />
      </div>

      {detalheBanker && (
        <BankerDetalhe banker={detalheBanker} registrosPorCliente={registrosPorCliente}
          mesInicio={mesInicio} anoInicio={anoInicio} mesFim={mesFim} anoFim={anoFim}
          onFechar={() => setDetalheBanker(null)} />
      )}
    </div>
  );
}
