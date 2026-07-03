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

// Unidade de cada horas_base — TODAS são horas/MÊS; o driver diz por-quê-multiplica.
const UNIDADE_DRIVER: Record<string, string> = {
  fixo: 'h/mês (fixo)',
  boolean: 'h/mês (quando ativo)',
  vol_movimentos: 'h/mês (escala por movimentos/mês)',
  qtd_veiculos: 'h/mês por veículo',
  qtd_imoveis: 'h/mês por imóvel',
  qtd_func_domesticos: 'h/mês por funcionário',
  qtd_recebiveis: 'h/mês por recebível/mês',
  qtd_contratacoes: 'h/mês por contratação/mês',
  qtd_contas: 'h/mês por conta',
  grupos_financeiros: 'h/mês por grupo',
};

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
      <div className="rounded-lg p-3 text-xs space-y-1" style={{ backgroundColor: '#f0f6ff', color: '#6b6b8a' }}>
        <p><strong>Todas as horas são horas de trabalho por MÊS.</strong> Para drivers quantitativos
        (veículos, imóveis, contas, grupos, movimentos), é <strong>h/mês por unidade</strong> do driver;
        para <em>fixo</em>/<em>quando ativo</em>, é o total de h/mês da atividade.</p>
        <p><strong>Vigente</strong> = valor em uso; igual ao padrão = default de fábrica. Muda a
        <strong> demanda estimada</strong> (fee sugerido + matriz de capacidade). <strong>Não move o
        fechado</strong> (custo lê pct salvo).
        {nOverrides > 0 && <span style={{ color: '#0065FF' }}> · {nOverrides} override(s) ativo(s).</span>}</p>
      </div>

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
                    <span className="block text-[10px]" style={{ color: '#9ca3af' }}>{UNIDADE_DRIVER[ativ.driver] ?? 'h/mês'}</span>
                  </span>
                  <span className="text-[11px]" style={{ color: '#9ca3af' }}>padrão {padrao.toLocaleString('pt-BR')} h/mês</span>
                  <label className="flex items-center gap-1">
                    <span className="text-[11px]" style={{ color: '#6b6b8a' }}>vigente (h/mês)</span>
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
