// Limpeza dos órfãos RIA_BTG em poupanca/ — Caminho A confirmado pelo CFO.
//
// Passo 1 — reconfirmação LIVE + guard-rail de anomalia
// Passo 2 — snapshot prévio → deleteDoc → validação V1/V2/V3 → relatório
//
// Decisão registrada: lixo de teste, sem cliente real correspondente.
// Evidências em audit-results/diagnostico-orfaos-legados-poupanca-2026-05-14T21-21-43.md
// e no comentário do próprio cleanup-poupanca-fantasmas.mjs.
//
// Guard-rail: se algum doc RIA_BTG aparecer com |pl_onshore| > R$ 1.000 OU
// |aporte_mes_total| > R$ 1.000 OU pl_offshore_usd > 1.000, ABORTA — isso
// contradiria "lixo de teste" e exige consulta humana.
//
// Sem efeito colateral fora dos docs RIA_BTG. Sem toque em parsers/hooks.

import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initDb, slugDoDocId } from './_helpers.mjs';

const ROOT = process.cwd();
const SLUG_ALVO = 'ria_btg';

// V3 spot-check — clientes reais para confirmar imutabilidade.
const SPOT_CHECK_SLUGS = [
  'wenderson_galeno',
  'moises_lima_magalhaes',
  'ademilson_braga_bispo_junior',
];

// Guard-rail de anomalia: lixo de teste tem ping-pongue de centavos.
// Threshold em R$ 1.000 dá margem larga sem deixar passar valor material.
const LIMITE_ANOMALIA_BRL = 1000;
const LIMITE_ANOMALIA_USD = 1000;

function fmtBRL(v) {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

function gravarJson(nomeBase, dados) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `${nomeBase}-${ts}.json`);
  writeFileSync(path, JSON.stringify(dados, null, 2), 'utf8');
  return path;
}

function gravarMd(nomeBase, conteudo) {
  const dir = join(ROOT, 'audit-results');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `${nomeBase}-${ts}.md`);
  writeFileSync(path, conteudo, 'utf8');
  return path;
}

function contarPorSlug(docs, slugAlvo) {
  let n = 0;
  for (const d of docs) if (slugDoDocId(d.id) === slugAlvo) n++;
  return n;
}

