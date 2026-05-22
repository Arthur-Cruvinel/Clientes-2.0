// READ-ONLY — varre collectionGroup('vinculos') e lista docs com
// pct > 0 mas id_estavel_cliente undefined (órfãos criados pela
// Peça 6 antes da correção).

import { collectionGroup, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();

console.log('\n=== Varredura collectionGroup("vinculos") ===\n');
const snap = await getDocs(collectionGroup(db, 'vinculos'));
console.log(`Total de vínculos em todo o Firestore: ${snap.size}`);

const orfaos = [];
let comPctMaior = 0;
for (const d of snap.docs) {
  const v = d.data();
  const pct = v.pct ?? 0;
  if (pct > 0) comPctMaior++;
  if (pct > 0 && v.id_estavel_cliente === undefined) {
    // path: fechamentos/{periodo}/vinculos/{docId}
    const partes = d.ref.path.split('/');
    const periodo = partes[1];
    orfaos.push({
      periodo,
      docId: d.id,
      pct,
      tem_id_estavel_colaborador: v.id_estavel_colaborador !== undefined,
      tem_nome_colaborador: v.nome_colaborador !== undefined,
      tem_nome_cliente: v.nome_cliente !== undefined,
      tem_funcao: v.funcao !== undefined,
      tem_origem: v.origem !== undefined,
    });
  }
}

console.log(`Total com pct > 0: ${comPctMaior}`);
console.log(`Órfãos (pct>0 && id_estavel_cliente undefined): ${orfaos.length}\n`);

for (const o of orfaos) {
  console.log(o);
}

process.exit(0);
