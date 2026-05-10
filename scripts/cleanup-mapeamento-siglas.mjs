// Fase C1 — Limpeza de mapeamento_siglas/ no Firestore.
// Deleta APENAS as 3 entradas confirmadas como suspeitas pela auditoria A1:
//   1) GABRIEL_JESUS  — sigla "GABRIEL JESUS" inválida (cliente real é GFJ)
//   2) GABRIEL_PIPINO — sigla "GABRIEL PIPINO" inválida (cliente real, sigla canon GPI)
//   3) docId começando com TAW01 + sigla === 'WNG' (cliente real é WRG / Wenderson Galeno)
//
// Pipeline:
//   1) Snapshot completo da coleção em backups/firestore/
//   2) Identifica os 3 alvos (não usa critério genérico)
//   3) Dry-run mostra os campos
//   4) Confirmação yes/no no terminal
//   5) Se yes: deleta um a um, logando com prefixo [Cleanup]

import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { initDb } from './_helpers.mjs';

const ROOT = process.cwd();

/** Snapshot JSON em backups/firestore/. Caminho retornado para o log. */
function gravarSnapshot(nomeBase, dados) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `${nomeBase}-${ts}.json`);
  writeFileSync(path, JSON.stringify(dados, null, 2), 'utf8');
  return path;
}

/** Pergunta yes/no e retorna boolean. Aborta se vier qualquer outra coisa. */
async function confirmar(pergunta) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await rl.question(`${pergunta} [yes/no]: `);
  rl.close();
  return resposta.trim().toLowerCase() === 'yes';
}

async function main() {
  const db = initDb();

  // 1) Snapshot completo da coleção (todas as 78 entradas, segundo A1).
  console.log('[Cleanup] Lendo mapeamento_siglas/ completo...');
  const snap = await getDocs(collection(db, 'mapeamento_siglas'));
  const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`[Cleanup] ${todos.length} documentos lidos`);

  const pathSnap = gravarSnapshot('mapeamento-siglas', todos);
  console.log(`[Cleanup] Snapshot salvo em ${pathSnap}`);

  // 2) Identifica alvos. Os 2 primeiros são docIds exatos. O 3º é variável
  //    (prefixo TAW01 + sigla 'WNG') — listar candidatos e exigir 1 match.
  const alvosExatos = ['GABRIEL_JESUS', 'GABRIEL_PIPINO'];
  const alvos = [];
  for (const docId of alvosExatos) {
    const found = todos.find((d) => d.id === docId);
    if (found) alvos.push(found);
    else console.warn(`[Cleanup] AVISO: docId esperado "${docId}" não encontrado`);
  }

  const candidatosTaw = todos.filter(
    (d) => d.id.startsWith('TAW01') && d.sigla === 'WNG',
  );
  if (candidatosTaw.length === 0) {
    console.warn('[Cleanup] AVISO: nenhum docId TAW01* com sigla "WNG" encontrado');
  } else if (candidatosTaw.length > 1) {
    console.error('[Cleanup] ERRO: mais de 1 doc TAW01* com sigla "WNG":');
    for (const c of candidatosTaw) console.error(`  - ${c.id}`);
    console.error('[Cleanup] Abortando — investigar antes de deletar.');
    process.exit(1);
  } else {
    alvos.push(candidatosTaw[0]);
  }

  if (alvos.length === 0) {
    console.log('[Cleanup] Nenhum alvo encontrado — nada a fazer. Saindo.');
    return;
  }

  // 3) Dry-run — mostra todos os campos de cada alvo.
  console.log('\n[Cleanup] === DRY-RUN — alvos identificados ===');
  for (const a of alvos) {
    console.log(`\n  docId: ${a.id}`);
    for (const [k, v] of Object.entries(a)) {
      if (k === 'id') continue;
      console.log(`    ${k}: ${JSON.stringify(v)}`);
    }
  }
  console.log(`\n[Cleanup] Total a deletar: ${alvos.length} documentos`);

  // 4) Confirmação humana.
  const ok = await confirmar('\nConfirma a deleção destes documentos?');
  if (!ok) {
    console.log('[Cleanup] Cancelado pelo usuário. Nenhuma deleção feita.');
    return;
  }

  // 5) Deletes serializados (poucos docs — não precisa batch).
  for (const a of alvos) {
    await deleteDoc(doc(db, 'mapeamento_siglas', a.id));
    console.log(`[Cleanup] Deletado: mapeamento_siglas/${a.id}`);
  }
  console.log(`\n[Cleanup] Concluído — ${alvos.length} documentos deletados.`);
  console.log(`[Cleanup] Snapshot de restauração: ${pathSnap}`);
}

main().catch((e) => {
  console.error('[Cleanup] Erro fatal:', e);
  process.exit(1);
});
