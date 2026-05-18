// Fase 2.5 — Peça 1, Etapa 3.
// Cria UM doc em fechamentos/SANDBOX/vinculos/ usando valores reais de
// colaboradores_base/ e clientes_base/. Valida leitura após write.
//
// Exemplo definido pelo CFO:
//   docId: arthur_cruvinel_kevin_santos_lopes_consultoria_gestao
//   colab: colaboradores_base/arthur_cruvinel
//   cli:   clientes_base/kevin_santos_lopes
//   funcao: consultoria_gestao
//
// Período: literal 'SANDBOX' (decisão fechada).
// Estrutura do doc segue a interface Vinculo (src/types/vinculo.ts).
//
// Modo: por padrão APPLY. Não há flag --dry-run porque é um único write
// em coleção isolada (SANDBOX) — sem risco a dados de produção.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

const SLUG_COLAB = 'arthur_cruvinel';
const SLUG_CLI = 'kevin_santos_lopes';
const FUNCAO = 'consultoria_gestao';
const PCT = 0.10;
const PERIODO = 'SANDBOX';
const DOC_ID = `${SLUG_COLAB}_${SLUG_CLI}_${FUNCAO}`;

async function main() {
  const db = initDb();

  console.log('[Sandbox] Lendo colaboradores_base/' + SLUG_COLAB + '...');
  const colabSnap = await getDoc(doc(db, 'colaboradores_base', SLUG_COLAB));
  if (!colabSnap.exists()) {
    throw new Error(
      `colaboradores_base/${SLUG_COLAB} não existe. Cadastre o colaborador antes ` +
      'ou ajuste SLUG_COLAB no topo do script para um colaborador real.',
    );
  }
  const colab = colabSnap.data();
  if (!colab.id_estavel) {
    throw new Error(`colaboradores_base/${SLUG_COLAB} existe mas não tem id_estavel.`);
  }
  console.log(`  ✓ ${colab.nome_colaborador} · id_estavel=${colab.id_estavel}`);

  console.log('[Sandbox] Lendo clientes_base/' + SLUG_CLI + '...');
  const cliSnap = await getDoc(doc(db, 'clientes_base', SLUG_CLI));
  if (!cliSnap.exists()) {
    throw new Error(
      `clientes_base/${SLUG_CLI} não existe. Ajuste SLUG_CLI no topo do script.`,
    );
  }
  const cli = cliSnap.data();
  if (!cli.id_estavel) {
    throw new Error(`clientes_base/${SLUG_CLI} existe mas não tem id_estavel.`);
  }
  if (cli.pacote_servico === 'asset_only') {
    throw new Error(
      `clientes_base/${SLUG_CLI} é Pure Asset (asset_only) — não gera vínculos.`,
    );
  }
  console.log(`  ✓ ${cli.nome_cliente} · pacote=${cli.pacote_servico} · id_estavel=${cli.id_estavel}`);

  // Monta o vínculo conforme src/types/vinculo.ts
  const vinculo = {
    periodo: PERIODO,
    id_estavel_colaborador: colab.id_estavel,
    id_estavel_cliente: cli.id_estavel,
    nome_colaborador: colab.nome_colaborador,
    nome_cliente: cli.nome_cliente,
    funcao: FUNCAO,
    pct: PCT,
    origem: 'sandbox',
    data_criacao: new Date().toISOString(),
  };

  const ref = doc(db, 'fechamentos', PERIODO, 'vinculos', DOC_ID);
  console.log(`[Sandbox] Gravando ${ref.path}...`);
  await setDoc(ref, vinculo);
  console.log('  ✓ Write OK.');

  // Validação: read-back e comparação
  console.log('[Sandbox] Validando leitura...');
  const checkSnap = await getDoc(ref);
  if (!checkSnap.exists()) throw new Error('Read-back falhou: doc não encontrado após write.');
  const lido = checkSnap.data();

  const camposObrigatorios = [
    'periodo', 'id_estavel_colaborador', 'id_estavel_cliente',
    'nome_colaborador', 'nome_cliente', 'funcao', 'pct', 'origem', 'data_criacao',
  ];
  for (const campo of camposObrigatorios) {
    if (lido[campo] === undefined) {
      throw new Error(`Campo "${campo}" ausente no doc após read-back.`);
    }
    if (lido[campo] !== vinculo[campo]) {
      throw new Error(
        `Campo "${campo}" divergente: gravado=${JSON.stringify(vinculo[campo])} · ` +
        `lido=${JSON.stringify(lido[campo])}`,
      );
    }
  }
  console.log(`  ✓ Validação OK — 9 campos presentes, valores iguais ao gravado.`);

  console.log('\n[Sandbox] Resumo:');
  console.log(`  Path:   ${ref.path}`);
  console.log(`  Período: ${lido.periodo}`);
  console.log(`  Colab:   ${lido.nome_colaborador} (${lido.id_estavel_colaborador})`);
  console.log(`  Cli:     ${lido.nome_cliente} (${lido.id_estavel_cliente})`);
  console.log(`  Função:  ${lido.funcao}`);
  console.log(`  Pct:     ${lido.pct}`);
  console.log(`  Origem:  ${lido.origem}`);
  console.log(`  Criado:  ${lido.data_criacao}`);
}

main().catch((e) => {
  console.error('[Sandbox] Erro:', e.message);
  process.exit(1);
});
