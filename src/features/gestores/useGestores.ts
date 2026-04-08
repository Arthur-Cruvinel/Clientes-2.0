import { useApp } from '../../state/AppContext';

export function useGestores() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
