// --- Modal de detalhe do banker — métricas, gráfico AUM, tabela clientes ---

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { RegistroPoupanca } from '../../../types';
import type { DadosBanker } from './useBanker';
import { BankerDetalheMetricas } from './BankerDetalheMetricas';
import { BankerDetalheChart } from './BankerDetalheChart';
import { BankerClienteTabela } from './BankerClienteTabela';
import { PoupancaClienteDetalhe } from '../PoupancaClienteDetalhe';

interface BankerDetalheProps {
  banker: DadosBanker;
  registrosPorCliente: Map<string, RegistroPoupanca[]>;
  mesInicio: number; anoInicio: number;
  mesFim: number; anoFim: number;
  onFechar: () => void;
}

const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function BankerDetalhe({
  banker, registrosPorCliente, mesInicio, anoInicio, mesFim, anoFim, onFechar,
}: BankerDetalheProps) {
  const [clienteDetalhe, setClienteDetalhe] = useState<RegistroPoupanca[]>([]);
  const nMeses = (anoFim * 12 + mesFim) - (anoInicio * 12 + mesInicio) + 1;
  const periodoLabel = `${ML[mesInicio - 1]}/${anoInicio} — ${ML[mesFim - 1]}/${anoFim}`;

  // Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-white shadow-2xl ring-1 ring-black/5 w-[94vw] max-w-[1400px] mx-4 max-h-[94vh] flex flex-col"
        style={{ borderRadius: 16 }}>

        {/* HEADER */}
        <div className="flex items-center justify-between shrink-0"
          style={{ backgroundColor: '#160F41', borderRadius: '16px 16px 0 0', padding: '20px 28px' }}>
          <div>
            <h2 className="text-white" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {banker.nome}
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {banker.totalClientes} cliente{banker.totalClientes !== 1 ? 's' : ''} • {periodoLabel}
            </p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1 transition-colors hover:bg-white/10">
            <X size={20} style={{ color: '#fff' }} />
          </button>
        </div>

        {/* BODY — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Métricas */}
          <BankerDetalheMetricas b={banker} nMeses={nMeses} />

          {/* Gráfico AUM */}
          <BankerDetalheChart nomes={banker.clientes} registrosPorCliente={registrosPorCliente} />

          {/* Tabela de clientes */}
          <div className="mx-6 mt-4 mb-6">
            <h4 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
              Clientes — {banker.nome}
            </h4>
            <BankerClienteTabela
              nomes={banker.clientes}
              registrosPorCliente={registrosPorCliente}
              nMeses={nMeses}
              onClienteClick={setClienteDetalhe}
            />
          </div>
        </div>
      </div>

      {/* Modal de detalhe do cliente (dentro de modal) */}
      {clienteDetalhe.length > 0 && (
        <PoupancaClienteDetalhe
          registros={clienteDetalhe}
          onFechar={() => setClienteDetalhe([])}
        />
      )}
    </div>
  );
}
