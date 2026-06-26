// --- Aba Extraordinário das Configurações ---
// Faixas de valor (R$) e percentuais informativos por tipo de serviço avulso,
// usados pelo Orçador de Extraordinário. NÃO entram no motor do fee — só
// sugerem o valor e montam a cláusula informativa (texto). Jurídico cravado;
// ma/valuation/viabilidade nascem zerados (o CFO crava aqui).

import { useState, useEffect } from 'react';
import type { Parametros, TipoExtraordinario, FaixaExtraordinario } from '../../types';
import { CATALOGO_EXTRAORDINARIO } from '../extraordinario/catalogoExtraordinario';

interface Props {
  parametros: Parametros;
  onSalvar: (p: Parametros) => Promise<void>;
  salvando: boolean;
}

export function TabExtraordinario({ parametros, onSalvar, salvando }: Props) {
  const [ext, setExt] = useState<Record<TipoExtraordinario, FaixaExtraordinario>>(parametros.extraordinario);

  useEffect(() => { setExt(parametros.extraordinario); }, [parametros]);

  const setCampo = (tipo: TipoExtraordinario, campo: keyof FaixaExtraordinario, valor: number) => {
    setExt(prev => ({ ...prev, [tipo]: { ...prev[tipo], [campo]: valor } }));
  };

  const salvar = () => {
    if (!confirm('Estas faixas/percentuais são GLOBAIS — afetam todos os orçamentos extraordinários novos. Confirmar?')) return;
    onSalvar({ ...parametros, extraordinario: ext });
  };

  const INP = 'rounded-lg px-2 py-1.5 text-sm w-28';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
  const grupos = ['Jurídico', 'Estratégico'] as const;

  return (
    <div className="space-y-6">
      <p className="text-xs" style={{ color: '#6b6b8a' }}>
        Faixa de valor sugerida (mín–máx) por serviço extraordinário + percentual informativo
        (success fee / % da causa). <strong>Não afeta o cálculo do fee</strong> — o Orçador usa a
        faixa como sugestão (valor editável) e o % vira texto no documento.
      </p>

      {grupos.map(grupo => (
        <div key={grupo} className="space-y-3">
          <h3 className="text-sm font-bold" style={{ color: '#160F41' }}>{grupo}</h3>
          {CATALOGO_EXTRAORDINARIO.filter(c => c.grupo === grupo).map(cat => {
            const f = ext[cat.tipo];
            return (
              <div key={cat.tipo} className="rounded-lg border p-3" style={{ borderColor: '#e2e2e8' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: '#160F41' }}>{cat.label}</span>
                  {cat.placeholder && <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>A cravar</span>}
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="block">
                    <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Faixa mín (R$)</span>
                    <input type="number" step="50" value={f.faixa_min} onChange={e => setCampo(cat.tipo, 'faixa_min', Number(e.target.value))} className={INP} style={BRD} />
                  </label>
                  <label className="block">
                    <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Faixa máx (R$)</span>
                    <input type="number" step="50" value={f.faixa_max} onChange={e => setCampo(cat.tipo, 'faixa_max', Number(e.target.value))} className={INP} style={BRD} />
                  </label>
                  {cat.clausula && (
                    <>
                      <label className="block">
                        <span className="text-[11px]" style={{ color: '#6b6b8a' }}>{cat.clausula === 'success_fee' ? 'Success fee mín (%)' : '% da causa mín'}</span>
                        <input type="number" step="0.5" value={f.clausula_pct_min ?? 0} onChange={e => setCampo(cat.tipo, 'clausula_pct_min', Number(e.target.value))} className={INP} style={BRD} />
                      </label>
                      <label className="block">
                        <span className="text-[11px]" style={{ color: '#6b6b8a' }}>{cat.clausula === 'success_fee' ? 'Success fee máx (%)' : '% da causa máx'}</span>
                        <input type="number" step="0.5" value={f.clausula_pct_max ?? 0} onChange={e => setCampo(cat.tipo, 'clausula_pct_max', Number(e.target.value))} className={INP} style={BRD} />
                      </label>
                    </>
                  )}
                  {cat.clausula === 'pct_causa' && (
                    <label className="block">
                      <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Honorário mínimo (R$)</span>
                      <input type="number" step="100" value={f.clausula_minimo ?? 0} onChange={e => setCampo(cat.tipo, 'clausula_minimo', Number(e.target.value))} className={INP} style={BRD} />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <button disabled={salvando} onClick={salvar}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
