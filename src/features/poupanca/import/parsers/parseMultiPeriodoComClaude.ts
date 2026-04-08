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
}

const SYSTEM = 'Você é um parser financeiro especializado. Responda APENAS com JSON válido, sem texto adicional, sem markdown, sem explicações.';

function buildPrompt(texto: string): string {
  return `Extraia os dados mensais da tabela "Aplicações e Resgates" e da tabela "Performance Histórica" deste relatório.

REGRAS CRÍTICAS:
1. Extrair APENAS linhas de meses individuais (ex: "Jan/2025", "Jun/2025", "Jan/2026")
2. IGNORAR linhas de subtotal anual (ex: "2025", "2026")
3. IGNORAR a linha inicial com formato "(i) DD/MM/YYYY"
4. Para rentabilidade_pct: usar a linha "Carteira" da tabela "Performance Histórica" para o mês correspondente, dividido por 100 (ex: "0,92" → 0.0092)
5. Para cdi_mes_pct: usar a linha "CDI" da tabela "Performance Histórica", dividido por 100. Se não disponível para o mês: null
6. aporte_mes_total = campo E (Saldo Movimentações = B - C), pode ser negativo
7. Todos os valores numéricos em formato decimal ponto (não vírgula)

Retorne SOMENTE este JSON:
{
  "registros": [
    {
      "mes": 1,
      "ano": 2025,
      "pl_inicial_total": 469325.52,
      "aporte_mes_total": 0.00,
      "rentabilidade_total": 203.11,
      "pl_total": 469528.63,
      "rentabilidade_pct": 0.0043,
      "cdi_mes_pct": 0.0096
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

  // Validação de consistência: pl_total ≈ pl_inicial + aporte + rent (tolerância R$ 1)
  const esperado = plIni + (isNaN(aporte) ? 0 : aporte) + (isNaN(rent) ? 0 : rent);
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
    console.error(`[MultiPeriodo] ${sigla}: falha definitiva`, e);
    throw new Error(`Nenhum registro mensal encontrado para ${sigla}`);
  }
}
