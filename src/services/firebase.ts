// --- Inicialização Firebase (SDK modular v9+) ---
// Funções de leitura das collections do Firestore por período

import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, collectionGroup, getDocs, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, writeBatch, deleteField } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Cliente, Colaborador, CustoIndireto, Parametros, AlteracaoCliente, PeriodoStatus, RegistroPoupanca, PerfilComplexidade, ReajusteSalarial } from '../types';
import type { Vinculo } from '../types/vinculo';
import { BATCH_LIMIT, FUNCOES_ALOCACAO } from '../utils/constants';
import { PARAMETROS_DEFAULT } from '../utils/constants';
import { buscarTetoPorPeriodo } from '../utils/financials.custos';
import { slug } from '../utils/slug';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Obrigatório: rede corporativa com proxy exige long polling
// ignoreUndefinedProperties: campos opcionais com valor undefined são omitidos
// do documento (sem essa flag, setDoc lança "Unsupported field value: undefined"
// e quebra silenciosamente fluxos como o save do modal de Perfil).
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
});

export const auth = getAuth(app);

// ============================================================
// Funções de leitura por período
// Estrutura: fechamentos/{anoMes}/clientes, colaboradores, etc.
// ============================================================

/**
 * Busca todos os clientes de um período.
 * Caminho: fechamentos/{anoMes}/clientes
 */
export async function buscarClientes(anoMes: string): Promise<Cliente[]> {
  try {
    const ref = collection(db, 'fechamentos', anoMes, 'clientes');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Cliente);
  } catch (error) {
    console.error(`[Firebase] Erro ao buscar clientes do período ${anoMes}:`, error);
    throw error;
  }
}

/**
 * Busca todos os colaboradores de um período.
 * Caminho: fechamentos/{anoMes}/colaboradores
 */
export async function buscarColaboradores(anoMes: string): Promise<Colaborador[]> {
  try {
    const ref = collection(db, 'fechamentos', anoMes, 'colaboradores');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Colaborador);
  } catch (error) {
    console.error(`[Firebase] Erro ao buscar colaboradores do período ${anoMes}:`, error);
    throw error;
  }
}

/**
 * Busca todos os vínculos cliente↔colaborador de um período (Fase 2.5 — Peça 5).
 * Caminho: fechamentos/{anoMes}/vinculos
 *
 * O pipeline financeiro (calcularCustoDireto) consome esta lista para resolver
 * colaborador→cliente por id_estavel quando vínculos com pct > 0 existem.
 * Vínculos com pct = 0 ficam latentes — o pipeline cai no fallback dos campos
 * do cliente (leitura dual). Quando Peça 6 popular pct via UI, a migração para
 * vínculos acontece automaticamente sem nenhuma alteração de código adicional.
 */
export async function buscarVinculos(anoMes: string): Promise<Vinculo[]> {
  try {
    const ref = collection(db, 'fechamentos', anoMes, 'vinculos');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Vinculo);
  } catch (error) {
    console.error(`[Firebase] Erro ao buscar vínculos do período ${anoMes}:`, error);
    throw error;
  }
}

/**
 * Salva (merge) um colaborador no período.
 * Caminho: fechamentos/{anoMes}/colaboradores/{id}
 *
 * Princípio 5 (geração defensiva): se o objeto não tiver `id_estavel`,
 * gera UUID v4 antes de gravar — garante que nenhum doc nasça sem o campo
 * por qualquer caminho de código que chegue aqui.
 */
export async function salvarColaboradorPeriodo(
  anoMes: string, colaborador: Colaborador,
): Promise<void> {
  if (!colaborador.id) throw new Error('Colaborador sem id — impossível salvar.');
  const dados = colaborador.id_estavel
    ? colaborador
    : { ...colaborador, id_estavel: crypto.randomUUID() };
  try {
    await setDoc(doc(db, 'fechamentos', anoMes, 'colaboradores', dados.id!), dados);
  } catch (error) {
    console.error(`[Firebase] Erro ao salvar colaborador ${colaborador.id}:`, error);
    throw error;
  }
}

/** Lista todos os períodos (YYYY-MM) onde o colaborador existe, ordenado ASC.
 *  Usa collectionGroup p/ varrer fechamentos/{periodo}/colaboradores e
 *  filtrar por document id. */
export async function buscarPeriodosDoColaborador(
  colaboradorId: string,
): Promise<string[]> {
  try {
    const snap = await getDocs(collectionGroup(db, 'colaboradores'));
    const periodos = snap.docs
      .filter(d => d.id === colaboradorId)
      .map(d => d.ref.path.split('/')[1]);  // fechamentos/{periodo}/colaboradores/{id}
    return [...new Set(periodos)].sort();
  } catch (error) {
    console.error(`[Firebase] Erro ao listar períodos do colaborador ${colaboradorId}:`, error);
    throw error;
  }
}

/** Filtro de propagação multi-período. Determina o subconjunto de períodos
 *  (em fechamentos/) onde o histórico será aplicado.
 *
 *    'todos'        → todos os períodos do colaborador
 *    'a_partir_de'  → períodos >= periodoInicio
 *    'ate'          → períodos <= periodoFim
 *    'intervalo'    → períodos >= periodoInicio && <= periodoFim
 */
export interface FiltroPropagacao {
  tipo: 'todos' | 'a_partir_de' | 'ate' | 'intervalo';
  periodoInicio?: string;  // YYYY-MM
  periodoFim?: string;     // YYYY-MM
}

export function aplicarFiltro(periodos: string[], f: FiltroPropagacao): string[] {
  switch (f.tipo) {
    case 'todos': return periodos;
    case 'a_partir_de':
      return f.periodoInicio ? periodos.filter(p => p >= f.periodoInicio!) : [];
    case 'ate':
      return f.periodoFim ? periodos.filter(p => p <= f.periodoFim!) : [];
    case 'intervalo':
      if (!f.periodoInicio || !f.periodoFim || f.periodoInicio > f.periodoFim) return [];
      return periodos.filter(p => p >= f.periodoInicio! && p <= f.periodoFim!);
  }
}

/** Propaga o histórico de reajustes nos períodos selecionados pelo filtro.
 *  Para cada período, resolve teto/líquido vigentes via buscarTetoPorPeriodo
 *  — assim cada mês recebe o valor contratualmente correto da época, não o
 *  atual. Atualiza em batches de BATCH_LIMIT. Erros por batch acumulados
 *  sem abortar o restante. Reporta progresso após cada commit. */
