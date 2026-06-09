// --- Aba Folha do modal de Colaborador ---
// CLT: inputs principais são teto + liquido_acordado + dependentes; o motor
// calcula INSS/IRRF, complemento PLR e reflexos. Pro-labore: input é
// salario_base direto. Resumo dos calculados em tempo real (auditoria).
//
// Histórico de reajustes (CLT) é construído AUTOMATICAMENTE: ao salvar com
// teto/líquido diferentes do baseline (vigente para o período), o motor
// injeta uma entrada {vigencia: periodo, observacao: 'Reajuste automático'}.
// O usuário não cadastra reajustes manualmente — só pode excluir entradas
// não-vigentes para corrigir erros (ver HistoricoReajustes.tsx).
//
// Layout: flex-col com corpo scrollável (formulário) + rodapé fixo (ações).

import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { Loader2, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { calcularFolhaColaborador, buscarTetoPorPeriodo } from '../../utils/financials';
import { buscarPeriodosDoColaborador } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useApp } from '../../state/AppContext';
import { FolhaCalculadosResumo } from './FolhaCalculadosResumo';
import { Campo, SelectField } from './FolhaTabFields';
import { HistoricoReajustes } from './HistoricoReajustes';
import { AplicarHistoricoTodos } from './AplicarHistoricoTodos';
import type { Colaborador, ReajusteSalarial } from '../../types';

export interface FolhaForm {
  nome_colaborador: string; cargo: string; funcao_principal: string;
  tipo_vinculo: 'clt' | 'pro_labore'; localidade: 'SP' | 'RJ';
  alocavel: boolean; percentual_alocavel: number; percentual_institucional: number;
  salario_base: number; salario_teto_cargo: number; liquido_acordado: number;
  qtd_dependentes: number;
  // beneficios_fixos é DERIVADO (= soma dos 4 abaixo) — read-only na UI.
  beneficios_fixos: number;
  vale_alimentacao: number; vale_transporte: number;
  plano_saude: number; outros_beneficios: number;
  historico_reajustes: ReajusteSalarial[];
}

/** Invariante do sistema: beneficios_fixos = VA + VT + plano + outros. */
function somaBeneficios(va: number, vt: number, ps: number, ob: number): number {
  return (va || 0) + (vt || 0) + (ps || 0) + (ob || 0);
}

interface Props {
  modo: 'editar' | 'criar';
  inicial: Colaborador;
  periodo: string;
  salvando: boolean;
  onSalvar: (atualizado: Colaborador) => Promise<void>;
  onCancelar: () => void;
  /** Slot opcional alinhado à esquerda do rodapé fixo (ex: botão Excluir). */
  extraFooterLeft?: ReactNode;
  /** Reporta se o form está sujo (diferente do snapshot inicial). Usado pela
   *  navegação anterior/próximo no cabeçalho para confirmar perda de edições. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Registra a função que valida + monta o payload (sem persistir), para o
   *  fluxo "Salvar e avançar" orquestrado pelo modal pai. Retorna null se a
   *  validação falhar (o erro já é exibido aqui). */
  registrarMontarPayload?: (fn: () => Colaborador | null) => void;
}

/** Resolve teto/líquido vigentes para o período a partir do colaborador
 *  (consulta histórico OU cai no fallback dos campos diretos). Encapsula a
 *  inicialização do form e a obtenção do baseline na hora de salvar. */
function tetoVigente(c: Colaborador, periodo: string): { teto: number; liquido: number } {
  const r = buscarTetoPorPeriodo(c, periodo);
  return { teto: r.salario_teto_cargo, liquido: r.liquido_acordado };
}

/** Monta o estado inicial do form a partir do colaborador + período.
 *  Fonte única para init (useState), ressincronização (useEffect) e o
 *  snapshot de comparação do dirty-check. */
