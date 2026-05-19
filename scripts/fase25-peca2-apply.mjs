// Fase 2.5 — Peça 2+3 — Etapa 3 (apply) + Etapa 4 (validação).
// Wipe-and-replace por período em fechamentos/{periodo}/vinculos/.
// SANDBOX intocado. Opção B (slug canônico via id_estavel) confirmada.
// Max 400 ops por writeBatch (limite efetivo do Firestore).

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { initDb, slugify } from './_helpers.mjs';

const PERIODOS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
const FUNCOES = ['consultoria_gestao', 'consultoria_planejamento', 'consultoria_financeira', 'operacional_financeiro', 'serv_adm', 'serv_aux_adm'];
const BATCH_LIMIT = 400;
const SANITY_ESPERADO_POR_PERIODO = 172;

const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const db = initDb();

// ===== Mapas e resolução =====
const cliBaseSnap = await getDocs(collection(db, 'clientes_base'));
const cliBaseDocs = cliBaseSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
const cliBasePorIdEstavel = new Map(cliBaseDocs.filter(c => c.id_estavel).map(c => [c.id_estavel, c]));

const colabSnap = await getDocs(collection(db, 'colaboradores_base'));
const colabsBase = colabSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
const colabPorNomeNorm = new Map();
const colabPorIdEstavel = new Map();
for (const c of colabsBase) {
  colabPorNomeNorm.set(norm(c.nome_colaborador), c);
  if (c.id_estavel) colabPorIdEstavel.set(c.id_estavel, c);
}

const cintia = colabPorNomeNorm.get('cintia de jesus alves');
const RESOLUCAO_MANUAL = {
  'flavia santos': { tipo: 'manual', docId: 'flavia_santos_romeu', nome: 'Flávia Santos Romeu', id_estavel: 'a063e11b-b8dd-4c4a-868c-f15289e5919c' },
  'cintia alves':  { tipo: 'manual', docId: 'cintia_de_jesus_alves', nome: 'Cintia De Jesus Alves', id_estavel: cintia?.id_estavel },
  'luiz nerone':   { tipo: 'manual', docId: 'luis_eduardo_nerone', nome: 'Luis Eduardo Nerone', id_estavel: 'ac6922ca-d464-4743-b125-51e8d0ec26c1' },
  'lucas silva':   { tipo: 'manual', docId: 'lucas_henrique', nome: 'Lucas Henrique', id_estavel: 'a5a8437d-6bd3-47f4-bd7a-8fd925fe6595' },
  'vinicius rodrigues': { tipo: 'manual', docId: 'vinicius_rodrigues_ex', nome: 'Vinicius Rodrigues (ex-funcionário)', id_estavel: 'vinicius_rodrigues_ex' },
};

function resolverNome(nome) {
  if (!nome) return null;
  const n = norm(nome);
  if (RESOLUCAO_MANUAL[n]) return { ...RESOLUCAO_MANUAL[n], slug: RESOLUCAO_MANUAL[n].docId };
  const canon = colabPorNomeNorm.get(n);
  if (canon) return { tipo: 'canonico', docId: canon.docId, slug: canon.docId, nome: canon.nome_colaborador, id_estavel: canon.id_estavel };
  return { tipo: 'nao_resolvido', docId: 'nao_resolvido_' + slugify(nome), slug: 'nao_resolvido_' + slugify(nome), nome: nome, id_estavel: 'nao_resolvido_' + slugify(nome) };
}

function resolverSlugCliente(cli) {
  if (cli.id_estavel) {
    const base = cliBasePorIdEstavel.get(cli.id_estavel);
    if (base) return base.docId;
  }
  return slugify(cli.nome_cliente ?? '');
}

// ===== Build vínculos em memória (mesma lógica do dry-run) =====
const dataCriacao = new Date().toISOString();
const vinculosPorPeriodo = {};
for (const p of PERIODOS) {
  const snap = await getDocs(collection(db, 'fechamentos', p, 'clientes'));
  const lista = [];
  for (const d of snap.docs) {
    const cli = { docId: d.id, ...d.data() };
    if (cli.pacote_servico === 'asset_only') continue;
    let idEstCli = cli.id_estavel;
    if (!idEstCli) continue;
    const slugCli = resolverSlugCliente(cli);
    for (const f of FUNCOES) {
      const nome = cli[f];
      if (!nome || !String(nome).trim()) continue;
      const r = resolverNome(nome);
      lista.push({
        id: `${r.slug}_${slugCli}_${f}`,
        periodo: p,
        id_estavel_colaborador: r.id_estavel,
        id_estavel_cliente: idEstCli,
        nome_colaborador: r.nome,
        nome_cliente: cli.nome_cliente,
        funcao: f,
        pct: typeof cli[`pct_${f}`] === 'number' ? cli[`pct_${f}`] : 0,
        origem: 'migracao',
        data_criacao: dataCriacao,
      });
    }
  }
  vinculosPorPeriodo[p] = lista;
}

// ===== ETAPA 3: Apply =====
console.log('=== ETAPA 3: Apply (wipe-and-replace por período) ===\n');

