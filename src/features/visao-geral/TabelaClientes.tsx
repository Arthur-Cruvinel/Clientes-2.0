// --- Tabela de clientes com totais dinâmicos, sticky, ordenação e filtros ---

import { useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { ColunaConfig } from '../../components/ui/DataTable';
import type { DadosCliente, VisaoFinanceira } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { FiltroColuna } from './FiltroColuna';

interface Props {
  clientes: DadosCliente[];
  colunas: ColunaConfig<DadosCliente>[];
  colunaOrdenada: string;
  onOrdenar: (chave: string) => void;
  visaoFinanceira: VisaoFinanceira;
  valoresUnicos: Map<string, string[]>;
  filtros: Record<string, Set<string>>;
  onFiltroChange: (chave: string, valores: Set<string>) => void;
  periodoFechado?: boolean;
}

/** Calcula totais dinamicamente a partir dos clientes visíveis (filtrados). */
function calcularTotais(clientes: DadosCliente[], isMC: boolean): Record<string, string> {
  let fee = 0, rebate = 0, custoDireto = 0, custoDedicado = 0, custoIndireto = 0;
  let impostosFat = 0, impostosLucro = 0, mc = 0, ebitda = 0, lucroLiquido = 0, receita = 0;

  for (const c of clientes) {
    fee += c.receita_fee_mensal;
    rebate += c.receita_rebate;
    receita += c.receita_bruta;
    custoDireto += c.custo_direto;
    custoDedicado += c.custo_dedicado;
    custoIndireto += c.custo_indireto_rateado;
    impostosFat += c.impostos_faturamento;
    impostosLucro += c.impostos_lucro;
    mc += c.margem_contribuicao;
    ebitda += c.ebitda;
    lucroLiquido += c.lucro_liquido;
  }

  const valorPrincipal = isMC ? mc : ebitda;
  const margemPct = receita > 0 ? (valorPrincipal / receita) * 100 : 0;
  const margemLiqPct = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

  return {
    nome_cliente: `${clientes.length} clientes`,
    receita_fee_mensal: formatCurrency(fee),
    receita_rebate: formatCurrency(rebate),
    custo_direto: formatCurrency(custoDireto),
    custo_dedicado: custoDedicado > 0 ? formatCurrency(custoDedicado) : '-',
    custo_indireto_rateado: isMC ? '—' : formatCurrency(custoIndireto),
    impostos_faturamento: formatCurrency(impostosFat),
    impostos_lucro: formatCurrency(impostosLucro),
    margem_contribuicao: formatCurrency(mc),
    ebitda: formatCurrency(ebitda),
    margem: formatPercent(margemPct),
    lucro_liquido: `${formatCurrency(lucroLiquido)} · ${formatPercent(margemLiqPct)}`,
  };
}

const stickyCol = { position: 'sticky' as const, left: 0, zIndex: 5, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' };

export function TabelaClientes({
  clientes, colunas, colunaOrdenada, onOrdenar, visaoFinanceira,
  valoresUnicos, filtros, onFiltroChange, periodoFechado,
}: Props) {
  const isMC = visaoFinanceira === 'margem_contribuicao';
  const totaisLinha = useMemo(() => calcularTotais(clientes, isMC), [clientes, isMC]);
  // Estilo da tabela quando período fechado (borda verde sutil)
  const borderStyle = periodoFechado ? { borderColor: '#86efac' } : { borderColor: '#e2e2e8' };

  return (
    <div className="overflow-x-auto overflow-y-auto rounded-lg border" style={{ ...borderStyle, maxHeight: '70vh' }}>
      <table className="min-w-full divide-y" style={{ borderColor: '#e2e2e8' }}>
        <thead style={{ backgroundColor: '#f9f9fb', position: 'sticky', top: 0, zIndex: 10 }}>
          <tr>
            {colunas.map((col, i) => {
              const uv = valoresUnicos.get(col.chave) ?? [];
              const filtro = filtros[col.chave];
              const ativo = !!filtro && filtro.size < uv.length;
              return (
                <th key={col.chave}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                    col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left'
                  } ${col.ordenavel ? 'cursor-pointer select-none hover:bg-gray-100' : ''}`}
                  style={{ color: '#6b6b8a', backgroundColor: '#f9f9fb', ...(i === 0 ? { ...stickyCol, zIndex: 15 } : {}) }}
                  onClick={() => col.ordenavel && onOrdenar(col.chave)}>
                  <span className="inline-flex items-center gap-1" title={col.tooltip}>
                    {col.titulo}
                    {col.ordenavel && <ArrowUpDown size={10} style={{ color: colunaOrdenada === col.chave ? '#0065FF' : '#d1d5db' }} />}
                    {uv.length > 0 && (
                      <FiltroColuna valores={uv} selecionados={filtro ?? new Set(uv)}
                        onChange={(novos) => onFiltroChange(col.chave, novos)} ativo={ativo} />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
          {clientes.map(c => (
            <tr key={c.nome_cliente} className="hover:bg-gray-50/50 transition-colors">
              {colunas.map((col, i) => (
                <td key={col.chave}
                  className={`px-4 py-2.5 text-sm whitespace-nowrap ${
                    col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left'
                  }`}
                  style={{ color: '#160F41', backgroundColor: '#ffffff', ...(i === 0 ? stickyCol : {}) }}>
                  {col.render(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            {colunas.map((col, i) => (
              <td key={col.chave}
                className={`px-4 py-3 text-sm font-bold whitespace-nowrap ${
                  col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left'
                }`}
                style={{ color: '#160F41', backgroundColor: '#f3f4f6', ...(i === 0 ? stickyCol : {}) }}>
                {totaisLinha[col.chave] ?? ''}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
