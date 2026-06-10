// --- Modal de edição de cliente com abas ---

import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { FUNCOES_ALOCACAO, HORAS_CLT_MES, HORAS_PACOTE } from '../../utils/constants';
import { buscarHistoricoAlteracoes, excluirClientePeriodo, excluirClientePermanente } from '../../services/firebase';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../state/AuthContext';
import { PerfilComplexidadeTab, PERFIL_DEFAULT } from './PerfilComplexidadeTab';
import type { DadosCliente, Cliente, Colaborador, PacoteServico, FuncaoAlocacao, AlteracaoCliente, RegistroPoupanca, PerfilComplexidade, MoedaFee } from '../../types';
import type { Vinculo } from '../../types/vinculo';

interface Props {
  cliente: DadosCliente;
  // PL vem do RegistroPoupanca do período (CLAUDE.md). Exibido como read-only —
  // a edição de PL acontece no módulo AUM & Performance, não no Perfil.
  poupanca?: RegistroPoupanca;
  colaboradores: Colaborador[];
  bankers: string[];
  /** Vínculos cliente↔colaborador do período (Fase 2.5 — Peça 6). Fonte primária
   *  do pct exibido na aba Alocação; fallback no campo legado quando ausente. */
  vinculos: Vinculo[];
  /** Período selecionado — necessário para excluir do período específico. */
  periodo: string;
  onSalvar: (dados: Partial<Cliente>) => Promise<void>;
  /** Chamado após exclusão bem-sucedida para o pai recarregar a lista. */
  onExcluido?: () => void;
  salvando: boolean;
  onFechar: () => void;
}

type ExclusaoEstado =
  | { tipo: 'menu' }
  | { tipo: 'confirmar_periodo' }
  | { tipo: 'confirmar_permanente' }
  | { tipo: 'executando_periodo' }
  | { tipo: 'executando_permanente'; periodo: string; atual: number; total: number }
  | { tipo: 'sem_doc_no_periodo' }
  | { tipo: 'erro'; msg: string };

const LABEL_F: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Financeira', operacional_financeiro: 'Operacional',
  serv_adm: 'Adm.', serv_aux_adm: 'Aux. Adm.',
};
const PACOTES: PacoteServico[] = ['full', 'advanced', 'light', 'future', 'asset_only'];
const ABAS = ['Alocação', 'Configuração', 'Complexidade', 'Cadastral', 'Histórico'] as const;

const LABEL_CAMPO: Record<string, string> = {
  receita_fee: 'Fee', pacote_servico: 'Pacote', banker: 'Banker', empresario: 'Empresário',
  data_entrada: 'Data entrada', moeda_fee: 'Moeda do fee',
  percentual_rebate_anual_onshore: 'Rebate onshore', percentual_rebate_anual_offshore: 'Rebate offshore',
  aliquota_impostos_rebate: 'Alíq. imp. rebate',
  pct_consultoria_gestao: '% Gestão', pct_consultoria_planejamento: '% Planejamento',
  pct_consultoria_financeira: '% Financeira', pct_operacional_financeiro: '% Operacional',
  pct_serv_adm: '% Adm.', pct_serv_aux_adm: '% Aux. Adm.',
  // fator_* mantidos apenas para formatar entradas de histórico anteriores ao
  // redesenho de pct_* — nenhum código atual escreve esses campos.
  fator_consultoria_gestao: 'Fator gestão (calc.)', fator_consultoria_planejamento: 'Fator planejamento (calc.)',
  fator_consultoria_financeira: 'Fator financeira (calc.)', fator_operacional_financeiro: 'Fator operacional (calc.)',
  fator_serv_adm: 'Fator adm. (calc.)', fator_serv_aux_adm: 'Fator aux. adm. (calc.)',
  consultoria_gestao: 'Gestor', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Financeira', operacional_financeiro: 'Operacional',
  serv_adm: 'Adm.', serv_aux_adm: 'Aux. adm.',
  peso_juridico: 'Peso Consultoria & Legal (Jurídico)',
  volume_movimentos_mes: 'Vol. movimentos',
  utiliza_servico_juridico: 'Consultoria & Legal (Jurídico)', utiliza_conciliacao: 'Conciliação',
  pl_onshore: 'AUM Onshore', pl_offshore: 'AUM Offshore',
  custo_contabilidade_dedicado: 'Custo contab.', custo_pagamento_dedicado: 'Custo pgto.',
  custo_administrativo_dedicado: 'Custo adm.', custo_viagem_dedicado: 'Custo viagem',
};

