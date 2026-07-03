import { PlaceholderModulo } from '../../components/ui/PlaceholderModulo';

export function Evolucao() {
  return (
    <PlaceholderModulo
      nome="Evolução"
      pergunta="O patrimônio do cliente está crescendo — e por quê? Financeiro e outros ativos, com a variação decomposta: aportes, rendimento, câmbio."
      origem={{ tipo: 'especificado', parte: 'V.5' }}
    />
  );
}
