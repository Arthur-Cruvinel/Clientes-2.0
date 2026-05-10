// Sub-fase 3C — Validação READ-ONLY da hipótese sobre os 22 docs fantasma.
//
// Hipótese: cada docId fantasma em fechamentos/*/clientes/ bate com slug
// EXISTENTE em clientes_base/, com nome_cliente e id_estavel preenchidos.
// Se confirmado, caminho (b) (popular via clientes_base/{docId}) é seguro.

import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { initDb, gravarMd } from './_helpers.mjs';

function semNome(data) {
  const v = data?.nome_cliente;
  return v == null || (typeof v === 'string' && v.trim() === '');
}

async function main() {
  const db = initDb();

  console.log('[Validate] Lendo fechamentos/*/clientes/ + clientes_base/...');
  const [fechSnap, baseSnap] = await Promise.all([
    getDocs(collectionGroup(db, 'clientes')),
    getDocs(collection(db, 'clientes_base')),
  ]);

  // Indexa clientes_base/ por docId
  const baseMap = new Map();
  for (const d of baseSnap.docs) baseMap.set(d.id, d.data());

  // Coleta os fantasmas + valida
  const fantasmas = fechSnap.docs.filter((d) => semNome(d.data()));
  console.log(`[Validate] ${fantasmas.length} docs fantasma encontrados`);

  // Unifica por docId (cada cliente aparece em 2 períodos — só queremos 11 únicos)
  const porSlug = new Map();
  for (const d of fantasmas) {
    if (!porSlug.has(d.id)) porSlug.set(d.id, { periodos: [], data: d.data() });
    porSlug.get(d.id).periodos.push(d.ref.path.split('/')[1]);
  }

  // Valida cada slug único contra clientes_base/
  const resultado = [];
  for (const [slug, info] of [...porSlug.entries()].sort()) {
    const base = baseMap.get(slug);
    if (!base) {
      resultado.push({ slug, status: 'NAO_EXISTE_EM_BASE', periodos: info.periodos });
      continue;
    }
    const temNome = typeof base.nome_cliente === 'string' && base.nome_cliente.trim().length > 0;
    const temIdEstavel = typeof base.id_estavel === 'string' && base.id_estavel.length > 0;
    if (!temNome) {
      resultado.push({ slug, status: 'BASE_SEM_NOME', periodos: info.periodos, base });
    } else if (!temIdEstavel) {
      resultado.push({ slug, status: 'BASE_SEM_ID_ESTAVEL', periodos: info.periodos, base });
    } else {
      resultado.push({
        slug, status: 'OK_RECUPERAVEL', periodos: info.periodos,
        nome_canonico: base.nome_cliente, id_estavel: base.id_estavel,
      });
    }
  }

  // Sumário
  const okCount = resultado.filter((r) => r.status === 'OK_RECUPERAVEL').length;
  const naoExiste = resultado.filter((r) => r.status === 'NAO_EXISTE_EM_BASE').length;
  const semNomeBase = resultado.filter((r) => r.status === 'BASE_SEM_NOME').length;
  const semId = resultado.filter((r) => r.status === 'BASE_SEM_ID_ESTAVEL').length;
  console.log(`\n[Validate] === Validação dos ${porSlug.size} slugs únicos ===`);
  console.log(`  OK_RECUPERAVEL:        ${okCount}`);
  console.log(`  NAO_EXISTE_EM_BASE:    ${naoExiste}`);
  console.log(`  BASE_SEM_NOME:         ${semNomeBase}`);
  console.log(`  BASE_SEM_ID_ESTAVEL:   ${semId}`);
  console.log(`\n  Total de docs (snapshots) recuperáveis: ${okCount * 2} (cada slug em 2 períodos)`);

  // Relatório markdown
  const out = [];
  out.push('# Validação dos 22 docs fantasma — hipótese de recuperação via clientes_base/');
  out.push('');
  out.push(`Gerado em ${new Date().toISOString()}. READ-ONLY.`);
  out.push('');
  out.push('## Sumário');
  out.push('');
  out.push(`- Slugs únicos fantasma: **${porSlug.size}** (cada um em 2 períodos = ${fantasmas.length} docs)`);
  out.push(`- Recuperáveis via clientes_base/: **${okCount}** slugs (${okCount * 2} docs)`);
  out.push(`- Não recuperáveis (sem base): **${naoExiste + semNomeBase + semId}** slugs`);
  out.push('');
  out.push('## Tabela detalhada');
  out.push('');
  out.push('| Slug (docId fantasma) | Períodos | Status | Nome canônico | id_estavel canônico |');
  out.push('|---|---|---|---|---|');
  for (const r of resultado) {
    const nome = r.nome_canonico ?? '—';
    const id = r.id_estavel ?? '—';
    const periodos = r.periodos.sort().join(', ');
    out.push(`| \`${r.slug}\` | ${periodos} | ${r.status} | ${nome} | \`${id}\` |`);
  }
  out.push('');
  out.push('## Conclusão');
  out.push('');
  if (naoExiste === 0 && semNomeBase === 0 && semId === 0) {
    out.push('✓ Hipótese confirmada 100%. Todos os 22 docs podem ser recuperados via caminho (b).');
    out.push('');
    out.push('Para cada fantasma, aplicar via `updateDoc`:');
    out.push('- `nome_cliente` = `clientes_base/{docId}.nome_cliente`');
    out.push('- `id_estavel` = `clientes_base/{docId}.id_estavel`');
    out.push('');
    out.push('Os demais campos (pacote, consultoria_*, etc.) NÃO são populados nesta rodada — fora do escopo.');
  } else {
    out.push('⚠ Hipótese parcialmente confirmada. Casos especiais precisam de decisão manual.');
  }

  const path = gravarMd('fase-3-validacao-fantasmas', out.join('\n'));
  console.log(`\n[Validate] Relatório salvo em ${path}`);
}

main().catch((e) => {
  console.error('[Validate] Erro:', e);
  process.exit(1);
});
