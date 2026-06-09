// --- Modal "Propagar folha em massa" (todos os colaboradores) ---
// Wizard 4 etapas: base → destino → confirmar → aplicando/concluido/erro.
// Diferente do single-colab: aplica um SNAPSHOT (teto/líquido vigente no
// período base) em todos os períodos-destino — não toca historico_reajustes.
//
// Padrão visual idêntico ao AplicarHistoricoTodos.tsx (Footer / OpcaoDestino /
// Linha / Field locais para evitar acoplamento entre os modais).

import { useState, useMemo, useEffect } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../state/AppContext';
import { propagarFolhaTodosColaboradores, buscarDadosFolhaPorPeriodo, type FiltroPropagacao } from '../../services/firebase';
import { formatCurrency } from '../../utils/formatters';
import type { Colaborador } from '../../types';

interface Props {
  colaboradores: Colaborador[];
  periodosDisponiveis: string[];
  periodoAtual: string;
  onFechar: () => void;
}

type Etapa = 'base' | 'destino' | 'confirmar' | 'aplicando' | 'concluido' | 'erro';
type TipoProp = FiltroPropagacao['tipo'];
type ErroProp = { colaborador: string; periodo: string; erro: string };

const ROT_DESTINO: Record<TipoProp, string> = {
  a_partir_de: 'A partir deste período',
  ate: 'Até este período',
  todos: 'Todos os períodos',
  intervalo: 'Intervalo personalizado',
};

const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;

