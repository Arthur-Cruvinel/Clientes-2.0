// --- Drill-down de capacidade de UM colaborador (reutilizável) ---
// Usado na seção 2 do módulo Capacidade e no painel embutido da Alocação
// em Lote. Mostra (opcional) barra de ocupação total + breakdown por função
// com tabela de clientes.
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { LABEL_FUNCAO, type ColaboradorCapacidade } from './useCapacidade';

function cor(ocup: number): string {
  if (ocup > 1.0) return '#dc2626';
  if (ocup >= 0.8) return '#ea580c';
  return '#16a34a';
}

interface Props { dado: ColaboradorCapacidade; mostrarBarraTotal?: boolean; }

export function CapacidadeDrillDown({ dado, mostrarBarraTotal = false }: Props) {
  const funcoes = FUNCOES_ALOCACAO.filter(f => dado.porFuncao[f]);
  return (
    <div className="space-y-3">
      {mostrarBarraTotal && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: '#6b6b8a' }}>Ocupação total</span>
            <span className="font-bold" style={{ color: cor(dado.ocupacaoPct) }}>{(dado.ocupacaoPct * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#eef0f4' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, dado.ocupacaoPct * 100)}%`, backgroundColor: cor(dado.ocupacaoPct) }} />
          </div>
          <p className="text-[10px] mt-1" style={{ color: '#9ca3af' }}>
            {dado.horasUsadas.toFixed(0)}h de {dado.horasDisponiveis.toFixed(0)}h disponíveis
          </p>
        </div>
      )}
      {funcoes.map(f => {
        const uso = dado.porFuncao[f]!;
        const pctFuncao = dado.horasDisponiveis > 0 ? (uso.horas / dado.horasDisponiveis) * 100 : 0;
        return (
          <div key={f} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium" style={{ color: '#160F41' }}>{LABEL_FUNCAO[f]}</span>
              <span style={{ color: '#6b6b8a' }}>{pctFuncao.toFixed(0)}% · {uso.horas.toFixed(1)}h</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px]">
                <tbody className="divide-y" style={{ borderColor: '#eef0f4' }}>
                  {uso.clientes.map(c => (
                    <tr key={c.nome}>
                      <td className="py-1 pr-2" style={{ color: '#160F41' }}>{c.nome}</td>
                      <td className="py-1 px-2" style={{ color: '#9ca3af' }}>{c.pacote}</td>
                      <td className="py-1 px-2 text-right" style={{ color: '#6b6b8a' }}>{(c.pct * 100).toFixed(1)}%</td>
                      <td className="py-1 pl-2 text-right" style={{ color: '#6b6b8a' }}>{c.horas.toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {funcoes.length === 0 && <p className="text-xs italic" style={{ color: '#6b6b8a' }}>Nenhum cliente alocado a este colaborador.</p>}
    </div>
  );
}
