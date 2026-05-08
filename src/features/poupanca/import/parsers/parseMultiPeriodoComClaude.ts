// --- Parser multi-período para PDFs onshore (Comdinheiro) ---
// Extrai registros mensais da tabela "Aplicações e Resgates" e "Performance Histórica".

import { chamarClaude } from './parseComClaude';

export interface RegistroMensal {
  mes: number;                    // 1–12
  ano: number;
  pl_inicial_total: number;       // Saldo Inicial (A)
  aporte_mes_total: number;       // Saldo Movimentações (E = B - C)
  rentabilidade_total: number;    // Rendimento Nominal (F)
  pl_total: number;               // Saldo Final (G)
  rentabilidade_pct: number;      // decimal (ex: 0.0092)
  cdi_mes_pct: number | null;     // CDI do mês em decimal, null se indisponível
  impostos_mes: number | null;    // Impostos (D) — valor positivo, null se indisponível
  // Valor do campo E da linha "(i) DD/MM/YYYY" quando a data != dia 1 do mês.
  // Representa o tombamento bruto (aporte de abertura de carteira nova).
  // null em meses normais (linha (i) é do dia 1 ou não representa abertura).
  nnm_linha_abertura?: number | null;
  // Dia DD da linha "(i) DD/MM/YYYY" quando data != dia 1 do mês.
  // Usado para pro-rata do benchmark (CDI) em meses de tombamento.
  // null em meses normais.
  dia_inicio?: number | null;
}

const SYSTEM = 'Você é um parser financeiro especializado. Responda APENAS com JSON válido, sem texto adicional, sem markdown, sem explicações.';

