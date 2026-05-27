import type { ReactNode } from 'react';

interface KpiCardProps {
  titulo: string;
  valor: string;
  cor?: string;
  subtitulo?: string;
  // 2ª linha de subtítulo (ReactNode p/ permitir cor/ícone próprios).
  subtitulo2?: ReactNode;
}

export function KpiCard({ titulo, valor, cor = 'text-gray-900', subtitulo, subtitulo2 }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</p>
      {subtitulo && <p className="text-sm text-gray-400 mt-0.5">{subtitulo}</p>}
      {subtitulo2 && <p className="text-sm mt-0.5">{subtitulo2}</p>}
    </div>
  );
}
