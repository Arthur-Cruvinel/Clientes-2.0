// --- Hook de importação de PDFs de poupança (offshore/onshore) ---
// Extrai texto via pdfjs-dist, parseia via Claude API, salva no Firestore.

import { useState, useCallback } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { db, buscarMapeamentoSiglas, salvarEntradaMapeamento } from '../../../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { BATCH_LIMIT } from '../../../utils/constants';
import { slug } from '../../../utils/slug';
import { parseOffshoreComClaude, parseOnshoreComClaude, resolverSigla, type SiglaNaoMapeada } from './parsers/parseComClaude';
import { buscarPTAXFechamento } from '../../../services/ptax';
// [NOVO] Import do parser multi-período
import { parseMultiPeriodoComClaude, type RegistroMensal } from './parsers/parseMultiPeriodoComClaude';
import { SIGLA_PARA_NOME } from './MAPEAMENTO_SIGLAS';
import type { RegistroPoupanca } from '../../../types';

// Configura o worker do pdf.js para funcionar com Vite
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type TipoImport = 'offshore' | 'onshore';

export interface PreviewItem {
  nome_cliente?: string;
  codigo_conta?: string;        // código bruto da conta no PDF (offshore)
  starting_value_usd?: number;  // somente exibição no preview offshore
  pl_anterior?: number;         // somente exibição no preview onshore
  pl_onshore?: number;
  pl_offshore_usd?: number;
  aporte_mes_onshore?: number;
  aporte_mes_offshore?: number;
  rentabilidade_onshore?: number;
  rentabilidade_offshore?: number;
  rendimento_nominal_brl?: number | null;  // Rendimento Bruto extraído do PDF (onshore)
  dia_corte?: number | null;    // dia do mês do cabeçalho do PDF (offshore parcial)
  ano?: number;
  mes?: number;
  _arquivo: string;
  /** Sintoma: cashflow USD extraído pelo Claude é > 50% do PL final USD —
   *  forte indicador de que o modelo leu a coluna errada (Ending Value como
   *  NCF). Se este item virar primeiro mês offshore (hasPrev=false) no save,
   *  geraria nnm_tombamento_offshore desproporcional. Badge âmbar no preview
   *  pede revisão antes de confirmar.
   *  Mantido opcional p/ retrocompat. */
  tombamento_suspeito?: boolean;
  /** Razão `|cashflow USD| / pl_offshore_usd` quando tombamento_suspeito.
   *  Não confundir com a razão tomb/aporte do critério da auditoria global
   *  (que mede o dado já gravado, não o sintoma no preview). */
  tombamento_ratio?: number;
  /** Quando duas ou mais contas da lâmina mapeiam para o mesmo nome_cliente,
   *  o agregador combina os valores numéricos em um único item e lista aqui
   *  os códigos das contas combinadas (ordem da lâmina). undefined = item não
   *  agregado (só uma conta no PDF). */
  contas_agregadas?: string[];
  /** Estado de quarentena (Frente 1.2). Setado pelos parsers onshore quando
   *  resolverSigla retorna nao_encontrado. Propagado pelo salvarNoFirestore /
   *  salvarMultiPeriodo para o doc gravado. Ausência = registro ativo. */
  status?: RegistroPoupanca['status'];
  sigla_bruta_origem?: string;
}

/**
 * Agrega items que apontam para o mesmo `nome_cliente` em um único item.
 *
 * Motivo: o `docId` no Firestore é derivado de `nome_cliente` + `ano` + `mes`,
 * não da sigla da conta. Quando duas contas distintas (ex: TAW019408 + D47226006)
 * mapeiam para o mesmo cliente (ex: MLM → "MOISES LIMA MAGALHAES"), os dois
 * items geram o MESMO docId. Sem agregação, dois `setDoc` paralelos com
 * `merge: true` se sobrescrevem em race condition silenciosa — só sobra
 * o último a chegar.
 *
 * Estratégia:
 *  - Campos aditivos (saldo, cashflow, rentabilidade BRL): SOMA.
 *  - Rentabilidade % (mensal): MÉDIA PONDERADA pelo PL inicial da conta
 *    (`starting_value_usd` para offshore, `pl_anterior` para onshore).
 *    Pesos zerados (carteira nova) → mantém rent do primeiro item.
 *  - `dia_corte`: mesmo valor (vem do cabeçalho da mesma lâmina).
 *  - `_arquivo`: concatena nomes ("a.pdf, b.pdf") para auditoria.
 *  - `contas_agregadas`: lista os códigos combinados (apenas quando 2+).
 */
