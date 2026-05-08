// --- Proxy serverless para FRED (Federal Reserve Economic Data) ---
// Busca Fed Funds Rate CSV e repassa ao browser.
// Browser chama /.netlify/functions/fred-proxy

import type { Handler } from '@netlify/functions';

const FRED_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS';

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

  try {
    const response = await fetch(FRED_URL);
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'text/csv' },
        body: `Error: FRED responded ${response.status}`,
      };
    }

    const csv = await response.text();
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Cache-Control': 'public, max-age=86400' },
      body: csv,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: e instanceof Error ? e.message : 'Erro no proxy FRED' }),
    };
  }
};

export { handler };
