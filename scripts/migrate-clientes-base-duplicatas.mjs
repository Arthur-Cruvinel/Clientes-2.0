// Fase C4 — Migração de duplicatas em clientes_base/.
// Renomeia documentos com slugs legacy para slugs canônicos derivados do
// nome completo, preservando todos os campos exceto nome_cliente. Adiciona
// campos de auditoria migrado_de/migrado_em_v2.
//
// REGRA INVIOLÁVEL — só toca clientes_base/. Não toca poupanca/, nem
// fechamentos/, nem mapeamento_siglas/. A inspeção C3 confirmou zero refs
// cruzadas para os 2 slugs aqui — caso contrário, esta migração seria
// insuficiente (faltaria atualizar nome_cliente nos refs).
//
// Pipeline por migração (sequencial):
//   1) Lê origem.        Skip se não existir.
//   2) Lê destino.       Aborta se já existir (não sobrescreve).
//   3) Snapshot origem.  Aborta se snapshot falhar.
//   4) Dry-run.          Mostra cada campo + alteração de nome_cliente.
//   5) Confirmação yes/no individual.
//   6) Cria destino + valida + deleta origem.

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { initDb, gravarMd } from './_helpers.mjs';

const MIGRACOES = [
  { slug_origem: 'kevin', slug_destino: 'kevin_santos_lopes',
    nome_canonico: 'KEVIN SANTOS LOPES', sigla_canonica: 'KSL' },
  { slug_origem: 'tamires', slug_destino: 'tamires_cassia_dias_de_britto',
    nome_canonico: 'TAMIRES CÁSSIA DIAS DE BRITTO', sigla_canonica: 'TCG' },
];

const ROOT = process.cwd();

function gravarSnapshot(nomeBase, dados) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `${nomeBase}-${ts}.json`);
  writeFileSync(path, JSON.stringify(dados, null, 2), 'utf8');
  return path;
}

async function confirmar(pergunta) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await rl.question(`${pergunta} [yes/no]: `);
  rl.close();
  return resposta.trim().toLowerCase() === 'yes';
}

/** Compara campos de origem vs destino exceto os listados em `exceto`.
 *  Devolve { ok, divergencias[] } — usado para validar pós-criação.
 *  JSON.stringify funciona bem para os tipos primitivos do Firestore aqui.
 *  Datas seriam um caso de borda — clientes_base não tem campos Timestamp. */
function validarPreservacao(origem, destino, exceto = ['nome_cliente']) {
  const div = [];
  for (const [k, v] of Object.entries(origem)) {
    if (exceto.includes(k)) continue;
    const w = destino[k];
    if (JSON.stringify(v) !== JSON.stringify(w)) {
      div.push({ campo: k, origem: v, destino: w });
    }
  }
  return { ok: div.length === 0, divergencias: div };
}

