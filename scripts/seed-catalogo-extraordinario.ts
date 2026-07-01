// Seed dos TEXTOS-PADRÃO do catálogo de extraordinários em parametros/global.
// Fonte VERSIONADA e verbatim: docs/catalogo-extraordinario-textos.md.
// Escreve SÓ os 4 campos de texto por tipo (descricao/prazo/dependencias/ressalvas
// _padrao) em parametros.extraordinario[tipo], PRESERVANDO as faixas (read-modify-
// write). Idempotente — re-rodar produz o mesmo estado. NÃO toca fechamentos/.
//
// Rodar:  npx tsx scripts/seed-catalogo-extraordinario.ts [--dry]
//   --dry  → só parseia e mostra o que gravaria, sem escrever.
//
// Init do Firestore via .env (mesmo padrão de scripts/frente1-snapshot.ts).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { PARAMETROS_DEFAULT } from '../src/utils/constants';

const DRY = process.argv.includes('--dry');
const ROOT = process.cwd();
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID,
});
const db = initializeFirestore(app, { experimentalForceLongPolling: true, ignoreUndefinedProperties: true });

// ── Parser do .md ────────────────────────────────────────────────────────────
// Só as 4 chaves a seguir, no INÍCIO da linha, delimitam campo. Colons internos
// ("compreende:", "Base de cálculo:") não são chaves → ficam no valor. Linhas
// que não são chave nem cabeçalho são continuação (join por espaço).
const CHAVES = ['descricao', 'prazo', 'dependencias', 'ressalvas'] as const;
type Chave = typeof CHAVES[number];
const CAMPO_PADRAO: Record<Chave, string> = {
  descricao: 'descricao_padrao', prazo: 'prazo_padrao',
  dependencias: 'dependencias_padrao', ressalvas: 'ressalvas_padrao',
};

function parseTextos(md: string): Record<string, Record<Chave, string>> {
  const out: Record<string, Record<Chave, string>> = {};
  let tipo: string | null = null;
  let chave: Chave | null = null;
  const reTipo = /^##\s+(\S+)\s*$/;
  const reChave = new RegExp(`^(${CHAVES.join('|')}):\\s?(.*)$`);
  for (const raw of md.split('\n')) {
    const linha = raw.replace(/\r$/, '');
    const mT = linha.match(reTipo);
    if (mT) { tipo = mT[1]; out[tipo] = { descricao: '', prazo: '', dependencias: '', ressalvas: '' }; chave = null; continue; }
    if (!tipo) continue;                                  // ignora título/intro antes do 1º ##
    const mC = linha.match(reChave);
    if (mC) { chave = mC[1] as Chave; out[tipo][chave] = mC[2].trim(); continue; }
    if (chave && linha.trim()) {                          // continuação do campo atual
      out[tipo][chave] = (out[tipo][chave] + ' ' + linha.trim()).trim();
    }
  }
  // "(vazio)" → string vazia
  for (const t of Object.keys(out)) for (const k of CHAVES) if (out[t][k] === '(vazio)') out[t][k] = '';
  return out;
}

async function main() {
  const md = readFileSync(join(ROOT, 'docs', 'catalogo-extraordinario-textos.md'), 'utf8');
  const textos = parseTextos(md);
  const tipos = Object.keys(textos);
  console.log(`[seed] ${tipos.length} tipos lidos de docs/catalogo-extraordinario-textos.md: ${tipos.join(', ')}\n`);

  const ref = doc(db, 'parametros', 'global');
  const snap = await getDoc(ref);
  const atual: any = snap.exists() ? snap.data() : {};
  const extAtual: Record<string, any> = { ...(atual.extraordinario ?? {}) };

  const extNovo: Record<string, any> = { ...extAtual };
  for (const tipo of tipos) {
    // Base: faixa existente OU default (preserva faixa_min/max/clausula_*).
    const base = extAtual[tipo] ?? (PARAMETROS_DEFAULT as any).extraordinario?.[tipo] ?? {};
    const t = textos[tipo];
    extNovo[tipo] = {
      ...base,
      [CAMPO_PADRAO.descricao]: t.descricao,
      [CAMPO_PADRAO.prazo]: t.prazo,
      [CAMPO_PADRAO.dependencias]: t.dependencias,
      [CAMPO_PADRAO.ressalvas]: t.ressalvas,
    };
    const prev = extAtual[tipo] ?? {};
    const mudou = ['descricao_padrao', 'prazo_padrao', 'dependencias_padrao', 'ressalvas_padrao']
      .some(c => (prev[c] ?? '') !== extNovo[tipo][c]);
    console.log(`  ${tipo}: ${mudou ? 'ATUALIZA' : 'já igual'} · descr ${t.descricao.length}c · prazo ${t.prazo.length}c · dep ${t.dependencias.length}c · ressalvas ${t.ressalvas.length}c`);
  }

  if (DRY) { console.log('\n[seed] --dry: nada escrito.'); process.exit(0); }

  await setDoc(ref, { extraordinario: extNovo }, { merge: true });
  console.log('\n[seed] gravado em parametros/global (merge). Verificando…');
  const check: any = (await getDoc(ref)).data();
  const ok = tipos.every(t => (check.extraordinario?.[t]?.descricao_padrao ?? '') === textos[t].descricao);
  console.log(`[seed] verificação: ${ok ? 'OK — descrições conferem' : 'FALHOU'}`);
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('[seed] erro:', e); process.exit(1); });
