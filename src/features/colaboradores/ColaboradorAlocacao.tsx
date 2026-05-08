// --- Aba "Alocação" do modal: edita pct_* dos clientes atendidos ---
// Mostra horas efetivas (pct × 168 × % alocável) e fator de escopo por cliente.

import { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';
import { HORAS_CLT_MES, HORAS_PACOTE } from '../../utils/constants';
import { corBarraOcupacao } from './columns';
import type { Cliente, FuncaoAlocacao } from '../../types';
import type { ColaboradorDerivado, StatusOcupacao } from './useColaboradores';

interface Props {
  derivado: ColaboradorDerivado;
  clientes: Cliente[];
  periodo: string;
  onSalvarPct: (nomeCliente: string, funcao: FuncaoAlocacao, valor: number) => Promise<void>;
  salvando: boolean;
}

function statusDe(ocupacao: number): StatusOcupacao {
  if (ocupacao > 1.2) return 'sobrecarga';
  if (ocupacao > 1.0) return 'atencao';
  return 'ok';
}

function corFator(fator: number): string {
  if (fator > 1.5) return '#dc2626';
  if (fator > 1.0) return '#ea580c';
  return '#16a34a';
}

export function ColaboradorAlocacao({ derivado, clientes, periodo, onSalvarPct, salvando }: Props) {
  const { colaborador: c, funcao } = derivado;
  const atendidos = useMemo(() => funcao
    ? clientes.filter(cli => (cli[funcao] as string | undefined) === c.nome_colaborador)
    : [], [clientes, funcao, c.nome_colaborador]);

  // Estado local com pct editáveis indexados por nome_cliente.
  const [pcts, setPcts] = useState<Record<string, number>>(() => {
    const inicial: Record<string, number> = {};
    if (funcao) {
      for (const cli of atendidos) {
        const key = `pct_${funcao}` as keyof Cliente;
        inicial[cli.nome_cliente] = (cli[key] as number | undefined) ?? 0;
      }
    }
    return inicial;
  });

  const somaPct = Object.values(pcts).reduce((s, v) => s + v, 0);
  const ocupacao = c.percentual_alocavel > 0 ? somaPct / c.percentual_alocavel : 0;
  const status = statusDe(ocupacao);

  const handleSalvar = useCallback(async () => {
    if (!funcao) return;
    for (const [nome, valor] of Object.entries(pcts)) {
      const cli = atendidos.find(a => a.nome_cliente === nome);
      const pctOriginal = (cli?.[`pct_${funcao}` as keyof Cliente] as number | undefined) ?? 0;
      if (Math.abs(valor - pctOriginal) > 1e-6) {
        await onSalvarPct(nome, funcao, valor);
      }
    }
  }, [pcts, atendidos, funcao, onSalvarPct]);

  if (!funcao) {
    return <p className="text-sm py-4 italic" style={{ color: '#6b6b8a' }}>
      Função {c.funcao_principal} não mapeada — não é possível alocar clientes.
    </p>;
  }

  const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
  const TD = 'px-3 py-2 text-xs';

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#6b6b8a' }}>Período: {periodo}</p>

      {atendidos.length === 0 ? (
        <p className="text-sm py-4 italic" style={{ color: '#6b6b8a' }}>
          Nenhum cliente alocado em {c.funcao_principal}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
          <table className="min-w-full">
            <thead style={{ backgroundColor: '#f9f9fb' }}>
              <tr>
                <th className={`${TH} text-left`} style={{ color: '#6b6b8a' }}>Cliente</th>
                <th className={`${TH} text-left`} style={{ color: '#6b6b8a' }}>Pacote</th>
                <th className={`${TH} text-right`} style={{ color: '#6b6b8a' }}>% Dedicação</th>
                <th className={`${TH} text-right`} style={{ color: '#6b6b8a' }}>Horas efet.</th>
                <th className={`${TH} text-right`} style={{ color: '#6b6b8a' }}>Fator escopo</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
              {atendidos.map(cli => {
                const pct = pcts[cli.nome_cliente] ?? 0;
                const horasEfet = pct * HORAS_CLT_MES * c.percentual_alocavel;
                const horasPacote = HORAS_PACOTE[cli.pacote_servico]?.[funcao] ?? 0;
                const pctNorm = horasPacote / HORAS_CLT_MES;
                const fator = pctNorm > 0 ? pct / pctNorm : 0;
                return (
                  <tr key={cli.nome_cliente}>
                    <td className={TD} style={{ color: '#160F41' }}>{cli.nome_cliente}</td>
                    <td className={TD} style={{ color: '#6b6b8a' }}>{cli.pacote_servico}</td>
                    <td className={`${TD} text-right`}>
                      <input type="number" step="0.01" min={0} max={1} value={pct}
                        onChange={e => setPcts(p => ({ ...p, [cli.nome_cliente]: Number(e.target.value) }))}
                        className="w-20 rounded px-2 py-1 text-xs text-right"
                        style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
                    </td>
                    <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{horasEfet.toFixed(1)}h</td>
                    <td className={`${TD} text-right`}>
                      <span className="font-medium" style={{ color: corFator(fator) }}>{fator.toFixed(2)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
        <div className="flex items-center justify-between mb-2 text-xs">
          <span style={{ color: '#6b6b8a' }}>Capacidade alocável: {formatPercent(c.percentual_alocavel * 100)}</span>
          <span style={{ color: '#160F41' }}>Ocupação atual: {(somaPct * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#fff' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(ocupacao * 100, 200)}%`, backgroundColor: corBarraOcupacao(status) }} />
        </div>
        {ocupacao > 1.0 && (
          <p className="mt-2 flex items-center gap-1 text-[11px]" style={{ color: '#dc2626' }}>
            <AlertTriangle size={11} /> Soma de pct excede capacidade alocável do colaborador.
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={handleSalvar} disabled={salvando || atendidos.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
          {salvando && <Loader2 size={14} className="animate-spin" />}
          {salvando ? 'Salvando...' : 'Salvar Alocação'}
        </button>
      </div>
    </div>
  );
}
