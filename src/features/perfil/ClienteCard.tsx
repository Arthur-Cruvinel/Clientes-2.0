// --- Card de cliente na lista lateral ---

import type { DadosCliente } from '../../types';

export const COR_PACOTE: Record<string, string> = {
  full: '#160F41', advanced: '#7c3aed', light: '#3b82f6', future: '#9ca3af', asset_only: '#d97706',
};

/** Rótulo curto do pacote para badge (asset_only → 'asset'). */
export function labelPacote(pacote: string): string {
  return pacote === 'asset_only' ? 'asset' : pacote;
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Formata 'YYYY-MM' → 'Mmm/AAAA'. Inválido vira string vazia. */
function formatarDataEntrada(d: string | undefined): string {
  if (!d) return '';
  const [a, m] = d.split('-').map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(m) || m < 1 || m > 12) return '';
  return `${MESES_LABEL[m - 1]}/${a}`;
}

interface Props {
  cliente: DadosCliente;
  selecionado: boolean;
  onClick: () => void;
}

export function ClienteCard({ cliente, selecionado, onClick }: Props) {
  const lucro = cliente.ebitda > 0;
  const entradaFmt = formatarDataEntrada(cliente.data_entrada);
  const tooltipPacote = entradaFmt
    ? `Pacote: ${cliente.pacote_servico} · Entrada: ${entradaFmt}`
    : `Pacote: ${cliente.pacote_servico}`;
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
            title={tooltipPacote}
            style={{ backgroundColor: COR_PACOTE[cliente.pacote_servico] ?? '#9ca3af' }}>
            {labelPacote(cliente.pacote_servico)}
          </span>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lucro ? '#16a34a' : '#dc2626' }} />
        </div>
      </div>
    </button>
  );
}
