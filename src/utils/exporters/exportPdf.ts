// --- Exportadores PDF (jsPDF + autoTable) ---
// Gera relatórios .pdf formatados com identidade visual Galácticos Capital.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DadosCliente } from '../../types';
import type { MM6Cliente } from '../../features/poupanca/usePoupanca';
import type { LinhaDetalhe } from '../../features/poupanca/PoupancaClienteDetalhe';
import type { Visao } from '../../features/poupanca/PoupancaTabela';
import { pickR, tombVisao } from '../../features/poupanca/DetalheTabela';

// ============================================================
// Constantes visuais
// ============================================================

const COR_HEADER = '#160F41';
const COR_GRAD_INICIO = '#0065FF';
const COR_GRAD_FIM = '#D000BB';
const COR_NEGATIVO = '#dc2626';
const COR_POSITIVO = '#16a34a';
const COR_LINHA_ALT = '#f8f9fc';
const COR_TOTAL_BG = '#f1f5f9';

/** Formata número como moeda BRL */
function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata percentual */
function pct(valor: number, decimais = 1): string {
  return `${valor.toFixed(decimais).replace('.', ',')}%`;
}

/** Retorna timestamp brasileiro formatado */
function agora(): string {
  return new Date().toLocaleString('pt-BR');
}

// ============================================================
// Header padrão em todas as páginas
// ============================================================

function desenharHeader(
  doc: jsPDF,
  titulo: string,
  subtitulo: string,
  infoDir: string,
): number {
  const pageW = doc.internal.pageSize.getWidth();

  // Fundo escuro
  doc.setFillColor(COR_HEADER);
  doc.rect(0, 0, pageW, 20, 'F');

  // Texto esquerda
  doc.setTextColor('#ffffff');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('GALÁCTICOS CAPITAL', 10, 9);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(titulo, 10, 16);

  // Texto direita
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255, 180);
  doc.text(infoDir, pageW - 10, 12, { align: 'right' });

  // Linha gradiente decorativa (simulada com dois segmentos)
  const yLinha = 20.5;
  doc.setDrawColor(COR_GRAD_INICIO);
  doc.setLineWidth(0.8);
  doc.line(0, yLinha, pageW / 2, yLinha);
  doc.setDrawColor(COR_GRAD_FIM);
  doc.line(pageW / 2, yLinha, pageW, yLinha);

  // Subtítulo
  doc.setTextColor('#374151');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(subtitulo, 10, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#9ca3af');
  doc.text(`Exportado em: ${agora()}`, 10, 33);

  return 37; // Y onde começa o conteúdo
}

// ============================================================
// Footer padrão
// ============================================================

function desenharFooter(doc: jsPDF): void {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const totalPaginas = doc.getNumberOfPages();

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);

    // Linha separadora
    doc.setDrawColor('#e5e7eb');
    doc.setLineWidth(0.3);
    doc.line(10, pageH - 12, pageW - 10, pageH - 12);

    // Texto
    doc.setFontSize(7);
    doc.setTextColor('#94a3b8');
    doc.text('Galácticos Capital — Confidencial — Uso Interno', 10, pageH - 7);
    doc.text(`Página ${i} de ${totalPaginas}`, pageW - 10, pageH - 7, { align: 'right' });
  }
}

// ============================================================
// Visão Geral CFO
// ============================================================

