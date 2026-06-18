// --- Contexto principal da aplicação ---
// Gerencia período, regime, visão financeira, parâmetros e dados processados.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Cliente, DadosPeriodo, RegimeTributario, VisaoFinanceira, Parametros, PeriodoStatus } from '../types';
import { PARAMETROS_DEFAULT } from '../utils/constants';
import {
  buscarClientesBase,
  buscarClientes,
  buscarColaboradores,
  buscarCustosIndiretos,
  buscarCustosDedicados,
  buscarParametros,
  semearAliquotasRebate,
  buscarStatusPeriodo,
  buscarRegistrosPoupancaPorPeriodo,
  buscarVinculos,
  verificarPeriodoVazio,
  buscarPeriodoAnterior,
  copiarPeriodo,
} from '../services/firebase';
import { processarPeriodo, calcularFolhaColaborador, resolverClientePorPeriodo } from '../utils/financials';
import { buscarAumPorPeriodo, type AumCliente } from '../services/aumIntegration';
import { ModalCopiarPeriodo, type ResumoCopia } from '../components/ui/ModalCopiarPeriodo';

interface AppState {
  dadosPeriodo: DadosPeriodo | null;
  aumMap: Map<string, AumCliente> | null;
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
  periodoFechado: boolean;
  statusPeriodo: PeriodoStatus | null;
  iniciarCopiaManual: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');
  const [regime, setRegime] = useState<RegimeTributario>('presumido');
  const [visaoFinanceira, setVisaoFinanceira] = useState<VisaoFinanceira>('ebitda');
  const [parametros, setParametros] = useState<Parametros>(PARAMETROS_DEFAULT);
  const [dadosPeriodo, setDadosPeriodo] = useState<DadosPeriodo | null>(null);
  const [aumMap, setAumMap] = useState<Map<string, AumCliente> | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [periodoFechado, setPeriodoFechado] = useState(false);
  const [statusPeriodo, setStatusPeriodo] = useState<PeriodoStatus | null>(null);
  const [periodoParaCopiar, setPeriodoParaCopiar] = useState<{
    origem: string;
    destino: string;
    modo: 'automatico' | 'manual';
  } | null>(null);

