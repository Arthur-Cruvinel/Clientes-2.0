// --- Prompts e tipos para parser de documentos de imóveis ---

import type { CampoExtraido } from './useDocumentParser';

export interface ImovelExtraido {
  descricao: CampoExtraido<string>;
  tipo: CampoExtraido<'residencial' | 'comercial' | 'rural' | 'terreno'>;
  endereco: CampoExtraido<string>;
  bairro: CampoExtraido<string>;
  cidade: CampoExtraido<string>;
  uf: CampoExtraido<string>;
  cep: CampoExtraido<string>;
  area_total_m2: CampoExtraido<number>;
  area_privativa_m2: CampoExtraido<number>;
  quartos: CampoExtraido<number>;
  banheiros: CampoExtraido<number>;
  vagas_garagem: CampoExtraido<number>;
  andar: CampoExtraido<number>;
  ano_construcao: CampoExtraido<number>;
  valor_compra: CampoExtraido<number>;
  data_compra: CampoExtraido<string>;
  valor_aluguel: CampoExtraido<number>;
}

export const PROMPTS_IMOVEL = {
  system: `Você é um especialista em análise de documentos imobiliários brasileiros.
Analise o documento e extraia as informações do imóvel.
Responda APENAS com JSON válido, sem texto adicional, sem markdown.
Para cada campo, indique a confiança: 'alta' (dado explícito no doc),
'media' (inferido com segurança), 'baixa' (estimado ou ambíguo).
Se não encontrar um campo, use valor: null e confianca: 'baixa'.`,

  user: `Analise este documento e extraia os dados do imóvel no seguinte formato JSON:
{
  "documento_tipo": "string (ex: Contrato de Compra e Venda)",
  "paginas_analisadas": 0,
  "avisos": ["lista de campos não encontrados ou ambíguos"],
  "campos": {
    "descricao": { "valor": "string descritiva", "confianca": "alta|media|baixa", "trecho_original": "trecho" },
    "tipo": { "valor": "residencial|comercial|rural|terreno", "confianca": "..." },
    "endereco": { "valor": "logradouro e número", "confianca": "..." },
    "bairro": { "valor": "string", "confianca": "..." },
    "cidade": { "valor": "string", "confianca": "..." },
    "uf": { "valor": "sigla 2 letras", "confianca": "..." },
    "cep": { "valor": "string", "confianca": "..." },
    "area_total_m2": { "valor": 0, "confianca": "..." },
    "area_privativa_m2": { "valor": null, "confianca": "..." },
    "quartos": { "valor": null, "confianca": "..." },
    "banheiros": { "valor": null, "confianca": "..." },
    "vagas_garagem": { "valor": null, "confianca": "..." },
    "andar": { "valor": null, "confianca": "..." },
    "ano_construcao": { "valor": null, "confianca": "..." },
    "valor_compra": { "valor": 0, "confianca": "..." },
    "data_compra": { "valor": "YYYY-MM-DD", "confianca": "..." },
    "valor_aluguel": { "valor": null, "confianca": "..." }
  }
}`,
};
