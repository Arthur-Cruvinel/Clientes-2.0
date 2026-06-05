// Migração — divisão de beneficios_fixos em 4 subcampos (aditiva).
//
// Regra ÚNICA de herança (fechada pelo CFO): o pacote padrão é Vale Alimentação.
//   vale_alimentacao = beneficios_fixos
//   vale_transporte = 0, plano_saude = 0, outros_beneficios = 0
//
// PRINCÍPIOS:
//   - Puramente ADITIVA: só cria os 4 subcampos. beneficios_fixos e qualquer
//     campo calculado (custo_total_mensal, custo_hora, ...) NUNCA são tocados.
//     Mesmo precedente do id_estavel (Fase 3) sobre períodos fechados.
//   - writeBatch.update (semântica updateDoc): se o doc não existir no caminho,
//     o commit falha → interrompe e reporta. Nunca cria doc fantasma.
//   - Idempotente: docs que já têm os 4 subcampos são pulados.
//
// Escopo: colaboradores_base/ (21) + fechamentos/{periodo}/colaboradores/ (105).
//
// Modos:
//   node scripts/migrarBeneficios.mjs            → DRY-RUN (default, sem writes)
//   node scripts/migrarBeneficios.mjs --apply    → snapshot + APPLY + validação

import {
  collection, collectionGroup, getDocs, getDoc, writeBatch,
} from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initDb } from './_helpers.mjs';

const ROOT = process.cwd();
const BATCH_LIMIT = 400;
const SUBCAMPOS = ['vale_alimentacao', 'vale_transporte', 'plano_saude', 'outros_beneficios'];
const ESPERADOS = new Set([0, 1426.83]);
const TOLERANCIA = 0.005; // meio centavo, para float
const APPLY = process.argv.includes('--apply');

/** Regra única de herança. Recebe o total persistido, devolve os 4 subcampos. */
function decompor(beneficiosFixos) {
  return {
    vale_alimentacao: beneficiosFixos ?? 0,
    vale_transporte: 0,
    plano_saude: 0,
    outros_beneficios: 0,
  };
}

/** Lê todos os docs alvo das 2 coleções e monta o plano de migração. */
async function montarPlano(db) {
  const itens = [];

  const baseSnap = await getDocs(collection(db, 'colaboradores_base'));
  for (const d of baseSnap.docs) itens.push(montarItem(d, 'colaboradores_base', d.ref));

  const cgSnap = await getDocs(collectionGroup(db, 'colaboradores'));
  for (const d of cgSnap.docs) {
    const periodo = d.ref.path.split('/')[1]; // fechamentos/{periodo}/colaboradores/{id}
    itens.push(montarItem(d, `fechamentos/${periodo}`, d.ref));
  }
  return itens;
}

function montarItem(docSnap, colecao, ref) {
  const data = docSnap.data();
  const benef = data.beneficios_fixos;
  const jaMigrado = SUBCAMPOS.some(k => data[k] !== undefined);
  return {
    path: `${colecao}/${docSnap.id}`,
    ref,
    colecao,
    beneficios_fixos: benef,
    custo_total_mensal: data.custo_total_mensal,
    jaMigrado,
    tipoInvalido: typeof benef !== 'number' || Number.isNaN(benef),
    foraDoEsperado: typeof benef === 'number' && !ESPERADOS.has(benef),
    decomposicao: typeof benef === 'number' ? decompor(benef) : null,
  };
}

function resumir(itens) {
  const aMigrar = itens.filter(i => !i.jaMigrado && !i.tipoInvalido);
  const jaMigrados = itens.filter(i => i.jaMigrado);
  const invalidos = itens.filter(i => i.tipoInvalido);
  const outliers = itens.filter(i => i.foraDoEsperado);
  return { aMigrar, jaMigrados, invalidos, outliers };
}

