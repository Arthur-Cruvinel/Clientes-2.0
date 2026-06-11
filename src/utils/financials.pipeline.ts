// --- Orquestrador do período: roda DRE para todos os clientes em sequência ---
// Pré-calcula custo direto antes do DRE para que o rateio de indiretos use
// o pool somado correto. PL vem do RegistroPoupanca do período (CLAUDE.md).

import type {
  Cliente, Colaborador, CustoIndireto, ResultadoCliente, RegimeTributario,
  RegistroPoupanca,
} from '../types';
import type { Vinculo } from '../types/vinculo';
import {
  calcularCustoDireto, calcularCustoInstitucional, somarPctPorColaborador,
} from './financials.custos';
import { calcularFatorNormalizacao, calcularOciosidade } from './financials.alocacao';
import { calcularDRE } from './financials.dre';
import type { AliquotasRebate } from './financials.receita';

export function processarPeriodo(
  clientes: Cliente[],
  colaboradores: Colaborador[],
  custosIndiretos: CustoIndireto[],
  registrosPoupanca: RegistroPoupanca[],
  regime: RegimeTributario,
  // Vínculos do período (Fase 2.5 — Peça 5). Opcional para retrocompat com
  // chamadas isoladas (testes, simulador). Default [] = pipeline cai sempre
  // no fallback legado (campo do cliente), comportamento idêntico ao pré-Peça 5.
  vinculos: Vinculo[] = [],
  // Alíquotas globais de retenção do rebate por perna (parametros/global).
  // Opcional: sem isto, calcularReceita usa os defaults constantes (nunca 0).
  aliquotasRebate?: AliquotasRebate,
): ResultadoCliente[] {
  // 0. Pré-passe por colaborador (regra CFO): normalização da sobre-alocação +
  // ociosidade da folga. Computados UMA vez e propagados ao DRE.
  //   - fatorNorm: Σpct>alocavel → alocavel/Σpct (pcts viram pesos); senão 1.
  //   - poolNaoAlocado = institucional + ociosidade (folha não distribuída).
  // INVARIANTE: folha ≡ direto(normalizado) + institucional + ociosidade.
  const somaPct = somarPctPorColaborador(clientes, colaboradores, vinculos);
  const fatorNorm = calcularFatorNormalizacao(colaboradores, somaPct);
  const ociosidade = calcularOciosidade(colaboradores, somaPct);
  const poolNaoAlocado = calcularCustoInstitucional(colaboradores) + ociosidade;

  // 1. Pré-calcular custo direto de cada cliente (já normalizado) — necessário
  // p/ rateio dos indiretos.
  const todosCustosDiretos: Record<string, number> = {};
  for (const c of clientes) {
    todosCustosDiretos[c.nome_cliente] = calcularCustoDireto(c, colaboradores, vinculos, fatorNorm);
  }

  // 2. Indexar poupança por nome_cliente para lookup O(1) por cliente.
  const poupancaPorNome = new Map<string, RegistroPoupanca>();
  for (const p of registrosPoupanca) poupancaPorNome.set(p.nome_cliente, p);

  // 3. DRE por cliente — passa o RegistroPoupanca correspondente (se houver).
  const resultados = clientes.map(c => {
    const poupanca = poupancaPorNome.get(c.nome_cliente);
    return calcularDRE(
      c, colaboradores, clientes, todosCustosDiretos, custosIndiretos, regime, poupanca, vinculos,
      fatorNorm, poolNaoAlocado, aliquotasRebate,
    );
  });

  // 4. Auditoria.
  const totalCustoDireto = Object.values(todosCustosDiretos).reduce((s, v) => s + v, 0);
  const fixosGerais = custosIndiretos
    .filter(c => c.tipo_custo === 'geral')
    .reduce((s, c) => s + c.valor_mensal, 0);
  const institucional = calcularCustoInstitucional(colaboradores);
  const folha = colaboradores.reduce((s, c) => s + (c.custo_total_mensal ?? 0), 0);
  const pureAssetCount = resultados.filter(r => r.perfil === 'pure_asset').length;
  const semPoupanca = clientes.filter(c => !poupancaPorNome.has(c.nome_cliente)).length;

  console.log(`[Pipeline] Clientes processados: ${resultados.length}`);
  console.log(`[Pipeline] Pure asset (excluídos do rateio geral): ${pureAssetCount}`);
  console.log(`[Pipeline] Sem RegistroPoupanca no período (rebate=0): ${semPoupanca}`);
  console.log(`[Pipeline] Custo direto total: ${totalCustoDireto.toFixed(2)}`);
  console.log(
    `[Pipeline] Pool indiretos gerais: ${(fixosGerais + poolNaoAlocado).toFixed(2)} `
    + `(fixos: ${fixosGerais.toFixed(2)} + institucional: ${institucional.toFixed(2)} `
    + `+ ociosidade: ${ociosidade.toFixed(2)})`,
  );
  // Invariante CFO: folha ≡ direto(normalizado) + institucional + ociosidade.
  const conferencia = totalCustoDireto + institucional + ociosidade;
  console.log(
    `[Pipeline] Invariante folha=${folha.toFixed(2)} ≟ direto+inst+ociosidade=`
    + `${conferencia.toFixed(2)} (Δ=${(folha - conferencia).toFixed(2)})`,
  );

  // 5. Ordenar por lucro líquido DESC.
  return resultados.sort((a, b) => b.lucro_liquido - a.lucro_liquido);
}