export function exportVisaoGeralPdf(
  dados: DadosCliente[],
  periodo: string,
  regime: string,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const startY = desenharHeader(
    doc,
    'Visão Geral CFO',
    'Demonstrativo de Resultado por Cliente',
    `${periodo} | ${regime}`,
  );

  // Cabeçalhos da tabela
  const head = [[
    'Cliente', 'Receita Bruta', 'Impostos Fat.', 'Custo Direto',
    'Custo Indireto', 'Custo Dedicado', 'Mg. Contrib.', 'EBITDA', 'Margem %',
    'IRPJ/CSLL', 'Lucro Líq.', 'Mg. Líq. %',
    'Receita Rebate', 'Regime', 'Jurídico',
  ]];

  // Corpo
  const body = dados.map((c) => [
    c.nome_cliente,
    brl(c.receita_bruta),
    brl(c.impostos_faturamento),
    brl(c.custo_direto),
    brl(c.custo_indireto_rateado),
    brl(c.custo_dedicado),
    brl(c.margem_contribuicao),
    brl(c.ebitda),
    pct(c.margem),
    brl(c.impostos_lucro),
    brl(c.lucro_liquido),
    pct(c.margem_liquida),
    brl(c.receita_rebate),
    regime,
    c.utiliza_servico_juridico ? 'Sim' : 'Não',
  ]);

  // Totais
  const soma = (campo: keyof DadosCliente) =>
    dados.reduce((acc, c) => acc + (Number(c[campo]) || 0), 0);
  const margemMedia = dados.length > 0
    ? dados.reduce((acc, c) => acc + c.margem, 0) / dados.length
    : 0;
  const margemLiqMedia = dados.length > 0
    ? dados.reduce((acc, c) => acc + c.margem_liquida, 0) / dados.length
    : 0;

  const foot = [[
    'TOTAL',
    brl(soma('receita_bruta')),
    brl(soma('impostos_faturamento')),
    brl(soma('custo_direto')),
    brl(soma('custo_indireto_rateado')),
    brl(soma('custo_dedicado')),
    brl(soma('margem_contribuicao')),
    brl(soma('ebitda')),
    pct(margemMedia),
    brl(soma('impostos_lucro')),
    brl(soma('lucro_liquido')),
    pct(margemLiqMedia),
    brl(soma('receita_rebate')),
    '',
    '',
  ]];

  autoTable(doc, {
    startY,
    head,
    body,
    foot,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: COR_HEADER,
      textColor: '#ffffff',
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: COR_TOTAL_BG,
      textColor: '#1f2937',
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: COR_LINHA_ALT },
    didParseCell(data) {
      // Colorir EBITDA e Margem
      if (data.section === 'body') {
        const colIdx = data.column.index;
        const valor = dados[data.row.index];
        if (!valor) return;

        // Mg. Contribuição (col 6) — inserida antes do EBITDA, desloca as demais +1
        if (colIdx === 6) {
          data.cell.styles.textColor = valor.margem_contribuicao >= 0 ? COR_POSITIVO : COR_NEGATIVO;
        }
        // EBITDA (col 7)
        if (colIdx === 7) {
          data.cell.styles.textColor = valor.ebitda >= 0 ? COR_POSITIVO : COR_NEGATIVO;
        }
        // Margem % (col 8)
        if (colIdx === 8) {
          data.cell.styles.textColor = valor.margem >= 0 ? COR_POSITIVO : COR_NEGATIVO;
        }
        // Lucro Líquido (col 10) e Mg. Líq. % (col 11)
        if (colIdx === 10 || colIdx === 11) {
          data.cell.styles.textColor = valor.lucro_liquido >= 0 ? COR_POSITIVO : COR_NEGATIVO;
        }
      }
    },
  });

  desenharFooter(doc);
  doc.save(`visao-geral_${periodo}_${Date.now()}.pdf`);
}

// ============================================================
// AUM & Performance
// ============================================================

