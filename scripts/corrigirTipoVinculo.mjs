// Fase 2 Ato 2A.5.c — Corrige tipo_vinculo em colaboradores_base/ e
// nos snapshots de fechamentos/{periodo}/colaboradores/, recalculando
// Categoria B (encargos, INSS, IRRF, 13º/férias, custos) via espelho
// inline de calcularFolhaColaborador.
//
// Script PARAMETRIZÁVEL — reutilizável para sub-etapa 2A.5.d (estagiários).
//
// REGRAS ABSOLUTAS:
//   - Toda gravação via updateDoc (não setDoc, não writeBatch.delete)
//   - Snapshot prévio em backups/firestore/
//   - Read-only por padrão; write apenas com --apply
//   - Só toca tipo_vinculo + 11 campos de Categoria B
//   - NÃO toca em nome_colaborador, cargo, salario_base,
//     salario_teto_cargo, liquido_acordado, beneficios_fixos,
//     funcao_principal, id_estavel, qtd_dependentes, localidade, alocavel,
//     percentual_alocavel, percentual_institucional, historico_reajustes

import { collection, collectionGroup, getDocs, doc, updateDoc } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initDb } from './_helpers.mjs';

const ROOT = process.cwd();
const TIPOS_VALIDOS = new Set(['pro_labore', 'estagio']);

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
// Funções de cálculo — espelho EXATO de src/utils/financials.custos.ts
// (incluindo o ramo estagio adicionado na Sub-etapa 2A.5.a)
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

function parseArgs(argv) {
  const args = { colaboradores: [], tipo: null, periodos: null, apply: false };
  for (const a of argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--colaboradores=')) {
      args.colaboradores = a.slice('--colaboradores='.length).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a.startsWith('--tipo=')) args.tipo = a.slice('--tipo='.length).trim();
    else if (a.startsWith('--periodos=')) {
      args.periodos = a.slice('--periodos='.length).split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return args;
}

function gravarSnapshot(docsAfetados, modo) {
  const dir = join(ROOT, 'backups', 'firestore');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `corrigirTipoVinculo-${ts}.json`);
  writeFileSync(path, JSON.stringify({
    timestamp: new Date().toISOString(), modo,
    total: docsAfetados.length,
    docs: docsAfetados.map((d) => ({
      docId: d.id, path: d.ref.path, dados_antes: d.data(),
    })),
  }, null, 2), 'utf8');
  return path;
}

function gravarRelatorio(conteudo, prefixo) {
  const dir = join(ROOT, 'audit-results');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `${prefixo}-${ts}.md`);
  writeFileSync(path, conteudo, 'utf8');
  return path;
}

