// --- Helpers do módulo Alocação em Lote ---

import { FUNCOES_ALOCACAO } from '../../utils/constants';
import type { Cliente, FuncaoAlocacao } from '../../types';

const MAPA_FUNCAO: Record<string, FuncaoAlocacao> = {
  Gestor: 'consultoria_gestao', Coordenador: 'consultoria_planejamento',
  Consultor: 'consultoria_financeira', Operador: 'operacional_financeiro',
  Administrativo: 'serv_adm', AuxAdm: 'serv_aux_adm',
};
export function normalizarFuncao(f: string): FuncaoAlocacao | null {
  if ((FUNCOES_ALOCACAO as readonly string[]).includes(f)) return f as FuncaoAlocacao;
  return MAPA_FUNCAO[f] ?? null;
}

/** Redistribui pcts dos não-travados proporcionalmente ao espaço restante. */
export function redistribuir(
  base: Record<string, number>,
  travados: Set<string>,
  clientes: Cliente[],
  percentualAlocavel: number,
): Record<string, number> {
  const somaTravados = clientes
    .filter(c => travados.has(c.nome_cliente))
    .reduce((s, c) => s + (base[c.nome_cliente] ?? 0), 0);
  const espaco = Math.max(0, percentualAlocavel - somaTravados);
  const naoTravados = clientes.filter(c => !travados.has(c.nome_cliente));
  const somaAtual = naoTravados.reduce((s, c) => s + (base[c.nome_cliente] ?? 0), 0);
  const result = { ...base };
  for (const c of naoTravados) {
    if (somaAtual > 0) result[c.nome_cliente] = (base[c.nome_cliente] ?? 0) / somaAtual * espaco;
    else if (naoTravados.length > 0) result[c.nome_cliente] = espaco / naoTravados.length;
  }
  return result;
}
