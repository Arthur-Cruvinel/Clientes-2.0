// --- Exportadores Excel (SheetJS) ---
// Gera planilhas .xlsx com NÚMEROS REAIS (não strings formatadas),
// permitindo somas, validações e fórmulas no Excel.

import * as XLSX from 'xlsx';
import type { DadosCliente, RegistroPoupanca } from '../../types';
import type { MM6Cliente } from '../../features/poupanca/usePoupanca';
import { nnmReal } from '../financials';

// ============================================================
// Helpers
// ============================================================

function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function salvarWorkbook(wb: XLSX.WorkBook, nomeArquivo: string): void {
  XLSX.writeFile(wb, nomeArquivo);
}

function autoWidth(ws: XLSX.WorkSheet, headers: string[]): void {
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
}

/**
 * Aplica formatação numérica às células de dados de uma worksheet.
 * - Colunas de moeda: #,##0.00
 * - Colunas de percentual: 0.00%
 * Mantém cabeçalhos e título como texto.
 *
 * @param ws - Worksheet
 * @param primeiraLinhaData - Índice da primeira linha com dados (0-based)
 * @param colsPct - Índices das colunas que são percentual (0-based)
 * @param colsTexto - Índices das colunas que devem ficar como texto (0-based)
 */
function formatarCelulas(
  ws: XLSX.WorkSheet,
  primeiraLinhaData: number,
  colsPct: Set<number>,
  colsTexto: Set<number>,
): void {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = primeiraLinhaData; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      if (colsTexto.has(C)) continue;
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || typeof cell.v !== 'number') continue;
      cell.t = 'n'; // tipo numérico
      cell.z = colsPct.has(C) ? '0.00%' : '#,##0.00';
    }
  }
}

// ============================================================
// Visão Geral CFO
// ============================================================

export function exportVisaoGeralExcel(
  dados: DadosCliente[],
  periodo: string,
  regime: string,
): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    'CLIENTE', 'RECEITA BRUTA', 'IMPOSTOS FAT.', 'CUSTO DIRETO',
    'CUSTO INDIRETO', 'CUSTO DEDICADO', 'EBITDA', 'MARGEM %',
    'RECEITA REBATE', 'REGIME',
  ];

  const rows: (string | number | null)[][] = [];

  rows.push(['GALÁCTICOS CAPITAL — Visão Geral CFO']);
  rows.push([
    `Período: ${periodo} | Regime: ${regime} | Exportado em: ${new Date().toLocaleString('pt-BR')}`,
  ]);
  rows.push([]);
  rows.push(headers);

  for (const c of dados) {
    rows.push([
      c.nome_cliente,
      c.receita_bruta,
      c.impostos_faturamento,
      c.custo_direto,
      c.custo_indireto_rateado,
      c.custo_dedicado,
      c.ebitda,
      c.margem / 100,  // decimal pra Excel (5.5% → 0.055 → exibe "5.50%")
      c.receita_rebate,
      regime,
    ]);
  }

  // Totais
  const soma = (campo: keyof DadosCliente) =>
    dados.reduce((acc, c) => acc + (Number(c[campo]) || 0), 0);
  const margemMedia = dados.length > 0
    ? dados.reduce((acc, c) => acc + c.margem, 0) / dados.length
    : 0;

  rows.push([
    'TOTAL',
    soma('receita_bruta'),
    soma('impostos_faturamento'),
    soma('custo_direto'),
    soma('custo_indireto_rateado'),
    soma('custo_dedicado'),
    soma('ebitda'),
    margemMedia / 100,
    soma('receita_rebate'),
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);
  // Margem % = coluna 7 (0-based), Texto = colunas 0 (nome) e 9 (regime)
  formatarCelulas(ws, 4, new Set([7]), new Set([0, 9]));

  XLSX.utils.book_append_sheet(wb, ws, 'Visão Geral');
  salvarWorkbook(wb, `visao-geral_${periodo}_${Date.now()}.xlsx`);
}

// ============================================================
// AUM & Performance (tabela agregada)
// ============================================================

