// Sub-fase 3C — Adiciona campo id_estavel (UUID v4) seguindo Princípio 5 / Visão 2.
//
// Visão 2: id_estavel representa a ENTIDADE LÓGICA (a pessoa Kevin), não o
// documento Firestore. Snapshots em fechamentos/ HERDAM o id_estavel do
// cadastro mestre clientes_base/ via match por nome — não geram UUID novo.
//
// Modos:
//   --colecao=clientes_base
//     Comportamento original (Visão 1): gera UUID novo para cada doc sem
//     id_estavel. Idempotente. clientes_base/ é a FONTE de id_estavel —
//     todos os outros docs vão herdar daqui.
//
//   --colecao=clientes_fechamentos
//     Visão 2: lê clientes_base/ primeiro, monta slugParaIdEstavel,
//     classifica cada snapshot em CONFIANTE / AMBIGUO / FANTASMA /
//     IRRECUPERAVEL e aplica herança via updateDoc.
//
//   --apply
//     Sem essa flag, todos os modos são dry-run.
//
// REGRAS ABSOLUTAS (respeitadas):
//   - NUNCA altera docId
//   - NUNCA deleta nada
//   - Toda gravação via writeBatch.update (equivalente a updateDoc em lote)
//   - Sem deleteDoc, sem set sem merge, sem batch.delete

import { collection, collectionGroup, getDocs, writeBatch } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDb } from './_helpers.mjs';

const BATCH_LIMIT = 400;
const ROOT = process.cwd();

const COLECOES = {
  clientes_base:            { tipo: 'top',   nome: 'clientes_base' },
  clientes_fechamentos:     { tipo: 'group', nome: 'clientes' },
  colaboradores_fechamentos:{ tipo: 'group', nome: 'colaboradores' },
  custos_fechamentos:       { tipo: 'group', nome: 'custosIndiretos' },
};

/** Slug canônico — mesma fórmula do app (src/utils/slug.ts). */
function slugify(nome) {
  if (!nome) return '';
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function parseArgs(argv) {
  const args = { colecao: null, apply: false };
  for (const a of argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--colecao=')) args.colecao = a.slice('--colecao='.length);
  }
  return args;
}

function precisaIdEstavel(data) {
  return typeof data.id_estavel !== 'string' || data.id_estavel.length === 0;
}

/** Snapshot JSON dos docs afetados (estado ANTES da migração). */
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

/** Grava relatório markdown em audit-results/fase-3c-aplicacao-{ts}.md. */
function gravarRelatorio(conteudo) {
  const dir = join(ROOT, 'audit-results');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `fase-3c-aplicacao-${ts}.md`);
  writeFileSync(path, conteudo, 'utf8');
  return path;
}

// ============================================================
// Modo: clientes_base — comportamento original (Visão 1)
// ============================================================

async function processarClientesBase(db, apply) {
  console.log(`\n[Migrate id_estavel] === clientes_base/ ===`);
  const snap = await getDocs(collection(db, 'clientes_base'));
  const semIdEstavel = snap.docs.filter((d) => precisaIdEstavel(d.data()));
  const total = snap.size;
  const jaTinham = total - semIdEstavel.length;

  console.log(`[Migrate id_estavel] Total: ${total}, com id_estavel: ${jaTinham}, sem: ${semIdEstavel.length}`);

  if (semIdEstavel.length === 0) {
    console.log('[Migrate id_estavel] Idempotência: todos já têm id_estavel.');
    return { totalDocs: total, jaTinham, adicionados: 0 };
  }

  const pathSnap = gravarSnapshot('clientes_base', semIdEstavel, apply ? 'apply' : 'dry-run');
  console.log(`[Migrate id_estavel] Snapshot: ${pathSnap}`);

  if (!apply) {
    console.log(`[Migrate id_estavel] DRY-RUN — ${semIdEstavel.length} docs seriam modificados.`);
    return { totalDocs: total, jaTinham, adicionados: 0, dryRun: true, snapshot: pathSnap };
  }

  let adicionados = 0;
  for (let i = 0; i < semIdEstavel.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = semIdEstavel.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) batch.update(d.ref, { id_estavel: randomUUID() });
    await batch.commit();
    adicionados += chunk.length;
    console.log(`[Migrate id_estavel] Batch ${Math.floor(i / BATCH_LIMIT) + 1}: ${chunk.length} docs`);
  }
  return { totalDocs: total, jaTinham, adicionados, snapshot: pathSnap };
}

