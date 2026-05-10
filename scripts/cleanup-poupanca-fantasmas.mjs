// Fase C2 — Limpeza de poupanca/ no Firestore (clientes-fantasma).
// Deleta documentos cujo slug do docId é um dos 3 confirmados pela A2:
//   - msal_investments_limited           (1 doc — dados pertencem a MLM)
//   - wenderson_r_do_nascimento_galeno   (4 docs — dados pertencem a WRG)
//   - ria_btg                            (2 docs — lixo de teste)
// Total esperado: 7 documentos.
//
// Pipeline:
//   1) Lê coleção poupanca/ completa.
//   2) Filtra docs cujo slug bate com um dos 3 alvos (qualquer ano-mês).
//   3) Snapshot completo dos docs identificados em backups/firestore/
//   4) Dry-run com docId, nome_cliente, ano-mês, valores principais.
//   5) Confirmação yes/no no terminal.
//   6) Se yes: deleta um a um, logando com [Cleanup].

import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { initDb, slugDoDocId } from './_helpers.mjs';

const ROOT = process.cwd();

const SLUGS_FANTASMA = new Set([
  'msal_investments_limited',
  'wenderson_r_do_nascimento_galeno',
  'ria_btg',
]);

const ESPERADOS = { msal_investments_limited: 1, wenderson_r_do_nascimento_galeno: 4, ria_btg: 2 };

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

function fmtBRL(v) {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

async function main() {
  const db = initDb();

  // 1) Lê coleção poupanca/ completa.
  console.log('[Cleanup] Lendo poupanca/ completo...');
  const snap = await getDocs(collection(db, 'poupanca'));
  console.log(`[Cleanup] ${snap.size} documentos lidos`);

  // 2) Filtra fantasmas.
  const alvos = [];
  for (const d of snap.docs) {
    const slug = slugDoDocId(d.id);
    if (SLUGS_FANTASMA.has(slug)) {
      alvos.push({ id: d.id, slug, ...d.data() });
    }
  }

  // Sanity check — bate com totais esperados pela A2?
  const contagem = {};
  for (const a of alvos) contagem[a.slug] = (contagem[a.slug] ?? 0) + 1;
  console.log('\n[Cleanup] === Contagem por slug (esperado vs encontrado) ===');
  for (const slug of SLUGS_FANTASMA) {
    const ach = contagem[slug] ?? 0;
    const esp = ESPERADOS[slug];
    const ok = ach === esp ? '✓' : '⚠';
    console.log(`  ${ok} ${slug}: encontrado ${ach}, esperado ${esp}`);
  }

  if (alvos.length === 0) {
    console.log('[Cleanup] Nenhum fantasma encontrado — nada a fazer. Saindo.');
    return;
  }

  // 3) Snapshot dos alvos.
  const pathSnap = gravarSnapshot('poupanca-fantasmas', alvos);
  console.log(`\n[Cleanup] Snapshot salvo em ${pathSnap}`);

  // 4) Dry-run — mostra metadados e valores principais.
  console.log('\n[Cleanup] === DRY-RUN — fantasmas identificados ===');
  for (const a of alvos) {
    const periodo = `${a.ano}-${String(a.mes).padStart(2, '0')}`;
    console.log(`\n  docId: ${a.id}`);
    console.log(`    slug:           ${a.slug}`);
    console.log(`    nome_cliente:   ${a.nome_cliente ?? '—'}`);
    console.log(`    período:        ${periodo}`);
    console.log(`    pl_total:       ${fmtBRL(a.pl_total)}`);
    console.log(`    aporte_mes:     ${fmtBRL(a.aporte_mes_total)}`);
  }
  console.log(`\n[Cleanup] Total a deletar: ${alvos.length} documentos`);

  // 5) Confirmação humana.
  const ok = await confirmar('\nConfirma a deleção destes documentos?');
  if (!ok) {
    console.log('[Cleanup] Cancelado pelo usuário. Nenhuma deleção feita.');
    return;
  }

  // 6) Deletes serializados.
  for (const a of alvos) {
    await deleteDoc(doc(db, 'poupanca', a.id));
    console.log(`[Cleanup] Deletado: poupanca/${a.id}`);
  }
  console.log(`\n[Cleanup] Concluído — ${alvos.length} documentos deletados.`);
  console.log(`[Cleanup] Snapshot de restauração: ${pathSnap}`);
}

main().catch((e) => {
  console.error('[Cleanup] Erro fatal:', e);
  process.exit(1);
});
