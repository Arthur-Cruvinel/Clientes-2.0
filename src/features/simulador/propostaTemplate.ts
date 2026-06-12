// --- Template da proposta institucional (HTML autossuficiente) ---
// Identidade visual Galáticos. Capa-fallback espelha o modelo Adriana Carneiro
// (fundo escuro + overlay preto + LOGO CENTRAL sem caixa + título leve). Logo =
// traçado FIEL do asset da marca (logoGalaticos.svg, importado ?raw), SEM fundo
// próprio, cor adaptável: branca sobre fundo escuro (capa), institucional
// (#160F41) sobre fundo claro (fechamento).
//
// PRINCÍPIO (Parte 3): O ESCOPO ESCRITO = A VOLUMETRIA PRECIFICADA. Os blocos de
// "Alinhamento" são GERADOS dos inputs (limites quantitativos por pilar
// contratado) + cláusula de excedente + ativação dos não-contratados + texto
// livre opcional. Não é texto fixo do modelo.

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
  // Volumetria (escopo) + serviços.
  usaJuridico: boolean; usaConciliacao: boolean;
  planejamentoTributario: boolean; revisaoContratos: boolean;
  qtdVeiculos: number; qtdImoveis: number; gruposFinanceiros: number; qtdFuncionariosDomesticos: number;
  volumeMovimentos: number; qtdContasBancarias: number; qtdRecebiveis: number; qtdContratacoes: number;
  plTotal: number;
  textoEscopoAdicional: string;
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

function pilarHTML(numero: number, titulo: string, descricao: string, contratado: boolean, servicos: { texto: string; contratado: boolean }[]): string {
  const ativos = servicos.filter(s => s.contratado).map(s => `<li><span>✓</span><span>${esc(s.texto)}</span></li>`).join('');
  const extras = servicos.filter(s => !s.contratado);
  const liExtras = extras.length
    ? `<li class="text-gray-400 mt-2 pt-2 border-t border-gray-100 text-[10px] uppercase font-semibold">Disponível / Extra:</li>`
      + extras.map(s => `<li class="text-gray-400"><span>+</span><span>${esc(s.texto)}</span></li>`).join('')
    : '';
  if (contratado) {
    return `<div class="flex flex-col rounded-lg p-6 border-2 border-primario relative shadow-lg bg-white">
      <div class="absolute top-0 right-0 bg-primario text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">Contratado</div>
      <span class="text-sm font-semibold text-primario uppercase">Pilar ${numero}</span>
      <h3 class="text-xl font-bold text-principal mt-1 mb-3">${esc(titulo)}</h3>
      <p class="text-secundario mb-4 leading-relaxed text-xs">${esc(descricao)}</p>
      <ul class="service-list flex-grow mt-auto">${ativos}${liExtras}</ul></div>`;
  }
  return `<div class="flex flex-col service-card-inactive rounded-lg p-6 relative">
      <span class="text-sm font-semibold text-gray-400 uppercase">Pilar ${numero}</span>
      <h3 class="text-xl font-bold text-gray-500 mt-1 mb-3">${esc(titulo)}</h3>
      <p class="text-secundario mb-4 leading-relaxed text-xs">${esc(descricao)}</p>
      <ul class="service-list service-list-inactive flex-grow mt-auto">${liExtras || ativos}</ul></div>`;
}

/** Blocos de escopo GERADOS da volumetria — limites quantitativos por pilar
 *  contratado + cláusula de excedente; não-contratados → ativação; + texto livre. */
