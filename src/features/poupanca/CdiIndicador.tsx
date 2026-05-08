// --- Indicador CDI (atual + projetado via Focus) ---
// Mostra CDI atual e projeção baseada na curva de juros.

import { useState, useEffect } from 'react';
import { TrendingUp, Loader2, X } from 'lucide-react';
import { buscarCDIMensal } from '../../services/cdi';
import { buscarCDIProjetado, getSelicAtual, getCurvaSelicProjetada } from '../../services/cdiProjetado';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface CdiMes { chave: string; label: string; valor: number; selicRef: number | null; tipo: 'real' | 'projetado'; }

export function CdiIndicador() {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<CdiMes[]>([]);
  const [selicFocus, setSelicFocus] = useState<number | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setLoading(true);

    const hoje = new Date();
    const meses: { ano: number; mes: number }[] = [];
    // 6 meses passados + 12 futuros
    for (let i = -6; i <= 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      meses.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    }

    const periodoAtual = hoje.getFullYear() * 12 + (hoje.getMonth() + 1);

    // Buscar curva SELIC projetada para cruzar
    const curvaPromise = getCurvaSelicProjetada();

    Promise.all([
      curvaPromise,
      Promise.allSettled(
        meses.map(async ({ ano, mes }) => {
          const p = ano * 12 + mes;
          const isPassado = p < periodoAtual;
          let valor: number;
          try {
            valor = isPassado ? await buscarCDIMensal(ano, mes) : await buscarCDIProjetado(ano, mes);
          } catch {
            valor = await buscarCDIProjetado(ano, mes);
          }
          return {
            chave: `${ano}-${String(mes).padStart(2, '0')}`,
            label: `${MESES[mes - 1]}/${ano}`,
            valor,
            tipo: (isPassado ? 'real' : 'projetado') as 'real' | 'projetado',
          };
        }),
      ),
    ]).then(([curva, results]) => {
      if (cancelado) return;
      const curvaMap = new Map(curva.map(c => [c.mes, c.selic]));
      const lista: CdiMes[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          lista.push({ ...r.value, selicRef: curvaMap.get(r.value.chave) ?? null });
        }
      }
      lista.sort((a, b) => a.chave.localeCompare(b.chave));
      setDados(lista);
      setSelicFocus(getSelicAtual());
    }).finally(() => { if (!cancelado) setLoading(false); });

    return () => { cancelado = true; };
  }, [aberto]);

  return (
    <>
      <button onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
        style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
        <TrendingUp size={14} /> CDI
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#160F41' }}>
              <div className="flex items-center gap-2 text-white">
                <TrendingUp size={16} />
                <span className="text-sm font-semibold">CDI — Realizado + Projecao</span>
              </div>
              <button onClick={() => setAberto(false)} className="text-white/60 hover:text-white"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loading && (
                <div className="flex items-center gap-2 py-4 text-sm" style={{ color: '#6b6b8a' }}>
                  <Loader2 size={14} className="animate-spin" /> Buscando taxas...
                </div>
              )}

              {selicFocus != null && (
                <div className="rounded-lg p-3" style={{ backgroundColor: '#f0f9ff' }}>
                  <p className="text-xs" style={{ color: '#6b6b8a' }}>SELIC Meta (Focus BCB)</p>
                  <p className="text-lg font-bold" style={{ color: '#0065FF' }}>{selicFocus.toFixed(2)}% a.a.</p>
                  <p className="text-xs" style={{ color: '#6b6b8a' }}>CDI ≈ {(selicFocus - 0.10).toFixed(2)}% a.a. → {(((Math.pow(1 + (selicFocus - 0.10) / 100, 1/12) - 1) * 100)).toFixed(4)}% a.m.</p>
                </div>
              )}

              {dados.length > 0 && (
                <table className="min-w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: '#f9f9fb' }}>
                      <th className="px-3 py-2 text-left font-bold uppercase" style={{ color: '#6b6b8a' }}>Periodo</th>
                      <th className="px-3 py-2 text-right font-bold uppercase" style={{ color: '#6b6b8a' }}>SELIC</th>
                      <th className="px-3 py-2 text-right font-bold uppercase" style={{ color: '#6b6b8a' }}>CDI Mensal</th>
                      <th className="px-3 py-2 text-right font-bold uppercase" style={{ color: '#6b6b8a' }}>CDI Anual.</th>
                      <th className="px-3 py-2 text-center font-bold uppercase" style={{ color: '#6b6b8a' }}>Fonte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#f1f5f9' }}>
                    {dados.map((d, i) => {
                      const selicMudou = d.selicRef != null && i > 0 && d.selicRef !== dados[i - 1]?.selicRef;
                      return (
                        <tr key={d.chave} style={selicMudou ? { borderTop: '2px solid #0065FF' } : undefined}>
                          <td className="px-3 py-1.5 font-medium" style={{ color: '#160F41' }}>{d.label}</td>
                          <td className="px-3 py-1.5 text-right" style={selicMudou ? { color: '#0065FF', fontWeight: 700 } : { color: '#6b6b8a' }}>
                            {d.selicRef != null ? `${d.selicRef.toFixed(2)}%` : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right">{(d.valor * 100).toFixed(4)}%</td>
                          <td className="px-3 py-1.5 text-right">{((Math.pow(1 + d.valor, 12) - 1) * 100).toFixed(2)}%</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={d.tipo === 'real'
                                ? { backgroundColor: '#dcfce7', color: '#166534' }
                                : { backgroundColor: '#fef3c7', color: '#92400e' }}>
                              {d.tipo === 'real' ? 'Realizado' : 'Projecao'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
