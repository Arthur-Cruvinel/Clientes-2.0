// --- Import de consumo jurídico: ENTRADA ASSISTIDA + DE-PARA (Commits 1-2) ---
// O relatório do Monday é PDF-imagem (parse morto por prova). O operador COLA as contagens;
// parse determinístico (Commit 1) → de-para nome→cliente canônico com QUARENTENA (Commit 2).
// Ambiguidade (2+ candidatos) nunca desempata em silêncio → quarentena com 3 saídas
// (casar / cadastrar novo / marcar CASA), resolução memorizada. Save do consumo é Commit 3.

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../state/AppContext';
import { useAuth } from '../../../state/AuthContext';
import {
  buscarMapeamentoMonday, salvarEntradaMapeamentoMonday, buscarUniversoJuridico,
  type EntradaMapeamentoMonday,
} from '../../../services/firebase';
import { NovoClienteModal } from '../../perfil/NovoClienteModal';
import { parseContagens } from './parseContagens';
import { casarNomeMonday, normNome, type ClienteUniverso, type Resolucao } from './resolverMonday';

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function ConsumoJuridicoImport() {
  const { periodoSelecionado } = useApp();
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState('');
  const [texto, setTexto] = useState('');
  const [dePara, setDePara] = useState<Record<string, EntradaMapeamentoMonday>>({});
  const [universo, setUniverso] = useState<ClienteUniverso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);         // recarrega de-para/universo após resolução
  const [cadastrarPara, setCadastrarPara] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    Promise.all([buscarMapeamentoMonday(), buscarUniversoJuridico()]).then(([dp, uni]) => {
      if (!vivo) return;
      setDePara(dp); setUniverso(uni); setCarregando(false);
    });
    return () => { vivo = false; };
  }, [versao]);

  const r = useMemo(() => parseContagens(texto), [texto]);
  const periodoValido = PERIODO_RE.test(periodo);
  const dpPorNome = useMemo(() => {
    const m = new Map<string, EntradaMapeamentoMonday>();
    for (const k of Object.keys(dePara)) m.set(normNome(k), dePara[k]);
    return m;
  }, [dePara]);
  const universoOrdenado = useMemo(() => [...universo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [universo]);

  // Resolve cada entrada: de-para (memória) → match único → quarentena (ambíguo/não casado).
  const { resolvidos, pendentes } = useMemo(() => {
    const resolvidos: { nome: string; contagem: number; alvo: string }[] = [];
    const pendentes: { nome: string; contagem: number; res: Resolucao }[] = [];
    for (const e of r.entradas) {
      const dp = dpPorNome.get(normNome(e.nome));
      if (dp) { resolvidos.push({ nome: e.nome, contagem: e.contagem, alvo: dp.alvo === 'casa' ? 'CASA' : (dp.nome_cliente_canonico ?? '—') }); continue; }
      const res = casarNomeMonday(e.nome, universo);
      if (res.tipo === 'match') resolvidos.push({ nome: e.nome, contagem: e.contagem, alvo: res.canonico });
      else pendentes.push({ nome: e.nome, contagem: e.contagem, res });
    }
    return { resolvidos, pendentes };
  }, [r.entradas, dpPorNome, universo]);

  const registrador = usuario?.nome ?? usuario?.email ?? undefined;
  async function resolverCliente(nomeMonday: string, id_estavel: string, canonico: string) {
    await salvarEntradaMapeamentoMonday({ nome_monday: nomeMonday, alvo: 'cliente', id_estavel_cliente: id_estavel, nome_cliente_canonico: canonico, registrado_em: new Date().toISOString(), registrado_por: registrador });
    setVersao(v => v + 1);
  }
  async function resolverCasa(nomeMonday: string) {
    await salvarEntradaMapeamentoMonday({ nome_monday: nomeMonday, alvo: 'casa', registrado_em: new Date().toISOString(), registrado_por: registrador });
    setVersao(v => v + 1);
  }

  const rotulo = (color: string, bg: string, txt: string) => (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: bg, color }}>{txt}</span>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="text-lg font-bold" style={{ color: '#160F41' }}>Consumo Jurídico — entrada de contagens</h3>
        <p className="text-sm mt-1" style={{ color: '#6b6b8a' }}>
          O relatório do Monday é uma imagem — cole as contagens do dashboard (uma linha por
          cliente). O relatório é <strong>acumulado</strong> (Jan → mês corrente); o delta mensal
          sai entre snapshots. Cada nome passa pelo <strong>de-para</strong>; ambiguidade vai para
          quarentena (nunca desempata sozinho).
        </p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Período do relatório</label>
        <input value={periodo} onChange={e => setPeriodo(e.target.value.trim())} placeholder="2026-06"
          className="mt-1 block w-40 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: periodo && !periodoValido ? '#991b1b' : '#e2e2e8' }} />
        {periodo && !periodoValido && <p className="text-[11px] mt-1" style={{ color: '#991b1b' }}>Formato AAAA-MM (ex.: 2026-06).</p>}
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
          Contagens coladas — formato: <code>Nome &lt;espaços&gt; número</code>
        </label>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={10}
          placeholder={'Rede Ronaldo 130\nLorena Improta 71\nPaulinho 51\n...'}
          className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-mono" style={{ borderColor: '#e2e2e8' }} />
      </div>

      {r.erros.length > 0 && (
        <div className="rounded-lg p-3" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-xs font-bold mb-1" style={{ color: '#991b1b' }}>{r.erros.length} linha(s) não reconhecida(s) — corrija antes de seguir:</p>
          <ul className="text-[11px] space-y-0.5" style={{ color: '#991b1b' }}>
            {r.erros.map(e => <li key={e.linha}>Linha {e.linha}: "{e.texto}" — {e.motivo}</li>)}
          </ul>
        </div>
      )}

      {r.entradas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
              Preview ({r.entradas.length} clientes) {carregando && '· carregando de-para…'}
            </span>
            <span className="text-sm font-bold" style={{ color: '#160F41' }}>Total: {r.total} demandas</span>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr><th className="px-3 py-1.5 text-left text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Cliente (Monday)</th>
                  <th className="px-3 py-1.5 text-right text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Demandas</th>
                  <th className="px-3 py-1.5 text-left text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Vínculo</th></tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {resolvidos.map((e, i) => (
                  <tr key={`ok-${e.nome}-${i}`}>
                    <td className="px-3 py-1.5" style={{ color: '#160F41' }}>{e.nome}</td>
                    <td className="px-3 py-1.5 text-right font-medium" style={{ color: '#160F41' }}>{e.contagem}</td>
                    <td className="px-3 py-1.5">{e.alvo === 'CASA' ? rotulo('#6b6b8a', '#f3f4f6', 'CASA') : rotulo('#166534', '#f0fdf4', e.alvo)}</td>
                  </tr>
                ))}
                {pendentes.map((e, i) => (
                  <tr key={`pd-${e.nome}-${i}`} style={{ backgroundColor: '#fffbeb' }}>
                    <td className="px-3 py-1.5 font-medium" style={{ color: '#160F41' }}>{e.nome}</td>
                    <td className="px-3 py-1.5 text-right font-medium" style={{ color: '#160F41' }}>{e.contagem}</td>
                    <td className="px-3 py-1.5">{rotulo('#b45309', '#fef3c7', e.res.tipo === 'ambiguo' ? `ambíguo (${e.res.candidatos.length})` : 'não casado')} <span className="text-[10px]" style={{ color: '#6b6b8a' }}>↓ quarentena</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] mt-2" style={{ color: '#6b6b8a' }}>
            Confira o <strong>Total</strong> contra a soma do PDF. Save do consumo é Commit 3.
          </p>
        </div>
      )}

      {/* Quarentena — 3 saídas, memoriza a resolução */}
      {pendentes.length > 0 && (
        <div className="rounded-lg border p-3" style={{ borderColor: '#fde68a', backgroundColor: '#fffbeb' }}>
          <p className="text-xs font-bold mb-2" style={{ color: '#b45309' }}>Quarentena — {pendentes.length} nome(s) a resolver (uma vez; o de-para memoriza)</p>
          <div className="space-y-2">
            {pendentes.map((e, i) => (
              <div key={`q-${e.nome}-${i}`} className="rounded-lg bg-white border p-2" style={{ borderColor: '#e2e2e8' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold" style={{ color: '#160F41' }}>{e.nome} <span className="text-[11px] font-normal" style={{ color: '#6b6b8a' }}>· {e.contagem} demandas · {e.res.tipo === 'ambiguo' ? 'candidatos: ' + e.res.candidatos.map(c => c.nome).join(', ') : 'nenhum candidato'}</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select defaultValue="" onChange={ev => { const c = universo.find(u => u.id_estavel === ev.target.value); if (c) resolverCliente(e.nome, c.id_estavel, c.nome); }}
                    className="rounded border px-2 py-1 text-xs" style={{ borderColor: '#e2e2e8' }}>
                    <option value="" disabled>Casar com cliente…</option>
                    {e.res.tipo === 'ambiguo' && <optgroup label="candidatos">{e.res.candidatos.map(c => <option key={c.id_estavel} value={c.id_estavel}>{c.nome}</option>)}</optgroup>}
                    <optgroup label="todos os clientes">{universoOrdenado.map(c => <option key={c.id_estavel} value={c.id_estavel}>{c.nome}</option>)}</optgroup>
                  </select>
                  <button type="button" onClick={() => setCadastrarPara(e.nome)} disabled={!periodoSelecionado}
                    className="px-2 py-1 rounded text-xs font-medium border disabled:opacity-40" style={{ borderColor: '#0065FF', color: '#0065FF' }}
                    title={periodoSelecionado ? undefined : 'Selecione um período no topo da plataforma para cadastrar'}>Cadastrar novo</button>
                  <button type="button" onClick={() => resolverCasa(e.nome)} className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#f3f4f6', color: '#6b6b8a' }}>Marcar CASA</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {periodoValido && r.entradas.length > 0 && r.erros.length === 0 && pendentes.length === 0 && !carregando && (
        <div className="rounded-lg p-2 text-[11px]" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>
          ✓ {periodo}: {r.entradas.length} clientes resolvidos, 0 em quarentena, {r.total} demandas. Pronto para o snapshot (Commit 3).
        </div>
      )}

      {cadastrarPara && periodoSelecionado && (
        <NovoClienteModal periodo={periodoSelecionado} onFechar={() => setCadastrarPara(null)}
          onCriado={async (nomeCriado) => {
            const uni = await buscarUniversoJuridico();
            setUniverso(uni);
            const c = uni.find(x => normNome(x.nome) === normNome(nomeCriado));
            if (c) await resolverCliente(cadastrarPara, c.id_estavel, c.nome);
            setCadastrarPara(null);
            setVersao(v => v + 1);
          }} />
      )}
    </div>
  );
}
