// --- Aba Poupança — PDFs (largura total) ---
// Renderiza ImportPoupanca em largura total. O layout antigo de 2 colunas
// (col-span-5 controles + col-span-7 placeholder vazio) comprimia a tabela
// de preview a ~530px e cortava colunas. Agora o preview tem ~1200px+
// disponíveis e exibe todas as colunas sem scroll horizontal.

import { ImportPoupanca } from '../poupanca/import/ImportPoupanca';

export function PoupancaImportTab() {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5" style={{ borderColor: '#e2e2e8' }}>
      <ImportPoupanca />
    </div>
  );
}
