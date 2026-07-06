// READ-ONLY — confirma que a sub-coleção custosDedicados NÃO tem nenhum doc em
// produção (estrutura existe só em código; nada foi semeado). Nenhum write.
import { collectionGroup, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();
const snap = await getDocs(collectionGroup(db, 'custosDedicados'));
console.log(`custosDedicados (todos os períodos): ${snap.size} doc(s)`);
console.log(snap.size === 0 ? '✓ VAZIO — nada foi semeado, como esperado.' : '✗ INESPERADO — há docs!');
for (const d of snap.docs) console.log('  -', d.ref.path);
process.exit(0);