function construirFormInicial(inicial: Colaborador, periodo: string): FolhaForm {
  const v = tetoVigente(inicial, periodo);

  // Resolve os 4 subcampos de benefício. Doc já migrado tem ao menos um deles
  // → usa os valores persistidos. Doc legado (nenhum subcampo) com
  // beneficios_fixos > 0 → herança fechada pelo CFO: vale_alimentacao recebe o
  // total, os demais 3 ficam zero. beneficios_fixos é sempre a soma (invariante).
  const algumPresente =
    inicial.vale_alimentacao !== undefined || inicial.vale_transporte !== undefined ||
    inicial.plano_saude !== undefined || inicial.outros_beneficios !== undefined;
  const benefTotalLegado = inicial.beneficios_fixos ?? 0;
  const vale_alimentacao = algumPresente ? (inicial.vale_alimentacao ?? 0) : benefTotalLegado;
  const vale_transporte = algumPresente ? (inicial.vale_transporte ?? 0) : 0;
  const plano_saude = algumPresente ? (inicial.plano_saude ?? 0) : 0;
  const outros_beneficios = algumPresente ? (inicial.outros_beneficios ?? 0) : 0;

  return {
    nome_colaborador: inicial.nome_colaborador, cargo: inicial.cargo,
    funcao_principal: inicial.funcao_principal,
    tipo_vinculo: inicial.tipo_vinculo === 'pro_labore' ? 'pro_labore' : 'clt',
    localidade: inicial.localidade ?? 'SP',
    alocavel: inicial.alocavel ?? true,
    percentual_alocavel: inicial.percentual_alocavel ?? 0.7,
    percentual_institucional: inicial.percentual_institucional ?? 0.3,
    salario_base: inicial.salario_base ?? 0,
    // Init via buscarTetoPorPeriodo — abrir Fev/2026 carrega valores de
    // Jan/2026 se não houve reajuste registrado entre eles.
    salario_teto_cargo: v.teto,
    liquido_acordado: v.liquido,
    qtd_dependentes: inicial.qtd_dependentes ?? 0,
    vale_alimentacao, vale_transporte, plano_saude, outros_beneficios,
    // Derivado da soma — preserva o valor original (herança = identidade).
    beneficios_fixos: somaBeneficios(vale_alimentacao, vale_transporte, plano_saude, outros_beneficios),
    historico_reajustes: inicial.historico_reajustes ?? [],
  };
}

// Normalização p/ detectar cargo duplicado por grafia (acentos/caixa/espaços).
function normCargo(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Dropdown de cargo DERIVADO dos cargos já usados (sem constante/coleção nova) +
// opção de adicionar um cargo inédito. Cargo é descritivo — o motor não o usa.
function CargoField({ valor, cargos, onChange }: { valor: string; cargos: string[]; onChange: (v: string) => void }) {
  const [adicionando, setAdicionando] = useState(false);
  const [novo, setNovo] = useState('');

  // Inclui o cargo atual do form para que fique sempre selecionável.
  const opcoes = useMemo(() => {
    const set = new Set(cargos.filter(Boolean));
    if (valor) set.add(valor);
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [cargos, valor]);

  const INP = 'rounded px-2 py-1.5 text-sm w-full';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;

  function confirmarNovo() {
    const limpo = novo.trim();
    if (!limpo) return;
    // Duplicata por grafia → reaproveita o cargo existente (não cria "diretor " novo).
    const existente = opcoes.find(c => normCargo(c) === normCargo(limpo));
    if (existente) { onChange(existente); setAdicionando(false); setNovo(''); return; }
    // Micro-fricção anti-typo: confirma antes de um cargo inédito entrar na lista.
    if (!window.confirm(`Criar o cargo «${limpo}»?`)) return;
    onChange(limpo);
    setAdicionando(false); setNovo('');
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Cargo</label>
      {adicionando ? (
        <div className="flex gap-2">
          <input autoFocus value={novo} onChange={e => setNovo(e.target.value)}
            placeholder="Novo cargo (ex: Diretor)"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarNovo(); } }}
            className={INP} style={BRD} />
          <button type="button" onClick={confirmarNovo} disabled={!novo.trim()}
            className="px-3 py-1.5 rounded text-xs font-medium text-white bg-gradient-brand disabled:opacity-50">Criar</button>
          <button type="button" onClick={() => { setAdicionando(false); setNovo(''); }}
            className="px-3 py-1.5 rounded text-xs" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
        </div>
      ) : (
        <select value={valor}
          onChange={e => { if (e.target.value === '__novo__') setAdicionando(true); else onChange(e.target.value); }}
          className={INP} style={BRD}>
          <option value="">Selecione um cargo...</option>
          {opcoes.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__novo__">+ Adicionar novo cargo…</option>
        </select>
      )}
    </div>
  );
}

