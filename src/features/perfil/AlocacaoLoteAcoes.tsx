// --- Painel de ações da Atribuição em Lote ---
// Topo: banker + empresário (campos cadastrais).
// Grid 2 col: 6 funções de alocação (consultoria_*, operacional_*, serv_*).
// Cada select de função filtra colaboradores por funcao_principal correspondente.

import { useMemo, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { normalizarFuncao } from './utilsAlocacao';
import type { Colaborador, FuncaoAlocacao } from '../../types';
import type { CampoAtribuicaoLote } from './usePerfil';

const LABEL_FUNCAO: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Consultoria Gestão',
  consultoria_planejamento: 'Cons. Planejamento',
  consultoria_financeira: 'Cons. Financeira',
  operacional_financeiro: 'Oper. Financeiro',
  serv_adm: 'Serv. Administrativo',
  serv_aux_adm: 'Aux. Administrativo',
};

interface Props {
  count: number;
  bankersUnicos: string[];
  empresariosUnicos: string[];
  colaboradores: Colaborador[];
  salvando: boolean;
  onAplicar: (campo: CampoAtribuicaoLote, valor: string) => void;
  onLimpar: () => void;
}

const INP = 'rounded-lg px-2 py-1.5 text-xs w-40';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;
const BTN = 'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-700';

export function AlocacaoLoteAcoes({ count, bankersUnicos, empresariosUnicos, colaboradores, salvando, onAplicar, onLimpar }: Props) {
  const [banker, setBanker] = useState('');
  const [empresario, setEmpresario] = useState('');
  // Estado por função — { [funcao]: nome_colaborador_selecionado }
  const [funcaoVal, setFuncaoVal] = useState<Record<string, string>>({});

  // Mesmo gate canônico: só colaboradores válidos (nome+cargo+função).
  const colaboradoresPorFuncao = useMemo(() => {
    const r: Record<FuncaoAlocacao, Colaborador[]> = {} as Record<FuncaoAlocacao, Colaborador[]>;
    for (const f of FUNCOES_ALOCACAO) r[f] = [];
    for (const c of colaboradores) {
      if (!c.nome_colaborador?.trim() || !c.cargo?.trim() || !c.funcao_principal) continue;
      const f = normalizarFuncao(c.funcao_principal);
      if (f) r[f].push(c);
    }
    for (const f of FUNCOES_ALOCACAO) r[f].sort((a, b) => a.nome_colaborador.localeCompare(b.nome_colaborador, 'pt-BR'));
    return r;
  }, [colaboradores]);

  return (
    <div className="sticky bottom-0 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.06)] p-4 -mx-5 -mb-5 rounded-b-lg space-y-4"
      style={{ borderColor: '#e2e2e8' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: '#160F41' }}>
          Aplicar para {count} cliente{count !== 1 ? 's' : ''} selecionado{count !== 1 ? 's' : ''}:
        </p>
        <button onClick={onLimpar} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
          <X size={12} /> Limpar seleção
        </button>
      </div>

      {/* Banker + Empresário (cadastrais) */}
      <div className="flex flex-wrap items-end gap-4 pb-3 border-b" style={{ borderColor: '#f3f4f6' }}>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] font-medium block mb-0.5" style={{ color: '#6b6b8a' }}>Banker</label>
            <input value={banker} onChange={e => setBanker(e.target.value)} list="lote-bankers"
              placeholder="Nome do banker..." className={INP} style={BRD} />
            <datalist id="lote-bankers">{bankersUnicos.map(b => <option key={b} value={b} />)}</datalist>
          </div>
          <button disabled={salvando || !banker.trim()} className={BTN}
            onClick={() => onAplicar('banker', banker)}>
            {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Aplicar Banker
          </button>
        </div>
        <div className="h-8 w-px" style={{ backgroundColor: '#e2e2e8' }} />
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] font-medium block mb-0.5" style={{ color: '#6b6b8a' }}>Empresário</label>
            <input value={empresario} onChange={e => setEmpresario(e.target.value)} list="lote-empresarios"
              placeholder="Nome do empresário..." className={INP} style={BRD} />
            <datalist id="lote-empresarios">{empresariosUnicos.map(e => <option key={e} value={e} />)}</datalist>
          </div>
          <button disabled={salvando || !empresario.trim()} className={BTN}
            onClick={() => onAplicar('empresario', empresario)}>
            {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Aplicar Empresário
          </button>
        </div>
      </div>

      {/* Funções de alocação — grid 2 colunas */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>
          Funções de alocação
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FUNCOES_ALOCACAO.map(f => {
            const opcoes = colaboradoresPorFuncao[f];
            const valor = funcaoVal[f] ?? '';
            return (
              <div key={f} className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-medium block mb-0.5" style={{ color: '#6b6b8a' }}>{LABEL_FUNCAO[f]}</label>
                  <select value={valor} onChange={e => setFuncaoVal(p => ({ ...p, [f]: e.target.value }))}
                    className={`${INP} w-full`} style={BRD}>
                    <option value="">{opcoes.length === 0 ? 'Sem colaborador disponível' : 'Selecione…'}</option>
                    {opcoes.map(c => <option key={c.id ?? c.nome_colaborador} value={c.nome_colaborador}>{c.nome_colaborador}</option>)}
                  </select>
                </div>
                <button disabled={salvando || !valor.trim()} className={BTN}
                  onClick={() => onAplicar(f, valor)}>
                  {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Aplicar
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
