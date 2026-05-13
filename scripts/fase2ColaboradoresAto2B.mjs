// Fase 2 Ato 2B — Replicação para trás (Dez/25).
//
// Deleta TODOS os docs atuais em fechamentos/2025-12/colaboradores/
// (30 docs com docIds UUID) e cria 21 docs canônicos com docId=slug,
// herdando Categoria A de colaboradores_base/ e recalculando Categoria B
// via espelho inline de calcularFolhaColaborador (incluindo ramo 'estagio').
//
// REGRAS ABSOLUTAS:
//   - Snapshot prévio em backups/firestore/ ANTES de qualquer write
//   - deleteDoc nos 30 docs atuais
//   - setDoc({merge:false}) nos 21 docs novos, docId = slug
//   - Não toca colaboradores_base/ nem qualquer outra coleção
//   - Read-only por default; write apenas com --apply
//
// PENDÊNCIA: cópia inline de calcularFolhaColaborador — registrada em
// audit-results/pendencias-fase3-descobertas.md. Sincronizada com função
// canônica em src/utils/financials.custos.ts (inclui ramo 'estagio'
// adicionado na Sub-etapa 2A.5.a).

import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initDb } from './_helpers.mjs';

const ROOT = process.cwd();
const PERIODO_ALVO = '2025-12';
const ANO_ALVO = 2025;
const ORIGEM_REPLICACAO = '2026-01'; // semântica: cópia "para trás" a partir de Jan/26 via base

// =========================================================================
// Constantes inline — espelho de src/utils/constants.ts
// =========================================================================

const HORAS_BRUTAS_ANO = 52 * 44;
const HORAS_FERIAS_ANO = 44 * (30 / 7);
const HORAS_DIA_UTIL = 44 / 5;
const FERIADOS_POR_LOCALIDADE = { SP: 15, RJ: 15 };
const HORAS_PRODUTIVAS_POR_LOCALIDADE = {
  SP: HORAS_BRUTAS_ANO - HORAS_FERIAS_ANO - FERIADOS_POR_LOCALIDADE.SP * HORAS_DIA_UTIL,
  RJ: HORAS_BRUTAS_ANO - HORAS_FERIAS_ANO - FERIADOS_POR_LOCALIDADE.RJ * HORAS_DIA_UTIL,
};

const TABELA_INSS = {
  2025: [
    { ate: 1518.00, aliquota: 0.075 },
    { ate: 2793.88, aliquota: 0.090 },
    { ate: 4190.83, aliquota: 0.120 },
    { ate: 8157.41, aliquota: 0.140 },
  ],
  2026: [
    { ate: 1621.00, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.090 },
    { ate: 4354.27, aliquota: 0.120 },
    { ate: 8475.55, aliquota: 0.140 },
  ],
};

