// --- Modal de Colaborador (orquestrador) ---
// Modos: 'editar' (derivado existente) e 'criar' (novo). Aba Alocação só em editar.
// Botão excluir disponível para admin no modo editar.
// Navegação anterior/próximo (modo editar): setas no cabeçalho percorrem a
// MESMA lista ordenada da tabela. Com form sujo, confirma antes de trocar.

import { useState, useRef, useEffect } from 'react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../state/AuthContext';
import { ColaboradorAlocacao } from './ColaboradorAlocacao';
import { FolhaTab } from './FolhaTab';
import { ConfirmacaoExclusao } from './ConfirmacaoExclusao';
import type { Colaborador, Cliente, FuncaoAlocacao } from '../../types';
import type { ColaboradorDerivado } from './useColaboradores';

interface PropsBase {
  clientes: Cliente[];
  periodo: string;
  salvando: boolean;
  onSalvarPct: (nomeCliente: string, funcao: FuncaoAlocacao, valor: number) => Promise<void>;
  onFechar: () => void;
}

interface PropsEditar extends PropsBase {
  modo: 'editar';
  derivado: ColaboradorDerivado;
  onSalvarFolha: (atualizado: Colaborador) => Promise<void>;
  onExcluir: (colaboradorId: string, removerFuturos: boolean) => Promise<{ periodosFuturos: number }>;
  // ── Navegação anterior/próximo (opcional) ──────────────────────────────
  // Derivados vizinhos na ordenação atual da tabela (null = extremidade).
  anterior?: ColaboradorDerivado | null;
  proximo?: ColaboradorDerivado | null;
  // Troca o colaborador editado (o pai faz setModal → remount via key).
  onNavegar?: (destino: ColaboradorDerivado) => void;
  // Persiste o payload e navega para o destino (fluxo "Salvar e avançar").
  // Separado de onSalvarFolha (que fecha o modal) — aqui o pai navega.
  onSalvarFolhaEAvancar?: (atualizado: Colaborador, destino: ColaboradorDerivado) => Promise<void>;
  // Desligamento/reativação: grava ativo + data_demissao no doc do período.
  onAlterarStatus?: (ativo: boolean, dataDemissao?: string) => Promise<void>;
}

interface PropsCriar extends PropsBase {
  modo: 'criar';
  onCriar: (novo: Colaborador) => Promise<void>;
}

type Props = PropsEditar | PropsCriar;

const ABAS = ['Folha', 'Alocação'] as const;

const COLABORADOR_VAZIO: Colaborador = {
  nome_colaborador: '', cargo: '', localidade: 'SP',
  funcao_principal: '', alocavel: true, tipo_vinculo: 'clt',
  // Status nasce igual aos colaboradores migrados na Fase 2 (corrige a
  // bifurcação: criados pela UI antes não tinham estes campos).
  ativo: true, funcoes_secundarias: [], cadastro_completo: true,
  percentual_alocavel: 0.7, percentual_institucional: 0.3,
  salario_base: 0, beneficios_fixos: 0,
  vale_alimentacao: 0, vale_transporte: 0, plano_saude: 0, outros_beneficios: 0,
  custo_total_mensal: 0, custo_hora: 0,
  salario_teto_cargo: 0, liquido_acordado: 0, qtd_dependentes: 0,
};

