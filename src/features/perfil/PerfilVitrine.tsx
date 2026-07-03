// --- Abas de VITRINE do Perfil do Cliente (placeholders com mockup) ---
// Visão 360 (abertura): dashboard fake — 5 cards com conteúdo ilustrativo.
// Pedido de Aporte: placeholder de documento (só frase).
// Relatório Mensal: mockup de documento institucional. Sem dados reais/lógica.

import type { ReactNode } from 'react';
import { PlaceholderModulo } from '../../components/ui/PlaceholderModulo';
import { SeloIlustrativo } from '../../components/ui/MockupModulo';
import { MockupRelatorio } from '../vitrine/mockups';

function Card({ titulo, badge, children }: { titulo: string; badge: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: '#e2e2e8', background: 'linear-gradient(180deg,#f8fbff,#ffffff)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold" style={{ color: '#160F41' }}>{titulo}</p>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: '#f0f6ff', color: '#0065FF' }}>{badge}</span>
      </div>
      {children}
    </div>
  );
}

export function Visao360Tab() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm font-bold" style={{ color: '#160F41' }}>Dashboard 360</p>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide"
          style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>Em construção</span>
        <SeloIlustrativo />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card titulo="Fluxo de Caixa" badge="integra Automação Bancária">
          <div className="flex items-center gap-4">
            <div><p className="text-[10px]" style={{ color: '#6b6b8a' }}>Entradas</p><p className="text-sm font-bold" style={{ color: '#166534' }}>R$ 187 mil</p></div>
            <div><p className="text-[10px]" style={{ color: '#6b6b8a' }}>Saídas</p><p className="text-sm font-bold" style={{ color: '#991b1b' }}>R$ 143 mil</p></div>
          </div>
          <div className="mt-2 h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: '#eee' }}>
            <div style={{ width: '57%', backgroundColor: '#166534' }} /><div style={{ width: '43%', backgroundColor: '#991b1b' }} />
          </div>
        </Card>

        <Card titulo="Patrimônio" badge="integra Patrimônio/Evolução">
          <p className="text-lg font-bold" style={{ color: '#160F41' }}>R$ 14,2 M</p>
          <p className="text-[11px] font-medium" style={{ color: '#166534' }}>↗ +2,1% no mês</p>
        </Card>

        <Card titulo="Tarefas" badge="integra Tarefas/Agente WhatsApp">
          <div className="flex gap-4">
            <div><p className="text-lg font-bold" style={{ color: '#0065FF' }}>3</p><p className="text-[10px]" style={{ color: '#6b6b8a' }}>em andamento</p></div>
            <div><p className="text-lg font-bold" style={{ color: '#b45309' }}>1</p><p className="text-[10px]" style={{ color: '#6b6b8a' }}>pendente</p></div>
          </div>
        </Card>

        <Card titulo="Crédito" badge="Parte V.11">
          <p className="text-lg font-bold" style={{ color: '#160F41' }}>745 <span className="text-[11px]" style={{ color: '#166534' }}>↗</span></p>
          <p className="text-[10px]" style={{ color: '#6b6b8a' }}>score · tendência de alta</p>
        </Card>

        <Card titulo="Linha do Tempo" badge="Novo">
          <ul className="space-y-1 text-[11px]" style={{ color: '#4B5563' }}>
            <li>· Jul/2025 — Entrada na carteira</li>
            <li>· Set/2025 — Proposta Full aceita</li>
            <li>· Jan/2026 — Aditivo de escopo</li>
            <li>· Mai/2026 — Aporte offshore</li>
          </ul>
        </Card>
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
      pergunta="O fechamento do mês do cliente: receitas e despesas do mês e do acumulado do ano, posição patrimonial e o realizado contra o plano — um documento desenhado para a família ler, no padrão institucional da casa, direto no WhatsApp."
      mockup={<MockupRelatorio />} />
  );
}
