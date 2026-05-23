// Correção pontual — normalizar nome do cliente "Pierre Fabian Grego"
// para UPPERCASE "PIERRE FABIAN GREGO" em todas as coleções.
//
// Fluxo (espelha cadastrarSiglaNova sem a parte de sigla):
//   1. Localiza doc em clientes_base/ por match parcial case-insensitive em
//      nome_cliente contendo "Pierre". Aborta se 0 ou ≥2 matches.
//   2. Lê id_estavel — aborta se ausente (Fase 3 incompleta).
//   3. Em modo --apply:
//      a) updateDoc(clientes_base/{docId}, { nome_cliente: NOME_NOVO })
//      b) propagarNomeClientePorIdEstavel — atualiza fechamentos/*/clientes/
//         via collectionGroup, batches de 400.
//      c) corrigirNomeClientePoupanca(nomeAntigo, nomeNovo) — atualiza
//         poupanca/ via match normalizado (NFD + lower + trim).
//
// Default: dry-run. Use `node scripts/renomear-pierre-uppercase.mjs --apply`
// para executar as escritas.

import {
  collection,
  collectionGroup,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const NOME_BUSCA = 'pierre';                 // match parcial case-insensitive
const NOME_NOVO = 'PIERRE FABIAN GREGO';
const BATCH_LIMIT = 400;

const APPLY = process.argv.includes('--apply');

const norm = (s) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function localizarCliente(db) {
  const snap = await getDocs(collection(db, 'clientes_base'));
  const matches = [];
  for (const d of snap.docs) {
    const data = d.data();
    const nome = data.nome_cliente ?? '';
    if (norm(nome).includes(NOME_BUSCA)) {
      matches.push({
        docId: d.id,
        nome_cliente: nome,
        id_estavel: data.id_estavel ?? null,
      });
    }
  }
  return matches;
}

async function propagarNomePorIdEstavel(db, idEstavel, nomeNovo) {
  const snap = await getDocs(collectionGroup(db, 'clientes'));
  const alvos = snap.docs.filter((d) => {
    const data = d.data();
    return data.id_estavel === idEstavel && data.nome_cliente !== nomeNovo;
  });
  const periodos = new Set();
  const erros = [];
  let atualizados = 0;
  for (let i = 0; i < alvos.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = alvos.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) batch.update(d.ref, { nome_cliente: nomeNovo });
    try {
      await batch.commit();
      for (const d of chunk) periodos.add(d.ref.path.split('/')[1]);
      atualizados += chunk.length;
    } catch (err) {
      erros.push(`Batch fechamentos #${i / BATCH_LIMIT + 1}: ${err?.message ?? 'erro'}`);
    }
  }
  return { atualizados, periodos, erros, candidatos: alvos.length };
}

