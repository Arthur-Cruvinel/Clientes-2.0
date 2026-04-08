import { useApp } from '../../state/AppContext';

export function useRisco() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
