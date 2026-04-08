// --- Prompts e tipos para parser de documentos de veículos (DUT/CRLV) ---

import type { CampoExtraido } from './useDocumentParser';

export interface VeiculoExtraido {
  marca: CampoExtraido<string>;
  modelo: CampoExtraido<string>;
  ano_modelo: CampoExtraido<number>;
  ano_fabricacao: CampoExtraido<number>;
  placa: CampoExtraido<string>;
  renavam: CampoExtraido<string>;
  cor: CampoExtraido<string>;
  combustivel: CampoExtraido<string>;
  chassi: CampoExtraido<string>;
}

export const PROMPTS_VEICULO = {
  system: `Você é um especialista em análise de documentos veiculares brasileiros (DUT, CRLV).
Analise o documento e extraia as informações do veículo.
Responda APENAS com JSON válido, sem texto adicional, sem markdown.
Para cada campo, indique a confiança: 'alta' (dado explícito), 'media' (inferido), 'baixa' (ambíguo).
Se não encontrar um campo, use valor: null e confianca: 'baixa'.`,

  user: `Analise este documento e extraia os dados do veículo:
{
  "documento_tipo": "string (ex: CRLV, DUT)",
  "paginas_analisadas": 0,
  "avisos": [],
  "campos": {
    "marca": { "valor": "string", "confianca": "alta|media|baixa", "trecho_original": "..." },
    "modelo": { "valor": "string", "confianca": "..." },
    "ano_modelo": { "valor": 0, "confianca": "..." },
    "ano_fabricacao": { "valor": 0, "confianca": "..." },
    "placa": { "valor": "ABC1D23", "confianca": "..." },
    "renavam": { "valor": "string", "confianca": "..." },
    "cor": { "valor": "string", "confianca": "..." },
    "combustivel": { "valor": "string", "confianca": "..." },
    "chassi": { "valor": "string", "confianca": "..." }
  }
}`,
};
