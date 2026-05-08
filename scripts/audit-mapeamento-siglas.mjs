// Auditoria READ-ONLY de mapeamento_siglas/ no Firestore.
// Lista todas as entradas e marca suspeitas com base no SIGLA_PARA_NOME
// hardcoded (fonte de verdade canônica).
// Uso: node scripts/audit-mapeamento-siglas.mjs

import { collection, getDocs } from 'firebase/firestore';
import { initDb, carregarMapeamentos, gravarMd } from './_helpers.mjs';

const db = initDb();
const { siglaParaNome } = carregarMapeamentos();
console.log(`[Audit] SIGLA_PARA_NOME hardcoded: ${siglaParaNome.size} siglas`);

console.log('[Audit] Lendo mapeamento_siglas/...');
const snap = await getDocs(collection(db, 'mapeamento_siglas'));
console.log(`[Audit] Total de entradas: ${snap.size}`);

// Helpers de detecção de suspeita por substring no codigo OU nome.
function pertenceA(s, palavras) {
  const norm = (s ?? '').toUpperCase();
  return palavras.some(p => norm.includes(p.toUpperCase()));
}

const linhas = [];
let suspeitas = 0;

for (const d of snap.docs) {
  const x = d.data();
  const codigo = x.codigo ?? '';
  const sigla = x.sigla ?? '';
  const nome = x.nome_cliente ?? '';

  // Critérios de suspeita (acumula motivos, não exclusivos)
  const motivos = [];

  // (i) Sigla NÃO existe no SIGLA_PARA_NOME hardcoded — mapeia para destino
  // que ninguém reconhece como cliente válido.
  if (sigla && !siglaParaNome.has(sigla)) {
    motivos.push(`sigla "${sigla}" desconhecida`);
  }

  // (ii) Wenderson/Galeno em codigo ou nome → sigla deveria ser WRG.
  const ehWenderson = pertenceA(codigo, ['WENDERSON', 'GALENO'])
    || pertenceA(nome, ['WENDERSON', 'GALENO']);
  if (ehWenderson && sigla !== 'WRG') {
    motivos.push(`Wenderson/Galeno mas sigla=${sigla} (esperado WRG)`);
  }

  // (iii) MSAL ou códigos D47226006/TAW019408 → sigla deveria ser MLM.
  const ehMsal = pertenceA(codigo, ['MSAL', 'D47226006', 'TAW019408'])
    || pertenceA(nome, ['MSAL', 'D47226006', 'TAW019408']);
  if (ehMsal && sigla !== 'MLM') {
    motivos.push(`MSAL/D47.../TAW019408 mas sigla=${sigla} (esperado MLM)`);
  }

  if (motivos.length > 0) suspeitas++;

  linhas.push({
    docId: d.id,
    codigo,
    sigla,
    nome_cliente: nome,
    registrado_em: x.registrado_em ?? '',
    registrado_por: x.registrado_por ?? '',
    suspeita: motivos.length > 0 ? motivos.join(' · ') : '',
  });
}

// Ordena: suspeitas primeiro, depois por código
linhas.sort((a, b) => {
  if (a.suspeita && !b.suspeita) return -1;
  if (!a.suspeita && b.suspeita) return 1;
  return a.codigo.localeCompare(b.codigo);
});

const md = [
  `# Auditoria mapeamento_siglas/ — ${new Date().toISOString()}`,
  '',
  `- Total de entradas: **${snap.size}**`,
  `- Suspeitas: **${suspeitas}**`,
  `- Siglas canônicas (SIGLA_PARA_NOME hardcoded): ${siglaParaNome.size}`,
  '',
  '## Entradas (suspeitas no topo)',
  '',
  '| docId | codigo | sigla | nome_cliente | registrado_em | registrado_por | SUSPEITA |',
  '|---|---|---|---|---|---|---|',
  ...linhas.map(l => `| \`${l.docId}\` | \`${l.codigo}\` | ${l.sigla} | ${l.nome_cliente} | ${l.registrado_em} | ${l.registrado_por} | ${l.suspeita ? `**${l.suspeita}**` : ''} |`),
  '',
].join('\n');

const path = gravarMd('mapeamento', md);
console.log(`[Audit] Sumário: ${snap.size} entradas, ${suspeitas} suspeitas`);
console.log(`[Audit] Relatório salvo: ${path}`);
process.exit(0);
