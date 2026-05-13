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
  qtd_dependentes: number; beneficios_fixos: number;
  historico_reajustes: ReajusteSalarial[];
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
}

/** Resolve teto/líquido vigentes para o período a partir do colaborador
 *  (consulta histórico OU cai no fallback dos campos diretos). Encapsula a
 *  inicialização do form e a obtenção do baseline na hora de salvar. */
function tetoVigente(c: Colaborador, periodo: string): { teto: number; liquido: number } {
  const r = buscarTetoPorPeriodo(c, periodo);
  return { teto: r.salario_teto_cargo, liquido: r.liquido_acordado };
}

export function FolhaTab({ modo, inicial, periodo, salvando, onSalvar, onCancelar, extraFooterLeft }: Props) {
  const { usuario } = useAuth();
  const [form, setForm] = useState<FolhaForm>(() => {
    const v = tetoVigente(inicial, periodo);
    return {
      nome_colaborador: inicial.nome_colaborador, cargo: inicial.cargo,
      funcao_principal: inicial.funcao_principal,
      tipo_vinculo: inicial.tipo_vinculo === 'pro_labore' ? 'pro_labore' : 'clt', localidade: inicial.localidade ?? 'SP',
      alocavel: inicial.alocavel ?? true,
      percentual_alocavel: inicial.percentual_alocavel ?? 0.7,
      percentual_institucional: inicial.percentual_institucional ?? 0.3,
      salario_base: inicial.salario_base ?? 0,
      // Init via buscarTetoPorPeriodo — abrir Fev/2026 carrega valores de
      // Jan/2026 se não houve reajuste registrado entre eles.
      salario_teto_cargo: v.teto,
      liquido_acordado: v.liquido,
      qtd_dependentes: inicial.qtd_dependentes ?? 0,
      beneficios_fixos: inicial.beneficios_fixos ?? 0,
      historico_reajustes: inicial.historico_reajustes ?? [],
    };
  });
  const [erro, setErro] = useState<string | null>(null);
  const [resumoAberto, setResumoAberto] = useState(true);
  const [aplicarTodosAberto, setAplicarTodosAberto] = useState(false);
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[] | null>(null);
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(false);

  const isCLT = form.tipo_vinculo === 'clt';
  const set = <K extends keyof FolhaForm>(k: K, v: FolhaForm[K]) => setForm(p => ({ ...p, [k]: v }));

  // Re-inicializa o form quando muda o colaborador editado OU o período.
  // Garante que abrir um período diferente recarrega o teto vigente correto
  // sem sobrescrever a digitação em curso (deps são apenas chaves de identidade).
  useEffect(() => {
    const v = tetoVigente(inicial, periodo);
    setForm({
      nome_colaborador: inicial.nome_colaborador, cargo: inicial.cargo,
      funcao_principal: inicial.funcao_principal,
      tipo_vinculo: inicial.tipo_vinculo === 'pro_labore' ? 'pro_labore' : 'clt', localidade: inicial.localidade ?? 'SP',
      alocavel: inicial.alocavel ?? true,
      percentual_alocavel: inicial.percentual_alocavel ?? 0.7,
      percentual_institucional: inicial.percentual_institucional ?? 0.3,
      salario_base: inicial.salario_base ?? 0,
      salario_teto_cargo: v.teto,
      liquido_acordado: v.liquido,
      qtd_dependentes: inicial.qtd_dependentes ?? 0,
      beneficios_fixos: inicial.beneficios_fixos ?? 0,
      historico_reajustes: inicial.historico_reajustes ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial.nome_colaborador, periodo]);

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

  async function handleSalvar() {
    setErro(null);
    if (modo === 'criar') {
      if (!form.nome_colaborador.trim()) return setErro('Nome é obrigatório.');
      if (!form.cargo.trim()) return setErro('Cargo é obrigatório.');
      if (!form.funcao_principal.trim()) return setErro('Função é obrigatória.');
      if (isCLT && form.salario_teto_cargo <= 0) return setErro('Teto CLT deve ser > 0.');
      if (!isCLT && form.salario_base <= 0) return setErro('Salário base deve ser > 0.');
    }
    const soma = form.percentual_alocavel + form.percentual_institucional;
    if (Math.abs(soma - 1) > 0.001) return setErro(`% Alocável + Institucional deve ser 1,00 (atual: ${soma.toFixed(2)}).`);

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

    await onSalvar({
      ...colabCalc,
      historico_reajustes: historicoFinal,
      custo_total_mensal: resultado.custo_total_mensal, custo_hora: resultado.custo_hora,
      inss: resultado.inss, irrf: resultado.irrf_liquido,
      complemento_plr: resultado.complemento_plr, reflexos_plr_mensal: resultado.reflexos_plr_mensal,
      encargos_patronais: resultado.encargos_patronais, decimo_terceiro_ferias: resultado.decimo_terceiro_ferias,
    });
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
        {modo === 'criar' && (
          <section className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Cadastro</h4>
            <Campo label="Cargo" tipo="text" valor={form.cargo} onText={v => set('cargo', v)} />
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
          <Campo label="Benefícios Fixos" tipo="number" step={0.01} valor={form.beneficios_fixos} onNum={v => set('beneficios_fixos', v)} />
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
