// --- Hook central para parser de documentos via Claude API ---

import { useState, useCallback } from 'react';

export interface CampoExtraido<T> {
  valor: T | null;
  confianca: 'alta' | 'media' | 'baixa';
  trecho_original?: string;
}

export interface ResultadoParser<T> {
  campos: T;
  documento_tipo: string;
  paginas_analisadas: number;
  avisos: string[];
}

const PROXY_URL = '/.netlify/functions/claude-proxy';
// claude-sonnet-4-20250514 passou a retornar 404 (not_found_error). Migrado para
// claude-sonnet-4-6 (alias atual de Sonnet). Usar sempre o alias sem sufixo de
// data; atualizar quando a Anthropic lançar a próxima geração. Manter em sincronia
// com o parser de lâminas (parseComClaude.ts).
const MODEL = 'claude-sonnet-4-6';

export function useDocumentParser() {
  const [parseando, setParseando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const parsearDocumento = useCallback(async <T,>(
    arquivo: File,
    promptSistema: string,
    promptUsuario: string,
  ): Promise<ResultadoParser<T> | null> => {
    setParseando(true); setErro(null);
    try {
      // 1. PDF → base64
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(arquivo);
      });

      // 2. Chamar Claude via proxy serverless
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          system: promptSistema,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: promptUsuario },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`API ${response.status}: ${txt.slice(0, 200)}`);
      }

      const data = await response.json();
      const texto = data.content?.[0]?.text;
      if (typeof texto !== 'string') throw new Error('Resposta inválida da API');

      // 3. Limpar markdown e parsear JSON
      const limpo = texto.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(limpo) as ResultadoParser<T>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[DocParser] Erro:', msg);
      setErro(msg);
      return null;
    } finally {
      setParseando(false);
    }
  }, []);

  return { parsearDocumento, parseando, erro };
}
