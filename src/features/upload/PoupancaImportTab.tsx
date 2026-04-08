// --- Aba Poupança — PDFs (wrapper 2 colunas) ---
// Renderiza ImportPoupanca com layout consistente da Central de Importação.

import { ClipboardList } from 'lucide-react';
import { ImportPoupanca } from '../poupanca/import/ImportPoupanca';

export function PoupancaImportTab() {
  return (
    <div className="grid grid-cols-12 gap-8">
      {/* COLUNA ESQUERDA — cards de import */}
      <div className="col-span-5">
        <div className="bg-white rounded-xl border shadow-sm p-5" style={{ borderColor: '#e2e2e8' }}>
          <ImportPoupanca />
        </div>
      </div>

      {/* COLUNA DIREITA — preview e feedback (renderizado pelo próprio ImportPoupanca via portal ou inline) */}
      <div className="col-span-7">
        <div className="rounded-xl border flex flex-col items-center justify-center h-64"
          style={{ borderColor: '#e2e2e8', backgroundColor: '#f8f9fc' }}>
          <ClipboardList size={48} style={{ color: '#e2e2e8' }} />
          <p className="text-sm mt-3" style={{ color: '#6b6b8a' }}>
            Preview e resultados aparecem no painel à esquerda
          </p>
        </div>
      </div>
    </div>
  );
}
