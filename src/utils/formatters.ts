// --- Funções de Formatação ---

import type { RegistroPoupanca } from '../types';
import { SIGLA_PARA_NOME } from '../features/poupanca/import/MAPEAMENTO_SIGLAS';

/**
 * Busca o RegistroPoupanca de um cliente num array indexado por nome.
 * PL é gerenciado pelo módulo AUM & Performance (CLAUDE.md) — consumidores
 * que precisam exibir/calcular PL chamam este helper sobre dadosPeriodo.registrosPoupanca.
 */
export function encontrarPoupanca(
  nomeCliente: string,
  registros: RegistroPoupanca[],
): RegistroPoupanca | undefined {
  return registros.find(r => r.nome_cliente === nomeCliente);
}

// Inverte SIGLA_PARA_NOME para buscar sigla pelo nome do cliente.
// Construído uma única vez no carregamento do módulo.
const NOME_PARA_SIGLA: Record<string, string> = Object.fromEntries(
  Object.entries(SIGLA_PARA_NOME).map(([sigla, nome]) => [nome, sigla])
);

/**
 * Retorna a sigla oficial do cliente buscando no MAPEAMENTO_SIGLAS invertido.
 * NUNCA gera sigla automaticamente quando há mapeamento — só faz fallback
 * por iniciais quando o nome não está cadastrado (cliente novo, parser failure).
 */
export function getSiglaCliente(nomeCliente: string): string {
  // 1. Busca exata
  if (NOME_PARA_SIGLA[nomeCliente]) return NOME_PARA_SIGLA[nomeCliente];

  // 2. Busca case-insensitive (cobre variações de capitalização)
  const nomeUpper = nomeCliente.toUpperCase();
  const entrada = Object.entries(NOME_PARA_SIGLA).find(
    ([nome]) => nome.toUpperCase() === nomeUpper,
  );
  if (entrada) return entrada[1];

  // 3. Fallback: primeiras letras das palavras de 3+ caracteres (máx 3)
  // Usado apenas quando o nome não está no mapa.
  return nomeCliente
    .split(' ')
    .filter(p => p.length > 2)
    .slice(0, 3)
    .map(p => p[0].toUpperCase())
    .join('');
}


/**
 * Formata um número como moeda brasileira (R$).
 * @param compact - Se true, abrevia valores grandes (ex: R$ 1,2M)
 */
export function formatCurrency(value: number, compact = false): string {
  if (value == null || typeof value !== 'number' || isNaN(value) || !isFinite(value)) return 'R$ 0,00';

  if (compact) {
    if (Math.abs(value) >= 1e6) return `R$ ${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `R$ ${(value / 1e3).toFixed(0)}k`;
  }

  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata um número como porcentagem com casas decimais.
 */
export function formatPercent(value: number, decimals = 1): string {
  if (value == null || typeof value !== 'number' || isNaN(value) || !isFinite(value)) return '0,0%';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

/**
 * Formata uma data no padrão brasileiro (dd/mm/aaaa).
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

/**
 * Converte string de input de moeda ("R$ 1.200,50") para número (1200.50).
 */
export function parseCurrencyInput(value: string): number {
  if (!value) return 0;
  return Number(
    String(value)
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

/**
 * Converte período "2025-12" → "Dezembro 2025".
 */
export function formatPeriodo(anoMes: string): string {
  const [anoStr, mesStr] = anoMes.split('-');
  const mesIndex = parseInt(mesStr, 10) - 1;
  if (isNaN(mesIndex) || mesIndex < 0 || mesIndex > 11) return anoMes;
  return `${MESES[mesIndex]} ${anoStr}`;
}
