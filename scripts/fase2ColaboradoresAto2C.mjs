// Fase 2 Ato 2C — Replicação canônica para Jan/Fev/Mar/Abr/26.
//
// 1 período por execução (--periodo obrigatório). Padrão idêntico ao
// Ato 2B (delete 21 docs UUID + create 21 docs com docId=slug), mas
// para os 4 períodos pós-Dez/25 onde dados já estão corretos pós-2A.5.
//
// Diferença vs 2B:
//   - Deleta 21 (não 30) — esses períodos não têm templates nem duplicatas
//   - Δ Custo Folha esperado: ~R$ 0 (dados já corretos; só normaliza docId)
//   - replicado_de varia por período (Jan/26 → 'colaboradores_base';
//     Fev/26 → '2026-01'; Mar/26 → '2026-02'; Abr/26 → '2026-03')
//   - origem: 'fase2-ato2c'
//
// REGRAS ABSOLUTAS:
//   - Snapshot prévio em backups/firestore/ antes de qualquer write
//   - deleteDoc nos 21 docs atuais
//   - setDoc({merge:false}) docId=slug
//   - Não toca outras coleções
//   - Read-only por default; write apenas com --apply
//
// PENDÊNCIA: cópia inline de calcularFolhaColaborador — registrada em
// audit-results/pendencias-fase3-descobertas.md. Inclui ramo 'estagio'.

import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initDb } from './_helpers.mjs';

const ROOT = process.cwd();
const PERIODOS_VALIDOS = new Set(['2026-01', '2026-02', '2026-03', '2026-04']);
const REPLICADO_DE_POR_PERIODO = {
  '2026-01': 'colaboradores_base',
  '2026-02': '2026-01',
  '2026-03': '2026-02',
  '2026-04': '2026-03',
};

// =========================================================================
// Constantes e funções inline — espelho de src/utils/financials.custos.ts
// (sincronizado com sub-etapa 2A.5.a — inclui branch 'estagio')
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
  const args = { periodo: null, apply: false };
  for (const a of argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--periodo=')) args.periodo = a.slice('--periodo='.length).trim();
  }
  return args;
}

function gravarSnapshot(docs, periodo, modo) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `fase2-ato2c-${periodo}-pre-write-${ts}.json`);
  writeFileSync(path, JSON.stringify({
    timestamp: new Date().toISOString(), modo, periodo,
    total: docs.length,
    docs: docs.map((d) => ({ docId: d.id, path: d.ref.path, dados_antes: d.data() })),
  }, null, 2), 'utf8');
  return path;
}

