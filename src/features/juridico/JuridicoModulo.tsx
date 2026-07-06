// --- Módulo Jurídico (vitrine): consumo REAL + resto ilustrativo ---
// A seção de CONSUMO é real (JuridicoConsumo, lê o snapshot medido). O fluxo por status
// (kanban) e as franquias seguem ILUSTRATIVOS com selo — guard-rail: só a parte de consumo
// deixa de ser mockup, por decisão dada. Nada aqui toca motor/DRE.

import { SeloIlustrativo } from '../../components/ui/MockupModulo';
import { JuridicoConsumo } from './JuridicoConsumo';

const AZUL = '#0065FF', AMBAR = '#b45309', VERDE = '#166534', VERMELHO = '#991b1b';

export function JuridicoModulo() {
  const cols = [
    { t: 'Abertas', n: 6, cor: AZUL }, { t: 'Em andamento', n: 4, cor: AMBAR }, { t: 'Concluídas no mês', n: 11, cor: VERDE },
  ];
  const franquia = [
    { c: 'Cliente A', usado: 5, franquia: 2 }, { c: 'Cliente B', usado: 2, franquia: 4 }, { c: 'Cliente C', usado: 3, franquia: 5 },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold" style={{ color: '#160F41' }}>Jurídico</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide" style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>Em construção</span>
      </div>
      <p className="max-w-3xl text-lg md:text-xl font-semibold leading-snug" style={{ color: '#160F41' }}>
        Capacidade fixa com demanda sem preço marginal gera fila, sempre. Demandas medidas,
        franquias por tier, consumo visível — o jurídico que limita e cobra sem virar gargalo.
      </p>

      {/* SEÇÃO REAL — consumo medido */}
      <JuridicoConsumo />

      {/* RESTO ILUSTRATIVO — fluxo por status + franquias (selo) */}
      <div className="rounded-xl border p-4 relative" style={{ borderColor: '#e2e2e8', backgroundColor: '#fff' }}>
        <div className="absolute top-3 right-3"><SeloIlustrativo /></div>
        <p className="text-[11px] uppercase font-bold mb-3" style={{ color: '#6b6b8a' }}>Fluxo por status e franquias (ilustrativo — em construção)</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {cols.map(c => (
            <div key={c.t} className="rounded-lg p-2 text-center" style={{ backgroundColor: '#f9f9fb' }}>
              <p className="text-lg font-bold" style={{ color: c.cor }}>{c.n}</p>
              <p className="text-[9px] uppercase font-bold" style={{ color: '#6b6b8a' }}>{c.t}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {franquia.map(f => {
            const estourou = f.usado > f.franquia; const pct = Math.min(100, (f.usado / f.franquia) * 100);
            return (
              <div key={f.c} className="flex items-center gap-2">
                <span className="text-[10px] w-16 shrink-0" style={{ color: '#160F41' }}>{f.c}</span>
                <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: '#eee' }}>
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: estourou ? VERMELHO : VERDE }} />
                </div>
                <span className="text-[10px] w-14 text-right" style={{ color: estourou ? VERMELHO : '#6b6b8a' }}>{f.usado}/{f.franquia}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div><span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: '#f0f6ff', color: '#0065FF' }}>Especificado — Parte V.2 do documento</span></div>
    </div>
  );
}
