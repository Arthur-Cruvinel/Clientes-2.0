// --- Import de consumo jurídico: ENTRADA ASSISTIDA + DE-PARA (Commits 1-2) ---
// O relatório do Monday é PDF-imagem (parse morto por prova). O operador COLA as contagens;
// parse determinístico (Commit 1) → de-para nome→cliente canônico com QUARENTENA (Commit 2).
// Ambiguidade (2+ candidatos) nunca desempata em silêncio → quarentena com 3 saídas
// (casar / cadastrar novo / marcar CASA), resolução memorizada. Save do consumo é Commit 3.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../state/AppContext';
import { useAuth } from '../../../state/AuthContext';
import {
  buscarMapeamentoMonday, salvarEntradaMapeamentoMonday, buscarUniversoJuridico,
  salvarSnapshotConsumoJuridico, type EntradaMapeamentoMonday,
} from '../../../services/firebase';
import { NovoClienteModal } from '../../perfil/NovoClienteModal';
import { parseContagens } from './parseContagens';
import { casarNomeMonday, normNome, type ClienteUniverso, type Resolucao } from './resolverMonday';
import { lerArquivoBase64 } from '../../../utils/lerArquivoBase64';

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// ── Import direto do PDF do board (via claude-proxy — NÃO se toca a function) ──
// Teto síncrono da Netlify é ~6MB de body; o PDF vai em base64 (infla ~33%), então
// o PDF cru cabe em ~4,5MB. Modelo = o mesmo alias que o useDocumentParser usa hoje.
const MAX_PDF_BYTES = 4.5 * 1024 * 1024;
const MODELO_PDF = 'claude-sonnet-4-6';
const PROMPT_SISTEMA_PDF =
  'Você transcreve um board de demandas jurídicas (Monday) para texto puro. '
  + 'Não interprete, não resuma, não comente — apenas transcreva as contagens fielmente.';