// ============================================================
// Modo: clientes_fechamentos — Visão 2 (herança via match)
// ============================================================

/** Lookup por prefixo. Confirma exatamente 1 match em clientes_base/.
 *  Aborta o processo se 0 ou 2+ matches. */
function resolverAmbiguoPorPrefixo(prefixo, baseSnap) {
  const matches = baseSnap.docs.filter((d) => d.id.startsWith(prefixo));
  if (matches.length === 0) {
    throw new Error(`AMBIGUO: nenhum doc em clientes_base/ começa com "${prefixo}_". Abortando.`);
  }
  if (matches.length > 1) {
    const ids = matches.map((d) => d.id).join(', ');
    throw new Error(`AMBIGUO: ${matches.length} docs em clientes_base/ começam com "${prefixo}_": ${ids}. Abortando.`);
  }
  const d = matches[0];
  return { docId: d.id, nome_canonico: d.data().nome_cliente, id_estavel: d.data().id_estavel };
}

/** Classifica um snapshot de fechamentos/{periodo}/clientes/ contra clientes_base. */
function classificarSnapshot(d, baseSnap, mapaSlugToBase, mapaDocIdToBase, ambiguoMap) {
  const data = d.data();
  const nome = data.nome_cliente;

  // FANTASMA: sem nome_cliente. Tenta recuperar via docId.
  if (nome == null || (typeof nome === 'string' && nome.trim() === '')) {
    const baseRef = mapaDocIdToBase.get(d.id);
    if (baseRef) {
      return {
        tipo: 'FANTASMA',
        nome_recuperado: baseRef.nome_cliente,
        id_estavel: baseRef.id_estavel,
      };
    }
    return { tipo: 'IRRECUPERAVEL', motivo: 'sem nome_cliente e docId não bate com clientes_base/' };
  }

  // AMBIGUO: nome curto Kevin/Tamires — mapeamento por prefixo.
  const ambiguoTrim = nome.trim().toLowerCase();
  for (const [chave, info] of ambiguoMap.entries()) {
    if (ambiguoTrim === chave) {
      return {
        tipo: 'AMBIGUO',
        nome_atual: nome,
        nome_canonico: info.nome_canonico,
        id_estavel: info.id_estavel,
      };
    }
  }

  // CONFIANTE: match exato no nome OU via slug.
  const refByNome = baseSnap.docs.find((b) => b.data().nome_cliente === nome);
  if (refByNome) return { tipo: 'CONFIANTE', via: 'nome_exato', id_estavel: refByNome.data().id_estavel };

  const slug = slugify(nome);
  const baseBySlug = mapaSlugToBase.get(slug);
  if (baseBySlug) return { tipo: 'CONFIANTE', via: 'slug_exato', id_estavel: baseBySlug.id_estavel };

  return { tipo: 'IRRECUPERAVEL', motivo: `nome "${nome}" não bate em clientes_base/ (nem exato, nem via slug)` };
}