export async function propagarFolhaColaborador(
  colaboradorId: string,
  historico: ReajusteSalarial[],
  salarioTetoAtual: number,
  liquidoAcordadoAtual: number,
  filtro: FiltroPropagacao,
  onProgress?: (periodo: string, atual: number, total: number) => void,
): Promise<{ periodos: string[]; erros: string[] }> {
  try {
    const snap = await getDocs(collectionGroup(db, 'colaboradores'));
    // Path: fechamentos/{anoMes}/colaboradores/{id}
    const todosDocs = snap.docs.filter(d => d.id === colaboradorId);
    const periodosFiltrados = new Set(aplicarFiltro(
      todosDocs.map(d => d.ref.path.split('/')[1]),
      filtro,
    ));
    const docsAlvo = todosDocs.filter(d => periodosFiltrados.has(d.ref.path.split('/')[1]));
    const total = docsAlvo.length;
    const periodosAtualizados: string[] = [];
    const erros: string[] = [];
    // Stub p/ buscarTetoPorPeriodo — só precisa dos campos consultados.
    const stubColab = {
      salario_teto_cargo: salarioTetoAtual,
      liquido_acordado: liquidoAcordadoAtual,
      historico_reajustes: historico,
    } as Colaborador;

    for (let i = 0; i < docsAlvo.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = docsAlvo.slice(i, i + BATCH_LIMIT);
      for (const d of chunk) {
        const periodo = d.ref.path.split('/')[1];
        const r = buscarTetoPorPeriodo(stubColab, periodo);
        batch.update(d.ref, {
          historico_reajustes: historico,
          salario_teto_cargo: r.salario_teto_cargo,
          liquido_acordado: r.liquido_acordado,
        });
      }
      try {
        await batch.commit();
        for (const d of chunk) {
          const periodo = d.ref.path.split('/')[1];
          periodosAtualizados.push(periodo);
          onProgress?.(periodo, periodosAtualizados.length, total);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        for (const d of chunk) erros.push(`${d.ref.path.split('/')[1]}: ${msg}`);
      }
    }
    return { periodos: periodosAtualizados, erros };
  } catch (error) {
    console.error(`[Firebase] Erro ao propagar folha do colaborador ${colaboradorId}:`, error);
    throw error;
  }
}

/** Lê os campos diretos `salario_teto_cargo` e `liquido_acordado` salvos em
 *  `fechamentos/{periodo}/colaboradores/{id}` para cada colaborador.
 *  Diferente de `buscarTetoPorPeriodo`, NÃO consulta `historico_reajustes` —
 *  retorna o que está literalmente persistido naquele período. Usado pelo
 *  preview da propagação em massa e pelo snapshot da própria propagação. */
export async function buscarDadosFolhaPorPeriodo(
  colaboradores: Colaborador[],
  periodo: string,
): Promise<Record<string, { salario_teto_cargo: number; liquido_acordado: number }>> {
  const result: Record<string, { salario_teto_cargo: number; liquido_acordado: number }> = {};
  await Promise.all(colaboradores.map(async c => {
    if (!c.id) return;
    try {
      const snap = await getDoc(doc(db, 'fechamentos', periodo, 'colaboradores', c.id));
      if (snap.exists()) {
        const d = snap.data();
        result[c.id] = {
          salario_teto_cargo: d.salario_teto_cargo ?? 0,
          liquido_acordado: d.liquido_acordado ?? 0,
        };
      }
    } catch (error) {
      console.error(`[Firebase] Erro ao ler folha de ${c.nome_colaborador} (${periodo}):`, error);
    }
  }));
  return result;
}

/** Propaga a folha de TODOS os colaboradores em massa.
 *
 *  Diferente de `propagarFolhaColaborador` (que reaplica historico_reajustes
 *  por período), esta função:
 *    1. Lê um SNAPSHOT (teto/líquido DIRETOS) de cada colaborador no
 *       `periodoBase` via `buscarDadosFolhaPorPeriodo` — sem consultar
 *       histórico (mostra exatamente o que está salvo no período-base);
 *    2. Aplica esse snapshot em todos os períodos-destino selecionados
 *       (definidos pelo `filtro`) — apenas onde o documento existe.
 *
 *  Não toca em `historico_reajustes` — operação intencional: fixar valores
 *  de um momento específico em vários períodos sem reescrever o histórico.
 *
 *  Pré-busca todos os docs via collectionGroup uma vez para evitar erros
 *  de "doc não existe" em colaboradores que não cobrem todos os períodos. */
export async function propagarFolhaTodosColaboradores(
  colaboradores: Colaborador[],
  periodosDisponiveis: string[],
  periodoBase: string,
  filtro: FiltroPropagacao,
  onProgress?: (
    nomeColaborador: string,
    colaboradorAtual: number,
    totalColaboradores: number,
    periodoAtual: string,
    periodoAtualIdx: number,
    totalPeriodos: number,
  ) => void,
): Promise<{
  colaboradoresAtualizados: number;
  periodosAtualizados: number;
  erros: Array<{ colaborador: string; periodo: string; erro: string }>;
}> {
  const periodosDestino = aplicarFiltro(periodosDisponiveis, filtro);
  const totalColabs = colaboradores.length;
  const totalPeriodos = periodosDestino.length;
  const erros: Array<{ colaborador: string; periodo: string; erro: string }> = [];
  let colabsAtualizados = 0;
  let periodosAtualizadosAcc = 0;

  try {
    // Pré-busca {colabId → Map(periodo → DocumentReference)} para só atualizar
    // onde o doc existe (colaboradores podem não cobrir todos os períodos).
    const allSnap = await getDocs(collectionGroup(db, 'colaboradores'));
    const colabPeriodos = new Map<string, Map<string, typeof allSnap.docs[0]['ref']>>();
    for (const d of allSnap.docs) {
      const periodo = d.ref.path.split('/')[1];
      if (!colabPeriodos.has(d.id)) colabPeriodos.set(d.id, new Map());
      colabPeriodos.get(d.id)!.set(periodo, d.ref);
    }
    // Snapshot direto do período-base (não passa por histórico) — alinha com
    // o preview do wizard e evita divergências em estado inconsistente.
    const snapshotBase = await buscarDadosFolhaPorPeriodo(colaboradores, periodoBase);

    for (let ci = 0; ci < colaboradores.length; ci++) {
      const colab = colaboradores[ci];
      if (!colab.id) {
        for (const p of periodosDestino) erros.push({ colaborador: colab.nome_colaborador, periodo: p, erro: 'colaborador sem id' });
        continue;
      }
      const snapshot = snapshotBase[colab.id];
      if (!snapshot) {
        for (const p of periodosDestino) erros.push({ colaborador: colab.nome_colaborador, periodo: p, erro: `sem dados em ${periodoBase}` });
        continue;
      }
      const refsDoColab = colabPeriodos.get(colab.id) ?? new Map();
      let temSucesso = false;

      for (let pi = 0; pi < periodosDestino.length; pi += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = periodosDestino.slice(pi, pi + BATCH_LIMIT);
        const chunkRefs: Array<{ periodo: string; idx: number }> = [];
        for (let j = 0; j < chunk.length; j++) {
          const periodo = chunk[j];
          const ref = refsDoColab.get(periodo);
          if (!ref) {
            erros.push({ colaborador: colab.nome_colaborador, periodo, erro: 'doc não existe nesse período' });
            continue;
          }
          batch.update(ref, {
            salario_teto_cargo: snapshot.salario_teto_cargo,
            liquido_acordado: snapshot.liquido_acordado,
          });
          chunkRefs.push({ periodo, idx: pi + j });
        }
        if (chunkRefs.length === 0) continue;
        try {
          await batch.commit();
          for (const { periodo, idx } of chunkRefs) {
            periodosAtualizadosAcc++;
            onProgress?.(colab.nome_colaborador, ci + 1, totalColabs, periodo, idx + 1, totalPeriodos);
          }
          temSucesso = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'erro desconhecido';
          for (const { periodo } of chunkRefs) erros.push({ colaborador: colab.nome_colaborador, periodo, erro: msg });
        }
      }
      if (temSucesso) colabsAtualizados++;
    }

    return { colaboradoresAtualizados: colabsAtualizados, periodosAtualizados: periodosAtualizadosAcc, erros };
  } catch (error) {
    console.error('[Firebase] Erro ao propagar folha em massa:', error);
    throw error;
  }
}

/** Persiste o histórico de reajustes salariais e os campos principais
 *  (salario_teto_cargo, liquido_acordado) — espelho da entrada mais recente
 *  para exibição rápida nos cadastros. */
export async function salvarHistoricoReajustes(
  colaboradorId: string,
  periodo: string,
  historico: ReajusteSalarial[],
  salarioTetoAtual: number,
  liquidoAcordadoAtual: number,
): Promise<void> {
  try {
    const ref = doc(db, 'fechamentos', periodo, 'colaboradores', colaboradorId);
    await updateDoc(ref, {
      historico_reajustes: historico,
      salario_teto_cargo: salarioTetoAtual,
      liquido_acordado: liquidoAcordadoAtual,
    });
  } catch (error) {
    console.error(`[Firebase] Erro ao salvar histórico de reajustes ${colaboradorId} (${periodo}):`, error);
    throw error;
  }
}

/** Renomeia um colaborador propagando para todos os clientes em todos os
 *  períodos. Substitui o nome em qualquer dos 6 campos de função
 *  (consultoria_gestao, consultoria_planejamento, consultoria_financeira,
 *  operacional_financeiro, serv_adm, serv_aux_adm) usando match exato OU
 *  normalizado (sem acento, lowercase, espaços colapsados).
 *
 *  Cobertura completa:
 *   - `fechamentos/{periodo}/clientes/{id}` via collectionGroup('clientes')
 *     — atualiza os 6 campos de função
 *   - `clientes_base/{slug}` via collection top-level (collectionGroup
 *     não alcança coleções top-level com nome diferente)
 *   - `fechamentos/{periodo}/colaboradores/{id}` via collectionGroup
 *     ('colaboradores') — atualiza `nome_colaborador` em todos os períodos
 *     (tenta where exato; cai em scan-normalize se índice ausente / vazio).
 *
 *  Resultado: lookup cliente→colaborador permanece consistente em
 *  qualquer período, presente ou passado. */
export async function renomearColaborador(
  nomeAntigo: string,
  nomeNovo: string,
  onProgress?: (etapa: string, atual: number, total: number) => void,
): Promise<{ clientesAtualizados: number; periodosAtualizados: number; erros: string[] }> {
  const normalize = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const alvoNorm = normalize(nomeAntigo);
  const erros: string[] = [];
  const slugsTocados = new Set<string>();
  const periodosTocados = new Set<string>();

  // Constrói update somente p/ campos que batem no nome antigo.
  function montarUpdate(data: Record<string, unknown>): Record<string, string> | null {
    const upd: Record<string, string> = {};
    for (const f of FUNCOES_ALOCACAO) {
      const v = data[f] as string | undefined;
      if (v && (v === nomeAntigo || normalize(v) === alvoNorm)) upd[f] = nomeNovo;
    }
    return Object.keys(upd).length > 0 ? upd : null;
  }

  try {
    // 1) Fechamentos: todos os fechamentos/{periodo}/clientes/{id}
    onProgress?.('Buscando clientes em todos os períodos…', 0, 1);
    const fechSnap = await getDocs(collectionGroup(db, 'clientes'));
    const docsFech = fechSnap.docs
      .map(d => ({ ref: d.ref, data: d.data() as Record<string, unknown>, periodo: d.ref.path.split('/')[1] }))
      .filter(x => montarUpdate(x.data) !== null);
    const totalFech = docsFech.length;

    for (let i = 0; i < docsFech.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = docsFech.slice(i, i + BATCH_LIMIT);
      for (const x of chunk) batch.update(x.ref, montarUpdate(x.data)!);
      try {
        await batch.commit();
        for (const x of chunk) {
          slugsTocados.add(x.ref.id);
          periodosTocados.add(x.periodo);
        }
        onProgress?.('Atualizando fechamentos', Math.min(i + chunk.length, totalFech), totalFech);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        erros.push(`Batch fechamentos #${i / BATCH_LIMIT + 1}: ${msg}`);
      }
    }

    // 2) clientes_base/ (cadastro mestre — collectionGroup não alcança aqui).
    onProgress?.('Lendo cadastro mestre (clientes_base)…', 0, 1);
    const baseSnap = await getDocs(collection(db, 'clientes_base'));
    const docsBase = baseSnap.docs
      .map(d => ({ ref: d.ref, data: d.data() as Record<string, unknown> }))
      .filter(x => montarUpdate(x.data) !== null);
    const totalBase = docsBase.length;

    for (let i = 0; i < docsBase.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = docsBase.slice(i, i + BATCH_LIMIT);
      for (const x of chunk) batch.update(x.ref, montarUpdate(x.data)!);
      try {
        await batch.commit();
        for (const x of chunk) slugsTocados.add(x.ref.id);
        onProgress?.('Atualizando cadastro mestre', Math.min(i + chunk.length, totalBase), totalBase);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        erros.push(`Batch clientes_base #${i / BATCH_LIMIT + 1}: ${msg}`);
      }
    }

    // 3) Colaboradores em todos os períodos: atualiza nome_colaborador no
    //    próprio doc do colaborador em fechamentos/{periodo}/colaboradores/{id}.
    //    Sem isso, períodos passados continuariam com o nome antigo gerando
    //    mismatch no lookup cliente→colaborador do motor financeiro.
    let docsColab: Array<{ ref: import('firebase/firestore').DocumentReference; periodo: string }> = [];
    try {
      // Tentativa 1: query exata. Requer índice composite no Firestore;
      // se não houver, cai no fallback (try/catch).
      const snapExato = await getDocs(query(
        collectionGroup(db, 'colaboradores'),
        where('nome_colaborador', '==', nomeAntigo),
      ));
      snapExato.forEach(d => {
        docsColab.push({ ref: d.ref, periodo: d.ref.path.split('/')[1] });
      });
    } catch {
      // Índice ausente / erro de query — vai pro scan-normalize abaixo.
    }
    // Fallback: scan completo da collectionGroup + filtro normalizado.
    // Necessário porque (a) Firestore não tem case-insensitive nativo;
    // (b) índice composite pode não estar criado.
    if (docsColab.length === 0) {
      const snapTodos = await getDocs(collectionGroup(db, 'colaboradores'));
      for (const d of snapTodos.docs) {
        const nome = (d.data() as Record<string, unknown>).nome_colaborador as string | undefined;
        if (nome && normalize(nome) === alvoNorm) {
          docsColab.push({ ref: d.ref, periodo: d.ref.path.split('/')[1] });
        }
      }
    }
    const totalColab = docsColab.length;
    for (let i = 0; i < docsColab.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = docsColab.slice(i, i + BATCH_LIMIT);
      for (const x of chunk) batch.update(x.ref, { nome_colaborador: nomeNovo });
      try {
        await batch.commit();
        for (const x of chunk) periodosTocados.add(x.periodo);
        onProgress?.('Atualizando cadastro do colaborador nos períodos',
          Math.min(i + chunk.length, totalColab), totalColab);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        erros.push(`Batch colaboradores #${i / BATCH_LIMIT + 1}: ${msg}`);
      }
    }

    return {
      clientesAtualizados: slugsTocados.size,
      periodosAtualizados: periodosTocados.size,
      erros,
    };
  } catch (error) {
    console.error(`[Firebase] Erro ao renomear colaborador "${nomeAntigo}" → "${nomeNovo}":`, error);
    throw error;
  }
}

/** Remove um colaborador apenas do período indicado. */
export async function deletarColaboradorPeriodo(
  anoMes: string, colaboradorId: string,
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'fechamentos', anoMes, 'colaboradores', colaboradorId));
  } catch (error) {
    console.error(`[Firebase] Erro ao excluir colaborador ${colaboradorId} (${anoMes}):`, error);
    throw error;
  }
}