function agregarItensPorCliente(itens: PreviewItem[]): PreviewItem[] {
  const grupos = new Map<string, PreviewItem[]>();
  for (const item of itens) {
    const chave = item.nome_cliente ?? '';
    const lista = grupos.get(chave) ?? [];
    lista.push(item);
    grupos.set(chave, lista);
  }

  const agregados: PreviewItem[] = [];
  for (const [, grupo] of grupos) {
    if (grupo.length === 1) { agregados.push(grupo[0]); continue; }

    // Soma campos numéricos aditivos. Cada tipo (offshore/onshore) só tem
    // o seu subconjunto preenchido — somar undefined∥0 é seguro p/ ambos.
    const base: PreviewItem = { ...grupo[0] };
    base.pl_offshore_usd = 0;
    base.starting_value_usd = 0;
    base.aporte_mes_offshore = 0;
    base.pl_onshore = 0;
    base.pl_anterior = 0;
    base.aporte_mes_onshore = 0;
    base.rendimento_nominal_brl = 0;

    let pesoOff = 0, somaRentOff = 0;
    let pesoOn = 0, somaRentOn = 0;

    for (const item of grupo) {
      base.pl_offshore_usd += item.pl_offshore_usd ?? 0;
      base.starting_value_usd += item.starting_value_usd ?? 0;
      base.aporte_mes_offshore += item.aporte_mes_offshore ?? 0;
      base.pl_onshore += item.pl_onshore ?? 0;
      base.pl_anterior += item.pl_anterior ?? 0;
      base.aporte_mes_onshore += item.aporte_mes_onshore ?? 0;
      base.rendimento_nominal_brl = (base.rendimento_nominal_brl ?? 0)
        + (item.rendimento_nominal_brl ?? 0);

      const pOff = item.starting_value_usd ?? 0;
      if (pOff > 0 && item.rentabilidade_offshore != null) {
        pesoOff += pOff;
        somaRentOff += pOff * item.rentabilidade_offshore;
      }
      const pOn = item.pl_anterior ?? 0;
      if (pOn > 0 && item.rentabilidade_onshore != null) {
        pesoOn += pOn;
        somaRentOn += pOn * item.rentabilidade_onshore;
      }
    }

    // Rentabilidade ponderada — fallback p/ rent do primeiro se peso zero
    // (ex: ambas as contas começaram do zero no mês).
    if (pesoOff > 0) base.rentabilidade_offshore = somaRentOff / pesoOff;
    if (pesoOn > 0) base.rentabilidade_onshore = somaRentOn / pesoOn;

    base.contas_agregadas = grupo
      .map(g => g.codigo_conta).filter((c): c is string => !!c);
    base._arquivo = grupo.map(g => g._arquivo).join(', ');

    console.log(
      `[Import] Agregados ${grupo.length} items de "${base.nome_cliente}" — `
      + `pl_offshore_usd=${base.pl_offshore_usd?.toFixed(2)}, `
      + `starting_usd=${base.starting_value_usd?.toFixed(2)}, `
      + `cashflow=${base.aporte_mes_offshore?.toFixed(2)}, `
      + `rent%=${base.rentabilidade_offshore?.toFixed(4) ?? 'n/a'} `
      + `(contas: ${base.contas_agregadas.join(', ') || 'sem código'})`,
    );

    agregados.push(base);
  }
  return agregados;
}

function sanitizeDoc(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}


/** Extrai texto de um PDF via pdfjs-dist. Filtra páginas vazias. */
async function extrairTextoPDF(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const texto = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').trim();
    if (texto) paginas.push(texto);
  }
  return paginas.join('\n');
}

