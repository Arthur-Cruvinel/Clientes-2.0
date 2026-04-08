// --- Skeleton loaders para Visão Geral ---
// Mantêm o layout estável enquanto os dados carregam.

function Pulse({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} style={style} />;
}

/** 4 cards KPI em skeleton */
export function SkeletonKpis() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Tabela skeleton — 8 linhas fake */
export function SkeletonTabela() {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3" style={{ backgroundColor: '#f9f9fb' }}>
        {[80, 50, 70, 70, 70, 60, 70, 50, 60].map((w, i) => (
          <Pulse key={i} className="h-3" style={{ width: w }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: 8 }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-t border-gray-100">
          {[120, 50, 80, 80, 80, 70, 80, 50, 60].map((w, i) => (
            <Pulse key={i} className="h-4" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  );
}
