// --- Fila de PDFs com retry automático ---
// Quando a API Anthropic retorna 529 (overloaded), salva o arquivo
// numa fila local e tenta reprocessar a cada 2 minutos.
// Usa funções raw de parsing (que propagam erros) em vez dos hooks de UI.

import { useState, useCallback, useRef, useEffect } from 'react';
import { getDocument } from 'pdfjs-dist';
import { parseMultiPeriodoComClaude, type RegistroMensal } from './parsers/parseMultiPeriodoComClaude';
import { parseOffshoreComClaude } from './parsers/parseComClaude';
import { MAPEAMENTO_SIGLAS, SIGLA_PARA_NOME } from './MAPEAMENTO_SIGLAS';

export interface ItemFila {
  id: string;
  arquivo: File;
  tipo: 'onshore' | 'offshore';
  tentativas: number;
  status: 'aguardando' | 'processando' | 'sucesso' | 'falha';
  erro?: string;
  adicionadoEm: number;
  ultimaTentativaEm?: number;
  anoRef?: number;
  mesRef?: number;
  // Resultado do processamento (para o caller exibir)
  resultadoOnshore?: { nomeCliente: string; registros: RegistroMensal[] };
}

const INTERVALO_RETRY_MS = 2 * 60 * 1000; // 2 minutos
const MAX_TENTATIVAS_FILA = 10;

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

/** Processa onshore diretamente (propaga erro em vez de engolir). */
async function processarOnshoreRaw(file: File): Promise<{ nomeCliente: string; registros: RegistroMensal[] }> {
  const texto = await extrairTextoPDF(file);
  const matchCarteira = texto.match(/Carteira:\s*(\S+)/i);
  const codigoCarteira = matchCarteira?.[1] ?? '';
  const sigla = MAPEAMENTO_SIGLAS[codigoCarteira]
    ?? MAPEAMENTO_SIGLAS[codigoCarteira.replace(/_C$/, '')]
    ?? codigoCarteira;
  const nomeCliente = SIGLA_PARA_NOME[sigla] ?? sigla;
  const registros = await parseMultiPeriodoComClaude(texto, sigla);
  return { nomeCliente, registros };
}

export function useFilaRetry() {
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [retryAtivo, setRetryAtivo] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processandoRef = useRef(false);

  const adicionarNaFila = useCallback((arquivo: File, tipo: 'onshore' | 'offshore', anoRef?: number, mesRef?: number) => {
    const item: ItemFila = {
      id: `${Date.now()}-${arquivo.name}`,
      arquivo,
      tipo,
      tentativas: 0,
      status: 'aguardando',
      adicionadoEm: Date.now(),
      anoRef,
      mesRef,
    };
    setFila(prev => [...prev, item]);
    console.log(`[FilaRetry] Adicionado: ${arquivo.name} (${tipo})`);
  }, []);

  const removerDaFila = useCallback((id: string) => {
    setFila(prev => prev.filter(i => i.id !== id));
  }, []);

  const limparConcluidos = useCallback(() => {
    setFila(prev => prev.filter(i => i.status !== 'sucesso'));
  }, []);

  const processarProximo = useCallback(async () => {
    if (processandoRef.current) return;

    // Buscar próximo pendente atomicamente
    let itemId: string | null = null;
    setFila(prev => {
      const pendente = prev.find(i => i.status === 'aguardando' && i.tentativas < MAX_TENTATIVAS_FILA);
      if (!pendente) return prev;
      itemId = pendente.id;
      return prev.map(i =>
        i.id === pendente.id
          ? { ...i, status: 'processando' as const, tentativas: i.tentativas + 1, ultimaTentativaEm: Date.now() }
          : i,
      );
    });

    if (!itemId) return;

    // Precisamos buscar o item fora do setFila (o state pode não ter atualizado)
    // Usar uma ref para guardar o arquivo
    const itemRef = fila.find(i => i.id === itemId);
    if (!itemRef) return;

    processandoRef.current = true;
    const tentativaNum = itemRef.tentativas + 1;
    console.log(`[FilaRetry] Tentativa ${tentativaNum}/${MAX_TENTATIVAS_FILA}: ${itemRef.arquivo.name}`);

    try {
      if (itemRef.tipo === 'onshore') {
        const resultado = await processarOnshoreRaw(itemRef.arquivo);
        // Sucesso — guardar resultado para o caller usar
        setFila(prev => prev.map(i =>
          i.id === itemId ? { ...i, status: 'sucesso' as const, resultadoOnshore: resultado } : i,
        ));
        console.log(`[FilaRetry] Sucesso: ${itemRef.arquivo.name} — ${resultado.registros.length} meses`);
      } else {
        const texto = await extrairTextoPDF(itemRef.arquivo);
        await parseOffshoreComClaude(texto);
        setFila(prev => prev.map(i =>
          i.id === itemId ? { ...i, status: 'sucesso' as const } : i,
        ));
        console.log(`[FilaRetry] Sucesso: ${itemRef.arquivo.name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const is529 = msg.includes('529') || msg.includes('overloaded') || msg.includes('Overloaded');

      if (is529 && tentativaNum < MAX_TENTATIVAS_FILA) {
        setFila(prev => prev.map(i =>
          i.id === itemId ? { ...i, status: 'aguardando' as const, erro: `529 — tentativa ${tentativaNum}` } : i,
        ));
        console.log(`[FilaRetry] 529 — volta pra fila (${tentativaNum}/${MAX_TENTATIVAS_FILA})`);
      } else {
        setFila(prev => prev.map(i =>
          i.id === itemId ? { ...i, status: 'falha' as const, erro: msg } : i,
        ));
        console.error(`[FilaRetry] Falha: ${itemRef.arquivo.name} — ${msg}`);
      }
    } finally {
      processandoRef.current = false;
    }
  }, [fila]);

  const iniciarRetry = useCallback(() => {
    if (timerRef.current) return;
    setRetryAtivo(true);
    processarProximo();
    timerRef.current = setInterval(() => { processarProximo(); }, INTERVALO_RETRY_MS);
    console.log(`[FilaRetry] Retry iniciado (a cada ${INTERVALO_RETRY_MS / 1000}s)`);
  }, [processarProximo]);

  const pararRetry = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRetryAtivo(false);
  }, []);

  const tentarAgora = useCallback((id: string) => {
    setFila(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'aguardando' as const } : i,
    ));
    setTimeout(processarProximo, 100);
  }, [processarProximo]);

  // Parar timer quando fila esvazia
  useEffect(() => {
    const pendentes = fila.filter(i => i.status === 'aguardando');
    if (pendentes.length === 0 && timerRef.current) {
      pararRetry();
    }
  }, [fila, pararRetry]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return {
    fila,
    pendentes: fila.filter(i => i.status === 'aguardando').length,
    processandoFila: fila.some(i => i.status === 'processando'),
    concluidos: fila.filter(i => i.status === 'sucesso').length,
    falhas: fila.filter(i => i.status === 'falha').length,
    retryAtivo,
    adicionarNaFila, removerDaFila, limparConcluidos,
    iniciarRetry, pararRetry, processarProximo, tentarAgora,
  };
}
