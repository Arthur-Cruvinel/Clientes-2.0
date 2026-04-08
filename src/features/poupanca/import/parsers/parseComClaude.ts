// --- Parser via Anthropic API (Claude) ---
// Envia texto bruto do PDF para o Claude e recebe dados estruturados em JSON.

import type { RegistroPoupanca } from '../../../../types';
import { MAPEAMENTO_SIGLAS, SIGLA_PARA_NOME } from '../MAPEAMENTO_SIGLAS';

const PROXY_URL = '/.netlify/functions/claude-proxy';
const MODEL = 'claude-sonnet-4-20250514';

// [NOVO] exportada para reutilização em parseMultiPeriodoComClaude
export async function chamarClaude(prompt: string): Promise<string> {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`API Anthropic ${response.status}: ${erro}`);
  }

  const data = await response.json();
  const texto = data.content?.[0]?.text;
  if (typeof texto !== 'string') {
    console.error('[ParseClaude] Resposta inesperada da API:', JSON.stringify(data));
    throw new Error(`API retornou resposta inválida: ${JSON.stringify(data.content)}`);
  }
  // Limpa markdown que a API pode incluir apesar das instruções
  return texto
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/** Resolve código de conta para sigla via MAPEAMENTO_SIGLAS com busca por prefixo. */
function resolverSigla(codigo: string): string | null {
  const limpo = codigo.replace(/[….\s]+$/g, '');
  if (MAPEAMENTO_SIGLAS[codigo]) return MAPEAMENTO_SIGLAS[codigo];
  if (MAPEAMENTO_SIGLAS[limpo]) return MAPEAMENTO_SIGLAS[limpo];
  if (MAPEAMENTO_SIGLAS[`${limpo}_C`]) return MAPEAMENTO_SIGLAS[`${limpo}_C`];
  if (limpo.length >= 3) {
    for (const chave of Object.keys(MAPEAMENTO_SIGLAS)) {
      if (chave.startsWith(limpo)) return MAPEAMENTO_SIGLAS[chave];
    }
  }
  return null;
}

// ============================================================
// Offshore
// ============================================================

interface OffshoreItem {
  nome_cliente: string;
  codigo_conta: string;
  starting_value_usd: number;
  pl_offshore_usd: number;
  aporte_mes_offshore: number;
  rentabilidade_offshore: number;
}

/** Resultado offshore com campo extra starting_value_usd (só para preview). */
export type OffshoreResult = Partial<RegistroPoupanca> & { starting_value_usd?: number };

export async function parseOffshoreComClaude(
  textoBruto: string,
): Promise<OffshoreResult[]> {
  const prompt = `Você receberá o texto extraído de um PDF chamado "US Performance Report" da Galapagos Capital.
Extraia todos os clientes da tabela "Assets by Account".
Para cada cliente retorne um objeto JSON com:
- nome_cliente: string (nome completo sem o código entre parênteses)
- codigo_conta: string (código entre parênteses, mesmo que truncado com …)
- starting_value_usd: number (Starting Value em USD, sem $ e sem vírgulas)
- pl_offshore_usd: number (Ending Value em USD, sem $ e sem vírgulas, negativo se entre parênteses)
- aporte_mes_offshore: number (Net Cash Flow em USD, negativo se entre parênteses)
- rentabilidade_offshore: number (retorno do mês em %, ex: 0.40 para 0.40%)

Ignore linhas de cabeçalho, totais e benchmarks.
Retorne APENAS um array JSON válido, sem texto adicional, sem markdown.
Exemplo: [{"nome_cliente":"Roger Krug Guedes","codigo_conta":"E66777005","starting_value_usd":3386310,"pl_offshore_usd":3402439,"aporte_mes_offshore":0,"rentabilidade_offshore":0.41}]

Texto do PDF:
${textoBruto}`;

  try {
    const textoLimpo = await chamarClaude(prompt);
    const json: OffshoreItem[] = JSON.parse(textoLimpo);

    return json.map(item => {
      const sigla = resolverSigla(item.codigo_conta);
      const nome = sigla ? (SIGLA_PARA_NOME[sigla] ?? sigla) : item.nome_cliente;
      return {
        nome_cliente: nome,
        starting_value_usd: item.starting_value_usd,
        pl_offshore_usd: item.pl_offshore_usd,
        aporte_mes_offshore: item.aporte_mes_offshore,
        rentabilidade_offshore: item.rentabilidade_offshore,
      };
    });
  } catch (e) {
    console.error('[ParseClaude] Erro ao parsear offshore:', e);
    throw e;
  }
}

