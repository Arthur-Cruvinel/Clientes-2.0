// --- Lista de clientes do Perfil como tabela com filtros estilo Excel ---
// Substitui o painel lateral simples: 2 colunas (Nome | Pacote), header
// ordenável + filtro por coluna (texto no Nome, checkboxes no Pacote), busca
// geral e badge de pacote. Estado de ordenação/filtros vive em usePerfil.

import { Search, X, Filter } from 'lucide-react';
import { HeaderOrdenavel, type OrdenacaoState } from '../../components/ui/HeaderOrdenavel';
import { COR_PACOTE, labelPacote } from './ClienteCard';
import type { ColunaListaCliente } from './usePerfil';
import type { DadosCliente, PacoteServico } from '../../types';

interface Props {
  clientes: DadosCliente[];
  selecionadoId?: string;
  onSelecionar: (c: DadosCliente) => void;
  busca: string;
  setBusca: (s: string) => void;
  periodoLabel: string;
  ordenacao: OrdenacaoState<ColunaListaCliente>;
  setOrdenacao: (o: OrdenacaoState<ColunaListaCliente>) => void;
  filtroNomeColuna: string;
  setFiltroNomeColuna: (s: string) => void;
  filtroPacotes: PacoteServico[];
  setFiltroPacotes: (p: PacoteServico[]) => void;
  pacotesDisponiveis: PacoteServico[];
  limparFiltros: () => void;
  // Controle do dropdown aberto — UI-only, mora no pai p/ fechar ao trocar.
  dropdown: ColunaListaCliente | null;
  setDropdown: (c: ColunaListaCliente | null) => void;
}

function BadgePacote({ pacote }: { pacote: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
      style={{ backgroundColor: COR_PACOTE[pacote] ?? '#9ca3af' }}>
      {labelPacote(pacote)}
    </span>
  );
}

const TH = 'px-3 py-2 text-[10px] font-bold uppercase';

