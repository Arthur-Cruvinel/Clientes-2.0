// --- Orçador de Extraordinário (Lote B) ---
// Ferramenta avulsa: monta orçamentos de serviços extraordinários (pontuais,
// fora do fee, a preço de mercado). SELETOR de valor fixo (faixa editável) +
// cláusulas % informativas (texto, não calcula). Espelha o GeradorProposta:
// form → monta DadosOrcamento → "Gerar" (PDF via gerar-pdf) / "Salvar"
// (persiste em orcamentos/). NÃO toca o motor do fee.

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { salvarOrcamento, buscarOrcamentos, atualizarOrcamentoStatus, excluirOrcamento } from '../../services/firebase';
import { gerarOrcamentoHTML } from './orcamentoTemplate';
import { CATALOGO_EXTRAORDINARIO, CATALOGO_POR_TIPO, montarClausulaInformativa, pctDefault } from './catalogoExtraordinario';
import { precificarLinhaCalculada, type LinhaCalculadaResult } from '../simulador/precificacaoBase';
import { ALIQUOTAS, FUNCOES_ALOCACAO } from '../../utils/constants';
import type { DadosOrcamento, ItemOrcamento, TipoExtraordinario, NaturezaOrcamento, FuncaoAlocacao } from '../../types';

const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
const STATUS: DadosOrcamento['status'][] = ['rascunho', 'enviado', 'aceito', 'recusado'];

// Rótulos curtos das 6 funções + jurídica (linha calculada por esforço).
const LABEL_FUNCAO_ORC: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planej.', consultoria_financeira: 'Financ.',
  operacional_financeiro: 'Operac.', serv_adm: 'Adm.', serv_aux_adm: 'Aux.',
};
const horasZero = (): Record<FuncaoAlocacao, number> => ({
  consultoria_gestao: 0, consultoria_planejamento: 0, consultoria_financeira: 0,
  operacional_financeiro: 0, serv_adm: 0, serv_aux_adm: 0,
});