// ============================================================
// Onshore
// ============================================================

interface OnshoreItem {
  codigo_carteira: string;
  nome_cliente: string;
  pl_anterior: number;
  saldo_final: number;
  mes: number;
  ano: number;
  aplicacoes: number;
  resgates: number;
  rentabilidade_pct: number;
  rendimento_nominal_brl: number;
}

/** Resultado onshore com campos extras para preview. */
export type OnshoreResult = Partial<RegistroPoupanca> & { pl_anterior?: number; rendimento_nominal_brl?: number | null };

export async function parseOnshoreComClaude(
  textoBruto: string,
): Promise<OnshoreResult | null> {
  const prompt = `Responda SOMENTE com o objeto JSON. Não escreva nenhuma observação, explicação ou texto antes ou depois do JSON.

Você receberá o texto extraído de um extrato de carteira da Galapagos Capital (sistema Comdinheiro).
Extraia as seguintes informações e retorne APENAS um objeto JSON válido, sem texto adicional, sem markdown:
- codigo_carteira: string (ex: "ABJ_C", encontrado após "Carteira:")
- nome_cliente: string (nome completo do titular, ex: "Ademilson Braga Bispo Junior")
- pl_anterior: number (saldo inicial do período/mês de referência, ex: R$ 23.594.801,38 → 23594801.38)
- saldo_final: number (último valor após "Saldo" com data — é o saldo mais recente, ex: R$ 23.710.941,20 → 23710941.20)
- mes: number (mês do saldo final, ex: janeiro=1, dezembro=12)
- ano: number (ano do saldo final)
- aplicacoes: number (coluna Aplicações da linha do mês de referência na tabela "Aplicações e Resgates")
- resgates: number (coluna Resgates da linha do mês de referência)
- rentabilidade_pct: number (Var. Nominal do mês, primeiro valor percentual dessa linha, ex: 1,58% → 1.58)
- rendimento_nominal_brl: number (Rendimento Bruto do Resumo Carteira, ex: "R$ 355.629,47" → 355629.47. É o valor que aparece no box "Rendimento Bruto" no topo do PDF, ao lado de "Impostos Pagos" e "Saldo Final")

Todos os valores numéricos devem ser numbers JavaScript (sem R$, sem pontos de milhar, vírgula decimal → ponto decimal).

IMPORTANTE: Retorne APENAS o objeto JSON puro, sem blocos de código, sem markdown, sem aspas triplas, sem nenhum texto antes ou depois.

Texto do PDF:
${textoBruto}`;

  try {
    const textoLimpo = await chamarClaude(prompt);
    const item: OnshoreItem = JSON.parse(textoLimpo);

    // Resolve sigla e depois nome completo via SIGLA_PARA_NOME
    const sigla = MAPEAMENTO_SIGLAS[item.codigo_carteira]
      ?? MAPEAMENTO_SIGLAS[item.codigo_carteira.replace(/_C$/, '')]
      ?? item.codigo_carteira;
    const nomeCompleto = SIGLA_PARA_NOME[sigla] ?? item.nome_cliente ?? sigla;

    return {
      nome_cliente: nomeCompleto,
      pl_anterior: item.pl_anterior,
      pl_onshore: item.saldo_final,
      aporte_mes_onshore: item.aplicacoes - item.resgates,
      rentabilidade_onshore: item.rentabilidade_pct,
      rendimento_nominal_brl: typeof item.rendimento_nominal_brl === 'number'
        ? item.rendimento_nominal_brl
        : null,
      ano: item.ano,
      mes: item.mes,
    };
  } catch (e) {
    console.error('[ParseClaude] Erro ao parsear onshore:', e);
    throw e;
  }
}
