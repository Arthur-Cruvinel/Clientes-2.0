// --- Integração AUM (poupança → rebate) ---
// Busca PL atualizado por cliente da coleção poupanca para uso no cálculo de rebate.
// Cacheia em memória para não repetir queries na mesma sessão.

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { RegistroPoupanca } from '../types';

// ============================================================
// Interface pública
// ============================================================

export interface AumCliente {
  nome_cliente: string;
  pl_onshore: number;
  pl_offshore: number;
  pl_total: number;
  ano: number;
  mes: number;
  periodo_label: string; // ex: "Mar/2025"
}

// ============================================================
// Cache em memória — chave "YYYY-MM"
// ============================================================

const cache = new Map<string, Map<string, AumCliente>>();

// ============================================================
// Função auxiliar
// ============================================================

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatPeriodoLabel(mes: number, ano: number): string {
  return `${MESES[mes - 1]}/${ano}`;
}

// ============================================================
// Função principal
// ============================================================

export async function buscarAumPorPeriodo(
  ano: number,
  mes: number,
): Promise<Map<string, AumCliente>> {
  const chaveCache = `${ano}-${String(mes).padStart(2, '0')}`;

  // Retorna cache se já buscou nesta sessão
  if (cache.has(chaveCache)) {
    return cache.get(chaveCache)!;
  }

  console.log('[AumIntegration] Buscando AUM para', ano, mes);

  const poupancaRef = collection(db, 'poupanca');

  // 1. Tentar período exato
  let docs = await getDocs(
    query(poupancaRef, where('ano', '==', ano), where('mes', '==', mes)),
  );

  // 2. Se não encontrou, buscar o período mais recente disponível anterior
  if (docs.empty) {
    console.log(`[AumIntegration] Período ${ano}-${mes} não encontrado, buscando mais recente...`);

    const todosSnap = await getDocs(poupancaRef);
    const periodoAlvo = ano * 12 + mes;

    // Encontrar o período mais recente anterior ao solicitado
    let melhorPeriodo = -1;
    let anoFound = 0;
    let mesFound = 0;

    todosSnap.forEach((d) => {
      const data = d.data();
      const p = (data.ano as number) * 12 + (data.mes as number);
      if (p < periodoAlvo && p > melhorPeriodo) {
        melhorPeriodo = p;
        anoFound = data.ano as number;
        mesFound = data.mes as number;
      }
    });

    if (melhorPeriodo === -1) {
      // Nenhum período anterior encontrado — retorna vazio
      console.log('[AumIntegration] Nenhum período anterior encontrado');
      const vazio = new Map<string, AumCliente>();
      cache.set(chaveCache, vazio);
      return vazio;
    }

    console.log(`[AumIntegration] Período ${ano}-${mes} não encontrado, usando ${anoFound}-${mesFound}`);

    docs = await getDocs(
      query(poupancaRef, where('ano', '==', anoFound), where('mes', '==', mesFound)),
    );
  }

  // 3. Montar Map de resultados
  const resultado = new Map<string, AumCliente>();

  docs.forEach((d) => {
    const data = d.data() as RegistroPoupanca;
    // Filtro de quarentena (Frente 2): registros pendentes não alimentam o
    // Map AUM, então não viram Pure Asset sintetizado no AppContext e não
    // geram rebate fictício no DRE. Ausência de status = ativo (retrocompat).
    if (data.status === 'pendente_normalizacao') return;
    const plOnshore = (data.pl_onshore as number) ?? 0;

    // PL offshore: preferir USD × PTAX se disponível
    let plOffshore: number;
    if (data.pl_offshore_usd && data.ptax_fechamento) {
      plOffshore = (data.pl_offshore_usd as number) * (data.ptax_fechamento as number);
    } else {
      plOffshore = (data.pl_offshore as number) ?? 0;
    }

    const plTotal = (data.pl_total as number) ?? (plOnshore + plOffshore);
    // Chave do Map normalizada: NFD + remove combining marks + UPPER + trim.
    // Mesma normalização usada em AppContext.normNome — garante match entre
    // grafias diferentes ("FENÔMENOS" vs "FENOMENOS"). O nome_cliente
    // exibido permanece com a grafia normalizada (sem acentos) para
    // consistência com o resto do pipeline.
    const nomeNormalizado = ((data.nome_cliente as string) ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

    if (!nomeNormalizado) return;

    resultado.set(nomeNormalizado, {
      nome_cliente: nomeNormalizado,
      pl_onshore: plOnshore,
      pl_offshore: plOffshore,
      pl_total: plTotal,
      ano: data.ano as number,
      mes: data.mes as number,
      periodo_label: formatPeriodoLabel(data.mes as number, data.ano as number),
    });
  });

  console.log('[AumIntegration] Encontrados', resultado.size, 'clientes');

  cache.set(chaveCache, resultado);
  return resultado;
}
