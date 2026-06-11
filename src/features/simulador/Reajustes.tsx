// --- Aba Reajustes (Precificação): fee sugerido p/ clientes existentes ---
import { useMemo, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { salvarParametros } from '../../services/firebase';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useReajustes, type ReajusteRow, type PerfilStatus } from './useReajustes';

const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
const TD = 'px-3 py-2 text-sm';

const PERFIL_LABEL: Record<PerfilStatus, { txt: string; cor: string; bg: string }> = {
  completo: { txt: 'Completo', cor: '#166534', bg: '#dcfce7' },
  parcial:  { txt: 'Parcial',  cor: '#92400e', bg: '#fef3c7' },
  ausente:  { txt: 'Ausente',  cor: '#6b7280', bg: '#f3f4f6' },
};
const PERFIL_TIP = 'Base do cálculo de horas: completo = perfil + volumetria; parcial = perfil sem volumetria mensal (consumo zero REAL, não pendência); ausente = sem perfil → fallback HORAS_PACOTE.';

function badgeView(r: ReajusteRow) {
  switch (r.badge) {
    case 'subprecificado':   return <Badge variante="alerta">Subprecificado</Badge>;
    case 'sobreprecificado': return <Badge variante="roxo">Sobreprecificado</Badge>;
    case 'rebate_cobre':     return <Badge variante="sucesso">Rebate cobre</Badge>;
    default:                 return <Badge variante="default">OK</Badge>;
  }
}

function atendView(r: ReajusteRow) {
  if (r.atendimento == null) return <span style={{ color: '#d1d5db' }}>—</span>;
  const d = r.deltaAtendimento ?? 0;
  const txt = `${d >= 0 ? '+' : ''}${d.toFixed(0)}h`;
  if (r.atendimento === 'subatendido') return <Badge variante="alerta">Subatendido {txt}</Badge>;
  if (r.atendimento === 'sobreatendido') return <Badge variante="roxo">Sobreatendido {txt}</Badge>;
  return <Badge variante="sucesso">Alinhado {txt}</Badge>;
}

