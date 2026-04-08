// --- Tela de Configurações com abas internas ---

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useConfiguracoes } from './useConfiguracoes';
import { TabCustos } from './TabCustos';
import { TabRebate } from './TabRebate';
import { TabPacotes } from './TabPacotes';

const ABAS = [
  { id: 'custos', label: 'Custos Diretos' },
  { id: 'rebate', label: 'Rebate' },
  { id: 'pacotes', label: 'Pacotes de Serviço' },
] as const;

type AbaId = (typeof ABAS)[number]['id'];

export function Configuracoes() {
  const { parametros, salvar, salvando, toast } = useConfiguracoes();
  const [aba, setAba] = useState<AbaId>('custos');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
        <Settings size={20} /> Configurações
      </h2>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#f3f4f6' }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${aba === a.id ? 'bg-white shadow-sm' : ''}`}
            style={{ color: aba === a.id ? '#160F41' : '#6b6b8a' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#e2e2e8' }}>
        {aba === 'custos' && <TabCustos parametros={parametros} onSalvar={salvar} salvando={salvando} />}
        {aba === 'rebate' && <TabRebate parametros={parametros} onSalvar={salvar} salvando={salvando} />}
        {aba === 'pacotes' && <TabPacotes parametros={parametros} onSalvar={salvar} salvando={salvando} />}
      </div>

      {/* Toast */}
      {toast && (
        <div className="p-3 rounded-lg text-sm" style={{
          backgroundColor: toast.startsWith('Erro') ? '#fee2e2' : '#dcfce7',
          color: toast.startsWith('Erro') ? '#991b1b' : '#166534',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
