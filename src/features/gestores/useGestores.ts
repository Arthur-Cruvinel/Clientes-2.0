// --- Hook da aba Gestores: "o gestor se paga?" ---
// Gestor = colaborador com vínculo de consultoria_gestao (pct>0). Carteira =
// clientes desses vínculos (fonte: vinculos/, NUNCA cliente[funcao] legado).
//
// MÉTRICA CENTRAL (fechada com o CFO — EXPOSIÇÃO, jamais recálculo do motor):
//   ebitda_carteira  = Σ ResultadoCliente.ebitda dos clientes da carteira.
//   custo_alocado    = Σ da linha consultoria_gestao do gestor em cada cliente
//                      (linhas_mao_de_obra do pipeline = pct × custo_total ×
//                      fatorNorm) — MESMA base do motor, já computada.
//
//   ── ARMADILHAS DE DUPLA CONTAGEM ──────────────────────────────────────────
//   1ª ordem (custo DIRETO): o EBITDA já descontou o custo direto do gestor na
//      carteira. Somá-lo de volta (custo_alocado) evita cobrar o gestor duas
//      vezes — uma no EBITDA, outra no denominador.
//   2ª ordem (auto-OCIOSIDADE rateada): a ociosidade do PRÓPRIO gestor entra no
//      pool indireto geral e volta, via rateio, a descontar uma fatia do EBITDA
//      da sua carteira → circularidade. Devolvemos só essa fatia:
//        ociosidade_do_gestor = max(0, alocavel − Σpct) × custo_total
//                               (MESMA fórmula/base de calcularOciosidade).
//        fatia_devolvida = ociosidade_do_gestor × Σ(pct_rateio dos clientes da
//                          carteira), pct_rateio = custo_direto_cli / Σ direto
//                          (a MESMA proporção do rateio do pool geral no motor).
//   NÃO se expurga a ociosidade dos OUTROS colaboradores rateada à carteira —
//   é overhead legítimo que a carteira deve suportar; só a do próprio gestor é viés.
//
//   margem_antes = ebitda_carteira + custo_alocado + fatia_devolvida.
//   cobertura    = margem_antes / custo_total_mensal CHEIO (denominador
//                  INALTERADO — é o que a carteira precisa cobrir).
//   se_paga      = cobertura ≥ 100%.
//
// Multi-gestor: em 2026-01 há 0 clientes com 2+ vínculos consultoria_gestao
// pct>0 — cada cliente pertence a no máximo 1 carteira (sem dupla contagem).
// Se surgir multi-gestor, a 1ª versão contaria o cliente nas duas carteiras;
// o tratamento acordado (rateio do ebitda pelo pct de cada gestor) fica para
// quando o caso existir (BACKLOG).

import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import { ocupacaoConsolidada } from '../../utils/financials.alocacao';
import { somarPctPorColaborador } from '../../utils/financials.custos';

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

export interface ClienteCarteira {
  nome: string;
  pct: number;            // pct do vínculo consultoria_gestao (dedicação do gestor)
  receita: number;
  ebitda: number;
  custoAlocado: number;
}

export interface GestorRow {
  id_estavel: string;
  nome: string;
  nClientes: number;
  receitaCarteira: number;
  ebitdaCarteira: number;
  custoAlocado: number;
  custoTotal: number;       // custo_total_mensal CHEIO do gestor
  fatiaDevolvida: number;   // auto-ociosidade do gestor rateada de volta à carteira
  margemAntes: number;      // ebitda_carteira + custo_alocado + fatia_devolvida
  cobertura: number;        // margem_antes / custo_total (1.0 = 100%)
  sePaga: boolean;
  ocupacao: number;         // ocupacaoConsolidada.total (resumo magro de capacidade)
  carteira: ClienteCarteira[];
}

export interface ResumoGestores {
  rows: GestorRow[];
  clientesEmCarteira: number;   // únicos
  clientesSemGestor: number;
  universo: number;
}

