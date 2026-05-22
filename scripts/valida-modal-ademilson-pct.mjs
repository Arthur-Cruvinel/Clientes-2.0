// READ-ONLY — replica resolverPctDoVinculo do EditarClienteModal para
// confirmar que o modal exibirá pct=14.1% em consultoria_financeira do
// Ademilson em 2026-01, e 0.0% nas demais funções (fallback no campo legado).

import { collection, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();
const PERIODO = '2026-01';
const FUNCOES = [
  'consultoria_gestao', 'consultoria_planejamento', 'consultoria_financeira',
  'operacional_financeiro', 'serv_adm', 'serv_aux_adm',
];

function resolverPctDoVinculo(cliente, funcao, vinculos) {
  const pctLegado = ((cliente[`pct_${funcao}`]) ?? 0) * 100;
  if (!cliente.id_estavel) return { pct: pctLegado, fonte: 'legado_sem_id_estavel' };
  const vinculo = vinculos.find(v =>
    v.id_estavel_cliente === cliente.id_estavel
    && v.funcao === funcao
    && v.pct > 0,
  );
  if (vinculo) return { pct: vinculo.pct * 100, fonte: 'vinculo' };
  return { pct: pctLegado, fonte: 'legado_vinculo_zero_ou_ausente' };
}

function resolverNomeColabDoVinculo(cliente, funcao, vinculos) {
  const nomeLegado = cliente[funcao] ?? '';
  if (!cliente.id_estavel) return { nome: nomeLegado, fonte: 'legado_sem_id_estavel' };
  const vinculo = vinculos.find(v =>
    v.id_estavel_cliente === cliente.id_estavel
    && v.funcao === funcao,
  );
  if (vinculo?.nome_colaborador) return { nome: vinculo.nome_colaborador, fonte: 'vinculo' };
  return { nome: nomeLegado, fonte: 'legado' };
}

const [fcSnap, vincSnap] = await Promise.all([
  getDocs(collection(db, 'fechamentos', PERIODO, 'clientes')),
  getDocs(collection(db, 'fechamentos', PERIODO, 'vinculos')),
]);

const ademClientes = fcSnap.docs
  .filter(d => (d.data().nome_cliente ?? '').toLowerCase().includes('ademilson'))
  .map(d => ({ id: d.id, ...d.data() }));
const vinculos = vincSnap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log(`\n=== Modal Ademilson 2026-01 — pct esperado por função ===\n`);

for (const c of ademClientes) {
  console.log(`Doc ${c.id} (id_estavel=${c.id_estavel})`);
  for (const f of FUNCOES) {
    const legado = c[f] ?? '(undefined)';
    const pct = resolverPctDoVinculo(c, f, vinculos);
    const nome = resolverNomeColabDoVinculo(c, f, vinculos);
    console.log(`  ${f}:`);
    console.log(`    pct exibido: ${pct.pct.toFixed(1)}% [fonte=${pct.fonte}]`);
    console.log(`    nome exibido: "${nome.nome}" [fonte=${nome.fonte}] (legado: "${legado}")`);
  }
  console.log('');
}

process.exit(0);
