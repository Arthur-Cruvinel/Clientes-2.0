// Fase B1 — Varredura das lâminas offshore (Galápagos Performance Report).
// READ-ONLY. Lê todos os PDFs em ../dados/laminas offshore/, extrai texto
// via pdfjs-dist e identifica os HOLDING ACCOUNTs (nomes de cliente) que
// aparecem na tabela "Assets by Account".
//
// Saídas:
//   1) audit-results/dump-laminas-{ts}.txt — texto bruto da seção
//      Assets by Account de cada PDF (para auditoria visual).
//   2) audit-results/variantes-{ts}.md — tabela de revisão Fase B2
//      comparando nomes encontrados com chaves de MAPEAMENTO_SIGLAS.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { gravarMd } from './_helpers.mjs';

const ROOT = process.cwd();
const REPO_ROOT = join(ROOT, '..');
const LAMINAS_DIR = join(REPO_ROOT, 'dados', 'laminas offshore');

/** Parse local do MAPEAMENTO_SIGLAS.ts — variante do helper genérico que
 *  funciona com a estrutura atual do arquivo (fecha com `};` simples, não
 *  `} as const`). Mantenho local para não modificar `_helpers.mjs`, que
 *  é usado por outros scripts da Fase A. */
function carregarMapeamentoLocal() {
  const txt = readFileSync(
    join(ROOT, 'src/features/poupanca/import/MAPEAMENTO_SIGLAS.ts'),
    'utf8',
  );
  // MAPEAMENTO_SIGLAS: do `= {` até o `\n};` que fecha. Não-guloso para
  // não capturar o bloco SIGLA_PARA_NOME que vem depois.
  const blocoMap = txt.match(/MAPEAMENTO_SIGLAS[^=]*=\s*\{([\s\S]*?)\n\};/);
  const mapeamento = new Map();
  if (blocoMap) {
    // Aceita siglas de qualquer tamanho (>=2 chars uppercase + dígitos/_).
    const re = /'([^']+)':\s*'([A-Z][A-Z0-9_]*)'/g;
    let m;
    while ((m = re.exec(blocoMap[1])) !== null) mapeamento.set(m[1], m[2]);
  }
  // SIGLA_PARA_NOME: idêntico, para sabermos quais siglas já existem.
  const blocoNome = txt.match(/SIGLA_PARA_NOME[^=]*=\s*\{([\s\S]*?)\n\};/);
  const siglaParaNome = new Map();
  if (blocoNome) {
    const re = /'([A-Z][A-Z0-9_]*)':\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(blocoNome[1])) !== null) siglaParaNome.set(m[1], m[2]);
  }
  return { mapeamento, siglaParaNome };
}

/** Extrai texto cru do PDF, página por página. */
async function extrairTexto(pdfPath) {
  const data = new Uint8Array(readFileSync(pdfPath));
  const pdf = await getDocument({ data }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const texto = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .trim();
    if (texto) paginas.push(texto);
  }
  return paginas.join('\n');
}

/** Recorta a seção "Assets by Account" do texto cru. Devolve fragmento ou
 *  string vazia se não encontrar. */
function recortarAssetsByAccount(texto) {
  const idx = texto.indexOf('Assets by Account');
  if (idx === -1) return '';
  // Próxima seção típica: "Account performance" ou "Performance by Account"
  const candidatos = ['Account performance', 'Performance by Account', 'Asset Allocation'];
  let fim = texto.length;
  for (const c of candidatos) {
    const j = texto.indexOf(c, idx + 20);
    if (j !== -1 && j < fim) fim = j;
  }
  return texto.slice(idx, fim);
}

/** Heurística: nomes de cliente vêm seguidos de um código entre parênteses.
 *  Padrão: "<Nome do Cliente> (CÓDIGO) ..."
 *  Captura o nome (pode conter espaços, pontos, hífens) e o código.
 *  Exemplo: "Moises Lima Magalhaes (D47226006)" → ["Moises Lima Magalhaes", "D47226006"] */
function extrairNomes(fragmento) {
  // Permite letras Unicode, espaços, pontos, hífens, vírgulas no nome.
  // Código: alfanumérico, 5+ caracteres entre parênteses.
  const re = /([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s\.\-,]{3,80}?)\s*\(([A-Z0-9]{5,})\)/g;
  const achados = new Map(); // nome → Set(códigos)
  let m;
  while ((m = re.exec(fragmento)) !== null) {
    const nome = m[1].trim().replace(/\s+/g, ' ');
    const codigo = m[2];
    if (!achados.has(nome)) achados.set(nome, new Set());
    achados.get(nome).add(codigo);
  }
  return achados;
}

/** Sugere sigla canon para um nome com base em substrings inequívocas. */
function sugerirSigla(nome, mapeamento) {
  // Match exato primeiro (case-sensitive como o resolverSigla usa)
  if (mapeamento.has(nome)) {
    return { sigla: mapeamento.get(nome), motivo: 'match exato em MAPEAMENTO_SIGLAS' };
  }
  // Heurísticas por substring (case-insensitive)
  const lower = nome.toLowerCase();
  const dicas = [
    { teste: /galeno|wenderson/, sigla: 'WRG', motivo: 'substring "Galeno"/"Wenderson"' },
    { teste: /msal/, sigla: 'MLM', motivo: 'substring "MSAL" (Moises Lima Magalhaes)' },
    { teste: /moises lima|moisés lima/, sigla: 'MLM', motivo: 'substring "Moises Lima"' },
    { teste: /krug guedes|roger krug/, sigla: 'RKG', motivo: 'substring "Krug Guedes"' },
    { teste: /pipino/, sigla: 'GPI', motivo: 'substring "Pipino" (sigla NOVA — adicionar em SIGLA_PARA_NOME)' },
    { teste: /gabriel fernando de jesus|gabriel.*jesus/, sigla: 'GFJ', motivo: 'substring "Gabriel Fernando de Jesus"' },
  ];
  for (const d of dicas) {
    if (d.teste.test(lower)) return { sigla: d.sigla, motivo: d.motivo };
  }
  return { sigla: null, motivo: 'AÇÃO HUMANA NECESSÁRIA' };
}

