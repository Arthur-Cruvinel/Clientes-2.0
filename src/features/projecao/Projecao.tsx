import { PlaceholderModulo } from '../../components/ui/PlaceholderModulo';
import { MockupProjecao } from '../vitrine/mockups';

export function Projecao() {
  return (
    <PlaceholderModulo
      nome="Projeção"
      pergunta="Quanto a casa fatura até o período escolhido — os PLs da carteira crescendo e os fees dos pipes convertendo em receita."
      origem={{ tipo: 'novo' }}
      mockup={<MockupProjecao />}
    />
  );
}
