// --- Módulo Patrimônio — wrapper com seletor de cliente + abas ---

import { useState, useEffect, useRef } from 'react';
import { Search, BarChart2, Briefcase, Home, Car, Gem, TrendingDown, Users, ChevronUp, ChevronDown } from 'lucide-react';
import type { Cliente } from '../../types';
import { slug } from '../../utils/slug';
import { usePatrimonio } from './usePatrimonio';
import { usePatrimonioCrud } from './usePatrimonioCrud';
import { PatrimonioVisaoGeral } from './visao-geral/PatrimonioVisaoGeral';
import { PatrimonioInvestimentos } from './investimentos/PatrimonioInvestimentos';
import { PatrimonioImoveis } from './imoveis/PatrimonioImoveis';
import { PatrimonioVeiculos } from './veiculos/PatrimonioVeiculos';
import { PatrimonioOutrosBens } from './outros-bens/PatrimonioOutrosBens';
import { PatrimonioPassivos } from './passivos/PatrimonioPassivos';

const ABAS = [
  { id: 'visao', icon: BarChart2, label: 'Visão Geral' },
  { id: 'invest', icon: Briefcase, label: 'Investimentos' },
  { id: 'imoveis', icon: Home, label: 'Imóveis' },
  { id: 'veiculos', icon: Car, label: 'Veículos' },
  { id: 'outros', icon: Gem, label: 'Outros Bens' },
  { id: 'passivos', icon: TrendingDown, label: 'Passivos' },
] as const;
type AbaId = (typeof ABAS)[number]['id'];

export function Patrimonio() {
  const { clientes, clienteSelecionado, selecionar, busca, setBusca, modoConsolidado, irParaConsolidado, navegarCliente, loading } = usePatrimonio();
  const [aba, setAba] = useState<AbaId>('visao');
  const c = clienteSelecionado;
  const itemRef = useRef<HTMLButtonElement>(null);

  // Teclado: ArrowUp/ArrowDown para navegar clientes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); navegarCliente('anterior'); }
      if (e.key === 'ArrowDown') { e.preventDefault(); navegarCliente('proximo'); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navegarCliente]);

  // Scroll para o cliente selecionado
  useEffect(() => {
    itemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [c?.nome_cliente]);
  const nome = modoConsolidado ? 'Consolidado — Todos os Clientes' : c?.nome_cliente ?? '';
  const slugCliente = c?.nome_cliente ? slug(c.nome_cliente) : null;
  const crud = usePatrimonioCrud(slugCliente, c?.nome_cliente ?? null);

  if (loading) return <div className="p-8 text-center" style={{ color: '#6b6b8a' }}>Carregando...</div>;

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Coluna esquerda — seletor de cliente */}
      <div className="w-[280px] flex-shrink-0 rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: '#e2e2e8' }}>
        <div className="p-3 border-b" style={{ borderColor: '#e2e2e8' }}>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ border: '1px solid #e2e2e8' }}>
            <Search size={14} style={{ color: '#6b6b8a' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente..."
              className="text-sm w-full outline-none bg-transparent" style={{ color: '#160F41' }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: '#e2e2e8' }}>
          {clientes.map((cli: Cliente) => {
            const ativo = c?.nome_cliente === cli.nome_cliente && !modoConsolidado;
            return (
              <button key={cli.nome_cliente} onClick={() => selecionar(cli)}
                ref={ativo ? itemRef : undefined}
                className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${ativo ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}`}
                style={{ color: '#160F41' }}>
                {cli.nome_cliente}
              </button>
            );
          })}
          {clientes.length === 0 && <p className="p-4 text-sm text-center" style={{ color: '#6b6b8a' }}>Nenhum cliente</p>}
        </div>
        <div className="p-3 border-t" style={{ borderColor: '#e2e2e8' }}>
          <button onClick={irParaConsolidado}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${modoConsolidado ? 'bg-gradient-brand text-white' : ''}`}
            style={!modoConsolidado ? { border: '1px solid #e2e2e8', color: '#6b6b8a' } : undefined}>
            <Users size={13} /> Visão Consolidada
          </button>
        </div>
      </div>

      {/* Coluna direita — conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!c && !modoConsolidado ? (
          <div className="h-full flex items-center justify-center rounded-lg border" style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
            <p className="text-sm">Selecione um cliente ou a visão consolidada</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: '#160F41' }}>{nome}</h3>
              {!modoConsolidado && clientes.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{ color: '#6b6b8a' }}>
                    {clientes.findIndex((cli: Cliente) => cli.nome_cliente === c?.nome_cliente) + 1}/{clientes.length}
                  </span>
                  <button onClick={() => navegarCliente('anterior')} title="Cliente anterior (↑)"
                    className="p-1 rounded hover:bg-gray-100" style={{ color: '#6b6b8a' }}>
                    <ChevronUp size={16} />
                  </button>
                  <button onClick={() => navegarCliente('proximo')} title="Proximo cliente (↓)"
                    className="p-1 rounded hover:bg-gray-100" style={{ color: '#6b6b8a' }}>
                    <ChevronDown size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Abas */}
            <div className="flex gap-1 rounded-lg p-1 mb-4" style={{ backgroundColor: '#f3f4f6' }}>
              {ABAS.map(a => {
                const Icon = a.icon;
                return (
                  <button key={a.id} onClick={() => setAba(a.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium ${aba === a.id ? 'bg-white shadow-sm' : ''}`}
                    style={{ color: aba === a.id ? '#160F41' : '#6b6b8a' }}>
                    <Icon size={12} /> {a.label}
                  </button>
                );
              })}
            </div>

            {/* Conteúdo da aba */}
            <div className="flex-1 overflow-y-auto rounded-lg border p-5" style={{ borderColor: '#e2e2e8' }}>
              {aba === 'visao' && <PatrimonioVisaoGeral
                investimentos={crud.investimentos} imoveis={crud.imoveis}
                veiculos={crud.veiculos} outrosBens={crud.outrosBens} passivos={crud.passivos}
                carteiraGalapagos={crud.carteiraGalapagos} />}
              {aba === 'invest' && <PatrimonioInvestimentos items={crud.investimentos}
                onSalvar={crud.salvarInvestimento} onExcluir={crud.excluirInvestimento} loading={crud.loading}
                carteiraGalapagos={crud.carteiraGalapagos} />}
              {aba === 'imoveis' && <PatrimonioImoveis items={crud.imoveis}
                onSalvar={crud.salvarImovel} onExcluir={crud.excluirImovel} loading={crud.loading} />}
              {aba === 'veiculos' && <PatrimonioVeiculos items={crud.veiculos}
                onSalvar={crud.salvarVeiculo} onExcluir={crud.excluirVeiculo} loading={crud.loading} />}
              {aba === 'outros' && <PatrimonioOutrosBens items={crud.outrosBens}
                onSalvar={crud.salvarOutroBem} onExcluir={crud.excluirOutroBem} loading={crud.loading} />}
              {aba === 'passivos' && <PatrimonioPassivos items={crud.passivos}
                onSalvar={crud.salvarPassivo} onExcluir={crud.excluirPassivo} loading={crud.loading} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Patrimonio;
