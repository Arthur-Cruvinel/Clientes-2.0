// --- Tela principal do módulo AUM & Performance ---
// Compõe KPIs, meta, gráfico, tabela e painel de importação.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FileText, Upload, Loader2, Target, ShieldCheck } from 'lucide-react';
// [NOVO] Navegação para Central de Importação
import { useNavigate } from 'react-router-dom';
import { usePoupanca } from './usePoupanca';
import { useRevisao } from './useRevisao';
import { useApp } from '../../state/AppContext';
import type { RegistroPoupanca } from '../../types';
import { PoupancaKpis } from './PoupancaKpis';
import { PoupancaMeta } from './PoupancaMeta';
import { PoupancaChart } from './PoupancaChart';
import { PoupancaMetaChart } from './PoupancaMetaChart';
import { PoupancaTabela } from './PoupancaTabela';
import { PoupancaClienteDetalhe } from './PoupancaClienteDetalhe';
// [NOVO] Painel meta em lote
import { PoupancaMetaLote } from './PoupancaMetaLote';
import { BankerVisao } from './banker/BankerVisao';
import { AgenteValidacao } from '../agente/AgenteValidacao';
import { CdiIndicador } from './CdiIndicador';
import { BurnRateModal } from './BurnRateModal';
import { ProjecaoModal } from './ProjecaoModal';

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
  // Default: ano corrente cheio (Jan a Dez). Cobre o horizonte completo
  // dos cenários de projeção (Trajetória da Meta vai até a data_alvo da
  // meta global, normalmente Dez/anoCorrente).
  const anoCorrente = hoje.getFullYear();
  const [mesInicio, setMesInicio] = useState(1);
  const [anoInicio, setAnoInicio] = useState(anoCorrente);
  const [mesFim, setMesFim] = useState(12);
  const [anoFim, setAnoFim] = useState(anoCorrente);
  // [NOVO] Navegar para Central de Importação
  const navigate = useNavigate();
  const [registrosDetalhe, setRegistrosDetalhe] = useState<RegistroPoupanca[]>([]);
  // [NOVO] Painel meta em lote
  const [painelMetaAberto, setPainelMetaAberto] = useState(false);
  const [visualizacao, setVisualizacao] = useState<'cliente' | 'banker'>('cliente');
  const [validacaoAberta, setValidacaoAberta] = useState(false);

  // Auto-swap se inicio > fim
  useEffect(() => {
    const ini = anoInicio * 12 + mesInicio;
    const fim = anoFim * 12 + mesFim;
    if (ini > fim) {
      setMesInicio(mesFim); setAnoInicio(anoFim);
      setMesFim(mesInicio); setAnoFim(anoInicio);
    }
  }, [mesInicio, anoInicio, mesFim, anoFim]);

  const { dadosPeriodo } = useApp();

  const { registrosPorCliente, historico, historicoMetaCumprimento, loading, totais, metaNNM, setMetaNNM, metaAUM, setMetaAUM, metasPeriodo, setMetasPeriodo, modoAUM, setModoAUM, aumLegadoTotal, clientesQueimando, rebateEmRiscoTotal, mm6Clientes, clientesEmBurnMM6, projecaoConsolidada, serieAumProjetadaMM6, projecaoSobGestaoConsolidada, serieAumSobGestaoProjetadaMM6, serieAumOrganicoEsperado, serieAumRitmoAtual, serieMetaTrajetoria, coberturaCapacidade, mesesNoPeriodo, aumInicialPeriodo, registroAnteriorPorCliente, recarregar } = usePoupanca(
    mesInicio, anoInicio, mesFim, anoFim, dadosPeriodo?.clientes,
  );

  // Card "Projeção Dez" e linha projetada do gráfico alternam entre Galápagos
  // (poupança pura) e Sob Gestão (poupança + legado capitalizado) conforme
  // o toggle. Demais KPIs (NNM, Burn, Rebate) continuam Galápagos puro.
  const projecaoDisplay = modoAUM === 'sob_gestao'
    ? projecaoSobGestaoConsolidada
    : projecaoConsolidada;
  const serieProjetadaDisplay = modoAUM === 'sob_gestao'
    ? serieAumSobGestaoProjetadaMM6
    : serieAumProjetadaMM6;

  const [burnModalAberto, setBurnModalAberto] = useState(false);
  const [projecaoModalAberto, setProjecaoModalAberto] = useState(false);

  // Hook de revisão (cliente-level + mês-level)
  const { estaMarcado, toggleCliente, toggleMes } = useRevisao();

  // Lista ordenada de nomes — vem do PoupancaTabelaLinhas via callback,
  // serve para a navegação anterior/próximo respeitar a ordenação atual.
  const [nomesOrdenados, setNomesOrdenados] = useState<string[]>([]);

  const clientesSemBanker = useMemo(() => {
    const set = new Set<string>();
    for (const c of dadosPeriodo?.clientes ?? []) {
      if (!c.banker) set.add(c.nome_cliente);
    }
    return set;
  }, [dadosPeriodo]);

  function handleClienteClick(regs: RegistroPoupanca[]) {
    setRegistrosDetalhe(regs);
  }

  // ── Navegação anterior/próximo no modal de detalhe ────────────────
  // O índice é calculado dinamicamente a partir do nome do cliente atual
  // dentro do modal e da lista ordenada (lifted) da tabela.
  const nomeAberto = registrosDetalhe[0]?.nome_cliente ?? '';
  const indiceAberto = useMemo(
    () => (nomeAberto ? nomesOrdenados.indexOf(nomeAberto) : -1),
    [nomeAberto, nomesOrdenados],
  );
  const temAnterior = indiceAberto > 0;
  const temProximo = indiceAberto >= 0 && indiceAberto < nomesOrdenados.length - 1;
  const posicaoTexto = indiceAberto >= 0
    ? `${indiceAberto + 1}/${nomesOrdenados.length}`
    : '';

  const handleNavegar = useCallback((direcao: 'anterior' | 'proximo') => {
    if (indiceAberto < 0) return;
    const novoIndice = direcao === 'proximo' ? indiceAberto + 1 : indiceAberto - 1;
    if (novoIndice < 0 || novoIndice >= nomesOrdenados.length) return;
    const novoNome = nomesOrdenados[novoIndice];
    const novosRegistros = registrosPorCliente.get(novoNome);
    if (novosRegistros) setRegistrosDetalhe(novosRegistros);
  }, [indiceAberto, nomesOrdenados, registrosPorCliente]);

  // Toggle de revisão do cliente atualmente aberto no modal
  const handleToggleRevisaoCliente = useCallback(() => {
    if (nomeAberto) toggleCliente(nomeAberto);
  }, [nomeAberto, toggleCliente]);

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
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
            {([['galapagos', 'Galapagos'], ['sob_gestao', 'Sob Gestao']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setModoAUM(id)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${modoAUM === id ? 'bg-gradient-brand text-white' : ''}`}
                style={modoAUM !== id ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
                {label}
              </button>
            ))}
          </div>
          <CdiIndicador />
          <button onClick={() => setValidacaoAberta(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
            <ShieldCheck size={14} /> Validar
          </button>
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

      {!loading && <PoupancaKpis totais={totais} mesInicio={mesInicio} anoInicio={anoInicio} mesFim={mesFim} anoFim={anoFim} modoAUM={modoAUM} aumLegadoTotal={aumLegadoTotal} clientesQueimando={clientesQueimando} rebateEmRiscoTotal={rebateEmRiscoTotal} projecao={projecaoDisplay} mesesNoPeriodo={mesesNoPeriodo} aumInicialPeriodo={aumInicialPeriodo} onAbrirBurnDetalhe={() => setBurnModalAberto(true)} onAbrirProjecao={() => setProjecaoModalAberto(true)} />}

      {burnModalAberto && (
        <BurnRateModal
          clientes={clientesEmBurnMM6}
          periodoInicio={{ mes: mesInicio, ano: anoInicio }}
          periodoFim={{ mes: mesFim, ano: anoFim }}
          anoFim={anoFim}
          onFechar={() => setBurnModalAberto(false)} />
      )}

      {projecaoModalAberto && (
        <ProjecaoModal
          clientes={mm6Clientes}
          consolidado={projecaoConsolidada}
          periodoInicio={{ mes: mesInicio, ano: anoInicio }}
          periodoFim={{ mes: mesFim, ano: anoFim }}
          anoFim={anoFim}
          onFechar={() => setProjecaoModalAberto(false)} />
      )}
      {!loading && <PoupancaMeta metaAUM={metaAUM} setMetaAUM={setMetaAUM} metaNNM={metaNNM} setMetaNNM={setMetaNNM} metasPeriodo={metasPeriodo} setMetasPeriodo={setMetasPeriodo} totais={totais} historico={historico} historicoMeta={historicoMetaCumprimento} modoAUM={modoAUM} aumLegadoTotal={aumLegadoTotal} />}
      {!loading && <PoupancaChart dados={historico} metaAUM={metaAUM} totais={totais} mesFim={mesFim} anoFim={anoFim} serieAumProjetadaMM6={serieProjetadaDisplay} modoAUM={modoAUM} aumLegadoTotal={aumLegadoTotal} />}
      {!loading && <PoupancaMetaChart dados={historicoMetaCumprimento} metaAUM={metaAUM} serieAumOrganicoEsperado={serieAumOrganicoEsperado} serieAumRitmoAtual={serieAumRitmoAtual} serieMetaTrajetoria={serieMetaTrajetoria} coberturaCapacidade={coberturaCapacidade} />}

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
            <PoupancaTabela registrosPorCliente={registrosPorCliente}
              registroAnteriorPorCliente={registroAnteriorPorCliente}
              metaNNM={metaNNM}
              numeroMeses={(anoFim * 12 + mesFim) - (anoInicio * 12 + mesInicio) + 1}
              clientesSemBanker={clientesSemBanker}
              onClienteClick={handleClienteClick}
              periodoLabel={`${MESES_LABEL[mesInicio - 1]}/${anoInicio} a ${MESES_LABEL[mesFim - 1]}/${anoFim}`}
              estaMarcado={estaMarcado}
              onToggleRevisao={toggleCliente}
              onOrdenadosChange={setNomesOrdenados} />
          )}

          {visualizacao === 'banker' && (
            <BankerVisao registrosPorCliente={registrosPorCliente}
              clientesComBanker={dadosPeriodo?.clientes ?? []}
              mesInicio={mesInicio} anoInicio={anoInicio} mesFim={mesFim} anoFim={anoFim} />
          )}
        </div>
      )}

      <PoupancaClienteDetalhe
        registros={registrosDetalhe}
        onFechar={() => { setRegistrosDetalhe([]); recarregar(); }}
        temAnterior={temAnterior}
        temProximo={temProximo}
        posicaoTexto={posicaoTexto}
        onNavegar={handleNavegar}
        marcadoRevisao={nomeAberto ? estaMarcado(nomeAberto) : false}
        onToggleRevisaoCliente={handleToggleRevisaoCliente}
        onToggleRevisaoMes={(ano, mes, estadoAtual) =>
          toggleMes(nomeAberto, ano, mes, estadoAtual)
        }
      />

      {validacaoAberta && (
        <AgenteValidacao
          onFechar={() => setValidacaoAberta(false)}
          onAbrirCliente={(nome) => {
            const regs = registrosPorCliente.get(nome);
            if (!regs) return;
            setRegistrosDetalhe(regs);
            setValidacaoAberta(false);
          }}
        />
      )}
    </div>
  );
}