export function PropagacaoEmMassa({ colaboradores, periodosDisponiveis, periodoAtual, onFechar }: Props) {
  const { recarregar } = useApp();
  const [etapa, setEtapa] = useState<Etapa>('base');
  const [periodoBase, setPeriodoBase] = useState(
    periodosDisponiveis.includes(periodoAtual) ? periodoAtual : (periodosDisponiveis[0] ?? ''));
  const [tipo, setTipo] = useState<TipoProp>('a_partir_de');
  const [intervaloIni, setIntervaloIni] = useState(periodoAtual);
  const [intervaloFim, setIntervaloFim] = useState(periodoAtual);
  const [progresso, setProgresso] = useState({ nome: '', colabAtual: 0, totalColabs: 0, periodo: '', periodoIdx: 0, totalPeriodos: 0 });
  const [resultado, setResultado] = useState<{ colaboradoresAtualizados: number; periodosAtualizados: number; erros: ErroProp[] } | null>(null);
  const [errosExpandidos, setErrosExpandidos] = useState(false);

  const colabsOrdenados = useMemo(
    () => [...colaboradores].sort((a, b) => a.nome_colaborador.localeCompare(b.nome_colaborador, 'pt-BR')),
    [colaboradores]);

  // Snapshot DIRETO do período base (lê fechamentos/{periodoBase}/colaboradores
  // sem passar por histórico). Re-fetch ao mudar de período. Mostra exatamente
  // o que será propagado.
  const [snapshotBase, setSnapshotBase] = useState<Record<string, { salario_teto_cargo: number; liquido_acordado: number }>>({});
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  useEffect(() => {
    if (!periodoBase) return;
    let cancelado = false;
    setCarregandoPreview(true);
    buscarDadosFolhaPorPeriodo(colabsOrdenados, periodoBase)
      .then(dados => { if (!cancelado) setSnapshotBase(dados); })
      .finally(() => { if (!cancelado) setCarregandoPreview(false); });
    return () => { cancelado = true; };
  }, [colabsOrdenados, periodoBase]);

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

  // Guarda "só para frente": destino > base. Períodos ≤ base são filtrados
  // (não escondemos as opções do wizard — apenas avisamos quantos saíram).
  const periodosFrente = useMemo(
    () => periodosAfetados.filter(p => p > periodoBase), [periodosAfetados, periodoBase]);
  const excluidosTras = periodosAfetados.length - periodosFrente.length;

  const intervaloValido = tipo !== 'intervalo' || (intervaloIni && intervaloFim && intervaloIni <= intervaloFim);

  async function aplicar() {
    setEtapa('aplicando');
    try {
      const r = await propagarFolhaTodosColaboradores(
        colabsOrdenados, periodosDisponiveis, periodoBase, filtro,
        (nome, colabAtual, totalColabs, periodo, periodoIdx, totalPeriodos) =>
          setProgresso({ nome, colabAtual, totalColabs, periodo, periodoIdx, totalPeriodos }),
      );
      setResultado(r);
      setEtapa(r.erros.length > 0 ? 'erro' : 'concluido');
      if (r.colaboradoresAtualizados > 0) recarregar();
    } catch (e) {
      setResultado({ colaboradoresAtualizados: 0, periodosAtualizados: 0,
        erros: [{ colaborador: '—', periodo: '—', erro: e instanceof Error ? e.message : 'Erro desconhecido' }] });
      setEtapa('erro');
    }
  }

  const handleFechar = etapa === 'aplicando' ? () => {} : onFechar;
  const titulo = etapa === 'aplicando' ? 'Propagando folha em massa…'
    : etapa === 'concluido' || etapa === 'erro' ? 'Resultado da propagação em massa'
    : 'Propagar folha em massa';

  return (
    <Modal aberto onFechar={handleFechar} titulo={titulo}>
      {etapa === 'base' && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>1 · Selecionar período base</p>
          <p className="text-sm" style={{ color: '#160F41' }}>Qual período usar como referência?</p>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            Os valores de cada colaborador neste período serão aplicados nos períodos destino.
          </p>
          <select value={periodoBase} onChange={e => setPeriodoBase(e.target.value)} className={INP} style={BRD}>
            {periodosDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto" style={{ borderColor: '#e2e2e8' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ backgroundColor: '#f9f9fb', color: '#6b6b8a' }}>
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Colaborador</th>
                  <th className="px-2 py-1.5 text-right font-medium">Teto CLT</th>
                  <th className="px-2 py-1.5 text-right font-medium">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {carregandoPreview && (
                  <tr><td colSpan={3} className="px-2 py-3 text-center text-[11px]" style={{ color: '#6b6b8a' }}>
                    <Loader2 size={12} className="animate-spin inline mr-1" /> Carregando…
                  </td></tr>
                )}
                {!carregandoPreview && colabsOrdenados.map(colab => {
                  const dados = colab.id ? snapshotBase[colab.id] : undefined;
                  return (
                    <tr key={colab.id ?? colab.nome_colaborador} className="border-t" style={{ borderColor: '#f3f4f6' }}>
                      <td className="px-2 py-1.5" style={{ color: '#160F41' }}>{colab.nome_colaborador}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: dados ? '#160F41' : '#9ca3af' }}>
                        {dados ? formatCurrency(dados.salario_teto_cargo) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: dados ? '#160F41' : '#9ca3af' }}>
                        {dados ? formatCurrency(dados.liquido_acordado) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] italic" style={{ color: '#6b6b8a' }}>
            Valores lidos diretamente de fechamentos/{periodoBase}/colaboradores. Colaboradores sem dados nesse período (—) serão pulados.
          </p>
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
            <OpcaoDestino atual={tipo} valor="a_partir_de" titulo="① A partir deste período"
              descricao={`Atualiza ${periodoBase} e meses seguintes.`} onSelect={setTipo} />
            <OpcaoDestino atual={tipo} valor="ate" titulo="② Até este período"
              descricao={`Atualiza ${periodoBase} e meses anteriores.`} onSelect={setTipo} />
            <OpcaoDestino atual={tipo} valor="todos" titulo="③ Todos os períodos"
              descricao="Atualiza todos os períodos disponíveis." onSelect={setTipo} />
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
            <strong>{colabsOrdenados.length}</strong> colaboradores × <strong>{periodosFrente.length}</strong> períodos = <strong>{colabsOrdenados.length * periodosFrente.length}</strong> atualizações.
          </p>
          {excluidosTras > 0 && (
            <p className="text-xs flex items-start gap-1.5 p-2 rounded" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{excluidosTras} período(s) ≤ base foram excluídos — a propagação em massa só vai para frente (destino &gt; {periodoBase}).</span>
            </p>
          )}
          <Footer onVoltar={() => setEtapa('base')} voltarLabel="Voltar"
            onAvancar={() => setEtapa('confirmar')} avancarLabel="Avançar"
            avancarDisabled={!intervaloValido || periodosFrente.length === 0} />
        </div>
      )}

      {etapa === 'confirmar' && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>3 · Confirmar e aplicar</p>
          <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
            <Linha label="Base" valor={periodoBase} />
            <Linha label="Destino" valor={ROT_DESTINO[tipo]} />
            <Linha label="Colaboradores" valor={String(colabsOrdenados.length)} />
            <Linha label="Períodos (destino)"
              valor={periodosFrente.length <= 5
                ? periodosFrente.join(', ') || '—'
                : `${periodosFrente.slice(0, 5).join(', ')} … e mais ${periodosFrente.length - 5}`} />
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              <strong>Sobrescreve os dados existentes</strong> dos {colabsOrdenados.length} colaboradores
              {' '}nos {periodosFrente.length} período(s) acima ({periodosFrente[0] ?? '—'} … {periodosFrente[periodosFrente.length - 1] ?? '—'}).
              {' '}<strong>Não pode ser desfeito.</strong> Confira o período base antes de continuar.
            </p>
          </div>
          <Footer onVoltar={() => setEtapa('destino')} voltarLabel="Voltar"
            onAvancar={aplicar} avancarLabel="Confirmar e aplicar" />
        </div>
      )}

      {etapa === 'aplicando' && (
        <div className="space-y-3">
          <p className="text-sm flex items-center gap-2" style={{ color: '#160F41' }}>
            <Loader2 size={16} className="animate-spin" />
            Atualizando {progresso.nome || '...'} ({progresso.colabAtual}/{progresso.totalColabs})
          </p>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            Período: {progresso.periodo || '—'} ({progresso.periodoIdx}/{progresso.totalPeriodos})
          </p>
          <div className="rounded-full overflow-hidden h-2" style={{ backgroundColor: '#f3f4f6' }}>
            <div className="h-full bg-gradient-brand transition-all"
              style={{ width: progresso.totalColabs ? `${(progresso.colabAtual / progresso.totalColabs) * 100}%` : '0%' }} />
          </div>
        </div>
      )}

      {(etapa === 'concluido' || etapa === 'erro') && resultado && (
        <div className="space-y-3">
          {resultado.colaboradoresAtualizados > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                <strong>{resultado.colaboradoresAtualizados}</strong> colaborador{resultado.colaboradoresAtualizados === 1 ? '' : 'es'} × <strong>{resultado.periodosAtualizados}</strong> atualizaç{resultado.periodosAtualizados === 1 ? 'ão' : 'ões'} de período concluídas.
              </p>
            </div>
          )}
          {resultado.erros.length > 0 && (
            <div className="rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <button onClick={() => setErrosExpandidos(v => !v)}
                className="w-full flex items-center justify-between p-3 text-left" style={{ color: '#991b1b' }}>
                <span className="flex items-center gap-2 text-sm"><AlertTriangle size={16} /> {resultado.erros.length} erro{resultado.erros.length === 1 ? '' : 's'}</span>
                <ChevronDown size={14} style={{ transform: errosExpandidos ? 'rotate(180deg)' : 'none' }} />
              </button>
              {errosExpandidos && (
                <ul className="px-3 pb-3 text-xs list-disc list-inside max-h-40 overflow-y-auto" style={{ color: '#991b1b' }}>
                  {resultado.erros.slice(0, 50).map((e, i) => <li key={i}>{e.colaborador} · {e.periodo}: {e.erro}</li>)}
                  {resultado.erros.length > 50 && <li className="italic">… e mais {resultado.erros.length - 50} erro(s).</li>}
                </ul>
              )}
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
    <div className="flex justify-between text-xs gap-2">
      <span style={{ color: '#6b6b8a' }}>{label}</span>
      <span className="font-medium text-right" style={{ color: '#160F41' }}>{valor}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>{label}</label>{children}</div>;
}
