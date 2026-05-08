import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Largura = 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | '7xl';

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  /** Largura máxima Tailwind. Default '2xl' (672px) — modais com tabela
   *  larga (BurnRateModal, ProjecaoModal) usam '7xl' (1280px). */
  largura?: Largura;
  children: ReactNode;
}

// Hardcode das classes para o Tailwind tree-shaker incluir todas as variantes.
const LARGURA_CLASS: Record<Largura, string> = {
  'md':  'max-w-md',
  'lg':  'max-w-lg',
  'xl':  'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

export function Modal({ aberto, onFechar, titulo, largura = '2xl', children }: ModalProps) {
  useEffect(() => {
    if (aberto) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <div className={`relative bg-white rounded-lg shadow-xl ${LARGURA_CLASS[largura]} w-full mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
