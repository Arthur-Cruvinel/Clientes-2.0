// --- Modal de Colaborador (orquestrador) ---
// Modos: 'editar' (derivado existente) e 'criar' (novo). Aba Alocação só em editar.
// Botão excluir disponível para admin no modo editar.

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
  percentual_alocavel: 0.7, percentual_institucional: 0.3,
  salario_base: 0, beneficios_fixos: 0,
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

  const inicial = props.modo === 'editar' ? props.derivado.colaborador : COLABORADOR_VAZIO;
  const titulo = props.modo === 'criar'
    ? 'Novo colaborador'
    : `Colaborador — ${inicial.nome_colaborador}`;
  const podeAlocacao = props.modo === 'editar' && props.derivado.colaborador.alocavel;

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

  return (
    <Modal aberto onFechar={props.onFechar} titulo={titulo}>
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
    </Modal>
  );
}
