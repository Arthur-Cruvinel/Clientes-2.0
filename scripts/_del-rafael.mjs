// EXCLUSÃO RAFAEL dummies — TEMP. Deleta rrf_glpg_2026_4 e rrf_glpg_2026_5
// SOMENTE se (a) são dummies pl_onshore<=1 e (b) o doc canônico do mês existe.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
const g = (k) => env.match(new RegExp(`${k}=(.+)`))?.[1]?.trim();
const app = initializeApp({
  apiKey: g('VITE_FIREBASE_API_KEY'), authDomain: g('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: g('VITE_FIREBASE_PROJECT_ID'), storageBucket: g('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: g('VITE_FIREBASE_MESSAGING_SENDER_ID'), appId: g('VITE_FIREBASE_APP_ID'),
});
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const N = (v) => (typeof v === 'number' && !isNaN(v) ? v : 0);
const WRITE = process.argv.includes('--write');

const casos = [
  { del: 'rrf_glpg_2026_4', canon: 'rafael_ricieri_faci_2026_4' },
  { del: 'rrf_glpg_2026_5', canon: 'rafael_ricieri_faci_2026_5' },
];

for (const c of casos) {
  const dSnap = await getDoc(doc(db, 'poupanca', c.del));
  const cSnap = await getDoc(doc(db, 'poupanca', c.canon));
  if (!dSnap.exists()) { console.log(`SKIP ${c.del}: não existe`); continue; }
  const d = dSnap.data();
  const ehDummy = Math.abs(N(d.pl_onshore)) <= 1 && Math.abs(N(d.pl_offshore)) <= 1;
  const canonOk = cSnap.exists();
  console.log(`${c.del}: pl_on=${N(d.pl_onshore)} pl_off=${N(d.pl_offshore)} dummy=${ehDummy} | canônico ${c.canon} existe=${canonOk}`);
  if (!ehDummy) { console.log(`  ✗ ABORTA: não é dummy (pl > 1) — não excluir`); continue; }
  if (!canonOk) { console.log(`  ✗ ABORTA: canônico não existe — deixaria buraco`); continue; }
  if (WRITE) {
    await deleteDoc(doc(db, 'poupanca', c.del));
    const re = await getDoc(doc(db, 'poupanca', c.del));
    console.log(`  ${re.exists() ? '✗ ainda existe' : '✓ excluído'} | canônico permanece: ${(await getDoc(doc(db, 'poupanca', c.canon))).exists()}`);
  } else {
    console.log(`  [preview] excluiria ${c.del}; canônico ${c.canon} permanece`);
  }
}
process.exit(0);
