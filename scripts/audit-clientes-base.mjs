// Auditoria READ-ONLY de clientes_base/ no Firestore.
// Compara cada slug com o conjunto de slugs canônicos derivado do
// SIGLA_PARA_NOME hardcoded. Marca:
//   (i) slug sem sigla canônica (potencial fantasma)
//   (ii) Wenderson/Galeno em nome E não bate com slug WRG canônico
//   (iii) MSAL em nome E não bate com slug MLM canônico
// Uso: node scripts/audit-clientes-base.mjs

import { collection, getDocs } from 'firebase/firestore';
import {
  initDb, carregarMapeamentos, slugify, slugsCanonicos, gravarMd,
} from './_helpers.mjs';

const db = initDb();
const { siglaParaNome } = carregarMapeamentos();
const slugsOk = slugsCanonicos(siglaParaNome);

console.log('[Audit] Lendo clientes_base/...');
const snap = await getDocs(collection(db, 'clientes_base'));
console.log(`[Audit] Total de docs: ${snap.size}`);

// Slugs canônicos esperados para Wenderson e MSAL — usados nas regras (ii) e (iii).
const slugWRG = slugify(siglaParaNome.get('WRG') ?? '');
const slugMLM = slugify(siglaParaNome.get('MLM') ?? '');

function pertenceA(s, palavras) {
  const norm = (s ?? '').toUpperCase();
  return palavras.some(p => norm.includes(p.toUpperCase()));
}

const linhas = [];
let suspeitas = 0;

for (const d of snap.docs) {
  const x = d.data();
  const docId = d.id;
  const nome = x.nome_cliente ?? '';
  const slugCalc = slugify(nome);

  const motivos = [];

  // (i) docId não é nenhum slug canônico — provável fantasma.
  if (!slugsOk.has(docId)) {
    motivos.push(`docId="${docId}" não é slug canônico`);
  }

  // (ii) Wenderson/Galeno mas docId não é o slug WRG canônico.
  if (pertenceA(nome, ['WENDERSON', 'GALENO']) && docId !== slugWRG) {
    motivos.push(`Wenderson/Galeno mas docId=${docId} (esperado ${slugWRG})`);
  }

  // (iii) MSAL mas docId não é o slug MLM canônico.
  if (pertenceA(nome, ['MSAL']) && docId !== slugMLM) {
    motivos.push(`MSAL mas docId=${docId} (esperado ${slugMLM})`);
  }

  // (iv) Sanidade extra — slugify(nome) ≠ docId. Indica que o nome foi
  // alterado depois do save sem recriar doc com slug novo.
  if (slugCalc && slugCalc !== docId) {
    motivos.push(`slug(nome)=${slugCalc} ≠ docId=${docId}`);
  }

  if (motivos.length > 0) suspeitas++;

  linhas.push({
    docId,
    nome,
    slugCalc,
    pacote: x.pacote_servico ?? '',
    data_entrada: x.data_entrada ?? '',
    suspeita: motivos.join(' · '),
  });
}

linhas.sort((a, b) => {
  if (a.suspeita && !b.suspeita) return -1;
  if (!a.suspeita && b.suspeita) return 1;
  return a.docId.localeCompare(b.docId);
});

const md = [
  `# Auditoria clientes_base/ — ${new Date().toISOString()}`,
  '',
  `- Total de docs: **${snap.size}**`,
  `- Suspeitas: **${suspeitas}**`,
  `- Slugs canônicos esperados (derivados de SIGLA_PARA_NOME): ${slugsOk.size}`,
  '',
  '## Docs (suspeitos no topo)',
  '',
  '| docId | nome_cliente | slug(nome) | pacote | data_entrada | SUSPEITA |',
  '|---|---|---|---|---|---|',
  ...linhas.map(l => `| \`${l.docId}\` | ${l.nome} | \`${l.slugCalc}\` | ${l.pacote} | ${l.data_entrada} | ${l.suspeita ? `**${l.suspeita}**` : ''} |`),
  '',
].join('\n');

const path = gravarMd('clientes-base', md);
console.log(`[Audit] Sumário: ${snap.size} docs, ${suspeitas} suspeitos`);
console.log(`[Audit] Relatório salvo: ${path}`);
process.exit(0);
