// --- Abas de VITRINE do Perfil do Cliente (placeholders) ---
// Visão 360 (abertura): esqueleto estático de dashboard — 5 cards com frase + badge.
// Pedido de Aporte / Relatório Mensal: placeholders de documento. Sem dados/lógica.

import { PlaceholderModulo } from '../../components/ui/PlaceholderModulo';

const CARDS_360: { titulo: string; frase: string; badge: string }[] = [
  { titulo: 'Fluxo de Caixa', badge: 'integra Automação Bancária',
    frase: 'Entradas e saídas do mês, classificadas — o caixa do cliente sem planilha.' },
  { titulo: 'Patrimônio', badge: 'integra Patrimônio/Evolução',
    frase: 'Financeiro e outros ativos, com a variação do mês decomposta.' },
  { titulo: 'Tarefas', badge: 'integra Tarefas/Agente WhatsApp',
    frase: 'Em andamento, pendentes e concluídas — o que a casa está fazendo por este cliente, agora.' },
  { titulo: 'Crédito', badge: 'Parte V.11',
    frase: 'Score, tendência e eventos — a saúde de crédito do cliente vigiada antes do problema, não depois.' },
  { titulo: 'Linha do Tempo', badge: 'Novo',
    frase: 'A história do cliente numa tela — entrada, propostas, aditivos, extraordinários, aportes.' },
];

export function Visao360Tab() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm font-bold" style={{ color: '#160F41' }}>Dashboard 360</p>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide"
          style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>Em construção</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARDS_360.map(c => (
          <div key={c.titulo} className="rounded-lg border p-4" style={{ borderColor: '#e2e2e8', background: 'linear-gradient(180deg,#f8fbff,#ffffff)' }}>
            <p className="text-sm font-bold" style={{ color: '#160F41' }}>{c.titulo}</p>
            <p className="text-sm mt-1 leading-snug" style={{ color: '#4B5563' }}>{c.frase}</p>
            <span className="inline-block mt-3 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: '#f0f6ff', color: '#0065FF' }}>{c.badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PedidoAporteTab() {
  return (
    <PlaceholderModulo nome="Pedido de Aporte" origem={{ tipo: 'novo' }}
      pergunta="As despesas do mês pagas pela casa, detalhadas — e o pedido de recursos do mês seguinte. Do envio à confirmação do aporte na conta: um ciclo com status, não uma troca de mensagens. Gerado pelo mesmo motor das propostas, entregue pelo WhatsApp." />
  );
}

export function RelatorioMensalTab() {
  return (
    <PlaceholderModulo nome="Relatório Mensal" origem={{ tipo: 'novo' }}
      pergunta="O fechamento do mês do cliente: receitas e despesas do mês e do acumulado do ano, posição patrimonial e o realizado contra o plano — um documento desenhado para a família ler, no padrão institucional da casa, direto no WhatsApp." />
  );
}