const resultados = {};
for (const p of PERIODOS) {
  console.log(`--- ${p} ---`);

  // WIPE
  const existSnap = await getDocs(collection(db, 'fechamentos', p, 'vinculos'));
  const existDocs = existSnap.docs;
  let deletados = 0;
  if (existDocs.length > 0) {
    for (let i = 0; i < existDocs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = existDocs.slice(i, i + BATCH_LIMIT);
      for (const d of chunk) batch.delete(d.ref);
      await batch.commit();
      deletados += chunk.length;
    }
    console.log(`  Wipe: ${deletados} docs deletados`);
  } else {
    console.log(`  Wipe: 0 docs (estado já limpo)`);
  }

  // CREATE
  const lista = vinculosPorPeriodo[p];
  let criados = 0;
  for (let i = 0; i < lista.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = lista.slice(i, i + BATCH_LIMIT);
    for (const v of chunk) {
      const ref = doc(db, 'fechamentos', p, 'vinculos', v.id);
      batch.set(ref, v);
    }
    await batch.commit();
    criados += chunk.length;
  }
  console.log(`  Create: ${criados} vínculos criados`);

  resultados[p] = { deletados, criados, esperado: SANITY_ESPERADO_POR_PERIODO };
  if (criados !== SANITY_ESPERADO_POR_PERIODO) {
    console.error(`  ⚠ ESPERADO ${SANITY_ESPERADO_POR_PERIODO}, criado ${criados}`);
  }
}

// ===== ETAPA 4: Validação =====
console.log('\n=== ETAPA 4: Validação pós-migração ===\n');

const validacoes = {};
let totalGeralValid = 0;

for (const p of PERIODOS) {
  const snap = await getDocs(collection(db, 'fechamentos', p, 'vinculos'));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  totalGeralValid += docs.length;
  const v = { total: docs.length, esperado: SANITY_ESPERADO_POR_PERIODO, ok: docs.length === SANITY_ESPERADO_POR_PERIODO };

  // (b) Amostra de 3 — verificar id_estavel apontando para docs existentes
  const amostra = [docs[0], docs[Math.floor(docs.length / 2)], docs[docs.length - 1]];
  v.amostra = amostra.map(d => {
    const colabExiste = d.id_estavel_colaborador === 'vinicius_rodrigues_ex'
      ? 'placeholder (intencional)'
      : (colabPorIdEstavel.has(d.id_estavel_colaborador) ? '✓' : '✗ ÓRFÃO');
    const cliExiste = cliBasePorIdEstavel.has(d.id_estavel_cliente) ? '✓' : '✗ ÓRFÃO';
    const funcaoValida = FUNCOES.includes(d.funcao) ? '✓' : '✗';
    return { id: d.id, colab: colabExiste, cli: cliExiste, funcao: funcaoValida };
  });
  validacoes[p] = v;
}

console.log('(a) Contagem por período:');
for (const p of PERIODOS) {
  const v = validacoes[p];
  console.log(`  ${p}: ${v.total} ${v.ok ? '✓' : '✗ esperado ' + v.esperado}`);
}
console.log(`  TOTAL: ${totalGeralValid} (esperado: ${SANITY_ESPERADO_POR_PERIODO * PERIODOS.length})`);

console.log('\n(b) Amostras (3 vínculos por período):');
for (const p of PERIODOS) {
  console.log(`  ${p}:`);
  for (const a of validacoes[p].amostra) {
    console.log(`    ${a.id}`);
    console.log(`       colab=${a.colab} | cli=${a.cli} | funcao=${a.funcao}`);
  }
}

// (c) Verificar que clientes pure asset não geraram vínculos
console.log('\n(c) Pure Asset não tem vínculos:');
const idsEstaveisPureAsset = new Set(
  cliBaseDocs.filter(c => c.pacote_servico === 'asset_only').map(c => c.id_estavel).filter(Boolean)
);
let vinculosPureAsset = 0;
for (const p of PERIODOS) {
  const snap = await getDocs(collection(db, 'fechamentos', p, 'vinculos'));
  for (const d of snap.docs) {
    const data = d.data();
    if (idsEstaveisPureAsset.has(data.id_estavel_cliente)) vinculosPureAsset++;
  }
}
console.log(`  Vínculos apontando para cliente Pure Asset: ${vinculosPureAsset} (esperado: 0)`);
const purAssetOk = vinculosPureAsset === 0;

// (d) SANDBOX intacto
console.log('\n(d) SANDBOX:');
const sandboxSnap = await getDocs(collection(db, 'fechamentos', 'SANDBOX', 'vinculos'));
console.log(`  fechamentos/SANDBOX/vinculos/: ${sandboxSnap.size} doc(s) (esperado: 1)`);
const sandboxOk = sandboxSnap.size === 1;

const todasOk = PERIODOS.every(p => validacoes[p].ok) && purAssetOk && sandboxOk;
console.log(`\n${todasOk ? '✅ TODAS as validações passaram.' : '⚠ ALGUMA validação falhou — revisar antes do commit.'}`);

process.exit(todasOk ? 0 : 1);
