// --- Parser via Anthropic API (Claude) ---
// Envia texto bruto do PDF para o Claude e recebe dados estruturados em JSON.

import type { RegistroPoupanca } from '../../../../types';
import { MAPEAMENTO_SIGLAS, SIGLA_PARA_NOME } from '../MAPEAMENTO_SIGLAS';
import type { EntradaMapeamentoSigla } from '../../../../services/firebase';

/** Sigla detectada no PDF mas não resolvida nem pelo MAPEAMENTO_SIGLAS
 *  hardcoded, nem pelo mapeamento Firestore (resolvido via UI). */
export interface SiglaNaoMapeada {
  codigo: string;     // codigo_conta extraído pelo Claude
  nome_bruto: string; // nome_cliente como veio no PDF
  periodo?: string;   // YYYY-MM informado pela UI ao chamar o parser
}

const PROXY_URL = '/.netlify/functions/claude-proxy';
// claude-sonnet-4-20250514 passou a retornar 404 (not_found_error). Migrado para
// claude-sonnet-4-6 (alias atual de Sonnet). Usar sempre o alias sem sufixo de
// data; atualizar quando a Anthropic lançar a próxima geração. Manter em sincronia
// com o parser de documentos (useDocumentParser.ts).
const MODEL = 'claude-sonnet-4-6';
const MAX_RETRIES = 3;