export function useImportPoupanca() {
  const [tipo, setTipo] = useState<TipoImport>('offshore');
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [previewMulti, setPreviewMulti] = useState<RegistroMensal[]>([]);
  const [nomeClienteMulti, setNomeClienteMulti] = useState<string>('');
  // Frente 1.2 — quando o multi-período não resolve a sigla, guarda o
  // código bruto aqui para o save gravar com status='pendente_normalizacao'.
  // null = sigla resolvida normalmente.
  const [siglaBrutaMulti, setSiglaBrutaMulti] = useState<string | null>(null);

  const [ptaxAtual, setPtaxAtual] = useState<number | null>(null);
  const [ptaxData, setPtaxData] = useState<string | null>(null);
  const [ptaxLoading, setPtaxLoading] = useState(false);
  const [ptaxErro, setPtaxErro] = useState<string | null>(null);

  // Estado para resolução de siglas novas (offshore). Quando o parse encontra
  // códigos não mapeados, o fluxo pausa: siglasNaoMapeadas é exposto p/ a UI
  // (ResolverSiglasModal) e arquivosPendentes guarda o input p/ re-tentativa.
  const [siglasNaoMapeadas, setSiglasNaoMapeadas] = useState<SiglaNaoMapeada[]>([]);
  const [arquivosPendentes, setArquivosPendentes] = useState<
    { files: File[]; anoRef?: number; mesRef?: number } | null
  >(null);

  // Estado para Frente 1.3 / Frente 3 — siglas onshore que caíram em quarentena.
  // Diferente do offshore: NÃO pausa o upload (decisão CFO: importar e
  // reconciliar depois). Acumulado por sigla bruta deduplicada — N meses do
  // multi-período viram 1 entrada. Frente 3 consumirá para exibir relatório
  // de pendências ao fim do upload.
  const [siglasQuarentenaOnshore, setSiglasQuarentenaOnshore] = useState<Set<string>>(new Set());

  const buscarPTAX = useCallback(async (ano: number, mes: number) => {
    setPtaxLoading(true);
    setPtaxErro(null);
    try {
      const resultado = await buscarPTAXFechamento(ano, mes);
      setPtaxAtual(resultado.ptax);
      setPtaxData(resultado.data);
    } catch (e) {
      setPtaxErro(e instanceof Error ? e.message : String(e));
      setPtaxAtual(null);
      setPtaxData(null);
    } finally {
      setPtaxLoading(false);
    }
  }, []);

  // [NOVO] Processa PDF multi-período (onshore)
  const processarMultiPeriodo = useCallback(async (file: File) => {
    setProcessando(true);
    setErro(null);
    setPreviewMulti([]);
    setNomeClienteMulti('');
    setSiglaBrutaMulti(null);
    try {
      console.log('[ImportMultiPeriodo] Processando:', file.name);
      const texto = await extrairTextoPDF(file);

      // Resolver sigla do texto (busca "Carteira: XXX_C")
      const matchCarteira = texto.match(/Carteira:\s*(\S+)/i);
      const codigoCarteira = matchCarteira?.[1] ?? '';

      // Resolução canônica (Frente 1.1) — paridade com offshore + single-period:
      //   resolverSigla hardcoded → mapeamentoFirestore → null (= quarentena).
      const mapeamento = await buscarMapeamentoSiglas();
      const resultado = resolverSigla(codigoCarteira);
      if (resultado.metodo === 'prefix_match') {
        console.warn(
          `[Mapeamento] PREFIX-MATCH disparou (multi-período): código="${codigoCarteira}" `
          + `→ sigla=${resultado.sigla}. Verifique se está correto.`,
        );
      }
      const entradaFs = !resultado.sigla ? (mapeamento[codigoCarteira] ?? null) : null;
      const sigla = resultado.sigla ?? entradaFs?.sigla ?? null;

      // Quarentena (Frente 1.2): sigla não resolvida — registra a sigla bruta
      // e usa-a como label visual no preview. Save grava com nome_cliente=''
      // + status='pendente_normalizacao' + sigla_bruta_origem=codigoCarteira.
      // O upload NÃO pausa (decisão CFO).
      if (!sigla) {
        console.warn(
          `[ImportMultiPeriodo] Sigla não resolvida: codigoCarteira="${codigoCarteira}" `
          + `— registros vão para quarentena.`,
        );
        setSiglaBrutaMulti(codigoCarteira);
        // Preview mostra a sigla bruta para o usuário ver o que está em quarentena.
        setNomeClienteMulti(codigoCarteira);
        // Acumula no state de pendências (Frente 3 vai consumir).
        setSiglasQuarentenaOnshore(prev => new Set([...prev, codigoCarteira]));
        // Parser ainda roda — extrai os meses; o save é que vai para quarentena.
        const registros = await parseMultiPeriodoComClaude(texto, codigoCarteira);
        setPreviewMulti(registros);
        console.log(`[ImportMultiPeriodo] ${codigoCarteira} (quarentena): ${registros.length} meses`);
        setProcessando(false);
        return;
      }

      // Resolveu — prioriza nome do Firestore (manual) sobre SIGLA_PARA_NOME.
      const nomeCompleto = entradaFs?.nome_cliente ?? SIGLA_PARA_NOME[sigla] ?? sigla;
      setNomeClienteMulti(nomeCompleto);

      const registros = await parseMultiPeriodoComClaude(texto, sigla);
      console.log('[DEBUG tombamento] registros do parser:',
        JSON.stringify(registros.map(r => ({
          mes: r.mes,
          ano: r.ano,
          pl_inicial_total: r.pl_inicial_total,
          aporte_mes_total: r.aporte_mes_total,
          rentabilidade_total: r.rentabilidade_total,
          pl_total: r.pl_total,
          nnm_linha_abertura: r.nnm_linha_abertura ?? null,
        })), null, 2),
      );
      setPreviewMulti(registros);
      console.log(`[ImportMultiPeriodo] ${nomeCompleto}: ${registros.length} meses`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ImportMultiPeriodo] Erro:', e);
      setErro(msg);
    } finally {
      setProcessando(false);
    }
  }, []);

  // [NOVO] Salva registros multi-período no Firestore
  const salvarMultiPeriodo = useCallback(async () => {
    if (previewMulti.length === 0 || !nomeClienteMulti) return;
    setSalvando(true);
    setToast(null);
    try {
      // Frente 1.2 — Opção D1: docId baseado em sigla bruta quando em
      // quarentena; senão, nome canônico (padrão atual).
      const emQuarentena = siglaBrutaMulti != null;
      const slugBase = emQuarentena ? slug(siglaBrutaMulti) : slug(nomeClienteMulti);
      for (let i = 0; i < previewMulti.length; i += BATCH_LIMIT) {
        const chunk = previewMulti.slice(i, i + BATCH_LIMIT);
        const promises = chunk.map(r => {
          const docId = `${slugBase}_${r.ano}_${r.mes}`;

          // ── Detecção de mês de tombamento (Comdinheiro) ──
          // Convenção do sistema (alinhada ao resto do código):
          //   aporte_mes_onshore armazenado = NNM BRUTO (B - C, INCLUI tomb)
          //   nnm_tombamento_onshore       = valor do tombamento separado
          //   poupança líquida = aporte - tomb (computada em tempo de display)
          //
          // Fonte prioritária: campo `nnm_linha_abertura` do parser. Quando > 0,
          // indica que a linha "(i) DD/MM/YYYY" tem data != dia 1 do mês
          // (carteira nova aberta no meio do mês) e seu E é o tombamento bruto.
          //
          // Fallback (detecção matemática) quando nnm_linha_abertura está ausente:
          //   Tipo 0 (normal):  G = A + NNM + F - D
          //   Tipo 1 (pi inflado): G = NNM + F - D, A > 0 → pi=0, tomb=A
          //   Tipo 2 (aporte duplo-contado): G = (NNM-A) + F - D, A > 0 → pi=0, aporte=NNM-A, tomb=A
          //   Tipo 3 (pi=0, aporte inflado): A≈0, NNM>G/2, resíduo > 0 → tomb=resíduo
          const A = r.pl_inicial_total ?? 0;
          const NNM = r.aporte_mes_total ?? 0;
          const F = r.rentabilidade_total ?? 0;
          const D = r.impostos_mes ?? 0;
          const G = r.pl_total ?? 0;
          let tombAbertura = r.nnm_linha_abertura ?? null;
          const TOL = 0.05;

          // Sanity check: se NNM + F ≈ G (saldo fecha sem tombamento),
          // a linha "(i)" era data futura e nnm_linha_abertura é espúrio.
          // Comdinheiro às vezes gera lâminas com período invertido
          // (ex: lâmina de Dez/25 com linha "(i) 21/01/2026"), e o parser
          // pode não filtrar isso no prompt. Aqui descartamos o valor.
          if (tombAbertura != null && tombAbertura > TOL) {
            const semTombamento = Math.abs(NNM + F - G) < 1;
            if (semTombamento) {
              console.log(`[Import] ${r.ano}-${r.mes} ${nomeClienteMulti}: nnm_linha_abertura=${tombAbertura} descartado (saldo fecha sem tombamento — linha (i) provavelmente futura)`);
              tombAbertura = null;
            }
          }

          let storedPi = A;
          let storedAporte = NNM;
          let tombVal = 0;

          if (tombAbertura != null && tombAbertura > TOL && tombAbertura <= NNM + 1) {
            // Fonte prioritária: parser extraiu a linha de abertura.
            // Claude soma E_(i) + E_mes em aporte_mes_total, fazendo o tombamento
            // aparecer 2 vezes (uma na soma, outra em nnm_linha_abertura).
            // Identidade: NNM_bruto + tombamento = aporte_mes_total → NNM_bruto = NNM - tomb
            // Convenção do sistema: aporte armazenado = NNM bruto (= B - C, sem double count).
            storedPi = 0;
            storedAporte = NNM - tombAbertura;
            tombVal = tombAbertura;
          } else {
            // Fallback matemático
            const d0 = Math.abs((A + NNM + F - D) - G);
            const d1 = Math.abs((NNM + F - D) - G);
            const d2 = Math.abs(((NNM - A) + F - D) - G);

            if (d0 < TOL) {
              // Tipo 0 — nada a fazer
            } else if (d1 < TOL && A > TOL) {
              // Tipo 1
              storedPi = 0;
              storedAporte = NNM;
              tombVal = A;
            } else if (d2 < TOL && A > TOL) {
              // Tipo 2
              storedPi = 0;
              storedAporte = NNM - A;
              tombVal = A;
            } else if (A < TOL && NNM > G * 0.5) {
              // Tipo 3
              const aporteBrutoEsperado = G - F + D;
              const tombCalc = NNM - aporteBrutoEsperado;
              if (tombCalc > TOL) {
                storedPi = 0;
                storedAporte = aporteBrutoEsperado;
                tombVal = tombCalc;
              }
            } else {
              console.warn(`[Import] ${r.ano}-${r.mes} ${nomeClienteMulti}: nenhuma fórmula bate (d0=${d0.toFixed(2)}, d1=${d1.toFixed(2)}, d2=${d2.toFixed(2)}) — salvando valores brutos`);
            }
          }

          const dados: Record<string, unknown> = {
            // Quarentena (Frente 1.2): nome_cliente vazio + status + sigla_bruta_origem.
            // Senão: nome_cliente canônico (padrão atual).
            nome_cliente: emQuarentena ? '' : nomeClienteMulti,
            ano: r.ano, mes: r.mes,
            // Grava APENAS campos onshore — merge: true preserva offshore existente.
            // NÃO gravar pl_offshore: 0 nem pl_total — pl_total será computado em leitura.
            pl_onshore: G,
            pl_inicial_onshore: storedPi,
            aporte_mes_onshore: storedAporte,
            aporte_mes_total: storedAporte,
            rentabilidade_onshore: F,
            rentabilidade_total: F,
            rentabilidade_pct: r.rentabilidade_pct,
          };
          if (r.cdi_mes_pct != null) dados.cdi_mes_pct = r.cdi_mes_pct;
          if (r.impostos_mes != null) dados.impostos_mes = r.impostos_mes;
          if (tombVal > 0) dados.nnm_tombamento_onshore = tombVal;
          // Período parcial: sempre grava (null apaga em reimport de mês completo).
          dados.dia_inicio = r.dia_inicio != null && r.dia_inicio > 1 ? r.dia_inicio : null;
          // Capacidade de poupança: derivada do preview (não mais hardcoded).
          // null/undefined → sem_capacidade=true; número (+ ou −) → sem_capacidade=false.
          // Preserva valores negativos (cliente queima caixa).
          // Parser atual não extrai capacidade → campo fica ausente em dados,
          // e merge: true preserva o que foi gravado pelo import Excel.
          const capPreviewOn = (r as { capacidade_poupanca_mensal?: number | null }).capacidade_poupanca_mensal;
          if (capPreviewOn !== undefined) {
            dados.sem_capacidade_poupanca = capPreviewOn == null;
            if (capPreviewOn != null) dados.capacidade_poupanca_mensal = capPreviewOn;
          }
          // Quarentena (Frente 1.2): grava status + sigla bruta para os N meses
          // do multi-período. Normalização posterior (corrigirNomeClientePoupanca)
          // limpa esses dois campos juntos via match por sigla_bruta_origem.
          if (emQuarentena && siglaBrutaMulti) {
            dados.status = 'pendente_normalizacao';
            dados.sigla_bruta_origem = siglaBrutaMulti;
          }
          return setDoc(doc(db, 'poupanca', docId), sanitizeDoc(dados), { merge: true });
        });
        await Promise.all(promises);
      }
      setToast(`${previewMulti.length} meses salvos com sucesso`);
      setPreviewMulti([]);
    } catch (e) {
      setToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSalvando(false);
    }
  }, [previewMulti, nomeClienteMulti, siglaBrutaMulti]);

  // [NOVO] Aceita ano/mes opcionais para auto-fetch de PTAX no modo offshore
  const processarArquivos = useCallback(async (files: FileList | File[], anoRef?: number, mesRef?: number) => {
    setProcessando(true);
    setErro(null);
    setPreview([]);
    const items: PreviewItem[] = [];
    const erros: string[] = [];

    // Carrega o mapeamento Firestore uma vez por upload — pega entradas
    // adicionadas via ResolverSiglasModal em sessões anteriores.
    const mapeamento = await buscarMapeamentoSiglas();
    const periodoStr = anoRef && mesRef
      ? `${anoRef}-${String(mesRef).padStart(2, '0')}` : undefined;
    const naoMapeadasAcumuladas: SiglaNaoMapeada[] = [];
    const quarentenaOnshoreUpload = new Set<string>();

    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.pdf')) continue;
      try {
        console.log(`[Import${tipo === 'offshore' ? 'Offshore' : 'Onshore'}] Processando: ${file.name}`);
        const textoCompleto = await extrairTextoPDF(file);

        if (tipo === 'offshore') {
          const { registros, siglas_nao_mapeadas } = await parseOffshoreComClaude(
            textoCompleto, mapeamento, periodoStr,
          );
          console.log(`[ImportOffshore] ${file.name}: ${registros.length} resolvidos, ${siglas_nao_mapeadas.length} não mapeados`);
          for (const r of registros) items.push({ ...r, _arquivo: file.name });
          naoMapeadasAcumuladas.push(...siglas_nao_mapeadas);
        } else {
          // Truncar para 4000 chars — onshore é 1 cliente por PDF, não precisa do texto todo.
          // mapeamento (já carregado linha 393) é passado para resolver sigla via
          // canônico+Firestore — paridade com offshore após Frente 1.
          const textoTruncado = textoCompleto.slice(0, 4000);
          const resultado = await parseOnshoreComClaude(textoTruncado, mapeamento);
          console.log('[ImportOnshore] Resposta da API:', resultado);
          if (resultado) {
            items.push({ ...resultado, _arquivo: file.name });
            // Frente 1.3 — acumula sigla para o relatório de pendências.
            if (resultado.status === 'pendente_normalizacao' && resultado.sigla_bruta_origem) {
              quarentenaOnshoreUpload.add(resultado.sigla_bruta_origem);
            }
          }
          else erros.push(`${file.name}: nenhum dado extraído`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Import${tipo === 'offshore' ? 'Offshore' : 'Onshore'}] Erro ao processar ${file.name}:`, e);
        erros.push(`${file.name}: ${msg}`);
      }
    }

    // Pausa o fluxo se há siglas novas — UI mostra ResolverSiglasModal,
    // usuário resolve, aplicarSiglasResolvidas é chamado e re-roda o upload.
    if (naoMapeadasAcumuladas.length > 0) {
      // Dedup por código (vários PDFs podem repetir a mesma sigla nova).
      const dedup = new Map<string, SiglaNaoMapeada>();
      for (const s of naoMapeadasAcumuladas) if (!dedup.has(s.codigo)) dedup.set(s.codigo, s);
      setSiglasNaoMapeadas([...dedup.values()]);
      setArquivosPendentes({ files: Array.from(files), anoRef, mesRef });
      setProcessando(false);
      return;
    }

    // [NOVO] Auto-fetch PTAX para offshore após parsear os PDFs
    if (tipo === 'offshore' && anoRef && mesRef && items.length > 0) {
      try {
        setPtaxLoading(true);
        setPtaxErro(null);
        console.log(`[ImportOffshore] Buscando PTAX para ${mesRef}/${anoRef}...`);
        const resultado = await buscarPTAXFechamento(anoRef, mesRef);
        setPtaxAtual(resultado.ptax);
        setPtaxData(resultado.data);
        console.log(`[ImportOffshore] PTAX: ${resultado.ptax.toFixed(4)} (${resultado.data})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPtaxErro(`PTAX não encontrado — preencha manualmente após o import`);
        setPtaxAtual(null);
        setPtaxData(null);
        console.warn('[ImportOffshore] PTAX não encontrado:', msg);
      } finally {
        setPtaxLoading(false);
      }
    }

    // Agregação por nome_cliente: combina contas distintas que mapeiam para o
    // mesmo cliente (ex: MSAL Andbanc + MSAL JP Morgan → MOISES LIMA MAGALHAES).
    // Sem isso, dois items gerariam o mesmo docId e o save em paralelo causaria
    // sobrescrita silenciosa por race condition.
    const itemsAgregados = agregarItensPorCliente(items);

    // Sanity check de tombamento espúrio (offshore). Heurística: se o cashflow
    // USD extraído do PDF é > 50% do PL final USD, o Claude provavelmente leu
    // a coluna errada (Ending Value como NCF). Quando isso cai num primeiro
    // mês de carteira (hasPrev=false), o save grava nnm_tombamento_offshore
    // desproporcional — bug histórico do Ademilson Abr/26 (R$ 20,6M de
    // tombamento espúrio). Preview ganha badge âmbar para revisão humana.
    if (tipo === 'offshore') {
      for (const it of itemsAgregados) {
        const cashUsd = Math.abs(it.aporte_mes_offshore ?? 0);
        const plUsd = it.pl_offshore_usd ?? 0;
        if (plUsd > 0 && cashUsd > 0.5 * plUsd) {
          it.tombamento_suspeito = true;
          it.tombamento_ratio = cashUsd / plUsd;
          console.warn(
            `[Tombamento] Suspeita no preview: cliente="${it.nome_cliente}" `
            + `cashflow USD=${cashUsd.toFixed(2)} é ${(cashUsd / plUsd).toFixed(1)}× `
            + `do PL USD=${plUsd.toFixed(2)}. Se cair em primeiro mês, gera `
            + `tombamento desproporcional. Verifique a lâmina.`,
          );
        }
      }
    }

    setPreview(itemsAgregados);
    // Frente 1.3 — publica siglas em quarentena acumuladas neste upload.
    // Frente 3 vai consumir para exibir o relatório de pendências.
    if (quarentenaOnshoreUpload.size > 0) {
      setSiglasQuarentenaOnshore(prev => new Set([...prev, ...quarentenaOnshoreUpload]));
      console.log(`[ImportOnshore] ${quarentenaOnshoreUpload.size} sigla(s) em quarentena: ${[...quarentenaOnshoreUpload].join(', ')}`);
    }
    if (itemsAgregados.length === 0 && erros.length === 0) {
      setErro('Nenhum dado extraído dos PDFs. Verifique o formato.');
    } else if (erros.length > 0) {
      setErro(`Erros em ${erros.length} arquivo(s): ${erros.join(' | ')}`);
    }
    setProcessando(false);
  }, [tipo]);

  const salvarNoFirestore = useCallback(async (ano: number, mes: number) => {
    if (preview.length === 0) return;

    // ── OFFSHORE: bloqueia save sem PTAX ──────────────────────────
    // Sem PTAX, a conversão USD→BRL é impossível e o dado vai entrar errado.
    if (tipo === 'offshore' && (ptaxAtual == null || ptaxAtual <= 0)) {
      setToast('Erro: PTAX obrigatória para salvar dados offshore. Busque a PTAX primeiro.');
      return;
    }

    setSalvando(true);
    setToast(null);
    try {
      for (let i = 0; i < preview.length; i += BATCH_LIMIT) {
        const chunk = preview.slice(i, i + BATCH_LIMIT);
        const promises = chunk.map(async item => {
          // DocId — Frente 1.2 (Opção D1 confirmada pelo CFO):
          //   resolvido → slug(nome_cliente)_ano_mes (padrão atual)
          //   quarentena → slug(sigla_bruta_origem)_ano_mes (padrão atual de
          //     órfãos como aae_btg_*, sem prefixo "quarentena_")
          // "Nunca alterar docId" preservado: ao normalizar via
          // corrigirNomeClientePoupanca (2.5), o docId fica intacto; só o
          // conteúdo muda (nome_cliente + remove status/sigla_bruta_origem).
          const emQuarentena = (item as Partial<RegistroPoupanca>).status === 'pendente_normalizacao';
          const baseSlug = emQuarentena
            ? slug((item as Partial<RegistroPoupanca>).sigla_bruta_origem ?? 'desconhecido')
            : slug(item.nome_cliente ?? 'desconhecido');
          const docId = `${baseSlug}_${ano}_${mes}`;

          // Dados comuns a ambos os tipos
          const dados: Record<string, unknown> = {
            nome_cliente: item.nome_cliente, ano, mes,
          };
          // Quarentena (Frente 1.2): propaga campos se presentes.
          if (emQuarentena) {
            dados.status = 'pendente_normalizacao';
            dados.sigla_bruta_origem = (item as Partial<RegistroPoupanca>).sigla_bruta_origem;
          }
          // Capacidade de poupança: derivada do preview (não mais hardcoded).
          // null/undefined → sem_capacidade=true; número (+ ou −) → sem_capacidade=false.
          // Parsers de PDF atuais não extraem capacidade → campo fica ausente
          // em dados e merge: true preserva o que foi gravado pelo import Excel.
          const capPreview = (item as { capacidade_poupanca_mensal?: number | null }).capacidade_poupanca_mensal;
          if (capPreview !== undefined) {
            dados.sem_capacidade_poupanca = capPreview == null;
            if (capPreview != null) dados.capacidade_poupanca_mensal = capPreview;
          }

          if (tipo === 'offshore') {
            // ── OFFSHORE: converte TUDO de USD pra BRL via PTAX ──────
            // NÃO grava pl_onshore → merge: true preserva dados onshore.
            const ptax = ptaxAtual!; // seguro — já bloqueamos acima se null
            const endingUsd = item.pl_offshore_usd ?? 0;
            const startingUsd = item.starting_value_usd ?? 0;
            const cashflowUsd = item.aporte_mes_offshore ?? 0;
            // % da lâmina (coluna MONTH) — gravado apenas como campo informativo.
            const rentPctLamina = (item.rentabilidade_offshore ?? 0) / 100;

            // Buscar ending USD e PTAX do mês anterior (para encadear AUM e capturar accrued).
            const mesPrev = mes === 1 ? 12 : mes - 1;
            const anoPrev = mes === 1 ? ano - 1 : ano;
            const prevSnap = await getDoc(doc(db, 'poupanca', `${baseSlug}_${anoPrev}_${mesPrev}`));
            const prevData = prevSnap.exists() ? prevSnap.data() : null;
            const prevEndingUsd = (prevData?.pl_offshore_usd as number | undefined) ?? 0;
            const prevPtax = (prevData?.ptax_fechamento as number | undefined) ?? ptax;
            const hasPrev = prevEndingUsd > 0.01;

            // Accrued interest: starting da lâmina atual − ending USD do mês anterior.
            // Tratado como cashflow (entra no NNM), para que ganho cambial incida só
            // sobre o PL pré-accrual e o saldo do mês feche exatamente.
            const accrued = hasPrev ? startingUsd - prevEndingUsd : 0;
            const cashflowComAccrued = cashflowUsd + accrued;

            // Rendimento USD via RESIDUAL — fecha o saldo:
            //   AUM_ini + NNM + rent + ganho_cambial = AUM_fin.
            const rentUsd = endingUsd - startingUsd - cashflowUsd;

            dados.pl_offshore_usd = endingUsd;
            dados.pl_offshore = endingUsd * ptax;
            // AUM Inicial BRL = prevEndingUsd × ptaxAnterior (encadeia com o fechamento anterior).
            // Se não há mês anterior: 0 (primeiro mês da carteira).
            dados.pl_inicial_offshore = hasPrev ? prevEndingUsd * prevPtax : 0;
            dados.aporte_mes_offshore = cashflowComAccrued * ptax;
            dados.rentabilidade_offshore = rentUsd * ptax;
            dados.rentabilidade_pct_offshore = rentPctLamina;
            dados.ptax_fechamento = ptax;
            dados.pl_inicial_offshore_usd = startingUsd;

            // Primeiro mês da carteira (sem prev): tombamento = cashflow real em BRL.
            // NÃO usar endingUsd × ptax — inclui a rentabilidade do próprio mês.
            // Cashflow = 0 no primeiro mês: não grava (preserva edição manual existente).
            if (!hasPrev && cashflowUsd > 0.01) {
              const tombBrl = cashflowUsd * ptax;
              dados.nnm_tombamento_offshore = tombBrl;
              // Rede de segurança: se o tombamento prestes a gravar é > 5× o
              // aporte BRL final do mês, é forte sinal de Claude tendo lido
              // a coluna errada. Não bloqueia (admin pode estar reimportando
              // de propósito), mas grita no console pra inspeção.
              const aporteBrlFinal = Math.abs(cashflowComAccrued * ptax);
              if (aporteBrlFinal > 0.01 && tombBrl > 5 * aporteBrlFinal) {
                console.warn(
                  `[Tombamento] SAVE com ratio suspeito: ${baseSlug}_${ano}_${mes} `
                  + `tomb=${tombBrl.toFixed(2)} é ${(tombBrl / aporteBrlFinal).toFixed(1)}× `
                  + `o aporte BRL final=${aporteBrlFinal.toFixed(2)}. Revisar pós-save.`,
                );
              }
            }
            // Período parcial: grava dia_corte (null = mês completo, apaga valor anterior).
            const diaCorte = (item as { dia_corte?: number | null }).dia_corte;
            dados.dia_corte = diaCorte != null && diaCorte > 0 ? diaCorte : null;
            // NÃO gravar pl_onshore, pl_total, aporte_mes_onshore, etc.
            // Todos os *_total são computados em tempo de leitura (usePoupanca).
          } else {
            // ── ONSHORE: grava apenas campos onshore ─────────────────
            // NÃO grava pl_offshore → merge: true preserva dados offshore.
            dados.pl_onshore = item.pl_onshore ?? 0;
            dados.pl_inicial_onshore = item.pl_anterior ?? 0;
            dados.aporte_mes_onshore = item.aporte_mes_onshore ?? 0;
            dados.rentabilidade_onshore = item.rentabilidade_onshore;
            dados.rendimento_nominal_brl = item.rendimento_nominal_brl;
            // NÃO gravar pl_offshore, aporte_mes_offshore, etc.
          }

          return setDoc(doc(db, 'poupanca', docId), sanitizeDoc(dados), { merge: true });
        });
        await Promise.all(promises);
      }
      setToast(`${preview.length} registros salvos com sucesso`);
      setPreview([]);
    } catch (e) {
      setToast(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSalvando(false);
    }
  }, [preview, ptaxAtual, tipo]);

  const limpar = useCallback(() => {
    setPreview([]);
    setErro(null);
    setToast(null);
    // [NOVO] Limpar estado multi-período
    setPreviewMulti([]);
    setNomeClienteMulti('');
    setSiglaBrutaMulti(null);
  }, []);

  /** Salva os mapeamentos resolvidos via UI no Firestore e re-roda o upload
   *  com o cache de arquivos pendentes — agora todos os códigos resolvem. */
  const aplicarSiglasResolvidas = useCallback(async (
    resolucoes: Array<{ codigo: string; sigla: string; nome_cliente: string; registrado_por?: string }>,
  ) => {
    const agora = new Date().toISOString();
    await Promise.all(resolucoes.map(r => salvarEntradaMapeamento({
      codigo: r.codigo, sigla: r.sigla.trim().toUpperCase(),
      nome_cliente: r.nome_cliente.trim(), registrado_em: agora,
      registrado_por: r.registrado_por,
    })));
    // Re-tentativa: usa o cache dos arquivos para reprocessar com o
    // mapeamento atualizado (parser refaz o fetch internamente).
    if (arquivosPendentes) {
      const { files, anoRef, mesRef } = arquivosPendentes;
      setArquivosPendentes(null);
      setSiglasNaoMapeadas([]);
      await processarArquivos(files, anoRef, mesRef);
    }
  }, [arquivosPendentes, processarArquivos]);

  /** Cancela um upload pausado por siglas não mapeadas — descarta o cache. */
  const cancelarSiglasResolvidas = useCallback(() => {
    setArquivosPendentes(null);
    setSiglasNaoMapeadas([]);
  }, []);

  return {
    tipo, setTipo, preview, processando, salvando,
    erro, toast, processarArquivos, salvarNoFirestore, limpar,
    ptaxAtual, ptaxData, ptaxLoading, ptaxErro, buscarPTAX,
    previewMulti, nomeClienteMulti,
    processarMultiPeriodo, salvarMultiPeriodo,
    siglasNaoMapeadas, aplicarSiglasResolvidas, cancelarSiglasResolvidas,
    // Frente 1.3 — Frente 3 consome para exibir relatório de pendências.
    siglasQuarentenaOnshore,
  };
}
