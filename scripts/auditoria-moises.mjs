// Auditoria READ-ONLY do MOISES LIMA MAGALHAES em poupanca/.
// Inspeciona presença e tipo dos campos transferencia_interna_* para
// diagnosticar discrepância de NNM MM6 no Burn Rate.
// Uso: node scripts/auditoria-moises.mjs

import { collection, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const CAMPOS_INSPECIONAR = [
  'aporte_mes_total',
  'aporte_mes_onshore',
  'aporte_mes_offshore',
  'transferencia_interna_onshore',
  'transferencia_interna_offshore',
  'nnm_tombamento',
  'nnm_tombamento_onshore',
  'nnm_tombamento_offshore',
  'rentabilidade_total',
  'pl_total',
];

function fmtValor(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  return JSON.stringify(v);
}

function linhaCampo(data, campo) {
  const existe = campo in data;
  const valor = data[campo];
  const tipo = existe ? typeof valor : 'AUSENTE';
  const valorStr = existe ? fmtValor(valor) : 'PROPRIEDADE AUSENTE';
  return `${campo.padEnd(34)} | tipo: ${tipo.padEnd(9)} | valor: ${valorStr}`;
}

let db;
try {
  db = initDb();
} catch (e) {
  console.error('[Audit] Erro ao inicializar Firebase:', e.message);
  process.exit(1);
}

console.log('[Audit] Lendo poupanca/...');
let snap;
try {
  snap = await getDocs(collection(db, 'poupanca'));
} catch (e) {
  console.error('[Audit] Erro ao ler coleção poupanca/:', e.message);
  process.exit(1);
}
console.log(`[Audit] Total de docs em poupanca/: ${snap.size}`);

// Match em memória — Firestore não tem LIKE.
const docsMoises = [];
for (const d of snap.docs) {
  const data = d.data();
  const nome = String(data.nome_cliente ?? '').toUpperCase();
  if (nome.includes('MOISES') || nome.includes('MAGALHAES')) {
    docsMoises.push({ id: d.id, data });
  }
}

console.log(`[Audit] Docs do Moises encontrados: ${docsMoises.length}\n`);

if (docsMoises.length === 0) {
  console.log('Nenhum doc com nome_cliente contendo "MOISES" ou "MAGALHAES".');
  console.log('Possível causa: nome_cliente persistido com grafia diferente,');
  console.log('ou o cliente está sob outra sigla. Verificar mapeamento_siglas/.');
  process.exit(0);
}

// Ordena por (ano, mes) ascendente quando disponíveis.
docsMoises.sort((a, b) => {
  const pa = (a.data.ano ?? 0) * 12 + (a.data.mes ?? 0);
  const pb = (b.data.ano ?? 0) * 12 + (b.data.mes ?? 0);
  return pa - pb;
});

// Métricas agregadas.
let qComTransfOn = 0;
let qComTransfOff = 0;
let qPropTransfOn = 0;
let qPropTransfOff = 0;
let somaAporteTotal = 0;
let somaNnmReal = 0;

for (const { id, data } of docsMoises) {
  console.log(`=== MOISES — DOC: ${id} ===`);
  console.log(`nome_cliente: ${JSON.stringify(data.nome_cliente ?? null)}`);
  console.log(`periodo: ${data.ano ?? '?'}/${data.mes ?? '?'}`);
  console.log('');
  console.log('--- aportes ---');
  console.log(linhaCampo(data, 'aporte_mes_total'));
  console.log(linhaCampo(data, 'aporte_mes_onshore'));
  console.log(linhaCampo(data, 'aporte_mes_offshore'));
  console.log('');
  console.log('--- transferencia interna ---');
  console.log(linhaCampo(data, 'transferencia_interna_onshore'));
  console.log(linhaCampo(data, 'transferencia_interna_offshore'));
  console.log('');
  console.log('--- tombamento ---');
  console.log(linhaCampo(data, 'nnm_tombamento'));
  console.log(linhaCampo(data, 'nnm_tombamento_onshore'));
  console.log(linhaCampo(data, 'nnm_tombamento_offshore'));
  console.log('');

  // Cálculo manual do nnmReal — replica utils/financials.ts:nnmReal
  const aOn = Number(data.aporte_mes_onshore ?? 0) || 0;
  const aOff = Number(data.aporte_mes_offshore ?? 0) || 0;
  const tOn = Number(data.transferencia_interna_onshore ?? 0) || 0;
  const tOff = Number(data.transferencia_interna_offshore ?? 0) || 0;
  const nnmReal = (aOn + aOff) - (tOn + tOff);
  console.log('--- cálculo manual ---');
  console.log(`nnmReal calculado: ${nnmReal}`);
  console.log('  detalhe: (aporte_on + aporte_off) - (transf_on + transf_off)');
  console.log(`  detalhe: (${aOn} + ${aOff}) - (${tOn} + ${tOff}) = ${nnmReal}`);
  console.log('');

  console.log('--- todos os campos do doc ---');
  const chaves = Object.keys(data).slice().sort();
  for (const k of chaves) console.log(`  ${k}`);
  console.log('===\n');

  // Agregados.
  if ('transferencia_interna_onshore' in data) qPropTransfOn++;
  if ('transferencia_interna_offshore' in data) qPropTransfOff++;
  if (Number(data.transferencia_interna_onshore ?? 0) !== 0) qComTransfOn++;
  if (Number(data.transferencia_interna_offshore ?? 0) !== 0) qComTransfOff++;
  somaAporteTotal += Number(data.aporte_mes_total ?? 0) || 0;
  somaNnmReal += nnmReal;
}

console.log('==================== RESUMO ====================');
console.log(`Total de docs do Moises:                          ${docsMoises.length}`);
console.log(`Docs com transferencia_interna_onshore != 0:      ${qComTransfOn}`);
console.log(`Docs com transferencia_interna_offshore != 0:     ${qComTransfOff}`);
console.log(`Docs com PROPRIEDADE transferencia_interna_on:    ${qPropTransfOn}`);
console.log(`Docs com PROPRIEDADE transferencia_interna_off:   ${qPropTransfOff}`);
console.log('');
console.log(`Soma aporte_mes_total (bruto):                    ${somaAporteTotal}`);
console.log(`Soma nnmReal (bruto - transferencia interna):     ${somaNnmReal}`);
const diff = somaAporteTotal - somaNnmReal;
console.log(`Diferenca (bruto - real):                         ${diff}`);
console.log('');
if (Math.abs(diff) < 0.01) {
  console.log('>>> CONCLUSAO: bruto == real. Transferencia interna NAO esta');
  console.log('    descontando nada na agregacao manual. Possiveis causas:');
  console.log('    - campos transferencia_interna_* nunca foram persistidos (H1)');
  console.log('    - campos persistidos como string/outro tipo (H2)');
  console.log('    - docs do Moises com grafia divergente nao casaram (verificar');
  console.log('      lista de campos acima)');
} else {
  console.log('>>> CONCLUSAO: transferencia interna ESTA presente nos dados.');
  console.log('    Bug deve estar no consumidor (helper, leitura, ou MM6).');
  console.log('    Inspecionar mm6PorCliente em features/poupanca/usePoupanca.ts.');
}

process.exit(0);
