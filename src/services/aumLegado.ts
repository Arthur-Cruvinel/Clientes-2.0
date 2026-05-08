// --- Serviço de AUM Legado (investimentos Gestão Galácticos em Patrimônio) ---
// Busca investimentos marcados como gestao_galaticos na estrutura:
//   patrimonio/{clienteSlug}/investimentos/{id}
// Como o Firestore não lista docs pai de subcoleções orphãs,
// iteramos os slugs de clientes_base/ para encontrar investimentos.

import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { InvestimentoExterno } from '../types';

let cacheResult: { porMes: Map<string, number>; total: number } | null = null;

export async function buscarAumLegado(): Promise<{ porMes: Map<string, number>; total: number }> {
  if (cacheResult) return cacheResult;

  console.log('[AumLegado] Buscando investimentos Gestao Galaticos...');

  // Buscar slugs de clientes_base (fonte de verdade dos clientes)
  const clientesSnap = await getDocs(collection(db, 'clientes_base'));
  const investimentos: InvestimentoExterno[] = [];

  // Para cada cliente, buscar subcoleção patrimonio/{slug}/investimentos/
  for (const clienteDoc of clientesSnap.docs) {
    const slug = clienteDoc.id;
    try {
      const invsSnap = await getDocs(collection(db, 'patrimonio', slug, 'investimentos'));
      for (const invDoc of invsSnap.docs) {
        const inv = { id: invDoc.id, ...invDoc.data() } as InvestimentoExterno;
        if (inv.gestao_galaticos) investimentos.push(inv);
      }
    } catch {
      // Subcoleção não existe para este cliente — ignorar
    }
  }

  if (investimentos.length === 0) {
    console.log('[AumLegado] Nenhum investimento Gestao Galaticos encontrado');
    cacheResult = { porMes: new Map(), total: 0 };
    return cacheResult;
  }

  // Agrupar por mês (data_referencia "YYYY-MM-DD" → "YYYY-MM")
  const porMesRaw = new Map<string, number>();
  let totalAtual = 0;
  for (const inv of investimentos) {
    const valor = inv.valor_brl ?? inv.valor ?? 0;
    totalAtual += valor;
    if (!inv.data_referencia) continue;
    const chave = inv.data_referencia.substring(0, 7);
    porMesRaw.set(chave, (porMesRaw.get(chave) ?? 0) + valor);
  }

  // Carry forward: preencher meses sem dado com último valor conhecido
  const mesesOrdenados = [...porMesRaw.keys()].sort();
  const porMes = new Map<string, number>();

  if (mesesOrdenados.length > 0) {
    const [anoIni, mesIni] = mesesOrdenados[0].split('-').map(Number);
    const hoje = new Date();
    const anoFim = hoje.getFullYear();

    let ultimoValor = 0;
    for (let a = anoIni; a <= anoFim + 1; a++) {
      for (let m = (a === anoIni ? mesIni : 1); m <= 12; m++) {
        const chave = `${a}-${String(m).padStart(2, '0')}`;
        if (porMesRaw.has(chave)) ultimoValor = porMesRaw.get(chave)!;
        porMes.set(chave, ultimoValor);
        if (a === anoFim + 1) break;
      }
    }
  }

  console.log(`[AumLegado] ${investimentos.length} investimentos, total: R$ ${totalAtual.toLocaleString()}`);

  cacheResult = { porMes, total: totalAtual };
  return cacheResult;
}

export function invalidarCacheAumLegado() {
  cacheResult = null;
}