function blocosEscopo(d: DadosPropostaTemplate, contr: { adm: boolean; fin: boolean; jur: boolean; inv: boolean }): string {
  const EXC = 'Volumes excedentes ou aumento significativo de complexidade serão objeto de renegociação de honorários.';
  const blocos: { titulo: string; texto: string }[] = [];

  if (contr.adm) {
    const it: string[] = [];
    if (d.qtdImoveis || d.qtdVeiculos || d.gruposFinanceiros) it.push(`patrimônio (${d.qtdImoveis} imóveis, ${d.qtdVeiculos} veículos, ${d.gruposFinanceiros} grupo(s) financeiro(s))`);
    if (d.qtdFuncionariosDomesticos) it.push(`${d.qtdFuncionariosDomesticos} funcionário(s) doméstico(s)`);
    if (d.qtdContratacoes) it.push(`${d.qtdContratacoes} contratação(ões) de serviço/mês`);
    blocos.push({ titulo: 'Escopo Administrativo', texto: `Gestão de ${it.join('; ') || 'rotina e bens'}. ${EXC}` });
  }
  if (contr.fin) {
    const it: string[] = [];
    if (d.volumeMovimentos) it.push(`${d.volumeMovimentos} movimentação(ões)/mês`);
    if (d.qtdContasBancarias) it.push(`${d.qtdContasBancarias} conta(s) bancária(s)`);
    if (d.qtdRecebiveis) it.push(`${d.qtdRecebiveis} recebível(is)/mês`);
    blocos.push({ titulo: 'Escopo do Pilar Financeiro', texto: `Pagamentos, conciliação bancária e fluxo de caixa${it.length ? ` — ${it.join('; ')}` : ''}. ${EXC}` });
  }
  if (contr.jur) {
    const it: string[] = [];
    if (d.revisaoContratos) it.push('revisão de contratos');
    if (d.planejamentoTributario) it.push('planejamento tributário');
    blocos.push({ titulo: 'Escopo Jurídico', texto: `Apoio consultivo contínuo${it.length ? `: ${it.join(', ')}` : ''}. ${EXC}` });
  }
  if (contr.inv) {
    blocos.push({ titulo: 'Escopo de Investimentos', texto: `Gestão de carteira${d.plTotal > 0 ? ` sobre patrimônio estimado de ${brl(d.plTotal)}` : ''}. ${EXC}` });
  }
  const naoContr = [!contr.fin && 'Financeiro', !contr.jur && 'Jurídico', !contr.inv && 'Investimentos'].filter(Boolean) as string[];
  if (naoContr.length) blocos.push({ titulo: 'Ativação de Novos Serviços', texto: `Serviços adicionais (${naoContr.join(', ')}, M&A, entre outros) podem ser ativados a qualquer momento mediante orçamento pontual.` });
  if (d.textoEscopoAdicional.trim()) blocos.push({ titulo: 'Observações', texto: esc(d.textoEscopoAdicional) });

  return blocos.map(b => `<div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">${b.titulo}</strong><p class="text-secundario text-base mt-1">${b.texto}</p></div>`).join('');
}

