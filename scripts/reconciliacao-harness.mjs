// ─────────────────────────────────────────────────────────────────────────────
// HARNESS DE RECONCILIAÇÃO — placar permanente da identidade do AUM (poupança).
//
// Replica EXATAMENTE o cálculo da tela (usePoupanca + PoupancaTabela):
//   1. auto-reparo de pl_onshore corrompido (import offshore antigo)
//   2. encadeamento read-time pl_inicial_onshore = pl_onshore[t-1] (histórico completo)
//   3. filtro de quarentena + filtro de mês fantasma
//   4. agregação por cliente (1º pl_inicial / último pl / Σ flows) por visão
//   5. ganho cambial = resíduo que fecha a identidade BRL, com guard estrutural
//      (mês faltando / transferência interna → mantém clássico e flag) — igual ao deploy
//
// Resíduo de identidade por visão:
//   onshore     : pl_fim − pl_ini − NNM_real − Rent + Imp
//   offshore    : pl_fim − pl_ini − NNM_real − Rent − GC
//   consolidado : onshore + offshore
//
// Uso:  node scripts/reconciliacao-harness.mjs            (resumo + top 20)
//       node scripts/reconciliacao-harness.mjs --top=40   (mais linhas)
//       node scripts/reconciliacao-harness.mjs --cliente="WESLEY"  (drill mês a mês)
//
// READ-ONLY. Nunca escreve. É o ÚNICO placar da frente de reconciliação:
// toda onda de correção termina com este harness re-rodado e o delta reportado.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV = join(__dirname, '..', '.env');
const env = readFileSync(ENV, 'utf-8');
const g = (k) => env.match(new RegExp(`${k}=(.+)`))?.[1]?.trim();
const app = initializeApp({
  apiKey: g('VITE_FIREBASE_API_KEY'), authDomain: g('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: g('VITE_FIREBASE_PROJECT_ID'), storageBucket: g('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: g('VITE_FIREBASE_MESSAGING_SENDER_ID'), appId: g('VITE_FIREBASE_APP_ID'),
});
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const N = (v) => (typeof v === 'number' && !isNaN(v) ? v : 0);
const pNum = (a, m) => a * 12 + m;
const nnmRealOn = (r) => N(r.aporte_mes_onshore) - N(r.transferencia_interna_onshore);
const nnmRealOff = (r) => N(r.aporte_mes_offshore) - N(r.transferencia_interna_offshore);

// ── calcOffshore — RÉPLICA do deploy (GC residual + guard estrutural) ─────────
function calcOffshore(r, prev) {
  const plUsdFinal = N(r.pl_offshore_usd);
  const ptaxAtual = r.ptax_fechamento ?? 1;
  const rentPctLamina = N(r.rentabilidade_pct_offshore);
  const ptaxAnterior = prev?.ptax_fechamento ?? ptaxAtual;
  let plUsdInicial = N(prev?.pl_offshore_usd);
  if (plUsdInicial <= 0.01 && N(r.pl_inicial_offshore) > 0.01 && ptaxAnterior > 0)
    plUsdInicial = N(r.pl_inicial_offshore) / ptaxAnterior;
  const primeiroMes = plUsdInicial <= 0.01;
  let rentBrl;
  if (primeiroMes) {
    const cashBrl = N(r.aporte_mes_offshore); const temCash = Math.abs(cashBrl) > 0.01; let rentUsd;
    if (temCash) { const nnmUsd = ptaxAtual > 0 ? cashBrl / ptaxAtual : plUsdFinal; rentUsd = nnmUsd * rentPctLamina; }
    else if (rentPctLamina > 0 && plUsdFinal > 0.01) rentUsd = plUsdFinal * rentPctLamina / (1 + rentPctLamina);
    else rentUsd = 0;
    rentBrl = rentUsd * ptaxAtual;
    // Preferir rentabilidade gravada (≠0) no primeiroMes — igual ao deploy.
    const rentSavedPM = N(r.rentabilidade_offshore);
    if (rentSavedPM !== 0) rentBrl = rentSavedPM;
  } else {
    const saved = N(r.rentabilidade_offshore);
    rentBrl = saved !== 0 ? saved : plUsdInicial * rentPctLamina * ptaxAtual;
  }
  const piBrl = primeiroMes ? 0 : plUsdInicial * ptaxAnterior;
  const prevTemPosicao = N(prev?.pl_offshore_usd) > 0.01;
  const mesFaltando = prev != null && prevTemPosicao && ((r.ano * 12 + r.mes) - (prev.ano * 12 + prev.mes) > 1);
  const temTransfOff = Math.abs(N(r.transferencia_interna_offshore)) > 0.01;
  const gcAnomalia = !primeiroMes && (mesFaltando || temTransfOff);
  const gcSimples = (plUsdInicial > 0.01 && ptaxAtual > 0 && ptaxAnterior > 0) ? plUsdInicial * (ptaxAtual - ptaxAnterior) : null;
  const plOffFinalBrl = r.pl_offshore ?? (plUsdFinal * ptaxAtual);
  const gcResidual = plOffFinalBrl - piBrl - nnmRealOff(r) - rentBrl;
  const gcBrl = primeiroMes ? null : (gcAnomalia ? gcSimples : gcResidual);
  return { piBrl, rentBrl, gcBrl, gcAnomalia, primeiroMes };
}

// ── Pipeline usePoupanca (auto-reparo + encadeamento + quarentena) ───────────
async function carregarRegistros() {
  const snap = await getDocs(collection(db, 'poupanca'));
  let registros = snap.docs.map(d => {
    const raw = { id: d.id, ...d.data() }; raw._plOnRaw = raw.pl_onshore;
    if (N(raw.pl_onshore) === 0 && N(raw.pl_inicial_onshore) > 0)
      raw.pl_onshore = N(raw.pl_inicial_onshore) + N(raw.aporte_mes_onshore) + N(raw.rentabilidade_onshore) - N(raw.impostos_mes);
    return raw;
  }).filter(r => r.status !== 'pendente_normalizacao');
  const porNome = new Map();
  for (const r of registros) { const l = porNome.get(r.nome_cliente) ?? []; l.push(r); porNome.set(r.nome_cliente, l); }
  for (const [, regs] of porNome) {
    regs.sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
    for (let i = 1; i < regs.length; i++) if (N(regs[i - 1].pl_onshore) > 0.01) regs[i].pl_inicial_onshore = regs[i - 1].pl_onshore;
  }
  return { registros, porNome };
}

function ehFantasma(r) {
  const a = Math.abs;
  return a(N(r.pl_onshore) + N(r.pl_offshore)) < 1 && a(N(r.pl_inicial_onshore) + N(r.pl_inicial_offshore)) < 1
    && a(N(r.aporte_mes_onshore) + N(r.aporte_mes_offshore)) < 1 && a(N(r.rentabilidade_onshore) + N(r.rentabilidade_offshore)) < 1;
}

// ── Resíduos de um período [ini,fim] (números pNum) ──────────────────────────
function residuosPeriodo({ registros, porNome }, ini, fim) {
  const intervalo = registros.filter(r => { const p = pNum(r.ano, r.mes); return p >= ini && p <= fim && !ehFantasma(r); });
  const porCli = new Map();
  for (const r of intervalo) { const l = porCli.get(r.nome_cliente) ?? []; l.push(r); porCli.set(r.nome_cliente, l); }
  const linhas = [];
  for (const [nome, regs] of porCli) {
    regs.sort((a, b) => pNum(a.ano, a.mes) - pNum(b.ano, b.mes));
    const pri = regs[0], ult = regs[regs.length - 1];
    const regAnt = (porNome.get(nome) ?? []).filter(r => pNum(r.ano, r.mes) < ini).slice(-1)[0] ?? null;
    let nnmOn = 0, rOn = 0, imp = 0, nnmOff = 0, rOff = 0, gcOff = 0, gcAnom = false, importFaltante = false;
    const resMensalOn = [];
    for (let i = 0; i < regs.length; i++) {
      const r = regs[i]; const prev = i > 0 ? regs[i - 1] : regAnt;
      nnmOn += nnmRealOn(r); rOn += N(r.rentabilidade_onshore); imp += N(r.impostos_mes);
      const off = calcOffshore(r, prev); nnmOff += nnmRealOff(r); rOff += off.rentBrl;
      if (off.gcBrl != null) gcOff += off.gcBrl; if (off.gcAnomalia) gcAnom = true;
      // import faltante: pl_onshore ≈ 0 mas pl_inicial encadeado > 0 (registro só-offshore)
      const plIniCh = i > 0 ? N(regs[i - 1].pl_onshore) : N(r.pl_inicial_onshore);
      if (N(r.pl_onshore) <= 0.01 && plIniCh > 0.01) importFaltante = true;
      const rmOn = N(r.pl_onshore) - plIniCh - nnmRealOn(r) - N(r.rentabilidade_onshore) + N(r.impostos_mes);
      resMensalOn.push({ mk: `${r.ano}-${String(r.mes).padStart(2, '0')}`, R: rmOn, tomb: N(r.nnm_tombamento_onshore) });
    }
    const resOn = N(ult.pl_onshore) - N(pri.pl_inicial_onshore) - nnmOn - rOn + imp;
    const resOff = N(ult.pl_offshore) - N(pri.pl_inicial_offshore) - nnmOff - rOff - gcOff;
    const resCons = resOn + resOff;
    // classificação (sobre o consolidado)
    const entradaPi = N(pri.pl_inicial_onshore) <= 0.01 && N(pri.pl_inicial_offshore) <= 0.01;
    let classe;
    if (importFaltante) classe = 'import_faltante';
    else if (Math.abs(resCons) <= 1000) classe = 'fronteira';
    else if (gcAnom && Math.abs(resOn) <= 1000) classe = 'anomalo_offshore';
    else if (entradaPi && !regAnt) classe = 'entrada';
    else if (entradaPi && regAnt) classe = 're_entrada';
    else classe = 'material';
    const concMes = [...resMensalOn].sort((a, b) => Math.abs(b.R) - Math.abs(a.R))[0];
    linhas.push({ nome, resOn, resOff, resCons, classe, gcAnom, importFaltante,
      priMk: `${pri.ano}-${String(pri.mes).padStart(2, '0')}`, concMk: concMes?.mk, concR: concMes?.R, resMensalOn });
  }
  const tot = (k) => linhas.reduce((s, l) => s + l[k], 0);
  return { linhas, totOn: tot('resOn'), totOff: tot('resOff'), totCons: tot('resCons') };
}

function imprimirPeriodo(titulo, res, topN) {
  console.log('\n' + '═'.repeat(96));
  console.log(`PERÍODO: ${titulo}`);
  console.log('═'.repeat(96));
  console.log(`  ONSHORE = ${fmt(res.totOn)}  |  OFFSHORE = ${fmt(res.totOff)}  |  CONSOLIDADO = ${fmt(res.totCons)}`);
  const porClasse = {};
  for (const l of res.linhas) porClasse[l.classe] = (porClasse[l.classe] ?? 0) + l.resCons;
  console.log('  Por classificação (consolidado):');
  for (const [c, v] of Object.entries(porClasse).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])))
    console.log(`    ${c.padEnd(18)} = ${fmt(v).padStart(16)}  (${res.linhas.filter(l => l.classe === c).length} clientes)`);
  const mat = res.linhas.filter(l => Math.abs(l.resCons) > 1000).sort((a, b) => Math.abs(b.resCons) - Math.abs(a.resCons));
  console.log(`  TOP ${Math.min(topN, mat.length)} resíduos materiais (|consolidado| > R$ 1.000):`);
  for (const l of mat.slice(0, topN))
    console.log(`    ${fmt(l.resCons).padStart(15)} | ${l.classe.padEnd(16)} | conc ${l.concMk} (${fmt(l.concR)}) | ${l.nome}`);
}

