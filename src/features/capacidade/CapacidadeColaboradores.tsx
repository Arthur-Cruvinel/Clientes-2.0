// --- Seção 1+2 do módulo Capacidade: cards por colaborador + drill-down ---
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { type ColaboradorCapacidade } from './useCapacidade';
import { CapacidadeDrillDown } from './CapacidadeDrillDown';

// Verde até 80%, amarelo até 100%, vermelho acima (sobrecarga).
function cor(ocup: number): string {
  if (ocup > 1.0) return '#dc2626';
  if (ocup >= 0.8) return '#ea580c';
  return '#16a34a';
}

export function CapacidadeColaboradores({ dados }: { dados: ColaboradorCapacidade[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const sel = dados.find(d => d.colaborador.nome_colaborador === expandido) ?? null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>Ocupação por colaborador</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {dados.map(d => {
          const nome = d.colaborador.nome_colaborador;
          const ativo = expandido === nome;
          const pct = d.ocupacaoPct * 100;
          return (
            <button key={nome} type="button" onClick={() => setExpandido(ativo ? null : nome)}
              className="text-left rounded-lg border p-3 transition-all"
              style={{ borderColor: ativo ? '#0065FF' : '#e2e2e8', backgroundColor: ativo ? '#f5f8ff' : '#fff' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: '#160F41' }}>{nome}</span>
                <span className="text-xs font-bold" style={{ color: cor(d.ocupacaoPct) }}>{pct.toFixed(0)}%</span>
              </div>
              <p className="text-[11px] mb-2" style={{ color: '#6b6b8a' }}>{d.colaborador.cargo}</p>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#eef0f4' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: cor(d.ocupacaoPct) }} />
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#9ca3af' }}>
                {d.horasUsadas.toFixed(0)}h de {d.horasDisponiveis.toFixed(0)}h disponíveis
              </p>
            </button>
          );
        })}
        {dados.length === 0 && <p className="text-sm italic col-span-full" style={{ color: '#6b6b8a' }}>Nenhum colaborador alocável no período.</p>}
      </div>

      {sel && (() => {
        const primeiraFuncao = FUNCOES_ALOCACAO.find(f => sel.porFuncao[f]);
        const nome = encodeURIComponent(sel.colaborador.nome_colaborador);
        const href = `/perfil?visao=lote_aloc&colaborador=${nome}`
          + (primeiraFuncao ? `&funcao=${primeiraFuncao}` : '');
        return (
          <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: '#0065FF', backgroundColor: '#f9fbff' }}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>{sel.colaborador.nome_colaborador} — detalhe</h4>
              <Link to={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">
                <Pencil size={12} /> Editar alocação
              </Link>
            </div>
            <CapacidadeDrillDown dado={sel} />
          </div>
        );
      })()}
    </div>
  );
}
