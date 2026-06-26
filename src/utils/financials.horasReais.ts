// --- Horas reais estimadas por cliente (perfil de complexidade) ---
// Aplica o catálogo de ATIVIDADES_SERVICO ao driver correspondente
// (perfil + volumetria mensal do Cliente) para estimar carga real
// por função. Saída usada por calcularPctDistribuido (quando o cliente
// tem perfil_complexidade) e pela aba Complexidade no Perfil.

import type {
  Cliente, FuncaoAlocacao, HorasReaisCalculadas, PerfilComplexidade,
} from '../types';
import { HORAS_CLT_MES } from './constants';
import { ATIVIDADES_SERVICO, VOLUME_MOVIMENTOS_PADRAO } from './atividadesServico';

function porFuncaoZerado(): Record<FuncaoAlocacao, number> {
  return {
    consultoria_gestao: 0,
    consultoria_planejamento: 0,
    consultoria_financeira: 0,
    operacional_financeiro: 0,
    serv_adm: 0,
    serv_aux_adm: 0,
  };
}

export function calcularHorasReais(
  cliente: Cliente, perfil: PerfilComplexidade,
): HorasReaisCalculadas {
  const resultado: HorasReaisCalculadas = {
    por_funcao: porFuncaoZerado(), total: 0, alertas: [], detalhes: [],
  };

  // Volumetria mensal vem direto do Cliente (não duplicada no perfil).
  const volMov = cliente.volume_movimentos_mes ?? 0;
  const qtdRecebiveis = cliente.qtd_recebiveis_mes ?? 0;
  const qtdContratacoes = cliente.qtd_contratacoes_mes ?? 0;

  for (const [nome, ativ] of Object.entries(ATIVIDADES_SERVICO)) {
    let horas = 0;
    let driverValor = 0;

    switch (ativ.driver) {
      case 'fixo':
        horas = ativ.horas_base; driverValor = 1; break;

      case 'boolean': {
        const ligada = ativ.boolean_campo ? !!perfil[ativ.boolean_campo] : false;
        if (!ligada) continue;
        horas = ativ.horas_base; driverValor = 1;
        // Alerta dedicado: revisao_contratos ativa sem pacote jurídico.
        if (nome === 'revisao_contratos' && !cliente.utiliza_servico_juridico && ativ.alerta) {
          resultado.alertas.push(ativ.alerta);
        }
        break;
      }

      case 'vol_movimentos':
        driverValor = volMov;
        if (nome === 'fluxo_caixa') horas = (volMov * 0.5) / 60;
        else horas = ativ.horas_base * (volMov / (ativ.driver_base ?? VOLUME_MOVIMENTOS_PADRAO));
        break;

      case 'qtd_veiculos':
        driverValor = perfil.qtd_veiculos ?? 0;
        horas = ativ.horas_base * driverValor; break;
      case 'qtd_imoveis':
        driverValor = perfil.qtd_imoveis ?? 0;
        horas = ativ.horas_base * driverValor; break;
      case 'qtd_func_domesticos':
        driverValor = perfil.qtd_funcionarios_domesticos ?? 0;
        horas = ativ.horas_base * driverValor; break;
      case 'qtd_recebiveis':
        driverValor = qtdRecebiveis;
        horas = ativ.horas_base * driverValor; break;
      case 'qtd_contratacoes':
        driverValor = qtdContratacoes;
        horas = ativ.horas_base * driverValor; break;
      case 'grupos_financeiros':
        driverValor = perfil.grupos_financeiros ?? 1;
        horas = ativ.horas_base * (driverValor / (ativ.driver_base ?? 1)); break;
    }

    if (horas > 0) {
      resultado.por_funcao[ativ.funcao] += horas;
      resultado.total += horas;
      resultado.detalhes.push({ atividade: nome, horas, funcao: ativ.funcao, driver_valor: driverValor });
    }
  }

  // gestao_obra: alerta puro (sem horas-base) — fora do loop.
  if (perfil.gestao_obra && (cliente.receita_fee ?? 0) === 0) {
    resultado.alertas.push('Gestão de obra ativa sem cobrança — verificar fee');
  }

  return resultado;
}

/** Wrapper: pct normativo a partir das horas reais (para uso em calcularPctDistribuido).
 *  Retorna proporções por cliente×função; HORAS_CLT_MES é só denominador
 *  para alinhar escala com pct_normativo do pacote. */
export function pctNormativoPorHorasReais(
  horasReais: HorasReaisCalculadas, funcao: FuncaoAlocacao,
): number {
  return (horasReais.por_funcao[funcao] ?? 0) / HORAS_CLT_MES;
}
