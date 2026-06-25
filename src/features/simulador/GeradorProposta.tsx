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
import { calcularFee } from './calcularFee';
import { salvarProposta, buscarPropostas, atualizarPropostaStatus, excluirProposta } from '../../services/firebase';
import { gerarPropostaHTML } from './propostaTemplate';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { FuncaoAlocacao, PacoteServico, RegimeTributario, DadosProposta, PropostaInputs, PropostaOutputs } from '../../types';

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
// Campo INCREMENTAL do aditivo: mostra o valor atual (baseline) como referência
// e um input "+X" (começa em 0 = nada adicionado).
function AdicaoNum({ label, atual, v, set }: { label: string; atual: number | string; v: number; set: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px]" style={{ color: '#6b6b8a' }}>{label} <span style={{ color: '#9ca3af' }}>· atual {atual}</span></span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-bold" style={{ color: '#0065FF' }}>＋</span>
        <input type="number" min={0} step={1} value={v} onChange={e => set(Math.max(0, Number(e.target.value)))}
          className="rounded px-2 py-1.5 text-sm w-full" style={BRD} />
      </div>
    </label>
  );
}

export interface PrefillProposta {
  tipo: 'prospect' | 'cliente_existente';
  nome: string;
  id_estavel_cliente?: string;
  inputs: Partial<PropostaInputs>;
}

// Snapshot do ESCOPO (subconjunto de CalcularFeeInputs editável no form). Usado
// como baseline imutável (escopo atual) e como ampliado (cópia editável) no
// aditivo Forma 1: delta = motor(ampliado) − motor(baseline).
interface ScopeSnapshot {
  pacote: PacoteServico; veic: number; imov: number; grupos: number; domest: number;
  planTrib: boolean; revContr: boolean; obra: boolean; usaJur: boolean; usaConc: boolean;
  volMov: number; contratacoes: number; recebiveis: number; demandasJur: number;
  plOn: number; plOff: number; taxaOn: number; taxaOff: number;
  dContab: number; dPgto: number; dAdm: number; dViagem: number;
}

// Incrementos do aditivo (Forma 2): QUANTO A MAIS de cada driver ordinário o
// CFO adiciona. ampliado = baseline + incrementos. Conciliação NÃO é campo —
// acompanha movimento (regra automática). Pacote/PL/taxas/dedicados/flags não
// são adicionáveis neste lote (recalibração/serviços específicos = futuro).
interface Incrementos {
  volMov: number; recebiveis: number; contratacoes: number;
  imov: number; veic: number; domest: number; grupos: number;
  demandasJur: number;
}
const ZERO_INC: Incrementos = { volMov: 0, recebiveis: 0, contratacoes: 0, imov: 0, veic: 0, domest: 0, grupos: 0, demandasJur: 0 };

// ampliado = baseline + incrementos (campo a campo). Conciliação derivada:
// movimento (baseline + incremento) > 0 → conciliação on. Jurídico on se há
// demandas (baseline ou adicionadas).
function ampliar(base: ScopeSnapshot, inc: Incrementos): ScopeSnapshot {
  const volMov = base.volMov + inc.volMov;
  const demandasJur = base.demandasJur + inc.demandasJur;
  return {
    ...base,
    volMov, recebiveis: base.recebiveis + inc.recebiveis, contratacoes: base.contratacoes + inc.contratacoes,
    imov: base.imov + inc.imov, veic: base.veic + inc.veic, domest: base.domest + inc.domest, grupos: base.grupos + inc.grupos,
    demandasJur,
    usaConc: volMov > 0,                       // conciliação automática (acompanha movimento)
    usaJur: base.usaJur || demandasJur > 0,    // jurídico on se há demandas
  };
}

