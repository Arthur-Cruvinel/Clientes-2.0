// Helpers compartilhados pelos scripts de auditoria.
// READ-ONLY — nenhum write Firestore aqui. Cada script auditor importa o
// que precisa: init Firebase, parse de SIGLA_PARA_NOME (texto), slugify,
// gravação de markdown.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const ROOT = process.cwd();

/** Carrega .env do projeto manualmente (sem dotenv pra não adicionar dep). */
function carregarEnv() {
  const txt = readFileSync(join(ROOT, '.env'), 'utf8');
  return Object.fromEntries(
    txt.split('\n').filter(l => l.includes('=')).map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
  );
}

/** Inicializa Firestore com long polling (proxy corporativo). */
export function initDb() {
  const env = carregarEnv();
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  return initializeFirestore(app, { experimentalForceLongPolling: true });
}

/** Parse "leve" do MAPEAMENTO_SIGLAS.ts via regex.
 *  Usado em vez de import .ts para rodar com Node nativo (sem tsx).
 *  Frágil para reformatações grandes do arquivo, suficiente para extrair
 *  pares 'chave': 'sigla'. Mantém fonte única de verdade. */
export function carregarMapeamentos() {
  const txt = readFileSync(
    join(ROOT, 'src/features/poupanca/import/MAPEAMENTO_SIGLAS.ts'),
    'utf8',
  );

  // Bloco SIGLA_PARA_NOME — chaves são siglas curtas (UPPER + underscore + dígitos)
  const blocoNome = txt.match(/SIGLA_PARA_NOME[^=]*=\s*\{([\s\S]*?)\n\}/);
  const siglaParaNome = new Map();
  if (blocoNome) {
    const re = /'([A-Z][A-Z0-9_]*)':\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(blocoNome[1])) !== null) siglaParaNome.set(m[1], m[2]);
  }

  // Bloco MAPEAMENTO_SIGLAS — chaves são códigos brutos (qualquer string)
  const blocoMap = txt.match(/MAPEAMENTO_SIGLAS[^=]*=\s*\{([\s\S]*?)\n\} as const/);
  const mapeamento = new Map();
  if (blocoMap) {
    const re = /'([^']+)':\s*'([A-Z][A-Z0-9_]*)'/g;
    let m;
    while ((m = re.exec(blocoMap[1])) !== null) mapeamento.set(m[1], m[2]);
  }

  return { siglaParaNome, mapeamento };
}

/** Mesma função de useImportPoupanca.ts:43-46 (slug do docId em poupanca/). */
export function slugify(nome) {
  return (nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/** Extrai slug do docId no formato {slug}_{ano}_{mes}. */
export function slugDoDocId(docId) {
  const m = docId.match(/^(.+?)_(\d{4})_(\d{1,2})$/);
  return m ? m[1] : docId;
}

/** Garante audit-results/ e grava arquivo. Retorna o caminho final. */
export function gravarMd(nomeBase, conteudo) {
  const dir = join(ROOT, 'audit-results');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `${nomeBase}-${ts}.md`);
  writeFileSync(path, conteudo, 'utf8');
  return path;
}

/** Conjunto de slugs derivados das siglas conhecidas (canônicos). */
export function slugsCanonicos(siglaParaNome) {
  const set = new Set();
  for (const nome of siglaParaNome.values()) set.add(slugify(nome));
  return set;
}
