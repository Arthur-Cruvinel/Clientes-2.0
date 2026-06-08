// --- Linha expansível da tabela de colaboradores ---
// Quando expandida, mostra preview das alocações por cliente sem abrir o modal.

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { ColaboradorDerivado } from './useColaboradores';
import type { Cliente } from '../../types';
import { COR_VINCULO, COR_LOCALIDADE, COR_STATUS, corBarraOcupacao, COLUNAS } from './columns';

interface Props {
  derivado: ColaboradorDerivado;
  clientes: Cliente[];
  onAbrirModal: () => void;
  selecionado: boolean;
  onToggleSelecao: () => void;
}

export function ColaboradorCard({ derivado, clientes, onAbrirModal, selecionado, onToggleSelecao }: Props) {
  const [expandido, setExpandido] = useState(false);
  const { colaborador: c, custoTotalMensal, ocupacao, statusOcupacao, funcao, somaPctClientes } = derivado;
  // Narrowing temporário: 'estagio' mapeado para 'clt' visualmente
  // (badge "CLT") até Fase 5 expandir COR_VINCULO. Pendência registrada
  // em audit-results/pendencias-fase3-descobertas.md.
  const tipo: 'clt' | 'pro_labore' = c.tipo_vinculo === 'pro_labore' ? 'pro_labore' : 'clt';
  const local = c.localidade ?? 'SP';
  const corV = COR_VINCULO[tipo];
  const corL = COR_LOCALIDADE[local];
  const corS = COR_STATUS[statusOcupacao];

  // Clientes atendidos por este colaborador na função principal.
  const atendidos = useMemo(() => {
    if (!funcao) return [];
    return clientes.filter(cli => (cli[funcao] as string | undefined) === c.nome_colaborador);
  }, [clientes, funcao, c.nome_colaborador]);

  const TD = 'px-3 py-2 text-xs';
  const ocupPct = Math.min(ocupacao * 100, 200);

  return (
    <>
      <tr className="border-b hover:bg-gray-50 cursor-pointer" style={{ borderColor: '#e2e2e8' }}
          onClick={() => setExpandido(v => !v)}>
        {/* Checkbox de seleção — não propaga o clique (não expande a linha). */}
        <td className={`${TD} w-10 text-center`} onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selecionado} onChange={onToggleSelecao}
            aria-label={`Selecionar ${c.nome_colaborador}`} className="cursor-pointer" />
        </td>
        <td className={`${TD} ${COLUNAS[0].classe ?? ''}`}>
          <div className="flex items-center gap-1.5 truncate" style={{ color: '#160F41' }}>
            {expandido ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="font-medium truncate">{c.nome_colaborador}</span>
          </div>
        </td>
        <td className={`${TD} truncate ${COLUNAS[1].classe ?? ''}`} style={{ color: '#6b6b8a' }}>{c.cargo}</td>
        <td className={`${TD} ${COLUNAS[2].classe ?? ''}`}>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: corV.bg, color: corV.cor }}>{corV.label}</span>
        </td>
        <td className={`${TD} ${COLUNAS[3].classe ?? ''}`}>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: corL.bg, color: corL.cor }}>{local}</span>
        </td>
        <td className={`${TD} truncate ${COLUNAS[4].classe ?? ''}`} style={{ color: '#6b6b8a' }}>{c.funcao_principal}</td>
        <td className={`${TD} text-right ${COLUNAS[5].classe ?? ''}`} style={{ color: '#160F41' }}>
          {formatCurrency(custoTotalMensal)}
        </td>
        <td className={`${TD} text-right ${COLUNAS[6].classe ?? ''}`} style={{ color: '#6b6b8a' }}>
          {formatPercent(c.percentual_alocavel * 100)}
        </td>
        <td className={`${TD} ${COLUNAS[7].classe ?? ''}`}>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${ocupPct}%`, backgroundColor: corBarraOcupacao(statusOcupacao) }} />
            </div>
            <span className="text-[10px]" style={{ color: '#6b6b8a' }}>{(ocupacao * 100).toFixed(0)}%</span>
          </div>
        </td>
        <td className={`${TD} text-center ${COLUNAS[8].classe ?? ''}`}>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: corS.bg, color: corS.cor }}>{corS.label}</span>
        </td>
      </tr>

      {expandido && (
        <tr style={{ backgroundColor: '#fafafa' }}>
          {/* +1 coluna pelo checkbox de seleção. */}
          <td colSpan={COLUNAS.length + 1} className="px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: '#160F41' }}>
                Alocação por cliente · soma {(somaPctClientes * 100).toFixed(1)}%
              </p>
              <button onClick={(e) => { e.stopPropagation(); onAbrirModal(); }}
                className="text-xs font-medium px-3 py-1 rounded text-white bg-gradient-brand">
                Editar folha &amp; alocação
              </button>
            </div>
            {atendidos.length === 0 ? (
              <p className="text-xs italic" style={{ color: '#6b6b8a' }}>Sem clientes alocados na função principal.</p>
            ) : (
              <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                {atendidos.map(cli => {
                  const pctKey = funcao ? (`pct_${funcao}` as keyof Cliente) : null;
                  const pct = (pctKey ? (cli[pctKey] as number | undefined) : 0) ?? 0;
                  return (
                    <div key={cli.nome_cliente} className="flex justify-between text-xs">
                      <span style={{ color: '#160F41' }}>{cli.nome_cliente}</span>
                      <span style={{ color: '#6b6b8a' }}>{(pct * 100).toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
