import { useApp } from '../../state/AppContext';

export function Risco() {
  const { loading } = useApp();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text">Risco</h2>
      <div className="bg-card rounded-lg border border-border p-8 text-center text-text-muted">
        {loading ? <p>Carregando dados...</p> : <p>Em construção</p>}
      </div>
    </div>
  );
}
