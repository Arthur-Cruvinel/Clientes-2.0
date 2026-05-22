// Reparo retroativo dos vínculos órfãos criados pela 1ª iteração da
// Peça 6 (setDoc({pct}, merge:true) → doc só com pct). Preenche os
// campos identificadores ausentes preservando pct.
//
// Lógica:
//   - Varre collectionGroup('vinculos') buscando docs com
//     pct > 0 && id_estavel_cliente === undefined.
//   - Para cada órfão, parse docId = {slug_colab}_{slug_cli}_{funcao}.
//     funcao = sufixo conhecido (uma das 6 de FUNCOES_ALOCACAO).
//     slug_colab + slug_cli = prefixo. Para desambiguar, varre
//     todos os splits possíveis e testa qual existe em
//     clientes_base/{slug_cli}.
//   - Resolve id_estavel_colaborador: busca em
//     fechamentos/{periodo}/colaboradores/{slug_colab}. Fallback
//     para varredura collectionGroup(colaboradores) por docId.
//   - Resolve id_estavel_cliente, nome_cliente: clientes_base/{slug_cli}.
//   - writeBatch.update preservando pct.
//
// Sanity: aborta se algum órfão não resolver campos. Idempotente —
// rodar de novo após sucesso não toca nada (filtro por id_estavel_cliente
// undefined exclui docs já reparados).

import { collection, collectionGroup, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();

const FUNCOES = [
  'consultoria_gestao', 'consultoria_planejamento', 'consultoria_financeira',
  'operacional_financeiro', 'serv_adm', 'serv_aux_adm',
];

function parseDocId(docId) {
  // Tenta cada função como sufixo
  for (const f of FUNCOES) {
    const sufixo = '_' + f;
    if (docId.endsWith(sufixo)) {
      const prefix = docId.slice(0, -sufixo.length);
      return { prefix, funcao: f };
    }
  }
  return null;
}

async function resolverSlugCli(prefix) {
  // Tenta cada split possível do prefix em {slug_colab}_{slug_cli}.
  // Itera de TRÁS para frente (slug_cli mais curto primeiro), porque
  // slug_colab é geralmente compound e slug_cli pode ser. Para cada
  // candidato slug_cli, verifica se existe em clientes_base/.
  const partes = prefix.split('_');
  for (let split = 1; split < partes.length; split++) {
    const slugColab = partes.slice(0, split).join('_');
    const slugCli = partes.slice(split).join('_');
    const ref = doc(db, 'clientes_base', slugCli);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { slugColab, slugCli, clienteBase: snap.data() };
    }
  }
  return null;
}

async function resolverColaborador(slugColab, periodo) {
  // 1) Tenta direto em fechamentos/{periodo}/colaboradores/{slugColab}
  const ref = doc(db, 'fechamentos', periodo, 'colaboradores', slugColab);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  // 2) Fallback: varre collectionGroup buscando docId === slugColab
  const grupo = await getDocs(collectionGroup(db, 'colaboradores'));
  for (const d of grupo.docs) {
    if (d.id === slugColab) return d.data();
  }
  return null;
}

console.log('\n=== Reparo retroativo de vínculos órfãos ===\n');

const snap = await getDocs(collectionGroup(db, 'vinculos'));
const orfaos = snap.docs.filter(d => {
  const v = d.data();
  return (v.pct ?? 0) > 0 && v.id_estavel_cliente === undefined;
});

console.log(`Órfãos detectados: ${orfaos.length}\n`);

const plano = [];
for (const d of orfaos) {
  const partes = d.ref.path.split('/');
  const periodo = partes[1];
  const docId = d.id;
  const pctAtual = d.data().pct;
  console.log(`  ${periodo}/${docId} (pct=${pctAtual})`);

  const parsed = parseDocId(docId);
  if (!parsed) {
    console.error(`    ERRO: docId não casa com nenhuma função conhecida`);
    process.exit(1);
  }

  const slugRes = await resolverSlugCli(parsed.prefix);
  if (!slugRes) {
    console.error(`    ERRO: prefix "${parsed.prefix}" não resolveu em clientes_base/`);
    process.exit(1);
  }

  const colab = await resolverColaborador(slugRes.slugColab, periodo);
  if (!colab) {
    console.error(`    ERRO: colaborador "${slugRes.slugColab}" não encontrado`);
    process.exit(1);
  }
  if (!colab.id_estavel) {
    console.error(`    ERRO: colaborador "${slugRes.slugColab}" sem id_estavel`);
    process.exit(1);
  }
  if (!slugRes.clienteBase.id_estavel) {
    console.error(`    ERRO: cliente "${slugRes.slugCli}" sem id_estavel em clientes_base`);
    process.exit(1);
  }

  plano.push({
    docRef: d.ref,
    docId,
    periodo,
    pctAtual,
    parsed,
    slugColab: slugRes.slugColab,
    slugCli: slugRes.slugCli,
    nomeCliente: slugRes.clienteBase.nome_cliente,
    idEstCliente: slugRes.clienteBase.id_estavel,
    nomeColab: colab.nome_colaborador,
    idEstColab: colab.id_estavel,
  });

  console.log(`    → colab: ${colab.nome_colaborador} (${colab.id_estavel})`);
  console.log(`    → cliente: ${slugRes.clienteBase.nome_cliente} (${slugRes.clienteBase.id_estavel})`);
  console.log(`    → funcao: ${parsed.funcao}`);
}

console.log(`\n=== Sanity: ${plano.length}/${orfaos.length} resolvidos. Aplicando update… ===\n`);

if (plano.length !== orfaos.length) {
  console.error('ABORT: nem todos os órfãos resolveram.');
  process.exit(1);
}

const dataReparo = new Date().toISOString();
const batch = writeBatch(db);
for (const p of plano) {
  batch.update(p.docRef, {
    id_estavel_colaborador: p.idEstColab,
    id_estavel_cliente: p.idEstCliente,
    nome_colaborador: p.nomeColab,
    nome_cliente: p.nomeCliente,
    funcao: p.parsed.funcao,
    periodo: p.periodo,
    origem: 'manual',
    data_criacao: dataReparo,
  });
}
await batch.commit();

console.log(`✓ ${plano.length} vínculos reparados.\n`);
console.log('=== Verificação pós-reparo ===\n');

for (const p of plano) {
  const snap2 = await getDoc(p.docRef);
  const v = snap2.data();
  console.log(`  ${p.docId}`);
  console.log(`    pct: ${v.pct} (preservado: ${v.pct === p.pctAtual})`);
  console.log(`    id_estavel_colaborador: ${v.id_estavel_colaborador}`);
  console.log(`    id_estavel_cliente: ${v.id_estavel_cliente}`);
  console.log(`    nome_colaborador: ${v.nome_colaborador}`);
  console.log(`    nome_cliente: ${v.nome_cliente}`);
  console.log(`    funcao: ${v.funcao}`);
  console.log(`    origem: ${v.origem}`);
}

process.exit(0);