/** Verifica se o período está vazio (3 subcoleções com 0 documentos). */
export async function verificarPeriodoVazio(periodo: string): Promise<boolean> {
  try {
    const [colab, custos, clientes] = await Promise.all([
      getDocs(collection(db, 'fechamentos', periodo, 'colaboradores')),
      getDocs(collection(db, 'fechamentos', periodo, 'custosIndiretos')),
      getDocs(collection(db, 'fechamentos', periodo, 'clientes')),
    ]);
    return colab.empty && custos.empty && clientes.empty;
  } catch (error) {
    console.error(`[Firebase] Erro ao verificar período vazio ${periodo}:`, error);
    throw error;
  }
}

/** Calcula o mês anterior em formato 'YYYY-MM'. Retorna null se inválido. */
export function buscarPeriodoAnterior(periodo: string): string | null {
  const [anoStr, mesStr] = periodo.split('-');
  const ano = parseInt(anoStr);
  const mes = parseInt(mesStr);
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;
  const novoMes = mes === 1 ? 12 : mes - 1;
  const novoAno = mes === 1 ? ano - 1 : ano;
  return `${novoAno}-${String(novoMes).padStart(2, '0')}`;
}

/** Copia colaboradores → custosIndiretos → clientes → vinculos de um período
 *  para outro. Mantém docId. Usa WriteBatch em chunks de BATCH_LIMIT. Reporta
 *  progresso.
 *
 *  Fase 2.5 — Peça 7: vinculos/ entrou na replicação. Sem isso, um período
 *  novo criado por cópia nascia sem vínculos — Alocação em Lote mostrava
 *  pct=0 em tudo e o pipeline caía no fallback legado até alguém gravar
 *  manualmente. */