export function ListaClientesTabela({
  clientes, selecionadoId, onSelecionar, busca, setBusca, periodoLabel,
  ordenacao, setOrdenacao, filtroNomeColuna, setFiltroNomeColuna,
  filtroPacotes, setFiltroPacotes, pacotesDisponiveis, limparFiltros,
  dropdown, setDropdown,
}: Props) {
  const temFiltro = !!filtroNomeColuna || filtroPacotes.length > 0;

  const togglePacote = (p: PacoteServico) =>
    setFiltroPacotes(filtroPacotes.includes(p)
      ? filtroPacotes.filter(x => x !== p)
      : [...filtroPacotes, p]);

  // Botão de filtro no header — abre/fecha o dropdown da coluna e sinaliza ativo.
  const IconeFiltro = ({ coluna, ativo }: { coluna: ColunaListaCliente; ativo: boolean }) => (
    <button type="button" title="Filtrar"
      onClick={e => { e.stopPropagation(); setDropdown(dropdown === coluna ? null : coluna); }}
      className="relative ml-1 p-0.5 rounded hover:bg-gray-200"
      style={{ color: ativo ? '#0065FF' : '#9ca3af' }}>
      <Filter size={11} fill={ativo ? '#0065FF' : 'none'} />
    </button>
  );

  return (
    <div className="w-[380px] flex-shrink-0 rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: '#e2e2e8' }}>
      {periodoLabel && (
        <div className="px-3 pt-2 pb-0">
          <p className="text-[10px]" style={{ color: '#6b6b8a' }}>Dados cadastrais — referência: {periodoLabel}</p>
        </div>
      )}

      {/* Busca geral */}
      <div className="p-3 border-b" style={{ borderColor: '#e2e2e8' }}>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ border: '1px solid #e2e2e8' }}>
          <Search size={14} style={{ color: '#6b6b8a' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente..."
            className="text-sm w-full outline-none bg-transparent" style={{ color: '#160F41' }} />
          {busca && (
            <button type="button" onClick={() => setBusca('')} title="Limpar busca"
              className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          )}
        </div>
      </div>

      {/* Filtros de coluna ativos */}
      {temFiltro && (
        <div className="px-3 py-2 border-b flex items-center gap-1.5 flex-wrap" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
          {filtroNomeColuna && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
              Nome: "{filtroNomeColuna}"
            </span>
          )}
          {filtroPacotes.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
              Pacote: {filtroPacotes.length}
            </span>
          )}
          <button type="button" onClick={limparFiltros}
            className="ml-auto text-[10px] font-medium hover:underline" style={{ color: '#0065FF' }}>
            Limpar filtros
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="flex-1 overflow-y-auto relative">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-30" style={{ backgroundColor: '#f9f9fb' }}>
            <tr>
              <th className={`${TH} text-left`} style={{ position: 'relative' }}>
                <div className="flex items-center">
                  <HeaderOrdenavel titulo="Nome" chave="nome" alinhamento="left"
                    ordenacao={ordenacao} onOrdenar={setOrdenacao} />
                  <IconeFiltro coluna="nome" ativo={!!filtroNomeColuna} />
                </div>
                {dropdown === 'nome' && (
                  <div className="absolute left-2 top-full mt-1 z-50 w-56 rounded-lg border bg-white shadow-lg p-2"
                    style={{ borderColor: '#e2e2e8' }} onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ border: '1px solid #e2e2e8' }}>
                      <Search size={12} style={{ color: '#6b6b8a' }} />
                      <input autoFocus value={filtroNomeColuna} onChange={e => setFiltroNomeColuna(e.target.value)}
                        placeholder="Filtrar por nome..." className="text-xs w-full outline-none bg-transparent normal-case"
                        style={{ color: '#160F41', textTransform: 'none' }} />
                      {filtroNomeColuna && (
                        <button type="button" onClick={() => setFiltroNomeColuna('')} className="text-gray-400 hover:text-gray-600">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </th>
              <th className={`${TH} text-left`} style={{ position: 'relative', width: '110px' }}>
                <div className="flex items-center">
                  <HeaderOrdenavel titulo="Pacote" chave="pacote" alinhamento="left"
                    ordenacao={ordenacao} onOrdenar={setOrdenacao} />
                  <IconeFiltro coluna="pacote" ativo={filtroPacotes.length > 0} />
                </div>
                {dropdown === 'pacote' && (
                  <div className="absolute right-2 top-full mt-1 z-50 w-40 rounded-lg border bg-white shadow-lg p-2"
                    style={{ borderColor: '#e2e2e8' }} onClick={e => e.stopPropagation()}>
                    {pacotesDisponiveis.length === 0 && (
                      <p className="text-[11px] px-1 py-1" style={{ color: '#6b6b8a' }}>Nenhum pacote</p>
                    )}
                    {pacotesDisponiveis.map(p => (
                      <label key={p} className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover:bg-gray-50 normal-case"
                        style={{ textTransform: 'none' }}>
                        <input type="checkbox" checked={filtroPacotes.includes(p)} onChange={() => togglePacote(p)} className="rounded" />
                        <BadgePacote pacote={p} />
                      </label>
                    ))}
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {clientes.map(cli => {
              const sel = !!cli.id && cli.id === selecionadoId;
              return (
                <tr key={cli.id ?? cli.nome_cliente} onClick={() => onSelecionar(cli)}
                  className={`cursor-pointer transition-colors ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  style={{ borderLeft: sel ? '3px solid #0065FF' : '3px solid transparent' }}>
                  <td className="px-3 py-2.5">
                    <span className="text-sm font-medium block truncate" style={{ color: '#160F41', maxWidth: '230px' }}
                      title={cli.nome_cliente}>{cli.nome_cliente}</span>
                  </td>
                  <td className="px-3 py-2.5"><BadgePacote pacote={cli.pacote_servico} /></td>
                </tr>
              );
            })}
            {clientes.length === 0 && (
              <tr><td colSpan={2} className="p-4 text-sm text-center" style={{ color: '#6b6b8a' }}>Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Backdrop p/ fechar dropdown ao clicar fora */}
      {dropdown && <div className="fixed inset-0 z-40" onClick={() => setDropdown(null)} />}
    </div>
  );
}
