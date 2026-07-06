// SEED idempotente do de-para Monday — as resoluções já decididas pelo CFO.
// Roda: npx tsx scripts/seed-mapeamento-monday.ts   (getDoc antes → nunca sobrescreve)
// Resolve id_estavel pelo nome canônico em clientes_base no momento do seed.
import { readFileSync } from 'node:fs'; import { join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
const env = Object.fromEntries(readFileSync(join(process.cwd(), '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID });
const db = initializeFirestore(app, { experimentalForceLongPolling: true, ignoreUndefinedProperties: true });
const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const mondayDocId = (n: string) => n.trim().replace(/[/.\s#$\[\]]/g, '_');

const SEEDS: { monday: string; alvo: 'cliente' | 'casa'; canonico?: string }[] = [
  { monday: 'Ronaldo', alvo: 'cliente', canonico: 'RONALDO LUIS NAZARIO DE LIMA' },
  { monday: 'Ronald', alvo: 'cliente', canonico: 'RONALD DOMINGUES NAZARIO DE LIMA' },
  { monday: 'Galáticos', alvo: 'casa' },
  { monday: 'Interno', alvo: 'casa' },
];

(async () => {
  const base = (await getDocs(collection(db, 'clientes_base'))).docs.map(d => d.data() as any);
  const porNome = new Map(base.map(c => [norm(c.nome_cliente), c]));
  const agora = '2026-07-06T00:00:00.000Z'; // fixo (scripts não usam Date.now())
  let criados = 0, existentes = 0, erros = 0;
  for (const s of SEEDS) {
    const id = mondayDocId(s.monday);
    const ref = doc(db, 'mapeamento_monday', id);
    if ((await getDoc(ref)).exists()) { console.log(`= já existe: "${s.monday}"`); existentes++; continue; }
    let entrada: any = { nome_monday: s.monday, alvo: s.alvo, registrado_em: agora, registrado_por: 'seed-cfo' };
    if (s.alvo === 'cliente') {
      const c = porNome.get(norm(s.canonico!));
      if (!c?.id_estavel) { console.error(`✗ canônico não encontrado/sem id_estavel: "${s.canonico}"`); erros++; continue; }
      entrada.id_estavel_cliente = c.id_estavel; entrada.nome_cliente_canonico = c.nome_cliente;
    }
    await setDoc(ref, entrada);
    console.log(`+ seed: "${s.monday}" → ${s.alvo === 'casa' ? 'CASA' : entrada.nome_cliente_canonico}`);
    criados++;
  }
  console.log(`\nseed monday: ${criados} criados · ${existentes} já existiam · ${erros} erros`);
  process.exit(erros ? 1 : 0);
})().catch(e => { console.error('ERRO:', e); process.exit(1); });
