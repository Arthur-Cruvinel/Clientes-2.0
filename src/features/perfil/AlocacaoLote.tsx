// --- Aba Alocação em Lote — com ordenação e filtros checkbox estilo Excel ---

import { useState, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import type { DadosCliente } from '../../types';
import { useOrdenacao } from '../poupanca/useOrdenacao';
import { ThOrdenavel } from '../poupanca/ThOrdenavel';
import { FiltroCheckbox } from '../poupanca/FiltroCheckbox';
import { AlocacaoLoteAcoes } from './AlocacaoLoteAcoes';

interface Props {
  clientes: DadosCliente[];
  bankersUnicos: string[];
  empresariosUnicos: string[];
  onAplicar: (ids: string[], campo: 'banker' | 'empresario', valor: string) => Promise<void>;
  onRecarregar: () => Promise<void>;
}

const TD = 'px-3 py-2 text-xs';

function acessor(c: DadosCliente, col: string): string | number | null {
  switch (col) {
    case 'nome': return c.nome_cliente;
    case 'banker': return c.banker ?? '';
    case 'empresario': return c.empresario ?? '';
    default: return null;
  }
}

export function AlocacaoLote({ clientes, bankersUnicos, empresariosUnicos, onAplicar, onRecarregar }: Props) {
  const [busca, setBusca] = useState('');
  const [filtroNomes, setFiltroNomes] = useState<Set<string> | null>(null);
  const [filtroBankers, setFiltroBankers] = useState<Set<string> | null>(null);
  const [filtroEmps, setFiltroEmps] = useState<Set<string> | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Valores únicos para filtros checkbox
  const nomes = useMemo(() => clientes.map(c => c.nome_cliente).sort(), [clientes]);
  const bankerVals = useMemo(() => [...new Set(clientes.map(c => c.banker || 'Sem banker'))].sort(), [clientes]);
  const empVals = useMemo(() => [...new Set(clientes.map(c => c.empresario || 'Sem empresário'))].sort(), [clientes]);

  // Filtragem por busca e checkboxes
  const filtrados = useMemo(() => {
    let lista = [...clientes];
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(c => c.nome_cliente.toLowerCase().includes(q));
    }
    if (filtroNomes) lista = lista.filter(c => filtroNomes.has(c.nome_cliente));
    if (filtroBankers) lista = lista.filter(c => filtroBankers.has(c.banker || 'Sem banker'));
    if (filtroEmps) lista = lista.filter(c => filtroEmps.has(c.empresario || 'Sem empresário'));
    return lista;
  }, [clientes, busca, filtroNomes, filtroBankers, filtroEmps]);

  // Ordenação
  const acessorCb = useCallback(acessor, []);
  const { ordenados, coluna, direcao, alternar } = useOrdenacao(filtrados, acessorCb);

  const todosCheck = ordenados.length > 0 && ordenados.every(c => selecionados.has(c.id ?? ''));

  const toggleTodos = useCallback(() => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (todosCheck) { ordenados.forEach(c => next.delete(c.id ?? '')); }
      else { ordenados.forEach(c => { if (c.id) next.add(c.id); }); }
      return next;
    });
  }, [ordenados, todosCheck]);

  const toggle = useCallback((id: string) => {
    setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleAplicar = useCallback(async (campo: 'banker' | 'empresario', valor: string) => {
    const ids = [...selecionados];
    if (ids.length === 0 || !valor.trim()) return;
    setSalvando(true);
    try {
      await onAplicar(ids, campo, valor.trim());
      await onRecarregar();
      const label = campo === 'banker' ? 'Banker' : 'Empresário';
      setToast({ msg: `${label} atualizado em ${ids.length} clientes`, ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Erro ao salvar', ok: false });
    } finally { setSalvando(false); }
    setTimeout(() => setToast(null), 3000);
  }, [selecionados, onAplicar, onRecarregar]);

  const thProps = { colunaAtiva: coluna, direcao, onAlternar: alternar };
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>Alocação em Lote</h3>
        <p className="text-xs" style={{ color: '#6b6b8a' }}>Atribua banker e empresário para múltiplos clientes</p>
      </div>

      {/* Busca + contador */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={BRD}>
          <Search size={13} className="text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar clientes..."
            className="text-xs outline-none bg-transparent w-36" style={{ color: '#160F41' }} />
        </div>
        <span className="ml-auto text-xs" style={{ color: '#6b6b8a' }}>
          {selecionados.size} de {ordenados.length} selecionados
        </span>
      </div>

      {toast && (
        <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${toast.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-y-auto rounded-lg border" style={{ borderColor: '#e2e2e8', maxHeight: 'calc(100vh - 420px)' }}>
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              <th className="px-3 py-2 w-10">
                <input type="checkbox" checked={todosCheck} onChange={toggleTodos} className="rounded" />
              </th>
              <ThOrdenavel chave="nome" label="Cliente" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left" {...thProps}>
                <FiltroCheckbox valores={nomes} selecionados={filtroNomes} onAplicar={setFiltroNomes} />
              </ThOrdenavel>
              <ThOrdenavel chave="banker" label="Banker Atual" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left" {...thProps}>
                <FiltroCheckbox valores={bankerVals} selecionados={filtroBankers} onAplicar={setFiltroBankers} />
              </ThOrdenavel>
              <ThOrdenavel chave="empresario" label="Empresário Atual" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left" {...thProps}>
                <FiltroCheckbox valores={empVals} selecionados={filtroEmps} onAplicar={setFiltroEmps} />
              </ThOrdenavel>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {ordenados.map(c => {
              const sel = selecionados.has(c.id ?? '');
              return (
                <tr key={c.id ?? c.nome_cliente} onClick={() => c.id && toggle(c.id)}
                  className={`cursor-pointer transition-colors ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={sel} readOnly className="rounded pointer-events-none" /></td>
                  <td className={`${TD} font-medium`} style={{ color: '#160F41' }}>{c.nome_cliente}</td>
                  <td className={TD}>
                    {c.banker || <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>—</span>}
                  </td>
                  <td className={TD}>
                    {c.empresario || <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selecionados.size > 0 && (
        <AlocacaoLoteAcoes count={selecionados.size} bankersUnicos={bankersUnicos} empresariosUnicos={empresariosUnicos}
          salvando={salvando} onAplicar={handleAplicar} onLimpar={() => setSelecionados(new Set())} />
      )}
    </div>
  );
}
