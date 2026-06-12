// --- Exportadores Excel (SheetJS) ---
// Gera planilhas .xlsx com NÚMEROS REAIS (não strings formatadas),
// permitindo somas, validações e fórmulas no Excel.

import * as XLSX from 'xlsx';
import type { DadosCliente } from '../../types';
import type { MM6Cliente } from '../../features/poupanca/usePoupanca';
import type { LinhaDetalhe } from '../../features/poupanca/PoupancaClienteDetalhe';
import type { Visao } from '../../features/poupanca/PoupancaTabela';
import { pickR, tombVisao } from '../../features/poupanca/DetalheTabela';

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
    'CUSTO INDIRETO', 'CUSTO DEDICADO', 'MARGEM CONTRIB.', 'EBITDA', 'MARGEM %',
    'IRPJ/CSLL', 'LUCRO LÍQUIDO',
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
      c.margem_contribuicao,
      c.ebitda,
      c.margem / 100,  // decimal pra Excel (5.5% → 0.055 → exibe "5.50%")
      c.impostos_lucro,
      c.lucro_liquido,
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
    soma('margem_contribuicao'),
    soma('ebitda'),
    margemMedia / 100,
    soma('impostos_lucro'),
    soma('lucro_liquido'),
    soma('receita_rebate'),
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);
  // Margem % = coluna 8 (0-based) após inserir MARGEM CONTRIB. (6); EBITDA→7.
  // Texto = colunas 0 (nome) e 12 (regime). Demais deslocadas +1.
  formatarCelulas(ws, 4, new Set([8]), new Set([0, 12]));

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
  linhas: LinhaDetalhe[],
  periodoLabel: string,
  visao: Visao,
  benchmarkPorMes: Record<string, number | null>,
  metaAutoFillGlobal: number | null,
): void {
  const wb = XLSX.utils.book_new();

  const mostrarGC = visao !== 'onshore';
  const mostrarImp = visao !== 'offshore';
  const isOff = visao === 'offshore';
  const benchmarkNome = isOff ? 'FED FUNDS %' : 'CDI %';
  const visaoLabel = visao === 'consolidado' ? 'Consolidado'
    : visao === 'onshore' ? 'Onshore' : 'Offshore';

  // Monta o cabeçalho conforme visão (espelha exatamente as colunas da tabela).
  const headers: string[] = ['MÊS/ANO', 'AUM INICIAL'];
  if (isOff) headers.push('AUM INICIAL USD');
  headers.push('NNM');
  if (isOff) headers.push('NNM USD');
  headers.push('TOMBAMENTO', 'POUP. LÍQ.', 'RENT. R$');
  if (isOff) headers.push('RENT. USD');
  if (mostrarImp) headers.push('IMPOSTOS');
  headers.push('RENT. %', benchmarkNome, 'SPREAD');
  if (mostrarGC) headers.push('G. CAMBIAL');
  if (isOff) headers.push('PTAX INI', 'PTAX FIN');
  headers.push('META', 'PROGRESSO');
  headers.push('AUM FINAL');
  if (isOff) headers.push('AUM FINAL USD');

  // Índices dinâmicos para formatação (percent vs moeda).
  const colsPct = new Set<number>();
  const colsTexto = new Set<number>([0]);  // Mês/Ano sempre texto
  let colIdx = 0;
  const idx = {
    mesAno: colIdx++,
    aumIni: colIdx++,
    aumIniUsd: isOff ? colIdx++ : -1,
    nnm: colIdx++,
    nnmUsd: isOff ? colIdx++ : -1,
    tomb: colIdx++,
    poupLiq: colIdx++,
    rentBrl: colIdx++,
    rentUsd: isOff ? colIdx++ : -1,
    imp: mostrarImp ? colIdx++ : -1,
    rentPct: colIdx++,
    benchmark: colIdx++,
    spread: colIdx++,
    gc: mostrarGC ? colIdx++ : -1,
    ptaxIni: isOff ? colIdx++ : -1,
    ptaxFin: isOff ? colIdx++ : -1,
    meta: colIdx++,
    progresso: colIdx++,
    aumFinal: colIdx++,
    aumFinalUsd: isOff ? colIdx++ : -1,
  };
  colsPct.add(idx.rentPct);
  colsPct.add(idx.benchmark);
  colsPct.add(idx.spread);
  colsPct.add(idx.progresso);

  const meses = [
    '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  const rows: (string | number | null)[][] = [];
  rows.push([`GALÁCTICOS CAPITAL — ${nomeCliente}`]);
  rows.push([`Período: ${periodoLabel} | Visão: ${visaoLabel}`]);
  rows.push([]);
  rows.push(headers);

  // Agregadores para a linha de TOTAL/MÉDIA (espelha o tfoot da tabela).
  let nnmTot = 0, tombTot = 0, rbTot = 0, gcTot = 0, metaTot = 0;
  let sumRp = 0, cRp = 0, sumBm = 0, cBm = 0, sumSp = 0, cSp = 0;
  let impTot = 0, temImp = false;
  let rentUsdTot = 0, nnmUsdTot = 0;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const r = l.r;
    const prevR = i > 0 ? linhas[i - 1].r : null;
    const d = pickR(r, visao, prevR);
    const chave = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
    const bm = benchmarkPorMes[chave] ?? null;
    const sp = bm != null && d.rp != null ? d.rp - bm : null;
    const tomb = tombVisao(r, visao);
    const poupLiq = d.nnm - tomb;
    const meta = r.meta_poupanca_mensal ?? metaAutoFillGlobal ?? null;
    const prog = meta && meta > 0 ? poupLiq / meta : null;

    const row: (string | number | null)[] = [];
    row[idx.mesAno] = `${meses[r.mes] ?? r.mes}/${r.ano}`;
    row[idx.aumIni] = d.pi || null;
    if (isOff) row[idx.aumIniUsd] = ('piUsd' in d ? d.piUsd : 0) || null;
    row[idx.nnm] = d.nnm;
    if (isOff) row[idx.nnmUsd] = ('nnmUsd' in d ? d.nnmUsd : 0) || null;
    row[idx.tomb] = tomb || null;
    row[idx.poupLiq] = poupLiq;
    row[idx.rentBrl] = d.rb;
    if (isOff) row[idx.rentUsd] = ('rentUsd' in d ? d.rentUsd : 0) || null;
    if (mostrarImp) row[idx.imp] = r.impostos_mes ?? null;
    row[idx.rentPct] = d.rp;
    row[idx.benchmark] = bm;
    row[idx.spread] = sp;
    if (mostrarGC) row[idx.gc] = l.ganhoCambial;
    if (isOff) {
      row[idx.ptaxIni] = ('ptaxIni' in d ? d.ptaxIni : null) ?? null;
      row[idx.ptaxFin] = ('ptaxFin' in d ? d.ptaxFin : null) ?? null;
    }
    row[idx.meta] = meta;
    row[idx.progresso] = prog;
    row[idx.aumFinal] = d.pf;
    if (isOff) row[idx.aumFinalUsd] = r.pl_offshore_usd ?? null;
    rows.push(row);

    nnmTot += d.nnm;
    tombTot += tomb;
    rbTot += d.rb;
    if (mostrarGC && l.ganhoCambial != null) gcTot += l.ganhoCambial;
    if (meta) metaTot += meta;
    if (d.rp != null) { sumRp += d.rp; cRp++; }
    if (bm != null) { sumBm += bm; cBm++; }
    if (sp != null) { sumSp += sp; cSp++; }
    if (mostrarImp && r.impostos_mes != null) { impTot += r.impostos_mes; temImp = true; }
    if (isOff) {
      if ('rentUsd' in d) rentUsdTot += d.rentUsd ?? 0;
      if ('nnmUsd' in d) nnmUsdTot += d.nnmUsd ?? 0;
    }
  }

  // Linha TOTAL / MÉDIA
  const totalRow: (string | number | null)[] = [];
  totalRow[idx.mesAno] = `TOTAL / MÉDIA (${linhas.length} ${linhas.length === 1 ? 'mês' : 'meses'})`;
  totalRow[idx.aumIni] = null;
  if (isOff) totalRow[idx.aumIniUsd] = null;
  totalRow[idx.nnm] = nnmTot;
  if (isOff) totalRow[idx.nnmUsd] = nnmUsdTot || null;
  totalRow[idx.tomb] = tombTot || null;
  totalRow[idx.poupLiq] = nnmTot - tombTot;
  totalRow[idx.rentBrl] = rbTot;
  if (isOff) totalRow[idx.rentUsd] = rentUsdTot || null;
  if (mostrarImp) totalRow[idx.imp] = temImp ? impTot : null;
  totalRow[idx.rentPct] = cRp > 0 ? sumRp / cRp : null;
  totalRow[idx.benchmark] = cBm > 0 ? sumBm / cBm : null;
  totalRow[idx.spread] = cSp > 0 ? sumSp / cSp : null;
  if (mostrarGC) totalRow[idx.gc] = gcTot;
  if (isOff) { totalRow[idx.ptaxIni] = null; totalRow[idx.ptaxFin] = null; }
  totalRow[idx.meta] = metaTot || null;
  totalRow[idx.progresso] = metaTot > 0 ? (nnmTot - tombTot) / metaTot : null;
  totalRow[idx.aumFinal] = null;
  if (isOff) totalRow[idx.aumFinalUsd] = null;
  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, headers);
  formatarCelulas(ws, 4, colsPct, colsTexto);

  const nomeAba = `${nomeCliente.substring(0, 25)} ${visaoLabel.substring(0, 4)}`.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  salvarWorkbook(wb, `${slugify(nomeCliente)}_${visao}_aum_${Date.now()}.xlsx`);
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
