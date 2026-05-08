// --- Diálogo de confirmação para excluir colaborador ---
// Dois passos: (1) confirma exclusão do período atual, (2) opcional remover futuros.

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';

interface Props {
  nome: string;
  periodo: string;            // 'YYYY-MM'
  proximoPeriodo: string;     // 'YYYY-MM' do mês seguinte
  salvando: boolean;
  onConfirmar: (removerFuturos: boolean) => Promise<void>;
  onFechar: () => void;
}

type Etapa = 'confirma' | 'futuros';

export function ConfirmacaoExclusao({
  nome, periodo, proximoPeriodo, salvando, onConfirmar, onFechar,
}: Props) {
  const [etapa, setEtapa] = useState<Etapa>('confirma');

  async function handlePeriodoAtual() {
    // Apenas avança para a pergunta sobre futuros — exclusão real ocorre lá.
    setEtapa('futuros');
  }

  async function handleSomenteEste() {
    await onConfirmar(false);
    onFechar();
  }

  async function handleIncluirFuturos() {
    await onConfirmar(true);
    onFechar();
  }

  return (
    <Modal aberto onFechar={onFechar} titulo="Excluir colaborador">
      {etapa === 'confirma' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
            <AlertTriangle size={18} style={{ color: '#991b1b', flexShrink: 0, marginTop: 2 }} />
            <div className="text-sm" style={{ color: '#991b1b' }}>
              <p className="font-medium">Excluir <strong>{nome}</strong> do período <strong>{periodo}</strong>?</p>
              <p className="mt-1">Períodos anteriores não serão afetados.</p>
              <p className="mt-1 font-medium">Esta ação não pode ser desfeita.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm"
              style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
            <button onClick={handlePeriodoAtual}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#dc2626' }}>Excluir</button>
          </div>
        </div>
      )}

      {etapa === 'futuros' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: '#160F41' }}>
            Deseja também remover <strong>{nome}</strong> de todos os períodos futuros
            a partir de <strong>{proximoPeriodo}</strong>?
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={handleSomenteEste} disabled={salvando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
              {salvando && <Loader2 size={14} className="animate-spin" />}
              Não, apenas este período
            </button>
            <button onClick={handleIncluirFuturos} disabled={salvando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#dc2626' }}>
              {salvando && <Loader2 size={14} className="animate-spin" />}
              Sim, remover dos futuros
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