function gravarRelatorio(conteudo, periodo, modoTag) {
  const dir = join(ROOT, 'audit-results');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `fase2-ato2c-${periodo}-${modoTag}-${ts}.md`);
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

  if (!args.periodo) {
    console.error('ERRO: --periodo=YYYY-MM é obrigatório.');
    process.exit(1);
  }
  if (!PERIODOS_VALIDOS.has(args.periodo)) {
    console.error(`ERRO: --periodo deve ser um de ${[...PERIODOS_VALIDOS].join(', ')}. Recebido: "${args.periodo}".`);
    process.exit(1);
  }

  const PERIODO = args.periodo;
  const ANO = parseInt(PERIODO.split('-')[0], 10);
  const REPLICADO_DE = REPLICADO_DE_POR_PERIODO[PERIODO];

  console.log(`[Ato 2C] Iniciado — modo: ${modo} | período: ${PERIODO} | ano: ${ANO} | replicado_de: ${REPLICADO_DE}`);

  const db = initDb();

  // ===========================================================
  // Fase A — Validação pré-execução
  // ===========================================================
  console.log('\n[Ato 2C] Fase A — Validação pré-execução...');

  const baseSnap = await getDocs(collection(db, 'colaboradores_base'));
  console.log(`[Ato 2C] colaboradores_base/ tem ${baseSnap.size} docs.`);
  const baseDocs = baseSnap.docs;
  const baseIncompletos = baseDocs.filter((d) => {
    const data = d.data();
    return !data.funcao_principal || data.cadastro_completo !== true;
  });
  if (baseIncompletos.length > 0) {
    console.error(`[Ato 2C] ABORTAR: ${baseIncompletos.length} doc(s) em colaboradores_base/ incompleto(s)`);
    process.exit(1);
  }
  console.log(`[Ato 2C] ✓ Base íntegra (${baseDocs.length} docs).`);

  const atualSnap = await getDocs(collection(db, 'fechamentos', PERIODO, 'colaboradores'));
  const docsAtuais = atualSnap.docs;
  console.log(`[Ato 2C] fechamentos/${PERIODO}/colaboradores/ tem ${docsAtuais.length} docs.`);

  // Indexa atuais por id_estavel
  const atualPorIdEstavel = new Map();
  for (const d of docsAtuais) {
    const idEst = d.data().id_estavel;
    if (!idEst) continue;
    if (!atualPorIdEstavel.has(idEst)) atualPorIdEstavel.set(idEst, []);
    atualPorIdEstavel.get(idEst).push(d);
  }

  // Diagnóstico atual
  const idEstaveisBase = new Map(baseDocs.map((d) => [d.data().id_estavel, d.id]));
  const slugsAtuaisReais = new Set();
  const docsTemplate = [];
  const slugsDuplicados = new Map();
  const docsSemMatch = [];
  for (const d of docsAtuais) {
    const data = d.data();
    const idEst = data.id_estavel;
    const slug = idEst ? idEstaveisBase.get(idEst) : null;
    const isTemplate = !data.nome_colaborador?.trim() || !data.cargo?.trim()
      || !data.funcao_principal?.trim() || slugify(data.nome_colaborador) === 'a_contratar';
    if (isTemplate) { docsTemplate.push({ docId: d.id, nome: data.nome_colaborador ?? '(vazio)' }); continue; }
    if (!slug) { docsSemMatch.push({ docId: d.id, nome: data.nome_colaborador, id_estavel: idEst }); continue; }
    slugsAtuaisReais.add(slug);
    const docsDoSlug = atualPorIdEstavel.get(idEst) ?? [];
    if (docsDoSlug.length > 1) slugsDuplicados.set(slug, docsDoSlug);
  }
  const slugsBase = new Set(baseDocs.map((d) => d.id));
  const slugsAusentesNoAtual = [...slugsBase].filter((s) => !slugsAtuaisReais.has(s));

  console.log(`[Ato 2C] Estado atual de ${PERIODO}:`);
  console.log(`  - Total docs: ${docsAtuais.length}`);
  console.log(`  - Templates: ${docsTemplate.length}`);
  console.log(`  - Docs sem match (órfãos): ${docsSemMatch.length}`);
  console.log(`  - Slugs únicos reais: ${slugsAtuaisReais.size}`);
  console.log(`  - Slugs duplicados (>1 doc): ${slugsDuplicados.size}`);
  console.log(`  - Slugs em base ausentes em ${PERIODO}: ${slugsAusentesNoAtual.length}`);

  // ===========================================================
  // Fase C — Cálculo do novo estado
  // ===========================================================
  console.log(`\n[Ato 2C] Fase C — Calculando novo estado para ${PERIODO}...`);

  const propostas = [];
  let somaCustoAtual = 0;
  for (const d of docsAtuais) somaCustoAtual += d.data().custo_total_mensal ?? 0;

  for (const baseDoc of baseDocs) {
    const slug = baseDoc.id;
    const data = baseDoc.data();
    const folha = calcularFolhaColaborador(data, ANO, PERIODO);
    const reajuste = buscarTetoPorPeriodo(data, PERIODO);

    const payload = {
      nome_colaborador: data.nome_colaborador,
      slug,
      id_estavel: data.id_estavel,
      cargo: data.cargo,
      funcao_principal: data.funcao_principal,
      funcoes_secundarias: data.funcoes_secundarias ?? [],
      ativo: data.ativo ?? true,
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
      cadastro_completo: true,
      replicado_de: REPLICADO_DE,
      data_replicacao: Timestamp.now(),
      origem: 'fase2-ato2c',
    };

    const docsAtuaisDoSlug = atualPorIdEstavel.get(data.id_estavel) ?? [];
    const custoAtualSlug = docsAtuaisDoSlug.reduce((s, d) => s + (d.data().custo_total_mensal ?? 0), 0);

    propostas.push({
      slug,
      nome: data.nome_colaborador,
      payloadNovo: payload,
      custoAtual: custoAtualSlug,
      docsAtuaisIds: docsAtuaisDoSlug.map((x) => x.id),
      duplicado: docsAtuaisDoSlug.length > 1,
      novoEmPeriodo: docsAtuaisDoSlug.length === 0,
    });
  }

  const somaCustoNovo = propostas.reduce((s, p) => s + p.payloadNovo.custo_total_mensal, 0);

  // ===========================================================
  // Fase D — Relatório dry-run
  // ===========================================================
  console.log('\n=== Tabela comparativa por slug ===\n');
  console.log('Slug                          | Status              | Custo atual    | Custo novo     | Δ');
  console.log('------------------------------|---------------------|---------------:|--------------:|--------');
  for (const p of propostas) {
    const status = p.novoEmPeriodo ? 'AUSENTE → criar'
      : p.duplicado ? `DUPLICADO (${p.docsAtuaisIds.length} docs)`
      : 'Único (1 doc)';
    const delta = p.payloadNovo.custo_total_mensal - p.custoAtual;
    console.log(
      p.slug.padEnd(30) + '| ' +
      status.padEnd(20) + '| ' +
      fmtBRL(p.custoAtual).padStart(14) + ' | ' +
      fmtBRL(p.payloadNovo.custo_total_mensal).padStart(14) + ' | ' +
      ((delta >= 0 ? '+' : '') + fmtBRL(delta)),
    );
  }

  console.log('\n=== Resumo ===');
  console.log(`  Total docs base: ${baseDocs.length}`);
  console.log(`  Total docs atuais ${PERIODO}: ${docsAtuais.length}`);
  console.log(`  Custo total ${PERIODO} ANTES: ${fmtBRL(somaCustoAtual)}`);
  console.log(`  Custo total ${PERIODO} DEPOIS: ${fmtBRL(somaCustoNovo)}`);
  const deltaTotal = somaCustoNovo - somaCustoAtual;
  console.log(`  Δ: ${(deltaTotal >= 0 ? '+' : '') + fmtBRL(deltaTotal)}`);
  console.log(`  Δ esperado: próximo de R$ 0 (dados já corretos pós-2A.5)`);

  // ===========================================================
  // Fase B — Snapshot prévio
  // ===========================================================
  console.log(`\n[Ato 2C] Fase B — Gravando snapshot prévio dos ${docsAtuais.length} docs atuais...`);
  const pathSnap = gravarSnapshot(docsAtuais, PERIODO, modo);
  console.log(`[Ato 2C] Snapshot prévio: ${pathSnap}`);

  // ===========================================================
  // Fase E — Apply
  // ===========================================================
  let deletados = 0, criados = 0, erros = [];
  if (args.apply) {
    console.log('\n[Ato 2C] Fase E — APLICANDO writes...');

    console.log(`[Ato 2C] Deletando ${docsAtuais.length} docs antigos...`);
    for (const d of docsAtuais) {
      try {
        await deleteDoc(d.ref);
        deletados++;
        console.log(`  [Ato 2C Delete ${PERIODO}] ${deletados}/${docsAtuais.length} ${d.id}`);
      } catch (e) {
        erros.push({ acao: 'delete', docId: d.id, erro: e.message });
        console.error(`  [Ato 2C Delete ${PERIODO}] ERRO ${d.id}: ${e.message}`);
      }
    }

    console.log(`[Ato 2C] Criando ${propostas.length} docs canônicos (docId=slug)...`);
    for (const p of propostas) {
      try {
        await setDoc(doc(db, 'fechamentos', PERIODO, 'colaboradores', p.slug), p.payloadNovo);
        criados++;
        console.log(`  [Ato 2C Create ${PERIODO}] ${criados}/${propostas.length} ${p.slug}`);
      } catch (e) {
        erros.push({ acao: 'create', slug: p.slug, erro: e.message });
        console.error(`  [Ato 2C Create ${PERIODO}] ERRO ${p.slug}: ${e.message}`);
      }
    }

    // Validação pós-write
    console.log('\n[Ato 2C] Validando pós-write...');
    const valSnap = await getDocs(collection(db, 'fechamentos', PERIODO, 'colaboradores'));
    const valDocs = valSnap.docs;
    const docIdsBate = valDocs.every((d) => d.data().slug === d.id);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const docsComUUID = valDocs.filter((d) => uuidRegex.test(d.id));
    const validacoes = {
      total_correto: valDocs.length === propostas.length,
      docIds_sao_slugs: docIdsBate,
      zero_uuids: docsComUUID.length === 0,
    };
    console.log(`  Total docs ${PERIODO}: ${valDocs.length} (esperado: ${propostas.length}) — ${validacoes.total_correto ? '✓' : '✗'}`);
    console.log(`  docId == slug em todos: ${validacoes.docIds_sao_slugs ? 'SIM ✓' : 'NÃO ✗'}`);
    console.log(`  Zero docIds UUID: ${validacoes.zero_uuids ? 'SIM ✓' : 'NÃO ✗'}`);
    if (!Object.values(validacoes).every((v) => v)) throw new Error('Validação pós-write falhou');
  }

  // ===========================================================
  // Fase F — Relatório
  // ===========================================================
  const md = [];
  md.push(`# Fase 2 Ato 2C — Replicação canônica para ${PERIODO} — ${modo}`);
  md.push('');
  md.push(`Gerado em ${new Date().toISOString()}.`);
  md.push('');
  md.push(`- Período alvo: **${PERIODO}**`);
  md.push(`- Ano (para tabelas INSS/IRRF): **${ANO}**`);
  md.push(`- replicado_de: **${REPLICADO_DE}**`);
  md.push('');
  md.push('## Fase A — Validação pré-execução');
  md.push('');
  md.push(`- Base íntegra (${baseDocs.length} docs com funcao_principal + cadastro_completo): ✓`);
  md.push(`- Estado atual ${PERIODO}: **${docsAtuais.length} docs**`);
  md.push(`  - Templates: ${docsTemplate.length}`);
  md.push(`  - Slugs duplicados: ${slugsDuplicados.size}`);
  md.push(`  - Docs sem match: ${docsSemMatch.length}`);
  md.push(`  - Slugs ausentes: ${slugsAusentesNoAtual.length}`);
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
    const status = p.novoEmPeriodo ? 'AUSENTE → criar'
      : p.duplicado ? `DUPLICADO (${p.docsAtuaisIds.length} docs)`
      : 'Único (1 doc)';
    const delta = p.payloadNovo.custo_total_mensal - p.custoAtual;
    md.push(`| ${i + 1} | \`${p.slug}\` | ${status} | ${fmtBRL(p.custoAtual)} | ${fmtBRL(p.payloadNovo.custo_total_mensal)} | ${(delta >= 0 ? '+' : '') + fmtBRL(delta)} |`);
  });
  md.push('');
  md.push('## Resumo');
  md.push('');
  md.push(`- Custo total ${PERIODO} ANTES: **${fmtBRL(somaCustoAtual)}**`);
  md.push(`- Custo total ${PERIODO} DEPOIS: **${fmtBRL(somaCustoNovo)}**`);
  md.push(`- Δ: **${(deltaTotal >= 0 ? '+' : '') + fmtBRL(deltaTotal)}** (esperado próximo de R$ 0)`);
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

  const pathMd = gravarRelatorio(md.join('\n'), PERIODO, args.apply ? 'aplicado' : 'dry-run');
  console.log(`\n[Ato 2C] Relatório salvo: ${pathMd}`);
  console.log(`\n[Ato 2C] Concluído. Modo: ${modo} | período: ${PERIODO}`);
}

main().catch((e) => {
  console.error('[Ato 2C] Erro:', e);
  process.exit(1);
});
