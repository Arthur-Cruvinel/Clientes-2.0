// --- Template do orçamento extraordinário (HTML autossuficiente) ---
// Mesmo molde do propostaTemplate (Tailwind CDN + Poppins + logo + tira contínua
// no PDF), mas documento próprio e mais enxuto: cabeçalho, lista de itens com
// valores, cláusulas informativas (% como TEXTO), total, validade, condições.
// Logo re-importado do raw (decisão: NÃO extrair de propostaTemplate).

import logoRaw from '../simulador/logoGalaticos.svg?raw';
import type { DadosOrcamento } from '../../types';

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Data de apresentação: criado_em (ISO) formatado pt-BR; fallback = hoje.
const formatData = (iso?: string): string => {
  const dt = iso ? new Date(iso) : new Date();
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

/** Logo fiel parametrizada por cor (sem fundo) — mesma transformação do
 *  propostaTemplate, copiada para não acoplar os dois templates. */
function logoSVG(cor: string, suffix: string): string {
  return logoRaw
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<clipPath id="clip0h">[\s\S]*?<\/clipPath>/, '')
    .replace(/ clip-path="url\(#clip0h\)"/, '')
    .replace(/ width="180" height="45"/, ' width="100%" height="100%" viewBox="0 0 180 46" preserveAspectRatio="xMidYMid meet" style="display:block"')
    .replace(/fill="white"/g, `fill="${cor}"`)
    .replace(/id="fill1h"/g, `id="fill1${suffix}"`).replace(/url\(#fill1h\)/g, `url(#fill1${suffix})`);
}

function itensHTML(d: DadosOrcamento): string {
  if (!d.itens.length) {
    return `<p class="text-secundario text-base">Nenhum item neste orçamento.</p>`;
  }
  return d.itens.map(it => {
    const clausula = it.clausula_informativa
      ? `<p class="text-[13px] text-secundario mt-1 italic">${esc(it.clausula_informativa)}</p>`
      : '';
    return `<div class="flex items-start justify-between gap-6 py-4 border-b border-gray-200">
      <div class="flex-grow"><strong class="text-principal text-base">${esc(it.descricao)}</strong>${clausula}</div>
      <div class="text-right text-principal text-lg font-semibold whitespace-nowrap">${brl(it.valor)}</div>
    </div>`;
  }).join('');
}

export function gerarOrcamentoHTML(d: DadosOrcamento, opts: { paraPdf?: boolean } = {}): string {
  const temClausula = d.itens.some(it => it.clausula_informativa);
  return `<!DOCTYPE html>
<html lang="pt-br" class="scroll-smooth"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Orçamento — ${esc(d.nome_cliente)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --cor-primaria:#732AD8; --cor-destaque:#D100B9; --cor-acento:#2F49EE; --cor-texto-principal:#160F41; --cor-texto-secundario:#4B5563; }
  body { font-family:'Poppins',sans-serif; background:#F3F4F6; color:var(--cor-texto-principal); }
  .text-primario{color:var(--cor-primaria)} .text-principal{color:var(--cor-texto-principal)} .text-secundario{color:var(--cor-texto-secundario)}
  /* PDF = PÁGINA ÚNICA contínua (PDFShift format "1152xauto", use_print:false).
     O bloco abaixo encosta a tira no topo/fim (zera my-12 do #doc + margem do
     body) — só sai no HTML com paraPdf:true; browser não é afetado. */
  #barra-print{position:fixed;right:20px;bottom:20px;z-index:50}${opts.paraPdf ? `
  body{margin:0!important;background:#fff!important}
  #doc{margin-top:0!important;margin-bottom:0!important}` : ''}
</style></head>
<body class="antialiased">
${opts.paraPdf ? '' : `<div id="barra-print"><button onclick="window.print()" style="background:linear-gradient(135deg,#2F49EE,#732AD8,#D100B9);color:#fff;border:none;padding:12px 20px;border-radius:999px;font-family:Poppins,sans-serif;font-weight:600;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25)">🖨️ Imprimir / PDF</button></div>`}

<div id="doc" class="w-full max-w-6xl mx-auto my-12 bg-white shadow-2xl rounded-lg overflow-hidden">

  <section id="capa" class="relative px-12 md:px-20 py-16 text-white" style="background:linear-gradient(120deg,#160F41 0%,#2F49EE 60%,#732AD8 100%)">
    <div class="mb-10" style="width:200px">${logoSVG('#FFFFFF', 'capa')}</div>
    <div class="inline-block border border-white/30 px-5 py-1.5 rounded-full bg-black/20 mb-5"><span class="text-xs font-bold text-white uppercase tracking-widest">Orçamento</span></div>
    <h1 class="text-3xl md:text-4xl font-light uppercase" style="letter-spacing:0.12em">Serviços Extraordinários</h1>
    <h2 class="text-xl md:text-2xl font-semibold text-white mt-4">${esc(d.nome_cliente)}</h2>
    <p class="text-xs text-white/70 uppercase tracking-widest mt-3">${esc(formatData(d.criado_em))}</p>
  </section>

  <section id="itens" class="p-12 md:p-20 bg-white">
    <h3 class="text-sm font-semibold text-secundario uppercase tracking-wide mb-1">Detalhamento</h3>
    <h2 class="text-3xl font-bold text-principal mb-6">Itens do Orçamento</h2>
    <p class="text-secundario leading-relaxed mb-6 max-w-3xl">Serviços extraordinários — pontuais e não-recorrentes, fora do fee mensal — orçados a preço de mercado.</p>
    <div>${itensHTML(d)}</div>
    <div class="flex items-center justify-between mt-6 pt-4">
      <span class="text-base font-semibold text-principal uppercase tracking-wide">Valor Total</span>
      <span class="text-3xl font-extrabold text-primario">${brl(d.valor_total)}</span>
    </div>
    ${temClausula ? `<p class="text-[12px] text-secundario mt-4 italic">As cláusulas percentuais acima são informativas e independem do valor fixo orçado; o êxito/mais-valia é apurado no resultado.</p>` : ''}
  </section>

  <section id="condicoes" class="p-12 md:p-20" style="background:var(--cor-fundo-alternativo);background:#F9FAFB">
    <h2 class="text-center text-2xl font-bold text-principal mb-8">Condições</h2>
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">Validade</strong><p class="text-secundario text-base mt-1">Este orçamento é válido por ${d.validadeDias} dias a partir da data de apresentação.</p></div>
      <div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">Natureza</strong><p class="text-secundario text-base mt-1">Serviços extraordinários são pontuais e não-recorrentes, cobrados à parte do fee mensal de gestão.</p></div>
      ${d.observacoes && d.observacoes.trim() ? `<div class="bg-white p-5 rounded-md border border-gray-200"><strong class="text-principal text-lg">Observações</strong><p class="text-secundario text-base mt-1">${esc(d.observacoes)}</p></div>` : ''}
    </div>
  </section>

  <section id="fechamento" class="p-16 text-center bg-white">
    <div class="mx-auto mb-2" style="width:200px;color:#160F41">${logoSVG('#160F41', 'fim')}</div>
    <div class="w-24 h-1.5 mx-auto my-6 rounded-full" style="background:linear-gradient(90deg,#2F49EE,#732AD8,#D100B9)"></div>
    <p class="mt-2 text-2xl text-secundario font-light max-w-2xl mx-auto">Gestão Patrimonial e Performance Financeira.</p>
  </section>

</div></body></html>`;
}
