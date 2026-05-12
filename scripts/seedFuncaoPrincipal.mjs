// Fase 2 Ato 1.5 — seed de funcao_principal em colaboradores_base/.
//
// Lê valor do snapshot Jan/26, aplica regra especial para sócios
// (Viviane Leal, Amilcar Junior, Priscilla Rocha → 'institucional'),
// valida contra FUNCOES_PRINCIPAIS e propõe updateDoc.
//
// REGRAS ABSOLUTAS:
//   - Só toca em `funcao_principal` e `cadastro_completo`
//   - Toda gravação via updateDoc (não setDoc)
//   - Snapshot prévio obrigatório em backups/firestore/
//   - Read-only por padrão; write apenas com --apply

import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initDb } from './_helpers.mjs';

const ROOT = process.cwd();

// Espelho de FUNCOES_PRINCIPAIS em src/utils/constants.ts.
const FUNCOES_PRINCIPAIS = [
  'consultoria_gestao',
  'consultoria_planejamento',
  'consultoria_financeira',
  'operacional_financeiro',
  'serv_adm',
  'serv_aux_adm',
  'institucional',
];

// Sócios — funcao_principal forçada para 'institucional' independente do snapshot.
const SOCIOS_FORCAR_INSTITUCIONAL = new Set([
  'Viviane Leal',
  'Amilcar Junior',
  'Priscilla Rocha',
]);

function slugify(nome) {
  if (!nome) return '';
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function normalizar(s) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function parseArgs(argv) {
  return { apply: argv.slice(2).includes('--apply') };
}

function gravarSnapshot(docs) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `seed-funcao-principal-${ts}.json`);
  const payload = {
    timestamp: new Date().toISOString(),
    total: docs.length,
    docs: docs.map((d) => ({ docId: d.id, path: d.ref.path, dados_antes: d.data() })),
  };
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  return path;
}

function gravarRelatorio(conteudo, modo) {
  const dir = join(ROOT, 'audit-results');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `fase2-seed-funcao-principal-${modo}-${ts}.md`);
  writeFileSync(path, conteudo, 'utf8');
  return path;
}

