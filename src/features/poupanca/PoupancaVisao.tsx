// --- Tela principal do módulo AUM & Performance ---
// Compõe KPIs, meta, gráfico, tabela e painel de importação.

import { useState, useEffect, useMemo } from 'react';
import { FileText, Upload, Loader2, Target } from 'lucide-react';
// [NOVO] Navegação para Central de Importação
import { useNavigate } from 'react-router-dom';
import { usePoupanca } from './usePoupanca';
import { useApp } from '../../state/AppContext';
import type { RegistroPoupanca } from '../../types';
import { PoupancaKpis } from './PoupancaKpis';
import { PoupancaMeta } from './PoupancaMeta';
import { PoupancaChart } from './PoupancaChart';
import { PoupancaTabela } from './PoupancaTabela';
import { PoupancaClienteDetalhe } from './PoupancaClienteDetalhe';
// [NOVO] Painel meta em lote
import { PoupancaMetaLote } from './PoupancaMetaLote';
import { BankerVisao } from './banker/BankerVisao';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ANOS = [2024, 2025, 2026, 2027];

function MesAnoSelect({ mes, ano, setMes, setAno, label }: {
  mes: number; ano: number;
  setMes: (m: number) => void; setAno: (a: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label}</span>
      <select value={mes} onChange={e => setMes(Number(e.target.value))}
        className="rounded-lg px-2 py-1.5 text-sm" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
        {MESES_LABEL.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
      </select>
      <select value={ano} onChange={e => setAno(Number(e.target.value))}
        className="rounded-lg px-2 py-1.5 text-sm" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
        {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

export function PoupancaVisao() {
  const hoje = new Date();
  // Inicio: Jan/2025 — Fim: mês anterior ao atual
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const [mesInicio, setMesInicio] = useState(1);
  const [anoInicio, setAnoInicio] = useState(2025);
  const [mesFim, setMesFim] = useState(mesAnterior.getMonth() + 1);
  const [anoFim, setAnoFim] = useState(mesAnterior.getFullYear());
  // [NOVO] Navegar para Central de Importação
  const navigate = useNavigate();
  const [registrosDetalhe, setRegistrosDetalhe] = useState<RegistroPoupanca[]>([]);
  // [NOVO] Painel meta em lote
  const [painelMetaAberto, setPainelMetaAberto] = useState(false);
  const [visualizacao, setVisualizacao] = useState<'cliente' | 'banker'>('cliente');

  // Auto-swap se inicio > fim
  useEffect(() => {
    const ini = anoInicio * 12 + mesInicio;
    const fim = anoFim * 12 + mesFim;
    if (ini > fim) {
      setMesInicio(mesFim); setAnoInicio(anoFim);
      setMesFim(mesInicio); setAnoFim(anoInicio);
    }
  }, [mesInicio, anoInicio, mesFim, anoFim]);

  const { registrosPorCliente, historico, loading, totais, metaNNM, setMetaNNM, recarregar } = usePoupanca(
    mesInicio, anoInicio, mesFim, anoFim,
  );

  const { dadosPeriodo } = useApp();
  const clientesSemBanker = useMemo(() => {
    const set = new Set<string>();
    for (const c of dadosPeriodo?.dados ?? []) {
      if (!c.banker) set.add(c.nome_cliente);
    }
    return set;
  }, [dadosPeriodo]);

  function handleClienteClick(regs: RegistroPoupanca[]) {
    setRegistrosDetalhe(regs);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#160F41' }}>
          <FileText size={20} /> AUM & Performance
        </h2>
        <div className="flex items-center gap-4">
          <MesAnoSelect label="De:" mes={mesInicio} ano={anoInicio}
            setMes={setMesInicio} setAno={setAnoInicio} />
          <MesAnoSelect label="Até:" mes={mesFim} ano={anoFim}
            setMes={setMesFim} setAno={setAnoFim} />
          {/* [NOVO] Botão meta em lote */}
          <button onClick={() => setPainelMetaAberto(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ border: '1px solid #e2e2e8', color: painelMetaAberto ? '#0065FF' : '#6b6b8a' }}>
            <Target size={14} /> Metas em Lote
          </button>
          {/* [NOVO] Redireciona para Central de Importação, aba Poupança */}
          <button onClick={() => navigate('/upload?aba=poupanca')}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-brand">
            <Upload size={14} /> Importar PDFs
          </button>
        </div>
      </div>

      {/* [NOVO] Painel meta em lote */}
      {painelMetaAberto && !loading && (
        <PoupancaMetaLote registrosPorCliente={registrosPorCliente}
          mesInicio={mesInicio} anoInicio={anoInicio} mesFim={mesFim} anoFim={anoFim}
          onAplicado={() => { setPainelMetaAberto(false); recarregar(); }}
          onFechar={() => setPainelMetaAberto(false)} />
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: '#160F41' }}>
          <Loader2 className="animate-spin" size={16} /> Carregando dados...
        </div>
      )}

      {!loading && <PoupancaKpis totais={totais} mesInicio={mesInicio} anoInicio={anoInicio} mesFim={mesFim} anoFim={anoFim} />}
      {!loading && <PoupancaMeta metaNNM={metaNNM} setMetaNNM={setMetaNNM} />}
      {!loading && <PoupancaChart dados={historico} />}

      {!loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: '#160F41' }}>
              {MESES_LABEL[mesInicio - 1]}/{anoInicio} a {MESES_LABEL[mesFim - 1]}/{anoFim}
            </h4>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
              {([['cliente', '👤 Por Cliente'], ['banker', '🏦 Por Banker']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setVisualizacao(id)}
                  className={`px-4 py-1.5 text-xs font-medium transition-all ${visualizacao === id ? 'bg-gradient-brand text-white' : ''}`}
                  style={visualizacao !== id ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visualizacao === 'cliente' && (
            <PoupancaTabela registrosPorCliente={registrosPorCliente} metaNNM={metaNNM}
              numeroMeses={(anoFim * 12 + mesFim) - (anoInicio * 12 + mesInicio) + 1}
              clientesSemBanker={clientesSemBanker}
              onClienteClick={handleClienteClick}
              periodoLabel={`${MESES_LABEL[mesInicio - 1]}/${anoInicio} a ${MESES_LABEL[mesFim - 1]}/${anoFim}`} />
          )}

          {visualizacao === 'banker' && (
            <BankerVisao registrosPorCliente={registrosPorCliente}
              clientesComBanker={dadosPeriodo?.dados ?? []}
              mesInicio={mesInicio} anoInicio={anoInicio} mesFim={mesFim} anoFim={anoFim} />
          )}
        </div>
      )}

      <PoupancaClienteDetalhe
        registros={registrosDetalhe}
        onFechar={() => { setRegistrosDetalhe([]); recarregar(); }}
      />
    </div>
  );
}