// "Inclui: …" do documento — literais dos incrementos > 0.
function derivarAdicoesInc(inc: Incrementos): string[] {
  const a: string[] = [];
  if (inc.demandasJur > 0) a.push(`jurídico consultivo até ${inc.demandasJur} demanda${inc.demandasJur === 1 ? '' : 's'}/mês`);
  if (inc.volMov > 0) a.push(`+${inc.volMov} movimentações/mês (pagamentos, conciliação, fluxo)`);
  if (inc.recebiveis > 0) a.push(`+${inc.recebiveis} recebível(is)/mês`);
  if (inc.contratacoes > 0) a.push(`+${inc.contratacoes} contratação(ões)/mês`);
  if (inc.imov > 0) a.push(`+${inc.imov} imóvel(is)`);
  if (inc.veic > 0) a.push(`+${inc.veic} veículo(s)`);
  if (inc.domest > 0) a.push(`+${inc.domest} funcionário(s) doméstico(s)`);
  if (inc.grupos > 0) a.push(`+${inc.grupos} grupo(s) financeiro(s)`);
  return a;
}

// Chaves dos itens NOVOS p/ selo "Novo" nos pilares do documento.
function itensNovosInc(inc: Incrementos): string[] {
  const k: string[] = [];
  if (inc.demandasJur > 0) k.push('juridico');
  if (inc.volMov > 0 || inc.recebiveis > 0) k.push('movimentos');   // financeiro/conciliação
  if (inc.imov > 0) k.push('imoveis');
  if (inc.veic > 0) k.push('veiculos');
  if (inc.domest > 0) k.push('domesticos');
  return k;
}

