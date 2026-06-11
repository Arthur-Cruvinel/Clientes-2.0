// --- Modal de detalhamento do Custo Indireto rateado para um cliente ---
// Decompõe o rateio por tipo (geral / juridico / conciliacao) para auditoria.
// Reproduz a fórmula do motor (financials.custos.ts:96-145) — incluindo o
// pool institucional dos colaboradores na parcela 'geral'.

import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { useApp } from '../../state/AppContext';
import { calcularCustoInstitucional, calcularOciosidade, somarPctPorColaborador } from '../../utils/financials';
import type { DadosCliente, CustoIndireto } from '../../types';

interface Props {
  cliente: DadosCliente;
  todosClientes: DadosCliente[];
  custosIndiretos: CustoIndireto[];
  custosDiretos: Map<string, number>;
  onFechar: () => void;
}

export function CustoIndiretoModal({ cliente, todosClientes, custosIndiretos, custosDiretos, onFechar }: Props) {
  const { dadosPeriodo } = useApp();
  const colaboradores = dadosPeriodo?.colaboradores ?? [];
  // Pool da folha NÃO-ALOCADA = institucional + ociosidade — entra no pool
  // 'geral' do motor; incluir aqui para o detalhamento bater ao centavo.
  const custoInstitucional = calcularCustoInstitucional(colaboradores);
  const somaPct = somarPctPorColaborador(
    dadosPeriodo?.clientes ?? [], colaboradores, dadosPeriodo?.vinculos ?? []);
  const ociosidade = calcularOciosidade(colaboradores, somaPct);

  // Denominador do rateio geral (proporcional ao custo direto). % do cliente é
  // o MESMO para todas as parcelas do pool geral — vem do pipeline (custo direto
  // do cliente / Σ custo direto), nunca recalculado por via própria.
  const somaCustoDireto = todosClientes.reduce((s, c) => s + (custosDiretos.get(c.nome_cliente) ?? 0), 0);
  const custoDiretoCliente = custosDiretos.get(cliente.nome_cliente) ?? 0;
  const pct = somaCustoDireto > 0 ? custoDiretoCliente / somaCustoDireto : 0;

  // Uma linha POR CATEGORIA do pool geral: as 5 do Firestore + institucional +
  // ociosidade (folha não-alocada). Jurídico/conciliação NÃO entram — viraram
  // custo DIRETO (dedicado). Σ alocado = pool geral × pct ≡ custo_indireto_rateado.
  type Linha = { descricao: string; valorTotal: number; pctCliente: number; alocado: number };
  const categorias: { descricao: string; valorTotal: number }[] = [];
  for (const ci of custosIndiretos) {
    if (ci.tipo_custo === 'geral') categorias.push({ descricao: ci.descricao_custo, valorTotal: ci.valor_mensal });
  }
  if (custoInstitucional > 0) categorias.push({ descricao: 'Institucional (folha não-alocável)', valorTotal: custoInstitucional });
  if (ociosidade > 0) categorias.push({ descricao: 'Ociosidade (folha não-alocada)', valorTotal: ociosidade });

  const linhas: Linha[] = categorias
    .filter(c => c.valorTotal > 0)
    .map(c => ({ descricao: c.descricao, valorTotal: c.valorTotal, pctCliente: pct, alocado: c.valorTotal * pct }));
  const somaAlocado = linhas.reduce((s, l) => s + l.alocado, 0);

  const TH = 'px-3 py-2 text-xs font-bold uppercase tracking-wider text-left';
  const TD = 'px-3 py-2 text-sm';

  return (
    <Modal aberto onFechar={onFechar} titulo={`Custo Indireto — ${cliente.nome_cliente}`}>
      {linhas.length === 0 ? (
        <p className="text-sm" style={{ color: '#6b6b8a' }}>Nenhum custo indireto alocado a este cliente.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: '#f9f9fb' }}>
              <tr>
                <th className={TH}>Categoria</th>
                <th className={`${TH} text-right`}>Valor Total</th>
                <th className={`${TH} text-right`}>% Cliente</th>
                <th className={`${TH} text-right`}>Alocado</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
              {linhas.map((l, i) => (
                <tr key={i}>
                  <td className={TD} title={l.descricao}>{l.descricao}</td>
                  <td className={`${TD} text-right`}>{formatCurrency(l.valorTotal)}</td>
                  <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{formatPercent(l.pctCliente * 100)}</td>
                  <td className={`${TD} text-right font-medium`}>{formatCurrency(l.alocado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <td colSpan={3} className={`${TD} font-bold`}>TOTAL</td>
                <td className={`${TD} text-right font-bold`}>{formatCurrency(somaAlocado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}
