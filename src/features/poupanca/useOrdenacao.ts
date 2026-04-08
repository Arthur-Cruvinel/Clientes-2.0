// --- Hook de ordenação por coluna ---

import { useState, useMemo, useCallback } from 'react';

export type Direcao = 'asc' | 'desc' | null;

interface Estado {
  coluna: string | null;
  direcao: Direcao;
}

export function useOrdenacao<T>(
  dados: T[],
  acessor: (item: T, coluna: string) => number | string | null,
) {
  const [estado, setEstado] = useState<Estado>({ coluna: null, direcao: null });

  const alternar = useCallback((col: string) => {
    setEstado(prev => {
      if (prev.coluna !== col) return { coluna: col, direcao: 'asc' };
      if (prev.direcao === 'asc') return { coluna: col, direcao: 'desc' };
      return { coluna: null, direcao: null }; // terceiro clique remove
    });
  }, []);

  const ordenados = useMemo(() => {
    if (!estado.coluna || !estado.direcao) return dados;
    const col = estado.coluna;
    const mult = estado.direcao === 'asc' ? 1 : -1;
    return [...dados].sort((a, b) => {
      const va = acessor(a, col);
      const vb = acessor(b, col);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string')
        return va.localeCompare(vb) * mult;
      return ((va as number) - (vb as number)) * mult;
    });
  }, [dados, estado, acessor]);

  return { ordenados, coluna: estado.coluna, direcao: estado.direcao, alternar };
}
