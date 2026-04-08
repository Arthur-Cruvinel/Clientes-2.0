import { useApp } from '../../state/AppContext';

export function useProjecao() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
