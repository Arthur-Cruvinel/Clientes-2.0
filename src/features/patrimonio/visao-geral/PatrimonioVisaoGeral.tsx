// --- Aba Visão Geral do patrimônio ---

import { BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { InvestimentoExterno, Imovel, Veiculo, OutroBem, Passivo } from '../../../types';
import type { CarteiraGalapagos } from '../usePatrimonioCrud';
import { usePatrimonioVisaoGeral } from './usePatrimonioVisaoGeral';
import { PatrimonioKpis } from './PatrimonioKpis';
import { GraficoBarras, GraficoDonut } from './PatrimonioGraficos';
import { TabelaCustodia, TabelaTipo, TabelaCategoria } from './PatrimonioTabelas';

interface Props {
  investimentos: InvestimentoExterno[];
  imoveis: Imovel[];
  veiculos: Veiculo[];
  outrosBens: OutroBem[];
  passivos: Passivo[];
  carteiraGalapagos?: CarteiraGalapagos | null;
}

export function PatrimonioVisaoGeral({ investimentos, imoveis, veiculos, outrosBens, passivos, carteiraGalapagos }: Props) {
  const navigate = useNavigate();
  const d = usePatrimonioVisaoGeral({ investimentos, imoveis, veiculos, outrosBens, passivos, carteiraGalapagos: carteiraGalapagos ?? null });

  const semDados = d.totalAtivos === 0 && d.totalPassivos === 0;

  if (semDados) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BarChart2 size={48} style={{ color: '#e2e2e8' }} />
        <p className="text-sm mt-3 font-medium" style={{ color: '#6b6b8a' }}>Nenhum ativo cadastrado</p>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
          Importe dados via Central de Importação ou cadastre manualmente nas abas acima
        </p>
        <button onClick={() => navigate('/upload?aba=patrimonio')}
          className="mt-4 px-4 py-2 rounded-lg text-xs font-medium text-white bg-gradient-brand">
          Ir para Importação
        </button>
      </div>
    );
  }

  const categorias = [
    { nome: 'Investimentos', qtd: investimentos.length, valor: d.totalInvestimentos },
    { nome: 'Imóveis', qtd: imoveis.length, valor: d.totalImoveis },
    { nome: 'Veículos', qtd: veiculos.length, valor: d.totalVeiculos },
    { nome: 'Outros Bens', qtd: outrosBens.length, valor: d.totalOutrosBens },
  ];

  return (
    <div className="space-y-5">
      <PatrimonioKpis totalAtivos={d.totalAtivos} totalPassivos={d.totalPassivos} patrimonioLiquido={d.patrimonioLiquido} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GraficoBarras dados={d.dadosBarras} />
        <GraficoDonut dados={d.distribuicaoAtivos} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TabelaCustodia dados={d.porCustodia} totalAtivos={d.totalAtivos} />
        <TabelaTipo dados={d.porTipoInvestimento} totalAtivos={d.totalAtivos} />
      </div>

      <TabelaCategoria categorias={categorias} totalAtivos={d.totalAtivos}
        totalPassivos={d.totalPassivos} patrimonioLiquido={d.patrimonioLiquido} />
    </div>
  );
}
