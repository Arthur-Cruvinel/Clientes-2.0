// --- Matcher DETERMINÍSTICO nome Monday → cliente canônico ---
// Match por PALAVRA INTEIRA (todos os tokens do nome Monday são palavras do canônico) —
// evita "ronald" pescar "rede ronaldo" (bug do preliminar). ENDURECIMENTO: ambiguidade
// (2+ candidatos) NUNCA desempata em silêncio → vai para quarentena. 0 candidatos →
// quarentena (não casado). O universo é clientes_base COMPLETO (inclui asset_only/Pure
// Assets — confirmado na Fase 0).

export interface ClienteUniverso { nome: string; id_estavel: string; }

export type Resolucao =
  | { tipo: 'match'; id_estavel: string; canonico: string }
  | { tipo: 'ambiguo'; candidatos: ClienteUniverso[] }
  | { tipo: 'nao_casado' };

const STOP = new Set(['dos', 'das', 'de', 'da', 'do', 'e']);
export const normNome = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const tokens = (s: string) => normNome(s).split(' ').filter(t => t.length >= 3 && !STOP.has(t));

/** Casa um nome Monday contra o universo. NÃO decide ambiguidade — devolve os candidatos. */
export function casarNomeMonday(nomeMonday: string, universo: ClienteUniverso[]): Resolucao {
  const mt = tokens(nomeMonday);
  if (mt.length === 0) return { tipo: 'nao_casado' };
  const cand = universo.filter(c => {
    const palavras = new Set(normNome(c.nome).split(' '));
    return mt.every(t => palavras.has(t));
  });
  if (cand.length === 0) return { tipo: 'nao_casado' };
  if (cand.length === 1) return { tipo: 'match', id_estavel: cand[0].id_estavel, canonico: cand[0].nome };
  return { tipo: 'ambiguo', candidatos: cand };
}
