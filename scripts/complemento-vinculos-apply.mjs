// Complementação de vínculos — Etapas 2+3. Extensão da Fase 2.5 Peça 2.
// Cria vínculos faltantes para funções que têm colaborador no campo legado
// (FONTE = clientes_base) mas SEM vínculo correspondente no período.
//
// ADITIVO: nunca deleta nem sobrescreve vínculo existente. Um par
// (id_estavel_cliente, funcao) que já tem vínculo é pulado.
// Dedup por id_estavel: docs duplicados no snapshot (UUID + slug) contam 1x.
//
// Uso:
//   node scripts/complemento-vinculos-apply.mjs          → DRY-RUN (sem write)
//   node scripts/complemento-vinculos-apply.mjs apply     → grava

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { initDb, slugify } from './_helpers.mjs';

const APLICAR = process.argv[2] === 'apply';
const PERIODOS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
const FUNCOES = ['consultoria_gestao', 'consultoria_planejamento', 'consultoria_financeira', 'operacional_financeiro', 'serv_adm', 'serv_aux_adm'];
const BATCH_LIMIT = 400;
const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const db = initDb();

// ===== Resolução de colaborador (idêntica à Peça 2) =====
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
  'flavia santos': { docId: 'flavia_santos_romeu', nome: 'Flávia Santos Romeu', id_estavel: 'a063e11b-b8dd-4c4a-868c-f15289e5919c' },
  'cintia alves':  { docId: 'cintia_de_jesus_alves', nome: 'Cintia De Jesus Alves', id_estavel: cintia?.id_estavel },
  'luiz nerone':   { docId: 'luis_eduardo_nerone', nome: 'Luis Eduardo Nerone', id_estavel: 'ac6922ca-d464-4743-b125-51e8d0ec26c1' },
  'lucas silva':   { docId: 'lucas_henrique', nome: 'Lucas Henrique', id_estavel: 'a5a8437d-6bd3-47f4-bd7a-8fd925fe6595' },
  'vinicius rodrigues': { docId: 'vinicius_rodrigues_ex', nome: 'Vinicius Rodrigues (ex-funcionário)', id_estavel: 'vinicius_rodrigues_ex' },
};

function resolverNome(nome) {
  const n = norm(nome);
  if (RESOLUCAO_MANUAL[n]) return { tipo: 'manual', slug: RESOLUCAO_MANUAL[n].docId, ...RESOLUCAO_MANUAL[n] };
  const canon = colabPorNomeNorm.get(n);
  if (canon) return { tipo: 'canonico', slug: canon.docId, docId: canon.docId, nome: canon.nome_colaborador, id_estavel: canon.id_estavel };
  return { tipo: 'nao_resolvido', slug: 'nao_resolvido_' + slugify(nome), docId: 'nao_resolvido_' + slugify(nome), nome, id_estavel: 'nao_resolvido_' + slugify(nome) };
}

// ===== clientes_base por id_estavel (FONTE B) =====
const cliBaseSnap = await getDocs(collection(db, 'clientes_base'));
const cliBaseDocs = cliBaseSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
const cliBasePorIdEstavel = new Map(cliBaseDocs.filter(c => c.id_estavel).map(c => [c.id_estavel, c]));

// ===== Build vínculos faltantes por período (dedup por id_estavel) =====
const dataCriacao = new Date().toISOString();
const faltantesPorPeriodo = {};
const contagemAntes = {};
const semBase = [];

for (const p of PERIODOS) {
  // vínculos existentes → set de "{id_estavel_cliente}|{funcao}"
  const vincSnap = await getDocs(collection(db, 'fechamentos', p, 'vinculos'));
  contagemAntes[p] = vincSnap.size;
  const vincSet = new Set(vincSnap.docs.map(d => `${d.data().id_estavel_cliente}|${d.data().funcao}`));

  // ids únicos presentes no período (dedup UUID + slug)
  const cliSnap = await getDocs(collection(db, 'fechamentos', p, 'clientes'));
  const idsPresentes = new Set();
  for (const d of cliSnap.docs) {
    const id = d.data().id_estavel;
    if (id) idsPresentes.add(id);
  }

  const lista = [];
  for (const idEst of idsPresentes) {
    const base = cliBasePorIdEstavel.get(idEst);
    if (!base) { semBase.push({ periodo: p, idEst }); continue; }      // sem cadastro mestre → não há FONTE B
    if (base.pacote_servico === 'asset_only') continue;                // pure asset não gera vínculo
    const slugCli = base.docId;                                        // slug canônico (docId do clientes_base)
    for (const f of FUNCOES) {
      const nome = base[f];
      if (!nome || !String(nome).trim()) continue;
      if (vincSet.has(`${idEst}|${f}`)) continue;                      // já tem vínculo → pula (aditivo)
      const r = resolverNome(nome);
      lista.push({
        id: `${r.slug}_${slugCli}_${f}`,
        periodo: p,
        id_estavel_colaborador: r.id_estavel,
        id_estavel_cliente: idEst,
        nome_colaborador: r.nome,
        nome_cliente: base.nome_cliente,
        funcao: f,
        pct: 0,
        origem: 'migracao',
        data_criacao: dataCriacao,
        _resolucao: r.tipo,
      });
    }
  }
  faltantesPorPeriodo[p] = lista;
}

