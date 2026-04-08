// --- Inicialização Firebase (SDK modular v9+) ---
// Funções de leitura das collections do Firestore por período

import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Cliente, Colaborador, CustoIndireto, Parametros } from '../types';
import { PARAMETROS_DEFAULT } from '../utils/constants';

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
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
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

export default app;
