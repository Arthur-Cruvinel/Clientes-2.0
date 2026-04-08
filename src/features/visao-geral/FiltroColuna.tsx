// --- Dropdown de filtro estilo Excel com checkboxes e pesquisa ---
// Usa position:fixed para escapar do overflow:auto do container da tabela.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Filter, Search } from 'lucide-react';

interface Props {
  valores: string[];
  selecionados: Set<string>;
  onChange: (novos: Set<string>) => void;
  ativo: boolean;
}

export function FiltroColuna({ valores, selecionados, onChange, ativo }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Calcula posição fixa a partir do botão
  const abrir = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (aberto) { setAberto(false); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
    setAberto(true);
  }, [aberto]);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function handleClick(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setAberto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [aberto]);

  const filtrados = busca
    ? valores.filter(v => v.toLowerCase().includes(busca.toLowerCase()))
    : valores;

  const todosVisiveisSelecionados = filtrados.length > 0 && filtrados.every(v => selecionados.has(v));

  function toggleTodos() {
    const novos = new Set(selecionados);
    if (todosVisiveisSelecionados) filtrados.forEach(v => novos.delete(v));
    else filtrados.forEach(v => novos.add(v));
    onChange(novos);
  }

  function toggle(valor: string) {
    const novos = new Set(selecionados);
    if (novos.has(valor)) novos.delete(valor); else novos.add(valor);
    onChange(novos);
  }

  function aplicar() { onChange(new Set(filtrados)); setBusca(''); setAberto(false); }
  function limpar() { onChange(new Set(valores)); setBusca(''); setAberto(false); }

  return (
    <>
      <button ref={btnRef} onClick={abrir}
        className="ml-1 p-0.5 rounded hover:bg-gray-200 transition-colors" title="Filtrar">
        <Filter size={10} style={{ color: ativo ? '#0065FF' : '#d1d5db' }} />
      </button>

      {aberto && (
        <div ref={dropRef}
          className="fixed z-[100] bg-white rounded-lg shadow-xl border"
          style={{ borderColor: '#e2e2e8', width: 220, top: pos.top, left: pos.left }}
          onClick={e => e.stopPropagation()}>

          {/* Busca */}
          <div className="p-2 border-b" style={{ borderColor: '#e2e2e8' }}>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded border" style={{ borderColor: '#e2e2e8' }}>
              <Search size={12} style={{ color: '#6b6b8a' }} />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && busca && filtrados.length > 0) aplicar(); }}
                placeholder="Pesquisar..." className="text-xs w-full outline-none bg-transparent"
                style={{ color: '#160F41' }} autoFocus />
            </div>
          </div>

          {/* Selecionar todos */}
          <div className="px-2 py-1.5 border-b" style={{ borderColor: '#e2e2e8' }}>
            <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: '#160F41' }}>
              <input type="checkbox" checked={todosVisiveisSelecionados} onChange={toggleTodos} className="rounded" />
              <span className="font-medium">Selecionar todos</span>
            </label>
          </div>

          {/* Lista de valores */}
          <div className="max-h-52 overflow-y-auto px-2 py-1">
            {filtrados.length === 0 ? (
              <p className="text-xs py-2 text-center" style={{ color: '#6b6b8a' }}>Nenhum resultado</p>
            ) : filtrados.map(v => (
              <label key={v} className="flex items-center gap-2 cursor-pointer text-xs py-0.5" style={{ color: '#160F41' }}>
                <input type="checkbox" checked={selecionados.has(v)} onChange={() => toggle(v)} className="rounded flex-shrink-0" />
                <span className="truncate" title={v}>{v || '(vazio)'}</span>
              </label>
            ))}
          </div>

          {/* Botão aplicar */}
          {busca && filtrados.length > 0 && (
            <div className="px-2 py-1.5 border-t" style={{ borderColor: '#e2e2e8' }}>
              <button onClick={aplicar} className="w-full text-xs py-1.5 rounded font-medium text-white bg-gradient-brand">
                Aplicar ({filtrados.length})
              </button>
            </div>
          )}

          {/* Botão limpar */}
          {ativo && (
            <div className="px-2 py-1.5 border-t" style={{ borderColor: '#e2e2e8' }}>
              <button onClick={limpar} className="w-full text-xs py-1 rounded text-center font-medium" style={{ color: '#0065FF' }}>
                Limpar filtro
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