const TABELA_IRRF = {
  2025: [
    { ate: 2259.20,  aliquota: 0,     deducao: 0      },
    { ate: 2826.65,  aliquota: 0.075, deducao: 169.44 },
    { ate: 3751.05,  aliquota: 0.150, deducao: 381.44 },
    { ate: 4664.68,  aliquota: 0.225, deducao: 662.77 },
    { ate: Infinity, aliquota: 0.275, deducao: 896.00 },
  ],
  2026: [
    { ate: 2428.80,  aliquota: 0,     deducao: 0      },
    { ate: 2826.65,  aliquota: 0.075, deducao: 182.16 },
    { ate: 3751.05,  aliquota: 0.150, deducao: 394.16 },
    { ate: 4664.68,  aliquota: 0.225, deducao: 675.49 },
    { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
  ],
};

const REDUTOR_IR_2026 = (renda) =>
  renda <= 5000 ? 312.89
  : renda <= 7350 ? Math.max(0, 978.62 - 0.133145 * renda)
  : 0;

const DEDUCAO_DEPENDENTE_IRRF = { 2025: 189.59, 2026: 189.59 };

// =========================================================================
// Funções inline — espelho de src/utils/financials.custos.ts
// =========================================================================

function calcularINSS(salarioBruto, ano) {
  const tabela = TABELA_INSS[ano] ?? TABELA_INSS[2026];
  let inss = 0;
  let baseAnterior = 0;
  for (const faixa of tabela) {
    if (salarioBruto <= 0) break;
    const limiteAtual = Math.min(salarioBruto, faixa.ate);
    const baseNaFaixa = Math.max(0, limiteAtual - baseAnterior);
    inss += baseNaFaixa * faixa.aliquota;
    baseAnterior = faixa.ate;
    if (salarioBruto <= faixa.ate) break;
  }
  return Math.round(inss * 100) / 100;
}

function calcularIRRF(salarioBruto, inss, qtdDep, ano) {
  const tabela = TABELA_IRRF[ano] ?? TABELA_IRRF[2026];
  const deducaoDep = DEDUCAO_DEPENDENTE_IRRF[ano] ?? 189.59;
  const baseCalculo = salarioBruto - inss - qtdDep * deducaoDep;
  if (baseCalculo <= 0) return 0;
  let irrf = 0;
  for (const faixa of tabela) {
    if (baseCalculo <= faixa.ate) {
      irrf = baseCalculo * faixa.aliquota - faixa.deducao;
      break;
    }
  }
  irrf = Math.max(0, irrf);
  if (ano === 2026) irrf = Math.max(0, irrf - REDUTOR_IR_2026(salarioBruto));
  return Math.round(irrf * 100) / 100;
}

function buscarTetoPorPeriodo(colaborador, periodo) {
  if (!Array.isArray(colaborador.historico_reajustes) || colaborador.historico_reajustes.length === 0) {
    return {
      salario_teto_cargo: colaborador.salario_teto_cargo,
      liquido_acordado: colaborador.liquido_acordado ?? 0,
    };
  }
  const ordenado = [...colaborador.historico_reajustes].sort((a, b) => a.vigencia.localeCompare(b.vigencia));
  let resultado = ordenado[0];
  for (const r of ordenado) {
    if (r.vigencia <= periodo) resultado = r;
    else break;
  }
  return {
    salario_teto_cargo: resultado.salario_teto_cargo,
    liquido_acordado: resultado.liquido_acordado,
  };
}

function calcularFolhaColaborador(c, ano, periodo) {
  const horasProd = HORAS_PRODUTIVAS_POR_LOCALIDADE[c.localidade ?? 'SP'] ?? HORAS_PRODUTIVAS_POR_LOCALIDADE.SP;

  // Ramo estagiário (Lei 11.788/2008) — Sub-etapa 2A.5.a
  if (c.tipo_vinculo === 'estagio') {
    const base = c.salario_base ?? 0;
    const custoMensal = base + (c.beneficios_fixos ?? 0);
    return {
      salario_teto_cargo: 0, liquido_acordado: 0, qtd_dependentes: 0,
      inss: 0, irrf: 0, redutor_ir_2026: 0, irrf_liquido: 0,
      liquido_do_teto: base, complemento_plr: 0, reflexos_plr_mensal: 0,
      encargos_patronais: 0, decimo_terceiro_ferias: 0,
      custo_total_mensal: custoMensal, custo_hora: (custoMensal * 12) / horasProd,
    };
  }

  if (c.tipo_vinculo === 'pro_labore') {
    const base = c.salario_base ?? 0;
    const encargos = base * 0.20;
    const custoMensal = base + (c.beneficios_fixos ?? 0) + encargos;
    return {
      salario_teto_cargo: 0, liquido_acordado: 0, qtd_dependentes: 0,
      inss: 0, irrf: 0, redutor_ir_2026: 0, irrf_liquido: 0,
      liquido_do_teto: 0, complemento_plr: 0, reflexos_plr_mensal: 0,
      encargos_patronais: encargos, decimo_terceiro_ferias: 0,
      custo_total_mensal: custoMensal, custo_hora: (custoMensal * 12) / horasProd,
    };
  }

  // CLT
  const reajuste = periodo
    ? buscarTetoPorPeriodo(c, periodo)
    : { salario_teto_cargo: c.salario_teto_cargo ?? 0, liquido_acordado: c.liquido_acordado ?? 0 };
  const teto = reajuste.salario_teto_cargo;
  const liquidoAcordado = reajuste.liquido_acordado;
  const qtdDep = c.qtd_dependentes ?? 0;
  const inss = calcularINSS(teto, ano);
  const irrf = calcularIRRF(teto, inss, qtdDep, ano);
  const redutor = ano === 2026 ? REDUTOR_IR_2026(teto) : 0;
  const irrfLiquido = irrf;
  const liquidoDoTeto = teto - inss - irrfLiquido;
  const complementoPLR = Math.max(0, liquidoAcordado - liquidoDoTeto);
  const reflexosPLR = (complementoPLR / 12) * (4 / 3);
  const encargos = teto * 0.28;
  const decimoFerias = (teto / 12) * (4 / 3);
  const custoMensal = teto + (c.beneficios_fixos ?? 0) + encargos + decimoFerias + complementoPLR + reflexosPLR;
  return {
    salario_teto_cargo: teto, liquido_acordado: liquidoAcordado, qtd_dependentes: qtdDep,
    inss, irrf: irrfLiquido, redutor_ir_2026: redutor, irrf_liquido: irrfLiquido,
    liquido_do_teto: liquidoDoTeto, complemento_plr: complementoPLR, reflexos_plr_mensal: reflexosPLR,
    encargos_patronais: encargos, decimo_terceiro_ferias: decimoFerias,
    custo_total_mensal: custoMensal, custo_hora: (custoMensal * 12) / horasProd,
  };
}

// =========================================================================
// Util
// =========================================================================

function slugify(nome) {
  if (!nome) return '';
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function parseArgs(argv) {
  return { apply: argv.slice(2).includes('--apply') };
}

function gravarSnapshot(docs, modo) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `fase2-ato2b-dez25-pre-write-${ts}.json`);
  writeFileSync(path, JSON.stringify({
    timestamp: new Date().toISOString(), modo, periodo: PERIODO_ALVO,
    total: docs.length,
    docs: docs.map((d) => ({ docId: d.id, path: d.ref.path, dados_antes: d.data() })),
  }, null, 2), 'utf8');
  return path;
}

