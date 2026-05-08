// --- Modal de cópia de período (4 estados internos) ---
// Drive: o caller passa `onConfirmar` que executa a cópia recebendo onProgress;
// o modal mantém estado local p/ progresso, resumo e erro.

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { Modal } from './Modal';

export type ResumoCopia = {
  colaboradores: number;
  custosIndiretos: number;
  clientes: number;
};

interface Props {
  aberto: boolean;
  periodoOrigem: string;
  periodoDestino: string;
  modo: 'automatico' | 'manual';
  onConfirmar: (
    onProgress: (etapa: string, pct: number) => void,
  ) => Promise<ResumoCopia>;
  onCancelar: () => void;
}

type Estado = 'confirmando' | 'copiando' | 'concluido' | 'erro';

export function ModalCopiarPeriodo({
  aberto, periodoOrigem, periodoDestino, modo, onConfirmar, onCancelar,
}: Props) {
  const [estado, setEstado] = useState<Estado>('confirmando');
  const [progresso, setProgresso] = useState({ etapa: '', pct: 0 });
  const [resumo, setResumo] = useState<ResumoCopia | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  function reset() {
    setEstado('confirmando');
    setProgresso({ etapa: '', pct: 0 });
    setResumo(null);
    setErro(null);
  }

  function fechar() {
    reset();
    onCancelar();
  }

  async function executar() {
    setEstado('copiando');
    setProgresso({ etapa: 'Iniciando...', pct: 0 });
    try {
      const r = await onConfirmar((etapa, pct) => setProgresso({ etapa, pct }));
      setResumo(r);
      setEstado('concluido');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido');
      setEstado('erro');
    }
  }

  const titulo = modo === 'automatico'
    ? 'Período vazio detectado'
    : 'Copiar período';

  return (
    <Modal aberto onFechar={estado === 'copiando' ? () => undefined : fechar} titulo={titulo}>
      {estado === 'confirmando' && (
        <div className="space-y-4">
          {modo === 'automatico' && (
            <p className="text-sm" style={{ color: '#6b6b8a' }}>
              O período <strong>{periodoDestino}</strong> ainda não possui dados.
            </p>
          )}
          <p className="text-sm" style={{ color: '#160F41' }}>
            Deseja copiar a base de <strong>{periodoOrigem}</strong> para <strong>{periodoDestino}</strong>?
          </p>
          <ul className="text-sm space-y-1" style={{ color: '#160F41' }}>
            <li>✓ Colaboradores</li>
            <li>✓ Custos Indiretos</li>
            <li>✓ Clientes</li>
          </ul>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={fechar} className="px-4 py-2 rounded-lg text-sm"
              style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
            <button onClick={executar}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">
              <Copy size={14} /> Copiar
            </button>
          </div>
        </div>
      )}

      {estado === 'copiando' && (
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#160F41' }}>
            <Loader2 size={16} className="animate-spin" /> {progresso.etapa || 'Processando...'}
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progresso.pct}%`, backgroundColor: '#0065FF' }} />
          </div>
          <p className="text-xs text-center" style={{ color: '#6b6b8a' }}>{progresso.pct}%</p>
        </div>
      )}

      {estado === 'concluido' && resumo && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#dcfce7' }}>
            <CheckCircle2 size={18} style={{ color: '#166534', flexShrink: 0, marginTop: 2 }} />
            <div className="text-sm" style={{ color: '#166534' }}>
              <p className="font-medium">Período {periodoDestino} criado com sucesso</p>
              <p className="mt-1">
                {resumo.colaboradores} colaboradores · {resumo.custosIndiretos} custos indiretos
                · {resumo.clientes} clientes copiados
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={fechar}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">
              Fechar
            </button>
          </div>
        </div>
      )}

      {estado === 'erro' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
            <XCircle size={18} style={{ color: '#991b1b', flexShrink: 0, marginTop: 2 }} />
            <div className="text-sm" style={{ color: '#991b1b' }}>
              <p className="font-medium">Erro ao copiar</p>
              <p className="mt-1">{erro}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={fechar} className="px-4 py-2 rounded-lg text-sm"
              style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Fechar</button>
            <button onClick={executar}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">
              Tentar novamente
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