export async function copiarPeriodo(
  periodoOrigem: string,
  periodoDestino: string,
  onProgress?: (etapa: string, pct: number) => void,
): Promise<{ colaboradores: number; custosIndiretos: number; clientes: number; vinculos: number }> {
  const etapas = [
    { sub: 'colaboradores',   label: 'Colaboradores',     pct: 25  },
    { sub: 'custosIndiretos', label: 'Custos Indiretos',  pct: 50  },
    { sub: 'clientes',        label: 'Clientes',          pct: 75  },
    { sub: 'vinculos',        label: 'Vínculos',          pct: 100 },
  ] as const;

  const contagem = { colaboradores: 0, custosIndiretos: 0, clientes: 0, vinculos: 0 };

  for (const e of etapas) {
    onProgress?.(`Copiando ${e.label}...`, e.pct - 25);
    const snap = await getDocs(collection(db, 'fechamentos', periodoOrigem, e.sub));

    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) {
        batch.set(doc(db, 'fechamentos', periodoDestino, e.sub, d.id), d.data());
      }
      await batch.commit();
    }

    contagem[e.sub] = snap.size;
    onProgress?.(`${e.label} copiados (${snap.size})`, e.pct);
  }

  return contagem;
}

/** Remove o colaborador de todos os períodos posteriores ao inicial.
 *  Retorna a quantidade de períodos afetados.
 *  Usa collectionGroup p/ varrer todos os subdocumentos colaboradores. */
export async function deletarColaboradorPeriodosFuturos(
  colaboradorId: string, periodoInicial: string,
): Promise<number> {
  try {
    const snap = await getDocs(collectionGroup(db, 'colaboradores'));
    let afetados = 0;
    for (const d of snap.docs) {
      if (d.id !== colaboradorId) continue;
      // Path: fechamentos/{anoMes}/colaboradores/{id}
      const partes = d.ref.path.split('/');
      const anoMes = partes[1];
      if (!anoMes || anoMes <= periodoInicial) continue;  // strings 'YYYY-MM' ordenam lexicograficamente
      await deleteDoc(d.ref);
      afetados++;
    }
    return afetados;
  } catch (error) {
    console.error(`[Firebase] Erro ao excluir ${colaboradorId} de períodos futuros:`, error);
    throw error;
  }
}

/**
 * Busca todos os custos indiretos de um período.
 * Caminho: fechamentos/{anoMes}/custosIndiretos
 */
export async function buscarCustosIndiretos(anoMes: string): Promise<CustoIndireto[]> {
  try {
    const ref = collection(db, 'fechamentos', anoMes, 'custosIndiretos');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as CustoIndireto);
  } catch (error) {
    console.error(`[Firebase] Erro ao buscar custos indiretos do período ${anoMes}:`, error);
    throw error;
  }
}

/**
 * Busca registros de poupança (RegistroPoupanca) do período especificado.
 * Fonte de verdade do PL para o cálculo de rebate (CLAUDE.md — decisão arquitetural).
 * Caminho: poupanca/ filtrado por ano e mes.
 */
export async function buscarRegistrosPoupancaPorPeriodo(
  ano: number, mes: number,
): Promise<RegistroPoupanca[]> {
  try {
    const ref = collection(db, 'poupanca');
    const snap = await getDocs(query(ref, where('ano', '==', ano), where('mes', '==', mes)));
    // Filtro de quarentena (Frente 2): registros com status='pendente_normalizacao'
    // são gravados pelo fluxo onshore quando a sigla não foi resolvida (Frente 1).
    // Eles NÃO devem alimentar o cálculo de rebate no DRE — caso contrário, o
    // órfão geraria receita fictícia no EBITDA por cliente. Ausência de status
    // = ativo (retrocompat com os 845 docs pré-Frente 1).
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as RegistroPoupanca)
      .filter(r => r.status !== 'pendente_normalizacao');
  } catch (error) {
    console.error(`[Firebase] Erro ao buscar registros de poupança ${ano}-${mes}:`, error);
    throw error;
  }
}

// ============================================================
// Atualização de cliente individual
// ============================================================

export async function atualizarCliente(
  periodo: string, clienteId: string, dados: Partial<Cliente>,
): Promise<void> {
  try {
    const ref = doc(db, 'fechamentos', periodo, 'clientes', clienteId);
    // Remove campos undefined antes de enviar ao Firestore
    const limpo = Object.fromEntries(Object.entries(dados).filter(([_, v]) => v !== undefined));
    await updateDoc(ref, limpo);
  } catch (error) {
    console.error(`[Firebase] Erro ao atualizar cliente ${clienteId}:`, error);
    throw error;
  }
}

/** Resolve o docId canônico em `fechamentos/{periodo}/clientes/` para um
 *  cliente identificado por `id_estavel`. Existe para corrigir o
 *  Bug Arquitetural #1 (docs-sombra por `setDoc merge`): consumers que
 *  conhecem o cliente pelo `id_estavel` mas guardam `id` vindo de
 *  `clientes_base/` (docId=slug) acabam gravando no doc errado quando o
 *  snapshot do período tem docId=UUID.
 *
 *  Estratégia: query `where('id_estavel', '==', idEstavel)`; se 1+ match,
 *  retorna o docId do primeiro. Se nenhum match (período sem snapshot
 *  para esse cliente — novo cliente, período recém-criado), retorna
 *  `fallbackId` — preserva o comportamento original do `setDoc merge` de
 *  criar doc no período. Erros de query (índice ausente, etc.) também
 *  caem no fallback. */
export async function resolverDocIdClientePorIdEstavel(
  periodo: string,
  idEstavel: string | undefined,
  fallbackId: string,
): Promise<string> {
  if (!idEstavel) return fallbackId;
  try {
    const q = query(
      collection(db, 'fechamentos', periodo, 'clientes'),
      where('id_estavel', '==', idEstavel),
    );
    const snap = await getDocs(q);
    if (snap.empty) return fallbackId;
    return snap.docs[0].id;
  } catch (error) {
    console.warn(`[Firebase] resolverDocId fallback p/ ${idEstavel} em ${periodo}:`, error);
    return fallbackId;
  }
}

// ============================================================
// Parâmetros globais
// ============================================================

export async function buscarParametros(): Promise<Parametros> {
  try {
    const snap = await getDoc(doc(db, 'parametros', 'global'));
    if (!snap.exists()) return PARAMETROS_DEFAULT;
    return { ...PARAMETROS_DEFAULT, ...snap.data() } as Parametros;
  } catch (error) {
    console.error('[Firebase] Erro ao buscar parâmetros:', error);
    return PARAMETROS_DEFAULT;
  }
}

export async function salvarParametros(params: Parametros): Promise<void> {
  try {
    await setDoc(doc(db, 'parametros', 'global'), params);
  } catch (error) {
    console.error('[Firebase] Erro ao salvar parâmetros:', error);
    throw error;
  }
}

