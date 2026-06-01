// --- Modal: ranking de empresários (agregado a partir dos clientes da Visão Geral) ---
import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { HeaderOrdenavel, type OrdenacaoState } from '../../components/ui/HeaderOrdenavel';
import { FiltroCheckbox } from '../poupanca/FiltroCheckbox';
import { formatCurrency, formatPercent, getSiglaCliente } from '../../utils/formatters';
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

// Drill-down: clientes de um empresário. Mesmas funcionalidades do ranking
// (ordenação + filtro Excel) com uma coluna de Sigla à frente.
interface LinhaCliente {
  sigla: string;
  nome: string;
  pacote: string;
  pl: number;
  receita: number;
  margem: number;   // decimal
}

type ChaveCliente = keyof LinhaCliente;

export function RankingEmpresariosModal({ clientes, onFechar }: { clientes: DadosClienteComPoupanca[]; onFechar: () => void }) {
  // Ordenação via componente compartilhado HeaderOrdenavel (consistente com a
  // lista de clientes do Perfil). Default: receita desc.
  const [ordenacao, setOrdenacao] = useState<OrdenacaoState<ChaveOrd>>({ coluna: 'receita', direcao: 'desc' });
  // Filtro estilo Excel na coluna Empresário (null = todos, sem filtro).
  const [filtroEmpresarios, setFiltroEmpresarios] = useState<Set<string> | null>(null);
  const [empresarioSelecionado, setEmpresarioSelecionado] = useState<string | null>(null);

  // Estado do drill-down (clientes do empresário): ordenação + filtros Excel.
  const [ordenacaoEmp, setOrdenacaoEmp] = useState<OrdenacaoState<ChaveCliente>>({ coluna: 'receita', direcao: 'desc' });
  const [filtroSiglasEmp, setFiltroSiglasEmp] = useState<Set<string> | null>(null);
  const [filtroNomesEmp, setFiltroNomesEmp] = useState<Set<string> | null>(null);
  const [filtroPacotesEmp, setFiltroPacotesEmp] = useState<Set<string> | null>(null);

  // Abre o drill-down zerando filtros/ordenação do quadro anterior.
  const abrirEmpresario = (emp: string) => {
    setFiltroSiglasEmp(null);
    setFiltroNomesEmp(null);
    setFiltroPacotesEmp(null);
    setOrdenacaoEmp({ coluna: 'receita', direcao: 'desc' });
    setEmpresarioSelecionado(emp);
  };

  // Linhas-base do drill-down (com sigla), sem filtro/ordenação.
  const clientesEmpBase = useMemo<LinhaCliente[]>(() => {
    if (!empresarioSelecionado) return [];
    return clientes
      .filter(c => (c.empresario?.trim() || SEM) === empresarioSelecionado)
      .map(c => ({
        sigla: getSiglaCliente(c.nome_cliente),
        nome: c.nome_cliente,
        pacote: c.pacote_servico,
        pl: (c.pl_onshore ?? 0) + (c.pl_offshore ?? 0),
        receita: c.receita_bruta ?? 0,
        margem: c.margem ?? 0,
      }));
  }, [clientes, empresarioSelecionado]);

  // Valores únicos (ordem alfabética) para os filtros Excel do drill-down.
  const uniq = (vals: string[]) => [...new Set(vals)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const siglasEmpDisp = useMemo(() => uniq(clientesEmpBase.map(l => l.sigla)), [clientesEmpBase]);
  const nomesEmpDisp = useMemo(() => uniq(clientesEmpBase.map(l => l.nome)), [clientesEmpBase]);
  const pacotesEmpDisp = useMemo(() => uniq(clientesEmpBase.map(l => l.pacote)), [clientesEmpBase]);

  // Filtra (Sigla/Cliente/Pacote) e ordena pela coluna ativa.
  const clientesEmp = useMemo(() => {
    const arr = clientesEmpBase.filter(l =>
      (!filtroSiglasEmp || filtroSiglasEmp.has(l.sigla)) &&
      (!filtroNomesEmp || filtroNomesEmp.has(l.nome)) &&
      (!filtroPacotesEmp || filtroPacotesEmp.has(l.pacote)));
    const mult = ordenacaoEmp.direcao === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = a[ordenacaoEmp.coluna]; const vb = b[ordenacaoEmp.coluna];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
      return String(va).localeCompare(String(vb), 'pt-BR') * mult;
    });
    return arr;
  }, [clientesEmpBase, filtroSiglasEmp, filtroNomesEmp, filtroPacotesEmp, ordenacaoEmp]);

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

  // Valores únicos para o filtro Excel da coluna Empresário (ordem alfabética).
  const empresariosDisponiveis = useMemo(
    () => linhas.map(l => l.empresario).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [linhas],
  );

  // Filtra (por Empresário) e então ordena pela coluna ativa.
  const ordenadas = useMemo(() => {
    const arr = linhas.filter(l => !filtroEmpresarios || filtroEmpresarios.has(l.empresario));
    const mult = ordenacao.direcao === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = a[ordenacao.coluna]; const vb = b[ordenacao.coluna];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
      return String(va).localeCompare(String(vb), 'pt-BR') * mult;
    });
    return arr;
  }, [linhas, ordenacao, filtroEmpresarios]);

  const THD = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
  const TD = 'px-3 py-2 text-xs';

  const cols: { chave: ChaveOrd; label: string; align: 'left' | 'right' }[] = [
    { chave: 'empresario', label: 'Empresário', align: 'left' },
    { chave: 'clientes', label: 'Clientes', align: 'right' },
    { chave: 'pl_total', label: 'PL Total', align: 'right' },
    { chave: 'pct_pl', label: '% PL', align: 'right' },
    { chave: 'receita', label: 'Receita', align: 'right' },
    { chave: 'pct_receita', label: '% Receita', align: 'right' },
    { chave: 'margem_media', label: 'Margem Média', align: 'right' },
  ];

  // Colunas do drill-down. `filtro` aponta para os valores únicos + estado do
  // FiltroCheckbox da coluna (só nas categóricas: Sigla, Cliente, Pacote).
  const colsEmp: {
    chave: ChaveCliente; label: string; align: 'left' | 'right';
    filtro?: { valores: string[]; sel: Set<string> | null; onAplicar: (s: Set<string> | null) => void };
  }[] = [
    { chave: 'sigla', label: 'Sigla', align: 'left', filtro: { valores: siglasEmpDisp, sel: filtroSiglasEmp, onAplicar: setFiltroSiglasEmp } },
    { chave: 'nome', label: 'Cliente', align: 'left', filtro: { valores: nomesEmpDisp, sel: filtroNomesEmp, onAplicar: setFiltroNomesEmp } },
    { chave: 'pacote', label: 'Pacote', align: 'left', filtro: { valores: pacotesEmpDisp, sel: filtroPacotesEmp, onAplicar: setFiltroPacotesEmp } },
    { chave: 'pl', label: 'PL Total', align: 'right' },
    { chave: 'receita', label: 'Receita', align: 'right' },
    { chave: 'margem', label: 'Margem', align: 'right' },
  ];

  return (
    <Modal aberto onFechar={onFechar} titulo="🏆 Ranking de Empresários" largura="6xl">
      {empresarioSelecionado ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>
              Clientes de {empresarioSelecionado} — {clientesEmp.length} cliente{clientesEmp.length === 1 ? '' : 's'}
            </h4>
            <button type="button" onClick={() => setEmpresarioSelecionado(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
              ← Voltar ao ranking
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f9f9fb' }}>
                <tr>
                  {colsEmp.map(col => (
                    <th key={col.chave} className={`${THD} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                      style={{ position: 'relative' }}>
                      <div className={`flex items-center ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                        <HeaderOrdenavel titulo={col.label} chave={col.chave} alinhamento={col.align}
                          ordenacao={ordenacaoEmp} onOrdenar={setOrdenacaoEmp} />
                        {col.filtro && (
                          <FiltroCheckbox valores={col.filtro.valores}
                            selecionados={col.filtro.sel} onAplicar={col.filtro.onAplicar} />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {clientesEmp.map(c => (
                  <tr key={c.nome}>
                    <td className={`${TD} font-semibold`} style={{ color: '#160F41' }}>{c.sigla}</td>
                    <td className={TD} style={{ color: '#160F41' }}>{c.nome}</td>
                    <td className={TD} style={{ color: '#9ca3af' }}>{c.pacote}</td>
                    <td className={`${TD} text-right`} style={{ color: '#160F41' }}>{formatCurrency(c.pl, true)}</td>
                    <td className={`${TD} text-right`} style={{ color: '#160F41' }}>{formatCurrency(c.receita, true)}</td>
                    <td className={`${TD} text-right font-medium`} style={{ color: c.margem >= 0 ? '#16a34a' : '#dc2626' }}>{formatPercent(c.margem * 100, 1)}</td>
                  </tr>
                ))}
                {clientesEmp.length === 0 && <tr><td className={`${TD} italic`} colSpan={colsEmp.length} style={{ color: '#6b6b8a' }}>Sem clientes.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              {cols.map(col => (
                <th key={col.chave} className={`${THD} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  style={{ position: 'relative' }}>
                  <div className={`flex items-center ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                    <HeaderOrdenavel titulo={col.label} chave={col.chave} alinhamento={col.align}
                      ordenacao={ordenacao} onOrdenar={setOrdenacao} />
                    {col.chave === 'empresario' && (
                      <FiltroCheckbox valores={empresariosDisponiveis}
                        selecionados={filtroEmpresarios} onAplicar={setFiltroEmpresarios} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {ordenadas.map(l => (
              <tr key={l.empresario}>
                <td className={TD}>
                  <button type="button" onClick={() => abrirEmpresario(l.empresario)}
                    className="hover:underline text-left" style={{ color: l.empresario === SEM ? '#9ca3af' : '#0065FF' }}>
                    {l.empresario}
                  </button>
                </td>
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
      )}
    </Modal>
  );
}
