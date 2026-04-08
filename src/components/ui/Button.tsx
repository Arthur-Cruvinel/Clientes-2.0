import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'perigo';
}

const ESTILOS = {
  primario: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secundario: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
} as const;

export function Button({ variante = 'primario', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