export function exportAumExcel(
  registros: Record<string, unknown>[],
  periodoLabel: string,
  visao: string,
): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    'CLIENTE', 'AUM INICIAL', 'NNM', 'TOMBAMENTO', 'NNM LÍQUIDO',
    'RENT. R$', 'IMPOSTOS', 'RENT. %', 'CDI %', 'SPREAD', 'G. CAMBIAL',
    'AUM FINAL', 'META', 'PROGRESSO %',
  ];

  const rows: (string | number | null)[][] = [];

  rows.push(['GALÁCTICOS CAPITAL — AUM & Performance']);
  rows.push([`Período: ${periodoLabel} | Visão: ${visao}`]);
  rows.push([]);
  rows.push(headers);

  for (const r of registros) {
    const imp = r.impostos != null ? Number(r.impostos) : null;
    const rentPct = Number(r.rent_pct ?? r.rentabilidade_pct ?? 0);
    const cdiPct = Number(r.cdi_pct ?? 0);
    const spreadPct = Number(r.spread ?? 0);
    const progressoPct = Number(r.progresso_pct ?? 0);
    rows.push([
      String(r.nome_cliente ?? r.cliente ?? ''),
      Number(r.aum_inicial ?? r.pl_inicial_total ?? 0),
      // Sem fallback bruto: o consumidor (PoupancaTabela) deve preencher r.nnm.
      // Se vier vazio, melhor exibir 0 do que silenciosamente usar bruto.
      Number(r.nnm ?? 0),
      Number(r.tombamento ?? r.nnm_tombamento ?? 0),
      Number(r.nnm_liquido ?? 0),
      Number(r.rent_rs ?? r.rentabilidade_total ?? 0),
      imp != null && imp > 0 ? imp : null,
      rentPct / 100,      // decimal pra formato Excel %
      cdiPct / 100,
      spreadPct / 100,
      // null = indisponível (cliente onshore-only / primeiro mês sem prev) →
      // célula vazia. 0 = calculado e zero (PTAX inalterada) → renderiza '0'.
      r.ganho_cambial == null ? null : Number(r.ganho_cambial),
      Number(r.aum_final ?? r.pl_total ?? 0),
      Number(r.meta ?? r.meta_poupanca_mensal ?? 0),
      progressoPct / 100,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);
  // Colunas %: 7=Rent%, 8=CDI%, 9=Spread, 13=Progresso%  |  Texto: 0=Nome
  formatarCelulas(ws, 4, new Set([7, 8, 9, 13]), new Set([0]));

  XLSX.utils.book_append_sheet(wb, ws, 'AUM & Performance');
  salvarWorkbook(wb, `aum-performance_${periodoLabel}_${Date.now()}.xlsx`);
}

// ============================================================
// Histórico individual (cliente)
// ============================================================

export function exportClienteAumExcel(
  nomeCliente: string,
  registros: RegistroPoupanca[],
  periodoLabel: string,
): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    'MÊS/ANO', 'AUM INICIAL', 'NNM', 'TOMBAMENTO', 'RENT. R$',
    'RENT. %', 'CDI %', 'SPREAD', 'G. CAMBIAL', 'AUM FINAL', 'META',
  ];

  const meses = [
    '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  const rows: (string | number | null)[][] = [];

  rows.push([`GALÁCTICOS CAPITAL — ${nomeCliente}`]);
  rows.push([`Período: ${periodoLabel}`]);
  rows.push([]);
  rows.push(headers);

  for (const r of registros) {
    rows.push([
      `${meses[r.mes] ?? r.mes}/${r.ano}`,
      r.pl_inicial_total ?? 0,
      nnmReal(r),  // NNM Real (desconta transferência interna)
      r.nnm_tombamento ?? 0,
      r.rentabilidade_total ?? 0,
      (r.rentabilidade_pct ?? 0) * 100 / 100,  // já é decimal → manter pra Excel %
      null, // CDI
      null, // Spread
      null, // Ganho cambial
      r.pl_total,
      r.meta_poupanca_mensal ?? 0,
    ]);
  }

  // Totais
  const somaNum = (campo: keyof RegistroPoupanca) =>
    registros.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0);

  rows.push([
    'TOTAL',
    null,
    registros.reduce((acc, r) => acc + nnmReal(r), 0),
    somaNum('nnm_tombamento'),
    somaNum('rentabilidade_total'),
    null, null, null, null,
    null,
    null,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);
  // Colunas %: 5=Rent%, 6=CDI%, 7=Spread  |  Texto: 0=Mês/Ano
  formatarCelulas(ws, 4, new Set([5, 6, 7]), new Set([0]));

  const nomeAba = nomeCliente.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  salvarWorkbook(wb, `${slugify(nomeCliente)}_aum_${Date.now()}.xlsx`);
}

// ============================================================
// Burn Rate (drilldown MM6)
// ============================================================

