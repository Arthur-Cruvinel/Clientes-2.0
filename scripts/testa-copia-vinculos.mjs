// Teste E2E da Fase 2.5 — Peça 7:
//   1. Copia fechamentos/2026-04 → fechamentos/2026-TEST-PECA7 com a mesma
//      lógica do copiarPeriodo (incl. vínculos).
//   2. Confere paridade docId-a-docId entre vinculos/ origem e destino.
//   3. Deleta o período de teste no final (qualquer caminho, sucesso ou erro).
//
// READ + temporary write — destino é período sintético que nunca foi tocado
// pelo motor. A limpeza no finally garante zero resíduo.

import {
  collection, doc, getDoc, getDocs, writeBatch, deleteDoc,
} from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();
const ORIGEM  = '2026-04';
const DESTINO = '2026-TEST-PECA7';
const BATCH_LIMIT = 400;
const SUBCOLECOES = ['colaboradores', 'custosIndiretos', 'clientes', 'vinculos'];

async function copiar(periodoOrigem, periodoDestino) {
  const contagem = {};
  for (const sub of SUBCOLECOES) {
    const snap = await getDocs(collection(db, 'fechamentos', periodoOrigem, sub));
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) {
        batch.set(doc(db, 'fechamentos', periodoDestino, sub, d.id), d.data());
      }
      await batch.commit();
    }
    contagem[sub] = snap.size;
    console.log(`  ${sub}: ${snap.size} docs copiados`);
  }
  return contagem;
}

async function limpar(periodo) {
  console.log(`\n=== Limpando ${periodo} ===`);
  for (const sub of SUBCOLECOES) {
    const snap = await getDocs(collection(db, 'fechamentos', periodo, sub));
    let n = 0;
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) {
        batch.delete(d.ref);
      }
      await batch.commit();
      n += Math.min(BATCH_LIMIT, snap.docs.length - i);
    }
    console.log(`  ${sub}: ${n} docs apagados`);
  }
}

async function conferirVinculos(periodoOrigem, periodoDestino) {
  const [origemSnap, destinoSnap] = await Promise.all([
    getDocs(collection(db, 'fechamentos', periodoOrigem, 'vinculos')),
    getDocs(collection(db, 'fechamentos', periodoDestino, 'vinculos')),
  ]);
  console.log(`\n=== Conferindo paridade de vínculos ===`);
  console.log(`  origem (${periodoOrigem}):  ${origemSnap.size} docs`);
  console.log(`  destino (${periodoDestino}): ${destinoSnap.size} docs`);
  if (origemSnap.size !== destinoSnap.size) {
    return { ok: false, motivo: 'contagem divergente' };
  }
  const mapOrig = new Map(origemSnap.docs.map(d => [d.id, d.data()]));
  let divergencias = [];
  for (const d of destinoSnap.docs) {
    const orig = mapOrig.get(d.id);
    if (!orig) {
      divergencias.push({ docId: d.id, motivo: 'destino tem doc inexistente na origem' });
      continue;
    }
    const dest = d.data();
    // Confere campos críticos do Vinculo
    const camposCriticos = ['pct', 'id_estavel_colaborador', 'id_estavel_cliente', 'funcao', 'periodo'];
    for (const k of camposCriticos) {
      if (orig[k] !== dest[k]) {
        divergencias.push({ docId: d.id, campo: k, origem: orig[k], destino: dest[k] });
      }
    }
  }
  if (divergencias.length > 0) {
    console.log(`  ⚠ ${divergencias.length} divergência(s):`);
    for (const x of divergencias.slice(0, 5)) console.log('   ', x);
    return { ok: false, motivo: divergencias.length + ' divergência(s)' };
  }
  console.log(`  ✓ todos os docs casam por id e campos críticos`);
  return { ok: true };
}

let resultado = { ok: false };
try {
  console.log(`=== Cópia ${ORIGEM} → ${DESTINO} (simulando copiarPeriodo) ===\n`);
  await copiar(ORIGEM, DESTINO);
  resultado = await conferirVinculos(ORIGEM, DESTINO);
} catch (e) {
  console.error('ERRO:', e);
  resultado = { ok: false, motivo: e.message };
} finally {
  // Limpa SEMPRE — destino é período sintético, não deve sobrar nada.
  try {
    await limpar(DESTINO);
  } catch (e) {
    console.error('ERRO na limpeza:', e);
  }
}

console.log(`\n=== Resultado: ${resultado.ok ? '✓ OK' : '✗ FALHOU: ' + resultado.motivo} ===`);
process.exit(resultado.ok ? 0 : 1);
