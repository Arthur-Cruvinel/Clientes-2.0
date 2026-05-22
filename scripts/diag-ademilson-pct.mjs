// READ-ONLY — diagnóstico Ademilson custo direto zero.
// Lê vínculos do período 2026-01 + clientes_base/ademilson*.

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();
const PERIODO = '2026-01';

console.log(`\n=== (1) vinculos em fechamentos/${PERIODO}/vinculos/ com 'ademilson' no id ===\n`);
const vincSnap = await getDocs(collection(db, 'fechamentos', PERIODO, 'vinculos'));
const ademVinc = vincSnap.docs.filter(d => d.id.toLowerCase().includes('ademilson'));
console.log(`Total no período: ${vincSnap.size} | Filtrados 'ademilson': ${ademVinc.length}\n`);
for (const d of ademVinc) {
  const v = d.data();
  console.log({
    id: d.id,
    pct: v.pct,
    pct_tipo: typeof v.pct,
    id_estavel_colaborador: v.id_estavel_colaborador,
    id_estavel_cliente: v.id_estavel_cliente,
    nome_colaborador: v.nome_colaborador,
    nome_cliente: v.nome_cliente,
    funcao: v.funcao,
    origem: v.origem,
  });
}

console.log(`\n=== (2) clientes_base/ademilson_braga_bispo_junior ===\n`);
const cbRef = doc(db, 'clientes_base', 'ademilson_braga_bispo_junior');
const cbSnap = await getDoc(cbRef);
if (!cbSnap.exists()) {
  console.log('NÃO EXISTE com slug ademilson_braga_bispo_junior. Listando docs de clientes_base com "ademilson":');
  const all = await getDocs(collection(db, 'clientes_base'));
  for (const d of all.docs) {
    if (d.id.toLowerCase().includes('ademilson')) {
      console.log({ id: d.id, ...d.data() });
    }
  }
} else {
  const c = cbSnap.data();
  console.log({
    docId: cbSnap.id,
    id_estavel: c.id_estavel,
    pacote_servico: c.pacote_servico,
    consultoria_gestao: c.consultoria_gestao,
    consultoria_planejamento: c.consultoria_planejamento,
    consultoria_financeira: c.consultoria_financeira,
    operacional_financeiro: c.operacional_financeiro,
    serv_adm: c.serv_adm,
    serv_aux_adm: c.serv_aux_adm,
    pct_consultoria_gestao: c.pct_consultoria_gestao,
    pct_consultoria_planejamento: c.pct_consultoria_planejamento,
    pct_consultoria_financeira: c.pct_consultoria_financeira,
    pct_operacional_financeiro: c.pct_operacional_financeiro,
    pct_serv_adm: c.pct_serv_adm,
    pct_serv_aux_adm: c.pct_serv_aux_adm,
  });
}

console.log('\n=== (também) fechamentos/2026-01/clientes/ — busca por "ademilson" ===\n');
const fcSnap = await getDocs(collection(db, 'fechamentos', PERIODO, 'clientes'));
for (const d of fcSnap.docs) {
  if (d.id.toLowerCase().includes('ademilson') || (d.data().nome_cliente ?? '').toLowerCase().includes('ademilson')) {
    const c = d.data();
    console.log({
      docId: d.id,
      id_estavel: c.id_estavel,
      nome_cliente: c.nome_cliente,
      pct_consultoria_gestao: c.pct_consultoria_gestao,
      pct_consultoria_planejamento: c.pct_consultoria_planejamento,
      pct_consultoria_financeira: c.pct_consultoria_financeira,
      pct_operacional_financeiro: c.pct_operacional_financeiro,
      pct_serv_adm: c.pct_serv_adm,
      pct_serv_aux_adm: c.pct_serv_aux_adm,
      consultoria_gestao: c.consultoria_gestao,
      consultoria_financeira: c.consultoria_financeira,
      operacional_financeiro: c.operacional_financeiro,
      serv_adm: c.serv_adm,
      serv_aux_adm: c.serv_aux_adm,
    });
  }
}

process.exit(0);
