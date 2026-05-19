// Fase 2.5 — Peça 2+3 — Etapas 0+1: snapshot prévio + diagnóstico read-only.
// Sem writes em vinculos/. Cria backup em backups/firestore/vinculos-pre-migracao-{ts}/.

import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initDb, slugify } from './_helpers.mjs';

const ROOT = process.cwd();
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const PERIODOS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
const FUNCOES = ['consultoria_gestao', 'consultoria_planejamento', 'consultoria_financeira', 'operacional_financeiro', 'serv_adm', 'serv_aux_adm'];

const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const db = initDb();

// ========== ETAPA 0 ==========
console.log('=== ETAPA 0: Snapshot prévio ===');
const dir = join(ROOT, 'backups', 'firestore', 'vinculos-pre-migracao-' + TS);
mkdirSync(dir, { recursive: true });

const cliBaseSnap = await getDocs(collection(db, 'clientes_base'));
const cliBaseDocs = cliBaseSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
writeFileSync(join(dir, 'clientes_base.json'), JSON.stringify(cliBaseDocs, null, 2), 'utf8');
console.log('  clientes_base.json: ' + cliBaseDocs.length + ' docs');

const cliPorPeriodo = {};
for (const p of PERIODOS) {
  const snap = await getDocs(collection(db, 'fechamentos', p, 'clientes'));
  const docs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  writeFileSync(join(dir, 'fechamentos_' + p + '_clientes.json'), JSON.stringify(docs, null, 2), 'utf8');
  cliPorPeriodo[p] = docs;
  console.log('  fechamentos_' + p + '_clientes.json: ' + docs.length + ' docs');
}
console.log('  Snapshot dir: ' + dir);

// ========== ETAPA 1 ==========
console.log('\n=== ETAPA 1: Diagnóstico ===\n');

const colabSnap = await getDocs(collection(db, 'colaboradores_base'));
const colabsBase = colabSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
const colabPorNomeNorm = new Map();
for (const c of colabsBase) {
  colabPorNomeNorm.set(norm(c.nome_colaborador), c);
}
console.log('Colaboradores_base indexados: ' + colabsBase.length + ' por nome normalizado');

const cintia = colabPorNomeNorm.get('cintia de jesus alves');
const RESOLUCAO_MANUAL = {
  'flavia santos': { tipo: 'manual', docId: 'flavia_santos_romeu', nome: 'Flávia Santos Romeu', id_estavel: 'a063e11b-b8dd-4c4a-868c-f15289e5919c' },
  'cintia alves':  { tipo: 'manual', docId: 'cintia_de_jesus_alves', nome: 'Cintia De Jesus Alves', id_estavel: cintia?.id_estavel },
  'luiz nerone':   { tipo: 'manual', docId: 'luis_eduardo_nerone', nome: 'Luis Eduardo Nerone', id_estavel: 'ac6922ca-d464-4743-b125-51e8d0ec26c1' },
  'lucas silva':   { tipo: 'manual', docId: 'lucas_henrique', nome: 'Lucas Henrique', id_estavel: 'a5a8437d-6bd3-47f4-bd7a-8fd925fe6595' },
  'vinicius rodrigues': { tipo: 'manual', docId: 'vinicius_rodrigues_ex', nome: 'Vinicius Rodrigues (ex-funcionário)', id_estavel: 'vinicius_rodrigues_ex' },
};

console.log('\nMapa manual (5 nomes quebrados):');
for (const [src, alvo] of Object.entries(RESOLUCAO_MANUAL)) {
  console.log('  "' + src + '" → ' + alvo.docId + ' / id_estavel=' + (alvo.id_estavel ?? 'AUSENTE') + (alvo.id_estavel ? '' : ' ⚠'));
}

function resolverNome(nome) {
  if (!nome) return null;
  const n = norm(nome);
  if (RESOLUCAO_MANUAL[n]) return { ...RESOLUCAO_MANUAL[n], slug: RESOLUCAO_MANUAL[n].docId };
  const canon = colabPorNomeNorm.get(n);
  if (canon) return { tipo: 'canonico', docId: canon.docId, slug: canon.docId, nome: canon.nome_colaborador, id_estavel: canon.id_estavel };
  return { tipo: 'nao_resolvido', docId: 'nao_resolvido_' + slugify(nome), slug: 'nao_resolvido_' + slugify(nome), nome: nome, id_estavel: 'nao_resolvido_' + slugify(nome) };
}

// (a) por período: docs com função preenchida
console.log('\n--- (a) Docs com função preenchida por período (excluindo asset_only) ---');
for (const p of PERIODOS) {
  const docs = cliPorPeriodo[p];
  const ativos = docs.filter(c => c.pacote_servico !== 'asset_only');
  const comFuncao = ativos.filter(c => FUNCOES.some(f => c[f] && String(c[f]).trim()));
  const pureAsset = docs.filter(c => c.pacote_servico === 'asset_only').length;
  console.log('  ' + p + ': total=' + docs.length + ', asset_only=' + pureAsset + ', com função=' + comFuncao.length);
}

