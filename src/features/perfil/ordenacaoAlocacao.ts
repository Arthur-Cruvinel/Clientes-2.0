// --- Ordenação da tabela de Alocação em Lote ---
// Mesmo padrão do features/colaboradores/ordenacao.ts (CLAUDE.md regra 10).

import type { Cliente } from '../../types';
import type { OrdenacaoState } from '../../components/ui/HeaderOrdenavel';
import { horasReaisPorCliente } from '../../utils/financials.alocacao';

export type ChaveOrdAlocacao =
  | 'nome_cliente' | 'pacote_servico' | 'pct_atual'
  | 'novo_pct' | 'horas_efetivas';

export type OrdenacaoAlocacao = OrdenacaoState<ChaveOrdAlocacao>;

// funcao/percentualAlocavel saíram do Contexto: o comparador deixou de lê-los
// (a ordenação por escopo saiu no Bloco 1; "horas_efetivas" agora usa a base
// canônica pct × 164, sem percentual_alocavel).
interface Contexto {
  pctEditado: Record<string, number>;
  pctOriginal: Record<string, number>;
}

export function compararClientes(o: OrdenacaoAlocacao, ctx: Contexto) {
  const dir = o.direcao === 'asc' ? 1 : -1;
  const horasDe = (cli: Cliente) =>
    horasReaisPorCliente(ctx.pctEditado[cli.nome_cliente] ?? 0);
  return (a: Cliente, b: Cliente): number => {
    switch (o.coluna) {
      case 'nome_cliente':   return a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR') * dir;
      case 'pacote_servico': return (a.pacote_servico ?? '').localeCompare(b.pacote_servico ?? '') * dir;
      case 'pct_atual':      return ((ctx.pctOriginal[a.nome_cliente] ?? 0) - (ctx.pctOriginal[b.nome_cliente] ?? 0)) * dir;
      case 'novo_pct':       return ((ctx.pctEditado[a.nome_cliente] ?? 0) - (ctx.pctEditado[b.nome_cliente] ?? 0)) * dir;
      case 'horas_efetivas': return (horasDe(a) - horasDe(b)) * dir;
      default: return 0;
    }
  };
}
