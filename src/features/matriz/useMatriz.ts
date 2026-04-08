import { useApp } from '../../state/AppContext';

export function useMatriz() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
