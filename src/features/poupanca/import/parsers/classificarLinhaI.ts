// --- Classificação determinística da linha "(i)" do Comdinheiro (multi-período) ---
// Princípio: o LLM extrai as células CRUAS; ESTE código classifica por DATA.
// Cobre os casos: mês corrente (entrada / continuação), mês anterior (ponte),
// data futura / ausente. NNM é SEMPRE derivado pela identidade contábil.
// ZERO dependências — função pura, testável isoladamente (gate anti-regressão).

export interface CelulasMultiPeriodo {
  mes: number;                  // mês de referência (competência)
  ano: number;                  // ano de referência
  pl_inicial_total: number;     // A da linha "(i)"  (ou A da "Mês" quando não há "(i)")
  rentabilidade_total: number;  // SOMA F das 2 linhas (como o LLM entrega hoje)
  impostos_mes: number;         // SOMA D das 2 linhas
  pl_total: number;             // G da linha "Mês/Ano" (saldo final do mês)
  data_linha_i: string | null;  // "DD/MM/AAAA" da linha "(i)" (null se ausente)
  g_linha_i: number | null;     // G da linha "(i)"  (= A da linha "Mês/Ano")
  f_linha_i: number | null;     // F da linha "(i)"
  d_linha_i: number | null;     // D da linha "(i)"
}

export type CasoLinhaI = 'futura_ausente' | 'ponte' | 'entrada' | 'continuacao';

export interface ResultadoClassificacao {
  caso: CasoLinhaI;
  pl_inicial: number;
  rentabilidade: number;
  impostos: number;
  nnm: number;                        // = pl_total − pl_inicial − rent + imp (identidade)
  nnm_linha_abertura: number | null;
  dia_inicio: number | null;
}

const TOL = 1;
const num = (v: number | null | undefined) => (typeof v === 'number' && !isNaN(v) ? v : 0);

/** Parse "DD/MM/AAAA" (aceita "/" ou "-") → {dia,mes,ano} ou null. */
export function parseDataLinhaI(s: string | null | undefined): { dia: number; mes: number; ano: number } | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;
  const dia = Number(m[1]); const mes = Number(m[2]); let ano = Number(m[3]);
  if (ano < 100) ano += 2000;
  if (!(mes >= 1 && mes <= 12) || !(dia >= 1 && dia <= 31)) return null;
  return { dia, mes, ano };
}

/**
 * Classifica o registro pela DATA da linha "(i)" e devolve os campos finais.
 * O NNM é derivado pela identidade em TODOS os casos.
 */
export function classificarLinhaI(c: CelulasMultiPeriodo): ResultadoClassificacao {
  const di = parseDataLinhaI(c.data_linha_i);
  const refN = c.ano * 12 + c.mes;
  const ident = (pi: number, rent: number, imp: number) => c.pl_total - pi - rent + imp;

  // CASO A — sem "(i)" OU "(i)" com data POSTERIOR (lâmina invertida): usa os
  // campos combinados como vieram (a "Mês" é a base; comportamento existente).
  if (!di || di.ano * 12 + di.mes > refN) {
    const pi = c.pl_inicial_total, rent = c.rentabilidade_total, imp = c.impostos_mes;
    return { caso: 'futura_ausente', pl_inicial: pi, rentabilidade: rent, impostos: imp,
      nnm: ident(pi, rent, imp), nnm_linha_abertura: null, dia_inicio: null };
  }

  // CASO B — "(i)" no MÊS ANTERIOR → PONTE: usa SÓ a linha "Mês". O E/F/D da
  // "(i)" pertence ao mês anterior e é descartado.
  if (di.ano * 12 + di.mes < refN) {
    const pi = num(c.g_linha_i);                          // A da "Mês" = G da "(i)"
    const rent = c.rentabilidade_total - num(c.f_linha_i); // F(Mês)
    const imp = c.impostos_mes - num(c.d_linha_i);         // D(Mês)
    return { caso: 'ponte', pl_inicial: pi, rentabilidade: rent, impostos: imp,
      nnm: ident(pi, rent, imp), nnm_linha_abertura: null, dia_inicio: null };
  }

  // CASO C — "(i)" no MÊS DE REFERÊNCIA.
  const aI = c.pl_inicial_total;                           // A da linha "(i)"
  if (Math.abs(aI) <= TOL) {
    // ENTRADA real (A(i) ≈ 0): pl_inicial = 0, depósito de abertura entra no NNM
    // via identidade. nnm_linha_abertura = E(i) = G(i) − A(i) − F(i) + D(i).
    const eI = num(c.g_linha_i) - aI - num(c.f_linha_i) + num(c.d_linha_i);
    return { caso: 'entrada', pl_inicial: 0, rentabilidade: c.rentabilidade_total, impostos: c.impostos_mes,
      nnm: ident(0, c.rentabilidade_total, c.impostos_mes),
      nnm_linha_abertura: Math.abs(eI) > TOL ? eI : null, dia_inicio: di.dia };
  }
  // CONTINUAÇÃO (A(i) > 0): pl_inicial = A(i); rent/imp = somas das 2 linhas;
  // NNM = identidade = E(i) + E(Mês) — INCLUI o movimento do 1º dia.
  return { caso: 'continuacao', pl_inicial: aI, rentabilidade: c.rentabilidade_total, impostos: c.impostos_mes,
    nnm: ident(aI, c.rentabilidade_total, c.impostos_mes), nnm_linha_abertura: null, dia_inicio: null };
}
