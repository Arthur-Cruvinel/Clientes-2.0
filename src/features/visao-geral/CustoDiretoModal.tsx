// --- Modal de detalhamento do Custo Direto (3 seções) ---

import { Modal } from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/formatters';
import type { DadosCliente, Parametros } from '../../types';

interface Props {
  cliente: DadosCliente;
  parametros: Parametros;
  onFechar: () => void;
}

const LABEL_FUNCAO: Record<string, string> = {
  consultoria_gestao: 'Consultoria Gestão',
  consultoria_planejamento: 'Consultoria Planejamento',
  consultoria_financeira: 'Consultoria Financeira',
  operacional_financeiro: 'Operacional Financeiro',
  serv_adm: 'Serviços Administrativos',
  serv_aux_adm: 'Aux. Administrativo',
};

const TH = 'px-3 py-2 text-xs font-bold uppercase tracking-wider text-left';
const TD = 'px-3 py-2 text-sm';

export function CustoDiretoModal({ cliente, onFechar }: Props) {
  const d = cliente.custo_direto_detalhe;

  if (cliente.pacote_servico === 'asset_only') {
    return (
      <Modal aberto onFechar={onFechar} titulo={`Custo Direto — ${cliente.nome_cliente}`}>
        <p className="text-sm" style={{ color: '#6b6b8a' }}>Nenhum custo direto — cliente pure asset.</p>
      </Modal>
    );
  }

  const totalGeral = d.total;

  return (
    <Modal aberto onFechar={onFechar} titulo={`Custo Direto — ${cliente.nome_cliente}`}>
      <div className="space-y-5">
        {/* Seção 1 — Mão de obra */}
        {d.linhasMaoDeObra.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>Mão de obra</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: '#f9f9fb' }}>
                  <tr>
                    <th className={TH}>Função</th>
                    <th className={TH}>Responsável</th>
                    <th className={`${TH} text-right`}>H. Dir.</th>
                    <th className={`${TH} text-right`}>Fator</th>
                    <th className={`${TH} text-right`}>H. Efet.</th>
                    <th className={`${TH} text-right`}>R$/h</th>
                    <th className={`${TH} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                  {d.linhasMaoDeObra.map((l, i) => (
                    <tr key={i}>
                      <td className={TD}>{LABEL_FUNCAO[l.funcao] ?? l.funcao}</td>
                      <td className={TD}>{l.responsavel}</td>
                      <td className={`${TD} text-right`}>{l.horasDireito > 0 ? `${l.horasDireito}h` : '—'}</td>
                      <td className={`${TD} text-right`}>{l.fator > 0 ? l.fator.toFixed(2) : '—'}</td>
                      <td className={`${TD} text-right`}>{l.horasEfetivas.toFixed(1)}h</td>
                      <td className={`${TD} text-right`}>{formatCurrency(l.custoHora)}</td>
                      <td className={`${TD} text-right font-medium`}>{formatCurrency(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ backgroundColor: '#f3f4f6' }}>
                  <td colSpan={6} className={`${TD} font-bold`}>Subtotal mão de obra</td>
                  <td className={`${TD} text-right font-bold`}>{formatCurrency(d.maoDeObra)}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Seção 2 — Serviços externos */}
        {(d.juridico > 0 || d.conciliacao > 0) && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>Serviços externos</p>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr><th className={TH}>Serviço</th><th className={TH}>Base de rateio</th><th className={`${TH} text-right`}>Valor</th></tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {d.juridico > 0 && (
                  <tr>
                    <td className={TD}>Jurídico</td>
                    <td className={TD} style={{ color: '#6b6b8a' }}>Peso {(cliente.peso_juridico ?? 1.0).toFixed(1)}</td>
                    <td className={`${TD} text-right font-medium`}>{formatCurrency(d.juridico)}</td>
                  </tr>
                )}
                {d.conciliacao > 0 && (
                  <tr>
                    <td className={TD}>Conciliação</td>
                    <td className={TD} style={{ color: '#6b6b8a' }}>{cliente.volume_movimentos_mes ?? 0} mov</td>
                    <td className={`${TD} text-right font-medium`}>{formatCurrency(d.conciliacao)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Seção 3 — Custos dedicados */}
        {(d.contabilidade > 0 || d.pagamento > 0 || d.administrativo > 0) && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>Custos dedicados</p>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr><th className={TH}>Descrição</th><th className={`${TH} text-right`}>Valor</th></tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {d.contabilidade > 0 && <tr><td className={TD}>Contabilidade</td><td className={`${TD} text-right font-medium`}>{formatCurrency(d.contabilidade)}</td></tr>}
                {d.pagamento > 0 && <tr><td className={TD}>Plataforma Tempo</td><td className={`${TD} text-right font-medium`}>{formatCurrency(d.pagamento)}</td></tr>}
                {d.administrativo > 0 && <tr><td className={TD}>Administrativo</td><td className={`${TD} text-right font-medium`}>{formatCurrency(d.administrativo)}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Total geral */}
        <div className="flex justify-between items-center px-3 py-3 rounded-lg" style={{ backgroundColor: '#f3f4f6' }}>
          <span className="text-sm font-bold" style={{ color: '#160F41' }}>TOTAL CUSTO DIRETO</span>
          <span className="text-sm font-bold" style={{ color: '#160F41' }}>{formatCurrency(totalGeral)}</span>
        </div>
      </div>
    </Modal>
  );
}
