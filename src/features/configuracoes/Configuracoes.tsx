// --- Tela de Configurações com abas internas ---

import { useState, useCallback, useEffect } from 'react';
import { Settings, Database, Loader2, Wrench, Tags, FilePen, Eraser } from 'lucide-react';
import { useConfiguracoes } from './useConfiguracoes';
import { TabCustos } from './TabCustos';
import { TabRebate } from './TabRebate';
import { TabPacotes } from './TabPacotes';
import { ColaboradoresVisao } from '../colaboradores/ColaboradoresVisao';
import { Metodologia } from '../metodologia/Metodologia';
import { useAuth } from '../../state/AuthContext';
import { migrarClientesBase } from '../../scripts/migrarClientesBase';
import { executarMigracaoMapeamento } from '../../utils/migrarMapeamentoSiglas';
import { corrigirRegistroPoupanca, corrigirNomeClientePoupanca, corrigirEntradaMapeamentoSiglas, zerarCampoTombamento } from '../../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';

const FLAG_MAPEAMENTO_MIGRADO = 'mapeamento_migrado';

const ABAS = [
  { id: 'custos', label: 'Custos Diretos' },
  { id: 'rebate', label: 'Rebate' },
  { id: 'pacotes', label: 'Pacotes de Serviço' },
  { id: 'colaboradores', label: 'Colaboradores' },
  { id: 'metodologia', label: 'Metodologia' },
] as const;

type AbaId = (typeof ABAS)[number]['id'];