const PROMPT_USUARIO_PDF =
  'Transcreva o board deste PDF seguindo REGRAS ESTRITAS:\n'
  + '- UMA linha por cliente, no formato exato: NOME CONTAGEM\n'
  + '  (NOME exatamente como aparece no board; CONTAGEM = número inteiro de demandas).\n'
  + '- Transcreva os nomes EXATAMENTE como aparecem no documento, caractere a caractere.\n'
  + '  Nomes quase idênticos (ex.: "Artur Guimarães" e "Arthur Guimarães") são ENTRADAS\n'
  + '  DISTINTAS do board — transcreva uma linha para cada, NUNCA fundir nem deduplicar.\n'
  + '- A linha #TOTAL n só deve existir se o documento IMPRIMIR literalmente um número\n'
  + '  de total. É PROIBIDO calcular, somar ou inferir o total a partir das linhas ou de\n'
  + '  outros números do documento. Se nenhum total estiver impresso, NÃO emita a linha #TOTAL.\n'
  + '- NENHUM outro texto: sem cabeçalhos, sem comentários, sem markdown, sem cercas de código.';

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
  const [importando, setImportando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Import direto do PDF do board: File → base64 (util) → claude-proxy. A resposta
  // vem como "NOME CONTAGEM" (uma linha/cliente) + opcional "#TOTAL n". Confere o
  // total contra a soma transcrita (parser canônico); só então alimenta `texto` — a
  // boca do funil. Divergiu → erro, textarea intocado. Reusa parse→de-para→snapshot.
  async function importarDoPdf(arquivo: File) {
    setErroPdf(null);
    if (arquivo.size > MAX_PDF_BYTES) {
      setErroPdf(`PDF de ${(arquivo.size / 1024 / 1024).toFixed(1)}MB excede o limite de 4,5MB. Reduza o arquivo ou cole as contagens manualmente abaixo.`);
      return;
    }
    setImportando(true);
    try {
      const base64 = await lerArquivoBase64(arquivo);
      const resp = await fetch('/.netlify/functions/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODELO_PDF,
          max_tokens: 4096,
          system: PROMPT_SISTEMA_PDF,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: PROMPT_USUARIO_PDF },
            ],
          }],
        }),
      });
      if (resp.status === 429) {
        setErroPdf('Limite de requisições atingido (rate limit). Aguarde alguns segundos e tente de novo.');
        return;
      }
      if (!resp.ok) {
        const t = await resp.text();
        setErroPdf(`Falha na extração (HTTP ${resp.status}): ${t.slice(0, 200)}`);
        return;
      }
      const data = await resp.json();
      const bruto = data?.content?.[0]?.text;
      if (typeof bruto !== 'string') {
        setErroPdf('Resposta inválida da extração — tente de novo ou cole as contagens manualmente.');
        return;
      }
      // Defesa contra cercas de código (o prompt já as proíbe). Separa linhas "#".
      const limpo = bruto.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
      const linhas = limpo.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const contagens = linhas.filter(l => !l.startsWith('#'));
      const mTotal = linhas.filter(l => l.startsWith('#'))
        .map(l => /^#TOTAL\s+(\d+)/i.exec(l)).find(Boolean);
      const totalDeclarado = mTotal ? parseInt(mTotal[1], 10) : null;
      // Conferência via parser canônico (mesma soma que o funil usará). NÃO altera parseContagens.
      const somaTranscrita = parseContagens(contagens.join('\n')).total;
      if (totalDeclarado !== null && somaTranscrita !== totalDeclarado) {
        setErroPdf(`Total do board (#TOTAL ${totalDeclarado}) ≠ soma transcrita (${somaTranscrita}). A transcrição não confere — revise o PDF e tente de novo. O campo abaixo NÃO foi preenchido.`);
        return;
      }
      setTexto(contagens.join('\n'));
    } catch {
      setErroPdf('Falha de rede ao extrair do PDF. Verifique a conexão e tente de novo.');
    } finally {
      setImportando(false);
    }
  }

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
  // tipo 'externo' = paga o jurídico direto, não é cliente da base (fora do pool).
  type Resolvido = { nome: string; contagem: number; tipo: 'cliente' | 'casa' | 'externo'; id_estavel?: string; canonico?: string };
  const { resolvidos, pendentes } = useMemo(() => {
    const resolvidos: Resolvido[] = [];
    const pendentes: { nome: string; contagem: number; res: Resolucao }[] = [];
    for (const e of r.entradas) {
      const dp = dpPorNome.get(normNome(e.nome));
      if (dp) { resolvidos.push({ nome: e.nome, contagem: e.contagem, tipo: dp.alvo, id_estavel: dp.id_estavel_cliente, canonico: dp.nome_cliente_canonico }); continue; }
      const res = casarNomeMonday(e.nome, universo);
      if (res.tipo === 'match') resolvidos.push({ nome: e.nome, contagem: e.contagem, tipo: 'cliente', id_estavel: res.id_estavel, canonico: res.canonico });
      else pendentes.push({ nome: e.nome, contagem: e.contagem, res });
    }
    return { resolvidos, pendentes };
  }, [r.entradas, dpPorNome, universo]);

  const registrador = usuario?.nome ?? usuario?.email ?? undefined;
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState<string | null>(null);
  const podeSalvar = periodoValido && r.entradas.length > 0 && r.erros.length === 0 && pendentes.length === 0 && !carregando;
  async function salvarSnapshot() {
    setSalvando(true);
    try {
      // A SOMA por id_estavel aqui é INTENCIONAL e load-bearing — não trocar por
      // set direto. O board real tem nomes quase-idênticos que o de-para resolve
      // para o MESMO cliente (caso vivo: "Artur Guimarães" 2 + "Arthur Guimarães" 1
      // → um cliente, 3 demandas). Como o snapshot grava por docId=id_estavel
      // (firebase.ts:2028, batch.set), substituir esta soma por atribuição faria a
      // 2ª entrada SOBRESCREVER a 1ª — perda de demandas em silêncio. Não há teste
      // cobrindo este ponto: o golden guarda só o parser (pré-de-para).
      const porId = new Map<string, { nome: string; demandas: number }>();
      // Externos agregam por NOME do board (não têm id_estavel — não são clientes da base).
      const porExterno = new Map<string, number>();
      let casa = 0;
      for (const e of resolvidos) {
        if (e.tipo === 'casa') { casa += e.contagem; continue; }
        if (e.tipo === 'externo') { porExterno.set(e.nome, (porExterno.get(e.nome) ?? 0) + e.contagem); continue; }
        if (!e.id_estavel) continue;
        const cur = porId.get(e.id_estavel) ?? { nome: e.canonico ?? e.nome, demandas: 0 };
        cur.demandas += e.contagem; porId.set(e.id_estavel, cur);
      }
      const clientes = [...porId].map(([id, v]) => ({ id_estavel_cliente: id, nome_cliente: v.nome, demandas: v.demandas }));
      const externos = [...porExterno].map(([nome, demandas]) => ({ nome, demandas }));
      await salvarSnapshotConsumoJuridico(periodo, clientes, casa, externos, registrador);
      setSalvo(periodo);
    } finally { setSalvando(false); }
  }

  async function resolverCliente(nomeMonday: string, id_estavel: string, canonico: string) {
    await salvarEntradaMapeamentoMonday({ nome_monday: nomeMonday, alvo: 'cliente', id_estavel_cliente: id_estavel, nome_cliente_canonico: canonico, registrado_em: new Date().toISOString(), registrado_por: registrador });
    setVersao(v => v + 1);
  }
  async function resolverCasa(nomeMonday: string) {
    await salvarEntradaMapeamentoMonday({ nome_monday: nomeMonday, alvo: 'casa', registrado_em: new Date().toISOString(), registrado_por: registrador });
    setVersao(v => v + 1);
  }
  /** 4ª saída: paga o jurídico direto e não é cliente da base → fora do pool. */
  async function resolverExterno(nomeMonday: string) {
    await salvarEntradaMapeamentoMonday({ nome_monday: nomeMonday, alvo: 'externo', registrado_em: new Date().toISOString(), registrado_por: registrador });
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

      {/* Import direto do PDF do board (via claude-proxy). Preenche o textarea abaixo. */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Importar do PDF do board</label>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importarDoPdf(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={importando}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-50"
            style={{ borderColor: '#0065FF', color: '#0065FF' }}>
            {importando ? 'Extraindo do PDF…' : 'Importar do PDF do board'}
          </button>
          <span className="text-[11px]" style={{ color: '#6b6b8a' }}>PDF até 4,5MB · a transcrição preenche o campo abaixo (ainda passa pelo de-para)</span>
        </div>
        {erroPdf && <p className="text-[11px] mt-1.5" style={{ color: '#991b1b' }}>{erroPdf}</p>}
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
          Contagens — cole manualmente OU use o import do PDF acima · formato: <code>Nome &lt;espaços&gt; número</code>
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
                    <td className="px-3 py-1.5">{e.tipo === 'casa'
                      ? rotulo('#6b6b8a', '#f3f4f6', 'CASA')
                      : e.tipo === 'externo'
                        ? rotulo('#3730a3', '#eef2ff', 'EXTERNO (fora do pool)')
                        : rotulo('#166534', '#f0fdf4', e.canonico ?? '—')}</td>
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
                  <button type="button" onClick={() => resolverExterno(e.nome)}
                    className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#eef2ff', color: '#3730a3' }}
                    title="Paga o jurídico diretamente e não é cliente da base — fica fora do pool (não entra em rateio nem em cortesia)">Externo (fora do pool)</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {podeSalvar && (
        <div className="rounded-lg p-3 flex items-center justify-between gap-3" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <span className="text-[12px]" style={{ color: '#166534' }}>
            ✓ {periodo}: {r.entradas.length} clientes resolvidos, 0 em quarentena, {r.total} demandas.
            {salvo === periodo && ' · snapshot salvo ✓'}
          </span>
          <button type="button" onClick={salvarSnapshot} disabled={salvando}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#0065FF,#D000BB)' }}>
            {salvando ? 'Salvando…' : salvo === periodo ? 'Salvar de novo (substitui)' : 'Salvar snapshot'}
          </button>
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
