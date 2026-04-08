// --- Exportadores Excel (SheetJS) ---
// Gera planilhas .xlsx formatadas para Visão Geral, AUM e histórico individual.

import * as XLSX from 'xlsx';
import type { DadosCliente, RegistroPoupanca } from '../../types';

// ============================================================
// Helpers
// ============================================================

/** Remove acentos e caracteres especiais, substituindo por hífens */
function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Formata número como moeda BRL para exibição na planilha */
function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata número como percentual */
function pct(valor: number, decimais = 1): string {
  return `${valor.toFixed(decimais).replace('.', ',')}%`;
}

/** Dispara o download de um workbook */
function salvarWorkbook(wb: XLSX.WorkBook, nomeArquivo: string): void {
  XLSX.writeFile(wb, nomeArquivo);
}

/** Configura largura das colunas com base nos cabeçalhos */
function autoWidth(ws: XLSX.WorkSheet, headers: string[]): void {
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
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

  const rows: (string | number)[][] = [];

  // Título
  rows.push(['GALÁCTICOS CAPITAL — Visão Geral CFO']);
  rows.push([
    `Período: ${periodo} | Regime: ${regime} | Exportado em: ${new Date().toLocaleString('pt-BR')}`,
  ]);
  rows.push([]); // linha vazia
  rows.push(headers);

  // Dados
  for (const c of dados) {
    rows.push([
      c.nome_cliente,
      brl(c.receita_bruta),
      brl(c.impostos_faturamento),
      brl(c.custo_direto),
      brl(c.custo_indireto_rateado),
      brl(c.custo_dedicado),
      brl(c.ebitda),
      pct(c.margem),
      brl(c.receita_rebate),
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
    brl(soma('receita_bruta')),
    brl(soma('impostos_faturamento')),
    brl(soma('custo_direto')),
    brl(soma('custo_indireto_rateado')),
    brl(soma('custo_dedicado')),
    brl(soma('ebitda')),
    pct(margemMedia),
    brl(soma('receita_rebate')),
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);

  XLSX.utils.book_append_sheet(wb, ws, 'Visão Geral');
  salvarWorkbook(wb, `visao-geral_${periodo}_${Date.now()}.xlsx`);
}

// ============================================================
// AUM & Performance (tabela agregada)
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportAumExcel(
  registros: Record<string, unknown>[],
  periodoLabel: string,
  visao: string,
): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    'CLIENTE', 'AUM INICIAL', 'NNM', 'TOMBAMENTO', 'NNM LÍQUIDO',
    'RENT. R$', 'RENT. %', 'CDI %', 'SPREAD', 'G. CAMBIAL',
    'AUM FINAL', 'META', 'PROGRESSO %',
  ];

  const rows: (string | number)[][] = [];

  rows.push(['GALÁCTICOS CAPITAL — AUM & Performance']);
  rows.push([`Período: ${periodoLabel} | Visão: ${visao}`]);
  rows.push([]);
  rows.push(headers);

  for (const r of registros) {
    rows.push([
      String(r.nome_cliente ?? r.cliente ?? ''),
      brl(Number(r.aum_inicial ?? r.pl_inicial_total ?? 0)),
      brl(Number(r.nnm ?? r.aporte_mes_total ?? 0)),
      brl(Number(r.tombamento ?? r.nnm_tombamento ?? 0)),
      brl(Number(r.nnm_liquido ?? 0)),
      brl(Number(r.rent_rs ?? r.rentabilidade_total ?? 0)),
      pct(Number(r.rent_pct ?? r.rentabilidade_pct ?? 0)),
      pct(Number(r.cdi_pct ?? 0)),
      pct(Number(r.spread ?? 0)),
      brl(Number(r.ganho_cambial ?? 0)),
      brl(Number(r.aum_final ?? r.pl_total ?? 0)),
      brl(Number(r.meta ?? r.meta_poupanca_mensal ?? 0)),
      pct(Number(r.progresso_pct ?? 0)),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);

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

  const rows: (string | number)[][] = [];

  rows.push([`GALÁCTICOS CAPITAL — ${nomeCliente}`]);
  rows.push([`Período: ${periodoLabel}`]);
  rows.push([]);
  rows.push(headers);

  for (const r of registros) {
    rows.push([
      `${meses[r.mes] ?? r.mes}/${r.ano}`,
      brl(r.pl_inicial_total ?? 0),
      brl(r.aporte_mes_total),
      brl(r.nnm_tombamento ?? 0),
      brl(r.rentabilidade_total ?? 0),
      pct(r.rentabilidade_pct ?? 0, 2),
      '', // CDI — preenchido pelo consumidor se disponível
      '', // Spread
      '', // Ganho cambial
      brl(r.pl_total),
      brl(r.meta_poupanca_mensal ?? 0),
    ]);
  }

  // Totais
  const somaNum = (campo: keyof RegistroPoupanca) =>
    registros.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0);

  rows.push([
    'TOTAL',
    '',
    brl(somaNum('aporte_mes_total')),
    brl(somaNum('nnm_tombamento')),
    brl(somaNum('rentabilidade_total')),
    '', '', '', '',
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);

  // Nome da aba: máximo 31 caracteres (limitação do Excel)
  const nomeAba = nomeCliente.substring(0, 31);

  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  salvarWorkbook(wb, `${slugify(nomeCliente)}_aum_${Date.now()}.xlsx`);
}
