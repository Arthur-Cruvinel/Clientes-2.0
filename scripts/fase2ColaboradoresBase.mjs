// Fase 2 — Princípio 3: criação de colaboradores_base/ e replicação
// dos snapshots por período. Multi-ato com CHECKPOINT humano entre cada.
//
// Modos:
//   sem args                → dry-run do Ato 1 (default)
//   --ato=1                 → dry-run do Ato 1
//   --ato=1 --apply         → APPLY do Ato 1 (cria colaboradores_base/)
//   --ato=2                 → dry-run do Ato 2
//   --ato=2 --apply         → APPLY do Ato 2 (replica para 2025-12)
//   --ato=3                 → dry-run do PRÓXIMO período pendente do Ato 3
//   --ato=3 --apply         → APPLY do PRÓXIMO período pendente do Ato 3
//                             (executa 1 período por vez; rodar 3 vezes)
//
// REGRAS ABSOLUTAS:
//   - setDoc com merge:false para criações em colaboradores_base/
//   - deleteDoc apenas no Ato 2 e Ato 3 (saneamento explícito)
//   - docId = slug (não UUID) — corrige Bug A
//   - Nenhum write fora das coleções alvo
//   - Snapshot pré-write em backups/firestore/

import {
  collection, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp,
} from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initDb } from './_helpers.mjs';

const ROOT = process.cwd();
const BATCH_LIMIT = 400;

// =========================================================================
// Constantes inline — espelho de src/utils/constants.ts
// =========================================================================

const SEMANAS_ANO = 52;
const HORAS_SEMANAIS_CLT = 44;
const HORAS_DIA_UTIL = HORAS_SEMANAIS_CLT / 5;
const HORAS_FERIAS_ANO = HORAS_SEMANAIS_CLT * (30 / 7);
const HORAS_BRUTAS_ANO = SEMANAS_ANO * HORAS_SEMANAIS_CLT;
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
const ANO_FOLHA_VIGENTE = 2026;

// =========================================================================
// Folha mensal — espelho EXATO de src/utils/financials.custos.ts
// (calcularINSS, calcularIRRF, buscarTetoPorPeriodo, calcularFolhaColaborador)
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
      vigencia: periodo,
      fonte: 'direto',
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
    vigencia: resultado.vigencia,
    fonte: 'historico',
  };
}

function calcularFolhaColaborador(c, ano, periodo) {
  const horasProd = HORAS_PRODUTIVAS_POR_LOCALIDADE[c.localidade ?? 'SP'] ?? HORAS_PRODUTIVAS_POR_LOCALIDADE.SP;

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

  const reajuste = periodo
    ? buscarTetoPorPeriodo(c, periodo)
    : { salario_teto_cargo: c.salario_teto_cargo ?? 0, liquido_acordado: c.liquido_acordado ?? 0,
        vigencia: '', fonte: 'direto' };
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
  const custoMensal = teto + (c.beneficios_fixos ?? 0) + encargos + decimoFerias
    + complementoPLR + reflexosPLR;

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
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function ehColabReal(data) {
  return !!(data?.nome_colaborador?.trim()
    && data?.cargo?.trim()
    && data?.funcao_principal?.trim());
}

function parseArgs(argv) {
  const args = { ato: 1, apply: false };
  for (const a of argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--ato=')) args.ato = parseInt(a.slice('--ato='.length), 10);
  }
  return args;
}

function gravarSnapshot(label, docsAfetados, modo) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `fase2-${label}-${ts}.json`);
  const payload = {
    timestamp: new Date().toISOString(),
    label, modo,
    total: docsAfetados.length,
    docs: docsAfetados.map((d) => ({
      docId: d.id, path: d.ref.path, dados_antes: d.data(),
    })),
  };
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  return path;
}

function gravarRelatorio(label, conteudo) {
  const dir = join(ROOT, 'audit-results');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `fase2-${label}-${ts}.md`);
  writeFileSync(path, conteudo, 'utf8');
  return path;
}

