// --- Hook CRUD do módulo Patrimônio por cliente ---
// Gerencia busca, criação, edição e exclusão de ativos e passivos.
// Estrutura Firestore: patrimonio/{clienteSlug}/{categoria}/{id}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { InvestimentoExterno, Imovel, Veiculo, OutroBem, Passivo, RegistroPoupanca } from '../../types';

export interface CarteiraGalapagos {
  pl_onshore: number;
  pl_offshore: number;
  pl_total: number;
  periodo_label: string;
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ── CRUD genérico ────────────────────────────────────────────────────────

async function buscarCategoria<T>(slug: string, cat: string): Promise<T[]> {
  const ref = collection(db, 'patrimonio', slug, cat);
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T);
}

async function salvarCategoria<T extends { id?: string }>(slug: string, cat: string, item: T): Promise<string> {
  const { id, ...dados } = item;
  if (id) {
    await updateDoc(doc(db, 'patrimonio', slug, cat, id), dados);
    return id;
  }
  const novoDoc = await addDoc(collection(db, 'patrimonio', slug, cat), dados);
  return novoDoc.id;
}

async function excluirCategoria(slug: string, cat: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'patrimonio', slug, cat, id));
}

// ── Funções tipadas por categoria ────────────────────────────────────────

export async function buscarInvestimentos(slug: string) { return buscarCategoria<InvestimentoExterno>(slug, 'investimentos'); }
export async function salvarInvestimento(slug: string, item: InvestimentoExterno) { return salvarCategoria(slug, 'investimentos', item); }
export async function excluirInvestimento(slug: string, id: string) { return excluirCategoria(slug, 'investimentos', id); }

export async function buscarImoveis(slug: string) { return buscarCategoria<Imovel>(slug, 'imoveis'); }
export async function salvarImovel(slug: string, item: Imovel) { return salvarCategoria(slug, 'imoveis', item); }
export async function excluirImovel(slug: string, id: string) { return excluirCategoria(slug, 'imoveis', id); }

export async function buscarVeiculos(slug: string) { return buscarCategoria<Veiculo>(slug, 'veiculos'); }
export async function salvarVeiculo(slug: string, item: Veiculo) { return salvarCategoria(slug, 'veiculos', item); }
export async function excluirVeiculo(slug: string, id: string) { return excluirCategoria(slug, 'veiculos', id); }

export async function buscarOutrosBens(slug: string) { return buscarCategoria<OutroBem>(slug, 'outros_bens'); }
export async function salvarOutroBem(slug: string, item: OutroBem) { return salvarCategoria(slug, 'outros_bens', item); }
export async function excluirOutroBem(slug: string, id: string) { return excluirCategoria(slug, 'outros_bens', id); }

export async function buscarPassivos(slug: string) { return buscarCategoria<Passivo>(slug, 'passivos'); }
export async function salvarPassivo(slug: string, item: Passivo) { return salvarCategoria(slug, 'passivos', item); }
export async function excluirPassivo(slug: string, id: string) { return excluirCategoria(slug, 'passivos', id); }

// ── Hook ─────────────────────────────────────────────────────────────────

export function usePatrimonioCrud(clienteSlug: string | null, clienteNome: string | null = null) {
  const [investimentos, setInvestimentos] = useState<InvestimentoExterno[]>([]);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [outrosBens, setOutrosBens] = useState<OutroBem[]>([]);
  const [passivos, setPassivos] = useState<Passivo[]>([]);
  const [carteiraGalapagos, setCarteiraGalapagos] = useState<CarteiraGalapagos | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteSlug) {
      setInvestimentos([]); setImoveis([]); setVeiculos([]); setOutrosBens([]); setPassivos([]);
      setCarteiraGalapagos(null);
      return;
    }
    setLoading(true); setErro(null);
    console.log('[Patrimonio] Carregando:', clienteSlug);
    try {
      const [inv, imo, vei, out, pas] = await Promise.all([
        buscarInvestimentos(clienteSlug),
        buscarImoveis(clienteSlug),
        buscarVeiculos(clienteSlug),
        buscarOutrosBens(clienteSlug),
        buscarPassivos(clienteSlug),
      ]);
      setInvestimentos(inv); setImoveis(imo); setVeiculos(vei); setOutrosBens(out); setPassivos(pas);
      console.log('[Patrimonio] Total ativos:', inv.length + imo.length + vei.length + out.length + pas.length);

      // Buscar carteira Galápagos do módulo AUM & Performance
      if (clienteNome) {
        try {
          const poupSnap = await getDocs(collection(db, 'poupanca'));
          const regs = poupSnap.docs
            .map(d => d.data() as RegistroPoupanca)
            .filter(r => r.nome_cliente === clienteNome)
            .sort((a, b) => (b.ano * 12 + b.mes) - (a.ano * 12 + a.mes));
          if (regs.length > 0) {
            const ult = regs[0];
            setCarteiraGalapagos({
              pl_onshore: ult.pl_onshore ?? 0,
              pl_offshore: ult.pl_offshore ?? 0,
              pl_total: ult.pl_total ?? 0,
              periodo_label: `${MESES_LABEL[(ult.mes ?? 1) - 1]}/${ult.ano ?? ''}`,
            });
          } else { setCarteiraGalapagos(null); }
        } catch { setCarteiraGalapagos(null); }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Patrimonio] Erro:', msg);
      setErro(msg);
    } finally { setLoading(false); }
  }, [clienteSlug, clienteNome]);

  useEffect(() => { carregar(); }, [carregar]);

  // Totais
  const totalAtivos = useMemo(() => {
    let t = 0;
    for (const i of investimentos) t += i.valor_brl ?? i.valor ?? 0;
    for (const i of imoveis) t += i.valor_mercado ?? 0;
    for (const v of veiculos) t += v.valor_fipe ?? v.valor_mercado_manual ?? 0;
    for (const o of outrosBens) t += o.valor_estimado ?? 0;
    return t;
  }, [investimentos, imoveis, veiculos, outrosBens]);

  const totalPassivos = useMemo(() =>
    passivos.reduce((s, p) => s + (p.saldo_devedor ?? 0), 0),
  [passivos]);

  const patrimonioLiquido = totalAtivos - totalPassivos;

  // Wrappers CRUD que fazem refetch após operação
  const wrap = useCallback(<T,>(fn: (slug: string, ...args: T[]) => Promise<unknown>) =>
    async (...args: T[]) => {
      if (!clienteSlug) return;
      await fn(clienteSlug, ...args);
      await carregar();
    }, [clienteSlug, carregar]);

  return {
    investimentos, imoveis, veiculos, outrosBens, passivos,
    carteiraGalapagos, loading, erro,
    totalAtivos, totalPassivos, patrimonioLiquido,
    salvarInvestimento: wrap<InvestimentoExterno>(salvarInvestimento),
    excluirInvestimento: wrap<string>(excluirInvestimento),
    salvarImovel: wrap<Imovel>(salvarImovel),
    excluirImovel: wrap<string>(excluirImovel),
    salvarVeiculo: wrap<Veiculo>(salvarVeiculo),
    excluirVeiculo: wrap<string>(excluirVeiculo),
    salvarOutroBem: wrap<OutroBem>(salvarOutroBem),
    excluirOutroBem: wrap<string>(excluirOutroBem),
    salvarPassivo: wrap<Passivo>(salvarPassivo),
    excluirPassivo: wrap<string>(excluirPassivo),
    refetch: carregar,
  };
}
