// --- Hook de cálculos agregados da visão geral patrimonial ---

import { useMemo } from 'react';
import type { InvestimentoExterno, Imovel, Veiculo, OutroBem, Passivo } from '../../../types';
import type { CarteiraGalapagos } from '../usePatrimonioCrud';

interface Dados {
  investimentos: InvestimentoExterno[];
  imoveis: Imovel[];
  veiculos: Veiculo[];
  outrosBens: OutroBem[];
  passivos: Passivo[];
  carteiraGalapagos: CarteiraGalapagos | null;
}

const CORES_ATIVOS = ['#0065FF', '#7c3aed', '#0ea5e9', '#f59e0b'];
const LABEL_TIPO: Record<string, string> = {
  renda_fixa: 'Renda Fixa', renda_variavel: 'Renda Variável',
  fundo: 'Fundos', previdencia: 'Previdência', outro: 'Outros',
};

export function usePatrimonioVisaoGeral(dados: Dados) {
  return useMemo(() => {
    const galVal = dados.carteiraGalapagos?.pl_total ?? 0;

    // Investimentos virtuais: externos + carteira Galápagos
    const allInv: InvestimentoExterno[] = [...dados.investimentos];
    if (dados.carteiraGalapagos && galVal > 0) {
      allInv.push({
        id: 'galapagos-carteira',
        custodia: 'outro',
        instituicao: 'Galápagos Capital',
        descricao: `Carteira Galápagos — ${dados.carteiraGalapagos.periodo_label}`,
        tipo: 'fundo',
        valor: galVal,
        moeda: 'BRL',
        valor_brl: galVal,
        data_referencia: '',
      });
    }

    const totalInv = allInv.reduce((s, i) => s + (i.valor_brl ?? i.valor ?? 0), 0);
    const totalImo = dados.imoveis.reduce((s, i) => s + (i.valor_mercado ?? 0), 0);
    const totalVei = dados.veiculos.reduce((s, v) => s + (v.valor_fipe ?? v.valor_mercado_manual ?? 0), 0);
    const totalOut = dados.outrosBens.reduce((s, o) => s + (o.valor_estimado ?? 0), 0);
    const totalAtivos = totalInv + totalImo + totalVei + totalOut;
    const totalPassivos = dados.passivos.reduce((s, p) => s + (p.saldo_devedor ?? 0), 0);
    const patrimonioLiquido = totalAtivos - totalPassivos;

    const distItems = [
      { nome: 'Investimentos', valor: totalInv },
      { nome: 'Imóveis', valor: totalImo },
      { nome: 'Veículos', valor: totalVei },
      { nome: 'Outros Bens', valor: totalOut },
    ];
    const distribuicaoAtivos = distItems.map((d, i) => ({
      ...d, cor: CORES_ATIVOS[i], pct: totalAtivos > 0 ? d.valor / totalAtivos : 0,
    }));

    const dadosBarras = [
      { categoria: 'Ativos', valor: totalAtivos },
      { categoria: 'Passivos', valor: totalPassivos },
      { categoria: 'Patrimônio Líquido', valor: patrimonioLiquido },
    ];

    // Por custódia (com Galápagos Capital)
    const mapCust = new Map<string, number>();
    for (const i of allInv) {
      const k = i.instituicao === 'Galápagos Capital' ? 'Galápagos Capital' : (i.custodia ?? 'outro');
      mapCust.set(k, (mapCust.get(k) ?? 0) + (i.valor_brl ?? i.valor ?? 0));
    }
    const porCustodia = [...mapCust.entries()]
      .map(([custodia, valor]) => ({ custodia, valor, pct: totalInv > 0 ? valor / totalInv : 0 }))
      .sort((a, b) => b.valor - a.valor);

    // Por tipo (com Galápagos)
    const mapTipo = new Map<string, number>();
    for (const i of allInv) {
      const k = i.tipo ?? 'outro';
      mapTipo.set(k, (mapTipo.get(k) ?? 0) + (i.valor_brl ?? i.valor ?? 0));
    }
    const porTipoInvestimento = [...mapTipo.entries()]
      .map(([tipo, valor]) => ({ tipo: LABEL_TIPO[tipo] ?? tipo, valor, pct: totalInv > 0 ? valor / totalInv : 0 }))
      .sort((a, b) => b.valor - a.valor);

    return {
      totalInvestimentos: totalInv, totalImoveis: totalImo,
      totalVeiculos: totalVei, totalOutrosBens: totalOut,
      totalAtivos, totalPassivos, patrimonioLiquido,
      distribuicaoAtivos, dadosBarras, porCustodia, porTipoInvestimento,
    };
  }, [dados]);
}
