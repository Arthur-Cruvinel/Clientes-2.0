// --- Parser multi-período para PDFs onshore (Comdinheiro) ---
// Extrai registros mensais da tabela "Aplicações e Resgates" e "Performance Histórica".

import { chamarClaude } from './parseComClaude';
import { classificarLinhaI } from './classificarLinhaI';

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
  // Flags de auditoria — preenchidas quando a identidade contábil corrige o
  // aporte lido pelo LLM (ver validarRegistro). Alimentam o alerta visual
  // no preview (âmbar). Ausentes em registros sem correção.
  _corrigido_por_identidade?: boolean;
  _aporte_original_llm?: number;
  // Alerta-only (vermelho): o pl_inicial deste mês não bate com o pl_total do
  // mês anterior (gap, movimentação entre contas, ou leitura suspeita do LLM).
  // NÃO altera o NNM — é só sinalização para conferência humana. Preenchida em
  // marcarEncadeamento (pós-parse), pois exige o registro do mês anterior.
  _encadeamento_quebrado?: boolean;
  _pl_inicial_esperado?: number;   // pl_total do mês anterior (para o tooltip)
}

const SYSTEM = 'Você é um parser financeiro especializado. Responda APENAS com JSON válido, sem texto adicional, sem markdown, sem explicações.';