/** Constrói payload de colaboradores_base/{slug} a partir de um snapshot. */
function montarPayloadBase(snapshotData) {
  return {
    nome_colaborador: snapshotData.nome_colaborador,
    slug: slugify(snapshotData.nome_colaborador),
    id_estavel: snapshotData.id_estavel,
    cargo: snapshotData.cargo,
    funcao_principal: '',          // VAZIO — usuário preenche via UI
    funcoes_secundarias: [],       // default vazio
    ativo: true,
    // data_admissao / data_demissao: undefined (Firestore ignora com ignoreUndefinedProperties)
    alocavel: snapshotData.alocavel,
    percentual_alocavel: snapshotData.percentual_alocavel,
    percentual_institucional: snapshotData.percentual_institucional,
    salario_teto_cargo: snapshotData.salario_teto_cargo ?? 0,
    liquido_acordado: snapshotData.liquido_acordado ?? 0,
    beneficios_fixos: snapshotData.beneficios_fixos ?? 0,
    tipo_vinculo: snapshotData.tipo_vinculo ?? 'clt',  // inferir 'clt' se ausente
    qtd_dependentes: snapshotData.qtd_dependentes ?? 0,
    localidade: snapshotData.localidade ?? 'SP',
    historico_reajustes: snapshotData.historico_reajustes ?? [],
    salario_base: snapshotData.salario_base ?? 0,
    cadastro_completo: false,
    origem: 'extracao_jan_2026',
    data_extracao: Timestamp.now(),
  };
}

/** Constrói payload de fechamentos/{periodo}/colaboradores/{slug} a partir
 *  de um doc de colaboradores_base/{slug}, recalculando Cat B. */
function montarPayloadSnapshotReplicado(baseData, ano, mes, periodoOrigem) {
  // Stub Colaborador para calcularFolhaColaborador (precisa só dos campos perenes).
  const stub = {
    salario_teto_cargo: baseData.salario_teto_cargo,
    liquido_acordado: baseData.liquido_acordado,
    salario_base: baseData.salario_base ?? 0,
    beneficios_fixos: baseData.beneficios_fixos,
    qtd_dependentes: baseData.qtd_dependentes,
    tipo_vinculo: baseData.tipo_vinculo,
    localidade: baseData.localidade,
    historico_reajustes: baseData.historico_reajustes ?? [],
  };
  const periodo = `${ano}-${String(mes).padStart(2, '0')}`;
  const folha = calcularFolhaColaborador(stub, ano, periodo);

  return {
    // Categoria A — copia
    nome_colaborador: baseData.nome_colaborador,
    id_estavel: baseData.id_estavel,
    cargo: baseData.cargo,
    funcao_principal: baseData.funcao_principal,
    alocavel: baseData.alocavel,
    percentual_alocavel: baseData.percentual_alocavel,
    percentual_institucional: baseData.percentual_institucional,
    salario_teto_cargo: baseData.salario_teto_cargo,
    salario_base: baseData.salario_base ?? 0,
    liquido_acordado: baseData.liquido_acordado,
    beneficios_fixos: baseData.beneficios_fixos,
    tipo_vinculo: baseData.tipo_vinculo,
    qtd_dependentes: baseData.qtd_dependentes,
    localidade: baseData.localidade,
    historico_reajustes: baseData.historico_reajustes ?? [],

    // Categoria B — recalculada por calcularFolhaColaborador (período correto)
    inss: folha.inss,
    irrf: folha.irrf,
    encargos_patronais: folha.encargos_patronais,
    decimo_terceiro_ferias: folha.decimo_terceiro_ferias,
    complemento_plr: folha.complemento_plr,
    reflexos_plr_mensal: folha.reflexos_plr_mensal,
    custo_total_mensal: folha.custo_total_mensal,
    custo_hora: folha.custo_hora,

    // Rastreabilidade
    replicado_de: periodoOrigem,
    data_replicacao: Timestamp.now(),
    cadastro_completo: false,
  };
}

// =========================================================================
// ATO 1 — Criar colaboradores_base/
// =========================================================================

