// --- Aba Gestores: economia por gestor ("o gestor se paga?") ---
// Tabela de cobertura por gestor + drill-down da carteira. Capacidade aqui é
// só um resumo magro (ocupação %) — a análise profunda fica na aba Capacidade.

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useGestores, type GestorRow } from './useGestores';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatPercent, formatPeriodo } from '../../utils/formatters';

const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
const TD = 'px-3 py-2 text-sm';

export function Gestores() {
  const { resumo, periodoSelecionado, loading } = useGestores();
  const [sel, setSel] = useState<GestorRow | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#160F41' }}>
          <Users size={20} /> Gestores
          {periodoSelecionado && <span className="text-base font-normal" style={{ color: '#6b6b8a' }}>— {formatPeriodo(periodoSelecionado)}</span>}
        </h2>
      </div>
      <p className="text-xs" style={{ color: '#6b6b8a' }}>
        Cobertura = (EBITDA da carteira + custo do gestor já alocado nela) ÷ custo total
        do gestor. ≥ 100% → o gestor se paga.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: '#6b6b8a' }}>Carregando…</p>
      ) : resumo.rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center" style={{ borderColor: '#fbbf24', backgroundColor: '#fffbeb' }}>
          <p className="text-sm" style={{ color: '#92400e' }}>Nenhum gestor com carteira no período.</p>
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr style={{ color: '#6b6b8a' }}>
                  <th className={`${TH} text-left`}>Gestor</th>
                  <th className={`${TH} text-right`}>Nº cli.</th>
                  <th className={`${TH} text-right`}>Receita carteira</th>
                  <th className={`${TH} text-right`}>EBITDA carteira</th>
                  <th className={`${TH} text-right`}>Custo alocado</th>
                  <th className={`${TH} text-right`}>Custo total</th>
                  <th className={`${TH} text-right`}>Margem antes</th>
                  <th className={`${TH} text-right`}>Cobertura</th>
                  <th className={`${TH} text-right`}>Ocup.</th>
                  <th className={`${TH} text-center`}>Veredito</th>
                </tr>
              </thead>
              <tbody>
                {resumo.rows.map(g => (
                  <tr key={g.id_estavel} className="border-t cursor-pointer hover:bg-gray-50" style={{ borderColor: '#e2e2e8' }} onClick={() => setSel(g)}>
                    <td className={`${TD} font-medium`} style={{ color: '#160F41' }}>{g.nome}</td>
                    <td className={`${TD} text-right`}>{g.nClientes}</td>
                    <td className={`${TD} text-right`}>{formatCurrency(g.receitaCarteira)}</td>
                    <td className={`${TD} text-right`} style={{ color: g.ebitdaCarteira >= 0 ? '#166534' : '#991b1b' }}>{formatCurrency(g.ebitdaCarteira)}</td>
                    <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatCurrency(g.custoAlocado)}</td>
                    <td className={`${TD} text-right`}>{formatCurrency(g.custoTotal)}</td>
                    <td className={`${TD} text-right`} style={{ color: g.margemAntes >= 0 ? '#166534' : '#991b1b' }}>{formatCurrency(g.margemAntes)}</td>
                    <td className={`${TD} text-right font-bold`} style={{ color: g.sePaga ? '#166534' : '#991b1b' }}>{formatPercent(g.cobertura * 100)}</td>
                    <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatPercent(g.ocupacao * 100)}</td>
                    <td className={`${TD} text-center`}>
                      <Badge variante={g.sePaga ? 'sucesso' : 'alerta'}>{g.sePaga ? 'Se paga' : 'Não se paga'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            {resumo.rows.length} gestores · {resumo.clientesEmCarteira} clientes em carteira ·
            {' '}{resumo.clientesSemGestor} sem gestor · {resumo.universo} no universo da tela.
            Ocupação é resumo — análise de capacidade fica na aba Capacidade.
          </p>
        </>
      )}

      {sel && (
        <Modal aberto onFechar={() => setSel(null)} titulo={`Carteira — ${sel.nome}`} largura="4xl">
          <div className="space-y-3">
            <p className="text-sm" style={{ color: '#6b6b8a' }}>
              Cobertura <strong style={{ color: sel.sePaga ? '#166534' : '#991b1b' }}>{formatPercent(sel.cobertura * 100)}</strong>
              {' '}· margem antes do gestor {formatCurrency(sel.margemAntes)} ÷ custo total {formatCurrency(sel.custoTotal)}.
            </p>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr style={{ color: '#6b6b8a' }}>
                  <th className={`${TH} text-left`}>Cliente</th>
                  <th className={`${TH} text-right`}>% dedic.</th>
                  <th className={`${TH} text-right`}>Receita</th>
                  <th className={`${TH} text-right`}>EBITDA</th>
                  <th className={`${TH} text-right`}>Custo alocado</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {sel.carteira.map(c => (
                  <tr key={c.nome}>
                    <td className={TD} style={{ color: '#160F41' }}>{c.nome}</td>
                    <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatPercent(c.pct * 100)}</td>
                    <td className={`${TD} text-right`}>{formatCurrency(c.receita)}</td>
                    <td className={`${TD} text-right`} style={{ color: c.ebitda >= 0 ? '#166534' : '#991b1b' }}>{formatCurrency(c.ebitda)}</td>
                    <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatCurrency(c.custoAlocado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <td className={`${TD} font-bold`} colSpan={2} style={{ color: '#160F41' }}>{sel.nClientes} clientes</td>
                  <td className={`${TD} text-right font-bold`}>{formatCurrency(sel.receitaCarteira)}</td>
                  <td className={`${TD} text-right font-bold`}>{formatCurrency(sel.ebitdaCarteira)}</td>
                  <td className={`${TD} text-right font-bold`}>{formatCurrency(sel.custoAlocado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
