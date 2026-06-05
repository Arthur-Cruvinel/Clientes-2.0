// --- Parsing de abas do template Excel v23 ---
// SheetJS com { header: 1 } lê linha a linha.
// Cabeçalho sempre na linha índice 2 (linha 3 do Excel).
// Reutiliza parseNumericValue de services/parsers.ts.
//
// Template v23:
//   - pl_onshore/pl_offshore removidos da aba clientes (PL vem de poupanca/)
//   - fator_* removidos (modelo antigo); pct_* é o modelo atual de alocação

import * as XLSX from 'xlsx';
import { parseNumericValue } from '../../services/parsers';
import type { Colaborador, Cliente, CustoIndireto, RegistroPoupanca } from '../../types';

// ============================================================
// Helpers
// ============================================================

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value ?? '').toLowerCase().trim();
  return s === 'sim' || s === 'true' || s === '1';
}

function num(value: unknown): number {
  return parseNumericValue(value) ?? 0;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function strOpt(value: unknown): string | undefined {
  const s = str(value);
  return s === '' || s === '-' ? undefined : s;
}

/** Lê aba como array de objetos { coluna: valor } usando linha índice 2 como cabeçalho. */
function lerAba(wb: XLSX.WorkBook, nomeAba: string): Record<string, unknown>[] {
  const sheet = wb.Sheets[nomeAba];
  if (!sheet) return [];

  // Lê tudo como array de arrays (linha a linha)
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (raw.length < 3) return [];

  // Linha índice 2 (linha 3 do Excel) é o cabeçalho
  const headerRow = raw[2] as unknown[];
  const headers = headerRow.map(h => String(h).trim());

  // Linhas de dados começam na índice 3
  const resultado: Record<string, unknown>[] = [];
  for (let i = 3; i < raw.length; i++) {
    const valores = raw[i] as unknown[];
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = valores[j] ?? '';
    }
    resultado.push(obj);
  }
  return resultado;
}

/** Retorna lista de abas encontradas e não encontradas. */
export function verificarAbas(wb: XLSX.WorkBook): { encontradas: string[]; ausentes: string[] } {
  const esperadas = ['colaboradores', 'clientes', 'custos_indiretos', 'poupanca'];
  const encontradas: string[] = [];
  const ausentes: string[] = [];
  for (const aba of esperadas) {
    if (wb.Sheets[aba]) encontradas.push(aba);
    else ausentes.push(aba);
  }
  return { encontradas, ausentes };
}

// ============================================================
// Parsers por aba
// ============================================================

export function parseColaboradores(wb: XLSX.WorkBook): Colaborador[] {
  const rows = lerAba(wb, 'colaboradores');
  const resultado: Colaborador[] = [];

  for (const row of rows) {
    const nome = str(row['nome_colaborador']);
    if (!nome || nome.startsWith('DEPRECATED')) continue;

    // localidade vem da coluna 'localidade' do template; default 'SP' se vazia.
    const localRaw = str(row['localidade']).toUpperCase().trim();
    const localidade: 'SP' | 'RJ' = localRaw === 'RJ' ? 'RJ' : 'SP';

    resultado.push({
      nome_colaborador: nome,
      cargo: str(row['cargo']),
      localidade,
      funcao_principal: str(row['funcao_principal']),
      alocavel: parseBool(row['alocavel']),
      percentual_alocavel: num(row['percentual_alocavel']),
      percentual_institucional: num(row['percentual_institucional']),
      salario_base: num(row['salario_base']),
      // liquido_acordado/qtd_dependentes: novos inputs do modelo de folha CLT
      // (substitui diferenca_teto e decimo_terceiro_ferias_plr — agora derivados).
      liquido_acordado: num(row['liquido_acordado']),
      qtd_dependentes: num(row['qtd_dependentes']),
      beneficios_fixos: num(row['beneficios_fixos']),
      // Herança fechada (CFO): a coluna única importada vira vale_alimentacao;
      // os outros 3 ficam zero. Mantém o invariante beneficios_fixos = soma
      // sem alterar o template Excel nesta etapa.
      vale_alimentacao: num(row['beneficios_fixos']),
      vale_transporte: 0,
      plano_saude: 0,
      outros_beneficios: 0,
      // custo_total_mensal/custo_hora vêm da planilha mas o motor sempre
      // recalcula a partir dos inputs — a coluna existe só por compatibilidade
      // com auditorias antigas.
      custo_total_mensal: num(row['custo_total_mensal']),
      custo_hora: num(row['custo_hora']),
      salario_teto_cargo: num(row['salario_teto_cargo']),
    });
  }
  return resultado;
}

