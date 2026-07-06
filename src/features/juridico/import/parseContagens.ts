// --- Parser DETERMINÍSTICO de contagens de consumo jurídico (entrada assistida) ---
// Fonte: o relatório do Monday é PDF-imagem (parse de PDF morto por prova técnica —
// 0 itens de texto, 1 operador de imagem). O operador COLA as contagens do dashboard,
// uma linha por cliente ("Nome <espaços> número"). Este parser é puro e determinístico:
// nome = tudo antes do último inteiro; contagem = o inteiro final. Linha que não casa
// vira ERRO nomeado (linha + motivo) — NUNCA se pula em silêncio, nunca se inventa número.

export interface EntradaContagem {
  nome: string;
  contagem: number;
}

export interface ErroLinha {
  linha: number;      // 1-based, para o operador achar na textarea
  texto: string;      // conteúdo bruto da linha
  motivo: string;
}

export interface ResultadoParse {
  entradas: EntradaContagem[];
  total: number;          // Σ contagens (para conferência visual contra o PDF)
  erros: ErroLinha[];     // vazio = parse limpo
}

// "Nome <espaços> inteiro" — o inteiro FINAL é a contagem; o resto (trim) é o nome.
const LINHA_RE = /^(.+?)\s+(\d+)$/;

export function parseContagens(texto: string): ResultadoParse {
  const entradas: EntradaContagem[] = [];
  const erros: ErroLinha[] = [];

  texto.split(/\r?\n/).forEach((bruto, i) => {
    const linha = bruto.trim();
    if (linha === '') return;            // linha em branco: ignora (não é erro)
    const m = LINHA_RE.exec(linha);
    if (!m) {
      erros.push({ linha: i + 1, texto: bruto, motivo: 'não casa o formato "Nome <espaços> número inteiro"' });
      return;
    }
    const nome = m[1].trim();
    if (nome === '') {
      erros.push({ linha: i + 1, texto: bruto, motivo: 'nome vazio (só número)' });
      return;
    }
    entradas.push({ nome, contagem: parseInt(m[2], 10) });
  });

  const total = entradas.reduce((s, e) => s + e.contagem, 0);
  return { entradas, total, erros };
}