const CAMPOS_MOEDA = new Set(['receita_fee', 'pl_onshore', 'pl_offshore', 'custo_contabilidade_dedicado', 'custo_pagamento_dedicado', 'custo_administrativo_dedicado', 'custo_viagem_dedicado']);
const CAMPOS_PCT = new Set(['percentual_rebate_anual_onshore', 'percentual_rebate_anual_offshore', 'aliquota_impostos_rebate']);

function fmtValorHistorico(campo: string, valor: unknown): string {
  if (valor == null) return '—';
  if (CAMPOS_MOEDA.has(campo)) return formatCurrency(Number(valor));
  if (CAMPOS_PCT.has(campo)) return `${(Number(valor) * 100).toFixed(2)}%`;
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor);
}

/** Leitura dual de pct (Fase 2.5 — Peça 6): vínculo com pct > 0 é fonte
 *  primária; campo legado cliente.pct_${funcao} é fallback. Retorna em
 *  percentual humano (0-100) pronto para o form.
 *
 *  Match direto por (id_estavel_cliente, funcao) — espelha exatamente
 *  resolverColaboradorParaFuncao do pipeline (financials.custos.ts). NÃO passa
 *  pelo nome do colaborador no campo do cliente, porque grafia legada
 *  quebrada (ex: "Luiz Nerone" vs cadastro "Luis Eduardo Nerone") faria o
 *  lookup falhar mesmo com vínculo existindo. id_estavel_cliente é único por
 *  cliente, então essa busca já é determinística — Bug Arquitetural #1
 *  (duplicação de docs) também não atrapalha. */
function resolverPctDoVinculo(
  cliente: Cliente,
  funcao: FuncaoAlocacao,
  vinculos: Vinculo[],
): number {
  const pctLegado = ((cliente[`pct_${funcao}` as keyof Cliente] as number | undefined) ?? 0) * 100;
  if (!cliente.id_estavel) return pctLegado;
  const vinculo = vinculos.find(v =>
    v.id_estavel_cliente === cliente.id_estavel
    && v.funcao === funcao
    && v.pct > 0,
  );
  return vinculo ? vinculo.pct * 100 : pctLegado;
}

/** Nome canônico do colaborador da função, vindo do vínculo quando existir
 *  (independente de pct). Corrige o caso em que o campo cliente[funcao]
 *  guarda nome legado quebrado (ex: 'Luiz Nerone' em vez do canônico
 *  'Luis Eduardo Nerone'): o dropdown não casaria com nenhuma opção do select
 *  e mostraria vazio. Pelo vínculo, o nome é o canônico — escrito pela
 *  migração da Peça 2 e pelos saves da Peça 6 corrigida. Fallback no campo
 *  legado quando vínculo ausente. */
function resolverNomeColabDoVinculo(
  cliente: Cliente,
  funcao: FuncaoAlocacao,
  vinculos: Vinculo[],
): string {
  const nomeLegado = (cliente[funcao] as string | undefined) ?? '';
  if (!cliente.id_estavel) return nomeLegado;
  const vinculo = vinculos.find(v =>
    v.id_estavel_cliente === cliente.id_estavel
    && v.funcao === funcao,
  );
  return vinculo?.nome_colaborador ?? nomeLegado;
}