function fmtBRL(v) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(v) {
  if (v == null) return '—';
  return (Math.round(v * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  const args = parseArgs(process.argv);
  const modo = args.apply ? 'APLICADO' : 'DRY-RUN';
  console.log(`[Corrigir tipo_vinculo] Iniciado — modo: ${modo}`);

  // Fase A — validação dos inputs
  if (args.colaboradores.length === 0) {
    console.error('ERRO: --colaboradores=slug1,slug2,... é obrigatório.');
    process.exit(1);
  }
  if (!args.tipo) {
    console.error('ERRO: --tipo=pro_labore|estagio é obrigatório.');
    process.exit(1);
  }
  if (!TIPOS_VALIDOS.has(args.tipo)) {
    console.error(`ERRO: --tipo deve ser um de: ${[...TIPOS_VALIDOS].join(', ')}. Recebido: "${args.tipo}".`);
    process.exit(1);
  }
  console.log(`[Corrigir tipo_vinculo] Slugs: ${args.colaboradores.join(', ')}`);
  console.log(`[Corrigir tipo_vinculo] Novo tipo: ${args.tipo}`);

  const db = initDb();

  // Fase B — leitura do estado atual
  console.log('\n[Corrigir tipo_vinculo] Lendo colaboradores_base/...');
  const baseSnap = await getDocs(collection(db, 'colaboradores_base'));
  const baseDocs = new Map(baseSnap.docs.map((d) => [d.id, d]));

  // Valida que todos os slugs existem em base
  const naoEncontrados = args.colaboradores.filter((slug) => !baseDocs.has(slug));
  if (naoEncontrados.length > 0) {
    console.error(`ERRO: Slugs não encontrados em colaboradores_base/: ${naoEncontrados.join(', ')}`);
    process.exit(1);
  }

  // Junção base ↔ snapshots usa `id_estavel` (compartilhado), porque docs em
  // fechamentos/*/colaboradores/ têm docId UUID (Bug A), não slug. Monta
  // mapa id_estavel → slug-alvo e o inverso.
  const idEstavelToSlug = new Map();
  const slugToIdEstavel = new Map();
  for (const slug of args.colaboradores) {
    const baseDoc = baseDocs.get(slug);
    const idEst = baseDoc.data().id_estavel;
    if (!idEst) {
      console.error(`ERRO: colaboradores_base/${slug} não tem id_estavel — abortando.`);
      process.exit(1);
    }
    idEstavelToSlug.set(idEst, slug);
    slugToIdEstavel.set(slug, idEst);
  }

  // Detecta períodos disponíveis se --periodos não foi passado.
  // Critério: períodos em fechamentos/*/colaboradores/ que contenham ao menos
  // um doc cujo `id_estavel` casa com algum dos slugs alvo.
  let periodosAlvo = args.periodos;
  if (!periodosAlvo) {
    console.log('[Corrigir tipo_vinculo] Detectando períodos via collectionGroup (join por id_estavel)...');
    const cgSnap = await getDocs(collectionGroup(db, 'colaboradores'));
    const periodosSet = new Set();
    for (const d of cgSnap.docs) {
      const idEst = d.data()?.id_estavel;
      if (idEst && idEstavelToSlug.has(idEst)) {
        periodosSet.add(d.ref.path.split('/')[1]);
      }
    }
    periodosAlvo = [...periodosSet].sort();
  }
  console.log(`[Corrigir tipo_vinculo] Períodos alvo (${periodosAlvo.length}): ${periodosAlvo.join(', ')}`);

  // Carrega snapshots e indexa por (slug, periodo) — slug derivado do id_estavel.
  const snapshots = new Map(); // chave: `${slug}|${periodo}` → DocumentSnapshot
  for (const periodo of periodosAlvo) {
    const snap = await getDocs(collection(db, 'fechamentos', periodo, 'colaboradores'));
    for (const d of snap.docs) {
      const idEst = d.data()?.id_estavel;
      const slug = idEst ? idEstavelToSlug.get(idEst) : null;
      if (slug) snapshots.set(`${slug}|${periodo}`, d);
    }
  }

  // Verifica se todos os (slug, periodo) foram encontrados (esperado para Ato 2.5.c).
  const faltantes = [];
  for (const slug of args.colaboradores) {
    for (const periodo of periodosAlvo) {
      if (!snapshots.has(`${slug}|${periodo}`)) faltantes.push(`${periodo}/${slug}`);
    }
  }
  if (faltantes.length > 0) {
    console.warn(`[Corrigir tipo_vinculo] AVISO: ${faltantes.length} (slug, periodo) sem snapshot — não serão atualizados:`);
    for (const f of faltantes) console.warn(`  - ${f}`);
  }

  // Fase C — cálculo das mudanças
  const propostas = []; // { tipo: 'base'|'snapshot', docRef, antes, depois, payload, slug, periodo? }

  for (const slug of args.colaboradores) {
    const baseDoc = baseDocs.get(slug);
    const baseData = baseDoc.data();

    // colaboradores_base/{slug} — só altera tipo_vinculo
    propostas.push({
      tipo: 'base',
      slug,
      docRef: baseDoc.ref,
      antes: { tipo_vinculo: baseData.tipo_vinculo },
      depois: { tipo_vinculo: args.tipo },
      payload: { tipo_vinculo: args.tipo },
    });

    // Cada snapshot: tipo_vinculo + Categoria B recalculada
    for (const periodo of periodosAlvo) {
      const snapDoc = snapshots.get(`${slug}|${periodo}`);
      if (!snapDoc) continue;
      const snapData = snapDoc.data();
      const ano = parseInt(periodo.split('-')[0], 10);
      const colabHipotetico = { ...snapData, tipo_vinculo: args.tipo };
      const folha = calcularFolhaColaborador(colabHipotetico, ano, periodo);
      const payload = {
        tipo_vinculo: args.tipo,
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
      };
      propostas.push({
        tipo: 'snapshot',
        slug, periodo,
        docRef: snapDoc.ref,
        antes: {
          tipo_vinculo: snapData.tipo_vinculo,
          inss: snapData.inss,
          irrf: snapData.irrf,
          irrf_liquido: snapData.irrf_liquido,
          redutor_ir_2026: snapData.redutor_ir_2026,
          liquido_do_teto: snapData.liquido_do_teto,
          complemento_plr: snapData.complemento_plr,
          reflexos_plr_mensal: snapData.reflexos_plr_mensal,
          encargos_patronais: snapData.encargos_patronais,
          decimo_terceiro_ferias: snapData.decimo_terceiro_ferias,
          custo_total_mensal: snapData.custo_total_mensal,
          custo_hora: snapData.custo_hora,
        },
        depois: payload,
        payload,
      });
    }
  }

  // Fase D — Relatório dry-run
  console.log('\n=== Diff por documento ===\n');
  for (const p of propostas) {
    if (p.tipo === 'base') {
      console.log(`--- colaboradores_base/${p.slug} ---`);
      console.log(`  tipo_vinculo: ${p.antes.tipo_vinculo} → ${p.depois.tipo_vinculo}`);
      console.log('');
    } else {
      console.log(`--- fechamentos/${p.periodo}/colaboradores/${p.slug} ---`);
      const campos = [
        ['tipo_vinculo', p.antes.tipo_vinculo, p.depois.tipo_vinculo, null],
        ['inss', p.antes.inss, p.depois.inss],
        ['irrf', p.antes.irrf, p.depois.irrf],
        ['irrf_liquido', p.antes.irrf_liquido, p.depois.irrf_liquido],
        ['redutor_ir_2026', p.antes.redutor_ir_2026, p.depois.redutor_ir_2026],
        ['liquido_do_teto', p.antes.liquido_do_teto, p.depois.liquido_do_teto],
        ['complemento_plr', p.antes.complemento_plr, p.depois.complemento_plr],
        ['reflexos_plr_mensal', p.antes.reflexos_plr_mensal, p.depois.reflexos_plr_mensal],
        ['encargos_patronais', p.antes.encargos_patronais, p.depois.encargos_patronais],
        ['decimo_terceiro_ferias', p.antes.decimo_terceiro_ferias, p.depois.decimo_terceiro_ferias],
        ['custo_total_mensal', p.antes.custo_total_mensal, p.depois.custo_total_mensal],
        ['custo_hora', p.antes.custo_hora, p.depois.custo_hora],
      ];
      for (const [campo, antes, depois] of campos) {
        if (campo === 'tipo_vinculo') {
          console.log(`  ${campo.padEnd(25)} ${String(antes).padEnd(15)} ${String(depois).padEnd(15)} —`);
        } else {
          const diff = (depois ?? 0) - (antes ?? 0);
          console.log(`  ${campo.padEnd(25)} ${fmtNum(antes).padEnd(15)} ${fmtNum(depois).padEnd(15)} ${(diff >= 0 ? '+' : '') + fmtNum(diff)}`);
        }
      }
      console.log('');
    }
  }

  // Totais agregados por colaborador
  console.log('=== Totais agregados ===\n');
  const totaisPorSlug = new Map();
  for (const slug of args.colaboradores) totaisPorSlug.set(slug, { antes: 0, depois: 0, periodos: [] });
  for (const p of propostas) {
    if (p.tipo !== 'snapshot') continue;
    const t = totaisPorSlug.get(p.slug);
    const antes = p.antes.custo_total_mensal ?? 0;
    const depois = p.depois.custo_total_mensal ?? 0;
    t.antes += antes;
    t.depois += depois;
    t.periodos.push({ periodo: p.periodo, antes, depois });
  }

  let economiaTotal = 0;
  for (const slug of args.colaboradores) {
    const t = totaisPorSlug.get(slug);
    console.log(`Sócio/colaborador: ${slug}`);
    for (const { periodo, antes, depois } of t.periodos) {
      const dif = depois - antes;
      console.log(`  ${periodo}: antes ${fmtBRL(antes)} | depois ${fmtBRL(depois)} | diff ${(dif >= 0 ? '+' : '') + fmtBRL(dif)}`);
    }
    const difAg = t.depois - t.antes;
    console.log(`  Total ${t.periodos.length} períodos: antes ${fmtBRL(t.antes)} | depois ${fmtBRL(t.depois)} | economia ${fmtBRL(-difAg)}`);
    console.log('');
    economiaTotal += -difAg;
  }
  console.log(`Resumo geral:`);
  console.log(`  Total docs a alterar: ${propostas.length}`);
  console.log(`  Economia agregada total: ${fmtBRL(economiaTotal)}`);

  // Fase E — APPLY
  let aplicados = 0, erros = [];
  let pathSnap = null;
  if (args.apply) {
    pathSnap = gravarSnapshot(propostas.map((p) => ({
      id: p.docRef.path.split('/').pop(),
      ref: p.docRef,
      data: () => p.antes,
    })), 'apply');
    console.log(`\n[Corrigir tipo_vinculo] Snapshot prévio: ${pathSnap}`);

    console.log('[Corrigir tipo_vinculo] APLICANDO updateDoc...');
    const t0 = Date.now();
    for (const p of propostas) {
      try {
        await updateDoc(p.docRef, p.payload);
        aplicados++;
        const ref = p.tipo === 'base' ? `colaboradores_base/${p.slug}` : `fechamentos/${p.periodo}/colaboradores/${p.slug}`;
        console.log(`  [${aplicados}/${propostas.length}] ${ref}`);
      } catch (e) {
        erros.push({ path: p.docRef.path, erro: e.message });
        console.error(`  ERRO ${p.docRef.path}: ${e.message}`);
      }
    }
    const tempo = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[Corrigir tipo_vinculo] Aplicados: ${aplicados}/${propostas.length} em ${tempo}s. Erros: ${erros.length}`);

    // Validação pós-write
    console.log('[Corrigir tipo_vinculo] Validando pós-write...');
    const valBaseSnap = await getDocs(collection(db, 'colaboradores_base'));
    const cltRestantes = [];
    for (const d of valBaseSnap.docs) {
      if (!args.colaboradores.includes(d.id)) continue;
      if (d.data().tipo_vinculo !== args.tipo) {
        cltRestantes.push({ docId: d.id, tipo_atual: d.data().tipo_vinculo });
      }
    }
    if (cltRestantes.length > 0) {
      console.error(`[Corrigir tipo_vinculo] ERRO: ${cltRestantes.length} docs em colaboradores_base/ ainda não estão com tipo_vinculo=${args.tipo}:`);
      for (const x of cltRestantes) console.error(`  - ${x.docId} (atual: ${x.tipo_atual})`);
      throw new Error('Validação pós-write falhou');
    }
    console.log(`[Corrigir tipo_vinculo] ✓ Validação OK: todos os ${args.colaboradores.length} slugs alvo estão com tipo_vinculo=${args.tipo}.`);
  }

  // Relatório markdown
  const md = [];
  md.push(`# Fase 2 Ato 2A.5 — Corrigir tipo_vinculo — ${modo}`);
  md.push('');
  md.push(`Gerado em ${new Date().toISOString()}.`);
  md.push('');
  md.push(`Slugs alvo: ${args.colaboradores.join(', ')}`);
  md.push(`Novo tipo: \`${args.tipo}\``);
  md.push(`Períodos: ${periodosAlvo.join(', ')}`);
  md.push('');
  md.push('## Diff por documento');
  md.push('');
  for (const p of propostas) {
    if (p.tipo === 'base') {
      md.push(`### colaboradores_base/${p.slug}`);
      md.push('');
      md.push(`| Campo | Antes | Depois |`);
      md.push(`|---|---|---|`);
      md.push(`| tipo_vinculo | ${p.antes.tipo_vinculo} | **${p.depois.tipo_vinculo}** |`);
      md.push('');
    } else {
      md.push(`### fechamentos/${p.periodo}/colaboradores/${p.slug}`);
      md.push('');
      md.push(`| Campo | Antes | Depois | Diferença |`);
      md.push(`|---|---:|---:|---:|`);
      const campos = [
        ['tipo_vinculo', p.antes.tipo_vinculo, p.depois.tipo_vinculo],
        ['inss', p.antes.inss, p.depois.inss],
        ['irrf', p.antes.irrf, p.depois.irrf],
        ['irrf_liquido', p.antes.irrf_liquido, p.depois.irrf_liquido],
        ['redutor_ir_2026', p.antes.redutor_ir_2026, p.depois.redutor_ir_2026],
        ['liquido_do_teto', p.antes.liquido_do_teto, p.depois.liquido_do_teto],
        ['complemento_plr', p.antes.complemento_plr, p.depois.complemento_plr],
        ['reflexos_plr_mensal', p.antes.reflexos_plr_mensal, p.depois.reflexos_plr_mensal],
        ['encargos_patronais', p.antes.encargos_patronais, p.depois.encargos_patronais],
        ['decimo_terceiro_ferias', p.antes.decimo_terceiro_ferias, p.depois.decimo_terceiro_ferias],
        ['custo_total_mensal', p.antes.custo_total_mensal, p.depois.custo_total_mensal],
        ['custo_hora', p.antes.custo_hora, p.depois.custo_hora],
      ];
      for (const [campo, antes, depois] of campos) {
        if (campo === 'tipo_vinculo') {
          md.push(`| ${campo} | ${antes} | **${depois}** | — |`);
        } else {
          const diff = (depois ?? 0) - (antes ?? 0);
          md.push(`| ${campo} | ${fmtNum(antes)} | ${fmtNum(depois)} | ${(diff >= 0 ? '+' : '') + fmtNum(diff)} |`);
        }
      }
      md.push('');
    }
  }
  md.push('## Totais agregados');
  md.push('');
  for (const slug of args.colaboradores) {
    const t = totaisPorSlug.get(slug);
    md.push(`### ${slug}`);
    md.push('');
    md.push(`| Período | Antes | Depois | Diferença |`);
    md.push(`|---|---:|---:|---:|`);
    for (const { periodo, antes, depois } of t.periodos) {
      const dif = depois - antes;
      md.push(`| ${periodo} | ${fmtBRL(antes)} | ${fmtBRL(depois)} | ${(dif >= 0 ? '+' : '') + fmtBRL(dif)} |`);
    }
    md.push(`| **Total** | **${fmtBRL(t.antes)}** | **${fmtBRL(t.depois)}** | **economia ${fmtBRL(-(t.depois - t.antes))}** |`);
    md.push('');
  }
  md.push(`## Resumo`);
  md.push('');
  md.push(`- Total docs alterados: **${propostas.length}**`);
  md.push(`- Economia agregada total nos períodos cobertos: **${fmtBRL(economiaTotal)}**`);
  if (args.apply) {
    md.push(`- Snapshot: \`${pathSnap}\``);
    md.push(`- Aplicados: ${aplicados}/${propostas.length}`);
    md.push(`- Erros: ${erros.length}`);
  }

  const modoTag = args.apply ? 'aplicado' : 'dry-run';
  const prefixo = `fase2-corrigirTipoVinculo-${args.tipo}-${modoTag}`;
  const pathMd = gravarRelatorio(md.join('\n'), prefixo);
  console.log(`\n[Corrigir tipo_vinculo] Relatório salvo: ${pathMd}`);
}

main().catch((e) => {
  console.error('[Corrigir tipo_vinculo] Erro:', e);
  process.exit(1);
});
