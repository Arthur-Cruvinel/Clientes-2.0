// --- Renderização da tabela de clientes por visão (com ordenação e filtro) ---

import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Info, Flag } from 'lucide-react';
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
  // Revisão (cliente-level)
  estaMarcado?: (nome: string) => boolean;
  onToggleRevisao?: (nome: string) => void;
  // Lift de ordenação para o pai (usado pela navegação anterior/próximo)
  onOrdenadosChange?: (nomes: string[]) => void;
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

// Meses até PL zerar (burn rate). Aplicável só quando capacidade < 0 e PL > 0.
function calcBurn(l: LinhaTabela, pl: number): number | null {
  const cap = l.registros[l.registros.length - 1]?.capacidade_poupanca_mensal;
  if (cap == null || cap >= 0 || pl <= 0) return null;
  return Math.ceil(pl / Math.abs(cap));
}

function corBurn(meses: number): string {
  if (meses <= 12) return '#991b1b';   // vermelho escuro — crítico
  if (meses <= 24) return '#d97706';   // âmbar — alerta
  return '#6b7280';                    // cinza — distante
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
      case 'imp': return l.impostosTotal ?? null;
      case 'rp': return d.rp;
      case 'gc': return l.ganhoCambial;
      case 'pf': return d.pf;
      case 'burn': return calcBurn(l, d.pf);
      case 'meta': return l.metaPeriodo;
      case 'status': return l.metaPeriodo ? l.nnmPoupancaLiquida / l.metaPeriodo : l.nnmPoupancaLiquida;
      default: return null;
    }
  };
}