function imprimirDryRun(itens) {
  const { aMigrar, jaMigrados, invalidos, outliers } = resumir(itens);
  console.log('\n========== DRY-RUN — Migração beneficios_fixos → 4 subcampos ==========');
  console.log(`Total de docs lidos: ${itens.length}`);

  const porColecao = new Map();
  for (const i of aMigrar) {
    const grupo = i.colecao;
    porColecao.set(grupo, (porColecao.get(grupo) ?? 0) + 1);
  }
  console.log('\nDocs A MIGRAR por coleção/período:');
  for (const k of [...porColecao.keys()].sort()) console.log(`  ${k.padEnd(24)} : ${porColecao.get(k)}`);
  console.log(`  ${'TOTAL a migrar'.padEnd(24)} : ${aMigrar.length}`);

  console.log(`\nJá migrados (pulados): ${jaMigrados.length}`);
  console.log(`Tipo inválido (não migra): ${invalidos.length}`);
  if (invalidos.length) for (const i of invalidos) console.log(`  ⚠ ${i.path} → beneficios_fixos = ${JSON.stringify(i.beneficios_fixos)}`);

  console.log('\nDecomposição que cada doc receberá (regra única: VA = total, demais 0):');
  const exemplos = new Map(); // valor -> qtd
  for (const i of aMigrar) exemplos.set(i.beneficios_fixos, (exemplos.get(i.beneficios_fixos) ?? 0) + 1);
  for (const [valor, qtd] of [...exemplos.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  beneficios_fixos=${String(valor).padStart(10)} → VA=${valor}, VT=0, PS=0, Outros=0   [${qtd} doc(s)]`);
  }

  console.log(`\n⚠ OUTLIERS (valor ≠ {0, 1426.83}) — visibilidade do CFO, mesma regra aplicada:`);
  if (!outliers.length) console.log('  (nenhum)');
  for (const i of outliers) {
    const tag = i.jaMigrado ? ' [já migrado]' : '';
    console.log(`  ${i.path} → beneficios_fixos = ${i.beneficios_fixos} → VA = ${i.beneficios_fixos}${tag}`);
  }

  console.log('\nNada foi escrito (dry-run). Rode com --apply após aprovação.');
}

/** Snapshot pré-write completo das 2 coleções para backups/firestore/. */
async function snapshot(db) {
  const dump = { geradoEm: new Date().toISOString(), colaboradores_base: [], fechamentos: [] };

  const baseSnap = await getDocs(collection(db, 'colaboradores_base'));
  for (const d of baseSnap.docs) dump.colaboradores_base.push({ path: d.ref.path, data: d.data() });

  const cgSnap = await getDocs(collectionGroup(db, 'colaboradores'));
  for (const d of cgSnap.docs) dump.fechamentos.push({ path: d.ref.path, data: d.data() });

  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `migracao-beneficios-pre-write-${ts}.json`);
  writeFileSync(path, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`[snapshot] ${dump.colaboradores_base.length} base + ${dump.fechamentos.length} fechamentos → ${path}`);
  return path;
}

/** Aplica os updates em lotes. batch.update falha atômico se algum doc sumiu. */
async function aplicar(db, aMigrar) {
  let gravados = 0;
  for (let i = 0; i < aMigrar.length; i += BATCH_LIMIT) {
    const chunk = aMigrar.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.update(item.ref, item.decomposicao); // payload SÓ os 4 subcampos
    }
    try {
      await batch.commit();
      gravados += chunk.length;
      console.log(`[apply] lote ${i / BATCH_LIMIT + 1}: ${chunk.length} docs gravados (acum. ${gravados})`);
    } catch (e) {
      console.error(`[apply] FALHA no lote iniciando em ${i} — interrompido. Doc inexistente?`, e);
      throw e;
    }
  }
  return gravados;
}

/** Re-lê todos os docs e valida invariante + custo intocado. */
async function validar(db, planoPreWrite) {
  const preCusto = new Map(planoPreWrite.map(i => [i.path, i.custo_total_mensal]));
  const itens = await montarPlano(db);
  let okInvariante = 0, falhasInvariante = [], falhasCusto = [], semSubcampos = [];

  for (const i of itens) {
    // 1) invariante soma === beneficios_fixos
    if (!i.jaMigrado) { semSubcampos.push(i.path); continue; }
    // re-lê os 4 do doc (montarItem só guarda beneficios_fixos/custo; pega data fresh)
    const fresh = (await getDoc(i.ref)).data();
    const soma = SUBCAMPOS.reduce((s, k) => s + (fresh[k] ?? 0), 0);
    if (Math.abs(soma - (i.beneficios_fixos ?? 0)) <= TOLERANCIA) okInvariante++;
    else falhasInvariante.push(`${i.path}: soma=${soma} ≠ beneficios_fixos=${i.beneficios_fixos}`);
    // 2) custo intocado
    const custoPre = preCusto.get(i.path);
    if (custoPre !== undefined && i.custo_total_mensal !== custoPre)
      falhasCusto.push(`${i.path}: custo ${custoPre} → ${i.custo_total_mensal}`);
  }

  console.log('\n========== VALIDAÇÃO PÓS-WRITE ==========');
  console.log(`Docs com invariante OK (soma === beneficios_fixos, tol ${TOLERANCIA}): ${okInvariante}/${itens.length}`);
  if (semSubcampos.length) console.log(`⚠ Docs ainda SEM os 4 subcampos (${semSubcampos.length}): ${semSubcampos.join(', ')}`);
  if (falhasInvariante.length) console.log(`❌ FALHAS de invariante (${falhasInvariante.length}):\n  ${falhasInvariante.join('\n  ')}`);
  if (falhasCusto.length) console.log(`❌ custo_total_mensal ALTERADO (${falhasCusto.length}):\n  ${falhasCusto.join('\n  ')}`);
  const ok = falhasInvariante.length === 0 && falhasCusto.length === 0 && semSubcampos.length === 0;
  console.log(ok ? '\n[OK] Validação 100% — invariante preservado, nenhum custo alterado.' : '\n[ATENÇÃO] Há divergências acima.');
  return ok;
}

async function main() {
  const db = initDb();
  const plano = await montarPlano(db);

  if (!APPLY) { imprimirDryRun(plano); return; }

  // APPLY: snapshot → writes → validação
  const { aMigrar } = resumir(plano);
  console.log(`\n========== APPLY — ${aMigrar.length} docs a migrar ==========`);
  await snapshot(db);
  const gravados = await aplicar(db, aMigrar);
  console.log(`\n[apply] concluído: ${gravados} docs gravados.`);
  await validar(db, plano);
}

main().then(() => { console.log('\n[FIM]'); process.exit(0); })
  .catch(e => { console.error('[ERRO FATAL]', e); process.exit(1); });
