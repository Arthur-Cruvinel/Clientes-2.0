// READ-ONLY / DRY-RUN — seeding de custo_administrativo_dedicado como valor
// VARIÁVEL POR PERÍODO (estrutura nova, paralela a custosIndiretos).
// Fonte do seed = MASTER (clientes_base/). NENHUM write. Só getDocs.
//
// Uso: node scripts/dryrun-seed-custo-administrativo.mjs
//
// Escopo: APENAS custo_administrativo_dedicado. Não toca contabilidade/pagamento.
//
// Saídas:
//  A) status aberto/fechado de cada período (periodos_status/{p}.fechado)
//  B) dry-run do seed: período × cliente × valor que SERIA semeado (do master)
//  C) impacto EBITDA: delta entre o valor que o pipeline USA HOJE
//     (aberto→master, fechado→snapshot) e o valor semeado (master).

import { collection, collectionGroup, getDocs, getDoc, doc } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();
const CAMPO = 'custo_administrativo_dedicado';
const PERIODOS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];

function leitura(data, campo) {
  if (!(campo in data)) return { presente: false, valor: null };
  const v = data[campo];
  return { presente: true, valor: typeof v === 'number' ? v : Number(v) || 0 };
}
const normNome = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const chave = (data) => data.id_estavel ? `est:${data.id_estavel}` : `nom:${normNome(data.nome_cliente)}`;
const fmt = (v) => v == null ? '—(ausente)' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  // ── Master ────────────────────────────────────────────────────────────────
  const baseSnap = await getDocs(collection(db, 'clientes_base'));
  const master = new Map(); // chave → { nome, campo: {presente,valor} }
  for (const d of baseSnap.docs) {
    const data = d.data();
    master.set(chave(data), { nome: data.nome_cliente ?? d.id, campo: leitura(data, CAMPO) });
  }

  // ── Status dos períodos ─────────────────────────────────────────────────────
  const statusPeriodo = new Map(); // periodo → { existe, fechado }
  for (const p of PERIODOS) {
    const s = await getDoc(doc(db, 'periodos_status', p));
    statusPeriodo.set(p, s.exists()
      ? { existe: true, fechado: !!s.data().fechado }
      : { existe: false, fechado: false }); // sem doc = aberto (AppContext lê do master)
  }

  // ── Snapshots ───────────────────────────────────────────────────────────────
  const cg = await getDocs(collectionGroup(db, 'clientes'));
  // periodo → Map(chave → { nome, campo:{presente,valor} })
  const snaps = new Map(PERIODOS.map(p => [p, new Map()]));
  for (const d of cg.docs) {
    const partes = d.ref.path.split('/');
    if (partes[0] !== 'fechamentos' || partes[2] !== 'clientes') continue;
    const periodo = partes[1];
    if (!snaps.has(periodo)) continue; // ignora SANDBOX e qualquer período fora dos 6
    const data = d.data();
    snaps.get(periodo).set(chave(data), { nome: data.nome_cliente ?? d.id, campo: leitura(data, CAMPO) });
  }

  // ── A) STATUS ───────────────────────────────────────────────────────────────
  console.log('='.repeat(78));
  console.log('A) STATUS DOS PERÍODOS  (define o que o pipeline lê HOJE)');
  console.log('='.repeat(78));
  for (const p of PERIODOS) {
    const st = statusPeriodo.get(p);
    const lbl = st.fechado ? 'FECHADO → pipeline lê SNAPSHOT' : 'aberto  → pipeline lê MASTER';
    console.log(`  ${p}: ${lbl}${st.existe ? '' : '  (sem doc periodos_status → aberto)'}`);
  }

  // ── B) DRY-RUN DO SEED ──────────────────────────────────────────────────────
  // Para cada período × cliente COM snapshot: seed = master[chave].
  // master ausente → "sem valor" (asset_only): NÃO semeia valor.
  console.log('\n' + '='.repeat(78));
  console.log('B) DRY-RUN SEED  (fonte = master; 1 valor por cliente por período)');
  console.log('='.repeat(78));
  // Como o master é mono-instância, o valor a semear é o MESMO em todos os
  // períodos onde o cliente tem snapshot. Mostro a lista única + presença/período.
  const seedPorPeriodo = new Map(PERIODOS.map(p => [p, { comValor: 0, semValor: 0, zero: 0, soma: 0 }]));
  const clientesComValor = []; // { nome, seed, periodosComSnapshot:Set }
  const semMatchMaster = []; // snapshots sem master correspondente

  // universo de clientes com snapshot em algum dos 6 períodos
  const universo = new Map(); // chave → nome
  for (const p of PERIODOS) for (const [k, v] of snaps.get(p)) if (!universo.has(k)) universo.set(k, v.nome);

  for (const [k, nome] of universo) {
    const m = master.get(k);
    const periodosComSnap = PERIODOS.filter(p => snaps.get(p).has(k));
    if (!m) { semMatchMaster.push({ nome, periodos: periodosComSnap }); }
    const seed = m?.campo;
    for (const p of periodosComSnap) {
      const bucket = seedPorPeriodo.get(p);
      if (!seed || !seed.presente) { bucket.semValor++; }
      else if (Math.abs(seed.valor) < 0.005) { bucket.zero++; }
      else { bucket.comValor++; bucket.soma += seed.valor; }
    }
    if (seed && seed.presente && Math.abs(seed.valor) >= 0.005) {
      clientesComValor.push({ nome, seed: seed.valor, periodos: periodosComSnap });
    }
  }

  console.log('\n  Resumo por período (clientes com snapshot a semear):');
  console.log('  período  | com valor>0 | valor=0 | sem valor(master ausente) | soma a semear');
  for (const p of PERIODOS) {
    const b = seedPorPeriodo.get(p);
    console.log(`  ${p} |   ${String(b.comValor).padStart(7)}   | ${String(b.zero).padStart(7)} | ${String(b.semValor).padStart(24)}  | ${fmt(b.soma)}`);
  }

  console.log(`\n  Clientes com valor>0 a semear (mesmo valor do master em todos os períodos com snapshot):`);
  clientesComValor.sort((a, b) => b.seed - a.seed);
  for (const c of clientesComValor) {
    console.log(`    • ${c.nome.padEnd(34)} seed=${fmt(c.seed).padStart(12)}  períodos=[${c.periodos.join(', ')}]`);
  }
  console.log(`\n  (${clientesComValor.length} clientes com valor>0; demais semeiam 0 ou "sem valor")`);
  if (semMatchMaster.length) {
    console.log(`\n  ⚠ Snapshots SEM master correspondente (não casaram por id_estavel/nome) — ${semMatchMaster.length}:`);
    for (const s of semMatchMaster) console.log(`    • ${s.nome}  [${s.periodos.join(', ')}]`);
  }

  // ── C) IMPACTO EBITDA ───────────────────────────────────────────────────────
  // valor HOJE: aberto → master; fechado → snapshot.
  // valor PÓS-SEED: master (semeado em todos os períodos).
  // delta = pós - hoje. Custo sobe (EBITDA desce) quando delta > 0.
  console.log('\n' + '='.repeat(78));
  console.log('C) IMPACTO NO EBITDA  (delta = seed[master] − valor_lido_hoje)');
  console.log('='.repeat(78));

  for (const p of PERIODOS) {
    const st = statusPeriodo.get(p);
    const linhas = [];
    let soma = 0;
    let maxAbsAberto = 0;
    for (const [k, nome] of snaps.get(p)) {
      const m = master.get(k);
      const seedVal = (m && m.campo.presente) ? m.campo.valor : 0; // "sem valor" → 0 p/ custo
      const snapCampo = snaps.get(p).get(k).campo;
      const snapVal = snapCampo.presente ? snapCampo.valor : 0;
      const hojeVal = st.fechado ? snapVal : seedVal; // aberto lê master(=seed); fechado lê snapshot
      const delta = seedVal - hojeVal;
      if (!st.fechado) { maxAbsAberto = Math.max(maxAbsAberto, Math.abs(delta)); }
      if (Math.abs(delta) >= 0.005) {
        linhas.push({ nome, hoje: hojeVal, seed: seedVal, delta });
        soma += delta;
      }
    }
    if (!st.fechado) {
      console.log(`\n  ${p} [ABERTO] — invariante: delta deve ser 0.  max|delta| = ${fmt(maxAbsAberto)}  ${maxAbsAberto < 0.005 ? '✓ OK (sem impacto)' : '✗ VIOLADO'}`);
      if (linhas.length) for (const l of linhas) console.log(`      ! ${l.nome}: hoje=${fmt(l.hoje)} seed=${fmt(l.seed)} delta=${fmt(l.delta)}`);
    } else {
      console.log(`\n  ${p} [FECHADO] — clientes com delta ≠ 0 (custo SOBE, EBITDA DESCE):`);
      linhas.sort((a, b) => b.delta - a.delta);
      if (!linhas.length) console.log('      (nenhum — snapshot já bate com o master)');
      for (const l of linhas) console.log(`      • ${l.nome.padEnd(34)} hoje=${fmt(l.hoje).padStart(11)}  seed=${fmt(l.seed).padStart(11)}  Δcusto=+${fmt(l.delta)}  ⇒ ΔEBITDA=−${fmt(l.delta)}`);
      console.log(`      ── SOMA do período ${p}: Δcusto total = +${fmt(soma)}  ⇒  EBITDA cai ${fmt(soma)}`);
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log('FIM. READ-ONLY / DRY-RUN — nada foi escrito, nenhuma estrutura criada.');
  console.log('='.repeat(78));
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERRO:', e); process.exit(1); });
