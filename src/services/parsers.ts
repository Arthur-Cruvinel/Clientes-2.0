// --- Parser numérico robusto ---

/**
 * Converte qualquer representação numérica (string ou number) para number.
 * Trata formato brasileiro (1.000,50) e americano (1,000.50).
 * Retorna null se não conseguir converter.
 */
export function parseNumericValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;

  let s = String(value).replace('R$', '').trim();
  if (s === '') return null;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  // Formato BR: 1.000,50 (ponto como milhar, vírgula como decimal)
  if (hasDot && hasComma && s.lastIndexOf('.') < s.lastIndexOf(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Apenas vírgula: 1000,50
  else if (hasComma && !hasDot) {
    s = s.replace(',', '.');
  }
  // Formato US: 1,000.50 (vírgula como milhar, ponto como decimal)
  else if (hasComma && hasDot && s.lastIndexOf(',') < s.lastIndexOf('.')) {
    s = s.replace(/,/g, '');
  }

  const number = parseFloat(s);
  return isNaN(number) ? null : number;
}