export function Orcador() {
  const { dadosPeriodo, parametros } = useApp();

  const [nomeCliente, setNomeCliente] = useState('');
  const [idEstavelCliente, setIdEstavelCliente] = useState<string | undefined>();
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [validadeDias, setValidadeDias] = useState(15);
  const [observacoes, setObservacoes] = useState('');
  const [tipoNovo, setTipoNovo] = useState<TipoExtraordinario>('juridico_parecer');
  const [naturezaNova, setNaturezaNova] = useState<NaturezaOrcamento>('tabelado');
  const [editId, setEditId] = useState<string | undefined>();

  const regime = dadosPeriodo?.parametros?.regime ?? 'presumido';
  const [orcamentos, setOrcamentos] = useState<DadosOrcamento[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const nomesClientes = useMemo(() =>
    [...(dadosPeriodo?.clientes ?? [])].map(c => c.nome_cliente).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [dadosPeriodo]);

  const valorTotal = useMemo(() => itens.reduce((s, it) => s + (it.valor || 0), 0), [itens]);

  useEffect(() => { buscarOrcamentos().then(setOrcamentos).catch(() => {}); }, []);

  function selecionarCliente(nome: string) {
    setNomeCliente(nome);
    const cli = dadosPeriodo?.clientes.find(c => c.nome_cliente === nome);
    setIdEstavelCliente(cli?.id_estavel);
  }

  function adicionarItem() {
    const cat = CATALOGO_POR_TIPO[tipoNovo];
    // CALCULADO (por esforço): nasce com horas zeradas + margem default; preço 0
    // até o usuário informar horas (recalculado em setItemCalc).
    if (naturezaNova === 'calculado') {
      const novo: ItemOrcamento = {
        tipo: tipoNovo, descricao: cat.label, natureza: 'calculado', valor: 0,
        horas_por_funcao: horasZero(), horas_juridicas: 0, margem: parametros.margem_alvo,
      };
      setItens(prev => [...prev, novo]);
      return;
    }
    // SUCCESS FEE (condicional): % sobre base (transação|mais-valia) → projeção
    // estimada. valor=0 — NÃO entra no total fechado (só regra + projeção).
    if (naturezaNova === 'success_fee') {
      const novo: ItemOrcamento = {
        tipo: tipoNovo, descricao: cat.label, natureza: 'success_fee', valor: 0,
        base_success: 'transacao', percentual_success: 0.10, valor_base_estimado: 0, projecao_success: 0,
      };
      setItens(prev => [...prev, novo]);
      return;
    }
    // TABELADO (valor fixo — comportamento histórico).
    const faixa = parametros.extraordinario[tipoNovo];
    const sugerido = faixa.faixa_max > 0 ? Math.round((faixa.faixa_min + faixa.faixa_max) / 2 / 50) * 50 : 0;
    const pctEsc = pctDefault(tipoNovo, faixa);
    const novo: ItemOrcamento = {
      tipo: tipoNovo, descricao: cat.label, natureza: 'tabelado', valor: sugerido,
      clausula_pct: pctEsc, clausula_informativa: montarClausulaInformativa(tipoNovo, pctEsc, faixa),
    };
    setItens(prev => [...prev, novo]);
  }

  // Preço derivado de uma linha calculada (reusa as entranhas de precificacaoBase).
  const precoCalc = (it: ItemOrcamento): LinhaCalculadaResult => precificarLinhaCalculada({
    colaboradores: dadosPeriodo?.colaboradores ?? [], clientes: dadosPeriodo?.clientes ?? [],
    vinculos: dadosPeriodo?.vinculos ?? [],
    horasPorFuncao: it.horas_por_funcao ?? horasZero(), horasJuridicas: it.horas_juridicas ?? 0,
    custoHoraJuridico: parametros.custo_hora_juridico, fatorJuridico: parametros.fator_demanda_juridica,
    overheadRatio: parametros.overhead_ratio_referencia, margem: it.margem ?? parametros.margem_alvo,
    aliqFat: ALIQUOTAS[regime].faturamento,
  });
  // Aplica patch numa linha calculada E recomputa preço/custo (valor = preço).
  const setItemCalc = (idx: number, patch: Partial<ItemOrcamento>) => {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      const r = precoCalc(merged);
      return { ...merged, valor: Math.round(r.preco), custo_direto_calc: r.custoDireto, custo_total_calc: r.custoTotal };
    }));
  };
  const setHoraFuncao = (idx: number, f: FuncaoAlocacao, h: number) => {
    const atual = itens[idx].horas_por_funcao ?? horasZero();
    setItemCalc(idx, { horas_por_funcao: { ...atual, [f]: h } });
  };
  // Success fee: aplica patch E recomputa projeção (base_estimado × percentual).
  // valor fica 0 — não entra no total fechado.
  const setItemSuccess = (idx: number, patch: Partial<ItemOrcamento>) => {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const m = { ...it, ...patch };
      const proj = (m.valor_base_estimado ?? 0) * (m.percentual_success ?? 0);
      return { ...m, projecao_success: proj, valor: 0 };
    }));
  };
  const setItemCampo = (idx: number, campo: 'descricao' | 'valor', valor: string | number) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  };
  // % escolhido dentro da faixa → atualiza o número E recompõe a cláusula (texto).
  const setItemPct = (idx: number, pct: number) => {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const faixa = parametros.extraordinario[it.tipo];
      return { ...it, clausula_pct: pct, clausula_informativa: montarClausulaInformativa(it.tipo, pct, faixa) };
    }));
  };
  const removerItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx));

  function buildDados(): DadosOrcamento {
    const now = new Date().toISOString();
    const idEst = editId ?? crypto.randomUUID();
    const ant = editId ? orcamentos.find(o => o.id_estavel === editId) : undefined;
    return {
      id_estavel: idEst,
      criado_em: ant?.criado_em ?? now,
      atualizado_em: now,
      status: ant?.status ?? 'rascunho',
      nome_cliente: nomeCliente.trim() || 'Cliente',
      id_estavel_cliente: idEstavelCliente,
      itens,
      valor_total: valorTotal,
      validadeDias: validadeDias > 0 ? validadeDias : 15,
      observacoes: observacoes.trim() || undefined,
    };
  }

  async function salvar() {
    if (!nomeCliente.trim()) { setToast('Informe o nome do cliente.'); return; }
    if (!itens.length) { setToast('Adicione ao menos um item.'); return; }
    setSalvando(true);
    try {
      const dados = buildDados();
      await salvarOrcamento(dados);
      setEditId(dados.id_estavel);
      setOrcamentos(await buscarOrcamentos());
      setToast('Orçamento salvo.'); setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setToast(`Erro ao salvar: ${e instanceof Error ? e.message : 'erro'}`); setTimeout(() => setToast(null), 5000);
    } finally { setSalvando(false); }
  }

  async function gerar() {
    if (!itens.length) { setToast('Adicione ao menos um item.'); return; }
    const html = gerarOrcamentoHTML(buildDados(), { paraPdf: true });
    setGerandoPdf(true); setToast(null);
    try {
      const resp = await fetch('/.netlify/functions/gerar-pdf', { method: 'POST', body: html });
      if (!resp.ok) {
        let msg = `Erro ${resp.status}`;
        try { const j = await resp.json(); msg = j.error ?? msg; } catch { /* corpo não-JSON */ }
        setToast(`Falha ao gerar PDF: ${msg}`); setTimeout(() => setToast(null), 6000);
        return;
      }
      const url = URL.createObjectURL(await resp.blob());
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setToast(`Falha ao gerar PDF: ${e instanceof Error ? e.message : 'erro de rede'}`); setTimeout(() => setToast(null), 6000);
    } finally { setGerandoPdf(false); }
  }

  function reabrir(o: DadosOrcamento) {
    setEditId(o.id_estavel); setNomeCliente(o.nome_cliente); setIdEstavelCliente(o.id_estavel_cliente);
    setItens(o.itens ?? []); setValidadeDias(o.validadeDias ?? 15); setObservacoes(o.observacoes ?? '');
  }
  function duplicar(o: DadosOrcamento) {
    setEditId(undefined); setNomeCliente(`${o.nome_cliente} (cópia)`); setIdEstavelCliente(o.id_estavel_cliente);
    setItens(o.itens ?? []); setValidadeDias(o.validadeDias ?? 15); setObservacoes(o.observacoes ?? '');
  }
  function novo() {
    setEditId(undefined); setNomeCliente(''); setIdEstavelCliente(undefined);
    setItens([]); setValidadeDias(15); setObservacoes('');
  }
  async function mudarStatus(o: DadosOrcamento, status: DadosOrcamento['status']) {
    await atualizarOrcamentoStatus(o.id_estavel, status); setOrcamentos(await buscarOrcamentos());
  }
  async function remover(o: DadosOrcamento) {
    if (!confirm(`Excluir o orçamento de ${o.nome_cliente}?`)) return;
    await excluirOrcamento(o.id_estavel); if (editId === o.id_estavel) setEditId(undefined);
    setOrcamentos(await buscarOrcamentos());
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Form */}
      <div className="lg:col-span-2 space-y-4 rounded-lg border p-4" style={{ borderColor: '#e2e2e8' }}>
        <p className="text-xs" style={{ color: '#6b6b8a' }}>
          Orçamento de serviços <strong>extraordinários</strong> — pontuais, fora do fee mensal,
          a preço de mercado. Seletor de valor fixo (faixa sugerida, editável) + cláusulas %
          informativas. {editId && <span style={{ color: '#0065FF' }}>· editando salvo</span>}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Cliente (nome livre ou existente)</span>
            <input list="clientes-orc" value={nomeCliente} onChange={e => selecionarCliente(e.target.value)} className={INP} style={BRD} placeholder="Nome do cliente" />
            <datalist id="clientes-orc">{nomesClientes.map(n => <option key={n} value={n} />)}</datalist>
          </label>
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Validade (dias)</span>
            <input type="number" step={1} value={validadeDias} onChange={e => setValidadeDias(Number(e.target.value))} className={INP} style={BRD} />
          </label>
        </div>

        {/* Adicionar item */}
        <div className="rounded-lg p-3" style={{ backgroundColor: '#f0f6ff' }}>
          <span className="text-[11px] font-semibold" style={{ color: '#160F41' }}>Adicionar serviço</span>
          <div className="flex gap-2 mt-1">
            <select value={naturezaNova} onChange={e => setNaturezaNova(e.target.value as NaturezaOrcamento)} className={INP} style={BRD}>
              <option value="tabelado">Tabelado (valor fixo)</option>
              <option value="calculado">Calculado (por esforço)</option>
              <option value="success_fee">Success fee (% sobre base)</option>
            </select>
            <select value={tipoNovo} onChange={e => setTipoNovo(e.target.value as TipoExtraordinario)} className={INP} style={BRD}>
              {CATALOGO_EXTRAORDINARIO.map(c => (
                <option key={c.tipo} value={c.tipo}>{c.grupo} — {c.label}{c.placeholder ? ' (a cravar)' : ''}</option>
              ))}
            </select>
            <button onClick={adicionarItem} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand whitespace-nowrap">＋ Adicionar</button>
          </div>
        </div>

        {/* Lista de itens */}
        {itens.length > 0 && (
          <div className="space-y-2">
            {itens.map((it, idx) => {
              // ── LINHA SUCCESS FEE (condicional — não fecha no total) ──────
              if (it.natureza === 'success_fee') {
                const baseLabel = it.base_success === 'mais_valia' ? 'mais-valia' : 'transação';
                return (
                  <div key={idx} className="rounded-lg border p-3 space-y-2" style={{ borderColor: '#92400e' }}>
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Success fee · condicional</span>
                      <input value={it.descricao} onChange={e => setItemCampo(idx, 'descricao', e.target.value)} className="rounded px-2 py-1.5 text-sm flex-grow" style={BRD} />
                      <button onClick={() => removerItem(idx)} className="px-2 py-1.5 rounded text-xs" style={{ border: '1px solid #fca5a5', color: '#dc2626' }}>✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="text-[10px]" style={{ color: '#6b6b8a' }}>Base</span>
                        <select value={it.base_success ?? 'transacao'} onChange={e => setItemSuccess(idx, { base_success: e.target.value as ItemOrcamento['base_success'] })} className="rounded px-2 py-1 text-sm w-full" style={BRD}>
                          <option value="transacao">Transação</option>
                          <option value="mais_valia">Mais-valia</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px]" style={{ color: '#6b6b8a' }}>Percentual (%)</span>
                        <input type="number" step={0.5} min={0} value={Math.round((it.percentual_success ?? 0) * 1000) / 10}
                          onChange={e => setItemSuccess(idx, { percentual_success: Number(e.target.value) / 100 })} className="rounded px-2 py-1 text-sm w-full text-right" style={BRD} />
                      </label>
                      <label className="block">
                        <span className="text-[10px]" style={{ color: '#6b6b8a' }}>Base estimada (R$)</span>
                        <input type="number" step={1000} min={0} value={it.valor_base_estimado ?? 0}
                          onChange={e => setItemSuccess(idx, { valor_base_estimado: Number(e.target.value) })} className="rounded px-2 py-1 text-sm w-full text-right" style={BRD} />
                      </label>
                    </div>
                    <div className="text-[11px]" style={{ color: '#92400e' }}>
                      Regra: <strong>{Math.round((it.percentual_success ?? 0) * 1000) / 10}%</strong> sobre {baseLabel} · projeção estimada <strong>~{formatCurrency(it.projecao_success ?? 0)}</strong> — não fecha no total.
                    </div>
                  </div>
                );
              }
              // ── LINHA CALCULADA (por esforço) ─────────────────────────────
              if ((it.natureza ?? 'tabelado') === 'calculado') {
                const r = precoCalc(it);
                return (
                  <div key={idx} className="rounded-lg border p-3 space-y-2" style={{ borderColor: '#0065FF' }}>
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: '#e0edff', color: '#0065FF' }}>Calculado</span>
                      <input value={it.descricao} onChange={e => setItemCampo(idx, 'descricao', e.target.value)} className="rounded px-2 py-1.5 text-sm flex-grow" style={BRD} />
                      <button onClick={() => removerItem(idx)} className="px-2 py-1.5 rounded text-xs" style={{ border: '1px solid #fca5a5', color: '#dc2626' }}>✕</button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {FUNCOES_ALOCACAO.map(f => (
                        <label key={f} className="block">
                          <span className="text-[10px]" style={{ color: '#6b6b8a' }}>{LABEL_FUNCAO_ORC[f]} (h)</span>
                          <input type="number" step={0.5} min={0} value={it.horas_por_funcao?.[f] ?? 0}
                            onChange={e => setHoraFuncao(idx, f, Number(e.target.value))} className="rounded px-2 py-1 text-sm w-full text-right" style={BRD} />
                        </label>
                      ))}
                      <label className="block">
                        <span className="text-[10px]" style={{ color: '#6b6b8a' }}>Jurídico (h)</span>
                        <input type="number" step={0.5} min={0} value={it.horas_juridicas ?? 0}
                          onChange={e => setItemCalc(idx, { horas_juridicas: Number(e.target.value) })} className="rounded px-2 py-1 text-sm w-full text-right" style={BRD} />
                      </label>
                      <label className="block">
                        <span className="text-[10px]" style={{ color: '#6b6b8a' }}>Margem (%)</span>
                        <input type="number" step={1} min={0} max={99} value={Math.round((it.margem ?? parametros.margem_alvo) * 100)}
                          onChange={e => setItemCalc(idx, { margem: Number(e.target.value) / 100 })} className="rounded px-2 py-1 text-sm w-full text-right" style={BRD} />
                      </label>
                    </div>
                    <div className="flex items-center justify-between text-[11px]" style={{ color: '#6b6b8a' }}>
                      <span>Custo direto {formatCurrency(r.custoDireto)} · jurídico {formatCurrency(r.custoJuridico)} · overhead ×{parametros.overhead_ratio_referencia.toFixed(2)} · margem {Math.round((it.margem ?? parametros.margem_alvo) * 100)}%</span>
                      <span className="font-bold text-sm" style={{ color: r.denomInvalido ? '#991b1b' : '#160F41' }}>
                        {r.denomInvalido ? 'margem+imposto ≥ 100%' : `Preço ${formatCurrency(it.valor)}`}
                      </span>
                    </div>
                  </div>
                );
              }
              // ── LINHA TABELADA (valor fixo) ───────────────────────────────
              const faixa = parametros.extraordinario[it.tipo];
              return (
                <div key={idx} className="rounded-lg border p-3" style={{ borderColor: '#e2e2e8' }}>
                  <div className="flex gap-2 items-start">
                    <input value={it.descricao} onChange={e => setItemCampo(idx, 'descricao', e.target.value)} className="rounded px-2 py-1.5 text-sm flex-grow" style={BRD} />
                    <input type="number" step={50} value={it.valor} onChange={e => setItemCampo(idx, 'valor', Number(e.target.value))} className="rounded px-2 py-1.5 text-sm w-32 text-right" style={BRD} />
                    <button onClick={() => removerItem(idx)} className="px-2 py-1.5 rounded text-xs" style={{ border: '1px solid #fca5a5', color: '#dc2626' }}>✕</button>
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: '#9ca3af' }}>
                    Faixa sugerida: {faixa.faixa_max > 0 ? `${formatCurrency(faixa.faixa_min)} – ${formatCurrency(faixa.faixa_max)}` : 'a cravar (Configurações → Extraordinário)'}
                  </div>
                  {CATALOGO_POR_TIPO[it.tipo].clausula && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-medium" style={{ color: '#160F41' }}>
                        {CATALOGO_POR_TIPO[it.tipo].clausula === 'success_fee' ? 'Success fee (%)' : '% da causa'}
                      </span>
                      <input type="number" step={0.5} value={it.clausula_pct ?? 0} onChange={e => setItemPct(idx, Number(e.target.value))}
                        className="rounded px-2 py-1 text-sm w-20" style={BRD} />
                      <span className="text-[10px]" style={{ color: '#9ca3af' }}>
                        faixa {faixa.clausula_pct_min ?? 0}–{faixa.clausula_pct_max ?? 0}%
                      </span>
                    </div>
                  )}
                  {it.clausula_informativa && (
                    <div className="text-[11px] mt-1 italic" style={{ color: '#6b6b8a' }}>↳ {it.clausula_informativa}</div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-sm font-semibold" style={{ color: '#160F41' }}>Valor total</span>
              <span className="text-lg font-bold" style={{ color: '#732AD8' }}>{formatCurrency(valorTotal)}</span>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Observações (opcional)</span>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className={INP} style={BRD} placeholder="Condições específicas deste orçamento." />
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={salvar} disabled={salvando} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand disabled:opacity-50">
            {salvando ? 'Salvando…' : editId ? 'Atualizar orçamento' : 'Salvar orçamento'}
          </button>
          <button onClick={novo} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Novo</button>
          <button onClick={gerar} disabled={gerandoPdf} className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50" style={{ border: '1px solid #0065FF', color: '#0065FF' }}>
            {gerandoPdf ? 'Gerando PDF…' : 'Gerar orçamento ↗'}
          </button>
          {toast && <span className="text-xs self-center" style={{ color: '#166534' }}>{toast}</span>}
        </div>
      </div>

      {/* Gestão — orçamentos salvos */}
      <div className="space-y-2 rounded-lg border p-4" style={{ borderColor: '#e2e2e8' }}>
        <span className="text-sm font-semibold" style={{ color: '#160F41' }}>Orçamentos salvos</span>
        {orcamentos.length === 0 && <p className="text-xs" style={{ color: '#9ca3af' }}>Nenhum orçamento salvo ainda.</p>}
        {orcamentos.map(o => (
          <div key={o.id_estavel} className="rounded-lg border p-2 text-xs" style={{ borderColor: editId === o.id_estavel ? '#0065FF' : '#e2e2e8' }}>
            <div className="flex items-center justify-between">
              <strong style={{ color: '#160F41' }}>{o.nome_cliente}</strong>
              <span style={{ color: '#732AD8' }}>{formatCurrency(o.valor_total)}</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <select value={o.status} onChange={e => mudarStatus(o, e.target.value as DadosOrcamento['status'])} className="rounded px-1 py-0.5 text-[10px]" style={BRD}>
                {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => reabrir(o)} className="px-2 py-0.5 rounded text-[10px]" style={{ border: '1px solid #e2e2e8', color: '#0065FF' }}>Reabrir</button>
              <button onClick={() => duplicar(o)} className="px-2 py-0.5 rounded text-[10px]" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Duplicar</button>
              <button onClick={() => remover(o)} className="px-2 py-0.5 rounded text-[10px]" style={{ border: '1px solid #fca5a5', color: '#dc2626' }}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
