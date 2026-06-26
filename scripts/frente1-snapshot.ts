// Frente 1 — leitura de PRODUÇÃO (READ-ONLY). NENHUMA escrita no Firestore.
// (0.6) Snapshot de EBITDA + custo direto de um período, rodando o MOTOR REAL
//       (processarPeriodo), espelhando a sequência do AppContext.carregarPeriodo.
// (0.4) Contagem de clientes com pct_* != 0 por período (+ vínculos com pct>0).
//
// Rodar: npx tsx scripts/frente1-snapshot.ts [periodo] [regime]
//   periodo default '2026-01'; regime default 'presumido'.
//
// Inicializa o próprio Firestore via .env (firebase.ts da app usa import.meta.env,
// indisponível sob tsx). Importa só o motor PURO de src/utils/financials.* —
// nenhum desses arquivos toca services/firebase nem import.meta.env (verificado).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore, collection, collectionGroup, getDocs, doc, getDoc, query, where,
} from 'firebase/firestore';

import { processarPeriodo } from '../src/utils/financials.pipeline';
import { calcularFolhaColaborador, resolverClientePorPeriodo } from '../src/utils/financials.custos';
import { PARAMETROS_DEFAULT } from '../src/utils/constants';

// ── Init Firestore (mesmo padrão de scripts/_helpers.mjs) ────────────────────
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

const docs = (snap: any) => snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

const PCT_FIELDS = [
  'pct_consultoria_gestao', 'pct_consultoria_planejamento', 'pct_consultoria_financeira',
  'pct_operacional_financeiro', 'pct_serv_adm', 'pct_serv_aux_adm',
];
const temPct = (c: any) => PCT_FIELDS.some(f => Math.abs(Number(c[f] ?? 0)) > 1e-12);
const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── 0.4 — contagem de pct por período (collectionGroup) ──────────────────────
async function contarPct() {
  const cliSnap = await getDocs(collectionGroup(db, 'clientes'));
  const vinSnap = await getDocs(collectionGroup(db, 'vinculos'));
  const porPeriodo: Record<string, { total: number; comPct: number }> = {};
  cliSnap.forEach((d: any) => {
    const periodo = d.ref.parent.parent?.id ?? '???';
    porPeriodo[periodo] ??= { total: 0, comPct: 0 };
    porPeriodo[periodo].total++;
    if (temPct(d.data())) porPeriodo[periodo].comPct++;
  });
  const vincComPct: Record<string, number> = {};
  vinSnap.forEach((d: any) => {
    const periodo = d.ref.parent.parent?.id ?? '???';
    if (Number(d.data().pct ?? 0) > 1e-12) vincComPct[periodo] = (vincComPct[periodo] ?? 0) + 1;
  });
  console.log('\n=== 0.4 — clientes com pct_* != 0 por período ===');
  console.log('periodo | clientes com pct | total clientes | vínculos pct>0');
  for (const p of Object.keys(porPeriodo).sort()) {
    console.log(`${p} | ${porPeriodo[p].comPct} | ${porPeriodo[p].total} | ${vincComPct[p] ?? 0}`);
  }
}

