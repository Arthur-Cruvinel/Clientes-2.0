// --- Ordenação da tabela de Alocação em Lote ---
// Mesmo padrão do features/colaboradores/ordenacao.ts (CLAUDE.md regra 10).

import type { Cliente, FuncaoAlocacao } from '../../types';
import type { OrdenacaoState } from '../../components/ui/HeaderOrdenavel';
import { HORAS_CLT_MES, HORAS_PACOTE } from '../../utils/constants';

export type ChaveOrdAlocacao =
  | 'nome_cliente' | 'pacote_servico' | 'pct_atual'
  | 'novo_pct' | 'horas_efetivas' | 'fator';

export type OrdenacaoAlocacao = OrdenacaoState<ChaveOrdAlocacao>;

interface Contexto {
  funcao: FuncaoAlocacao | null;
  pctEditado: Record<string, number>;
  pctOriginal: Record<string, number>;
  percentualAlocavel: number;
}

export function compararClientes(o: OrdenacaoAlocacao, ctx: Contexto) {
  const dir = o.direcao === 'asc' ? 1 : -1;
  const fatorDe = (cli: Cliente) => {
    if (!ctx.funcao) return 0;
    const pct = ctx.pctEditado[cli.nome_cliente] ?? 0;
    const ref = (HORAS_PACOTE[cli.pacote_servico]?.[ctx.funcao] ?? 0) / HORAS_CLT_MES;
    return ref > 0 ? pct / ref : 0;
  };
  const horasDe = (cli: Cliente) =>
    (ctx.pctEditado[cli.nome_cliente] ?? 0) * HORAS_CLT_MES * ctx.percentualAlocavel;
  return (a: Cliente, b: Cliente): number => {
    switch (o.coluna) {
      case 'nome_cliente':   return a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR') * dir;
      case 'pacote_servico': return (a.pacote_servico ?? '').localeCompare(b.pacote_servico ?? '') * dir;
      case 'pct_atual':      return ((ctx.pctOriginal[a.nome_cliente] ?? 0) - (ctx.pctOriginal[b.nome_cliente] ?? 0)) * dir;
      case 'novo_pct':       return ((ctx.pctEditado[a.nome_cliente] ?? 0) - (ctx.pctEditado[b.nome_cliente] ?? 0)) * dir;
      case 'horas_efetivas': return (horasDe(a) - horasDe(b)) * dir;
      case 'fator':          return (fatorDe(a) - fatorDe(b)) * dir;
      default: return 0;
    }
  };
}
