// --- Tabelas detalhamento por custódia, tipo e categoria ---

import { formatCurrency, formatPercent } from '../../../utils/formatters';

const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left';
const THR = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-right';
const TD = 'px-3 py-2 text-xs';
const TDR = 'px-3 py-2 text-xs text-right';

interface CustodiaProps { dados: { custodia: string; valor: number; pct: number }[]; totalAtivos: number }
interface TipoProps { dados: { tipo: string; valor: number; pct: number }[]; totalAtivos: number }
interface CategoriaProps {
  categorias: { nome: string; qtd: number; valor: number }[];
  totalAtivos: number; totalPassivos: number; patrimonioLiquido: number;
}

export function TabelaCustodia({ dados, totalAtivos }: CustodiaProps) {
  if (dados.length === 0) return <EmptyMsg msg="Nenhum investimento cadastrado" />;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
      <p className="text-xs font-semibold px-3 py-2" style={{ color: '#160F41', backgroundColor: '#f9f9fb' }}>Investimentos por Custódia</p>
      <table className="min-w-full"><thead style={{ backgroundColor: '#f9f9fb' }}><tr>
        <th className={TH}>Custódia</th><th className={THR}>Valor</th><th className={THR}>% Ativos</th><th className={THR}>% Invest.</th>
      </tr></thead><tbody className="divide-y" style={{ borderColor: '#e2e8f0' }}>
        {dados.map(d => (
          <tr key={d.custodia}><td className={TD}>{d.custodia}</td>
            <td className={TDR}>{formatCurrency(d.valor)}</td>
            <td className={TDR}>{totalAtivos > 0 ? formatPercent(d.valor / totalAtivos * 100) : '—'}</td>
            <td className={TDR}>{formatPercent(d.pct * 100)}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

export function TabelaTipo({ dados, totalAtivos }: TipoProps) {
  if (dados.length === 0) return <EmptyMsg msg="Nenhum investimento cadastrado" />;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
      <p className="text-xs font-semibold px-3 py-2" style={{ color: '#160F41', backgroundColor: '#f9f9fb' }}>Investimentos por Tipo</p>
      <table className="min-w-full"><thead style={{ backgroundColor: '#f9f9fb' }}><tr>
        <th className={TH}>Tipo</th><th className={THR}>Valor</th><th className={THR}>% Ativos</th><th className={THR}>% Invest.</th>
      </tr></thead><tbody className="divide-y" style={{ borderColor: '#e2e8f0' }}>
        {dados.map(d => (
          <tr key={d.tipo}><td className={TD}>{d.tipo}</td>
            <td className={TDR}>{formatCurrency(d.valor)}</td>
            <td className={TDR}>{totalAtivos > 0 ? formatPercent(d.valor / totalAtivos * 100) : '—'}</td>
            <td className={TDR}>{formatPercent(d.pct * 100)}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

export function TabelaCategoria({ categorias, totalAtivos, totalPassivos, patrimonioLiquido }: CategoriaProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
      <p className="text-xs font-semibold px-3 py-2" style={{ color: '#160F41', backgroundColor: '#f9f9fb' }}>Detalhamento por Categoria</p>
      <table className="min-w-full"><thead style={{ backgroundColor: '#f9f9fb' }}><tr>
        <th className={TH}>Categoria</th><th className={THR}>Nº Itens</th><th className={THR}>Valor Total</th><th className={THR}>% Patrimônio</th>
      </tr></thead><tbody className="divide-y" style={{ borderColor: '#e2e8f0' }}>
        {categorias.map(c => (
          <tr key={c.nome}><td className={TD}>{c.nome}</td><td className={TDR}>{c.qtd}</td>
            <td className={TDR}>{formatCurrency(c.valor)}</td>
            <td className={TDR}>{totalAtivos > 0 ? formatPercent(c.valor / totalAtivos * 100) : '—'}</td></tr>
        ))}
        <tr className="bg-blue-50/50"><td className={`${TD} font-semibold`}>Ativos Totais</td><td className={TDR}>—</td>
          <td className={`${TDR} font-semibold`}>{formatCurrency(totalAtivos)}</td><td className={TDR}>100%</td></tr>
        {totalPassivos > 0 && (
          <tr><td className={TD} style={{ color: '#dc2626' }}>Passivos</td><td className={TDR}>—</td>
            <td className={TDR} style={{ color: '#dc2626' }}>{formatCurrency(totalPassivos)}</td><td className={TDR}>—</td></tr>
        )}
        <tr className="border-t-2" style={{ borderColor: '#d1d5db' }}>
          <td className={`${TD} font-bold`} style={{ color: '#160F41' }}>Patrimônio Líquido</td><td className={TDR}>—</td>
          <td className={`${TDR} font-bold`} style={{ color: patrimonioLiquido >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(patrimonioLiquido)}</td>
          <td className={TDR}>—</td></tr>
      </tbody></table>
    </div>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return <div className="rounded-xl border p-6 text-center text-xs" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>{msg}</div>;
}