function buildPrompt(texto: string): string {
  return `Extraia os dados mensais da tabela "Aplicações e Resgates" e da tabela "Performance Histórica" deste relatório.

ESTRUTURA DA TABELA "Aplicações e Resgates":
A tabela tem dois tipos de linha para cada mês:
- Linha "(i) DD/MM/YYYY": saldo de abertura do mês + movimentações do primeiro dia útil
- Linha "Mês/Ano" (ex: "Abr/2026"): demais movimentações do mês + saldo final

FONTE DE VERDADE — leia estes 4 campos com MÁXIMA atenção (o NNM do mês é
DERIVADO deles pela identidade contábil, NÃO da soma de movimentações):
- pl_total = coluna G da linha "Mês/Ano" (saldo final do mês) ← CRÍTICO, leia todos os dígitos
- pl_inicial_total = coluna A da linha "(i)" (saldo de abertura PURO, antes de qualquer
  movimentação). É a coluna A REAL — NÃO zere por causa da data: se A > R$ 1, use A
  (continuação, mesmo que a linha (i) seja "02/01" porque o dia 1 foi feriado/fim de
  semana). Só é 0 quando A da linha (i) for genuinamente ≈ 0 (ABERTURA REAL de carteira).
- rentabilidade_total = SOMA do campo F (Rendimento Nominal) das DUAS linhas
- impostos_mes = SOMA do campo D (Impostos) das DUAS linhas

O sistema calcula o NNM assim: aporte = pl_total − pl_inicial − rentabilidade + impostos.

CAMPO DE CROSS-CHECK (NÃO é a fonte do NNM):
- aporte_mes_total = SOMA do campo E (Saldo Movimentações) das DUAS linhas: "(i)" + "Mês/Ano".
  Forneça o melhor valor que conseguir ler; o sistema compara com a identidade e,
  se divergir, usa a identidade e sinaliza para conferência. NÃO force esse valor
  para bater com a identidade — reporte o que a coluna E realmente mostra.
- nnm_linha_abertura = campo E da linha "(i)" SOMENTE quando A (Saldo Inicial) da
                       linha "(i)" for ≈ 0 (≤ R$ 1), ou seja, ABERTURA REAL de carteira.
                       Se A > R$ 1 (continuação), use null. null em meses normais.
- dia_inicio = dia DD da linha "(i) DD/MM/YYYY" SOMENTE quando A da linha "(i)" for ≈ 0
               (abertura real). Se A > R$ 1 (continuação), use null. null em meses normais.

CÉLULAS CRUAS DA LINHA "(i)" — EXTRAIA SEMPRE (o SISTEMA classifica, você só extrai):
- data_linha_i = data da linha "(i)" como "DD/MM/AAAA" (ex: "30/04/2026"). null se não houver linha "(i)".
- g_linha_i = coluna G (Saldo Final) da linha "(i)". null se não houver.
- f_linha_i = coluna F (Rendimento Nominal) da linha "(i)". null se não houver.
- d_linha_i = coluna D (Impostos) da linha "(i)". null se não houver.
NÃO tente decidir entrada/continuação/ponte — apenas reporte essas células com fidelidade.
O sistema compara o MÊS de data_linha_i com o mês de referência e classifica sozinho:
  • data_linha_i no MÊS de referência → usa a linha "(i)" (entrada se A≈0, senão continuação).
  • data_linha_i no MÊS ANTERIOR (ex: "(i) 30/04" numa lâmina de Maio) → PONTE: o sistema
    usa só a linha "Mês" (A=g_linha_i) e descarta E/F/D da "(i)" (são do mês anterior).

EXEMPLO REAL:
(i) 01/04/2026   23.132.427,07   8.245,32   399.999,88   0,00   -391.754,56   26.070,91   22.766.743,42
Abr/2026         22.766.743,42   396.144,97  395.155,83   6.731,66   989,13   77.437,37   22.838.438,26

Resultado correto para Abril/2026:
- pl_total = 22838438.26 (coluna G da linha Abr) ← campo crítico
- pl_inicial_total = 23132427.07 (coluna A da linha (i), NÃO da linha Abr)
- rentabilidade_total = 26070.91 + 77437.37 = 103508.28
- impostos_mes = 0 + 6731.66 = 6731.66
- aporte_mes_total (cross-check, soma E) = -391754.56 + 989.13 = -390765.43
- conferência pela identidade: 22838438.26 − 23132427.07 − 103508.28 + 6731.66 = -390765.43 ✓
- nnm_linha_abertura = null (A da linha (i) = 23.132.427,07 > 0 → continuação, não abertura)
- dia_inicio = null (continuação)

COMO IDENTIFICAR a linha "(i)" de cada mês:
- A linha "(i)" que aparece ANTES de "Abr/2026" pertence a Abril
- A linha "(i)" que aparece ANTES de "Mai/2026" pertence a Maio
- E assim por diante

CASO ESPECIAL — CARTEIRA ABERTA NO MEIO DO MÊS (TOMBAMENTO):
O SINAL de abertura de carteira é a coluna **A (Saldo Inicial) da linha "(i)" ≈ 0**,
NÃO a data da linha. Carteira nova não tinha saldo antes → A = 0 e o campo E da
linha "(i)" traz o tombamento (aporte de abertura). Nesse caso:
- pl_inicial_total = 0 (carteira NÃO EXISTIA antes da abertura)
- nnm_linha_abertura = E da linha "(i)"; dia_inicio = DD da linha "(i)"

ATENÇÃO — NÃO confunda feriado no dia 1 com abertura:
Quando o dia 1 do mês é feriado/fim de semana, a linha "(i)" vem com a data do
primeiro dia útil (ex: "(i) 02/01" porque 01/01 é Ano Novo), mas a carteira JÁ
EXISTIA. O sinal é a coluna A: se A > R$ 1, é CONTINUAÇÃO:
- pl_inicial_total = A da linha "(i)" (o saldo inicial real, ex: 21.402.074,90)
- nnm_linha_abertura = null; dia_inicio = null (mês cheio, sem pro-rata)

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
- pl_inicial_total = 0 (A da linha (i) = 0,00 → ABERTURA REAL)
- aporte_mes_total = 2.684.059,71 + 763.532,97 = 3.447.592,68 (soma E das 2 linhas)
- rentabilidade_total = -2,99 + 28.902,25 = 28.899,26 (soma F das 2 linhas)
- impostos_mes = 0 + 22,36 = 22,36
- pl_total = 3.476.472,58
- nnm_linha_abertura = 2.684.059,71 (A=0 → abertura; E da linha "(i)" é o tombamento)
- dia_inicio = 10 (dia da linha "(i) 10/10/2025")

EXEMPLO CONTINUAÇÃO COM FERIADO NO DIA 1 (NÃO é abertura — A > 0):
(i) 02/01/2026   21.402.074,90   ...        ...          ...      ...            ...        ...
Jan/2026         ...             ...        ...          ...      ...            ...        26.415.199,36

Resultado correto para Jan/2026:
- pl_inicial_total = 21.402.074,90 (A da linha (i) > 0 → CONTINUAÇÃO, apesar de "02/01")
- nnm_linha_abertura = null (NÃO é abertura — a carteira já existia)
- dia_inicio = null (mês cheio para o cliente; sem pro-rata de CDI)
- aporte derivado pela identidade: pl_total − pl_inicial − rent + impostos

EXEMPLO PONTE — linha "(i)" datada no MÊS ANTERIOR (Ronaldo, lâmina de Maio):
(i) 30/04/2026   22.875.798,38   ...   ...   0,00   −3.499.999,98   12.706,54   19.388.504,94
Mai/2026         19.388.504,94   ...   ...   3.943,86   4.026.151,67   235.084,68   23.645.797,42

Células a extrair (você NÃO classifica — só reporta):
- pl_inicial_total = 22.875.798,38 (A da linha "(i)")
- pl_total = 23.645.797,42 (G da linha "Mai")
- rentabilidade_total = 12.706,54 + 235.084,68 = 247.791,22 (soma F)
- impostos_mes = 0,00 + 3.943,86 = 3.943,86 (soma D)
- data_linha_i = "30/04/2026" ; g_linha_i = 19.388.504,94 ; f_linha_i = 12.706,54 ; d_linha_i = 0,00
O SISTEMA detecta que 04/2026 < 05/2026 (mês anterior) → PONTE → usa pl_inicial = g_linha_i
(19.388.504,94), rent = 247.791,22 − 12.706,54 = 235.084,68, e NNM = 4.026.151,67 (só Maio).

REGRA DE SANIDADE ao extrair aporte_mes_total:
- aporte_mes_total = (soma de E das 2 linhas) = B_total - C_total
- NUNCA inclua a coluna A no cálculo de aporte_mes_total
- Valide: pl_total ≈ pl_inicial_total + aporte_mes_total + rentabilidade_total - impostos_mes
  (diferença < R$ 1; se ≈ pl_inicial_total, você somou A por engano)

ATENÇÃO CRÍTICA — NÚMEROS GRANDES EM pt-BR (não trunque os milhões):
- Os valores usam ponto como separador de MILHAR e vírgula como decimal.
  Leia TODOS os dígitos, com atenção especial aos grupos de milhão e dezena
  de milhão. NÃO descarte o grupo da frente.
- Exemplos de conversão correta:
    "70.516.612,99"  → 70516612.99   (NÃO 516612.99 — não perca os 70 milhões)
    "1.234.567,89"   → 1234567.89    (NÃO 234567.89)
    "70.369.560,60"  → 70369560.60   (NÃO 369560.60)
- Confira o pl_total (Saldo Final) e o aporte com a identidade
  pl_total = pl_inicial + aporte + rendimento − impostos antes de responder.
  Se não fechar, você provavelmente truncou um número grande — releia.

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
      "dia_inicio": null,
      "data_linha_i": "01/04/2026",
      "g_linha_i": 22766743.42,
      "f_linha_i": 26070.91,
      "d_linha_i": 0.00
    }
  ]
}

Texto do relatório:
${texto}`;
}

