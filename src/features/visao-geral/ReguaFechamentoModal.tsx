// --- Régua de fechamento de período (Commit B) ---
// Co-localizada com a gestão de período da Visão Geral (Fechar/Reabrir/Copiar).
// Mostra os 6 checks automáticos + 3 checkboxes manuais + botão "Fechar mês".
// O botão ARMA só quando os checks a–e (não-informativos) passam; o check f e
// os checkboxes ficam registrados, mas não travam.

import { useEffect, useMemo, useState } from 'react';
import { Check, X, Info, Loader2, Lock } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../state/AppContext';
import { useAuth } from '../../state/AuthContext';
import {
  buscarClientesBase, buscarCustosDedicados, fecharPeriodo, periodoTemSnapshotClientes,
} from '../../services/firebase';
import {
  rodarReguaFechamento, reguaArmada, type CheckFechamento,
} from '../../utils/reguaFechamento';
import type { Cliente, ChecklistManualFechamento } from '../../types';

const CHECKBOXES: { chave: keyof ChecklistManualFechamento; label: string }[] = [
  { chave: 'alocacoes_revisadas', label: 'Alocações revisadas' },
  { chave: 'poupanca_aum_validado', label: 'Poupança / AUM validado (Agente)' },
  { chave: 'custos_dedicados_conferidos', label: 'Custos dedicados conferidos' },
];

export function ReguaFechamentoModal(
  { onFechar, onFechado }: { onFechar: () => void; onFechado: (msg: string) => void },
) {
  const { periodoSelecionado, dadosPeriodo, periodoFechado, recarregar } = useApp();
  const { usuario } = useAuth();

  // Insumos que exigem leitura (os demais vêm de memória): base master (completa
  // + subconjunto ativo) + presença de custosDedicados próprios do período.
  const [clientesBase, setClientesBase] = useState<Cliente[] | null>(null);
  const [temCustosDedicados, setTemCustosDedicados] = useState<boolean | null>(null);
  // Snapshot já existe? → é IMUTÁVEL: fechar só atualiza o checklist/status.
  const [temSnapshot, setTemSnapshot] = useState<boolean | null>(null);
  const [erroInsumos, setErroInsumos] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistManualFechamento>({
    alocacoes_revisadas: false, poupanca_aum_validado: false, custos_dedicados_conferidos: false,
  });
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [base, dedicados, snap] = await Promise.all([
          buscarClientesBase(),
          buscarCustosDedicados(periodoSelecionado),
          periodoTemSnapshotClientes(periodoSelecionado),
        ]);
        if (cancelado) return;
        setClientesBase(base);
        setTemCustosDedicados(dedicados.length > 0);
        setTemSnapshot(snap);
      } catch (e) {
        if (!cancelado) setErroInsumos(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelado = true; };
  }, [periodoSelecionado]);

  const carregandoInsumos = clientesBase === null || temCustosDedicados === null || temSnapshot === null;

  const checks = useMemo<CheckFechamento[]>(() => {
    if (carregandoInsumos || !dadosPeriodo) return [];
    // "Ativo na base" = já entrou no período (data_entrada <= período, ou sem
    // data_entrada). Comparação por string YYYY-MM é segura. A base COMPLETA vai
    // p/ o check de órfãos (existência), o subconjunto ativo p/ clientes_copiados.
    const ativos = clientesBase!.filter(c => !c.data_entrada || c.data_entrada <= periodoSelecionado);
    return rodarReguaFechamento({
      periodo: periodoSelecionado,
      deltaFolha: dadosPeriodo.deltaFolha ?? null,
      clientesPeriodo: dadosPeriodo.clientes,
      clientesBaseAtivos: ativos,
      clientesBaseTodos: clientesBase!,
      colaboradores: dadosPeriodo.colaboradores,
      vinculos: dadosPeriodo.vinculos,
      temCustosDedicadosProprios: temCustosDedicados!,
    });
  }, [carregandoInsumos, dadosPeriodo, periodoSelecionado, clientesBase, temCustosDedicados]);

  const armada = checks.length > 0 && reguaArmada(checks);
  const podeFechar = armada && !periodoFechado && !fechando;
  // Snapshot existente = imutável: a ação vira "atualizar checklist", nunca re-gravar.
  const soChecklist = temSnapshot === true;

  async function handleFecharMes() {
    if (!podeFechar || !dadosPeriodo) return;
    setFechando(true);
    try {
      await fecharPeriodo(periodoSelecionado, {
        fechado_por: usuario?.email ?? 'desconhecido',
        total_clientes: dadosPeriodo.clientes.length,
        receita_total: dadosPeriodo.totais.receita_bruta,
        checklist_manual: checklist,
      });
      recarregar();
      onFechado('Período fechado com sucesso');
      onFechar();
    } catch (e) {
      setErroInsumos(e instanceof Error ? e.message : String(e));
    } finally {
      setFechando(false);
    }
  }

  return (
    <Modal aberto onFechar={onFechar} titulo="Régua de fechamento" largura="2xl">
      <div className="space-y-5">
        {erroInsumos && (
          <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
            {erroInsumos}
          </div>
        )}

        {/* Checks automáticos */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: '#6b6b8a' }}>
            Verificações automáticas
          </p>
          {carregandoInsumos ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#6b6b8a' }}>
              <Loader2 size={14} className="animate-spin" /> Rodando checks…
            </div>
          ) : (
            <div className="space-y-1.5">
              {checks.map(c => {
                const cor = c.informativo ? '#0065FF' : (c.ok ? '#166534' : '#991b1b');
                const bg = c.informativo ? '#eff6ff' : (c.ok ? '#f0fdf4' : '#fef2f2');
                const Icone = c.informativo ? Info : (c.ok ? Check : X);
                return (
                  <div key={c.id} className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: bg }}>
                    <Icone size={15} style={{ color: cor, marginTop: 1, flexShrink: 0 }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: '#160F41' }}>
                        {c.label}{c.informativo && <span className="ml-1 text-[10px] font-normal" style={{ color: '#6b6b8a' }}>· informativo</span>}
                      </p>
                      <p className="text-xs" style={{ color: '#6b6b8a' }}>{c.detalhe}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Checkboxes manuais */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: '#6b6b8a' }}>
            Conferências manuais (registradas, não travam)
          </p>
          <div className="space-y-1.5">
            {CHECKBOXES.map(({ chave, label }) => (
              <label key={chave} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#160F41' }}>
                <input type="checkbox" checked={checklist[chave]}
                  onChange={e => setChecklist(prev => ({ ...prev, [chave]: e.target.checked }))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Snapshot existente → o congelamento é intocável (Incidente 2026-01) */}
        {soChecklist && (
          <div className="rounded-lg p-3 text-[12px]" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
            <strong>Este período já tem snapshot congelado — ele NÃO será tocado.</strong> Salvar aqui
            atualiza apenas o checklist e o status do fechamento; nenhum dado de cliente é apagado ou
            regravado. Recongelar um período a partir da base atual não é possível por esta tela.
          </div>
        )}

        {/* Ação */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t" style={{ borderColor: '#e2e2e8' }}>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            {periodoFechado
              ? 'Período já está fechado.'
              : armada
                ? (soChecklist
                  ? 'Verificações OK — o snapshot existente permanece como está.'
                  : 'Todas as verificações passaram — pode fechar.')
                : 'Fechar o mês exige todas as verificações automáticas (exceto a informativa) OK.'}
          </p>
          <button onClick={handleFecharMes} disabled={!podeFechar}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            {fechando ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            {fechando ? 'Salvando…' : soChecklist ? 'Atualizar checklist' : 'Fechar mês'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
