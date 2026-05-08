// --- Utilitário de dias úteis ---
// Conta dias úteis (exclui sábados, domingos e feriados nacionais fixos).
// Usado para pro-rata de benchmarks (CDI, Fed Funds) em períodos parciais.

// Feriados nacionais fixos (mês, dia).
// Feriados móveis (Carnaval, Páscoa, Corpus Christi) não entram — aproximação
// aceitável para pro-rata de benchmark; o desvio é menor que 1 dia útil/mês.
const FERIADOS_FIXOS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],   // Ano Novo
  [4, 21],  // Tiradentes
  [5, 1],   // Dia do Trabalho
  [9, 7],   // Independência
  [10, 12], // N. Sra. Aparecida
  [11, 2],  // Finados
  [11, 15], // Proclamação da República
  [11, 20], // Consciência Negra
  [12, 25], // Natal
] as const;

function ehFeriado(mes: number, dia: number): boolean {
  return FERIADOS_FIXOS.some(([m, d]) => m === mes && d === dia);
}

function ehDiaUtil(ano: number, mes: number, dia: number): boolean {
  const dow = new Date(ano, mes - 1, dia).getDay();
  if (dow === 0 || dow === 6) return false;
  return !ehFeriado(mes, dia);
}

export function diasUteisEntre(ano: number, mes: number, diaIni: number, diaFim: number): number {
  if (diaFim < diaIni) return 0;
  let count = 0;
  for (let d = diaIni; d <= diaFim; d++) {
    if (ehDiaUtil(ano, mes, d)) count++;
  }
  return count;
}

export function diasUteisNoMes(ano: number, mes: number): number {
  const ultimo = new Date(ano, mes, 0).getDate();
  return diasUteisEntre(ano, mes, 1, ultimo);
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}
