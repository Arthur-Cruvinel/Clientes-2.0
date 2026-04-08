// --- Filtro checkbox estilo Excel com busca ---

import { useState, useRef, useEffect, useCallback } from 'react';
import { Filter, Check, Search, X } from 'lucide-react';

interface Props {
  valores: string[];                // lista de valores únicos disponíveis
  selecionados: Set<string> | null; // null = todos selecionados (sem filtro ativo)
  onAplicar: (sel: Set<string> | null) => void;
}

export function FiltroCheckbox({ valores, selecionados, onAplicar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [temp, setTemp] = useState<Set<string>>(new Set(valores));
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza estado temporário ao abrir
  useEffect(() => {
    if (aberto) {
      setTemp(selecionados ? new Set(selecionados) : new Set(valores));
      setBusca('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [aberto, selecionados, valores]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  const buscaNorm = busca.trim().toLowerCase();
  const filtrados = buscaNorm
    ? valores.filter(v => v.toLowerCase().includes(buscaNorm))
    : valores;

  const toggle = useCallback((v: string) => {
    setTemp(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }, []);

  const aplicar = useCallback(() => {
    // Se todos selecionados → remove filtro (null)
    const resultado = temp.size === valores.length ? null : new Set(temp);
    onAplicar(resultado);
    setAberto(false);
  }, [temp, valores, onAplicar]);

  const ativo = selecionados != null;

  return (
    <div className="relative inline-flex" ref={ref}>
      <button onClick={() => setAberto(v => !v)}
        className="p-0.5 rounded transition-colors hover:bg-gray-200"
        title="Filtrar">
        <Filter size={12} className={ativo ? 'text-blue-600' : 'text-gray-400'} />
      </button>

      {aberto && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white rounded-lg shadow-xl ring-1 ring-black/10"
          style={{ width: 240, maxHeight: 340 }}>
          {/* Busca */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b" style={{ borderColor: '#e2e8f0' }}>
            <Search size={13} className="text-gray-400 shrink-0" />
            <input ref={inputRef} value={busca} onChange={e => setBusca(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') aplicar(); }}
              placeholder="Pesquisar..."
              className="flex-1 text-xs outline-none bg-transparent" style={{ color: '#160F41' }} />
            {busca && <button onClick={() => setBusca('')} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
          </div>

          {/* Ações rápidas */}
          <div className="flex gap-2 px-2 py-1 border-b text-[10px]" style={{ borderColor: '#e2e8f0' }}>
            <button onClick={() => setTemp(new Set(valores))} className="text-blue-600 hover:underline">
              Selecionar todos
            </button>
            <button onClick={() => setTemp(new Set())} className="text-red-500 hover:underline">
              Limpar
            </button>
          </div>

          {/* Lista de checkboxes */}
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {filtrados.map(v => {
              const checked = temp.has(v);
              return (
                <label key={v}
                  className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-blue-50/50 text-xs"
                  style={{ color: '#160F41' }}>
                  <span className="flex items-center justify-center shrink-0 rounded border"
                    style={{ width: 16, height: 16, borderColor: checked ? '#0065FF' : '#cbd5e1',
                      backgroundColor: checked ? '#0065FF' : '#fff' }}>
                    {checked && <Check size={11} className="text-white" />}
                  </span>
                  <input type="checkbox" className="sr-only" checked={checked}
                    onChange={() => toggle(v)} />
                  <span className="truncate">{v}</span>
                </label>
              );
            })}
            {filtrados.length === 0 && (
              <p className="px-2 py-3 text-xs text-center" style={{ color: '#94a3b8' }}>Nenhum resultado</p>
            )}
          </div>

          {/* Confirmar */}
          <div className="px-2 py-1.5 border-t" style={{ borderColor: '#e2e8f0' }}>
            <button onClick={aplicar}
              className="w-full py-1.5 rounded-md text-xs font-medium text-white transition-colors"
              style={{ background: 'linear-gradient(90deg, #0065FF, #D000BB)' }}>
              Aplicar ({temp.size}/{valores.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
