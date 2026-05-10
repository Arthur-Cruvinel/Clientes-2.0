// Fase C3 — Inspeção de duplicatas em clientes_base/ (READ-ONLY).
// Audita os 2 docIds suspeitos identificados pela A3:
//   - kevin     (provável duplicata de KSL — Kevin Santos Lopes)
//   - tamires   (provável duplicata de TCG — Tamires Cassia Dias de Britto)
//
// Para cada um: dump do documento + verifica existência da versão canônica
// + busca referências cruzadas em poupanca/, fechamentos/{*}/clientes/,
// mapeamento_siglas/. ZERO writes — qualquer set/update/delete é violação
// da REGRA INVIOLÁVEL.
//
// Saída: audit-results/inspect-duplicatas-{ts}.md com recomendação por slug.

import { collection, collectionGroup, doc, getDoc, getDocs } from 'firebase/firestore';
import { initDb, gravarMd } from './_helpers.mjs';

const SUSPEITOS = [
  { slug: 'kevin', canonico: 'kevin_santos_lopes', sigla: 'KSL' },
  { slug: 'tamires', canonico: 'tamires_cassia_dias_de_britto', sigla: 'TCG' },
];

/** Lê doc — retorna { existe, dados } sem lançar quando não encontra. */
async function lerDoc(db, caminho, id) {
  const ref = doc(db, caminho, id);
  const snap = await getDoc(ref);
  return { existe: snap.exists(), dados: snap.exists() ? snap.data() : null };
}

/** Refs em poupanca/ — varre coleção e filtra por slug do docId. */
async function buscarPoupanca(db, slug) {
  const snap = await getDocs(collection(db, 'poupanca'));
  const matches = [];
  for (const d of snap.docs) {
    if (d.id.startsWith(`${slug}_`)) matches.push({ id: d.id, ...d.data() });
  }
  return matches;
}

/** Refs em fechamentos/{periodo}/clientes/ — collectionGroup p/ todos os
 *  períodos de uma vez. Filtra docId exato (slug é o id do doc). */
async function buscarFechamentos(db, slug) {
  const snap = await getDocs(collectionGroup(db, 'clientes'));
  const matches = [];
  for (const d of snap.docs) {
    // Path: fechamentos/{periodo}/clientes/{slug}
    if (d.id === slug) {
      const periodo = d.ref.parent.parent?.id ?? '?';
      matches.push({ periodo, id: d.id, ...d.data() });
    }
  }
  return matches;
}

/** Refs em mapeamento_siglas/ — campo `codigo` ou docId que case com slug. */
async function buscarMapeamentoSiglas(db, slug) {
  const snap = await getDocs(collection(db, 'mapeamento_siglas'));
  const slugLower = slug.toLowerCase();
  const matches = [];
  for (const d of snap.docs) {
    const data = d.data();
    const codigoLower = (data.codigo ?? '').toLowerCase();
    if (d.id.toLowerCase() === slugLower || codigoLower === slugLower) {
      matches.push({ id: d.id, ...data });
    }
  }
  return matches;
}

/** Heurística da recomendação. Trivial: sem refs cruzadas em fechamentos +
 *  versão canônica não existe ou é doc órfão (ainda sem dados). Complexa:
 *  refs em fechamentos OU canônico já tem dados em conflito. */
