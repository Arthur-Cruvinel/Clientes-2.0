// Complementação de vínculos — Etapa 1: Diagnóstico READ-ONLY.
// Extensão da Fase 2.5 Peça 2. Identifica funções com colaborador no campo
// legado mas SEM vínculo correspondente em fechamentos/{periodo}/vinculos/.
//
// Lê o campo de função de DUAS fontes e reporta o gap em cada uma:
//   A) fechamentos/{periodo}/clientes/  (snapshot do período — o que a
//      migração original usou e o que o pipeline lê per-período)
//   B) clientes_base/                   (cadastro mestre — o que a UI edita)
// A divergência entre A e B é a causa-raiz do caso RONALD.
// Nenhum write. Apenas relatório.

import { collection, getDocs } from 'firebase/firestore';
import { initDb, slugify } from './_helpers.mjs';

const PERIODOS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
const FUNCOES = ['consultoria_gestao', 'consultoria_planejamento', 'consultoria_financeira', 'operacional_financeiro', 'serv_adm', 'serv_aux_adm'];
const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const db = initDb();

// ===== Resolução de colaborador (mesma da Peça 2) =====
const colabSnap = await getDocs(collection(db, 'colaboradores_base'));
const colabsBase = colabSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
const colabPorNomeNorm = new Map();
for (const c of colabsBase) colabPorNomeNorm.set(norm(c.nome_colaborador), c);

const cintia = colabPorNomeNorm.get('cintia de jesus alves');
const RESOLUCAO_MANUAL = {
  'flavia santos': { tipo: 'manual', docId: 'flavia_santos_romeu', nome: 'Flávia Santos Romeu', id_estavel: 'a063e11b-b8dd-4c4a-868c-f15289e5919c' },
  'cintia alves':  { tipo: 'manual', docId: 'cintia_de_jesus_alves', nome: 'Cintia De Jesus Alves', id_estavel: cintia?.id_estavel },
  'luiz nerone':   { tipo: 'manual', docId: 'luis_eduardo_nerone', nome: 'Luis Eduardo Nerone', id_estavel: 'ac6922ca-d464-4743-b125-51e8d0ec26c1' },
  'lucas silva':   { tipo: 'manual', docId: 'lucas_henrique', nome: 'Lucas Henrique', id_estavel: 'a5a8437d-6bd3-47f4-bd7a-8fd925fe6595' },
  'vinicius rodrigues': { tipo: 'manual', docId: 'vinicius_rodrigues_ex', nome: 'Vinicius Rodrigues (ex-funcionário)', id_estavel: 'vinicius_rodrigues_ex' },
};

function resolverNome(nome) {
  if (!nome) return null;
  const n = norm(nome);
  if (RESOLUCAO_MANUAL[n]) return { ...RESOLUCAO_MANUAL[n], slug: RESOLUCAO_MANUAL[n].docId };
  const canon = colabPorNomeNorm.get(n);
  if (canon) return { tipo: 'canonico', docId: canon.docId, slug: canon.docId, nome: canon.nome_colaborador, id_estavel: canon.id_estavel };
  return { tipo: 'nao_resolvido', docId: 'nao_resolvido_' + slugify(nome), nome, id_estavel: 'nao_resolvido_' + slugify(nome) };
}

// ===== clientes_base por id_estavel (fonte B) =====
const cliBaseSnap = await getDocs(collection(db, 'clientes_base'));
const cliBaseDocs = cliBaseSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
const cliBasePorIdEstavel = new Map(cliBaseDocs.filter(c => c.id_estavel).map(c => [c.id_estavel, c]));

// Carrega vínculos + clientes do período uma vez
const dadosPeriodo = {};
for (const p of PERIODOS) {
  const vincSnap = await getDocs(collection(db, 'fechamentos', p, 'vinculos'));
  const vincSet = new Set(vincSnap.docs.map(d => {
    const v = d.data();
    return `${v.id_estavel_cliente}|${v.funcao}`;
  }));
  const cliSnap = await getDocs(collection(db, 'fechamentos', p, 'clientes'));
  const clientesPeriodo = cliSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
  dadosPeriodo[p] = { vincSet, vincTotal: vincSnap.size, clientesPeriodo };
}

