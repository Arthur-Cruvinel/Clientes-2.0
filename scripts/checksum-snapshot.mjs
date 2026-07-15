// Checksum READ-ONLY do snapshot de um período. Prova de imutabilidade:
// rode ANTES e DEPOIS de um fechamento — o hash tem de ser idêntico.
//   node scripts/checksum-snapshot.mjs [periodo]
// Nasceu da blindagem de 15/07 (Incidente 2026-01). NENHUMA escrita.

import { createHash } from 'node:crypto';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const periodo = process.argv[2] ?? '2026-01';
const db = initDb();

const snap = await getDocs(collection(db, 'fechamentos', periodo, 'clientes'));
// Ordena por docId e serializa com chaves ordenadas → hash estável.
const ordenado = snap.docs
  .map(d => ({ docId: d.id, data: d.data() }))
  .sort((a, b) => a.docId.localeCompare(b.docId))
  .map(x => JSON.stringify(x, Object.keys(x.data).sort().length ? undefined : undefined));
const canonico = snap.docs
  .map(d => ({ docId: d.id, data: d.data() }))
  .sort((a, b) => a.docId.localeCompare(b.docId))
  .map(x => x.docId + '|' + JSON.stringify(x.data, Object.keys(x.data).sort()))
  .join('\n');
const hash = createHash('sha256').update(canonico).digest('hex');

const st = await getDoc(doc(db, 'periodos_status', periodo));
const s = st.exists() ? st.data() : null;

console.log(`=== snapshot fechamentos/${periodo}/clientes ===`);
console.log(`  docs .......... ${snap.size}`);
console.log(`  SHA-256 ....... ${hash}`);
console.log(`  guarda de imutabilidade (≥1 doc → snapshot intocável): ${snap.size > 0 ? 'ATIVA' : 'inativa (1ª modalidade: copiaria a base)'}`);
console.log(`=== periodos_status/${periodo} ===`);
console.log(`  fechado=${s?.fechado} · fechado_em=${s?.fechado_em ?? '—'} · total_clientes=${s?.total_clientes ?? '—'} · receita_total=${s?.receita_total ?? '—'}`);
void ordenado;
process.exit(0);
