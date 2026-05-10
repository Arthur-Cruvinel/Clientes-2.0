// --- Migração única: fechamentos/2025-12/clientes → clientes_base/ ---
// Copia apenas campos da interface Cliente base (sem campos calculados).
// Executar uma vez via botão na tela de Configurações.

import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BATCH_LIMIT } from '../utils/constants';
import { slug } from '../utils/slug';

// Campos calculados que NÃO devem ser copiados
const CAMPOS_CALCULADOS = new Set([
  'receita_rebate',
  'receita_fee_mensal',
  'receita_bruta',
  'custo_direto',
  'custo_dedicado',
  'custo_indireto_rateado',
  'custo_total',
  'impostos_faturamento',
  'impostos_lucro',
  'margem_contribuicao',
  'ebitda',
  'margem',
  'classificacao',
  'horas_totais',
  'custo_direto_detalhe',
]);

export interface ResultadoMigracao {
  total: number;
  sucesso: number;
  erros: string[];
}

export async function migrarClientesBase(
  onProgresso?: (msg: string) => void,
): Promise<ResultadoMigracao> {
  const resultado: ResultadoMigracao = { total: 0, sucesso: 0, erros: [] };

  try {
    // 1. Buscar todos os clientes de 2025-12
    onProgresso?.('Buscando clientes de Dez/2025...');
    const ref = collection(db, 'fechamentos', '2025-12', 'clientes');
    const snapshot = await getDocs(ref);
    resultado.total = snapshot.size;

    if (snapshot.empty) {
      resultado.erros.push('Nenhum cliente encontrado em fechamentos/2025-12/clientes');
      return resultado;
    }

    onProgresso?.(`Migrando ${resultado.total} clientes...`);

    // 2. Buscar todos os registros de poupança para encontrar data_entrada de Pure Assets
    onProgresso?.('Buscando dados de poupança para datas de entrada...');
    const poupancaSnap = await getDocs(collection(db, 'poupanca'));
    // Mapa: nome_cliente_upper → período mais antigo (ano*12+mes)
    const primeiroMesPoupanca = new Map<string, { ano: number; mes: number }>();
    poupancaSnap.forEach(d => {
      const data = d.data();
      const nome = ((data.nome_cliente as string) ?? '').trim().toUpperCase();
      const ano = data.ano as number;
      const mes = data.mes as number;
      if (!nome || !ano || !mes) return;
      const periodo = ano * 12 + mes;
      const atual = primeiroMesPoupanca.get(nome);
      if (!atual || periodo < (atual.ano * 12 + atual.mes)) {
        primeiroMesPoupanca.set(nome, { ano, mes });
      }
    });

    // 3. Preparar documentos limpos (sem campos calculados)
    const docs = snapshot.docs.map(d => {
      const data = d.data();

      // Remover campos calculados e campo 'id' (será o slug)
      const limpo: Record<string, unknown> = {};
      for (const [chave, valor] of Object.entries(data)) {
        if (!CAMPOS_CALCULADOS.has(chave) && chave !== 'id' && valor !== undefined) {
          limpo[chave] = valor;
        }
      }

      // Para clientes Pure Asset: buscar data_entrada da poupança
      const isPureAsset = data.pacote_servico === 'asset_only' || (data.receita_fee ?? 0) === 0;
      if (isPureAsset) {
        const nomeUpper = ((data.nome_cliente as string) ?? '').trim().toUpperCase();
        const primeiro = primeiroMesPoupanca.get(nomeUpper);
        if (primeiro) {
          limpo.data_entrada = `${primeiro.ano}-${String(primeiro.mes).padStart(2, '0')}`;
        }
      }

      // Adicionar timestamp de migração
      limpo.migrado_em = new Date().toISOString();

      const nome = (data.nome_cliente as string) ?? '';
      const slugCliente = slug(nome);

      return { slugCliente, nome, dados: limpo };
    });

    // 3. Salvar em batches de 400
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      const promises = chunk.map(({ slugCliente, nome, dados }) => {
        if (!slugCliente) {
          resultado.erros.push(`Slug vazio para cliente: ${nome}`);
          return Promise.resolve();
        }
        return setDoc(doc(db, 'clientes_base', slugCliente), dados)
          .then(() => { resultado.sucesso++; })
          .catch((e: Error) => {
            resultado.erros.push(`${nome}: ${e.message}`);
          });
      });
      await Promise.all(promises);
      onProgresso?.(`Migrando ${resultado.total} clientes... (${Math.min(i + BATCH_LIMIT, docs.length)}/${docs.length})`);
    }

    console.log(`[Migração] Concluída: ${resultado.sucesso}/${resultado.total} clientes migrados`);
    if (resultado.erros.length > 0) {
      console.warn('[Migração] Erros:', resultado.erros);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Migração] Erro fatal:', e);
    resultado.erros.push(`Erro fatal: ${msg}`);
  }

  return resultado;
}
