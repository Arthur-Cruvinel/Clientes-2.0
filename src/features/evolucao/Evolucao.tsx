import { PlaceholderModulo } from '../../components/ui/PlaceholderModulo';
import { MockupEvolucao } from '../vitrine/mockups';

export function Evolucao() {
  return (
    <PlaceholderModulo
      nome="Evolução"
      pergunta="O patrimônio do cliente está crescendo — e por quê? Financeiro e outros ativos, com a variação decomposta: aportes, rendimento, câmbio."
      origem={{ tipo: 'especificado', parte: 'V.5' }}
      mockup={<MockupEvolucao />}
    />
  );
}