/** Calcula 'YYYY-MM' do mês seguinte para o diálogo de exclusão. */
function proximoPeriodo(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number);
  const d = new Date(a, m, 1);  // mês JS-0; m=12 vira janeiro do ano seguinte
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ColaboradorModal(props: Props) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Folha');
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  // Estado da navegação. `dirty` é reportado pelo FolhaTab; `pendente` guarda
  // o destino aguardando confirmação quando há edições não salvas.
  const [dirty, setDirty] = useState(false);
  const [pendente, setPendente] = useState<ColaboradorDerivado | null>(null);
  // Função registrada pelo FolhaTab que valida + monta o payload (sem persistir).
  const montarRef = useRef<(() => Colaborador | null) | null>(null);

  const ehEditar = props.modo === 'editar';
  const anterior = ehEditar ? props.anterior ?? null : null;
  const proximo = ehEditar ? props.proximo ?? null : null;

  const inicial = props.modo === 'editar' ? props.derivado.colaborador : COLABORADOR_VAZIO;
  const titulo = props.modo === 'criar'
    ? 'Novo colaborador'
    : `Colaborador — ${inicial.nome_colaborador}`;
  const podeAlocacao = props.modo === 'editar' && props.derivado.colaborador.alocavel;

  // Tenta navegar; se o form está sujo, abre o diálogo de confirmação.
  function tentarNavegar(destino: ColaboradorDerivado | null) {
    if (!destino || props.modo !== 'editar') return;
    if (dirty) { setPendente(destino); return; }
    props.onNavegar?.(destino);
  }

  async function salvarEAvancar() {
    if (props.modo !== 'editar' || !pendente) return;
    const destino = pendente;
    const payload = montarRef.current?.();
    setPendente(null);                 // fecha o diálogo (erro de validação fica visível)
    if (!payload) return;              // validação falhou → permanece no atual
    await props.onSalvarFolhaEAvancar?.(payload, destino);
  }

  function descartarEAvancar() {
    if (props.modo !== 'editar' || !pendente) return;
    const destino = pendente;
    setPendente(null);
    props.onNavegar?.(destino);        // remount via key descarta o form
  }

  // Atalhos ←/→ — só quando nenhum input está focado e sem diálogo aberto.
  useEffect(() => {
    if (props.modo !== 'editar') return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (pendente || confirmandoExclusao) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      e.preventDefault();
      tentarNavegar(e.key === 'ArrowLeft' ? anterior : proximo);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.modo, anterior, proximo, pendente, confirmandoExclusao, dirty]);

  async function handleSalvar(atualizado: Colaborador) {
    if (props.modo === 'criar') await props.onCriar(atualizado);
    else await props.onSalvarFolha(atualizado);
  }

  async function handleConfirmarExclusao(removerFuturos: boolean) {
    if (props.modo !== 'editar') return;
    const id = props.derivado.colaborador.id;
    if (!id) return;
    await props.onExcluir(id, removerFuturos);
    props.onFechar();
  }

  // Setas no cabeçalho — só no modo editar e quando há vizinhos definidos.
  const acoesCabecalho = ehEditar && (anterior !== undefined || proximo !== undefined) ? (
    <div className="flex items-center gap-0.5 shrink-0">
      <button type="button" onClick={() => tentarNavegar(anterior)}
        disabled={!anterior || props.salvando} title="Colaborador anterior (←)"
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ color: '#160F41' }}>
        <ChevronLeft size={18} />
      </button>
      <button type="button" onClick={() => tentarNavegar(proximo)}
        disabled={!proximo || props.salvando} title="Próximo colaborador (→)"
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ color: '#160F41' }}>
        <ChevronRight size={18} />
      </button>
    </div>
  ) : undefined;

  return (
    <Modal aberto onFechar={props.onFechar} titulo={titulo} acoesCabecalho={acoesCabecalho}>
      <div className="flex gap-1 mb-4 rounded-lg p-1" style={{ backgroundColor: '#f3f4f6' }}>
        {ABAS.filter(a => a !== 'Alocação' || podeAlocacao).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${aba === a ? 'bg-white shadow-sm' : ''}`}
            style={{ color: aba === a ? '#160F41' : '#6b6b8a' }}>{a}</button>
        ))}
      </div>

      {aba === 'Folha' && (
        <FolhaTab modo={props.modo} inicial={inicial} periodo={props.periodo}
          salvando={props.salvando} onSalvar={handleSalvar} onCancelar={props.onFechar}
          onDirtyChange={setDirty}
          registrarMontarPayload={fn => { montarRef.current = fn; }}
          onAlterarStatus={props.modo === 'editar' ? props.onAlterarStatus : undefined}
          extraFooterLeft={props.modo === 'editar' && isAdmin ? (
            <button onClick={() => setConfirmandoExclusao(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
              style={{ color: '#dc2626', border: '1px solid #fecaca' }}>
              <Trash2 size={12} /> Excluir
            </button>
          ) : undefined} />
      )}

      {aba === 'Alocação' && props.modo === 'editar' && (
        <div className="max-h-[60vh] overflow-y-auto">
          <ColaboradorAlocacao derivado={props.derivado} clientes={props.clientes}
            periodo={props.periodo} onSalvarPct={props.onSalvarPct} salvando={props.salvando} />
        </div>
      )}

      {confirmandoExclusao && props.modo === 'editar' && (
        <ConfirmacaoExclusao
          nome={props.derivado.colaborador.nome_colaborador}
          periodo={props.periodo}
          proximoPeriodo={proximoPeriodo(props.periodo)}
          salvando={props.salvando}
          onConfirmar={handleConfirmarExclusao}
          onFechar={() => setConfirmandoExclusao(false)} />
      )}

      {/* Diálogo de edições não salvas ao navegar */}
      {pendente && props.modo === 'editar' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPendente(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-5">
            <h3 className="text-sm font-semibold mb-1" style={{ color: '#160F41' }}>
              Alterações não salvas
            </h3>
            <p className="text-xs mb-4" style={{ color: '#6b6b8a' }}>
              Você editou a folha de <strong>{inicial.nome_colaborador}</strong> sem salvar.
              O que deseja fazer antes de ir para <strong>{pendente.colaborador.nome_colaborador}</strong>?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={salvarEAvancar} disabled={props.salvando}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
                Salvar e avançar
              </button>
              <button onClick={descartarEAvancar}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid #e2e2e8', color: '#dc2626' }}>
                Descartar e avançar
              </button>
              <button onClick={() => setPendente(null)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
