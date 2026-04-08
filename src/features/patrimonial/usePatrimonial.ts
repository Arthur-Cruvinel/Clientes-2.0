import { useApp } from '../../state/AppContext';

export function usePatrimonial() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
