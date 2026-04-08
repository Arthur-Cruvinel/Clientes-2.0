import { useApp } from '../../state/AppContext';

export function usePipeline() {
  const { dadosPeriodo, regime } = useApp();
  return { dadosPeriodo, regime };
}
