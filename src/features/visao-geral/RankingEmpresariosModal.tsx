// --- Modal: ranking de empresários (agregado a partir dos clientes da Visão Geral) ---
import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { DadosClienteComPoupanca } from '../../utils/dadosClienteAdapter';

const SEM = '(Sem empresário)';

interface LinhaRanking {
  empresario: string;
  clientes: number;
  pl_total: number;
  pct_pl: number;
  receita: number;
  pct_receita: number;
  margem_media: number;   // decimal (média ponderada por receita)
}

type ChaveOrd = keyof LinhaRanking;

export function RankingEmpresariosModal({ clientes, onFechar }: { clientes: DadosClienteComPoupanca[]; onFechar: () => void }) {
  const [coluna, setColuna] = useState<ChaveOrd>('receita');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const linhas = useMemo<LinhaRanking[]>(() => {
    const grupos = new Map<string, { clientes: number; pl: number; receita: number; margXrec: number }>();
    let plGeral = 0;
    let receitaGeral = 0;
    for (const c of clientes) {
      const emp = c.empresario?.trim() || SEM;
      const pl = (c.pl_onshore ?? 0) + (c.pl_offshore ?? 0);
      const receita = c.receita_bruta ?? 0;
      const g = grupos.get(emp) ?? { clientes: 0, pl: 0, receita: 0, margXrec: 0 };
      g.clientes += 1;
      if (pl > 0) g.pl += pl;          // PL só de clientes com PL > 0
      g.receita += receita;
      g.margXrec += (c.margem ?? 0) * receita;   // numerador da média ponderada
      grupos.set(emp, g);
      if (pl > 0) plGeral += pl;
      receitaGeral += receita;
    }
    return [...grupos.entries()].map(([empresario, g]) => ({
      empresario,
      clientes: g.clientes,
      pl_total: g.pl,
      pct_pl: plGeral > 0 ? (g.pl / plGeral) * 100 : 0,
      receita: g.receita,
      pct_receita: receitaGeral > 0 ? (g.receita / receitaGeral) * 100 : 0,
      margem_media: g.receita > 0 ? g.margXrec / g.receita : 0,
    }));
  }, [clientes]);

  const ordenadas = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      const va = a[coluna]; const vb = b[coluna];
      if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va;
      return dir === 'asc'
        ? String(va).localeCompare(String(vb), 'pt-BR')
        : String(vb).localeCompare(String(va), 'pt-BR');
    });
    return arr;
  }, [linhas, coluna, dir]);

  const ordenar = (c: ChaveOrd) => {
    if (c === coluna) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setColuna(c); setDir(c === 'empresario' ? 'asc' : 'desc'); }
  };

  const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none';
  const TD = 'px-3 py-2 text-xs';
  const seta = (c: ChaveOrd) => (coluna === c ? (dir === 'asc' ? ' ▲' : ' ▼') : '');

  const cols: { chave: ChaveOrd; label: string; align: 'left' | 'right' }[] = [
    { chave: 'empresario', label: 'Empresário', align: 'left' },
    { chave: 'clientes', label: 'Clientes', align: 'right' },
    { chave: 'pl_total', label: 'PL Total', align: 'right' },
    { chave: 'pct_pl', label: '% PL', align: 'right' },
    { chave: 'receita', label: 'Receita', align: 'right' },
    { chave: 'pct_receita', label: '% Receita', align: 'right' },
    { chave: 'margem_media', label: 'Margem Média', align: 'right' },
  ];

  return (
    <Modal aberto onFechar={onFechar} titulo="🏆 Ranking de Empresários" largura="6xl">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead style={{ backgroundColor: '#160F41', color: '#fff' }}>
            <tr>
              {cols.map(col => (
                <th key={col.chave} onClick={() => ordenar(col.chave)}
                  className={`${TH} ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {col.label}{seta(col.chave)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {ordenadas.map(l => (
              <tr key={l.empresario}>
                <td className={TD} style={{ color: l.empresario === SEM ? '#9ca3af' : '#160F41' }}>{l.empresario}</td>
                <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{l.clientes}</td>
                <td className={`${TD} text-right`} style={{ color: '#160F41' }}>{formatCurrency(l.pl_total, true)}</td>
                <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{l.pct_pl.toFixed(1)}%</td>
                <td className={`${TD} text-right`} style={{ color: '#160F41' }}>{formatCurrency(l.receita, true)}</td>
                <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{l.pct_receita.toFixed(1)}%</td>
                <td className={`${TD} text-right font-medium`} style={{ color: l.margem_media >= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatPercent(l.margem_media * 100, 1)}
                </td>
              </tr>
            ))}
            {ordenadas.length === 0 && (
              <tr><td className={`${TD} italic`} colSpan={cols.length} style={{ color: '#6b6b8a' }}>Nenhum cliente no período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