// (b) resolução em clientes_base
console.log('\n--- (b) Resolução de nomes em clientes_base/ ---');
const resolvidosBase = new Map();
const naoResolvidosBase = new Map();
const refsTotal = { manual: 0, canonico: 0, nao_resolvido: 0 };
for (const cli of cliBaseDocs) {
  if (cli.pacote_servico === 'asset_only') continue;
  for (const f of FUNCOES) {
    const nome = cli[f];
    if (!nome) continue;
    const r = resolverNome(nome);
    if (!r) continue;
    refsTotal[r.tipo]++;
    if (r.tipo === 'nao_resolvido') {
      naoResolvidosBase.set(nome, (naoResolvidosBase.get(nome) ?? 0) + 1);
    } else {
      const cur = resolvidosBase.get(nome) ?? { contagem: 0, alvo: r };
      cur.contagem++;
      resolvidosBase.set(nome, cur);
    }
  }
}
console.log('Referências em clientes_base/ por tipo:');
console.log('  manual (mapa de 5 nomes): ' + refsTotal.manual);
console.log('  canonico (match normalizado): ' + refsTotal.canonico);
console.log('  nao_resolvido: ' + refsTotal.nao_resolvido);

console.log('\nNomes que resolveram MANUALMENTE (saneados):');
for (const [nome, info] of resolvidosBase) {
  if (info.alvo.tipo !== 'manual') continue;
  console.log('  "' + nome + '" (' + info.contagem + 'x) → ' + info.alvo.nome);
}
console.log('\nNomes que resolveram CANÔNICO direto:');
for (const [nome, info] of [...resolvidosBase].sort((a, b) => b[1].contagem - a[1].contagem)) {
  if (info.alvo.tipo !== 'canonico') continue;
  console.log('  "' + nome + '" (' + info.contagem + 'x) → ' + info.alvo.nome);
}
if (naoResolvidosBase.size === 0) {
  console.log('\nNomes NÃO RESOLVIDOS em clientes_base/: 0 ✓');
} else {
  console.log('\nNomes NÃO RESOLVIDOS em clientes_base/:');
  for (const [nome, n] of naoResolvidosBase) console.log('  "' + nome + '" (' + n + 'x) → seria nao_resolvido_' + slugify(nome));
}

// Contagem de vínculos por período
console.log('\n--- Vínculos que seriam criados por período ---');
let totalGeral = 0;
const naoResolvidosFech = new Map();
for (const p of PERIODOS) {
  const docs = cliPorPeriodo[p];
  let total = 0;
  const porFuncao = {};
  let nrPeriodo = 0;
  for (const cli of docs) {
    if (cli.pacote_servico === 'asset_only') continue;
    for (const f of FUNCOES) {
      const nome = cli[f];
      if (!nome) continue;
      total++;
      porFuncao[f] = (porFuncao[f] ?? 0) + 1;
      const r = resolverNome(nome);
      if (r?.tipo === 'nao_resolvido') {
        nrPeriodo++;
        naoResolvidosFech.set(nome, (naoResolvidosFech.get(nome) ?? 0) + 1);
      }
    }
  }
  totalGeral += total;
  console.log('  ' + p + ': total=' + total + ' (nao_resolvidos=' + nrPeriodo + ')');
  for (const [f, n] of Object.entries(porFuncao)) console.log('     ' + f + ': ' + n);
}
console.log('\n  TOTAL GERAL (5 períodos): ' + totalGeral);

if (naoResolvidosFech.size > 0) {
  console.log('\nNomes NÃO RESOLVIDOS encontrados nos fechamentos:');
  for (const [nome, n] of naoResolvidosFech) console.log('  "' + nome + '" (' + n + 'x)');
}

// (c) e (d)
console.log('\n--- (c) Período SANDBOX ---');
const sandboxSnap = await getDocs(collection(db, 'fechamentos', 'SANDBOX', 'vinculos'));
console.log('  fechamentos/SANDBOX/vinculos/: ' + sandboxSnap.size + ' doc(s) — NÃO será tocado.');

console.log('\n--- (d) Estado atual de fechamentos/*/vinculos/ ---');
try {
  const vincSnap = await getDocs(collectionGroup(db, 'vinculos'));
  const porPeriodoExist = new Map();
  for (const d of vincSnap.docs) {
    const p = d.ref.path.split('/')[1];
    porPeriodoExist.set(p, (porPeriodoExist.get(p) ?? 0) + 1);
  }
  console.log('  Total docs em vinculos/ (todos os períodos): ' + vincSnap.size);
  for (const [p, n] of porPeriodoExist) console.log('    ' + p + ': ' + n + ' docs');
  const nonSandbox = [...porPeriodoExist.keys()].filter(p => p !== 'SANDBOX');
  if (nonSandbox.length === 0) console.log('  ✓ Estado limpo — só SANDBOX tem vínculos.');
  else console.log('  ⚠ EXISTEM vínculos em: ' + nonSandbox.join(', '));
} catch (e) {
  console.log('  collectionGroup erro: ' + e.message);
}

console.log('\n=== Diagnóstico completo. ===');
console.log('Snapshot dir: ' + dir);
console.log('Total de vínculos a criar (5 períodos): ' + totalGeral);
