// --- Régua de fechamento de período (Commit B) ---
// Checks AUTOMÁTICOS, PUROS e READ-ONLY. Nenhum recalcula nada: só COMPARAM
// valores que o sistema já produziu (Δ do pipeline, sets em memória do
// AppContext, presença de subcoleção). A coleta dos insumos (fetch de
// clientes_base e de custosDedicados) vive no modal — aqui é só o veredito.
//
// Os checks a–e ARMAM o botão "Fechar mês" quando todos passam. O check f é
// INFORMATIVO (informativo: true) — nunca trava, só reporta o estado real.

import type { Cliente, Colaborador } from '../types';
import type { Vinculo } from '../types/vinculo';
import { FUNCOES_ALOCACAO } from './constants';

export interface CheckFechamento {
  id: 'delta_folha' | 'clientes_copiados' | 'folha_presente'
    | 'vinculos_orfaos' | 'perfis_vazios' | 'custos_dedicados';
  label: string;
  ok: boolean;
  detalhe: string;
  /** true = não trava o fechamento (apenas informa). Só o check f. */
  informativo?: boolean;
}

export interface EntradaRegua {
  periodo: string;
  /** Δ da partição de folha exposto pelo pipeline (dadosPeriodo.deltaFolha).
   *  null quando o pipeline não rodou/expôs — check a falha por segurança. */
  deltaFolha: number | null;
  /** Clientes do período em memória (dadosPeriodo.clientes) — inclui pure assets. */
  clientesPeriodo: Cliente[];
  /** Clientes ATIVOS da base master (clientes_base já filtrado por
   *  data_entrada <= período pelo modal). Usado pelo check clientes_copiados. */
  clientesBaseAtivos: Cliente[];
  /** TODOS os clientes da base master (clientes_base sem filtro de data_entrada).
   *  Universo de EXISTÊNCIA usado pelo check vinculos_orfaos: um vínculo para um
   *  cliente que existe na base mas ainda não entrou no período (data_entrada
   *  futura) é INERTE, não órfão. Órfão = referência que não existe em lugar
   *  nenhum. Omitido → cai em clientesBaseAtivos (retrocompat). */
  clientesBaseTodos?: Cliente[];
  /** Colaboradores do período (dadosPeriodo.colaboradores). */
  colaboradores: Colaborador[];
  /** Vínculos do período (dadosPeriodo.vinculos). */
  vinculos: Vinculo[];
  /** true = o período tem docs próprios em custosDedicados/; false = usa o
   *  fallback do master (desenho, não bug). Informativo. */
  temCustosDedicadosProprios: boolean;
  /** Tolerância do Δ. Default 0,005 (meio centavo — mesmo epsilon dos scripts). */
  epsilon?: number;
}

const EPSILON_PADRAO = 0.005;