// [NOVO] exportada para reutilização em parseMultiPeriodoComClaude
export async function chamarClaude(prompt: string): Promise<string> {
  for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    // Retry automático para 429 (rate limit) e 529 (overloaded)
    if ((response.status === 429 || response.status === 529) && tentativa < MAX_RETRIES) {
      const waitMs = response.status === 429 ? 65000 : 30000;
      console.log(`[Claude] Erro ${response.status} — aguardando ${waitMs / 1000}s antes de tentar novamente (${tentativa}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }

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

  throw new Error('API Anthropic: máximo de tentativas atingido');
}

/** Resolve código de conta (e opcionalmente nome) para sigla via MAPEAMENTO_SIGLAS.
 *
 *  Ordem de tentativas:
 *    1. Match exato pelo código bruto.
 *    2. Match exato pelo código "limpo" (sem ellipsis Unicode `…`, ponto literal
 *       `.` ou whitespace ao final — comum em PDFs com truncamento visual).
 *    3. Match exato `{limpo}_C` (sufixo Comdinheiro de carteira).
 *    4. Fallback por NOME (quando informado). Antes desta etapa o resolver
 *       caía direto no prefix-match permissivo, e códigos truncados (ex:
 *       "TAW01…") pescavam chaves longas erradas (TAW019408 → MLM) — bug do
 *       Wenderson em Jan/2026. Mover o nome para ANTES do prefix-match
 *       resolve corretamente quando o PDF traz o nome completo, mesmo com
 *       código truncado.
 *    5. Prefix-match RESTRITIVO — exige limpo ≥ 6 chars E chave ≥ 6 chars,
 *       direção INVERTIDA (`limpo.startsWith(chave)`). Só dispara quando o
 *       input é uma EXTENSÃO de uma chave conhecida (ex: variante futura
 *       de carteira), nunca quando o input é mais curto que a chave. Isso
 *       elimina a classe inteira de bugs de "input truncado pesca chave longa".
 *
 *  O retorno expõe `metodo` para que o chamador possa logar exatamente qual
 *  caminho disparou (importante: prefix_match é fallback de última instância
 *  e merece warning).
 */
export type MetodoResolucao =
  | 'codigo_exato'
  | 'codigo_limpo'
  | 'codigo_C'
  | 'nome'
  | 'prefix_match'
  | 'nao_encontrado';

export function resolverSigla(codigo: string, nomeCliente?: string): {
  sigla: string | null;
  metodo: MetodoResolucao;
} {
  const limpo = codigo.replace(/[….\s]+$/g, '');

  if (MAPEAMENTO_SIGLAS[codigo])       return { sigla: MAPEAMENTO_SIGLAS[codigo], metodo: 'codigo_exato' };
  if (MAPEAMENTO_SIGLAS[limpo])        return { sigla: MAPEAMENTO_SIGLAS[limpo], metodo: 'codigo_limpo' };
  if (MAPEAMENTO_SIGLAS[`${limpo}_C`]) return { sigla: MAPEAMENTO_SIGLAS[`${limpo}_C`], metodo: 'codigo_C' };

  if (nomeCliente && MAPEAMENTO_SIGLAS[nomeCliente]) {
    return { sigla: MAPEAMENTO_SIGLAS[nomeCliente], metodo: 'nome' };
  }

  if (limpo.length >= 6) {
    for (const chave of Object.keys(MAPEAMENTO_SIGLAS)) {
      if (chave.length >= 6 && limpo.startsWith(chave)) {
        return { sigla: MAPEAMENTO_SIGLAS[chave], metodo: 'prefix_match' };
      }
    }
  }

  return { sigla: null, metodo: 'nao_encontrado' };
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

/** Resultado offshore com campos extras (só para preview). */
export type OffshoreResult = Partial<RegistroPoupanca> & {
  starting_value_usd?: number;
  /** Código bruto da conta no PDF — usado pela agregação para popular
   *  `contas_agregadas[]` quando duas contas mapeiam para o mesmo cliente. */
  codigo_conta?: string;
};

export async function parseOffshoreComClaude(
  textoBruto: string,
  mapeamentoFirestore: Record<string, EntradaMapeamentoSigla> = {},
  periodo?: string,
): Promise<{ registros: OffshoreResult[]; siglas_nao_mapeadas: SiglaNaoMapeada[] }> {
  const prompt = `Você receberá o texto extraído de um PDF chamado "US Performance Report" da Galapagos Capital.

PRIMEIRO, identifique o cabeçalho do relatório no formato "From <data1> to <data2>"
(ex: "From Nov 1, 2025 to Nov 30, 2025"). O valor de <data2> é a data de corte do período.

Em seguida, extraia todos os clientes da tabela "Assets by Account".
Para cada cliente retorne um objeto JSON com:
- nome_cliente: string (nome completo sem o código entre parênteses)
- codigo_conta: string (código entre parênteses, mesmo que truncado com …)
- starting_value_usd: number (Starting Value em USD, sem $ e sem vírgulas)
- pl_offshore_usd: number (Ending Value em USD, sem $ e sem vírgulas, negativo se entre parênteses)
- aporte_mes_offshore: number (Net Cash Flow em USD, negativo se entre parênteses)
- rentabilidade_offshore: number (coluna MONTH da tabela Assets by Account — retorno individual do cliente naquele mês, em %. Ex: 0.52 para 0.52%. NÃO usar a coluna CURRENT PERIOD nem o percentual total do portfólio.)
- dia_corte: number | null (o DIA de <data2> do cabeçalho se for ANTES do último dia do mês;
  null se for o último dia do mês. Ex: "Nov 17, 2025" → 17; "Nov 30, 2025" → null.
  Mesmo valor em todos os clientes — vem do cabeçalho do relatório.)

Ignore linhas de cabeçalho, totais e benchmarks.
Retorne APENAS um array JSON válido, sem texto adicional, sem markdown.
Exemplo: [{"nome_cliente":"Roger Krug Guedes","codigo_conta":"E66777005","starting_value_usd":3386310,"pl_offshore_usd":3402439,"aporte_mes_offshore":0,"rentabilidade_offshore":0.41,"dia_corte":null}]

Texto do PDF:
${textoBruto}`;

  try {
    const textoLimpo = await chamarClaude(prompt);
    const json: (OffshoreItem & { dia_corte?: number | null })[] = JSON.parse(textoLimpo);

    const registros: OffshoreResult[] = [];
    const siglas_nao_mapeadas: SiglaNaoMapeada[] = [];

    for (const item of json) {
      // Resolução em 2 etapas:
      //
      // ETAPA 1 — resolverSigla(codigo, nome): tenta na ordem
      //   código exato → código limpo → código_C → nome → prefix-match restritivo.
      //   O nome agora vem ANTES do prefix-match (fix do bug TAW01…→MLM em
      //   Jan/2026 — código truncado pescava chave longa errada).
      //
      // ETAPA 2 — mapeamentoFirestore[codigo_conta]: fallback de última
      //   instância para entradas cadastradas via ResolverSiglasModal em
      //   sessões anteriores (não estão no MAPEAMENTO_SIGLAS hardcoded).
      const resultado = resolverSigla(item.codigo_conta, item.nome_cliente);

      // Validação cruzada código↔nome — só faz sentido quando a sigla foi
      // resolvida via código (não via nome). Se o nome também resolve para
      // alguma sigla DIFERENTE da do código, é sinal de inconsistência no
      // mapeamento (provável: nome cadastrado por extenso para uma sigla,
      // código cadastrado para outra). Avisa mas não bloqueia — código tem
      // prioridade porque PDFs costumam variar mais o nome do que o código.
      if (resultado.sigla
        && resultado.metodo !== 'nome'
        && resultado.metodo !== 'nao_encontrado'
        && item.nome_cliente
        && MAPEAMENTO_SIGLAS[item.nome_cliente]
        && MAPEAMENTO_SIGLAS[item.nome_cliente] !== resultado.sigla) {
        console.warn(
          `[Mapeamento] CONFLITO: código "${item.codigo_conta}" resolve para sigla `
          + `${resultado.sigla} (método: ${resultado.metodo}), mas nome `
          + `"${item.nome_cliente}" resolve para sigla `
          + `${MAPEAMENTO_SIGLAS[item.nome_cliente]}. `
          + `Usando ${resultado.sigla} (código tem prioridade).`,
        );
      }

      // Log obrigatório quando prefix-match dispara — caminho de fallback
      // que merece auditoria humana, especialmente após o bug do Wenderson.
      if (resultado.metodo === 'prefix_match') {
        console.warn(
          `[Mapeamento] PREFIX-MATCH disparou: código="${item.codigo_conta}" `
          + `→ sigla=${resultado.sigla}. Verifique se está correto — esse `
          + `caminho é fallback de última instância.`,
        );
      }

      const entradaFs = !resultado.sigla
        ? (mapeamentoFirestore[item.codigo_conta] ?? null)
        : null;
      const sigla = resultado.sigla ?? entradaFs?.sigla ?? null;

      if (!sigla) {
        // Sigla nova — adiciona à lista de pendências em vez de criar cliente
        // com nome bruto (evita cliente fantasma silenciosamente nos dados).
        siglas_nao_mapeadas.push({
          codigo: item.codigo_conta,
          nome_bruto: item.nome_cliente,
          periodo,
        });
        continue;
      }

      // Resolveu — prioriza nome cadastrado no Firestore (manual) sobre o
      // SIGLA_PARA_NOME hardcoded (default).
      const nome = entradaFs?.nome_cliente ?? SIGLA_PARA_NOME[sigla] ?? sigla;
      const diaCorte = item.dia_corte != null && !isNaN(Number(item.dia_corte))
        ? Number(item.dia_corte) : null;
      registros.push({
        nome_cliente: nome,
        codigo_conta: item.codigo_conta,
        starting_value_usd: item.starting_value_usd,
        pl_offshore_usd: item.pl_offshore_usd,
        aporte_mes_offshore: item.aporte_mes_offshore,
        rentabilidade_offshore: item.rentabilidade_offshore,
        dia_corte: diaCorte != null && diaCorte >= 1 && diaCorte <= 31 ? diaCorte : null,
      });
    }

    return { registros, siglas_nao_mapeadas };
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

/** Mesma assinatura de retorno do parseOffshore: registros + siglas_nao_resolvidas.
 *  Mas atenção — onshore NÃO pausa o upload como o offshore faz. Em vez disso,
 *  o registro é gravado com status='pendente_normalizacao' e a sigla é
 *  acumulada para o relatório de pendências (Frente 3). */
export async function parseOnshoreComClaude(
  textoBruto: string,
  mapeamentoFirestore: Record<string, EntradaMapeamentoSigla> = {},
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

ATENÇÃO CRÍTICA — NÚMEROS GRANDES EM pt-BR (não trunque os milhões):
Ponto = separador de MILHAR, vírgula = decimal. Leia TODOS os dígitos, com
atenção especial aos grupos de milhão/dezena de milhão. NÃO descarte o grupo
da frente. Ex.: "70.516.612,99" → 70516612.99 (NÃO 516612.99 — não perca os
70 milhões); "1.234.567,89" → 1234567.89 (NÃO 234567.89).

IMPORTANTE: Retorne APENAS o objeto JSON puro, sem blocos de código, sem markdown, sem aspas triplas, sem nenhum texto antes ou depois.

Texto do PDF:
${textoBruto}`;

  try {
    const textoLimpo = await chamarClaude(prompt);
    const item: OnshoreItem = JSON.parse(textoLimpo);

    // Resolução canônica (paridade com offshore — Frente 1.1).
    //
    // ETAPA 1 — resolverSigla(codigo, nome): 5 caminhos hardcoded.
    // ETAPA 2 — mapeamentoFirestore[codigo]: fallback Firestore.
    const resultado = resolverSigla(item.codigo_carteira, item.nome_cliente);
    if (resultado.metodo === 'prefix_match') {
      console.warn(
        `[Mapeamento] PREFIX-MATCH disparou (onshore): código="${item.codigo_carteira}" `
        + `→ sigla=${resultado.sigla}. Verifique se está correto.`,
      );
    }
    const entradaFs = !resultado.sigla
      ? (mapeamentoFirestore[item.codigo_carteira] ?? null)
      : null;
    const sigla = resultado.sigla ?? entradaFs?.sigla ?? null;

    // Quarentena (Frente 1.2): sigla não resolvida → registro com
    // status='pendente_normalizacao' e sigla_bruta_origem=código bruto.
    // O upload NÃO pausa (decisão CFO: importar e reconciliar depois).
    if (!sigla) {
      console.warn(
        `[ParseOnshore] Sigla não resolvida: codigo="${item.codigo_carteira}", `
        + `nome_bruto="${item.nome_cliente}" — registro vai para quarentena.`,
      );
      return {
        nome_cliente: '',
        status: 'pendente_normalizacao',
        sigla_bruta_origem: item.codigo_carteira,
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
    }

    // Resolveu — prioriza nome do Firestore (manual) sobre SIGLA_PARA_NOME (default).
    const nomeCompleto = entradaFs?.nome_cliente ?? SIGLA_PARA_NOME[sigla] ?? sigla;

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
