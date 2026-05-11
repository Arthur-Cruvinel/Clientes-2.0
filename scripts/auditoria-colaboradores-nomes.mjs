// Auditoria READ-ONLY: lista nome_colaborador distintos em
// fechamentos/{periodo}/colaboradores/, agrupa por slug e sinaliza
// variações de grafia (mesma pessoa cadastrada com nomes ligeiramente
// diferentes em períodos distintos).
//
// Sem writes. Apenas getDocs em collectionGroup('colaboradores').

import { collectionGroup, getDocs } from 'firebase/firestore';
import { initDb, slugify, gravarMd } from './_helpers.mjs';

/** Classifica um grupo conforme número de grafias distintas + presença. */
function classificar(grupo) {
  if (grupo.nomes_encontrados.size === 0) return 'VAZIO';
  if (grupo.nomes_encontrados.size === 1) return 'OK';
  return 'VARIACAO';
}

async function main() {
  const db = initDb();

  console.log('[Inspect] Lendo collectionGroup("colaboradores")...');
  const snap = await getDocs(collectionGroup(db, 'colaboradores'));
  console.log(`[Inspect] ${snap.size} documentos encontrados`);

  // Agrupa por slug do nome_colaborador. Grupos com slug vazio
  // (nome ausente/vazio) ficam separados em VAZIO.
  const porSlug = new Map();
  const semNome = []; // docs sem nome — vão para grupo VAZIO

  for (const d of snap.docs) {
    const data = d.data();
    const periodo = d.ref.path.split('/')[1];
    const nome = data?.nome_colaborador;
    const cargo = data?.cargo;

    if (!nome || (typeof nome === 'string' && nome.trim() === '')) {
      semNome.push({
        docId: d.id, periodo,
        campos_presentes: Object.keys(data ?? {}).sort(),
      });
      continue;
    }

    const slug = slugify(nome);
    if (!porSlug.has(slug)) {
      porSlug.set(slug, {
        slug,
        nomes_encontrados: new Set(),
        periodos: [],
        docIds: new Set(),
        cargos: new Set(),
        // Mapa interno: nome → períodos onde aparece (para tabela de variação)
        porGrafia: new Map(),
      });
    }
    const g = porSlug.get(slug);
    g.nomes_encontrados.add(nome);
    g.periodos.push(periodo);
    g.docIds.add(d.id);
    if (cargo && cargo.trim()) g.cargos.add(cargo.trim());
    if (!g.porGrafia.has(nome)) g.porGrafia.set(nome, []);
    g.porGrafia.get(nome).push(periodo);
  }

  // Classifica
  const ok = [];
  const variacoes = [];
  for (const g of porSlug.values()) {
    const cls = classificar(g);
    if (cls === 'OK') ok.push(g);
    else if (cls === 'VARIACAO') variacoes.push(g);
  }

  // Ordena para consistência de output
  ok.sort((a, b) => a.slug.localeCompare(b.slug));
  variacoes.sort((a, b) => a.slug.localeCompare(b.slug));
  semNome.sort((a, b) => (a.periodo + a.docId).localeCompare(b.periodo + b.docId));

  // ====== Relatório no terminal + md ======
  const linhas = [];
  const push = (s = '') => { linhas.push(s); console.log(s); };

  push('=== AUDITORIA colaboradores — nome_colaborador ===');
  push(`Data: ${new Date().toISOString()}`);
  push('');
  push('--- Resumo ---');
  push(`  Total documentos: ${snap.size}`);
  push(`  Colaboradores únicos (por slug): ${porSlug.size}`);
  push(`  Grupos OK (1 grafia): ${ok.length}`);
  push(`  Grupos com VARIAÇÃO (2+ grafias): ${variacoes.length}`);
  push(`  Grupos VAZIO (sem nome): ${semNome.length}`);
  push('');

  push('--- Grupos com VARIAÇÃO (requer atenção) ---');
  if (variacoes.length === 0) {
    push('  Nenhum.');
  } else {
    for (const g of variacoes) {
      push(`  Slug: ${g.slug}`);
      push(`    Grafias encontradas:`);
      const grafiasOrdenadas = [...g.porGrafia.entries()]
        .sort(([a], [b]) => a.localeCompare(b));
      for (const [nome, periodos] of grafiasOrdenadas) {
        const ps = [...new Set(periodos)].sort().join(', ');
        push(`      - "${nome}" → períodos: [${ps}]`);
      }
      const cargos = [...g.cargos].sort();
      push(`    Cargos: [${cargos.join(', ') || '—'}]`);
      push(`    Total snapshots: ${g.periodos.length}`);
      push('');
    }
  }

  push('--- Grupos OK ---');
  if (ok.length === 0) {
    push('  Nenhum.');
  } else {
    for (const g of ok) {
      const nomeCanonico = [...g.nomes_encontrados][0];
      const nPeriodos = new Set(g.periodos).size;
      const cargo = [...g.cargos].sort().join(', ') || '—';
      push(`  ${g.slug} | "${nomeCanonico}" | ${nPeriodos} períodos | cargo: ${cargo}`);
    }
  }
  push('');

  push('--- Grupos VAZIO ---');
  if (semNome.length === 0) {
    push('  Nenhum.');
  } else {
    for (const x of semNome) {
      push(`  docId: ${x.docId} | período: ${x.periodo} | campos presentes: [${x.campos_presentes.join(', ')}]`);
    }
  }
  push('');
  push('===================');

  // Salva cópia em md
  const path = gravarMd('auditoria-colaboradores-nomes', linhas.join('\n'));
  console.log(`\n[Inspect] Relatório salvo em ${path}`);
}

main().catch((e) => {
  console.error('[Inspect] Erro:', e);
  process.exit(1);
});