  // Buscar parâmetros uma vez na inicialização. Antes, semeia (idempotente) as
  // alíquotas de rebate por perna se ausentes — para que TabRebate as edite.
  useEffect(() => {
    semearAliquotasRebate().finally(() => buscarParametros().then(setParametros));
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
          const colaboradores = await buscarColaboradores(tentativa);
          if (colaboradores.length > 0) {
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
      // Verificar se o período está fechado
      const status = await buscarStatusPeriodo(periodo);
      const fechado = status?.fechado === true;
      setPeriodoFechado(fechado);
      setStatusPeriodo(status);

      // Detecção automática de período vazio: se vazio e anterior tem dados,
      // dispara modal de cópia em paralelo. Não bloqueia o restante do load.
      try {
        const vazio = await verificarPeriodoVazio(periodo);
        if (vazio) {
          const anterior = buscarPeriodoAnterior(periodo);
          if (anterior && !(await verificarPeriodoVazio(anterior))) {
            setPeriodoParaCopiar({ origem: anterior, destino: periodo, modo: 'automatico' });
          }
        }
      } catch { /* não interrompe o fluxo principal */ }

      // Extrair ano/mes do período (necessário p/ buscar poupança em paralelo).
      const [anoStr, mesStr] = periodo.split('-');
      const ano = parseInt(anoStr);
      const mes = parseInt(mesStr);

      // Se fechado: buscar snapshot de fechamentos/{periodo}/clientes/
      // Se aberto: buscar de clientes_base/ (dados atuais)
      // poupanca/ é a fonte de PL do período (CLAUDE.md — decisão arquitetural).
      // vinculos/ é a estrutura nova da Fase 2.5 — pipeline usa via leitura dual.
      const [clientes, colaboradoresRaw, custosIndiretos, registrosPoupanca, vinculos, custosDedicados] = await Promise.all([
        fechado ? buscarClientes(periodo) : buscarClientesBase(),
        buscarColaboradores(periodo),
        buscarCustosIndiretos(periodo),
        buscarRegistrosPoupancaPorPeriodo(ano, mes),
        buscarVinculos(periodo),
        // custosDedicados/ — custo_administrativo_dedicado VARIÁVEL por período
        // (estrutura nova). Vazia até o usuário repreender os meses.
        buscarCustosDedicados(periodo),
      ]);

      // Sempre recalcula a folha completa a partir dos campos base — valores
      // no Firestore podem estar defasados (tabelas INSS/IRRF mudam todo ano,
      // fórmula antiga não tinha PLR). Convergem quando o admin salva via
      // modal. CLAUDE.md (decisão arquitetural).
      // Passa `periodo` para que o motor use o teto correto via histórico
      // de reajustes (buscarTetoPorPeriodo) — sem histórico cai no fallback
      // dos campos diretos.
      const anoPeriodo = ano;
      const colaboradores = colaboradoresRaw.map(c => {
        const r = calcularFolhaColaborador(c, anoPeriodo, periodo);
        return {
          ...c,
          custo_total_mensal: r.custo_total_mensal,
          custo_hora: r.custo_hora,
          inss: r.inss,
          irrf: r.irrf_liquido,
          complemento_plr: r.complemento_plr,
          reflexos_plr_mensal: r.reflexos_plr_mensal,
          encargos_patronais: r.encargos_patronais,
          decimo_terceiro_ferias: r.decimo_terceiro_ferias,
        };
      });

      // ── Overlay do custo administrativo dedicado (estrutura por período) ──────
      // custo_administrativo_dedicado migrou de mono-instância no master para
      // valor VARIÁVEL por período em fechamentos/{periodo}/custosDedicados/
      // {id_estavel}. Para cada cliente COM doc na estrutura nova, sobrepõe o
      // valor do período no objeto cliente. SEM doc (estrutura ainda vazia / mês
      // não repreendido) → MANTÉM o valor antigo do master como FALLBACK (não
      // força zero). Isso alimenta de uma vez as 3 superfícies: engine
      // (financials.dre.ts), CadastralTab read-only e o form do modal.
      // FALLBACK TEMPORÁRIO: será removido quando o campo antigo for desativado
      // (passo futuro, depois do repreenchimento dos meses).
      const dedicadoPorIdEstavel = new Map(
        custosDedicados
          .filter(d => d.id_estavel_cliente)
          .map(d => [d.id_estavel_cliente, d.custo_administrativo_dedicado]),
      );
      const clientesComDedicado = clientes.map(c => {
        const comDedicado = (c.id_estavel && dedicadoPorIdEstavel.has(c.id_estavel))
          ? { ...c, custo_administrativo_dedicado: dedicadoPorIdEstavel.get(c.id_estavel) }
          : c;
        // Overlay de VIGÊNCIA (Tier A): resolve fee/moeda/rebate/contabilidade/
        // pagamento do cliente para o período (forward-only). Histórico vazio →
        // no-op (retrocompat). Mesmo padrão do overlay do administrativo: alimenta
        // o motor (DRE/EBITDA) E a UI de uma vez, sem threadar período no pipeline.
        return resolverClientePorPeriodo(comDedicado, periodo);
      });

      // Filtrar clientes por data_entrada (só aparecem a partir do período de entrada)
      const periodoAtual = ano * 12 + mes;
      const clientesFiltrados = clientesComDedicado.filter(c => {
        if (!c.data_entrada) return true; // sem data_entrada: sempre aparece
        const [anoEnt, mesEnt] = c.data_entrada.split('-').map(Number);
        return (anoEnt * 12 + mesEnt) <= periodoAtual;
      });

      // Buscar AUM atualizado da coleção poupanca (Map p/ overlay/Pure Asset)
      const aumPeriodo = await buscarAumPorPeriodo(ano, mes);
      setAumMap(aumPeriodo);

      if (clientesFiltrados.length === 0 && aumPeriodo.size === 0) {
        setDadosPeriodo(null);
        setErro(`Nenhum dado encontrado para o período ${periodo}`);
        return;
      }

      // Identificar clientes do AUM ausentes do fechamento → sintetizar como Pure Asset.
      // PL não vai no objeto Cliente — o motor (processarPeriodo) lê PL direto
      // do RegistroPoupanca via lookup por nome_cliente. O Pure Asset entra só
      // como "ficha cadastral mínima" para o motor saber que ele existe.
      //
      // Normalização: NFD + remove combining marks + UPPER + trim. Sem isto,
      // "FUNDAÇÃO FENÔMENOS" (fechamento) ≠ "FUNDAÇÃO FENOMENOS" (poupanca)
      // por causa do circunflexo, gerando duplicata de Pure Asset.
      const normNome = (s: string): string =>
        s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
      const nomesNoFechamento = new Set(
        clientesFiltrados.map(c => normNome(c.nome_cliente)),
      );
      // Mapa nome normalizado → data_entrada — usado p/ não sintetizar Pure
      // Asset cujo cliente_base ainda não entrou no período. Olha a lista
      // BRUTA (clientes), não a já filtrada por data_entrada.
      const dataEntradaPorNome = new Map<string, string>();
      for (const c of clientes) {
        if (c.data_entrada) {
          dataEntradaPorNome.set(normNome(c.nome_cliente), c.data_entrada);
        }
      }
      const clientesPureAsset: Cliente[] = [];
      for (const [nome, aum] of aumPeriodo) {
        const nomeNorm = normNome(nome);
        if (nomesNoFechamento.has(nomeNorm)) continue;
        // Não sintetizar se o cliente_base correspondente tem data_entrada
        // posterior ao período atual (cliente entrará só num mês futuro).
        // Comparação por string YYYY-MM é segura (formato fixo).
        const dataEntrada = dataEntradaPorNome.get(nomeNorm);
        if (dataEntrada && dataEntrada > periodo) continue;
        clientesPureAsset.push({
          nome_cliente: aum.nome_cliente,
          receita_fee: 0,
          percentual_rebate_anual_onshore: params.taxa_rebate_onshore,
          percentual_rebate_anual_offshore: params.taxa_rebate_offshore,
          // Alíquota de rebate é GLOBAL (parametros) — sem campo por cliente.
          utiliza_servico_juridico: false,
          utiliza_conciliacao: false,
          pacote_servico: 'asset_only',
          pct_consultoria_gestao: 0,
          pct_consultoria_planejamento: 0,
          pct_consultoria_financeira: 0,
          pct_operacional_financeiro: 0,
          pct_serv_adm: 0,
          pct_serv_aux_adm: 0,
        });
      }

      const todosClientes = [...clientesFiltrados, ...clientesPureAsset];
      // Leitura dual (Fase 2.5 — Peça 5): processarPeriodo recebe vinculos e
      // propaga para calcularCustoDireto. Vínculo com pct > 0 substitui o
      // fallback de nome no campo do cliente. Como hoje todos os 860 vínculos
      // têm pct=0, o comportamento é idêntico ao legado até Peça 6 popular pct.
      const resultados = processarPeriodo(
        todosClientes,
        colaboradores,
        custosIndiretos,
        registrosPoupanca,
        regimeAtual,
        vinculos,
        { onshore: params.aliquota_rebate_onshore, offshore: params.aliquota_rebate_offshore },
      );

      // Totais consolidados — calculados uma vez aqui para evitar repetir nos consumidores.
      const receita_bruta = resultados.reduce((s, r) => s + r.receita_bruta, 0);
      const ebitda = resultados.reduce((s, r) => s + r.ebitda, 0);
      const lucro_liquido = resultados.reduce((s, r) => s + r.lucro_liquido, 0);

      setDadosPeriodo({
        resultados,
        clientes: todosClientes,
        colaboradores,
        custosIndiretos,
        registrosPoupanca,
        vinculos,
        totais: {
          receita_bruta,
          custo_total: resultados.reduce((s, r) => s + r.custo_total, 0),
          ebitda,
          lucro_liquido,
          margem_ebitda:  receita_bruta > 0 ? ebitda / receita_bruta : 0,
          margem_liquida: receita_bruta > 0 ? lucro_liquido / receita_bruta : 0,
        },
        parametros: { periodo, regime: regimeAtual },
      });
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

  /** Abre o modal de cópia em modo manual para o período atualmente selecionado. */
  const iniciarCopiaManual = useCallback(() => {
    if (!periodoSelecionado) return;
    const anterior = buscarPeriodoAnterior(periodoSelecionado);
    if (!anterior) return;
    setPeriodoParaCopiar({ origem: anterior, destino: periodoSelecionado, modo: 'manual' });
  }, [periodoSelecionado]);

  // Captura local — usada na callback do modal para não disputar com setState.
  const copiaAtual = periodoParaCopiar;

  return (
    <AppContext.Provider
      value={{
        dadosPeriodo, aumMap, periodoSelecionado, setPeriodoSelecionado,
        regime, setRegime, visaoFinanceira, setVisaoFinanceira,
        parametros, setParametros, recarregar, loading, erro,
        periodoFechado, statusPeriodo, iniciarCopiaManual,
      }}
    >
      {children}
      {copiaAtual && (
        <ModalCopiarPeriodo
          aberto
          periodoOrigem={copiaAtual.origem}
          periodoDestino={copiaAtual.destino}
          modo={copiaAtual.modo}
          onCancelar={() => setPeriodoParaCopiar(null)}
          onConfirmar={async (onProgress): Promise<ResumoCopia> => {
            const r = await copiarPeriodo(copiaAtual.origem, copiaAtual.destino, onProgress);
            recarregar();
            return r;
          }}
        />
      )}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp() deve ser usado dentro de <AppProvider>');
  return ctx;
}
