// --- Definição de colunas e ajudas visuais para a tabela de colaboradores ---

import type { StatusOcupacao } from './useColaboradores';

export interface ColunaCol {
  chave: string;
  titulo: string;
  alinhamento?: 'left' | 'right' | 'center';
  // Classes Tailwind de largura/alinhamento por coluna. Nome cresce
  // (sem largura fixa); demais usam w-* para distribuição estável.
  classe?: string;
}

export const COLUNAS: ColunaCol[] = [
  { chave: 'nome',         titulo: 'Nome',         alinhamento: 'left',   classe: '' },
  { chave: 'cargo',        titulo: 'Cargo',        alinhamento: 'left',   classe: 'w-48' },
  { chave: 'tipo',         titulo: 'Vínculo',      alinhamento: 'left',   classe: 'w-24' },
  { chave: 'localidade',   titulo: 'Local',        alinhamento: 'left',   classe: 'w-20' },
  { chave: 'funcao',       titulo: 'Função',       alinhamento: 'left',   classe: 'w-48' },
  { chave: 'custo_total',  titulo: 'Custo Mensal', alinhamento: 'right',  classe: 'w-36' },
  { chave: 'pct_alocavel', titulo: '% Alocável',   alinhamento: 'right',  classe: 'w-28' },
  { chave: 'ocupacao',     titulo: 'Ocupação',     alinhamento: 'left',   classe: 'w-40' },
  { chave: 'status',       titulo: 'Status',       alinhamento: 'center', classe: 'w-24' },
];

// Cores do badge de vínculo
export const COR_VINCULO: Record<'clt' | 'pro_labore', { bg: string; cor: string; label: string }> = {
  clt:        { bg: '#dbeafe', cor: '#1e40af', label: 'CLT' },
  pro_labore: { bg: '#fef3c7', cor: '#92400e', label: 'Pró-labore' },
};

// Cores do badge de localidade
export const COR_LOCALIDADE: Record<'SP' | 'RJ', { bg: string; cor: string }> = {
  SP: { bg: '#ede9fe', cor: '#5b21b6' },
  RJ: { bg: '#cffafe', cor: '#155e75' },
};

// Cores e labels do badge de status de ocupação
export const COR_STATUS: Record<StatusOcupacao, { bg: string; cor: string; label: string }> = {
  ok:         { bg: '#dcfce7', cor: '#166534', label: 'OK' },
  atencao:    { bg: '#fef3c7', cor: '#92400e', label: 'Atenção' },
  sobrecarga: { bg: '#fee2e2', cor: '#991b1b', label: 'Sobrecarga' },
};

// Cor da barra de ocupação por status (mesma escala visual do status)
export function corBarraOcupacao(status: StatusOcupacao): string {
  if (status === 'sobrecarga') return '#dc2626';
  if (status === 'atencao') return '#ea580c';
  return '#16a34a';
}
