interface KpiCardProps {
  titulo: string;
  valor: string;
  cor?: string;
  subtitulo?: string;
}

export function KpiCard({ titulo, valor, cor = 'text-gray-900', subtitulo }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</p>
      {subtitulo && <p className="text-sm text-gray-400 mt-0.5">{subtitulo}</p>}
    </div>
  );
}