function buildPrompt(texto: string): string {
  return `Extraia os dados mensais da tabela "Aplicações e Resgates" e da tabela "Performance Histórica" deste relatório.

ESTRUTURA DA TABELA "Aplicações e Resgates":
A tabela tem dois tipos de linha para cada mês:
- Linha "(i) DD/MM/YYYY": saldo de abertura do mês + movimentações do primeiro dia útil
- Linha "Mês/Ano" (ex: "Abr/2026"): demais movimentações do mês + saldo final

Para cada mês, COMBINE as duas linhas assim:
- pl_inicial_total = coluna A da linha "(i)" do mês (saldo de abertura PURO, antes de qualquer movimentação)
- aporte_mes_total = SOMA do campo E (Saldo Movimentações) das DUAS linhas: linha "(i)" + linha "Mês/Ano"
- impostos_mes = SOMA do campo D (Impostos) das DUAS linhas
- rentabilidade_total = SOMA do campo F (Rendimento Nominal) das DUAS linhas: linha "(i)" + linha "Mês/Ano"
- pl_total = coluna G da linha "Mês/Ano" (saldo final do mês)
- nnm_linha_abertura = campo E da linha "(i)" SE a data dessa linha NÃO for o dia 1 do mês
                       (ex: "(i) 10/10/2025" → extrair E; "(i) 01/04/2026" → null)
                       Indica tombamento em carteira nova. null em meses normais.
- dia_inicio = dia DD da linha "(i) DD/MM/YYYY" SE a data NÃO for o dia 1 do mês
               (ex: "(i) 10/10/2025" → 10; "(i) 01/04/2026" → null)
               null em meses normais.

EXEMPLO REAL:
(i) 01/04/2026   23.132.427,07   8.245,32   399.999,88   0,00   -391.754,56   26.070,91   22.766.743,42
Abr/2026         22.766.743,42   396.144,97  395.155,83   6.731,66   989,13   77.437,37   22.838.438,26

Resultado correto para Abril/2026:
- pl_inicial_total = 23132427.07 (coluna A da linha (i), NÃO da linha Abr)
- aporte_mes_total = -391754.56 + 989.13 = -390765.43
- impostos_mes = 0 + 6731.66 = 6731.66
- rentabilidade_total = 26070.91 + 77437.37 = 103508.28
- pl_total = 22838438.26
- nnm_linha_abertura = null (linha (i) é de 01/04 — dia 1, então não é abertura)
- dia_inicio = null (linha (i) é de 01/04 — dia 1)

COMO IDENTIFICAR a linha "(i)" de cada mês:
- A linha "(i)" que aparece ANTES de "Abr/2026" pertence a Abril
- A linha "(i)" que aparece ANTES de "Mai/2026" pertence a Maio
- E assim por diante

CASO ESPECIAL — CARTEIRA ABERTA NO MEIO DO MÊS (TOMBAMENTO):
Quando a linha "(i)" NÃO é do primeiro dia do mês (ex: "(i) 10/10/2025"
em vez de "(i) 01/10/2025"), a carteira abriu nesse mês. Nesse caso:
- pl_inicial_total = 0 (carteira NÃO EXISTIA antes da abertura)
- O valor da coluna A da linha "(i)" é geralmente 0 também
- O campo E da linha "(i)" contém o valor do tombamento (aporte de abertura)

REGRA LINHA (i) COM DATA FUTURA:
Se a linha "(i) DD/MM/YYYY" tiver data POSTERIOR ao mês de referência
da lâmina, IGNORE essa linha completamente. NÃO extraia nnm_linha_abertura
nem dia_inicio dela — ambos devem ser null.

Exemplo: lâmina de Dez/2025 com linha "(i) 21/01/2026" → ignorar,
pois jan/2026 > dez/2025. O mês de dezembro deve ser tratado como
mês NORMAL (sem tombamento), usando apenas a linha "Dez/2025".

Essa anomalia ocorre quando o Comdinheiro gera lâminas com período
invertido (data_inicio > data_fim).

EXEMPLO TOMBAMENTO (carteira aberta em 10/10/2025):
(i) 10/10/2025   0,00         2.684.059,71   0,00         0,00     2.684.059,71   -2,99      2.684.056,72
Out/2025         2.684.056,72  1.934.084,50  1.170.551,53  22,36    763.532,97     28.902,25  3.476.472,58

Resultado correto para Out/2025:
- pl_inicial_total = 0 (não 2.684.056,72 — aquele é saldo APÓS abertura)
- aporte_mes_total = 2.684.059,71 + 763.532,97 = 3.447.592,68 (soma E das 2 linhas)
- rentabilidade_total = -2,99 + 28.902,25 = 28.899,26 (soma F das 2 linhas)
- impostos_mes = 0 + 22,36 = 22,36
- pl_total = 3.476.472,58
- nnm_linha_abertura = 2.684.059,71 (E da linha "(i) 10/10/2025" — data != dia 1)
- dia_inicio = 10 (dia da linha "(i) 10/10/2025")

REGRA DE SANIDADE ao extrair aporte_mes_total:
- aporte_mes_total = (soma de E das 2 linhas) = B_total - C_total
- NUNCA inclua a coluna A no cálculo de aporte_mes_total
- Valide: pl_total ≈ pl_inicial_total + aporte_mes_total + rentabilidade_total - impostos_mes
  (diferença < R$ 1; se ≈ pl_inicial_total, você somou A por engano)

REGRAS ADICIONAIS:
1. Extrair APENAS meses individuais (ex: "Jan/2025", "Jun/2025")
2. IGNORAR linhas de subtotal anual (ex: "2025", "2026")
3. Para rentabilidade_pct: usar a linha "Carteira" da tabela "Performance Histórica" para o mês correspondente, dividido por 100 (ex: "0,92" → 0.0092)
4. Para cdi_mes_pct: usar a linha "CDI" da tabela "Performance Histórica", dividido por 100. Se não disponível: null
5. Todos os valores numéricos em formato decimal ponto (não vírgula)
6. impostos_mes: sempre valor POSITIVO. Se zero ou ausente: null

Retorne SOMENTE este JSON:
{
  "registros": [
    {
      "mes": 4,
      "ano": 2026,
      "pl_inicial_total": 469325.52,
      "aporte_mes_total": -5000.00,
      "rentabilidade_total": 4203.11,
      "pl_total": 468528.63,
      "rentabilidade_pct": 0.0090,
      "cdi_mes_pct": 0.0096,
      "impostos_mes": 12.45,
      "nnm_linha_abertura": null,
      "dia_inicio": null
    }
  ]
}

Texto do relatório:
${texto}`;
}

