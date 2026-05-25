// --- Seção 1+2 do módulo Capacidade: cards agrupados por função + drill-down inline ---
import { useState, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { LABEL_FUNCAO, type ColaboradorCapacidade } from './useCapacidade';
import { CapacidadeDrillDown } from './CapacidadeDrillDown';

// Verde até 80%, amarelo até 100%, vermelho acima (sobrecarga de capacidade).
function cor(ocup: number): string {
  if (ocup > 1.0) return '#dc2626';
  if (ocup >= 0.8) return '#ea580c';
  return '#16a34a';
}

function rotuloFuncao(fp: string): string {
  return (LABEL_FUNCAO as Record<string, string>)[fp] ?? (fp.charAt(0).toUpperCase() + fp.slice(1));
}

export function CapacidadeColaboradores({ dados }: { dados: ColaboradorCapacidade[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  // Agrupa por funcao_principal. Ordem: funções canônicas (FUNCOES_ALOCACAO),
  // depois não-canônicas (ex.: "institucional") em ordem alfabética.
  const grupos = useMemo(() => {
    const mapa: Record<string, ColaboradorCapacidade[]> = {};
    for (const d of dados) {
      const fp = d.colaborador.funcao_principal || '(sem função)';
      if (mapa[fp]) mapa[fp].push(d); else mapa[fp] = [d];
    }
    const ordem: string[] = [];
    for (const f of FUNCOES_ALOCACAO) if (mapa[f]) ordem.push(f);
    for (const fp of Object.keys(mapa).sort()) if (!ordem.includes(fp)) ordem.push(fp);
    return ordem.map(fp => ({
      fp,
      label: rotuloFuncao(fp),
      colabs: mapa[fp],
      alerta: mapa[fp].some(d => d.extrapolaEscopo || d.ocupacaoPct > 1),
    }));
  }, [dados]);

  const toggleGrupo = (fp: string) => setFechados(prev => {
    const n = new Set(prev);
    if (n.has(fp)) n.delete(fp); else n.add(fp);
    return n;
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>Ocupação por colaborador</h3>
      {dados.length === 0 && <p className="text-sm italic" style={{ color: '#6b6b8a' }}>Nenhum colaborador alocável no período.</p>}

      {grupos.map(g => {
        const colapsado = fechados.has(g.fp);
        return (
          <div key={g.fp} className="space-y-2">
            <button type="button" onClick={() => toggleGrupo(g.fp)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ backgroundColor: '#f3f4f6', color: '#160F41' }}>
              <span className="text-xs font-semibold">
                {g.label} <span style={{ color: '#9ca3af' }}>· {g.colabs.length}</span>
              </span>
              <span className="flex items-center gap-2">
                {g.alerta && (
                  <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#ea580c' }}
                    title="Algum colaborador do grupo está sobrecarregado (>100%) ou extrapola o escopo do pacote">
                    <AlertTriangle size={11} /> atenção
                  </span>
                )}
                {colapsado ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </span>
            </button>

            {!colapsado && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.colabs.map(d => {
                  const nome = d.colaborador.nome_colaborador;
                  const ativo = expandido === nome;
                  const pct = d.ocupacaoPct * 100;
                  const primeiraFuncao = FUNCOES_ALOCACAO.find(f => d.porFuncao[f]);
                  const href = `/perfil?visao=lote_aloc&colaborador=${encodeURIComponent(nome)}`
                    + (primeiraFuncao ? `&funcao=${primeiraFuncao}` : '');
                  return (
                    <Fragment key={nome}>
                      <button type="button" onClick={() => setExpandido(ativo ? null : nome)}
                        className="text-left rounded-lg border p-3 transition-all"
                        style={{ borderColor: ativo ? '#0065FF' : '#e2e2e8', backgroundColor: ativo ? '#f5f8ff' : '#fff' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium" style={{ color: '#160F41' }}>{nome}</span>
                          <span className="text-xs font-bold" style={{ color: cor(d.ocupacaoPct) }}>{pct.toFixed(0)}%</span>
                        </div>
                        <p className="text-[11px]" style={{ color: '#6b6b8a' }}>{d.colaborador.cargo}</p>
                        {d.extrapolaEscopo && (
                          <span className="inline-block mb-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                            style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}
                            title="Algum cliente consome mais horas que o pacote prevê (escopo > 1)">
                            ⚠ extrapola escopo
                          </span>
                        )}
                        <div className="mb-2" />
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#eef0f4' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: cor(d.ocupacaoPct) }} />
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: '#9ca3af' }}>
                          {d.horasUsadas.toFixed(0)}h de {d.horasDisponiveis.toFixed(0)}h disponíveis
                        </p>
                      </button>

                      {ativo && (
                        <div className="col-span-full rounded-lg border p-4 space-y-3" style={{ borderColor: '#0065FF', backgroundColor: '#f9fbff' }}>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>{nome} — detalhe</h4>
                            <Link to={href}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">
                              <Pencil size={12} /> Editar alocação
                            </Link>
                          </div>
                          <CapacidadeDrillDown dado={d} />
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