/** Normaliza nome p/ casamento tolerante (NFD + sem acento + upper + trim). */
function normNome(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

/** Cliente que legitimamente NÃO precisa de alocação de CFO: pure asset
 *  (asset_only) ou sem fee. Excluído do check perfis_vazios. */
function isPureAsset(c: Cliente): boolean {
  return c.pacote_servico === 'asset_only' || (c.receita_fee ?? 0) <= 0;
}

/** Cliente tem alguma alocação real na função f? Leitura dual (mesma do motor):
 *  vínculo com pct>0 OU campo legado pct_${f} > 0. */
function temAlocacaoFuncao(
  c: Cliente, f: string, vinculos: Vinculo[],
): boolean {
  const legado = (c as unknown as Record<string, number>)[`pct_${f}`] ?? 0;
  if (legado > 0) return true;
  if (!c.id_estavel) return false;
  return vinculos.some(v =>
    v.id_estavel_cliente === c.id_estavel && v.funcao === f && v.pct > 0);
}

// ── Checks individuais ───────────────────────────────────────────────────────

function checkDeltaFolha(e: EntradaRegua): CheckFechamento {
  const eps = e.epsilon ?? EPSILON_PADRAO;
  if (e.deltaFolha === null) {
    return {
      id: 'delta_folha', label: 'Partição da folha (Δ = 0,00)', ok: false,
      detalhe: 'Δ indisponível — o motor não expôs o valor do período.',
    };
  }
  const ok = Math.abs(e.deltaFolha) < eps;
  return {
    id: 'delta_folha', label: 'Partição da folha (Δ = 0,00)', ok,
    detalhe: ok
      ? `Δ = ${e.deltaFolha.toFixed(2)} (< ${eps} — folha ≡ direto+institucional+ociosidade).`
      : `Δ = ${e.deltaFolha.toFixed(2)} — parcelas da folha não fecham (tolerância ${eps}).`,
  };
}

function checkClientesCopiados(e: EntradaRegua): CheckFechamento {
  // Todo cliente ativo da base master precisa existir no período. Casa por
  // id_estavel; fallback por nome normalizado (cliente sem id_estavel).
  const idsPeriodo = new Set(
    e.clientesPeriodo.map(c => c.id_estavel).filter((x): x is string => !!x));
  const nomesPeriodo = new Set(e.clientesPeriodo.map(c => normNome(c.nome_cliente)));
  const faltando = e.clientesBaseAtivos.filter(c => {
    if (c.id_estavel && idsPeriodo.has(c.id_estavel)) return false;
    return !nomesPeriodo.has(normNome(c.nome_cliente));
  });
  const ok = faltando.length === 0;
  return {
    id: 'clientes_copiados', label: 'Clientes da base presentes no período', ok,
    detalhe: ok
      ? `${e.clientesBaseAtivos.length} clientes ativos da base — todos presentes.`
      : `${faltando.length} ausente(s): ${faltando.slice(0, 5).map(c => c.nome_cliente).join(', ')}${faltando.length > 5 ? '…' : ''}.`,
  };
}

function checkFolhaPresente(e: EntradaRegua): CheckFechamento {
  const n = e.colaboradores.length;
  const ok = n > 0;
  return {
    id: 'folha_presente', label: 'Folha do período presente', ok,
    detalhe: ok ? `${n} colaboradores no período.` : 'Nenhum colaborador no período.',
  };
}

function checkVinculosOrfaos(e: EntradaRegua): CheckFechamento {
  // Só vínculos com pct>0 importam — são os que o motor consome. pct=0 é inerte
  // (fallback), então referência dangling com pct=0 não afeta cálculo.
  // EXISTÊNCIA do cliente é testada contra o universo COMPLETO (base + período),
  // não contra o set ativo: vínculo para cliente real ainda não entrado
  // (data_entrada futura) é inerte, não órfão.
  const universoClientes = e.clientesBaseTodos ?? e.clientesBaseAtivos;
  const idsCli = new Set(
    [...e.clientesPeriodo, ...universoClientes]
      .map(c => c.id_estavel).filter((x): x is string => !!x));
  const idsColab = new Set(
    e.colaboradores.map(c => c.id_estavel).filter((x): x is string => !!x));
  const orfaos = e.vinculos.filter(v =>
    v.pct > 0
    && (!idsCli.has(v.id_estavel_cliente) || !idsColab.has(v.id_estavel_colaborador)));
  const ok = orfaos.length === 0;
  const ativos = e.vinculos.filter(v => v.pct > 0).length;
  return {
    id: 'vinculos_orfaos', label: 'Vínculos sem referência órfã', ok,
    detalhe: ok
      ? `${ativos} vínculo(s) com pct>0 — nenhum aponta para cliente/colaborador inexistente.`
      : `${orfaos.length} vínculo(s) órfão(s): pct>0 apontando para cliente/colaborador que não existe na base.`,
  };
}

function checkPerfisVazios(e: EntradaRegua): CheckFechamento {
  // Todo cliente NÃO pure-asset precisa de ao menos uma função com alocação
  // (vínculo pct>0 OU pct_${f} legado > 0). Pure asset é excluído por definição.
  const semAlocacao = e.clientesPeriodo.filter(c =>
    !isPureAsset(c)
    && !FUNCOES_ALOCACAO.some(f => temAlocacaoFuncao(c, f, e.vinculos)));
  const ok = semAlocacao.length === 0;
  const universo = e.clientesPeriodo.filter(c => !isPureAsset(c)).length;
  return {
    id: 'perfis_vazios', label: 'Clientes com alocação preenchida', ok,
    detalhe: ok
      ? `${universo} clientes com fee — todos têm ao menos uma função alocada.`
      : `${semAlocacao.length} sem alocação: ${semAlocacao.slice(0, 5).map(c => c.nome_cliente).join(', ')}${semAlocacao.length > 5 ? '…' : ''}.`,
  };
}

function checkCustosDedicados(e: EntradaRegua): CheckFechamento {
  // INFORMATIVO — nunca trava. Só diz se o período tem docs próprios ou usa o
  // fallback do master (desenho conhecido: copiarPeriodo não copia custosDedicados).
  return {
    id: 'custos_dedicados', label: 'Custos dedicados (informativo)',
    ok: e.temCustosDedicadosProprios, informativo: true,
    detalhe: e.temCustosDedicadosProprios
      ? 'Período tem docs próprios em custosDedicados/ (custo administrativo do mês).'
      : 'Sem docs próprios — custo administrativo usando o fallback do master.',
  };
}

/** Roda os 6 checks na ordem a–f. */
export function rodarReguaFechamento(e: EntradaRegua): CheckFechamento[] {
  return [
    checkDeltaFolha(e),
    checkClientesCopiados(e),
    checkFolhaPresente(e),
    checkVinculosOrfaos(e),
    checkPerfisVazios(e),
    checkCustosDedicados(e),
  ];
}

/** O botão "Fechar mês" arma quando TODOS os checks NÃO-informativos passam. */
export function reguaArmada(checks: CheckFechamento[]): boolean {
  return checks.filter(c => !c.informativo).every(c => c.ok);
}
