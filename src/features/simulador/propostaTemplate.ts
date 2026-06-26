// --- Template da proposta institucional (HTML autossuficiente) ---
// Identidade visual Galáticos. Capa-fallback espelha o modelo Adriana Carneiro
// (fundo escuro + overlay preto + LOGO CENTRAL sem caixa + título leve). Logo =
// traçado FIEL do asset da marca (logoGalaticos.svg, importado ?raw), SEM fundo
// próprio, cor adaptável: branca sobre fundo escuro (capa), institucional
// (#160F41) sobre fundo claro (fechamento).
//
// PRINCÍPIO CENTRAL: pilares ticados, escopo escrito e preço derivam DO MESMO
// dado da proposta. A função `ticks()` é a fonte ÚNICA: ela define cada item
// como contratado/não a partir de um driver da volumetria; tanto os pilares
// (✓/+) quanto blocosEscopo() leem dela — tick e texto nunca divergem.
//   - Item contratado  → aparece com "✓".
//   - Item NÃO contratado → aparece com "+" (vitrine: o cliente sabe que existe).
//   - Pilar com ≥1 item ✓ = CONTRATADO (badge derivado dos itens, não fixo).
// O ESCOPO ESCRITO = A VOLUMETRIA PRECIFICADA.

import logoRaw from './logoGalaticos.svg?raw';

export interface DadosPropostaTemplate {
  nome: string;
  tipo: 'prospect' | 'cliente_existente';
  data: string;
  textoIntroducao: string;
  imagemCapaUrl: string;
  valorProposto: number;
  feeAtual: number;
  pacote: string;
  adicoes: string[];   // aditivo: lista do que o ampliado acrescenta (vazio em prospect)
  itensNovos: string[];   // aditivo: chaves dos itens NOVOS p/ selo "Novo" (vazio em prospect)
  // Volumetria (escopo) + serviços.
  usaJuridico: boolean; usaConciliacao: boolean;
  qtdDemandasJuridicas: number;   // N demandas consultivas/mês incluídas (0 = não exibe "até N")
  planejamentoTributario: boolean; revisaoContratos: boolean;
  qtdVeiculos: number; qtdImoveis: number; gruposFinanceiros: number; qtdFuncionariosDomesticos: number;
  volumeMovimentos: number; qtdContasBancarias: number; qtdRecebiveis: number; qtdContratacoes: number;
  dedicViagem: number;
  plTotal: number; plOffshore: number;   // plOffshore > 0 → Estrutura Offshore contratada
  titularidades: string; // texto livre (ex.: "1 PF + 1 PJ"); vazio → redação genérica
  // Contabilidade (exibição — não entra no motor). Mensal > 0 → aparece.
  contabilidadeMensal: number;      // R$/mês; soma no total MOSTRADO
  contabilidadeIr: number;          // R$ — IR à parte (0 = não cita)
  contabilidadeFechamento: number;  // R$ — fechamento anual à parte (0 = não cita)
  contabilidadeTipo: string;        // "PF"/"PJ" ou livre; vazio = não cita
  textoEscopoAdicional: string;
  validadeDias: number;  // validade da proposta (default 15)
  diaVencimento: number; // dia do vencimento do boleto, 1–28 (default 10)
  // ── Política de reajuste por volume excedente (só redação — não no cálculo) ──
  toleranciaVolumePct: number;      // folga % antes de reajustar
  periodicidadeMedicaoMeses: number; // periodicidade de medição (meses)
  valorFaixaExcedente: number;      // R$ por faixa adicional
}

// Cláusula de excedente — POLÍTICA parametrizada (Configurações → Reajuste).
// Decisão do CFO: aparece UMA vez só, na seção "Excedentes" das Condições
// Gerais. Os cards de escopo descrevem apenas o que inclui (sem repetir a
// cláusula). Os 3 parâmetros vêm de `parametros` (passados via DadosProposta).
function clausulaExcedente(d: DadosPropostaTemplate): string {
  const tol = d.toleranciaVolumePct.toLocaleString('pt-BR');
  const per = d.periodicidadeMedicaoMeses;
  const perTxt = per === 1 ? '1 mês' : `${per.toLocaleString('pt-BR')} meses`;
  return `Os volumes indicados refletem o escopo precificado nesta proposta. Aplica-se uma tolerância de ${tol}% sobre o volume contratado; acima dela, há um acréscimo de ${brl(d.valorFaixaExcedente)} a cada ${tol}% adicionais de volume. A medição ocorre a cada ${perTxt} e não é retroativa.`;
}

