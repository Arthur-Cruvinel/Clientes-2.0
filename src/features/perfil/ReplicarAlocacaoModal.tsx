// --- Modal: replicar alocação (vínculos pct>0) do período atual p/ outros ---
// Semântica ADITIVA: aplica só vínculos com pct>0 da origem; pares onde a
// origem tem 0 não são tocados (preserva alocação do destino).
import { useState, useEffect } from 'react';
import { Loader2, Copy } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { listarPeriodosComVinculos, replicarVinculos } from '../../services/firebase';

interface Props { periodoOrigem: string; onFechar: () => void; }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function rotulo(p: string): string {
  const [a, m] = p.split('-').map(Number);
  return m >= 1 && m <= 12 ? `${MESES[m - 1]}/${a}` : p;
}

type Estado = 'selecionando' | 'replicando' | 'concluido';

export function ReplicarAlocacaoModal({ periodoOrigem, onFechar }: Props) {
  const [periodos, setPeriodos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [destinos, setDestinos] = useState<Set<string>>(new Set());
  const [estado, setEstado] = useState<Estado>('selecionando');
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<{ porDestino: Record<string, { atualizados: number; criados: number }>; erros: string[] } | null>(null);

  useEffect(() => {
    listarPeriodosComVinculos()
      .then(ps => setPeriodos(ps.filter(p => p !== periodoOrigem)))
      .catch(() => setPeriodos([]))
      .finally(() => setCarregando(false));
  }, [periodoOrigem]);

  const toggle = (p: string) => setDestinos(prev => {
    const n = new Set(prev);
    if (n.has(p)) n.delete(p); else n.add(p);
    return n;
  });

  const replicar = async () => {
    if (destinos.size === 0) return;
    setEstado('replicando'); setProgresso(0);
    try {
      const r = await replicarVinculos(periodoOrigem, [...destinos], (_, pct) => setProgresso(pct));
      setResultado(r);
    } catch (e) {
      setResultado({ porDestino: {}, erros: [e instanceof Error ? e.message : 'falha ao replicar'] });
    }
    setEstado('concluido');
  };

  return (
    <Modal aberto onFechar={onFechar} titulo="Replicar alocação para outros períodos">
      <div className="space-y-4 text-sm">
        <p style={{ color: '#6b6b8a' }}>
          Copia os vínculos com <strong>% de dedicação &gt; 0</strong> de{' '}
          <strong style={{ color: '#160F41' }}>{rotulo(periodoOrigem)}</strong> para os períodos selecionados.
          Pares sem alocação na origem não são alterados no destino (modo aditivo).
        </p>

        {estado === 'selecionando' && (
          <>
            {carregando ? (
              <p className="flex items-center gap-2" style={{ color: '#6b6b8a' }}><Loader2 size={14} className="animate-spin" /> Carregando períodos...</p>
            ) : periodos.length === 0 ? (
              <p className="italic" style={{ color: '#6b6b8a' }}>Nenhum outro período com vínculos disponível.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {periodos.map(p => (
                  <label key={p} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
                    style={{ border: `1px solid ${destinos.has(p) ? '#0065FF' : '#e2e2e8'}`, backgroundColor: destinos.has(p) ? '#f5f8ff' : '#fff' }}>
                    <input type="checkbox" checked={destinos.has(p)} onChange={() => toggle(p)} />
                    <span style={{ color: '#160F41' }}>{rotulo(p)}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onFechar} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
              <button type="button" onClick={replicar} disabled={destinos.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand disabled:opacity-40">
                <Copy size={12} /> Replicar para {destinos.size} período{destinos.size === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}

        {estado === 'replicando' && (
          <div className="space-y-2">
            <p className="flex items-center gap-2" style={{ color: '#160F41' }}><Loader2 size={14} className="animate-spin" /> Replicando... {progresso}%</p>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#eef0f4' }}>
              <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        )}

        {estado === 'concluido' && resultado && (
          <div className="space-y-2">
            {Object.entries(resultado.porDestino).map(([p, c]) => (
              <p key={p} style={{ color: '#160F41' }}>
                <strong>{rotulo(p)}</strong>: {c.atualizados} atualizado{c.atualizados === 1 ? '' : 's'}, {c.criados} criado{c.criados === 1 ? '' : 's'}.
              </p>
            ))}
            {resultado.erros.map((e, i) => <p key={i} style={{ color: '#dc2626' }}>{e}</p>)}
            {Object.keys(resultado.porDestino).length === 0 && resultado.erros.length === 0 && (
              <p className="italic" style={{ color: '#6b6b8a' }}>Nada a replicar.</p>
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={onFechar} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
