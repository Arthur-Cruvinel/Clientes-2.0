// --- Proxy para cotação de moedas estrangeiras BCB (PTAX) ---
// Aceita qualquer moeda suportada: USD, EUR, GBP, etc.
// Browser chama /.netlify/functions/cotacao-proxy?moeda=EUR&dataInicial=03-01-2026&dataFinal=03-31-2026

import type { Handler } from '@netlify/functions';

const BCB_BASE = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata';

const handler: Handler = async (event) => {
  const origin = event.headers['origin'] ?? '';
  const allowed = origin.includes('netlify.app') || origin.includes('localhost') || origin.includes('127.0.0.1');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: corsHeaders, body: '{"error":"Method not allowed"}' };

  const moeda = event.queryStringParameters?.moeda;
  const dataInicial = event.queryStringParameters?.dataInicial;
  const dataFinal = event.queryStringParameters?.dataFinal;

  if (!moeda || !dataInicial || !dataFinal) {
    return { statusCode: 400, headers: corsHeaders,
      body: JSON.stringify({ error: 'Parametros obrigatorios: moeda, dataInicial (MM-DD-YYYY), dataFinal (MM-DD-YYYY)' }) };
  }

  const url = `${BCB_BASE}/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@di,dataFinalCotacao=@df)?` +
    `@moeda='${moeda}'&@di='${dataInicial}'&@df='${dataFinal}'&$format=json` +
    `&$select=cotacaoVenda,dataHoraCotacao&$orderby=dataHoraCotacao%20desc&$top=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { statusCode: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `BCB respondeu ${response.status}` }) };
    }
    const data = await response.text();
    return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' }, body: data };
  } catch (e) {
    return { statusCode: 502, headers: corsHeaders,
      body: JSON.stringify({ error: e instanceof Error ? e.message : 'Erro no proxy cotacao' }) };
  }
};

export { handler };