export function PoupancaTabelaLinhas({
  linhas, visao, clientesSemBanker, onClienteClick,
  estaMarcado, onToggleRevisao, onOrdenadosChange,
}: Props) {
  const mostrarGC = visao !== 'onshore';
  // Impostos vêm de lâminas onshore (Comdinheiro), então só fazem sentido em
  // visões que incluem onshore. Na visão pura offshore, escondemos a coluna.
  const mostrarImp = visao !== 'offshore';
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

  // Notifica o pai sempre que a lista ordenada/filtrada mudar — usado pela
  // navegação anterior/próximo no modal de detalhe individual.
  useEffect(() => {
    if (onOrdenadosChange) {
      onOrdenadosChange(ordenados.map(l => l.nome));
    }
  }, [ordenados, onOrdenadosChange]);

  const totais = useMemo(() => {
    let pi = 0, pf = 0, nnm = 0, rb = 0, gc = 0, temGc = false, metaPeriodo = 0;
    let imp = 0, temImp = false;
    let srp = 0, sp = 0;
    for (const l of ordenados) {
      const d = pick(l, visao);
      pi += d.pi; pf += d.pf; nnm += d.nnm; rb += d.rb;
      if (l.metaPeriodo) metaPeriodo += l.metaPeriodo;
      if (d.rp != null && d.pf > 0) { srp += d.rp * d.pf; sp += d.pf; }
      if (l.ganhoCambial != null) { gc += l.ganhoCambial; temGc = true; }
      if (l.impostosTotal != null) { imp += l.impostosTotal; temImp = true; }
    }
    return {
      pi, pf, nnm, rb, metaPeriodo,
      gc: temGc ? gc : null,
      imp: temImp ? imp : null,
      rpMedia: sp > 0 ? srp / sp : 0,
    };
  }, [ordenados, visao]);

  const thProps = { colunaAtiva: coluna, direcao, onAlternar: alternar };

  return (
    <div className="overflow-x-auto overflow-y-auto rounded-lg border" style={{ borderColor: '#e2e2e8', maxHeight: '70vh' }}>
      <table className="min-w-full text-sm table-fixed">
        <thead style={{ backgroundColor: '#f9f9fb', position: 'sticky', top: 0, zIndex: 10 }}>
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
            {mostrarImp && <ThOrdenavel chave="imp" label="Impostos" className={`${TH_R} w-24`} {...thProps} />}
            <ThOrdenavel chave="rp" label="Rent. %" className={`${TH_R} w-20`} {...thProps} />
            {mostrarGC && <ThOrdenavel chave="gc" label="G. Cambial" className={`${TH_R} w-28`} {...thProps} />}
            <ThOrdenavel chave="pf" label="AUM Final" className={`${TH_R} w-28`} {...thProps} />
            <ThOrdenavel chave="burn" label="Burn" className={`${TH_R} w-20`} {...thProps} />
            <ThOrdenavel chave="meta" label="Meta Poupança" className={`${TH_R} w-28`} {...thProps} />
            <ThOrdenavel chave="status" label="Status" className="px-3 py-2 text-xs font-bold uppercase text-center w-28" {...thProps}>
              <FiltroCheckbox valores={statusVals} selecionados={filtroStatus} onAplicar={setFiltroStatus} />
            </ThOrdenavel>
            <th className="px-2 py-2 text-xs font-bold uppercase text-center w-12" title="Marcar para revisão">
              <Flag size={13} style={{ color: '#6b6b8a', display: 'inline-block' }} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
          {ordenados.map(l => {
            const d = pick(l, visao);
            const isOff = visao === 'offshore';
            const marcadoRevisao = estaMarcado?.(l.nome) ?? false;
            return (
              <tr key={l.nome} onClick={() => onClienteClick(l.registros)}
                className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                style={marcadoRevisao ? { backgroundColor: '#fef3c7' } : undefined}>
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
                <td className={TD_R}>
                  {d.pi ? formatCurrency(d.pi) : '—'}
                  {isOff && l.plIniOffUsd > 0.01 && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {l.plIniOffUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                <td className={TD_R} style={cor(d.nnm)}>
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    {formatCurrency(d.nnm)}
                    {l.tombamentoTotal > 0 && (
                      <span title={`NNM Total: ${formatCurrency(l.nnmCons)} | Tombamento: ${formatCurrency(l.tombamentoTotal)} | Poupança líquida: ${formatCurrency(l.nnmPoupancaLiquida)}`}>
                        <Info size={12} style={{ color: '#6b6b8a' }} />
                      </span>
                    )}
                  </span>
                  {isOff && Math.abs(l.nnmOffUsd) > 0.01 && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {l.nnmOffUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                <td className={TD_R} style={cor(d.rb)}>
                  {formatCurrency(d.rb)}
                  {isOff && Math.abs(l.rentBrlOffUsd) > 0.01 && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {l.rentBrlOffUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                {mostrarImp && (
                  <td className={TD_R} style={{ color: l.impostosTotal != null ? '#dc2626' : '#94a3b8' }}>
                    {l.impostosTotal != null ? formatCurrency(l.impostosTotal) : '—'}
                  </td>
                )}
                <td className={TD_R} style={d.rp != null && d.rp < 0 ? { color: '#dc2626' } : undefined}>
                  {d.rp != null ? `${(d.rp * 100).toFixed(2)}%` : '—'}
                </td>
                {mostrarGC && (
                  <td className={TD_R} style={cor(l.ganhoCambial)}>
                    <span className="inline-flex items-center gap-0.5 justify-end">
                      {l.ganhoCambial != null ? formatCurrency(l.ganhoCambial) : '—'}
                      {l.gcAnomalia && (
                        <span title="Cadeia offshore inconsistente (mês faltando ou transferência interna) — câmbio pelo método clássico, não confiável. Revisar.">
                          <AlertTriangle size={11} style={{ color: '#f59e0b' }} />
                        </span>
                      )}
                    </span>
                  </td>
                )}
                <td className={TD_R}>
                  {formatCurrency(d.pf)}
                  {isOff && l.plFimOffUsd > 0.01 && (
                    <span className="block" style={{ fontSize: 10, color: '#94a3b8' }}>USD {l.plFimOffUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                </td>
                {(() => {
                  const burn = calcBurn(l, d.pf);
                  return (
                    <td className={TD_R} style={burn != null ? { color: corBurn(burn), fontWeight: 600 } : { color: '#94a3b8' }}>
                      {burn != null ? `${burn} meses` : '—'}
                    </td>
                  );
                })()}
                <td className={TD_R}>
                  {l.metaPeriodo
                    ? <span style={l.registros[l.registros.length - 1]?.meta_poupanca_mensal ? undefined : { color: '#94a3b8', fontStyle: 'italic' }}
                        title={l.registros[l.registros.length - 1]?.meta_poupanca_mensal ? 'Meta manual' : 'Meta auto (media NNM liq.)'}>
                        {formatCurrency(l.metaPeriodo)}
                      </span>
                    : '—'}
                </td>
                <td className="px-2 py-2">
                  <TabelaStatusBar nnm={l.nnmPoupancaLiquida} meta={l.metaPeriodo} metaMensal={l.metaMensal}
                    tombamento={l.tombamentoTotal > 0 && l.nnmPoupancaLiquida <= 0 && l.nnmCons > 0}
                    capacidade={l.registros[l.registros.length - 1]?.capacidade_poupanca_mensal}
                    semCapacidade={l.registros[l.registros.length - 1]?.sem_capacidade_poupanca} />
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleRevisao?.(l.nome); }}
                    title={marcadoRevisao ? 'Desmarcar revisão' : 'Marcar para revisão'}
                    className="p-1 rounded hover:bg-black/5 transition-colors"
                  >
                    <Flag
                      size={14}
                      style={{
                        color: marcadoRevisao ? '#dc2626' : '#cbd5e1',
                        fill: marcadoRevisao ? '#fca5a5' : 'transparent',
                      }}
                    />
                  </button>
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
            {mostrarImp && (
              <td className={`${TD_R} font-semibold`} style={{ color: totais.imp != null ? '#dc2626' : '#94a3b8' }}>
                {totais.imp != null ? formatCurrency(totais.imp) : '—'}
              </td>
            )}
            <td className={`${TD_R} font-semibold`}>{(totais.rpMedia * 100).toFixed(2)}%</td>
            {mostrarGC && (
              <td className={`${TD_R} font-semibold`} style={cor(totais.gc)}>
                {totais.gc != null ? formatCurrency(totais.gc) : '—'}
              </td>
            )}
            <td className={`${TD_R} font-semibold`}>{formatCurrency(totais.pf)}</td>
            <td />
            <td className={`${TD_R} font-semibold`}>{totais.metaPeriodo > 0 ? formatCurrency(totais.metaPeriodo) : '—'}</td>
            <td />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