// ============================================================
// Clientes base (collection raiz — fonte única de verdade)
// ============================================================

/**
 * Busca todos os clientes da collection raiz clientes_base/.
 *
 * Dedup defensivo por `id_estavel`: proteção contra docs paralelos
 * gerados por re-derivação de slug após renomeação de nome canônico
 * (incidente Allan → ALLAN ANDRADE ELIAS, 2026-05-18). O fix de
 * salvarClienteBase (mesmo commit) elimina a origem; este dedup
 * garante que o AppContext nunca renderize duplicado mesmo se a
 * fonte de dados ficar suja por outro caminho ainda não coberto.
 *
 * Ordem: mantém o primeiro doc encontrado (ordem do Firestore — sem
 * orderBy explícito, geralmente docId asc). Cliente sem id_estavel
 * (legado Fase 3 não migrado) passa sem dedup.
 */
export async function buscarClientesBase(): Promise<Cliente[]> {
  try {
    const ref = collection(db, 'clientes_base');
    const snapshot = await getDocs(ref);
    const todos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Cliente);
    const vistos = new Set<string>();
    return todos.filter(c => {
      if (!c.id_estavel) return true;
      if (vistos.has(c.id_estavel)) {
        console.warn(`[buscarClientesBase] doc duplicado por id_estavel — ignorado: ${c.id} (nome="${c.nome_cliente}")`);
        return false;
      }
      vistos.add(c.id_estavel);
      return true;
    });
  } catch (error) {
    console.error('[Firebase] Erro ao buscar clientes_base:', error);
    throw error;
  }
}

/**
 * Salva (ou atualiza) um cliente em clientes_base/{docId}.
 *
 * docId resolution:
 *  - Em UPDATE (cliente já tem `id`): usa `cliente.id` como docId.
 *    Re-derivar slug do nome causa doc paralelo quando o nome canônico
 *    muda (incidente Allan → ALLAN ANDRADE ELIAS, 2026-05-18).
 *  - Em CREATE (cliente.id ausente): usa `slug(nome_cliente)` como docId.
 *    É o único caso legítimo de derivar slug do nome — primeira gravação,
 *    nada anterior a preservar.
 *
 * Princípio 5 (geração defensiva): se o objeto não tiver `id_estavel`,
 * gera UUID v4 antes de gravar — garante que nenhum cliente nasça sem
 * identidade lógica por qualquer caminho de código.
 */
export async function salvarClienteBase(cliente: Cliente): Promise<void> {
  const docIdCliente = cliente.id ?? slug(cliente.nome_cliente ?? '');
  const dados = cliente.id_estavel
    ? cliente
    : { ...cliente, id_estavel: crypto.randomUUID() };
  try {
    await setDoc(doc(db, 'clientes_base', docIdCliente), dados, { merge: true });
  } catch (error) {
    console.error('[Firebase] Erro ao salvar cliente_base:', error);
    throw error;
  }
}

/** Cria cliente novo em `clientes_base/` + snapshot inicial em
 *  `fechamentos/{periodo}/clientes/`. Caso de uso: ramo "novo cliente" do
 *  formulário Cadastrar Sigla Nova (Manutenção) — fluxo end-to-end de
 *  registrar cliente que aparece pela primeira vez via lâmina.
 *
 *  Padrão alinhado com NovoClienteModal: pct_* zerados (atribuir equipe
 *  depois via Alocação em Lote), id_estavel via UUID v4 imutável,
 *  uniqueness check em clientes_base/{slug} antes de gravar. Difere em
 *  consolidar as 2 escritas num único helper reutilizável.
 *
 *  Rebate em DECIMAL (já `/100` pelo caller). Alíquota também em decimal.
 *  Retorna `id_estavel` (UUID gerado), `slugCliente` (docId) e lista de
 *  erros (vazia se sucesso). Em caso de uniqueness fail, retorna
 *  `slugCliente=''` e mensagem em `erros`. */
export async function criarClienteNovo(params: {
  nomeCompleto: string;
  pacoteServico: 'full' | 'advanced' | 'light' | 'future' | 'asset_only';
  percentualRebateOnshore: number;
  percentualRebateOffshore: number;
  aliquotaImpostosRebate: number;
  receitaFee: number;
  utilizaServicoJuridico: boolean;
  utilizaConciliacao: boolean;
  dataEntrada: string;        // 'YYYY-MM'
  periodo: string;            // 'YYYY-MM' — destino do snapshot inicial
}): Promise<{ id_estavel: string; slugCliente: string; erros: string[] }> {
  const {
    nomeCompleto, pacoteServico,
    percentualRebateOnshore, percentualRebateOffshore, aliquotaImpostosRebate,
    receitaFee, utilizaServicoJuridico, utilizaConciliacao,
    dataEntrada, periodo,
  } = params;
  const erros: string[] = [];

  const nome = nomeCompleto.trim();
  if (!nome) return { id_estavel: '', slugCliente: '', erros: ['Nome do cliente vazio.'] };
  const slugCliente = slug(nome);
  if (!slugCliente) return { id_estavel: '', slugCliente: '', erros: ['Nome inválido (sem caracteres alfanuméricos).'] };

  // Uniqueness check — não sobrescrever doc existente.
  const refBase = doc(db, 'clientes_base', slugCliente);
  const snapBase = await getDoc(refBase);
  if (snapBase.exists()) {
    const existente = snapBase.data() as Cliente;
    erros.push(`Cliente "${existente.nome_cliente}" já existe em clientes_base/${slugCliente}.`);
    return { id_estavel: '', slugCliente: '', erros };
  }

  const id_estavel = crypto.randomUUID();
  const novo: Cliente = {
    id_estavel,
    nome_cliente: nome,
    receita_fee: pacoteServico === 'asset_only' ? 0 : receitaFee,
    percentual_rebate_anual_onshore: percentualRebateOnshore,
    percentual_rebate_anual_offshore: percentualRebateOffshore,
    aliquota_impostos_rebate: aliquotaImpostosRebate,
    utiliza_servico_juridico: utilizaServicoJuridico,
    utiliza_conciliacao: utilizaConciliacao,
    pacote_servico: pacoteServico,
    // pct_* zerados — atribuição via Alocação em Lote depois.
    pct_consultoria_gestao: 0,
    pct_consultoria_planejamento: 0,
    pct_consultoria_financeira: 0,
    pct_operacional_financeiro: 0,
    pct_serv_adm: 0,
    pct_serv_aux_adm: 0,
    data_entrada: dataEntrada,
  };

  try {
    await salvarClienteBase(novo);
    await setDoc(doc(db, 'fechamentos', periodo, 'clientes', slugCliente), novo);
    return { id_estavel, slugCliente, erros: [] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Firebase] Erro ao criar cliente novo:', error);
    erros.push(`Falha ao gravar cliente: ${msg}`);
    return { id_estavel: '', slugCliente: '', erros };
  }
}

/**
 * Persiste o perfil de complexidade de um cliente.
 *
 * Split de armazenamento (CLAUDE.md \u2014 perfil de complexidade):
 *  - Drivers fixos (qtd_*, planejamento_tributario, revisao_contratos,
 *    gestao_obra, grupos_financeiros) \u2192 clientes_base/{slug}.perfil_complexidade
 *  - Volumetria mensal (volume_movimentos_mes, qtd_recebiveis_mes,
 *    qtd_contratacoes_mes) \u2192 fechamentos/{periodo}/clientes/{id} (top-level
 *    no documento do Cliente, N\u00c3O dentro de perfil_complexidade)
 *
 * volumetria opcional \u2014 s\u00f3 grava o que vier no objeto. clienteId s\u00f3 \u00e9
 * obrigat\u00f3rio se houver volume a salvar.
 */
