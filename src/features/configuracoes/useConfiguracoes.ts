// --- Hook de configurações — lê e salva parâmetros globais ---

import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { salvarParametros } from '../../services/firebase';
import type { Parametros } from '../../types';

export function useConfiguracoes() {
  const { parametros, setParametros } = useApp();
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function salvar(novosParams: Parametros) {
    setSalvando(true);
    setToast(null);
    try {
      await salvarParametros(novosParams);
      setParametros(novosParams);
      setToast('Configurações salvas');
    } catch (e) {
      setToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSalvando(false);
    }
  }

  return { parametros, salvar, salvando, toast, setToast };
}