async function main() {
  const args = parseArgs(process.argv);
  const modo = args.apply ? 'APLICADO' : 'DRY-RUN';
  console.log(`[Seed funcao_principal] Iniciado — modo: ${modo}`);

  const db = initDb();

  // 1. Lê colaboradores_base/
  console.log('[Seed] Lendo colaboradores_base/...');
  const baseSnap = await getDocs(collection(db, 'colaboradores_base'));
  console.log(`[Seed] colaboradores_base/: ${baseSnap.size} docs`);

  // 2. Lê fechamentos/2026-01/colaboradores/ para extrair funcao_principal
  console.log('[Seed] Lendo fechamentos/2026-01/colaboradores/...');
  const jan26 = await getDocs(collection(db, 'fechamentos', '2026-01', 'colaboradores'));

  // Indexa Jan/26 por nome normalizado e por slug
  const jan26PorNome = new Map();
  const jan26PorSlug = new Map();
  for (const d of jan26.docs) {
    const data = d.data();
    const nome = data?.nome_colaborador;
    if (!nome) continue;
    jan26PorNome.set(normalizar(nome), data);
    jan26PorSlug.set(slugify(nome), data);
  }

  // 3. Para cada doc em base, determina funcao_principal proposta
  const propostas = [];
  for (const d of baseSnap.docs) {
    const data = d.data();
    const docId = d.id;
    const nome = data.nome_colaborador;
    const cargo = data.cargo;
    const funcaoAtual = data.funcao_principal ?? '';

    // Lookup em Jan/26: nome exato (normalizado) preferido; fallback por slug.
    const jan26Data = jan26PorNome.get(normalizar(nome)) ?? jan26PorSlug.get(docId);
    const funcaoJan26 = jan26Data?.funcao_principal ?? null;

    // Regra especial 1 — Sócios
    const ehSocio = SOCIOS_FORCAR_INSTITUCIONAL.has(nome);
    let proposta;
    let fonte;
    let observacao = '';

    if (ehSocio) {
      proposta = 'institucional';
      fonte = 'regra-especial-socio';
      if (funcaoJan26 && funcaoJan26 !== 'institucional') {
        observacao = `Jan/26 era "${funcaoJan26}" — sobrescrevendo para institucional`;
      }
    } else if (funcaoJan26 == null) {
      proposta = null;
      fonte = 'sem-fonte';
      observacao = 'Sem match em Jan/26 e não é sócio — REVISÃO HUMANA';
    } else if (!FUNCOES_PRINCIPAIS.includes(funcaoJan26)) {
      proposta = null;
      fonte = 'valor-invalido';
      observacao = `Valor "${funcaoJan26}" não está em FUNCOES_PRINCIPAIS — REVISÃO HUMANA`;
    } else {
      proposta = funcaoJan26;
      fonte = 'snapshot-jan26';
    }

    propostas.push({
      docId, nome, cargo,
      funcao_atual: funcaoAtual,
      funcao_jan26: funcaoJan26,
      funcao_proposta: proposta,
      fonte, observacao,
      eh_socio: ehSocio,
      requer_revisao: proposta == null,
    });
  }

  // Ordena por nome para legibilidade
  propostas.sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'));

  // 4. Estatísticas
  const totalDocs = propostas.length;
  const totalRevisao = propostas.filter((p) => p.requer_revisao).length;
  const totalAplicar = propostas.filter((p) => !p.requer_revisao).length;
  const socios = propostas.filter((p) => p.eh_socio);

  console.log('\n=== Distribuição ===');
  console.log(`  Total docs: ${totalDocs}`);
  console.log(`  Aplicar:    ${totalAplicar}`);
  console.log(`  Revisão:    ${totalRevisao}`);
  console.log(`  Sócios:     ${socios.length}`);

  console.log('\n=== Tabela (ordem alfabética por nome) ===');
  console.log('nome'.padEnd(28) + ' | ' + 'cargo'.padEnd(34) + ' | ' + 'jan/26'.padEnd(26) + ' | ' + 'proposta'.padEnd(26) + ' | fonte');
  console.log('-'.repeat(28) + '-+-' + '-'.repeat(34) + '-+-' + '-'.repeat(26) + '-+-' + '-'.repeat(26) + '-+----------');
  for (const p of propostas) {
    const jan = String(p.funcao_jan26 ?? '(null)');
    const prop = String(p.funcao_proposta ?? '(null)');
    console.log(
      (p.nome ?? '').padEnd(28) + ' | ' +
      (p.cargo ?? '').padEnd(34) + ' | ' +
      jan.padEnd(26) + ' | ' +
      prop.padEnd(26) + ' | ' + p.fonte,
    );
  }

  // 5. Snapshot prévio
  const pathSnap = gravarSnapshot(baseSnap.docs);
  console.log(`\n[Seed] Snapshot prévio: ${pathSnap}`);

  // 6. APPLY (apenas com --apply)
  let aplicados = 0, erros = [];
  if (args.apply) {
    if (totalRevisao > 0) {
      console.error(`\n[Seed] ERRO: ${totalRevisao} casos requerem REVISÃO HUMANA. Apply abortado.`);
      process.exit(1);
    }

    console.log('\n[Seed] APLICANDO updateDoc em cada colaborador_base/...');
    for (const p of propostas) {
      try {
        await updateDoc(doc(db, 'colaboradores_base', p.docId), {
          funcao_principal: p.funcao_proposta,
          cadastro_completo: true,
        });
        aplicados++;
        console.log(`  [${aplicados}/${totalDocs}] ${p.docId}: ${p.funcao_proposta}`);
      } catch (e) {
        erros.push({ docId: p.docId, erro: e.message });
        console.error(`  ERRO ${p.docId}: ${e.message}`);
      }
    }

    // Validação pós-write
    console.log('[Seed] Validando pós-write...');
    const valSnap = await getDocs(collection(db, 'colaboradores_base'));
    const vazios = valSnap.docs.filter((d) => {
      const v = d.data().funcao_principal;
      return v == null || v === '';
    });
    if (vazios.length > 0) {
      throw new Error(`Validação falhou: ${vazios.length} docs ainda com funcao_principal vazio`);
    }
    console.log(`[Seed] ✓ Validação OK: 0 docs com funcao_principal vazio.`);
  }

  // 7. Relatório markdown
  const md = [];
  md.push(`# Fase 2 Ato 1.5 — Seed de funcao_principal — ${modo}`);
  md.push('');
  md.push(`Gerado em ${new Date().toISOString()}.`);
  md.push('');
  md.push('## Resumo');
  md.push('');
  md.push(`- Total docs em colaboradores_base/: **${totalDocs}**`);
  md.push(`- Propostas a aplicar (CONFIANTE): **${totalAplicar}**`);
  md.push(`- Casos REVISÃO HUMANA: **${totalRevisao}**`);
  md.push(`- Sócios (forçados 'institucional'): **${socios.length}**`);
  if (args.apply) {
    md.push(`- Aplicados: **${aplicados}/${totalDocs}**`);
    md.push(`- Erros: **${erros.length}**`);
  }
  md.push('');
  md.push('## Tabela completa');
  md.push('');
  md.push('| # | Nome | Cargo | funcao_principal Jan/26 | funcao_principal proposta | Fonte | Observação |');
  md.push('|---|---|---|---|---|---|---|');
  propostas.forEach((p, i) => {
    md.push(
      `| ${i + 1} | ${p.nome ?? '—'} | ${p.cargo ?? '—'} | ` +
      `${p.funcao_jan26 ?? '(null)'} | **${p.funcao_proposta ?? '(REVISÃO)'}** | ` +
      `${p.fonte} | ${p.observacao || '—'} |`,
    );
  });
  md.push('');
  if (socios.length > 0) {
    md.push('## Sócios — regra especial aplicada');
    md.push('');
    for (const s of socios) {
      md.push(`- **${s.nome}** (${s.cargo}): Jan/26 = \`${s.funcao_jan26 ?? '(null)'}\` → forçado para \`institucional\``);
    }
    md.push('');
  }
  if (totalRevisao > 0) {
    md.push('## Casos REVISÃO HUMANA');
    md.push('');
    for (const p of propostas.filter((x) => x.requer_revisao)) {
      md.push(`- **${p.nome}** (${p.cargo}): ${p.observacao}`);
    }
    md.push('');
  }
  md.push(`## Snapshot prévio`);
  md.push('');
  md.push(`\`${pathSnap}\``);
  md.push('');
  if (args.apply && erros.length > 0) {
    md.push('## Erros');
    md.push('');
    for (const e of erros) md.push(`- \`${e.docId}\`: ${e.erro}`);
    md.push('');
  }

  const modoTag = args.apply ? 'aplicado' : 'dry-run';
  const pathMd = gravarRelatorio(md.join('\n'), modoTag);
  console.log(`\n[Seed] Relatório salvo: ${pathMd}`);

  console.log('\n=== Resumo final ===');
  console.log(`  Total: ${totalDocs} · Aplicar: ${totalAplicar} · Revisão: ${totalRevisao} · Sócios: ${socios.length}`);
  if (args.apply) console.log(`  Aplicados: ${aplicados} · Erros: ${erros.length}`);
}

main().catch((e) => {
  console.error('[Seed funcao_principal] Erro:', e);
  process.exit(1);
});
