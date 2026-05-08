// --- Aba Metodologia (dentro de Configurações) ---
// Decisões metodológicas adotadas no motor financeiro — auditável, sem edição.

import { BookOpen } from 'lucide-react';
import { MetodologiaCard } from './MetodologiaCard';
import {
  HORAS_BRUTAS_ANO, HORAS_FERIAS_ANO, HORAS_PRODUTIVAS_POR_LOCALIDADE,
  FERIADOS_POR_LOCALIDADE, HORAS_DIA_UTIL,
} from '../../utils/constants';

export function Metodologia() {
  const ferSP = FERIADOS_POR_LOCALIDADE.SP * HORAS_DIA_UTIL;
  const ferRJ = FERIADOS_POR_LOCALIDADE.RJ * HORAS_DIA_UTIL;
  const horasFerias = HORAS_FERIAS_ANO;
  const prodSP = HORAS_PRODUTIVAS_POR_LOCALIDADE.SP;
  const prodRJ = HORAS_PRODUTIVAS_POR_LOCALIDADE.RJ;

  const cards = [
    {
      titulo: 'Horas Produtivas por Colaborador',
      decisao:
        'Horas produtivas calculadas por localidade (SP/RJ), descontando férias, '
        + 'feriados nacionais, municipais e carnaval.',
      fundamentacao:
`CLT 44h/semana × 52 semanas = ${HORAS_BRUTAS_ANO}h brutas/ano
(-) Férias: 30 dias corridos × (44÷7) = ${horasFerias.toFixed(0)}h
(-) Feriados SP: ${FERIADOS_POR_LOCALIDADE.SP} dias (11 nacionais + 2 municipais SP + 2 carnaval) = ${ferSP.toFixed(0)}h
(-) Feriados RJ: ${FERIADOS_POR_LOCALIDADE.RJ} dias (11 nacionais + 2 municipais RJ + 2 carnaval) = ${ferRJ.toFixed(0)}h

Feriados municipais SP: 25/jan (Aniversário SP), 09/jul (Revolução Constitucionalista)
Feriados municipais RJ: 20/jan (São Sebastião), 23/abr (São Jorge)
Carnaval: segunda e terça — ponto facultativo adotado pela Galácticos`,
      formula:
`SP: ${HORAS_BRUTAS_ANO} - ${horasFerias.toFixed(0)} - ${ferSP.toFixed(0)} = ${prodSP.toFixed(0)}h/ano (~${(prodSP / 12).toFixed(0)}h/mês)
RJ: ${HORAS_BRUTAS_ANO} - ${horasFerias.toFixed(0)} - ${ferRJ.toFixed(0)} = ${prodRJ.toFixed(0)}h/ano (~${(prodRJ / 12).toFixed(0)}h/mês)`,
      vigencia: 'A partir de 2026',
      impacto: 'Custo/hora ~1,8% maior que modelo anterior (base fixa 168h)',
    },
    {
      titulo: 'Custo/Hora — Base Anual',
      decisao: 'custo_hora = custo_total_anual ÷ horas_produtivas_localidade.',
      fundamentacao:
`Colaborador CLT recebe 13,3333 salários/ano (12 mensais + 13º + 1/3 férias adicional)
mas produz apenas ~${prodSP.toFixed(0)}h.
Usar custo_mensal ÷ 168h subestima o custo/hora real.`,
      formula:
`CLT:
  custo_anual = (salario_teto × 13,3333) + (benefícios × 12)
              + (encargos × 12) + (bônus × 13,3333)
  custo_hora  = custo_anual ÷ horas_produtivas_localidade

Pró-labore (sem 13º/férias):
  custo_anual = (salario_base × 12) + (benefícios × 12)
              + (salario_base × 0,20 × 12)
  custo_hora  = custo_anual ÷ horas_produtivas_localidade`,
      vigencia: 'A partir de 2026',
    },
    {
      titulo: 'Rateio de Custos Indiretos',
      decisao: 'Três critérios de rateio por tipo de custo indireto.',
      fundamentacao:
        'Custos de natureza diferente têm drivers de consumo diferentes — usar '
        + 'um único critério distorceria a rentabilidade.',
      formula:
`Geral       → proporcional ao custo_direto
              pure_asset excluído (custo_direto = 0)
Jurídico    → proporcional ao peso_juridico (default 1,0)
              apenas clientes com utiliza_servico_juridico = true
Conciliação → proporcional ao volume_movimentos_mes
              apenas clientes com utiliza_conciliacao = true`,
      vigencia: 'Desde a implementação inicial',
    },
    {
      titulo: 'Custo Institucional dos Colaboradores',
      decisao: 'Parcela não alocada a clientes entra no pool de indiretos gerais.',
      fundamentacao:
`100% da folha deve ser capturada no modelo.
percentual_alocavel + percentual_institucional = 1,0

A parcela institucional representa reuniões internas, gestão e treinamentos —
custo real da estrutura, rateado entre todos os clientes.`,
      formula:
`custo_institucional = custo_total_mensal × percentual_institucional
pool_geral_total = Σ(itens tipo='geral' do Firestore)
                 + Σ(custo_institucional de todos os colaboradores)`,
      vigencia: 'A partir de 2026',
    },
    {
      titulo: 'Perfis de Cliente',
      decisao: 'Três perfis com tratamento diferenciado no motor financeiro.',
      fundamentacao:
        'Clientes pure asset geram receita passiva sem consumir estrutura '
        + 'operacional — incluí-los no rateio geral distorceria a rentabilidade '
        + 'de clientes que efetivamente demandam serviço.',
      formula:
`Pure Asset  → receita_fee = 0, receita só de rebate
              custo_direto = 0
              excluído do rateio de indiretos gerais
Fee Based   → receita_fee > 0, rebate = 0
Híbrido     → receita_fee > 0 e rebate > 0`,
      vigencia: 'Desde a implementação inicial',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
          <BookOpen size={18} /> Metodologia
        </h3>
        <p className="text-xs mt-1" style={{ color: '#6b6b8a' }}>
          Decisões metodológicas adotadas no motor financeiro. Conteúdo estático e auditável.
        </p>
      </div>

      <div className="space-y-4">
        {cards.map(card => <MetodologiaCard key={card.titulo} {...card} />)}
      </div>
    </div>
  );
}
