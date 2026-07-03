// --- Abas de VITRINE do Perfil do Cliente (dashboard + documentos, mockup) ---
// Visão 360 (abertura): dashboard fake 2×3 com números + mini-visuais.
// Crédito: aba própria (score + Serasa + alerta). Pedido de Aporte / Relatório
// Mensal: mockups de documento. TODOS os dados FICTÍCIOS. Presentation-only.

import type { ReactNode } from 'react';
import { PlaceholderModulo } from '../../components/ui/PlaceholderModulo';
import { SeloIlustrativo, MockupModulo } from '../../components/ui/MockupModulo';
import { MockupRelatorio } from '../vitrine/mockups';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts';

const AZUL = '#0065FF', VERDE = '#166534', VERMELHO = '#991b1b', AMBAR = '#b45309';

function Card360({ titulo, badge, children, onClick }: { titulo: string; badge: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div className={`rounded-lg border p-4 ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
      onClick={onClick} style={{ borderColor: '#e2e2e8', background: 'linear-gradient(180deg,#f8fbff,#ffffff)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold" style={{ color: '#160F41' }}>{titulo}</p>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: '#f0f6ff', color: '#0065FF' }}>{badge}</span>
      </div>
      {children}
    </div>
  );
}

export function Visao360Tab({ onIrCredito }: { onIrCredito?: () => void }) {
  const spark = [11.8, 12.0, 12.3, 12.6, 12.9, 13.1, 13.3, 13.5, 13.7, 13.9, 14.0, 14.2].map((v, i) => ({ i, v }));
  const barras3 = [{ m: 'Abr', e: 175, s: 140 }, { m: 'Mai', e: 181, s: 152 }, { m: 'Jun', e: 187, s: 143 }];
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm font-bold" style={{ color: '#160F41' }}>Dashboard 360</p>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide"
          style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>Em construção</span>
        <SeloIlustrativo />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card360 titulo="Fluxo de Caixa" badge="Automação Bancária">
          <div className="flex items-center gap-4 mb-2">
            <div><p className="text-[10px]" style={{ color: '#6b6b8a' }}>Entradas</p><p className="text-sm font-bold" style={{ color: VERDE }}>R$ 187 mil</p></div>
            <div><p className="text-[10px]" style={{ color: '#6b6b8a' }}>Saídas</p><p className="text-sm font-bold" style={{ color: VERMELHO }}>R$ 143 mil</p></div>
          </div>
          <ResponsiveContainer width="100%" height={44}>
            <BarChart data={barras3} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Bar dataKey="e" fill={VERDE} radius={[2, 2, 0, 0]} /><Bar dataKey="s" fill={VERMELHO} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card360>

        <Card360 titulo="Patrimônio" badge="Patrimônio/Evolução">
          <p className="text-lg font-bold" style={{ color: '#160F41' }}>R$ 14,2 M <span className="text-[11px] font-medium" style={{ color: VERDE }}>↗ +2,1%</span></p>
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={spark} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <Line type="monotone" dataKey="v" stroke={AZUL} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card360>

        <Card360 titulo="Tarefas" badge="Tarefas/Agente">
          <div className="flex gap-4 mb-1">
            <span className="text-lg font-bold" style={{ color: AZUL }}>3<span className="text-[10px] font-normal" style={{ color: '#6b6b8a' }}> em andamento</span></span>
            <span className="text-lg font-bold" style={{ color: AMBAR }}>1<span className="text-[10px] font-normal" style={{ color: '#6b6b8a' }}> pendente</span></span>
          </div>
          <ul className="text-[11px] space-y-0.5" style={{ color: '#4B5563' }}>
            <li>· Revisão contratual — Jurídico</li>
            <li>· Aporte mensal — Financeiro</li>
          </ul>
        </Card360>

        <Card360 titulo="Crédito" badge="Parte V.11" onClick={onIrCredito}>
          <p className="text-lg font-bold" style={{ color: '#160F41' }}>745 <span className="text-[11px]" style={{ color: VERDE }}>↗</span></p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: '#dcfce7', color: VERDE }}>sem alertas ativos</span>
          <p className="text-[10px] mt-2" style={{ color: '#0065FF' }}>ver detalhes →</p>
        </Card360>

        <Card360 titulo="Linha do Tempo" badge="Novo">
          <ul className="space-y-1 text-[11px]" style={{ color: '#4B5563' }}>
            <li>· 2023 — Entrada na carteira</li>
            <li>· mai/25 — Aditivo de escopo</li>
            <li>· fev/26 — M&A concluído</li>
            <li>· jun/26 — Aporte confirmado</li>
          </ul>
        </Card360>

        <Card360 titulo="Plano Financeiro" badge="Parte V.1">
          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium mb-1" style={{ backgroundColor: '#dcfce7', color: VERDE }}>No plano ✓</span>
          <p className="text-[12px]" style={{ color: '#160F41' }}>Superávit do mês <strong>R$ 84 mil</strong> vs. R$ 78 mil planejado.</p>
        </Card360>
      </div>
    </div>
  );
}

export function CreditoTab() {
  const trend = [740, 741, 739, 742, 744, 745].map((v, i) => ({ i, v }));
  const serasa: [string, string, string][] = [
    ['Consulta ao CPF', '12/06', 'info'],
    ['Protestos', '—', 'nenhum'],
    ['Negativações', '—', 'nenhuma'],
    ['Ações judiciais', '—', 'nenhuma'],
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold" style={{ color: '#160F41' }}>Saúde de crédito</p>
        <SeloIlustrativo />
      </div>

      <div className="rounded-lg border p-4 flex items-center gap-6" style={{ borderColor: '#e2e2e8' }}>
        <div>
          <p className="text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Score</p>
          <p className="text-3xl font-extrabold" style={{ color: '#160F41' }}>745 <span className="text-sm" style={{ color: VERDE }}>↗</span></p>
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={trend} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <Line type="monotone" dataKey="v" stroke={AZUL} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px]" style={{ color: '#6b6b8a' }}>6 meses — estável, leve alta</p>
        </div>
      </div>

      <div className="rounded-lg p-2" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
        <span className="text-[11px] font-medium" style={{ color: AMBAR }}>⚠ 2 consultas ao CPF em 30 dias — padrão atípico, acompanhar.</span>
      </div>

      <table className="min-w-full text-sm">
        <thead style={{ backgroundColor: '#f9f9fb' }}>
          <tr>{['Evento', 'Data', 'Severidade'].map((c, i) => (
            <th key={i} className={`px-2 py-1.5 text-[10px] font-bold uppercase ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: '#6b6b8a' }}>{c}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
          {serasa.map(([ev, dt, sev], r) => (
            <tr key={r}>
              <td className="px-2 py-1.5" style={{ color: '#160F41' }}>{ev}</td>
              <td className="px-2 py-1.5 text-right" style={{ color: '#6b6b8a' }}>{dt}</td>
              <td className="px-2 py-1.5 text-right" style={{ color: sev === 'info' ? AMBAR : '#6b6b8a' }}>{sev}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: '#f0f6ff', color: '#0065FF' }}>
        Especificado — Parte V.11 do documento
      </span>
    </div>
  );
}

