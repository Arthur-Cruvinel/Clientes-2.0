// Fase 2.5 — Peça 2+3 — Etapa 2: dry-run completo.
// Constrói TODOS os vínculos em memória, sem write. Reporta:
//   - Por período: total, breakdown por função, resolvidos × tipo, vinicius_ex
//   - 3 amostras (manual, canônico, vinicius_ex) para validação visual
//   - Detalhes sobre fechamentos vs clientes_base (cobertura de Luiz Nerone etc.)

import { collection, getDocs } from 'firebase/firestore';
import { initDb, slugify } from './_helpers.mjs';

const PERIODOS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
const FUNCOES = ['consultoria_gestao', 'consultoria_planejamento', 'consultoria_financeira', 'operacional_financeiro', 'serv_adm', 'serv_aux_adm'];

const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const db = initDb();

const cliBaseSnap = await getDocs(collection(db, 'clientes_base'));
const cliBaseDocs = cliBaseSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
const cliBasePorId = new Map(cliBaseDocs.map(c => [c.docId, c]));
// Opção B: bridge id_estavel → clientes_base.docId (slug canônico).
// O docId em fechamentos/{periodo}/clientes/ é UUID, NÃO slug. O slug canônico
// só vive em clientes_base/. id_estavel é a ponte estável entre as duas
// representações.
const cliBasePorIdEstavel = new Map(cliBaseDocs.filter(c => c.id_estavel).map(c => [c.id_estavel, c]));

const colabSnap = await getDocs(collection(db, 'colaboradores_base'));
const colabsBase = colabSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
const colabPorNomeNorm = new Map();
for (const c of colabsBase) colabPorNomeNorm.set(norm(c.nome_colaborador), c);

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

// Constrói TODOS os vínculos em memória.
// Cliente vem de fechamentos/{periodo}/clientes — usa id_estavel do fechamento
// se presente, senão fallback para clientes_base/{docId}.id_estavel.
const dataCriacao = new Date().toISOString();
const vinculosPorPeriodo = {};
const stats = {};
const semClienteIdEstavel = [];
// Opção B + fallback B.2: rastrear quantos casos de fallback aconteceram.
//   - Caso ideal: bridge id_estavel → clientes_base.docId (slug)
//   - Fallback B.2: slugify(cli.nome_cliente) quando o id_estavel do
//     cliente em fechamentos NÃO bate com nenhum em clientes_base
const fallbacks = [];

function resolverSlugCliente(cli) {
  // Opção B: prioridade — bridge via id_estavel.
  if (cli.id_estavel) {
    const base = cliBasePorIdEstavel.get(cli.id_estavel);
    if (base) return { slug: base.docId, fonte: 'clientes_base.docId via id_estavel' };
  }
  // Fallback B.2: derivar do nome.
  return { slug: slugify(cli.nome_cliente ?? ''), fonte: 'slugify(nome_cliente)' };
}

for (const p of PERIODOS) {
  const snap = await getDocs(collection(db, 'fechamentos', p, 'clientes'));
  const docs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  const lista = [];
  const tipos = { manual: 0, canonico: 0, nao_resolvido: 0 };
  const porFuncao = {};
  const viniciusCount = { contagem: 0, clientes: [] };

  for (const cli of docs) {
    if (cli.pacote_servico === 'asset_only') continue;
    let idEstCli = cli.id_estavel;
    if (!idEstCli) {
      const base = cliBasePorId.get(cli.docId);
      idEstCli = base?.id_estavel;
    }
    if (!idEstCli) {
      semClienteIdEstavel.push({ periodo: p, cliente_docId: cli.docId, nome: cli.nome_cliente });
      continue;
    }
    // Opção B: resolver slug canônico do cliente.
    const { slug: slugCli, fonte } = resolverSlugCliente(cli);
    if (fonte === 'slugify(nome_cliente)') {
      fallbacks.push({
        periodo: p, cliente_docId: cli.docId, nome: cli.nome_cliente,
        id_estavel: cli.id_estavel ?? '(ausente)', slug_calculado: slugCli,
      });
    }
    for (const f of FUNCOES) {
      const nome = cli[f];
      if (!nome || !String(nome).trim()) continue;
      const r = resolverNome(nome);
      tipos[r.tipo]++;
      porFuncao[f] = (porFuncao[f] ?? 0) + 1;
      if (r.docId === 'vinicius_rodrigues_ex') {
        viniciusCount.contagem++;
        viniciusCount.clientes.push(cli.nome_cliente);
      }
      const vinculo = {
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
      };
      lista.push(vinculo);
    }
  }
  vinculosPorPeriodo[p] = lista;
  stats[p] = { total: lista.length, tipos, porFuncao, viniciusCount };
}

console.log('=== ETAPA 2: Dry-run completo (NENHUM write em vinculos/) ===\n');

for (const p of PERIODOS) {
  const s = stats[p];
  console.log(`--- ${p} ---`);
  console.log(`  Total de vínculos: ${s.total}`);
  console.log(`  Por tipo de resolução: manual=${s.tipos.manual} | canonico=${s.tipos.canonico} | nao_resolvido=${s.tipos.nao_resolvido}`);
  console.log(`  Vinicius Rodrigues (ex-funcionário): ${s.viniciusCount.contagem} vínculo(s)`);
  if (s.viniciusCount.contagem > 0 && s.viniciusCount.contagem <= 10) {
    console.log(`    Clientes: ${s.viniciusCount.clientes.join(', ')}`);
  }
  console.log(`  Breakdown por função:`);
  for (const f of FUNCOES) {
    console.log(`    ${f}: ${s.porFuncao[f] ?? 0}`);
  }
  console.log('');
}

