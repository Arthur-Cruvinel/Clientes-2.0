// --- Catálogo estático dos serviços extraordinários ---
// Metadados de UI por tipo (label, grupo, tipo de cláusula informativa). As
// FAIXAS de valor e os PERCENTUAIS vivem em Parametros.extraordinario (editáveis
// em Configurações → Extraordinário) — aqui é só a estrutura fixa/ordenação.
// Jurídico cravado; ma/valuation/viabilidade são plugáveis (placeholder=true).

import type { TipoExtraordinario, FaixaExtraordinario } from '../../types';

export interface CatalogoExtraordinarioEntry {
  tipo: TipoExtraordinario;
  label: string;
  grupo: 'Jurídico' | 'Estratégico';
  // Modelo da cláusula informativa (texto — NÃO calcula). undefined = sem cláusula.
  //  'success_fee' → success fee % sobre a mais-valia (resultado futuro).
  //  'pct_causa'   → % sobre o valor da causa, com mínimo em R$.
  clausula?: 'success_fee' | 'pct_causa';
  placeholder?: boolean;   // faixa a cravar pelo CFO (ma/valuation/viabilidade)
}

// Ordem = ordem de exibição no seletor do Orçador.
export const CATALOGO_EXTRAORDINARIO: CatalogoExtraordinarioEntry[] = [
  { tipo: 'juridico_elaboracao_simples',  label: 'Elaboração de documento — simples',  grupo: 'Jurídico' },
  { tipo: 'juridico_elaboracao_complexa', label: 'Elaboração de documento — complexa', grupo: 'Jurídico' },
  { tipo: 'juridico_parecer',             label: 'Parecer aprofundado',                grupo: 'Jurídico' },
  { tipo: 'juridico_representacao',       label: 'Representação / negociação',         grupo: 'Jurídico', clausula: 'success_fee' },
  { tipo: 'juridico_contencioso',         label: 'Contencioso',                        grupo: 'Jurídico', clausula: 'pct_causa' },
  { tipo: 'ma',          label: 'M&A — Fusões e Aquisições', grupo: 'Estratégico', placeholder: true },
  { tipo: 'valuation',   label: 'Valuation',                 grupo: 'Estratégico', placeholder: true },
  { tipo: 'viabilidade', label: 'Estudo de viabilidade',     grupo: 'Estratégico', placeholder: true },
];

export const CATALOGO_POR_TIPO: Record<TipoExtraordinario, CatalogoExtraordinarioEntry> =
  Object.fromEntries(CATALOGO_EXTRAORDINARIO.map(e => [e.tipo, e])) as Record<TipoExtraordinario, CatalogoExtraordinarioEntry>;

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const pct = (n: number) => n.toLocaleString('pt-BR') + '%';

/** Ponto default do percentual ao adicionar um item: mínimo da faixa %.
 *  Retorna undefined quando o tipo não tem cláusula. */
export function pctDefault(tipo: TipoExtraordinario, faixa: FaixaExtraordinario): number | undefined {
  const cat = CATALOGO_POR_TIPO[tipo];
  if (!cat?.clausula) return undefined;
  return faixa.clausula_pct_min ?? faixa.clausula_pct_max ?? 0;
}

/** Monta a cláusula informativa (texto) a partir do % ESCOLHIDO pelo CFO.
 *  faixa fornece o mínimo em R$ (contencioso). Retorna undefined quando o tipo
 *  não tem cláusula ou o % não foi definido. */
export function montarClausulaInformativa(tipo: TipoExtraordinario, pctEscolhido: number | undefined, faixa: FaixaExtraordinario): string | undefined {
  const cat = CATALOGO_POR_TIPO[tipo];
  if (!cat?.clausula || pctEscolhido == null) return undefined;
  if (cat.clausula === 'success_fee') {
    return `Success fee de ${pct(pctEscolhido)} sobre a mais-valia apurada, devido apenas em caso de êxito (apurado no resultado).`;
  }
  // pct_causa (contencioso)
  const minimo = faixa.clausula_minimo ? `, com honorários mínimos de ${brl(faixa.clausula_minimo)}` : '';
  return `Honorários de ${pct(pctEscolhido)} sobre o valor da causa${minimo}.`;
}
