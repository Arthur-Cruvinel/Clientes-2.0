// --- Slug canônico do projeto ---
// Fonte única de verdade para gerar identificadores estáveis a partir de
// nomes livres (de cliente, colaborador, etc). Substitui ~14 implementações
// locais espalhadas pelo código que faziam quase a mesma coisa.

/**
 * Gera slug canônico a partir de texto livre.
 *
 * Regra: NFD + remove combining marks + lowercase + trim
 *        + colapsa whitespace + spaces→_ + remove caracteres não [a-z0-9_]
 *
 * Casos:
 *   slug("KEVIN SANTOS LOPES")       → "kevin_santos_lopes"
 *   slug("Tamires Cássia")            → "tamires_cassia"
 *   slug("João Silva  Jr.")           → "joao_silva_jr"
 *   slug("  espaços extras  ")        → "espacos_extras"
 *   slug("Maria-João")                → "mariajoao"  (hífen é removido)
 *
 * Use para: docIds em Firestore, identificadores em URL, chaves estáveis.
 *
 * NÃO use para: nomes de arquivo de download (use a slugify específica de
 *               exportExcel.ts/exportPdf.ts, que preserva hífens p/ legibilidade);
 *               labels visuais (use o nome original, não o slug).
 *
 * Garantia: idempotente — slug(slug(x)) === slug(x) para qualquer x.
 */
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// === Testes manuais (rodar mentalmente ou copiar para playground) ===
// console.assert(slug("KEVIN SANTOS LOPES") === "kevin_santos_lopes");
// console.assert(slug("Tamires Cássia") === "tamires_cassia");
// console.assert(slug("  espaços  ") === "espacos");
// console.assert(slug(slug("João")) === slug("João")); // idempotência
