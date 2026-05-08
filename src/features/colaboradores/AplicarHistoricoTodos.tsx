// --- Modal "Propagar folha do colaborador" ---
// Wizard de 3 etapas + execução: base → destino → confirmar → aplicando → resultado.
//   1. base: usuário escolhe o período de referência (preview via buscarTetoPorPeriodo)
//   2. destino: 4 opções (a_partir_de | ate | todos | intervalo)
//   3. confirmar: resumo + lista dos períodos afetados
//   aplicando: barra de progresso por período
//   concluido | erro: resultado final + recarregar() do AppContext

import { useState, useMemo } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../state/AppContext';
import { propagarFolhaColaborador, type FiltroPropagacao } from '../../services/firebase';
import { buscarTetoPorPeriodo } from '../../utils/financials';
import { formatCurrency } from '../../utils/formatters';
import type { Colaborador, ReajusteSalarial } from '../../types';

interface Props {
  colaborador: Colaborador;
  historico: ReajusteSalarial[];
  periodoAtual: string;            // default da base
  periodosDisponiveis: string[];   // pré-buscados em FolhaTab
  onFechar: () => void;
  onConcluido?: () => void;
}

type Etapa = 'base' | 'destino' | 'confirmar' | 'aplicando' | 'concluido' | 'erro';
type TipoProp = FiltroPropagacao['tipo'];

const ROT_DESTINO: Record<TipoProp, string> = {
  a_partir_de: 'Deste período em diante',
  ate: 'Até este período (para trás)',
  todos: 'Todos os períodos',
  intervalo: 'Intervalo personalizado',
};

const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;

