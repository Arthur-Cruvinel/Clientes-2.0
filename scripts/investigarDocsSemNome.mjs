// Sub-fase 3C — Investigação READ-ONLY dos 22 docs "(sem nome)" em
// fechamentos/*/clientes/. Inspeciona payload integral, agrupa por período,
// tenta cross-reference com clientes_base/ (por sigla) e poupanca/ (por mês).

import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { initDb, gravarMd } from './_helpers.mjs';

/** Decide se o doc é "sem nome" — mesmo critério do match script. */
function semNome(data) {
  const v = data?.nome_cliente;
  return v == null || (typeof v === 'string' && v.trim() === '');
}

/** Detecta natureza do docId. */
function tipoDocId(id) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return 'UUID v4';
  if (/^[a-z0-9_]+$/.test(id)) return 'slug';
  if (/^\d+$/.test(id)) return 'numérico';
  return 'outro';
}

/** Conta campos não-vazios (excluindo o próprio nome_cliente). */
function camposPreenchidos(data) {
  const out = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'nome_cliente') continue;
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (typeof v === 'number' && v === 0) continue;
    if (typeof v === 'boolean' && v === false) continue;
    out.push(k);
  }
  return out;
}

async function main() {
  const db = initDb();

  console.log('[Inspect] Lendo collectionGroup(clientes)...');
  const snap = await getDocs(collectionGroup(db, 'clientes'));
  const semNomeDocs = snap.docs.filter((d) => semNome(d.data()));
  console.log(`[Inspect] ${semNomeDocs.length} docs sem nome de ${snap.size} total`);

  // Agrupa por período
  const porPeriodo = new Map();
  for (const d of semNomeDocs) {
    const periodo = d.ref.path.split('/')[1];
    if (!porPeriodo.has(periodo)) porPeriodo.set(periodo, []);
    porPeriodo.get(periodo).push(d);
  }

  // Lê clientes_base/ e poupanca/ para tentar cross-reference futura
  const baseSnap = await getDocs(collection(db, 'clientes_base'));
  const slugsBase = new Set(baseSnap.docs.map((d) => d.id));

  // Constrói relatório
  const out = [];
  out.push('# Investigação — 22 docs "(sem nome)" em fechamentos/*/clientes/');
  out.push('');
  out.push(`Gerado em ${new Date().toISOString()}. READ-ONLY.`);
  out.push('');
  out.push('## Sumário');
  out.push('');
  out.push(`Total de docs sem nome: **${semNomeDocs.length}**`);
  out.push('');
  out.push('### Distribuição por período');
  out.push('');
  out.push('| Período | Qtd | Tipos de docId |');
  out.push('|---|---:|---|');
  for (const [p, docs] of [...porPeriodo.entries()].sort()) {
    const tipos = new Set(docs.map((d) => tipoDocId(d.id)));
    out.push(`| ${p} | ${docs.length} | ${[...tipos].join(', ')} |`);
  }
  out.push('');

  // Análise de padrão: docIds bate com slugs de clientes_base/?
  let docsBatemSlugBase = 0;
  for (const d of semNomeDocs) {
    if (slugsBase.has(d.id)) docsBatemSlugBase++;
  }
  out.push('## Cross-reference com clientes_base/');
  out.push('');
  out.push(`Docs cujo docId bate com slug existente em clientes_base/: **${docsBatemSlugBase}/${semNomeDocs.length}**`);
  out.push('');
  if (docsBatemSlugBase > 0) {
    out.push('Isso é um forte indicador: os docs "(sem nome)" provavelmente são docs');
    out.push('cujo `nome_cliente` foi corrompido/apagado mas o docId preserva a identidade');
    out.push('via slug. Recuperação possível: ler `clientes_base/{docId}.nome_cliente`');
    out.push('e usar para popular o nome no snapshot + herdar id_estavel da base.');
  }
  out.push('');

  // Listagem completa: payload integral de cada doc
  out.push('## Listagem completa (payload integral)');
  out.push('');
  let idx = 0;
  for (const [periodo, docs] of [...porPeriodo.entries()].sort()) {
    out.push(`### Período ${periodo} (${docs.length} docs)`);
    out.push('');
    for (const d of docs) {
      idx++;
      const data = d.data();
      const preenchidos = camposPreenchidos(data);
      const tipo = tipoDocId(d.id);
      const noBase = slugsBase.has(d.id) ? '✓ docId existe em clientes_base/' : '✗ docId NÃO existe em clientes_base/';
      const nomeBase = slugsBase.has(d.id)
        ? baseSnap.docs.find((x) => x.id === d.id)?.data().nome_cliente
        : null;

      out.push(`#### ${idx}. \`${d.ref.path}\``);
      out.push('');
      out.push(`- **docId:** \`${d.id}\` (tipo: ${tipo})`);
      out.push(`- **Cross-ref clientes_base/:** ${noBase}`);
      if (nomeBase) out.push(`- **Nome no clientes_base/:** \`${nomeBase}\``);
      out.push(`- **Campos com valor (não-vazio/zero):** ${preenchidos.length === 0 ? 'NENHUM' : preenchidos.join(', ')}`);
      out.push('');
      out.push('Payload integral:');
      out.push('');
      out.push('```json');
      out.push(JSON.stringify(data, null, 2));
      out.push('```');
      out.push('');
    }
  }

  // Hipóteses e recomendação
  out.push('## Hipóteses sobre origem');
  out.push('');
  if (docsBatemSlugBase === semNomeDocs.length) {
    out.push('100% dos docId batem com slugs em `clientes_base/`. Isso sugere fortemente');
    out.push('que estes docs foram criados por algum pipeline que copiou o docId mas não');
    out.push('o campo `nome_cliente`. Candidatos:');
    out.push('- `fecharPeriodo` em firebase.ts (linhas 752-781) — `batch.set(destRef, d.data())`. Se');
    out.push('  o doc de origem em clientes_base/ não tinha nome_cliente em algum momento, o erro');
    out.push('  se propagou. **Improvável** — clientes_base/ atual tem todos com nome.');
    out.push('- `copiarPeriodo` em firebase.ts (linhas 537-567) — mesma operação `batch.set`.');
    out.push('  Possível que um período anterior tenha tido docs sem nome que foram copiados.');
    out.push('- Algum import Excel antigo gravou docs com docId mas sem campo `nome_cliente`.');
    out.push('');
    out.push('## Recomendação técnica');
    out.push('');
    out.push('**Opção recomendada:** recuperação cruzada com clientes_base/. Para cada doc:');
    out.push('1. Ler `clientes_base/{docId}.nome_cliente` → popular no snapshot.');
    out.push('2. Ler `clientes_base/{docId}.id_estavel` → herdar.');
    out.push('3. Aplicar tudo em um único `updateDoc` por doc.');
    out.push('');
    out.push('Isso transforma os 22 docs SEM_MATCH em CONFIANTE retroativo. Nenhum dado é');
    out.push('perdido — apenas restauramos campos que faltavam.');
  } else if (docsBatemSlugBase > 0) {
    out.push(`${docsBatemSlugBase}/${semNomeDocs.length} docs batem com clientes_base/.`);
    out.push('Os restantes ficam ambíguos — decisão manual necessária.');
  } else {
    out.push('Nenhum dos docs sem nome bate com slugs em clientes_base/.');
    out.push('Provavelmente são lixo (Pure Assets fantasma, imports defeituosos).');
    out.push('');
    out.push('## Recomendação técnica');
    out.push('');
    out.push('Verificar caso a caso. Se nenhum campo financeiro tem valor real,');
    out.push('podem ser deletados (não geram receita/custo no DRE).');
  }

  const path = gravarMd('fase-3-investigacao-sem-nome', out.join('\n'));
  console.log(`\n[Inspect] Relatório salvo em ${path}`);
  console.log(`[Inspect] Cross-ref com clientes_base: ${docsBatemSlugBase}/${semNomeDocs.length} batem`);
}

main().catch((e) => {
  console.error('[Inspect] Erro:', e);
  process.exit(1);
});
