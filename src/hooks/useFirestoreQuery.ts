import { useEffect, useState } from 'react';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Hook genérico para buscar uma collection do Firestore.
 * Retorna os documentos como array tipado.
 */
export function useFirestoreQuery<T = DocumentData>(caminho: string) {
  const [dados, setDados] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function buscar() {
      try {
        setCarregando(true);
        const snapshot = await getDocs(collection(db, caminho));
        if (!cancelado) {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
          setDados(docs);
          setErro(null);
        }
      } catch (e) {
        if (!cancelado) {
          console.error(`[Firestore] Erro ao buscar ${caminho}:`, e);
          setErro(e instanceof Error ? e.message : 'Erro desconhecido');
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    buscar();
    return () => { cancelado = true; };
  }, [caminho]);

  return { dados, carregando, erro };
}
