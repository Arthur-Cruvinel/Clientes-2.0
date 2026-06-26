// --- Seção "Excesso por colaborador" do módulo Capacidade (Frente 1, Mov. 3) ---
// Responde à Pergunta 2: "qual colaborador gasta, num cliente, o tempo que
// faltava para outro?". Por colaborador, lista os clientes onde ele super-serve
// (REAL > ESPERADO na sua função principal), ordenados do maior excesso ao menor.
// REAL/ESPERADO/EXCESSO vêm prontos do hook (useCapacidade.excessoPorColaborador).
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ExcessoColaborador } from './useCapacidade';

const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-right';
const TD = 'px-3 py-2 text-xs text-right';

function corExcesso(h: number): string {
  if (h > 10) return '#dc2626';   // vermelho — desvio grande
  if (h > 3) return '#ea580c';    // laranja — desvio moderado
  return '#160F41';
}

export function CapacidadeExcesso({ dados }: { dados: ExcessoColaborador[] }) {
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const toggle = (nome: string) => setFechados(prev => {
    const n = new Set(prev);
    if (n.has(nome)) n.delete(nome); else n.add(nome);
    return n;
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>Excesso por colaborador</h3>
        <p className="text-[11px]" style={{ color: '#6b6b8a' }}>
          Clientes em que o colaborador dedica MAIS horas do que a demanda de volume da sua
          função pede (REAL &gt; ESPERADO). É a capacidade que poderia faltar a outro cliente.
        </p>
      </div>

      {dados.length === 0 && (
        <p className="text-sm italic" style={{ color: '#6b6b8a' }}>
          Nenhum colaborador com excesso no período.
        </p>
      )}

      {dados.map(d => {
        const nome = d.colaborador.nome_colaborador;
        const colapsado = fechados.has(nome);
        return (
          <div key={nome} className="rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
            <button type="button" onClick={() => toggle(nome)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-t-lg"
              style={{ backgroundColor: '#f9f9fb', color: '#160F41' }}>
              <span className="text-xs font-semibold">
                {nome} <span style={{ color: '#9ca3af' }}>· {d.label} · {d.itens.length} cliente{d.itens.length === 1 ? '' : 's'}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: corExcesso(d.totalExcesso) }}>
                  +{d.totalExcesso.toFixed(1)}h
                </span>
                {colapsado ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </span>
            </button>

            {!colapsado && (
              <table className="min-w-full">
                <thead style={{ color: '#6b6b8a' }}>
                  <tr>
                    <th className={`${TH} text-left`} style={{ textAlign: 'left' }}>Cliente</th>
                    <th className={`${TH} text-left`} style={{ textAlign: 'left' }}>Pacote</th>
                    <th className={TH} title="Horas que o colaborador dedica ao cliente (pct efetivo × horas alocáveis)">Real</th>
                    <th className={TH} title="Demanda de volume da função para o cliente (calcularHorasReais; sem perfil → pacote)">Esperado</th>
                    <th className={TH} title="Real − Esperado">Excesso</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                  {d.itens.map(it => (
                    <tr key={it.nome_cliente}>
                      <td className={`${TD} text-left`} style={{ textAlign: 'left', color: '#160F41' }}>{it.nome_cliente}</td>
                      <td className={`${TD} text-left`} style={{ textAlign: 'left', color: '#6b6b8a' }}>{it.pacote}</td>
                      <td className={TD} style={{ color: '#6b6b8a' }}>{it.real.toFixed(1)}h</td>
                      <td className={TD} style={{ color: '#6b6b8a' }}>{it.esperado.toFixed(1)}h</td>
                      <td className={`${TD} font-medium`} style={{ color: corExcesso(it.excesso) }}>+{it.excesso.toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
