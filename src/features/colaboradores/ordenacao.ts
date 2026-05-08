// --- Ordenação da tabela de Colaboradores ---
// Status fica de fora — é derivado da ocupação.

import type { ColaboradorDerivado } from './useColaboradores';

export type ChaveOrdenacao =
  | 'nome_colaborador' | 'cargo' | 'localidade' | 'funcao_principal'
  | 'custo_total_mensal' | 'percentual_alocavel' | 'ocupacao';

export interface Ordenacao {
  coluna: ChaveOrdenacao;
  direcao: 'asc' | 'desc';
}

/** Mapeia chave da coluna (COLUNAS[i].chave) para a chave de ordenação.
 *  Colunas ausentes deste mapa não são ordenáveis (Vínculo e Status). */
export const CHAVE_ORD: Partial<Record<string, ChaveOrdenacao>> = {
  nome: 'nome_colaborador', cargo: 'cargo', localidade: 'localidade',
  funcao: 'funcao_principal', custo_total: 'custo_total_mensal',
  pct_alocavel: 'percentual_alocavel', ocupacao: 'ocupacao',
};

export function compararDerivados(o: Ordenacao) {
  const dir = o.direcao === 'asc' ? 1 : -1;
  return (a: ColaboradorDerivado, b: ColaboradorDerivado): number => {
    const ca = a.colaborador, cb = b.colaborador;
    switch (o.coluna) {
      case 'nome_colaborador': return ca.nome_colaborador.localeCompare(cb.nome_colaborador, 'pt-BR') * dir;
      case 'cargo':            return (ca.cargo ?? '').localeCompare(cb.cargo ?? '', 'pt-BR') * dir;
      case 'localidade':       return (ca.localidade ?? '').localeCompare(cb.localidade ?? '') * dir;
      case 'funcao_principal': return (ca.funcao_principal ?? '').localeCompare(cb.funcao_principal ?? '') * dir;
      case 'custo_total_mensal':  return (a.custoTotalMensal - b.custoTotalMensal) * dir;
      case 'percentual_alocavel': return (ca.percentual_alocavel - cb.percentual_alocavel) * dir;
      case 'ocupacao':            return (a.ocupacao - b.ocupacao) * dir;
      default: return 0;
    }
  };
}