export function exportAumPdf(
  registros: Record<string, unknown>[],
  periodoLabel: string,
  visao: string,
  totais: {
    aumTotal?: number;
    nnmTotal?: number;
    rentMedia?: number;
    clientesPoupando?: number;
  },
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  let startY = desenharHeader(
    doc,
    'AUM & Performance',
    'Relatório Consolidado de Patrimônio',
    `${periodoLabel} | ${visao}`,
  );

  // Bloco de KPIs (4 boxes)
  const kpis = [
    { label: 'AUM Total', valor: brl(totais.aumTotal ?? 0) },
    { label: 'NNM Total', valor: brl(totais.nnmTotal ?? 0) },
    { label: 'Rent. Média', valor: pct(totais.rentMedia ?? 0) },
    { label: 'Clientes Poupando', valor: String(totais.clientesPoupando ?? 0) },
  ];

  const boxW = (pageW - 20 - 15) / 4; // 4 boxes com gap
  kpis.forEach((kpi, i) => {
    const x = 10 + i * (boxW + 5);
    doc.setFillColor('#f8f9fc');
    doc.roundedRect(x, startY, boxW, 14, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor('#6b7280');
    doc.text(kpi.label, x + 4, startY + 5);
    doc.setFontSize(10);
    doc.setTextColor('#1f2937');
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.valor, x + 4, startY + 11);
    doc.setFont('helvetica', 'normal');
  });

  startY += 20;

  // Tabela
  const head = [[
    'Cliente', 'AUM Inicial', 'NNM', 'Tombamento', 'NNM Líquido',
    'Rent. R$', 'Impostos', 'Rent. %', 'CDI %', 'Spread', 'G. Cambial',
    'AUM Final', 'Meta', 'Progresso %',
  ]];

  const body = registros.map((r) => {
    const imp = r.impostos != null ? Number(r.impostos) : null;
    return [
      String(r.nome_cliente ?? r.cliente ?? ''),
      brl(Number(r.aum_inicial ?? r.pl_inicial_total ?? 0)),
      // Sem fallback bruto: o consumidor preenche r.nnm. Vazio → 0 (não bruto).
      brl(Number(r.nnm ?? 0)),
      brl(Number(r.tombamento ?? r.nnm_tombamento ?? 0)),
      brl(Number(r.nnm_liquido ?? 0)),
      brl(Number(r.rent_rs ?? r.rentabilidade_total ?? 0)),
      imp != null && imp > 0 ? brl(imp) : '—',
      pct(Number(r.rent_pct ?? r.rentabilidade_pct ?? 0)),
      pct(Number(r.cdi_pct ?? 0)),
      pct(Number(r.spread ?? 0)),
      // null = indisponível (vide exportExcel para detalhe).
      r.ganho_cambial == null ? '—' : brl(Number(r.ganho_cambial)),
      brl(Number(r.aum_final ?? r.pl_total ?? 0)),
      brl(Number(r.meta ?? r.meta_poupanca_mensal ?? 0)),
      pct(Number(r.progresso_pct ?? 0)),
    ];
  });

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: {
      fillColor: COR_HEADER,
      textColor: '#ffffff',
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: COR_LINHA_ALT },
  });

  desenharFooter(doc);
  doc.save(`aum-performance_${periodoLabel}_${Date.now()}.pdf`);
}

// ============================================================
// Histórico individual (cliente)
// ============================================================

