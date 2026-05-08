// --- Proxy serverless para API PTAX do BCB ---
// Roda no servidor Netlify, contornando proxy corporativo e CORS.
// O browser chama /.netlify/functions/ptax-proxy?data=MM-DD-YYYY
// e recebe o JSON da cotação de venda do dólar.

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

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const dataCotacao = event.queryStringParameters?.data;
  if (!dataCotacao) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Parâmetro "data" obrigatório (formato MM-DD-YYYY)' }) };
  }

  const url = `${BCB_BASE}/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataCotacao}'&$format=json&$select=cotacaoVenda,tipoBoletim`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `BCB respondeu ${response.status}: ${response.statusText}` }),
      };
    }

    const data = await response.text();

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: data,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: e instanceof Error ? e.message : 'Erro no proxy PTAX' }),
    };
  }
};

export { handler };
