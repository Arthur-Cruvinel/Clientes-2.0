// --- Central de Importação (3 abas com layout consistente) ---

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, FileText, Trash2, Building2, Scale } from 'lucide-react';
import { UploadImport } from './UploadImport';
import { PoupancaImportTab } from './PoupancaImportTab';
import { PatrimonioImportTab } from './PatrimonioImportTab';
import { GerenciarDados } from './GerenciarDados';
import { ConsumoJuridicoImport } from '../juridico/import/ConsumoJuridicoImport';

type Aba = 'excel' | 'poupanca' | 'patrimonio' | 'juridico' | 'gerenciar';

const TABS: { id: Aba; label: string; icon: typeof FileSpreadsheet }[] = [
  { id: 'excel', label: 'Excel & Dados', icon: FileSpreadsheet },
  { id: 'poupanca', label: 'AUM & Performance — PDFs', icon: FileText },
  { id: 'patrimonio', label: 'Patrimônio', icon: Building2 },
  { id: 'juridico', label: 'Consumo Jurídico', icon: Scale },
  { id: 'gerenciar', label: 'Gerenciar Dados', icon: Trash2 },
];

export function Upload() {
  const [params] = useSearchParams();
  const abaParam = params.get('aba');
  const ABAS_VALIDAS: Aba[] = ['excel', 'poupanca', 'patrimonio', 'juridico', 'gerenciar'];
  const [aba, setAba] = useState<Aba>(
    (ABAS_VALIDAS as string[]).includes(abaParam ?? '') ? (abaParam as Aba) : 'excel',
  );

  useEffect(() => {
    if ((ABAS_VALIDAS as string[]).includes(abaParam ?? '')) setAba(abaParam as Aba);
  }, [abaParam]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#160F41' }}>Central de Importação</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6b6b8a' }}>
          Gerencie importações e dados da plataforma
        </p>
      </div>

      <div className="flex border-b" style={{ borderColor: '#e2e2e8' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const ativo = aba === t.id;
          return (
            <button key={t.id} onClick={() => setAba(t.id)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                ativo ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
              }`}
              style={{ color: ativo ? '#0065FF' : '#6b6b8a' }}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {aba === 'excel' && <UploadImport />}
      {aba === 'poupanca' && <PoupancaImportTab />}
      {aba === 'patrimonio' && <PatrimonioImportTab />}
      {aba === 'juridico' && <ConsumoJuridicoImport />}
      {aba === 'gerenciar' && <GerenciarDados />}
    </div>
  );
}
