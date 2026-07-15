// Dump READ-ONLY de coleções do Firestore para backups/firestore/.
// Nasceu do incidente de 2026-07-10 (re-fechamento do 2026-01 sem retrato prévio):
// PITR e backups agendados exigem billing (projeto no plano gratuito), então este
// dump local é o ÚNICO paraquedas. Rode ANTES de qualquer operação destrutiva
// (fechar/reabrir período, migração, cleanup).
//
// Uso:  node scripts/dump-firestore.mjs [rotulo]
// Grava um JSON por escopo: backups/firestore/<escopo>_<ISO>.json
// Formato: [{ docId, data }] — o mesmo dos dumps históricos (restauráveis).
//
// NENHUMA escrita no Firestore. Só leitura + arquivos locais.

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { collection, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const ROOT = process.cwd();
const DIR = join(ROOT, 'backups', 'firestore');
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const rotulo = process.argv[2] ? `${process.argv[2]}-` : '';

/** Escopos do retrato. Cada um vira um arquivo. */
const ESCOPOS = [
  { nome: 'clientes_base', path: ['clientes_base'] },
  { nome: 'periodos_status', path: ['periodos_status'] },
  { nome: 'consumo_juridico_meta', path: ['consumo_juridico'] },
  { nome: 'consumo_juridico_2026-06_clientes', path: ['consumo_juridico', '2026-06', 'clientes'] },
  { nome: 'mapeamento_monday', path: ['mapeamento_monday'] },
  // fechamentos/2026-01 — TODAS as subcoleções (o período congelado)
  { nome: 'fechamentos_2026-01_clientes', path: ['fechamentos', '2026-01', 'clientes'] },
  { nome: 'fechamentos_2026-01_colaboradores', path: ['fechamentos', '2026-01', 'colaboradores'] },
  { nome: 'fechamentos_2026-01_custosIndiretos', path: ['fechamentos', '2026-01', 'custosIndiretos'] },
  { nome: 'fechamentos_2026-01_custosDedicados', path: ['fechamentos', '2026-01', 'custosDedicados'] },
  { nome: 'fechamentos_2026-01_vinculos', path: ['fechamentos', '2026-01', 'vinculos'] },
];

const db = initDb();
mkdirSync(DIR, { recursive: true });

let totalDocs = 0, totalBytes = 0;
for (const e of ESCOPOS) {
  try {
    const snap = await getDocs(collection(db, ...e.path));
    const dump = snap.docs.map(d => ({ docId: d.id, data: d.data() }));
    const file = join(DIR, `${rotulo}${e.nome}_${TS}.json`);
    writeFileSync(file, JSON.stringify(dump, null, 2), 'utf8');
    const bytes = statSync(file).size;
    totalDocs += dump.length; totalBytes += bytes;
    console.log(`  ✓ ${String(dump.length).padStart(4)} docs · ${String(Math.round(bytes / 1024)).padStart(5)} KB · ${file.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
  } catch (err) {
    console.error(`  ✗ ${e.nome}: ${err?.message ?? err}`);
  }
}
console.log(`\nTOTAL: ${totalDocs} docs · ${(totalBytes / 1024 / 1024).toFixed(2)} MB · timestamp ${TS}`);
process.exit(0);
