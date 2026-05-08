// --- Servico de consulta Fed Funds Rate (FRED) ---
// Busca taxa mensal do Federal Funds Rate via proxy Netlify.

import { diasUteisEntre, diasUteisNoMes, ultimoDiaDoMes } from './diasUteis';

const PROXY_URL = '/.netlify/functions/fred-proxy';
const TIMEOUT_MS = 10000;

/** Cache em memoria — chave "YYYY-MM", valor decimal mensal. */
const cache = new Map<string, number>();

/** Cache do CSV bruto para nao re-fetch. */
let csvCache: string | null = null;

async function fetchCSV(): Promise<string> {
  if (csvCache) return csvCache;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(PROXY_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    csvCache = text;
    return text;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function parseCSV(csv: string): Map<string, number> {
  const mapa = new Map<string, number>();
  const linhas = csv.split('\n');
  // Pula header (DATE,FEDFUNDS)
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const [date, value] = linha.split(',');
    if (!date || !value) continue;
    // DATE formato: YYYY-MM-DD
    const chave = date.substring(0, 7); // "YYYY-MM"
    const taxaAnual = parseFloat(value);
    if (!isNaN(taxaAnual)) {
      // Converter taxa anual % para decimal mensal
      const taxaMensal = taxaAnual / 100 / 12;
      mapa.set(chave, taxaMensal);
    }
  }
  return mapa;
}

/**
 * Busca o Fed Funds Rate mensal.
 * Sem diaIni/diaFim: retorna taxa decimal mensal cheia (anual/12).
 * Com recorte: aplica pro-rata por dias úteis:
 *   fed_prorata = fed_mes × (diasUteisEntre(diaIni, diaFim) / diasUteisNoMes)
 * Retorna null se não encontrado.
 */
export async function buscarFedFundsRate(
  ano: number, mes: number, diaIni?: number, diaFim?: number,
): Promise<number | null> {
  const cheio = await buscarFedCheio(ano, mes);
  if (cheio == null) return null;
  if (diaIni == null && diaFim == null) return cheio;

  const ini = diaIni ?? 1;
  const fim = diaFim ?? ultimoDiaDoMes(ano, mes);
  const diasPeriodo = diasUteisEntre(ano, mes, ini, fim);
  const diasMes = diasUteisNoMes(ano, mes);
  if (diasMes <= 0) return cheio;
  const fator = diasPeriodo / diasMes;
  const chave = `${ano}-${String(mes).padStart(2, '0')}`;
  console.log(`[FedFunds] ${chave} pro-rata ${ini}-${fim}: ${diasPeriodo}/${diasMes} dias úteis (fator ${fator.toFixed(4)})`);
  return cheio * fator;
}

async function buscarFedCheio(ano: number, mes: number): Promise<number | null> {
  const chave = `${ano}-${String(mes).padStart(2, '0')}`;
  const cached = cache.get(chave);
  if (cached != null) return cached;

  try {
    const csv = await fetchCSV();
    const mapa = parseCSV(csv);
    for (const [k, v] of mapa) cache.set(k, v);

    const valor = mapa.get(chave) ?? null;
    if (valor != null) {
      const taxaAnual = valor * 12 * 100;
      console.log(`[FedFunds] Taxa ${chave}: ${valor.toFixed(4)} (${taxaAnual.toFixed(2)}% a.a.)`);
    } else {
      console.log(`[FedFunds] Taxa ${chave}: nao encontrada`);
    }
    return valor;
  } catch (e) {
    console.error('[FedFunds] Erro ao buscar Fed Funds Rate:', e);
    return null;
  }
}