export async function salvarPerfilComplexidade(
  nomeCliente: string,
  perfil: PerfilComplexidade,
  periodoSelecionado: string,
  volume?: { volume_movimentos_mes?: number; qtd_recebiveis_mes?: number; qtd_contratacoes_mes?: number },
  clienteId?: string,
): Promise<void> {
  const slugCliente = slug(nomeCliente);
  try {
    await updateDoc(doc(db, 'clientes_base', slugCliente), { perfil_complexidade: perfil });
    if (volume && clienteId) {
      const limpo = Object.fromEntries(Object.entries(volume).filter(([_, v]) => v !== undefined));
      if (Object.keys(limpo).length > 0) {
        await updateDoc(doc(db, 'fechamentos', periodoSelecionado, 'clientes', clienteId), limpo);
      }
    }
  } catch (error) {
    console.error('[Firebase] Erro ao salvar perfil de complexidade:', error);
    throw error;
  }
}

// ============================================================
// Fechamento de período
// ============================================================

export async function buscarStatusPeriodo(periodo: string): Promise<PeriodoStatus | null> {
  try {
    const snap = await getDoc(doc(db, 'periodos_status', periodo));
    if (!snap.exists()) return null;
    return snap.data() as PeriodoStatus;
  } catch (error) {
    console.error(`[Firebase] Erro ao buscar status do período ${periodo}:`, error);
    return null;
  }
}

export async function fecharPeriodo(
  periodo: string,
  dados: { fechado_por: string; total_clientes: number; receita_total: number },
): Promise<void> {
  // 1. Copiar clientes_base/ para fechamentos/{periodo}/clientes/
  const clientesSnap = await getDocs(collection(db, 'clientes_base'));
  const docs = clientesSnap.docs;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const destRef = doc(db, 'fechamentos', periodo, 'clientes', d.id);
      batch.set(destRef, d.data());
    }
    await batch.commit();
  }

  // 2. Registrar status do período
  await setDoc(doc(db, 'periodos_status', periodo), {
    periodo,
    fechado: true,
    fechado_em: new Date().toISOString(),
    fechado_por: dados.fechado_por,
    total_clientes: dados.total_clientes,
    receita_total: dados.receita_total,
  } satisfies PeriodoStatus);

  console.log(`[Firebase] Período ${periodo} fechado com ${docs.length} clientes`);
}

export async function reabrirPeriodo(periodo: string, reaberto_por: string): Promise<void> {
  await updateDoc(doc(db, 'periodos_status', periodo), {
    fechado: false,
    reaberto_em: new Date().toISOString(),
    reaberto_por,
  });
  console.log(`[Firebase] Período ${periodo} reaberto por ${reaberto_por}`);
}

// ============================================================
// Histórico de alterações de clientes
// ============================================================


/**
 * Registra uma alteração na subcoleção clientes_base/{slug}/historico_alteracoes/.
 */
export async function registrarAlteracao(
  clienteNome: string,
  alteracao: AlteracaoCliente,
): Promise<void> {
  const slugCliente = slug(clienteNome);
  try {
    await addDoc(collection(db, 'clientes_base', slugCliente, 'historico_alteracoes'), alteracao);
  } catch (error) {
    console.error(`[Firebase] Erro ao registrar alteração para ${clienteNome}:`, error);
  }
}

/**
 * Busca histórico de alterações de um cliente, ordenado por data desc.
 */
export async function buscarHistoricoAlteracoes(
  clienteNome: string,
): Promise<AlteracaoCliente[]> {
  const slugCliente = slug(clienteNome);
  try {
    const ref = collection(db, 'clientes_base', slugCliente, 'historico_alteracoes');
    const snap = await getDocs(query(ref, orderBy('alterado_em', 'desc')));
    return snap.docs.map(d => d.data() as AlteracaoCliente);
  } catch (error) {
    console.error(`[Firebase] Erro ao buscar histórico de ${clienteNome}:`, error);
    return [];
  }
}

// ============================================================
// Correção de registros de poupança
// ============================================================

/** Atualiza `nome_cliente` em todos os docs de `poupanca/` que casam com
 *  `nomeAntigo` (match exato OU normalizado: NFD + lowercase + sem acento).
 *  Útil para corrigir grafias inconsistentes que vieram do parser de lâmina
 *  (ex: "FUNDAÇÃO FENOMENOS" → "FUNDAÇÃO FENÔMENOS").
 *
 *  Frente 1.5 — normalização de quarentena:
 *  Critério de match expandido — também casa quando
 *  `sigla_bruta_origem === nomeAntigo` (após normalização). Assim a UI atual
 *  ("Corrigir Nomes em Poupança" com 2 inputs em Configurações → Manutenção)
 *  funciona tanto para renomear cliente já cadastrado (caso legado) quanto
 *  para normalizar uma sigla órfã (caso pós-Frente 1) — basta o usuário
 *  passar a sigla bruta como `nomeAntigo`.
 *
 *  Update expandido — quando o registro está em quarentena
 *  (status='pendente_normalizacao'), o update também:
 *    - remove status (deleteField)
 *    - remove sigla_bruta_origem (deleteField)
 *  Resultado: o registro deixa o limbo e passa a contar nos agregados a
 *  partir do próximo refresh do AppContext / usePoupanca. */
export async function corrigirNomeClientePoupanca(
  nomeAntigo: string,
  nomeNovo: string,
): Promise<{ atualizados: number; erros: string[] }> {
  const norm = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const alvoNorm = norm(nomeAntigo);
  const erros: string[] = [];
  let atualizados = 0;
  try {
    const snap = await getDocs(collection(db, 'poupanca'));
    const docsAlvo = snap.docs.filter(d => {
      const data = d.data() as Record<string, unknown>;
      const nome = data.nome_cliente as string | undefined;
      const sigla = data.sigla_bruta_origem as string | undefined;
      // Match em nome_cliente (caso legado de renomeação) OU em
      // sigla_bruta_origem (caso pós-Frente 1 de normalização de quarentena).
      const matchNome = !!nome && (nome === nomeAntigo || norm(nome) === alvoNorm);
      const matchSigla = !!sigla && (sigla === nomeAntigo || norm(sigla) === alvoNorm);
      return matchNome || matchSigla;
    });
    for (let i = 0; i < docsAlvo.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = docsAlvo.slice(i, i + BATCH_LIMIT);
      for (const d of chunk) {
        const data = d.data() as Record<string, unknown>;
        const update: Record<string, unknown> = { nome_cliente: nomeNovo };
        // Se está em quarentena, limpar o estado — o registro volta a contar
        // nos agregados a partir do próximo refresh.
        if (data.status === 'pendente_normalizacao' || data.sigla_bruta_origem != null) {
          update.status = deleteField();
          update.sigla_bruta_origem = deleteField();
        }
        batch.update(d.ref, update);
      }
      try {
        await batch.commit();
        atualizados += chunk.length;
      } catch (err) {
        erros.push(`Batch #${i / BATCH_LIMIT + 1}: ${err instanceof Error ? err.message : 'erro'}`);
      }
    }
    return { atualizados, erros };
  } catch (error) {
    console.error(`[Firebase] Erro ao corrigir nomes em poupanca ("${nomeAntigo}" → "${nomeNovo}"):`, error);
    throw error;
  }
}

export async function corrigirRegistroPoupanca(
  docId: string,
  campos: Partial<RegistroPoupanca>,
): Promise<void> {
  try {
    const limpo = Object.fromEntries(Object.entries(campos).filter(([_, v]) => v !== undefined));
    await updateDoc(doc(db, 'poupanca', docId), limpo);
  } catch (error) {
    console.error(`[Firebase] Erro ao corrigir poupanca/${docId}:`, error);
    throw error;
  }
}

// ============================================================
// Mapeamento de siglas (Firestore — complementa o hardcoded)
// ============================================================

