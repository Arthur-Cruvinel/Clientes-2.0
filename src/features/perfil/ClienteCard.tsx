// --- Card de cliente na lista lateral ---

import type { DadosCliente } from '../../types';

const COR_PACOTE: Record<string, string> = {
  full: '#160F41', advanced: '#7c3aed', light: '#3b82f6', future: '#9ca3af', asset_only: '#d97706',
};

interface Props {
  cliente: DadosCliente;
  selecionado: boolean;
  onClick: () => void;
}

export function ClienteCard({ cliente, selecionado, onClick }: Props) {
  const lucro = cliente.ebitda > 0;
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors ${selecionado ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      style={{ borderLeft: selecionado ? '3px solid #0065FF' : '3px solid transparent' }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate" style={{ color: '#160F41', maxWidth: '70%' }}>
          {cliente.nome_cliente}
        </span>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
            style={{ backgroundColor: COR_PACOTE[cliente.pacote_servico] ?? '#9ca3af' }}>
            {cliente.pacote_servico === 'asset_only' ? 'asset' : cliente.pacote_servico}
          </span>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lucro ? '#16a34a' : '#dc2626' }} />
        </div>
      </div>
    </button>
  );
}
