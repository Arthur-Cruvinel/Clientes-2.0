// --- Parser do template Excel patrimonial ---

import * as XLSX from 'xlsx';
import { slug } from '../../utils/slug';
import type { InvestimentoExterno, Imovel, Veiculo, OutroBem, Passivo } from '../../types';

export interface PatrimonioParseado {
  cliente: string;
  slug: string;
  investimentos: InvestimentoExterno[];
  imoveis: Imovel[];
  veiculos: Veiculo[];
  outros_bens: OutroBem[];
  passivos: Passivo[];
}

export interface ParseResult {
  clientes: Map<string, PatrimonioParseado>;
  erros: string[];
  avisos: string[];
  totalRegistros: number;
}


function lerAba<T>(wb: XLSX.WorkBook, nome: string, obrigatorios: string[]): { rows: (T & { cliente_nome: string })[]; erros: string[] } {
  const ws = wb.Sheets[nome];
  if (!ws) return { rows: [], erros: [] };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: 2 });
  const rows: (T & { cliente_nome: string })[] = [];
  const erros: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r.cliente_nome) { erros.push(`${nome} linha ${i + 4}: cliente_nome ausente`); continue; }
    for (const campo of obrigatorios) {
      if (r[campo] == null || r[campo] === '') {
        erros.push(`${nome} linha ${i + 4}: campo "${campo}" obrigatório vazio`);
      }
    }
    rows.push(r as T & { cliente_nome: string });
  }
  return { rows, erros };
}

export function parsePatrimonioExcel(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const erros: string[] = [];
  const avisos: string[] = [];
  const mapa = new Map<string, PatrimonioParseado>();

  function getCliente(nome: string): PatrimonioParseado {
    const slugCliente = slug(nome);
    if (!mapa.has(slugCliente)) {
      mapa.set(slugCliente, { cliente: nome, slug: slugCliente, investimentos: [], imoveis: [], veiculos: [], outros_bens: [], passivos: [] });
    }
    return mapa.get(slugCliente)!;
  }

  // Investimentos
  const inv = lerAba<InvestimentoExterno>(wb, 'investimentos', ['custodia', 'descricao', 'tipo', 'valor', 'moeda', 'data_referencia']);
  erros.push(...inv.erros);
  for (const r of inv.rows) {
    const c = getCliente(String(r.cliente_nome));
    const { cliente_nome: _, ...dados } = r;
    c.investimentos.push(dados as InvestimentoExterno);
  }

  // Imóveis
  const imo = lerAba<Imovel>(wb, 'imoveis', ['descricao', 'uf', 'tipo', 'valor_mercado']);
  erros.push(...imo.erros);
  for (const r of imo.rows) {
    const c = getCliente(String(r.cliente_nome));
    const { cliente_nome: _, ...dados } = r;
    c.imoveis.push(dados as Imovel);
  }

  // Veículos
  const vei = lerAba<Veiculo>(wb, 'veiculos', ['marca', 'modelo', 'ano_modelo', 'ano_fabricacao']);
  erros.push(...vei.erros);
  for (const r of vei.rows) {
    const c = getCliente(String(r.cliente_nome));
    const { cliente_nome: _, ...dados } = r;
    c.veiculos.push(dados as Veiculo);
  }

  // Outros bens
  const out = lerAba<OutroBem>(wb, 'outros_bens', ['descricao', 'tipo', 'valor_estimado']);
  erros.push(...out.erros);
  for (const r of out.rows) {
    const c = getCliente(String(r.cliente_nome));
    const { cliente_nome: _, ...dados } = r;
    c.outros_bens.push(dados as OutroBem);
  }

  // Passivos
  const pas = lerAba<Passivo>(wb, 'passivos', ['tipo', 'credor', 'descricao', 'saldo_devedor', 'taxa_juros_mensal', 'sistema_amortizacao', 'parcela_atual', 'parcelas_restantes', 'data_inicio', 'data_fim']);
  erros.push(...pas.erros);
  for (const r of pas.rows) {
    const c = getCliente(String(r.cliente_nome));
    const { cliente_nome: _, ...dados } = r;
    c.passivos.push(dados as Passivo);
  }

  let totalRegistros = 0;
  for (const c of mapa.values()) {
    totalRegistros += c.investimentos.length + c.imoveis.length + c.veiculos.length + c.outros_bens.length + c.passivos.length;
  }

  if (mapa.size === 0 && erros.length === 0) avisos.push('Nenhum dado encontrado no arquivo');

  return { clientes: mapa, erros, avisos, totalRegistros };
}
