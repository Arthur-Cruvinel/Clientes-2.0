// Sub-fase 3C — PASSO 3a refeito (Visão 2): analisa match entre docs em
// fechamentos/*/clientes/ e clientes_base/, classificando em CONFIANTE,
// AMBÍGUO ou SEM_MATCH. READ-ONLY — apenas gera relatório.
//
// Regra (Visão 2): id_estavel deve representar a entidade lógica.
// Snapshots do mesmo cliente em períodos diferentes herdam o mesmo
// id_estavel de clientes_base/{slug}.id_estavel.
//
// Classificação:
//   CONFIANTE  → nome_cliente bate exato OU slug bate exato com base
//   AMBÍGUO    → slug do doc é substring de algum slug em base (ou vice-versa)
//   SEM_MATCH  → nenhum candidato

import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { initDb, gravarMd } from './_helpers.mjs';

/** Slug canônico — copiado de src/utils/slug.ts (impl idêntica). */
function slug(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/** Classifica um doc em fechamentos contra a base de clientes. */
function classificar(nomeFech, baseByNome, baseBySlug, todosBaseSlugs) {
  // CONFIANTE — match exato no nome
  if (baseByNome.has(nomeFech)) {
    return { tipo: 'CONFIANTE', via: 'nome_exato', candidato: baseByNome.get(nomeFech) };
  }
  const sFech = slug(nomeFech);
  // CONFIANTE — match via slug
  if (baseBySlug.has(sFech)) {
    return { tipo: 'CONFIANTE', via: 'slug_exato', candidato: baseBySlug.get(sFech) };
  }
  // AMBÍGUO — substring match (não-fuzzy, determinístico, conservador)
  // Min 4 chars para evitar match espúrio entre nomes curtos (ex: "ana" e
  // "ana_carolina" — não, esse caso já bate via slug. Mas "luiz" e "luiza"
  // fariam match espúrio. Min 4 reduz isso.)
  const candidatosAmbiguos = [];
  if (sFech.length >= 4) {
    for (const bSlug of todosBaseSlugs) {
      if (bSlug.length < 4) continue;
      if (bSlug === sFech) continue; // já cobrido por CONFIANTE
      if (sFech.includes(bSlug) || bSlug.includes(sFech)) {
        candidatosAmbiguos.push({ slug: bSlug, ...baseBySlug.get(bSlug) });
      }
    }
  }
  if (candidatosAmbiguos.length > 0) {
    return { tipo: 'AMBIGUO', via: 'substring_slug', candidatos: candidatosAmbiguos };
  }
  return { tipo: 'SEM_MATCH' };
}

async function main() {
  const db = initDb();

  // 1) Carrega clientes_base/ uma vez. Todos devem ter id_estavel (PASSO 2).
  console.log('[Match] Lendo clientes_base/...');
  const baseSnap = await getDocs(collection(db, 'clientes_base'));
  const baseByNome = new Map();
  const baseBySlug = new Map();
  let baseSemIdEstavel = 0;
  for (const d of baseSnap.docs) {
    const data = d.data();
    if (!data.id_estavel) baseSemIdEstavel++;
    const meta = { docId: d.id, id_estavel: data.id_estavel, nome_cliente: data.nome_cliente };
    baseByNome.set(data.nome_cliente, meta);
    const s = slug(data.nome_cliente);
    if (!baseBySlug.has(s)) baseBySlug.set(s, meta);
  }
  const todosBaseSlugs = [...baseBySlug.keys()];
  console.log(`[Match] clientes_base/: ${baseSnap.size} docs, ${baseSemIdEstavel} sem id_estavel`);
  if (baseSemIdEstavel > 0) {
    console.error('[Match] ERRO: clientes_base/ tem docs sem id_estavel. PASSO 2 não foi concluído.');
    process.exit(1);
  }

  // 2) Carrega fechamentos/*/clientes/ e classifica.
  console.log('[Match] Lendo collectionGroup(clientes)...');
  const fechSnap = await getDocs(collectionGroup(db, 'clientes'));
  console.log(`[Match] ${fechSnap.size} docs em fechamentos/*/clientes/`);

  const buckets = { CONFIANTE: [], AMBIGUO: [], SEM_MATCH: [] };
  for (const d of fechSnap.docs) {
    const data = d.data();
    const nome = data.nome_cliente ?? '(sem nome)';
    const periodo = d.ref.path.split('/')[1];
    const r = classificar(nome, baseByNome, baseBySlug, todosBaseSlugs);
    buckets[r.tipo].push({ docId: d.id, path: d.ref.path, periodo, nome, ...r });
  }

  console.log('\n[Match] === Distribuição ===');
  for (const tipo of ['CONFIANTE', 'AMBIGUO', 'SEM_MATCH']) {
    console.log(`  ${tipo.padEnd(11)} → ${buckets[tipo].length} docs`);
  }

  // 3) Relatório markdown.
  const linhas = [];
  linhas.push('# Sub-fase 3C — Match clientes_fechamentos × clientes_base');
  linhas.push('');
  linhas.push(`Gerado em ${new Date().toISOString()}. READ-ONLY.`);
  linhas.push('');
  linhas.push('## Sumário');
  linhas.push('');
  linhas.push(`- Total em \`clientes_base/\`: **${baseSnap.size}** (todos com id_estavel)`);
  linhas.push(`- Total em \`fechamentos/*/clientes/\`: **${fechSnap.size}**`);
  linhas.push('');
  linhas.push('| Classificação | Docs | Comportamento esperado |');
  linhas.push('|---|---:|---|');
  linhas.push(`| **CONFIANTE** | ${buckets.CONFIANTE.length} | Herdar id_estavel do match em clientes_base/ |`);
  linhas.push(`| **AMBÍGUO** | ${buckets.AMBIGUO.length} | Requer revisão humana — possui candidato(s) por substring |`);
  linhas.push(`| **SEM_MATCH** | ${buckets.SEM_MATCH.length} | Requer revisão humana — nenhum candidato em clientes_base/ |`);
  linhas.push('');

  // Detalhe — CONFIANTE: agrupar por via para inspecção
  const confExatos = buckets.CONFIANTE.filter((x) => x.via === 'nome_exato').length;
  const confSlug = buckets.CONFIANTE.filter((x) => x.via === 'slug_exato').length;
  linhas.push('### Detalhe CONFIANTE');
  linhas.push('');
  linhas.push(`- Match por nome exato: **${confExatos}**`);
  linhas.push(`- Match por slug (normalizado): **${confSlug}**`);
  linhas.push('');

  // AMBÍGUO — listar TODOS, agrupados por nome
  linhas.push('### AMBÍGUO — todos os casos');
  linhas.push('');
  if (buckets.AMBIGUO.length === 0) {
    linhas.push('Nenhum caso ambíguo.');
  } else {
    const porNome = new Map();
    for (const a of buckets.AMBIGUO) {
      if (!porNome.has(a.nome)) porNome.set(a.nome, { periodos: new Set(), candidatos: a.candidatos });
      porNome.get(a.nome).periodos.add(a.periodo);
    }
    linhas.push('| Nome em fechamentos | Períodos afetados | Candidatos em clientes_base/ |');
    linhas.push('|---|---|---|');
    for (const [nome, info] of [...porNome.entries()].sort()) {
      const periodos = [...info.periodos].sort().join(', ');
      const cands = info.candidatos
        .map((c) => `\`${c.docId}\` (${c.nome_cliente})`)
        .join(' · ');
      linhas.push(`| ${nome} | ${periodos} | ${cands} |`);
    }
  }
  linhas.push('');

  // SEM_MATCH — listar TODOS, agrupados por nome
  linhas.push('### SEM_MATCH — todos os casos');
  linhas.push('');
  if (buckets.SEM_MATCH.length === 0) {
    linhas.push('Nenhum caso sem match.');
  } else {
    const porNome = new Map();
    for (const s of buckets.SEM_MATCH) {
      if (!porNome.has(s.nome)) porNome.set(s.nome, new Set());
      porNome.get(s.nome).add(s.periodo);
    }
    linhas.push('| Nome em fechamentos | Períodos afetados | Slug derivado |');
    linhas.push('|---|---|---|');
    for (const [nome, periodos] of [...porNome.entries()].sort()) {
      linhas.push(`| ${nome} | ${[...periodos].sort().join(', ')} | \`${slug(nome)}\` |`);
    }
  }
  linhas.push('');
  linhas.push('## Decisões pendentes do usuário');
  linhas.push('');
  linhas.push('Para cada AMBÍGUO: escolher qual candidato de clientes_base/ herdar (ou rejeitar).');
  linhas.push('Para cada SEM_MATCH: decidir entre:');
  linhas.push('1. Criar entrada nova em `clientes_base/` (cliente legítimo ainda não cadastrado)');
  linhas.push('2. Gerar id_estavel novo direto no doc (sem espelho em clientes_base)');
  linhas.push('3. Pular o doc (lixo/erro de dado — não migrar)');

  const path = gravarMd('fase-3-match-clientes', linhas.join('\n'));
  console.log(`\n[Match] Relatório salvo em ${path}`);
}

main().catch((e) => {
  console.error('[Match] Erro:', e);
  process.exit(1);
});