const totalGeral = PERIODOS.reduce((s, p) => s + stats[p].total, 0);
console.log(`TOTAL GERAL (5 períodos): ${totalGeral} vínculos\n`);

// Verifica unicidade de docIds (sanity check).
const docIdsTodos = [];
for (const p of PERIODOS) for (const v of vinculosPorPeriodo[p]) docIdsTodos.push(v.id);
const docIdsUnicos = new Set(docIdsTodos);
console.log(`Sanity: docIds gerados=${docIdsTodos.length}, distintos=${docIdsUnicos.size}`);
if (docIdsTodos.length !== docIdsUnicos.size) {
  // Pode haver duplicata por período (mesma combinação colab+cli+funcao em mais de 1 período é OK
  // — docId é único por subcoleção). Mas duplicata DENTRO do mesmo período é erro.
  const porPeriodoDup = {};
  for (const p of PERIODOS) {
    const vistos = new Set();
    const dups = [];
    for (const v of vinculosPorPeriodo[p]) {
      if (vistos.has(v.id)) dups.push(v.id);
      vistos.add(v.id);
    }
    if (dups.length > 0) porPeriodoDup[p] = dups;
  }
  if (Object.keys(porPeriodoDup).length > 0) {
    console.log('⚠ DUPLICATAS DENTRO DE PERÍODO:');
    for (const [p, ds] of Object.entries(porPeriodoDup)) console.log(`  ${p}: ${ds.join(', ')}`);
  } else {
    console.log('  (Diferença entre total e distintos é esperada — mesmo docId pode aparecer em períodos diferentes, OK)');
  }
}

console.log('');
if (semClienteIdEstavel.length > 0) {
  console.log(`⚠ Clientes SEM id_estavel (não geram vínculos): ${semClienteIdEstavel.length}`);
  for (const c of semClienteIdEstavel.slice(0, 10)) console.log(`  ${c.periodo}/${c.cliente_docId} (${c.nome})`);
}

// === Amostras ===
console.log('\n=== AMOSTRAS (3 vínculos para validação visual) ===\n');

// 1. Amostra manual (Flávia ou Vinicius)
const v2025 = vinculosPorPeriodo['2025-12'];
const amostraManual = v2025.find(v => v.id_estavel_colaborador === 'a063e11b-b8dd-4c4a-868c-f15289e5919c');
const amostraCanonico = v2025.find(v => v.nome_colaborador === 'Arthur Cruvinel');
const amostraVinicius = v2025.find(v => v.id_estavel_colaborador === 'vinicius_rodrigues_ex');

console.log('--- Amostra 1: saneamento manual (Flavia Santos → Flávia Santos Romeu) ---');
console.log(JSON.stringify(amostraManual, null, 2));

console.log('\n--- Amostra 2: canônico direto (Arthur Cruvinel) ---');
console.log(JSON.stringify(amostraCanonico, null, 2));

console.log('\n--- Amostra 3: ex-funcionário (Vinicius Rodrigues → vinicius_rodrigues_ex) ---');
console.log(JSON.stringify(amostraVinicius, null, 2));

// Variação: comparar 2025-12 vs 2026-04 para Luiz Nerone (diagnóstico de 14-mai mencionou 50 refs em fechamentos)
console.log('\n=== Cobertura de "Luiz Nerone" em fechamentos ===\n');
for (const p of PERIODOS) {
  const luiz = vinculosPorPeriodo[p].filter(v => v.id_estavel_colaborador === 'ac6922ca-d464-4743-b125-51e8d0ec26c1');
  const luizManual = luiz.filter(v => v.nome_colaborador === 'Luis Eduardo Nerone'); // todos serão Luis Eduardo Nerone, mas vamos confirmar
  console.log(`  ${p}: ${luiz.length} vínculos para Luis Eduardo Nerone (todos saneados)`);
}

// === Relatório de fallbacks B.2 ===
console.log('\n=== Fallback B.2 — clientes em fechamentos sem match por id_estavel em clientes_base/ ===\n');
console.log(`Total de ocorrências de fallback: ${fallbacks.length}`);
if (fallbacks.length === 0) {
  console.log('  ✓ Nenhum fallback necessário — todos os clientes em fechamentos casaram com clientes_base/ via id_estavel.');
  console.log('  Opção B sozinha cobriu 100% dos casos.');
} else {
  // Dedup por (periodo, cliente_docId) para listar único por aparição
  const porSlugCalc = new Map();
  for (const fb of fallbacks) {
    const k = fb.slug_calculado;
    if (!porSlugCalc.has(k)) porSlugCalc.set(k, { nome: fb.nome, periodos: new Set(), id_estavel: fb.id_estavel });
    porSlugCalc.get(k).periodos.add(fb.periodo);
  }
  console.log(`Distintos (por slug_calculado): ${porSlugCalc.size}\n`);
  console.log('| Slug calculado | Nome cliente | id_estavel | Períodos afetados |');
  console.log('|---|---|---|---|');
  for (const [slug, info] of porSlugCalc) {
    console.log(`| \`${slug}\` | ${info.nome} | ${info.id_estavel} | ${[...info.periodos].sort().join(', ')} |`);
  }
}

console.log('\n=== Dry-run completo. Nenhum write feito. ===');
