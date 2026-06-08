// --- Modal de edição de benefícios em lote ---
// Escreve EXCLUSIVAMENTE no período ativo (recebido por prop e exibido no
// resumo). Semântica crítica: campo VAZIO = não altera (preserva o valor
// atual de cada colaborador); campo PREENCHIDO (inclusive 0) = aplica a todos.
// Por isso o estado é string ('' = não tocar), nunca number com default 0.

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/formatters';
import type { ColaboradorDerivado, BeneficiosPatch, ResultadoLote, SubBeneficio } from './useColaboradores';

interface Props {
  selecionados: ColaboradorDerivado[];
  periodo: string;
  salvando: boolean;
  onAplicar: (patch: BeneficiosPatch) => Promise<ResultadoLote>;
  onFechar: () => void;
}

const LABELS: Record<SubBeneficio, string> = {
  vale_alimentacao: 'Vale Alimentação',
  vale_transporte: 'Vale Transporte',
  plano_saude: 'Plano de Saúde',
  outros_beneficios: 'Outros Benefícios',
};

const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;

export function BeneficiosLoteModal({ selecionados, periodo, salvando, onAplicar, onFechar }: Props) {
  // '' = não alterar. Qualquer valor (inclusive '0') = aplicar.
  const [valores, setValores] = useState<Record<SubBeneficio, string>>({
    vale_alimentacao: '', vale_transporte: '', plano_saude: '', outros_beneficios: '',
  });
  const [etapa, setEtapa] = useState<'form' | 'confirmar' | 'resultado'>('form');
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);

  const set = (k: SubBeneficio, v: string) => setValores(p => ({ ...p, [k]: v }));

  // Patch só com os campos preenchidos. trim() para tratar espaços como vazio.
  const patch: BeneficiosPatch = {};
  (Object.keys(LABELS) as SubBeneficio[]).forEach(k => {
    if (valores[k].trim() !== '') patch[k] = Number(valores[k]);
  });
  const camposTocados = Object.keys(patch) as SubBeneficio[];
  const algumInvalido = (Object.keys(LABELS) as SubBeneficio[])
    .some(k => valores[k].trim() !== '' && Number.isNaN(Number(valores[k])));

  const proLabore = selecionados.filter(d => d.colaborador.tipo_vinculo === 'pro_labore');

  async function aplicar() {
    const r = await onAplicar(patch);
    setResultado(r);
    setEtapa('resultado');
  }

  return (
    <Modal aberto onFechar={onFechar} titulo="Editar benefícios em lote" largura="lg">
      {/* ETAPA FORM */}
      {etapa === 'form' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            {selecionados.length} colaborador(es) selecionado(s) · período <strong>{periodo}</strong>.
            Deixe um campo <strong>vazio</strong> para não alterá-lo (preserva o valor atual de cada um).
            Um valor preenchido — <strong>inclusive 0</strong> — é aplicado a todos.
          </p>

          {proLabore.length > 0 && (
            <div className="flex gap-2 rounded-lg p-3 text-xs" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <strong>Atenção:</strong> a seleção inclui {proLabore.length} pró-labore — benefícios normalmente
                não se aplicam a sócios: {proLabore.map(d => d.colaborador.nome_colaborador).join(', ')}.
                Você decide se segue.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(LABELS) as SubBeneficio[]).map(k => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{LABELS[k]}</label>
                <input type="number" step={0.01} value={valores[k]} placeholder="não alterar"
                  onChange={e => set(k, e.target.value)} className={INP} style={BRD} />
              </div>
            ))}
          </div>

          {algumInvalido && (
            <p className="text-xs px-3 py-2 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              Há valor não numérico em algum campo. Corrija antes de continuar.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
              Cancelar
            </button>
            <button onClick={() => setEtapa('confirmar')} disabled={camposTocados.length === 0 || algumInvalido}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
              Revisar
            </button>
          </div>
        </div>
      )}

      {/* ETAPA CONFIRMAR */}
      {etapa === 'confirmar' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: '#160F41' }}>
            Aplicar a <strong>{selecionados.length}</strong> colaborador(es) no período <strong>{periodo}</strong>:
          </p>
          <ul className="text-sm space-y-1 rounded-lg p-3" style={{ backgroundColor: '#f3f4f6', color: '#160F41' }}>
            {camposTocados.map(k => (
              <li key={k}>{LABELS[k]} → <strong>{formatCurrency(patch[k]!)}</strong></li>
            ))}
          </ul>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            Os demais subcampos não listados permanecem inalterados em cada colaborador.
            beneficios_fixos e o custo mensal são recalculados pelo motor.
          </p>
          {proLabore.length > 0 && (
            <p className="text-xs" style={{ color: '#92400e' }}>
              Inclui {proLabore.length} pró-labore.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={() => setEtapa('form')} disabled={salvando}
              className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
              Voltar
            </button>
            <button onClick={aplicar} disabled={salvando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando && <Loader2 size={14} className="animate-spin" />}
              {salvando ? 'Aplicando…' : `Aplicar a ${selecionados.length}`}
            </button>
          </div>
        </div>
      )}

      {/* ETAPA RESULTADO */}
      {etapa === 'resultado' && resultado && (
        <div className="space-y-4">
          <p className="text-sm font-medium" style={{ color: resultado.erros.length ? '#92400e' : '#166534' }}>
            {resultado.atualizados} atualizado(s)
            {resultado.erros.length > 0 && `, ${resultado.erros.length} falhou(aram)`}.
          </p>
          {resultado.erros.length > 0 && (
            <ul className="text-xs space-y-1 rounded-lg p-3 max-h-48 overflow-y-auto"
              style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              {resultado.erros.map((e, i) => (
                <li key={i}><strong>{e.nome}</strong> — {e.motivo}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
            <button onClick={onFechar}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand">
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
