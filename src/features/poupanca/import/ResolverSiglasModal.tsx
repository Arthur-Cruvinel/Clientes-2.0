// --- Modal "Resolver siglas não reconhecidas" ---
// Aparece quando o parser de lâmina offshore encontra códigos que não estão
// em MAPEAMENTO_SIGLAS (hardcoded) nem em mapeamento_siglas/ (Firestore).
// Usuário cadastra cada sigla e o upload retoma após persistência.

import { useMemo, useState } from 'react';
import { Loader2, AlertTriangle, X, Check } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useAuth } from '../../../state/AuthContext';
import type { SiglaNaoMapeada } from './parsers/parseComClaude';

interface Props {
  siglas: SiglaNaoMapeada[];
  /** Lista de nomes de clientes existentes — facilita reuso (datalist). */
  nomesClientesExistentes: string[];
  onCancelar: () => void;
  onConfirmar: (resolucoes: Array<{ codigo: string; sigla: string; nome_cliente: string; registrado_por?: string }>) => Promise<void>;
}

interface LinhaResolucao {
  codigo: string;
  nome_bruto: string;
  nome_cliente: string;  // editável
  sigla: string;         // editável (sugerido das iniciais)
}

/** Sugere uma sigla curta a partir do nome (3 primeiras iniciais de palavras
 *  com 3+ chars, em maiúsculas). Mesmo comportamento de `getSiglaCliente`. */
function sugerirSigla(nome: string): string {
  return nome.split(/\s+/).filter(p => p.length > 2).slice(0, 3)
    .map(p => p[0]).join('').toUpperCase();
}

const INP = 'rounded px-2 py-1.5 text-xs w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;

export function ResolverSiglasModal({ siglas, nomesClientesExistentes, onCancelar, onConfirmar }: Props) {
  const { usuario } = useAuth();
  const [linhas, setLinhas] = useState<LinhaResolucao[]>(() =>
    siglas.map(s => ({
      codigo: s.codigo,
      nome_bruto: s.nome_bruto,
      nome_cliente: s.nome_bruto.toUpperCase(),
      sigla: sugerirSigla(s.nome_bruto),
    }))
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const datalistId = useMemo(() => `clientes-existentes-${Math.random().toString(36).slice(2, 8)}`, []);

  function set(idx: number, campo: 'nome_cliente' | 'sigla', valor: string) {
    setLinhas(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const nova = { ...l, [campo]: valor };
      // Auto-atualiza sigla quando o usuário muda o nome (não sobrescreve
      // se ele já tiver editado a sigla manualmente — heurística: sigla
      // contém só letras maiúsculas e tem ≤4 chars E é igual à sugestão
      // anterior do nome velho).
      if (campo === 'nome_cliente' && l.sigla === sugerirSigla(l.nome_cliente)) {
        nova.sigla = sugerirSigla(valor);
      }
      return nova;
    }));
  }

  async function confirmar() {
    setErro(null);
    // Validações: tudo preenchido + sigla unique no batch.
    for (const l of linhas) {
      if (!l.nome_cliente.trim()) return setErro(`Nome obrigatório para o código "${l.codigo}".`);
      if (!l.sigla.trim()) return setErro(`Sigla obrigatória para o código "${l.codigo}".`);
    }
    const siglasNoBatch = new Set<string>();
    for (const l of linhas) {
      const s = l.sigla.trim().toUpperCase();
      if (siglasNoBatch.has(s)) return setErro(`Sigla "${s}" duplicada — códigos diferentes precisam de siglas distintas.`);
      siglasNoBatch.add(s);
    }
    setSalvando(true);
    try {
      await onConfirmar(linhas.map(l => ({
        codigo: l.codigo,
        sigla: l.sigla.trim().toUpperCase(),
        nome_cliente: l.nome_cliente.trim(),
        registrado_por: usuario?.nome ?? usuario?.email,
      })));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar mapeamento.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto onFechar={salvando ? () => {} : onCancelar} titulo={`Siglas não reconhecidas (${siglas.length})`}>
      <div className="space-y-3">
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <p className="text-xs">
            Informe o nome do cliente para cada sigla encontrada antes de continuar. Os mapeamentos são salvos em <code>mapeamento_siglas/</code> e usados em uploads futuros.
          </p>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {linhas.map((l, idx) => (
            <div key={l.codigo} className="rounded-lg border p-3 space-y-2"
              style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span style={{ color: '#6b6b8a' }}>Código/conta:</span> <strong style={{ color: '#160F41' }}>{l.codigo}</strong></div>
                <div><span style={{ color: '#6b6b8a' }}>Nome no PDF:</span> <strong style={{ color: '#160F41' }}>{l.nome_bruto}</strong></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>Nome do cliente</label>
                  <input type="text" list={datalistId} value={l.nome_cliente}
                    onChange={e => set(idx, 'nome_cliente', e.target.value)}
                    className={INP} style={BRD} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>Sigla interna</label>
                  <input type="text" value={l.sigla} maxLength={6}
                    onChange={e => set(idx, 'sigla', e.target.value.toUpperCase())}
                    className={`${INP} font-mono uppercase`} style={BRD} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <datalist id={datalistId}>
          {nomesClientesExistentes.map(n => <option key={n} value={n} />)}
        </datalist>

        {erro && (
          <p className="text-xs px-3 py-2 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>{erro}</p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
          <button onClick={onCancelar} disabled={salvando}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
            <X size={14} /> Cancelar upload
          </button>
          <button onClick={confirmar} disabled={salvando}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirmar e continuar
          </button>
        </div>
      </div>
    </Modal>
  );
}
