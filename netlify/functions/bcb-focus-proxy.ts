// --- Proxy para API Focus BCB (expectativas SELIC por reunião COPOM) ---
// Retorna expectativas mais recentes de SELIC meta por reunião.
// Busca top 1 por Data (mais recente do Focus) com todas as reuniões futuras.

import type { Handler } from '@netlify/functions';

const BCB_BASE = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata';

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

  // Busca TODAS as reuniões do Focus mais recente (top=50 cobre ~2 anos de COPOM)
  // Ordena por Data desc para pegar a pesquisa mais recente primeiro
  const url = `${BCB_BASE}/ExpectativasMercadoSelic?$format=json&$top=50&$orderby=Data%20desc&$filter=baseCalculo%20eq%200&$select=Reuniao,Mediana,Data`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { statusCode: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `BCB respondeu ${response.status}` }) };
    }
    const data = await response.text();
    return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' }, body: data };
  } catch (e) {
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: e instanceof Error ? e.message : 'Erro no proxy Focus' }) };
  }
};

export { handler };
