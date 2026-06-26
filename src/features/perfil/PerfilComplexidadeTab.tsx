// --- Aba "Complexidade" do modal de cliente ---
// Edita o perfil de complexidade (drivers fixos + volumetria mensal) e
// exibe horas reais estimadas vs horas normativas do pacote por função.
// Split de armazenamento — ver salvarPerfilComplexidade em firebase.ts.

import { useMemo, useState } from 'react';
// Estado de complexidade (perfil/recebíveis/contratações) é ELEVADO ao modal
// (EditarClienteModal) e recebido por props — assim sobrevive à troca de abas,
// que desmonta este componente. Antes vivia em useState local e era perdido.
import { Loader2, AlertTriangle } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { salvarPerfilComplexidade } from '../../services/firebase';
import { calcularHorasReais } from '../../utils/financials';
import { FUNCOES_ALOCACAO, HORAS_PACOTE } from '../../utils/constants';
import { Secao, Campo, Check } from './perfilComplexidadeUI';
import type { Cliente, FuncaoAlocacao, PerfilComplexidade } from '../../types';

const LABEL_F: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Financeira', operacional_financeiro: 'Operacional',
  serv_adm: 'Adm.', serv_aux_adm: 'Aux. Adm.',
};

export const PERFIL_DEFAULT: PerfilComplexidade = {
  grupos_financeiros: 1,
  qtd_veiculos: 0, qtd_imoveis: 0, qtd_funcionarios_domesticos: 0,
  planejamento_tributario: false, revisao_contratos: false, gestao_obra: false,
};

interface Props {
  cliente: Cliente;
  // volumetria mensal vem do form do modal (sincronizada com a aba Configuração).
  volumeMovimentosMes: number;
  setVolumeMovimentosMes: (v: number) => void;
  // Estado controlado pelo modal (persiste entre trocas de aba).
  perfil: PerfilComplexidade;
  setPerfil: (p: PerfilComplexidade) => void;
  qtdRecebiveis: number;
  setQtdRecebiveis: (v: number) => void;
  qtdContratacoes: number;
  setQtdContratacoes: (v: number) => void;
}

export function PerfilComplexidadeTab({
  cliente, volumeMovimentosMes, setVolumeMovimentosMes,
  perfil, setPerfil, qtdRecebiveis, setQtdRecebiveis, qtdContratacoes, setQtdContratacoes,
}: Props) {
  const { periodoSelecionado, recarregar } = useApp();
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const clienteAtual: Cliente = useMemo(() => ({
    ...cliente,
    volume_movimentos_mes: volumeMovimentosMes,
    qtd_recebiveis_mes: qtdRecebiveis,
    qtd_contratacoes_mes: qtdContratacoes,
  }), [cliente, volumeMovimentosMes, qtdRecebiveis, qtdContratacoes]);

  const horas = useMemo(() => calcularHorasReais(clienteAtual, perfil), [clienteAtual, perfil]);

  const setP = <K extends keyof PerfilComplexidade>(k: K, v: PerfilComplexidade[K]) =>
    setPerfil({ ...perfil, [k]: v });

  async function handleSalvar() {
    if (!periodoSelecionado) return;
    setSalvando(true);
    try {
      await salvarPerfilComplexidade(cliente.nome_cliente, perfil, periodoSelecionado, {
        volume_movimentos_mes: volumeMovimentosMes,
        qtd_recebiveis_mes: qtdRecebiveis,
        qtd_contratacoes_mes: qtdContratacoes,
      }, cliente.id);
      setToast('Perfil de complexidade salvo.');
      setTimeout(() => setToast(null), 3500);
      recarregar();
    } finally { setSalvando(false); }
  }

  const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
  const TD = 'px-3 py-2 text-xs';
  const semJuridico = !cliente.utiliza_servico_juridico;

  return (
    <div className="space-y-4">
      <Secao titulo="Volumetria Financeira (mês)">
        <Campo label="Volume movimentos / mês" value={volumeMovimentosMes} onChange={setVolumeMovimentosMes} step={1} />
        <Campo label="Grupos financeiros" value={perfil.grupos_financeiros} onChange={v => setP('grupos_financeiros', v)} step={1} />
        <Campo label="Recebíveis no mês" value={qtdRecebiveis} onChange={setQtdRecebiveis} step={1} />
        <Campo label="Contratações de serviço / mês" value={qtdContratacoes} onChange={setQtdContratacoes} step={1} />
      </Secao>
      <Secao titulo="Patrimônio">
        <Campo label="Veículos" value={perfil.qtd_veiculos} onChange={v => setP('qtd_veiculos', v)} step={1} />
        <Campo label="Imóveis" value={perfil.qtd_imoveis} onChange={v => setP('qtd_imoveis', v)} step={1} />
        <Campo label="Funcionários domésticos" value={perfil.qtd_funcionarios_domesticos} onChange={v => setP('qtd_funcionarios_domesticos', v)} step={1} />
      </Secao>
      <Secao titulo="Serviços Contratados">
        <Check label="Planejamento tributário" checked={perfil.planejamento_tributario} onChange={v => setP('planejamento_tributario', v)} />
        <Check label="Revisão de contratos" checked={perfil.revisao_contratos} onChange={v => setP('revisao_contratos', v)}
          badge={perfil.revisao_contratos && semJuridico ? 'Sem pacote jurídico' : undefined} />
        <Check label="Gestão de obra" checked={perfil.gestao_obra} onChange={v => setP('gestao_obra', v)}
          badge={perfil.gestao_obra && (cliente.receita_fee ?? 0) === 0 ? 'Sem cobrança' : undefined} />
      </Secao>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
        <table className="min-w-full">
          <thead style={{ backgroundColor: '#f9f9fb', color: '#6b6b8a' }}>
            <tr>
              <th className={`${TH} text-left`}>Função</th>
              <th className={`${TH} text-right`}>H. reais</th>
              <th className={`${TH} text-right`}>H. pacote</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {FUNCOES_ALOCACAO.map(f => {
              const reais = horas.por_funcao[f] ?? 0;
              const pacote = HORAS_PACOTE[cliente.pacote_servico]?.[f] ?? 0;
              return (
                <tr key={f}>
                  <td className={TD} style={{ color: '#160F41' }}>{LABEL_F[f]}</td>
                  <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{reais.toFixed(1)}h</td>
                  <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{pacote.toFixed(1)}h</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <td className={`${TD} font-bold`} style={{ color: '#160F41' }}>TOTAL</td>
              <td className={`${TD} text-right font-bold`} style={{ color: '#160F41' }}>{horas.total.toFixed(1)}h</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {horas.alertas.map((a, i) => (
        <p key={i} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded"
          style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
          <AlertTriangle size={11} /> {a}
        </p>
      ))}
      {toast && <p className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700">{toast}</p>}

      <div className="flex justify-end pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
        <button onClick={handleSalvar} disabled={salvando}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
          {salvando && <Loader2 size={14} className="animate-spin" />}
          {salvando ? 'Salvando...' : 'Salvar Complexidade'}
        </button>
      </div>
    </div>
  );
}
