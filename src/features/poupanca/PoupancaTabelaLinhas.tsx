// --- Renderização da tabela de clientes por visão (com ordenação e filtro) ---

import { useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { formatCurrency, getSiglaCliente } from '../../utils/formatters';
import type { RegistroPoupanca } from '../../types';
import type { LinhaTabela, Visao } from './PoupancaTabela';
import { TabelaStatusBar } from './TabelaStatusBar';
import { useOrdenacao } from './useOrdenacao';
import { ThOrdenavel } from './ThOrdenavel';
import { FiltroCheckbox } from './FiltroCheckbox';

interface Props {
  linhas: LinhaTabela[];
  visao: Visao;
  clientesSemBanker?: Set<string>;
  onClienteClick: (registros: RegistroPoupanca[]) => void;
}

const TH_R = 'px-3 py-2 text-xs font-bold uppercase text-right';
const TD_R = 'px-3 py-2 text-xs text-right';

function statusLabel(l: LinhaTabela): string {
  if (l.tombamentoTotal > 0 && l.nnmPoupancaLiquida <= 0 && l.nnmCons > 0) return 'Só tombamento';
  if (l.nnmPoupancaLiquida <= 0) return 'Sem NNM';
  if (l.metaPeriodo && l.nnmPoupancaLiquida >= l.metaPeriodo) return 'Acima da meta';
  if (l.metaPeriodo && l.nnmPoupancaLiquida > 0) return 'Abaixo';
  return 'Positivo';
}
function cor(v: number | null) {
  if (v == null) return undefined;
  return v < 0 ? { color: '#dc2626' } : v > 0 ? { color: '#16a34a' } : undefined;
}

function pick(l: LinhaTabela, v: Visao) {
  if (v === 'onshore') return { pi: l.plIniOn, pf: l.plFimOn, nnm: l.nnmOn, rb: l.rentBrlOn, rp: l.rentPctOn };
  if (v === 'offshore') return { pi: l.plIniOff, pf: l.plFimOff, nnm: l.nnmOff, rb: l.rentBrlOff, rp: l.rentPctOff };
  return { pi: l.plIniCons, pf: l.plFimCons, nnm: l.nnmCons, rb: l.rentBrlCons, rp: l.rentPctCons };
}

function acessorVisao(visao: Visao) {
  return (l: LinhaTabela, col: string): number | string | null => {
    const d = pick(l, visao);
    switch (col) {
      case 'sigla': return getSiglaCliente(l.nome);
      case 'nome': return l.nome;
      case 'pi': return d.pi;
      case 'nnm': return d.nnm;
      case 'rb': return d.rb;
      case 'rp': return d.rp;
      case 'gc': return l.ganhoCambial;
      case 'pf': return d.pf;
      case 'meta': return l.metaPeriodo;
      case 'status': return l.metaPeriodo ? l.nnmCons / l.metaPeriodo : l.nnmCons;
      default: return null;
    }
  };
}

export function PoupancaTabelaLinhas({ linhas, visao, clientesSemBanker, onClienteClick }: Props) {
  const mostrarGC = visao !== 'onshore';
  const [filtroClientes, setFiltroClientes] = useState<Set<string> | null>(null);
  const [filtroSiglas, setFiltroSiglas] = useState<Set<string> | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<Set<string> | null>(null);

  const nomes = useMemo(() => linhas.map(l => l.nome).sort(), [linhas]);
  const siglas = useMemo(() => [...new Set(linhas.map(l => getSiglaCliente(l.nome)))].sort(), [linhas]);
  const statusVals = useMemo(() => [...new Set(linhas.map(l => statusLabel(l)))].sort(), [linhas]);

  const filtradas = useMemo(() => {
    let lista = linhas;
    if (filtroSiglas) lista = lista.filter(l => filtroSiglas.has(getSiglaCliente(l.nome)));
    if (filtroClientes) lista = lista.filter(l => filtroClientes.has(l.nome));
    if (filtroStatus) lista = lista.filter(l => filtroStatus.has(statusLabel(l)));
    return lista;
  }, [linhas, filtroClientes, filtroSiglas, filtroStatus]);

  const acessor = useCallback(acessorVisao(visao), [visao]);
  const { ordenados, coluna, direcao, alternar } = useOrdenacao(filtradas, acessor);

  const totais = useMemo(() => {
    let pi = 0, pf = 0, nnm = 0, rb = 0, gc = 0, temGc = false, metaPeriodo = 0;
    let srp = 0, sp = 0;
    for (const l of ordenados) {
      const d = pick(l, visao);
      pi += d.pi; pf += d.pf; nnm += d.nnm; rb += d.rb;
      if (l.metaPeriodo) metaPeriodo += l.metaPeriodo;
      if (d.rp != null && d.pf > 0) { srp += d.rp * d.pf; sp += d.pf; }
      if (l.ganhoCambial != null) { gc += l.ganhoCambial; temGc = true; }
    }
    return { pi, pf, nnm, rb, metaPeriodo, gc: temGc ? gc : null, rpMedia: sp > 0 ? srp / sp : 0 };
  }, [ordenados, visao]);

  const thProps = { colunaAtiva: coluna, direcao, onAlternar: alternar };

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#e2e2e8' }}>
      <table className="min-w-full text-sm table-fixed">
        <thead style={{ backgroundColor: '#f9f9fb' }}>
          <tr>
            <ThOrdenavel chave="sigla" label="Sigla" className="px-3 py-2 text-xs font-bold uppercase text-center w-16" {...thProps}>
              <FiltroCheckbox valores={siglas} selecionados={filtroSiglas} onAplicar={setFiltroSiglas} />
            </ThOrdenavel>
            <ThOrdenavel chave="nome" label="Cliente" className="px-3 py-2 text-xs font-bold uppercase text-left w-44" {...thProps}>
              <FiltroCheckbox valores={nomes} selecionados={filtroClientes} onAplicar={setFiltroClientes} />
            </ThOrdenavel>
            <ThOrdenavel chave="pi" label="AUM Inicial" className={`${TH_R} w-28`} {...thProps} />
            <ThOrdenavel chave="nnm" label="NNM" className={`${TH_R} w-24`} {...thProps} />
            <ThOrdenavel chave="rb" label="Rent. R$" className={`${TH_R} w-28`} {...thProps} />
            <ThOrdenavel chave="rp" label="Rent. %" className={`${TH_R} w-20`} {...thProps} />
            {mostrarGC && <ThOrdenavel chave="gc" label="G. Cambial" className={`${TH_R} w-28`} {...thProps} />}
            <ThOrdenavel chave="pf" label="AUM Final" className={`${TH_R} w-28`} {...thProps} />
            <ThOrdenavel chave="meta" label="Meta Poupança" className={`${TH_R} w-28`} {...thProps} />
            <ThOrdenavel chave="status" label="Status" className="px-3 py-2 text-xs font-bold uppercase text-center w-28" {...thProps}>
              <FiltroCheckbox valores={statusVals} selecionados={filtroStatus} onAplicar={setFiltroStatus} />
            </ThOrdenavel>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
          {ordenados.map(l => {
            const d = pick(l, visao);
            return (
              <tr key={l.nome} onClick={() => onClienteClick(l.registros)}
                className="cursor-pointer hover:bg-blue-50/40 transition-colors">
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[9px] font-bold"
                    style={{ backgroundColor: '#160F41', color: '#fff' }}>
                    {getSiglaCliente(l.nome)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-medium text-left truncate" style={{ color: '#160F41' }}>
                  <span className="inline-flex items-center gap-1">
                    {l.nome}
                    {clientesSemBanker?.has(l.nome) && (
                      <span title="Sem banker"><AlertTriangle size={12} style={{ color: '#f59e0b' }} /></span>
                    )}
                  </span>
                </td>
                <td className={TD_R}>{d.pi ? formatCurrency(d.pi) : '—'}</td>
                <td className={TD_R} style={cor(d.nnm)}>
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    {formatCurrency(d.nnm)}
                    {l.tombamentoTotal > 0 && (
                      <span title={`NNM Total: ${formatCurrency(l.nnmCons)} | Tombamento: ${formatCurrency(l.tombamentoTotal)} | Poupança líquida: ${formatCurrency(l.nnmPoupancaLiquida)}`}>
                        <Info size={12} style={{ color: '#6b6b8a' }} />
                      </span>
                    )}
                  </span>
                </td>
                <td className={TD_R} style={cor(d.rb)}>{formatCurrency(d.rb)}</td>
                <td className={TD_R} style={d.rp != null && d.rp < 0 ? { color: '#dc2626' } : undefined}>
                  {d.rp != null ? `${(d.rp * 100).toFixed(2)}%` : '—'}
                </td>
                {mostrarGC && (
                  <td className={TD_R} style={cor(l.ganhoCambial)}>
                    {l.ganhoCambial != null ? formatCurrency(l.ganhoCambial) : '—'}
                  </td>
                )}
                <td className={TD_R}>{formatCurrency(d.pf)}</td>
                <td className={TD_R}>{l.metaPeriodo ? formatCurrency(l.metaPeriodo) : '—'}</td>
                <td className="px-2 py-2">
                  <TabelaStatusBar nnm={l.nnmPoupancaLiquida} meta={l.metaPeriodo} metaMensal={l.metaMensal}
                    tombamento={l.tombamentoTotal > 0 && l.nnmPoupancaLiquida <= 0 && l.nnmCons > 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t-2" style={{ borderColor: '#d1d5db' }}>
            <td />
            <td className="px-3 py-2 text-xs font-semibold text-left" style={{ color: '#160F41' }}>
              TOTAL / MÉDIA {filtroClientes || filtroSiglas || filtroStatus ? `(${ordenados.length}/${linhas.length})` : ''}
            </td>
            <td className={`${TD_R} font-semibold`}>{totais.pi ? formatCurrency(totais.pi) : '—'}</td>
            <td className={`${TD_R} font-semibold`} style={cor(totais.nnm)}>{formatCurrency(totais.nnm)}</td>
            <td className={`${TD_R} font-semibold`} style={cor(totais.rb)}>{formatCurrency(totais.rb)}</td>
            <td className={`${TD_R} font-semibold`}>{(totais.rpMedia * 100).toFixed(2)}%</td>
            {mostrarGC && (
              <td className={`${TD_R} font-semibold`} style={cor(totais.gc)}>
                {totais.gc != null ? formatCurrency(totais.gc) : '—'}
              </td>
            )}
            <td className={`${TD_R} font-semibold`}>{formatCurrency(totais.pf)}</td>
            <td className={`${TD_R} font-semibold`}>{totais.metaPeriodo > 0 ? formatCurrency(totais.metaPeriodo) : '—'}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
