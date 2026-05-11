// --- Aba Visão Geral ---
// DRE consolidado: KPIs globais + tabela com filtros/ordenação + modais de custo.

import { useMemo, useState, useCallback } from 'react';
import { Lock, Unlock, ShieldCheck, Copy, Loader2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useAuth } from '../../state/AuthContext';
import { formatPeriodo, formatCurrency, formatPercent } from '../../utils/formatters';
import { KpiCard } from '../../components/ui/KpiCard';
import { useVisaoGeral } from './useVisaoGeral';
import { criarColunas, valorTextoColuna } from './columns';
import { TabelaClientes } from './TabelaClientes';
import { SkeletonKpis, SkeletonTabela } from './Skeletons';
import { CustoDiretoModal } from './CustoDiretoModal';
import { CustoIndiretoModal } from './CustoIndiretoModal';
import { ImpostosModal } from './ImpostosModal';
import { ExportButton } from '../../components/ui/ExportButton';
import { exportVisaoGeralExcel } from '../../utils/exporters/exportExcel';
import { exportVisaoGeralPdf } from '../../utils/exporters/exportPdf';
import { fecharPeriodo, reabrirPeriodo, buscarClientes, db } from '../../services/firebase';
import { AgenteValidacao } from '../agente/AgenteValidacao';
import { writeBatch, doc as firestoreDoc } from 'firebase/firestore';
import { BATCH_LIMIT } from '../../utils/constants';
import { slug } from '../../utils/slug';
import type { DadosCliente } from '../../types';

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function periodoCurto(anoMes: string | undefined): string {
  if (!anoMes) return '';
  const [ano, mes] = anoMes.split('-');
  const idx = parseInt(mes, 10) - 1;
  return idx >= 0 && idx < 12 ? `${MESES_CURTOS[idx]}/${ano}` : anoMes;
}