// Fonte única dos drivers → contratado/não. Pilares e escopo leem daqui.
interface Ticks {
  imoveis: boolean; veiculos: boolean; domesticos: boolean; contratacoes: boolean; viagens: boolean; eventos: boolean;
  planejamentoFin: boolean; movimentos: boolean;
  juridico: boolean; revisao: boolean; planTrib: boolean;
  investimentos: boolean; consolidacao: boolean; relatorios: boolean; offshore: boolean; liquidez: boolean;
}
function ticks(d: DadosPropostaTemplate): Ticks {
  return {
    // PILAR 1 (Administrativo) — contratação de serviços e viagens são pacote
    // básico (sempre ✓); imóveis/veículos/funcionários seguem a quantidade.
    imoveis: d.qtdImoveis > 0,
    veiculos: d.qtdVeiculos > 0,
    domesticos: d.qtdFuncionariosDomesticos > 0,
    contratacoes: true,
    viagens: true,
    eventos: false,                          // serviço extra — nunca ✓ nesta versão
    // PILAR 2 (Financeiro) — Planejamento é chamariz de poupança, sempre incluído.
    planejamentoFin: true,
    movimentos: d.volumeMovimentos > 0,      // pagamento/conciliação/fluxo
    // PILAR 3 (Jurídico) — N demandas consultivas/mês também acende o consultivo
    // (coerência tick↔texto: se há jurídico precificado, o pilar mostra ✓).
    juridico: d.usaJuridico || d.qtdDemandasJuridicas > 0, revisao: d.revisaoContratos, planTrib: d.planejamentoTributario,
    // PILAR 4 (Investimentos) — núcleo da casa, sempre incluído; offshore por PL.
    investimentos: true,
    consolidacao: true,                      // multi-custódia (BTG/XP/Galápagos)
    relatorios: true,
    offshore: d.plOffshore > 0,
    liquidez: false,                         // extra
  };
}
// Pilar contratado = tem ≥1 item ✓. adm/fin/inv sempre contratados por definição.
function contratacao(t: Ticks) {
  return {
    adm: t.imoveis || t.veiculos || t.domesticos || t.contratacoes || t.viagens,
    fin: t.planejamentoFin || t.movimentos,
    jur: t.juridico || t.revisao || t.planTrib,
    inv: t.investimentos,
  };
}

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Logo fiel parametrizada por cor (sem fundo). cor = '#FFFFFF' (sobre escuro)
 *  ou '#160F41' (sobre claro). suffix = ids únicos por instância. */