async function ato1(db, apply) {
  console.log('\n=== ATO 1 — Criar colaboradores_base/ a partir de Jan/26 ===\n');

  // Pré-check: colaboradores_base/ deve estar VAZIO ou conter o resultado da
  // execução anterior. Não falha — apenas avisa.
  const existentes = await getDocs(collection(db, 'colaboradores_base'));
  if (existentes.size > 0) {
    console.log(`[Ato 1] AVISO: colaboradores_base/ já tem ${existentes.size} docs. ` +
                `O apply vai sobrescrever via setDoc (merge:false).`);
  }

  // Lê Jan/26
  const snap = await getDocs(collection(db, 'fechamentos', '2026-01', 'colaboradores'));
  const reais = snap.docs.filter((d) => ehColabReal(d.data()));
  console.log(`[Ato 1] Jan/26: ${snap.size} docs totais, ${reais.length} reais.`);

  if (reais.length === 0) throw new Error('Nenhum doc real em Jan/26.');

  // Monta payloads
  const operacoes = reais.map((d) => {
    const data = d.data();
    const slug = slugify(data.nome_colaborador);
    return { docId: slug, payload: montarPayloadBase(data), origem: d.id, nome: data.nome_colaborador, id_estavel: data.id_estavel };
  });

  // Verifica duplicidade de slug
  const slugs = operacoes.map((op) => op.docId);
  const dupSlugs = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupSlugs.length > 0) {
    throw new Error(`Slugs duplicados em Jan/26: ${[...new Set(dupSlugs)].join(', ')}`);
  }

  // Preview
  console.log('\n[Ato 1] Lista dos docs a criar:');
  console.log('slug                              | nome                          | id_estavel                           | campos');
  console.log('----------------------------------|-------------------------------|--------------------------------------|--------');
  for (const op of operacoes) {
    const campos = Object.keys(op.payload).length;
    console.log(`${op.docId.padEnd(33)} | ${op.nome.padEnd(29)} | ${op.id_estavel ?? '(sem id_estavel)'.padEnd(36)} | ${campos}`);
  }

  if (!apply) {
    console.log('\n[Ato 1] DRY-RUN — nenhum write executado.');
    return { dryRun: true, total: operacoes.length, operacoes };
  }

  // APPLY — gravar
  console.log(`\n[Ato 1] APLICANDO — criando ${operacoes.length} docs em colaboradores_base/...`);
  const pathSnap = gravarSnapshot('ato1-base-criacao', existentes.docs, 'apply');
  console.log(`[Ato 1] Snapshot prévio: ${pathSnap}`);

  let criados = 0, erros = [];
  for (const op of operacoes) {
    try {
      await setDoc(doc(db, 'colaboradores_base', op.docId), op.payload);
      criados++;
    } catch (e) {
      erros.push({ slug: op.docId, erro: e.message });
    }
  }
  console.log(`[Ato 1] Criados: ${criados}/${operacoes.length}. Erros: ${erros.length}`);

  // Validação pós-write
  const valSnap = await getDocs(collection(db, 'colaboradores_base'));
  console.log(`[Ato 1] Validação: colaboradores_base/ contém ${valSnap.size} docs (esperado ≥ ${operacoes.length}).`);
  if (valSnap.size < operacoes.length) {
    throw new Error(`Validação falhou: esperado ≥ ${operacoes.length}, encontrado ${valSnap.size}`);
  }

  return { total: operacoes.length, criados, erros, snapshot: pathSnap };
}

// =========================================================================
// ATO 2 — Replicação para trás (Dez/25)
// =========================================================================