async function processarClientesFechamentos(db, apply) {
  console.log(`\n[Migrate id_estavel] === clientes_fechamentos (Visão 2: herança via match) ===`);

  // FASE A — carrega clientes_base/ e valida que todos têm id_estavel.
  const baseSnap = await getDocs(collection(db, 'clientes_base'));
  const baseSemId = baseSnap.docs.filter((d) => precisaIdEstavel(d.data()));
  console.log(`[Migrate id_estavel] clientes_base/: ${baseSnap.size} docs, sem id_estavel: ${baseSemId.length}`);
  if (baseSemId.length > 0) {
    throw new Error(`clientes_base/ tem ${baseSemId.length} docs sem id_estavel. Rode --colecao=clientes_base --apply primeiro.`);
  }

  // Mapas auxiliares
  const mapaSlugToBase = new Map(); // slug do nome → { docId, nome_cliente, id_estavel }
  const mapaDocIdToBase = new Map(); // docId da base → { nome_cliente, id_estavel }
  for (const d of baseSnap.docs) {
    const data = d.data();
    const meta = { docId: d.id, nome_cliente: data.nome_cliente, id_estavel: data.id_estavel };
    mapaDocIdToBase.set(d.id, meta);
    const slug = slugify(data.nome_cliente);
    if (slug && !mapaSlugToBase.has(slug)) mapaSlugToBase.set(slug, meta);
  }

  // Resolução AMBIGUO por prefixo (estratégia b — aborta se 0 ou 2+).
  console.log('[Migrate id_estavel] Resolvendo AMBIGUO via prefix lookup em clientes_base/...');
  const kevinRef = resolverAmbiguoPorPrefixo('kevin', baseSnap);
  const tamiresRef = resolverAmbiguoPorPrefixo('tamires', baseSnap);
  console.log(`  kevin_*  → ${kevinRef.docId} (${kevinRef.nome_canonico})`);
  console.log(`  tamires_* → ${tamiresRef.docId} (${tamiresRef.nome_canonico})`);
  const ambiguoMap = new Map();
  ambiguoMap.set('kevin', kevinRef);
  ambiguoMap.set('tamires', tamiresRef);

  // FASE B — classifica todos os snapshots.
  const fechSnap = await getDocs(collectionGroup(db, 'clientes'));
  console.log(`[Migrate id_estavel] Snapshots em fechamentos/*/clientes/: ${fechSnap.size}`);

  const buckets = { CONFIANTE: [], AMBIGUO: [], FANTASMA: [], IRRECUPERAVEL: [], JA_TEM: [] };
  for (const d of fechSnap.docs) {
    const data = d.data();
    if (!precisaIdEstavel(data)) {
      buckets.JA_TEM.push({ docId: d.id, path: d.ref.path });
      continue;
    }
    const periodo = d.ref.path.split('/')[1];
    const r = classificarSnapshot(d, baseSnap, mapaSlugToBase, mapaDocIdToBase, ambiguoMap);
    buckets[r.tipo].push({ docId: d.id, path: d.ref.path, periodo, ref: d.ref, ...r });
  }

  console.log('\n[Migrate id_estavel] === Distribuição ===');
  for (const t of ['CONFIANTE', 'AMBIGUO', 'FANTASMA', 'IRRECUPERAVEL', 'JA_TEM']) {
    console.log(`  ${t.padEnd(13)} → ${buckets[t].length} docs`);
  }

  const totalAModificar = buckets.CONFIANTE.length + buckets.AMBIGUO.length + buckets.FANTASMA.length;
  const docsAfetadosBruto = [...buckets.CONFIANTE, ...buckets.AMBIGUO, ...buckets.FANTASMA]
    .map((x) => fechSnap.docs.find((d) => d.ref.path === x.path));
  const pathSnap = gravarSnapshot('clientes_fechamentos', docsAfetadosBruto, apply ? 'apply' : 'dry-run');
  console.log(`[Migrate id_estavel] Snapshot: ${pathSnap}`);

  let aplicados = 0, batches = 0;
  if (apply && totalAModificar > 0) {
    console.log('\n[Migrate id_estavel] APLICANDO writes (writeBatch em chunks de 400)...');
    const todosWrites = [
      ...buckets.CONFIANTE.map((x) => ({ ref: x.ref, payload: { id_estavel: x.id_estavel } })),
      ...buckets.AMBIGUO.map((x) => ({ ref: x.ref, payload: { id_estavel: x.id_estavel, nome_cliente: x.nome_canonico } })),
      ...buckets.FANTASMA.map((x) => ({ ref: x.ref, payload: { id_estavel: x.id_estavel, nome_cliente: x.nome_recuperado } })),
    ];
    for (let i = 0; i < todosWrites.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = todosWrites.slice(i, i + BATCH_LIMIT);
      for (const w of chunk) batch.update(w.ref, w.payload);
      await batch.commit();
      aplicados += chunk.length;
      batches++;
      console.log(`[Migrate id_estavel] Batch ${batches}: ${chunk.length} docs escritos.`);
    }

    // Validação pós-write
    console.log('[Migrate id_estavel] Validando pós-write...');
    const valSnap = await getDocs(collectionGroup(db, 'clientes'));
    const restantes = valSnap.docs.filter((d) => precisaIdEstavel(d.data()));
    if (restantes.length > buckets.IRRECUPERAVEL.length) {
      throw new Error(`Validação falhou: ${restantes.length} docs sem id_estavel (esperado: ${buckets.IRRECUPERAVEL.length} IRRECUPERAVEIS).`);
    }
    console.log(`[Migrate id_estavel] ✓ Validação OK: ${restantes.length} restantes (esperado: ${buckets.IRRECUPERAVEL.length}).`);
  }

  return {
    totalDocs: fechSnap.size,
    confiante: buckets.CONFIANTE.length,
    ambiguo: buckets.AMBIGUO.length,
    fantasma: buckets.FANTASMA.length,
    irrecuperavel: buckets.IRRECUPERAVEL.length,
    jaTem: buckets.JA_TEM.length,
    aplicados, batches,
    snapshot: pathSnap,
    detalhes: buckets,
    refsCanonicos: { kevin: kevinRef, tamires: tamiresRef },
  };
}

