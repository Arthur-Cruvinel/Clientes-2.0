// --- Import de consumo jurídico: ENTRADA ASSISTIDA (Commit 1) ---
// O relatório do Monday é PDF-imagem (parse morto por prova). O operador COLA as contagens
// do dashboard; este componente parseia de forma determinística e mostra o preview para
// conferência visual contra o PDF. Sem save aqui — o funil (de-para → snapshot → tela) é
// dos Commits 2-4. O PDF em test-fixtures/ é a referência humana do que se olha ao colar.

import { useMemo, useState } from 'react';
import { parseContagens } from './parseContagens';

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function ConsumoJuridicoImport() {
  const [periodo, setPeriodo] = useState('');
  const [texto, setTexto] = useState('');
  const r = useMemo(() => parseContagens(texto), [texto]);
  const periodoValido = PERIODO_RE.test(periodo);
  const entradasOrdenadas = [...r.entradas].sort((a, b) => b.contagem - a.contagem);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="text-lg font-bold" style={{ color: '#160F41' }}>Consumo Jurídico — entrada de contagens</h3>
        <p className="text-sm mt-1" style={{ color: '#6b6b8a' }}>
          O relatório do Monday é uma imagem — cole as contagens do dashboard (uma linha por
          cliente). O relatório é <strong>acumulado</strong> (Jan → mês corrente); o delta mensal
          sai entre snapshots.
        </p>
      </div>

      {/* Período */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Período do relatório</label>
        <input value={periodo} onChange={e => setPeriodo(e.target.value.trim())} placeholder="2026-06"
          className="mt-1 block w-40 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: periodo && !periodoValido ? '#991b1b' : '#e2e2e8' }} />
        {periodo && !periodoValido && <p className="text-[11px] mt-1" style={{ color: '#991b1b' }}>Formato AAAA-MM (ex.: 2026-06).</p>}
      </div>

      {/* Textarea */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
          Contagens coladas — formato: <code>Nome &lt;espaços&gt; número</code>
        </label>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={10}
          placeholder={'Rede Ronaldo 130\nLorena Improta 71\nPaulinho 51\n...'}
          className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-mono"
          style={{ borderColor: '#e2e2e8' }} />
      </div>

      {/* Erros — NUNCA pular em silêncio */}
      {r.erros.length > 0 && (
        <div className="rounded-lg p-3" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-xs font-bold mb-1" style={{ color: '#991b1b' }}>{r.erros.length} linha(s) não reconhecida(s) — corrija antes de seguir:</p>
          <ul className="text-[11px] space-y-0.5" style={{ color: '#991b1b' }}>
            {r.erros.map(e => <li key={e.linha}>Linha {e.linha}: "{e.texto}" — {e.motivo}</li>)}
          </ul>
        </div>
      )}

      {/* Preview + total para conferência visual contra o PDF */}
      {r.entradas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Preview ({r.entradas.length} clientes)</span>
            <span className="text-sm font-bold" style={{ color: '#160F41' }}>Total: {r.total} demandas</span>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr><th className="px-3 py-1.5 text-left text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Cliente (Monday)</th>
                  <th className="px-3 py-1.5 text-right text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Demandas</th></tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {entradasOrdenadas.map((e, i) => (
                  <tr key={`${e.nome}-${i}`}>
                    <td className="px-3 py-1.5" style={{ color: '#160F41' }}>{e.nome}</td>
                    <td className="px-3 py-1.5 text-right font-medium" style={{ color: '#160F41' }}>{e.contagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] mt-2" style={{ color: '#6b6b8a' }}>
            Confira o <strong>Total</strong> contra a soma do PDF. Próximo passo (de-para dos nomes
            → clientes canônicos) entra no Commit 2; a persistência e a tela, no Commit 3.
          </p>
        </div>
      )}

      {periodoValido && r.entradas.length > 0 && r.erros.length === 0 && (
        <div className="rounded-lg p-2 text-[11px]" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>
          ✓ Parse limpo para {periodo}: {r.entradas.length} clientes, {r.total} demandas. Pronto para o de-para (Commit 2).
        </div>
      )}
    </div>
  );
}