export function VisaoGeral() {
  const { periodoSelecionado, visaoFinanceira, parametros, periodoFechado, statusPeriodo, recarregar } = useApp();
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';
  const {
    clientes, clientesAtivos, totais, loading, regime,
    custosIndiretos,
    modal, abrirCustoDireto, abrirCustoIndireto, abrirImpostos, fecharModal,
  } = useVisaoGeral();

  const [colunaOrdenada, setColunaOrdenada] = useState('ebitda');
  const [fechandoPeriodo, setFechandoPeriodo] = useState(false);
  const [toastPeriodo, setToastPeriodo] = useState<string | null>(null);
  const [validacaoAberta, setValidacaoAberta] = useState(false);
  const [copiandoBase, setCopiandoBase] = useState(false);

  const handleFecharPeriodo = useCallback(async () => {
    if (!periodoSelecionado || !totais) return;
    const label = formatPeriodo(periodoSelecionado);
    if (!confirm(`Fechar ${label}? Esta ação cria um snapshot imutável dos dados atuais.`)) return;
    setFechandoPeriodo(true);
    try {
      await fecharPeriodo(periodoSelecionado, {
        fechado_por: usuario?.email ?? 'desconhecido',
        total_clientes: clientes.length,
        receita_total: totais.receita_bruta,
      });
      setToastPeriodo('Período fechado com sucesso');
      recarregar();
    } catch (e) {
      setToastPeriodo(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFechandoPeriodo(false);
    }
  }, [periodoSelecionado, totais, usuario, recarregar, clientes.length]);

  const handleReabrirPeriodo = useCallback(async () => {
    if (!periodoSelecionado) return;
    const label = formatPeriodo(periodoSelecionado);
    if (!confirm(`Reabrir ${label}? Os dados voltarão a ser carregados da base atual.`)) return;
    setFechandoPeriodo(true);
    try {
      await reabrirPeriodo(periodoSelecionado, usuario?.email ?? 'desconhecido');
      setToastPeriodo('Período reaberto');
      recarregar();
    } catch (e) {
      setToastPeriodo(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFechandoPeriodo(false);
    }
  }, [periodoSelecionado, usuario, recarregar]);

  const handleCopiarBaseAnterior = useCallback(async () => {
    if (!periodoSelecionado) return;
    setCopiandoBase(true);
    try {
      // Tentar meses anteriores até encontrar um com dados
      const [anoStr, mesStr] = periodoSelecionado.split('-');
      let ano = parseInt(anoStr);
      let mes = parseInt(mesStr);
      let clientesAnterior: Awaited<ReturnType<typeof buscarClientes>> = [];
      let periodoAnterior = '';

      for (let i = 0; i < 12; i++) {
        mes--;
        if (mes < 1) { mes = 12; ano--; }
        periodoAnterior = `${ano}-${String(mes).padStart(2, '0')}`;
        clientesAnterior = await buscarClientes(periodoAnterior);
        if (clientesAnterior.length > 0) break;
      }

      if (clientesAnterior.length === 0) {
        setToastPeriodo('Erro: Nenhum periodo anterior encontrado com dados');
        return;
      }

      // Copiar para fechamentos/{periodoAtual}/colaboradores ja existe,
      // copiar clientes do periodo anterior para o atual
      for (let i = 0; i < clientesAnterior.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = clientesAnterior.slice(i, i + BATCH_LIMIT);
        for (const c of chunk) {
          // Fonte única de slug: utils/slug.ts (normaliza acento + filtra
          // [^a-z0-9_]). Antes era inline divergente — risco de criar doc
          // duplicado em chave divergente quando c.id era ausente.
          const docId = c.id ?? slug(c.nome_cliente);
          batch.set(firestoreDoc(db, 'fechamentos', periodoSelecionado, 'clientes', docId), c as unknown as Record<string, unknown>);
        }
        await batch.commit();
      }

      setToastPeriodo(`Base copiada de ${periodoCurto(periodoAnterior)} (${clientesAnterior.length} clientes)`);
      recarregar();
    } catch (e) {
      setToastPeriodo(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCopiandoBase(false);
    }
  }, [periodoSelecionado, recarregar]);

  const [ordem, setOrdem] = useState<'asc' | 'desc'>('desc');
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({});

  const isMC = visaoFinanceira === 'margem_contribuicao';

  const handleOrdenar = useCallback((chave: string) => {
    if (chave === colunaOrdenada) setOrdem(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setColunaOrdenada(chave); setOrdem('desc'); }
  }, [colunaOrdenada]);

  const colunas = useMemo(
    () => criarColunas({ onClickCustoDireto: abrirCustoDireto, onClickCustoIndireto: abrirCustoIndireto, onClickImpostos: abrirImpostos, visaoFinanceira }),
    [abrirCustoDireto, abrirCustoIndireto, abrirImpostos, visaoFinanceira],
  );

  // Valores únicos por coluna (para os dropdowns de filtro)
  const valoresUnicos = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const col of colunas) {
      const set = new Set<string>();
      for (const c of clientes) set.add(valorTextoColuna(c, col.chave, isMC));
      mapa.set(col.chave, [...set].sort());
    }
    return mapa;
  }, [clientes, colunas, isMC]);

  const handleFiltroChange = useCallback((chave: string, valores: Set<string>) => {
    setFiltros(prev => {
      const uv = valoresUnicos.get(chave);
      // Se todos selecionados, remover o filtro
      if (uv && valores.size >= uv.length) {
        const { [chave]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [chave]: valores };
    });
  }, [valoresUnicos]);

  // Filtrar → ordenar
  const clientesFiltradosOrdenados = useMemo(() => {
    let lista = clientes;

    // Aplicar filtros ativos
    const chavesAtivas = Object.keys(filtros);
    if (chavesAtivas.length > 0) {
      lista = lista.filter((c: DadosCliente) => {
        for (const chave of chavesAtivas) {
          const val = valorTextoColuna(c, chave, isMC);
          if (!filtros[chave].has(val)) return false;
        }
        return true;
      });
    }

    // Ordenar
    const sorted = [...lista];
    sorted.sort((a, b) => {
      const va = (a as unknown as Record<string, unknown>)[colunaOrdenada];
      const vb = (b as unknown as Record<string, unknown>)[colunaOrdenada];
      if (typeof va === 'number' && typeof vb === 'number') return ordem === 'asc' ? va - vb : vb - va;
      return ordem === 'asc' ? String(va ?? '').localeCompare(String(vb ?? '')) : String(vb ?? '').localeCompare(String(va ?? ''));
    });
    return sorted;
  }, [clientes, filtros, colunaOrdenada, ordem, isMC]);

  const custosDiretos = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clientes) m.set(c.nome_cliente, c.custo_direto);
    return m;
  }, [clientes]);

  // Margem de contribuição não vem nos totais consolidados — soma por cliente.
  const margemContribuicaoTotal = useMemo(
    () => clientes.reduce(
      (s: number, c: DadosCliente) =>
        s + (c.receita_bruta - c.impostos_faturamento - c.custo_direto - c.custo_dedicado),
      0,
    ),
    [clientes],
  );
  const kpiValor = totais ? (isMC ? margemContribuicaoTotal : totais.ebitda) : 0;
  const kpiReceita = totais?.receita_bruta ?? 0;
  const kpiMargemPct = kpiReceita > 0 ? (kpiValor / kpiReceita) * 100 : 0;

  const regimeLabel = regime === 'real' ? 'Real' : 'Presumido';
  const periodoLabel = periodoCurto(periodoSelecionado);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold" style={{ color: '#160F41' }}>
            Visão Geral
            {periodoSelecionado && <span className="ml-2 text-base font-normal" style={{ color: '#6b6b8a' }}>— {formatPeriodo(periodoSelecionado)}</span>}
          </h2>
          {periodoFechado ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                <Lock size={11} /> Fechado
              </span>
              {statusPeriodo?.fechado_em && (
                <span className="text-xs" style={{ color: '#6b6b8a' }}>
                  {new Date(statusPeriodo.fechado_em).toLocaleDateString('pt-BR')}
                </span>
              )}
              {isAdmin && (
                <button onClick={handleReabrirPeriodo} disabled={fechandoPeriodo}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
                  style={{ color: '#dc2626', border: '1px solid #fecaca' }}>
                  <Unlock size={11} /> Reabrir
                </button>
              )}
            </div>
          ) : clientes.length > 0 && (
            <button onClick={handleFecharPeriodo} disabled={fechandoPeriodo}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-50"
              style={{ color: '#6b6b8a', border: '1px solid #e2e2e8' }}>
              <Lock size={11} /> {fechandoPeriodo ? 'Fechando...' : 'Fechar Período'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {clientes.length > 0 && (
            <button onClick={() => setValidacaoAberta(true)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
              style={{ color: '#6b6b8a', border: '1px solid #e2e2e8' }}>
              <ShieldCheck size={14} /> Validar
            </button>
          )}
          {clientes.length > 0 && (
            <ExportButton
              onExportExcel={() => exportVisaoGeralExcel(clientes, periodoLabel, regimeLabel)}
              onExportPdf={() => exportVisaoGeralPdf(clientes, periodoLabel, regimeLabel)}
            />
          )}
        </div>
      </div>

      {toastPeriodo && (
        <div className="p-3 rounded-lg text-sm" style={{
          backgroundColor: toastPeriodo.includes('Erro') ? '#fee2e2' : '#dcfce7',
          color: toastPeriodo.includes('Erro') ? '#991b1b' : '#166534',
        }}>
          {toastPeriodo}
        </div>
      )}

      {loading ? <SkeletonKpis /> : totais && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard titulo="Receita Total" valor={formatCurrency(totais.receita_bruta)} />
          <KpiCard titulo={isMC ? 'Margem Contrib.' : 'EBITDA'} valor={formatCurrency(kpiValor)}
            cor={kpiValor >= 0 ? 'text-green-700' : 'text-red-700'} />
          <KpiCard titulo={isMC ? 'Mg. Contribuição' : 'Margem EBITDA'} valor={formatPercent(kpiMargemPct)}
            cor={kpiMargemPct >= 0 ? 'text-green-700' : 'text-red-700'} />
          <KpiCard titulo="Clientes Ativos" valor={String(clientesAtivos)} />
        </div>
      )}

      {loading ? <SkeletonTabela /> : clientes.length === 0 ? (
        <div className="rounded-lg border p-8 text-center space-y-3" style={{ borderColor: '#fbbf24', backgroundColor: '#fffbeb' }}>
          <p className="text-sm" style={{ color: '#92400e' }}>
            Nenhum dado encontrado para o periodo selecionado.
          </p>
          {!periodoFechado && (
            <button onClick={handleCopiarBaseAnterior} disabled={copiandoBase}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
              {copiandoBase ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
              {copiandoBase ? 'Copiando...' : 'Copiar base do mes anterior'}
            </button>
          )}
        </div>
      ) : (
        <TabelaClientes clientes={clientesFiltradosOrdenados} colunas={colunas}
          colunaOrdenada={colunaOrdenada} onOrdenar={handleOrdenar} visaoFinanceira={visaoFinanceira}
          valoresUnicos={valoresUnicos} filtros={filtros} onFiltroChange={handleFiltroChange}
          periodoFechado={periodoFechado} />
      )}

      {modal?.tipo === 'custo_direto' && (
        <CustoDiretoModal cliente={modal.cliente} parametros={parametros} onFechar={fecharModal} />
      )}
      {modal?.tipo === 'custo_indireto' && (
        <CustoIndiretoModal cliente={modal.cliente} todosClientes={clientes} custosIndiretos={custosIndiretos}
          custosDiretos={custosDiretos} onFechar={fecharModal} />
      )}
      {modal?.tipo === 'impostos' && (
        <ImpostosModal cliente={modal.cliente} regime={regime} onFechar={fecharModal} />
      )}

      {validacaoAberta && <AgenteValidacao onFechar={() => setValidacaoAberta(false)} />}
    </div>
  );
}
