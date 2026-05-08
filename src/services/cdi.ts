// --- Serviço de consulta CDI mensal (BCB série 4391) ---
// Busca a taxa CDI acumulada no mês via API do BCB.

import { diasUteisEntre, diasUteisNoMes, ultimoDiaDoMes } from './diasUteis';

const BASE_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados';
const TIMEOUT_MS = 8000;

/** Cache em memória do CDI cheio — chave "YYYY-MM", valor decimal. */
const cache = new Map<string, number>();

/**
 * Busca o CDI do mês via BCB (série 4391). Retorna decimal.
 * Se diaIni e/ou diaFim forem informados, retorna pro-rata por dias úteis:
 *   cdi_prorata = cdi_mes_cheio × (diasUteisEntre(diaIni, diaFim) / diasUteisNoMes)
 * Sem parâmetros opcionais → comportamento original (mês cheio).
 */
export async function buscarCDIMensal(
  ano: number, mes: number, diaIni?: number, diaFim?: number,
): Promise<number> {
  const chave = `${ano}-${String(mes).padStart(2, '0')}`;

  const cdiCheio = await buscarCDICheio(ano, mes);

  // Sem recorte → mês cheio (comportamento original)
  if (diaIni == null && diaFim == null) return cdiCheio;

  const ini = diaIni ?? 1;
  const fim = diaFim ?? ultimoDiaDoMes(ano, mes);
  const diasPeriodo = diasUteisEntre(ano, mes, ini, fim);
  const diasMes = diasUteisNoMes(ano, mes);
  if (diasMes <= 0) return cdiCheio;
  const fator = diasPeriodo / diasMes;
  console.log(`[CDI] ${chave} pro-rata ${ini}-${fim}: ${diasPeriodo}/${diasMes} dias úteis (fator ${fator.toFixed(4)})`);
  return cdiCheio * fator;
}

async function buscarCDICheio(ano: number, mes: number): Promise<number> {
  const chave = `${ano}-${String(mes).padStart(2, '0')}`;
  const cached = cache.get(chave);
  if (cached != null) return cached;

  console.log(`[CDI] Buscando ${chave}...`);

  const mm = String(mes).padStart(2, '0');
  const ultDia = ultimoDiaDoMes(ano, mes);
  const dataInicial = `01/${mm}/${ano}`;
  const dataFinal = `${ultDia}/${mm}/${ano}`;
  const url = `${BASE_URL}?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const dados: { data: string; valor: string }[] = await response.json();

    if (!dados.length) {
      throw new Error(`Sem dados de CDI para ${mm}/${ano} — mês ainda não fechado?`);
    }

    // Último registro do mês = CDI acumulado final
    const ultimoValor = dados[dados.length - 1].valor;
    const pct = Number(ultimoValor.replace(',', '.'));
    if (isNaN(pct)) {
      throw new Error(`Valor CDI inválido: "${ultimoValor}"`);
    }

    const decimal = pct / 100;
    cache.set(chave, decimal);
    console.log(`[CDI] CDI de ${mm}/${ano}: ${pct.toFixed(4)}%`);
    return decimal;
  } catch (e) {
    clearTimeout(timer);
    console.error('[CDI] Falha ao buscar CDI:', e);
    throw e;
  }
}
