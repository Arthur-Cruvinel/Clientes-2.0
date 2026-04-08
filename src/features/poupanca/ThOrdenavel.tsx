// --- Header de coluna ordenável ---

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { Direcao } from './useOrdenacao';

interface Props {
  chave: string;
  label: string;
  className?: string;
  colunaAtiva: string | null;
  direcao: Direcao;
  onAlternar: (col: string) => void;
  children?: React.ReactNode; // slot para filtro
}

export function ThOrdenavel({ chave, label, className, colunaAtiva, direcao, onAlternar, children }: Props) {
  const ativo = colunaAtiva === chave;
  const Icon = ativo && direcao === 'asc' ? ChevronUp
    : ativo && direcao === 'desc' ? ChevronDown
    : ChevronsUpDown;

  return (
    <th className={`${className ?? ''} select-none`}>
      <span className="inline-flex items-center gap-0.5">
        <button onClick={() => onAlternar(chave)}
          className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors">
          {label}
          <Icon size={12} className={ativo ? 'text-blue-600' : 'text-gray-400'} />
        </button>
        {children}
      </span>
    </th>
  );
}