export function FolhaTab({
  modo, inicial, periodo, salvando, onSalvar, onCancelar, extraFooterLeft,
  onDirtyChange, registrarMontarPayload,
}: Props) {
  const { usuario } = useAuth();
  const { dadosPeriodo } = useApp();
  // Lista derivada dos cargos já usados no período (sem constante/coleção nova).
  const cargos = useMemo(
    () => [...new Set((dadosPeriodo?.colaboradores ?? []).map(c => c.cargo).filter(Boolean))],
    [dadosPeriodo],
  );
  const [form, setForm] = useState<FolhaForm>(() => construirFormInicial(inicial, periodo));
  const [erro, setErro] = useState<string | null>(null);
  const [resumoAberto, setResumoAberto] = useState(true);
  const [aplicarTodosAberto, setAplicarTodosAberto] = useState(false);
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[] | null>(null);
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(false);

  const isCLT = form.tipo_vinculo === 'clt';
  const set = <K extends keyof FolhaForm>(k: K, v: FolhaForm[K]) => setForm(p => ({ ...p, [k]: v }));

  // Atualiza um dos 4 subcampos de benefício e recalcula beneficios_fixos
  // (derivado = soma). Mantém o invariante a cada digitação.
  type SubBeneficio = 'vale_alimentacao' | 'vale_transporte' | 'plano_saude' | 'outros_beneficios';
  const setBeneficio = (k: SubBeneficio, v: number) => setForm(p => {
    const next = { ...p, [k]: v };
    next.beneficios_fixos = somaBeneficios(
      next.vale_alimentacao, next.vale_transporte, next.plano_saude, next.outros_beneficios,
    );
    return next;
  });

  // Re-inicializa o form quando muda o colaborador editado OU o período.
  // Garante que abrir um período diferente recarrega o teto vigente correto
  // sem sobrescrever a digitação em curso (deps são apenas chaves de identidade).
  // Obs: a navegação anterior/próximo remonta o modal via key={id}, então este
  // efeito atua principalmente na troca de período (mesmo colaborador).
  useEffect(() => {
    setForm(construirFormInicial(inicial, periodo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial.nome_colaborador, periodo]);

  // Snapshot inicial para o dirty-check — mesma construção do init, recomputado
  // só quando muda a identidade (colaborador/período).
  const snapshotInicial = useMemo(
    () => construirFormInicial(inicial, periodo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inicial.nome_colaborador, periodo],
  );
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(snapshotInicial),
    [form, snapshotInicial],
  );
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  // Apenas reflete a deleção de uma entrada não-vigente — não sincroniza
  // campos principais (estes são fonte da verdade para o save automático).
  function handleHistoricoChange(novoHistorico: ReajusteSalarial[]) {
    setForm(p => ({ ...p, historico_reajustes: novoHistorico }));
  }

  // Folha completa em tempo real a partir do form (digitação reflete na hora).
  // NÃO passamos `periodo` ao motor — passar `periodo` faria buscarTetoPorPeriodo
  // sobrescrever o teto/líquido do form com a entrada do histórico, congelando o
  // preview. Em produção (AppContext) o motor recebe `periodo` para resolver o
  // teto via histórico; aqui no modal o preview é WYSIWYG dos valores digitados.
  const colabCalc = useMemo<Colaborador>(() => ({
    ...inicial, ...form, custo_total_mensal: 0, custo_hora: 0,
  }), [form, inicial]);
  const resultado = useMemo(() => {
    const ano = periodo ? parseInt(periodo.split('-')[0]) : undefined;
    return calcularFolhaColaborador(colabCalc, ano);
  }, [colabCalc, periodo]);

  // Pré-busca os períodos do colaborador antes de abrir o modal de propagação.
  // Mostra loading no botão até a lista chegar.
  async function abrirPropagar() {
    if (!inicial.id) return;
    setCarregandoPeriodos(true);
    try {
      const periodos = await buscarPeriodosDoColaborador(inicial.id);
      setPeriodosDisponiveis(periodos);
      setAplicarTodosAberto(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao listar períodos.');
    } finally {
      setCarregandoPeriodos(false);
    }
  }

  // Valida e monta o payload final SEM persistir. Retorna null (e exibe erro)
  // quando a validação falha. Usado tanto pelo botão Salvar quanto pelo fluxo
  // "Salvar e avançar" da navegação (que persiste via o pai). Validações e
  // payload são idênticos ao comportamento anterior — só a persistência saiu.
  function montarPayload(): Colaborador | null {
    setErro(null);
    if (modo === 'criar') {
      if (!form.nome_colaborador.trim()) { setErro('Nome é obrigatório.'); return null; }
      if (!form.cargo.trim()) { setErro('Cargo é obrigatório.'); return null; }
      if (!form.funcao_principal.trim()) { setErro('Função é obrigatória.'); return null; }
      if (isCLT && form.salario_teto_cargo <= 0) { setErro('Teto CLT deve ser > 0.'); return null; }
      if (!isCLT && form.salario_base <= 0) { setErro('Salário base deve ser > 0.'); return null; }
    }
    const soma = form.percentual_alocavel + form.percentual_institucional;
    if (Math.abs(soma - 1) > 0.001) { setErro(`% Alocável + Institucional deve ser 1,00 (atual: ${soma.toFixed(2)}).`); return null; }

    // Auto-registro de reajuste (CLT): se o usuário alterou teto OU líquido
    // em relação ao baseline (vigente no período do `inicial`), injeta uma
    // entrada com vigencia=periodo. Substitui qualquer entrada anterior com a
    // mesma vigência (caso o mesmo período seja salvo de novo após edição).
    let historicoFinal = form.historico_reajustes;
    if (isCLT) {
      const baseline = tetoVigente(inicial, periodo);
      const mudou = form.salario_teto_cargo !== baseline.teto
                 || form.liquido_acordado !== baseline.liquido;
      if (mudou) {
        const nova: ReajusteSalarial = {
          vigencia: periodo,
          salario_teto_cargo: form.salario_teto_cargo,
          liquido_acordado: form.liquido_acordado,
          observacao: 'Reajuste automático',
          registrado_em: new Date().toISOString(),
          registrado_por: usuario?.nome ?? usuario?.email ?? 'sistema',
        };
        historicoFinal = [...form.historico_reajustes.filter(r => r.vigencia !== periodo), nova];
      }
    }

    return {
      ...colabCalc,
      historico_reajustes: historicoFinal,
      custo_total_mensal: resultado.custo_total_mensal, custo_hora: resultado.custo_hora,
      inss: resultado.inss, irrf: resultado.irrf_liquido,
      complemento_plr: resultado.complemento_plr, reflexos_plr_mensal: resultado.reflexos_plr_mensal,
      encargos_patronais: resultado.encargos_patronais, decimo_terceiro_ferias: resultado.decimo_terceiro_ferias,
    };
  }

  // Registra montarPayload para o modal pai (fluxo Salvar e avançar). Sem array
  // de deps: re-registra a cada render para manter a closure atual de form.
  useEffect(() => { registrarMontarPayload?.(montarPayload); });

  async function handleSalvar() {
    const payload = montarPayload();
    if (!payload) return;
    await onSalvar(payload);
  }

  return (
    <div className="flex flex-col">
      {/* Corpo scrollável — max-h direto evita o pitfall do flex-1 sem
          altura fixa no parent (que pode colapsar e esconder seções). */}
      <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
        {/* Nome do colaborador é editável em ambos os modos. Quando editado
            no modo 'editar' e salvo, dispara a propagação automática para
            todos os clientes que tinham o nome antigo (RenomearColaboradorModal). */}
        <Campo label="Nome do Colaborador" tipo="text" valor={form.nome_colaborador}
          placeholder="Nome completo" onText={v => set('nome_colaborador', v)} />
        {/* Cargo — dropdown derivado, editável em CRIAR e EDITAR. */}
        <CargoField valor={form.cargo} cargos={cargos} onChange={v => set('cargo', v)} />
        {modo === 'criar' && (
          <section className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Cadastro</h4>
            <Campo label="Função principal (consultoria_gestao, operacional_financeiro, …)"
              tipo="text" valor={form.funcao_principal} onText={v => set('funcao_principal', v)} />
          </section>
        )}

        <section className="grid grid-cols-2 gap-3">
          <SelectField label="Vínculo" valor={form.tipo_vinculo}
            opcoes={[['clt', 'CLT'], ['pro_labore', 'Pró-labore']]}
            onChange={v => set('tipo_vinculo', v as 'clt' | 'pro_labore')} />
          <SelectField label="Localidade" valor={form.localidade}
            opcoes={[['SP', 'SP'], ['RJ', 'RJ']]}
            onChange={v => set('localidade', v as 'SP' | 'RJ')} />
          <Campo label="% Alocável (0–1)" tipo="number" step={0.01} valor={form.percentual_alocavel} onNum={v => set('percentual_alocavel', v)} />
          <Campo label="% Institucional (0–1)" tipo="number" step={0.01} valor={form.percentual_institucional} onNum={v => set('percentual_institucional', v)} />
        </section>

        <section className="space-y-2 pt-2 border-t" style={{ borderColor: '#f3f4f6' }}>
          <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Remuneração</h4>
          {isCLT ? (
            <>
              <Campo label="Salário Teto CLT" tipo="number" step={0.01} valor={form.salario_teto_cargo} onNum={v => set('salario_teto_cargo', v)} />
              <Campo label="Líquido Acordado" tipo="number" step={0.01} valor={form.liquido_acordado} onNum={v => set('liquido_acordado', v)} />
              <Campo label="Dependentes IR" tipo="number" step={1} valor={form.qtd_dependentes} onNum={v => set('qtd_dependentes', Math.max(0, Math.floor(v)))} />
            </>
          ) : (
            <Campo label="Salário Pró-labore" tipo="number" step={0.01} valor={form.salario_base} onNum={v => set('salario_base', v)} />
          )}
          {/* Benefícios detalhados em 4 subcampos. beneficios_fixos é DERIVADO
              (soma) e read-only — só ele entra no custo (motor lê só ele). */}
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Benefícios</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Vale Alimentação" tipo="number" step={0.01} valor={form.vale_alimentacao} onNum={v => setBeneficio('vale_alimentacao', v)} />
              <Campo label="Vale Transporte" tipo="number" step={0.01} valor={form.vale_transporte} onNum={v => setBeneficio('vale_transporte', v)} />
              <Campo label="Plano de Saúde" tipo="number" step={0.01} valor={form.plano_saude} onNum={v => setBeneficio('plano_saude', v)} />
              <Campo label="Outros Benefícios" tipo="number" step={0.01} valor={form.outros_beneficios} onNum={v => setBeneficio('outros_beneficios', v)} />
            </div>
            <div className="flex items-center justify-between rounded px-2 py-1.5" style={{ backgroundColor: '#f3f4f6' }}
              title="Calculado automaticamente (soma dos 4 benefícios). É o valor que entra no custo.">
              <span className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Benefícios Fixos (total)</span>
              <span className="text-sm font-bold" style={{ color: '#160F41' }}>{formatCurrency(form.beneficios_fixos)}</span>
            </div>
          </div>
        </section>

        {isCLT && (
          <HistoricoReajustes historico={form.historico_reajustes} periodo={periodo}
            onChange={handleHistoricoChange} />
        )}

        <button type="button" onClick={() => setResumoAberto(v => !v)}
          className="w-full rounded-lg p-3 flex items-center justify-between"
          style={{ backgroundColor: '#160F41', color: '#fff' }}>
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-wider opacity-70">Custo total mensal · clique para detalhar</p>
            <p className="text-lg font-bold">{formatCurrency(resultado.custo_total_mensal)}</p>
            <p className="text-[10px] opacity-70">Custo/hora ({form.localidade}): {formatCurrency(resultado.custo_hora)}</p>
          </div>
          {resumoAberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {resumoAberto && <FolhaCalculadosResumo resultado={resultado} isCLT={isCLT} localidade={form.localidade} />}
      </div>

      {erro && <p className="text-xs px-3 py-2 mt-2 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>{erro}</p>}

      <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
        <div>{extraFooterLeft}</div>
        <div className="flex gap-3 flex-wrap justify-end">
          <button onClick={onCancelar} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
          {modo === 'editar' && inicial.id && (
            <button type="button" onClick={abrirPropagar} disabled={salvando || carregandoPeriodos}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ border: '1px solid #160F41', color: '#160F41' }}>
              {carregandoPeriodos ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
              {carregandoPeriodos ? 'Carregando períodos…' : 'Propagar folha…'}
            </button>
          )}
          <button onClick={handleSalvar} disabled={salvando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {salvando ? 'Salvando...' : modo === 'criar' ? 'Criar Colaborador' : 'Salvar Folha'}
          </button>
        </div>
      </div>

      {aplicarTodosAberto && inicial.id && periodosDisponiveis && (
        <AplicarHistoricoTodos
          colaborador={{ ...inicial, ...form }}
          historico={form.historico_reajustes}
          periodoAtual={periodo}
          periodosDisponiveis={periodosDisponiveis}
          onFechar={() => setAplicarTodosAberto(false)}
        />
      )}
    </div>
  );
}