export function PedidoAporteTab() {
  return (
    <PlaceholderModulo nome="Pedido de Aporte" origem={{ tipo: 'novo' }}
      pergunta="As despesas do mês pagas pela casa, detalhadas — e o pedido de recursos do mês seguinte. Do envio à confirmação do aporte na conta: um ciclo com status, não uma troca de mensagens. Gerado pelo mesmo motor das propostas, entregue pelo WhatsApp."
      mockup={
        <MockupModulo grafico={
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
              <div className="px-4 py-2" style={{ background: 'linear-gradient(135deg,#160F41,#2F49EE)' }}>
                <span className="text-white text-sm font-bold">Pedido de Aporte — Jun/2026</span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Despesas pagas no mês — R$ 143 mil</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[['Folha doméstica', 'R$ 38 mil'], ['Imóveis', 'R$ 27 mil'], ['Cartões', 'R$ 22 mil']].map(([c, v]) => (
                      <span key={c} className="px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: '#f9f9fb', color: '#160F41' }}>{c}: {v}</span>
                    ))}
                  </div>
                </div>
                <div className="pt-1 border-t" style={{ borderColor: '#f3f4f6' }}>
                  <p className="text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Pedido para o próximo mês</p>
                  <p className="text-lg font-bold" style={{ color: '#160F41' }}>R$ 150 mil</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[['Enviado', true], ['Aprovado', true], ['Aporte confirmado', false]].map(([et, ok], i) => (
                <div key={et as string} className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
                    style={{ backgroundColor: ok ? '#dcfce7' : '#f3f4f6', color: ok ? VERDE : '#6b6b8a' }}>
                    {ok ? '✓' : '○'} {et}
                  </span>
                  {i < 2 && <span style={{ color: '#9ca3af' }}>→</span>}
                </div>
              ))}
            </div>
          </div>
        } />
      } />
  );
}

export function RelatorioMensalTab() {
  return (
    <PlaceholderModulo nome="Relatório Mensal" origem={{ tipo: 'novo' }}
      pergunta="O fechamento do mês do cliente: receitas e despesas do mês e do acumulado do ano, posição patrimonial e o realizado contra o plano — um documento desenhado para a família ler, no padrão institucional da casa, direto no WhatsApp."
      mockup={<MockupRelatorio />} />
  );
}
