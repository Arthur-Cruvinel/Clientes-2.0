// READ-ONLY — valida que o pipeline de custo direto agora encontra o
// vínculo do Ademilson em 2026-01 e calcula custo > 0.
//
// Reproduz em JS puro a lógica do resolverColaboradorParaFuncao da
// Peça 5 (financials.custos.ts) para o caso específico do Ademilson.

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const db = initDb();
const PERIODO = '2026-01';
const FUNCOES = [
  'consultoria_gestao', 'consultoria_planejamento', 'consultoria_financeira',
  'operacional_financeiro', 'serv_adm', 'serv_aux_adm',
];

console.log(`\n=== Validação pipeline para Ademilson em ${PERIODO} ===\n`);

// 1. Ler cliente (snapshot do período — vamos pegar AMBOS os docs)
const fcSnap = await getDocs(collection(db, 'fechamentos', PERIODO, 'clientes'));
const ademClientes = fcSnap.docs
  .filter(d => (d.data().nome_cliente ?? '').toLowerCase().includes('ademilson'))
  .map(d => ({ id: d.id, ...d.data() }));

console.log(`Docs Ademilson no snapshot: ${ademClientes.length}`);
for (const c of ademClientes) {
  console.log(`  - docId=${c.id} id_estavel=${c.id_estavel} consultoria_financeira=${c.consultoria_financeira ?? '(undefined)'}`);
}

// 2. Ler vínculos do período
const vincSnap = await getDocs(collection(db, 'fechamentos', PERIODO, 'vinculos'));
const vinculos = vincSnap.docs.map(d => ({ id: d.id, ...d.data() }));
console.log(`\nTotal vínculos no período: ${vinculos.length}`);

// 3. Ler colaboradores e indexar por id_estavel
const colabSnap = await getDocs(collection(db, 'fechamentos', PERIODO, 'colaboradores'));
const colaboradores = colabSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const mapColabPorIdEstavel = new Map();
for (const c of colaboradores) {
  if (c.id_estavel) mapColabPorIdEstavel.set(c.id_estavel, c);
}
console.log(`Colaboradores com id_estavel: ${mapColabPorIdEstavel.size}`);

// 4. Para cada doc Ademilson, executar a resolução por função
for (const cliente of ademClientes) {
  console.log(`\n— Resolvendo ${cliente.nome_cliente} (docId=${cliente.id}) —`);
  for (const funcao of FUNCOES) {
    // Réplica de resolverColaboradorParaFuncao (Peça 5)
    let resultado;
    if (cliente.id_estavel) {
      const vinculo = vinculos.find(v =>
        v.id_estavel_cliente === cliente.id_estavel
        && v.funcao === funcao
        && (v.pct ?? 0) > 0,
      );
      if (vinculo) {
        const colab = mapColabPorIdEstavel.get(vinculo.id_estavel_colaborador);
        if (colab) {
          resultado = { fonte: 'vinculo', colab: colab.nome_colaborador, pct: vinculo.pct };
        } else {
          resultado = { fonte: 'vinculo_orfao_no_colab', vinculo: vinculo.id, pct: vinculo.pct };
        }
      }
    }
    if (!resultado) {
      // Fallback nome do cliente
      const nome = cliente[funcao];
      const pctKey = `pct_${funcao}`;
      const pct = cliente[pctKey] ?? 0;
      if (nome) {
        resultado = { fonte: 'cliente', nome, pct };
      } else {
        resultado = { fonte: 'nada', pct };
      }
    }
    if (resultado.pct > 0 || resultado.fonte === 'cliente' || resultado.fonte === 'vinculo') {
      console.log(`  ${funcao}: fonte=${resultado.fonte} pct=${resultado.pct.toFixed(6)} → ${resultado.colab ?? resultado.nome ?? '(sem colab)'}`);
    }
  }
}

process.exit(0);