// ── 0.6 — snapshot de dinheiro, espelhando AppContext.carregarPeriodo ─────────
async function snapshot(periodo: string, regime: string) {
  const [anoStr, mesStr] = periodo.split('-');
  const ano = parseInt(anoStr), mes = parseInt(mesStr);

  // Parâmetros (read-only — NÃO chama semearAliquotasRebate, que escreve).
  const pSnap = await getDoc(doc(db, 'parametros', 'global'));
  const params: any = pSnap.exists() ? { ...PARAMETROS_DEFAULT, ...pSnap.data() } : PARAMETROS_DEFAULT;

  // Status do período (fechado? → snapshot clientes; aberto → clientes_base).
  const stSnap = await getDoc(doc(db, 'periodos_status', periodo));
  const fechado = stSnap.exists() && (stSnap.data() as any).fechado === true;

  const [clientesRaw, colaboradoresRaw, custosIndiretos, poupancaRaw, vinculos, custosDedicados] = await Promise.all([
    fechado
      ? getDocs(collection(db, 'fechamentos', periodo, 'clientes')).then(docs)
      : getDocs(collection(db, 'clientes_base')).then(docs),
    getDocs(collection(db, 'fechamentos', periodo, 'colaboradores')).then(docs),
    getDocs(collection(db, 'fechamentos', periodo, 'custosIndiretos')).then(docs),
    getDocs(query(collection(db, 'poupanca'), where('ano', '==', ano), where('mes', '==', mes))).then(docs),
    getDocs(collection(db, 'fechamentos', periodo, 'vinculos')).then(docs),
    getDocs(collection(db, 'fechamentos', periodo, 'custosDedicados')).then(docs),
  ]);

  // Dedup clientes_base por id_estavel (igual buscarClientesBase).
  let clientes = clientesRaw;
  if (!fechado) {
    const vistos = new Set<string>();
    clientes = clientesRaw.filter((c: any) => {
      if (!c.id_estavel) return true;
      if (vistos.has(c.id_estavel)) return false;
      vistos.add(c.id_estavel); return true;
    });
  }

  // Filtro de quarentena da poupança (igual buscarRegistrosPoupancaPorPeriodo).
  const registrosPoupanca = poupancaRaw.filter((r: any) => r.status !== 'pendente_normalizacao');

  // Recalcular folha (AppContext :144-157).
  const colaboradores = colaboradoresRaw.map((c: any) => {
    const r: any = calcularFolhaColaborador(c, ano, periodo);
    return {
      ...c, custo_total_mensal: r.custo_total_mensal, custo_hora: r.custo_hora,
      inss: r.inss, irrf: r.irrf_liquido, complemento_plr: r.complemento_plr,
      reflexos_plr_mensal: r.reflexos_plr_mensal, encargos_patronais: r.encargos_patronais,
      decimo_terceiro_ferias: r.decimo_terceiro_ferias,
    };
  });

  // Overlay custo administrativo dedicado + resolverClientePorPeriodo (:169-183).
  const dedicadoPorId = new Map(
    custosDedicados.filter((d: any) => d.id_estavel_cliente)
      .map((d: any) => [d.id_estavel_cliente, d.custo_administrativo_dedicado]),
  );
  const clientesComDedicado = clientes.map((c: any) => {
    const comDed = (c.id_estavel && dedicadoPorId.has(c.id_estavel))
      ? { ...c, custo_administrativo_dedicado: dedicadoPorId.get(c.id_estavel) } : c;
    return resolverClientePorPeriodo(comDed, periodo);
  });

  // Filtro data_entrada (:186-191).
  const periodoAtual = ano * 12 + mes;
  const clientesFiltrados = clientesComDedicado.filter((c: any) => {
    if (!c.data_entrada) return true;
    const [ae, me] = c.data_entrada.split('-').map(Number);
    return (ae * 12 + me) <= periodoAtual;
  });

  // AUM + síntese de Pure Asset (:194-250) — replica buscarAumPorPeriodo (período exato).
  const normNome = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const aum = new Map<string, any>();
  for (const r of registrosPoupanca as any[]) {
    const nome = normNome(r.nome_cliente);
    if (!nome) continue;
    const plOff = (r.pl_offshore_usd && r.ptax_fechamento) ? r.pl_offshore_usd * r.ptax_fechamento : (r.pl_offshore ?? 0);
    aum.set(nome, { nome_cliente: nome, pl_onshore: r.pl_onshore ?? 0, pl_offshore: plOff });
  }
  const nomesNoFech = new Set(clientesFiltrados.map((c: any) => normNome(c.nome_cliente)));
  const dataEntradaPorNome = new Map<string, string>();
  for (const c of clientes as any[]) if (c.data_entrada) dataEntradaPorNome.set(normNome(c.nome_cliente), c.data_entrada);
  const pureAsset: any[] = [];
  for (const [nome] of aum) {
    if (nomesNoFech.has(nome)) continue;
    const de = dataEntradaPorNome.get(nome);
    if (de && de > periodo) continue;
    pureAsset.push({
      nome_cliente: nome, receita_fee: 0,
      percentual_rebate_anual_onshore: params.taxa_rebate_onshore,
      percentual_rebate_anual_offshore: params.taxa_rebate_offshore,
      utiliza_servico_juridico: false, utiliza_conciliacao: false, pacote_servico: 'asset_only',
      pct_consultoria_gestao: 0, pct_consultoria_planejamento: 0, pct_consultoria_financeira: 0,
      pct_operacional_financeiro: 0, pct_serv_adm: 0, pct_serv_aux_adm: 0,
    });
  }

  const todosClientes = [...clientesFiltrados, ...pureAsset];
  const resultados: any[] = processarPeriodo(
    todosClientes as any, colaboradores as any, custosIndiretos as any,
    registrosPoupanca as any, regime as any, vinculos as any,
    { onshore: params.aliquota_rebate_onshore, offshore: params.aliquota_rebate_offshore },
  );

  const somaDireto = resultados.reduce((s, r) => s + r.custo_direto, 0);
  const somaEbitda = resultados.reduce((s, r) => s + r.ebitda, 0);
  const somaReceita = resultados.reduce((s, r) => s + r.receita_bruta, 0);
  const somaLucro = resultados.reduce((s, r) => s + r.lucro_liquido, 0);

  console.log(`\n=== 0.6 — SNAPSHOT ${periodo} (regime=${regime}, fechado=${fechado}) ===`);
  console.log(`clientes processados: ${resultados.length} (fechamento: ${clientesFiltrados.length} + pure asset: ${pureAsset.length})`);
  console.log(`Σ custo_direto  = ${fmt(somaDireto)}`);
  console.log(`Σ EBITDA        = ${fmt(somaEbitda)}`);
  console.log(`Σ receita_bruta = ${fmt(somaReceita)}`);
  console.log(`Σ lucro_liquido = ${fmt(somaLucro)}`);
}

(async () => {
  const periodo = process.argv[2] ?? '2026-01';
  const regime = process.argv[3] ?? 'presumido';
  await snapshot(periodo, regime);
  await contarPct();
  process.exit(0);
})().catch(e => { console.error('ERRO:', e); process.exit(1); });
