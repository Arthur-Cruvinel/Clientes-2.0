// --- Aba Capacidade — ocupação por colaborador, absorção por pacote, simulador ---
import { useCapacidade } from './useCapacidade';
import { CapacidadeColaboradores } from './CapacidadeColaboradores';
import { CapacidadeExcesso } from './CapacidadeExcesso';
import { CapacidadeLivreColaborador } from './CapacidadeLivreColaborador';
import { CapacidadeAbsorcao } from './CapacidadeAbsorcao';

export function Capacidade() {
  const { porColaborador, excessoPorColaborador, capacidadeLivrePorColaborador, absorcaoPorPacote, simular, loading } = useCapacidade();

  if (loading) {
    return <div className="p-8 text-center" style={{ color: '#6b6b8a' }}>Carregando dados...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold" style={{ color: '#160F41' }}>Capacidade</h2>
      <CapacidadeColaboradores dados={porColaborador} />
      <CapacidadeExcesso dados={excessoPorColaborador} />
      <CapacidadeLivreColaborador dados={capacidadeLivrePorColaborador} />
      <CapacidadeAbsorcao absorcao={absorcaoPorPacote} simular={simular} />
    </div>
  );
}
