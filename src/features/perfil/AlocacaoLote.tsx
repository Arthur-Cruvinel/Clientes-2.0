// --- Aba Alocação em Lote — com ordenação e filtros checkbox estilo Excel ---

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { DadosCliente, Colaborador, FuncaoAlocacao } from '../../types';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { Modal } from '../../components/ui/Modal';
import { useOrdenacao } from '../poupanca/useOrdenacao';
import { ThOrdenavel } from '../poupanca/ThOrdenavel';
import { FiltroCheckbox } from '../poupanca/FiltroCheckbox';
import { AlocacaoLoteAcoes } from './AlocacaoLoteAcoes';
import type { CampoAtribuicaoLote } from './usePerfil';

interface Props {
  clientes: DadosCliente[];
  colaboradores: Colaborador[];
  bankersUnicos: string[];
  empresariosUnicos: string[];
  onAplicar: (ids: string[], campo: CampoAtribuicaoLote, valor: string) => Promise<void>;
  onRecarregar: () => Promise<void>;
}

const LABEL_CAMPO: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Consultoria Gestão',
  consultoria_planejamento: 'Cons. Planejamento',
  consultoria_financeira: 'Cons. Financeira',
  operacional_financeiro: 'Oper. Financeiro',
  serv_adm: 'Serv. Administrativo',
  serv_aux_adm: 'Aux. Administrativo',
};

// Headers das 6 colunas de função (label "ATUAL" deixa claro que mostra
// o estado vigente — distinto da seleção do painel de Atribuição abaixo).
const LABEL_COL_ATUAL: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão Atual',
  consultoria_planejamento: 'Planejamento Atual',
  consultoria_financeira: 'Financeira Atual',
  operacional_financeiro: 'Operacional Atual',
  serv_adm: 'Adm. Atual',
  serv_aux_adm: 'Aux. Adm. Atual',
};

// Opções do filtro "função vazia" (atalho p/ achar quem precisa de atribuição).
const LABEL_SEM: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Sem Gestão',
  consultoria_planejamento: 'Sem Planejamento',
  consultoria_financeira: 'Sem Financeira',
  operacional_financeiro: 'Sem Operacional',
  serv_adm: 'Sem Adm.',
  serv_aux_adm: 'Sem Aux. Adm.',
};

const TD = 'px-3 py-2 text-xs';

function acessor(c: DadosCliente, col: string): string | number | null {
  switch (col) {
    case 'nome': return c.nome_cliente;
    case 'banker': return c.banker ?? '';
    case 'empresario': return c.empresario ?? '';
    default:
      // Colunas de função — leitura tipada genérica para não duplicar 6 cases.
      if ((FUNCOES_ALOCACAO as readonly string[]).includes(col)) {
        return ((c as unknown as Record<string, unknown>)[col] as string | undefined) ?? '';
      }
      return null;
  }
}