export function exportClienteAumPdf(
  nomeCliente: string,
  linhas: LinhaDetalhe[],
  periodoLabel: string,
  visao: Visao,
  benchmarkPorMes: Record<string, number | null>,
  metaAutoFillGlobal: number | null,
  metricas: {
    rentAcumulada: number;
    cdiAcumulado: number | null;
    spread: number | null;
    rentAbsoluta: number;
  },
): void {
  const mostrarGC = visao !== 'onshore';
  const mostrarImp = visao !== 'offshore';
  const isOff = visao === 'offshore';
  const benchmarkNome = isOff ? 'Fed Funds' : 'CDI';
  const visaoLabel = visao === 'consolidado' ? 'Consolidado'
    : visao === 'onshore' ? 'Onshore' : 'Offshore';

  // Landscape — offshore tem muitas colunas (incl. USD); landscape também
  // acomoda confortavelmente onshore/consolidado sem aperto.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  let startY = desenharHeader(
    doc,
    nomeCliente,
    `Histórico de Patrimônio e Rentabilidade — ${visaoLabel}`,
    periodoLabel,
  );

  const cards = [
    { label: 'Rent. Acumulada', valor: pct(metricas.rentAcumulada * 100, 2) },
    { label: `${benchmarkNome} Acumulado`, valor: metricas.cdiAcumulado != null ? pct(metricas.cdiAcumulado * 100, 2) : '—' },
    { label: 'Spread', valor: metricas.spread != null ? pct(metricas.spread * 100, 2) : '—' },
    { label: 'Rent. R$', valor: brl(metricas.rentAbsoluta) },
  ];

  const cardW = (pageW - 20 - 30) / 4;
  cards.forEach((card, i) => {
    const x = 10 + i * (cardW + 10);
    const y = startY;
    doc.setFillColor('#f8f9fc');
    doc.roundedRect(x, y, cardW, 14, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor('#6b7280');
    doc.text(card.label, x + 4, y + 5);
    doc.setFontSize(11);
    doc.setTextColor('#1f2937');
    doc.setFont('helvetica', 'bold');
    doc.text(card.valor, x + 4, y + 11);
    doc.setFont('helvetica', 'normal');
  });

  startY += 22;

  const meses = [
    '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  // Cabeçalho dinâmico conforme visão (espelha exatamente as colunas da tabela).
  const head: string[] = ['Mês/Ano', 'AUM Inicial'];
  if (isOff) head.push('AUM Ini USD');
  head.push('NNM');
  if (isOff) head.push('NNM USD');
  head.push('Tomb.', 'Poup. Líq.', 'Rent. R$');
  if (isOff) head.push('Rent. USD');
  if (mostrarImp) head.push('Impostos');
  head.push('Rent. %', `${benchmarkNome} %`, 'Spread');
  if (mostrarGC) head.push('G. Cambial');
  if (isOff) head.push('PTAX Ini', 'PTAX Fin');
  head.push('Meta', 'Progr.', 'AUM Final');
  if (isOff) head.push('AUM Final USD');

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

  const fmtUsd = (v: number | null | undefined): string => {
    if (v == null || Math.abs(v) < 0.005) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtBrlOrDash = (v: number | null | undefined): string => {
    if (v == null || Math.abs(v) < 0.005) return '—';
    return brl(v);
  };
  const fmtPctOrDash = (v: number | null | undefined): string => {
    if (v == null) return '—';
    return pct(v * 100, 2);
  };
  const fmtPtax = (v: number | null | undefined): string => {
    if (v == null || v === 0) return '—';
    return v.toFixed(4);
  };

  let nnmTot = 0, tombTot = 0, rbTot = 0, gcTot = 0, metaTot = 0;
  let sumRp = 0, cRp = 0, sumBm = 0, cBm = 0, sumSp = 0, cSp = 0;
  let impTot = 0, temImp = false;
  let rentUsdTot = 0, nnmUsdTot = 0;

  const linhasCalc = linhas.map((l, i) => {
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
    return { l, r, d, bm, sp, tomb, poupLiq, meta, prog };
  });

  const body: string[][] = linhasCalc.map(({ l, r, d, bm, sp, tomb, poupLiq, meta, prog }) => {
    const row: string[] = [];
    row[idx.mesAno] = `${meses[r.mes] ?? r.mes}/${r.ano}`;
    row[idx.aumIni] = fmtBrlOrDash(d.pi);
    if (isOff) row[idx.aumIniUsd] = fmtUsd('piUsd' in d ? d.piUsd : 0);
    row[idx.nnm] = brl(d.nnm);
    if (isOff) row[idx.nnmUsd] = fmtUsd('nnmUsd' in d ? d.nnmUsd : 0);
    row[idx.tomb] = fmtBrlOrDash(tomb);
    row[idx.poupLiq] = brl(poupLiq);
    row[idx.rentBrl] = brl(d.rb);
    if (isOff) row[idx.rentUsd] = fmtUsd('rentUsd' in d ? d.rentUsd : 0);
    if (mostrarImp) row[idx.imp] = r.impostos_mes != null ? brl(r.impostos_mes) : '—';
    row[idx.rentPct] = fmtPctOrDash(d.rp);
    row[idx.benchmark] = fmtPctOrDash(bm);
    row[idx.spread] = sp != null ? `${sp >= 0 ? '+' : ''}${pct(sp * 100, 2)}` : '—';
    if (mostrarGC) row[idx.gc] = l.ganhoCambial != null ? brl(l.ganhoCambial) : '—';
    if (isOff) {
      row[idx.ptaxIni] = fmtPtax('ptaxIni' in d ? d.ptaxIni : null);
      row[idx.ptaxFin] = fmtPtax('ptaxFin' in d ? d.ptaxFin : null);
    }
    row[idx.meta] = meta ? brl(meta) : '—';
    row[idx.progresso] = prog != null ? pct(prog * 100, 0) : '—';
    row[idx.aumFinal] = brl(d.pf);
    if (isOff) row[idx.aumFinalUsd] = fmtUsd(r.pl_offshore_usd);

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

    return row;
  });

  const totalRow: string[] = [];
  totalRow[idx.mesAno] = `TOTAL / MÉDIA (${linhas.length})`;
  totalRow[idx.aumIni] = '—';
  if (isOff) totalRow[idx.aumIniUsd] = '—';
  totalRow[idx.nnm] = brl(nnmTot);
  if (isOff) totalRow[idx.nnmUsd] = fmtUsd(nnmUsdTot);
  totalRow[idx.tomb] = fmtBrlOrDash(tombTot);
  totalRow[idx.poupLiq] = brl(nnmTot - tombTot);
  totalRow[idx.rentBrl] = brl(rbTot);
  if (isOff) totalRow[idx.rentUsd] = fmtUsd(rentUsdTot);
  if (mostrarImp) totalRow[idx.imp] = temImp ? brl(impTot) : '—';
  totalRow[idx.rentPct] = cRp > 0 ? pct((sumRp / cRp) * 100, 2) : '—';
  totalRow[idx.benchmark] = cBm > 0 ? pct((sumBm / cBm) * 100, 2) : '—';
  totalRow[idx.spread] = cSp > 0 ? `${(sumSp / cSp) >= 0 ? '+' : ''}${pct((sumSp / cSp) * 100, 2)}` : '—';
  if (mostrarGC) totalRow[idx.gc] = brl(gcTot);
  if (isOff) { totalRow[idx.ptaxIni] = '—'; totalRow[idx.ptaxFin] = '—'; }
  totalRow[idx.meta] = metaTot > 0 ? brl(metaTot) : '—';
  totalRow[idx.progresso] = metaTot > 0 ? pct(((nnmTot - tombTot) / metaTot) * 100, 0) : '—';
  totalRow[idx.aumFinal] = '—';
  if (isOff) totalRow[idx.aumFinalUsd] = '—';
  body.push(totalRow);

  const totalRowIndex = body.length - 1;

  autoTable(doc, {
    startY,
    head: [head],
    body,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: {
      fillColor: COR_HEADER,
      textColor: '#ffffff',
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: COR_LINHA_ALT },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const i = data.row.index;
      const c = data.column.index;
      const isTotal = i === totalRowIndex;
      if (isTotal) {
        data.cell.styles.fillColor = COR_TOTAL_BG;
        data.cell.styles.fontStyle = 'bold';
        return;
      }
      const calc = linhasCalc[i];
      if (!calc) return;
      const { d, sp, l, r } = calc;
      if (c === idx.rentBrl || c === idx.rentPct) {
        if (d.rb < 0 || (d.rp != null && d.rp < 0)) data.cell.styles.textColor = COR_NEGATIVO;
        else if (d.rb > 0) data.cell.styles.textColor = COR_POSITIVO;
      }
      if (c === idx.nnm) {
        if (d.nnm < 0) data.cell.styles.textColor = COR_NEGATIVO;
        else if (d.nnm > 0) data.cell.styles.textColor = COR_POSITIVO;
      }
      if (c === idx.spread && sp != null) {
        data.cell.styles.textColor = sp >= 0 ? COR_POSITIVO : COR_NEGATIVO;
      }
      if (mostrarGC && c === idx.gc && l.ganhoCambial != null) {
        data.cell.styles.textColor = l.ganhoCambial >= 0 ? COR_POSITIVO : COR_NEGATIVO;
      }
      if (mostrarImp && c === idx.imp && r.impostos_mes != null && r.impostos_mes !== 0) {
        data.cell.styles.textColor = COR_NEGATIVO;
      }
    },
  });

  desenharFooter(doc);

  const slugNome = nomeCliente
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  doc.save(`${slugNome}_${visao}_aum_${Date.now()}.pdf`);
}

// ============================================================
// Burn Rate (drilldown MM6) — landscape
// ============================================================

export function exportBurnRatePdf(
  clientes: MM6Cliente[],
  periodoLabel: string,
  anoFim: number,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const startY = desenharHeader(
    doc,
    'Clientes com Burn Rate Ativo',
    `Critério: variação MM6 < 0  ·  ${clientes.length} cliente${clientes.length === 1 ? '' : 's'}`,
    periodoLabel,
  );

  const head = [[
    'Cliente', 'PL Atual', 'Rent. MM6', 'Taxa MM6', 'NNM MM6', 'Var. MM6',
    `PL Proj. Dez/${anoFim}`, `Meta Dez/${anoFim}`, 'Gap Meta', 'Severidade',
    'Rebate em Risco',
  ]];

  const fmtSev = (s: MM6Cliente['severidade']) =>
    s === 'critico' ? 'Crítico' : s === 'moderado' ? 'Moderado'
      : s === 'leve' ? 'Leve' : '—';
  const body = clientes.map((c) => [
    c.nome_cliente,
    brl(c.pl_atual),
    brl(c.mm6_rent_brl),
    pct(c.mm6_rent_pct * 100, 2),
    brl(c.mm6_nnm_liquido),
    brl(c.variacao_mm6),
    c.pl_projetado_fim_ano < 0.5 ? 'PL ZERADO' : brl(c.pl_projetado_fim_ano),
    c.meta_individual != null ? brl(c.meta_individual) : '—',
    c.gap_meta_individual != null ? brl(c.gap_meta_individual) : '—',
    fmtSev(c.severidade),
    brl(c.rebate_em_risco),
  ]);

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: COR_HEADER, textColor: '#ffffff', fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: COR_LINHA_ALT },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const c = clientes[data.row.index];
      if (!c) return;
      // Rent BRL/Taxa/Variação — vermelho quando negativo
      if ([2, 3, 5].includes(data.column.index)) {
        const v = data.column.index === 2 ? c.mm6_rent_brl
          : data.column.index === 3 ? c.mm6_rent_pct : c.variacao_mm6;
        if (v < 0) data.cell.styles.textColor = COR_NEGATIVO;
      }
      // Gap — verde se positivo, vermelho se negativo
      if (data.column.index === 8 && c.gap_meta_individual != null) {
        data.cell.styles.textColor = c.gap_meta_individual >= 0 ? COR_POSITIVO : COR_NEGATIVO;
      }
      // Severidade — destacar crítico em vermelho
      if (data.column.index === 9 && c.severidade === 'critico') {
        data.cell.styles.textColor = COR_NEGATIVO;
        data.cell.styles.fontStyle = 'bold';
      }
      // PL ZERADO badge
      if (data.column.index === 6 && c.pl_projetado_fim_ano < 0.5) {
        data.cell.styles.textColor = COR_NEGATIVO;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  desenharFooter(doc);
  const slug = periodoLabel.replace(/[\s/]/g, '_');
  doc.save(`burn-rate_${slug}_${Date.now()}.pdf`);
}

// ============================================================
// Projeção AUM (drilldown MM6) — landscape
// ============================================================

export function exportProjecaoPdf(
  clientes: MM6Cliente[],
  periodoLabel: string,
  anoFim: number,
  consolidado: {
    pl_total_atual: number;
    pl_total_projetado_fim_ano: number;
    meta_total: number | null;
    gap_total: number | null;
  },
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  let startY = desenharHeader(
    doc,
    `Projeção de AUM até Dezembro/${anoFim}`,
    `Modelo MM6 + CDI projetado  ·  período de visualização: ${periodoLabel}`,
    `${clientes.length} cliente${clientes.length === 1 ? '' : 's'}`,
  );

  // KPIs consolidados
  const kpis = [
    { label: 'AUM Atual', valor: brl(consolidado.pl_total_atual) },
    { label: `AUM Projetado Dez/${anoFim}`, valor: brl(consolidado.pl_total_projetado_fim_ano) },
    { label: 'Meta Total', valor: consolidado.meta_total != null ? brl(consolidado.meta_total) : '—' },
    { label: 'Gap', valor: consolidado.gap_total != null ? brl(consolidado.gap_total) : '—' },
  ];
  const boxW = (pageW - 20 - 15) / 4;
  kpis.forEach((kpi, i) => {
    const x = 10 + i * (boxW + 5);
    doc.setFillColor('#f8f9fc');
    doc.roundedRect(x, startY, boxW, 14, 2, 2, 'F');
    doc.setFontSize(7); doc.setTextColor('#6b7280');
    doc.text(kpi.label, x + 4, startY + 5);
    doc.setFontSize(10); doc.setTextColor('#1f2937');
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.valor, x + 4, startY + 11);
    doc.setFont('helvetica', 'normal');
  });
  startY += 20;

  const head = [[
    'Cliente', 'PL Atual', 'Rent. MM6', 'NNM MM6', 'Cap. Esperada', 'Fonte',
    'CDI MM6', 'Spread', `PL Proj. Dez/${anoFim}`, `Meta Dez/${anoFim}`, 'Gap', 'Status',
  ]];
  const body = clientes.map((c) => {
    const status = c.em_burn ? 'Em burn'
      : c.meta_individual == null ? 'Sem meta'
      : (c.gap_meta_individual ?? 0) > 0 ? 'Acima da meta' : 'Abaixo da meta';
    return [
      c.nome_cliente,
      brl(c.pl_atual),
      pct(c.mm6_rent_pct * 100, 2),
      brl(c.mm6_nnm_liquido),
      brl(c.capacidade_esperada),
      c.capacidade_fonte === 'manual' ? 'Manual' : 'Auto',
      pct(c.mm6_cdi_pct * 100, 2),
      `${c.spread.toFixed(2)}×`,
      c.pl_projetado_fim_ano < 0.5 ? 'PL ZERADO' : brl(c.pl_projetado_fim_ano),
      c.meta_individual != null ? brl(c.meta_individual) : '—',
      c.gap_meta_individual != null ? brl(c.gap_meta_individual) : '—',
      status,
    ];
  });

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: COR_HEADER, textColor: '#ffffff', fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: COR_LINHA_ALT },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const c = clientes[data.row.index];
      if (!c) return;
      // Rent% e NNM — vermelho se negativo
      if (data.column.index === 2 && c.mm6_rent_pct < 0) data.cell.styles.textColor = COR_NEGATIVO;
      if (data.column.index === 3 && c.mm6_nnm_liquido < 0) data.cell.styles.textColor = COR_NEGATIVO;
      // Gap — verde positivo, vermelho negativo
      if (data.column.index === 10 && c.gap_meta_individual != null) {
        data.cell.styles.textColor = c.gap_meta_individual >= 0 ? COR_POSITIVO : COR_NEGATIVO;
      }
      // Status — colore Em burn e Acima/Abaixo
      if (data.column.index === 11) {
        if (c.em_burn) { data.cell.styles.textColor = COR_NEGATIVO; data.cell.styles.fontStyle = 'bold'; }
        else if (c.gap_meta_individual != null && c.gap_meta_individual >= 0) {
          data.cell.styles.textColor = COR_POSITIVO;
        } else if (c.gap_meta_individual != null && c.gap_meta_individual < 0) {
          data.cell.styles.textColor = COR_NEGATIVO;
        }
      }
      // PL ZERADO em destaque
      if (data.column.index === 8 && c.pl_projetado_fim_ano < 0.5) {
        data.cell.styles.textColor = COR_NEGATIVO;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  desenharFooter(doc);
  const slug = periodoLabel.replace(/[\s/]/g, '_');
  doc.save(`projecao-aum_${slug}_${Date.now()}.pdf`);
}
