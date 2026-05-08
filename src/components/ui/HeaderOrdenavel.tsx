// --- Header de coluna ordenável (genérico, reusável entre tabelas) ---
// Padrão único para toda tabela do sistema (CLAUDE.md, "Princípios de Código").
// Cliclar alterna asc → desc → asc; trocar de coluna recomeça em asc.

import { ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface OrdenacaoState<TChave extends string> {
  coluna: TChave;
  direcao: 'asc' | 'desc';
}

interface Props<TChave extends string> {
  titulo: string;
  chave: TChave;
  alinhamento: 'left' | 'right' | 'center';
  ordenacao: OrdenacaoState<TChave>;
  onOrdenar: (o: OrdenacaoState<TChave>) => void;
  /** Tooltip nativo (HTML title) — útil para explicar a métrica da coluna. */
  tooltip?: string;
}

export function HeaderOrdenavel<TChave extends string>({
  titulo, chave, alinhamento, ordenacao, onOrdenar, tooltip,
}: Props<TChave>) {
  const ativo = ordenacao.coluna === chave;
  const Icone = !ativo ? ChevronsUpDown : ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown;
  const justify = alinhamento === 'right' ? 'justify-end'
    : alinhamento === 'center' ? 'justify-center' : 'justify-start';

  function clicar() {
    if (!ativo) onOrdenar({ coluna: chave, direcao: 'asc' });
    else onOrdenar({ coluna: chave, direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc' });
  }

  return (
    <button onClick={clicar} type="button" title={tooltip}
      className={`w-full flex items-center gap-1 ${justify} cursor-pointer hover:text-gray-700`}
      style={{ color: ativo ? '#160F41' : '#6b6b8a' }}>
      {titulo}
      <Icone size={11} style={{ opacity: ativo ? 1 : 0.4 }} />
    </button>
  );
}
