// Sub-fase 3E — Validação final READ-ONLY da Fase 3.
//
// Verifica cobertura de id_estavel, consistência cross-coleção e unicidade
// nas 4 coleções migradas. Não escreve nada no Firestore.
//
// Saída JSON no stdout — consumido por gerar-relatorio-3e.mjs em sequência.

import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { initDb } from './_helpers.mjs';

/** Slug canônico — espelho de src/utils/slug.ts. */
function slugify(nome) {
  if (!nome) return '';
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const SLUGS_IGNORADOS_EXPLICITOS = new Set(['a_contratar']);

function ehColabIgnorado(data) {
  const nome = (data?.nome_colaborador ?? '').trim();
  const cargo = (data?.cargo ?? '').trim();
  const funcao = (data?.funcao_principal ?? '').trim();
  if (!nome || !cargo || !funcao) return true;
  if (SLUGS_IGNORADOS_EXPLICITOS.has(slugify(nome))) return true;
  return false;
}

function ehCustoIgnorado(data) {
  const descricao = (data?.descricao_custo ?? '').trim();
  return !descricao;
}

function temIdEstavel(data) {
  return typeof data?.id_estavel === 'string' && data.id_estavel.length > 0;
}

/** Detecta duplicatas de id_estavel num conjunto de docs. */
function detectarDuplicatas(docs) {
  const porIdEstavel = new Map();
  for (const d of docs) {
    const data = d.data();
    if (!temIdEstavel(data)) continue;
    const lista = porIdEstavel.get(data.id_estavel) ?? [];
    lista.push({ docId: d.id, path: d.ref.path });
    porIdEstavel.set(data.id_estavel, lista);
  }
  const duplicatas = [];
  for (const [id, lista] of porIdEstavel) {
    if (lista.length > 1) duplicatas.push({ id_estavel: id, ocorrencias: lista });
  }
  return duplicatas;
}

async function main() {
  console.error('[Validar Fase 3] Iniciando consultas...');
  const db = initDb();

  // -------------------------------------------------
  // V1.a — clientes_base/
  // -------------------------------------------------
  console.error('[Validar Fase 3] Lendo clientes_base/...');
  const baseSnap = await getDocs(collection(db, 'clientes_base'));
  const baseDocs = baseSnap.docs;
  const baseComId = baseDocs.filter((d) => temIdEstavel(d.data()));
  const baseSemId = baseDocs.filter((d) => !temIdEstavel(d.data()));

  // Mapa id_estavel → { docId, nome_cliente } em clientes_base — usado por V2
  const baseIdsValidos = new Set();
  for (const d of baseDocs) {
    const data = d.data();
    if (temIdEstavel(data)) baseIdsValidos.add(data.id_estavel);
  }

  // -------------------------------------------------
  // V1.b — fechamentos/*/clientes/
  // -------------------------------------------------
  console.error('[Validar Fase 3] Lendo fechamentos/*/clientes/...');
  const fechClientesSnap = await getDocs(collectionGroup(db, 'clientes'));
  const fechClientesDocs = fechClientesSnap.docs;
  const fechClientesComId = fechClientesDocs.filter((d) => temIdEstavel(d.data()));
  const fechClientesSemId = fechClientesDocs.filter((d) => !temIdEstavel(d.data()));

  // -------------------------------------------------
  // V1.c — fechamentos/*/colaboradores/
  // -------------------------------------------------
  console.error('[Validar Fase 3] Lendo fechamentos/*/colaboradores/...');
  const colabSnap = await getDocs(collectionGroup(db, 'colaboradores'));
  const colabDocs = colabSnap.docs;
  const colabIgnorados = colabDocs.filter((d) => ehColabIgnorado(d.data()));
  const colabReais = colabDocs.filter((d) => !ehColabIgnorado(d.data()));
  const colabComId = colabReais.filter((d) => temIdEstavel(d.data()));
  const colabSemId = colabReais.filter((d) => !temIdEstavel(d.data()));

  // -------------------------------------------------
  // V1.d — fechamentos/*/custosIndiretos/
  // -------------------------------------------------
  console.error('[Validar Fase 3] Lendo fechamentos/*/custosIndiretos/...');
  const custosSnap = await getDocs(collectionGroup(db, 'custosIndiretos'));
  const custosDocs = custosSnap.docs;
  const custosIgnorados = custosDocs.filter((d) => ehCustoIgnorado(d.data()));
  const custosReais = custosDocs.filter((d) => !ehCustoIgnorado(d.data()));
  const custosComId = custosReais.filter((d) => temIdEstavel(d.data()));
  const custosSemId = custosReais.filter((d) => !temIdEstavel(d.data()));

  // -------------------------------------------------
  // V2 — Consistência cross-coleção (clientes)
  // -------------------------------------------------
  // Cada snapshot em fechamentos/*/clientes/ com id_estavel deve apontar para
  // um id_estavel que existe em clientes_base/.
  const orfaos = [];
  for (const d of fechClientesComId) {
    const data = d.data();
    if (!baseIdsValidos.has(data.id_estavel)) {
      orfaos.push({
        docId: d.id, path: d.ref.path,
        periodo: d.ref.path.split('/')[1],
        nome_cliente: data.nome_cliente ?? '(vazio)',
        id_estavel: data.id_estavel,
      });
    }
  }

  // -------------------------------------------------
  // V3 — Unicidade dentro de clientes_base/
  // -------------------------------------------------
  const dupClientesBase = detectarDuplicatas(baseDocs);
  // Em fechamentos/*/clientes/ é ESPERADO que o mesmo id_estavel apareça
  // múltiplas vezes (mesmo cliente em vários períodos) — não conta como
  // duplicata. Para colaboradores e custos idem (mesma entidade × períodos).
  // A unicidade só faz sentido na coleção mestre (clientes_base/).
  //
  // Para colaboradores e custos (sem mestre) o controle equivalente é:
  // dois grupos lógicos (slugs distintos) NÃO podem compartilhar id_estavel.
  // Implemento isso agregando por id_estavel e contando slugs distintos.
  function detectarColisoesPorAgrupamento(docs, getChave) {
    const porId = new Map();
    for (const d of docs) {
      const data = d.data();
      if (!temIdEstavel(data)) continue;
      const chave = getChave(data);
      if (!chave) continue;
      if (!porId.has(data.id_estavel)) porId.set(data.id_estavel, new Set());
      porId.get(data.id_estavel).add(chave);
    }
    const colisoes = [];
    for (const [id, chaves] of porId) {
      if (chaves.size > 1) colisoes.push({ id_estavel: id, chaves: [...chaves] });
    }
    return colisoes;
  }

  const colisoesColab = detectarColisoesPorAgrupamento(
    colabReais,
    (data) => slugify(data.nome_colaborador),
  );
  const colisoesCustos = detectarColisoesPorAgrupamento(
    custosReais,
    (data) => slugify(String(data.descricao_custo ?? '').trim()),
  );
  // Mesmo critério para clientes em fechamentos/ — não deve haver dois nomes
  // canônicos diferentes compartilhando o mesmo id_estavel. (Pós-3C/3D ok.)
  const colisoesClientesFech = detectarColisoesPorAgrupamento(
    fechClientesComId,
    (data) => slugify(data.nome_cliente ?? ''),
  );

  // -------------------------------------------------
  // Output JSON
  // -------------------------------------------------
  const resultado = {
    timestamp: new Date().toISOString(),
    v1: {
      clientes_base: {
        total: baseDocs.length,
        com_id: baseComId.length,
        sem_id: baseSemId.length,
        detalhes_sem_id: baseSemId.map((d) => ({ docId: d.id })),
      },
      clientes_fechamentos: {
        total: fechClientesDocs.length,
        com_id: fechClientesComId.length,
        sem_id: fechClientesSemId.length,
        detalhes_sem_id: fechClientesSemId.map((d) => ({
          path: d.ref.path,
          nome_cliente: d.data().nome_cliente ?? '(vazio)',
        })),
      },
      colaboradores_fechamentos: {
        total_docs: colabDocs.length,
        ignorados: colabIgnorados.length,
        docs_reais: colabReais.length,
        com_id: colabComId.length,
        sem_id: colabSemId.length,
        detalhes_sem_id: colabSemId.map((d) => ({
          path: d.ref.path,
          nome_colaborador: d.data().nome_colaborador ?? '(vazio)',
        })),
      },
      custosIndiretos_fechamentos: {
        total_docs: custosDocs.length,
        ignorados: custosIgnorados.length,
        docs_reais: custosReais.length,
        com_id: custosComId.length,
        sem_id: custosSemId.length,
        detalhes_sem_id: custosSemId.map((d) => ({
          path: d.ref.path,
          descricao_custo: d.data().descricao_custo ?? '(vazio)',
        })),
      },
    },
    v2: {
      snapshots_orfaos: orfaos.length,
      detalhes: orfaos,
    },
    v3: {
      duplicatas_clientes_base: dupClientesBase.length,
      detalhes_clientes_base: dupClientesBase,
      colisoes_colaboradores: colisoesColab.length,
      detalhes_colaboradores: colisoesColab,
      colisoes_custos: colisoesCustos.length,
      detalhes_custos: colisoesCustos,
      colisoes_clientes_fech: colisoesClientesFech.length,
      detalhes_clientes_fech: colisoesClientesFech,
    },
  };

  console.log(JSON.stringify(resultado, null, 2));
  console.error('[Validar Fase 3] Concluído.');
}

main().catch((e) => {
  console.error('[Validar Fase 3] Erro:', e);
  process.exit(1);
});
