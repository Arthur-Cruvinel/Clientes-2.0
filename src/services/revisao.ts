// --- Service de marcação de revisão pendente ---
// Suporta dois níveis:
//   1. Cliente inteiro: doc único `flags/revisao_clientes` com mapa de slugs
//   2. Mês individual: campo `revisao_pendente` no doc `poupanca/{slug_ano_mes}`

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const FLAGS_DOC = doc(db, 'flags', 'revisao_clientes');

/** Slugify igual ao usado em useImportPoupanca para gerar IDs consistentes. */
export function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// ============================================================
// Cliente-level: doc único com mapa
// ============================================================

/**
 * Lê o conjunto de slugs de clientes marcados para revisão.
 * Retorna Set vazio se o doc ainda não existir.
 */
export async function buscarClientesMarcados(): Promise<Set<string>> {
  try {
    const snap = await getDoc(FLAGS_DOC);
    if (!snap.exists()) return new Set();
    const data = snap.data();
    const mapa = data.clientes_marcados as Record<string, boolean> | undefined;
    if (!mapa) return new Set();
    return new Set(Object.keys(mapa).filter(k => mapa[k] === true));
  } catch (e) {
    console.error('[Revisao] Erro ao buscar clientes marcados:', e);
    return new Set();
  }
}

/**
 * Marca/desmarca um cliente para revisão. O slug é derivado do nome.
 * Operação idempotente — chamar duas vezes com mesmo valor é seguro.
 */
export async function definirRevisaoCliente(nomeCliente: string, marcado: boolean): Promise<void> {
  const slug = slugify(nomeCliente);
  // Atualização parcial do mapa: { clientes_marcados: { [slug]: true } } ou false pra remover
  const update: Record<string, unknown> = {};
  if (marcado) {
    update[`clientes_marcados.${slug}`] = true;
  } else {
    // Para "desmarcar" usamos null no campo do mapa, que efetivamente remove.
    // Mas o Firestore não tem deleteField inline aqui — usamos setDoc com merge
    // e estado completo, ou updateDoc com sentinela. Optamos por gravar false
    // (mais simples; o filtro em buscarClientesMarcados ignora false).
    update[`clientes_marcados.${slug}`] = false;
  }
  try {
    // updateDoc falha se o doc não existe; tentamos primeiro e fazemos
    // fallback pra setDoc na primeira gravação.
    await updateDoc(FLAGS_DOC, update);
  } catch {
    await setDoc(FLAGS_DOC, {
      clientes_marcados: { [slug]: marcado },
    }, { merge: true });
  }
}

// ============================================================
// Mês-level: campo no doc da poupanca
// ============================================================

/**
 * Marca/desmarca um mês específico de um cliente para revisão.
 * Atualiza o campo `revisao_pendente` no documento `poupanca/{slug}_{ano}_{mes}`.
 */
export async function definirRevisaoMes(
  nomeCliente: string,
  ano: number,
  mes: number,
  marcado: boolean,
): Promise<void> {
  const slug = slugify(nomeCliente);
  const docId = `${slug}_${ano}_${mes}`;
  const ref = doc(db, 'poupanca', docId);
  try {
    await updateDoc(ref, { revisao_pendente: marcado });
  } catch (e) {
    console.error(`[Revisao] Erro ao atualizar mes ${docId}:`, e);
    throw e;
  }
}