export function GeradorProposta({ prefill }: { prefill?: PrefillProposta }) {
  const { dadosPeriodo, regime: regimeGlobal, parametros } = useApp();

  const [pacote, setPacote] = useState<PacoteServico>('full');
  const [regime, setRegime] = useState<RegimeTributario>(regimeGlobal);
  const [veic, setVeic] = useState(0); const [imov, setImov] = useState(0);
  const [grupos, setGrupos] = useState(1); const [domest, setDomest] = useState(0);
  const [planTrib, setPlanTrib] = useState(false); const [revContr, setRevContr] = useState(false); const [obra, setObra] = useState(false);
  const [usaJur, setUsaJur] = useState(false); const [usaConc, setUsaConc] = useState(false);
  const [demandasJur, setDemandasJur] = useState(0);  // N demandas jurídicas consultivas/mês
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
  const [validadeDias, setValidadeDias] = useState(15);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [valorProposto, setValorProposto] = useState(0);
  const [feeAtual, setFeeAtual] = useState(0);
  // Escopo atual do cliente (aditivo) — snapshot IMUTÁVEL capturado no prefill.
  // null = sem cliente selecionado / modo prospect.
  const [baseline, setBaseline] = useState<ScopeSnapshot | null>(null);
  // Incrementos do aditivo (quanto a mais de cada driver). ampliado = baseline + inc.
  const [inc, setInc] = useState<Incrementos>(ZERO_INC);
  const [editId, setEditId] = useState<string | undefined>();
  const [propostas, setPropostas] = useState<DadosProposta[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);  // gera PDF via Netlify Function (PDFShift)

  const buildInputs = (): PropostaInputs => ({
    pacote, regime, qtd_veiculos: veic, qtd_imoveis: imov, grupos_financeiros: grupos, qtd_funcionarios_domesticos: domest,
    planejamento_tributario: planTrib, revisao_contratos: revContr, gestao_obra: obra,
    utiliza_servico_juridico: usaJur, utiliza_conciliacao: usaConc,
    qtd_demandas_juridicas_mes: demandasJur,
    volume_movimentos_mes: volMov, qtd_contratacoes_mes: contratacoes, qtd_recebiveis_mes: recebiveis,
    qtd_contas_bancarias: contas,
    pl_onshore: plOn, pl_offshore: plOff, taxa_rebate_onshore: taxaOn, taxa_rebate_offshore: taxaOff,
    dedic_contabilidade: dContab, dedic_pagamento: dPgto, dedic_administrativo: dAdm, dedic_viagem: dViagem,
    texto_introducao: textoIntro, imagem_capa_url: imagemCapa, texto_escopo_adicional: textoEscopo,
    validade_dias: validadeDias, dia_vencimento: diaVencimento, valor_proposto: valorProposto, fee_atual: feeAtual,
  });
  const aplicarInputs = (i: Partial<PropostaInputs>) => {
    if (i.pacote) setPacote(i.pacote); if (i.regime) setRegime(i.regime);
    setVeic(i.qtd_veiculos ?? 0); setImov(i.qtd_imoveis ?? 0); setGrupos(i.grupos_financeiros ?? 1); setDomest(i.qtd_funcionarios_domesticos ?? 0);
    setPlanTrib(!!i.planejamento_tributario); setRevContr(!!i.revisao_contratos); setObra(!!i.gestao_obra);
    setUsaJur(!!i.utiliza_servico_juridico); setUsaConc(!!i.utiliza_conciliacao);
    setDemandasJur(i.qtd_demandas_juridicas_mes ?? 0);   // snapshots pré-feature → 0 (retrocompat)
    setVolMov(i.volume_movimentos_mes ?? 0); setContratacoes(i.qtd_contratacoes_mes ?? 0); setRecebiveis(i.qtd_recebiveis_mes ?? 0);
    setContas(i.qtd_contas_bancarias ?? 0);
    setPlOn(i.pl_onshore ?? 0); setPlOff(i.pl_offshore ?? 0);
    if (i.taxa_rebate_onshore != null) setTaxaOn(i.taxa_rebate_onshore); if (i.taxa_rebate_offshore != null) setTaxaOff(i.taxa_rebate_offshore);
    setDContab(i.dedic_contabilidade ?? 0); setDPgto(i.dedic_pagamento ?? 0); setDAdm(i.dedic_administrativo ?? 0); setDViagem(i.dedic_viagem ?? 0);
    setTextoIntro(i.texto_introducao ?? ''); setImagemCapa(i.imagem_capa_url ?? ''); setTextoEscopo(i.texto_escopo_adicional ?? '');
    setValidadeDias(i.validade_dias ?? 15);   // snapshots velhos → 15
    setDiaVencimento(i.dia_vencimento ?? 10);  // snapshots velhos → 10
    setValorProposto(i.valor_proposto ?? 0); setFeeAtual(i.fee_atual ?? 0);
  };

  // Lista de clientes do período para o seletor do modo "cliente existente".
  const nomesClientes = useMemo(() =>
    [...(dadosPeriodo?.clientes ?? [])].map(c => c.nome_cliente).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [dadosPeriodo]);

  // Prefill REAL do cliente existente (mesma fonte do upsell de Reajustes):
  // puxa cadastro + perfil + volumetria + flags + rebate + dedicados + PL +
  // fee_atual. contas e N jurídico ficam em 0 (sem fonte no cadastro; N=0 é o
  // correto para aditivo — é o serviço que está sendo vendido, o CFO digita).
  // ScopeSnapshot a partir de um Partial<PropostaInputs> (mesmas chaves do form).
  const scopeFromInputs = (i: Partial<PropostaInputs>): ScopeSnapshot => ({
    pacote: i.pacote ?? 'full', veic: i.qtd_veiculos ?? 0, imov: i.qtd_imoveis ?? 0,
    grupos: i.grupos_financeiros ?? 1, domest: i.qtd_funcionarios_domesticos ?? 0,
    planTrib: !!i.planejamento_tributario, revContr: !!i.revisao_contratos, obra: !!i.gestao_obra,
    usaJur: !!i.utiliza_servico_juridico, usaConc: !!i.utiliza_conciliacao,
    volMov: i.volume_movimentos_mes ?? 0, contratacoes: i.qtd_contratacoes_mes ?? 0, recebiveis: i.qtd_recebiveis_mes ?? 0,
    demandasJur: i.qtd_demandas_juridicas_mes ?? 0,
    plOn: i.pl_onshore ?? 0, plOff: i.pl_offshore ?? 0, taxaOn: i.taxa_rebate_onshore ?? 0, taxaOff: i.taxa_rebate_offshore ?? 0,
    dContab: i.dedic_contabilidade ?? 0, dPgto: i.dedic_pagamento ?? 0, dAdm: i.dedic_administrativo ?? 0, dViagem: i.dedic_viagem ?? 0,
  });

  function selecionarClienteExistente(nome: string) {
    setNomeProspect(nome);
    setInc(ZERO_INC);
    if (!nome) { setIdEstavelCliente(undefined); setBaseline(null); return; }
    const cli = dadosPeriodo?.clientes.find(c => c.nome_cliente === nome);
    if (!cli) return;
    const pp = dadosPeriodo?.registrosPoupanca.find(p => p.nome_cliente === nome);
    const perfil = cli.perfil_complexidade;
    const inputs: Partial<PropostaInputs> = {
      pacote: cli.pacote_servico,
      qtd_veiculos: perfil?.qtd_veiculos, qtd_imoveis: perfil?.qtd_imoveis,
      grupos_financeiros: perfil?.grupos_financeiros, qtd_funcionarios_domesticos: perfil?.qtd_funcionarios_domesticos,
      planejamento_tributario: perfil?.planejamento_tributario, revisao_contratos: perfil?.revisao_contratos, gestao_obra: perfil?.gestao_obra,
      utiliza_servico_juridico: cli.utiliza_servico_juridico, utiliza_conciliacao: cli.utiliza_conciliacao,
      volume_movimentos_mes: cli.volume_movimentos_mes, qtd_contratacoes_mes: cli.qtd_contratacoes_mes, qtd_recebiveis_mes: cli.qtd_recebiveis_mes,
      pl_onshore: pp?.pl_onshore ?? 0, pl_offshore: pp?.pl_offshore ?? 0,
      taxa_rebate_onshore: (cli.percentual_rebate_anual_onshore ?? 0) * 100, taxa_rebate_offshore: (cli.percentual_rebate_anual_offshore ?? 0) * 100,
      dedic_contabilidade: cli.custo_contabilidade_dedicado ?? 0, dedic_pagamento: cli.custo_pagamento_dedicado ?? 0,
      dedic_administrativo: cli.custo_administrativo_dedicado ?? 0, dedic_viagem: cli.custo_viagem_dedicado ?? 0,
      fee_atual: cli.receita_fee ?? 0,
      qtd_contas_bancarias: 0, qtd_demandas_juridicas_mes: 0, valor_proposto: 0,
    };
    setEditId(undefined);
    setIdEstavelCliente(cli.id_estavel);
    aplicarInputs(inputs);          // ampliado = cópia do escopo atual (editável)
    setBaseline(scopeFromInputs(inputs));  // baseline = mesmo escopo, TRAVADO
  }

  useEffect(() => { buscarPropostas().then(setPropostas).catch(() => {}); }, []);
  // Prefill vindo do upsell (aba Reajustes → "Gerar proposta").
  useEffect(() => {
    if (!prefill) return;
    setTipo(prefill.tipo); setNomeProspect(prefill.nome); setIdEstavelCliente(prefill.id_estavel_cliente);
    setEditId(undefined); aplicarInputs(prefill.inputs); setInc(ZERO_INC);
    setBaseline(prefill.tipo === 'cliente_existente' ? scopeFromInputs(prefill.inputs) : null);
  }, [prefill]);

  const prop = useMemo(() => {
    if (!dadosPeriodo) return null;
    const { colaboradores, clientes, vinculos } = dadosPeriodo;
    // Cálculo extraído para função pura (mesmo resultado; preparo do delta).
    return calcularFee({
      colaboradores, clientes, vinculos, parametros, regime,
      pacote, veic, imov, grupos, domest, planTrib, revContr, obra, usaJur, usaConc,
      volMov, contratacoes, recebiveis, demandasJur, plOn, plOff, taxaOn, taxaOff,
      dContab, dPgto, dAdm, dViagem,
    });
  }, [dadosPeriodo, pacote, regime, veic, imov, grupos, domest, planTrib, revContr, obra, usaJur, usaConc, demandasJur, volMov, contratacoes, recebiveis, plOn, plOff, taxaOn, taxaOff, dContab, dPgto, dAdm, dViagem, parametros]);

  // ── ADITIVO FORMA 1 (delta) — base (c) split ─────────────────────────────────
  // ampliado = baseline + incrementos (Forma 2). O baseline fica TRAVADO; o CFO
  // só edita `inc`. delta = motor(ampliado) − motor(baseline) — mesma régua, o
  // escopo existente e o rebate CANCELAM; sobra só o custo das adições, grossed-up.
  const feeBaseline = useMemo(() => {
    if (!dadosPeriodo || !baseline) return null;
    const { colaboradores, clientes, vinculos } = dadosPeriodo;
    return calcularFee({ colaboradores, clientes, vinculos, parametros, regime, ...baseline }).feeSugerido;
  }, [dadosPeriodo, baseline, parametros, regime]);
  const feeAmpliado = useMemo(() => {
    if (!dadosPeriodo || !baseline) return null;
    const { colaboradores, clientes, vinculos } = dadosPeriodo;
    return calcularFee({ colaboradores, clientes, vinculos, parametros, regime, ...ampliar(baseline, inc) }).feeSugerido;
  }, [dadosPeriodo, baseline, inc, parametros, regime]);
  const delta = (tipo === 'cliente_existente' && feeBaseline != null && feeAmpliado != null) ? feeAmpliado - feeBaseline : 0;
  const novoTotalAditivo = feeAtual + delta;   // sobre a receita_fee REAL (split)
  const adicoesAditivo = tipo === 'cliente_existente' ? derivarAdicoesInc(inc) : [];
  const setIncF = (k: keyof Incrementos) => (n: number) => setInc(p => ({ ...p, [k]: n }));

  const buildOutputs = (): PropostaOutputs => ({
    porFuncao: (prop?.porFuncao ?? []).map(x => ({ funcao: x.f, horas: x.horas, custoHora: x.custoHora, custo: x.custo })),
    custoDireto: prop?.custoDireto ?? 0, dedicados: prop?.dedicados ?? 0, overhead: prop?.overhead ?? 0,
    custoTotal: prop?.custoTotal ?? 0, rebate: prop?.rebate ?? 0, receitaNecessaria: prop?.receitaNecessaria ?? 0, feeSugerido: prop?.feeSugerido ?? 0,
    parcela_juridica: prop?.parcelaJuridica ?? 0,
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
    setEditId(p.id_estavel); aplicarInputs(p.inputs); setBaseline(null); setInc(ZERO_INC);
  }
  function duplicar(p: DadosProposta) {
    setTipo(p.tipo); setNomeProspect(`${p.nome_prospect} (cópia)`); setIdEstavelCliente(p.id_estavel_cliente);
    setEditId(undefined); aplicarInputs(p.inputs); setBaseline(null); setInc(ZERO_INC);
  }
  async function mudarStatus(p: DadosProposta, status: DadosProposta['status']) {
    await atualizarPropostaStatus(p.id_estavel, status); setPropostas(await buscarPropostas());
  }
  async function remover(p: DadosProposta) {
    if (!confirm(`Excluir a proposta de ${p.nome_prospect}?`)) return;
    await excluirProposta(p.id_estavel); if (editId === p.id_estavel) setEditId(undefined); setPropostas(await buscarPropostas());
  }
  function novo() { setEditId(undefined); setNomeProspect(''); setIdEstavelCliente(undefined); aplicarInputs({}); setBaseline(null); setInc(ZERO_INC); }

  async function gerar() {
    const data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    // Itens NOVOS no documento de aditivo (chaves dos incrementos > 0). Mesma
    // base da lista "Inclui:". Prospect → vazio.
    const itensNovos = tipo === 'cliente_existente' ? itensNovosInc(inc) : [];
    // Escopo que o documento renderiza: no aditivo é o AMPLIADO (baseline + inc),
    // para os pilares refletirem o novo total. No prospect, os estados do form
    // (mesmos valores → documento byte-idêntico).
    const escopoDoc: ScopeSnapshot = (tipo === 'cliente_existente' && baseline)
      ? ampliar(baseline, inc)
      : { pacote, veic, imov, grupos, domest, planTrib, revContr, obra, usaJur, usaConc, volMov, contratacoes, recebiveis, demandasJur, plOn, plOff, taxaOn, taxaOff, dContab, dPgto, dAdm, dViagem };
    const html = gerarPropostaHTML({
      nome: nomeProspect.trim() || 'Cliente', tipo, data,
      textoIntroducao: textoIntro, imagemCapaUrl: imagemCapa,
      // Headline da faixa: manual quando informado; senão o sugerido por tipo —
      // aditivo = fee_atual real + delta; prospect = fee sugerido total.
      valorProposto: valorProposto > 0 ? valorProposto
        : tipo === 'cliente_existente'
          ? Math.round(novoTotalAditivo / 50) * 50
          : Math.round((prop?.feeSugerido ?? 0) / 50) * 50,
      feeAtual, pacote: escopoDoc.pacote,
      adicoes: tipo === 'cliente_existente' ? adicoesAditivo : [],
      itensNovos,
      usaJuridico: escopoDoc.usaJur, usaConciliacao: escopoDoc.usaConc, planejamentoTributario: escopoDoc.planTrib, revisaoContratos: escopoDoc.revContr,
      qtdDemandasJuridicas: escopoDoc.demandasJur,
      qtdVeiculos: escopoDoc.veic, qtdImoveis: escopoDoc.imov, gruposFinanceiros: escopoDoc.grupos, qtdFuncionariosDomesticos: escopoDoc.domest,
      volumeMovimentos: escopoDoc.volMov, qtdContasBancarias: contas, qtdRecebiveis: escopoDoc.recebiveis, qtdContratacoes: escopoDoc.contratacoes,
      dedicViagem: escopoDoc.dViagem, plTotal: escopoDoc.plOn + escopoDoc.plOff, plOffshore: escopoDoc.plOff, textoEscopoAdicional: textoEscopo,
      validadeDias: validadeDias > 0 ? validadeDias : 15,
      diaVencimento: diaVencimento >= 1 && diaVencimento <= 28 ? diaVencimento : 10,
    }, { paraPdf: true });   // omite o botão "Imprimir" no HTML que vai pro PDF
    // Gera o PDF (tira contínua) via Netlify Function → PDFShift. A API key fica
    // protegida na function (env var). Abre o PDF retornado em nova aba.
    setGerandoPdf(true); setToast(null);
    try {
      const resp = await fetch('/.netlify/functions/gerar-pdf', { method: 'POST', body: html });
      if (!resp.ok) {
        let msg = `Erro ${resp.status}`;
        try { const j = await resp.json(); msg = j.error ?? msg; } catch { /* corpo não-JSON */ }
        setToast(`Falha ao gerar PDF: ${msg}`); setTimeout(() => setToast(null), 6000);
        return;
      }
      const url = URL.createObjectURL(await resp.blob());
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setToast(`Falha ao gerar PDF: ${e instanceof Error ? e.message : 'erro de rede'}`);
      setTimeout(() => setToast(null), 6000);
    } finally {
      setGerandoPdf(false);
    }
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
                <option value="prospect">Prospect</option><option value="cliente_existente">Aditivo de Escopo</option>
              </select>
            </label>
            <Num label="Valor proposto (R$/mês)" v={valorProposto} set={setValorProposto} step={50} />
          </div>
          {tipo === 'cliente_existente' && (
            <label className="block">
              <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Cliente existente — puxa dados do cadastro</span>
              <select value={nomesClientes.includes(nomeProspect) ? nomeProspect : ''}
                onChange={e => selecionarClienteExistente(e.target.value)} className={INP} style={BRD}>
                <option value="">Selecione um cliente…</option>
                {nomesClientes.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Nome do {tipo === 'prospect' ? 'prospect' : 'cliente'}</span>
            <input value={nomeProspect} onChange={e => setNomeProspect(e.target.value)} className={INP} style={BRD} />
          </label>
          {/* Só PROSPECT: o fee sugerido do motor é o fee total. No aditivo, o
              preenchimento usa o "novo total" (receita_fee + delta) — botão no
              painel do aditivo (à direita), NUNCA o feeSugerido cru (que incluiria
              todo o escopo existente). */}
          {tipo === 'prospect' && prop && valorProposto <= 0 && prop.feeSugerido > 0 && (
            <button type="button" onClick={() => setValorProposto(Math.round(prop.feeSugerido / 50) * 50)}
              className="text-[11px] underline" style={{ color: '#0065FF' }}>↑ usar fee sugerido arredondado ({formatCurrency(prop.feeSugerido)})</button>
          )}
          {tipo === 'cliente_existente' && (
            <div className="text-[11px]" style={{ color: '#6b6b8a' }}>Fee atual (cadastro): <strong style={{ color: '#160F41' }}>{formatCurrency(feeAtual)}</strong> — base real do aditivo (não editável).</div>
          )}
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
          <div className="grid grid-cols-2 gap-3">
            <Num label="Validade da proposta (dias)" v={validadeDias} set={setValidadeDias} />
            <Num label="Dia do vencimento (1–28)" v={diaVencimento} set={setDiaVencimento} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={salvar} disabled={salvando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? 'Salvando…' : editId ? 'Atualizar proposta' : 'Salvar proposta'}
            </button>
            <button onClick={novo} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Nova</button>
            <button onClick={gerar} disabled={gerandoPdf} className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50" style={{ border: '1px solid #0065FF', color: '#0065FF' }}>{gerandoPdf ? 'Gerando PDF…' : 'Gerar proposta ↗'}</button>
            {toast && <span className="text-xs self-center" style={{ color: '#166534' }}>{toast}</span>}
          </div>
        </div>

        {/* ADITIVO: o escopo atual (baseline) fica TRAVADO (read-only). O CFO só
            edita as "Adições" (jurídico N). Os <fieldset disabled> abaixo travam
            os campos vindos do prefill — evita editar o que o cliente já tem
            (e o delta netaria de qualquer forma, mas a UI deve deixar claro). */}
        {tipo === 'cliente_existente' && baseline && (
          <div className="rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            🔒 <strong>Escopo atual (travado)</strong> — referência do que o cliente já tem (não editável). Adicione novos serviços na seção <strong>Adições</strong> abaixo: só a diferença vira acréscimo.
          </div>
        )}

        <fieldset disabled={tipo === 'cliente_existente'} className="space-y-4 border-0 p-0 m-0 disabled:opacity-60">
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
        </fieldset>

        {/* ADIÇÕES: prospect = linha normal de jurídico N (parte do escopo). Aditivo
            = seção incremental agrupada (ampliado = baseline + inc), fora do
            fieldset travado. Conciliação NÃO é campo — acompanha o movimento. */}
        {tipo === 'prospect' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium" style={{ color: '#160F41' }}>Demandas jurídicas / mês (N)</span>
            <input type="number" step={1} min={0} value={demandasJur}
              onChange={e => setDemandasJur(Math.max(0, Number(e.target.value)))}
              className="rounded px-2 py-1 text-sm w-24" style={BRD} />
            <span className="text-[10px]" style={{ color: '#9ca3af' }}>jurídico consultivo incluído no fee · 0 = sem parcela</span>
          </div>
        ) : baseline && (
          <div className="rounded-lg border-2 p-3 space-y-3" style={{ borderColor: '#0065FF', backgroundColor: '#f0f6ff' }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#0065FF' }}>＋ Adições ao escopo (editável)</p>
            <p className="text-[10px]" style={{ color: '#6b6b8a' }}>Digite <strong>quanto a mais</strong> de cada item. A conciliação acompanha o movimento automaticamente — não precisa marcar.</p>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b8a' }}>Financeiro / volumetria</p>
              <div className="grid grid-cols-3 gap-3">
                <AdicaoNum label="Movimentos / mês" atual={baseline.volMov} v={inc.volMov} set={setIncF('volMov')} />
                <AdicaoNum label="Recebíveis / mês" atual={baseline.recebiveis} v={inc.recebiveis} set={setIncF('recebiveis')} />
                <AdicaoNum label="Contratações / mês" atual={baseline.contratacoes} v={inc.contratacoes} set={setIncF('contratacoes')} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b8a' }}>Perfil / bens</p>
              <div className="grid grid-cols-2 gap-3">
                <AdicaoNum label="Imóveis" atual={baseline.imov} v={inc.imov} set={setIncF('imov')} />
                <AdicaoNum label="Veículos" atual={baseline.veic} v={inc.veic} set={setIncF('veic')} />
                <AdicaoNum label="Func. domésticos" atual={baseline.domest} v={inc.domest} set={setIncF('domest')} />
                <AdicaoNum label="Grupos financeiros" atual={baseline.grupos} v={inc.grupos} set={setIncF('grupos')} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b8a' }}>Jurídico</p>
              <div className="grid grid-cols-2 gap-3">
                <AdicaoNum label="Demandas jurídicas / mês (N)" atual={baseline.demandasJur} v={inc.demandasJur} set={setIncF('demandasJur')} />
              </div>
            </div>
          </div>
        )}

        <fieldset disabled={tipo === 'cliente_existente'} className="space-y-4 border-0 p-0 m-0 disabled:opacity-60">
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
        </fieldset>
      </div>

      {/* SAÍDA */}
      <div className="space-y-3">
        {!prop ? <p className="text-sm" style={{ color: '#6b6b8a' }}>Selecione um período.</p> : prop.denomInvalido ? (
          <p className="text-sm" style={{ color: '#991b1b' }}>Margem alvo + imposto ≥ 100% — ajuste a margem na aba Reajustes.</p>
        ) : tipo === 'cliente_existente' ? (
          !baseline ? (
            <p className="text-sm" style={{ color: '#6b6b8a' }}>Selecione um cliente existente para montar o aditivo (escopo atual + adições).</p>
          ) : (
          <>
            {/* BASELINE travado (escopo atual, read-only). */}
            <div className="rounded-lg border p-3 text-xs" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9fafb' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6b6b8a' }}>Escopo atual (baseline — travado)</p>
              <p style={{ color: '#6b6b8a' }}>
                Pacote {baseline.pacote} · {baseline.volMov} mov/mês · {baseline.recebiveis} receb/mês · jurídico {baseline.usaJur ? 'sim' : 'não'} · conc {baseline.usaConc ? 'sim' : 'não'} · {baseline.imov} imóveis · {baseline.veic} veículos · ded {formatCurrency(baseline.dContab + baseline.dPgto + baseline.dAdm + baseline.dViagem)}
              </p>
            </div>
            {/* DELTA (base c split): fee atual real → + acréscimo (delta) → = novo total. */}
            <div className="rounded-lg border p-4" style={{ borderColor: '#0065FF', backgroundColor: '#f0f6ff' }}>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>Aditivo de escopo — composição do fee</p>
              <div className="space-y-1 text-sm">
                <L label="Fee atual (cadastro, real)" v={formatCurrency(feeAtual)} />
                <L label="+ Acréscimo (delta: ampliado − atual)" v={formatCurrency(delta)} forte />
                <div className="border-t pt-1 mt-1" style={{ borderColor: '#bfdbfe' }}>
                  <L label="= Novo total mensal" v={formatCurrency(novoTotalAditivo)} forte />
                </div>
              </div>
              {adicoesAditivo.length > 0 ? (
                <p className="text-[11px] mt-2" style={{ color: '#6b6b8a' }}>Inclui: {adicoesAditivo.join('; ')}.</p>
              ) : (
                <p className="text-[11px] mt-2" style={{ color: '#9ca3af' }}>Edite o escopo ampliado (volumetria, jurídico N, serviços) para gerar o acréscimo. Delta = R$ 0,00 enquanto o ampliado == baseline.</p>
              )}
              {novoTotalAditivo > 0 && Math.abs(valorProposto - novoTotalAditivo) > 0.5 && (
                <button type="button" onClick={() => setValorProposto(Math.round(novoTotalAditivo / 50) * 50)}
                  className="text-[11px] underline mt-2" style={{ color: '#0065FF' }}>↑ usar novo total no valor proposto ({formatCurrency(novoTotalAditivo)})</button>
              )}
            </div>
            <p className="text-[11px]" style={{ color: '#9ca3af' }}>Delta (Forma 1): acréscimo = motor(ampliado) − motor(atual) — mesma régua, o escopo existente e o rebate cancelam. Exibido sobre a receita_fee real. Sem patrimônio em R$.</p>
          </>
          )
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
              {prop.demandasJur > 0 && (
                <>
                  <L label={`+ Jurídico (${prop.demandasJur} demanda${prop.demandasJur === 1 ? '' : 's'})`} v={formatCurrency(prop.parcelaJuridica)} />
                  <p className="text-[11px] -mt-0.5" style={{ color: '#9ca3af' }}>
                    {prop.demandasJur} × {formatCurrency(prop.custoDemandaJuridica)} ({parametros.tempo_demanda_juridica_horas.toLocaleString('pt-BR')}h × {formatCurrency(parametros.custo_hora_juridico)} × {parametros.fator_demanda_juridica.toLocaleString('pt-BR')})
                  </p>
                </>
              )}
              <L label="+ Dedicados" v={formatCurrency(prop.dedicados)} />
              <L label={`+ Overhead (×${prop.overheadRatio.toFixed(2)} — razão de referência)`} v={formatCurrency(prop.overhead)} />
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
