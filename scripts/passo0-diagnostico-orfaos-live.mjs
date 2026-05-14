// Passo 0 — diagnóstico READ-ONLY do estado LIVE da coleção poupanca/.
// Confirma a presença atual dos 7 docs órfãos identificados em
// audit-results/diagnostico-orfaos-legados-poupanca-2026-05-14T21-21-43.md.
//
// Sem writes. Sem snapshot (vem no Passo 2). Apenas stdout.
//
// Uso: node scripts/passo0-diagnostico-orfaos-live.mjs

import { collection, getDocs } from 'firebase/firestore';
import { initDb, slugDoDocId } from './_helpers.mjs';

const SLUGS_FANTASMA = new Set([
  'msal_investments_limited',
  'wenderson_r_do_nascimento_galeno',
  'ria_btg',
]);

const SLUG_REAL_WENDERSON = 'wenderson_galeno';
const SLUG_REAL_MOISES = 'moises_lima_magalhaes';

const ESPERADOS = {
  msal_investments_limited: 1,
  wenderson_r_do_nascimento_galeno: 4,
  ria_btg: 2,
};

function fmtBRL(v) {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtUSD(v) {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

async function main() {
  const db = initDb();
  console.log('[Passo0] Lendo poupanca/ completo...');
  const snap = await getDocs(collection(db, 'poupanca'));
  console.log(`[Passo0] Total de docs LIVE: ${snap.size}\n`);

  // Indexa todos os docs por slug.
  const porSlug = new Map();
  for (const d of snap.docs) {
    const slug = slugDoDocId(d.id);
    const lista = porSlug.get(slug) ?? [];
    lista.push({ id: d.id, ...d.data() });
    porSlug.set(slug, lista);
  }

  console.log('=== Estado dos 3 slugs FANTASMA esperados ===\n');
  let totalFantasmas = 0;
  for (const slug of SLUGS_FANTASMA) {
    const docs = porSlug.get(slug) ?? [];
    const esperado = ESPERADOS[slug];
    const status = docs.length === esperado ? '✓ INTACTO' : docs.length === 0 ? '✓ JÁ REMOVIDO' : '⚠ PARCIAL';
    console.log(`Slug: ${slug}`);
    console.log(`  Encontrado: ${docs.length} doc(s) | Esperado: ${esperado} | Status: ${status}`);
    totalFantasmas += docs.length;
    if (docs.length > 0) {
      // Ordena por ano,mês
      docs.sort((a, b) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes));
      for (const d of docs) {
        const periodo = `${d.ano}-${String(d.mes).padStart(2, '0')}`;
        console.log(`    - docId: ${d.id}`);
        console.log(`        nome_cliente: ${d.nome_cliente ?? '—'}`);
        console.log(`        período:      ${periodo}`);
        console.log(`        pl_total:     ${fmtBRL(d.pl_total)}`);
        console.log(`        pl_onshore:   ${fmtBRL(d.pl_onshore)}`);
        console.log(`        pl_offshore:  ${fmtBRL(d.pl_offshore)}`);
        console.log(`        pl_offshore_usd: ${fmtUSD(d.pl_offshore_usd)}`);
        console.log(`        nnm_tombamento_offshore: ${fmtBRL(d.nnm_tombamento_offshore)}`);
        console.log(`        aporte_mes_total: ${fmtBRL(d.aporte_mes_total)}`);
      }
    }
    console.log('');
  }

  console.log(`Total de docs fantasma LIVE: ${totalFantasmas}\n`);

  // Wenderson real — confirma duplicação.
  console.log('=== Wenderson REAL (slug wenderson_galeno) ===\n');
  const wendersonReal = porSlug.get(SLUG_REAL_WENDERSON) ?? [];
  console.log(`Encontrado: ${wendersonReal.length} doc(s)`);
  if (wendersonReal.length > 0) {
    wendersonReal.sort((a, b) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes));
    for (const d of wendersonReal) {
      const periodo = `${d.ano}-${String(d.mes).padStart(2, '0')}`;
      console.log(`  - docId: ${d.id}`);
      console.log(`      nome_cliente: ${d.nome_cliente ?? '—'}`);
      console.log(`      período:      ${periodo}`);
      console.log(`      pl_total:     ${fmtBRL(d.pl_total)}`);
      console.log(`      pl_offshore_usd: ${fmtUSD(d.pl_offshore_usd)}`);
    }
  }
  console.log('');

  // Moises real — confirma se o MSAL é duplicação ou só fantasma standalone.
  console.log('=== Moises Lima Magalhaes REAL (slug moises_lima_magalhaes) ===\n');
  const moisesReal = porSlug.get(SLUG_REAL_MOISES) ?? [];
  console.log(`Encontrado: ${moisesReal.length} doc(s)`);
  if (moisesReal.length > 0) {
    moisesReal.sort((a, b) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes));
    for (const d of moisesReal) {
      const periodo = `${d.ano}-${String(d.mes).padStart(2, '0')}`;
      console.log(`  - docId: ${d.id}`);
      console.log(`      nome_cliente: ${d.nome_cliente ?? '—'}`);
      console.log(`      período:      ${periodo}`);
      console.log(`      pl_total:     ${fmtBRL(d.pl_total)}`);
      console.log(`      pl_offshore_usd: ${fmtUSD(d.pl_offshore_usd)}`);
    }
  }
  console.log('');

  // Resumo executivo
  console.log('=== RESUMO PASSO 0 ===');
  console.log(`  Total docs poupanca/ LIVE: ${snap.size}`);
  console.log(`  Total fantasmas remanescentes: ${totalFantasmas} (esperado: 7)`);
  console.log(`  Wenderson REAL: ${wendersonReal.length} doc(s) — coexistência ${wendersonReal.length > 0 && (porSlug.get('wenderson_r_do_nascimento_galeno')?.length ?? 0) > 0 ? 'CONFIRMADA (duplicação real)' : 'NÃO confirmada'}`);
  console.log(`  Moises REAL: ${moisesReal.length} doc(s) — coexistência ${moisesReal.length > 0 && (porSlug.get('msal_investments_limited')?.length ?? 0) > 0 ? 'CONFIRMADA (duplicação real)' : 'NÃO aplica (MSAL isolado)'}`);
}

main().catch((e) => {
  console.error('[Passo0] Erro:', e);
  process.exit(1);
});