export function parseClientes(wb: XLSX.WorkBook): Cliente[] {
  const rows = lerAba(wb, 'clientes');
  const resultado: Cliente[] = [];

  for (const row of rows) {
    const nome = str(row['nome_cliente']);
    if (!nome) continue;

    // Trata coluna com "O" maiúsculo no template: "Operacional_financeiro"
    const opFin = strOpt(row['Operacional_financeiro']) ?? strOpt(row['operacional_financeiro']);

    resultado.push({
      nome_cliente: nome,
      empresario: strOpt(row['empresario']),
      receita_fee: num(row['receita_fee']),
      // pl_onshore, pl_offshore, pl_offshore_usd, ptax_fechamento removidos
      // da aba clientes no template v23 — PL é gerenciado exclusivamente
      // pela aba poupanca (CLAUDE.md, decisão arquitetural).
      percentual_rebate_anual_onshore: num(row['percentual_rebate_anual_onshore']),
      percentual_rebate_anual_offshore: num(row['percentual_rebate_anual_offshore']),
      aliquota_impostos_rebate: num(row['aliquota_impostos_rebate']),
      custo_contabilidade_dedicado: num(row['custo_contabilidade_dedicado']),
      custo_pagamento_dedicado: num(row['custo_pagamento_dedicado']),
      custo_administrativo_dedicado: num(row['custo_administrativo_dedicado']),
      utiliza_servico_juridico: parseBool(row['utiliza_servico_juridico']),
      utiliza_conciliacao: parseBool(row['utiliza_conciliacao']),
      pacote_servico: (() => {
        // pl_onshore/pl_offshore removidos da aba clientes em v23 — auto-classify
        // depende exclusivamente do valor declarado em pacote_servico.
        const raw = str(row['pacote_servico']).toLowerCase();
        if (['full', 'advanced', 'light', 'future', 'asset_only'].includes(raw)) return raw;
        return 'light';  // default seguro quando ausente/inválido
      })() as Cliente['pacote_servico'],
      // fator_* removido — modelo antigo substituído por pct_*
      // Ver CLAUDE.md seção "Pipeline de Processamento — Custo Direto"
      consultoria_gestao: strOpt(row['consultoria_gestao']),
      consultoria_planejamento: strOpt(row['consultoria_planejamento']),
      consultoria_financeira: strOpt(row['consultoria_financeira']),
      operacional_financeiro: opFin,
      serv_adm: strOpt(row['serv_adm']),
      serv_aux_adm: strOpt(row['serv_aux_adm']),
      pct_consultoria_gestao: num(row['pct_consultoria_gestao']),
      pct_consultoria_planejamento: num(row['pct_consultoria_planejamento']),
      pct_consultoria_financeira: num(row['pct_consultoria_financeira']),
      pct_operacional_financeiro: num(row['pct_operacional_financeiro']),
      pct_serv_adm: num(row['pct_serv_adm']),
      pct_serv_aux_adm: num(row['pct_serv_aux_adm']),
      peso_juridico: num(row['peso_juridico']) || 1.0,
      volume_movimentos_mes: num(row['volume_movimentos_mes']) || 0,
    });
  }
  return resultado;
}

/** Mapeia coluna 'natureza' do Excel para tipo_custo do sistema. Retorna null para custos diretos (ignorar). */
function mapNatureza(natureza: string): 'geral' | 'juridico' | 'conciliacao' | null {
  const n = String(natureza ?? '').toLowerCase().trim();
  if (n === 'indireta') return 'geral';
  if (n === 'jurídico' || n === 'juridico') return 'juridico';
  if (n === 'conciliação' || n === 'conciliacao') return 'conciliacao';
  // 'Direta' = custo dedicado, não rateado — ignorar
  return null;
}

export function parseCustosIndiretos(wb: XLSX.WorkBook): CustoIndireto[] {
  const rows = lerAba(wb, 'custos_indiretos');
  const resultado: CustoIndireto[] = [];

  for (const row of rows) {
    // Coluna 'categoria_dre' = descrição; 'natureza' = tipo de rateio
    const descricao = str(row['categoria_dre']) || str(row['descricao_custo']);
    if (!descricao) continue;

    const valor = num(row['valor_mensal']);
    if (valor === 0) continue; // Ignora cabeçalhos de categoria e linhas zeradas

    const tipo = mapNatureza(str(row['natureza']) || str(row['tipo_custo']));
    if (tipo === null) continue; // Ignora custos diretos

    resultado.push({
      descricao_custo: descricao,
      valor_mensal: valor,
      tipo_custo: tipo,
    });
  }
  return resultado;
}

export function parsePoupanca(wb: XLSX.WorkBook): RegistroPoupanca[] {
  const rows = lerAba(wb, 'poupanca');
  const resultado: RegistroPoupanca[] = [];

  // Frente 1.6 — alinhamento com a interface (status + sigla_bruta_origem).
  // O Excel sempre traz o nome_cliente direto da planilha — sem sigla, sem
  // lookup. Logo, NUNCA entra em quarentena pelo canal Excel. Os campos novos
  // ficam ausentes (= 'ativo' por decisão CFO), mantendo retrocompatibilidade
  // total. Esta linha de código existe só para registrar a intenção explícita.

  for (const row of rows) {
    const nome = str(row['nome_cliente']);
    if (!nome) continue;

    resultado.push({
      nome_cliente: nome,
      ano: num(row['ano']),
      mes: num(row['mes']),
      pl_inicial_onshore: num(row['pl_inicial_onshore']),
      pl_inicial_offshore: num(row['pl_inicial_offshore']),
      pl_inicial_total: num(row['pl_inicial_total']),
      pl_onshore: num(row['pl_onshore']),
      pl_offshore: num(row['pl_offshore']),
      pl_total: num(row['pl_total']),
      pl_offshore_usd: num(row['pl_offshore_usd']),
      ptax_fechamento: num(row['ptax_fechamento']),
      aporte_mes_onshore: num(row['aporte_mes_onshore']),
      aporte_mes_offshore: num(row['aporte_mes_offshore']),
      aporte_mes_total: num(row['aporte_mes_total']),
      sem_capacidade_poupanca: parseBool(row['sem_capacidade_poupanca']),
      capacidade_poupanca_mensal: num(row['capacidade_poupanca_mensal']),
      meta_poupanca_mensal: num(row['meta_poupanca_mensal']),
      rentabilidade_onshore: num(row['rentabilidade_onshore']),
      rentabilidade_offshore: num(row['rentabilidade_offshore']),
      rentabilidade_total: num(row['rentabilidade_total']),
      rentabilidade_pct: num(row['rentabilidade_pct']),
    });
  }
  return resultado;
}
