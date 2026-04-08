// --- Preview dos dados patrimoniais parseados ---

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { PatrimonioParseado } from '../patrimonio/parsePatrimonioExcel';

interface Props { clientes: PatrimonioParseado[] }

const CATS = [
  { key: 'investimentos', label: 'Investimentos' },
  { key: 'imoveis', label: 'Imóveis' },
  { key: 'veiculos', label: 'Veículos' },
  { key: 'outros_bens', label: 'Outros' },
  { key: 'passivos', label: 'Passivos' },
] as const;

const TH = 'px-2 py-1 text-[10px] font-bold uppercase text-left';
const TD = 'px-2 py-1 text-[11px]';

export function PatrimonioImportPreview({ clientes }: Props) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [catAtiva, setCatAtiva] = useState<string>('investimentos');

  return (
    <div className="space-y-2">
      {clientes.map(c => {
        const totalAtivos = c.investimentos.length + c.imoveis.length + c.veiculos.length + c.outros_bens.length;
        const totalPassivos = c.passivos.length;
        const expandido = aberto === c.slug;
        const dados = (c as unknown as Record<string, unknown[]>)[catAtiva] as unknown[] ?? [];

        return (
          <div key={c.slug} className="rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setAberto(expandido ? null : c.slug)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
              {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="text-xs font-semibold" style={{ color: '#160F41' }}>{c.cliente}</span>
              <span className="ml-auto text-[10px]" style={{ color: '#6b6b8a' }}>
                {totalAtivos} ativo{totalAtivos !== 1 ? 's' : ''}, {totalPassivos} passivo{totalPassivos !== 1 ? 's' : ''}
              </span>
            </button>

            {expandido && (
              <div className="px-4 pb-3 space-y-2">
                <div className="flex gap-1 rounded p-0.5" style={{ backgroundColor: '#f3f4f6' }}>
                  {CATS.map(cat => {
                    const n = ((c as unknown as Record<string, unknown[]>)[cat.key] ?? []).length;
                    return (
                      <button key={cat.key} onClick={() => setCatAtiva(cat.key)}
                        className={`px-2 py-1 rounded text-[10px] font-medium ${catAtiva === cat.key ? 'bg-white shadow-sm' : ''}`}
                        style={{ color: catAtiva === cat.key ? '#160F41' : '#6b6b8a' }}>
                        {cat.label} ({n})
                      </button>
                    );
                  })}
                </div>
                {dados.length === 0 && <p className="text-xs py-2" style={{ color: '#94a3b8' }}>Nenhum registro</p>}
                {dados.length > 0 && (
                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="min-w-full">
                      <thead style={{ backgroundColor: '#f9f9fb' }}>
                        <tr>{Object.keys(dados[0] as object).filter(k => k !== 'id').slice(0, 6).map(k =>
                          <th key={k} className={TH}>{k}</th>
                        )}</tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                        {dados.map((row, i) => (
                          <tr key={i}>{Object.entries(row as object).filter(([k]) => k !== 'id').slice(0, 6).map(([k, v]) =>
                            <td key={k} className={TD}>
                              {typeof v === 'number' && v > 1000 ? formatCurrency(v) : String(v ?? '—')}
                            </td>
                          )}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
