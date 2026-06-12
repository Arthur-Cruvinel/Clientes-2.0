// --- Gerador de Propostas (prospect/simulação) — Parte 2 ---
// EFÊMERO: não persiste nada (BACKLOG: salvar propostas).
//
// Aproximações (prospect não tem vínculos nem folha própria — documentado na UI):
//  - custo direto = Σ horas_reais_função × custo_hora MÉDIO da função (média
//    ponderada por percentual_alocavel dos colaboradores alocáveis da função no
//    período corrente). No cliente real o custo vem de pct×custo do colaborador
//    específico — aqui é uma estimativa pela hora média.
//  - overhead = custo_direto × (pool geral ÷ Σ custo direto do período) — a MESMA
//    proporção do rateio real do motor.
//  - rebate = regra por perna do motor (taxas + alíquotas + split globais).
//  - jurídico/conciliação NÃO são estimados nesta v1 (dependem de peso/volume).

import { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../state/AppContext';
import { calcularHorasReais } from '../../utils/financials';
import { custoHoraMedioPorFuncao, overheadRatioPeriodo, custoDiretoDemanda } from './precificacaoBase';
import { salvarProposta, buscarPropostas, atualizarPropostaStatus, excluirProposta } from '../../services/firebase';
import { gerarPropostaHTML } from './propostaTemplate';
import { ALIQUOTAS, FUNCOES_ALOCACAO } from '../../utils/constants';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { Cliente, FuncaoAlocacao, PacoteServico, RegimeTributario, DadosProposta, PropostaInputs, PropostaOutputs } from '../../types';

const LABEL_F: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Financeira', operacional_financeiro: 'Operacional',
  serv_adm: 'Adm.', serv_aux_adm: 'Aux. Adm.',
};
const PACOTES: PacoteServico[] = ['full', 'advanced', 'light', 'future', 'asset_only'];
const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };

function Num({ label, v, set, step = 1 }: { label: string; v: number; set: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px]" style={{ color: '#6b6b8a' }}>{label}</span>
      <input type="number" step={step} value={v} onChange={e => set(Number(e.target.value))} className={INP} style={BRD} />
    </label>
  );
}
function Chk({ label, v, set }: { label: string; v: boolean; set: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#160F41' }}>
      <input type="checkbox" checked={v} onChange={e => set(e.target.checked)} /> {label}
    </label>
  );
}

export interface PrefillProposta {
  tipo: 'prospect' | 'cliente_existente';
  nome: string;
  id_estavel_cliente?: string;
  inputs: Partial<PropostaInputs>;
}