// ---- Função que computa faltantes dado um resolvedor de "campos de função" ----
function rodar(fonteLabel, getCliFuncaoFonte) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FONTE = ${fonteLabel}`);
  console.log('='.repeat(70));

  const naoResolviveisGlobais = new Map();
  let somaFaltantesResolviveis = 0;
  let somaFaltantesNaoResolviveis = 0;
  const ronaldFaltantes2604 = [];

  for (const p of PERIODOS) {
    const { vincSet, clientesPeriodo } = dadosPeriodo[p];
    let faltantesResolviveis = 0;
    let faltantesNaoResolviveis = 0;
    const porFuncao = {};

    for (const cliPeriodo of clientesPeriodo) {
      if (cliPeriodo.pacote_servico === 'asset_only') continue;
      const idEst = cliPeriodo.id_estavel;
      if (!idEst) continue;

      // Campos de função vêm da fonte escolhida (snapshot ou base)
      const funcCampos = getCliFuncaoFonte(cliPeriodo, idEst);
      if (!funcCampos) continue;

      for (const f of FUNCOES) {
        const nome = funcCampos[f];
        if (!nome || !String(nome).trim()) continue;
        const chave = `${idEst}|${f}`;
        if (vincSet.has(chave)) continue; // já tem vínculo
        // FALTANTE
        const r = resolverNome(nome);
        porFuncao[f] = (porFuncao[f] ?? 0) + 1;
        if (r.tipo === 'nao_resolvido') {
          faltantesNaoResolviveis++;
          naoResolviveisGlobais.set(nome, (naoResolviveisGlobais.get(nome) ?? 0) + 1);
        } else {
          faltantesResolviveis++;
        }
        if (p === '2026-04' && (cliPeriodo.nome_cliente ?? '').toUpperCase().includes('RONALD DOMINGUES')) {
          ronaldFaltantes2604.push({ funcao: f, nome, resolucao: r.tipo, nomeCanon: r.nome });
        }
      }
    }

    somaFaltantesResolviveis += faltantesResolviveis;
    somaFaltantesNaoResolviveis += faltantesNaoResolviveis;
    const tot = faltantesResolviveis + faltantesNaoResolviveis;
    console.log(`\n  ${p}: vínculos atuais=${dadosPeriodo[p].vincTotal} | faltantes=${tot} (resolvíveis=${faltantesResolviveis}, não-resolvíveis=${faltantesNaoResolviveis})`);
    for (const [f, n] of Object.entries(porFuncao)) console.log(`     ${f}: ${n}`);
  }

  console.log(`\n  >>> TOTAL FALTANTES (${fonteLabel}): ${somaFaltantesResolviveis + somaFaltantesNaoResolviveis}`);
  console.log(`      resolvíveis=${somaFaltantesResolviveis} | não-resolvíveis=${somaFaltantesNaoResolviveis}`);
  if (naoResolviveisGlobais.size === 0) {
    console.log('      Nomes não-resolvíveis: NENHUM ✓');
  } else {
    console.log('      Nomes não-resolvíveis (serão saneados pelo mapa manual se cobertos):');
    for (const [nome, n] of naoResolviveisGlobais) {
      const coberto = RESOLUCAO_MANUAL[norm(nome)] ? '✓ mapa manual' : '✗ SEM mapa';
      console.log(`        "${nome}" (${n}x) — ${coberto}`);
    }
  }
  console.log(`\n  RONALD DOMINGUES — faltantes em 2026-04 (${fonteLabel}): ${ronaldFaltantes2604.length}`);
  for (const r of ronaldFaltantes2604) console.log(`     ${r.funcao} ← "${r.nome}" (${r.resolucao}${r.nomeCanon && r.nomeCanon !== r.nome ? ' → ' + r.nomeCanon : ''})`);
}

// FONTE A: snapshot do período (campos no próprio doc do fechamento)
rodar('fechamentos/{periodo}/clientes (snapshot)', (cliPeriodo) => cliPeriodo);

// FONTE B: cadastro mestre clientes_base (o que a UI edita)
rodar('clientes_base (cadastro mestre)', (cliPeriodo, idEst) => cliBasePorIdEstavel.get(idEst));

process.exit(0);