export function AlocacaoLote({ clientes, colaboradores, bankersUnicos, empresariosUnicos, onAplicar, onRecarregar }: Props) {
  const [busca, setBusca] = useState('');
  const [filtroNomes, setFiltroNomes] = useState<Set<string> | null>(null);
  const [filtroBankers, setFiltroBankers] = useState<Set<string> | null>(null);
  const [filtroEmps, setFiltroEmps] = useState<Set<string> | null>(null);
  const [filtroFuncaoVazia, setFiltroFuncaoVazia] = useState<FuncaoAlocacao | ''>('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [modalPreencher, setModalPreencher] = useState(false);

  // Valores únicos para filtros checkbox
  const nomes = useMemo(() => clientes.map(c => c.nome_cliente).sort(), [clientes]);
  const bankerVals = useMemo(() => [...new Set(clientes.map(c => c.banker || 'Sem banker'))].sort(), [clientes]);
  const empVals = useMemo(() => [...new Set(clientes.map(c => c.empresario || 'Sem empresário'))].sort(), [clientes]);

  // Filtragem por busca, checkboxes e função vazia.
  const filtrados = useMemo(() => {
    let lista = [...clientes];
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(c => c.nome_cliente.toLowerCase().includes(q));
    }
    if (filtroNomes) lista = lista.filter(c => filtroNomes.has(c.nome_cliente));
    if (filtroBankers) lista = lista.filter(c => filtroBankers.has(c.banker || 'Sem banker'));
    if (filtroEmps) lista = lista.filter(c => filtroEmps.has(c.empresario || 'Sem empresário'));
    if (filtroFuncaoVazia) {
      lista = lista.filter(c => {
        const v = (c as unknown as Record<string, unknown>)[filtroFuncaoVazia] as string | undefined;
        return !v || !v.trim();
      });
    }
    return lista;
  }, [clientes, busca, filtroNomes, filtroBankers, filtroEmps, filtroFuncaoVazia]);

  // Ordenação
  const acessorCb = useCallback(acessor, []);
  const { ordenados, coluna, direcao, alternar } = useOrdenacao(filtrados, acessorCb);

  // Log de auditoria — clientes sem id são clientes fantasma (Pure Asset
  // sintetizado pelo AppContext a partir do AUM quando não há doc real em
  // fechamentos/.../clientes ou clientes_base/). Não podem ser selecionados
  // pq não há doc para atualizar; o usuário deve corrigir os dados (criar o
  // doc) — não esconder na UI.
  useEffect(() => {
    const semId = clientes.filter(c => !c.id);
    if (semId.length > 0) {
      console.warn(
        `[AlocacaoLote] ${semId.length} cliente(s) sem ID — não podem ser selecionados:`,
        semId.map(c => c.nome_cliente),
      );
    }
  }, [clientes]);

  // todosCheck considera apenas clientes id-tendo. Sem este filtro,
  // ordenados.every() com clientes sem id retornava false eternamente —
  // bug visual: "Selecionar todos" nunca aparecia marcado mesmo com todos
  // os clientes válidos selecionados.
  const idsValidos = useMemo(() => ordenados.filter(c => c.id).map(c => c.id as string), [ordenados]);
  const todosCheck = idsValidos.length > 0 && idsValidos.every(id => selecionados.has(id));

  const toggleTodos = useCallback(() => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (todosCheck) { ordenados.forEach(c => next.delete(c.id ?? '')); }
      else { ordenados.forEach(c => { if (c.id) next.add(c.id); }); }
      return next;
    });
  }, [ordenados, todosCheck]);

  const toggle = useCallback((id: string) => {
    setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleAplicar = useCallback(async (campo: CampoAtribuicaoLote, valor: string): Promise<boolean> => {
    const ids = [...selecionados];
    if (ids.length === 0 || !valor.trim()) return false;
    setSalvando(true);
    let ok = false;
    try {
      await onAplicar(ids, campo, valor.trim());
      await onRecarregar();
      const label = campo === 'banker' ? 'Banker'
        : campo === 'empresario' ? 'Empresário'
        : LABEL_CAMPO[campo as FuncaoAlocacao];
      setToast({ msg: `${label} atualizado em ${ids.length} clientes`, ok: true });
      ok = true;
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Erro ao salvar', ok: false });
    } finally { setSalvando(false); }
    setTimeout(() => setToast(null), 3000);
    return ok;
  }, [selecionados, onAplicar, onRecarregar]);

  // Wrapper que fecha o modal quando o Aplicar termina com sucesso.
  // Em erro mantém aberto para o usuário corrigir input — toast informa.
  const handleAplicarFechando = useCallback(async (campo: CampoAtribuicaoLote, valor: string) => {
    const ok = await handleAplicar(campo, valor);
    if (ok) setModalPreencher(false);
  }, [handleAplicar]);

  const thProps = { colunaAtiva: coluna, direcao, onAlternar: alternar };
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
  const TH_CLS = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left';

  return (
    <div className="space-y-4 flex flex-col h-full min-h-0 flex-1">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>Atribuição em Lote</h3>
        <p className="text-xs" style={{ color: '#6b6b8a' }}>Atribua banker, empresário e responsáveis por função para múltiplos clientes</p>
      </div>

      {/* Busca + filtro função vazia + contador */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={BRD}>
          <Search size={13} className="text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar clientes..."
            className="text-xs outline-none bg-transparent w-36" style={{ color: '#160F41' }} />
        </div>
        <select value={filtroFuncaoVazia}
          onChange={e => setFiltroFuncaoVazia(e.target.value as FuncaoAlocacao | '')}
          className="rounded-lg px-2 py-1.5 text-xs" style={BRD} title="Mostrar apenas clientes sem colaborador na função">
          <option value="">Todas as funções</option>
          {FUNCOES_ALOCACAO.map(f => <option key={f} value={f}>{LABEL_SEM[f]}</option>)}
        </select>
        <span className="ml-auto text-xs" style={{ color: '#6b6b8a' }}>
          {selecionados.size} de {ordenados.length} selecionados
        </span>
      </div>

      {toast && (
        <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${toast.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tabela — overflow-auto p/ permitir scroll horizontal com 9 colunas. */}
      <div className="overflow-auto rounded-lg border flex-1 min-h-0" style={{ borderColor: '#e2e2e8' }}>
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              <th className="px-3 py-2 w-10">
                <input type="checkbox" checked={todosCheck} onChange={toggleTodos} className="rounded" />
              </th>
              <ThOrdenavel chave="nome" label="Cliente" className={TH_CLS} {...thProps}>
                <FiltroCheckbox valores={nomes} selecionados={filtroNomes} onAplicar={setFiltroNomes} />
              </ThOrdenavel>
              <ThOrdenavel chave="banker" label="Banker Atual" className={TH_CLS} {...thProps}>
                <FiltroCheckbox valores={bankerVals} selecionados={filtroBankers} onAplicar={setFiltroBankers} />
              </ThOrdenavel>
              <ThOrdenavel chave="empresario" label="Empresário Atual" className={TH_CLS} {...thProps}>
                <FiltroCheckbox valores={empVals} selecionados={filtroEmps} onAplicar={setFiltroEmps} />
              </ThOrdenavel>
              {FUNCOES_ALOCACAO.map(f => (
                <ThOrdenavel key={f} chave={f} label={LABEL_COL_ATUAL[f]} className={`${TH_CLS} w-36`} {...thProps} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {ordenados.map(c => {
              const sel = selecionados.has(c.id ?? '');
              return (
                <tr key={c.id ?? c.nome_cliente} onClick={() => c.id && toggle(c.id)}
                  title={c.id ? undefined : 'Cliente sem ID no Firestore — não pode ser atualizado em lote (registro precisa de correção)'}
                  className={`transition-colors ${c.id ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={sel} readOnly disabled={!c.id}
                      className="rounded pointer-events-none" />
                  </td>
                  <td className={`${TD} font-medium`} style={{ color: '#160F41' }}>{c.nome_cliente}</td>
                  <td className={TD}>
                    {c.banker || <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>—</span>}
                  </td>
                  <td className={TD}>
                    {c.empresario || <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>—</span>}
                  </td>
                  {FUNCOES_ALOCACAO.map(f => {
                    const nome = ((c as unknown as Record<string, unknown>)[f] as string | undefined)?.trim() ?? '';
                    return (
                      <td key={f} className={`${TD} w-36 max-w-36`}>
                        {nome
                          ? <span className="block truncate" style={{ color: '#160F41' }} title={nome}>{nome}</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer slim — sempre presente quando há seleção. NÃO consome altura
          significativa da tabela (era o sintoma do AlocacaoLoteAcoes inline,
          que ocupava ~320px e "engolia" a área de seleção). Os campos vivem
          dentro do Modal abaixo, aberto sob demanda. */}
      {selecionados.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg"
          style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <span className="text-xs font-medium" style={{ color: '#1e3a8a' }}>
            {selecionados.size} cliente{selecionados.size === 1 ? '' : 's'} selecionado{selecionados.size === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelecionados(new Set())} type="button"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ border: '1px solid #e2e2e8', color: '#6b6b8a', backgroundColor: '#fff' }}>
              <X size={12} /> Limpar
            </button>
            <button onClick={() => setModalPreencher(true)} type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700">
              Preencher campos
            </button>
          </div>
        </div>
      )}

      <Modal aberto={modalPreencher}
        onFechar={() => setModalPreencher(false)}
        titulo={`Preencher campos para ${selecionados.size} cliente${selecionados.size === 1 ? '' : 's'}`}
        largura="4xl">
        <AlocacaoLoteAcoes bankersUnicos={bankersUnicos} empresariosUnicos={empresariosUnicos}
          colaboradores={colaboradores}
          salvando={salvando} onAplicar={handleAplicarFechando} />
      </Modal>
    </div>
  );
}
