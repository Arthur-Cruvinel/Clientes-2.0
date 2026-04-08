// --- Hook de importação de PDFs de poupança (offshore/onshore) ---
// Extrai texto via pdfjs-dist, parseia via Claude API, salva no Firestore.

import { useState, useCallback } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { db } from '../../../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { BATCH_LIMIT } from '../../../utils/constants';
import { parseOffshoreComClaude, parseOnshoreComClaude } from './parsers/parseComClaude';
import { buscarPTAXFechamento } from '../../../services/ptax';
// [NOVO] Import do parser multi-período
import { parseMultiPeriodoComClaude, type RegistroMensal } from './parsers/parseMultiPeriodoComClaude';
import { MAPEAMENTO_SIGLAS, SIGLA_PARA_NOME } from './MAPEAMENTO_SIGLAS';

// Configura o worker do pdf.js para funcionar com Vite
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type TipoImport = 'offshore' | 'onshore';
// [NOVO] Modo de import onshore
export type ModoImport = 'unico' | 'multiplo';

export interface PreviewItem {
  nome_cliente?: string;
  starting_value_usd?: number;  // somente exibição no preview offshore
  pl_anterior?: number;         // somente exibição no preview onshore
  pl_onshore?: number;
  pl_offshore_usd?: number;
  aporte_mes_onshore?: number;
  aporte_mes_offshore?: number;
  rentabilidade_onshore?: number;
  rentabilidade_offshore?: number;
  rendimento_nominal_brl?: number | null;  // Rendimento Bruto extraído do PDF (onshore)
  ano?: number;
  mes?: number;
  _arquivo: string;
}

