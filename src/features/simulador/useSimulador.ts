import { useApp } from '../../state/AppContext';

export function useSimulador() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