async function ato2(db, apply) {
  console.log('\n=== ATO 2 — Replicar colaboradores_base/ → fechamentos/2025-12/colaboradores/ ===\n');

  // Pré-check: Ato 1 aplicado?
  const base = await getDocs(collection(db, 'colaboradores_base'));
  if (base.size === 0) throw new Error('colaboradores_base/ vazio. Rode Ato 1 primeiro.');
  console.log(`[Ato 2] colaboradores_base/: ${base.size} docs ok.`);

  // Snapshot prévio dos docs em 2025-12 (que serão DELETADOS).
  const dez25 = await getDocs(collection(db, 'fechamentos', '2025-12', 'colaboradores'));
  console.log(`[Ato 2] Dez/25 atualmente: ${dez25.size} docs (serão deletados antes de replicar).`);

  if (!apply) {
    console.log('\n[Ato 2] DRY-RUN — não executa delete/write. Plano:');
    console.log(`  1. Deletar ${dez25.size} docs em fechamentos/2025-12/colaboradores/`);
    console.log(`  2. Replicar ${base.size} docs de colaboradores_base/ recalculando Cat B p/ ano=2025, mes=12`);
    console.log(`  3. docId = slug (não UUID)`);
    return { dryRun: true, dez25_atual: dez25.size, base_a_replicar: base.size };
  }

  // APPLY
  const pathSnap = gravarSnapshot('ato2-dez25-replicacao', dez25.docs, 'apply');
  console.log(`[Ato 2] Snapshot prévio: ${pathSnap}`);

  // (a) Deletar TODOS os docs de 2025-12
  console.log('[Ato 2] Deletando docs antigos de Dez/25...');
  let deletados = 0;
  for (const d of dez25.docs) {
    try { await deleteDoc(d.ref); deletados++; }
    catch (e) { console.error(`  ERRO deletando ${d.id}: ${e.message}`); }
  }
  console.log(`[Ato 2] Deletados: ${deletados}/${dez25.size}`);

  // (b) Replicar
  console.log('[Ato 2] Replicando para Dez/25...');
  let criados = 0, erros = [];
  for (const bDoc of base.docs) {
    const baseData = bDoc.data();
    const slug = baseData.slug ?? slugify(baseData.nome_colaborador);
    const payload = montarPayloadSnapshotReplicado(baseData, 2025, 12, '2026-01');
    try {
      await setDoc(doc(db, 'fechamentos', '2025-12', 'colaboradores', slug), payload);
      criados++;
    } catch (e) {
      erros.push({ slug, erro: e.message });
    }
  }
  console.log(`[Ato 2] Replicados: ${criados}/${base.size}. Erros: ${erros.length}`);

  // Validação
  const val = await getDocs(collection(db, 'fechamentos', '2025-12', 'colaboradores'));
  console.log(`[Ato 2] Validação: Dez/25 agora tem ${val.size} docs (esperado: ${base.size}).`);
  if (val.size !== base.size) {
    throw new Error(`Validação falhou: esperado ${base.size}, encontrado ${val.size}`);
  }

  return { deletados, criados, erros, snapshot: pathSnap };
}

// =========================================================================
// ATO 3 — Replicação para frente (Fev/26, Mar/26, Abr/26)
// =========================================================================

const PERIODOS_ATO3 = [
  { periodo: '2026-02', ano: 2026, mes: 2, origem: '2026-01' },
  { periodo: '2026-03', ano: 2026, mes: 3, origem: '2026-02' },
  { periodo: '2026-04', ano: 2026, mes: 4, origem: '2026-03' },
];

/** Detecta o próximo período pendente do Ato 3. Critério: todos os docs do
 *  período devem ter `replicado_de`. Se não, período é pendente. */
async function detectarProximoPeriodoAto3(db) {
  const base = await getDocs(collection(db, 'colaboradores_base'));
  const total = base.size;
  if (total === 0) throw new Error('colaboradores_base/ vazio. Rode Ato 1 primeiro.');

  for (const def of PERIODOS_ATO3) {
    const snap = await getDocs(collection(db, 'fechamentos', def.periodo, 'colaboradores'));
    const replicados = snap.docs.filter((d) => d.data().replicado_de != null).length;
    const docs_reais = snap.docs.filter((d) => ehColabReal(d.data())).length;
    if (replicados === total && docs_reais === total) {
      console.log(`[Ato 3] ${def.periodo}: já processado (${replicados}/${total} replicados).`);
      continue;
    }
    return { def, atual: snap, base };
  }
  return null; // tudo concluído
}

