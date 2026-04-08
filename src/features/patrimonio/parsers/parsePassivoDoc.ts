// --- Prompts e tipos para parser de documentos de passivos (financiamentos) ---

import type { CampoExtraido } from './useDocumentParser';

export interface PassivoExtraido {
  tipo: CampoExtraido<string>;
  credor: CampoExtraido<string>;
  descricao: CampoExtraido<string>;
  saldo_devedor: CampoExtraido<number>;
  taxa_juros_mensal: CampoExtraido<number>;
  sistema_amortizacao: CampoExtraido<'SAC' | 'PRICE' | 'outro'>;
  parcela_atual: CampoExtraido<number>;
  parcelas_restantes: CampoExtraido<number>;
  data_inicio: CampoExtraido<string>;
  data_fim: CampoExtraido<string>;
  bem_vinculado: CampoExtraido<string>;
}

export const PROMPTS_PASSIVO = {
  system: `Você é um especialista em análise de contratos de financiamento e empréstimos brasileiros.
Analise o documento e extraia as informações do passivo/dívida.
Responda APENAS com JSON válido, sem texto adicional, sem markdown.
Para cada campo, indique a confiança: 'alta' (dado explícito), 'media' (inferido), 'baixa' (ambíguo).
Se não encontrar um campo, use valor: null e confianca: 'baixa'.
Para taxa_juros_mensal, converta taxa anual para mensal se necessário (÷12).
Para sistema_amortizacao, infira do tipo de parcelas se não explícito.`,

  user: `Analise este contrato e extraia os dados do financiamento/empréstimo:
{
  "documento_tipo": "string (ex: Contrato de Financiamento Imobiliário)",
  "paginas_analisadas": 0,
  "avisos": [],
  "campos": {
    "tipo": { "valor": "financiamento_imovel|financiamento_veiculo|emprestimo|cartao|outro", "confianca": "..." },
    "credor": { "valor": "nome do banco/instituição", "confianca": "...", "trecho_original": "..." },
    "descricao": { "valor": "descrição resumida", "confianca": "..." },
    "saldo_devedor": { "valor": 0, "confianca": "..." },
    "taxa_juros_mensal": { "valor": 0.00, "confianca": "..." },
    "sistema_amortizacao": { "valor": "SAC|PRICE|outro", "confianca": "..." },
    "parcela_atual": { "valor": 0, "confianca": "..." },
    "parcelas_restantes": { "valor": 0, "confianca": "..." },
    "data_inicio": { "valor": "YYYY-MM-DD", "confianca": "..." },
    "data_fim": { "valor": "YYYY-MM-DD", "confianca": "..." },
    "bem_vinculado": { "valor": "descrição do bem em garantia", "confianca": "..." }
  }
}`,
};
