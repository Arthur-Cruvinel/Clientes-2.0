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
import type { DadosOrcamento, ItemOrcamento, TipoExtraordinario } from '../../types';

const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
const STATUS: DadosOrcamento['status'][] = ['rascunho', 'enviado', 'aceito', 'recusado'];

export function Orcador() {
  const { dadosPeriodo, parametros } = useApp();

  const [nomeCliente, setNomeCliente] = useState('');
  const [idEstavelCliente, setIdEstavelCliente] = useState<string | undefined>();
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [validadeDias, setValidadeDias] = useState(15);
  const [observacoes, setObservacoes] = useState('');
  const [tipoNovo, setTipoNovo] = useState<TipoExtraordinario>('juridico_parecer');
  const [editId, setEditId] = useState<string | undefined>();
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
    const faixa = parametros.extraordinario[tipoNovo];
    // Valor sugerido: ponto médio da faixa (arredondado a R$50); 0 = placeholder.
    const sugerido = faixa.faixa_max > 0 ? Math.round((faixa.faixa_min + faixa.faixa_max) / 2 / 50) * 50 : 0;
    // % escolhido: default = mínimo da faixa % (editável). undefined = sem cláusula.
    const pctEsc = pctDefault(tipoNovo, faixa);
    const novo: ItemOrcamento = {
      tipo: tipoNovo,
      descricao: cat.label,
      natureza: 'tabelado',
      valor: sugerido,
      clausula_pct: pctEsc,
      clausula_informativa: montarClausulaInformativa(tipoNovo, pctEsc, faixa),
    };
    setItens(prev => [...prev, novo]);
  }
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
