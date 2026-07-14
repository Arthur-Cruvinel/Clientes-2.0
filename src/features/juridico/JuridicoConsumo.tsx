// --- Seção REAL do módulo Jurídico: consumo medido por cliente ---
// Lê o snapshot consumo_juridico (acumulado Jan→período) e cruza com pool_mensal_juridico.
// TUDO relatório — nenhum lançamento; motor/DRE intocados. Substitui SÓ a parte de consumo
// do mockup (guard-rail: decisão dada). O resto do módulo segue ilustrativo com selo.

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { formatCurrency } from '../../utils/formatters';
import {
  buscarPeriodosConsumoJuridico, buscarConsumoClientesJuridico, buscarFlagsJuridico,
  type ConsumoPeriodoDoc, type ConsumoClienteDoc,
} from '../../services/firebase';

const KpiReal = ({ label, valor }: { label: string; valor: string }) => (
  <div className="rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b6b8a' }}>{label}</p>
    <p className="text-lg font-bold mt-0.5" style={{ color: '#160F41' }}>{valor}</p>
  </div>
);

export function JuridicoConsumo() {
  const { parametros } = useApp();
  const poolMensal = parametros.pool_mensal_juridico ?? 0;
  const [periodos, setPeriodos] = useState<ConsumoPeriodoDoc[]>([]);
  const [sel, setSel] = useState<string>('');
  const [clientes, setClientes] = useState<ConsumoClienteDoc[]>([]);
  const [flags, setFlags] = useState<Record<string, { jur: boolean; peso: number }>>({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarPeriodosConsumoJuridico().then(ps => {
      setPeriodos(ps);
      setSel(ps.length ? ps[ps.length - 1].periodo : '');
      if (!ps.length) setCarregando(false);
    });
    buscarFlagsJuridico().then(setFlags);
  }, []);
  useEffect(() => {
    if (!sel) return;
    setCarregando(true);
    buscarConsumoClientesJuridico(sel).then(cs => { setClientes(cs); setCarregando(false); });
  }, [sel]);

  const meta = periodos.find(p => p.periodo === sel);
  const dados = useMemo(() => {
    const totalNaoCasa = clientes.reduce((s, c) => s + c.demandas, 0);
    const meses = sel ? parseInt(sel.split('-')[1], 10) : 0;   // acumulado Jan→período
    const poolPeriodo = poolMensal * meses;
    const custoPorDemanda = totalNaoCasa > 0 ? poolPeriodo / totalNaoCasa : 0;
    const linhas = [...clientes].sort((a, b) => b.demandas - a.demandas).map(c => ({
      ...c,
      jur: flags[c.id_estavel_cliente]?.jur ?? false,
      participacao: totalNaoCasa > 0 ? c.demandas / totalNaoCasa : 0,
      custoEstimado: c.demandas * custoPorDemanda,
    }));
    const cortesia = linhas.filter(l => !l.jur);
    const vazamento = cortesia.reduce((s, l) => s + l.custoEstimado, 0);
    return { totalNaoCasa, meses, poolPeriodo, custoPorDemanda, linhas, cortesia, vazamento, entradaMes: meses > 0 ? totalNaoCasa / meses : 0 };
  }, [clientes, poolMensal, sel, flags]);

  if (carregando && !meta) return <p className="text-sm" style={{ color: '#6b6b8a' }}>Carregando consumo…</p>;
  if (!periodos.length) return (
    <div className="rounded-lg border p-4 text-sm" style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
      Sem snapshot de consumo ainda. Importe em <strong>Upload → Consumo Jurídico</strong>.
    </div>
  );
  const poolIndefinido = poolMensal <= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>● Medição real</span>
        <select value={sel} onChange={e => setSel(e.target.value)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: '#e2e2e8' }}>
          {periodos.map(p => <option key={p.periodo} value={p.periodo}>{p.periodo} (acum.)</option>)}
        </select>
        {meta && <span className="text-[11px]" style={{ color: '#6b6b8a' }}>
          {meta.n_clientes} clientes · CASA {meta.casa_demandas} · Externos {meta.externos_demandas ?? 0} · total {meta.total_demandas}
        </span>}
      </div>

      {poolIndefinido && (
        <div className="rounded-lg p-2 text-[11px]" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
          <code>pool_mensal_juridico</code> não definido em Configurações — custos exibidos como "—" até cravar o pool.
        </div>
      )}

      {/* KPIs do gargalo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiReal label="Pool mensal" valor={poolIndefinido ? '—' : formatCurrency(poolMensal)} />
        <KpiReal label={`Custo real / demanda`} valor={poolIndefinido ? '—' : formatCurrency(dados.custoPorDemanda)} />
        <KpiReal label={`Demandas (acum. ${dados.meses}m)`} valor={String(dados.totalNaoCasa)} />
        <KpiReal label="Entrada / mês (média)" valor={dados.entradaMes.toFixed(1)} />
      </div>
      <p className="text-[10px]" style={{ color: '#9ca3af' }}>
        Vazão e fila do gargalo dependem de status por demanda (concluída/andamento) — não vêm da
        contagem colada; entram quando o import trouxer o status linha-a-linha.
      </p>

      {/* Consumo por cliente */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
        <table className="min-w-full text-sm">
          <thead style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              <th className="px-3 py-1.5 text-left text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Cliente</th>
              <th className="px-3 py-1.5 text-right text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Demandas</th>
              <th className="px-3 py-1.5 text-right text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Participação</th>
              <th className="px-3 py-1.5 text-center text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Pacote</th>
              <th className="px-3 py-1.5 text-right text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Custo estimado</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {dados.linhas.map(c => (
              <tr key={c.id_estavel_cliente} style={c.jur ? undefined : { backgroundColor: '#fffbeb' }}>
                <td className="px-3 py-1.5" style={{ color: '#160F41' }}>{c.nome_cliente}</td>
                <td className="px-3 py-1.5 text-right font-medium" style={{ color: '#160F41' }}>{c.demandas}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: '#6b6b8a' }}>{(c.participacao * 100).toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-center">{c.jur
                  ? <span className="text-[10px] font-bold" style={{ color: '#166534' }}>sim</span>
                  : <span className="text-[10px] font-bold" style={{ color: '#b45309' }}>cortesia</span>}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: '#160F41' }}>{poolIndefinido ? '—' : formatCurrency(c.custoEstimado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CORTESIA — consomem sem pacote jurídico (a lista comercial) */}
      {dados.cortesia.length > 0 && (
        <div className="rounded-lg border p-3" style={{ borderColor: '#fde68a', backgroundColor: '#fffbeb' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#b45309' }}>Consomem sem pacote — lista comercial</p>
            <span className="text-sm font-bold" style={{ color: '#b45309' }}>
              Vazamento: {poolIndefinido ? '—' : formatCurrency(dados.vazamento)}
              <span className="text-[11px] font-normal"> · {dados.cortesia.length} clientes</span>
            </span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr>
              <th className="px-3 py-1 text-left text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Cliente</th>
              <th className="px-3 py-1 text-right text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Demandas</th>
              <th className="px-3 py-1 text-right text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Custo estimado</th>
            </tr></thead>
            <tbody className="divide-y" style={{ borderColor: '#fde68a' }}>
              {dados.cortesia.map(c => (
                <tr key={c.id_estavel_cliente}>
                  <td className="px-3 py-1 font-medium" style={{ color: '#160F41' }}>{c.nome_cliente}</td>
                  <td className="px-3 py-1 text-right" style={{ color: '#160F41' }}>{c.demandas}</td>
                  <td className="px-3 py-1 text-right font-bold" style={{ color: '#b45309' }}>{poolIndefinido ? '—' : formatCurrency(c.custoEstimado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] mt-2" style={{ color: '#6b6b8a' }}>
            Consumo jurídico de clientes sem <code>utiliza_servico_juridico</code> — o rateio por
            consumo (fase 2, frente própria) ataca este vazamento. Aqui é só o retrato comercial.
          </p>
        </div>
      )}

      {/* EXTERNOS — pagam o jurídico direto, não são clientes da base (fora do pool) */}
      {(meta?.externos?.length ?? 0) > 0 && (
        <div className="rounded-lg border p-3" style={{ borderColor: '#c7d2fe', backgroundColor: '#eef2ff' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#3730a3' }}>Externos — fora do pool</p>
            <span className="text-sm font-bold" style={{ color: '#3730a3' }}>
              {meta?.externos_demandas ?? 0} demandas
              <span className="text-[11px] font-normal"> · {meta?.externos?.length ?? 0} externos</span>
            </span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr>
              <th className="px-3 py-1 text-left text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Nome (board)</th>
              <th className="px-3 py-1 text-right text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Demandas</th>
            </tr></thead>
            <tbody className="divide-y" style={{ borderColor: '#c7d2fe' }}>
              {[...(meta?.externos ?? [])].sort((a, b) => b.demandas - a.demandas).map(e => (
                <tr key={e.nome}>
                  <td className="px-3 py-1 font-medium" style={{ color: '#160F41' }}>{e.nome}</td>
                  <td className="px-3 py-1 text-right" style={{ color: '#160F41' }}>{e.demandas}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] mt-2" style={{ color: '#6b6b8a' }}>
            Pagam o jurídico DIRETAMENTE e não são clientes da base — a medição grava o board
            inteiro, mas estes ficam fora do denominador do custo/demanda, do rateio e da cortesia.
          </p>
        </div>
      )}
    </div>
  );
}
