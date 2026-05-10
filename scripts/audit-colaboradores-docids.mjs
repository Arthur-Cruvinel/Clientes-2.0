// Sub-fase 1C — Grupo 2: auditoria read-only de docIds em
// fechamentos/{periodo}/colaboradores/. Classifica por padrão (hífen,
// underscore, UUID, outro) e conta docs + colaboradores únicos.
//
// READ-ONLY. Verificável: zero imports de setDoc/deleteDoc/updateDoc/addDoc.

import { collectionGroup, getDocs } from 'firebase/firestore';
import { initDb, gravarMd } from './_helpers.mjs';

// Regex de UUID v4 (formato gerado por crypto.randomUUID)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Classifica um docId em uma das 4 categorias. */
function classificar(docId) {
  if (UUID_RE.test(docId)) return 'uuid';
  const temHifen = docId.includes('-');
  const temUnderscore = docId.includes('_');
  if (temHifen && !temUnderscore) return 'hifen';
  if (temUnderscore && !temHifen) return 'underscore';
  if (temHifen && temUnderscore) return 'misto';
  return 'simples'; // sem hífen nem underscore (nome de uma só palavra)
}

async function main() {
  const db = initDb();
  console.log('[Inspect] Lendo collectionGroup("colaboradores")...');
  const snap = await getDocs(collectionGroup(db, 'colaboradores'));
  console.log(`[Inspect] ${snap.size} documentos encontrados`);

  // Agrupa por docId. Cada docId pode aparecer em N períodos — guardamos a
  // lista de períodos + nome_colaborador (pega do primeiro doc encontrado).
  const porDocId = new Map(); // docId → { categoria, periodos: Set, nome }
  for (const d of snap.docs) {
    const periodo = d.ref.path.split('/')[1]; // fechamentos/{periodo}/colaboradores/{id}
    const data = d.data();
    if (!porDocId.has(d.id)) {
      porDocId.set(d.id, {
        categoria: classificar(d.id),
        periodos: new Set(),
        nome: data?.nome_colaborador ?? '(sem nome)',
      });
    }
    porDocId.get(d.id).periodos.add(periodo);
  }

  // Contagem total: docs (somando períodos) + docIds únicos
  const totalDocs = snap.size;
  const totalUnicos = porDocId.size;
  console.log(`[Inspect] ${totalUnicos} colaboradores únicos (cobertura média de ${(totalDocs / totalUnicos).toFixed(1)} períodos cada)`);

  // Distribuição por categoria
  const categorias = ['hifen', 'underscore', 'uuid', 'misto', 'simples'];
  const contagem = Object.fromEntries(categorias.map((c) => [c, { docs: 0, unicos: 0, exemplos: [] }]));
  for (const [docId, info] of porDocId) {
    const c = contagem[info.categoria];
    c.docs += info.periodos.size;
    c.unicos += 1;
    if (c.exemplos.length < 5) {
      c.exemplos.push({ docId, nome: info.nome, n_periodos: info.periodos.size });
    }
  }

  // Console summary
  console.log('\n[Inspect] === Distribuição por categoria ===');
  for (const cat of categorias) {
    const c = contagem[cat];
    console.log(`  ${cat.padEnd(11)} → ${c.unicos} colaboradores únicos (${c.docs} docs)`);
  }

  // Markdown report
  const linhas = [];
  linhas.push('# Auditoria de docIds — fechamentos/{periodo}/colaboradores/');
  linhas.push('');
  linhas.push(`Gerado em ${new Date().toISOString()}.`);
  linhas.push('');
  linhas.push(`Total de documentos: **${totalDocs}**`);
  linhas.push(`Colaboradores únicos (docId distinto): **${totalUnicos}**`);
  linhas.push(`Cobertura média: **${(totalDocs / totalUnicos).toFixed(1)}** períodos por colaborador`);
  linhas.push('');
  linhas.push('## Distribuição por categoria');
  linhas.push('');
  linhas.push('| Categoria | Colaboradores únicos | Docs (todos os períodos) | Origem provável |');
  linhas.push('|---|---|---|---|');
  const origem = {
    hifen: 'UI manual via `slugificar` (separador `-`)',
    underscore: 'canônica `slug()` (separador `_`)',
    uuid: 'Excel import via `crypto.randomUUID()`',
    misto: 'manual exótico ou docId compostos com ambos',
    simples: 'nome de palavra única (sem espaço a normalizar)',
  };
  for (const cat of categorias) {
    const c = contagem[cat];
    linhas.push(`| ${cat} | ${c.unicos} | ${c.docs} | ${origem[cat]} |`);
  }
  linhas.push('');
  linhas.push('## Exemplos por categoria');
  for (const cat of categorias) {
    const c = contagem[cat];
    if (c.exemplos.length === 0) continue;
    linhas.push('');
    linhas.push(`### ${cat} (${c.unicos} únicos)`);
    linhas.push('');
    for (const ex of c.exemplos) {
      linhas.push(`- \`${ex.docId}\` — "${ex.nome}" — ${ex.n_periodos} período(s)`);
    }
  }
  linhas.push('');
  linhas.push('## Notas');
  linhas.push('');
  linhas.push('- Auditoria read-only: nenhuma escrita feita.');
  linhas.push('- `slugificar` em `useColaboradores.ts` produz docIds com `-`. `crypto.randomUUID()` em `useUploadImport.ts:192` produz UUIDs.');
  linhas.push('- Esta auditoria suporta a decisão entre opções (a), (b) ou (c) na Sub-fase 1C — Grupo 2.');

  const path = gravarMd('colaboradores-docids', linhas.join('\n'));
  console.log(`\n[Inspect] Relatório salvo em ${path}`);
}

main().catch((e) => {
  console.error('[Inspect] Erro:', e);
  process.exit(1);
});