(async () => {
  const args = process.argv.slice(2);
  const topN = Number(args.find(a => a.startsWith('--top='))?.split('=')[1] ?? 20);
  const cli = args.find(a => a.startsWith('--cliente='))?.split('=')[1];
  const dados = await carregarRegistros();
  const meses = [...new Set(dados.registros.map(r => pNum(r.ano, r.mes)))].sort((a, b) => a - b);
  const ultimo = meses[meses.length - 1];
  const anoU = Math.floor((ultimo - 1) / 12), mesU = ultimo - anoU * 12;

  console.log('═'.repeat(96));
  console.log('HARNESS DE RECONCILIAÇÃO — placar da identidade do AUM (read-only)');
  console.log(`Mês mais recente na base: ${anoU}-${String(mesU).padStart(2, '0')} | ${dados.registros.length} registros ativos`);
  console.log('═'.repeat(96));

  if (cli) {
    // Drill mês a mês de um cliente (base completa)
    const res = residuosPeriodo(dados, pNum(2000, 1), pNum(2100, 12));
    const l = res.linhas.find(x => x.nome.toUpperCase().includes(cli.toUpperCase()));
    if (!l) { console.log(`Cliente "${cli}" não encontrado.`); process.exit(0); }
    console.log(`\nDRILL ${l.nome} — resíduo onshore mês a mês (encadeado):`);
    for (const m of l.resMensalOn) console.log(`  ${m.mk}: R_on=${fmt(m.R).padStart(15)}${Math.abs(m.tomb) > 1 ? ' tomb=' + fmt(m.tomb) : ''}`);
    console.log(`  → resOn=${fmt(l.resOn)} resOff=${fmt(l.resOff)} resCons=${fmt(l.resCons)} classe=${l.classe}`);
    process.exit(0);
  }

  imprimirPeriodo(`MÊS CORRENTE (${anoU}-${String(mesU).padStart(2, '0')})`, residuosPeriodo(dados, ultimo, ultimo), topN);
  imprimirPeriodo('2026 YTD (2026-01 a 2026-12)', residuosPeriodo(dados, pNum(2026, 1), pNum(2026, 12)), topN);
  imprimirPeriodo('BASE COMPLETA (2025-01 a hoje)', residuosPeriodo(dados, pNum(2025, 1), ultimo), topN);
  console.log('\n(use --cliente="NOME" para drill mês a mês; --top=N para mais linhas)');
  process.exit(0);
})().catch(e => { console.error('ERRO:', e.stack || e.message); process.exit(1); });