export function GeradorProposta({ prefill }: { prefill?: PrefillProposta }) {
  const { dadosPeriodo, regime: regimeGlobal, parametros } = useApp();

  const [pacote, setPacote] = useState<PacoteServico>('full');
  const [regime, setRegime] = useState<RegimeTributario>(regimeGlobal);
  const [veic, setVeic] = useState(0); const [imov, setImov] = useState(0);
  const [grupos, setGrupos] = useState(1); const [domest, setDomest] = useState(0);
  const [planTrib, setPlanTrib] = useState(false); const [revContr, setRevContr] = useState(false); const [obra, setObra] = useState(false);
  const [usaJur, setUsaJur] = useState(false); const [usaConc, setUsaConc] = useState(false);
  const [volMov, setVolMov] = useState(0); const [contratacoes, setContratacoes] = useState(0); const [recebiveis, setRecebiveis] = useState(0);
  const [contas, setContas] = useState(0);
  const [plOn, setPlOn] = useState(0); const [plOff, setPlOff] = useState(0);
  const [taxaOn, setTaxaOn] = useState((parametros.taxa_rebate_onshore ?? 0) * 100);
  const [taxaOff, setTaxaOff] = useState((parametros.taxa_rebate_offshore ?? 0) * 100);
  const [dContab, setDContab] = useState(0); const [dPgto, setDPgto] = useState(0); const [dAdm, setDAdm] = useState(0); const [dViagem, setDViagem] = useState(0);
  // Meta + campos do template + persistência.
  const [tipo, setTipo] = useState<'prospect' | 'cliente_existente'>('prospect');
  const [nomeProspect, setNomeProspect] = useState('');
  const [idEstavelCliente, setIdEstavelCliente] = useState<string | undefined>();
  const [textoIntro, setTextoIntro] = useState('');
  const [imagemCapa, setImagemCapa] = useState('');
  const [textoEscopo, setTextoEscopo] = useState('');
  const [valorProposto, setValorProposto] = useState(0);
  const [feeAtual, setFeeAtual] = useState(0);
  const [editId, setEditId] = useState<string | undefined>();
  const [propostas, setPropostas] = useState<DadosProposta[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const buildInputs = (): PropostaInputs => ({
    pacote, regime, qtd_veiculos: veic, qtd_imoveis: imov, grupos_financeiros: grupos, qtd_funcionarios_domesticos: domest,
    planejamento_tributario: planTrib, revisao_contratos: revContr, gestao_obra: obra,
    utiliza_servico_juridico: usaJur, utiliza_conciliacao: usaConc,
    volume_movimentos_mes: volMov, qtd_contratacoes_mes: contratacoes, qtd_recebiveis_mes: recebiveis,
    qtd_contas_bancarias: contas,
    pl_onshore: plOn, pl_offshore: plOff, taxa_rebate_onshore: taxaOn, taxa_rebate_offshore: taxaOff,
    dedic_contabilidade: dContab, dedic_pagamento: dPgto, dedic_administrativo: dAdm, dedic_viagem: dViagem,
    texto_introducao: textoIntro, imagem_capa_url: imagemCapa, texto_escopo_adicional: textoEscopo,
    valor_proposto: valorProposto, fee_atual: feeAtual,
  });
  const aplicarInputs = (i: Partial<PropostaInputs>) => {
    if (i.pacote) setPacote(i.pacote); if (i.regime) setRegime(i.regime);
    setVeic(i.qtd_veiculos ?? 0); setImov(i.qtd_imoveis ?? 0); setGrupos(i.grupos_financeiros ?? 1); setDomest(i.qtd_funcionarios_domesticos ?? 0);
    setPlanTrib(!!i.planejamento_tributario); setRevContr(!!i.revisao_contratos); setObra(!!i.gestao_obra);
    setUsaJur(!!i.utiliza_servico_juridico); setUsaConc(!!i.utiliza_conciliacao);
    setVolMov(i.volume_movimentos_mes ?? 0); setContratacoes(i.qtd_contratacoes_mes ?? 0); setRecebiveis(i.qtd_recebiveis_mes ?? 0);
    setContas(i.qtd_contas_bancarias ?? 0);
    setPlOn(i.pl_onshore ?? 0); setPlOff(i.pl_offshore ?? 0);
    if (i.taxa_rebate_onshore != null) setTaxaOn(i.taxa_rebate_onshore); if (i.taxa_rebate_offshore != null) setTaxaOff(i.taxa_rebate_offshore);
    setDContab(i.dedic_contabilidade ?? 0); setDPgto(i.dedic_pagamento ?? 0); setDAdm(i.dedic_administrativo ?? 0); setDViagem(i.dedic_viagem ?? 0);
    setTextoIntro(i.texto_introducao ?? ''); setImagemCapa(i.imagem_capa_url ?? ''); setTextoEscopo(i.texto_escopo_adicional ?? '');
    setValorProposto(i.valor_proposto ?? 0); setFeeAtual(i.fee_atual ?? 0);
  };

  useEffect(() => { buscarPropostas().then(setPropostas).catch(() => {}); }, []);
  // Prefill vindo do upsell (aba Reajustes → "Gerar proposta").
  useEffect(() => {
    if (!prefill) return;
    setTipo(prefill.tipo); setNomeProspect(prefill.nome); setIdEstavelCliente(prefill.id_estavel_cliente);
    setEditId(undefined); aplicarInputs(prefill.inputs);
  }, [prefill]);

  const prop = useMemo(() => {
    if (!dadosPeriodo) return null;
    const { colaboradores, custosIndiretos, resultados, clientes, vinculos } = dadosPeriodo;

    // Mesma base do diagnóstico da Parte 1 (motor único — precificacaoBase).
    const custoHoraMedio = custoHoraMedioPorFuncao(colaboradores);
    const overheadRatio = overheadRatioPeriodo(colaboradores, custosIndiretos, clientes, vinculos, resultados);

    const cliente: Cliente = {
      nome_cliente: 'Proposta', pacote_servico: pacote, receita_fee: 0,
      percentual_rebate_anual_onshore: taxaOn / 100, percentual_rebate_anual_offshore: taxaOff / 100,
      utiliza_servico_juridico: usaJur, utiliza_conciliacao: usaConc,
      pct_consultoria_gestao: 0, pct_consultoria_planejamento: 0, pct_consultoria_financeira: 0,
      pct_operacional_financeiro: 0, pct_serv_adm: 0, pct_serv_aux_adm: 0,
      volume_movimentos_mes: volMov, qtd_recebiveis_mes: recebiveis, qtd_contratacoes_mes: contratacoes,
      perfil_complexidade: {
        grupos_financeiros: grupos, qtd_veiculos: veic, qtd_imoveis: imov, qtd_funcionarios_domesticos: domest,
        planejamento_tributario: planTrib, revisao_contratos: revContr, gestao_obra: obra,
      },
    } as Cliente;

    const horas = calcularHorasReais(cliente, cliente.perfil_complexidade!);
    const porFuncao = FUNCOES_ALOCACAO.map(f => {
      const h = horas.por_funcao[f] ?? 0; const ch = custoHoraMedio[f] ?? 0;
      return { f, horas: h, custoHora: ch, custo: h * ch };
    });
    const custoDireto = custoDiretoDemanda(horas.por_funcao, custoHoraMedio);
    const dedicados = dContab + dPgto + dAdm + dViagem;
    const overhead = custoDireto * overheadRatio;
    const custoTotal = custoDireto + dedicados + overhead;

    const aliqOn = parametros.aliquota_rebate_onshore, aliqOff = parametros.aliquota_rebate_offshore, split = parametros.split_plataforma;
    const rebate = ((plOn * (taxaOn / 100)) / 12 * (1 - aliqOn) + (plOff * (taxaOff / 100)) / 12 * (1 - aliqOff)) * split;

    const aliqFat = ALIQUOTAS[regime].faturamento, margem = parametros.margem_alvo;
    const denom = 1 - aliqFat - margem;
    const receitaNecessaria = denom > 0 ? custoTotal / denom : 0;
    const feeSugerido = receitaNecessaria - rebate;

    return { porFuncao, custoDireto, dedicados, overhead, overheadRatio, custoTotal, rebate, receitaNecessaria, feeSugerido, margem, aliqFat, denomInvalido: denom <= 0, alertas: horas.alertas, totalHoras: horas.total };
  }, [dadosPeriodo, pacote, regime, veic, imov, grupos, domest, planTrib, revContr, obra, usaJur, usaConc, volMov, contratacoes, recebiveis, plOn, plOff, taxaOn, taxaOff, dContab, dPgto, dAdm, dViagem, parametros]);

  const buildOutputs = (): PropostaOutputs => ({
    porFuncao: (prop?.porFuncao ?? []).map(x => ({ funcao: x.f, horas: x.horas, custoHora: x.custoHora, custo: x.custo })),
    custoDireto: prop?.custoDireto ?? 0, dedicados: prop?.dedicados ?? 0, overhead: prop?.overhead ?? 0,
    custoTotal: prop?.custoTotal ?? 0, rebate: prop?.rebate ?? 0, receitaNecessaria: prop?.receitaNecessaria ?? 0, feeSugerido: prop?.feeSugerido ?? 0,
  });

  async function salvar() {
    if (!nomeProspect.trim()) { setToast('Informe o nome do prospect/cliente.'); return; }
    setSalvando(true);
    try {
      const now = new Date().toISOString();
      const idEst = editId ?? crypto.randomUUID();
      const ant = editId ? propostas.find(p => p.id_estavel === editId) : undefined;
      const dados: DadosProposta = {
        id_estavel: idEst, criado_em: ant?.criado_em ?? now, atualizado_em: now,
        status: ant?.status ?? 'rascunho', tipo, nome_prospect: nomeProspect.trim(), id_estavel_cliente: idEstavelCliente,
        inputs: buildInputs(), outputs: buildOutputs(), valor_proposto: valorProposto,
      };
      await salvarProposta(dados);
      setEditId(idEst);
      setPropostas(await buscarPropostas());
      setToast('Proposta salva (snapshot da época).'); setTimeout(() => setToast(null), 3500);
    } finally { setSalvando(false); }
  }
  function reabrir(p: DadosProposta) {
    setTipo(p.tipo); setNomeProspect(p.nome_prospect); setIdEstavelCliente(p.id_estavel_cliente);
    setEditId(p.id_estavel); aplicarInputs(p.inputs);
  }
  function duplicar(p: DadosProposta) {
    setTipo(p.tipo); setNomeProspect(`${p.nome_prospect} (cópia)`); setIdEstavelCliente(p.id_estavel_cliente);
    setEditId(undefined); aplicarInputs(p.inputs);
  }
  async function mudarStatus(p: DadosProposta, status: DadosProposta['status']) {
    await atualizarPropostaStatus(p.id_estavel, status); setPropostas(await buscarPropostas());
  }
  async function remover(p: DadosProposta) {
    if (!confirm(`Excluir a proposta de ${p.nome_prospect}?`)) return;
    await excluirProposta(p.id_estavel); if (editId === p.id_estavel) setEditId(undefined); setPropostas(await buscarPropostas());
  }
  function novo() { setEditId(undefined); setNomeProspect(''); setIdEstavelCliente(undefined); aplicarInputs({}); }

  function gerar() {
    const data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const html = gerarPropostaHTML({
      nome: nomeProspect.trim() || 'Cliente', tipo, data,
      textoIntroducao: textoIntro, imagemCapaUrl: imagemCapa,
      valorProposto: valorProposto > 0 ? valorProposto : Math.round((prop?.feeSugerido ?? 0) / 50) * 50,
      feeAtual, pacote,
      usaJuridico: usaJur, usaConciliacao: usaConc, planejamentoTributario: planTrib, revisaoContratos: revContr,
      qtdVeiculos: veic, qtdImoveis: imov, gruposFinanceiros: grupos, qtdFuncionariosDomesticos: domest,
      volumeMovimentos: volMov, qtdContasBancarias: contas, qtdRecebiveis: recebiveis, qtdContratacoes: contratacoes,
      dedicViagem: dViagem, plTotal: plOn + plOff, textoEscopoAdicional: textoEscopo,
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* FORM */}
      <div className="space-y-4">
        {/* Meta + persistência */}
        <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: '#e2e2e8' }}>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Tipo</span>
              <select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)} className={INP} style={BRD}>
                <option value="prospect">Prospect</option><option value="cliente_existente">Cliente existente</option>
              </select>
            </label>
            <Num label="Valor proposto (R$/mês)" v={valorProposto} set={setValorProposto} step={50} />
          </div>
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Nome do {tipo === 'prospect' ? 'prospect' : 'cliente'}</span>
            <input value={nomeProspect} onChange={e => setNomeProspect(e.target.value)} className={INP} style={BRD} />
          </label>
          {prop && valorProposto <= 0 && prop.feeSugerido > 0 && (
            <button type="button" onClick={() => setValorProposto(Math.round(prop.feeSugerido / 50) * 50)}
              className="text-[11px] underline" style={{ color: '#0065FF' }}>↑ usar fee sugerido arredondado ({formatCurrency(prop.feeSugerido)})</button>
          )}
          {tipo === 'cliente_existente' && <Num label="Fee atual (composição aditiva)" v={feeAtual} set={setFeeAtual} step={50} />}
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Texto de introdução (editável)</span>
            <textarea value={textoIntro} onChange={e => setTextoIntro(e.target.value)} rows={3} className={INP} style={BRD}
              placeholder="Default gerado por nome/contexto se vazio." />
          </label>
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Imagem da capa (URL — vazio = capa-padrão escura com logo central)</span>
            <input value={imagemCapa} onChange={e => setImagemCapa(e.target.value)} className={INP} style={BRD} placeholder="https://…" />
            <span className="text-[10px]" style={{ color: '#9ca3af' }}>Use imagem em alta resolução (mínimo ~1600px de largura); imagens pequenas ficam ruins na capa.</span>
          </label>
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Escopo — observações adicionais (opcional; entra como bloco na pág. de investimento)</span>
            <textarea value={textoEscopo} onChange={e => setTextoEscopo(e.target.value)} rows={2} className={INP} style={BRD}
              placeholder="Ex.: ressalvas, exceções, condições específicas deste cliente." />
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={salvar} disabled={salvando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? 'Salvando…' : editId ? 'Atualizar proposta' : 'Salvar proposta'}
            </button>
            <button onClick={novo} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Nova</button>
            <button onClick={gerar} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #0065FF', color: '#0065FF' }}>Gerar proposta ↗</button>
            {toast && <span className="text-xs self-center" style={{ color: '#166534' }}>{toast}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Pacote</span>
            <select value={pacote} onChange={e => setPacote(e.target.value as PacoteServico)} className={INP} style={BRD}>
              {PACOTES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Regime</span>
            <select value={regime} onChange={e => setRegime(e.target.value as RegimeTributario)} className={INP} style={BRD}>
              <option value="presumido">Presumido</option><option value="real">Real</option>
            </select>
          </label>
        </div>

        <Secao titulo="Perfil de complexidade (fixo)">
          <Num label="Veículos" v={veic} set={setVeic} /><Num label="Imóveis" v={imov} set={setImov} />
          <Num label="Grupos financeiros" v={grupos} set={setGrupos} /><Num label="Func. domésticos" v={domest} set={setDomest} />
        </Secao>
        <div className="flex flex-wrap gap-4">
          <Chk label="Planej. tributário" v={planTrib} set={setPlanTrib} /><Chk label="Revisão contratos" v={revContr} set={setRevContr} />
          <Chk label="Gestão de obra" v={obra} set={setObra} /><Chk label="Serv. jurídico" v={usaJur} set={setUsaJur} /><Chk label="Conciliação" v={usaConc} set={setUsaConc} />
        </div>

        <Secao titulo="Volumetria mensal — alimenta: mov.→pagamentos/fluxo; contratações→indicação; recebíveis→conciliação">
          <Num label="Movimentos / mês" v={volMov} set={setVolMov} /><Num label="Contratações / mês" v={contratacoes} set={setContratacoes} />
          <Num label="Recebíveis / mês" v={recebiveis} set={setRecebiveis} /><Num label="Contas bancárias" v={contas} set={setContas} />
        </Secao>

        <Secao titulo="Patrimônio (rebate) e taxas">
          <Num label="PL onshore (R$)" v={plOn} set={setPlOn} step={1000} /><Num label="PL offshore (R$)" v={plOff} set={setPlOff} step={1000} />
          <Num label="Taxa rebate on (% a.a.)" v={taxaOn} set={setTaxaOn} step={0.01} /><Num label="Taxa rebate off (% a.a.)" v={taxaOff} set={setTaxaOff} step={0.01} />
        </Secao>
        <Secao titulo="Custos dedicados estimados (R$/mês)">
          <Num label="Contabilidade" v={dContab} set={setDContab} step={0.01} /><Num label="Plataforma pgto" v={dPgto} set={setDPgto} step={0.01} />
          <Num label="Administrativo" v={dAdm} set={setDAdm} step={0.01} /><Num label="Viagem" v={dViagem} set={setDViagem} step={0.01} />
        </Secao>
      </div>

      {/* SAÍDA */}
      <div className="space-y-3">
        {!prop ? <p className="text-sm" style={{ color: '#6b6b8a' }}>Selecione um período.</p> : prop.denomInvalido ? (
          <p className="text-sm" style={{ color: '#991b1b' }}>Margem alvo + imposto ≥ 100% — ajuste a margem na aba Reajustes.</p>
        ) : (
          <>
            <div className="rounded-lg border p-4 text-center" style={{ borderColor: '#0065FF', backgroundColor: '#f0f6ff' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Fee sugerido (mensal)</p>
              <p className="text-2xl font-bold" style={{ color: prop.feeSugerido > 0 ? '#160F41' : '#166534' }}>
                {prop.feeSugerido > 0 ? formatCurrency(prop.feeSugerido) : 'Rebate cobre'}
              </p>
              {prop.feeSugerido <= 0 && <p className="text-xs" style={{ color: '#166534' }}>Excedente {formatCurrency(prop.rebate - prop.receitaNecessaria)}</p>}
              <p className="text-[11px] mt-1" style={{ color: '#6b6b8a' }}>margem alvo {formatPercent(prop.margem * 100)} · imp.fat {formatPercent(prop.aliqFat * 100)}</p>
            </div>

            <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
              <table className="min-w-full text-xs">
                <thead style={{ backgroundColor: '#f9f9fb', color: '#6b6b8a' }}>
                  <tr><th className="px-3 py-1.5 text-left font-bold">Função</th><th className="px-3 py-1.5 text-right font-bold">Horas</th><th className="px-3 py-1.5 text-right font-bold">Custo/h méd.</th><th className="px-3 py-1.5 text-right font-bold">Custo</th></tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                  {prop.porFuncao.filter(x => x.horas > 0 || x.custo > 0).map(x => (
                    <tr key={x.f}><td className="px-3 py-1.5" style={{ color: '#160F41' }}>{LABEL_F[x.f]}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: '#6b6b8a' }}>{x.horas.toFixed(1)}h</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: '#6b6b8a' }}>{formatCurrency(x.custoHora)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(x.custo)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-sm rounded-lg p-3" style={{ backgroundColor: '#f3f4f6' }}>
              <L label={`Custo direto (${prop.totalHoras.toFixed(1)}h)`} v={formatCurrency(prop.custoDireto)} />
              <L label="+ Dedicados" v={formatCurrency(prop.dedicados)} />
              <L label={`+ Overhead (×${(prop.overheadRatio).toFixed(3)} do direto)`} v={formatCurrency(prop.overhead)} />
              <L label="= Custo total" v={formatCurrency(prop.custoTotal)} forte />
              <L label="Receita necessária" v={formatCurrency(prop.receitaNecessaria)} />
              <L label="− Rebate líquido estimado" v={formatCurrency(prop.rebate)} />
              <L label="= Fee sugerido" v={prop.feeSugerido > 0 ? formatCurrency(prop.feeSugerido) : formatCurrency(prop.feeSugerido)} forte />
            </div>
            {prop.alertas.map((a, i) => <p key={i} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>⚠ {a}</p>)}
            <p className="text-[11px]" style={{ color: '#9ca3af' }}>Custo direto via hora média da função (aproximação: prospect não tem vínculos). Salvar grava um snapshot imutável.</p>
          </>
        )}
      </div>

      {/* Propostas salvas (snapshot imutável da época) */}
      <div className="lg:col-span-2 rounded-lg border p-3" style={{ borderColor: '#e2e2e8' }}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>Propostas salvas ({propostas.length})</p>
        {propostas.length === 0 ? (
          <p className="text-xs" style={{ color: '#9ca3af' }}>Nenhuma proposta salva ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead style={{ color: '#6b6b8a' }}>
                <tr><th className="text-left py-1">Nome</th><th className="text-left py-1">Tipo</th><th className="text-left py-1">Criada</th><th className="text-right py-1">Valor</th><th className="text-left py-1">Status</th><th className="text-right py-1">Ações</th></tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {propostas.map(p => (
                  <tr key={p.id_estavel} style={{ backgroundColor: editId === p.id_estavel ? '#f0f6ff' : undefined }}>
                    <td className="py-1.5 font-medium" style={{ color: '#160F41' }}>{p.nome_prospect}</td>
                    <td className="py-1.5" style={{ color: '#6b6b8a' }}>{p.tipo === 'prospect' ? 'Prospect' : 'Existente'}</td>
                    <td className="py-1.5" style={{ color: '#6b6b8a' }}>{(p.criado_em ?? '').slice(0, 10)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(p.valor_proposto)}</td>
                    <td className="py-1.5">
                      <select value={p.status} onChange={e => mudarStatus(p, e.target.value as DadosProposta['status'])}
                        className="rounded px-1 py-0.5 text-[11px]" style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
                        <option value="rascunho">Rascunho</option><option value="enviada">Enviada</option>
                        <option value="aceita">Aceita</option><option value="recusada">Recusada</option>
                      </select>
                    </td>
                    <td className="py-1.5 text-right space-x-2">
                      <button onClick={() => reabrir(p)} className="underline" style={{ color: '#0065FF' }}>Reabrir</button>
                      <button onClick={() => duplicar(p)} className="underline" style={{ color: '#6b6b8a' }}>Duplicar</button>
                      <button onClick={() => remover(p)} className="underline" style={{ color: '#991b1b' }}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b8a' }}>{titulo}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
function L({ label, v, forte }: { label: string; v: string; forte?: boolean }) {
  return <div className="flex justify-between"><span style={{ color: '#6b6b8a' }}>{label}</span><span className={forte ? 'font-bold' : ''} style={{ color: '#160F41' }}>{v}</span></div>;
}