function validarRegistro(r: Record<string, unknown>): RegistroMensal | null {
  const mes = Number(r.mes);
  const ano = Number(r.ano);
  const plIni = Number(r.pl_inicial_total);   // A da linha "(i)" (input do caso C)
  const aporteLLM = Number(r.aporte_mes_total); // soma E das 2 linhas — só cross-check
  const rent = Number(r.rentabilidade_total);
  const plFim = Number(r.pl_total);
  const rentPct = Number(r.rentabilidade_pct);

  if ([mes, ano, plIni, plFim, rentPct].some(isNaN)) {
    console.warn('[MultiPeriodo] Registro descartado — campos obrigatórios inválidos:', r);
    return null;
  }

  const cdi = r.cdi_mes_pct != null ? Number(r.cdi_mes_pct) : null;
  const imp = r.impostos_mes != null ? Number(r.impostos_mes) : null;
  const impVal = imp != null && !isNaN(imp) ? imp : 0;
  const rentVal = isNaN(rent) ? 0 : rent;

  // Células CRUAS da linha "(i)" — o LLM só extrai; ESTE código classifica.
  const gI = r.g_linha_i != null ? Number(r.g_linha_i) : null;
  const fI = r.f_linha_i != null ? Number(r.f_linha_i) : null;
  const dI = r.d_linha_i != null ? Number(r.d_linha_i) : null;
  const dataI = typeof r.data_linha_i === 'string' ? r.data_linha_i : null;

  // ── Classificação determinística por DATA da linha "(i)" ─────────────────
  // Mês corrente → entrada (A(i)≈0) ou continuação (usa A(i)+soma, inclui 1º dia).
  // Mês anterior → PONTE (usa só a linha "Mês"; descarta E/F/D da "(i)").
  // Data futura/ausente → linha "Mês" como veio. NNM SEMPRE pela identidade.
  const cls = classificarLinhaI({
    mes, ano,
    pl_inicial_total: plIni,
    rentabilidade_total: rentVal,
    impostos_mes: impVal,
    pl_total: plFim,
    data_linha_i: dataI,
    g_linha_i: gI != null && !isNaN(gI) ? gI : null,
    f_linha_i: fI != null && !isNaN(fI) ? fI : null,
    d_linha_i: dI != null && !isNaN(dI) ? dI : null,
  });

  // Cross-check: a soma E lida pelo LLM diverge do NNM (identidade)? → âmbar.
  const aporteLLMv = isNaN(aporteLLM) ? 0 : aporteLLM;
  const diff = Math.abs(cls.nnm - aporteLLMv);
  let corrigido = false;
  let aporteOriginalLlm: number | undefined;
  if (diff > 0.01) {
    console.warn(
      `[NNM] ${mes}/${ano} (${cls.caso}) NNM=${cls.nnm.toFixed(2)} `
      + `vs soma E do LLM=${aporteLLMv.toFixed(2)} (diff R$ ${diff.toFixed(2)})`,
    );
    aporteOriginalLlm = aporteLLMv;
    corrigido = true;
  }

  return {
    mes, ano,
    pl_inicial_total: cls.pl_inicial,
    aporte_mes_total: cls.nnm,
    rentabilidade_total: cls.rentabilidade,
    pl_total: plFim,
    rentabilidade_pct: rentPct,
    cdi_mes_pct: cdi != null && !isNaN(cdi) ? cdi : null,
    impostos_mes: cls.impostos > 0 ? cls.impostos : null,
    nnm_linha_abertura: cls.nnm_linha_abertura,
    dia_inicio: cls.dia_inicio != null && cls.dia_inicio >= 1 && cls.dia_inicio <= 31 ? cls.dia_inicio : null,
    _corrigido_por_identidade: corrigido || undefined,
    _aporte_original_llm: aporteOriginalLlm,
  };
}

