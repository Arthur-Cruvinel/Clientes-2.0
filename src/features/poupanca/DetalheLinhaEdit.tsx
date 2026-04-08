// --- Painel de edição expansível (tr extra com colspan total) ---

import { useState, useMemo } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatCurrency } from '../../utils/formatters';
import type { RegistroPoupanca } from '../../types';

interface Props {
  registro: RegistroPoupanca;
  periodo: string;
  colSpan: number;
  onSalvo: (atualizado: RegistroPoupanca) => void;
  onCancelar: () => void;
}

function slugify(nome: string) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function parseNum(v: string): number | null {
  if (!v.trim()) return null;
  return isNaN(Number(v.replace(',', '.'))) ? null : Number(v.replace(',', '.'));
}

const LBL = 'text-[10px] font-medium uppercase tracking-wide mb-1';
const INP = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400 transition-colors';
const ERR_CLS = 'text-[10px] mt-0.5';

export function DetalheLinhaEdit({ registro: r, periodo, colSpan, onSalvo, onCancelar }: Props) {
  const temOff = !!(r.pl_offshore_usd || r.ptax_fechamento);
  const [v, setV] = useState({
    plIni: String(r.pl_inicial_total ?? 0),
    plOn: String(r.pl_onshore ?? 0),
    plOff: String(r.pl_offshore ?? 0),
    plUsd: String(r.pl_offshore_usd ?? ''),
    ptax: String(r.ptax_fechamento ?? ''),
    nnm: String(r.aporte_mes_total ?? 0),
    tombamento: String(r.nnm_tombamento ?? ''),
    rentR: String(r.rentabilidade_total ?? 0),
    meta: String(r.meta_poupanca_mensal ?? ''),
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  function set(k: string, val: string) {
    setV(p => ({ ...p, [k]: val }));
    setErros(p => ({ ...p, [k]: '' }));
  }

  // Recálculos ao vivo
  const calc = useMemo(() => {
    const plOn = parseNum(v.plOn) ?? 0;
    const plOff = parseNum(v.plOff) ?? 0;
    const plIni = parseNum(v.plIni) ?? 0;
    const nnm = parseNum(v.nnm) ?? 0;
    const rentR = parseNum(v.rentR) ?? 0;
    const plTotal = plOn + plOff;
    const denom = plIni + nnm;
    const rentPct = denom > 0 ? rentR / denom : 0;
    return { plTotal, rentPct };
  }, [v.plOn, v.plOff, v.plIni, v.nnm, v.rentR]);

  async function salvar() {
    const e: Record<string, string> = {};
    const plIni = parseNum(v.plIni); const plOn = parseNum(v.plOn); const plOff = parseNum(v.plOff);
    const nnm = parseNum(v.nnm); const rentR = parseNum(v.rentR);
    if (plIni == null) e.plIni = 'Inválido';
    if (plOn == null || plOn < 0) e.plOn = '≥ 0';
    if (plOff == null || plOff < 0) e.plOff = '≥ 0';
    if (nnm == null) e.nnm = 'Inválido';
    if (rentR == null) e.rentR = 'Inválido';
    const ptax = v.ptax ? parseNum(v.ptax) : null;
    if (v.ptax && (ptax == null || ptax < 1 || ptax > 20)) e.ptax = '1–20';
    const plUsd = v.plUsd ? parseNum(v.plUsd) : null;
    if (v.plUsd && plUsd == null) e.plUsd = 'Inválido';
    const tombamento = v.tombamento ? parseNum(v.tombamento) : null;
    if (v.tombamento && tombamento == null) e.tombamento = 'Inválido';
    if (tombamento != null && nnm != null && tombamento > nnm) e.tombamento = 'Não pode superar o NNM';
    const meta = v.meta ? parseNum(v.meta) : null;
    if (v.meta && meta == null) e.meta = 'Inválido';
    if (Object.values(e).some(Boolean)) { setErros(e); return; }

    const plTotal = (plOn ?? 0) + (plOff ?? 0);
    const denom = (plIni ?? 0) + (nnm ?? 0);
    const rentPct = denom > 0 ? (rentR ?? 0) / denom : (r.rentabilidade_pct ?? 0);
    const dados: Record<string, unknown> = {
      pl_inicial_total: plIni, pl_onshore: plOn, pl_offshore: plOff,
      pl_total: plTotal, aporte_mes_total: nnm,
      rentabilidade_total: rentR, rentabilidade_pct: rentPct,
    };
    if (ptax != null) dados.ptax_fechamento = ptax;
    if (plUsd != null) dados.pl_offshore_usd = plUsd;
    dados.nnm_tombamento = tombamento != null && tombamento > 0 ? tombamento : 0;
    if (meta != null) dados.meta_poupanca_mensal = meta;

    setSalvando(true);
    try {
      const docId = `${slugify(r.nome_cliente)}_${r.ano}_${r.mes}`;
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
        <input className={INP} value={v[k]} onChange={e => set(k, e.target.value)}
          placeholder={String(v[k])} />
        {erros[k] && <p className={ERR_CLS} style={{ color: '#dc2626' }}>{erros[k]}</p>}
      </div>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="overflow-hidden transition-all duration-200 ease-out max-h-96 opacity-100"
          style={{ backgroundColor: '#fff', borderBottom: '2px solid #dbeafe', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.04)' }}>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: '#160F41' }}>Editando {periodo}</p>
              {erros._ && <span className="text-xs" style={{ color: '#dc2626' }}>{erros._}</span>}
            </div>

            <div className="flex flex-wrap gap-4">
              {campo('plIni', 'AUM Inicial', 'w-40')}
              {campo('plOn', 'AUM Onshore', 'w-36')}
              {campo('plOff', 'AUM Offshore R$', 'w-36')}
              {temOff && campo('plUsd', 'AUM USD', 'w-28')}
              {temOff && campo('ptax', 'PTAX', 'w-24')}
              {campo('nnm', 'NNM', 'w-32')}
              <div className="w-32">
                <p className={LBL} style={{ color: '#6b6b8a' }} title="Portabilidade de outra instituição — não conta para meta de poupança">Tombamento R$</p>
                <input className={INP} value={v.tombamento} onChange={e => set('tombamento', e.target.value)} placeholder="0" />
                {erros.tombamento && <p className={ERR_CLS} style={{ color: '#dc2626' }}>{erros.tombamento}</p>}
                <p className="text-[10px] mt-0.5" style={{ color: '#6b6b8a' }}>
                  Poup. líquida: {formatCurrency((parseNum(v.nnm) ?? 0) - (parseNum(v.tombamento) ?? 0))}
                </p>
              </div>
              {campo('rentR', 'Rent. R$', 'w-36')}
              {campo('meta', 'Meta Poupança', 'w-36')}
            </div>

            <div className="flex gap-6 text-xs" style={{ color: '#6b6b8a' }}>
              <span>AUM Total calculado: {formatCurrency(calc.plTotal)}</span>
              <span>Rent. % calculada: {(calc.rentPct * 100).toFixed(4)}%</span>
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
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
