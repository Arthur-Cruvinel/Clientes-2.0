// --- Card de meta AUM unificada — metas por período + NNM derivado ---

import { useState, useMemo, useEffect } from 'react';
import { Pencil, Target, Plus, Trash2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { MetaAUM, MetaPeriodo, TotaisPoupanca, PontoHistorico, PontoMetaCumprimento, ModoAUM } from './usePoupanca';
import { buscarCDIProjetado } from '../../services/cdiProjetado';

interface Props {
  metaAUM: MetaAUM | null;
  setMetaAUM: (meta: MetaAUM) => Promise<void>;
  metaNNM: number | null;
  setMetaNNM: (valor: number) => Promise<void>;
  metasPeriodo: MetaPeriodo[];
  setMetasPeriodo: (metas: MetaPeriodo[]) => Promise<void>;
  totais: TotaisPoupanca;
  historico: PontoHistorico[];
  historicoMeta: PontoMetaCumprimento[];
  modoAUM: ModoAUM;
  aumLegadoTotal: number;
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function mesesEntre(hoje: Date, dataAlvo: string): number {
  const [anoAlvo, mesAlvo] = dataAlvo.split('-').map(Number);
  return (anoAlvo * 12 + mesAlvo) - (hoje.getFullYear() * 12 + (hoje.getMonth() + 1));
}

export function PoupancaMeta({ metaAUM, setMetaAUM, setMetaNNM, metasPeriodo, setMetasPeriodo, totais, historico, historicoMeta, modoAUM, aumLegadoTotal }: Props) {
  // AUM efetivo: sob gestão = Galápagos + legado; Galápagos = só lâminas
  const aumEfetivo = totais.pl_total + (modoAUM === 'sob_gestao' ? aumLegadoTotal : 0);
  // Meta ajustada: na visão Galápagos, desconta o legado que não é custódia Galápagos
  const metaAjustada = metaAUM ? {
    ...metaAUM,
    valor: modoAUM === 'galapagos' ? metaAUM.valor - aumLegadoTotal : metaAUM.valor,
  } : null;
  const [editando, setEditando] = useState(false);
  const [valorMeta, setValorMeta] = useState('');
  const [anoAlvo, setAnoAlvo] = useState(2026);
  const [mesAlvo, setMesAlvo] = useState(12);
  const [salvando, setSalvando] = useState(false);
  const [editandoPeriodo, setEditandoPeriodo] = useState(false);

  const [novaMetaAno, setNovaMetaAno] = useState(2025);
  const [novaMetaValor, setNovaMetaValor] = useState('');
  const [novaMetaNnm, setNovaMetaNnm] = useState('');

  // CDI projetado por mês para cálculo composto
  const [cdiMeses, setCdiMeses] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!metaAUM) return;
    let cancelado = false;
    const hoje = new Date();
    const mesesRest = mesesEntre(hoje, metaAUM.data_alvo);
    if (mesesRest <= 0) return;

    const meses: { ano: number; mes: number }[] = [];
    for (let i = 0; i < mesesRest; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1 + i, 1);
      meses.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    }

    Promise.allSettled(
      meses.map(async ({ ano, mes }) => {
        const val = await buscarCDIProjetado(ano, mes);
        return { chave: `${ano}-${String(mes).padStart(2, '0')}`, val };
      }),
    ).then(results => {
      if (cancelado) return;
      const mapa = new Map<string, number>();
      for (const r of results) if (r.status === 'fulfilled') mapa.set(r.value.chave, r.value.val);
      setCdiMeses(mapa);
    });
    return () => { cancelado = true; };
  }, [metaAUM]);

  // Média móvel NNM dos últimos 3 meses (dados reais do historicoMeta)
  const nnmMM3 = useMemo(() => {
    if (historicoMeta.length === 0) return 0;
    const ultimos3 = historicoMeta.slice(-3);
    const soma = ultimos3.reduce((s, d) => s + d.nnm, 0);
    return soma / ultimos3.length;
  }, [historicoMeta]);

  // Cálculo iterativo: rent composta sobre AUM + NNM projetado (MM3)
  // Usa metaAjustada (descontado legado na visão Galápagos)
  const derivado = useMemo(() => {
    if (!metaAjustada) return null;
    const hoje = new Date();
    const mesesRest = mesesEntre(hoje, metaAjustada.data_alvo);
    if (mesesRest <= 0) return { gap: 0, mesesRestantes: 0, nnmNecessario: 0, rentProjetada: 0, nnmMM3Mensal: 0, metaValor: metaAjustada.valor, pctAtingido: 100 };

    const pctAtingido = aumEfetivo > 0 ? (aumEfetivo / metaAjustada.valor) * 100 : 0;

    let aumProj = aumEfetivo;
    let rentAcum = 0;
    let nnmAcum = 0;
    for (let i = 0; i < mesesRest; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1 + i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cdiMes = cdiMeses.get(chave) ?? 0.01;
      const rentMes = aumProj * cdiMes;
      rentAcum += rentMes;
      nnmAcum += nnmMM3;
      aumProj += rentMes + nnmMM3;
    }

    const aumFinalProj = aumEfetivo + rentAcum + nnmAcum;
    const gapResidual = Math.max(0, metaAjustada.valor - aumFinalProj);
    const nnmNecessario = nnmMM3 + (gapResidual / mesesRest);

    return { gap: metaAjustada.valor - aumEfetivo, mesesRestantes: mesesRest, nnmNecessario, rentProjetada: rentAcum, nnmMM3Mensal: nnmMM3, metaValor: metaAjustada.valor, pctAtingido };
  }, [metaAjustada, aumEfetivo, cdiMeses, nnmMM3]);

  function iniciarEdicao() {
    if (metaAUM) {
      setValorMeta(String(metaAUM.valor));
      const [a, m] = metaAUM.data_alvo.split('-').map(Number);
      setAnoAlvo(a); setMesAlvo(m);
    } else {
      setValorMeta('1300000000');
      setAnoAlvo(2026); setMesAlvo(12);
    }
    setEditando(true);
  }

  async function salvar() {
    const num = Number(valorMeta);
    if (isNaN(num) || num <= 0) return;
    setSalvando(true);
    try {
      const dataAlvo = `${anoAlvo}-${String(mesAlvo).padStart(2, '0')}`;
      await setMetaAUM({ valor: num, data_alvo: dataAlvo });
      // Usar derivado se disponível (cálculo composto), senão simplificado
      if (derivado && derivado.mesesRestantes > 0) {
        await setMetaNNM(Math.round(derivado.nnmNecessario));
      } else {
        const mesesRest = mesesEntre(new Date(), dataAlvo);
        if (mesesRest > 0) {
          const gap = num - aumEfetivo;
          await setMetaNNM(Math.round(Math.max(0, gap) / mesesRest));
        }
      }
      setEditando(false);
    } finally { setSalvando(false); }
  }

  // Auto-derivar NNM: (meta AUM - AUM início do ano) / 12 meses
  function derivarNnm(valorAum: number, ano?: number): number {
    const anoRef = ano ?? novaMetaAno;
    // Buscar AUM do primeiro mês do ano no histórico
    const priMes = historico.find(h => h.ano === anoRef);
    const aumInicio = priMes?.pl_total ?? aumEfetivo;
    const gap = valorAum - aumInicio;
    return gap > 0 ? Math.round(gap / 12) : 0;
  }

  async function adicionarMetaPeriodo() {
    const valor = Number(novaMetaValor);
    const nnmManual = Number(novaMetaNnm);
    if (isNaN(valor) || valor <= 0) return;
    // Se NNM não foi preenchido, auto-derivar
    const nnmFinal = (!isNaN(nnmManual) && nnmManual > 0) ? nnmManual : derivarNnm(valor);
    const nova: MetaPeriodo = {
      ano: novaMetaAno,
      valor_aum: valor,
      data_alvo: `${novaMetaAno}-12`,
      nnm_mensal: nnmFinal,
    };
    const atualizadas = [...metasPeriodo.filter(m => m.ano !== novaMetaAno), nova].sort((a, b) => a.ano - b.ano);
    await setMetasPeriodo(atualizadas);
    setNovaMetaValor(''); setNovaMetaNnm('');
  }

  async function removerMetaPeriodo(ano: number) {
    await setMetasPeriodo(metasPeriodo.filter(m => m.ano !== ano));
  }

  const [aAlvo, mAlvo] = metaAUM ? metaAUM.data_alvo.split('-').map(Number) : [0, 0];

  return (
    <div className="bg-white rounded-lg border p-5" style={{ borderColor: '#e2e2e8' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0065FF, #D000BB)' }}>
            <Target size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
              Meta AUM {modoAUM === 'galapagos' ? '(Galapagos)' : '(Sob Gestao)'}
            </p>
            {metaAjustada ? (
              <p className="text-lg font-bold" style={{ color: '#160F41' }}>
                {formatCurrency(metaAjustada.valor, true)}
                <span className="text-xs font-normal ml-2" style={{ color: '#6b6b8a' }}>ate {MESES_LABEL[mAlvo - 1]}/{aAlvo}</span>
                {modoAUM === 'galapagos' && aumLegadoTotal > 0 && (
                  <span className="text-[10px] font-normal ml-2" style={{ color: '#f59e0b' }}>
                    (total {formatCurrency(metaAUM!.valor, true)} - legado {formatCurrency(aumLegadoTotal, true)})
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm" style={{ color: '#6b6b8a' }}>Clique para definir</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {!editando && (
            <button onClick={() => setEditandoPeriodo(v => !v)} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: editandoPeriodo ? '#0065FF' : '#6b6b8a' }} title="Metas por periodo">
              <TrendingUp size={16} />
            </button>
          )}
          {!editando && (
            <button onClick={iniciarEdicao} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: '#6b6b8a' }}>
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Editor meta atual */}
      {editando && (
        <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid #f1f5f9' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Valor da meta (R$)</label>
              <input type="number" value={valorMeta} onChange={e => setValorMeta(e.target.value)}
                className="w-full rounded-lg border px-3 py-1.5 text-sm mt-1" style={{ borderColor: '#e2e2e8', color: '#160F41' }} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Data-alvo</label>
              <div className="flex gap-1.5 mt-1">
                <select value={mesAlvo} onChange={e => setMesAlvo(Number(e.target.value))}
                  className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: '#e2e2e8', color: '#160F41' }}>
                  {MESES_LABEL.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
                </select>
                <select value={anoAlvo} onChange={e => setAnoAlvo(Number(e.target.value))}
                  className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: '#e2e2e8', color: '#160F41' }}>
                  {[2025, 2026, 2027, 2028, 2029, 2030].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={salvar} disabled={salvando}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditando(false)}
              className="px-3 py-1.5 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Derivações */}
      {derivado && !editando && (
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>Gap</p>
            <p className="text-sm font-bold" style={{ color: derivado.gap > 0 ? '#dc2626' : '#16a34a' }}>
              {formatCurrency(derivado.gap, true)}
            </p>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: '#f0fdf4' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>Rent. projetada</p>
            <p className="text-sm font-bold" style={{ color: '#16a34a' }}>
              {formatCurrency(derivado.rentProjetada, true)}
            </p>
            <p className="text-[10px]" style={{ color: '#6b6b8a' }}>CDI composto s/ AUM+NNM</p>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: '#eff6ff' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>NNM esperado (MM3)</p>
            <p className="text-sm font-bold" style={{ color: '#0065FF' }}>
              {formatCurrency(derivado.nnmMM3Mensal, true)}/mes
            </p>
            <p className="text-[10px]" style={{ color: '#6b6b8a' }}>media movel 3 periodos</p>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: '#f0f9ff' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>NNM necessario/mes</p>
            <p className="text-sm font-bold" style={{ color: '#0065FF' }}>{formatCurrency(derivado.nnmNecessario, true)}</p>
            <p className="text-[10px]" style={{ color: '#6b6b8a' }}>{derivado.mesesRestantes} meses restantes</p>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>% atingido</p>
            <p className="text-sm font-bold" style={{ color: derivado.pctAtingido >= 100 ? '#16a34a' : '#160F41' }}>
              {derivado.pctAtingido.toFixed(1)}%
            </p>
            <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e2e8f0' }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.min(derivado.pctAtingido, 100)}%`,
                background: 'linear-gradient(90deg, #0065FF, #D000BB)',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Metas por período */}
      {editandoPeriodo && !editando && (
        <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid #f1f5f9' }}>
          <p className="text-xs font-semibold" style={{ color: '#160F41' }}>Metas por periodo</p>

          {metasPeriodo.length > 0 && (
            <div className="space-y-1">
              {metasPeriodo.map(m => (
                <div key={m.ano} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#f8fafc' }}>
                  <span><strong style={{ color: '#160F41' }}>{m.ano}</strong> — AUM: {formatCurrency(m.valor_aum, true)} ate {m.data_alvo}</span>
                  <span style={{ color: '#0065FF' }}>NNM: {formatCurrency(m.nnm_mensal, true)}/mes</span>
                  <button onClick={() => removerMetaPeriodo(m.ano)} className="p-1 rounded hover:bg-red-50" style={{ color: '#dc2626' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>Ano</label>
              <select value={novaMetaAno} onChange={e => setNovaMetaAno(Number(e.target.value))}
                className="block rounded border px-2 py-1 text-xs mt-0.5" style={{ borderColor: '#e2e2e8' }}>
                {[2024, 2025, 2026, 2027, 2028].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>Meta AUM (R$)</label>
              <input type="number" value={novaMetaValor} onChange={e => setNovaMetaValor(e.target.value)}
                className="block rounded border px-2 py-1 text-xs mt-0.5 w-36" style={{ borderColor: '#e2e2e8' }} placeholder="1000000000" />
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>NNM/mes (R$)</label>
              <div className="flex gap-1 mt-0.5">
                <input type="number" value={novaMetaNnm} onChange={e => setNovaMetaNnm(e.target.value)}
                  className="block rounded border px-2 py-1 text-xs w-32" style={{ borderColor: '#e2e2e8' }}
                  placeholder={novaMetaValor ? formatCurrency(derivarNnm(Number(novaMetaValor))) : 'Auto'} />
                {novaMetaValor && (
                  <button onClick={() => setNovaMetaNnm(String(derivarNnm(Number(novaMetaValor))))}
                    className="px-1.5 py-1 rounded text-[10px] font-medium"
                    style={{ border: '1px solid #bfdbfe', color: '#0065FF' }} title="Calcular: (Meta AUM - AUM atual) / 12">
                    Auto
                  </button>
                )}
              </div>
            </div>
            <button onClick={adicionarMetaPeriodo}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white bg-gradient-brand">
              <Plus size={12} /> Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