export function exportBurnRateExcel(
  clientes: MM6Cliente[],
  periodoLabel: string,
  anoFim: number,
): void {
  const wb = XLSX.utils.book_new();
  const headers = [
    'CLIENTE', 'PL ATUAL', 'MM6 RENT R$/MÊS', 'MM6 TAXA %/MÊS',
    'MM6 NNM LÍQ./MÊS', 'VARIAÇÃO MM6', 'SPREAD vs CDI', 'MESES HIST.',
    `PL PROJ. DEZ/${anoFim}`, `META INDIV. DEZ/${anoFim}`, 'CAPACIDADE FONTE',
    'GAP META INDIV.', 'SEVERIDADE', 'EM BURN', 'REBATE EM RISCO',
  ];
  const rows: (string | number | null)[][] = [];
  rows.push([`GALÁCTICOS CAPITAL — Burn Rate (${periodoLabel})`]);
  rows.push([`Critério: variacao_mm6 < 0 (NNM líq. + Rent. BRL dos últimos 6 meses)`]);
  rows.push([]);
  rows.push(headers);
  for (const c of clientes) {
    rows.push([
      c.nome_cliente,
      c.pl_atual,
      c.mm6_rent_brl,
      c.mm6_rent_pct,         // decimal — coluna formatada como %
      c.mm6_nnm_liquido,
      c.variacao_mm6,
      c.spread,               // razão pura, não %
      c.n_meses,
      c.pl_projetado_fim_ano,
      c.meta_individual ?? null,
      c.capacidade_fonte,
      c.gap_meta_individual ?? null,
      c.severidade ?? '',
      c.em_burn ? 'sim' : 'não',
      c.rebate_em_risco,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);
  // Coluna 3 = Taxa %  |  Texto: 0=Cliente, 10=Fonte, 12=Severidade, 13=EmBurn
  formatarCelulas(ws, 4, new Set([3]), new Set([0, 10, 12, 13]));
  XLSX.utils.book_append_sheet(wb, ws, 'Burn Rate');
  salvarWorkbook(wb, `burn-rate_${slugify(periodoLabel)}_${Date.now()}.xlsx`);
}

// ============================================================
// Projeção AUM (drilldown MM6)
// ============================================================

export function exportProjecaoExcel(
  clientes: MM6Cliente[],
  periodoLabel: string,
  anoFim: number,
): void {
  const wb = XLSX.utils.book_new();
  const headers = [
    'CLIENTE', 'PL ATUAL', 'MM6 RENT %/MÊS', 'MM6 NNM LÍQ./MÊS',
    'MM6 NNM BRUTO', 'MM6 TOMB.', 'CAPACIDADE ESPERADA', 'CAPACIDADE FONTE',
    'MM6 CDI %/MÊS', 'SPREAD', 'MESES HIST.',
    `PL PROJ. DEZ/${anoFim}`, `META INDIV. DEZ/${anoFim}`, 'GAP META INDIV.', 'STATUS',
  ];
  const rows: (string | number | null)[][] = [];
  rows.push([`GALÁCTICOS CAPITAL — Projeção AUM Dez/${anoFim} (${periodoLabel})`]);
  rows.push([`Modelo: PL[t] = PL[t-1] × (1 + CDI_proj × spread) + MM6_NNM`]);
  rows.push([]);
  rows.push(headers);
  for (const c of clientes) {
    const status = c.em_burn ? 'Em burn'
      : c.meta_individual == null ? 'Sem meta'
      : (c.gap_meta_individual ?? 0) > 0 ? 'Acima da meta' : 'Abaixo da meta';
    rows.push([
      c.nome_cliente,
      c.pl_atual,
      c.mm6_rent_pct,
      c.mm6_nnm_liquido,
      c.mm6_nnm_bruto,
      c.mm6_tombamento,
      c.capacidade_esperada,
      c.capacidade_fonte,
      c.mm6_cdi_pct,
      c.spread,
      c.n_meses,
      c.pl_projetado_fim_ano,
      c.meta_individual ?? null,
      c.gap_meta_individual ?? null,
      status,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);
  // Cols % (decimal Excel): 2=Rent%, 8=CDI%  |  Texto: 0=Cliente, 7=Fonte, 14=Status
  formatarCelulas(ws, 4, new Set([2, 8]), new Set([0, 7, 14]));
  XLSX.utils.book_append_sheet(wb, ws, 'Projeção');
  salvarWorkbook(wb, `projecao-aum_${slugify(periodoLabel)}_${Date.now()}.xlsx`);
}
