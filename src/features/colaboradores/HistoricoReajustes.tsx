// --- Histórico de Reajustes Salariais (CLT) ---
// Log auditável SOMENTE LEITURA. Entradas são registradas automaticamente
// pelo FolhaTab ao salvar valores diferentes do baseline (vigente para o
// período). Aqui o usuário só pode EXCLUIR entradas não-vigentes para
// corrigir erros pontuais — não pode editar nem registrar manualmente.

import { Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { ReajusteSalarial } from '../../types';

interface Props {
  historico: ReajusteSalarial[];
  periodo: string;          // p/ destacar a entrada VIGENTE
  onChange: (novo: ReajusteSalarial[]) => void;
}

/** Replica buscarTetoPorPeriodo apenas para destaque visual da entrada
 *  vigente. Mantém a regra: maior vigencia <= periodo; fallback p/ 1ª. */
function vigenteParaPeriodo(historico: ReajusteSalarial[], periodo: string): string | null {
  if (!historico.length) return null;
  const ord = [...historico].sort((a, b) => a.vigencia.localeCompare(b.vigencia));
  let escolhida = ord[0];
  for (const r of ord) {
    if (r.vigencia <= periodo) escolhida = r;
    else break;
  }
  return escolhida.vigencia;
}

export function HistoricoReajustes({ historico, periodo, onChange }: Props) {
  const vigenciaAtiva = vigenteParaPeriodo(historico, periodo);
  const ordenadoDesc = [...historico].sort((a, b) => b.vigencia.localeCompare(a.vigencia));
  // INICIAL = entrada com a menor vigência do histórico (primeiro registro).
  const vigenciaInicial = ordenadoDesc.length > 0
    ? ordenadoDesc[ordenadoDesc.length - 1].vigencia
    : null;

  function excluir(vigenciaAlvo: string) {
    if (vigenciaAlvo === vigenciaAtiva) return;  // nunca excluir a vigente
    if (!window.confirm(`Remover registro de reajuste de ${vigenciaAlvo}?`)) return;
    onChange(historico.filter(r => r.vigencia !== vigenciaAlvo));
  }

  return (
    <section className="space-y-2 pt-2 border-t" style={{ borderColor: '#f3f4f6' }}>
      <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
        Histórico de Reajustes
      </h4>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: '#f9f9fb', color: '#6b6b8a' }}>
              <th className="px-2 py-1.5 text-left font-medium">Vigência</th>
              <th className="px-2 py-1.5 text-right font-medium">Teto CLT</th>
              <th className="px-2 py-1.5 text-right font-medium">Líquido</th>
              <th className="px-2 py-1.5 text-left font-medium">Observação</th>
              <th className="px-2 py-1.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {ordenadoDesc.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-[11px]" style={{ color: '#6b6b8a' }}>
                Nenhum reajuste registrado.
              </td></tr>
            )}
            {ordenadoDesc.map(r => {
              const ehVigente = r.vigencia === vigenciaAtiva;
              const ehInicial = r.vigencia === vigenciaInicial;
              return (
                <tr key={r.vigencia} className="border-t" style={{ borderColor: '#f3f4f6' }}>
                  <td className="px-2 py-1.5">
                    <span style={{ color: '#160F41' }}>{r.vigencia}</span>
                    {ehVigente && <Badge cor="#dcfce7" texto="#166534">Vigente</Badge>}
                    {ehInicial && <Badge cor="#fef9c3" texto="#854d0e">Inicial</Badge>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: '#160F41' }}>{formatCurrency(r.salario_teto_cargo)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: '#160F41' }}>{formatCurrency(r.liquido_acordado)}</td>
                  <td className="px-2 py-1.5" style={{ color: '#6b6b8a' }}>{r.observacao ?? '—'}</td>
                  <td className="px-1 py-1.5">
                    <button type="button" onClick={() => excluir(r.vigencia)} disabled={ehVigente}
                      title={ehVigente ? 'Não é possível excluir a entrada vigente' : 'Excluir'}
                      className="p-1 rounded disabled:opacity-30">
                      <Trash2 size={12} style={{ color: '#dc2626' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] italic" style={{ color: '#6b6b8a' }}>
        O histórico é atualizado automaticamente ao salvar alterações na folha.
      </p>
    </section>
  );
}

function Badge({ cor, texto, children }: { cor: string; texto: string; children: string }) {
  return <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ backgroundColor: cor, color: texto }}>{children}</span>;
}
