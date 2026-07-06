// READ-ONLY — mapeia divergência dos 3 custos "dedicados" entre o master
// (clientes_base/) e os snapshots (fechamentos/{periodo}/clientes/).
// Nenhum write Firestore. Só getDocs + collectionGroup. Imprime no console.
//
// Uso: node scripts/audit-dedicados-master-vs-snapshot.mjs
//
// Objetivo: decidir a fonte de verdade do seeding da migração que vai tornar
// custo_administrativo_dedicado um snapshot por período.

import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();

const CAMPOS = [
  'custo_administrativo_dedicado',
  'custo_contabilidade_dedicado',
  'custo_pagamento_dedicado',
];

// Distingue ausente (campo não existe no doc) de zero (existe e vale 0).
// Retorna { presente: bool, valor: number|null }.
function leituraCampo(data, campo) {
  if (!(campo in data)) return { presente: false, valor: null };
  const v = data[campo];
  return { presente: true, valor: typeof v === 'number' ? v : Number(v) || 0 };
}

function normNome(s) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

// Chave de match cliente: id_estavel quando existe, senão nome normalizado.
function chaveCliente(data) {
  return data.id_estavel ? `est:${data.id_estavel}` : `nom:${normNome(data.nome_cliente)}`;
}

const fmt = (v) => v == null ? '—(ausente)' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  // ── 1. Master: clientes_base/ ────────────────────────────────────────────
  const baseSnap = await getDocs(collection(db, 'clientes_base'));
  const master = new Map(); // chave → { nome, docId, campos: {campo: {presente,valor}} }
  for (const d of baseSnap.docs) {
    const data = d.data();
    const campos = {};
    for (const c of CAMPOS) campos[c] = leituraCampo(data, c);
    master.set(chaveCliente(data), {
      nome: data.nome_cliente ?? d.id, docId: d.id, campos,
    });
  }

  // ── 2. Snapshots: collectionGroup('clientes') ────────────────────────────
  // Inclui fechamentos/{periodo}/clientes/{id}. Agrupa por (chaveCliente).
  const cgSnap = await getDocs(collectionGroup(db, 'clientes'));
  // chave → Map(periodo → { docId, campos })
  const snaps = new Map();
  const periodosVistos = new Set();
  let docsSnapshotTotal = 0;
  for (const d of cgSnap.docs) {
    // path: fechamentos/{periodo}/clientes/{id}. Ignora qualquer outra coleção
    // 'clientes' que não esteja sob fechamentos/.
    const partes = d.ref.path.split('/');
    if (partes[0] !== 'fechamentos' || partes[2] !== 'clientes') continue;
    const periodo = partes[1];
    if (periodo === 'SANDBOX') continue;
    docsSnapshotTotal++;
    periodosVistos.add(periodo);
    const data = d.data();
    const campos = {};
    for (const c of CAMPOS) campos[c] = leituraCampo(data, c);
    const chave = chaveCliente(data);
    if (!snaps.has(chave)) snaps.set(chave, new Map());
    snaps.get(chave).set(periodo, { docId: d.id, nome: data.nome_cliente ?? d.id, campos });
  }

  const periodosOrdenados = [...periodosVistos].sort();

  // ── 3. Análise por campo ─────────────────────────────────────────────────
  console.log('='.repeat(80));
  console.log('AUDITORIA — custos dedicados: master (clientes_base) vs snapshots');
  console.log(`clientes_base: ${master.size} docs | snapshots(clientes): ${docsSnapshotTotal} docs`);
  console.log(`Períodos com snapshot: ${periodosOrdenados.join(', ')}`);
  console.log('='.repeat(80));

  // Universo de clientes = união das chaves master + snapshot.
  const todasChaves = new Set([...master.keys(), ...snaps.keys()]);

  for (const campo of CAMPOS) {
    console.log('\n' + '#'.repeat(80));
    console.log(`# CAMPO: ${campo}`);
    console.log('#'.repeat(80));

    let nClientesComDivergencia = 0;
    let nSnapshotsAusentes = 0;
    let nSnapshotsTotal = 0;
    let nTriviais = 0;       // todos períodos == master
    let nSemSnapshot = 0;    // cliente sem nenhum snapshot
    const linhasDivergentes = [];

    for (const chave of [...todasChaves].sort()) {
      const m = master.get(chave);
      const periodosDoCliente = snaps.get(chave); // Map periodo → {...}
      const nome = m?.nome ?? periodosDoCliente?.values().next().value?.nome ?? chave;
      const masterCampo = m?.campos[campo] ?? { presente: false, valor: null };

      if (!periodosDoCliente || periodosDoCliente.size === 0) {
        nSemSnapshot++;
        continue;
      }

      let clienteDivergente = false;
      const detalhePeriodos = [];
      for (const periodo of periodosOrdenados) {
        const snapP = periodosDoCliente.get(periodo);
        if (!snapP) continue; // cliente não existe nesse período
        nSnapshotsTotal++;
        const sc = snapP.campos[campo];
        if (!sc.presente) nSnapshotsAusentes++;

        // Divergência: valor numérico diferente do master, OU presença diferente.
        // Comparação de valor só quando ambos presentes; caso contrário, presença
        // divergente já é sinal.
        let diverge = false;
        if (sc.presente && masterCampo.presente) {
          diverge = Math.abs((sc.valor ?? 0) - (masterCampo.valor ?? 0)) > 0.005;
        } else if (sc.presente !== masterCampo.presente) {
          // um tem campo e o outro não — sinaliza, mas trata ausente-no-snapshot
          // separadamente do divergente-de-valor.
          diverge = sc.presente && (sc.valor ?? 0) !== 0; // snapshot tem valor !=0 e master não
        }
        if (diverge) clienteDivergente = true;
        detalhePeriodos.push(
          `${periodo}=${sc.presente ? fmt(sc.valor) : '—(ausente)'}${diverge ? ' *' : ''}`,
        );
      }

      if (clienteDivergente) {
        nClientesComDivergencia++;
        linhasDivergentes.push(
          `  • ${nome}\n      master=${masterCampo.presente ? fmt(masterCampo.valor) : '—(ausente)'} | ${detalhePeriodos.join('  ')}`,
        );
      } else {
        nTriviais++;
      }
    }

    console.log(`\nResumo ${campo}:`);
    console.log(`  Clientes com snapshot analisados: ${nTriviais + nClientesComDivergencia}`);
    console.log(`  → batem 100% com o master (trivial): ${nTriviais}`);
    console.log(`  → COM divergência master↔snapshot:   ${nClientesComDivergencia}`);
    console.log(`  Snapshots (doc×periodo) analisados:  ${nSnapshotsTotal}`);
    console.log(`  → com campo AUSENTE no snapshot:      ${nSnapshotsAusentes}`);
    console.log(`  Clientes só no master (sem snapshot): ${nSemSnapshot}`);

    if (linhasDivergentes.length > 0) {
      console.log(`\n  Divergências (período marcado com * difere do master):`);
      for (const l of linhasDivergentes) console.log(l);
    } else {
      console.log(`\n  Nenhuma divergência de valor — todos os snapshots == master.`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('FIM. READ-ONLY — nada foi escrito.');
  console.log('='.repeat(80));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('ERRO:', e);
  process.exit(1);
});
