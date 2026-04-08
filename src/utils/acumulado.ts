// --- Cálculo de retorno composto acumulado ---

/**
 * Calcula retorno acumulado composto mês a mês.
 * Entrada: array de retornos decimais mensais (ex: [0.0031, 0.0183, -0.0172])
 * Saída: array de retornos acumulados, mesmo tamanho.
 * Fórmula: acum[i] = (1 + r[0]) × (1 + r[1]) × ... × (1 + r[i]) - 1
 * Valores null/undefined são tratados como 0 (mês neutro).
 */
export function calcularAcumulado(retornos: (number | null)[]): number[] {
  const resultado: number[] = [];
  let produto = 1;
  for (const r of retornos) {
    produto *= 1 + (r ?? 0);
    resultado.push(produto - 1);
  }
  return resultado;
}

/**
 * Alinha os valores de CDI mensal com um array de meses do histórico.
 * Retorna array de mesma ordem/tamanho que `meses`, com null onde CDI indisponível.
 */
export function alinharCDI(
  meses: { ano: number; mes: number }[],
  cdiPorMes: Record<string, number | null>,
): (number | null)[] {
  return meses.map(({ ano, mes }) => {
    const chave = `${ano}-${String(mes).padStart(2, '0')}`;
    return cdiPorMes[chave] ?? null;
  });
}