/** Entrada do mapeamento de siglas persistido no Firestore.
 *  Usada quando o usuário resolve uma sigla nova durante o upload de lâmina. */
export interface EntradaMapeamentoSigla {
  codigo: string;          // código da conta/carteira (também base do doc id)
  sigla: string;            // sigla curta interna
  nome_cliente: string;    // nome completo do cliente
  registrado_em: string;   // ISO timestamp da criação
  registrado_por?: string; // nome/email de quem registrou
  atualizado_em?: string;  // ISO timestamp da última correção pontual
}

/** Sanitiza códigos para uso como ID de doc (Firestore proíbe `/`, `.` etc). */
function siglaDocId(codigo: string): string {
  return codigo.replace(/[/.\s#$\[\]]/g, '_');
}

/** Lê todo o mapeamento de siglas do Firestore. Retorno é indexado por
 *  `codigo` original (não pelo docId sanitizado) para casamento direto. */
export async function buscarMapeamentoSiglas(): Promise<Record<string, EntradaMapeamentoSigla>> {
  try {
    const snap = await getDocs(collection(db, 'mapeamento_siglas'));
    const result: Record<string, EntradaMapeamentoSigla> = {};
    for (const d of snap.docs) {
      const data = d.data() as EntradaMapeamentoSigla;
      result[data.codigo] = data;
    }
    return result;
  } catch (error) {
    console.error('[Firebase] Erro ao ler mapeamento de siglas:', error);
    return {};
  }
}

/** Persiste uma entrada nova/atualizada do mapeamento de siglas. */
export async function salvarEntradaMapeamento(entrada: EntradaMapeamentoSigla): Promise<void> {
  try {
    await setDoc(doc(db, 'mapeamento_siglas', siglaDocId(entrada.codigo)), entrada);
  } catch (error) {
    console.error(`[Firebase] Erro ao salvar mapeamento de sigla "${entrada.codigo}":`, error);
    throw error;
  }
}

/** Corrige `nome_cliente` de UMA entrada existente do mapeamento de siglas.
 *  Não cria entrada nova (retorna `atualizou: false` se não existe — o
 *  caminho normal de criação é via `ResolverSiglasModal` ou
 *  `executarMigracaoMapeamento`). Marca `atualizado_em` com timestamp. */
export async function corrigirEntradaMapeamentoSiglas(
  codigo: string,
  nomeNovo: string,
): Promise<{ atualizou: boolean; mensagem: string }> {
  const docRef = doc(db, 'mapeamento_siglas', siglaDocId(codigo));
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      const msg = `Entrada "${codigo}" não encontrada em mapeamento_siglas/. Crie-a primeiro via Migração ou ResolverSiglasModal.`;
      console.warn(`[MapeamentoSiglas] ${msg}`);
      return { atualizou: false, mensagem: msg };
    }
    await updateDoc(docRef, {
      nome_cliente: nomeNovo,
      atualizado_em: new Date().toISOString(),
    });
    const msg = `Entrada "${codigo}" atualizada para "${nomeNovo}".`;
    console.log(`[MapeamentoSiglas] ${msg}`);
    return { atualizou: true, mensagem: msg };
  } catch (error) {
    console.error(`[Firebase] Erro ao corrigir entrada "${codigo}":`, error);
    throw error;
  }
}

/** Propaga novo `nome_cliente` para todos os snapshots em
 *  `fechamentos/*​/clientes/` que apontam para o mesmo `id_estavel`.
 *  Match por `id_estavel` (não por nome) garante consistência cross-período
 *  mesmo quando snapshots históricos têm grafias divergentes.
 *
 *  Análogo a `renomearColaborador`, mas para cliente — onde a chave canônica
 *  é o `id_estavel` (UUID v4 imutável da Fase 3), não os 6 campos de função.
 *  Idempotente: snapshots cujo `nome_cliente` já bate com `nomeNovo` são
 *  pulados (não geram write desnecessário).
 *
 *  Erros por batch são acumulados sem abortar — o caller decide o que fazer
 *  com erros parciais. */
async function propagarNomeClientePorIdEstavel(
  idEstavel: string,
  nomeNovo: string,
): Promise<{ atualizados: number; periodos: Set<string>; erros: string[] }> {
  const erros: string[] = [];
  const periodos = new Set<string>();
  let atualizados = 0;
  try {
    const snap = await getDocs(collectionGroup(db, 'clientes'));
    const alvos = snap.docs.filter(d => {
      const data = d.data() as Record<string, unknown>;
      return data.id_estavel === idEstavel && data.nome_cliente !== nomeNovo;
    });
    for (let i = 0; i < alvos.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = alvos.slice(i, i + BATCH_LIMIT);
      for (const d of chunk) batch.update(d.ref, { nome_cliente: nomeNovo });
      try {
        await batch.commit();
        for (const d of chunk) periodos.add(d.ref.path.split('/')[1]);
        atualizados += chunk.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        erros.push(`Batch fechamentos #${i / BATCH_LIMIT + 1}: ${msg}`);
      }
    }
    return { atualizados, periodos, erros };
  } catch (error) {
    console.error(`[Firebase] Erro ao propagar nome para id_estavel ${idEstavel}:`, error);
    throw error;
  }
}

/** Cadastra uma sigla nova em `mapeamento_siglas/` e amarra ao cliente
 *  existente em `clientes_base/`, num único ato auditável. Caso de uso:
 *  lâmina nova chega com sigla desconhecida (ex: `AAE_BTG`); operador
 *  abre Manutenção, vincula ao cliente que já existe, opcionalmente
 *  oficializa um nome canônico, e o sistema normaliza tudo de uma vez.
 *
 *  Ordem das operações:
 *
 *  1. Lê `clientes_base/{slug}` — aborta se não existir ou se faltar
 *     `id_estavel` (cliente precisa estar na Fase 3, com identidade estável).
 *  2. Se `nomeCanonicoNovo` difere do atual:
 *     a. Atualiza `clientes_base/{slug}.nome_cliente`.
 *     b. Propaga para `fechamentos/*​/clientes/` via id_estavel
 *        (propagarNomeClientePorIdEstavel).
 *     c. Atualiza `poupanca/` com o nome antigo via
 *        corrigirNomeClientePoupanca — alinha grafias antigas no histórico
 *        (separado da limpeza de quarentena no passo 4).
 *  3. Cria entrada em `mapeamento_siglas/{siglaDocId(codigoCompleto)}` com
 *     `merge: false` semântico — usa `getDoc` antes para abortar se já
 *     existir (não sobrescreve silenciosamente). Inclui campo novo
 *     `id_estavel_cliente` para join futuro sem depender de nome.
 *  4. Limpa quarentena: chama corrigirNomeClientePoupanca com
 *     `nomeAntigo=codigoCompleto` — encontra docs de `poupanca/` com
 *     `sigla_bruta_origem=codigoCompleto`, grava `nome_cliente=nomeNovo`,
 *     remove `status` e `sigla_bruta_origem`.
 *
 *  Retorna `{ sucesso, mensagens, erros }` — `sucesso=false` apenas se
 *  alguma etapa crítica falhou (cliente não existe, mapeamento já existia).
 *  Erros de batch parciais aparecem em `erros` mas não abortam — quem
 *  consome decide se mostra como aviso ou falha. */
