import { ArrowUpDown } from 'lucide-react';

export interface ColunaConfig<T> {
  chave: string;
  titulo: string;
  render: (item: T) => React.ReactNode;
  alinhamento?: 'left' | 'right' | 'center';
  ordenavel?: boolean;
  tooltip?: string;   // legenda curta exibida no header (title nativo)
}

interface DataTableProps<T> {
  dados: T[];
  colunas: ColunaConfig<T>[];
  chaveId: (item: T) => string;
  onOrdenar?: (coluna: string) => void;
  colunaOrdenada?: string;
}

export function DataTable<T>({ dados, colunas, chaveId, onOrdenar, colunaOrdenada }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {colunas.map((col) => (
              <th
                key={col.chave}
                className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${
                  col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left'
                } ${col.ordenavel ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                onClick={() => col.ordenavel && onOrdenar?.(col.chave)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.titulo}
                  {col.ordenavel && (
                    <ArrowUpDown size={12} className={colunaOrdenada === col.chave ? 'text-indigo-600' : 'text-gray-300'} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dados.map((item) => (
            <tr key={chaveId(item)} className="hover:bg-gray-50 transition-colors">
              {colunas.map((col) => (
                <td
                  key={col.chave}
                  className={`px-4 py-3 text-sm ${
                    col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
