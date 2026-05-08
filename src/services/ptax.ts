// --- Serviço de consulta PTAX (BCB via múltiplas estratégias) ---
// Busca cotação de venda do dólar no último dia útil de um mês.
// Estratégia 1: API de séries temporais BCB (série 1, dólar venda) — mais confiável
// Estratégia 2: API OData (dia a dia) via proxy Netlify
// Estratégia 3: Fallback hardcoded para valores já validados
//
// A série 1 do BCB retorna todas as cotações do mês de uma vez,
// eliminando o problema de tentar adivinhar o último dia útil.

const PROXY_ODATA = '/.netlify/functions/ptax-proxy';
const PROXY_SERIE = '/.netlify/functions/ptax-serie-proxy';
const TIMEOUT_MS = 10000;

/** Cache em memória — chave "YYYY-MM", resultado { ptax, data }. */
const cache = new Map<string, { ptax: number; data: string }>();

// PTAX validadas manualmente (venda, último dia útil do mês).
// Usadas como fallback de último recurso quando ambas APIs falham.
const PTAX_FALLBACK: Record<string, number> = {
  '2025-03': 5.7422, '2025-04': 5.6608, '2025-05': 5.7087,
  '2025-06': 5.4571, '2025-07': 5.6021, '2025-08': 5.4264,
  '2025-09': 5.3186, '2025-10': 5.3843, '2025-11': 5.3338,
  '2025-12': 5.5024,
};

function ultimoDiaDoMes(ano: number, mes: number): Date {
  return new Date(ano, mes, 0);
}

function subtrairDia(data: Date): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() - 1);
  return nova;
}

function formatarParaBCB(data: Date): string {
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${mm}-${dd}-${data.getFullYear()}`;
}

function formatarISO(data: Date): string {
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mm}-${dd}`;
}

// ============================================================
// Estratégia 1: API de Séries Temporais BCB (série 1 = dólar venda)
// Retorna todas as cotações do mês — pegamos a última (último dia útil).
// ============================================================

async function tentarSerieBCB(ano: number, mes: number): Promise<{ ptax: number; data: string } | null> {
  const mm = String(mes).padStart(2, '0');
  const ultDia = ultimoDiaDoMes(ano, mes).getDate();
  const url = `${PROXY_SERIE}?dataInicial=01/${mm}/${ano}&dataFinal=${ultDia}/${mm}/${ano}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;

    const dados: { data: string; valor: string }[] = await response.json();
    if (!dados.length) return null;

    // Último registro = último dia útil do mês
    const ultimo = dados[dados.length - 1];
    const ptax = Number(ultimo.valor.replace(',', '.'));
    if (isNaN(ptax) || ptax <= 0) return null;

    // Data vem como "DD/MM/YYYY" — converter para ISO
    const [dd, mmR, yyyy] = ultimo.data.split('/');
    const dataISO = `${yyyy}-${mmR}-${dd}`;

    console.log(`[PTAX] Série BCB: ${ptax.toFixed(4)} em ${dataISO}`);
    return { ptax, data: dataISO };
  } catch (e) {
    clearTimeout(timer);
    console.warn('[PTAX] Série BCB falhou:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// Estratégia 2: API OData (dia a dia) via proxy existente
// Tenta até 7 dias para trás a partir do último dia do mês.
// ============================================================

interface CotacaoBCB {
  cotacaoVenda: number;
  tipoBoletim: string;
}

async function tentarODataBCB(ano: number, mes: number): Promise<{ ptax: number; data: string } | null> {
  let data = ultimoDiaDoMes(ano, mes);

  for (let tentativa = 0; tentativa < 7; tentativa++) {
    const dataBCB = formatarParaBCB(data);
    const url = `${PROXY_ODATA}?data=${dataBCB}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) { data = subtrairDia(data); continue; }

      const json = await response.json();
      const cotacoes: CotacaoBCB[] = json.value ?? [];
      const fechamento = cotacoes.find(c => c.tipoBoletim === 'Fechamento');

      if (fechamento) {
        const dataISO = formatarISO(data);
        console.log(`[PTAX] OData: ${fechamento.cotacaoVenda.toFixed(4)} em ${dataISO}`);
        return { ptax: fechamento.cotacaoVenda, data: dataISO };
      }
      data = subtrairDia(data);
    } catch {
      clearTimeout(timer);
      data = subtrairDia(data);
    }
  }
  return null;
}

// ============================================================
// Função principal — tenta todas as estratégias em ordem
// ============================================================

/**
 * Busca a PTAX de venda (fechamento) do último dia útil de um mês.
 * Estratégia: Série BCB → OData → Fallback hardcoded.
 */
export async function buscarPTAXFechamento(
  ano: number,
  mes: number,
): Promise<{ ptax: number; data: string }> {
  const chave = `${ano}-${String(mes).padStart(2, '0')}`;

  // Cache em memória
  const cached = cache.get(chave);
  if (cached) return cached;

  console.log(`[PTAX] Buscando para ${chave}...`);

  // Estratégia 1: Série BCB (mais confiável)
  const serie = await tentarSerieBCB(ano, mes);
  if (serie) { cache.set(chave, serie); return serie; }

  // Estratégia 2: OData dia a dia
  const odata = await tentarODataBCB(ano, mes);
  if (odata) { cache.set(chave, odata); return odata; }

  // Estratégia 3: Fallback hardcoded
  const fallback = PTAX_FALLBACK[chave];
  if (fallback) {
    console.warn(`[PTAX] APIs falharam, usando fallback: ${fallback.toFixed(4)} para ${chave}`);
    const resultado = { ptax: fallback, data: `${chave}-fallback` };
    cache.set(chave, resultado);
    return resultado;
  }

  console.error(`[PTAX] Todas as estratégias falharam para ${chave}`);
  throw new Error(`Não foi possível obter a PTAX de ${String(mes).padStart(2, '0')}/${ano}`);
}
