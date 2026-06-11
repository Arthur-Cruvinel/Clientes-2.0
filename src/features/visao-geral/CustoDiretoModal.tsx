// --- Modal de detalhamento de custo por cliente — DUAS variantes ---
// tipo='direto'   → "Custo Direto": mão de obra (salários alocados); total = custo_direto.
// tipo='dedicado' → "Custos Dedicados": dedicados manuais (contab/pgto/adm/viagem)
//                   + rateios diretos (Consultoria & Legal / Conciliação, com base);
//                   total = custo_dedicado.
// Cada modal totaliza SÓ o que exibe — nunca custo_total (rótulo honesto).

import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { DadosCliente } from '../../types';

interface Props {
  cliente: DadosCliente;
  tipo: 'direto' | 'dedicado';
  onFechar: () => void;
}

const TH = 'px-3 py-2 text-xs font-bold uppercase tracking-wider text-left';
const TD = 'px-3 py-2 text-sm';

const LABEL_FUNCAO: Record<string, string> = {
  consultoria_gestao: 'Consultoria Gestão',
  consultoria_planejamento: 'Consultoria Planejamento',
  consultoria_financeira: 'Consultoria Financeira',
  operacional_financeiro: 'Operacional Financeiro',
  serv_adm: 'Serviços Administrativos',
  serv_aux_adm: 'Aux. Administrativo',
};

export function CustoDiretoModal({ cliente, tipo, onFechar }: Props) {
  const d = cliente.custo_direto_detalhe;
  const ehDireto = tipo === 'direto';
  const titulo = ehDireto ? `Custo Direto — ${cliente.nome_cliente}` : `Custos Dedicados — ${cliente.nome_cliente}`;
  const totalColuna = ehDireto ? cliente.custo_direto : cliente.custo_dedicado;
  const rotuloTotal = ehDireto ? 'TOTAL CUSTO DIRETO' : 'TOTAL CUSTO DEDICADO';

  if (cliente.pacote_servico === 'asset_only') {
    return (
      <Modal aberto onFechar={onFechar} titulo={titulo}>
        <p className="text-sm" style={{ color: '#6b6b8a' }}>Nenhum custo — cliente pure asset.</p>
      </Modal>
    );
  }

  return (
    <Modal aberto onFechar={onFechar} titulo={titulo}>
      <div className="space-y-5">
        {ehDireto ? (
          /* Custo Direto = mão de obra (salários alocados), decomposta por
             colaborador. Σ valor ≡ custo_direto (mesma base/fatorNorm do motor). */
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>Mão de obra (salários alocados)</p>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr>
                  <th className={TH}>Função</th>
                  <th className={TH}>Colaborador</th>
                  <th className={`${TH} text-right`}>% efet.</th>
                  <th className={`${TH} text-right`}>Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {d.linhasMaoDeObra.length === 0 ? (
                  <tr><td className={TD} colSpan={4} style={{ color: '#6b6b8a' }}>Sem mão de obra alocada (custo direto via campo legado ou nenhum vínculo).</td></tr>
                ) : d.linhasMaoDeObra.map((l, i) => (
                  <tr key={i}>
                    <td className={TD}>{LABEL_FUNCAO[l.funcao] ?? l.funcao}</td>
                    <td className={TD}>{l.responsavel}</td>
                    <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatPercent(l.pct * 100)}</td>
                    <td className={`${TD} text-right font-medium`}>{formatCurrency(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {/* Dedicados manuais. */}
            {(d.contabilidade > 0 || d.pagamento > 0 || d.administrativo > 0 || d.viagem > 0) && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>Custos dedicados (lançados no cliente)</p>
                <table className="min-w-full text-sm">
                  <thead style={{ backgroundColor: '#f9f9fb' }}>
                    <tr><th className={TH}>Descrição</th><th className={`${TH} text-right`}>Valor</th></tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                    {d.contabilidade > 0 && <tr><td className={TD}>Contabilidade</td><td className={`${TD} text-right font-medium`}>{formatCurrency(d.contabilidade)}</td></tr>}
                    {d.pagamento > 0 && <tr><td className={TD}>Plataforma Tempo</td><td className={`${TD} text-right font-medium`}>{formatCurrency(d.pagamento)}</td></tr>}
                    {d.administrativo > 0 && <tr><td className={TD}>Administrativo</td><td className={`${TD} text-right font-medium`}>{formatCurrency(d.administrativo)}</td></tr>}
                    {d.viagem > 0 && <tr><td className={TD}>Viagem</td><td className={`${TD} text-right font-medium`}>{formatCurrency(d.viagem)}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rateios diretos (pools rateados ao cliente pela base de cada um). */}
            {(d.juridico > 0 || d.conciliacao > 0) && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>Rateios diretos</p>
                <table className="min-w-full text-sm">
                  <thead style={{ backgroundColor: '#f9f9fb' }}>
                    <tr><th className={TH}>Serviço</th><th className={TH}>Base de rateio</th><th className={`${TH} text-right`}>Valor</th></tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                    {d.juridico > 0 && (
                      <tr>
                        <td className={TD}>Consultoria & Legal (Jurídico)</td>
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

            {totalColuna === 0 && (
              <p className="text-sm" style={{ color: '#6b6b8a' }}>Nenhum custo dedicado para este cliente.</p>
            )}
          </>
        )}

        {/* Total da COLUNA exibida (nunca custo_total). */}
        <div className="flex justify-between items-center px-3 py-3 rounded-lg" style={{ backgroundColor: '#f3f4f6' }}>
          <span className="text-sm font-bold" style={{ color: '#160F41' }}>{rotuloTotal}</span>
          <span className="text-sm font-bold" style={{ color: '#160F41' }}>{formatCurrency(totalColuna)}</span>
        </div>
      </div>
    </Modal>
  );
}
