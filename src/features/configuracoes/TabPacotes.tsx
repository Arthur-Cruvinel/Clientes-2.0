// --- Aba Pacotes de Serviço das Configurações ---

import { useState, useEffect, useMemo } from 'react';
import type { Parametros, PacoteServico, FuncaoAlocacao } from '../../types';
import { FUNCOES_ALOCACAO } from '../../utils/constants';

interface Props {
  parametros: Parametros;
  onSalvar: (p: Parametros) => Promise<void>;
  salvando: boolean;
}

const PACOTES: PacoteServico[] = ['full', 'advanced', 'light', 'future'];
const LABEL_FUNCAO: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Consultoria Gestão',
  consultoria_planejamento: 'Cons. Planejamento',
  consultoria_financeira: 'Cons. Financeira',
  operacional_financeiro: 'Operac. Financeiro',
  serv_adm: 'Serv. Administrativos',
  serv_aux_adm: 'Aux. Administrativo',
};

type HorasState = Record<PacoteServico, Record<FuncaoAlocacao, number>>;

export function TabPacotes({ parametros, onSalvar, salvando }: Props) {
  const [horas, setHoras] = useState<HorasState>(() => {
    const h: Record<string, Record<string, number>> = {};
    for (const p of PACOTES) h[p] = { ...parametros.horas_pacote[p] };
    return h as HorasState;
  });

  useEffect(() => {
    const h: Record<string, Record<string, number>> = {};
    for (const p of PACOTES) h[p] = { ...parametros.horas_pacote[p] };
    setHoras(h as HorasState);
  }, [parametros]);

  function setHora(pacote: PacoteServico, funcao: FuncaoAlocacao, valor: number) {
    setHoras(prev => ({ ...prev, [pacote]: { ...prev[pacote], [funcao]: valor } }));
  }

  const totais = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of PACOTES) t[p] = FUNCOES_ALOCACAO.reduce((s, f) => s + (horas[p]?.[f] ?? 0), 0);
    return t;
  }, [horas]);

  const TH = 'px-3 py-2 text-xs font-bold uppercase tracking-wider text-center';
  const TD = 'px-2 py-1.5';

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              <th className={`${TH} text-left`} style={{ minWidth: 160 }}>Função</th>
              {PACOTES.map(p => <th key={p} className={TH}>{p}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {FUNCOES_ALOCACAO.map(f => (
              <tr key={f}>
                <td className={`${TD} text-xs font-medium`} style={{ color: '#160F41' }}>{LABEL_FUNCAO[f]}</td>
                {PACOTES.map(p => (
                  <td key={p} className={TD}>
                    <input type="number" min={0} value={horas[p]?.[f] ?? 0}
                      onChange={e => setHora(p, f, Number(e.target.value))}
                      className="w-16 text-center rounded px-1 py-1 text-sm"
                      style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <td className={`${TD} text-xs font-bold`}>Total</td>
              {PACOTES.map(p => <td key={p} className={`${TD} text-center text-xs font-bold`}>{totais[p]}h</td>)}
            </tr>
          </tfoot>
        </table>
      </div>

      <button disabled={salvando}
        onClick={() => onSalvar({ ...parametros, horas_pacote: { ...horas, asset_only: parametros.horas_pacote.asset_only } })}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
