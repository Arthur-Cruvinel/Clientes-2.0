// --- Proxy serverless para API de Séries Temporais BCB (série 1 = dólar venda) ---
// Retorna todas as cotações de um período em JSON.
// Browser chama /.netlify/functions/ptax-serie-proxy?dataInicial=01/01/2026&dataFinal=31/01/2026

import type { Handler } from '@netlify/functions';

const BCB_BASE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados';

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

  const dataInicial = event.queryStringParameters?.dataInicial;
  const dataFinal = event.queryStringParameters?.dataFinal;

  if (!dataInicial || !dataFinal) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Parâmetros dataInicial e dataFinal obrigatórios (formato DD/MM/YYYY)' }),
    };
  }

  const url = `${BCB_BASE}?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;

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
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      body: data,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: e instanceof Error ? e.message : 'Erro no proxy PTAX Série' }),
    };
  }
};

export { handler };