function sanitizeDoc(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

function slugify(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
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
  // [NOVO] Estado multi-período
  const [modoImport, setModoImport] = useState<ModoImport>('unico');
  const [previewMulti, setPreviewMulti] = useState<RegistroMensal[]>([]);
  const [nomeClienteMulti, setNomeClienteMulti] = useState<string>('');

  const [ptaxAtual, setPtaxAtual] = useState<number | null>(null);
  const [ptaxData, setPtaxData] = useState<string | null>(null);
  const [ptaxLoading, setPtaxLoading] = useState(false);
  const [ptaxErro, setPtaxErro] = useState<string | null>(null);

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
    try {
      console.log('[ImportMultiPeriodo] Processando:', file.name);
      const texto = await extrairTextoPDF(file);

      // Resolver sigla do texto (busca "Carteira: XXX_C")
      const matchCarteira = texto.match(/Carteira:\s*(\S+)/i);
      const codigoCarteira = matchCarteira?.[1] ?? '';
      const sigla = MAPEAMENTO_SIGLAS[codigoCarteira]
        ?? MAPEAMENTO_SIGLAS[codigoCarteira.replace(/_C$/, '')]
        ?? codigoCarteira;
      const nomeCompleto = SIGLA_PARA_NOME[sigla] ?? sigla;
      setNomeClienteMulti(nomeCompleto);

      const registros = await parseMultiPeriodoComClaude(texto, sigla);
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
      const slug = slugify(nomeClienteMulti);
      for (let i = 0; i < previewMulti.length; i += BATCH_LIMIT) {
        const chunk = previewMulti.slice(i, i + BATCH_LIMIT);
        const promises = chunk.map(r => {
          const docId = `${slug}_${r.ano}_${r.mes}`;
          const dados: Record<string, unknown> = {
            nome_cliente: nomeClienteMulti,
            ano: r.ano, mes: r.mes,
            pl_onshore: r.pl_total, pl_offshore: 0, pl_total: r.pl_total,
            pl_inicial_onshore: r.pl_inicial_total, pl_inicial_offshore: 0, pl_inicial_total: r.pl_inicial_total,
            aporte_mes_onshore: r.aporte_mes_total, aporte_mes_offshore: 0, aporte_mes_total: r.aporte_mes_total,
            rentabilidade_onshore: r.rentabilidade_total, rentabilidade_offshore: 0,
            rentabilidade_total: r.rentabilidade_total, rentabilidade_pct: r.rentabilidade_pct,
            sem_capacidade_poupanca: false,
          };
          if (r.cdi_mes_pct != null) dados.cdi_mes_pct = r.cdi_mes_pct;
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
  }, [previewMulti, nomeClienteMulti]);

  // [NOVO] Aceita ano/mes opcionais para auto-fetch de PTAX no modo offshore
  const processarArquivos = useCallback(async (files: FileList | File[], anoRef?: number, mesRef?: number) => {
    setProcessando(true);
    setErro(null);
    setPreview([]);
    const items: PreviewItem[] = [];
    const erros: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.pdf')) continue;
      try {
        console.log(`[Import${tipo === 'offshore' ? 'Offshore' : 'Onshore'}] Processando: ${file.name}`);
        const textoCompleto = await extrairTextoPDF(file);

        if (tipo === 'offshore') {
          const resultados = await parseOffshoreComClaude(textoCompleto);
          console.log(`[ImportOffshore] ${file.name}: ${resultados.length} registros extraídos`);
          for (const r of resultados) items.push({ ...r, _arquivo: file.name });
        } else {
          // Truncar para 4000 chars — onshore é 1 cliente por PDF, não precisa do texto todo
          const textoTruncado = textoCompleto.slice(0, 4000);
          const resultado = await parseOnshoreComClaude(textoTruncado);
          console.log('[ImportOnshore] Resposta da API:', resultado);
          if (resultado) items.push({ ...resultado, _arquivo: file.name });
          else erros.push(`${file.name}: nenhum dado extraído`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Import${tipo === 'offshore' ? 'Offshore' : 'Onshore'}] Erro ao processar ${file.name}:`, e);
        erros.push(`${file.name}: ${msg}`);
      }
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

    setPreview(items);
    if (items.length === 0 && erros.length === 0) {
      setErro('Nenhum dado extraído dos PDFs. Verifique o formato.');
    } else if (erros.length > 0) {
      setErro(`Erros em ${erros.length} arquivo(s): ${erros.join(' | ')}`);
    }
    setProcessando(false);
  }, [tipo]);

  const salvarNoFirestore = useCallback(async (ano: number, mes: number) => {
    if (preview.length === 0) return;
    setSalvando(true);
    setToast(null);
    try {
      for (let i = 0; i < preview.length; i += BATCH_LIMIT) {
        const chunk = preview.slice(i, i + BATCH_LIMIT);
        const promises = chunk.map(item => {
          const slug = slugify(item.nome_cliente ?? 'desconhecido');
          const docId = `${slug}_${ano}_${mes}`;
          const dados: Record<string, unknown> = {
            nome_cliente: item.nome_cliente, ano, mes,
            pl_onshore: item.pl_onshore ?? 0,
            pl_offshore: 0, pl_total: 0,
            pl_offshore_usd: item.pl_offshore_usd,
            aporte_mes_onshore: item.aporte_mes_onshore ?? 0,
            aporte_mes_offshore: item.aporte_mes_offshore ?? 0,
            aporte_mes_total: (item.aporte_mes_onshore ?? 0) + (item.aporte_mes_offshore ?? 0),
            rentabilidade_onshore: item.rentabilidade_onshore,
            rentabilidade_offshore: item.rentabilidade_offshore,
            rendimento_nominal_brl: item.rendimento_nominal_brl,
            sem_capacidade_poupanca: false,
          };
          // Incluir PTAX se disponível (import offshore)
          if (ptaxAtual != null) dados.ptax_fechamento = ptaxAtual;
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
  }, [preview, ptaxAtual]);

  const limpar = useCallback(() => {
    setPreview([]);
    setErro(null);
    setToast(null);
    // [NOVO] Limpar estado multi-período
    setPreviewMulti([]);
    setNomeClienteMulti('');
  }, []);

  return {
    tipo, setTipo, preview, processando, salvando,
    erro, toast, processarArquivos, salvarNoFirestore, limpar,
    ptaxAtual, ptaxData, ptaxLoading, ptaxErro, buscarPTAX,
    // [NOVO] Multi-período
    modoImport, setModoImport, previewMulti, nomeClienteMulti,
    processarMultiPeriodo, salvarMultiPeriodo,
  };
}
