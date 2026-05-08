// --- Aba Gerenciar Dados — layout 2 colunas com log de operações ---

import { useState, useEffect, useRef } from 'react';
import { Trash2, Loader2, ClipboardList, Database, PiggyBank, Search } from 'lucide-react';
import { db } from '../../services/firebase';
import { deleteDoc, deleteField, doc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { Modal } from '../../components/ui/Modal';
import {
  limparCollection, limparCollectionTodosPeriodos, contarPeriodos,
  limparPoupancaMes, limparTodaPoupanca,
} from './useUploadImport';

const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ANOS = [2024, 2025, 2026];
const BTN_D = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-colors';

interface LogItem { ts: string; acao: string; resultado: string; ok: boolean }
interface Confirm { titulo: string; msg: string; enfatico?: boolean; fn: () => Promise<void> }

export function GerenciarDados() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [colTodos, setColTodos] = useState<'colaboradores' | 'clientes' | 'custosIndiretos'>('colaboradores');
  const [operando, setOperando] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [logOps, setLogOps] = useState<LogItem[]>([]);
  // Excluir registro específico (suporta múltiplos clientes em lote)
  const [excTipo, setExcTipo] = useState<'todos' | 'onshore' | 'offshore'>('todos');
  const [excBusca, setExcBusca] = useState('');
  const [excClientes, setExcClientes] = useState<string[]>([]);
  const [excMesIni, setExcMesIni] = useState(hoje.getMonth() + 1);
  const [excAnoIni, setExcAnoIni] = useState(hoje.getFullYear());
  const [excMesFim, setExcMesFim] = useState(hoje.getMonth() + 1);
  const [excAnoFim, setExcAnoFim] = useState(hoje.getFullYear());
  const [excNomes, setExcNomes] = useState<string[]>([]);
  const [excDropdown, setExcDropdown] = useState(false);
  const excRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDocs(collection(db, 'poupanca')).then(snap => {
      const nomes = new Set<string>();
      snap.forEach(d => { const n = d.data().nome_cliente; if (n) nomes.add(n); });
      setExcNomes([...nomes].sort());
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (excRef.current && !excRef.current.contains(e.target as Node)) setExcDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function slugify(nome: string) {
    return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  const excSugestoes = excBusca.trim()
    ? excNomes.filter(n => n.toLowerCase().includes(excBusca.toLowerCase())).slice(0, 12)
    : excNomes;

  const periodo = `${ano}-${String(mes).padStart(2, '0')}`;
  const ts = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  async function exec(fn: () => Promise<number>, acao: string) {
    setConfirm(null); setOperando(true);
    try {
      const n = await fn();
      setLogOps(p => [{ ts: ts(), acao, resultado: `${n} docs removidos`, ok: true }, ...p].slice(0, 10));
    } catch (e) {
      setLogOps(p => [{ ts: ts(), acao, resultado: e instanceof Error ? e.message : String(e), ok: false }, ...p].slice(0, 10));
    } finally { setOperando(false); }
  }

  function pedir(c: Confirm) { setConfirm(c); }

  const Sel = () => (
    <div className="flex gap-2">
      <select value={mes} onChange={e => setMes(Number(e.target.value))} disabled={operando}
        className="flex-1 rounded-lg px-2 py-1.5 text-xs" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
        {ML.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
      </select>
      <select value={ano} onChange={e => setAno(Number(e.target.value))} disabled={operando}
        className="rounded-lg px-2 py-1.5 text-xs" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
        {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* COLUNA ESQUERDA — operações */}
      <div className="col-span-5 space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Operações</p>

        {/* Card Financeiros */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4" style={{ borderColor: '#e2e2e8' }}>
          <div className="flex items-center gap-2">
            <Database size={16} style={{ color: '#160F41' }} />
            <span className="text-sm font-semibold" style={{ color: '#160F41' }}>Dados Financeiros</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gray-100" style={{ color: '#6b6b8a' }}>fechamentos/</span>
          </div>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>Período específico</p>
          <Sel />
          <div className="grid grid-cols-2 gap-2">
            {(['colaboradores', 'clientes', 'custosIndiretos'] as const).map(col => (
              <button key={col} disabled={operando} className={BTN_D}
                onClick={() => pedir({ titulo: `Apagar ${col}`, msg: `Apagar ${col.toUpperCase()} de ${periodo}?`, fn: () => exec(() => limparCollection(periodo, col), `${col} ${periodo}`) })}>
                <Trash2 size={11} className="inline -mt-0.5 mr-1" />
                {col === 'custosIndiretos' ? 'Custos' : col.charAt(0).toUpperCase() + col.slice(1)}
              </button>
            ))}
            <button disabled={operando} className={BTN_D}
              onClick={() => pedir({ titulo: 'Período completo', msg: `Apagar TUDO de ${periodo}?`, enfatico: true, fn: async () => {
                setConfirm(null); setOperando(true);
                try {
                  let t = 0;
                  t += await limparCollection(periodo, 'colaboradores');
                  t += await limparCollection(periodo, 'clientes');
                  t += await limparCollection(periodo, 'custosIndiretos');
                  setLogOps(p => [{ ts: ts(), acao: `Período ${periodo}`, resultado: `${t} docs`, ok: true }, ...p].slice(0, 10));
                } catch (e) {
                  setLogOps(p => [{ ts: ts(), acao: `Período ${periodo}`, resultado: String(e), ok: false }, ...p].slice(0, 10));
                } finally { setOperando(false); }
              } })}>
              <Trash2 size={11} className="inline -mt-0.5 mr-1" /> Período
            </button>
          </div>
          <div className="flex items-center gap-2"><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /><span className="text-[10px]" style={{ color: '#6b6b8a' }}>ou</span><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /></div>
          <div className="flex items-center gap-2">
            <select value={colTodos} onChange={e => setColTodos(e.target.value as typeof colTodos)} disabled={operando}
              className="flex-1 rounded-lg px-2 py-1.5 text-xs" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
              <option value="colaboradores">Colaboradores</option>
              <option value="clientes">Clientes</option>
              <option value="custosIndiretos">Custos Indiretos</option>
            </select>
            <button disabled={operando} className={BTN_D}
              onClick={async () => { const n = await contarPeriodos(); pedir({ titulo: `Limpar ${colTodos}`, msg: `Apagar ${colTodos.toUpperCase()} em ${n} períodos?`, enfatico: true, fn: async () => {
                setConfirm(null); setOperando(true);
                try { const r = await limparCollectionTodosPeriodos(colTodos); setLogOps(p => [{ ts: ts(), acao: `${colTodos} (todos)`, resultado: `${r.registros} docs em ${r.periodos} períodos`, ok: true }, ...p].slice(0, 10)); }
                catch (e) { setLogOps(p => [{ ts: ts(), acao: `${colTodos} (todos)`, resultado: String(e), ok: false }, ...p].slice(0, 10)); }
                finally { setOperando(false); }
              } }); }}>
              <Trash2 size={11} className="inline -mt-0.5 mr-1" /> Todos
            </button>
          </div>
        </div>

        {/* Card Poupança */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4" style={{ borderColor: '#e2e2e8' }}>
          <div className="flex items-center gap-2">
            <PiggyBank size={16} style={{ color: '#160F41' }} />
            <span className="text-sm font-semibold" style={{ color: '#160F41' }}>Poupança / AUM</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gray-100" style={{ color: '#6b6b8a' }}>poupanca/</span>
          </div>
          <Sel />
          <div className="flex gap-2">
            <button disabled={operando} className={`flex-1 ${BTN_D}`}
              onClick={() => pedir({ titulo: 'Poupança do mês', msg: `Apagar poupança de ${ML[mes - 1]}/${ano}?`, fn: () => exec(() => limparPoupancaMes(ano, mes), `Poupança ${mes}/${ano}`) })}>
              <Trash2 size={11} className="inline -mt-0.5 mr-1" /> Limpar mês
            </button>
            <button disabled={operando} className={`flex-1 ${BTN_D}`}
              onClick={() => pedir({ titulo: 'TODA poupança', msg: 'Apagar TODO o histórico de poupança?', enfatico: true, fn: () => exec(limparTodaPoupanca, 'Poupança (tudo)') })}>
              <Trash2 size={11} className="inline -mt-0.5 mr-1" /> Limpar tudo
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2"><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /><span className="text-[10px]" style={{ color: '#6b6b8a' }}>ou</span><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /></div>

          {/* Excluir registro específico */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium" style={{ color: '#160F41' }}>Excluir cliente em período específico</span>
            </div>

            {/* Tipo de dados a excluir */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium shrink-0" style={{ color: '#6b6b8a' }}>Tipo:</span>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
                {([
                  { id: 'todos', label: 'Todos', badge: 'Remove documento completo', cor: 'bg-red-50 text-red-600' },
                  { id: 'onshore', label: 'Só Onshore', badge: 'Limpa campos onshore', cor: 'bg-blue-50 text-blue-600' },
                  { id: 'offshore', label: 'Só Offshore', badge: 'Limpa campos offshore', cor: 'bg-purple-50 text-purple-600' },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setExcTipo(t.id)}
                    className={`px-3 py-1.5 text-xs font-medium transition-all ${excTipo === t.id ? 'bg-gradient-brand text-white' : ''}`}
                    style={excTipo !== t.id ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs" style={{ color: '#6b6b8a' }}>
              {excTipo === 'todos' && 'Remove o documento inteiro (onshore + offshore). Irreversível.'}
              {excTipo === 'onshore' && 'Limpa apenas campos onshore (PL, NNM, rent. onshore). Preserva offshore.'}
              {excTipo === 'offshore' && 'Limpa apenas campos offshore (PL, NNM, rent. offshore, PTAX). Preserva onshore.'}
            </p>

            {/* Busca e seleção de clientes (multi-select) */}
            <div className="relative" ref={excRef}>
              <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ border: '1px solid #e2e2e8' }}>
                <Search size={13} className="text-gray-400 shrink-0" />
                <input value={excBusca}
                  onChange={e => { setExcBusca(e.target.value); setExcDropdown(true); }}
                  onFocus={() => setExcDropdown(true)}
                  placeholder={excClientes.length > 0 ? `${excClientes.length} selecionado(s) — buscar mais...` : 'Buscar clientes...'}
                  className="flex-1 text-xs outline-none bg-transparent" style={{ color: '#160F41' }} />
                {excClientes.length > 0 && (
                  <button onClick={() => setExcClientes([])}
                    className="text-gray-400 hover:text-gray-600 text-[10px] shrink-0">Limpar ({excClientes.length})</button>
                )}
              </div>
              {excDropdown && excSugestoes.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-lg shadow-lg ring-1 ring-black/10 overflow-y-auto" style={{ maxHeight: 240 }}>
                  {/* Ações rápidas */}
                  <div className="flex gap-2 px-3 py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <button onClick={() => { setExcClientes(excSugestoes); }}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                      Selecionar todos ({excSugestoes.length})
                    </button>
                    <button onClick={() => setExcClientes([])}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">
                      Limpar seleção
                    </button>
                  </div>
                  {excSugestoes.map(n => {
                    const selecionado = excClientes.includes(n);
                    return (
                      <button key={n} className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${selecionado ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        style={{ color: '#160F41' }}
                        onClick={() => {
                          setExcClientes(prev =>
                            selecionado ? prev.filter(x => x !== n) : [...prev, n],
                          );
                        }}>
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded border text-[10px] shrink-0 ${selecionado ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}>
                          {selecionado ? '✓' : ''}
                        </span>
                        {n}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chips dos selecionados */}
            {excClientes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {excClientes.slice(0, 8).map(n => (
                  <span key={n} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                    {n.split(' ').slice(0, 2).join(' ')}
                    <button onClick={() => setExcClientes(prev => prev.filter(x => x !== n))} className="hover:text-red-500">✕</button>
                  </span>
                ))}
                {excClientes.length > 8 && (
                  <span className="text-[10px] px-2 py-0.5 text-gray-500">+{excClientes.length - 8} mais</span>
                )}
              </div>
            )}

            {/* Período (De / Até) */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium shrink-0" style={{ color: '#6b6b8a', width: 24 }}>De:</span>
                <select value={excMesIni} onChange={e => setExcMesIni(Number(e.target.value))} disabled={operando}
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
                  {ML.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
                </select>
                <select value={excAnoIni} onChange={e => setExcAnoIni(Number(e.target.value))} disabled={operando}
                  className="rounded-lg px-2 py-1.5 text-xs" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
                  {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium shrink-0" style={{ color: '#6b6b8a', width: 24 }}>Até:</span>
                <select value={excMesFim} onChange={e => setExcMesFim(Number(e.target.value))} disabled={operando}
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
                  {ML.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
                </select>
                <select value={excAnoFim} onChange={e => setExcAnoFim(Number(e.target.value))} disabled={operando}
                  className="rounded-lg px-2 py-1.5 text-xs" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
                  {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {(() => {
                const n = (excAnoFim * 12 + excMesFim) - (excAnoIni * 12 + excMesIni) + 1;
                return n > 0 ? (
                  <p className="text-[10px]" style={{ color: '#6b6b8a' }}>{n} {n === 1 ? 'mês' : 'meses'} selecionado{n === 1 ? '' : 's'}</p>
                ) : (
                  <p className="text-[10px]" style={{ color: '#dc2626' }}>Período inválido</p>
                );
              })()}
            </div>

            {/* Botão excluir */}
            <button disabled={operando || excClientes.length === 0 || (excAnoFim * 12 + excMesFim) < (excAnoIni * 12 + excMesIni)}
              className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                excClientes.length > 0 && (excAnoFim * 12 + excMesFim) >= (excAnoIni * 12 + excMesIni)
                  ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              onClick={() => {
                if (excClientes.length === 0) return;
                const nMeses = (excAnoFim * 12 + excMesFim) - (excAnoIni * 12 + excMesIni) + 1;
                if (nMeses <= 0) return;
                const label = nMeses === 1
                  ? `${ML[excMesIni - 1]}/${excAnoIni}`
                  : `${ML[excMesIni - 1]}/${excAnoIni} a ${ML[excMesFim - 1]}/${excAnoFim} (${nMeses} meses)`;
                const tipoLabel = excTipo === 'todos' ? 'todos os dados'
                  : excTipo === 'onshore' ? 'apenas dados ONSHORE' : 'apenas dados OFFSHORE';
                const clientesLabel = excClientes.length === 1
                  ? excClientes[0]
                  : `${excClientes.length} clientes`;
                pedir({
                  titulo: `Excluir ${excTipo === 'todos' ? 'registros' : excTipo}`,
                  msg: `Excluir ${tipoLabel} de ${clientesLabel} — ${label}?\n${
                    excTipo === 'todos'
                      ? `Remove até ${nMeses * excClientes.length} documentos inteiros.`
                      : `Limpa campos ${excTipo} em até ${nMeses * excClientes.length} documentos (preserva ${excTipo === 'onshore' ? 'offshore' : 'onshore'}).`
                  } Não pode ser desfeita.`,
                  enfatico: true,
                  fn: async () => {
                    setConfirm(null); setOperando(true);
                    try {
                      let removidos = 0, naoEncontrados = 0;

                      // Campos a limpar por tipo (usa deleteField() pra remover do doc)
                      const camposOnshore = {
                        pl_onshore: deleteField(), pl_inicial_onshore: deleteField(),
                        aporte_mes_onshore: deleteField(), rentabilidade_onshore: deleteField(),
                        rendimento_nominal_brl: deleteField(), impostos_mes: deleteField(),
                      };
                      const camposOffshore = {
                        pl_offshore: deleteField(), pl_offshore_usd: deleteField(),
                        pl_inicial_offshore: deleteField(), aporte_mes_offshore: deleteField(),
                        rentabilidade_offshore: deleteField(), ptax_fechamento: deleteField(),
                      };

                      // Itera sobre TODOS os clientes selecionados × todos os meses
                      for (const cliente of excClientes) {
                        const slug = slugify(cliente);
                        let m = excMesIni, a = excAnoIni;
                        while (a * 12 + m <= excAnoFim * 12 + excMesFim) {
                          const docId = `${slug}_${a}_${m}`;
                          const ref = doc(db, 'poupanca', docId);
                          try {
                            if (excTipo === 'todos') {
                              await deleteDoc(ref);
                            } else {
                              await updateDoc(ref, excTipo === 'onshore' ? camposOnshore : camposOffshore);
                            }
                            removidos++;
                          } catch {
                            naoEncontrados++;
                          }
                          m++; if (m > 12) { m = 1; a++; }
                        }
                      }
                      const res = removidos > 0
                        ? `${removidos} doc${removidos > 1 ? 's' : ''} processado${removidos > 1 ? 's' : ''}${naoEncontrados > 0 ? ` (${naoEncontrados} não encontrado${naoEncontrados > 1 ? 's' : ''})` : ''}`
                        : 'Nenhum registro encontrado';
                      const acaoLabel = `${excTipo !== 'todos' ? excTipo + ' ' : ''}${clientesLabel} ${label}`;
                      setLogOps(p => [{ ts: ts(), acao: acaoLabel, resultado: res, ok: removidos > 0 }, ...p].slice(0, 10));
                      setExcClientes([]); setExcBusca('');
                    } catch (e) {
                      setLogOps(p => [{ ts: ts(), acao: `Excluir ${clientesLabel}`, resultado: e instanceof Error ? e.message : String(e), ok: false }, ...p].slice(0, 10));
                    } finally { setOperando(false); }
                  },
                });
              }}>
              🗑 Excluir registro{((excAnoFim * 12 + excMesFim) - (excAnoIni * 12 + excMesIni) + 1) > 1 ? 's' : ''}
            </button>
          </div>
        </div>

        {operando && <div className="flex items-center gap-2 text-sm" style={{ color: '#160F41' }}><Loader2 className="animate-spin" size={16} /> Processando...</div>}
      </div>

      {/* COLUNA DIREITA — log de operações */}
      <div className="col-span-7 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Log de Operações</p>

        {logOps.length === 0 && !confirm && (
          <div className="rounded-xl border flex flex-col items-center justify-center h-64"
            style={{ borderColor: '#e2e2e8', backgroundColor: '#f8f9fc' }}>
            <ClipboardList size={48} style={{ color: '#e2e2e8' }} />
            <p className="text-sm mt-3" style={{ color: '#6b6b8a' }}>Nenhuma operação executada</p>
          </div>
        )}

        {logOps.length > 0 && (
          <div className="space-y-2">
            {logOps.map((l, i) => (
              <div key={i} className="rounded-lg border p-3 flex items-center gap-3 text-xs"
                style={{ borderColor: '#e2e2e8' }}>
                <span className="font-mono" style={{ color: '#6b6b8a' }}>{l.ts}</span>
                <span className="font-medium" style={{ color: '#160F41' }}>{l.acao}</span>
                <span style={{ color: l.ok ? '#6b6b8a' : '#dc2626' }}>{l.resultado}</span>
                <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium ${l.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {l.ok ? 'OK' : 'Erro'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirm && (
        <Modal aberto onFechar={() => setConfirm(null)} titulo={confirm.titulo}>
          <p className={`text-sm mb-4 ${confirm.enfatico ? 'font-semibold text-red-700' : ''}`} style={confirm.enfatico ? undefined : { color: '#160F41' }}>
            {confirm.msg}
          </p>
          <p className="text-xs mb-4" style={{ color: '#6b6b8a' }}>Esta operação não pode ser desfeita.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
            <button onClick={confirm.fn} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">Confirmar exclusão</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