export function Configuracoes() {
  const { parametros, salvar, salvando, toast } = useConfiguracoes();
  const [aba, setAba] = useState<AbaId>('custos');
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';

  // Estado da migração
  const [migrando, setMigrando] = useState(false);
  const [migracaoMsg, setMigracaoMsg] = useState<string | null>(null);
  const [migracaoToast, setMigracaoToast] = useState<string | null>(null);

  const executarMigracao = useCallback(async () => {
    setMigrando(true);
    setMigracaoToast(null);
    try {
      const resultado = await migrarClientesBase(setMigracaoMsg);
      if (resultado.erros.length > 0) {
        setMigracaoToast(`${resultado.sucesso}/${resultado.total} migrados. Erros: ${resultado.erros.join(' | ')}`);
      } else {
        setMigracaoToast(`${resultado.sucesso} clientes migrados com sucesso para clientes_base/`);
      }
    } catch (e) {
      setMigracaoToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMigrando(false);
      setMigracaoMsg(null);
    }
  }, []);

  // Estado da migração do mapeamento de siglas
  const [migrandoSiglas, setMigrandoSiglas] = useState(false);
  const [siglasProgresso, setSiglasProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [siglasToast, setSiglasToast] = useState<string | null>(null);
  // Flag persistida — botão some após sucesso (operação one-shot).
  const [siglasMigrado, setSiglasMigrado] = useState(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(FLAG_MAPEAMENTO_MIGRADO) === '1');
  useEffect(() => {
    if (siglasMigrado) window.localStorage.setItem(FLAG_MAPEAMENTO_MIGRADO, '1');
  }, [siglasMigrado]);

  const executarMigracaoSiglas = useCallback(async () => {
    setMigrandoSiglas(true);
    setSiglasToast(null);
    setSiglasProgresso({ atual: 0, total: 0 });
    try {
      const r = await executarMigracaoMapeamento(
        usuario?.nome ?? usuario?.email ?? 'admin',
        (atual, total) => setSiglasProgresso({ atual, total }),
      );
      if (r.erros.length > 0) {
        setSiglasToast(`${r.migrados} migrados. Erros: ${r.erros.slice(0, 3).join(' | ')}${r.erros.length > 3 ? '…' : ''}`);
      } else {
        setSiglasToast(`${r.migrados} siglas migradas com sucesso para mapeamento_siglas/`);
        setSiglasMigrado(true);
      }
    } catch (e) {
      setSiglasToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMigrandoSiglas(false);
      setSiglasProgresso(null);
    }
  }, [usuario]);

  // Estado da correção de nomes em poupanca/
  const [corrigindoNome, setCorrigindoNome] = useState(false);
  const [nomeAntigo, setNomeAntigo] = useState('');
  const [nomeNovo, setNomeNovo] = useState('');
  const [correcaoNomeToast, setCorrecaoNomeToast] = useState<string | null>(null);

  const corrigirNomes = useCallback(async () => {
    if (!nomeAntigo.trim() || !nomeNovo.trim()) {
      setCorrecaoNomeToast('Erro: preencha ambos os nomes.');
      return;
    }
    setCorrigindoNome(true);
    setCorrecaoNomeToast(null);
    try {
      const r = await corrigirNomeClientePoupanca(nomeAntigo.trim(), nomeNovo.trim());
      if (r.erros.length > 0) {
        setCorrecaoNomeToast(`${r.atualizados} atualizados. Erros: ${r.erros.slice(0, 3).join(' | ')}${r.erros.length > 3 ? '…' : ''}`);
      } else {
        setCorrecaoNomeToast(`${r.atualizados} registros de poupança atualizados de "${nomeAntigo}" para "${nomeNovo}".`);
        setNomeAntigo(''); setNomeNovo('');
      }
    } catch (e) {
      setCorrecaoNomeToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCorrigindoNome(false);
    }
  }, [nomeAntigo, nomeNovo]);

  // Estado da correção pontual de entrada no mapeamento de siglas.
  const [corrigindoMap, setCorrigindoMap] = useState(false);
  const [mapCodigo, setMapCodigo] = useState('');
  const [mapNomeNovo, setMapNomeNovo] = useState('');
  const [correcaoMapToast, setCorrecaoMapToast] = useState<string | null>(null);

  const corrigirEntradaMap = useCallback(async () => {
    if (!mapCodigo.trim() || !mapNomeNovo.trim()) {
      setCorrecaoMapToast('Erro: preencha código e nome.');
      return;
    }
    setCorrigindoMap(true);
    setCorrecaoMapToast(null);
    try {
      const r = await corrigirEntradaMapeamentoSiglas(mapCodigo.trim(), mapNomeNovo.trim());
      setCorrecaoMapToast(r.atualizou ? r.mensagem : `Erro: ${r.mensagem}`);
      if (r.atualizou) { setMapCodigo(''); setMapNomeNovo(''); }
    } catch (e) {
      setCorrecaoMapToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCorrigindoMap(false);
    }
  }, [mapCodigo, mapNomeNovo]);

  // Estado do zerador de tombamento espúrio em poupanca/.
  // Usado para limpar registros stale de re-imports antigos com hasPrev=false.
  const [zerandoTomb, setZerandoTomb] = useState(false);
  const [tombDocId, setTombDocId] = useState('');
  const [tombCampo, setTombCampo] = useState<'nnm_tombamento_offshore' | 'nnm_tombamento_onshore' | 'nnm_tombamento'>('nnm_tombamento_offshore');
  const [tombToast, setTombToast] = useState<string | null>(null);

  const zerarTombamento = useCallback(async () => {
    if (!tombDocId.trim()) {
      setTombToast('Erro: informe o ID do documento.');
      return;
    }
    setZerandoTomb(true);
    setTombToast(null);
    try {
      const r = await zerarCampoTombamento(tombDocId.trim(), tombCampo);
      setTombToast(r.corrigido ? r.mensagem : `Aviso: ${r.mensagem}`);
      if (r.corrigido) setTombDocId('');
    } catch (e) {
      setTombToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setZerandoTomb(false);
    }
  }, [tombDocId, tombCampo]);

  // Estado da correção offshore
  const [corrigindoOff, setCorrigindoOff] = useState(false);
  const [correcaoOffToast, setCorrecaoOffToast] = useState<string | null>(null);

  const corrigirEntradaOffshore = useCallback(async () => {
    setCorrigindoOff(true);
    setCorrecaoOffToast(null);
    try {
      const snap = await getDocs(collection(db, 'poupanca'));
      // Agrupar por cliente e ordenar por período para encontrar meses de entrada
      const porCliente = new Map<string, { id: string; data: Record<string, unknown> }[]>();
      snap.docs.forEach(d => {
        const data = d.data();
        const nome = (data.nome_cliente as string) ?? '';
        if (!porCliente.has(nome)) porCliente.set(nome, []);
        porCliente.get(nome)!.push({ id: d.id, data });
      });

      let corrigidos = 0;
      for (const [, docs] of porCliente) {
        docs.sort((a, b) => {
          const pa = (a.data.ano as number) * 12 + (a.data.mes as number);
          const pb = (b.data.ano as number) * 12 + (b.data.mes as number);
          return pa - pb;
        });
        for (let i = 0; i < docs.length; i++) {
          const d = docs[i];
          const prev = i > 0 ? docs[i - 1] : null;
          const plUsdIni = (prev?.data.pl_offshore_usd as number) ?? 0;
          const plUsdFin = (d.data.pl_offshore_usd as number) ?? 0;
          const rentOff = (d.data.rentabilidade_offshore as number) ?? 0;
          const ptax = (d.data.ptax_fechamento as number) ?? 0;

          // Mês de entrada offshore: sem posição USD inicial mas com dados offshore
          if (plUsdIni <= 0.01 && plUsdFin > 0.01 && (rentOff > 0.01 || rentOff < -0.01)) {
            const rentOn = (d.data.rentabilidade_onshore as number) ?? 0;
            await corrigirRegistroPoupanca(d.id, {
              rentabilidade_offshore: 0,
              rentabilidade_total: rentOn,
              aporte_mes_offshore: plUsdFin * ptax,
            } as Record<string, unknown> as never);
            console.log(`[Correcao] Corrigido doc ${d.id}`);
            corrigidos++;
          }
        }
      }
      setCorrecaoOffToast(`${corrigidos} registros de entrada offshore corrigidos`);
    } catch (e) {
      setCorrecaoOffToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCorrigindoOff(false);
    }
  }, []);

  return (
    <div className={`mx-auto space-y-6 ${aba === 'colaboradores' ? 'max-w-full' : 'max-w-3xl'}`}>
      <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
        <Settings size={20} /> Configurações
      </h2>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#f3f4f6' }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${aba === a.id ? 'bg-white shadow-sm' : ''}`}
            style={{ color: aba === a.id ? '#160F41' : '#6b6b8a' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#e2e2e8' }}>
        {aba === 'custos' && <TabCustos parametros={parametros} onSalvar={salvar} salvando={salvando} />}
        {aba === 'rebate' && <TabRebate parametros={parametros} onSalvar={salvar} salvando={salvando} />}
        {aba === 'pacotes' && <TabPacotes parametros={parametros} onSalvar={salvar} salvando={salvando} />}
        {aba === 'colaboradores' && <ColaboradoresVisao />}
        {aba === 'metodologia' && <Metodologia />}
      </div>

      {/* Seção Manutenção — apenas admin */}
      {isAdmin && (
        <div className="bg-white rounded-lg border p-6 space-y-3" style={{ borderColor: '#e2e2e8' }}>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
            <Database size={16} /> Migração de Dados
          </h3>
          <p className="text-xs" style={{ color: '#6b6b8a' }}>
            Copia clientes de Dez/2025 para clientes_base/. Execute apenas uma vez.
          </p>
          <button onClick={executarMigracao} disabled={migrando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#dc2626' }}>
            {migrando ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            {migrando ? 'Migrando...' : 'Executar Migração'}
          </button>
          {migrando && migracaoMsg && (
            <p className="text-xs" style={{ color: '#6b6b8a' }}>{migracaoMsg}</p>
          )}
          {migracaoToast && (
            <div className="p-3 rounded-lg text-sm" style={{
              backgroundColor: migracaoToast.includes('Erro') ? '#fee2e2' : '#dcfce7',
              color: migracaoToast.includes('Erro') ? '#991b1b' : '#166534',
            }}>
              {migracaoToast}
            </div>
          )}

          {!siglasMigrado && (
            <div className="border-t pt-4 mt-4 space-y-3" style={{ borderColor: '#e2e2e8' }}>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
                <Tags size={16} /> Migrar Mapeamento de Siglas
              </h3>
              <p className="text-xs" style={{ color: '#6b6b8a' }}>
                Popula <code>mapeamento_siglas/</code> com as entradas estáticas
                de <code>SIGLA_PARA_NOME</code>. Operação one-shot — o botão some
                após sucesso (flag <code>{FLAG_MAPEAMENTO_MIGRADO}</code> salvo
                em localStorage).
              </p>
              <button onClick={executarMigracaoSiglas} disabled={migrandoSiglas}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#160F41' }}>
                {migrandoSiglas ? <Loader2 size={14} className="animate-spin" /> : <Tags size={14} />}
                {migrandoSiglas
                  ? `Migrando… ${siglasProgresso?.atual ?? 0}/${siglasProgresso?.total ?? 0}`
                  : 'Migrar Mapeamento de Siglas'}
              </button>
              {siglasToast && (
                <div className="p-3 rounded-lg text-sm" style={{
                  backgroundColor: siglasToast.startsWith('Erro') ? '#fee2e2' : '#dcfce7',
                  color: siglasToast.startsWith('Erro') ? '#991b1b' : '#166534',
                }}>
                  {siglasToast}
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4 mt-4 space-y-3" style={{ borderColor: '#e2e2e8' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
              <FilePen size={16} /> Corrigir Nomes em Poupança
            </h3>
            <p className="text-xs" style={{ color: '#6b6b8a' }}>
              Atualiza <code>nome_cliente</code> em todos os docs de
              {' '}<code>poupanca/</code> com match exato OU normalizado (NFD+lowercase+sem acento).
              Use para corrigir grafias inconsistentes vindas do parser de lâmina (ex:
              "FUNDAÇÃO FENOMENOS" → "FUNDAÇÃO FENÔMENOS").
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={nomeAntigo} onChange={e => setNomeAntigo(e.target.value)}
                placeholder="Nome antigo (atual em poupanca/)"
                className="rounded px-2 py-1.5 text-xs"
                style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
              <input type="text" value={nomeNovo} onChange={e => setNomeNovo(e.target.value)}
                placeholder="Nome novo (correto)"
                className="rounded px-2 py-1.5 text-xs"
                style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
            </div>
            <button onClick={corrigirNomes} disabled={corrigindoNome || !nomeAntigo.trim() || !nomeNovo.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#160F41' }}>
              {corrigindoNome ? <Loader2 size={14} className="animate-spin" /> : <FilePen size={14} />}
              {corrigindoNome ? 'Corrigindo...' : 'Aplicar Correção de Nomes'}
            </button>
            {correcaoNomeToast && (
              <div className="p-3 rounded-lg text-sm" style={{
                backgroundColor: correcaoNomeToast.startsWith('Erro') ? '#fee2e2' : '#dcfce7',
                color: correcaoNomeToast.startsWith('Erro') ? '#991b1b' : '#166534',
              }}>
                {correcaoNomeToast}
              </div>
            )}
          </div>

          <div className="border-t pt-4 mt-4 space-y-3" style={{ borderColor: '#e2e2e8' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
              <Tags size={16} /> Corrigir Entrada no Mapeamento de Siglas
            </h3>
            <p className="text-xs" style={{ color: '#6b6b8a' }}>
              Atualiza <code>nome_cliente</code> de UMA entrada existente em
              {' '}<code>mapeamento_siglas/&#123;codigo&#125;</code>. Para criar uma entrada nova,
              use a Migração ou a UI de Resolver Siglas durante upload de lâmina.
              Marca <code>atualizado_em</code> com timestamp.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={mapCodigo}
                onChange={e => setMapCodigo(e.target.value)}
                placeholder="Código/sigla (ex: FNR)"
                className="rounded px-2 py-1.5 text-xs font-mono uppercase"
                style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
              <input type="text" value={mapNomeNovo}
                onChange={e => setMapNomeNovo(e.target.value)}
                placeholder="Nome correto (ex: FUNDAÇÃO FENÔMENOS)"
                className="rounded px-2 py-1.5 text-xs"
                style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
            </div>
            <button onClick={corrigirEntradaMap} disabled={corrigindoMap || !mapCodigo.trim() || !mapNomeNovo.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#160F41' }}>
              {corrigindoMap ? <Loader2 size={14} className="animate-spin" /> : <Tags size={14} />}
              {corrigindoMap ? 'Atualizando...' : 'Atualizar Mapeamento'}
            </button>
            {correcaoMapToast && (
              <div className="p-3 rounded-lg text-sm" style={{
                backgroundColor: correcaoMapToast.startsWith('Erro') ? '#fee2e2' : '#dcfce7',
                color: correcaoMapToast.startsWith('Erro') ? '#991b1b' : '#166534',
              }}>
                {correcaoMapToast}
              </div>
            )}
          </div>

          <div className="border-t pt-4 mt-4 space-y-3" style={{ borderColor: '#e2e2e8' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
              <Eraser size={16} /> Zerar tombamento espúrio
            </h3>
            <p className="text-xs" style={{ color: '#6b6b8a' }}>
              Zera um campo de tombamento em UM doc de <code>poupanca/</code>.
              Caso de uso: limpar valor stale gerado por re-import antigo com
              <code> hasPrev=false</code>. Read-then-write — se o campo já é
              zero, não escreve.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={tombDocId}
                onChange={e => setTombDocId(e.target.value)}
                placeholder="ID do doc (ex: ademilson_braga_bispo_junior_2026_4)"
                className="rounded px-2 py-1.5 text-xs font-mono"
                style={{ border: '1px solid #e2e2e8', color: '#160F41' }} />
              <select value={tombCampo}
                onChange={e => setTombCampo(e.target.value as typeof tombCampo)}
                className="rounded px-2 py-1.5 text-xs"
                style={{ border: '1px solid #e2e2e8', color: '#160F41' }}>
                <option value="nnm_tombamento_offshore">nnm_tombamento_offshore</option>
                <option value="nnm_tombamento_onshore">nnm_tombamento_onshore</option>
                <option value="nnm_tombamento">nnm_tombamento (legado)</option>
              </select>
            </div>
            <button onClick={zerarTombamento} disabled={zerandoTomb || !tombDocId.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#d97706' }}>
              {zerandoTomb ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />}
              {zerandoTomb ? 'Zerando...' : 'Zerar Campo'}
            </button>
            {tombToast && (
              <div className="p-3 rounded-lg text-sm" style={{
                backgroundColor: tombToast.startsWith('Erro') ? '#fee2e2'
                  : tombToast.startsWith('Aviso') ? '#fef3c7' : '#dcfce7',
                color: tombToast.startsWith('Erro') ? '#991b1b'
                  : tombToast.startsWith('Aviso') ? '#92400e' : '#166534',
              }}>
                {tombToast}
              </div>
            )}
          </div>

          <div className="border-t pt-4 mt-4 space-y-3" style={{ borderColor: '#e2e2e8' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160F41' }}>
              <Wrench size={16} /> Corrigir Registros de Entrada Offshore
            </h3>
            <p className="text-xs" style={{ color: '#6b6b8a' }}>
              Zera rentabilidade e reclassifica como NNM os meses de entrada offshore
              (onde pl_offshore_usd_inicial = 0 mas rentabilidade_offshore &gt; 0).
            </p>
            <button onClick={corrigirEntradaOffshore} disabled={corrigindoOff}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#d97706' }}>
              {corrigindoOff ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
              {corrigindoOff ? 'Corrigindo...' : 'Corrigir Entradas Offshore'}
            </button>
            {correcaoOffToast && (
              <div className="p-3 rounded-lg text-sm" style={{
                backgroundColor: correcaoOffToast.includes('Erro') ? '#fee2e2' : '#dcfce7',
                color: correcaoOffToast.includes('Erro') ? '#991b1b' : '#166534',
              }}>
                {correcaoOffToast}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="p-3 rounded-lg text-sm" style={{
          backgroundColor: toast.startsWith('Erro') ? '#fee2e2' : '#dcfce7',
          color: toast.startsWith('Erro') ? '#991b1b' : '#166534',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
