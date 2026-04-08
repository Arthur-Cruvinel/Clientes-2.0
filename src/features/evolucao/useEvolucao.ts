import { useApp } from '../../state/AppContext';

export function useEvolucao() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
