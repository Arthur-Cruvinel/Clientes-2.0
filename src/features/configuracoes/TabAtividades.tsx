// --- Aba Atividades das Configurações ---
// Overrides de horas_base por atividade (parametros.atividades). Vazio = default de
// fábrica de ATIVIDADES_SERVICO (byte a byte). Afeta a DEMANDA estimada
// (calcularHorasReais → fee/matriz/Reajustes); NÃO move o custo FECHADO (pct salvo).

import { useState, useEffect } from 'react';
import type { Parametros, FuncaoAlocacao } from '../../types';
import { ATIVIDADES_SERVICO } from '../../utils/atividadesServico';
import { FUNCOES_ALOCACAO } from '../../utils/constants';

interface Props {
  parametros: Parametros;
  onSalvar: (p: Parametros) => Promise<void>;
  salvando: boolean;
}

const LABEL_FUNCAO: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Consultoria Financeira', operacional_financeiro: 'Operacional Financeiro',
  serv_adm: 'Administrativo', serv_aux_adm: 'Aux. Administrativo',
};
const rotuloAtividade = (id: string) => id.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

export function TabAtividades({ parametros, onSalvar, salvando }: Props) {
  const [over, setOver] = useState<Record<string, number>>(parametros.atividades ?? {});
  useEffect(() => { setOver(parametros.atividades ?? {}); }, [parametros]);

  // vigente = override ?? default. Ao editar: se voltar ao default, remove o override.
  const setVigente = (id: string, valor: number, padrao: number) => {
    setOver(prev => {
      const p = { ...prev };
      if (valor === padrao) delete p[id]; else p[id] = valor;
      return p;
    });
  };
  const restaurar = (id: string) => setOver(prev => { const p = { ...prev }; delete p[id]; return p; });

  const salvar = () => {
    if (!confirm('Estas horas-base são GLOBAIS — mudam a demanda estimada (fee/matriz/Reajustes) de TODOS os clientes novos. O período FECHADO não se move (usa pct salvo). Confirmar?')) return;
    onSalvar({ ...parametros, atividades: over });
  };

  const INP = 'rounded px-2 py-1 text-sm w-24 text-right';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
  const nOverrides = Object.keys(over).length;

  return (
    <div className="space-y-6">
      <p className="text-xs" style={{ color: '#6b6b8a' }}>
        Horas-base por atividade do catálogo. <strong>Vigente</strong> = o valor em uso; vazio/igual
        ao padrão = default de fábrica. Muda a <strong>demanda estimada</strong> (calcularHorasReais)
        → fee sugerido e matriz de capacidade. <strong>Não move o fechado</strong> (custo lê pct salvo).
        {nOverrides > 0 && <span style={{ color: '#0065FF' }}> · {nOverrides} override(s) ativo(s).</span>}
      </p>

      {FUNCOES_ALOCACAO.map(funcao => {
        const ids = Object.keys(ATIVIDADES_SERVICO).filter(id => ATIVIDADES_SERVICO[id].funcao === funcao);
        if (!ids.length) return null;
        return (
          <div key={funcao} className="space-y-2">
            <h3 className="text-sm font-bold" style={{ color: '#160F41' }}>{LABEL_FUNCAO[funcao]}</h3>
            {ids.map(id => {
              const ativ = ATIVIDADES_SERVICO[id];
              const padrao = ativ.horas_base;
              const vigente = over[id] ?? padrao;
              const alterado = over[id] != null && over[id] !== padrao;
              return (
                <div key={id} className="flex flex-wrap items-center gap-3 rounded-lg border p-2"
                  style={{ borderColor: alterado ? '#0065FF' : '#e2e2e8', backgroundColor: alterado ? '#f0f6ff' : '#fff' }}>
                  <span className="text-sm flex-grow" style={{ color: '#160F41' }}>{rotuloAtividade(id)}
                    <span className="text-[10px] ml-2" style={{ color: '#9ca3af' }}>driver: {ativ.driver}</span>
                  </span>
                  <span className="text-[11px]" style={{ color: '#9ca3af' }}>padrão {padrao.toLocaleString('pt-BR')}h</span>
                  <label className="flex items-center gap-1">
                    <span className="text-[11px]" style={{ color: '#6b6b8a' }}>vigente</span>
                    <input type="number" step="0.01" value={vigente}
                      onChange={e => setVigente(id, Number(e.target.value), padrao)} className={INP} style={BRD} />
                  </label>
                  {alterado && <button onClick={() => restaurar(id)} className="text-[11px] underline" style={{ color: '#0065FF' }}>restaurar</button>}
                </div>
              );
            })}
          </div>
        );
      })}

      <button disabled={salvando} onClick={salvar}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
