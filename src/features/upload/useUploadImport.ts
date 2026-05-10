// --- Hook de upload e importação Excel → Firestore ---
// Lê xlsx via SheetJS, parseia 4 abas, escreve em batch no Firestore.

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { collection, doc, writeBatch, setDoc, getDocs, query, where } from 'firebase/firestore';
import { BATCH_LIMIT } from '../../utils/constants';
import { slug } from '../../utils/slug';
import {
  parseColaboradores, parseClientes, parseCustosIndiretos,
  parsePoupanca, verificarAbas,
} from './parseExcel';
import type { Cliente, Colaborador, CustoIndireto, RegistroPoupanca } from '../../types';

// ============================================================
// Tipos exportados
// ============================================================

export interface PreviewDados {
  colaboradores: Colaborador[];
  clientes: Cliente[];
  custosIndiretos: CustoIndireto[];
  poupanca: RegistroPoupanca[];
  abasAusentes: string[];
}

export interface LogEntry {
  colecao: string;
  status: 'ok' | 'erro';
  mensagem: string;
}

type Etapa = 'selecao' | 'preview' | 'importando' | 'concluido';

// ============================================================
// Helpers
// ============================================================


/** Remove campos undefined — Firestore rejeita undefined, aceita apenas null ou ausência. */
function sanitizeDoc(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

/** Apaga todos os docs de uma subcollection (em batches). */
async function wipeSubcollection(periodo: string, subcol: string) {
  const ref = collection(db, 'fechamentos', periodo, subcol);
  const snapshot = await getDocs(ref);
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Apaga subcollection de um período e retorna contagem. */
export async function limparCollection(periodo: string, subcol: string): Promise<number> {
  const ref = collection(db, 'fechamentos', periodo, subcol);
  const snapshot = await getDocs(ref);
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

/** Apaga poupança de um mês/ano específico via query. */
export async function limparPoupancaMes(ano: number, mes: number): Promise<number> {
  const ref = collection(db, 'poupanca');
  const q = query(ref, where('ano', '==', ano), where('mes', '==', mes));
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

/** Conta quantos períodos (docs pai) existem em fechamentos/. */
export async function contarPeriodos(): Promise<number> {
  const ref = collection(db, 'fechamentos');
  const snapshot = await getDocs(ref);
  return snapshot.docs.length;
}

/** Apaga subcollection em TODOS os períodos existentes. */
export async function limparCollectionTodosPeriodos(
  nomeCollection: string,
): Promise<{ registros: number; periodos: number }> {
  const ref = collection(db, 'fechamentos');
  const snapshot = await getDocs(ref);
  let registros = 0;
  let periodos = 0;
  for (const docPai of snapshot.docs) {
    const count = await limparCollection(docPai.id, nomeCollection);
    if (count > 0) periodos++;
    registros += count;
  }
  return { registros, periodos };
}

/** Apaga TODA a collection de poupança. */
export async function limparTodaPoupanca(): Promise<number> {
  const ref = collection(db, 'poupanca');
  const snapshot = await getDocs(ref);
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

// ============================================================
// Hook
// ============================================================

export function useUploadImport() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [etapa, setEtapa] = useState<Etapa>('selecao');
  const [preview, setPreview] = useState<PreviewDados | null>(null);
  const [loteInfo, setLoteInfo] = useState({ loteAtual: 0, loteTotal: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  const periodo = `${ano}-${String(mes).padStart(2, '0')}`;

  // ----------------------------------------------------------
  // Leitura do arquivo Excel (parse automático ao selecionar)
  // ----------------------------------------------------------
  const lerArquivo = useCallback(async (file: File) => {
    setErro(null);
    setPreview(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const { ausentes } = verificarAbas(wb);

      const dados: PreviewDados = {
        colaboradores: parseColaboradores(wb),
        clientes: parseClientes(wb),
        custosIndiretos: parseCustosIndiretos(wb),
        poupanca: parsePoupanca(wb),
        abasAusentes: ausentes,
      };

      if (dados.clientes.length === 0 && dados.colaboradores.length === 0) {
        setErro('Nenhum dado encontrado. Verifique se as abas estão nomeadas corretamente.');
        return;
      }

      setPreview(dados);
      setEtapa('preview');
    } catch (e) {
      console.error('[Upload] Erro ao ler arquivo:', e);
      setErro(e instanceof Error ? e.message : 'Erro ao ler o arquivo Excel');
    }
  }, []);

  // ----------------------------------------------------------
  // Escrita em batch
  // ----------------------------------------------------------
  async function escreverBatch(
    subcol: string,
    dados: Record<string, unknown>[],
  ) {
    const ref = collection(db, 'fechamentos', periodo, subcol);
    const totalLotes = Math.ceil(dados.length / BATCH_LIMIT);

    for (let i = 0; i < dados.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = dados.slice(i, i + BATCH_LIMIT);
      for (const item of chunk) {
        const docRef = doc(ref, crypto.randomUUID());
        batch.set(docRef, sanitizeDoc(item));
      }
      await batch.commit();
      const loteNum = Math.floor(i / BATCH_LIMIT) + 1;
      setLoteInfo(prev => ({ ...prev, loteAtual: prev.loteAtual + 1 }));
      console.log(`[Upload] ${subcol}: lote ${loteNum}/${totalLotes}`);
    }
  }

  async function upsertPoupanca(dados: Record<string, unknown>[]) {
    const totalLotes = Math.ceil(dados.length / BATCH_LIMIT);

    for (let i = 0; i < dados.length; i += BATCH_LIMIT) {
      const chunk = dados.slice(i, i + BATCH_LIMIT);
      // setDoc com merge:true em paralelo dentro do lote
      const promises = chunk.map(item => {
        const slugCliente = slug(String(item['nome_cliente'] ?? ''));
        const docId = `${slugCliente}_${item['ano']}_${item['mes']}`;
        const docRef = doc(db, 'poupanca', docId);
        return setDoc(docRef, sanitizeDoc(item), { merge: true });
      });
      await Promise.all(promises);
      const loteNum = Math.floor(i / BATCH_LIMIT) + 1;
      setLoteInfo(prev => ({ ...prev, loteAtual: prev.loteAtual + 1 }));
      console.log(`[Upload] poupanca: lote ${loteNum}/${totalLotes}`);
    }
  }

  // ----------------------------------------------------------
  // Importar tudo
  // ----------------------------------------------------------
  const importar = useCallback(async () => {
    if (!preview) return;
    setMostrarConfirmacao(false);
    setEtapa('importando');
    setLogs([]);
    setErro(null);

    // Calcular total de lotes
    const lotesTotal =
      Math.ceil(preview.colaboradores.length / BATCH_LIMIT) +
      Math.ceil(preview.clientes.length / BATCH_LIMIT) +
      Math.ceil(preview.custosIndiretos.length / BATCH_LIMIT) +
      Math.ceil(preview.poupanca.length / BATCH_LIMIT);
    setLoteInfo({ loteAtual: 0, loteTotal: lotesTotal });

    const novoLogs: LogEntry[] = [];

    // Colaboradores — wipe-and-replace
    try {
      await wipeSubcollection(periodo, 'colaboradores');
      await escreverBatch('colaboradores', preview.colaboradores as unknown as Record<string, unknown>[]);
      novoLogs.push({ colecao: 'colaboradores', status: 'ok', mensagem: `${preview.colaboradores.length} registros` });
    } catch (e) {
      novoLogs.push({ colecao: 'colaboradores', status: 'erro', mensagem: String(e) });
    }

    // Clientes — salvar em clientes_base/ (collection raiz)
    try {
      const clienteDocs = preview.clientes as unknown as Record<string, unknown>[];
      for (let i = 0; i < clienteDocs.length; i += BATCH_LIMIT) {
        const chunk = clienteDocs.slice(i, i + BATCH_LIMIT);
        const promises = chunk.map(item => {
          const slugCliente = slug(String(item['nome_cliente'] ?? ''));
          const docRef = doc(db, 'clientes_base', slugCliente);
          return setDoc(docRef, sanitizeDoc(item));
        });
        await Promise.all(promises);
        setLoteInfo(prev => ({ ...prev, loteAtual: prev.loteAtual + 1 }));
      }
      novoLogs.push({ colecao: 'clientes_base', status: 'ok', mensagem: `${preview.clientes.length} registros` });
    } catch (e) {
      novoLogs.push({ colecao: 'clientes_base', status: 'erro', mensagem: String(e) });
    }

    // Custos Indiretos — wipe-and-replace
    try {
      await wipeSubcollection(periodo, 'custosIndiretos');
      await escreverBatch('custosIndiretos', preview.custosIndiretos as unknown as Record<string, unknown>[]);
      novoLogs.push({ colecao: 'custosIndiretos', status: 'ok', mensagem: `${preview.custosIndiretos.length} registros` });
    } catch (e) {
      novoLogs.push({ colecao: 'custosIndiretos', status: 'erro', mensagem: String(e) });
    }

    // Poupança — upsert (setDoc merge:true)
    try {
      await upsertPoupanca(preview.poupanca as unknown as Record<string, unknown>[]);
      novoLogs.push({ colecao: 'poupanca', status: 'ok', mensagem: `${preview.poupanca.length} registros (upsert)` });
    } catch (e) {
      novoLogs.push({ colecao: 'poupanca', status: 'erro', mensagem: String(e) });
    }

    setLogs(novoLogs);
    setEtapa('concluido');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, periodo]);

  const resetar = useCallback(() => {
    setEtapa('selecao');
    setPreview(null);
    setLoteInfo({ loteAtual: 0, loteTotal: 0 });
    setLogs([]);
    setErro(null);
  }, []);

  return {
    mes, setMes, ano, setAno, periodo,
    etapa, preview, loteInfo, logs, erro,
    mostrarConfirmacao, setMostrarConfirmacao,
    lerArquivo, importar, resetar,
  };
}
