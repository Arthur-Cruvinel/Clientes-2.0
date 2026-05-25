// --- Aba Capacidade — ocupação por colaborador, absorção por pacote, simulador ---
import { useCapacidade } from './useCapacidade';
import { CapacidadeColaboradores } from './CapacidadeColaboradores';
import { CapacidadeAbsorcao } from './CapacidadeAbsorcao';

export function Capacidade() {
  const { porColaborador, absorcaoPorPacote, simular, loading } = useCapacidade();

  if (loading) {
    return <div className="p-8 text-center" style={{ color: '#6b6b8a' }}>Carregando dados...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold" style={{ color: '#160F41' }}>Capacidade</h2>
      <CapacidadeColaboradores dados={porColaborador} />
      <CapacidadeAbsorcao absorcao={absorcaoPorPacote} simular={simular} />
    </div>
  );
}
