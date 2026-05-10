// Sub-fase 3A — Auditoria read-only: conta docs com/sem id_estavel
// nas 4 coleções alvo. ZERO writes (verificável por grep).

import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

async function contar(snap, label) {
  let total = 0, comId = 0;
  for (const d of snap.docs) {
    total++;
    const data = d.data();
    if (typeof data.id_estavel === 'string' && data.id_estavel.length > 0) comId++;
  }
  return { label, total, comId, semId: total - comId };
}

/** Agrupa docs por período para contagem fina (collectionGroup). */
function porPeriodo(snap) {
  const mapa = new Map();
  for (const d of snap.docs) {
    const periodo = d.ref.path.split('/')[1];
    mapa.set(periodo, (mapa.get(periodo) ?? 0) + 1);
  }
  return Array.from(mapa.entries()).sort();
}

/** Coleta docIds únicos (para colaboradores que repetem entre períodos). */
function unicos(snap) {
  const set = new Set();
  for (const d of snap.docs) set.add(d.id);
  return set.size;
}

async function main() {
  const db = initDb();

  console.log('[Inspect] Lendo coleções alvo...');
  const [snapBase, snapClientesGroup, snapColabsGroup, snapCustosGroup] = await Promise.all([
    getDocs(collection(db, 'clientes_base')),
    getDocs(collectionGroup(db, 'clientes')),
    getDocs(collectionGroup(db, 'colaboradores')),
    getDocs(collectionGroup(db, 'custosIndiretos')),
  ]);

  const baseStats = await contar(snapBase, 'clientes_base/');
  const clientesStats = await contar(snapClientesGroup, 'fechamentos/*/clientes/');
  const colabsStats = await contar(snapColabsGroup, 'fechamentos/*/colaboradores/');
  const custosStats = await contar(snapCustosGroup, 'fechamentos/*/custosIndiretos/');

  console.log('\n=== Resumo de id_estavel ===');
  for (const s of [baseStats, clientesStats, colabsStats, custosStats]) {
    console.log(`  ${s.label.padEnd(34)} total=${s.total}, com_id_estavel=${s.comId}, sem=${s.semId}`);
  }

  console.log('\n=== Distribuição por período ===');
  console.log('  fechamentos/*/clientes/');
  for (const [p, n] of porPeriodo(snapClientesGroup)) {
    console.log(`    ${p}: ${n}`);
  }
  console.log(`  fechamentos/*/colaboradores/  (únicos: ${unicos(snapColabsGroup)})`);
  for (const [p, n] of porPeriodo(snapColabsGroup)) {
    console.log(`    ${p}: ${n}`);
  }
  console.log('  fechamentos/*/custosIndiretos/');
  for (const [p, n] of porPeriodo(snapCustosGroup)) {
    console.log(`    ${p}: ${n}`);
  }

  const totalDocs = baseStats.total + clientesStats.total + colabsStats.total + custosStats.total;
  const totalSemId = baseStats.semId + clientesStats.semId + colabsStats.semId + custosStats.semId;
  console.log(`\n[Inspect] Total geral: ${totalDocs} docs, ${totalSemId} sem id_estavel (alvo da migração)`);

  // Retorna stats para uso pelo relator (importável).
  return { baseStats, clientesStats, colabsStats, custosStats,
    porPeriodoClientes: porPeriodo(snapClientesGroup),
    porPeriodoColabs: porPeriodo(snapColabsGroup),
    porPeriodoCustos: porPeriodo(snapCustosGroup),
    unicosColabs: unicos(snapColabsGroup),
  };
}

main().catch((e) => {
  console.error('[Inspect] Erro:', e);
  process.exit(1);
});
