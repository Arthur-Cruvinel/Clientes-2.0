// --- Serviço de AUM Legado (investimentos Gestão Galácticos em Patrimônio) ---
// Busca investimentos marcados como gestao_galaticos na estrutura:
//   patrimonio/{clienteSlug}/investimentos/{id}
// Como o Firestore não lista docs pai de subcoleções orphãs,
// iteramos os slugs de clientes_base/ para encontrar investimentos.

import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { InvestimentoExterno } from '../types';

export interface AumLegadoResult {
  // ── Total consolidado (mantido para retrocompatibilidade) ────────────
  porMes: Map<string, number>;
  total: number;
  // ── Decomposição por dimensão (inferida pela moeda do investimento) ──
  // Convenção: BRL → onshore, USD/EUR/GBP → offshore. É a mesma convenção
  // implícita usada no UI de cadastro (PatrimonioInvestimentos.tsx — só
  // ativa fluxo PTAX quando moeda !== 'BRL'). Furo conhecido: investimento
  // BRL custodiado offshore (raro) cai como onshore. Sem campo explícito
  // de dimensão na interface InvestimentoExterno.
  totalOnshore: number;
  totalOffshore: number;
  porMesOnshore: Map<string, number>;
  porMesOffshore: Map<string, number>;
}

let cacheResult: AumLegadoResult | null = null;

export async function buscarAumLegado(): Promise<AumLegadoResult> {
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

  // Resultado vazio padrão — usado como early return e fallback.
  const vazio: AumLegadoResult = {
    porMes: new Map(), total: 0,
    totalOnshore: 0, totalOffshore: 0,
    porMesOnshore: new Map(), porMesOffshore: new Map(),
  };

  if (investimentos.length === 0) {
    console.log('[AumLegado] Nenhum investimento Gestao Galaticos encontrado');
    cacheResult = vazio;
    return cacheResult;
  }

  // Agrupar por mês (data_referencia "YYYY-MM-DD" → "YYYY-MM"),
  // separando em 3 séries: total, onshore, offshore.
  const porMesRaw = new Map<string, number>();
  const porMesOnRaw = new Map<string, number>();
  const porMesOffRaw = new Map<string, number>();
  let totalAtual = 0;
  let totalOnshoreAtual = 0;
  let totalOffshoreAtual = 0;

  for (const inv of investimentos) {
    const valor = inv.valor_brl ?? inv.valor ?? 0;
    // Dimensão inferida pela moeda — ver doc da interface acima.
    const isOnshore = inv.moeda === 'BRL';
    totalAtual += valor;
    if (isOnshore) totalOnshoreAtual += valor;
    else totalOffshoreAtual += valor;

    if (!inv.data_referencia) continue;
    const chave = inv.data_referencia.substring(0, 7);
    porMesRaw.set(chave, (porMesRaw.get(chave) ?? 0) + valor);
    if (isOnshore) {
      porMesOnRaw.set(chave, (porMesOnRaw.get(chave) ?? 0) + valor);
    } else {
      porMesOffRaw.set(chave, (porMesOffRaw.get(chave) ?? 0) + valor);
    }
  }

  // Carry forward: preencher meses sem dado com último valor conhecido.
  // Aplicado igual nas 3 séries (total, onshore, offshore).
  function carryForward(raw: Map<string, number>): Map<string, number> {
    const ordenado = [...raw.keys()].sort();
    if (ordenado.length === 0) return new Map();
    const [anoIni, mesIni] = ordenado[0].split('-').map(Number);
    const hoje = new Date();
    const anoFim = hoje.getFullYear();
    const out = new Map<string, number>();
    let ultimoValor = 0;
    for (let a = anoIni; a <= anoFim + 1; a++) {
      for (let m = (a === anoIni ? mesIni : 1); m <= 12; m++) {
        const chave = `${a}-${String(m).padStart(2, '0')}`;
        if (raw.has(chave)) ultimoValor = raw.get(chave)!;
        out.set(chave, ultimoValor);
        if (a === anoFim + 1) break;
      }
    }
    return out;
  }

  const porMes = carryForward(porMesRaw);
  const porMesOnshore = carryForward(porMesOnRaw);
  const porMesOffshore = carryForward(porMesOffRaw);

  console.log(
    `[AumLegado] ${investimentos.length} investimentos | total: R$ ${totalAtual.toLocaleString()}`
    + ` (on: R$ ${totalOnshoreAtual.toLocaleString()} | off: R$ ${totalOffshoreAtual.toLocaleString()})`,
  );

  cacheResult = {
    porMes, total: totalAtual,
    totalOnshore: totalOnshoreAtual,
    totalOffshore: totalOffshoreAtual,
    porMesOnshore, porMesOffshore,
  };
  return cacheResult;
}

export function invalidarCacheAumLegado() {
  cacheResult = null;
}
