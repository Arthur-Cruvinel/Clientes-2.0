import { useApp } from '../../state/AppContext';

export function useCapacidade() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
