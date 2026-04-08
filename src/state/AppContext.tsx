// --- Contexto principal da aplicação ---
// Gerencia período, regime, visão financeira, parâmetros e dados processados.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ResultadoProcessamento, RegimeTributario, VisaoFinanceira, Parametros } from '../types';
import { PARAMETROS_DEFAULT } from '../utils/constants';
import {
  buscarClientes,
  buscarColaboradores,
  buscarCustosIndiretos,
  buscarParametros,
} from '../services/firebase';
import { processarDados } from '../utils/financials';

interface AppState {
  dadosPeriodo: ResultadoProcessamento | null;
  periodoSelecionado: string;
  setPeriodoSelecionado: (p: string) => void;
  regime: RegimeTributario;
  setRegime: (r: RegimeTributario) => void;
  visaoFinanceira: VisaoFinanceira;
  setVisaoFinanceira: (v: VisaoFinanceira) => void;
  parametros: Parametros;
  setParametros: (p: Parametros) => void;
  recarregar: () => void;
  loading: boolean;
  erro: string | null;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');
  const [regime, setRegime] = useState<RegimeTributario>('presumido');
  const [visaoFinanceira, setVisaoFinanceira] = useState<VisaoFinanceira>('ebitda');
  const [parametros, setParametros] = useState<Parametros>(PARAMETROS_DEFAULT);
  const [dadosPeriodo, setDadosPeriodo] = useState<ResultadoProcessamento | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Buscar parâmetros uma vez na inicialização
  useEffect(() => {
    buscarParametros().then(setParametros);
  }, []);

  // Auto-detectar período com dados: tenta mês anterior, depois recua até 12 meses
  useEffect(() => {
    if (periodoSelecionado) return;
    let cancelado = false;
    (async () => {
      const hoje = new Date();
      for (let i = 1; i <= 12; i++) {
        if (cancelado) return;
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const tentativa = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        try {
          const clientes = await buscarClientes(tentativa);
          if (clientes.length > 0) {
            if (!cancelado) setPeriodoSelecionado(tentativa);
            return;
          }
        } catch { /* tenta o próximo */ }
      }
    })();
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarPeriodo = useCallback(async (periodo: string, regimeAtual: RegimeTributario, params: Parametros) => {
    if (!periodo) return;
    setLoading(true);
    setErro(null);
    try {
      const [clientes, colaboradores, custosIndiretos] = await Promise.all([
        buscarClientes(periodo),
        buscarColaboradores(periodo),
        buscarCustosIndiretos(periodo),
      ]);
      if (clientes.length === 0) {
        setDadosPeriodo(null);
        setErro(`Nenhum dado encontrado para o período ${periodo}`);
        return;
      }
      const resultado = processarDados(clientes, colaboradores, custosIndiretos, regimeAtual, params, periodo);
      setDadosPeriodo(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[AppContext] Erro ao carregar período ${periodo}:`, error);
      setErro(mensagem);
      setDadosPeriodo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const recarregar = useCallback(() => {
    carregarPeriodo(periodoSelecionado, regime, parametros);
  }, [carregarPeriodo, periodoSelecionado, regime, parametros]);

  // Recarrega quando período, regime ou parâmetros mudam
  useEffect(() => {
    carregarPeriodo(periodoSelecionado, regime, parametros);
  }, [periodoSelecionado, regime, parametros, carregarPeriodo]);

  return (
    <AppContext.Provider
      value={{
        dadosPeriodo, periodoSelecionado, setPeriodoSelecionado,
        regime, setRegime, visaoFinanceira, setVisaoFinanceira,
        parametros, setParametros, recarregar, loading, erro,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp() deve ser usado dentro de <AppProvider>');
  return ctx;
}
