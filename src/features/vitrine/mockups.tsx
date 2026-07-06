// --- Mockups ILUSTRATIVOS da Vitrine 360 ---
// TODOS os dados são FICTÍCIOS — nomes de clientes INVENTADOS (nenhum real).
// Recharts para gráficos; nada de fetch/lógica — estático inline. Selo "dados
// ilustrativos" via MockupModulo em todos.

import { MockupModulo } from '../../components/ui/MockupModulo';
import {
  BarChart, Bar, Line, AreaChart, Area, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

const AZUL = '#0065FF';
const ROSA = '#D000BB';
const VERDE = '#166534';
const VERMELHO = '#991b1b';
const AMBAR = '#b45309';

// ── SAÚDE DO CLIENTE ────────────────────────────────────────────────────────
export function MockupSaude() {
  const rows: [string, string, string, string][] = [
    ['Enzo Batista', '58', '🔴', 'gap de preço'],
    ['Rafael Torres', '64', '🟡', 'PL em queda'],
    ['Bruno Amaral', '69', '🟡', 'franquia estourada 3 meses'],
    ['Caio Ribeiro', '73', '🟢', 'estável'],
    ['Diego Fontes', '82', '🟢', 'estável'],
  ];
  return (
    <MockupModulo
      kpis={[{ label: 'Clientes em alerta', valor: '7' }, { label: 'Score médio', valor: '71' }, { label: 'Excedentes ativos', valor: '4' }]}
      tabela={{ colunas: ['Cliente', 'Score', 'Semáforo', 'Motivo'], linhas: rows.map(r => [r[0], r[1], r[2], r[3]]) }}
    />
  );
}

// ── CARTEIRA ────────────────────────────────────────────────────────────────
export function MockupCarteira() {
  const abc = [
    { c: 'Enzo B.', acum: 12 }, { c: 'Rafael T.', acum: 22 }, { c: 'Bruno A.', acum: 31 },
    { c: 'Caio R.', acum: 39 }, { c: 'Diego F.', acum: 55 }, { c: 'Igor M.', acum: 66 },
    { c: 'Lucca P.', acum: 76 }, { c: 'Murilo V.', acum: 86 }, { c: 'Otávio R.', acum: 94 }, { c: 'Théo N.', acum: 100 },
  ];
  return (
    <MockupModulo
      kpis={[{ label: 'Top-5 da receita', valor: '38%' }, { label: 'HHI (concentração)', valor: '0,082' }]}
      grafico={
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={abc} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="c" tick={{ fontSize: 9 }} interval={0} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <ReferenceLine y={80} stroke={VERMELHO} strokeDasharray="4 4" label={{ value: 'Corte 80%', fontSize: 9, fill: VERMELHO }} />
              <Bar dataKey="acum" name="Participação acumulada" fill={AZUL} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[['Estrelas', '3'], ['Vacas leiteiras', '5'], ['Interrogações', '4'], ['Abacaxis', '2']].map(([q, n]) => (
              <div key={q} className="rounded-lg p-2" style={{ backgroundColor: '#f9f9fb' }}>
                <p className="text-[9px] uppercase font-bold" style={{ color: '#6b6b8a' }}>{q}</p>
                <p className="text-sm font-bold" style={{ color: '#160F41' }}>{n}</p>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}

// ── PLANEJAMENTO FINANCEIRO ─────────────────────────────────────────────────
export function MockupPlanejamento() {
  const premissas: [string, string][] = [
    ['Receita mensal', 'R$ 657 mil'], ['Despesa mensal', 'R$ 309 mil'],
    ['Capacidade de poupança', 'R$ 348 mil'], ['Taxa de juros', '14,98% a.a.'],
    ['Inflação', '4,20%'], ['Retorno real', '8,13%'],
    ['Joga até', '34 anos'], ['Expectativa de vida', '90 anos'],
  ];
  const curva = [];
  for (let a = 30; a <= 90; a += 2) {
    if (a <= 34) {
      const r = 5 + (25.7 - 5) * ((a - 30) / 4);
      curva.push({ idade: a, reserva: +r.toFixed(1), preservando: +r.toFixed(1), consumindo: +r.toFixed(1) });
    } else {
      curva.push({
        idade: a,
        reserva: +(25.7 - (a - 34) * 0.12).toFixed(1),
        preservando: +(25.7 - (a - 34) * 0.10).toFixed(1),
        consumindo: +(25.7 - (a - 34) * 0.52).toFixed(1),
      });
    }
  }
  const necessidades: [string, string][] = [
    ['41–43', 'R$ 168,8 mil'], ['44–46', 'R$ 169,3 mil'], ['47–51', 'R$ 170,3 mil'], ['52–90', 'R$ 166,8 mil'],
  ];
  return (
    <MockupModulo
      kpis={[
        { label: 'Reserva no início da aposentadoria', valor: 'R$ 25,7M' },
        { label: 'Necessidade', valor: 'R$ 25,4M' },
        { label: 'Superávit', valor: 'R$ 278 mil' },
      ]}
      grafico={
        <div className="space-y-4">
          {/* Premissas — ficha 2 colunas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
            {premissas.map(([l, v]) => (
              <div key={l} className="flex flex-col">
                <span className="text-[9px] uppercase font-bold" style={{ color: '#6b6b8a' }}>{l}</span>
                <span className="text-[12px] font-bold" style={{ color: '#160F41' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Gráfico central — reserva ao longo da idade + 2 cenários de retirada */}
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={curva} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="idade" tick={{ fontSize: 9 }} unit=" anos" />
              <YAxis tick={{ fontSize: 9 }} unit=" M" />
              <Tooltip formatter={(v) => `R$ ${v} M`} labelFormatter={(l) => `${l} anos`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine y={0} stroke={VERMELHO} strokeWidth={1} />
              <Area type="monotone" dataKey="reserva" name="Reserva" stroke={VERDE} fill={VERDE} fillOpacity={0.18} />
              <Line type="monotone" dataKey="preservando" name="Retirada preservando" stroke={AZUL} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="consumindo" name="Retirada consumindo" stroke={ROSA} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Barra de progresso — independência financeira */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold" style={{ color: '#160F41' }}>Independência Financeira até 90 anos</span>
              <span className="text-[11px] font-bold" style={{ color: VERDE }}>101,1%</span>
            </div>
            <div className="h-2.5 rounded-full" style={{ backgroundColor: '#eee' }}>
              <div className="h-2.5 rounded-full" style={{ width: '100%', backgroundColor: VERDE }} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Necessidades na aposentadoria */}
            <div>
              <p className="text-[10px] uppercase font-bold mb-1.5" style={{ color: '#6b6b8a' }}>Necessidades na aposentadoria</p>
              <table className="min-w-full text-[11px]">
                <thead><tr>
                  <th className="text-left px-2 py-1 text-[9px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Faixa etária</th>
                  <th className="text-right px-2 py-1 text-[9px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Despesa não coberta</th>
                </tr></thead>
                <tbody className="divide-y" style={{ borderColor: '#f3f4f6' }}>
                  {necessidades.map(([f, v]) => (
                    <tr key={f}><td className="px-2 py-1" style={{ color: '#160F41' }}>{f}</td><td className="px-2 py-1 text-right" style={{ color: '#160F41' }}>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Plano vs. Realizado — o diferencial */}
            <div className="rounded-lg p-3" style={{ backgroundColor: '#f0f6ff', border: '1px solid #dbeafe' }}>
              <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#0065FF' }}>Plano vs. Realizado — junho</p>
              <div className="flex items-center gap-4">
                <div><p className="text-[10px]" style={{ color: '#6b6b8a' }}>Planejada</p><p className="text-sm font-bold" style={{ color: '#160F41' }}>R$ 348 mil</p></div>
                <div><p className="text-[10px]" style={{ color: '#6b6b8a' }}>Realizada</p><p className="text-sm font-bold" style={{ color: '#160F41' }}>R$ 312 mil</p></div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: '#fef9c3', color: AMBAR }}>89% — abaixo do plano</span>
              </div>
              <p className="text-[10px] mt-2" style={{ color: '#6b6b8a' }}>Alimentado pela classificação automática do fluxo · Parte V.1.5</p>
            </div>
          </div>
        </div>
      }
    />
  );
}

// ── JURÍDICO ────────────────────────────────────────────────────────────────
export function MockupJuridico() {
  const cols: { titulo: string; n: number; cor: string; cards: { cat: string; porte: string; cli: string; dias: string; resp: string }[] }[] = [
    { titulo: 'Abertas', n: 6, cor: AZUL, cards: [
      { cat: 'Contrato de imagem', porte: 'médio', cli: 'Enzo B.', dias: '3d', resp: 'Dra. Paula' },
      { cat: 'Distrato fornecedor', porte: 'baixo', cli: 'Rafael T.', dias: '1d', resp: 'Dr. André' } ] },
    { titulo: 'Em andamento', n: 4, cor: AMBAR, cards: [
      { cat: 'Parecer societário', porte: 'alto', cli: 'Bruno A.', dias: '8d', resp: 'Dra. Paula' },
      { cat: 'Notificação extrajud.', porte: 'médio', cli: 'Caio R.', dias: '5d', resp: 'Dr. André' },
      { cat: 'Contrato patrocínio', porte: 'alto', cli: 'Diego F.', dias: '11d', resp: 'Dra. Paula' } ] },
    { titulo: 'Concluídas no mês', n: 11, cor: VERDE, cards: [
      { cat: 'Procuração pública', porte: 'baixo', cli: 'Igor M.', dias: '—', resp: 'Dr. André' },
      { cat: 'Aditivo contratual', porte: 'médio', cli: 'Lucca P.', dias: '—', resp: 'Dra. Paula' } ] },
  ];
  const consumo = [
    { c: 'Enzo B.', usado: 5, franquia: 2 }, { c: 'Rafael T.', usado: 2, franquia: 4 },
    { c: 'Bruno A.', usado: 3, franquia: 5 }, { c: 'Caio R.', usado: 1, franquia: 3 },
  ];
  const excedentes: [string, string, string][] = [
    ['Enzo B.', '3 demandas', 'R$ 5,1 mil'], ['Rafael T.', '2 demandas', 'R$ 3,3 mil'],
  ];
  return (
    <MockupModulo
      kpis={[
        { label: 'Demandas no mês', valor: '21' }, { label: 'Tempo médio de resolução', valor: '6,4 dias' },
        { label: 'Clientes na franquia', valor: '9/12' }, { label: 'Excedentes a faturar', valor: 'R$ 8,4 mil' },
      ]}
      grafico={
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {cols.map(col => (
              <div key={col.titulo} className="rounded-lg p-2" style={{ backgroundColor: '#f9f9fb' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold" style={{ color: col.cor }}>{col.titulo}</span>
                  <span className="text-[11px] font-bold" style={{ color: '#160F41' }}>{col.n}</span>
                </div>
                <div className="space-y-1.5">
                  {col.cards.map((c, i) => (
                    <div key={i} className="rounded p-1.5 bg-white border" style={{ borderColor: '#e2e2e8' }}>
                      <p className="text-[10px] font-bold" style={{ color: '#160F41' }}>{c.cat}</p>
                      <p className="text-[9px]" style={{ color: '#6b6b8a' }}>{c.porte} · {c.cli} · {c.dias} · {c.resp}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold mb-1.5" style={{ color: '#6b6b8a' }}>Consumo vs. franquia</p>
              <div className="space-y-1.5">
                {consumo.map(c => {
                  const estourou = c.usado > c.franquia;
                  const pct = Math.min(100, (c.usado / c.franquia) * 100);
                  return (
                    <div key={c.c} className="flex items-center gap-2">
                      <span className="text-[10px] w-16 shrink-0" style={{ color: '#160F41' }}>{c.c}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: '#eee' }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: estourou ? VERMELHO : VERDE }} />
                      </div>
                      <span className="text-[10px] w-14 text-right" style={{ color: estourou ? VERMELHO : '#6b6b8a' }}>{c.usado}/{c.franquia}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold mb-1.5" style={{ color: '#6b6b8a' }}>Excedentes do mês</p>
              <div className="space-y-1">
                {excedentes.map(([cli, qt, vl]) => (
                  <div key={cli} className="flex items-center justify-between text-[11px] rounded px-2 py-1" style={{ backgroundColor: '#fef2f2' }}>
                    <span style={{ color: '#160F41' }}>{cli} · {qt}</span>
                    <span className="font-bold" style={{ color: VERMELHO }}>{vl}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: '#6b6b8a' }}>Excedente vira cobrança — a franquia mede e limita.</p>
            </div>
          </div>
        </div>
      }
    />
  );
}

// ── CONTRATO VIVO ───────────────────────────────────────────────────────────
export function MockupContratoVivo() {
  const cel = (txt: string, alerta = false) => <span style={{ color: alerta ? VERMELHO : '#160F41', fontWeight: alerta ? 700 : 400 }}>{txt}</span>;
  const tend = (txt: string, alerta = false) => <span className="text-[10px]" style={{ color: alerta ? VERMELHO : '#6b6b8a' }}>{txt}</span>;
  return (
    <MockupModulo
      kpis={[
        { label: 'Clientes monitorados', valor: '96' }, { label: 'Com excedente ativo', valor: '4' },
        { label: 'Excedente recorrente 3+ meses', valor: '2' },
      ]}
      grafico={
        <div className="rounded-lg p-3" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
          <p className="text-[10px] uppercase font-bold mb-1" style={{ color: AMBAR }}>Gatilhos — o fechamento da venda</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[12px]" style={{ color: '#160F41' }}>
              <strong>Enzo B.</strong> — imóveis +2 acima há 3 meses → aditivo sugerido: <strong>+R$ 1,9 mil/mês</strong>
            </span>
            <button type="button" className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white" style={{ background: 'linear-gradient(135deg,#0065FF,#D000BB)' }}>
              Gerar aditivo no Simulador
            </button>
          </div>
          <p className="text-[10px] mt-2" style={{ color: '#6b6b8a' }}>O excedente medido vira proposta — telemetria fecha o ciclo da precificação.</p>
        </div>
      }
      tabela={{
        colunas: ['Item', 'Contratado', 'Consumido', 'Últimos 3m', 'Δ'],
        linhas: [
          [cel('Imóveis'), cel('3'), cel('5', true), tend('4 · 5 · 5', true), cel('+2', true)],
          [cel('Movimentos/mês'), cel('350'), cel('410', true), tend('380 · 395 · 410', true), cel('+60', true)],
          [cel('Veículos'), cel('4'), cel('4'), tend('4 · 4 · 4'), cel('0')],
          [cel('Demandas jurídicas'), cel('2'), cel('2'), tend('2 · 2 · 2'), cel('0')],
        ],
      }}
    />
  );
}

// ── PROJEÇÃO ────────────────────────────────────────────────────────────────
export function MockupProjecao() {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dados = meses.map((m, i) => ({
    m, atual: 480 + i * 9,
    pipeline: i < 2 ? 0 : Math.round((i - 1) * 14),
  }));
  return (
    <MockupModulo
      kpis={[{ label: 'Receita dez/26 projetada', valor: 'R$ 612 mil/mês' }, { label: 'Pipes no modelo', valor: '4' }]}
      grafico={
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="m" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} unit=" mil" />
            <Tooltip formatter={(v) => `R$ ${v} mil`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="atual" name="Carteira atual" stackId="1" stroke={AZUL} fill={AZUL} fillOpacity={0.5} />
            <Area type="monotone" dataKey="pipeline" name="Pipeline convertido" stackId="1" stroke={ROSA} fill={ROSA} fillOpacity={0.5} />
          </AreaChart>
        </ResponsiveContainer>
      }
    />
  );
}

// ── AGENTE WHATSAPP ─────────────────────────────────────────────────────────
export function MockupAgente() {
  const ciclo: [string, 'ok' | 'ativo' | 'aberto'][] = [
    ['Pedido identificado no grupo', 'ok'], ['Demanda estruturada', 'ok'],
    ['Aguardando aprovação (gestor)', 'ativo'], ['Lançamento no fluxo', 'aberto'],
  ];
  const icone = (s: string) => s === 'ok' ? '✓' : s === 'ativo' ? '●' : '○';
  return (
    <MockupModulo
      grafico={
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 rounded-lg p-3 space-y-2" style={{ backgroundColor: '#e5ddd5' }}>
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: '#fff', color: '#160F41' }}>
                Consegue ver o contrato da concessionária? <span className="text-[9px]" style={{ color: '#9ca3af' }}>09:14</span>
              </div>
              <div className="max-w-[80%] ml-auto rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: '#dcf8c6', color: '#160F41' }}>
                Recebido, encaminhei ao jurídico — protocolo #241. <span className="text-[9px]" style={{ color: '#6b7280' }}>09:14 ✓✓</span>
              </div>
            </div>
            <div className="rounded-lg p-3 border" style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
              <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#0065FF' }}>Tarefa criada</p>
              <p className="text-sm font-bold" style={{ color: '#160F41' }}>Revisão contratual</p>
              <p className="text-[11px] mt-1" style={{ color: '#6b6b8a' }}>Responsável: Jurídico</p>
              <p className="text-[11px]" style={{ color: '#6b6b8a' }}>Origem: WhatsApp</p>
            </div>
          </div>

          {/* Ciclo de pagamento — o agente estrutura, o humano aprova */}
          <div className="rounded-lg border p-3" style={{ borderColor: '#e2e2e8' }}>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {ciclo.map(([et, st], i) => {
                const cor = st === 'ok' ? VERDE : st === 'ativo' ? AZUL : '#9ca3af';
                return (
                  <div key={et} className="flex items-center gap-2">
                    <span className="text-[11px] font-medium" style={{ color: cor }}>{icone(st)} {et}</span>
                    {i < ciclo.length - 1 && <span style={{ color: '#9ca3af' }}>→</span>}
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: '#f0f6ff' }}>
              <span className="text-[12px]" style={{ color: '#160F41' }}>Pagamento solicitado: <strong>R$ 18,4 mil</strong> — fornecedor de imóvel — cliente Enzo B.</span>
            </div>
            <p className="text-[10px] mt-2" style={{ color: '#6b6b8a' }}>O agente estrutura, o humano aprova, o lançamento alimenta o fluxo — iniciação de pagamento com aprovação humana obrigatória.</p>
          </div>
        </div>
      }
    />
  );
}

// ── RELATÓRIO MENSAL (aba do Perfil) ────────────────────────────────────────
export function MockupRelatorio() {
  return (
    <MockupModulo
      grafico={
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#160F41,#2F49EE)' }}>
            <span className="text-white text-sm font-bold">Galácticos Capital — Relatório Mensal</span>
            <span className="text-white/70 text-[10px]">Jun/2026</span>
          </div>
          <div className="grid grid-cols-3 gap-3 p-4">
            {[['Receitas do mês', 'R$ 187 mil', VERDE], ['Despesas do mês', 'R$ 143 mil', VERMELHO], ['Acumulado no ano', 'R$ 1,04 mi', '#160F41']].map(([l, v, cor]) => (
              <div key={l} className="rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
                <p className="text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>{l}</p>
                <p className="text-base font-bold mt-0.5" style={{ color: cor }}>{v}</p>
              </div>
            ))}
          </div>
          <p className="px-4 pb-3 text-[10px]" style={{ color: '#9ca3af' }}>Gerado pelo motor de templates da casa, entregue via WhatsApp.</p>
        </div>
      }
    />
  );
}

// ── RESULTADOS (empresa) ────────────────────────────────────────────────────
export function MockupResultados() {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dados = meses.map((m, i) => ({ m, receita: 470 + i * 4 + (i % 3 === 0 ? 6 : 0), ebitda: 52 + i * 1.2 }));
  const dre: [string, string, string][] = [
    ['Receita', 'R$ 512 mil', 'R$ 2,94M'],
    ['Custo direto', 'R$ 134 mil', 'R$ 792 mil'],
    ['Custo dedicado', 'R$ 128 mil', 'R$ 745 mil'],
    ['Custo indireto', 'R$ 186 mil', 'R$ 1,06M'],
    ['EBITDA', 'R$ 64 mil', 'R$ 341 mil'],
    ['Margem %', '12,5%', '11,6%'],
  ];
  return (
    <MockupModulo
      kpis={[
        { label: 'Receita jun', valor: 'R$ 512 mil' }, { label: 'EBITDA jun', valor: 'R$ 64 mil (12,5%)' },
        { label: 'Receita acum. ano', valor: 'R$ 2,94M' }, { label: 'EBITDA acum.', valor: 'R$ 341 mil' },
      ]}
      grafico={
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="m" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} unit=" mil" />
              <Tooltip formatter={(v) => `R$ ${v} mil`} /><Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="receita" name="Receita" fill={AZUL} radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke={VERDE} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: '#f9f9fb' }}>
              <tr>
                <th className="text-left px-2 py-1.5 text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>DRE</th>
                <th className="text-right px-2 py-1.5 text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Mês</th>
                <th className="text-right px-2 py-1.5 text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
              {dre.map(([l, mes, ac], i) => (
                <tr key={l} style={i >= 4 ? { fontWeight: 700 } : undefined}>
                  <td className="px-2 py-1.5" style={{ color: '#160F41' }}>{l}</td>
                  <td className="px-2 py-1.5 text-right" style={{ color: '#160F41' }}>{mes}</td>
                  <td className="px-2 py-1.5 text-right" style={{ color: '#160F41' }}>{ac}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
}

// ── AUTOMAÇÃO BANCÁRIA ──────────────────────────────────────────────────────
export function MockupAutomacao() {
  const bancos: [string, string][] = [['Itaú', '✓ 07:12'], ['BTG', '✓ 07:12'], ['XP', '✓ 07:14'], ['Santander', '⏳ sincronizando']];
  const classificados: { data: string; desc: string; valor: string; cat: string; conf: string; revisar?: boolean }[] = [
    { data: '06/06', desc: 'PIX RECEB CBF', valor: 'R$ 450 mil', cat: 'Receita de imagem', conf: '98%' },
    { data: '05/06', desc: 'DEB AUTOR CONDOMÍNIO', valor: 'R$ 12,4 mil', cat: 'Moradia', conf: '97%' },
    { data: '05/06', desc: 'TED ENVIADA J.M.SILVA', valor: 'R$ 85 mil', cat: '⚠ revisar', conf: '71%', revisar: true },
    { data: '04/06', desc: 'COMPRA CARTÃO', valor: 'R$ 8,2 mil', cat: 'Lifestyle', conf: '94%' },
  ];
  const funil = [['Banco', '1.240'], ['Classificação ML', '1.202 auto · 38 revisão'], ['Plano Financeiro', '✓']];
  return (
    <MockupModulo
      kpis={[{ label: 'Movimentos no mês', valor: '1.240' }, { label: 'Classificados automaticamente', valor: '96%' }, { label: 'Fila de revisão', valor: '38' }]}
      grafico={
        <div className="space-y-4">
          {/* Conexões de banco */}
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {bancos.map(([b, st]) => {
                const ok = st.startsWith('✓');
                return (
                  <div key={b} className="rounded-lg p-2 text-center" style={{ backgroundColor: ok ? '#f0fdf4' : '#fffbeb', border: `1px solid ${ok ? '#bbf7d0' : '#fde68a'}` }}>
                    <p className="text-[11px] font-bold" style={{ color: '#160F41' }}>{b}</p>
                    <p className="text-[9px]" style={{ color: ok ? VERDE : AMBAR }}>{st}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: '#6b6b8a' }}>42 contas · Open Finance · extratos baixados automaticamente</p>
          </div>

          {/* Classificados agora */}
          <div>
            <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#6b6b8a' }}>Classificados agora</p>
            <table className="min-w-full text-[11px]">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr>{['Data', 'Descrição', 'Valor', 'Categoria ML', 'Confiança'].map((c, i) => (
                  <th key={i} className={`px-2 py-1 text-[9px] uppercase font-bold ${i >= 2 ? 'text-right' : 'text-left'}`} style={{ color: '#6b6b8a' }}>{c}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {classificados.map((r, i) => (
                  <tr key={i} style={r.revisar ? { backgroundColor: '#fffbeb' } : undefined}>
                    <td className="px-2 py-1" style={{ color: '#6b6b8a' }}>{r.data}</td>
                    <td className="px-2 py-1" style={{ color: '#160F41' }}>{r.desc}</td>
                    <td className="px-2 py-1 text-right" style={{ color: '#160F41' }}>{r.valor}</td>
                    <td className="px-2 py-1 text-right" style={{ color: r.revisar ? AMBAR : '#160F41' }}>{r.cat}</td>
                    <td className="px-2 py-1 text-right" style={{ color: r.revisar ? AMBAR : '#6b6b8a' }}>{r.conf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Funil */}
          <div className="flex items-stretch gap-2">
            {funil.map(([et, cont], i) => (
              <div key={et} className="flex items-center gap-2 flex-1">
                <div className="flex-1 rounded-lg p-2 text-center" style={{ backgroundColor: '#f0f6ff', border: '1px solid #dbeafe' }}>
                  <p className="text-[11px] font-bold" style={{ color: '#160F41' }}>{et}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#0065FF' }}>{cont}</p>
                </div>
                {i < funil.length - 1 && <span style={{ color: '#9ca3af' }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}

// ── SERVIÇOS SOB DEMANDA ────────────────────────────────────────────────────
export function MockupServicosDemanda() {
  const funil: [string, string][] = [['Orçados', '3'], ['Aprovados', '2'], ['Em execução', '3'], ['Concluídos no ano', '6']];
  const rows: string[][] = [
    ['M&A', 'Enzo B.', 'em execução', 'R$ 22,4 mil', 'R$ 13,1 mil', '41%'],
    ['Valuation', 'Rafael T.', 'concluído', 'R$ 18,0 mil', 'R$ 11,7 mil', '35%'],
    ['Gestão de obra', 'Caio R.', 'em execução', 'R$ 14,0 mil', 'R$ 9,9 mil', '29%'],
    ['Viabilidade', 'Bruno A.', 'concluído', 'R$ 12,0 mil', 'R$ 6,7 mil', '44%'],
  ];
  return (
    <MockupModulo
      kpis={[
        { label: 'Pipeline aprovado + execução', valor: 'R$ 96 mil' }, { label: 'Margem média realizada', valor: '38%' },
        { label: 'Horas apontadas em eventos', valor: '214h' },
      ]}
      grafico={
        <div className="space-y-3">
          <div className="flex items-stretch gap-2">
            {funil.map(([et, n], i) => (
              <div key={et} className="flex items-center gap-2 flex-1">
                <div className="flex-1 rounded-lg p-2 text-center" style={{ backgroundColor: '#f9f9fb' }}>
                  <p className="text-lg font-bold" style={{ color: '#160F41' }}>{n}</p>
                  <p className="text-[9px] uppercase font-bold" style={{ color: '#6b6b8a' }}>{et}</p>
                </div>
                {i < funil.length - 1 && <span style={{ color: '#9ca3af' }}>→</span>}
              </div>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: '#6b6b8a' }}>Receita do Orçador · custo do Apontamento de Horas — margem por evento.</p>
        </div>
      }
      tabela={{ colunas: ['Evento', 'Cliente', 'Status', 'Receita', 'Custo', 'Margem'], linhas: rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5]]) }}
    />
  );
}

// ── APONTAMENTO DE HORAS ────────────────────────────────────────────────────
export function MockupApontamento() {
  const dados = [
    { f: 'Gestão', alocado: 40, apontado: 38 }, { f: 'Financeira', alocado: 60, apontado: 44 },
    { f: 'Operacional', alocado: 80, apontado: 78 }, { f: 'Adm.', alocado: 30, apontado: 29 },
  ];
  const colabs: { c: string; aloc: string; apont: string; desvio: number }[] = [
    { c: 'Marina L.', aloc: '160h', apont: '195h', desvio: 22 },
    { c: 'Rodrigo V.', aloc: '160h', apont: '131h', desvio: -18 },
    { c: 'Fernanda C.', aloc: '150h', apont: '156h', desvio: 4 },
    { c: 'Renata M.', aloc: '140h', apont: '138h', desvio: -1 },
  ];
  const clientes: [string, string][] = [['Enzo B.', '+14h'], ['Rafael T.', '+9h'], ['Bruno A.', '+6h']];
  return (
    <MockupModulo
      kpis={[
        { label: 'Horas apontadas no mês', valor: '1.184h' }, { label: 'Aderência apontado vs. alocado', valor: '87%' },
        { label: 'Desvios > 15%', valor: '3 colaboradores' },
      ]}
      grafico={
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Por colaborador */}
            <div>
              <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#6b6b8a' }}>Por colaborador</p>
              <table className="min-w-full text-[11px]">
                <thead style={{ backgroundColor: '#f9f9fb' }}>
                  <tr>{['Colaborador', 'Alocado', 'Apontado', 'Desvio'].map((c, i) => (
                    <th key={i} className={`px-2 py-1 text-[9px] uppercase font-bold ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: '#6b6b8a' }}>{c}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                  {colabs.map(c => {
                    const cor = c.desvio > 15 ? VERMELHO : c.desvio < -15 ? AZUL : '#6b6b8a';
                    return (
                      <tr key={c.c}>
                        <td className="px-2 py-1" style={{ color: '#160F41' }}>{c.c}</td>
                        <td className="px-2 py-1 text-right" style={{ color: '#160F41' }}>{c.aloc}</td>
                        <td className="px-2 py-1 text-right" style={{ color: '#160F41' }}>{c.apont}</td>
                        <td className="px-2 py-1 text-right font-bold" style={{ color: cor }}>{c.desvio > 0 ? '+' : ''}{c.desvio}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Por função */}
            <div>
              <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#6b6b8a' }}>Alocado vs. apontado por função</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dados} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="f" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} unit="h" />
                  <Tooltip formatter={(v) => `${v}h`} /><Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="alocado" name="Alocado" fill="#c7d2fe" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="apontado" name="Apontado" radius={[3, 3, 0, 0]}>
                    {dados.map((d, i) => <Cell key={i} fill={d.alocado - d.apontado > 8 ? VERMELHO : AZUL} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg p-2" style={{ backgroundColor: '#fef2f2' }}>
            <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#6b6b8a' }}>Clientes com consumo acima do alocado</p>
            <div className="flex flex-wrap gap-2">
              {clientes.map(([c, d]) => (
                <span key={c} className="text-[11px]" style={{ color: '#160F41' }}>{c} <strong style={{ color: VERMELHO }}>{d}</strong></span>
              ))}
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: '#6b6b8a' }}>O desvio recorrente alimenta o repricing — medir em vez de estimar.</p>
          </div>
        </div>
      }
    />
  );
}

// ── TAREFAS ─────────────────────────────────────────────────────────────────
export function MockupTarefas() {
  const cols: { titulo: string; n: number; cor: string; cards: { t: string; cli: string; resp: string; prazo: string; wpp?: boolean }[] }[] = [
    { titulo: 'Pendentes', n: 5, cor: AMBAR, cards: [
      { t: 'Revisão contratual', cli: 'Enzo Batista', resp: 'Jurídico', prazo: 'Sex', wpp: true },
      { t: 'Aporte mensal', cli: 'Rafael Torres', resp: 'Financeiro', prazo: 'Seg' } ] },
    { titulo: 'Em andamento', n: 8, cor: AZUL, cards: [
      { t: 'Valuation participação', cli: 'Bruno Amaral', resp: 'Estratégico', prazo: '15 dias' },
      { t: 'Conciliação de contas', cli: 'Caio Ribeiro', resp: 'Operacional', prazo: 'Qua' } ] },
    { titulo: 'Concluídas na semana', n: 12, cor: VERDE, cards: [
      { t: 'Relatório mensal', cli: 'Diego Fontes', resp: 'Gestor', prazo: 'ok' } ] },
  ];
  return (
    <MockupModulo
      grafico={
        <div className="grid grid-cols-3 gap-3">
          {cols.map(col => (
            <div key={col.titulo} className="rounded-lg p-2" style={{ backgroundColor: '#f9f9fb' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold" style={{ color: col.cor }}>{col.titulo}</span>
                <span className="text-[11px] font-bold" style={{ color: '#160F41' }}>{col.n}</span>
              </div>
              <div className="space-y-1.5">
                {col.cards.map((c, i) => (
                  <div key={i} className="rounded p-1.5 bg-white border" style={{ borderColor: '#e2e2e8' }}>
                    <p className="text-[10px] font-bold" style={{ color: '#160F41' }}>{c.t}</p>
                    <p className="text-[9px]" style={{ color: '#6b6b8a' }}>{c.cli} · {c.resp} · {c.prazo}</p>
                    {c.wpp && <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: '#dcf8c6', color: '#166534' }}>WhatsApp</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      }
    />
  );
}

// ── EVOLUÇÃO (cliente) ──────────────────────────────────────────────────────
export function MockupEvolucao() {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dados = meses.map((m, i) => ({ m, financeiro: 8 + i * 0.35, outros: 5 + i * 0.15 }));
  return (
    <MockupModulo
      grafico={
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="m" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} unit=" M" />
              <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(1)} M`} /><Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="financeiro" name="Financeiro" stackId="1" stroke={AZUL} fill={AZUL} fillOpacity={0.5} />
              <Area type="monotone" dataKey="outros" name="Outros ativos" stackId="1" stroke={ROSA} fill={ROSA} fillOpacity={0.5} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2">
            {[['Aportes', '+R$ 120 mil', VERDE], ['Rendimento', '+R$ 86 mil', VERDE], ['Câmbio', '−R$ 14 mil', VERMELHO]].map(([l, v, cor]) => (
              <span key={l} className="px-3 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: '#f9f9fb', color: cor as string }}>{l}: {v}</span>
            ))}
          </div>
        </div>
      }
    />
  );
}

// ── DOSSIÊ DO CLIENTE ───────────────────────────────────────────────────────
export function MockupDossie() {
  const financeiro: [string, string][] = [['Fee', 'R$ 18,4 mil'], ['Custos (3 canais)', 'R$ 13,9 mil'], ['MC', '24%'], ['EBITDA', 'R$ 2,1 mil']];
  const patrimonio: [string, string][] = [['PL', 'R$ 14,2M (+2,1%)'], ['On / Off', '62% / 38%'], ['Aderência ao plano', '89%']];
  const pendencias = ['Procuração vencida', 'Aporte de julho aguardando confirmação', 'Demanda jurídica aberta há 12d'];
  const atencao = ['Fee 18% abaixo do sugerido', 'Franquia jurídica estourada 2 meses', '2 consultas ao CPF em 30d'];
  return (
    <MockupModulo
      grafico={
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#160F41,#2F49EE)' }}>
            <span className="text-white text-sm font-bold">Enzo Batista</span>
            <span className="text-white/70 text-[10px]">Banker: R. Bittencourt · Pacote Full · junho/2026</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            <div className="rounded-lg p-2" style={{ backgroundColor: '#f9f9fb' }}>
              <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#0065FF' }}>Financeiro</p>
              {financeiro.map(([l, v]) => (
                <div key={l} className="flex justify-between text-[11px]"><span style={{ color: '#6b6b8a' }}>{l}</span><span className="font-medium" style={{ color: '#160F41' }}>{v}</span></div>
              ))}
            </div>
            <div className="rounded-lg p-2" style={{ backgroundColor: '#f9f9fb' }}>
              <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#0065FF' }}>Patrimônio</p>
              {patrimonio.map(([l, v]) => (
                <div key={l} className="flex justify-between text-[11px]"><span style={{ color: '#6b6b8a' }}>{l}</span><span className="font-medium" style={{ color: '#160F41' }}>{v}</span></div>
              ))}
            </div>
            <div className="rounded-lg p-2" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
              <p className="text-[10px] uppercase font-bold mb-1" style={{ color: AMBAR }}>Pendências</p>
              <ul className="text-[11px] space-y-0.5" style={{ color: '#160F41' }}>{pendencias.map(p => <li key={p}>· {p}</li>)}</ul>
            </div>
            <div className="rounded-lg p-2" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-[10px] uppercase font-bold mb-1" style={{ color: VERMELHO }}>Pontos de atenção</p>
              <ul className="text-[11px] space-y-0.5" style={{ color: '#160F41' }}>{atencao.map(p => <li key={p}>· {p}</li>)}</ul>
            </div>
          </div>
          <p className="px-4 pb-3 text-[10px]" style={{ color: '#9ca3af' }}>Gerado pelo motor de templates — o mesmo das propostas.</p>
        </div>
      }
    />
  );
}

// ── GESTÃO DE OBRA (cliente) ────────────────────────────────────────────────
export function MockupGestaoObra() {
  const etapas = [
    { e: 'Fundação', orc: 320, real: 315 }, { e: 'Estrutura', orc: 540, real: 552 },
    { e: 'Alvenaria', orc: 380, real: 430 }, { e: 'Instalações', orc: 300, real: 210 },
    { e: 'Acabamento', orc: 460, real: 0 },
  ];
  const estoque: [string, string, string, string][] = [
    ['Cimento', '1.200 sc', '980 sc', '220 sc'],
    ['Aço', '18 t', '15 t', '3 t'],
    ['Porcelanato', '640 m²', '210 m²', '430 m²'],
  ];
  return (
    <MockupModulo
      kpis={[
        { label: 'Orçamento', valor: 'R$ 2,4M' }, { label: 'Realizado', valor: 'R$ 1,71M (71%)' },
        { label: 'Desvio', valor: '+4,2%' }, { label: 'Etapa', valor: '8 de 12' },
      ]}
      grafico={
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={etapas} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="e" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} unit=" mil" />
              <Tooltip formatter={(v) => `R$ ${v} mil`} /><Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="orc" name="Orçado" fill="#c7d2fe" radius={[3, 3, 0, 0]} />
              <Bar dataKey="real" name="Realizado" radius={[3, 3, 0, 0]}>
                {etapas.map((d, i) => <Cell key={i} fill={d.real > d.orc ? VERMELHO : AZUL} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="rounded-lg p-2" style={{ backgroundColor: '#f9f9fb' }}>
            <span className="text-[11px] font-medium" style={{ color: '#160F41' }}>Medição 8 — conferida ✓ — pagamento liberado <strong>R$ 142 mil</strong></span>
          </div>
        </div>
      }
      tabela={{
        colunas: ['Material', 'Comprado', 'Consumido', 'Saldo'],
        linhas: estoque.map(r => [r[0], r[1], r[2], r[3]]),
      }}
    />
  );
}

// ── FLUXO DE CAIXA (cliente) ────────────────────────────────────────────────
export function MockupFluxoCaixa() {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
  const dados = meses.map((m, i) => ({ m, entradas: 180 + i * 3, saidas: 130 + (i % 2 ? 18 : 8) }));
  const aprovacoes: [string, string][] = [
    ['Fornecedor de imóvel', 'R$ 18,4 mil'], ['Mensalidade escola', 'R$ 6,2 mil'],
  ];
  const lancamentos: [string, string, 'Pago' | 'Aprovisionado'][] = [
    ['05/06 · Folha doméstica', 'R$ 38 mil', 'Pago'],
    ['12/06 · Condomínio', 'R$ 12,4 mil', 'Pago'],
    ['28/06 · Aporte previsto', 'R$ 150 mil', 'Aprovisionado'],
  ];
  return (
    <MockupModulo
      grafico={
        <div className="space-y-3">
          {/* Aprovações pendentes */}
          <div className="rounded-lg border p-3" style={{ borderColor: '#e2e2e8' }}>
            <p className="text-[10px] uppercase font-bold mb-2" style={{ color: '#0065FF' }}>Aprovações pendentes (2)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {aprovacoes.map(([desc, vl]) => (
                <div key={desc} className="rounded-lg p-2 flex items-center justify-between" style={{ backgroundColor: '#f9f9fb' }}>
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: '#160F41' }}>{desc}</p>
                    <p className="text-[9px]" style={{ color: '#6b6b8a' }}>origem: WhatsApp · {vl}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: VERDE }}>Aprovar</button>
                    <button type="button" className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: '#fee2e2', color: VERMELHO }}>Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="m" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} unit=" mil" />
              <Tooltip formatter={(v) => `R$ ${v} mil`} /><Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="entradas" name="Entradas" fill={VERDE} radius={[3, 3, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill={VERMELHO} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div>
            <p className="text-[10px] uppercase font-bold mb-1" style={{ color: '#6b6b8a' }}>Top-3 categorias do mês</p>
            <div className="flex flex-wrap gap-2">
              {[['Folha doméstica', 'R$ 38 mil'], ['Imóveis', 'R$ 27 mil'], ['Cartões', 'R$ 22 mil']].map(([c, v]) => (
                <span key={c} className="px-3 py-1 rounded-full text-[11px]" style={{ backgroundColor: '#f9f9fb', color: '#160F41' }}>{c}: {v}</span>
              ))}
            </div>
          </div>

          {/* Lançamentos — inclui status Aprovisionado */}
          <table className="min-w-full text-[11px]">
            <thead style={{ backgroundColor: '#f9f9fb' }}>
              <tr>{['Lançamento', 'Valor', 'Status'].map((c, i) => (
                <th key={i} className={`px-2 py-1 text-[9px] uppercase font-bold ${i === 1 ? 'text-right' : 'text-left'}`} style={{ color: '#6b6b8a' }}>{c}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
              {lancamentos.map(([desc, vl, st]) => (
                <tr key={desc}>
                  <td className="px-2 py-1" style={{ color: '#160F41' }}>{desc}</td>
                  <td className="px-2 py-1 text-right" style={{ color: '#160F41' }}>{vl}</td>
                  <td className="px-2 py-1"><PillStatus s={st} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
}

// ── DOCUMENTOS (cliente) ────────────────────────────────────────────────────
export function MockupDocumentos() {
  const docs: [string, string, string, string][] = [
    ['Passaporte', 'Pessoal', '08/2026', '🟡 vence em 45 dias'],
    ['Procuração pública', 'Societário', '03/2026', '🔴 vencida'],
    ['IR 2025', 'Fiscal', 'entregue ✓', '🟢'],
    ['Contrato social Holding', 'Societário', 'sem validade', '—'],
    ['CNH', 'Pessoal', '11/2027', '🟢'],
  ];
  return (
    <MockupModulo
      kpis={[{ label: 'Documentos no cofre', valor: '34' }, { label: 'Vencendo em 60 dias', valor: '3' }, { label: 'Vencidos', valor: '1' }]}
      grafico={
        <div className="rounded-lg p-2" style={{ backgroundColor: '#f0f6ff', border: '1px solid #dbeafe' }}>
          <span className="text-[11px] font-medium" style={{ color: '#0065FF' }}>Procuração vencida → tarefa criada · renovação solicitada via WhatsApp ✓</span>
        </div>
      }
      tabela={{
        colunas: ['Documento', 'Categoria', 'Validade', 'Status'],
        linhas: docs.map(d => [d[0], d[1], d[2], d[3]]),
      }}
    />
  );
}

// ── FLUXO DE CAIXA DA CASA (empresa) ────────────────────────────────────────
function PillStatus({ s }: { s: 'Pago' | 'Agendado' | 'Aprovisionado' }) {
  const cor = s === 'Pago' ? VERDE : s === 'Agendado' ? AZUL : AMBAR;
  const bg = s === 'Pago' ? '#f0fdf4' : s === 'Agendado' ? '#f0f6ff' : '#fffbeb';
  return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: bg, color: cor }}>{s}</span>;
}

export function MockupFluxoCaixaEmpresa() {
  const alertas: [string, string][] = [
    ['🔴', 'Caixa negativo previsto em 30/07 (−R$ 62,8 mil)'],
    ['🟡', '2 clientes em atraso (R$ 21,4 mil)'],
    ['🟡', '40 receitas aprovisionadas há mais de 7 dias (R$ 1,49M)'],
  ];
  const mov: { data: string; desc: string; st: 'Pago' | 'Agendado' | 'Aprovisionado'; cc: string; ent?: string; sai?: string; saldo: string }[] = [
    { data: '03/07', desc: 'Licenças de software', st: 'Pago', cc: 'Tecnologia', sai: '12,4', saldo: '15,5' },
    { data: '04/07', desc: 'Fee — Enzo B.', st: 'Pago', cc: 'Receita', ent: '41,0', saldo: '56,5' },
    { data: '05/07', desc: 'Folha de julho', st: 'Agendado', cc: 'RH', sai: '128,0', saldo: '−71,5' },
    { data: '10/07', desc: 'Honorários contábeis', st: 'Agendado', cc: 'Contabilidade', sai: '8,2', saldo: '−79,7' },
    { data: '28/07', desc: 'Fee aprovisionado — Rafael T.', st: 'Aprovisionado', cc: 'Receita', ent: '39,0', saldo: '−40,7' },
  ];
  const budget: { cc: string; pct: number }[] = [{ cc: 'Folha', pct: 98 }, { cc: 'Tecnologia', pct: 112 }, { cc: 'Ocupação', pct: 95 }];
  return (
    <MockupModulo
      grafico={
        <div className="space-y-4">
          {/* Banners de alerta */}
          <div className="space-y-1.5">
            {alertas.map(([ic, txt]) => {
              const critico = ic === '🔴';
              return (
                <div key={txt} className="rounded-lg px-3 py-1.5 text-[11px] font-medium" style={{ backgroundColor: critico ? '#fef2f2' : '#fffbeb', color: critico ? VERMELHO : AMBAR }}>
                  {ic} {txt}
                </div>
              );
            })}
          </div>

          {/* Barra: saldo + legenda + ações */}
          <div className="flex items-center flex-wrap gap-3">
            <span className="text-[12px] font-bold" style={{ color: '#160F41' }}>Saldo inicial: R$ 27,9 mil</span>
            <span className="flex items-center gap-2 text-[10px]" style={{ color: '#6b6b8a' }}>
              <PillStatus s="Pago" /><PillStatus s="Agendado" /><PillStatus s="Aprovisionado" />
            </span>
            <span className="ml-auto flex gap-2">
              <button type="button" className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white" style={{ background: 'linear-gradient(135deg,#0065FF,#D000BB)' }}>+ Nova Movimentação</button>
              <button type="button" className="px-2.5 py-1 rounded-md text-[11px] font-medium border" style={{ borderColor: '#e2e2e8', color: '#160F41' }}>Exportar PDF</button>
            </span>
          </div>

          {/* Tabela de movimentações */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead style={{ backgroundColor: '#f9f9fb' }}>
                <tr>{['Data', 'Descrição', 'Status', 'Centro de custo', 'Entrada', 'Saída', 'Saldo'].map((c, i) => (
                  <th key={i} className={`px-2 py-1 text-[9px] uppercase font-bold ${i >= 4 ? 'text-right' : 'text-left'}`} style={{ color: '#6b6b8a' }}>{c}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
                {mov.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1" style={{ color: '#6b6b8a' }}>{r.data}</td>
                    <td className="px-2 py-1" style={{ color: '#160F41' }}>{r.desc}</td>
                    <td className="px-2 py-1"><PillStatus s={r.st} /></td>
                    <td className="px-2 py-1" style={{ color: '#6b6b8a' }}>{r.cc}</td>
                    <td className="px-2 py-1 text-right font-medium" style={{ color: VERDE }}>{r.ent ? `R$ ${r.ent} mil` : '—'}</td>
                    <td className="px-2 py-1 text-right" style={{ color: r.sai ? VERMELHO : '#9ca3af' }}>{r.sai ? `R$ ${r.sai} mil` : '—'}</td>
                    <td className="px-2 py-1 text-right font-bold" style={{ color: r.saldo.startsWith('−') ? VERMELHO : '#160F41' }}>R$ {r.saldo} mil</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Budget vs realizado */}
          <div>
            <p className="text-[10px] uppercase font-bold mb-1.5" style={{ color: '#6b6b8a' }}>Budget vs. realizado — junho</p>
            <div className="space-y-1.5">
              {budget.map(b => {
                const estourou = b.pct > 100;
                return (
                  <div key={b.cc} className="flex items-center gap-2">
                    <span className="text-[10px] w-20 shrink-0" style={{ color: '#160F41' }}>{b.cc}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: '#eee' }}>
                      <div className="h-2 rounded-full" style={{ width: `${Math.min(100, b.pct)}%`, backgroundColor: estourou ? VERMELHO : VERDE }} />
                    </div>
                    <span className="text-[10px] w-10 text-right font-bold" style={{ color: estourou ? VERMELHO : '#6b6b8a' }}>{b.pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[10px]" style={{ color: '#6b6b8a' }}>A Automação Bancária alimenta o realizado; o aprovisionado e o budget se lançam aqui — o caixa projetado nasce dos dois.</p>
        </div>
      }
    />
  );
}

// ── PROCESSOS (empresa) ─────────────────────────────────────────────────────
export function MockupProcessos() {
  const deptos = ['Financeiro', 'Jurídico', 'Atendimento', 'Compliance'];
  const etapas = ['Solicitação', 'Conferência', 'Alçada', 'Liquidação'];
  const quiz = [
    { t: 'Imediatamente, sem prazo', ok: false },
    { t: 'Até 15 dias', ok: true },
    { t: 'Até 90 dias', ok: false },
    { t: 'Não é obrigatório', ok: false },
  ];
  return (
    <MockupModulo
      grafico={
        <div className="space-y-4">
          {/* Seletor de departamento */}
          <div className="flex flex-wrap gap-2">
            {deptos.map((d, i) => (
              <span key={d} className="px-3 py-1 rounded-full text-[11px] font-medium"
                style={{ backgroundColor: i === 0 ? '#0065FF' : '#f3f4f6', color: i === 0 ? '#fff' : '#6b6b8a' }}>{d}</span>
            ))}
          </div>

          {/* Card de processo com mini-fluxo */}
          <div className="rounded-lg border p-3" style={{ borderColor: '#e2e2e8' }}>
            <p className="text-[12px] font-bold mb-2" style={{ color: '#160F41' }}>Aprovação de pagamentos — 4 etapas</p>
            <div className="flex items-center gap-2 flex-wrap">
              {etapas.map((e, i) => (
                <div key={e} className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#160F41' }}>
                    <span className="flex items-center justify-center rounded-full text-white text-[9px] font-bold" style={{ width: 16, height: 16, backgroundColor: '#0065FF' }}>{i + 1}</span>
                    {e}
                  </span>
                  {i < etapas.length - 1 && <span style={{ color: '#9ca3af' }}>→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Q&A pelo processo */}
          <div className="rounded-lg p-3" style={{ backgroundColor: '#f9f9fb' }}>
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-[12px] mb-2" style={{ backgroundColor: '#fff', border: '1px solid #e2e2e8', color: '#160F41' }}>
              Quem aprova pagamentos acima de R$ 50 mil?
            </div>
            <div className="max-w-[90%] ml-auto rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: '#f0f6ff', color: '#160F41' }}>
              Pela política de alçadas (Processo Financeiro §3), pagamentos acima de R$ 50 mil exigem dupla aprovação: gestor da conta + CFO.
              <span className="block mt-1"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: '#dbeafe', color: '#0065FF' }}>respondido pelo processo</span></span>
            </div>
          </div>

          {/* Mini-quiz LGPD */}
          <div className="rounded-lg border p-3" style={{ borderColor: '#e2e2e8' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold" style={{ color: '#160F41' }}>LGPD — Um cliente pede a exclusão dos dados. Qual o prazo legal de resposta?</p>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium shrink-0 ml-2" style={{ backgroundColor: '#f0fdf4', color: VERDE }}>Treinamento: 7/10 concluído</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {quiz.map(o => (
                <div key={o.t} className="rounded px-2 py-1.5 text-[11px]" style={{ backgroundColor: o.ok ? '#f0fdf4' : '#fff', border: `1px solid ${o.ok ? '#bbf7d0' : '#e2e2e8'}`, color: o.ok ? VERDE : '#160F41', fontWeight: o.ok ? 700 : 400 }}>
                  {o.ok ? '✓ ' : ''}{o.t}
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}
