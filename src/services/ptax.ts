// --- Serviço de consulta PTAX (BCB) ---
// Busca cotação de venda do dólar no último dia útil de um mês.

const BASE_URL = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata';
const MAX_TENTATIVAS = 5;
const TIMEOUT_MS = 8000;

function ultimoDiaDoMes(ano: number, mes: number): Date {
  // new Date(ano, mes, 0) retorna o último dia do mês anterior a (mes+1)
  return new Date(ano, mes, 0);
}

function subtrairDia(data: Date): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() - 1);
  return nova;
}

/** Formata Date como MM-DD-YYYY (formato esperado pela API do BCB). */
function formatarParaBCB(data: Date): string {
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  const yyyy = data.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

/** Formata Date como YYYY-MM-DD (ISO). */
function formatarISO(data: Date): string {
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mm}-${dd}`;
}

interface CotacaoBCB {
  cotacaoVenda: number;
  tipoBoletim: string;
}

/**
 * Busca a PTAX de venda (fechamento) do último dia útil de um mês.
 * Tenta até 5 dias para trás a partir do último dia do mês.
 */
export async function buscarPTAXFechamento(
  ano: number,
  mes: number,
): Promise<{ ptax: number; data: string }> {
  console.log(`[PTAX] Buscando para ${String(mes).padStart(2, '0')}/${ano}...`);

  let data = ultimoDiaDoMes(ano, mes);

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    const dataBCB = formatarParaBCB(data);
    const url = `${BASE_URL}/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataBCB}'&$format=json&$select=cotacaoVenda,tipoBoletim`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const cotacoes: CotacaoBCB[] = json.value ?? [];

      // Filtra pelo boletim de Fechamento
      const fechamento = cotacoes.find(c => c.tipoBoletim === 'Fechamento');
      if (fechamento) {
        const dataISO = formatarISO(data);
        console.log(`[PTAX] Encontrado: ${fechamento.cotacaoVenda.toFixed(4)} em ${dataISO}`);
        return { ptax: fechamento.cotacaoVenda, data: dataISO };
      }

      // Sem cotação nesse dia — tentar dia anterior
      console.warn(`[PTAX] Sem cotação em ${formatarISO(data)}, tentando dia anterior...`);
      data = subtrairDia(data);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof DOMException && e.name === 'AbortError') {
        console.warn(`[PTAX] Timeout em ${formatarISO(data)}, tentando dia anterior...`);
      } else {
        console.warn(`[PTAX] Erro em ${formatarISO(data)}: ${e instanceof Error ? e.message : e}`);
      }
      data = subtrairDia(data);
    }
  }

  console.error('[PTAX] Falha após 5 tentativas');
  throw new Error(`Não foi possível obter a PTAX de ${String(mes).padStart(2, '0')}/${ano} após ${MAX_TENTATIVAS} tentativas`);
}
