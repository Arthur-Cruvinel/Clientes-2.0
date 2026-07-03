// Parcelamento do total FECHADO do orçamento (success fee fora — devido no êxito).
// N parcelas iguais; a ÚLTIMA absorve o resto do arredondamento → Σ = total ao
// centavo. Fonte única (tela + PDF). N<=1 = à vista.

function n(parcelas: number): number { return Math.max(1, Math.floor(parcelas || 1)); }

/** Valor das N−1 primeiras parcelas (piso ao centavo). N<=1 → o total. */
export function valorParcela(totalFechado: number, parcelas: number): number {
  const N = n(parcelas);
  if (N <= 1) return totalFechado;
  return Math.floor((totalFechado * 100) / N) / 100;
}

/** Última parcela: absorve o resto (Σ = total ao centavo). */
export function ultimaParcela(totalFechado: number, parcelas: number): number {
  const N = n(parcelas);
  if (N <= 1) return totalFechado;
  return Math.round((totalFechado - valorParcela(totalFechado, N) * (N - 1)) * 100) / 100;
}

/** true quando a última parcela difere das demais (ajuste de centavo). */
export function ultimaDifere(totalFechado: number, parcelas: number): boolean {
  return Math.abs(ultimaParcela(totalFechado, parcelas) - valorParcela(totalFechado, parcelas)) > 0.005;
}