export function Reajustes() {
  const { parametros, setParametros } = useApp();
  const [materialidade, setMaterialidade] = useState(10); // % editável
  const { rows, dinheiroNaMesa, nSubatendidos, nSobreatendidos, margemAlvo, aliqImpFat, denomInvalido, periodoSelecionado, loading } = useReajustes(materialidade / 100);
  const [sel, setSel] = useState<ReajusteRow | null>(null);
  const [margemInput, setMargemInput] = useState(margemAlvo * 100);
  const [salvando, setSalvando] = useState(false);

  const visiveis = useMemo(() => {
    const filtradas = rows.filter(r => r.badge !== 'ok' || (r.gapPct != null && Math.abs(r.gapPct) >= materialidade / 100));
    return [...filtradas].sort((a, b) => b.gap - a.gap);
  }, [rows, materialidade]);

  async function salvarMargem() {
    if (!confirm(`Margem alvo GLOBAL = ${margemInput.toFixed(2)}% — afeta o fee sugerido de TODOS os clientes. Confirmar?`)) return;
    setSalvando(true);
    try {
      const novos = { ...parametros, margem_alvo: margemInput / 100 };
      await salvarParametros(novos);
      setParametros(novos);
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#6b6b8a' }}>Margem EBITDA alvo (GLOBAL %)</label>
          <div className="flex items-center gap-2">
            <input type="number" step="0.5" value={margemInput} onChange={e => setMargemInput(Number(e.target.value))}
              className="rounded px-2 py-1.5 text-sm w-28" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
            <button onClick={salvarMargem} disabled={salvando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#6b6b8a' }}>Materialidade (|gap| ≥ %)</label>
          <input type="number" step="1" value={materialidade} onChange={e => setMaterialidade(Number(e.target.value))}
            className="rounded px-2 py-1.5 text-sm w-24" style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
        </div>
        <p className="text-xs" style={{ color: '#6b6b8a' }}>
          Fee sugerido = custo ÷ (1 − imp.fat {formatPercent(aliqImpFat * 100)} − margem {formatPercent(margemAlvo * 100)}) − rebate líquido.
        </p>
      </div>

      {denomInvalido ? (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#991b1b' }}>
          Margem alvo + imposto de faturamento ≥ 100% — impossível precificar. Reduza a margem.
        </div>
      ) : loading ? (
        <p className="text-sm" style={{ color: '#6b6b8a' }}>Carregando…</p>
      ) : (
        <>
          <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr style={{ color: '#6b6b8a' }}>
                  <th className={`${TH} text-left`}>Cliente</th>
                  <th className={`${TH} text-left`}>Pacote</th>
                  <th className={`${TH} text-center`} title={PERFIL_TIP}>Perfil</th>
                  <th className={`${TH} text-right`}>Fee atual</th>
                  <th className={`${TH} text-right`}>Custo total</th>
                  <th className={`${TH} text-right`}>Rebate líq.</th>
                  <th className={`${TH} text-right`}>Receita nec.</th>
                  <th className={`${TH} text-right`}>Fee sugerido</th>
                  <th className={`${TH} text-right`}>Gap</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={`${TH} text-center`} title="Horas alocadas (realizado) vs horas de demanda (perfil). Diagnóstico de staffing — não muda o custo.">Atend.</th>
                  <th className={`${TH} text-right`} title="Fee hipotético SE a mão de obra fosse refeita conforme a demanda (horas demanda × custo/h médio). Cenário, não ação.">Fee cenário</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map(r => {
                  const p = PERFIL_LABEL[r.perfilStatus];
                  return (
                    <tr key={r.nome} className="border-t cursor-pointer hover:bg-gray-50" style={{ borderColor: '#e2e2e8' }} onClick={() => setSel(r)}>
                      <td className={`${TD} font-medium`} style={{ color: '#160F41' }}>{r.nome}</td>
                      <td className={TD} style={{ color: '#6b6b8a' }}>{r.pacote}</td>
                      <td className={`${TD} text-center`}>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: p.cor, backgroundColor: p.bg }}>{p.txt}</span>
                      </td>
                      <td className={`${TD} text-right`}>{formatCurrency(r.feeAtual)}</td>
                      <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatCurrency(r.custoTotal)}</td>
                      <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatCurrency(r.rebateLiquido)}</td>
                      <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatCurrency(r.receitaNecessaria)}</td>
                      <td className={`${TD} text-right font-bold`} style={{ color: '#160F41' }}>{r.feeSugerido > 0 ? formatCurrency(r.feeSugerido) : '—'}</td>
                      <td className={`${TD} text-right`} style={{ color: r.gap > 0 ? '#991b1b' : '#166534' }}>
                        {formatCurrency(r.gap)}{r.gapPct != null && <span className="text-[10px]"> ({formatPercent(r.gapPct * 100)})</span>}
                      </td>
                      <td className={`${TD} text-center`}>{badgeView(r)}</td>
                      <td className={`${TD} text-center`}>{atendView(r)}</td>
                      <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>
                        {r.atendimento === 'subatendido' && r.feeCenario != null ? formatCurrency(r.feeCenario) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm font-medium" style={{ color: '#991b1b' }}>
            💰 Dinheiro na mesa (Σ gap dos subprecificados): {formatCurrency(dinheiroNaMesa)}
            <span className="text-xs font-normal" style={{ color: '#6b6b8a' }}> · {visiveis.length} de {rows.length} acima da materialidade · staffing: {nSubatendidos} subatendidos / {nSobreatendidos} sobreatendidos · período {periodoSelecionado}</span>
          </p>
        </>
      )}

      {sel && (
        <Modal aberto onFechar={() => setSel(null)} titulo={`Reajuste — ${sel.nome}`} largura="lg">
          <div className="space-y-2 text-sm" style={{ color: '#160F41' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Eixo 1 — Preço (base realizada)</p>
            <Linha label="Custo total servido" valor={formatCurrency(sel.custoTotal)} />
            <Linha label={`÷ (1 − imp.fat ${formatPercent(aliqImpFat * 100)} − margem ${formatPercent(margemAlvo * 100)})`} valor="" />
            <Linha label="= Receita necessária" valor={formatCurrency(sel.receitaNecessaria)} forte />
            <Linha label="− Rebate líquido (subsídio)" valor={formatCurrency(sel.rebateLiquido)} />
            <Linha label="= Fee sugerido" valor={sel.feeSugerido > 0 ? formatCurrency(sel.feeSugerido) : `${formatCurrency(sel.feeSugerido)} (rebate cobre · excedente ${formatCurrency(sel.excedenteRebate)})`} forte />
            <div className="border-t pt-2 mt-2" style={{ borderColor: '#e2e2e8' }}>
              <Linha label="Fee atual" valor={formatCurrency(sel.feeAtual)} />
              <Linha label="Gap (sugerido − atual)" valor={`${formatCurrency(sel.gap)}${sel.gapPct != null ? ` (${formatPercent(sel.gapPct * 100)})` : ''}`}
                cor={sel.gap > 0 ? '#991b1b' : '#166534'} forte />
            </div>

            {/* Eixo 2 — Staffing (diagnóstico; NÃO é custo). */}
            <div className="border-t pt-3 mt-3" style={{ borderColor: '#e2e2e8' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6b6b8a' }}>Eixo 2 — Staffing (horas: alocadas vs demanda)</p>
              {sel.horasDemanda == null ? (
                <p className="text-xs" style={{ color: '#9ca3af' }}>Sem perfil de complexidade — diagnóstico de demanda indisponível.</p>
              ) : (
                <>
                  <table className="min-w-full text-xs">
                    <thead style={{ color: '#6b6b8a' }}>
                      <tr><th className="text-left py-1">Função</th><th className="text-right py-1">Alocadas</th><th className="text-right py-1">Demanda</th><th className="text-right py-1">Δ</th></tr>
                    </thead>
                    <tbody>
                      {sel.staffing.map(s => (
                        <tr key={s.funcao}>
                          <td className="py-1">{s.funcao}</td>
                          <td className="text-right py-1" style={{ color: '#6b6b8a' }}>{s.alocada.toFixed(1)}h</td>
                          <td className="text-right py-1" style={{ color: '#6b6b8a' }}>{s.demanda.toFixed(1)}h</td>
                          <td className="text-right py-1" style={{ color: (s.alocada - s.demanda) < 0 ? '#991b1b' : '#166534' }}>{(s.alocada - s.demanda) >= 0 ? '+' : ''}{(s.alocada - s.demanda).toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Linha label="Total alocadas vs demanda" valor={`${sel.horasAlocadas.toFixed(1)}h vs ${sel.horasDemanda.toFixed(1)}h (Δ ${(sel.deltaAtendimento ?? 0).toFixed(1)}h)`} forte />
                  {sel.atendimento === 'subatendido' && sel.feeCenario != null && (
                    <Linha label="Fee CENÁRIO (se realocado p/ demanda)" valor={`${formatCurrency(sel.feeCenario)} — hipótese, não ação`} cor="#92400e" forte />
                  )}
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Linha({ label, valor, forte, cor }: { label: string; valor: string; forte?: boolean; cor?: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: '#6b6b8a' }}>{label}</span>
      <span className={forte ? 'font-bold' : ''} style={{ color: cor ?? '#160F41' }}>{valor}</span>
    </div>
  );
}
