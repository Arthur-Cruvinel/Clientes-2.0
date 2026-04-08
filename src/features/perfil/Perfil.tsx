// --- Aba Perfil — visualização e edição de clientes ---

import { useState, useMemo } from 'react';
import { Search, Pencil } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { FUNCOES_ALOCACAO } from '../../utils/constants';
import { usePerfil } from './usePerfil';
import { ClienteCard } from './ClienteCard';
import { EditarClienteModal } from './EditarClienteModal';
import { AlocacaoLote } from './AlocacaoLote';
import type { FuncaoAlocacao } from '../../types';

const LABEL_F: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Consultoria Gestão', consultoria_planejamento: 'Cons. Planejamento',
  consultoria_financeira: 'Cons. Financeira', operacional_financeiro: 'Oper. Financeiro',
  serv_adm: 'Serv. Administrativos', serv_aux_adm: 'Aux. Administrativo',
};
const ABAS = ['Resumo', 'Alocação', 'Configuração', 'Cadastral'] as const;

export function Perfil() {
  const {
    clientes, clienteSelecionado, selecionar, busca, setBusca,
    modalAberto, setModalAberto, colaboradores, parametros, salvarCliente, salvando,
    loading, periodoLabel, bankersUnicos, empresariosUnicos, atualizarCampoEmLote, carregar,
  } = usePerfil();
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Resumo');
  const [visao, setVisao] = useState<'individual' | 'lote'>('individual');
  const c = clienteSelecionado;
  const bankers = useMemo(() =>
    [...new Set(clientes.map(cl => cl.banker).filter((b): b is string => !!b))].sort(),
  [clientes]);

  if (loading) return <div className="p-8 text-center" style={{ color: '#6b6b8a' }}>Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Toggle Individual / Lote */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e2e2e8' }}>
          {([['individual', '👤 Individual'], ['lote', '👥 Alocação em Lote']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setVisao(id)}
              className={`px-4 py-1.5 text-xs font-medium transition-all ${visao === id ? 'bg-gradient-brand text-white' : ''}`}
              style={visao !== id ? { backgroundColor: '#fff', color: '#6b6b8a' } : undefined}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {visao === 'lote' && (
        <div className="bg-white rounded-lg border p-5" style={{ borderColor: '#e2e2e8' }}>
          <AlocacaoLote clientes={clientes} bankersUnicos={bankersUnicos} empresariosUnicos={empresariosUnicos}
            onAplicar={atualizarCampoEmLote} onRecarregar={carregar} />
        </div>
      )}

      {visao === 'individual' && (
    <div className="flex gap-6 h-[calc(100vh-190px)]">
      {/* Painel esquerdo — lista */}
      <div className="w-[280px] flex-shrink-0 rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: '#e2e2e8' }}>
        {periodoLabel && (
          <div className="px-3 pt-2 pb-0">
            <p className="text-[10px]" style={{ color: '#6b6b8a' }}>Dados cadastrais — referência: {periodoLabel}</p>
          </div>
        )}
        <div className="p-3 border-b" style={{ borderColor: '#e2e2e8' }}>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ border: '1px solid #e2e2e8' }}>
            <Search size={14} style={{ color: '#6b6b8a' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente..."
              className="text-sm w-full outline-none bg-transparent" style={{ color: '#160F41' }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: '#e2e2e8' }}>
          {clientes.map(cli => (
            <ClienteCard key={cli.id ?? cli.nome_cliente} cliente={cli}
              selecionado={cli.id === c?.id} onClick={() => selecionar(cli)} />
          ))}
          {clientes.length === 0 && <p className="p-4 text-sm text-center" style={{ color: '#6b6b8a' }}>Nenhum cliente encontrado</p>}
        </div>
      </div>

      {/* Painel direito — detalhe */}
      <div className="flex-1 min-w-0">
        {!c ? (
          <div className="h-full flex items-center justify-center rounded-lg border" style={{ borderColor: '#e2e2e8', color: '#6b6b8a' }}>
            <p className="text-sm">Selecione um cliente na lista</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: '#160F41' }}>{c.nome_cliente}</h3>
              <button onClick={() => setModalAberto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">
                <Pencil size={12} /> Editar
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#f3f4f6' }}>
              {ABAS.map(a => (
                <button key={a} onClick={() => setAba(a)}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${aba === a ? 'bg-white shadow-sm' : ''}`}
                  style={{ color: aba === a ? '#160F41' : '#6b6b8a' }}>{a}</button>
              ))}
            </div>

            {/* Conteúdo */}
            <div className="rounded-lg border p-5" style={{ borderColor: '#e2e2e8' }}>
              {aba === 'Resumo' && <ResumoTab c={c} />}
              {aba === 'Alocação' && <AlocacaoTab c={c} hp={parametros.horas_pacote} />}
              {aba === 'Configuração' && <ConfigTab c={c} />}
              {aba === 'Cadastral' && <CadastralTab c={c} />}
            </div>
          </div>
        )}
      </div>

      {/* Modal edição */}
      {modalAberto && c && (
        <EditarClienteModal cliente={c} colaboradores={colaboradores} bankers={bankers}
          onSalvar={salvarCliente} salvando={salvando} onFechar={() => setModalAberto(false)} />
      )}
    </div>
      )}
    </div>
  );
}

// --- Sub-componentes das abas (somente leitura) ---

function ResumoTab({ c }: { c: import('../../types').DadosCliente }) {
  const kpis = [
    ['Receita Total', formatCurrency(c.receita_bruta)],
    ['Custo Direto', formatCurrency(c.custo_direto)],
    ['Custo Dedicado', formatCurrency(c.custo_dedicado)],
    ['Custo Indireto', formatCurrency(c.custo_indireto_rateado)],
    ['EBITDA', formatCurrency(c.ebitda)],
    ['Margem', formatPercent(c.margem * 100)],
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {kpis.map(([label, valor]) => (
        <div key={label as string} className="rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b6b8a' }}>{label}</p>
          <p className="text-sm font-bold mt-1" style={{ color: '#160F41' }}>{valor}</p>
        </div>
      ))}
    </div>
  );
}

function AlocacaoTab({ c, hp }: { c: import('../../types').DadosCliente; hp: Record<string, Record<string, number>> }) {
  const pacoteHoras = hp[c.pacote_servico] ?? {};
  const TH = 'px-2 py-1.5 text-[10px] font-bold uppercase text-left';
  const TD = 'px-2 py-1.5 text-sm';
  return (
    <table className="min-w-full text-sm">
      <thead style={{ backgroundColor: '#f9f9fb' }}>
        <tr><th className={TH}>Função</th><th className={TH}>Responsável</th><th className={`${TH} text-right`}>H. Dir.</th>
          <th className={`${TH} text-right`}>Fator</th><th className={`${TH} text-right`}>H. Efet.</th></tr>
      </thead>
      <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
        {FUNCOES_ALOCACAO.map(f => {
          const resp = (c as unknown as Record<string, unknown>)[f] as string ?? '—';
          const hDir = pacoteHoras[f] ?? 0;
          const fator = (c as unknown as Record<string, unknown>)[`fator_${f}`] as number ?? 0;
          const hEf = hDir * fator;
          return (
            <tr key={f}>
              <td className={TD}>{LABEL_F[f]}</td><td className={TD}>{resp}</td>
              <td className={`${TD} text-right`}>{hDir}h</td>
              <td className={`${TD} text-right`} style={{ color: fator > 1 ? '#dc2626' : '#16a34a' }}>{fator.toFixed(2)}</td>
              <td className={`${TD} text-right`}>{hEf.toFixed(1)}h</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Par({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b" style={{ borderColor: '#f3f4f6' }}>
      <span className="text-xs" style={{ color: '#6b6b8a' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: '#160F41' }}>{valor}</span>
    </div>
  );
}

function ConfigTab({ c }: { c: import('../../types').DadosCliente }) {
  return (
    <div>
      <Par label="Pacote de serviço" valor={c.pacote_servico} />
      <Par label="Peso jurídico" valor={(c.peso_juridico ?? 1.0).toFixed(1)} />
      <Par label="Volume movimentos/mês" valor={String(c.volume_movimentos_mes ?? 0)} />
      <Par label="Horas reativas/mês" valor={String(c.horas_reativas_mes ?? 0)} />
      <Par label="Utiliza serviço jurídico" valor={c.utiliza_servico_juridico ? 'Sim' : 'Não'} />
      <Par label="Utiliza conciliação" valor={c.utiliza_conciliacao ? 'Sim' : 'Não'} />
      <Par label="Taxa rebate onshore" valor={`${((c.percentual_rebate_anual_onshore ?? 0) * 100).toFixed(2)}% a.a.`} />
      <Par label="Taxa rebate offshore" valor={`${((c.percentual_rebate_anual_offshore ?? 0) * 100).toFixed(2)}% a.a.`} />
      <Par label="Alíquota imp. rebate" valor={`${((c.aliquota_impostos_rebate ?? 0) * 100).toFixed(2)}%`} />
    </div>
  );
}

function CadastralTab({ c }: { c: import('../../types').DadosCliente }) {
  return (
    <div>
      <Par label="Nome completo" valor={c.nome_cliente} />
      <Par label="Empresário" valor={c.empresario ?? '—'} />
      <Par label="Banker Responsável" valor={c.banker ?? '—'} />
      <Par label="Receita fee" valor={formatCurrency(c.receita_fee)} />
      <Par label="AUM Onshore" valor={formatCurrency(c.pl_onshore)} />
      <Par label="AUM Offshore" valor={formatCurrency(c.pl_offshore ?? 0)} />
      <Par label="Custo contabilidade dedicado" valor={formatCurrency(c.custo_contabilidade_dedicado ?? 0)} />
      <Par label="Custo pagamento dedicado" valor={formatCurrency(c.custo_pagamento_dedicado ?? 0)} />
      <Par label="Custo administrativo dedicado" valor={formatCurrency(c.custo_administrativo_dedicado ?? 0)} />
    </div>
  );
}
