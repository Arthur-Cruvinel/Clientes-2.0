// --- Aba "Alocação" do modal: edita o pct dos clientes atendidos ---
// FONTE ÚNICA: lê/grava fechamentos/{periodo}/vinculos/ (mesma do lote e do
// pipeline). Escala em PERCENTUAL (8 = 8%), idêntica à Alocação em Lote.
// O campo legado cliente.pct_* foi APOSENTADO aqui (era dado morto).

import { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';
import { HORAS_CLT_MES, FUNCOES_ALOCACAO } from '../../utils/constants';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../state/AppContext';
import { salvarVinculosPct } from '../../services/firebase';
import { corBarraOcupacao } from './columns';
import type { Cliente, FuncaoAlocacao } from '../../types';
import type { ColaboradorDerivado, StatusOcupacao } from './useColaboradores';

interface Props {
  derivado: ColaboradorDerivado;
  clientes: Cliente[];
  periodo: string;
}

const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function formatarPeriodoLongo(p?: string): string {
  if (!p) return '—';
  const [a, m] = p.split('-').map(Number);
  return (m >= 1 && m <= 12) ? `${MESES_LONGOS[m - 1]}/${a}` : p;
}

function statusDe(ocupacao: number): StatusOcupacao {
  if (ocupacao > 1.2) return 'sobrecarga';
  if (ocupacao > 1.0) return 'atencao';
  return 'ok';
}

export function ColaboradorAlocacao({ derivado, clientes, periodo }: Props) {
  const { colaborador: c, funcao } = derivado;
  const { dadosPeriodo, recarregar } = useApp();
  const vinculos = dadosPeriodo?.vinculos ?? [];
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Clientes atendidos nesta função: campo legado cli[funcao]===nome (mesma
  // fonte do lote e do useColaboradores). O pct, porém, vem do VÍNCULO.
  const atendidos = useMemo(() => funcao
    ? clientes.filter(cli => (cli[funcao] as string | undefined) === c.nome_colaborador)
    : [], [clientes, funcao, c.nome_colaborador]);

  // pct efetivo de (cliente, função): vínculo com pct>0 vence; senão legado
  // (paridade exata com resolverColaboradorParaFuncao / useAlocacaoEmLote).
  const pctEfetivo = useCallback((cli: Cliente, f: FuncaoAlocacao): number => {
    const v = (c.id_estavel && cli.id_estavel)
      ? vinculos.find(x => x.id_estavel_colaborador === c.id_estavel
          && x.id_estavel_cliente === cli.id_estavel && x.funcao === f)
      : undefined;
    const legado = (cli[`pct_${f}` as keyof Cliente] as number | undefined) ?? 0;
    return (v && v.pct > 0) ? v.pct : legado;
  }, [vinculos, c.id_estavel]);

  // Estado editável (fração interna; exibida ×100). Inicializa do vínculo.
  const [pcts, setPcts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (funcao) for (const cli of atendidos) init[cli.nome_cliente] = pctEfetivo(cli, funcao);
    return init;
  });

  const pa = c.percentual_alocavel ?? 0;
  const pi = c.percentual_institucional ?? 0;

  // Ocupação CONSOLIDADA (todas as 6 funções) — usa o valor EDITADO na função
  // atual e o vínculo nas demais. Espelha ocupacaoConsolidada do lote.
  const ocupConsolidada = useMemo(() => {
    let total = 0;
    for (const f of FUNCOES_ALOCACAO) {
      for (const cli of clientes) {
        if ((cli[f] as string | undefined) !== c.nome_colaborador) continue;
        total += (f === funcao && cli.nome_cliente in pcts)
          ? (pcts[cli.nome_cliente] ?? 0)
          : pctEfetivo(cli, f);
      }
    }
    return total;
  }, [clientes, c.nome_colaborador, funcao, pcts, pctEfetivo]);

  const sobreAlocado = ocupConsolidada > pa + 1e-9;
  const institucionalComVinculo = (pi >= 0.999 || pa <= 1e-9) && ocupConsolidada > 1e-9;

  const handleSalvar = useCallback(async () => {
    if (!funcao || !c.id_estavel) return;
    setSalvando(true);
    try {
      const edicoes = atendidos
        .filter(cli => cli.id_estavel && Math.abs((pcts[cli.nome_cliente] ?? 0) - pctEfetivo(cli, funcao)) > 1e-9)
        .map(cli => ({ cliente: cli, funcao, pct: pcts[cli.nome_cliente] ?? 0 }));
      const n = await salvarVinculosPct({ periodo, colaborador: c, edicoes, vinculosExistentes: vinculos });
      recarregar();
      setToast(`${n} alocação(ões) gravada(s) em ${formatarPeriodoLongo(periodo)}.`);
    } catch (e) {
      setToast(`Erro: ${e instanceof Error ? e.message : 'falha ao salvar'}`);
    } finally {
      setSalvando(false); setConfirmando(false);
      setTimeout(() => setToast(null), 3500);
    }
  }, [funcao, c, atendidos, pcts, pctEfetivo, periodo, vinculos, recarregar]);

  if (!funcao) {
    return <p className="text-sm py-4 italic" style={{ color: '#6b6b8a' }}>
      Função {c.funcao_principal} não mapeada — não é possível alocar clientes.
    </p>;
  }

  const somaPctFuncao = Object.values(pcts).reduce((s, v) => s + v, 0);
  const ocupacaoFuncao = pa > 0 ? somaPctFuncao / pa : 0;
  const alteracoes = atendidos.filter(cli =>
    cli.id_estavel && Math.abs((pcts[cli.nome_cliente] ?? 0) - pctEfetivo(cli, funcao)) > 1e-9).length;

  const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider';
  const TD = 'px-3 py-2 text-xs';

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#6b6b8a' }}>Período: {formatarPeriodoLongo(periodo)} · fonte: vínculos</p>

      {/* Guardas de sobre-alocação (avisam, não bloqueiam). */}
      {institucionalComVinculo && (
        <div className="flex items-start gap-2 rounded-lg p-3 text-xs" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span><strong>100% institucional com alocação a cliente</strong> ({(ocupConsolidada * 100).toFixed(0)}%) = dupla contagem no custo. Este colaborador é institucional (alocável 0%) mas tem vínculos — revise.</span>
        </div>
      )}
      {sobreAlocado && !institucionalComVinculo && (
        <div className="flex items-start gap-2 rounded-lg p-3 text-xs" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span><strong>Sobre-alocado: {(ocupConsolidada * 100).toFixed(0)}% de {(pa * 100).toFixed(0)}% disponíveis</strong> (todas as funções) — o custo direto contará mais que a folha deste colaborador.</span>
        </div>
      )}

      {atendidos.length === 0 ? (
        <p className="text-sm py-4 italic" style={{ color: '#6b6b8a' }}>
          Nenhum cliente alocado em {c.funcao_principal}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
          <table className="min-w-full">
            <thead style={{ backgroundColor: '#f9f9fb' }}>
              <tr>
                <th className={`${TH} text-left`} style={{ color: '#6b6b8a' }}>Cliente</th>
                <th className={`${TH} text-left`} style={{ color: '#6b6b8a' }}>Pacote</th>
                <th className={`${TH} text-right`} style={{ color: '#6b6b8a' }}>% Dedicação</th>
                <th className={`${TH} text-right`} style={{ color: '#6b6b8a' }}>Horas efet.</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
              {atendidos.map(cli => {
                const pct = pcts[cli.nome_cliente] ?? 0;
                const horasEfet = pct * HORAS_CLT_MES * pa;
                const alterado = cli.id_estavel && Math.abs(pct - pctEfetivo(cli, funcao)) > 1e-9;
                return (
                  <tr key={cli.nome_cliente}>
                    <td className={TD} style={{ color: '#160F41' }}>{cli.nome_cliente}</td>
                    <td className={TD} style={{ color: '#6b6b8a' }}>{cli.pacote_servico}</td>
                    <td className={`${TD} text-right`}>
                      <input type="number" step="0.1" min={0} max={100} value={Number((pct * 100).toFixed(1))}
                        onChange={e => setPcts(p => ({ ...p, [cli.nome_cliente]: Number(e.target.value) / 100 }))}
                        className="w-20 rounded px-2 py-1 text-xs text-right"
                        style={{ border: '1px solid #e2e2e8', color: '#160F41', backgroundColor: alterado ? '#fef3c7' : '#fff' }} />
                    </td>
                    <td className={`${TD} text-right`} style={{ color: '#6b6b8a' }}>{horasEfet.toFixed(1)}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
        <div className="flex items-center justify-between mb-2 text-xs">
          <span style={{ color: '#6b6b8a' }}>Capacidade alocável: {formatPercent(pa * 100)}</span>
          <span style={{ color: '#160F41' }}>Ocupação ({funcao}): {(somaPctFuncao * 100).toFixed(1)}% · consolidada: {(ocupConsolidada * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#fff' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(ocupacaoFuncao * 100, 200)}%`, backgroundColor: corBarraOcupacao(statusDe(ocupacaoFuncao)) }} />
        </div>
      </div>

      {toast && (
        <div className="text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: toast.startsWith('Erro') ? '#fee2e2' : '#dcfce7', color: toast.startsWith('Erro') ? '#991b1b' : '#166534' }}>
          {toast}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={() => setConfirmando(true)} disabled={salvando || alteracoes === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
          {salvando && <Loader2 size={14} className="animate-spin" />}
          {salvando ? 'Salvando...' : 'Salvar Alocação'}
        </button>
      </div>

      {/* Confirmação nomeando o período (padrão do projeto). */}
      {confirmando && (
        <Modal aberto onFechar={() => setConfirmando(false)} titulo="Confirmar gravação da alocação" largura="md">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#160F41' }}>
              Gravar a alocação de <strong>{c.nome_colaborador}</strong> em <strong>{formatarPeriodoLongo(periodo)}</strong>?
            </p>
            <p className="text-xs" style={{ color: '#6b6b8a' }}>
              {alteracoes} alteração{alteracoes === 1 ? '' : 'ões'} em fechamentos/{periodo}/vinculos.
            </p>
            <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
              <button onClick={() => setConfirmando(false)} disabled={salvando}
                className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
                {salvando && <Loader2 size={14} className="animate-spin" />} Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