export function gerarPropostaHTML(d: DadosPropostaTemplate): string {
  const ehAditivo = d.tipo === 'cliente_existente';
  const subtitulo = ehAditivo ? 'Aditivo de Escopo — Gestão Financeira' : 'Gestão Patrimonial e Performance Financeira';
  const introDefault = `${esc(d.nome)}, nosso objetivo é garantir que toda a sua rotina financeira tenha o nível de profissionalismo, segurança e controle que você espera. ${ehAditivo ? 'Hoje já cuidamos da sua operação — propomos ampliar o escopo para o <strong>Pilar Financeiro completo</strong>.' : 'Abaixo, a estrutura completa desenhada para a sua operação e o ecossistema de serviços disponíveis.'}`;
  const intro = d.textoIntroducao.trim() ? esc(d.textoIntroducao) : introDefault;
  const novo = Math.max(0, d.valorProposto - d.feeAtual);

  const contr = {
    adm: d.pacote !== 'asset_only',
    fin: d.pacote === 'full' || d.pacote === 'advanced' || d.usaConciliacao,
    jur: d.usaJuridico,
    inv: d.plTotal > 0,
  };

  const fundoCapa = d.imagemCapaUrl.trim()
    ? `<div class="absolute inset-0"><img src="${esc(d.imagemCapaUrl)}" alt="${esc(d.nome)}" class="w-full h-full object-cover object-top"></div>
       <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>`
    : `<div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>`;

  const pilares = [
    pilarHTML(1, 'Administrativo', 'Gestão completa da rotina e bens.', contr.adm,
      [{ texto: 'Gestão de Imóveis', contratado: true }, { texto: 'Gestão de Veículos', contratado: true },
       { texto: 'Contratação de Serviços', contratado: true }, { texto: 'Gestão de Funcionários', contratado: true },
       { texto: 'Organização de Viagens', contratado: true }]),
    pilarHTML(2, 'Financeiro', 'Operação e planejamento financeiro.', contr.fin,
      [{ texto: 'Planejamento Financeiro', contratado: d.pacote === 'full' || d.pacote === 'advanced' },
       { texto: 'Pagamento de Contas', contratado: d.pacote === 'full' || d.pacote === 'advanced' },
       { texto: 'Conciliação Bancária', contratado: d.usaConciliacao }, { texto: 'Fluxo de Caixa', contratado: d.pacote === 'full' }]),
    pilarHTML(3, 'Jurídico', 'Apoio consultivo contínuo.', contr.jur,
      [{ texto: 'Jurídico Consultivo', contratado: d.usaJuridico }, { texto: 'Revisão de Contratos', contratado: d.revisaoContratos },
       { texto: 'Planejamento Tributário', contratado: d.planejamentoTributario }, { texto: 'Direitos de Imagem', contratado: false }]),
    pilarHTML(4, 'Investimentos', 'Gestão de patrimônio e futuro.', contr.inv,
      [{ texto: 'Gestão de Investimentos', contratado: contr.inv }, { texto: 'M&A e Novos Negócios', contratado: false },
       { texto: 'Estudos de Viabilidade', contratado: false }]),
  ].join('');

  const composicao = ehAditivo
    ? `<div class="space-y-2 mb-4 text-sm">
         <div class="flex justify-between items-center text-secundario"><span>Escopo atual</span><span class="font-medium">${brl(d.feeAtual)}</span></div>
         <div class="flex justify-between items-center text-secundario"><span>Novo escopo (Financeiro)</span><span class="font-medium">${brl(novo)}</span></div>
       </div>`
    : `<div class="space-y-2 mb-4 text-sm"><div class="flex justify-between items-center text-secundario"><span>Gestão completa (mensal)</span><span class="font-medium">${brl(d.valorProposto)}</span></div></div>`;

  return `<!DOCTYPE html>
<html lang="pt-br" class="scroll-smooth"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proposta — ${esc(d.nome)}</title>
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
  @media print { *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important} #barra-print{display:none!important} section{break-inside:avoid} #capa{break-after:page} .service-card,.service-card-white,.service-card-inactive{break-inside:avoid} }
  #barra-print{position:fixed;right:20px;bottom:20px;z-index:50}
</style></head>
<body class="antialiased">
<div id="barra-print"><button onclick="window.print()" style="background:linear-gradient(135deg,#2F49EE,#732AD8,#D100B9);color:#fff;border:none;padding:12px 20px;border-radius:999px;font-family:Poppins,sans-serif;font-weight:600;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25)">🖨️ Imprimir / PDF</button></div>

<div class="w-full max-w-6xl mx-auto my-12 bg-white shadow-2xl rounded-lg overflow-hidden">

  <section id="capa" class="h-[700px] relative flex flex-col justify-end text-center text-white bg-gray-900">
    ${fundoCapa}
    <div class="absolute inset-0 flex justify-center" style="bottom:55%"><div style="width:36%;max-height:100%">${logoSVG('#FFFFFF', 'capa')}</div></div>
    <div class="relative z-10 p-8 pb-16 flex flex-col h-full"><div class="mt-auto">
      <div class="inline-block border border-white/30 px-6 py-2 rounded-full bg-black/30 backdrop-blur-sm mb-6"><span class="text-xs font-bold text-white uppercase tracking-widest">Proposta Comercial</span></div>
      <h1 class="text-2xl md:text-4xl font-light uppercase mb-2 text-white" style="letter-spacing:0.18em;text-shadow:0 2px 10px rgba(0,0,0,0.5)">Plano de Gestão <span class="text-primario font-normal">${esc(d.nome)}</span></h1>
      <h2 class="text-lg md:text-xl font-light text-gray-200 tracking-wider uppercase mt-4 max-w-2xl mx-auto">${subtitulo}</h2>
      <p class="text-xs text-gray-300 uppercase tracking-widest mt-4">${esc(d.data)}</p>
      <div class="w-24 h-1 mx-auto rounded-full mt-8" style="background:linear-gradient(90deg,#2F49EE,#732AD8,#D100B9)"></div>
    </div></div>
  </section>

  <section id="intro" class="p-12 md:p-20 text-center bg-white">
    <h2 class="text-4xl md:text-5xl font-bold text-principal mb-6">Sua Operação Financeira em Boas Mãos.</h2>
    <p class="text-xl md:text-2xl text-secundario leading-relaxed font-light max-w-4xl mx-auto">${intro}</p>
  </section>
  <div class="w-11/12 mx-auto border-t border-gray-200"></div>

  <section id="servicos" class="p-12 md:p-20" style="background:var(--cor-fundo-alternativo)">
    <h2 class="text-center text-4xl font-bold text-principal mb-12">O Ecossistema de Gestão</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">${pilares}</div>
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
      <div class="pr-8"><p class="text-xl text-secundario leading-relaxed font-light mb-6">Centralizamos toda a sua operação administrativa e financeira em nosso <strong>sistema de gestão (ERP)</strong>, garantindo controle total mesmo à distância.</p><p class="text-xl text-secundario leading-relaxed font-light">Você acompanha em tempo real a posição patrimonial, o fluxo de caixa e a evolução dos investimentos — tudo em um único painel.</p></div>
      <div class="space-y-6">
        <div class="service-card-white rounded-lg p-6 shadow-lg flex items-center space-x-4 border"><div class="text-3xl text-primario p-4 bg-white rounded-full shadow-inner"><i class="fas fa-chart-area"></i></div><div class="flex-grow"><h4 class="text-xl font-bold text-principal">Evolução Patrimonial</h4><p class="text-secundario text-sm">Performance consolidada.</p></div></div>
        <div class="service-card-white rounded-lg p-6 shadow-lg flex items-center space-x-4 border"><div class="text-3xl text-primario p-4 bg-white rounded-full shadow-inner"><i class="fas fa-building"></i></div><div class="flex-grow"><h4 class="text-xl font-bold text-principal">Gestão de Ativos</h4><p class="text-secundario text-sm">Imóveis e Veículos.</p></div></div>
      </div>
    </div>
  </section>

  <section id="parceria" class="p-12 md:p-20" style="background:var(--cor-fundo-alternativo)">
    <h2 class="text-center text-4xl font-bold text-principal mb-12">Nossa Parceria Estratégica</h2>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
      <div class="lg:col-span-1 service-card rounded-lg p-8 border-2 border-primario shadow-lg flex flex-col bg-white">
        <h3 class="text-lg font-semibold text-primario uppercase">INVESTIMENTO</h3>
        <h4 class="text-3xl font-bold text-principal mt-1 mb-4">O Plano</h4>
        <p class="text-secundario leading-relaxed mb-6 text-sm">Estrutura ${ehAditivo ? 'ampliada: operação atual + novo escopo' : 'completa de gestão patrimonial'}.</p>
        <div class="mt-auto"><div class="bg-gray-50 p-6 rounded-md border border-gray-200">
          <h5 class="font-bold text-xs mb-3 uppercase text-gray-500 tracking-wide text-left">Composição do Investimento:</h5>
          ${composicao}
          <div class="border-t border-gray-300 pt-3 flex justify-between items-end"><span class="text-xs text-gray-500 uppercase font-bold mb-1">Total Mensal</span><div class="text-right"><p class="text-2xl font-bold text-primario leading-none whitespace-nowrap">${brl(d.valorProposto)}</p></div></div>
          <p class="text-xs text-gray-500 mt-3 text-center">Pagamento mensal via boleto bancário, com vencimento todo dia 10.</p>
        </div></div>
      </div>
      <div class="lg:col-span-2 service-card rounded-lg p-8">
        <h3 class="text-lg font-semibold text-secundario uppercase">ALINHAMENTO</h3>
        <h4 class="text-3xl font-bold text-principal mt-1 mb-4">Escopo Contratado e Limites</h4>
        <p class="text-secundario leading-relaxed mb-6">O escopo descrito reflete exatamente a volumetria precificada — você paga pelo esforço dimensionado, com renegociação transparente se os volumes crescerem.</p>
        <div class="space-y-4 mt-6">${blocosEscopo(d, contr)}</div>
      </div>
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
    <p class="text-sm text-gray-400 mt-6">Proposta válida por 30 dias a partir da data de apresentação.</p>
  </section>

</div></body></html>`;
}
