// --- Aba Visão Geral ---
// DRE consolidado: KPIs globais + tabela com filtros/ordenação + modais de custo.

import { useMemo, useState, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
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

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function periodoCurto(anoMes: string | undefined): string {
  if (!anoMes) return '';
  const [ano, mes] = anoMes.split('-');
  const idx = parseInt(mes, 10) - 1;
  return idx >= 0 && idx < 12 ? `${MESES_CURTOS[idx]}/${ano}` : anoMes;
}

export function VisaoGeral() {
  const { periodoSelecionado, visaoFinanceira, parametros } = useApp();
  const {
    clientes, clientesAtivos, totais, loading, regime,
    custosIndiretos,
    modal, abrirCustoDireto, abrirCustoIndireto, abrirImpostos, fecharModal,
  } = useVisaoGeral();

  const [colunaOrdenada, setColunaOrdenada] = useState('ebitda');
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
      lista = lista.filter(c => {
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

  const kpiValor = totais ? (isMC ? totais.margem_contribuicao_total : totais.ebitda_total) : 0;
  const kpiReceita = totais?.receita_bruta_total ?? 0;
  const kpiMargemPct = kpiReceita > 0 ? (kpiValor / kpiReceita) * 100 : 0;

  const regimeLabel = regime === 'real' ? 'Real' : 'Presumido';
  const periodoLabel = periodoCurto(periodoSelecionado);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold" style={{ color: '#160F41' }}>
          Visão Geral
          {periodoSelecionado && <span className="ml-2 text-base font-normal" style={{ color: '#6b6b8a' }}>— {formatPeriodo(periodoSelecionado)}</span>}
        </h2>
        {clientes.length > 0 && (
          <ExportButton
            onExportExcel={() => exportVisaoGeralExcel(clientes, periodoLabel, regimeLabel)}
            onExportPdf={() => exportVisaoGeralPdf(clientes, periodoLabel, regimeLabel)}
          />
        )}
      </div>

      {loading ? <SkeletonKpis /> : totais && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard titulo="Receita Total" valor={formatCurrency(totais.receita_bruta_total)} />
          <KpiCard titulo={isMC ? 'Margem Contrib.' : 'EBITDA'} valor={formatCurrency(kpiValor)}
            cor={kpiValor >= 0 ? 'text-green-700' : 'text-red-700'} />
          <KpiCard titulo={isMC ? 'Mg. Contribuição' : 'Margem EBITDA'} valor={formatPercent(kpiMargemPct)}
            cor={kpiMargemPct >= 0 ? 'text-green-700' : 'text-red-700'} />
          <KpiCard titulo="Clientes Ativos" valor={String(clientesAtivos)} />
        </div>
      )}

      {loading ? <SkeletonTabela /> : clientes.length === 0 ? (
        <div className="rounded-lg border p-12 text-center" style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
          Nenhum dado encontrado para o período selecionado.<br />Verifique se o import foi realizado.
        </div>
      ) : (
        <TabelaClientes clientes={clientesFiltradosOrdenados} colunas={colunas}
          colunaOrdenada={colunaOrdenada} onOrdenar={handleOrdenar} visaoFinanceira={visaoFinanceira}
          valoresUnicos={valoresUnicos} filtros={filtros} onFiltroChange={handleFiltroChange} />
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
    </div>
  );
}