export function EditarClienteModal({ cliente, poupanca, colaboradores, bankers, vinculos, periodo, onSalvar, onExcluido, salvando, onFechar }: Props) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Alocação');
  // Estado da aba Complexidade ELEVADO ao modal — a aba é renderizada
  // condicionalmente (desmonta ao trocar), então o estado precisa viver aqui
  // para persistir enquanto o modal está aberto (descartado só ao fechar).
  const [perfilComplex, setPerfilComplex] = useState<PerfilComplexidade>(
    () => cliente.perfil_complexidade ?? PERFIL_DEFAULT);
  const [qtdRecebiveis, setQtdRecebiveis] = useState<number>(cliente.qtd_recebiveis_mes ?? 0);
  const [qtdContratacoes, setQtdContratacoes] = useState<number>(cliente.qtd_contratacoes_mes ?? 0);
  const [historico, setHistorico] = useState<AlteracaoCliente[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [exclusao, setExclusao] = useState<ExclusaoEstado | null>(null);

  useEffect(() => {
    if (aba !== 'Histórico') return;
    setHistoricoLoading(true);
    buscarHistoricoAlteracoes(cliente.nome_cliente)
      .then(setHistorico)
      .finally(() => setHistoricoLoading(false));
  }, [aba, cliente.nome_cliente]);

  const [form, setForm] = useState(() => ({
    pacote_servico: cliente.pacote_servico,
    // Fase 2.5 — Peça 6: nome do colab vem do vínculo quando existe (canônico,
    // ex: 'Luis Eduardo Nerone'); fallback no campo legado do cliente (que
    // pode ter grafia quebrada, ex: 'Luiz Nerone'). Sem isso, dropdown não
    // casaria com nenhuma <option> e exibiria '—'.
    consultoria_gestao: resolverNomeColabDoVinculo(cliente, 'consultoria_gestao', vinculos),
    consultoria_planejamento: resolverNomeColabDoVinculo(cliente, 'consultoria_planejamento', vinculos),
    consultoria_financeira: resolverNomeColabDoVinculo(cliente, 'consultoria_financeira', vinculos),
    operacional_financeiro: resolverNomeColabDoVinculo(cliente, 'operacional_financeiro', vinculos),
    serv_adm: resolverNomeColabDoVinculo(cliente, 'serv_adm', vinculos),
    serv_aux_adm: resolverNomeColabDoVinculo(cliente, 'serv_aux_adm', vinculos),
    // pct_* armazenados como decimal (0-1) no Firestore; form trabalha em
    // percentual (0-100) — convertido ÷100 no payload. Mesmo padrão do rebate.
    // Fase 2.5 — Peça 6: fonte primária é o vínculo correspondente em vinculos/;
    // fallback no campo legado do cliente. resolverPctDoVinculo retorna em
    // percentual humano pronto para o form (sem * 100 adicional aqui).
    pct_consultoria_gestao: resolverPctDoVinculo(cliente, 'consultoria_gestao', vinculos),
    pct_consultoria_planejamento: resolverPctDoVinculo(cliente, 'consultoria_planejamento', vinculos),
    pct_consultoria_financeira: resolverPctDoVinculo(cliente, 'consultoria_financeira', vinculos),
    pct_operacional_financeiro: resolverPctDoVinculo(cliente, 'operacional_financeiro', vinculos),
    pct_serv_adm: resolverPctDoVinculo(cliente, 'serv_adm', vinculos),
    pct_serv_aux_adm: resolverPctDoVinculo(cliente, 'serv_aux_adm', vinculos),
    peso_juridico: cliente.peso_juridico ?? 1.0,
    volume_movimentos_mes: cliente.volume_movimentos_mes ?? 0,
    utiliza_servico_juridico: cliente.utiliza_servico_juridico,
    utiliza_conciliacao: cliente.utiliza_conciliacao,
    percentual_rebate_anual_onshore: (cliente.percentual_rebate_anual_onshore ?? 0) * 100,
    percentual_rebate_anual_offshore: (cliente.percentual_rebate_anual_offshore ?? 0) * 100,
    aliquota_impostos_rebate: (cliente.aliquota_impostos_rebate ?? 0) * 100,
    empresario: cliente.empresario ?? '',
    banker: cliente.banker ?? '',
    // Fee em moeda estrangeira: o input mostra o valor na moeda ORIGINAL
    // (receita_fee_original); receita_fee persistido fica em BRL. Para BRL ou
    // clientes sem conversão, mostra receita_fee direto (retrocompat).
    receita_fee: (cliente.moeda_fee && cliente.moeda_fee !== 'BRL' && cliente.receita_fee_original != null)
      ? cliente.receita_fee_original
      : cliente.receita_fee,
    moeda_fee: (cliente.moeda_fee ?? 'BRL') as MoedaFee,
    custo_contabilidade_dedicado: cliente.custo_contabilidade_dedicado ?? 0,
    custo_pagamento_dedicado: cliente.custo_pagamento_dedicado ?? 0,
    custo_administrativo_dedicado: cliente.custo_administrativo_dedicado ?? 0,
    custo_viagem_dedicado: cliente.custo_viagem_dedicado ?? 0,
    data_entrada_mes: cliente.data_entrada ? Number(cliente.data_entrada.split('-')[1]) : 0,
    data_entrada_ano: cliente.data_entrada ? Number(cliente.data_entrada.split('-')[0]) : 0,
  }));

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  // Filtra linhas-fantasma do Firestore (legendas, cabeçalhos órfãos): mesmo
  // gate canônico de useColaboradores.ts — exige nome + cargo + função.
  const colaboradoresValidos = colaboradores.filter(
    c => c.nome_colaborador?.trim() && c.cargo?.trim() && c.funcao_principal,
  );
  const nomes = colaboradoresValidos.map(c => c.nome_colaborador).sort();
  const INP = 'rounded px-2 py-1.5 text-sm w-full';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };

  function handleSalvar() {
    // pct_* normalmente NÃO entra no payload (edição feita em "Alocação em
    // Lote"). Exceção: quando o colaborador da função foi removido (vazio),
    // zeramos pct_funcao no payload — caso contrário o cliente fica com %
    // dedicação órfão (sem dono) gerando "Reajuste automático" inválido na
    // próxima passada do motor.
    const pctZerados: Partial<Cliente> = {};
    for (const f of FUNCOES_ALOCACAO) {
      const colab = (form as Record<string, unknown>)[f] as string | undefined;
      if (!colab || !colab.trim()) {
        (pctZerados as Record<string, number>)[`pct_${f}`] = 0;
      }
    }

    onSalvar({
      pacote_servico: form.pacote_servico,
      consultoria_gestao: form.consultoria_gestao || undefined,
      consultoria_planejamento: form.consultoria_planejamento || undefined,
      consultoria_financeira: form.consultoria_financeira || undefined,
      operacional_financeiro: form.operacional_financeiro || undefined,
      serv_adm: form.serv_adm || undefined,
      serv_aux_adm: form.serv_aux_adm || undefined,
      ...pctZerados,
      peso_juridico: form.peso_juridico,
      volume_movimentos_mes: form.volume_movimentos_mes,
      // Complexidade: o "Salvar" do modal também persiste (em clientes_base/),
      // não só o botão "Salvar Complexidade" da aba.
      perfil_complexidade: perfilComplex,
      qtd_recebiveis_mes: qtdRecebiveis,
      qtd_contratacoes_mes: qtdContratacoes,
      utiliza_servico_juridico: form.utiliza_servico_juridico,
      utiliza_conciliacao: form.utiliza_conciliacao,
      percentual_rebate_anual_onshore: form.percentual_rebate_anual_onshore / 100,
      percentual_rebate_anual_offshore: form.percentual_rebate_anual_offshore / 100,
      aliquota_impostos_rebate: form.aliquota_impostos_rebate / 100,
      empresario: form.empresario || undefined,
      banker: form.banker || undefined,
      // receita_fee aqui é o valor na moeda selecionada (form.moeda_fee). A
      // conversão p/ BRL + gravação dos campos de auditoria acontece em
      // usePerfil.salvarCliente, que tem acesso ao buscarPtaxDiaAnterior.
      receita_fee: form.receita_fee,
      moeda_fee: form.moeda_fee,
      custo_contabilidade_dedicado: form.custo_contabilidade_dedicado,
      custo_pagamento_dedicado: form.custo_pagamento_dedicado,
      custo_administrativo_dedicado: form.custo_administrativo_dedicado,
      custo_viagem_dedicado: form.custo_viagem_dedicado,
      data_entrada: form.data_entrada_ano > 0 && form.data_entrada_mes > 0
        ? `${form.data_entrada_ano}-${String(form.data_entrada_mes).padStart(2, '0')}`
        : undefined,
    });
  }

  return (
    <Modal aberto onFechar={onFechar} titulo={`Editar — ${cliente.nome_cliente}`}>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 rounded-lg p-1" style={{ backgroundColor: '#f3f4f6' }}>
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${aba === a ? 'bg-white shadow-sm' : ''}`}
            style={{ color: aba === a ? '#160F41' : '#6b6b8a' }}>{a}</button>
        ))}
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto">
        {aba === 'Alocação' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Pacote</label>
              <select value={form.pacote_servico} onChange={e => set('pacote_servico', e.target.value)}
                className={INP} style={BRD}>
                {PACOTES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {FUNCOES_ALOCACAO.map(f => {
              const colabFuncao = ((form as Record<string, unknown>)[f] as string | undefined) ?? '';
              const semColab = !colabFuncao.trim();
              const pctPercentual = (form as Record<string, unknown>)[`pct_${f}`] as number;
              const horasPacote = HORAS_PACOTE[form.pacote_servico]?.[f] ?? 0;
              const pctNorm = horasPacote / HORAS_CLT_MES;
              const fator = (form.pacote_servico === 'asset_only' || pctNorm <= 0)
                ? 0 : (pctPercentual / 100) / pctNorm;
              // Fator só faz sentido quando há colaborador atribuído E pct > 0;
              // caso contrário renderiza '—' em cinza.
              const semFator = semColab || pctPercentual <= 0;
              const corFator = semFator ? '#9ca3af'
                : fator > 1.5 ? '#dc2626'
                : fator > 1.0 ? '#ea580c' : '#16a34a';
              return (
                <div key={f} className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>{LABEL_F[f]}</label>
                    <select value={(form as Record<string, unknown>)[f] as string ?? ''}
                      onChange={e => {
                        const novo = e.target.value;
                        // Ao remover o colaborador, zera o pct local — evita
                        // % órfão exibido no resumo enquanto o user não salva.
                        setForm(prev => ({
                          ...prev,
                          [f]: novo,
                          ...(novo === '' ? { [`pct_${f}`]: 0 } : {}),
                        }));
                      }}
                      className={`${INP} text-xs`} style={BRD}>
                      <option value="">—</option>
                      {nomes.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>% dedicação</label>
                    <div className={INP} style={{ ...BRD, backgroundColor: '#f9f9fb', color: '#6b6b8a' }}>
                      {pctPercentual.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>Fator</label>
                    <div className="text-xs font-medium px-2 py-1.5 rounded text-center"
                      style={{ backgroundColor: '#f9f9fb', color: corFator }}>
                      {semFator ? '—' : fator.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] mt-2 px-3 py-2 rounded" style={{ backgroundColor: '#f9f9fb', color: '#6b6b8a' }}>
              % de dedicação é somente leitura aqui — para editar a alocação,
              use a aba <strong>Alocação em Lote</strong> no painel de Perfil.
            </p>
          </>
        )}

        {aba === 'Configuração' && (
          <>
            {[
              ['peso_juridico', 'Peso jurídico', 0.1],
              ['volume_movimentos_mes', 'Volume movimentos/mês', 1],
            ].map(([k, label, step]) => (
              <div key={k as string} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label as string}</label>
                <input type="number" step={step as number} value={(form as Record<string, unknown>)[k as string] as number}
                  onChange={e => set(k as string, Number(e.target.value))} className={`${INP} w-40`} style={BRD} />
              </div>
            ))}
            {['utiliza_servico_juridico', 'utiliza_conciliacao'].map(k => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#160F41' }}>
                <input type="checkbox" checked={(form as Record<string, unknown>)[k] as boolean}
                  onChange={e => set(k, e.target.checked)} className="rounded" />
                {k === 'utiliza_servico_juridico' ? 'Utiliza serviço jurídico' : 'Utiliza conciliação'}
              </label>
            ))}
            {[
              ['percentual_rebate_anual_onshore', 'Taxa rebate onshore (%)'],
              ['percentual_rebate_anual_offshore', 'Taxa rebate offshore (%)'],
              ['aliquota_impostos_rebate', 'Alíquota imp. rebate (%)'],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label}</label>
                <input type="number" step="0.01" value={(form as Record<string, unknown>)[k] as number}
                  onChange={e => set(k, Number(e.target.value))} className={`${INP} w-40`} style={BRD} />
              </div>
            ))}
          </>
        )}

        {aba === 'Complexidade' && (
          // volume_movimentos_mes vive no form e é compartilhado com a aba
          // Configuração — editar em qualquer lugar reflete no form único.
          <PerfilComplexidadeTab cliente={cliente}
            volumeMovimentosMes={form.volume_movimentos_mes}
            setVolumeMovimentosMes={v => set('volume_movimentos_mes', v)}
            perfil={perfilComplex} setPerfil={setPerfilComplex}
            qtdRecebiveis={qtdRecebiveis} setQtdRecebiveis={setQtdRecebiveis}
            qtdContratacoes={qtdContratacoes} setQtdContratacoes={setQtdContratacoes} />
        )}

        {aba === 'Cadastral' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Empresário</label>
              <input value={form.empresario} onChange={e => set('empresario', e.target.value)}
                className={INP} style={BRD} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Banker Responsável</label>
              <input value={form.banker} onChange={e => set('banker', e.target.value)}
                list="bankers-datalist" placeholder="Nome do banker..."
                className={INP} style={BRD} />
              <datalist id="bankers-datalist">
                {bankers.map(b => <option key={b} value={b} />)}
              </datalist>
              {!form.banker && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs mt-1"
                  style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                  <AlertTriangle size={11} /> Sem banker
                </span>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Data de Entrada</label>
              <div className="flex gap-2">
                <select value={form.data_entrada_mes} onChange={e => set('data_entrada_mes', Number(e.target.value))}
                  className="rounded px-2 py-1.5 text-sm flex-1 min-w-0" style={BRD}>
                  <option value={0}>Mês...</option>
                  {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((l, i) => (
                    <option key={i} value={i + 1}>{l}</option>
                  ))}
                </select>
                <select value={form.data_entrada_ano} onChange={e => set('data_entrada_ano', Number(e.target.value))}
                  className="rounded px-2 py-1.5 text-sm w-24 flex-shrink-0" style={BRD}>
                  <option value={0}>Ano...</option>
                  {Array.from({ length: 21 }, (_, i) => 2010 + i).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Receita fee + moeda. Fee em moeda estrangeira é convertido para
                BRL na gravação (PTAX do dia anterior — ver usePerfil). */}
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Receita fee</label>
              <div className="flex gap-2">
                <input type="number" step="0.01" value={form.receita_fee}
                  onChange={e => set('receita_fee', Number(e.target.value))} className={INP} style={BRD} />
                <select value={form.moeda_fee} onChange={e => set('moeda_fee', e.target.value as MoedaFee)}
                  className="rounded px-2 py-1.5 text-sm w-20 flex-shrink-0" style={BRD}>
                  {(['BRL', 'USD', 'EUR', 'GBP'] as const).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {form.moeda_fee !== 'BRL' && (
                <p className="text-[10px]" style={{ color: '#6b6b8a' }}>
                  Fee em {form.moeda_fee} — convertido para BRL ao salvar, pela PTAX de venda do dia anterior.
                </p>
              )}
            </div>
            {[
              ['custo_contabilidade_dedicado', 'Custo contabilidade'],
              ['custo_pagamento_dedicado', 'Custo pagamento'],
              ['custo_administrativo_dedicado', 'Custo administrativo'],
              ['custo_viagem_dedicado', 'Custo viagem'],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label}</label>
                <input type="number" step="0.01" value={(form as Record<string, unknown>)[k] as number}
                  onChange={e => set(k, Number(e.target.value))} className={INP} style={BRD} />
              </div>
            ))}

            {/* AUM somente leitura — gerenciado pelo módulo AUM & Performance. */}
            <div className="space-y-1 pt-2 border-t" style={{ borderColor: '#f3f4f6' }}>
              <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b6b8a' }}>
                AUM do período (somente leitura)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>AUM Onshore</label>
                  <div className={INP} style={{ ...BRD, backgroundColor: '#f9f9fb' }}>
                    {formatCurrency(poupanca?.pl_onshore ?? 0)}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>AUM Offshore</label>
                  <div className={INP} style={{ ...BRD, backgroundColor: '#f9f9fb' }}>
                    {formatCurrency(poupanca?.pl_offshore ?? 0)}
                  </div>
                </div>
              </div>
              <p className="text-[10px]" style={{ color: '#6b6b8a' }}>
                Editar PL na aba AUM &amp; Performance.
              </p>
            </div>
          </>
        )}

        {aba === 'Histórico' && (
          <>
            {historicoLoading && (
              <div className="flex items-center gap-2 text-sm py-4" style={{ color: '#6b6b8a' }}>
                <Loader2 size={14} className="animate-spin" /> Carregando histórico...
              </div>
            )}
            {!historicoLoading && historico.length === 0 && (
              <p className="text-sm py-4" style={{ color: '#6b6b8a' }}>Nenhuma alteração registrada</p>
            )}
            {!historicoLoading && historico.length > 0 && (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
                <table className="min-w-full text-xs">
                  <thead style={{ backgroundColor: '#f9f9fb' }}>
                    <tr>
                      <th className="px-2 py-2 text-left font-bold uppercase" style={{ color: '#6b6b8a' }}>Data</th>
                      <th className="px-2 py-2 text-left font-bold uppercase" style={{ color: '#6b6b8a' }}>Campo</th>
                      <th className="px-2 py-2 text-right font-bold uppercase" style={{ color: '#6b6b8a' }}>Anterior</th>
                      <th className="px-2 py-2 text-right font-bold uppercase" style={{ color: '#6b6b8a' }}>Novo</th>
                      <th className="px-2 py-2 text-left font-bold uppercase" style={{ color: '#6b6b8a' }}>Por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                    {historico.map((h, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: '#160F41' }}>
                          {new Date(h.alterado_em).toLocaleDateString('pt-BR')} {new Date(h.alterado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-2 py-1.5 font-medium" style={{ color: '#160F41' }}>
                          {LABEL_CAMPO[h.campo] ?? h.campo}
                        </td>
                        <td className="px-2 py-1.5 text-right" style={{ color: '#991b1b' }}>
                          {fmtValorHistorico(h.campo, h.valor_anterior)}
                        </td>
                        <td className="px-2 py-1.5 text-right" style={{ color: '#166534' }}>
                          {fmtValorHistorico(h.campo, h.valor_novo)}
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[120px]" style={{ color: '#6b6b8a' }}>
                          {h.alterado_por}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rodapé */}
      <div className="flex gap-3 items-center mt-4 pt-4 border-t" style={{ borderColor: '#e2e2e8' }}>
        {isAdmin && cliente.id && (
          <button onClick={() => setExclusao({ tipo: 'menu' })} disabled={salvando}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{ color: '#dc2626', border: '1px solid #fecaca' }}>
            <Trash2 size={12} /> Excluir
          </button>
        )}
        <div className="ml-auto flex gap-3">
          <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
          <button onClick={handleSalvar} disabled={salvando}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {exclusao && cliente.id && (
        <ConfirmacaoExclusaoCliente
          cliente={cliente}
          periodo={periodo}
          estado={exclusao}
          setEstado={setExclusao}
          onConcluido={() => { setExclusao(null); onExcluido?.(); onFechar(); }} />
      )}
    </Modal>
  );
}

interface PropsConfirmacao {
  cliente: DadosCliente;
  periodo: string;
  estado: ExclusaoEstado;
  setEstado: (e: ExclusaoEstado | null) => void;
  onConcluido: () => void;
}

function ConfirmacaoExclusaoCliente({ cliente, periodo, estado, setEstado, onConcluido }: PropsConfirmacao) {
  if (!cliente.id) return null;
  const id = cliente.id;

  async function executarPeriodo() {
    setEstado({ tipo: 'executando_periodo' });
    try {
      // Passa id_estavel: o snapshot do período tem docId UUID ≠ slug (id).
      const r = await excluirClientePeriodo(id, periodo, cliente.id_estavel);
      if (!r.sucesso && r.motivo === 'sem_doc_no_periodo') {
        // Cliente aparece via fallback de clientes_base/ num período sem
        // snapshot próprio — não há o que excluir aqui. Avisa honestamente.
        setEstado({ tipo: 'sem_doc_no_periodo' });
        return;
      }
      onConcluido();
    } catch (e) {
      setEstado({ tipo: 'erro', msg: e instanceof Error ? e.message : 'Falha ao excluir.' });
    }
  }

  async function executarPermanente() {
    setEstado({ tipo: 'executando_permanente', periodo: '…', atual: 0, total: 0 });
    try {
      const r = await excluirClientePermanente(id, cliente.id_estavel, (p, atual, total) =>
        setEstado({ tipo: 'executando_permanente', periodo: p, atual, total }));
      if (r.erros.length > 0) {
        setEstado({ tipo: 'erro', msg: `Falhas em ${r.erros.length} operação(ões): ${r.erros.slice(0, 3).join('; ')}…` });
      } else {
        onConcluido();
      }
    } catch (e) {
      setEstado({ tipo: 'erro', msg: e instanceof Error ? e.message : 'Falha ao excluir.' });
    }
  }

  const titulo = estado.tipo === 'menu' ? 'Excluir cliente'
    : estado.tipo === 'confirmar_periodo' ? `Excluir de ${periodo}?`
    : estado.tipo === 'confirmar_permanente' ? 'Excluir PERMANENTEMENTE?'
    : estado.tipo === 'sem_doc_no_periodo' ? 'Sem registro neste período'
    : estado.tipo === 'erro' ? 'Erro' : 'Excluindo…';

  // Bloqueia fechar durante execução.
  const handleFechar = (estado.tipo === 'executando_periodo' || estado.tipo === 'executando_permanente')
    ? () => {} : () => setEstado(null);

  return (
    <Modal aberto onFechar={handleFechar} titulo={titulo}>
      {estado.tipo === 'menu' && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: '#160F41' }}>Cliente: <strong>{cliente.nome_cliente}</strong></p>
          <button onClick={() => setEstado({ tipo: 'confirmar_periodo' })}
            className="w-full text-left p-3 rounded-lg" style={{ border: '1px solid #e2e2e8' }}>
            <p className="text-sm font-medium" style={{ color: '#160F41' }}>Excluir apenas de <code>{periodo}</code></p>
            <p className="text-xs" style={{ color: '#6b6b8a' }}>Remove o doc deste período. Outros períodos e o cadastro mestre permanecem.</p>
          </button>
          <button onClick={() => setEstado({ tipo: 'confirmar_permanente' })}
            className="w-full text-left p-3 rounded-lg" style={{ border: '1px solid #fecaca', backgroundColor: '#fef2f2' }}>
            <p className="text-sm font-medium" style={{ color: '#dc2626' }}>Excluir permanentemente (todos os períodos)</p>
            <p className="text-xs" style={{ color: '#991b1b' }}>Remove o cliente de TODOS os fechamentos + cadastro mestre. Irreversível.</p>
          </button>
          <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setEstado(null)} className="px-4 py-2 rounded-lg text-sm"
              style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
          </div>
        </div>
      )}

      {estado.tipo === 'confirmar_periodo' && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: '#160F41' }}>Remover <strong>{cliente.nome_cliente}</strong> apenas do período <code>{periodo}</code>?</p>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Histórico em outros períodos é preservado. O cadastro mestre não é afetado.</p>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setEstado({ tipo: 'menu' })} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Voltar</button>
            <button onClick={executarPeriodo} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">Confirmar</button>
          </div>
        </div>
      )}

      {estado.tipo === 'confirmar_permanente' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm"><strong>Esta ação não pode ser desfeita.</strong> O cliente <strong>{cliente.nome_cliente}</strong> será removido de TODOS os períodos + do cadastro mestre.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setEstado({ tipo: 'menu' })} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Voltar</button>
            <button onClick={executarPermanente} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>Excluir permanentemente</button>
          </div>
        </div>
      )}

      {estado.tipo === 'executando_periodo' && (
        <div className="flex items-center gap-2 text-sm" style={{ color: '#160F41' }}>
          <Loader2 size={16} className="animate-spin" /> Excluindo…
        </div>
      )}

      {estado.tipo === 'executando_permanente' && (
        <div className="space-y-2">
          <p className="text-sm flex items-center gap-2" style={{ color: '#160F41' }}>
            <Loader2 size={14} className="animate-spin" /> Removendo de {estado.periodo}…
            {estado.total > 0 && <span className="ml-auto text-xs" style={{ color: '#6b6b8a' }}>{estado.atual}/{estado.total}</span>}
          </p>
          {estado.total > 0 && (
            <div className="rounded-full overflow-hidden h-2" style={{ backgroundColor: '#f3f4f6' }}>
              <div className="h-full bg-gradient-brand transition-all" style={{ width: `${(estado.atual / estado.total) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {estado.tipo === 'sem_doc_no_periodo' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm">
              Este cliente não possui registro no período <code>{periodo}</code>.
              Para removê-lo completamente, use <strong>Excluir permanentemente</strong>.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setEstado(null)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Fechar</button>
            <button onClick={() => setEstado({ tipo: 'confirmar_permanente' })} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>Excluir permanentemente</button>
          </div>
        </div>
      )}

      {estado.tipo === 'erro' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm">{estado.msg}</p>
          </div>
          <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setEstado(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">Fechar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
