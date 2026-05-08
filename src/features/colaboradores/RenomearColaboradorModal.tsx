// --- Modal "Renomear colaborador" ---
// Aparece automaticamente após Salvar Folha quando o nome foi alterado.
// State-machine: confirmando → renomeando → concluido | erro.
// Ao concluir com sucesso, dispara recarregar() do AppContext para que a
// listagem reflita os clientes atualizados.

import { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../state/AppContext';
import { renomearColaborador } from '../../services/firebase';

interface Props {
  nomeAntigo: string;
  nomeNovo: string;
  onFechar: () => void;
}

type Estado = 'confirmando' | 'renomeando' | 'concluido' | 'erro';
interface Resultado { clientesAtualizados: number; periodosAtualizados: number; erros: string[]; }

export function RenomearColaboradorModal({ nomeAntigo, nomeNovo, onFechar }: Props) {
  const { recarregar } = useApp();
  const [estado, setEstado] = useState<Estado>('confirmando');
  const [progresso, setProgresso] = useState({ etapa: '', atual: 0, total: 0 });
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function aplicar() {
    setEstado('renomeando');
    try {
      const r = await renomearColaborador(
        nomeAntigo, nomeNovo,
        (etapa, atual, total) => setProgresso({ etapa, atual, total }),
      );
      setResultado(r);
      setEstado(r.erros.length > 0 ? 'erro' : 'concluido');
      if (r.clientesAtualizados > 0) recarregar();
    } catch (e) {
      setResultado({ clientesAtualizados: 0, periodosAtualizados: 0,
        erros: [e instanceof Error ? e.message : 'Erro desconhecido'] });
      setEstado('erro');
    }
  }

  // Bloqueia fechar durante renomeando — operação não pode ser interrompida.
  const handleFechar = estado === 'renomeando' ? () => {} : onFechar;
  const titulo = estado === 'renomeando' ? 'Renomeando…'
    : estado === 'concluido' || estado === 'erro' ? 'Resultado da renomeação'
    : 'Renomear colaborador?';

  return (
    <Modal aberto onFechar={handleFechar} titulo={titulo}>
      {estado === 'confirmando' && (
        <div className="space-y-3">
          <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
            <Linha label="De" valor={nomeAntigo} />
            <Linha label="Para" valor={nomeNovo} />
          </div>
          <p className="text-sm" style={{ color: '#160F41' }}>
            Todos os clientes que têm <strong>"{nomeAntigo}"</strong> em qualquer função serão atualizados automaticamente em <strong>todos os períodos</strong>.
          </p>
          <p className="text-xs italic" style={{ color: '#6b6b8a' }}>
            Cobre <code>fechamentos/&#123;periodo&#125;/clientes/</code> + <code>clientes_base/</code>.
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
            <button onClick={aplicar} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">Renomear</button>
          </div>
        </div>
      )}

      {estado === 'renomeando' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: '#160F41' }} />
            <p className="text-sm" style={{ color: '#160F41' }}>
              {progresso.etapa || 'Iniciando…'} {progresso.total > 0 && <>({progresso.atual}/{progresso.total})</>}
            </p>
          </div>
          <div className="rounded-full overflow-hidden h-2" style={{ backgroundColor: '#f3f4f6' }}>
            <div className="h-full bg-gradient-brand transition-all"
              style={{ width: progresso.total ? `${(progresso.atual / progresso.total) * 100}%` : '0%' }} />
          </div>
        </div>
      )}

      {(estado === 'concluido' || estado === 'erro') && resultado && (
        <div className="space-y-3">
          {resultado.clientesAtualizados > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                <strong>{resultado.clientesAtualizados}</strong> cliente{resultado.clientesAtualizados === 1 ? '' : 's'} atualizado{resultado.clientesAtualizados === 1 ? '' : 's'}
                {resultado.periodosAtualizados > 0 && (
                  <> em <strong>{resultado.periodosAtualizados}</strong> período{resultado.periodosAtualizados === 1 ? '' : 's'}</>
                )}.
              </p>
            </div>
          )}
          {resultado.erros.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm">Falha em {resultado.erros.length} batch{resultado.erros.length === 1 ? '' : 'es'}:</p>
                <ul className="text-xs list-disc list-inside max-h-40 overflow-y-auto">
                  {resultado.erros.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                  {resultado.erros.length > 20 && <li className="italic">… e mais {resultado.erros.length - 20} erro(s).</li>}
                </ul>
              </div>
            </div>
          )}
          {resultado.clientesAtualizados === 0 && resultado.erros.length === 0 && (
            <p className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>
              Nenhum cliente referenciava "{nomeAntigo}" — apenas o nome do colaborador foi atualizado.
            </p>
          )}
          <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">Fechar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <span style={{ color: '#6b6b8a' }}>{label}</span>
      <span className="font-medium text-right" style={{ color: '#160F41' }}>{valor}</span>
    </div>
  );
}
