// --- Preview dos campos extraídos de um documento por IA ---

import { FileSearch, Info, AlertTriangle } from 'lucide-react';
import type { CampoExtraido } from './useDocumentParser';

interface Props {
  campos: Record<string, CampoExtraido<unknown>>;
  documento_tipo: string;
  avisos: string[];
  onAplicar: () => void;
  onDescartar: () => void;
}

const LABEL: Record<string, string> = {
  descricao: 'Descrição', tipo: 'Tipo', endereco: 'Endereço', bairro: 'Bairro',
  cidade: 'Cidade', uf: 'UF', cep: 'CEP', area_total_m2: 'Área Total (m²)',
  area_privativa_m2: 'Área Privativa', quartos: 'Quartos', banheiros: 'Banheiros',
  vagas_garagem: 'Vagas', andar: 'Andar', ano_construcao: 'Ano Construção',
  valor_compra: 'Valor Compra', data_compra: 'Data Compra', valor_aluguel: 'Aluguel',
  marca: 'Marca', modelo: 'Modelo', ano_modelo: 'Ano Modelo', ano_fabricacao: 'Ano Fabricação',
  placa: 'Placa', renavam: 'RENAVAM', cor: 'Cor', combustivel: 'Combustível', chassi: 'Chassi',
  credor: 'Credor', saldo_devedor: 'Saldo Devedor', taxa_juros_mensal: 'Taxa Juros',
  sistema_amortizacao: 'Sistema', parcela_atual: 'Parcela', parcelas_restantes: 'Restantes',
  data_inicio: 'Data Início', data_fim: 'Data Fim', bem_vinculado: 'Bem Vinculado',
};

const COR_CONF = {
  alta: { bg: '#ffffff', icon: null },
  media: { bg: '#fffbeb', icon: <Info size={11} style={{ color: '#f59e0b' }} /> },
  baixa: { bg: '#fff7ed', icon: <AlertTriangle size={11} style={{ color: '#f97316' }} /> },
};

export function DocumentParserPreview({ campos, documento_tipo, avisos, onAplicar, onDescartar }: Props) {
  const entries = Object.entries(campos);
  const encontrados = entries.filter(([, c]) => c.valor != null).length;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <FileSearch size={16} style={{ color: '#0065FF' }} />
        <span className="text-xs font-semibold" style={{ color: '#160F41' }}>Dados extraídos de: {documento_tipo}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100" style={{ color: '#1e40af' }}>{encontrados} campos</span>
        {avisos.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100" style={{ color: '#92400e' }}>{avisos.length} avisos</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {entries.map(([key, campo]) => {
          const conf = COR_CONF[campo.confianca] ?? COR_CONF.baixa;
          return (
            <div key={key} className="rounded-lg px-3 py-2" style={{ backgroundColor: campo.valor != null ? conf.bg : '#f3f4f6', border: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: '#64748b' }}>{LABEL[key] ?? key}</span>
                {campo.valor != null && conf.icon && (
                  <span title={campo.trecho_original ?? `Confiança: ${campo.confianca}`}>{conf.icon}</span>
                )}
              </div>
              {campo.valor != null
                ? <p className="text-xs font-medium" style={{ color: '#160F41' }}>{String(campo.valor)}</p>
                : <p className="text-xs italic" style={{ color: '#94a3b8' }}>Não encontrado</p>
              }
            </div>
          );
        })}
      </div>

      {avisos.length > 0 && (
        <div className="rounded-lg p-2 space-y-0.5" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
          {avisos.map((a, i) => <p key={i} className="text-[10px]" style={{ color: '#92400e' }}>{a}</p>)}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onDescartar} className="px-3 py-1.5 rounded-lg text-xs" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Descartar</button>
        <button onClick={onAplicar} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-brand">Aplicar dados ao formulário</button>
      </div>
    </div>
  );
}
