// --- Aba Imóveis — listagem + CRUD com modal detalhado ---

import { useState } from 'react';
import { Plus, Pencil, Trash2, Home } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import type { Imovel, TipoImovel } from '../../../types';
import { ImovelModal } from './ImovelModal';

interface Props { items: Imovel[]; onSalvar: (item: Imovel) => Promise<void>; onExcluir: (id: string) => Promise<void>; loading: boolean }

const LABEL_PADRAO: Record<string, string> = { simples: 'Simples', medio: 'Médio', alto: 'Alto', luxo: 'Luxo' };
const LABEL_USO: Record<string, string> = { proprio: 'Próprio', alugado: 'Alugado', vazio: 'Vazio', temporada: 'Temporada' };

function vazio(): Imovel { return { descricao: '', uf: 'SP', tipo: 'residencial' as TipoImovel, valor_mercado: 0 }; }

export function PatrimonioImoveis({ items, onSalvar, onExcluir, loading }: Props) {
  const [modal, setModal] = useState<Imovel | null>(null);

  if (loading) return <div className="py-8 text-center text-sm" style={{ color: '#6b6b8a' }}>Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>Imóveis</h4>
        <button onClick={() => setModal(vazio())} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12">
          <Home size={40} className="mx-auto" style={{ color: '#e2e2e8' }} />
          <p className="text-sm mt-2" style={{ color: '#6b6b8a' }}>Nenhum imóvel cadastrado</p>
          <button onClick={() => setModal(vazio())} className="mt-3 text-xs font-medium" style={{ color: '#0065FF' }}>
            Adicionar primeiro imóvel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map(i => (
          <div key={i.id} className="rounded-lg border p-4 hover:shadow-md transition-shadow" style={{ borderColor: '#e2e2e8' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-purple-100" style={{ color: '#7c3aed' }}>{i.uf}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100" style={{ color: '#6b6b8a' }}>{i.tipo}</span>
                  {i.padrao_acabamento && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50" style={{ color: '#1e40af' }}>{LABEL_PADRAO[i.padrao_acabamento]}</span>}
                  {i.uso_atual && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50" style={{ color: '#166534' }}>{LABEL_USO[i.uso_atual]}</span>}
                  {i.metodo_estimativa_imovel === 'claude_ai' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100" style={{ color: '#7c3aed' }}>IA</span>}
                </div>
                <p className="text-xs font-medium truncate" style={{ color: '#160F41' }}>{i.descricao}</p>
                {i.cidade && <p className="text-[10px]" style={{ color: '#6b6b8a' }}>{i.bairro ? `${i.bairro}, ` : ''}{i.cidade} - {i.uf}</p>}
                <p className="text-lg font-bold" style={{ color: '#7c3aed' }}>{formatCurrency(i.valor_mercado)}</p>
                <div className="flex gap-3 text-[10px]" style={{ color: '#6b6b8a' }}>
                  {i.area_total_m2 && <span>{i.area_total_m2} m²</span>}
                  {i.quartos && <span>{i.quartos} qts</span>}
                  {i.vagas_garagem && <span>{i.vagas_garagem} vaga{i.vagas_garagem > 1 ? 's' : ''}</span>}
                </div>
                {i.valor_aluguel && <p className="text-xs mt-0.5" style={{ color: '#16a34a' }}>Aluguel: {formatCurrency(i.valor_aluguel)}/mês</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setModal({ ...i })} className="p-1 rounded hover:bg-gray-100"><Pencil size={13} style={{ color: '#6b6b8a' }} /></button>
                <button onClick={() => i.id && confirm('Excluir imóvel?') && onExcluir(i.id)} className="p-1 rounded hover:bg-red-50"><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && <ImovelModal imovel={modal} onSalvar={onSalvar} onFechar={() => setModal(null)} />}
    </div>
  );
}