async function main() {
  const db = initDb();

  // === PASSO 1 — Reconfirmação LIVE ===
  console.log('[Passo1] Lendo poupanca/ live...');
  const snapAntes = await getDocs(collection(db, 'poupanca'));
  const docsAntes = snapAntes.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }));
  const totalAntes = docsAntes.length;
  console.log(`[Passo1] Total LIVE: ${totalAntes} docs`);

  // Captura baselines V3 (contagem por slug real conhecido).
  const spotCheckAntes = {};
  for (const slug of SPOT_CHECK_SLUGS) {
    spotCheckAntes[slug] = contarPorSlug(docsAntes, slug);
  }
  console.log(`[Passo1] Baseline V3:`, spotCheckAntes);

  // Filtra alvos RIA_BTG.
  const alvos = docsAntes
    .filter(d => slugDoDocId(d.id) === SLUG_ALVO)
    .sort((a, b) => {
      const pa = (a.data.ano ?? 0) * 12 + (a.data.mes ?? 0);
      const pb = (b.data.ano ?? 0) * 12 + (b.data.mes ?? 0);
      return pa - pb;
    });

  console.log(`[Passo1] Alvos RIA_BTG encontrados: ${alvos.length}`);
  if (alvos.length === 0) {
    console.log('[Passo1] Nenhum doc RIA_BTG remanescente — nada a fazer.');
    return;
  }

  // Guard-rail de anomalia — bloqueia se algum doc tem valor material.
  const anomalias = [];
  for (const a of alvos) {
    const onshore = Math.abs(a.data.pl_onshore ?? 0);
    const aporte = Math.abs(a.data.aporte_mes_total ?? 0);
    const offshoreUsd = Math.abs(a.data.pl_offshore_usd ?? 0);
    const plTotal = Math.abs(a.data.pl_total ?? 0);
    const motivos = [];
    if (onshore > LIMITE_ANOMALIA_BRL) motivos.push(`pl_onshore=${fmtBRL(a.data.pl_onshore)}`);
    if (aporte > LIMITE_ANOMALIA_BRL) motivos.push(`aporte_mes_total=${fmtBRL(a.data.aporte_mes_total)}`);
    if (offshoreUsd > LIMITE_ANOMALIA_USD) motivos.push(`pl_offshore_usd=${offshoreUsd}`);
    if (plTotal > LIMITE_ANOMALIA_BRL) motivos.push(`pl_total=${fmtBRL(a.data.pl_total)}`);
    if (motivos.length > 0) anomalias.push({ id: a.id, motivos });
  }
  if (anomalias.length > 0) {
    console.error('\n[Passo1] ⛔ GUARD-RAIL DISPARADO — alvos com valores materiais:');
    for (const an of anomalias) console.error(`  - ${an.id}: ${an.motivos.join(', ')}`);
    console.error('\n[Passo1] ABORTANDO sem deletar nada. Consultar usuário.');
    process.exit(2);
  }

  // Lista final.
  console.log('\n[Passo1] === Lista final de docs a deletar ===');
  for (const a of alvos) {
    const periodo = `${a.data.ano}-${String(a.data.mes).padStart(2, '0')}`;
    console.log(`  - ${a.id} | ${periodo} | pl_onshore=${fmtBRL(a.data.pl_onshore)} | aporte=${fmtBRL(a.data.aporte_mes_total)}`);
  }
  console.log(`[Passo1] Total a deletar: ${alvos.length}\n`);

  // === PASSO 2 — Execução ===

  // 1) Snapshot prévio obrigatório.
  const dadosSnapshot = alvos.map(a => ({
    docId: a.id,
    path: `poupanca/${a.id}`,
    data: a.data,
  }));
  const pathSnap = gravarJson('poupanca-ria-btg-pre-delete', dadosSnapshot);
  console.log(`[Passo2] Snapshot prévio salvo: ${pathSnap}`);

  // 2) Deletes serializados — facilita rastreio + abort precoce em erro.
  const deletados = [];
  const erros = [];
  for (const a of alvos) {
    try {
      await deleteDoc(doc(db, 'poupanca', a.id));
      deletados.push(a.id);
      console.log(`[Passo2] ✓ Deletado: poupanca/${a.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erros.push({ id: a.id, erro: msg });
      console.error(`[Passo2] ✗ ERRO ao deletar ${a.id}: ${msg}`);
    }
  }

  // 3) Validação pós-delete — re-leitura completa.
  console.log('\n[Passo2] Re-lendo poupanca/ para validação...');
  const snapDepois = await getDocs(collection(db, 'poupanca'));
  const docsDepois = snapDepois.docs.map(d => ({ id: d.id, data: d.data() }));
  const totalDepois = docsDepois.length;

  // V1: nenhum ria_btg_*
  const remanescentes = docsDepois.filter(d => slugDoDocId(d.id) === SLUG_ALVO);
  const v1 = { ok: remanescentes.length === 0, encontrados: remanescentes.length, detalhe: remanescentes.map(d => d.id) };

  // V2: total = antes - deletados
  const v2 = {
    ok: totalDepois === (totalAntes - deletados.length),
    esperado: totalAntes - deletados.length,
    encontrado: totalDepois,
    delta: totalDepois - (totalAntes - deletados.length),
  };

  // V3: contagens spot-check imutáveis
  const spotCheckDepois = {};
  for (const slug of SPOT_CHECK_SLUGS) {
    spotCheckDepois[slug] = contarPorSlug(docsDepois, slug);
  }
  const v3Falhas = [];
  for (const slug of SPOT_CHECK_SLUGS) {
    if (spotCheckAntes[slug] !== spotCheckDepois[slug]) {
      v3Falhas.push({ slug, antes: spotCheckAntes[slug], depois: spotCheckDepois[slug] });
    }
  }
  const v3 = { ok: v3Falhas.length === 0, falhas: v3Falhas, antes: spotCheckAntes, depois: spotCheckDepois };

  // === Relatório final ===
  const validacoesOk = v1.ok && v2.ok && v3.ok && erros.length === 0;
  const md = [
    `# Cleanup órfãos legados RIA_BTG — ${new Date().toISOString()}`,
    '',
    `Decisão CFO: Caminho A — lixo de teste, deletar todos.`,
    `Escopo: 13 docs RIA_BTG em poupanca/ (slug do docId = "${SLUG_ALVO}").`,
    `Causa raiz NÃO corrigida nesta rodada — limpeza de legado apenas.`,
    '',
    '## Snapshot prévio',
    '',
    `\`${pathSnap}\``,
    '',
    '## Docs deletados',
    '',
    `Total: **${deletados.length}** de ${alvos.length} alvo(s)${erros.length > 0 ? ` (${erros.length} erro(s))` : ''}`,
    '',
    '| # | docId | período | pl_onshore | aporte_mes_total |',
    '|---|---|---|---:|---:|',
    ...alvos.map((a, i) => {
      const periodo = `${a.data.ano}-${String(a.data.mes).padStart(2, '0')}`;
      const status = deletados.includes(a.id) ? '✓' : '✗';
      return `| ${i + 1} ${status} | \`${a.id}\` | ${periodo} | ${fmtBRL(a.data.pl_onshore)} | ${fmtBRL(a.data.aporte_mes_total)} |`;
    }),
    '',
    erros.length > 0 ? `### Erros de deleção\n\n${erros.map(e => `- ${e.id}: ${e.erro}`).join('\n')}\n` : '',
    '## Validação pós-delete',
    '',
    `**V1 — Nenhum doc com slug \`${SLUG_ALVO}\` em poupanca/:** ${v1.ok ? '✓ OK' : `✗ FALHOU (${v1.encontrados} remanescente(s): ${v1.detalhe.join(', ')})`}`,
    '',
    `**V2 — Total de poupanca/ = antes (${totalAntes}) − deletados (${deletados.length}):** ${v2.ok ? `✓ OK (${totalDepois})` : `✗ FALHOU — esperado ${v2.esperado}, encontrado ${v2.encontrado}, delta ${v2.delta}`}`,
    '',
    `**V3 — Spot-check imutabilidade de clientes reais:** ${v3.ok ? '✓ OK' : '✗ FALHOU'}`,
    '',
    '| Slug | Antes | Depois | Status |',
    '|---|---:|---:|---|',
    ...SPOT_CHECK_SLUGS.map(slug => `| \`${slug}\` | ${v3.antes[slug]} | ${v3.depois[slug]} | ${v3.antes[slug] === v3.depois[slug] ? '✓' : '✗'} |`),
    '',
    '## Resumo',
    '',
    `- Total LIVE antes:  **${totalAntes}**`,
    `- Total LIVE depois: **${totalDepois}**`,
    `- Docs deletados:    **${deletados.length}**`,
    `- Erros:             **${erros.length}**`,
    `- V1: ${v1.ok ? '✓' : '✗'} · V2: ${v2.ok ? '✓' : '✗'} · V3: ${v3.ok ? '✓' : '✗'}`,
    '',
    validacoesOk
      ? '## LIMPEZA DO LEGADO CONCLUÍDA ✓'
      : '## ⚠ LIMPEZA INCOMPLETA — revisar falhas antes do commit',
    '',
    '## Notas',
    '',
    '- A constante `ESPERADOS = { ria_btg: 2 }` em `scripts/cleanup-poupanca-fantasmas.mjs` está desatualizada (eram 13 docs); cosmético, não corrigido nesta rodada.',
    '- MSAL e Wenderson fantasmas já haviam sido deletados em 10-mai (cleanup parcial). Esta rodada finaliza o legado.',
    '- Causa raiz dos órfãos (caminhos onshore single e multi-período ignorando `mapeamento_siglas/`) permanece. Documentado em `audit-results/diagnostico-sigla-orfa-poupanca-2026-05-14T20-39-04.md`. Correção estrutural fica para fase própria.',
    '',
  ].join('\n');

  const pathMd = gravarMd('cleanup-orfaos-legados-poupanca', md);
  console.log(`\n[Passo2] Relatório salvo: ${pathMd}`);

  console.log('\n=== RESUMO FINAL ===');
  console.log(`  V1 (sem RIA_BTG remanescente): ${v1.ok ? '✓ OK' : '✗ FALHOU'}`);
  console.log(`  V2 (total consistente): ${v2.ok ? '✓ OK' : '✗ FALHOU'}`);
  console.log(`  V3 (spot-check imutável): ${v3.ok ? '✓ OK' : '✗ FALHOU'}`);
  console.log(`  Status: ${validacoesOk ? 'LIMPEZA DO LEGADO CONCLUÍDA ✓' : '⚠ INCOMPLETA — revisar'}`);

  process.exit(validacoesOk ? 0 : 3);
}

main().catch((e) => {
  console.error('[Cleanup RIA_BTG] Erro fatal:', e);
  process.exit(1);
});
