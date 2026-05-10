// --- Painel de edição expansível (adapta campos por visão) ---

import { useState, useMemo } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatCurrency } from '../../utils/formatters';
import { slug } from '../../utils/slug';
import type { RegistroPoupanca } from '../../types';
import type { Visao } from './PoupancaTabela';

interface Props {
  registro: RegistroPoupanca;
  periodo: string;
  colSpan: number;
  visao: Visao;
  onSalvo: (atualizado: RegistroPoupanca) => void;
  onCancelar: () => void;
}

function parseNum(v: string): number | null {
  if (!v.trim()) return null;
  return isNaN(Number(v.replace(',', '.'))) ? null : Number(v.replace(',', '.'));
}

const LBL = 'text-[10px] font-medium uppercase tracking-wide mb-1';
const INP = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400 transition-colors';
const ERR_CLS = 'text-[10px] mt-0.5';

export function DetalheLinhaEdit({ registro: r, periodo, colSpan, visao, onSalvo, onCancelar }: Props) {
  const isOff = visao === 'offshore';
  const isCons = visao === 'consolidado';

  const [v, setV] = useState({
    // Onshore
    plIniOn: String(r.pl_inicial_onshore ?? 0),
    plOn: String(r.pl_onshore ?? 0),
    nnmOn: String(r.aporte_mes_onshore ?? 0),
    rentOn: String(r.rentabilidade_onshore ?? 0),
    // Offshore
    plUsd: String(r.pl_offshore_usd ?? ''),
    ptax: String(r.ptax_fechamento ?? ''),
    plOff: String(r.pl_offshore ?? 0),
    plIniOff: String(r.pl_inicial_offshore ?? 0),
    nnmOff: String(r.aporte_mes_offshore ?? 0),
    rentPctOff: String(r.rentabilidade_pct_offshore != null ? (r.rentabilidade_pct_offshore * 100).toFixed(4) : ''),
    // Comum
    tombamento: String(
      isOff ? (r.nnm_tombamento_offshore ?? '') :
      isCons ? (r.nnm_tombamento ?? '') :
      (r.nnm_tombamento_onshore ?? '')
    ),
    meta: String(r.meta_poupanca_mensal ?? ''),
    capacidade: String(r.capacidade_poupanca_mensal ?? ''),
    // Transferência interna entre contas do mesmo cliente — aceita negativos
    // (entrada na conta visível na lâmina). Default = '' (nenhum movimento).
    transOn: String(r.transferencia_interna_onshore ?? ''),
    transOff: String(r.transferencia_interna_offshore ?? ''),
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  function set(k: string, val: string) {
    setV(p => ({ ...p, [k]: val }));
    setErros(p => ({ ...p, [k]: '' }));
  }

  // Recálculo ao vivo conforme visão
  const calc = useMemo(() => {
    const plOn = parseNum(v.plOn) ?? 0;
    const plOff = parseNum(v.plOff) ?? 0;
    const plUsd = parseNum(v.plUsd) ?? 0;
    const ptax = parseNum(v.ptax) ?? 1;
    const plTotal = plOn + plOff;
    // Offshore rent calculada
    const rentPctOff = parseNum(v.rentPctOff) ?? 0;
    const rentOffUsd = plUsd * (rentPctOff / 100);
    const rentOffBrl = rentOffUsd * ptax;
    return { plTotal, rentOffUsd, rentOffBrl };
  }, [v.plOn, v.plOff, v.plUsd, v.ptax, v.rentPctOff]);

  async function salvar() {
    const e: Record<string, string> = {};
    const tombamento = v.tombamento ? parseNum(v.tombamento) : null;
    if (v.tombamento && tombamento == null) e.tombamento = 'Invalido';
    const meta = v.meta ? parseNum(v.meta) : null;
    if (v.meta && meta == null) e.meta = 'Invalido';
    // Capacidade aceita negativos (cliente que queima caixa).
    const capacidade = v.capacidade ? parseNum(v.capacidade) : null;
    if (v.capacidade && capacidade == null) e.capacidade = 'Invalido';

    const dados: Record<string, unknown> = {};

    if (!isOff) {
      // Onshore ou Consolidado: salvar campos onshore
      const plIniOn = parseNum(v.plIniOn); const plOn = parseNum(v.plOn);
      const nnmOn = parseNum(v.nnmOn); const rentOn = parseNum(v.rentOn);
      if (plIniOn == null) e.plIniOn = 'Invalido';
      if (plOn == null || plOn < 0) e.plOn = '>= 0';
      if (nnmOn == null) e.nnmOn = 'Invalido';
      if (rentOn == null) e.rentOn = 'Invalido';
      dados.pl_inicial_onshore = plIniOn;
      dados.pl_onshore = plOn;
      dados.aporte_mes_onshore = nnmOn;
      dados.rentabilidade_onshore = rentOn;
      const denomOn = (plIniOn ?? 0) + (nnmOn ?? 0);
      if (denomOn > 0) dados.rentabilidade_pct = (rentOn ?? 0) / denomOn;
    }

    if (isOff || isCons) {
      // Offshore: salvar campos offshore
      const plUsd = v.plUsd ? parseNum(v.plUsd) : null;
      const ptax = v.ptax ? parseNum(v.ptax) : null;
      const plOff = parseNum(v.plOff);
      const plIniOff = parseNum(v.plIniOff);
      const nnmOff = parseNum(v.nnmOff);
      const rentPctOff = v.rentPctOff ? parseNum(v.rentPctOff) : null;
      if (plOff == null || plOff < 0) e.plOff = '>= 0';
      if (v.ptax && (ptax == null || ptax < 1 || ptax > 20)) e.ptax = '1-20';
      if (v.plUsd && plUsd == null) e.plUsd = 'Invalido';

      if (plUsd != null) dados.pl_offshore_usd = plUsd;
      if (ptax != null) dados.ptax_fechamento = ptax;
      dados.pl_offshore = plOff;
      if (plIniOff != null) dados.pl_inicial_offshore = plIniOff;
      if (nnmOff != null) dados.aporte_mes_offshore = nnmOff;
      if (rentPctOff != null) dados.rentabilidade_pct_offshore = rentPctOff / 100;
      // Rent offshore em BRL (para compatibilidade)
      if (plUsd != null && rentPctOff != null && ptax != null) {
        dados.rentabilidade_offshore = plUsd * (rentPctOff / 100) * ptax;
      }
    }

    // Salvar tombamento no campo da visão ativa
    const tombVal = tombamento != null && tombamento > 0 ? tombamento : 0;
    if (isOff) {
      dados.nnm_tombamento_offshore = tombVal;
    } else if (!isCons) {
      dados.nnm_tombamento_onshore = tombVal;
    }
    // isCons: não escreve campo separado — o legado reconsolidado abaixo reflete o estado atual.

    // Reconsolida o campo legado `nnm_tombamento` a partir do estado pós-save
    // dos separados. Isso evita o bug de stale no display (o estado local imediato
    // em onSalvo({...r, ...dados}) perderia o legado desatualizado, e o fallback
    // de tombVisao leria esse valor antigo até a próxima refetch). Também mantém
    // paridade com a consolidação que usePoupanca.ts faz no fetch.
    const novoTombOn = (!isOff && !isCons) ? tombVal : (r.nnm_tombamento_onshore ?? 0);
    const novoTombOff = isOff ? tombVal : (r.nnm_tombamento_offshore ?? 0);
    dados.nnm_tombamento = novoTombOn + novoTombOff;
    if (meta != null) dados.meta_poupanca_mensal = meta;
    // Capacidade: sempre grava ambos (reflete intenção do usuário).
    //   null → sem_capacidade_poupanca: true
    //   número (+/-) → sem_capacidade_poupanca: false
    dados.capacidade_poupanca_mensal = capacidade;
    dados.sem_capacidade_poupanca = capacidade == null;

    // Transferência interna — aceita qualquer sinal (positivo = saída,
    // negativo = entrada). Vazio vira 0 (sem transferência no mês).
    const transOn = v.transOn ? parseNum(v.transOn) : null;
    if (v.transOn && transOn == null) e.transOn = 'Invalido';
    const transOff = v.transOff ? parseNum(v.transOff) : null;
    if (v.transOff && transOff == null) e.transOff = 'Invalido';
    dados.transferencia_interna_onshore = transOn ?? 0;
    dados.transferencia_interna_offshore = transOff ?? 0;

    if (Object.values(e).some(Boolean)) { setErros(e); return; }

    setSalvando(true);
    try {
      const docId = `${slug(r.nome_cliente)}_${r.ano}_${r.mes}`;
      await updateDoc(doc(db, 'poupanca', docId), dados);
      onSalvo({ ...r, ...dados } as RegistroPoupanca);
    } catch (err) {
      setErros({ _: err instanceof Error ? err.message : 'Erro ao salvar' });
    } finally { setSalvando(false); }
  }

  function campo(k: keyof typeof v, label: string, w: string) {
    return (
      <div className={w}>
        <p className={LBL} style={{ color: '#6b6b8a' }}>{label}</p>
        <input className={INP} value={v[k]} onChange={e => set(k, e.target.value)} />
        {erros[k] && <p className={ERR_CLS} style={{ color: '#dc2626' }}>{erros[k]}</p>}
      </div>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="overflow-hidden transition-all duration-200 ease-out max-h-[500px] opacity-100"
          style={{ backgroundColor: '#fff', borderBottom: '2px solid #dbeafe', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.04)' }}>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: '#160F41' }}>
                Editando {periodo}
                <span className="text-xs font-normal ml-2" style={{ color: '#6b6b8a' }}>
                  ({visao === 'offshore' ? 'Offshore' : visao === 'onshore' ? 'Onshore' : 'Consolidado'})
                </span>
              </p>
              {erros._ && <span className="text-xs" style={{ color: '#dc2626' }}>{erros._}</span>}
            </div>

            <div className="flex flex-wrap gap-4">
              {/* Onshore — visível em onshore e consolidado */}
              {!isOff && (
                <>
                  {campo('plIniOn', 'AUM Ini. Onshore', 'w-36')}
                  {campo('plOn', 'AUM Final Onshore', 'w-36')}
                  {campo('nnmOn', 'NNM Onshore', 'w-32')}
                  {campo('rentOn', 'Rent. R$ Onshore', 'w-36')}
                </>
              )}

              {/* Offshore — visível em offshore e consolidado */}
              {(isOff || isCons) && (
                <>
                  {campo('plUsd', 'AUM USD', 'w-28')}
                  {campo('ptax', 'PTAX', 'w-24')}
                  {campo('plIniOff', 'AUM Ini. Off R$', 'w-36')}
                  {campo('plOff', 'AUM Final Off R$', 'w-36')}
                  {campo('nnmOff', 'NNM Offshore R$', 'w-32')}
                  {campo('rentPctOff', 'Rent. % Off (lamina)', 'w-36')}
                </>
              )}

              {/* Comum */}
              <div className="w-32">
                <p className={LBL} style={{ color: '#6b6b8a' }}>Tombamento R$</p>
                <input className={INP} value={v.tombamento} onChange={e => set('tombamento', e.target.value)} placeholder="0" />
                {erros.tombamento && <p className={ERR_CLS} style={{ color: '#dc2626' }}>{erros.tombamento}</p>}
              </div>
              <div className="w-44">
                <p className={LBL} style={{ color: '#6b6b8a' }}>Transferência Interna Onshore</p>
                <input className={INP} value={v.transOn} onChange={e => set('transOn', e.target.value)}
                  placeholder="Ex: 500000 (saída) ou -500000 (entrada)"
                  title="Movimento entre contas onshore do mesmo cliente — não afeta NNM nem poupança" />
                {erros.transOn && <p className={ERR_CLS} style={{ color: '#dc2626' }}>{erros.transOn}</p>}
              </div>
              <div className="w-44">
                <p className={LBL} style={{ color: '#6b6b8a' }}>Transferência Interna Offshore</p>
                <input className={INP} value={v.transOff} onChange={e => set('transOff', e.target.value)}
                  placeholder="Ex: 3996082 (saída) ou -3996082 (entrada)"
                  title="Movimento entre contas offshore do mesmo cliente — não afeta NNM nem poupança" />
                {erros.transOff && <p className={ERR_CLS} style={{ color: '#dc2626' }}>{erros.transOff}</p>}
              </div>
              {campo('meta', 'Meta Poupanca', 'w-36')}
              <div className="w-44">
                <p className={LBL} style={{ color: '#6b6b8a' }}>Capacidade de poupança (R$/mês)</p>
                <input className={INP} value={v.capacidade} onChange={e => set('capacidade', e.target.value)} placeholder="ex: 50000 ou -30000" />
                <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>Negativo indica queima de patrimônio</p>
                {erros.capacidade && <p className={ERR_CLS} style={{ color: '#dc2626' }}>{erros.capacidade}</p>}
              </div>
            </div>

            {/* Resumo calculado */}
            <div className="flex gap-6 text-xs" style={{ color: '#6b6b8a' }}>
              <span>AUM Total: {formatCurrency(calc.plTotal)}</span>
              {(isOff || isCons) && calc.rentOffBrl > 0 && (
                <span>Rent Off: USD {calc.rentOffUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} = {formatCurrency(calc.rentOffBrl)}</span>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={onCancelar}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
                <X size={13} /> Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
