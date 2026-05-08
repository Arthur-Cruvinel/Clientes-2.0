// --- Serviço de cotação multi-moeda (BCB PTAX) ---
// Busca cotação de venda para USD, EUR, GBP e outras moedas.
// Usa proxy /.netlify/functions/cotacao-proxy

const PROXY_URL = '/.netlify/functions/cotacao-proxy';
const TIMEOUT_MS = 10000;

const cache = new Map<string, number>();

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/**
 * Busca cotação de venda (PTAX) de uma moeda para um mês/ano.
 * Retorna a última cotação do mês.
 * Suporta: USD, EUR, GBP, CHF, CAD, AUD, JPY, etc.
 */
export async function buscarCotacaoMoeda(
  moeda: string,
  ano: number,
  mes: number,
): Promise<{ cotacao: number; data: string }> {
  if (moeda === 'BRL') return { cotacao: 1, data: '' };

  const chave = `${moeda}-${ano}-${String(mes).padStart(2, '0')}`;
  const cached = cache.get(chave);
  if (cached != null) return { cotacao: cached, data: chave };

  const mm = String(mes).padStart(2, '0');
  const ultDia = ultimoDiaDoMes(ano, mes);
  const dataInicial = `${mm}-01-${ano}`;
  const dataFinal = `${mm}-${ultDia}-${ano}`;

  const url = `${PROXY_URL}?moeda=${moeda}&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const valores: { cotacaoVenda: number; dataHoraCotacao: string }[] = json.value ?? [];

    if (valores.length === 0) {
      throw new Error(`Sem cotacao de ${moeda} para ${mm}/${ano}`);
    }

    const cotacao = valores[0].cotacaoVenda;
    const dataHora = valores[0].dataHoraCotacao;
    const dataISO = dataHora.substring(0, 10);

    console.log(`[Cotacao] ${moeda} ${mm}/${ano}: ${cotacao.toFixed(4)} (${dataISO})`);
    cache.set(chave, cotacao);
    return { cotacao, data: dataISO };
  } catch (e) {
    clearTimeout(timer);
    console.error(`[Cotacao] Erro ao buscar ${moeda} ${mm}/${ano}:`, e);
    throw e;
  }
}
