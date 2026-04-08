// --- Modal de edição de cliente com abas ---

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import type { DadosCliente, Cliente, Colaborador, PacoteServico, FuncaoAlocacao } from '../../types';

interface Props {
  cliente: DadosCliente;
  colaboradores: Colaborador[];
  bankers: string[];
  onSalvar: (dados: Partial<Cliente>) => Promise<void>;
  salvando: boolean;
  onFechar: () => void;
}

const LABEL_F: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Financeira', operacional_financeiro: 'Operacional',
  serv_adm: 'Adm.', serv_aux_adm: 'Aux. Adm.',
};
const PACOTES: PacoteServico[] = ['full', 'advanced', 'light', 'future', 'asset_only'];
const ABAS = ['Alocação', 'Configuração', 'Cadastral'] as const;

export function EditarClienteModal({ cliente, colaboradores, bankers, onSalvar, salvando, onFechar }: Props) {
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Alocação');
  const [form, setForm] = useState(() => ({
    pacote_servico: cliente.pacote_servico,
    consultoria_gestao: cliente.consultoria_gestao ?? '',
    consultoria_planejamento: cliente.consultoria_planejamento ?? '',
    consultoria_financeira: cliente.consultoria_financeira ?? '',
    operacional_financeiro: cliente.operacional_financeiro ?? '',
    serv_adm: cliente.serv_adm ?? '',
    serv_aux_adm: cliente.serv_aux_adm ?? '',
    fator_consultoria_gestao: cliente.fator_consultoria_gestao,
    fator_consultoria_planejamento: cliente.fator_consultoria_planejamento,
    fator_consultoria_financeira: cliente.fator_consultoria_financeira,
    fator_operacional_financeiro: cliente.fator_operacional_financeiro,
    fator_serv_adm: cliente.fator_serv_adm,
    fator_serv_aux_adm: cliente.fator_serv_aux_adm,
    peso_juridico: cliente.peso_juridico ?? 1.0,
    volume_movimentos_mes: cliente.volume_movimentos_mes ?? 0,
    horas_reativas_mes: cliente.horas_reativas_mes ?? 0,
    utiliza_servico_juridico: cliente.utiliza_servico_juridico,
    utiliza_conciliacao: cliente.utiliza_conciliacao,
    percentual_rebate_anual_onshore: (cliente.percentual_rebate_anual_onshore ?? 0) * 100,
    percentual_rebate_anual_offshore: (cliente.percentual_rebate_anual_offshore ?? 0) * 100,
    aliquota_impostos_rebate: (cliente.aliquota_impostos_rebate ?? 0) * 100,
    empresario: cliente.empresario ?? '',
    banker: cliente.banker ?? '',
    receita_fee: cliente.receita_fee,
    pl_onshore: cliente.pl_onshore,
    pl_offshore: cliente.pl_offshore ?? 0,
    custo_contabilidade_dedicado: cliente.custo_contabilidade_dedicado ?? 0,
    custo_pagamento_dedicado: cliente.custo_pagamento_dedicado ?? 0,
    custo_administrativo_dedicado: cliente.custo_administrativo_dedicado ?? 0,
  }));

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const nomes = colaboradores.map(c => c.nome_colaborador).sort();
  const INP = 'rounded px-2 py-1.5 text-sm w-full';
  const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };

  function handleSalvar() {
    onSalvar({
      pacote_servico: form.pacote_servico,
      consultoria_gestao: form.consultoria_gestao || undefined,
      consultoria_planejamento: form.consultoria_planejamento || undefined,
      consultoria_financeira: form.consultoria_financeira || undefined,
      operacional_financeiro: form.operacional_financeiro || undefined,
      serv_adm: form.serv_adm || undefined,
      serv_aux_adm: form.serv_aux_adm || undefined,
      fator_consultoria_gestao: form.fator_consultoria_gestao,
      fator_consultoria_planejamento: form.fator_consultoria_planejamento,
      fator_consultoria_financeira: form.fator_consultoria_financeira,
      fator_operacional_financeiro: form.fator_operacional_financeiro,
      fator_serv_adm: form.fator_serv_adm,
      fator_serv_aux_adm: form.fator_serv_aux_adm,
      peso_juridico: form.peso_juridico,
      volume_movimentos_mes: form.volume_movimentos_mes,
      horas_reativas_mes: form.horas_reativas_mes,
      utiliza_servico_juridico: form.utiliza_servico_juridico,
      utiliza_conciliacao: form.utiliza_conciliacao,
      percentual_rebate_anual_onshore: form.percentual_rebate_anual_onshore / 100,
      percentual_rebate_anual_offshore: form.percentual_rebate_anual_offshore / 100,
      aliquota_impostos_rebate: form.aliquota_impostos_rebate / 100,
      empresario: form.empresario || undefined,
      banker: form.banker || undefined,
      receita_fee: form.receita_fee,
      pl_onshore: form.pl_onshore,
      pl_offshore: form.pl_offshore,
      custo_contabilidade_dedicado: form.custo_contabilidade_dedicado,
      custo_pagamento_dedicado: form.custo_pagamento_dedicado,
      custo_administrativo_dedicado: form.custo_administrativo_dedicado,
    });
  }

  return (
    <Modal aberto onFechar={onFechar} titulo={`Editar — ${cliente.nome_cliente}`}>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 rounded-lg p-1" style={{ backgroundColor: '#f3f4f6' }}>
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${aba === a ? 'bg-white shadow-sm' : ''}`}
            style={{ color: aba === a ? '#160F41' : '#6b6b8a' }}>{a}</button>
        ))}
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto">
        {aba === 'Alocação' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Pacote</label>
              <select value={form.pacote_servico} onChange={e => set('pacote_servico', e.target.value)}
                className={INP} style={BRD}>
                {PACOTES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {FUNCOES_ALOCACAO.map(f => (
              <div key={f} className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>{LABEL_F[f]}</label>
                  <select value={(form as Record<string, unknown>)[f] as string ?? ''} onChange={e => set(f, e.target.value)}
                    className={`${INP} text-xs`} style={BRD}>
                    <option value="">—</option>
                    {nomes.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium" style={{ color: '#6b6b8a' }}>Fator</label>
                  <input type="number" step="0.01" min={0} max={2}
                    value={(form as Record<string, unknown>)[`fator_${f}`] as number}
                    onChange={e => set(`fator_${f}`, Number(e.target.value))}
                    className={INP} style={BRD} />
                </div>
              </div>
            ))}
          </>
        )}

        {aba === 'Configuração' && (
          <>
            {[
              ['peso_juridico', 'Peso jurídico', 0.1],
              ['volume_movimentos_mes', 'Volume movimentos/mês', 1],
              ['horas_reativas_mes', 'Horas reativas/mês', 1],
            ].map(([k, label, step]) => (
              <div key={k as string} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label as string}</label>
                <input type="number" step={step as number} value={(form as Record<string, unknown>)[k as string] as number}
                  onChange={e => set(k as string, Number(e.target.value))} className={`${INP} w-40`} style={BRD} />
              </div>
            ))}
            {['utiliza_servico_juridico', 'utiliza_conciliacao'].map(k => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#160F41' }}>
                <input type="checkbox" checked={(form as Record<string, unknown>)[k] as boolean}
                  onChange={e => set(k, e.target.checked)} className="rounded" />
                {k === 'utiliza_servico_juridico' ? 'Utiliza serviço jurídico' : 'Utiliza conciliação'}
              </label>
            ))}
            {[
              ['percentual_rebate_anual_onshore', 'Taxa rebate onshore (%)'],
              ['percentual_rebate_anual_offshore', 'Taxa rebate offshore (%)'],
              ['aliquota_impostos_rebate', 'Alíquota imp. rebate (%)'],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label}</label>
                <input type="number" step="0.01" value={(form as Record<string, unknown>)[k] as number}
                  onChange={e => set(k, Number(e.target.value))} className={`${INP} w-40`} style={BRD} />
              </div>
            ))}
          </>
        )}

        {aba === 'Cadastral' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Empresário</label>
              <input value={form.empresario} onChange={e => set('empresario', e.target.value)}
                className={INP} style={BRD} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>Banker Responsável</label>
              <input value={form.banker} onChange={e => set('banker', e.target.value)}
                list="bankers-datalist" placeholder="Nome do banker..."
                className={INP} style={BRD} />
              <datalist id="bankers-datalist">
                {bankers.map(b => <option key={b} value={b} />)}
              </datalist>
              {!form.banker && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs mt-1"
                  style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                  <AlertTriangle size={11} /> Sem banker
                </span>
              )}
            </div>
            {[
              ['receita_fee', 'Receita fee'],
              ['pl_onshore', 'AUM Onshore'],
              ['pl_offshore', 'AUM Offshore'],
              ['custo_contabilidade_dedicado', 'Custo contabilidade'],
              ['custo_pagamento_dedicado', 'Custo pagamento'],
              ['custo_administrativo_dedicado', 'Custo administrativo'],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label}</label>
                <input type="number" step="0.01" value={(form as Record<string, unknown>)[k] as number}
                  onChange={e => set(k, Number(e.target.value))} className={INP} style={BRD} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Rodapé */}
      <div className="flex gap-3 justify-end mt-4 pt-4 border-t" style={{ borderColor: '#e2e2e8' }}>
        <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm"
          style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
        <button onClick={handleSalvar} disabled={salvando}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}