function gravarRelatorio(conteudo, modoTag) {
  const dir = join(ROOT, 'audit-results');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `fase2-ato2b-replicacao-dez25-${modoTag}-${ts}.md`);
  writeFileSync(path, conteudo, 'utf8');
  return path;
}

function fmtBRL(v) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  const args = parseArgs(process.argv);
  const modo = args.apply ? 'APLICADO' : 'DRY-RUN';
  console.log(`[Ato 2B] Iniciado — modo: ${modo} | período alvo: ${PERIODO_ALVO}`);

  const db = initDb();

  // ===========================================================
  // Fase A — Validação pré-execução
  // ===========================================================
  console.log('\n[Ato 2B] Fase A — Validação pré-execução...');

  // A.1 — Base íntegra
  const baseSnap = await getDocs(collection(db, 'colaboradores_base'));
  console.log(`[Ato 2B] colaboradores_base/ tem ${baseSnap.size} docs.`);
  const baseDocs = baseSnap.docs;
  const baseIncompletos = baseDocs.filter((d) => {
    const data = d.data();
    return !data.funcao_principal || data.cadastro_completo !== true;
  });
  if (baseIncompletos.length > 0) {
    console.error(`[Ato 2B] ABORTAR: ${baseIncompletos.length} doc(s) em colaboradores_base/ incompleto(s):`);
    for (const d of baseIncompletos.slice(0, 5)) console.error(`  - ${d.id}: funcao_principal=${d.data().funcao_principal} | cadastro_completo=${d.data().cadastro_completo}`);
    process.exit(1);
  }
  console.log(`[Ato 2B] ✓ Base íntegra: todos os ${baseDocs.length} docs com funcao_principal e cadastro_completo=true.`);

  // A.2 — Estado atual de Dez/25
  const atualSnap = await getDocs(collection(db, 'fechamentos', PERIODO_ALVO, 'colaboradores'));
  const docsAtuais = atualSnap.docs;
  console.log(`[Ato 2B] fechamentos/${PERIODO_ALVO}/colaboradores/ tem ${docsAtuais.length} docs.`);

  // Indexa atuais por id_estavel para auditoria comparativa.
  const atualPorIdEstavel = new Map();
  for (const d of docsAtuais) {
    const idEst = d.data().id_estavel;
    if (!idEst) continue;
    if (!atualPorIdEstavel.has(idEst)) atualPorIdEstavel.set(idEst, []);
    atualPorIdEstavel.get(idEst).push(d);
  }

  // A.3 — Diagnóstico do estado atual
  const slugsBase = new Set(baseDocs.map((d) => d.id));
  const idEstaveisBase = new Map(baseDocs.map((d) => [d.data().id_estavel, d.id]));

  const slugsAtuaisReais = new Set();
  const docsTemplate = [];
  const slugsDuplicados = new Map(); // slug → array de docs
  const docsSemMatch = [];

  for (const d of docsAtuais) {
    const data = d.data();
    const idEst = data.id_estavel;
    const slug = idEst ? idEstaveisBase.get(idEst) : null;

    const isTemplate = !data.nome_colaborador?.trim()
      || !data.cargo?.trim()
      || !data.funcao_principal?.trim()
      || slugify(data.nome_colaborador) === 'a_contratar';

    if (isTemplate) {
      docsTemplate.push({ docId: d.id, nome: data.nome_colaborador ?? '(vazio)' });
      continue;
    }

    if (!slug) {
      docsSemMatch.push({ docId: d.id, nome: data.nome_colaborador, id_estavel: idEst });
      continue;
    }

    slugsAtuaisReais.add(slug);
    const docsDoSlug = atualPorIdEstavel.get(idEst) ?? [];
    if (docsDoSlug.length > 1) {
      slugsDuplicados.set(slug, docsDoSlug);
    }
  }

  const slugsAusentesNoAtual = [...slugsBase].filter((s) => !slugsAtuaisReais.has(s));

  console.log(`[Ato 2B] Estado atual de Dez/25:`);
  console.log(`  - Total docs: ${docsAtuais.length}`);
  console.log(`  - Templates (a_contratar, cinza, etc.): ${docsTemplate.length}`);
  console.log(`  - Docs sem match em base (id_estavel órfão): ${docsSemMatch.length}`);
  console.log(`  - Slugs únicos reais encontrados: ${slugsAtuaisReais.size}`);
  console.log(`  - Slugs duplicados (>1 doc): ${slugsDuplicados.size}`);
  if (slugsDuplicados.size > 0) {
    for (const [slug, docs] of slugsDuplicados) {
      console.log(`      ${slug}: ${docs.length} docs (${docs.map((x) => x.id).join(', ')})`);
    }
  }
  console.log(`  - Slugs em base mas ausentes em Dez/25: ${slugsAusentesNoAtual.length}`);
  if (slugsAusentesNoAtual.length > 0) {
    console.log(`      ${slugsAusentesNoAtual.join(', ')}`);
  }

  // ===========================================================
  // Fase C — Cálculo do novo estado
  // ===========================================================
  console.log('\n[Ato 2B] Fase C — Calculando novo estado para os 21 docs canônicos...');

  const propostas = []; // { slug, payloadNovo, custoNovo, custoAtual (soma se duplicado) }
  let somaCustoAtual = 0; // soma dos 30 docs atuais (incluindo templates/duplicados)
  for (const d of docsAtuais) somaCustoAtual += d.data().custo_total_mensal ?? 0;

  for (const baseDoc of baseDocs) {
    const slug = baseDoc.id;
    const data = baseDoc.data();
    const folha = calcularFolhaColaborador(data, ANO_ALVO, PERIODO_ALVO);

    // Resolve teto/líquido vigentes p/ Dez/25 (via histórico se houver)
    const reajuste = buscarTetoPorPeriodo(data, PERIODO_ALVO);

    const payload = {
      // Identidade
      nome_colaborador: data.nome_colaborador,
      slug,
      id_estavel: data.id_estavel,
      // Cargo / função
      cargo: data.cargo,
      funcao_principal: data.funcao_principal,
      funcoes_secundarias: data.funcoes_secundarias ?? [],
      // Status
      ativo: data.ativo ?? true,
      // Categoria A (perenes)
      alocavel: data.alocavel,
      percentual_alocavel: data.percentual_alocavel,
      percentual_institucional: data.percentual_institucional,
      salario_teto_cargo: reajuste.salario_teto_cargo ?? 0,
      salario_base: data.salario_base ?? 0,
      liquido_acordado: reajuste.liquido_acordado ?? 0,
      beneficios_fixos: data.beneficios_fixos ?? 0,
      tipo_vinculo: data.tipo_vinculo ?? 'clt',
      qtd_dependentes: data.qtd_dependentes ?? 0,
      localidade: data.localidade ?? 'SP',
      historico_reajustes: data.historico_reajustes ?? [],
      // Categoria B (recalculada)
      inss: folha.inss,
      irrf: folha.irrf,
      irrf_liquido: folha.irrf_liquido,
      redutor_ir_2026: folha.redutor_ir_2026,
      liquido_do_teto: folha.liquido_do_teto,
      complemento_plr: folha.complemento_plr,
      reflexos_plr_mensal: folha.reflexos_plr_mensal,
      encargos_patronais: folha.encargos_patronais,
      decimo_terceiro_ferias: folha.decimo_terceiro_ferias,
      custo_total_mensal: folha.custo_total_mensal,
      custo_hora: folha.custo_hora,
      // Metadados de rastreabilidade
      cadastro_completo: true,
      replicado_de: ORIGEM_REPLICACAO,
      data_replicacao: Timestamp.now(),
      origem: 'fase2-ato2b',
    };

    // Custo atual para este slug = soma dos custos dos docs atuais com mesmo id_estavel
    const docsAtuaisDoSlug = atualPorIdEstavel.get(data.id_estavel) ?? [];
    const custoAtualSlug = docsAtuaisDoSlug.reduce((s, d) => s + (d.data().custo_total_mensal ?? 0), 0);

    propostas.push({
      slug,
      nome: data.nome_colaborador,
      payloadNovo: payload,
      custoAtual: custoAtualSlug,
      docsAtuaisIds: docsAtuaisDoSlug.map((x) => x.id),
      duplicado: docsAtuaisDoSlug.length > 1,
      novoEmDez25: docsAtuaisDoSlug.length === 0,
    });
  }

  const somaCustoNovo = propostas.reduce((s, p) => s + p.payloadNovo.custo_total_mensal, 0);

  // ===========================================================
  // Fase D — Relatório dry-run
  // ===========================================================
  console.log('\n=== Tabela comparativa por slug ===\n');
  console.log('Slug                          | Status Dez/25      | Custo atual    | Custo novo     | Δ');
  console.log('------------------------------|--------------------|---------------:|--------------:|--------');
  for (const p of propostas) {
    const status = p.novoEmDez25 ? 'AUSENTE → criar'
      : p.duplicado ? `DUPLICADO (${p.docsAtuaisIds.length} docs)`
      : 'Único (1 doc)';
    const delta = p.payloadNovo.custo_total_mensal - p.custoAtual;
    console.log(
      p.slug.padEnd(30) + '| ' +
      status.padEnd(19) + '| ' +
      fmtBRL(p.custoAtual).padStart(14) + ' | ' +
      fmtBRL(p.payloadNovo.custo_total_mensal).padStart(14) + ' | ' +
      ((delta >= 0 ? '+' : '') + fmtBRL(delta)),
    );
  }

  console.log('\n=== Resumo ===');
  console.log(`  Total docs base: ${baseDocs.length}`);
  console.log(`  Total docs atuais Dez/25: ${docsAtuais.length}`);
  console.log(`  Templates a remover: ${docsTemplate.length}`);
  console.log(`  Duplicatas a consolidar: ${slugsDuplicados.size}`);
  console.log(`  Docs sem match (órfãos): ${docsSemMatch.length}`);
  console.log(`  Slugs novos (não existiam em Dez/25): ${propostas.filter((p) => p.novoEmDez25).length}`);
  console.log(`  Custo total Dez/25 ANTES: ${fmtBRL(somaCustoAtual)}`);
  console.log(`  Custo total Dez/25 DEPOIS: ${fmtBRL(somaCustoNovo)}`);
  console.log(`  Δ: ${(somaCustoNovo - somaCustoAtual >= 0 ? '+' : '') + fmtBRL(somaCustoNovo - somaCustoAtual)}`);

  // ===========================================================
  // Fase B — Snapshot prévio (executado SEMPRE — para dry-run e apply)
  // ===========================================================
  console.log('\n[Ato 2B] Fase B — Gravando snapshot prévio dos 30 docs atuais...');
  const pathSnap = gravarSnapshot(docsAtuais, modo);
  console.log(`[Ato 2B] Snapshot prévio: ${pathSnap}`);

  // ===========================================================
  // Fase E — Apply (somente com --apply)
  // ===========================================================
  let deletados = 0, criados = 0, erros = [];
  if (args.apply) {
    console.log('\n[Ato 2B] Fase E — APLICANDO writes...');

    // Delete dos 30 docs atuais
    console.log(`[Ato 2B] Deletando ${docsAtuais.length} docs antigos...`);
    for (const d of docsAtuais) {
      try {
        await deleteDoc(d.ref);
        deletados++;
        console.log(`  [Ato 2B Delete] ${deletados}/${docsAtuais.length} ${d.id}`);
      } catch (e) {
        erros.push({ acao: 'delete', docId: d.id, erro: e.message });
        console.error(`  [Ato 2B Delete] ERRO ${d.id}: ${e.message}`);
      }
    }

    // Create dos 21 docs novos com docId=slug
    console.log(`[Ato 2B] Criando ${propostas.length} docs canônicos (docId=slug)...`);
    for (const p of propostas) {
      try {
        await setDoc(doc(db, 'fechamentos', PERIODO_ALVO, 'colaboradores', p.slug), p.payloadNovo);
        criados++;
        console.log(`  [Ato 2B Create] ${criados}/${propostas.length} ${p.slug}`);
      } catch (e) {
        erros.push({ acao: 'create', slug: p.slug, erro: e.message });
        console.error(`  [Ato 2B Create] ERRO ${p.slug}: ${e.message}`);
      }
    }

    // Validação pós-write
    console.log('\n[Ato 2B] Validando pós-write...');
    const valSnap = await getDocs(collection(db, 'fechamentos', PERIODO_ALVO, 'colaboradores'));
    const valDocs = valSnap.docs;
    const docIdsValidos = new Set(valDocs.map((d) => d.id));
    const docIdsBate = valDocs.every((d) => d.data().slug === d.id);
    const docNeroneAntigo = valDocs.find((d) => d.id === '6fcc0862-5042-438e-95fe-e51a174b0f78');
    const algumTemplate = valDocs.some((d) => {
      const data = d.data();
      return !data.nome_colaborador?.trim() || !data.cargo?.trim() || slugify(data.nome_colaborador) === 'a_contratar';
    });

    const validacoes = {
      total_correto: valDocs.length === propostas.length,
      docIds_sao_slugs: docIdsBate,
      doc_6fcc0862_removido: !docNeroneAntigo,
      sem_templates: !algumTemplate,
    };
    console.log(`  Total docs Dez/25: ${valDocs.length} (esperado: ${propostas.length}) — ${validacoes.total_correto ? '✓' : '✗'}`);
    console.log(`  docId == slug em todos: ${validacoes.docIds_sao_slugs ? 'SIM ✓' : 'NÃO ✗'}`);
    console.log(`  Doc 6fcc0862 removido: ${validacoes.doc_6fcc0862_removido ? 'SIM ✓' : 'NÃO ✗'}`);
    console.log(`  Sem templates: ${validacoes.sem_templates ? 'SIM ✓' : 'NÃO ✗'}`);

    if (!Object.values(validacoes).every((v) => v)) {
      throw new Error('Validação pós-write falhou');
    }
  }

  // ===========================================================
  // Fase F — Relatório markdown
  // ===========================================================
  const md = [];
  md.push(`# Fase 2 Ato 2B — Replicação para Dez/25 — ${modo}`);
  md.push('');
  md.push(`Gerado em ${new Date().toISOString()}.`);
  md.push('');
  md.push('## Fase A — Validação pré-execução');
  md.push('');
  md.push(`- Base íntegra (21 docs com funcao_principal + cadastro_completo): ✓`);
  md.push(`- Estado atual Dez/25: **${docsAtuais.length} docs**`);
  md.push(`  - Templates: ${docsTemplate.length} (${docsTemplate.map((x) => x.nome).join(', ') || '—'})`);
  md.push(`  - Slugs duplicados: ${slugsDuplicados.size} (${[...slugsDuplicados.keys()].join(', ') || '—'})`);
  md.push(`  - Docs sem match (órfãos): ${docsSemMatch.length}`);
  md.push(`  - Slugs em base ausentes em Dez/25: ${slugsAusentesNoAtual.length} (${slugsAusentesNoAtual.join(', ') || '—'})`);
  md.push('');
  md.push('## Fase B — Snapshot prévio');
  md.push('');
  md.push(`- Arquivo: \`${pathSnap}\``);
  md.push(`- Total docs salvos: ${docsAtuais.length}`);
  md.push('');
  md.push('## Fase C/D — Comparativo por slug');
  md.push('');
  md.push('| # | Slug | Status atual | Custo atual | Custo novo | Δ |');
  md.push('|---|---|---|---:|---:|---:|');
  propostas.forEach((p, i) => {
    const status = p.novoEmDez25 ? 'AUSENTE → criar'
      : p.duplicado ? `DUPLICADO (${p.docsAtuaisIds.length} docs)`
      : 'Único (1 doc)';
    const delta = p.payloadNovo.custo_total_mensal - p.custoAtual;
    md.push(`| ${i + 1} | \`${p.slug}\` | ${status} | ${fmtBRL(p.custoAtual)} | ${fmtBRL(p.payloadNovo.custo_total_mensal)} | ${(delta >= 0 ? '+' : '') + fmtBRL(delta)} |`);
  });
  md.push('');
  md.push('## Resumo');
  md.push('');
  md.push(`- Total docs base: ${baseDocs.length}`);
  md.push(`- Total docs atuais Dez/25 (a deletar): ${docsAtuais.length}`);
  md.push(`- Total docs novos (a criar): ${propostas.length}`);
  md.push(`- Templates a remover: ${docsTemplate.length}`);
  md.push(`- Duplicatas a consolidar: ${slugsDuplicados.size}`);
  md.push(`- Custo total Dez/25 ANTES: **${fmtBRL(somaCustoAtual)}**`);
  md.push(`- Custo total Dez/25 DEPOIS: **${fmtBRL(somaCustoNovo)}**`);
  md.push(`- Δ: ${(somaCustoNovo - somaCustoAtual >= 0 ? '+' : '') + fmtBRL(somaCustoNovo - somaCustoAtual)}`);
  md.push('');
  if (args.apply) {
    md.push('## Fase E — Apply');
    md.push('');
    md.push(`- Deletados: ${deletados}/${docsAtuais.length}`);
    md.push(`- Criados: ${criados}/${propostas.length}`);
    md.push(`- Erros: ${erros.length}`);
    if (erros.length > 0) {
      md.push('');
      md.push('### Erros:');
      for (const e of erros) md.push(`- ${e.acao} ${e.docId ?? e.slug}: ${e.erro}`);
    }
  }

  const pathMd = gravarRelatorio(md.join('\n'), args.apply ? 'aplicado' : 'dry-run');
  console.log(`\n[Ato 2B] Relatório salvo: ${pathMd}`);
  console.log(`\n[Ato 2B] Concluído. Modo: ${modo}`);
}

main().catch((e) => {
  console.error('[Ato 2B] Erro:', e);
  process.exit(1);
});