/** Salvaguarda ALERTA-ONLY de encadeamento mês a mês.
 *  Para cada mês (exceto o primeiro da sequência), confere se o pl_inicial
 *  bate com o pl_total do mês anterior. Se não bate (tolerância R$ 0,01),
 *  marca _encadeamento_quebrado + _pl_inicial_esperado para o alerta visual
 *  (vermelho/laranja). NÃO altera o NNM nem o pl_inicial — é só sinalização.
 *  Motivo de ser alerta-only: o encadeamento diverge legitimamente em ~9% dos
 *  meses reais (gaps, movimentação entre contas, meses offshore-only), então
 *  derivar o NNM dele regrediria a maioria — ver diagnóstico da Etapa 1. */
function marcarEncadeamento(registros: RegistroMensal[]): RegistroMensal[] {
  for (let i = 1; i < registros.length; i++) {
    const prev = registros[i - 1];
    const curr = registros[i];
    // Só faz sentido conferir quando o mês anterior tem saldo final positivo
    // e o mês atual não é uma reentrada (pl_inicial > 0).
    if ((prev.pl_total ?? 0) <= 0.01 || (curr.pl_inicial_total ?? 0) <= 0.01) continue;
    if (Math.abs(curr.pl_inicial_total - prev.pl_total) > 0.01) {
      curr._encadeamento_quebrado = true;
      curr._pl_inicial_esperado = prev.pl_total;
      console.warn(
        `[Encadeamento] ${curr.mes}/${curr.ano}: pl_inicial ${curr.pl_inicial_total} `
        + `≠ pl_total anterior ${prev.pl_total} (diff R$ ${Math.abs(curr.pl_inicial_total - prev.pl_total).toFixed(2)}) — alerta-only`,
      );
    }
  }
  return registros;
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

  const ordenados = validos.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
  return marcarEncadeamento(ordenados);
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
