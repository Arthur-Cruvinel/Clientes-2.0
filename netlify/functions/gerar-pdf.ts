// --- Proxy serverless para PDFShift (HTML → PDF página única) ---
// A chave PDFSHIFT_API_KEY fica nas env vars do Netlify, NUNCA no browser/repo.
// Recebe o HTML (gerarPropostaHTML) no body e devolve o PDF (tira contínua):
//   format "1152xauto" → uma página, largura 1152px, altura = conteúdo.
//   use_print:false     → renderiza a folha SCREEN (ignora @media print).

import type { Handler } from '@netlify/functions';

const PDFSHIFT_URL = 'https://api.pdfshift.io/v3/convert/pdf';

// SANDBOX: PDFs de teste com marca d'água que NÃO consomem os créditos do mês.
// Manter true durante a validação; trocar para false (ou setar a env var
// PDFSHIFT_SANDBOX=false no Netlify) para gerar o PDF real sem marca d'água.
const SANDBOX = (process.env.PDFSHIFT_SANDBOX ?? 'true') !== 'false';

const handler: Handler = async (event) => {
  // CORS: só aceitar origem do próprio site (mesmo padrão dos outros proxies).
  const origin = event.headers['origin'] ?? '';
  const allowed = origin.includes('netlify.app') || origin.includes('localhost') || origin.includes('127.0.0.1');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'PDFSHIFT_API_KEY não configurada nas env vars do Netlify' }) };
  }

  const html = event.body ?? '';
  if (!html.trim()) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'HTML vazio no body da requisição' }) };
  }

  try {
    const resp = await fetch(PDFSHIFT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        source: html,          // HTML cru (gerarPropostaHTML inteiro)
        format: '1152xauto',   // PÁGINA ÚNICA: largura 1152px, altura = conteúdo
        margin: 0,             // tira encosta nas bordas
        use_print: false,      // renderiza SCREEN (ignora @media print) → look de tela
        sandbox: SANDBOX,      // teste com marca d'água enquanto SANDBOX=true
      }),
    });

    if (!resp.ok) {
      // PDFShift devolve JSON de erro quando falha (key inválida, HTML inválido…).
      const errText = await resp.text();
      return {
        statusCode: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `PDFShift ${resp.status}: ${errText.slice(0, 600)}` }),
      };
    }

    // Sucesso: bytes do PDF. Netlify classic function devolve binário em base64.
    const pdf = Buffer.from(await resp.arrayBuffer());
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      body: pdf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: e instanceof Error ? e.message : 'Erro no proxy PDFShift' }),
    };
  }
};

export { handler };
