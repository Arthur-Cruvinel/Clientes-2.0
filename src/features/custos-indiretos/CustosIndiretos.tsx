// --- Aba Custos Indiretos (dentro de Configurações) ---
// Edita o valor_mensal das 5 categorias canônicas no PERÍODO ATIVO. Não cria
// nem exclui categorias ("zerar" = valor 0). Aviso permanente do risco do Excel.

import { useState, useEffect } from 'react';
import { Layers, AlertTriangle, Loader2, Save, Sprout, Share2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../state/AuthContext';
import { useCustosIndiretos, type LinhaCusto } from './useCustosIndiretos';

type Plano = {
  temOrigem: boolean;
  destinoVazio: boolean;
  valores: Array<{ descricao_custo: string; valor: number }>;
  anomalias: Array<{ docId: string; id_estavel: string; descricao_custo: string; valor_mensal: number }>;
};

const INP = 'rounded px-2 py-1.5 text-sm w-full text-right';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;

export function CustosIndiretos() {
  const {
    periodo, linhas, precisaSemear, salvando, salvarValores, semear,
    proximoPeriodo, planejarPropagacao, executarPropagacao,
  } = useCustosIndiretos();
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';

  // Estado string por id_estavel — ressincroniza quando os valores persistidos
  // mudam (troca de período ou após salvar). WYSIWYG do que está no Firestore.
  const [valores, setValores] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [carregandoPlano, setCarregandoPlano] = useState(false);

  const assinatura = linhas.map(l => `${l.id_estavel}:${l.valorAtual}`).join('|');
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const l of linhas) init[l.id_estavel] = String(l.valorAtual);
    setValores(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const totalLive = linhas.reduce((s, l) => s + (Number(valores[l.id_estavel]) || 0), 0);

  // Linha editável (reutilizada nos dois grupos: gerais e diretos-rateados).
  const linhaRow = (l: LinhaCusto) => (
    <tr key={l.id_estavel} className="border-b" style={{ borderColor: '#e2e2e8' }}>
      <td className="px-3 py-2 text-sm" style={{ color: '#160F41' }}>{l.descricao_custo}</td>
      <td className="px-3 py-2 w-48">
        <input type="number" step="0.01" value={valores[l.id_estavel] ?? ''}
          onChange={e => setValores(p => ({ ...p, [l.id_estavel]: e.target.value }))}
          className={INP} style={BRD} disabled={!isAdmin} />
      </td>
    </tr>
  );

  async function salvar() {
    const edicoes = linhas
      .filter(l => l.docAtual && valores[l.id_estavel]?.trim() !== ''
        && Number(valores[l.id_estavel]) !== l.valorAtual)
      .map(l => ({ docId: l.docAtual!.id!, valor: Number(valores[l.id_estavel]), nome: l.descricao_custo }));
    if (edicoes.length === 0) { flash('Nenhuma alteração para salvar.'); return; }
    try {
      const r = await salvarValores(edicoes);
      flash(r.erros.length
        ? `${r.atualizados} salvo(s), ${r.erros.length} falhou: ${r.erros.map(e => `${e.nome} — ${e.motivo}`).join('; ')}`
        : `${r.atualizados} valor(es) salvos no período ${periodo}.`);
    } catch (e) {
      flash(`Erro: ${e instanceof Error ? e.message : 'falha ao salvar'}`);
    }
  }

  async function semearHandler() {
    try {
      const n = await semear();
      flash(n > 0 ? `${n} categoria(s) semeada(s) com valor 0 no período ${periodo}.` : 'Nada a semear — as 5 já existem.');
    } catch (e) {
      flash(`Erro: ${e instanceof Error ? e.message : 'falha ao semear'}`);
    }
  }

  async function abrirPropagacao() {
    setCarregandoPlano(true);
    try { setPlano(await planejarPropagacao()); }
    catch (e) { flash(`Erro: ${e instanceof Error ? e.message : 'falha ao planejar'}`); }
    finally { setCarregandoPlano(false); }
  }

  async function confirmarPropagacao() {
    try {
      const r = await executarPropagacao();
      const al = r.alinhados.length
        ? ` ${r.alinhados.length} doc(s) anômalo(s) alinhado(s): ${r.alinhados.map(a => a.descricao_custo).join(', ')}.`
        : '';
      flash(`${r.gravados} categoria(s) propagada(s) para ${proximoPeriodo}.${al}`);
    } catch (e) {
      flash(`Erro: ${e instanceof Error ? e.message : 'falha ao propagar'}`);
    } finally { setPlano(null); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
          <Layers size={18} /> Custos Indiretos
        </h3>
        <p className="text-xs" style={{ color: '#6b6b8a' }}>Período: {periodo || '—'}</p>
      </div>

      {/* Aviso permanente do risco do Excel (risco aceito — torná-lo visível) */}
      <div className="flex gap-2 rounded-lg p-3 text-xs" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <span>Reimportar a planilha deste período sobrescreve estes valores.</span>
      </div>

      {!periodo ? (
        <p className="text-sm" style={{ color: '#6b6b8a' }}>Selecione um período no topo.</p>
      ) : precisaSemear ? (
        <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: '#e2e2e8' }}>
          <p className="text-sm" style={{ color: '#160F41' }}>
            O período <strong>{periodo}</strong> não tem as 5 categorias canônicas. Semeie-as
            (valor 0, identidade canônica) para começar a editar.
          </p>
          {isAdmin && (
            <button onClick={semearHandler} disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-gradient-brand disabled:opacity-50">
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Sprout size={12} />}
              Semear categorias canônicas
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left" style={{ color: '#6b6b8a' }}>Categoria (DRE)</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-right w-48" style={{ color: '#6b6b8a' }}>Valor mensal</th>
                </tr>
              </thead>
              <tbody>
                {linhas.filter(l => l.tipo_custo === 'geral').map(linhaRow)}
                {linhas.some(l => l.tipo_custo !== 'geral') && (
                  <tr style={{ backgroundColor: '#f9f9fb' }}>
                    <td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}
                      title="Rateados ao cliente (peso jurídico / volume) e somados ao CUSTO DEDICADO — não ao pool indireto.">
                      Custos diretos rateados (compõem o dedicado do cliente)
                    </td>
                  </tr>
                )}
                {linhas.filter(l => l.tipo_custo !== 'geral').map(linhaRow)}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <td className="px-3 py-2 text-sm font-bold" style={{ color: '#160F41' }}>Total lançado</td>
                  <td className="px-3 py-2 text-sm font-bold text-right" style={{ color: '#160F41' }}>{formatCurrency(totalLive)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {isAdmin && (
            <div className="flex justify-end gap-3">
              <button onClick={abrirPropagacao} disabled={salvando || carregandoPlano || !proximoPeriodo}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ border: '1px solid #160F41', color: '#160F41' }}
                title={`Copiar estes valores para ${proximoPeriodo}`}>
                {carregandoPlano ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                Propagar para {proximoPeriodo}
              </button>
              <button onClick={salvar} disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {salvando ? 'Salvando…' : 'Salvar valores'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de confirmação da propagação — nomeia o destino, mostra valores
          e sinaliza anomalias (alinhamento explícito). */}
      {plano && (
        <Modal aberto onFechar={() => setPlano(null)} titulo={`Propagar custos indiretos → ${proximoPeriodo}`} largura="lg">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#160F41' }}>
              Copiar as 5 categorias (com valores) de <strong>{periodo}</strong> para
              <strong> {proximoPeriodo}</strong>, casando por identidade canônica:
            </p>
            <ul className="text-sm space-y-1 rounded-lg p-3" style={{ backgroundColor: '#f3f4f6', color: '#160F41' }}>
              {plano.valores.map(v => (
                <li key={v.descricao_custo} className="flex justify-between">
                  <span>{v.descricao_custo}</span><strong>{formatCurrency(v.valor)}</strong>
                </li>
              ))}
            </ul>

            {!plano.destinoVazio && (
              <p className="text-xs px-3 py-2 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                ⚠ O período {proximoPeriodo} <strong>já tem custos</strong> — eles serão sobrescritos pelos valores acima.
              </p>
            )}

            {plano.anomalias.length > 0 && (
              <div className="text-xs px-3 py-2 rounded space-y-1" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                <p><strong>Anomalia de identidade no destino</strong> ({plano.anomalias.length}). Confirmar irá
                  <strong> alinhar à identidade canônica (excluir estes docs)</strong>:</p>
                <ul className="list-disc pl-4">
                  {plano.anomalias.map(a => (
                    <li key={a.docId}>{a.descricao_custo} — docId {a.docId.slice(0, 8)}… / id_estavel {a.id_estavel.slice(0, 8)}…</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
              <button onClick={() => setPlano(null)} disabled={salvando}
                className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
                Cancelar
              </button>
              <button onClick={confirmarPropagacao} disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
                {salvando && <Loader2 size={14} className="animate-spin" />}
                {plano.anomalias.length > 0 ? 'Propagar e alinhar' : `Propagar para ${proximoPeriodo}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm shadow-lg z-50 max-w-md"
          style={{
            backgroundColor: toast.startsWith('Erro') || toast.includes('falhou') ? '#fee2e2' : '#dcfce7',
            color: toast.startsWith('Erro') || toast.includes('falhou') ? '#991b1b' : '#166534',
          }}>{toast}</div>
      )}
    </div>
  );
}