function validarRegistro(r: Record<string, unknown>): RegistroMensal | null {
  const mes = Number(r.mes);
  const ano = Number(r.ano);
  const plIni = Number(r.pl_inicial_total);
  const aporte = Number(r.aporte_mes_total);
  const rent = Number(r.rentabilidade_total);
  const plFim = Number(r.pl_total);
  const rentPct = Number(r.rentabilidade_pct);

  if ([mes, ano, plIni, plFim, rentPct].some(isNaN)) {
    console.warn('[MultiPeriodo] Registro descartado — campos obrigatórios inválidos:', r);
    return null;
  }

  const cdi = r.cdi_mes_pct != null ? Number(r.cdi_mes_pct) : null;
  const imp = r.impostos_mes != null ? Number(r.impostos_mes) : null;
  const nnmAbertura = r.nnm_linha_abertura != null ? Number(r.nnm_linha_abertura) : null;
  const diaIni = r.dia_inicio != null ? Number(r.dia_inicio) : null;

  // Validação de consistência: pl_total ≈ pl_inicial + aporte + rent - impostos (tol R$ 1)
  // Impostos entram na conta — rendimento_nominal (F) NÃO é líquido de impostos
  // no Comdinheiro. Sem subtrair, meses com IR teriam warning falso.
  const impVal = imp != null && !isNaN(imp) ? imp : 0;
  const esperado = plIni + (isNaN(aporte) ? 0 : aporte) + (isNaN(rent) ? 0 : rent) - impVal;
  const diff = Math.abs(plFim - esperado);
  if (diff > 1) {
    console.warn(`[MultiPeriodo] ${mes}/${ano}: diff R$ ${diff.toFixed(2)} (esperado ${esperado.toFixed(2)}, obteve ${plFim.toFixed(2)})`);
  }

  return {
    mes, ano,
    pl_inicial_total: plIni,
    aporte_mes_total: isNaN(aporte) ? 0 : aporte,
    rentabilidade_total: isNaN(rent) ? 0 : rent,
    pl_total: plFim,
    rentabilidade_pct: rentPct,
    cdi_mes_pct: cdi != null && !isNaN(cdi) ? cdi : null,
    impostos_mes: imp != null && !isNaN(imp) && imp > 0 ? imp : null,
    nnm_linha_abertura: nnmAbertura != null && !isNaN(nnmAbertura) ? nnmAbertura : null,
    dia_inicio: diaIni != null && !isNaN(diaIni) && diaIni >= 1 && diaIni <= 31 ? diaIni : null,
  };
}

async function tentarParsear(texto: string, temperatura: number): Promise<RegistroMensal[]> {
  const prompt = (temperatura === 0 ? '[temperatura=0] ' : '') + buildPrompt(texto);

  // Usa system prompt separado via prefixo no user message
  // (chamarClaude envia apenas user messages)
  const fullPrompt = `${SYSTEM}\n\n${prompt}`;
  const raw = await chamarClaude(fullPrompt);

  const json = JSON.parse(raw);
  const registrosRaw: Record<string, unknown>[] = json.registros ?? json;

  if (!Array.isArray(registrosRaw) || registrosRaw.length === 0) {
    throw new Error('Array de registros vazio ou ausente');
  }

  const validos: RegistroMensal[] = [];
  for (const r of registrosRaw) {
    const v = validarRegistro(r);
    if (v) validos.push(v);
  }

  return validos.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
}

export async function parseMultiPeriodoComClaude(
  texto: string,
  sigla: string,
): Promise<RegistroMensal[]> {
  // Primeira tentativa
  try {
    const registros = await tentarParsear(texto, 1);
    if (registros.length === 0) throw new Error('Nenhum registro válido');
    console.log(`[MultiPeriodo] ${sigla}: ${registros.length} meses extraídos`);
    return registros;
  } catch (e) {
    console.warn(`[MultiPeriodo] ${sigla}: primeira tentativa falhou, retentando com temperatura 0...`, e);
  }

  // Segunda tentativa (temperatura 0)
  try {
    const registros = await tentarParsear(texto, 0);
    if (registros.length === 0) throw new Error('Nenhum registro mensal encontrado');
    console.log(`[MultiPeriodo] ${sigla}: ${registros.length} meses extraídos (retry)`);
    return registros;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[MultiPeriodo] ${sigla}: falha definitiva`, e);
    throw new Error(`Nenhum registro mensal encontrado para ${sigla} — ${msg}`);
  }
}
