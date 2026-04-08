import { useApp } from '../../state/AppContext';

export function useCenarios() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