async function migrar(db, m, relatorio) {
  console.log(`\n[Migrate] === ${m.slug_origem} → ${m.slug_destino} ===`);
  const refOrigem = doc(db, 'clientes_base', m.slug_origem);
  const refDestino = doc(db, 'clientes_base', m.slug_destino);

  // 1) Lê origem.
  const snapOrigem = await getDoc(refOrigem);
  if (!snapOrigem.exists()) {
    console.warn(`[Migrate] Origem clientes_base/${m.slug_origem} não existe — pulando.`);
    relatorio.push({ ...m, status: 'pulado', motivo: 'origem não existe' });
    return;
  }
  const dadosOrigem = snapOrigem.data();
  const camposOrigem = Object.keys(dadosOrigem);
  console.log(`[Migrate] Origem lida: ${camposOrigem.length} campos`);

  // 2) Aborta se destino já existe.
  if ((await getDoc(refDestino)).exists()) {
    console.error(`[Migrate] ABORTANDO: clientes_base/${m.slug_destino} já existe — não sobrescrever.`);
    relatorio.push({ ...m, status: 'abortado', motivo: 'destino já existe' });
    return;
  }

  // 3) Snapshot.
  let pathSnap;
  try {
    pathSnap = gravarSnapshot(
      `clientes-base-migracao-${m.slug_origem}`,
      { docId: m.slug_origem, dados: dadosOrigem },
    );
    console.log(`[Migrate] Snapshot salvo em ${pathSnap}`);
  } catch (e) {
    console.error(`[Migrate] Falha ao gravar snapshot: ${e.message}`);
    relatorio.push({ ...m, status: 'abortado', motivo: 'falha no snapshot' });
    return;
  }

  // 4) Dry-run.
  console.log(`\n[Migrate] === DRY-RUN ===`);
  for (const [k, v] of Object.entries(dadosOrigem)) {
    if (k === 'nome_cliente') {
      console.log(`  ${k}: "${v}" → "${m.nome_canonico}" (ALTERADO)`);
    } else {
      console.log(`  ${k}: ${JSON.stringify(v)} (preservado)`);
    }
  }
  console.log(`  + migrado_de: "${m.slug_origem}" (NOVO — auditoria)`);
  console.log(`  + migrado_em_v2: <ISO timestamp> (NOVO — auditoria)`);

  // 5) Confirmação humana.
  const ok = await confirmar(`\nMigrar ${m.slug_origem} → ${m.slug_destino}?`);
  if (!ok) {
    console.log(`[Migrate] Cancelado pelo usuário.`);
    relatorio.push({ ...m, status: 'cancelado', motivo: 'confirmação negada' });
    return;
  }

  // 6) Construir doc destino. Spread copia todos os campos; depois
  //    sobrescrevemos nome_cliente e adicionamos auditoria.
  const dadosDestino = {
    ...dadosOrigem,
    nome_cliente: m.nome_canonico,
    migrado_de: m.slug_origem,
    migrado_em_v2: new Date().toISOString(),
  };

  // 6.1) Double-check destino (race entre check inicial e criação).
  if ((await getDoc(refDestino)).exists()) {
    console.error(`[Migrate] ABORTANDO double-check: destino apareceu entre check e create.`);
    relatorio.push({ ...m, status: 'abortado', motivo: 'destino apareceu (double-check)', snapshot: pathSnap });
    return;
  }

  // 6.2) Cria destino.
  await setDoc(refDestino, dadosDestino);
  console.log(`[Migrate] Criado: clientes_base/${m.slug_destino}`);

  // 6.3) Re-lê e valida campo a campo.
  const verify = await getDoc(refDestino);
  if (!verify.exists()) {
    console.error(`[Migrate] ERRO: destino não foi encontrado após setDoc — abortando, NÃO deletando origem.`);
    relatorio.push({ ...m, status: 'erro', motivo: 'destino sumiu após criação', snapshot: pathSnap });
    return;
  }
  const validacao = validarPreservacao(dadosOrigem, verify.data(), ['nome_cliente']);
  if (!validacao.ok) {
    console.error(`[Migrate] ERRO: validação falhou — ${validacao.divergencias.length} divergência(s):`);
    for (const d of validacao.divergencias) {
      console.error(`  - ${d.campo}: origem=${JSON.stringify(d.origem)} ≠ destino=${JSON.stringify(d.destino)}`);
    }
    console.error(`[Migrate] NÃO deletando origem. Intervenção humana necessária.`);
    relatorio.push({ ...m, status: 'erro', motivo: `validação pós-criação falhou (${validacao.divergencias.length} divergências)`, snapshot: pathSnap });
    return;
  }
  console.log(`[Migrate] Validação OK — ${camposOrigem.length} campo(s) preservados (exceto nome_cliente)`);

  // 6.4) Deleta origem.
  await deleteDoc(refOrigem);
  console.log(`[Migrate] Deletado: clientes_base/${m.slug_origem}`);

  relatorio.push({
    ...m, status: 'sucesso',
    campos_preservados: camposOrigem.length, snapshot: pathSnap,
  });
}

function montarRelatorio(relatorio) {
  const out = ['# Fase C4 — Migração Kevin/Tamires', '', `Gerado em ${new Date().toISOString()}`, ''];
  for (const r of relatorio) {
    out.push(`## ${r.slug_origem} → ${r.slug_destino}`, '');
    out.push(`- **Status**: ${r.status}`);
    if (r.motivo) out.push(`- **Motivo**: ${r.motivo}`);
    if (r.campos_preservados != null) out.push(`- **Campos preservados**: ${r.campos_preservados}`);
    if (r.snapshot) out.push(`- **Snapshot**: \`${r.snapshot}\``);
    out.push(`- Sigla canon: \`${r.sigla_canonica}\``);
    out.push(`- Nome canônico: \`${r.nome_canonico}\``, '');
  }
  return out.join('\n');
}

async function main() {
  const db = initDb();
  const relatorio = [];
  for (const m of MIGRACOES) {
    await migrar(db, m, relatorio);
  }
  const path = gravarMd('migracao', montarRelatorio(relatorio));
  console.log(`\n[Migrate] Relatório salvo em ${path}`);
  console.log(`[Migrate] Resumo: ${relatorio.map((r) => `${r.slug_origem}=${r.status}`).join(', ')}`);
}

main().catch((e) => {
  console.error('[Migrate] Erro fatal:', e);
  process.exit(1);
});
