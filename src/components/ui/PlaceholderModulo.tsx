// --- Placeholder de módulo "em construção" (Vitrine 360) ---
// A PERGUNTA em destaque é a alma da vitrine — o que o módulo vai responder.
// Estrutura com mockup: pergunta (topo) → mockup → badge de origem.
// A origem vira badge discreto: "Especificado — Parte V.x do documento" ou "Novo".
// Presentation-only: nenhum dado real, nenhuma lógica.

import type { ReactNode } from 'react';

export type OrigemModulo = { tipo: 'especificado'; parte: string } | { tipo: 'novo'; nota?: string };

interface Props {
  nome: string;
  pergunta: string;
  origem: OrigemModulo;
  mockup?: ReactNode;   // mockup ILUSTRATIVO opcional (dados fictícios)
}

function BadgeOrigem({ origem }: { origem: OrigemModulo }) {
  const texto = origem.tipo === 'especificado'
    ? `Especificado — Parte ${origem.parte} do documento`
    : `Novo${origem.nota ? ` — ${origem.nota}` : ''}`;
  const espec = origem.tipo === 'especificado';
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: espec ? '#f0f6ff' : '#fef3c7', color: espec ? '#0065FF' : '#92400e' }}>
      {texto}
    </span>
  );
}

export function PlaceholderModulo({ nome, pergunta, origem, mockup }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold" style={{ color: '#160F41' }}>{nome}</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide"
          style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>Em construção</span>
      </div>

      {mockup ? (
        <div className="space-y-5">
          <p className="max-w-3xl text-xl md:text-2xl font-semibold leading-snug" style={{ color: '#160F41' }}>{pergunta}</p>
          {mockup}
          <div><BadgeOrigem origem={origem} /></div>
        </div>
      ) : (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: '#e2e2e8', background: 'linear-gradient(180deg,#f8fbff,#ffffff)' }}>
          <p className="mx-auto max-w-2xl text-2xl md:text-3xl font-semibold leading-snug" style={{ color: '#160F41' }}>{pergunta}</p>
          <div className="mt-6"><BadgeOrigem origem={origem} /></div>
        </div>
      )}
    </div>
  );
}