export function useGestores() {
  const { dadosPeriodo, periodoSelecionado, loading } = useApp();

  const resumo = useMemo<ResumoGestores>(() => {
    if (!dadosPeriodo) return { rows: [], clientesEmCarteira: 0, clientesSemGestor: 0, universo: 0 };
    const { resultados, clientes, colaboradores, vinculos } = dadosPeriodo;

    const resByNome = new Map(resultados.map(r => [r.nome_cliente, r]));
    const cliById = new Map(clientes.filter(c => c.id_estavel).map(c => [c.id_estavel!, c]));
    const colabById = new Map(colaboradores.filter(c => c.id_estavel).map(c => [c.id_estavel!, c]));
    // Base do rateio geral (mesma do motor) + Σpct por colaborador (resolver) para
    // a auto-ociosidade. sumTotalDireto = denominador do pct_rateio do pool geral.
    const somaPct = somarPctPorColaborador(clientes, colaboradores, vinculos);
    const sumTotalDireto = resultados.reduce((s, r) => s + r.custo_direto, 0);

    // Vínculos de gestão ativos (pct>0) agrupados por gestor (id_estavel).
    const gestVinc = vinculos.filter(v => v.funcao === 'consultoria_gestao' && v.pct > 0);
    const porGestor = new Map<string, typeof gestVinc>();
    for (const v of gestVinc) {
      const l = porGestor.get(v.id_estavel_colaborador) ?? [];
      l.push(v); porGestor.set(v.id_estavel_colaborador, l);
    }

    const clientesEmCarteira = new Set<string>();
    const rows: GestorRow[] = [];
    for (const [gid, vincs] of porGestor) {
      const colab = colabById.get(gid);
      if (!colab) continue; // gestor sem cadastro (placeholder) — ignora

      let receitaCarteira = 0, ebitdaCarteira = 0, custoAlocado = 0, carteiraDireto = 0;
      const carteira: ClienteCarteira[] = [];
      for (const v of vincs) {
        const cli = cliById.get(v.id_estavel_cliente);
        if (!cli) continue;
        const r = resByNome.get(cli.nome_cliente);
        if (!r) continue;
        clientesEmCarteira.add(cli.nome_cliente);
        // Linha do gestor neste cliente (mesma base do motor: pct×custo×fatorNorm).
        const linha = r.linhas_mao_de_obra.find(
          l => l.funcao === 'consultoria_gestao' && norm(l.responsavel) === norm(colab.nome_colaborador),
        );
        const valor = linha?.valor ?? 0;
        receitaCarteira += r.receita_bruta;
        ebitdaCarteira += r.ebitda;
        custoAlocado += valor;
        carteiraDireto += r.custo_direto;  // base do pct_rateio do pool geral
        carteira.push({ nome: cli.nome_cliente, pct: v.pct, receita: r.receita_bruta, ebitda: r.ebitda, custoAlocado: valor });
      }

      const custoTotal = colab.custo_total_mensal ?? 0;
      // 2ª ordem: devolve só a fatia da auto-ociosidade do gestor que o rateio
      // geral cobrou de volta da própria carteira (custo_direto_carteira ÷ Σ direto).
      const ociosidadeGestor = Math.max(0, (colab.percentual_alocavel ?? 0) - (somaPct[gid] ?? 0)) * custoTotal;
      const fatiaDevolvida = sumTotalDireto > 0 ? ociosidadeGestor * (carteiraDireto / sumTotalDireto) : 0;
      const margemAntes = ebitdaCarteira + custoAlocado + fatiaDevolvida;
      const cobertura = custoTotal > 0 ? margemAntes / custoTotal : 0;
      rows.push({
        id_estavel: gid, nome: colab.nome_colaborador, nClientes: carteira.length,
        receitaCarteira, ebitdaCarteira, custoAlocado, custoTotal, fatiaDevolvida, margemAntes, cobertura,
        sePaga: cobertura >= 1,
        ocupacao: ocupacaoConsolidada(colab, clientes, vinculos).total,
        carteira: carteira.sort((a, b) => b.ebitda - a.ebitda),
      });
    }
    rows.sort((a, b) => b.cobertura - a.cobertura);

    return {
      rows,
      clientesEmCarteira: clientesEmCarteira.size,
      clientesSemGestor: resultados.length - clientesEmCarteira.size,
      universo: resultados.length,
    };
  }, [dadosPeriodo]);

  return { resumo, periodoSelecionado, loading };
}
