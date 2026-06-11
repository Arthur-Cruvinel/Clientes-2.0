// --- Gerador de Propostas (prospect/simulação) — Parte 2 ---
// EFÊMERO: não persiste nada (BACKLOG: salvar propostas).
//
// Aproximações (prospect não tem vínculos nem folha própria — documentado na UI):
//  - custo direto = Σ horas_reais_função × custo_hora MÉDIO da função (média
//    ponderada por percentual_alocavel dos colaboradores alocáveis da função no
//    período corrente). No cliente real o custo vem de pct×custo do colaborador
//    específico — aqui é uma estimativa pela hora média.
//  - overhead = custo_direto × (pool geral ÷ Σ custo direto do período) — a MESMA
//    proporção do rateio real do motor.
//  - rebate = regra por perna do motor (taxas + alíquotas + split globais).
//  - jurídico/conciliação NÃO são estimados nesta v1 (dependem de peso/volume).

import { useMemo, useState } from 'react';
import { useApp } from '../../state/AppContext';
import {
  somarPctPorColaborador, calcularCustoInstitucional,
} from '../../utils/financials.custos';
import { calcularOciosidade } from '../../utils/financials.alocacao';
import { calcularHorasReais } from '../../utils/financials';
import { ALIQUOTAS, FUNCOES_ALOCACAO } from '../../utils/constants';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { Cliente, FuncaoAlocacao, PacoteServico, RegimeTributario } from '../../types';

const LABEL_F: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Financeira', operacional_financeiro: 'Operacional',
  serv_adm: 'Adm.', serv_aux_adm: 'Aux. Adm.',
};
const PACOTES: PacoteServico[] = ['full', 'advanced', 'light', 'future', 'asset_only'];
const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };

function Num({ label, v, set, step = 1 }: { label: string; v: number; set: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px]" style={{ color: '#6b6b8a' }}>{label}</span>
      <input type="number" step={step} value={v} onChange={e => set(Number(e.target.value))} className={INP} style={BRD} />
    </label>
  );
}
function Chk({ label, v, set }: { label: string; v: boolean; set: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#160F41' }}>
      <input type="checkbox" checked={v} onChange={e => set(e.target.checked)} /> {label}
    </label>
  );
}