async function ato3(db, apply) {
  console.log('\n=== ATO 3 — Replicação para frente (Fev/26 → Mar/26 → Abr/26) ===\n');

  const proximo = await detectarProximoPeriodoAto3(db);
  if (!proximo) {
    console.log('[Ato 3] Todos os 3 períodos já foram processados. Nada a fazer.');
    return { concluido_total: true };
  }

  const { def, atual, base } = proximo;
  console.log(`[Ato 3] Próximo período pendente: ${def.periodo} (origem ${def.origem})`);
  console.log(`[Ato 3] ${def.periodo} atualmente tem ${atual.size} docs (serão deletados antes de replicar).`);
  console.log(`[Ato 3] ${base.size} docs em colaboradores_base/ serão replicados.`);

  if (!apply) {
    console.log('\n[Ato 3] DRY-RUN — não executa. Plano:');
    console.log(`  1. Deletar ${atual.size} docs em ${def.periodo}`);
    console.log(`  2. Replicar ${base.size} docs recalculando Cat B p/ ano=${def.ano}, mes=${def.mes}`);
    console.log(`  3. docId = slug (não UUID)`);
    console.log(`  4. replicado_de = '${def.origem}'`);
    return { dryRun: true, proximo_periodo: def.periodo };
  }

  // APPLY
  const pathSnap = gravarSnapshot(`ato3-${def.periodo}-replicacao`, atual.docs, 'apply');
  console.log(`[Ato 3] Snapshot prévio: ${pathSnap}`);

  // (a) Deletar
  console.log(`[Ato 3] Deletando docs antigos de ${def.periodo}...`);
  let deletados = 0;
  for (const d of atual.docs) {
    try { await deleteDoc(d.ref); deletados++; }
    catch (e) { console.error(`  ERRO deletando ${d.id}: ${e.message}`); }
  }
  console.log(`[Ato 3] Deletados: ${deletados}/${atual.size}`);

  // (b) Replicar
  console.log(`[Ato 3] Replicando para ${def.periodo}...`);
  let criados = 0, erros = [];
  for (const bDoc of base.docs) {
    const baseData = bDoc.data();
    const slug = baseData.slug ?? slugify(baseData.nome_colaborador);
    const payload = montarPayloadSnapshotReplicado(baseData, def.ano, def.mes, def.origem);
    try {
      await setDoc(doc(db, 'fechamentos', def.periodo, 'colaboradores', slug), payload);
      criados++;
    } catch (e) {
      erros.push({ slug, erro: e.message });
    }
  }
  console.log(`[Ato 3] Replicados: ${criados}/${base.size}. Erros: ${erros.length}`);

  // Validação
  const val = await getDocs(collection(db, 'fechamentos', def.periodo, 'colaboradores'));
  console.log(`[Ato 3] Validação: ${def.periodo} tem ${val.size} docs (esperado: ${base.size}).`);
  if (val.size !== base.size) {
    throw new Error(`Validação falhou: esperado ${base.size}, encontrado ${val.size}`);
  }

  // CHECKPOINT após cada período
  const proximoApos = PERIODOS_ATO3.find((p, i) =>
    PERIODOS_ATO3.indexOf(def) + 1 === i);
  console.log(`\n[Ato 3] ${def.periodo} concluído. Aguardando aprovação para próximo.`);
  if (proximoApos) {
    console.log(`        Próximo a processar: ${proximoApos.periodo}. Rode novamente \`npm run fase2:colab:ato3\` para continuar.`);
  } else {
    console.log('        Este foi o ÚLTIMO período. Ato 3 totalmente concluído após esta execução.');
  }

  return { periodo: def.periodo, deletados, criados, erros, snapshot: pathSnap };
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  const args = parseArgs(process.argv);
  const db = initDb();
  const modo = args.apply ? 'APLICADO' : 'DRY-RUN';
  console.log(`[Fase 2 colab] Iniciado | ato=${args.ato} | modo=${modo}`);

  let resultado;
  if (args.ato === 1) resultado = await ato1(db, args.apply);
  else if (args.ato === 2) resultado = await ato2(db, args.apply);
  else if (args.ato === 3) resultado = await ato3(db, args.apply);
  else { console.error(`Ato inválido: ${args.ato}`); process.exit(1); }

  // CHECKPOINT
  if (args.apply) {
    if (args.ato === 1) {
      console.log('\nATO 1 CONCLUÍDO. Aguardando aprovação para Ato 2.');
      console.log('USUÁRIO deve revisar colaboradores_base/ via UI e preencher funcao_principal antes de continuar.');
    } else if (args.ato === 2) {
      console.log('\nATO 2 CONCLUÍDO. Aguardando aprovação para Ato 3.');
      console.log('USUÁRIO deve revisar Dez/25 via UI e ajustar colaboradores que ainda não estavam na empresa.');
    }
  }

  // Relatório markdown
  const md = [
    `# Fase 2 Ato ${args.ato} — ${modo}`,
    '',
    `Gerado em ${new Date().toISOString()}.`,
    '',
    '```json',
    JSON.stringify(resultado, null, 2),
    '```',
  ].join('\n');
  const pathMd = gravarRelatorio(`ato${args.ato}-${modo.toLowerCase()}`, md);
  console.log(`\nRelatório salvo: ${pathMd}`);
}

main().catch((e) => {
  console.error('[Fase 2 colab] Erro:', e.message);
  process.exit(1);
});