export async function cadastrarSiglaNova(params: {
  sigla: string;             // 'AAE'
  codigoCompleto: string;    // 'AAE_BTG' — o que aparece na lâmina
  slugClienteExistente: string;  // 'allan' — docId em clientes_base/
  nomeCanonicoNovo: string;  // 'ALLAN ANDRADE ELIAS'
  registradoPor?: string;
}): Promise<{ sucesso: boolean; mensagens: string[]; erros: string[] }> {
  const { sigla, codigoCompleto, slugClienteExistente, nomeCanonicoNovo, registradoPor } = params;
  const mensagens: string[] = [];
  const erros: string[] = [];

  // ── Passo 1: ler clientes_base/{slug} ─────────────────────────────────
  const clienteRef = doc(db, 'clientes_base', slugClienteExistente);
  const clienteSnap = await getDoc(clienteRef);
  if (!clienteSnap.exists()) {
    return {
      sucesso: false,
      mensagens: [],
      erros: [`Cliente "${slugClienteExistente}" não existe em clientes_base/.`],
    };
  }
  const cliente = clienteSnap.data() as Record<string, unknown>;
  const idEstavel = cliente.id_estavel as string | undefined;
  if (!idEstavel) {
    return {
      sucesso: false,
      mensagens: [],
      erros: [`Cliente "${slugClienteExistente}" não tem id_estavel (Fase 3 incompleta).`],
    };
  }
  const nomeAtual = cliente.nome_cliente as string;

  // ── Passo 2: atualizar nome canônico (se mudou) ───────────────────────
  if (nomeCanonicoNovo !== nomeAtual) {
    try {
      await updateDoc(clienteRef, { nome_cliente: nomeCanonicoNovo });
      mensagens.push(`clientes_base/${slugClienteExistente}: "${nomeAtual}" → "${nomeCanonicoNovo}"`);
    } catch (err) {
      erros.push(`Falha ao atualizar clientes_base: ${err instanceof Error ? err.message : 'erro'}`);
    }

    try {
      const prop = await propagarNomeClientePorIdEstavel(idEstavel, nomeCanonicoNovo);
      if (prop.atualizados > 0) {
        mensagens.push(`${prop.atualizados} snapshot(s) em ${prop.periodos.size} período(s) atualizado(s).`);
      }
      erros.push(...prop.erros);
    } catch (err) {
      erros.push(`Falha ao propagar para fechamentos: ${err instanceof Error ? err.message : 'erro'}`);
    }

    try {
      const r = await corrigirNomeClientePoupanca(nomeAtual, nomeCanonicoNovo);
      if (r.atualizados > 0) {
        mensagens.push(`${r.atualizados} doc(s) em poupanca/ alinhado(s) ao novo nome.`);
      }
      erros.push(...r.erros);
    } catch (err) {
      erros.push(`Falha ao alinhar poupanca/: ${err instanceof Error ? err.message : 'erro'}`);
    }
  }

  // ── Passo 3: criar entrada em mapeamento_siglas/ (sem sobrescrever) ───
  const mapRef = doc(db, 'mapeamento_siglas', siglaDocId(codigoCompleto));
  const mapSnap = await getDoc(mapRef);
  if (mapSnap.exists()) {
    erros.push(
      `Entrada "${codigoCompleto}" já existe em mapeamento_siglas/. ` +
      'Use "Corrigir Entrada no Mapeamento de Siglas" para alterá-la.',
    );
    return { sucesso: false, mensagens, erros };
  }
  try {
    await setDoc(mapRef, {
      codigo: codigoCompleto,
      sigla,
      nome_cliente: nomeCanonicoNovo,
      id_estavel_cliente: idEstavel,
      registrado_em: new Date().toISOString(),
      registrado_por: registradoPor ?? 'manutencao_cfo',
      criado_via: 'manutencao_cfo',
    });
    mensagens.push(`mapeamento_siglas/${siglaDocId(codigoCompleto)} criado (sigla=${sigla}).`);
  } catch (err) {
    erros.push(`Falha ao criar mapeamento: ${err instanceof Error ? err.message : 'erro'}`);
    return { sucesso: false, mensagens, erros };
  }

  // ── Passo 4: normalizar quarentena via sigla_bruta_origem ─────────────
  try {
    const q = await corrigirNomeClientePoupanca(codigoCompleto, nomeCanonicoNovo);
    if (q.atualizados > 0) {
      mensagens.push(`${q.atualizados} doc(s) em quarentena normalizado(s).`);
    }
    erros.push(...q.erros);
  } catch (err) {
    erros.push(`Falha ao normalizar quarentena: ${err instanceof Error ? err.message : 'erro'}`);
  }

  return { sucesso: true, mensagens, erros };
}

// ============================================================
// Manutenção pontual de poupanca/ — limpeza de tombamento espúrio
// ============================================================

/** Zera um campo de tombamento em um doc específico de `poupanca/`. Caso de
 *  uso: limpar `nnm_tombamento_offshore` stale gerado por re-import histórico
 *  com `hasPrev = false` (a sequência foi corrigida depois, mas o `merge:
 *  true` preservou o campo). Read-then-write com checagem de existência —
 *  retorna `corrigido: false` se o campo já está vazio/zero (não escreve). */
export async function zerarCampoTombamento(
  docId: string,
  campo: 'nnm_tombamento_offshore' | 'nnm_tombamento_onshore' | 'nnm_tombamento',
): Promise<{ corrigido: boolean; mensagem: string }> {
  const ref = doc(db, 'poupanca', docId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { corrigido: false, mensagem: `Documento não encontrado: ${docId}` };
    }
    const valorAtual = (snap.data() as Record<string, unknown>)[campo];
    if (valorAtual == null || valorAtual === 0) {
      return { corrigido: false, mensagem: `Campo ${campo} já está vazio/zero em ${docId}` };
    }
    await updateDoc(ref, { [campo]: 0 });
    const fmt = Number(valorAtual).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const mensagem = `${campo} zerado em ${docId} (era: R$ ${fmt})`;
    console.log(`[Tombamento] ${mensagem}`);
    return { corrigido: true, mensagem };
  } catch (error) {
    console.error(`[Firebase] Erro ao zerar ${campo} em ${docId}:`, error);
    throw error;
  }
}

// ============================================================
// Exclusão de cliente
// ============================================================

/** Remove cliente APENAS do período indicado (não toca clientes_base/ nem
 *  outros períodos). Usado quando o cliente saiu da carteira em um mês mas
 *  pode voltar — preserva histórico. */
export async function excluirClientePeriodo(
  clienteId: string,
  periodo: string,
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'fechamentos', periodo, 'clientes', clienteId));
  } catch (error) {
    console.error(`[Firebase] Erro ao excluir cliente ${clienteId} de ${periodo}:`, error);
    throw error;
  }
}

/** Exclui PERMANENTEMENTE o cliente: remove de todos os períodos via
 *  collectionGroup('clientes') + remove de clientes_base/. Operação
 *  irreversível. Reporta progresso por período. */
export async function excluirClientePermanente(
  clienteId: string,
  onProgress?: (periodo: string, atual: number, total: number) => void,
): Promise<{ periodosRemovidos: number; erros: string[] }> {
  const erros: string[] = [];
  let periodosRemovidos = 0;
  try {
    const snap = await getDocs(collectionGroup(db, 'clientes'));
    const docsAlvo = snap.docs.filter(d => d.id === clienteId);
    const total = docsAlvo.length;
    for (let i = 0; i < docsAlvo.length; i++) {
      const d = docsAlvo[i];
      const periodo = d.ref.path.split('/')[1];
      try {
        await deleteDoc(d.ref);
        periodosRemovidos++;
        onProgress?.(periodo, i + 1, total);
      } catch (err) {
        erros.push(`${periodo}: ${err instanceof Error ? err.message : 'erro'}`);
      }
    }
    // Cadastro mestre — collectionGroup não alcança coleção top-level.
    try {
      await deleteDoc(doc(db, 'clientes_base', clienteId));
    } catch (err) {
      erros.push(`clientes_base: ${err instanceof Error ? err.message : 'erro'}`);
    }
    return { periodosRemovidos, erros };
  } catch (error) {
    console.error(`[Firebase] Erro ao excluir cliente ${clienteId} permanentemente:`, error);
    throw error;
  }
}

export default app;
