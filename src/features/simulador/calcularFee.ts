// --- Cálculo do fee de proposta (função pura, motor único) ---
// EXTRAÍDO do useMemo do GeradorProposta SEM alterar comportamento: mesma ordem
// de operações, mesmas fórmulas, mesmas constantes, mesmo objeto de saída.
// Reutilizável para rodar o motor 2× (delta baseline-vs-ampliado no aditivo
// Forma 1 — passo seguinte). Reusa as funções puras existentes (financials,
// precificacaoBase). NÃO faz I/O nem mantém estado — função pura dos inputs.

import type { Cliente, Colaborador, FuncaoAlocacao, Parametros, PacoteServico, RegimeTributario } from '../../types';
import type { Vinculo } from '../../types/vinculo';
import { ALIQUOTAS, FUNCOES_ALOCACAO } from '../../utils/constants';
import { calcularHorasReais } from '../../utils/financials';
import { custoHoraMedioPorFuncao, custoDiretoDemanda } from './precificacaoBase';

export interface CalcularFeeInputs {
  // Dados do período (para o custo/hora médio por função).
  colaboradores: Colaborador[];
  clientes: Cliente[];
  vinculos: Vinculo[];
  parametros: Parametros;
  regime: RegimeTributario;
  // Escopo (mesmos campos que o useMemo lê hoje).
  pacote: PacoteServico;
  veic: number; imov: number; grupos: number; domest: number;
  planTrib: boolean; revContr: boolean; obra: boolean;
  usaJur: boolean; usaConc: boolean;
  volMov: number; contratacoes: number; recebiveis: number;
  demandasJur: number;
  plOn: number; plOff: number; taxaOn: number; taxaOff: number;
  dContab: number; dPgto: number; dAdm: number; dViagem: number;
}

export interface CalcularFeeResult {
  porFuncao: { f: FuncaoAlocacao; horas: number; custoHora: number; custo: number }[];
  custoDireto: number;
  custoDemandaJuridica: number;
  parcelaJuridica: number;
  demandasJur: number;
  incrementoAditivo: number;
  dedicados: number;
  overhead: number;
  overheadRatio: number;
  custoTotal: number;
  rebate: number;
  receitaNecessaria: number;
  feeSugerido: number;
  margem: number;
  aliqFat: number;
  denomInvalido: boolean;
  alertas: string[];
  totalHoras: number;
}

export function calcularFee(i: CalcularFeeInputs): CalcularFeeResult {
  const { colaboradores, clientes, vinculos, parametros, regime } = i;

  // Mesma base do diagnóstico da Parte 1 (motor único — precificacaoBase).
  const custoHoraMedio = custoHoraMedioPorFuncao(colaboradores, clientes, vinculos);
  // Overhead SEMPRE da razão de referência (parametros/global).
  const overheadRatio = parametros.overhead_ratio_referencia;

  const cliente: Cliente = {
    nome_cliente: 'Proposta', pacote_servico: i.pacote, receita_fee: 0,
    percentual_rebate_anual_onshore: i.taxaOn / 100, percentual_rebate_anual_offshore: i.taxaOff / 100,
    utiliza_servico_juridico: i.usaJur, utiliza_conciliacao: i.usaConc,
    pct_consultoria_gestao: 0, pct_consultoria_planejamento: 0, pct_consultoria_financeira: 0,
    pct_operacional_financeiro: 0, pct_serv_adm: 0, pct_serv_aux_adm: 0,
    volume_movimentos_mes: i.volMov, qtd_recebiveis_mes: i.recebiveis, qtd_contratacoes_mes: i.contratacoes,
    perfil_complexidade: {
      grupos_financeiros: i.grupos, qtd_veiculos: i.veic, qtd_imoveis: i.imov, qtd_funcionarios_domesticos: i.domest,
      planejamento_tributario: i.planTrib, revisao_contratos: i.revContr, gestao_obra: i.obra,
    },
  } as Cliente;

  const horas = calcularHorasReais(cliente, cliente.perfil_complexidade!);
  const porFuncao = FUNCOES_ALOCACAO.map(f => {
    const h = horas.por_funcao[f] ?? 0; const ch = custoHoraMedio[f] ?? 0;
    return { f, horas: h, custoHora: ch, custo: h * ch };
  });
  const custoDireto = custoDiretoDemanda(horas.por_funcao, custoHoraMedio);
  // Jurídico consultivo: N × custo_demanda. custo_demanda = tempo × salário-hora
  // × fator (R$ 82,88 é cru → puxa overhead). A parcela entra no custo direto
  // ANTES do overhead, logo recebe overhead + imposto + margem como a mão de
  // obra das 6 funções. N=0 (default) → parcela 0 → fee idêntico ao atual.
  const custoDemandaJuridica = parametros.tempo_demanda_juridica_horas * parametros.custo_hora_juridico * parametros.fator_demanda_juridica;
  const parcelaJuridica = i.demandasJur * custoDemandaJuridica;
  const custoDiretoComJuridico = custoDireto + parcelaJuridica;
  const dedicados = i.dContab + i.dPgto + i.dAdm + i.dViagem;
  const overhead = custoDiretoComJuridico * overheadRatio;
  const custoTotal = custoDiretoComJuridico + dedicados + overhead;

  const aliqOn = parametros.aliquota_rebate_onshore, aliqOff = parametros.aliquota_rebate_offshore, split = parametros.split_plataforma;
  const rebate = ((i.plOn * (i.taxaOn / 100)) / 12 * (1 - aliqOn) + (i.plOff * (i.taxaOff / 100)) / 12 * (1 - aliqOff)) * split;

  const aliqFat = ALIQUOTAS[regime].faturamento, margem = parametros.margem_alvo;
  const denom = 1 - aliqFat - margem;
  const receitaNecessaria = denom > 0 ? custoTotal / denom : 0;
  const feeSugerido = receitaNecessaria - rebate;

  // Aditivo (cliente_existente): incremento ISOLADO do novo serviço — só a
  // parcela jurídica deste lote, com a MESMA matemática do Lote 1 (overhead +
  // gross-up de imposto+margem), SEM subtrair rebate (o rebate já subsidia o
  // fee atual). fee_novo = fee_atual + incremento. Prospect ignora (usa o fee
  // total). Próximo lote (extraordinário) amplia os serviços incrementáveis.
  const incrementoAditivo = denom > 0 ? (parcelaJuridica * (1 + overheadRatio)) / denom : 0;

  return { porFuncao, custoDireto, custoDemandaJuridica, parcelaJuridica, demandasJur: i.demandasJur, incrementoAditivo, dedicados, overhead, overheadRatio, custoTotal, rebate, receitaNecessaria, feeSugerido, margem, aliqFat, denomInvalido: denom <= 0, alertas: horas.alertas, totalHoras: horas.total };
}