// ============================================================
// Relatório markdown
// ============================================================

function montarRelatorio(resBase, resFech, modo) {
  const linhas = [];
  linhas.push('# Fase 3 Sub-fase 3C — Aplicação de id_estavel (Visão 2)');
  linhas.push('');
  linhas.push(`Gerado em ${new Date().toISOString()}.`);
  linhas.push(`Modo: **${modo === 'apply' ? 'APLICADO' : 'DRY-RUN'}**`);
  linhas.push('');
  linhas.push('## clientes_base/');
  linhas.push('');
  if (resBase) {
    linhas.push(`- Total: ${resBase.totalDocs}`);
    linhas.push(`- Já tinham id_estavel: ${resBase.jaTinham}`);
    linhas.push(`- id_estavel gerado agora: ${resBase.adicionados}`);
  } else {
    linhas.push('Não processado nesta execução.');
  }
  linhas.push('');
  linhas.push('## clientes_fechamentos/');
  linhas.push('');
  if (!resFech) {
    linhas.push('Não processado nesta execução.');
  } else {
    linhas.push(`- Total snapshots: ${resFech.totalDocs}`);
    linhas.push(`- CONFIANTE: ${resFech.confiante}`);
    linhas.push(`- AMBÍGUO: ${resFech.ambiguo}`);
    linhas.push(`- FANTASMA recuperável: ${resFech.fantasma}`);
    linhas.push(`- IRRECUPERÁVEL: ${resFech.irrecuperavel}`);
    linhas.push(`- Já tinham id_estavel: ${resFech.jaTem}`);
    linhas.push('');
    linhas.push('### Referências canônicas resolvidas (AMBIGUO)');
    linhas.push('');
    linhas.push(`- \`kevin_*\` → \`${resFech.refsCanonicos.kevin.docId}\` (${resFech.refsCanonicos.kevin.nome_canonico}) · id_estavel: \`${resFech.refsCanonicos.kevin.id_estavel}\``);
    linhas.push(`- \`tamires_*\` → \`${resFech.refsCanonicos.tamires.docId}\` (${resFech.refsCanonicos.tamires.nome_canonico}) · id_estavel: \`${resFech.refsCanonicos.tamires.id_estavel}\``);
    linhas.push('');
    if (resFech.detalhes.AMBIGUO.length > 0) {
      linhas.push('### Detalhes AMBÍGUO');
      linhas.push('');
      linhas.push('| Período | docId | nome_atual → nome_canônico | id_estavel |');
      linhas.push('|---|---|---|---|');
      for (const x of resFech.detalhes.AMBIGUO) {
        linhas.push(`| ${x.periodo} | \`${x.docId}\` | ${x.nome_atual} → **${x.nome_canonico}** | \`${x.id_estavel}\` |`);
      }
      linhas.push('');
    }
    if (resFech.detalhes.FANTASMA.length > 0) {
      linhas.push('### Detalhes FANTASMA');
      linhas.push('');
      linhas.push('| Período | docId | nome_recuperado | id_estavel |');
      linhas.push('|---|---|---|---|');
      for (const x of resFech.detalhes.FANTASMA) {
        linhas.push(`| ${x.periodo} | \`${x.docId}\` | ${x.nome_recuperado} | \`${x.id_estavel}\` |`);
      }
      linhas.push('');
    }
    if (resFech.detalhes.IRRECUPERAVEL.length > 0) {
      linhas.push('### Detalhes IRRECUPERÁVEL');
      linhas.push('');
      linhas.push('| Período | docId | motivo |');
      linhas.push('|---|---|---|');
      for (const x of resFech.detalhes.IRRECUPERAVEL) {
        linhas.push(`| ${x.periodo} | \`${x.docId}\` | ${x.motivo} |`);
      }
      linhas.push('');
    }
    linhas.push('### Writes');
    linhas.push('');
    linhas.push(`- Snapshots atualizados: ${resFech.aplicados}`);
    linhas.push(`- Batches executados: ${resFech.batches}`);
  }
  return linhas.join('\n');
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = parseArgs(process.argv);
  if (!args.colecao) args.colecao = 'clientes_fechamentos'; // default desta sub-fase
  if (!(args.colecao in COLECOES) && args.colecao !== 'todas') {
    console.error(`Coleção desconhecida: ${args.colecao}`);
    process.exit(1);
  }
  // Bloqueia coleções que ainda não têm tratamento Visão 2.
  if (args.colecao === 'colaboradores_fechamentos' || args.colecao === 'custos_fechamentos') {
    console.error(`Coleção ${args.colecao} ainda não implementada em Visão 2 (escopo Fase 3 futura).`);
    process.exit(1);
  }

  const db = initDb();
  let resBase = null, resFech = null;

  if (args.colecao === 'clientes_base' || args.colecao === 'todas') {
    resBase = await processarClientesBase(db, args.apply);
  }
  if (args.colecao === 'clientes_fechamentos' || args.colecao === 'todas') {
    resFech = await processarClientesFechamentos(db, args.apply);
  }

  const modo = args.apply ? 'apply' : 'dry-run';
  const relatorioMd = montarRelatorio(resBase, resFech, modo);
  const relatorioPath = gravarRelatorio(relatorioMd);
  console.log(`\n[Migrate id_estavel] Relatório salvo: ${relatorioPath}`);

  console.log('\n=== Resumo final ===');
  if (resBase) console.log(`  clientes_base:        total=${resBase.totalDocs}, ja_tinham=${resBase.jaTinham}, adicionados=${resBase.adicionados}`);
  if (resFech) {
    console.log(`  clientes_fechamentos: total=${resFech.totalDocs}, confiante=${resFech.confiante}, ambiguo=${resFech.ambiguo}, fantasma=${resFech.fantasma}, irrecuperavel=${resFech.irrecuperavel}, aplicados=${resFech.aplicados}${args.apply ? '' : ' (DRY-RUN)'}`);
  }
}

main().catch((e) => {
  console.error('[Migrate id_estavel] Erro:', e.message);
  process.exit(1);
});
