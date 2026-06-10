// --- Hook da aba Custos Indiretos ---
// Junta as 5 categorias canônicas (CATEGORIAS_CUSTO_INDIRETO) com os valores
// do período ativo (dadosPeriodo.custosIndiretos), casando por id_estavel.
// Edição = updateDoc só do valor_mensal no docId real. Seed = cria as faltantes
// com identidade canônica e valor 0. Escreve SEMPRE no período ativo.

import { useMemo, useState, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import {
  atualizarValorCustoIndireto, definirCustoIndireto, semearCustosIndiretos,
  planejarPropagacaoCustos, executarPropagacaoCustos,
} from '../../services/firebase';
import { CATEGORIAS_CUSTO_INDIRETO } from '../../utils/constants';
import type { CustoIndireto } from '../../types';

/** 'YYYY-MM' do mês seguinte (propagação só vai 1 período à frente). */
function proximoPeriodoDe(p: string): string {
  const [a, m] = p.split('-').map(Number);
  const d = new Date(a, m, 1);  // mês JS-0; m=12 → janeiro do ano seguinte
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface LinhaCusto {
  id_estavel: string;
  descricao_custo: string;
  tipo_custo: string;
  docIdCanonico: string;
  docAtual: CustoIndireto | null;  // doc presente no período (id = docId real)
  valorAtual: number;
}

export interface ResultadoSalvar {
  atualizados: number;
  erros: Array<{ nome: string; motivo: string }>;
}

export function useCustosIndiretos() {
  const { dadosPeriodo, periodoSelecionado, recarregar } = useApp();
  const [salvando, setSalvando] = useState(false);

  const custos = dadosPeriodo?.custosIndiretos ?? [];

  // Ordena pela constante (vocabulário fixo) e casa por id_estavel canônico.
  const linhas = useMemo<LinhaCusto[]>(() => CATEGORIAS_CUSTO_INDIRETO.map(cat => {
    const docAtual = custos.find(c => c.id_estavel === cat.id_estavel) ?? null;
    return {
      id_estavel: cat.id_estavel,
      descricao_custo: cat.descricao_custo,
      tipo_custo: cat.tipo_custo,
      docIdCanonico: cat.docId,
      docAtual,
      valorAtual: docAtual?.valor_mensal ?? 0,
    };
  }), [custos]);

  const precisaSemear = linhas.some(l => l.docAtual === null);
  const totalAtual = linhas.reduce((s, l) => s + l.valorAtual, 0);

  // Persiste valores editados. Categoria EXISTENTE → updateDoc (docId real).
  // Categoria FALTANTE (nunca semeada) com `criar` → UPSERT no docId canônico
  // (definirCustoIndireto) — input aceito = input persistido, nunca descartado.
  // Erro num custo não aborta os demais (acumula). Recarrega ao final.
  const salvarValores = useCallback(async (
    edicoes: Array<{
      docId: string; valor: number; nome: string;
      criar?: { id_estavel: string; descricao_custo: string; tipo_custo: string };
    }>,
  ): Promise<ResultadoSalvar> => {
    if (!periodoSelecionado) throw new Error('Sem período ativo na tela.');
    const erros: ResultadoSalvar['erros'] = [];
    let atualizados = 0;
    setSalvando(true);
    try {
      for (const e of edicoes) {
        try {
          if (e.criar) {
            await definirCustoIndireto(periodoSelecionado, {
              docId: e.docId, valor_mensal: e.valor, ...e.criar,
            });
          } else {
            await atualizarValorCustoIndireto(periodoSelecionado, e.docId, e.valor);
          }
          atualizados++;
        } catch (err) {
          erros.push({ nome: e.nome, motivo: err instanceof Error ? err.message : 'falha ao salvar' });
        }
      }
      recarregar();
      return { atualizados, erros };
    } finally { setSalvando(false); }
  }, [periodoSelecionado, recarregar]);

  const semear = useCallback(async (): Promise<number> => {
    if (!periodoSelecionado) throw new Error('Sem período ativo na tela.');
    setSalvando(true);
    try {
      const n = await semearCustosIndiretos(periodoSelecionado);
      recarregar();
      return n;
    } finally { setSalvando(false); }
  }, [periodoSelecionado, recarregar]);

  // ── Propagação para o próximo período (só 1 à frente) ───────────────────
  const proximoPeriodo = periodoSelecionado ? proximoPeriodoDe(periodoSelecionado) : '';

  // Read-only — alimenta o modal de confirmação (valores + anomalias).
  const planejarPropagacao = useCallback(
    () => planejarPropagacaoCustos(periodoSelecionado, proximoPeriodo),
    [periodoSelecionado, proximoPeriodo],
  );

  // Só após aval explícito da UI. Escreve no PRÓXIMO período (não recarrega o
  // ativo — os dados do período aberto não mudam).
  const executarPropagacao = useCallback(async () => {
    if (!periodoSelecionado) throw new Error('Sem período ativo na tela.');
    setSalvando(true);
    try { return await executarPropagacaoCustos(periodoSelecionado, proximoPeriodo); }
    finally { setSalvando(false); }
  }, [periodoSelecionado, proximoPeriodo]);

  return {
    periodo: periodoSelecionado, linhas, precisaSemear, totalAtual, salvando,
    salvarValores, semear,
    proximoPeriodo, planejarPropagacao, executarPropagacao,
  };
}