function logoSVG(cor: string, suffix: string): string {
  return logoRaw
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<clipPath id="clip0h">[\s\S]*?<\/clipPath>/, '')
    .replace(/ clip-path="url\(#clip0h\)"/, '')
    .replace(/ width="180" height="45"/, ' width="100%" height="100%" viewBox="0 0 180 46" preserveAspectRatio="xMidYMid meet" style="display:block"')
    .replace(/fill="white"/g, `fill="${cor}"`)
    .replace(/id="fill1h"/g, `id="fill1${suffix}"`).replace(/url\(#fill1h\)/g, `url(#fill1${suffix})`);
}

function pilarHTML(numero: number, titulo: string, descricao: string, servicos: { texto: string; contratado: boolean; novo?: boolean }[]): string {
  const contratado = servicos.some(s => s.contratado);   // ≥1 item ✓ = pilar CONTRATADO
  // Item NOVO (aditivo): ✓ + selo "Novo" magenta — destaca o que está sendo
  // adicionado vs o que o cliente já tinha. No prospect, novo é sempre undefined
  // → nenhum selo → documento byte-idêntico.
  const ativos = servicos.filter(s => s.contratado).map(s => `<li><span>✓</span><span>${esc(s.texto)}</span>${s.novo ? ` <span class="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style="background:#D100B9;color:#fff">Novo</span>` : ''}</li>`).join('');
  const extras = servicos.filter(s => !s.contratado);
  const liExtras = extras.length
    ? `<li class="text-gray-400 mt-2 pt-2 border-t border-gray-100 text-[10px] uppercase font-semibold">Disponível / Extra:</li>`
      + extras.map(s => `<li class="text-gray-400"><span>+</span><span>${esc(s.texto)}</span></li>`).join('')
    : '';
  if (contratado) {
    return `<div class="flex flex-col rounded-lg p-5 border-2 border-primario relative shadow-lg bg-white">
      <div class="absolute top-0 right-0 bg-primario text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">Contratado</div>
      <span class="text-sm font-semibold text-primario uppercase">Pilar ${numero}</span>
      <h3 class="text-xl font-bold text-principal mt-1 mb-2">${esc(titulo)}</h3>
      <p class="text-secundario mb-3 leading-relaxed text-xs">${esc(descricao)}</p>
      <ul class="service-list flex-grow mt-auto">${ativos}${liExtras}</ul></div>`;
  }
  return `<div class="flex flex-col service-card-inactive rounded-lg p-5 relative">
      <span class="text-sm font-semibold text-gray-400 uppercase">Pilar ${numero}</span>
      <h3 class="text-xl font-bold text-gray-500 mt-1 mb-2">${esc(titulo)}</h3>
      <p class="text-secundario mb-3 leading-relaxed text-xs">${esc(descricao)}</p>
      <ul class="service-list service-list-inactive flex-grow mt-auto">${liExtras || ativos}</ul></div>`;
}

/** Blocos de escopo GERADOS dos MESMOS ticks dos pilares — cada item escrito
 *  corresponde a um ✓ (e vice-versa). Os cards descrevem APENAS o que inclui;
 *  a cláusula de reajuste aparece uma vez só nas Condições Gerais (decisão CFO).
 *  Não-contratados → ativação; + texto livre. */
function blocosEscopo(d: DadosPropostaTemplate, t: Ticks, contr: { adm: boolean; fin: boolean; jur: boolean; inv: boolean }): string {
  const blocos: { titulo: string; texto: string }[] = [];

  if (contr.adm) {
    const it: string[] = [];
    if (t.imoveis) it.push(`${d.qtdImoveis} imóvel(is)`);
    if (t.veiculos) it.push(`${d.qtdVeiculos} veículo(s)`);
    if (t.domesticos) it.push(`${d.qtdFuncionariosDomesticos} funcionário(s) doméstico(s)`);
    if (t.contratacoes) it.push('contratação de serviços');
    if (t.viagens) it.push('organização de viagens');
    blocos.push({ titulo: 'Escopo Administrativo', texto: `Gestão de ${it.join('; ')}.` });
  }
  if (contr.fin) {
    // Limite de Volume (item 4) — só o teto PRINCIPAL (movimentações/mês), em
    // prosa fluida. Recebíveis/contratações/contas saíram de propósito: viravam
    // ficha técnica seca e "recebíveis" será revisto numa fase futura.
    const tetoMov = t.movimentos
      ? ` A operação do dia a dia — pagamentos, conciliação bancária e fluxo de caixa — é dimensionada para até ${d.volumeMovimentos} movimentações por mês.`
      : '';
    blocos.push({ titulo: 'Escopo do Pilar Financeiro', texto: `Planejamento financeiro e poupança incluídos.${tetoMov}` });
  }
  if (contr.jur) {
    const it: string[] = [];
    if (t.revisao) it.push('revisão de contratos');
    if (t.planTrib) it.push('planejamento tributário');
    // N>0 → delimita o consultivo incluído (até N/mês) e a fronteira do extra.
    // NUNCA exibir "até 0 demandas": com N=0 mantém a redação histórica.
    // SEM PREÇO no documento — só o N e a fronteira incluído/extraordinário.
    const base = d.qtdDemandasJuridicas > 0
      ? `Jurídico consultivo incluído — até ${d.qtdDemandasJuridicas} demanda${d.qtdDemandasJuridicas === 1 ? '' : 's'}/mês${it.length ? ` (${it.join(', ')})` : ''}. Serviços extraordinários (elaboração de documentos do zero, representação/negociação, contencioso, parecer aprofundado ou direcionamento a escritório externo) são orçados sob demanda, à parte.`
      : `Apoio consultivo contínuo${it.length ? `: ${it.join(', ')}` : ''}.`;
    blocos.push({ titulo: 'Escopo Jurídico', texto: base });
  }
  if (contr.inv) {
    // Investimento NÃO tem teto — é convite ao crescimento, não escopo racionado.
    // Por isso, SEM linguagem de limite e SEM a CLAUSULA_EXCEDENTE (que fala em
    // excedente/renegociação, imprópria aqui). Patrimônio em R$ nunca aparece
    // (regra firme do CFO, d2e0a22). Offshore gateado por t.offshore (coerência
    // tick↔texto com o Pilar 4).
    const offshoreFrase = t.offshore ? ' e estrutura offshore' : '';
    blocos.push({ titulo: 'Escopo de Investimentos', texto: `Gestão e consolidação do seu patrimônio onde ele estiver — múltiplas custódias reunidas em visão única, com relatórios de performance${offshoreFrase}. Não é necessário transferir custódia para contar com nossa gestão: acompanhamos e otimizamos seu patrimônio na estrutura atual, e o serviço acompanha o seu crescimento.` });
  }
  // adm/fin/inv são sempre contratados → só jur pode cair em ativação.
  const naoContr = [!contr.jur && 'Jurídico'].filter(Boolean) as string[];
  blocos.push({ titulo: 'Ativação de Novos Serviços', texto: `${naoContr.length ? `Serviços adicionais (${naoContr.join(', ')}) e s` : 'S'}oluções sob demanda (M&A, valuation, estudos de viabilidade) podem ser ativados a qualquer momento mediante orçamento pontual.` });

  return blocos.map(b => `<div class="escopo-card bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">${b.titulo}</strong><p class="text-secundario text-base mt-1">${b.texto}</p></div>`).join('');
}

/** Texto livre do escopo — full-width, fora do grid (após os blocos). */
function observacoesHTML(d: DadosPropostaTemplate): string {
  if (!d.textoEscopoAdicional.trim()) return '';
  return `<div class="escopo-card bg-white p-5 rounded-md border border-gray-200 mt-4"><strong class="text-principal text-lg">Observações</strong><p class="text-secundario text-base mt-1">${esc(d.textoEscopoAdicional)}</p></div>`;
}

/** "O Plano" (item 1) — prosa que sintetiza o escopo contratado a partir dos
 *  MESMOS ticks/contratação dos pilares (fonte única, zero dado novo). Lista
 *  em prosa quais frentes a proposta inclui. */
function oPlanoHTML(t: Ticks, contr: { adm: boolean; fin: boolean; jur: boolean; inv: boolean }): string {
  const partes: string[] = [];
  if (contr.fin) {
    const fin = ['planejamento financeiro'];
    if (t.movimentos) fin.push('pagamentos', 'conciliação bancária', 'fluxo de caixa');
    partes.push(`gestão financeira (${fin.join(', ')})`);
  }
  if (contr.adm) {
    const adm: string[] = [];
    if (t.imoveis) adm.push('imóveis');
    if (t.veiculos) adm.push('veículos');
    if (t.domesticos) adm.push('funcionários domésticos');
    adm.push('contratação de serviços', 'organização de viagens');
    partes.push(`gestão administrativa (${adm.join(', ')})`);
  }
  if (contr.jur) {
    const jur = ['jurídico consultivo'];
    if (t.revisao) jur.push('revisão de contratos');
    if (t.planTrib) jur.push('planejamento tributário');
    partes.push(`apoio ${jur.join(', ')}`);
  }
  if (contr.inv) {
    partes.push(`gestão de investimentos com consolidação multi-custódia${t.offshore ? ' e estrutura offshore' : ''}`);
  }
  if (!partes.length) return '';
  // Junção com "; e" antes do último item (português corrido).
  const lista = partes.length > 1
    ? `${partes.slice(0, -1).join('; ')}; e ${partes[partes.length - 1]}`
    : partes[0];
  const prosa = `Sob um gestor dedicado, sua proposta reúne ${lista}. Tudo centralizado em um único painel, com a estrutura acompanhando o crescimento do seu patrimônio.`;
  return `<section id="o-plano" class="px-12 md:px-20 pb-12 md:pb-16 text-center bg-white">
    <h3 class="text-sm font-semibold text-secundario uppercase tracking-wide mb-3">O Plano</h3>
    <p class="text-lg md:text-xl text-secundario leading-relaxed font-light max-w-4xl mx-auto">${prosa}</p>
  </section>`;
}

/** Frase de titularidades (itens 2+3) para o lead do "Escopo Contratado". Texto
 *  livre quando preenchido; genérico quando vazio. Sempre fecha com a cláusula
 *  de proposta complementar para outras titularidades. */
function titularidadesFrase(d: DadosPropostaTemplate): string {
  const alvo = d.titularidades.trim()
    ? `os grupos/titularidades aqui contratados (${esc(d.titularidades.trim())})`
    : 'os grupos/titularidades aqui contratados';
  return `Esta proposta contempla ${alvo} — demandas relativas a outras titularidades serão objeto de proposta complementar.`;
}

/** Cláusula de contabilidade (Condições Gerais) — só quando há mensal > 0.
 *  13º = mesmo valor do mensal. IR/fechamento/tipo citados se preenchidos.
 *  IR e fechamento são à parte (não-mensais) — NÃO somam no total mensal. */
function clausulaContabilidade(d: DadosPropostaTemplate): string {
  const tipo = d.contabilidadeTipo.trim() ? ` (${esc(d.contabilidadeTipo.trim())})` : '';
  const partes = [`Serviço de contabilidade${tipo}: mensalidade de ${brl(d.contabilidadeMensal)}. 13ª parcela equivalente à mensalidade (${brl(d.contabilidadeMensal)}).`];
  if (d.contabilidadeIr > 0) partes.push(`Imposto de renda cobrado à parte (${brl(d.contabilidadeIr)}).`);
  if (d.contabilidadeFechamento > 0) partes.push(`Fechamento anual cobrado à parte (${brl(d.contabilidadeFechamento)}).`);
  return partes.join(' ');
}

/** Parcelas NÃO-mensais da contabilidade (13º=mensal, IR, fechamento) — listadas
 *  na faixa como "à parte" para deixar claro que NÃO entram no total mensal. */
function contabilidadeParcelasAnuais(d: DadosPropostaTemplate): string {
  const itens = [`13ª parcela (${brl(d.contabilidadeMensal)})`];
  if (d.contabilidadeIr > 0) itens.push(`IR (${brl(d.contabilidadeIr)})`);
  if (d.contabilidadeFechamento > 0) itens.push(`fechamento (${brl(d.contabilidadeFechamento)})`);
  return itens.join(', ');
}

// ── Variação por TIPO de documento ──────────────────────────────────────────
// O scaffold do template é ÚNICO; só estes pontos mudam por tipo. Preparado para
// receber o 3º tipo (orçamento extraordinário) num lote seguinte — basta uma
// nova entrada aqui. prospect = literais ATUAIS (byte-equivalente: trava de
// não-regressão).
interface TipoDocConfig {
  tituloDoc: string;        // <title>{tituloDoc} — {nome}</title>
  badgeCapa: string;        // pílula da capa
  h1: string;               // título grande da capa (antes de {nome})
  subtitulo: string;        // subtítulo da capa
  introDefault: string;     // parágrafo de introdução (já interpolado com nome)
  composicaoLinha: string;  // linha de composição da faixa de investimento
}
function tipoConfig(d: DadosPropostaTemplate): TipoDocConfig {
  if (d.tipo === 'cliente_existente') {
    // ADITIVO — o documento PARECE aditivo (capa/título próprios) e a faixa mostra
    // os 3 números: fee atual → acréscimo → novo total. acréscimo = novo total −
    // fee atual; novo total = valorProposto (definido no Gerador como
    // fee_atual + incremento isolado).
    const acrescimo = Math.max(0, d.valorProposto - d.feeAtual);
    return {
      tituloDoc: 'Aditivo de Escopo',
      badgeCapa: 'Aditivo de Escopo',
      h1: 'Aditivo ao Plano de Gestão',
      subtitulo: 'Aditivo de Escopo — Gestão Financeira',
      introDefault: `${esc(d.nome)}, hoje já cuidamos da sua operação financeira no dia a dia. Esta proposta amplia o escopo para o <strong>Pilar Financeiro completo</strong> — consolidando pagamentos, conciliação e fluxo de caixa sob a mesma estrutura. O resultado é direto: mais controle sobre a rotina e visão consolidada do seu patrimônio em um único painel.`,
      composicaoLinha: `Escopo atual ${brl(d.feeAtual)} + acréscimo ${brl(acrescimo)} = novo total ${brl(d.valorProposto)}`,
    };
  }
  // PROSPECT — literais IDÊNTICOS ao template atual. NÃO ALTERAR (trava de
  // não-regressão byte-equivalente).
  return {
    tituloDoc: 'Proposta',
    badgeCapa: 'Proposta Comercial',
    h1: 'Plano de Gestão',
    subtitulo: 'Gestão Patrimonial e Performance Financeira',
    introDefault: `${esc(d.nome)}, a gestão de um patrimônio em crescimento exige estrutura, método e visão de longo prazo. Propomos assumir a sua operação financeira e administrativa de ponta a ponta — patrimônio, pagamentos, conciliação, fluxo de caixa e investimentos. O resultado é direto: você acompanha cada número com clareza e decide com base em informação organizada, de qualquer lugar.`,
    composicaoLinha: 'Gestão patrimonial completa, em um plano único',
  };
}

export function gerarPropostaHTML(d: DadosPropostaTemplate, opts: { paraPdf?: boolean } = {}): string {
  const cfg = tipoConfig(d);
  const subtitulo = cfg.subtitulo;
  const intro = d.textoIntroducao.trim() ? esc(d.textoIntroducao) : cfg.introDefault;
  // Título da capa. Aditivo: DUAS linhas fixas — frase fixa (linha 1) + nome
  // completo (linha 2) como bloco sem quebra interna (nowrap → quebra só ENTRE
  // a frase e o nome, nunca no meio do nome). Prospect: layout atual (inalterado
  // — byte-idêntico).
  const h1Html = d.tipo === 'cliente_existente'
    ? `${cfg.h1}<br><span class="text-primario font-normal" style="white-space:nowrap">${esc(d.nome)}</span>`
    : `${cfg.h1} <span class="text-primario font-normal">${esc(d.nome)}</span>`;

  // Fonte única: ticks → contratação. Pilares e escopo derivam daqui (coerência).
  const t = ticks(d);
  const contr = contratacao(t);

  // Imagem da capa em ALTA resolução: object-cover preenche sem limitar a
  // resolução-fonte; sem max-width/height artificial, sem filtros que degradem.
  const fundoCapa = d.imagemCapaUrl.trim()
    ? `<div class="absolute inset-0"><img src="${esc(d.imagemCapaUrl)}" alt="${esc(d.nome)}" decoding="sync" loading="eager" class="w-full h-full object-cover object-top" style="image-rendering:auto"></div>
       <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>`
    : `<div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>`;

  // Selo "Novo" por item (aditivo): chave em itensNovos. Prospect: vazio → nada.
  const nv = (k: string) => d.itensNovos.includes(k);
  const pilares = [
    pilarHTML(1, 'Administrativo', 'Gestão completa da rotina e bens.',
      [{ texto: 'Contratação de Serviços', contratado: t.contratacoes }, { texto: 'Organização de Viagens', contratado: t.viagens },
       { texto: 'Gestão de Imóveis', contratado: t.imoveis, novo: nv('imoveis') }, { texto: 'Gestão de Veículos', contratado: t.veiculos, novo: nv('veiculos') },
       { texto: 'Gestão de Funcionários', contratado: t.domesticos, novo: nv('domesticos') }, { texto: 'Organização de Eventos', contratado: t.eventos }]),
    pilarHTML(2, 'Financeiro', 'Operação e planejamento financeiro.',
      [{ texto: 'Planejamento Financeiro', contratado: t.planejamentoFin },
       { texto: 'Pagamento de Contas', contratado: t.movimentos, novo: nv('movimentos') },
       { texto: 'Conciliação Bancária', contratado: t.movimentos, novo: nv('movimentos') },
       { texto: 'Fluxo de Caixa', contratado: t.movimentos, novo: nv('movimentos') },
       // Contabilidade (exibição) — só entra como item ✓ quando há mensal > 0.
       ...(d.contabilidadeMensal > 0 ? [{ texto: 'Contabilidade', contratado: true }] : [])]),
    pilarHTML(3, 'Jurídico', 'Apoio consultivo contínuo.',
      [{ texto: 'Jurídico Consultivo', contratado: t.juridico, novo: nv('juridico') }, { texto: 'Revisão de Contratos', contratado: t.revisao, novo: nv('revisao') },
       { texto: 'Planejamento Tributário', contratado: t.planTrib, novo: nv('planTrib') }]),
    // M&A e Estudos de Viabilidade NÃO entram aqui — vivem em "Soluções Sob Demanda".
    pilarHTML(4, 'Investimentos', 'Gestão de patrimônio e futuro.',
      [{ texto: 'Gestão de Investimentos', contratado: t.investimentos },
       { texto: 'Consolidação de Ativos (multi-custódia)', contratado: t.consolidacao },
       { texto: 'Relatórios de Performance', contratado: t.relatorios },
       { texto: 'Estrutura Offshore', contratado: t.offshore, novo: nv('offshore') },
       { texto: 'Planejamento de Liquidez', contratado: t.liquidez }]),
  ].join('');

  // Faixa de investimento (resumo): composição enxuta para a linha secundária.
  const composicaoLinha = cfg.composicaoLinha;

  return `<!DOCTYPE html>
<html lang="pt-br" class="scroll-smooth"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cfg.tituloDoc} — ${esc(d.nome)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
<style>
  :root { --cor-primaria:#732AD8; --cor-destaque:#D100B9; --cor-acento:#2F49EE; --cor-texto-principal:#160F41; --cor-texto-secundario:#4B5563; --cor-fundo:#FFFFFF; --cor-fundo-alternativo:#F9FAFB; --cor-borda-card:rgba(0,0,0,0.08); }
  body { font-family:'Poppins',sans-serif; background:#F3F4F6; color:var(--cor-texto-principal); }
  .text-primario{color:var(--cor-primaria)} .bg-primario{background:var(--cor-primaria)} .text-principal{color:var(--cor-texto-principal)} .text-secundario{color:var(--cor-texto-secundario)}
  .service-card{background:var(--cor-fundo-alternativo);border:1px solid var(--cor-borda-card)} .service-card-inactive{background:#fff;border:1px dashed #D1D5DB} .service-card-white{background:#fff;border:1px solid var(--cor-borda-card)}
  .service-list{list-style:none;padding-left:0} .service-list li{display:flex;align-items:flex-start;margin-bottom:.5rem;font-size:.85rem;line-height:1.4;color:var(--cor-texto-secundario)} .service-list li>span:first-child{color:var(--cor-primaria);font-weight:700;margin-right:.5rem;margin-top:3px;flex-shrink:0} .service-list-inactive li>span:first-child{color:#9CA3AF}
  /* PDF = PÁGINA ÚNICA contínua, renderizada pelo PDFShift (format "1152xauto",
     use_print:false → mídia SCREEN). A paginação A4 (@page / @media print:
     break-after, break-inside, float dos pilares, adensamento) foi APOSENTADA —
     o serviço captura a tira inteira do tamanho do conteúdo, sem quebrar. O
     visual de tela (capa no topo, pilares 2×2, faixa de preço) é exatamente o
     que vai pro PDF. O botão #barra-print é omitido no HTML server-side
     (gerarPropostaHTML(d, { paraPdf:true })). */
  #barra-print{position:fixed;right:20px;bottom:20px;z-index:50}${opts.paraPdf ? `
  /* PDF (tira contínua): encosta no TOPO e no FIM. Zera o my-12 do #doc e a
     margem do body — sem o A4, viravam faixa cinza nas bordas. Browser não é
     afetado (só sai no HTML com paraPdf:true). */
  body{margin:0!important;background:#fff!important}
  #doc{margin-top:0!important;margin-bottom:0!important}` : ''}
</style></head>
<body class="antialiased">
${opts.paraPdf ? '' : `<div id="barra-print"><button onclick="window.print()" style="background:linear-gradient(135deg,#2F49EE,#732AD8,#D100B9);color:#fff;border:none;padding:12px 20px;border-radius:999px;font-family:Poppins,sans-serif;font-weight:600;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25)">🖨️ Imprimir / PDF</button></div>`}

<div id="doc" class="w-full max-w-6xl mx-auto my-12 bg-white shadow-2xl rounded-lg overflow-hidden">

  <section id="capa" class="h-[700px] relative flex flex-col justify-end text-center text-white bg-gray-900">
    ${fundoCapa}
    <div class="absolute inset-0 flex justify-center" style="bottom:55%"><div style="width:36%;max-height:100%">${logoSVG('#FFFFFF', 'capa')}</div></div>
    <div class="relative z-10 p-8 pb-16 flex flex-col h-full"><div class="mt-auto">
      <div class="inline-block border border-white/30 px-6 py-2 rounded-full bg-black/30 backdrop-blur-sm mb-6"><span class="text-xs font-bold text-white uppercase tracking-widest">${cfg.badgeCapa}</span></div>
      <h1 class="text-2xl md:text-4xl font-light uppercase mb-2 text-white" style="letter-spacing:0.18em;text-shadow:0 2px 10px rgba(0,0,0,0.5)">${h1Html}</h1>
      <h2 class="text-lg md:text-xl font-light text-gray-200 tracking-wider uppercase mt-4 max-w-2xl mx-auto">${subtitulo}</h2>
      <p class="text-xs text-gray-300 uppercase tracking-widest mt-4">${esc(d.data)}</p>
      <div class="w-24 h-1 mx-auto rounded-full mt-8" style="background:linear-gradient(90deg,#2F49EE,#732AD8,#D100B9)"></div>
    </div></div>
  </section>

  <section id="intro" class="p-12 md:p-20 text-center bg-white">
    <h2 class="text-4xl md:text-5xl font-bold text-principal mb-6">Sua Operação Financeira em Boas Mãos.</h2>
    <p class="text-xl md:text-2xl text-secundario leading-relaxed font-light max-w-4xl mx-auto">${intro}</p>
  </section>
  ${oPlanoHTML(t, contr)}
  <div class="w-11/12 mx-auto border-t border-gray-200"></div>

  <section id="servicos" class="p-12 md:p-20" style="background:var(--cor-fundo-alternativo)">
    <h2 class="text-center text-4xl font-bold text-principal mb-12">O Ecossistema de Gestão</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">${pilares}</div>
  </section>

  <section id="servicos-extras" class="p-12 md:p-20 bg-white">
    <h2 class="text-center text-3xl font-bold text-principal mb-10">Soluções Sob Demanda</h2>
    <p class="text-center text-lg text-secundario max-w-3xl mx-auto -mt-6 mb-10">Para demandas estratégicas de alta complexidade e expansão patrimonial.</p>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
      <div class="service-card-white rounded-lg p-6 text-center"><div class="text-3xl text-primario mb-3"><i class="fas fa-handshake"></i></div><h4 class="text-lg font-semibold text-principal">M&amp;A</h4><p class="text-secundario text-sm">Fusões e Aquisições</p></div>
      <div class="service-card-white rounded-lg p-6 text-center"><div class="text-3xl text-primario mb-3"><i class="fas fa-chart-pie"></i></div><h4 class="text-lg font-semibold text-principal">Valuation</h4><p class="text-secundario text-sm">Avaliação de Negócios</p></div>
      <div class="service-card-white rounded-lg p-6 text-center"><div class="text-3xl text-primario mb-3"><i class="fas fa-drafting-compass"></i></div><h4 class="text-lg font-semibold text-principal">Viabilidade</h4><p class="text-secundario text-sm">Estudos Econômicos</p></div>
      <div class="service-card-white rounded-lg p-6 text-center"><div class="text-3xl text-primario mb-3"><i class="fas fa-gavel"></i></div><h4 class="text-lg font-semibold text-principal">Jurídico</h4><p class="text-secundario text-sm">Consultoria Pontual</p></div>
    </div>
  </section>

  <section id="equipe" class="p-12 md:p-20" style="background:var(--cor-fundo-alternativo)">
    <h2 class="text-center text-4xl font-bold text-principal mb-12">Sua Estrutura de Suporte</h2>
    <div class="flex flex-col items-center justify-center w-full max-w-4xl mx-auto">
      <div class="service-card rounded-lg p-6 text-center w-full md:w-3/4 shadow-md bg-white"><h3 class="text-2xl font-bold text-principal">${esc(d.nome).toUpperCase()}</h3><p class="text-lg text-secundario">Cliente e Decisor.</p></div>
      <div class="text-3xl text-primario my-6 opacity-70"><i class="fas fa-arrow-down"></i></div>
      <div class="bg-primario text-white rounded-lg p-6 text-center w-full md:w-3/4 shadow-lg"><h3 class="text-2xl font-bold text-white">SEU GESTOR DEDICADO</h3><p class="text-lg text-gray-100">Um profissional sênior da Galáticos integrando todas as frentes.</p></div>
      <div class="text-3xl text-primario my-6 opacity-70"><i class="fas fa-arrow-down"></i></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 w-full mt-4">
        <div class="service-card rounded-lg p-6 text-center bg-white border border-gray-200"><div class="text-4xl text-primario mb-3"><i class="fas fa-home"></i></div><h4 class="text-xl font-semibold text-principal">Patrimônio</h4><p class="text-secundario text-sm">Imóveis e Veículos</p></div>
        <div class="service-card rounded-lg p-6 text-center bg-white border border-gray-200"><div class="text-4xl text-primario mb-3"><i class="fas fa-university"></i></div><h4 class="text-xl font-semibold text-principal">Financeiro</h4><p class="text-secundario text-sm">Planejamento e Controle</p></div>
        <div class="service-card rounded-lg p-6 text-center bg-white border border-gray-200"><div class="text-4xl text-primario mb-3"><i class="fas fa-gavel"></i></div><h4 class="text-xl font-semibold text-principal">Jurídico</h4><p class="text-secundario text-sm">Consultivo</p></div>
        <div class="service-card rounded-lg p-6 text-center bg-white border border-gray-200"><div class="text-4xl text-primario mb-3"><i class="fas fa-money-bill-wave"></i></div><h4 class="text-xl font-semibold text-principal">Investimentos</h4><p class="text-secundario text-sm">Gestão de Carteira</p></div>
      </div>
    </div>
  </section>

  <section id="tecnologia" class="p-12 md:p-20 bg-white">
    <h2 class="text-center text-4xl font-bold text-principal mb-12">Centralização e Controle (ERP)</h2>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
      <div class="pr-8"><p class="text-xl text-secundario leading-relaxed font-light mb-6">Centralizamos a sua operação administrativa e financeira em nosso <strong>sistema de gestão (ERP)</strong>.</p><p class="text-xl text-secundario leading-relaxed font-light">Você acompanha a posição patrimonial, o fluxo de caixa e os investimentos em um único painel, acessível de qualquer lugar.</p></div>
      <div class="space-y-6">
        <div class="service-card-white rounded-lg p-6 shadow-lg flex items-center space-x-4 border"><div class="text-3xl text-primario p-4 bg-white rounded-full shadow-inner"><i class="fas fa-chart-area"></i></div><div class="flex-grow"><h4 class="text-xl font-bold text-principal">Evolução Patrimonial</h4><p class="text-secundario text-sm">Performance consolidada.</p></div></div>
        <div class="service-card-white rounded-lg p-6 shadow-lg flex items-center space-x-4 border"><div class="text-3xl text-primario p-4 bg-white rounded-full shadow-inner"><i class="fas fa-building"></i></div><div class="flex-grow"><h4 class="text-xl font-bold text-principal">Gestão de Ativos</h4><p class="text-secundario text-sm">Imóveis e Veículos.</p></div></div>
      </div>
    </div>
  </section>

  <section id="investimento">
    <!-- FAIXA: valor elegante (premium sóbrio). Gradiente como background (sem
         box-shadow/blur) → não rasteriza a página na impressão. -->
    <div id="faixa-investimento" class="px-12 md:px-20 py-14 text-white" style="background:linear-gradient(120deg,#160F41 0%,#2F49EE 60%,#732AD8 100%)">
      <div class="max-w-5xl mx-auto">
        <p class="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/60">Investimento Mensal</p>
        <p class="mt-3"><span class="text-5xl font-extralight tracking-tight">${brl(d.valorProposto + d.contabilidadeMensal)}</span><span class="text-base font-light text-white/60"> /mês</span></p>
        <div class="mt-6 flex flex-wrap gap-x-10 gap-y-2 text-sm font-light text-white/75">
          <span><i class="fas fa-layer-group text-white/40 mr-2"></i>${composicaoLinha}</span>
          <span><i class="fas fa-barcode text-white/40 mr-2"></i>Boleto · vencimento dia ${d.diaVencimento}</span>
          <span><i class="fas fa-clock text-white/40 mr-2"></i>Válida por ${d.validadeDias} dias</span>
        </div>${d.adicoes.length ? `\n        <p class="mt-4 text-sm font-light text-white/85"><i class="fas fa-plus-circle text-white/50 mr-2"></i>Inclui: ${esc(d.adicoes.join('; '))}.</p>` : ''}${d.contabilidadeMensal > 0 ? `\n        <p class="mt-4 text-sm font-light text-white/85"><i class="fas fa-calculator text-white/50 mr-2"></i>Composição mensal: gestão ${brl(d.valorProposto)} + contabilidade ${brl(d.contabilidadeMensal)}. Cobranças à parte (não-mensais): ${contabilidadeParcelasAnuais(d)}.</p>` : ''}
      </div>
    </div>
    <!-- ESCOPO: largura total, cards lado a lado (grid 2 colunas). -->
    <div class="p-12 md:p-20" style="background:var(--cor-fundo-alternativo)">
      <div class="max-w-5xl mx-auto">
        <h3 class="text-sm font-semibold text-secundario uppercase tracking-wide">Alinhamento</h3>
        <h2 class="text-3xl font-bold text-principal mt-1 mb-3">Escopo Contratado e Limites</h2>
        <p class="text-secundario leading-relaxed mb-8 max-w-3xl">O escopo descrito reflete exatamente a volumetria precificada — você paga pelo esforço dimensionado, com reajuste transparente se os volumes crescerem. ${titularidadesFrase(d)}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">${blocosEscopo(d, t, contr)}</div>
        ${observacoesHTML(d)}
      </div>
    </div>
  </section>

  <section id="condicoes" class="p-12 md:p-20" style="background:var(--cor-fundo-alternativo)">
    <h2 class="text-center text-3xl font-bold text-principal mb-10">Condições Gerais</h2>
    <div class="max-w-4xl mx-auto space-y-4">
      <div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">Validade</strong><p class="text-secundario text-base mt-1">Esta proposta é válida por ${d.validadeDias} dias a partir da data de apresentação.</p></div>
      <div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">Pagamento</strong><p class="text-secundario text-base mt-1">Pagamento mensal via boleto, com vencimento todo dia ${d.diaVencimento}.</p></div>
      <div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">Rescisão</strong><p class="text-secundario text-base mt-1">O contrato pode ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias. Nos 3 (três) primeiros meses de vigência — período de experiência — a rescisão pode ser solicitada a qualquer momento, sem necessidade de aviso prévio.</p></div>
      <div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">Reajuste por Volume Excedente</strong><p class="text-secundario text-base mt-1">${clausulaExcedente(d)}</p></div>
      ${d.contabilidadeMensal > 0 ? `<div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">Contabilidade</strong><p class="text-secundario text-base mt-1">${clausulaContabilidade(d)}</p></div>` : ''}
    </div>
  </section>

  <section id="aceite" class="p-12 md:p-20 bg-white">
    <h2 class="text-center text-2xl font-bold text-principal mb-10">Aceite da Proposta</h2>
    <div class="max-w-2xl mx-auto space-y-12">
      <div class="border-b border-gray-300 pb-2"><p class="text-xs text-gray-500 uppercase tracking-wide">Contratante: ${esc(d.nome)}</p></div>
      <div class="grid grid-cols-2 gap-12">
        <div><div class="border-b border-gray-300 pb-2 mb-2"></div><p class="text-xs text-gray-500 uppercase tracking-wide">Assinatura</p></div>
        <div><div class="border-b border-gray-300 pb-2 mb-2"></div><p class="text-xs text-gray-500 uppercase tracking-wide">Data</p></div>
      </div>
      <div class="grid grid-cols-2 gap-12">
        <div><div class="border-b border-gray-300 pb-2 mb-2"></div><p class="text-xs text-gray-500 uppercase tracking-wide">Galáticos Capital — Representante</p></div>
        <div><div class="border-b border-gray-300 pb-2 mb-2"></div><p class="text-xs text-gray-500 uppercase tracking-wide">Data</p></div>
      </div>
    </div>
  </section>

  <section id="fechamento" class="p-20 text-center bg-white">
    <div class="mx-auto mb-2" style="width:240px;color:#160F41">${logoSVG('#160F41', 'fim')}</div>
    <div class="w-24 h-1.5 mx-auto my-6 rounded-full" style="background:linear-gradient(90deg,#2F49EE,#732AD8,#D100B9)"></div>
    <p class="mt-4 text-3xl text-secundario font-light max-w-2xl mx-auto">Gestão Patrimonial e Performance Financeira.</p>
    <p class="text-sm text-gray-400 mt-6">Proposta válida por ${d.validadeDias} dias a partir da data de apresentação.</p>
  </section>

</div></body></html>`;
}