export function GeradorProposta() {
  const { dadosPeriodo, regime: regimeGlobal, parametros } = useApp();

  const [pacote, setPacote] = useState<PacoteServico>('full');
  const [regime, setRegime] = useState<RegimeTributario>(regimeGlobal);
  const [veic, setVeic] = useState(0); const [imov, setImov] = useState(0);
  const [grupos, setGrupos] = useState(1); const [domest, setDomest] = useState(0);
  const [planTrib, setPlanTrib] = useState(false); const [revContr, setRevContr] = useState(false); const [obra, setObra] = useState(false);
  const [usaJur, setUsaJur] = useState(false); const [usaConc, setUsaConc] = useState(false);
  const [volMov, setVolMov] = useState(0); const [contratacoes, setContratacoes] = useState(0); const [recebiveis, setRecebiveis] = useState(0);
  const [plOn, setPlOn] = useState(0); const [plOff, setPlOff] = useState(0);
  const [taxaOn, setTaxaOn] = useState((parametros.taxa_rebate_onshore ?? 0) * 100);
  const [taxaOff, setTaxaOff] = useState((parametros.taxa_rebate_offshore ?? 0) * 100);
  const [dContab, setDContab] = useState(0); const [dPgto, setDPgto] = useState(0); const [dAdm, setDAdm] = useState(0); const [dViagem, setDViagem] = useState(0);

  const prop = useMemo(() => {
    if (!dadosPeriodo) return null;
    const { colaboradores, custosIndiretos, resultados, clientes, vinculos } = dadosPeriodo;

    // custo_hora MÉDIO por função (ponderado por percentual_alocavel).
    const custoHoraMedio = (f: FuncaoAlocacao): number => {
      const aloc = colaboradores.filter(c => c.alocavel && c.funcao_principal === f && (c.percentual_alocavel ?? 0) > 0);
      const peso = aloc.reduce((s, c) => s + (c.percentual_alocavel ?? 0), 0);
      return peso > 0 ? aloc.reduce((s, c) => s + (c.custo_hora ?? 0) * (c.percentual_alocavel ?? 0), 0) / peso : 0;
    };
    // proporção de overhead = pool geral ÷ Σ custo direto do período (rateio real).
    const somaPct = somarPctPorColaborador(clientes, colaboradores, vinculos);
    const poolGeral = custosIndiretos.filter(c => c.tipo_custo === 'geral').reduce((s, c) => s + c.valor_mensal, 0)
      + calcularCustoInstitucional(colaboradores) + calcularOciosidade(colaboradores, somaPct);
    const sumDireto = resultados.reduce((s, r) => s + r.custo_direto, 0);
    const overheadRatio = sumDireto > 0 ? poolGeral / sumDireto : 0;

    const cliente: Cliente = {
      nome_cliente: 'Proposta', pacote_servico: pacote, receita_fee: 0,
      percentual_rebate_anual_onshore: taxaOn / 100, percentual_rebate_anual_offshore: taxaOff / 100,
      utiliza_servico_juridico: usaJur, utiliza_conciliacao: usaConc,
      pct_consultoria_gestao: 0, pct_consultoria_planejamento: 0, pct_consultoria_financeira: 0,
      pct_operacional_financeiro: 0, pct_serv_adm: 0, pct_serv_aux_adm: 0,
      volume_movimentos_mes: volMov, qtd_recebiveis_mes: recebiveis, qtd_contratacoes_mes: contratacoes,
      perfil_complexidade: {
        grupos_financeiros: grupos, qtd_veiculos: veic, qtd_imoveis: imov, qtd_funcionarios_domesticos: domest,
        planejamento_tributario: planTrib, revisao_contratos: revContr, gestao_obra: obra,
      },
    } as Cliente;

    const horas = calcularHorasReais(cliente, cliente.perfil_complexidade!);
    const porFuncao = FUNCOES_ALOCACAO.map(f => {
      const h = horas.por_funcao[f] ?? 0; const ch = custoHoraMedio(f);
      return { f, horas: h, custoHora: ch, custo: h * ch };
    });
    const custoDireto = porFuncao.reduce((s, x) => s + x.custo, 0);
    const dedicados = dContab + dPgto + dAdm + dViagem;
    const overhead = custoDireto * overheadRatio;
    const custoTotal = custoDireto + dedicados + overhead;

    const aliqOn = parametros.aliquota_rebate_onshore, aliqOff = parametros.aliquota_rebate_offshore, split = parametros.split_plataforma;
    const rebate = ((plOn * (taxaOn / 100)) / 12 * (1 - aliqOn) + (plOff * (taxaOff / 100)) / 12 * (1 - aliqOff)) * split;

    const aliqFat = ALIQUOTAS[regime].faturamento, margem = parametros.margem_alvo;
    const denom = 1 - aliqFat - margem;
    const receitaNecessaria = denom > 0 ? custoTotal / denom : 0;
    const feeSugerido = receitaNecessaria - rebate;

    return { porFuncao, custoDireto, dedicados, overhead, overheadRatio, custoTotal, rebate, receitaNecessaria, feeSugerido, margem, aliqFat, denomInvalido: denom <= 0, alertas: horas.alertas, totalHoras: horas.total };
  }, [dadosPeriodo, pacote, regime, veic, imov, grupos, domest, planTrib, revContr, obra, usaJur, usaConc, volMov, contratacoes, recebiveis, plOn, plOff, taxaOn, taxaOff, dContab, dPgto, dAdm, dViagem, parametros]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* FORM */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Pacote</span>
            <select value={pacote} onChange={e => setPacote(e.target.value as PacoteServico)} className={INP} style={BRD}>
              {PACOTES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px]" style={{ color: '#6b6b8a' }}>Regime</span>
            <select value={regime} onChange={e => setRegime(e.target.value as RegimeTributario)} className={INP} style={BRD}>
              <option value="presumido">Presumido</option><option value="real">Real</option>
            </select>
          </label>
        </div>

        <Secao titulo="Perfil de complexidade (fixo)">
          <Num label="Veículos" v={veic} set={setVeic} /><Num label="Imóveis" v={imov} set={setImov} />
          <Num label="Grupos financeiros" v={grupos} set={setGrupos} /><Num label="Func. domésticos" v={domest} set={setDomest} />
        </Secao>
        <div className="flex flex-wrap gap-4">
          <Chk label="Planej. tributário" v={planTrib} set={setPlanTrib} /><Chk label="Revisão contratos" v={revContr} set={setRevContr} />
          <Chk label="Gestão de obra" v={obra} set={setObra} /><Chk label="Serv. jurídico" v={usaJur} set={setUsaJur} /><Chk label="Conciliação" v={usaConc} set={setUsaConc} />
        </div>

        <Secao titulo="Volumetria mensal — alimenta: mov.→pagamentos/fluxo; contratações→indicação; recebíveis→conciliação">
          <Num label="Movimentos / mês" v={volMov} set={setVolMov} /><Num label="Contratações / mês" v={contratacoes} set={setContratacoes} /><Num label="Recebíveis / mês" v={recebiveis} set={setRecebiveis} />
        </Secao>

        <Secao titulo="Patrimônio (rebate) e taxas">
          <Num label="PL onshore (R$)" v={plOn} set={setPlOn} step={1000} /><Num label="PL offshore (R$)" v={plOff} set={setPlOff} step={1000} />
          <Num label="Taxa rebate on (% a.a.)" v={taxaOn} set={setTaxaOn} step={0.01} /><Num label="Taxa rebate off (% a.a.)" v={taxaOff} set={setTaxaOff} step={0.01} />
        </Secao>
        <Secao titulo="Custos dedicados estimados (R$/mês)">
          <Num label="Contabilidade" v={dContab} set={setDContab} step={0.01} /><Num label="Plataforma pgto" v={dPgto} set={setDPgto} step={0.01} />
          <Num label="Administrativo" v={dAdm} set={setDAdm} step={0.01} /><Num label="Viagem" v={dViagem} set={setDViagem} step={0.01} />
        </Secao>
      </div>

      {/* SAÍDA */}
      <div className="space-y-3">
        {!prop ? <p className="text-sm" style={{ color: '#6b6b8a' }}>Selecione um período.</p> : prop.denomInvalido ? (
          <p className="text-sm" style={{ color: '#991b1b' }}>Margem alvo + imposto ≥ 100% — ajuste a margem na aba Reajustes.</p>
        ) : (
          <>
            <div className="rounded-lg border p-4 text-center" style={{ borderColor: '#0065FF', backgroundColor: '#f0f6ff' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b8a' }}>Fee sugerido (mensal)</p>
              <p className="text-2xl font-bold" style={{ color: prop.feeSugerido > 0 ? '#160F41' : '#166534' }}>
                {prop.feeSugerido > 0 ? formatCurrency(prop.feeSugerido) : 'Rebate cobre'}
              </p>
              {prop.feeSugerido <= 0 && <p className="text-xs" style={{ color: '#166534' }}>Excedente {formatCurrency(prop.rebate - prop.receitaNecessaria)}</p>}
              <p className="text-[11px] mt-1" style={{ color: '#6b6b8a' }}>margem alvo {formatPercent(prop.margem * 100)} · imp.fat {formatPercent(prop.aliqFat * 100)}</p>
            </div>

            <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
              <table className="min-w-full text-xs">
                <thead style={{ backgroundColor: '#f9f9fb', color: '#6b6b8a' }}>
                  <tr><th className="px-3 py-1.5 text-left font-bold">Função</th><th className="px-3 py-1.5 text-right font-bold">Horas</th><th className="px-3 py-1.5 text-right font-bold">Custo/h méd.</th><th className="px-3 py-1.5 text-right font-bold">Custo</th></tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                  {prop.porFuncao.filter(x => x.horas > 0 || x.custo > 0).map(x => (
                    <tr key={x.f}><td className="px-3 py-1.5" style={{ color: '#160F41' }}>{LABEL_F[x.f]}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: '#6b6b8a' }}>{x.horas.toFixed(1)}h</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: '#6b6b8a' }}>{formatCurrency(x.custoHora)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(x.custo)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-sm rounded-lg p-3" style={{ backgroundColor: '#f3f4f6' }}>
              <L label={`Custo direto (${prop.totalHoras.toFixed(1)}h)`} v={formatCurrency(prop.custoDireto)} />
              <L label="+ Dedicados" v={formatCurrency(prop.dedicados)} />
              <L label={`+ Overhead (×${(prop.overheadRatio).toFixed(3)} do direto)`} v={formatCurrency(prop.overhead)} />
              <L label="= Custo total" v={formatCurrency(prop.custoTotal)} forte />
              <L label="Receita necessária" v={formatCurrency(prop.receitaNecessaria)} />
              <L label="− Rebate líquido estimado" v={formatCurrency(prop.rebate)} />
              <L label="= Fee sugerido" v={prop.feeSugerido > 0 ? formatCurrency(prop.feeSugerido) : formatCurrency(prop.feeSugerido)} forte />
            </div>
            {prop.alertas.map((a, i) => <p key={i} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>⚠ {a}</p>)}
            <p className="text-[11px]" style={{ color: '#9ca3af' }}>Proposta efêmera — não é salva. Custo direto via hora média da função (aproximação: prospect não tem vínculos).</p>
          </>
        )}
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b8a' }}>{titulo}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
function L({ label, v, forte }: { label: string; v: string; forte?: boolean }) {
  return <div className="flex justify-between"><span style={{ color: '#6b6b8a' }}>{label}</span><span className={forte ? 'font-bold' : ''} style={{ color: '#160F41' }}>{v}</span></div>;
}