async function main() {
  const arquivos = readdirSync(LAMINAS_DIR).filter((f) => f.endsWith('.pdf'));
  console.log(`[Inspect] ${arquivos.length} PDFs em ${LAMINAS_DIR}`);

  // Acumular tudo cross-PDF para deduplicar.
  const nomesGlobais = new Map(); // nome → { codigos: Set, fontes: Set<arquivo> }
  const dumps = [];

  for (const arq of arquivos) {
    const path = join(LAMINAS_DIR, arq);
    console.log(`[Inspect] Lendo ${arq}...`);
    const texto = await extrairTexto(path);
    const fragmento = recortarAssetsByAccount(texto);
    if (!fragmento) {
      console.log(`[Inspect]   Não encontrou "Assets by Account" — pulando`);
      continue;
    }
    dumps.push(`\n=== ${arq} ===\n${fragmento.slice(0, 8000)}\n`);
    const achados = extrairNomes(fragmento);
    console.log(`[Inspect]   ${achados.size} nomes únicos encontrados`);
    for (const [nome, codigos] of achados) {
      if (!nomesGlobais.has(nome)) {
        nomesGlobais.set(nome, { codigos: new Set(), fontes: new Set() });
      }
      const entrada = nomesGlobais.get(nome);
      for (const c of codigos) entrada.codigos.add(c);
      entrada.fontes.add(arq);
    }
  }

  console.log(`[Inspect] ${nomesGlobais.size} nomes únicos cross-PDFs`);

  // Carregar MAPEAMENTO_SIGLAS atual via parse local (helper tem regex
  // que exige `as const`, ausente neste arquivo — ver função acima).
  const { mapeamento, siglaParaNome } = carregarMapeamentoLocal();
  console.log(`[Inspect] MAPEAMENTO_SIGLAS carregado: ${mapeamento.size} entradas`);
  console.log(`[Inspect] SIGLA_PARA_NOME carregado: ${siglaParaNome.size} entradas`);

  // Montar tabela B2.
  const linhas = [];
  linhas.push('# Fase B2 — Variantes encontradas nas lâminas offshore');
  linhas.push('');
  linhas.push(`Gerado em ${new Date().toISOString()}.`);
  linhas.push('');
  linhas.push(`Lâminas processadas: ${arquivos.length}`);
  linhas.push(`Nomes únicos extraídos: ${nomesGlobais.size}`);
  linhas.push('');
  linhas.push('| Nome encontrado | Códigos | Fontes (PDF) | Já mapeado? | Sigla canon | Sigla proposta | Motivo |');
  linhas.push('|---|---|---|---|---|---|---|');

  // Ordenar por nome para leitura humana.
  const ordenados = [...nomesGlobais.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [nome, info] of ordenados) {
    const codigos = [...info.codigos].join(', ') || '—';
    const fontes = [...info.fontes].map((f) => f.match(/(\d{2}-\d{2}-\d{4})/)?.[1] ?? f).join(', ');
    const jaMapeado = mapeamento.has(nome) ? '✓' : '✗';
    const siglaExistente = mapeamento.get(nome) ?? '—';
    const sugestao = sugerirSigla(nome, mapeamento);
    const proposta = jaMapeado === '✓' ? '(sem ação)' : (sugestao.sigla ?? '**AÇÃO HUMANA**');
    linhas.push(
      `| ${nome} | ${codigos} | ${fontes} | ${jaMapeado} | ${siglaExistente} | ${proposta} | ${sugestao.motivo} |`,
    );
  }

  linhas.push('');
  linhas.push('## Notas de revisão');
  linhas.push('');
  linhas.push('- Coluna "Sigla proposta" é apenas sugestão heurística; revisar antes de aprovar.');
  linhas.push('- Linhas com `(sem ação)` já estão em MAPEAMENTO_SIGLAS — não precisam de diff.');
  linhas.push('- Linhas com `**AÇÃO HUMANA**` precisam de decisão manual (cliente desconhecido ou ambíguo).');
  linhas.push('- Sigla `GPI` (Gabriel Pipino) é NOVA — exige adicionar em `SIGLA_PARA_NOME` antes do diff em `MAPEAMENTO_SIGLAS`.');

  const pathMd = gravarMd('variantes', linhas.join('\n'));
  console.log(`[Inspect] Tabela salva em ${pathMd}`);

  // Dump bruto pra auditoria visual.
  const pathDump = gravarMd('dump-laminas', dumps.join('\n').replace(/```/g, '\\`\\`\\`'));
  console.log(`[Inspect] Dump bruto salvo em ${pathDump}`);
}

main().catch((e) => {
  console.error('[Inspect] Erro:', e);
  process.exit(1);
});