export function AplicarHistoricoTodos({
  colaborador, historico, periodoAtual, periodosDisponiveis, onFechar, onConcluido,
}: Props) {
  const { recarregar } = useApp();
  const [etapa, setEtapa] = useState<Etapa>('base');
  const [periodoBase, setPeriodoBase] = useState(
    periodosDisponiveis.includes(periodoAtual) ? periodoAtual : (periodosDisponiveis[0] ?? ''),
  );
  const [tipo, setTipo] = useState<TipoProp>('a_partir_de');
  const [intervaloIni, setIntervaloIni] = useState(periodoAtual);
  const [intervaloFim, setIntervaloFim] = useState(periodoAtual);
  const [progresso, setProgresso] = useState({ periodo: '', atual: 0, total: 0 });
  const [resultado, setResultado] = useState<{ periodos: string[]; erros: string[] } | null>(null);

  // Stub p/ buscarTetoPorPeriodo usar o histórico EM EDIÇÃO (não o do Firestore).
  const stubColab = useMemo<Colaborador>(
    () => ({ ...colaborador, historico_reajustes: historico }), [colaborador, historico]);
  const previewBase = useMemo(
    () => periodoBase ? buscarTetoPorPeriodo(stubColab, periodoBase) : null,
    [stubColab, periodoBase]);

  const filtro = useMemo<FiltroPropagacao>(() => {
    if (tipo === 'todos') return { tipo };
    if (tipo === 'a_partir_de') return { tipo, periodoInicio: periodoBase };
    if (tipo === 'ate') return { tipo, periodoFim: periodoBase };
    return { tipo: 'intervalo', periodoInicio: intervaloIni, periodoFim: intervaloFim };
  }, [tipo, periodoBase, intervaloIni, intervaloFim]);

  const periodosAfetados = useMemo(() => {
    if (tipo === 'todos') return periodosDisponiveis;
    if (tipo === 'a_partir_de') return periodosDisponiveis.filter(p => p >= periodoBase);
    if (tipo === 'ate') return periodosDisponiveis.filter(p => p <= periodoBase);
    if (!intervaloIni || !intervaloFim || intervaloIni > intervaloFim) return [];
    return periodosDisponiveis.filter(p => p >= intervaloIni && p <= intervaloFim);
  }, [tipo, periodoBase, intervaloIni, intervaloFim, periodosDisponiveis]);

  const intervaloValido = tipo !== 'intervalo' || (intervaloIni && intervaloFim && intervaloIni <= intervaloFim);

  async function aplicar() {
    if (!colaborador.id || !previewBase) return;
    setEtapa('aplicando');
    try {
      const r = await propagarFolhaColaborador(
        colaborador.id, historico,
        previewBase.salario_teto_cargo, previewBase.liquido_acordado,
        filtro,
        (periodo, atual, total) => setProgresso({ periodo, atual, total }),
      );
      setResultado(r);
      setEtapa(r.erros.length > 0 ? 'erro' : 'concluido');
      if (r.periodos.length > 0) { onConcluido?.(); recarregar(); }
    } catch (e) {
      setResultado({ periodos: [], erros: [e instanceof Error ? e.message : 'Erro desconhecido'] });
      setEtapa('erro');
    }
  }

  const handleFechar = etapa === 'aplicando' ? () => {} : onFechar;
  const titulo = etapa === 'aplicando' ? 'Propagando folha…'
    : etapa === 'concluido' || etapa === 'erro' ? 'Resultado da propagação'
    : 'Propagar folha do colaborador';

  return (
    <Modal aberto onFechar={handleFechar} titulo={titulo}>
      {etapa === 'base' && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>1 · Selecionar base</p>
          <p className="text-sm" style={{ color: '#160F41' }}>Qual período usar como base?</p>
          <select value={periodoBase} onChange={e => setPeriodoBase(e.target.value)} className={INP} style={BRD}>
            {periodosDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {previewBase && (
            <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
              <Linha label="Teto CLT" valor={formatCurrency(previewBase.salario_teto_cargo)} />
              <Linha label="Líquido acordado" valor={formatCurrency(previewBase.liquido_acordado)} />
              <Linha label="Vigência usada" valor={`${previewBase.vigencia} (${previewBase.fonte})`} />
            </div>
          )}
          <Footer onVoltar={onFechar} voltarLabel="Cancelar"
            onAvancar={() => setEtapa('destino')} avancarLabel="Avançar"
            avancarDisabled={!periodoBase} />
        </div>
      )}

      {etapa === 'destino' && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>2 · Selecionar destino</p>
          <p className="text-sm" style={{ color: '#160F41' }}>Onde aplicar?</p>
          <div className="space-y-2">
            <OpcaoDestino atual={tipo} valor="a_partir_de" titulo="① Deste período em diante"
              descricao={`Atualiza ${periodoBase} e meses seguintes.`} onSelect={setTipo} />
            <OpcaoDestino atual={tipo} valor="ate" titulo="② Até este período (para trás)"
              descricao={`Atualiza ${periodoBase} e meses anteriores.`} onSelect={setTipo} />
            <OpcaoDestino atual={tipo} valor="todos" titulo="③ Todos os períodos"
              descricao="Atualiza todos os períodos do colaborador no sistema." onSelect={setTipo} />
            <OpcaoDestino atual={tipo} valor="intervalo" titulo="④ Intervalo personalizado"
              descricao="De [mês] até [mês]." onSelect={setTipo} />
            {tipo === 'intervalo' && (
              <div className="grid grid-cols-2 gap-2 ml-4">
                <Field label="De"><input type="month" value={intervaloIni} onChange={e => setIntervaloIni(e.target.value)} className={INP} style={BRD} /></Field>
                <Field label="Até"><input type="month" value={intervaloFim} onChange={e => setIntervaloFim(e.target.value)} className={INP} style={BRD} /></Field>
                {!intervaloValido && <p className="col-span-2 text-[11px]" style={{ color: '#dc2626' }}>De ≤ Até.</p>}
              </div>
            )}
          </div>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            Serão atualizados aproximadamente <strong>{periodosAfetados.length}</strong> período{periodosAfetados.length === 1 ? '' : 's'}.
          </p>
          <Footer onVoltar={() => setEtapa('base')} voltarLabel="Voltar"
            onAvancar={() => setEtapa('confirmar')} avancarLabel="Avançar"
            avancarDisabled={!intervaloValido || periodosAfetados.length === 0} />
        </div>
      )}

      {etapa === 'confirmar' && previewBase && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>3 · Confirmar e aplicar</p>
          <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
            <Linha label="Colaborador" valor={colaborador.nome_colaborador} />
            <Linha label="Base" valor={`${periodoBase} → ${formatCurrency(previewBase.salario_teto_cargo)} / ${formatCurrency(previewBase.liquido_acordado)}`} />
            <Linha label="Destino" valor={ROT_DESTINO[tipo]} />
            <Linha label="Períodos" valor={`${periodosAfetados.length} (${periodosAfetados[0] ?? '—'} … ${periodosAfetados[periodosAfetados.length - 1] ?? '—'})`} />
          </div>
          <div className="rounded-lg border p-2 max-h-32 overflow-y-auto text-[11px] flex flex-wrap gap-1" style={{ borderColor: '#e2e2e8' }}>
            {periodosAfetados.map(p => <span key={p} className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f3f4f6', color: '#160F41' }}>{p}</span>)}
          </div>
          <Footer onVoltar={() => setEtapa('destino')} voltarLabel="Voltar"
            onAvancar={aplicar} avancarLabel="Aplicar" />
        </div>
      )}

      {etapa === 'aplicando' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: '#160F41' }} />
            <p className="text-sm" style={{ color: '#160F41' }}>
              Atualizando {progresso.periodo || '...'} ({progresso.atual}/{progresso.total})
            </p>
          </div>
          <div className="rounded-full overflow-hidden h-2" style={{ backgroundColor: '#f3f4f6' }}>
            <div className="h-full bg-gradient-brand transition-all"
              style={{ width: progresso.total ? `${(progresso.atual / progresso.total) * 100}%` : '0%' }} />
          </div>
        </div>
      )}

      {(etapa === 'concluido' || etapa === 'erro') && resultado && (
        <div className="space-y-3">
          {resultado.periodos.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-sm"><strong>{resultado.periodos.length}</strong> período{resultado.periodos.length === 1 ? '' : 's'} atualizado{resultado.periodos.length === 1 ? '' : 's'} com sucesso.</p>
            </div>
          )}
          {resultado.erros.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm">Falha em {resultado.erros.length} período{resultado.erros.length === 1 ? '' : 's'}:</p>
                <ul className="text-xs list-disc list-inside max-h-40 overflow-y-auto">
                  {resultado.erros.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                  {resultado.erros.length > 20 && <li className="italic">… e mais {resultado.erros.length - 20} erro(s).</li>}
                </ul>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">Fechar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Footer(props: { onVoltar: () => void; voltarLabel: string; onAvancar: () => void; avancarLabel: string; avancarDisabled?: boolean }) {
  return (
    <div className="flex justify-between gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
      <button onClick={props.onVoltar} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
        <ArrowLeft size={14} /> {props.voltarLabel}
      </button>
      <button onClick={props.onAvancar} disabled={props.avancarDisabled}
        className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
        {props.avancarLabel} <ArrowRight size={14} />
      </button>
    </div>
  );
}

function OpcaoDestino({ atual, valor, titulo, descricao, onSelect }: { atual: TipoProp; valor: TipoProp; titulo: string; descricao: string; onSelect: (v: TipoProp) => void }) {
  const sel = atual === valor;
  return (
    <button type="button" onClick={() => onSelect(valor)}
      className="w-full text-left p-3 rounded-lg transition"
      style={sel ? { border: '2px solid #160F41', backgroundColor: '#f9f9fb' } : { border: '1px solid #e2e2e8' }}>
      <p className="text-sm font-medium" style={{ color: '#160F41' }}>{titulo}</p>
      <p className="text-xs" style={{ color: '#6b6b8a' }}>{descricao}</p>
    </button>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: '#6b6b8a' }}>{label}</span>
      <span className="font-medium" style={{ color: '#160F41' }}>{valor}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>{label}</label>{children}</div>;
}
