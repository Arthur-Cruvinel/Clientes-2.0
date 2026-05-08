// --- Migração one-shot: SIGLA_PARA_NOME (hardcoded) → mapeamento_siglas/ ---
// Executável via botão admin em Configurações. Popula o Firestore com as
// entradas do dicionário hardcoded para que o lookup do parser passe a
// consultar uma única fonte (Firestore) em todos os ambientes.

import { SIGLA_PARA_NOME } from '../features/poupanca/import/MAPEAMENTO_SIGLAS';
import { salvarEntradaMapeamento } from '../services/firebase';

export async function executarMigracaoMapeamento(
  usuarioNome: string,
  onProgress?: (atual: number, total: number) => void,
): Promise<{ migrados: number; erros: string[] }> {
  // Cada par sigla→nome vira uma entrada. O `codigo` da entrada é a própria
  // sigla — assim o parser resolve via mapeamentoFirestore[codigo_conta]
  // quando o código de conta bater com a sigla pura (ex: "ABJ" → "ABJ").
  const agora = new Date().toISOString();
  const entradas = Object.entries(SIGLA_PARA_NOME).map(([sigla, nome]) => ({
    codigo: sigla,
    sigla,
    nome_cliente: nome,
    registrado_em: agora,
    registrado_por: usuarioNome,
  }));

  const erros: string[] = [];
  let migrados = 0;

  for (let i = 0; i < entradas.length; i++) {
    try {
      await salvarEntradaMapeamento(entradas[i]);
      migrados++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erros.push(`${entradas[i].sigla}: ${msg}`);
    }
    onProgress?.(i + 1, entradas.length);
  }

  return { migrados, erros };
}
