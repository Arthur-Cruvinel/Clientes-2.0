// --- Orquestrador do período: roda DRE para todos os clientes em sequência ---
// Pré-calcula custo direto antes do DRE para que o rateio de indiretos use
// o pool somado correto. PL vem do RegistroPoupanca do período (CLAUDE.md).

import type {
  Cliente, Colaborador, CustoIndireto, ResultadoCliente, RegimeTributario,
  RegistroPoupanca,
} from '../types';
import { calcularCustoDireto, calcularCustoInstitucional } from './financials.custos';
import { calcularDRE } from './financials.dre';

export function processarPeriodo(
  clientes: Cliente[],
  colaboradores: Colaborador[],
  custosIndiretos: CustoIndireto[],
  registrosPoupanca: RegistroPoupanca[],
  regime: RegimeTributario,
): ResultadoCliente[] {
  // 1. Pré-calcular custo direto de cada cliente — necessário p/ rateio dos indiretos.
  const todosCustosDiretos: Record<string, number> = {};
  for (const c of clientes) {
    todosCustosDiretos[c.nome_cliente] = calcularCustoDireto(c, colaboradores);
  }

  // 2. Indexar poupança por nome_cliente para lookup O(1) por cliente.
  const poupancaPorNome = new Map<string, RegistroPoupanca>();
  for (const p of registrosPoupanca) poupancaPorNome.set(p.nome_cliente, p);

  // 3. DRE por cliente — passa o RegistroPoupanca correspondente (se houver).
  const resultados = clientes.map(c => {
    const poupanca = poupancaPorNome.get(c.nome_cliente);
    return calcularDRE(
      c, colaboradores, clientes, todosCustosDiretos, custosIndiretos, regime, poupanca,
    );
  });

  // 4. Auditoria.
  const totalCustoDireto = Object.values(todosCustosDiretos).reduce((s, v) => s + v, 0);
  const fixosGerais = custosIndiretos
    .filter(c => c.tipo_custo === 'geral')
    .reduce((s, c) => s + c.valor_mensal, 0);
  const institucional = calcularCustoInstitucional(colaboradores);
  const pureAssetCount = resultados.filter(r => r.perfil === 'pure_asset').length;
  const semPoupanca = clientes.filter(c => !poupancaPorNome.has(c.nome_cliente)).length;

  console.log(`[Pipeline] Clientes processados: ${resultados.length}`);
  console.log(`[Pipeline] Pure asset (excluídos do rateio geral): ${pureAssetCount}`);
  console.log(`[Pipeline] Sem RegistroPoupanca no período (rebate=0): ${semPoupanca}`);
  console.log(`[Pipeline] Custo direto total: ${totalCustoDireto.toFixed(2)}`);
  console.log(
    `[Pipeline] Pool indiretos gerais: ${(fixosGerais + institucional).toFixed(2)} `
    + `(fixos: ${fixosGerais.toFixed(2)} + institucional: ${institucional.toFixed(2)})`,
  );

  // 5. Ordenar por lucro líquido DESC.
  return resultados.sort((a, b) => b.lucro_liquido - a.lucro_liquido);
}