async function corrigirPoupanca(db, nomeAntigo, nomeNovo) {
  const alvoNorm = norm(nomeAntigo);
  const snap = await getDocs(collection(db, 'poupanca'));
  const alvos = snap.docs.filter((d) => {
    const data = d.data();
    const nome = data.nome_cliente;
    const sigla = data.sigla_bruta_origem;
    const matchNome = !!nome && (nome === nomeAntigo || norm(nome) === alvoNorm);
    const matchSigla = !!sigla && (sigla === nomeAntigo || norm(sigla) === alvoNorm);
    return matchNome || matchSigla;
  });
  const erros = [];
  let atualizados = 0;
  for (let i = 0; i < alvos.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = alvos.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      const update = { nome_cliente: nomeNovo };
      if (data.status === 'pendente_normalizacao' || data.sigla_bruta_origem != null) {
        update.status = deleteField();
        update.sigla_bruta_origem = deleteField();
      }
      batch.update(d.ref, update);
    }
    try {
      await batch.commit();
      atualizados += chunk.length;
    } catch (err) {
      erros.push(`Batch poupanca #${i / BATCH_LIMIT + 1}: ${err?.message ?? 'erro'}`);
    }
  }
  return { atualizados, candidatos: alvos.length, erros };
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APPLY (escritas habilitadas)' : 'DRY-RUN (apenas leitura)'}\n`);
  const db = initDb();

  // ── Passo 1: localizar cliente ───────────────────────────────────────────
  console.log('[1/4] Buscando em clientes_base/...');
  const matches = await localizarCliente(db);
  if (matches.length === 0) {
    console.error(`❌ Nenhum cliente encontrado com "${NOME_BUSCA}" em nome_cliente.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`❌ ${matches.length} clientes encontrados — desambiguação necessária:`);
    for (const m of matches) console.error(`   - docId="${m.docId}" nome="${m.nome_cliente}"`);
    process.exit(1);
  }
  const [{ docId, nome_cliente: nomeAtual, id_estavel: idEstavel }] = matches;
  console.log(`   ✓ docId      = ${docId}`);
  console.log(`   ✓ nome atual = "${nomeAtual}"`);
  console.log(`   ✓ id_estavel = ${idEstavel}`);
  console.log(`   → nome novo  = "${NOME_NOVO}"\n`);

  if (!idEstavel) {
    console.error('❌ id_estavel ausente. Cliente sem Fase 3 — não é possível propagar.');
    process.exit(1);
  }
  if (nomeAtual === NOME_NOVO) {
    console.log('ℹ Nome já está no formato canônico — nada a fazer.');
    process.exit(0);
  }

  if (!APPLY) {
    console.log('▣ DRY-RUN — operações que SERIAM executadas:');
    console.log(`   a) updateDoc(clientes_base/${docId}, { nome_cliente: "${NOME_NOVO}" })`);
    console.log(`   b) propagarNomePorIdEstavel("${idEstavel}", "${NOME_NOVO}")`);
    console.log(`   c) corrigirPoupanca("${nomeAtual}", "${NOME_NOVO}")`);
    console.log('\nRode com --apply para executar.');
    process.exit(0);
  }

  // ── Passo 2: clientes_base ───────────────────────────────────────────────
  console.log('[2/4] Atualizando clientes_base/...');
  try {
    await updateDoc(doc(db, 'clientes_base', docId), { nome_cliente: NOME_NOVO });
    console.log(`   ✓ clientes_base/${docId}.nome_cliente = "${NOME_NOVO}"\n`);
  } catch (err) {
    console.error(`   ❌ Falha: ${err?.message ?? 'erro'}`);
    process.exit(1);
  }

  // ── Passo 3: fechamentos/*/clientes/ via id_estavel ──────────────────────
  console.log('[3/4] Propagando para fechamentos/*/clientes/ via id_estavel...');
  const prop = await propagarNomePorIdEstavel(db, idEstavel, NOME_NOVO);
  console.log(`   ✓ ${prop.atualizados}/${prop.candidatos} snapshots atualizados em ${prop.periodos.size} período(s)`);
  if (prop.periodos.size) {
    console.log(`     Períodos: ${[...prop.periodos].sort().join(', ')}`);
  }
  for (const e of prop.erros) console.error(`   ⚠ ${e}`);
  console.log('');

  // ── Passo 4: poupanca/ via match normalizado ─────────────────────────────
  console.log('[4/4] Corrigindo poupanca/...');
  const pp = await corrigirPoupanca(db, nomeAtual, NOME_NOVO);
  console.log(`   ✓ ${pp.atualizados}/${pp.candidatos} docs de poupanca/ atualizados`);
  for (const e of pp.erros) console.error(`   ⚠ ${e}`);
  console.log('');

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESUMO:');
  console.log(`  clientes_base/                  : 1 doc (${docId})`);
  console.log(`  fechamentos/*/clientes/         : ${prop.atualizados} doc(s) em ${prop.periodos.size} período(s)`);
  console.log(`  poupanca/                       : ${pp.atualizados} doc(s)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