// ===== Relatório =====
console.log(`\n${'='.repeat(64)}`);
console.log(`MODO: ${APLICAR ? 'APPLY (grava)' : 'DRY-RUN (sem write)'} | FONTE: clientes_base`);
console.log('='.repeat(64));

let totalGeral = 0;
let totalNaoResolvido = 0;
const naoResolvidos = new Map();
for (const p of PERIODOS) {
  const lista = faltantesPorPeriodo[p];
  totalGeral += lista.length;
  const porFuncao = {};
  const nr = lista.filter(v => v._resolucao === 'nao_resolvido');
  totalNaoResolvido += nr.length;
  for (const v of nr) naoResolvidos.set(v.nome_colaborador, (naoResolvidos.get(v.nome_colaborador) ?? 0) + 1);
  for (const v of lista) porFuncao[v.funcao] = (porFuncao[v.funcao] ?? 0) + 1;
  console.log(`\n  ${p}: faltantes=${lista.length} (atuais=${contagemAntes[p]} → após=${contagemAntes[p] + lista.length})`);
  for (const [f, n] of Object.entries(porFuncao)) console.log(`     ${f}: ${n}`);
}
console.log(`\n  TOTAL faltantes (dedup): ${totalGeral} | não-resolvíveis: ${totalNaoResolvido}`);
if (naoResolvidos.size > 0) for (const [n, c] of naoResolvidos) console.log(`     não-resolvido: "${n}" (${c}x)`);

if (semBase.length > 0) {
  console.log(`\n  ⚠ ${semBase.length} (id_estavel, período) presentes no snapshot mas SEM doc em clientes_base — pulados:`);
  for (const s of semBase) console.log(`     ${s.periodo} | ${s.idEst}`);
}

// RONALD check
const RONALD = '4a5423ee-42af-482b-8f36-2d85ec73411f';
const ronald2604 = faltantesPorPeriodo['2026-04'].filter(v => v.id_estavel_cliente === RONALD);
console.log(`\n  RONALD DOMINGUES em 2026-04: ${ronald2604.length} vínculo(s) novo(s)`);
for (const v of ronald2604) console.log(`     ${v.funcao} ← ${v.nome_colaborador} | docId=${v.id}`);

// ===== Apply =====
if (!APLICAR) {
  console.log('\n(DRY-RUN — nenhum write. Rode com "apply" para gravar.)');
  process.exit(0);
}

console.log('\n=== GRAVANDO (writeBatch, máx 400/lote) ===');
const contagemDepois = {};
for (const p of PERIODOS) {
  const lista = faltantesPorPeriodo[p];
  let criados = 0;
  for (let i = 0; i < lista.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const v of lista.slice(i, i + BATCH_LIMIT)) {
      const { _resolucao, ...payload } = v;        // não persiste campo auxiliar
      batch.set(doc(db, 'fechamentos', p, 'vinculos', v.id), payload);
    }
    await batch.commit();
    criados += Math.min(BATCH_LIMIT, lista.length - i);
  }
  // recontar
  const vincSnap = await getDocs(collection(db, 'fechamentos', p, 'vinculos'));
  contagemDepois[p] = vincSnap.size;
  console.log(`  ${p}: criados=${criados} | total ${contagemAntes[p]} → ${contagemDepois[p]}`);
}

// Validação final RONALD
const ronaldSnap = await getDocs(collection(db, 'fechamentos', '2026-04', 'vinculos'));
const ronaldVinc = ronaldSnap.docs.filter(d => d.data().id_estavel_cliente === RONALD);
console.log(`\n  VALIDAÇÃO RONALD 2026-04: ${ronaldVinc.length} vínculos no total:`);
for (const d of ronaldVinc.sort((a, b) => a.data().funcao.localeCompare(b.data().funcao))) {
  console.log(`     ${d.data().funcao} ← ${d.data().nome_colaborador}`);
}

console.log('\n=== Apply concluído. ===');
process.exit(0);
