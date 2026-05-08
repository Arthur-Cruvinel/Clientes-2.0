// --- Serviço de CDI projetado (curva escalonada Focus BCB) ---
// Usa expectativas de SELIC por reunião COPOM para construir
// curva de CDI que varia ao longo dos meses.

import { buscarCDIMensal } from './cdi';

const PROXY_URL = '/.netlify/functions/bcb-focus-proxy';
const TIMEOUT_MS = 10000;

const cache = new Map<string, number>();
let selicAtualCache: number | null = null;
let curvaSelicCache: { mes: string; selic: number }[] | null = null;

// Mapeamento aproximado das 8 reuniões COPOM → mês de vigência
// Rx/YYYY → mês em que a decisão passa a vigorar
const REUNIAO_PARA_MES: Record<number, number> = {
  1: 1,   // R1 → Jan/Fev
  2: 3,   // R2 → Mar
  3: 5,   // R3 → Mai
  4: 6,   // R4 → Jun
  5: 8,   // R5 → Ago
  6: 9,   // R6 → Set
  7: 11,  // R7 → Nov
  8: 12,  // R8 → Dez
};

function selicParaCdiMensal(selicAnual: number): number {
  const cdiAnual = (selicAnual - 0.10) / 100;
  return Math.pow(1 + cdiAnual, 1 / 12) - 1;
}

function pNum(a: number, m: number) { return a * 12 + m; }

interface FocusItem {
  Reuniao: string;
  Mediana: number;
  Data: string;
}

async function buscarCurvaFocus(): Promise<{ mes: string; selic: number }[]> {
  if (curvaSelicCache) return curvaSelicCache;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(PROXY_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const dados: FocusItem[] = json.value ?? [];

    if (dados.length === 0) throw new Error('Sem dados Focus');

    // Filtrar pesquisa mais recente + baseCalculo=0 (Top5, já filtrado no proxy)
    const dataMaisRecente = dados[0]?.Data;
    const maisRecentes = dados.filter(d => d.Data === dataMaisRecente);

    // Parsear reuniões: "Rx/YYYY" → { periodo: YYYY*12+mes, selic }
    const reunioes: { periodo: number; selic: number; label: string }[] = [];
    for (const d of maisRecentes) {
      const match = d.Reuniao.match(/R(\d+)\/(\d{4})/);
      if (!match) continue;
      const numReuniao = Number(match[1]);
      const ano = Number(match[2]);
      const mesVigencia = REUNIAO_PARA_MES[numReuniao];
      if (!mesVigencia) continue;
      reunioes.push({ periodo: pNum(ano, mesVigencia), selic: d.Mediana, label: `${d.Reuniao} → ${mesVigencia}/${ano}` });
    }

    reunioes.sort((a, b) => a.periodo - b.periodo);
    if (reunioes.length === 0) throw new Error('Sem reuniões parseáveis');

    // A SELIC atual = primeira reunião futura ou mais recente
    selicAtualCache = reunioes[0].selic;

    // Construir curva: para cada mês, qual SELIC vigora?
    const curva: { mes: string; selic: number }[] = [];
    const hoje = new Date();

    for (let i = 0; i < 36; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const chaveM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const periodoMes = pNum(d.getFullYear(), d.getMonth() + 1);

      // Encontrar a última reunião que vigora neste mês (periodo <= periodoMes)
      let selicVigente = reunioes[0].selic;
      for (const r of reunioes) {
        if (r.periodo <= periodoMes) selicVigente = r.selic;
      }

      curva.push({ mes: chaveM, selic: selicVigente });
    }

    // Log das mudanças
    const mudancas = curva.filter((c, i) => i === 0 || c.selic !== curva[i - 1].selic);
    console.log('[CDIProjetado] Curva SELIC Focus:',
      mudancas.map(c => `${c.mes}: ${c.selic}%`).join(' → '));

    curvaSelicCache = curva;
    return curva;
  } catch (e) {
    console.warn('[CDIProjetado] Erro ao buscar Focus:', e);
    selicAtualCache = 14.25;
    const curva: { mes: string; selic: number }[] = [];
    const hoje = new Date();
    for (let i = 0; i < 36; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      curva.push({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, selic: 14.25 });
    }
    curvaSelicCache = curva;
    return curva;
  }
}

let focusCache: Map<string, number> | null = null;

async function buildFocusCache(): Promise<Map<string, number>> {
  const curva = await buscarCurvaFocus();
  const mapa = new Map<string, number>();
  for (const { mes, selic } of curva) {
    mapa.set(mes, selicParaCdiMensal(selic));
  }
  return mapa;
}

export async function buscarCDIProjetado(ano: number, mes: number): Promise<number> {
  const chave = `${ano}-${String(mes).padStart(2, '0')}`;
  if (cache.has(chave)) return cache.get(chave)!;

  const hoje = new Date();
  const periodoAtual = hoje.getFullYear() * 12 + (hoje.getMonth() + 1);
  const periodoAlvo = ano * 12 + mes;

  if (periodoAlvo < periodoAtual) {
    try {
      const real = await buscarCDIMensal(ano, mes);
      cache.set(chave, real);
      return real;
    } catch { /* usar projeção */ }
  }

  if (!focusCache) focusCache = await buildFocusCache();

  const projetado = focusCache.get(chave);
  if (projetado != null) {
    cache.set(chave, projetado);
    return projetado;
  }

  const fallback = selicParaCdiMensal(14.25);
  cache.set(chave, fallback);
  return fallback;
}

export function getSelicAtual(): number | null {
  return selicAtualCache;
}

export async function getCurvaSelicProjetada(): Promise<{ mes: string; selic: number; cdiMensal: number }[]> {
  const curva = await buscarCurvaFocus();
  return curva.map(c => ({ mes: c.mes, selic: c.selic, cdiMensal: selicParaCdiMensal(c.selic) }));
}
