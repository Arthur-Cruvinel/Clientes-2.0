// Sub-fase 3C — Adiciona campo id_estavel (UUID v4) aos docs que não têm.
// Idempotente: rodar 2x não duplica nem sobrescreve. Modo dry-run por default
// (passar --apply para executar). Snapshot JSON antes de qualquer write.
//
// Uso:
//   node adicionarIdEstavel.mjs --colecao=clientes_base               (dry-run)
//   node adicionarIdEstavel.mjs --colecao=clientes_base --apply       (executa)
//   node adicionarIdEstavel.mjs --colecao=todas --apply               (4 colecoes)
//
// Coleções aceitas: clientes_base, clientes_fechamentos,
//                   colaboradores_fechamentos, custos_fechamentos, todas

import { collection, collectionGroup, getDocs, writeBatch } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDb } from './_helpers.mjs';

const BATCH_LIMIT = 400; // margem sobre limite Firestore (500)
const ROOT = process.cwd();

/** Mapa de alvos: `top` = coleção raiz, `group` = collectionGroup. */
const COLECOES = {
  clientes_base:            { tipo: 'top',   nome: 'clientes_base' },
  clientes_fechamentos:     { tipo: 'group', nome: 'clientes' },
  colaboradores_fechamentos:{ tipo: 'group', nome: 'colaboradores' },
  custos_fechamentos:       { tipo: 'group', nome: 'custosIndiretos' },
};

function parseArgs(argv) {
  const args = { colecao: null, apply: false };
  for (const a of argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--colecao=')) args.colecao = a.slice('--colecao='.length);
  }
  return args;
}

/** Lê toda a coleção ou collectionGroup. */
async function lerColecao(db, conf) {
  return conf.tipo === 'top'
    ? getDocs(collection(db, conf.nome))
    : getDocs(collectionGroup(db, conf.nome));
}

/** Grava snapshot JSON dos docs afetados (estado ANTES da migração). */
function gravarSnapshot(colecao, docsAfetados, modo) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `id-estavel-${ts}-${colecao}.json`);
  const payload = {
    timestamp: new Date().toISOString(),
    colecao, modo,
    total_a_modificar: docsAfetados.length,
    docs: docsAfetados.map((d) => ({
      docId: d.id, path: d.ref.path, dados_antes: d.data(),
    })),
  };
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  return path;
}

/** Verifica se um doc precisa de id_estavel (não tem string válida). */
function precisaIdEstavel(data) {
  return typeof data.id_estavel !== 'string' || data.id_estavel.length === 0;
}

async function processarColecao(db, colecaoChave, apply) {
  const conf = COLECOES[colecaoChave];
  if (!conf) throw new Error(`Coleção desconhecida: ${colecaoChave}`);
  const rotulo = conf.tipo === 'top' ? `${conf.nome}/` : `collectionGroup(${conf.nome})`;
  console.log(`\n[Migrate id_estavel] === ${colecaoChave} (${rotulo}) ===`);

  const snap = await lerColecao(db, conf);
  const totalDocs = snap.size;
  const semIdEstavel = snap.docs.filter((d) => precisaIdEstavel(d.data()));
  const jaTinham = totalDocs - semIdEstavel.length;

  console.log(`[Migrate id_estavel] Total: ${totalDocs}, com id_estavel: ${jaTinham}, sem (alvo): ${semIdEstavel.length}`);

  if (semIdEstavel.length === 0) {
    console.log('[Migrate id_estavel] Nada a fazer — todos já têm id_estavel (idempotência).');
    return { colecao: colecaoChave, totalDocs, jaTinham, adicionados: 0, dryRun: !apply };
  }

  // Snapshot SEMPRE — mesmo em dry-run (registra estado antes para rollback futuro).
  const pathSnap = gravarSnapshot(colecaoChave, semIdEstavel, apply ? 'apply' : 'dry-run');
  console.log(`[Migrate id_estavel] Snapshot salvo: ${pathSnap}`);

  if (!apply) {
    console.log(`[Migrate id_estavel] DRY-RUN — ${semIdEstavel.length} docs seriam modificados.`);
    console.log('[Migrate id_estavel] Exemplos (primeiros 3 docs, UUIDs simulados — não são os definitivos):');
    for (const d of semIdEstavel.slice(0, 3)) {
      console.log(`  ${d.ref.path}: id_estavel = "${randomUUID()}"`);
    }
    return { colecao: colecaoChave, totalDocs, jaTinham, adicionados: 0, dryRun: true, snapshot: pathSnap };
  }

  // APPLY: writeBatch em chunks de BATCH_LIMIT.
  let adicionados = 0;
  for (let i = 0; i < semIdEstavel.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = semIdEstavel.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      batch.update(d.ref, { id_estavel: randomUUID() });
    }
    await batch.commit();
    adicionados += chunk.length;
    console.log(`[Migrate id_estavel] Batch ${Math.floor(i / BATCH_LIMIT) + 1}: ${chunk.length} docs atualizados`);
  }

  // Validação pós-write: re-lê coleção e conta docs sem id_estavel.
  console.log('[Migrate id_estavel] Validando pós-write...');
  const snapVal = await lerColecao(db, conf);
  const restantes = snapVal.docs.filter((d) => precisaIdEstavel(d.data()));
  if (restantes.length > 0) {
    console.error(`[Migrate id_estavel] ERRO: ${restantes.length} docs ainda sem id_estavel após write:`);
    for (const d of restantes.slice(0, 5)) console.error(`  - ${d.ref.path}`);
    throw new Error('Validação pós-write falhou');
  }
  console.log(`[Migrate id_estavel] ✓ Validação OK: 0 docs sem id_estavel.`);
  return { colecao: colecaoChave, totalDocs, jaTinham, adicionados, snapshot: pathSnap };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.colecao) {
    console.error('Uso: node adicionarIdEstavel.mjs --colecao=<nome> [--apply]');
    console.error('Coleções: clientes_base, clientes_fechamentos, colaboradores_fechamentos, custos_fechamentos, todas');
    process.exit(1);
  }
  if (!(args.colecao in COLECOES) && args.colecao !== 'todas') {
    console.error(`Coleção desconhecida: ${args.colecao}`);
    process.exit(1);
  }

  const db = initDb();
  const alvos = args.colecao === 'todas'
    ? Object.keys(COLECOES)
    : [args.colecao];

  const resultados = [];
  for (const k of alvos) resultados.push(await processarColecao(db, k, args.apply));

  console.log('\n=== Resumo final ===');
  for (const r of resultados) {
    const modo = r.dryRun ? ' (DRY-RUN)' : '';
    console.log(`  ${r.colecao.padEnd(28)} total=${r.totalDocs}, ja_tinham=${r.jaTinham}, adicionados=${r.adicionados}${modo}`);
  }
}

main().catch((e) => {
  console.error('[Migrate id_estavel] Erro:', e);
  process.exit(1);
});