function recomendar(suspeito, refs, canonico) {
  if (refs.fechamentos.length > 0) {
    return `**Migração complexa — requer atenção.** O slug "${suspeito.slug}" tem `
      + `${refs.fechamentos.length} referência(s) em fechamentos/ — exige merge `
      + `período-a-período antes de remover o doc legacy.`;
  }
  if (refs.poupanca.length > 0 && canonico.existe) {
    return `**Migração complexa — requer atenção.** Slug legacy tem `
      + `${refs.poupanca.length} doc(s) em poupanca/ E o canônico já existe — `
      + `exige decidir merge ou descarte por mês.`;
  }
  if (refs.poupanca.length === 0 && refs.fechamentos.length === 0
      && refs.mapeamentoSiglas.length === 0) {
    return `**Migração trivial.** Documento órfão sem referências cruzadas — `
      + `pode ser deletado direto após confirmar não ter histórico esperado.`;
  }
  return `**Migração trivial.** ${refs.poupanca.length} ref(s) em poupanca/ + `
    + `${refs.mapeamentoSiglas.length} em mapeamento_siglas/ podem ser renomeadas `
    + `via update do nome_cliente (slug do docId atualizado em batch).`;
}

function dumpCampos(dados, indent = '  ') {
  if (!dados) return `${indent}(documento não existe)`;
  return Object.entries(dados)
    .map(([k, v]) => `${indent}- **${k}**: \`${JSON.stringify(v)}\``)
    .join('\n');
}

function listarRefs(titulo, items, fmt) {
  if (items.length === 0) return `### ${titulo}\n\nNenhuma referência encontrada.\n`;
  const linhas = items.map((it, i) => `${i + 1}. ${fmt(it)}`).join('\n');
  return `### ${titulo}\n\nTotal: ${items.length}\n\n${linhas}\n`;
}

async function main() {
  const db = initDb();
  const out = [
    '# Fase C3 — Inspeção de duplicatas em clientes_base/',
    '',
    `Gerado em ${new Date().toISOString()}`,
    '',
    'READ-ONLY — nenhum write feito por este script.',
    '',
  ];

  for (const s of SUSPEITOS) {
    console.log(`[Inspect] Investigando "${s.slug}" (canônico: "${s.canonico}")...`);
    const fonte = await lerDoc(db, 'clientes_base', s.slug);
    const canonico = await lerDoc(db, 'clientes_base', s.canonico);
    const refs = {
      poupanca: await buscarPoupanca(db, s.slug),
      fechamentos: await buscarFechamentos(db, s.slug),
      mapeamentoSiglas: await buscarMapeamentoSiglas(db, s.slug),
    };

    out.push('---', '', `## Slug suspeito: \`${s.slug}\``, '');
    out.push(`Sigla canon esperada: \`${s.sigla}\` · slug canônico: \`${s.canonico}\``, '');
    out.push('### Documento atual em `clientes_base/`', '', `Existe? **${fonte.existe ? 'sim' : 'não'}**`, '');
    if (fonte.existe) out.push(dumpCampos(fonte.dados), '');
    out.push('### Versão canônica em `clientes_base/`', '');
    out.push(`Existe \`clientes_base/${s.canonico}\`? **${canonico.existe ? 'sim' : 'não'}**`);
    if (canonico.existe) out.push('', dumpCampos(canonico.dados));
    out.push('');
    out.push(listarRefs('Referências em `poupanca/`', refs.poupanca,
      (it) => `\`${it.id}\` — período ${it.ano}-${String(it.mes).padStart(2, '0')} · pl_total: ${it.pl_total ?? '—'}`));
    out.push(listarRefs('Referências em `fechamentos/{periodo}/clientes/`', refs.fechamentos,
      (it) => `período \`${it.periodo}\` · pacote: ${it.pacote_servico ?? '—'} · receita_fee: ${it.receita_fee ?? '—'}`));
    out.push(listarRefs('Referências em `mapeamento_siglas/`', refs.mapeamentoSiglas,
      (it) => `docId \`${it.id}\` · codigo: \`${it.codigo}\` · sigla: \`${it.sigla}\``));
    out.push('### Recomendação', '', recomendar(s, refs, canonico), '');
  }

  const path = gravarMd('inspect-duplicatas', out.join('\n'));
  console.log(`[Inspect] Relatório salvo em ${path}`);
}

main().catch((e) => {
  console.error('[Inspect] Erro:', e);
  process.exit(1);
});
