// Auditoria READ-ONLY de poupanca/ no Firestore.
// Para cada documento, calcula slug esperado a partir de nome_cliente
// (slugify do useImportPoupanca.ts) e compara com slug do docId.
// Marca 3 categorias: divergente, fantasma, contas_agregadas suspeito.
// Uso: node scripts/audit-poupanca.mjs

import { collection, getDocs } from 'firebase/firestore';
import {
  initDb, carregarMapeamentos, slugify, slugDoDocId, slugsCanonicos, gravarMd,
} from './_helpers.mjs';

const db = initDb();
const { siglaParaNome, mapeamento } = carregarMapeamentos();
const slugsOk = slugsCanonicos(siglaParaNome);
console.log(`[Audit] Slugs canônicos derivados: ${slugsOk.size}`);

console.log('[Audit] Lendo poupanca/...');
const snap = await getDocs(collection(db, 'poupanca'));
console.log(`[Audit] Total de docs: ${snap.size}`);

const cat1 = []; // slug divergente
const cat2 = []; // cliente-fantasma
const cat3 = []; // contas_agregadas suspeito

for (const d of snap.docs) {
  const x = d.data();
  const docId = d.id;
  const slugDoc = slugDoDocId(docId);
  const nome = x.nome_cliente ?? '';
  const slugCalc = slugify(nome);

  // Categoria 1 — slug do docId não bate com slugify(nome_cliente).
  // Indica que o nome_cliente foi alterado depois do save (ex: correção
  // de grafia) sem renomear o doc — gera 2 slugs para o mesmo cliente.
  if (slugDoc !== slugCalc) {
    cat1.push({ docId, slugDoc, slugCalc, nome });
  }

  // Categoria 2 — slug não corresponde a nenhuma sigla canônica.
  // Inclui clientes legítimos que não têm sigla cadastrada (raros) E
  // clientes-fantasma criados por imports antigos com sigla resolvida errado.
  if (!slugsOk.has(slugDoc)) {
    cat2.push({ docId, slugDoc, nome });
  }

  // Categoria 3 — algum codigo em contas_agregadas[] resolve para sigla
  // diferente da sigla esperada do cliente (derivada do slug).
  const contas = Array.isArray(x.contas_agregadas) ? x.contas_agregadas : [];
  if (contas.length > 0) {
    // Sigla esperada: encontra a sigla cuja slugify(SIGLA_PARA_NOME[sigla]) === slugDoc.
    let siglaEsperada = null;
    for (const [sigla, n] of siglaParaNome) {
      if (slugify(n) === slugDoc) { siglaEsperada = sigla; break; }
    }
    if (siglaEsperada) {
      const conflitos = [];
      for (const codigo of contas) {
        const siglaCod = mapeamento.get(codigo);
        if (siglaCod && siglaCod !== siglaEsperada) {
          conflitos.push(`${codigo} → ${siglaCod} (≠ ${siglaEsperada})`);
        }
      }
      if (conflitos.length > 0) {
        cat3.push({ docId, slugDoc, nome, siglaEsperada, conflitos });
      }
    }
  }
}

// Sumarização — agrupar Cat1 e Cat2 por slug do docId para reduzir ruído
function agrupar(arr, getSlug) {
  const map = new Map();
  for (const r of arr) {
    const k = getSlug(r);
    const lista = map.get(k) ?? [];
    lista.push(r);
    map.set(k, lista);
  }
  return map;
}
const cat1Grupos = agrupar(cat1, r => r.slugDoc);
const cat2Grupos = agrupar(cat2, r => r.slugDoc);

const md = [
  `# Auditoria poupanca/ — ${new Date().toISOString()}`,
  '',
  `- Total de docs: **${snap.size}**`,
  `- Cat1 — slug divergente: **${cat1.length}** doc${cat1.length === 1 ? '' : 's'} em ${cat1Grupos.size} cliente(s)`,
  `- Cat2 — cliente-fantasma: **${cat2.length}** doc${cat2.length === 1 ? '' : 's'} em ${cat2Grupos.size} slug(s)`,
  `- Cat3 — contas_agregadas suspeito: **${cat3.length}** doc${cat3.length === 1 ? '' : 's'}`,
  '',
  '## Cat1 — Slug divergente (nome_cliente ≠ slug do docId)',
  '',
  '| Slug do docId | Slug calculado | nome_cliente | Docs afetados |',
  '|---|---|---|---|',
  ...[...cat1Grupos.values()].map(g => {
    const r = g[0];
    return `| \`${r.slugDoc}\` | \`${r.slugCalc}\` | ${r.nome} | ${g.length} |`;
  }),
  '',
  '## Cat2 — Cliente-fantasma (slug sem sigla canônica)',
  '',
  '| Slug | Nome cadastrado | Docs |',
  '|---|---|---|',
  ...[...cat2Grupos.entries()].map(([slug, docs]) =>
    `| \`${slug}\` | ${docs[0].nome} | ${docs.length} |`),
  '',
  '## Cat3 — contas_agregadas com códigos resolvendo para sigla diferente',
  '',
  '| docId | Cliente | Sigla esperada | Conflitos |',
  '|---|---|---|---|',
  ...cat3.map(r => `| \`${r.docId}\` | ${r.nome} | ${r.siglaEsperada} | ${r.conflitos.join(' · ')} |`),
  '',
].join('\n');

const path = gravarMd('poupanca', md);
console.log(`[Audit] Sumário: cat1=${cat1.length} cat2=${cat2.length} cat3=${cat3.length}`);
console.log(`[Audit] Relatório salvo: ${path}`);
process.exit(0);
