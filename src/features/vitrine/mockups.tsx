// --- Mockups ILUSTRATIVOS da Vitrine 360 ---
// TODOS os dados são FICTÍCIOS — nomes de clientes INVENTADOS (nenhum real).
// Recharts para gráficos; nada de fetch/lógica — estático inline. Selo "dados
// ilustrativos" via MockupModulo em todos.

import { MockupModulo } from '../../components/ui/MockupModulo';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, Cell,
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
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dados = meses.map((m, i) => ({
    m, plano: 60 + i * 4,
    realizado: 60 + i * 4 + (i === 5 ? -9 : i === 8 ? -6 : 0),
  }));
  return (
    <MockupModulo
      kpis={[{ label: 'Idade de independência projetada', valor: '42 anos' }, { label: 'Superávit médio/mês', valor: 'R$ 84 mil' }]}
      grafico={
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="m" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} unit=" mi" />
            <Tooltip formatter={(v) => `R$ ${v} mi`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="plano" name="Plano" stroke={AZUL} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="realizado" name="Realizado" stroke={ROSA} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      }
    />
  );
}

// ── JURÍDICO ────────────────────────────────────────────────────────────────
export function MockupJuridico() {
  const cols: { titulo: string; n: number; cor: string; cards: string[] }[] = [
    { titulo: 'Abertas', n: 6, cor: AZUL, cards: ['Revisão contrato de imagem — Enzo B.', 'Distrato fornecedor — Rafael T.'] },
    { titulo: 'Em andamento', n: 4, cor: AMBAR, cards: ['Parecer societário — Bruno A.', 'Notificação — Caio R.', 'Contrato patrocínio — Diego F.'] },
    { titulo: 'Concluídas no mês', n: 11, cor: VERDE, cards: ['Procuração — Igor M.', 'Aditivo — Lucca P.'] },
  ];
  const consumo = [{ c: 'Enzo B.', usado: 4, franquia: 3 }, { c: 'Rafael T.', usado: 2, franquia: 4 }, { c: 'Bruno A.', usado: 3, franquia: 5 }];
  return (
    <MockupModulo
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
                  {col.cards.map((card, i) => (
                    <div key={i} className="rounded p-1.5 text-[10px] bg-white border" style={{ borderColor: '#e2e2e8', color: '#160F41' }}>{card}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold mb-1.5" style={{ color: '#6b6b8a' }}>Consumo vs franquia</p>
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
        </div>
      }
    />
  );
}

// ── CONTRATO VIVO ───────────────────────────────────────────────────────────
export function MockupContratoVivo() {
  const cel = (txt: string, alerta = false) => <span style={{ color: alerta ? VERMELHO : '#160F41', fontWeight: alerta ? 700 : 400 }}>{txt}</span>;
  return (
    <MockupModulo
      grafico={
        <div className="rounded-lg p-2 mb-3" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <span className="text-[11px] font-medium" style={{ color: VERMELHO }}>⚠ 2 itens acima do contratado há 3 meses — gatilho de renegociação.</span>
        </div>
      }
      tabela={{
        colunas: ['Item', 'Contratado', 'Consumido', 'Δ'],
        linhas: [
          [cel('Imóveis'), cel('3'), cel('5', true), cel('+2', true)],
          [cel('Veículos'), cel('4'), cel('4'), cel('0')],
          [cel('Movimentos/mês'), cel('350'), cel('410', true), cel('+60', true)],
          [cel('Demandas jurídicas'), cel('2'), cel('2'), cel('0')],
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
  return (
    <MockupModulo
      grafico={
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
  return (
    <MockupModulo
      kpis={[{ label: 'Receita', valor: 'R$ 512 mil' }, { label: 'Custos', valor: 'R$ 448 mil' }, { label: 'EBITDA', valor: 'R$ 64 mil' }]}
      grafico={
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="m" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} unit=" mil" />
            <Tooltip formatter={(v) => `R$ ${v} mil`} /><Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="receita" name="Receita" stroke={AZUL} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke={VERDE} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      }
    />
  );
}

// ── AUTOMAÇÃO BANCÁRIA ──────────────────────────────────────────────────────
export function MockupAutomacao() {
  const etapas = [['Banco (Open Finance)', '42 extratos'], ['Classificado por ML', '96% auto'], ['Plano Financeiro', '38 p/ revisar']];
  return (
    <MockupModulo
      kpis={[{ label: 'Extratos recebidos', valor: '42/42 contas' }, { label: 'Classificação automática', valor: '96%' }, { label: 'Pendentes de revisão', valor: '38' }]}
      grafico={
        <div className="flex items-stretch gap-2">
          {etapas.map(([et, cont], i) => (
            <div key={et} className="flex items-center gap-2 flex-1">
              <div className="flex-1 rounded-lg p-3 text-center" style={{ backgroundColor: '#f0f6ff', border: '1px solid #dbeafe' }}>
                <p className="text-[11px] font-bold" style={{ color: '#160F41' }}>{et}</p>
                <p className="text-[10px] mt-1" style={{ color: '#0065FF' }}>{cont}</p>
              </div>
              {i < etapas.length - 1 && <span style={{ color: '#9ca3af' }}>→</span>}
            </div>
          ))}
        </div>
      }
    />
  );
}

// ── SERVIÇOS SOB DEMANDA ────────────────────────────────────────────────────
export function MockupServicosDemanda() {
  const rows: [string, string, string, string, string][] = [
    ['M&A', 'Enzo Batista', 'em execução', 'R$ 22 mil', '41%'],
    ['Valuation', 'Rafael Torres', 'concluído', 'R$ 18 mil', '35%'],
    ['Viabilidade', 'Bruno Amaral', 'concluído', 'R$ 12 mil', '39%'],
    ['Gestão de obra', 'Caio Ribeiro', 'em execução', 'R$ 9 mil', '36%'],
  ];
  return (
    <MockupModulo
      kpis={[{ label: 'Eventos no ano', valor: '9' }, { label: 'Margem média', valor: '38%' }]}
      tabela={{ colunas: ['Tipo', 'Cliente', 'Status', 'Receita', 'Margem'], linhas: rows.map(r => [r[0], r[1], r[2], r[3], r[4]]) }}
    />
  );
}

// ── APONTAMENTO DE HORAS ────────────────────────────────────────────────────
export function MockupApontamento() {
  const dados = [
    { f: 'Gestão', alocado: 40, apontado: 38 }, { f: 'Financeira', alocado: 60, apontado: 44 },
    { f: 'Operacional', alocado: 80, apontado: 78 }, { f: 'Adm.', alocado: 30, apontado: 29 },
  ];
  return (
    <MockupModulo
      kpis={[{ label: 'Aderência apontado vs. alocado', valor: '87%' }]}
      grafico={
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="f" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} unit="h" />
            <Tooltip formatter={(v) => `${v}h`} /><Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="alocado" name="Alocado" fill="#c7d2fe" radius={[3, 3, 0, 0]} />
            <Bar dataKey="apontado" name="Apontado" radius={[3, 3, 0, 0]}>
              {dados.map((d, i) => <Cell key={i} fill={d.alocado - d.apontado > 8 ? VERMELHO : AZUL} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
  const blocos = [['DRE do mês', 'Receita R$ 41 mil · EBITDA R$ 12 mil'], ['Quem atende', 'Gestor: —  · Banker: —'],
    ['Classe', 'ABC: A  ·  BCG: Estrela'], ['Evolução 12m', 'PL +18% no período'], ['Aderência ao plano', 'No plano ✓']];
  return (
    <MockupModulo
      grafico={
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e2e8' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#160F41,#2F49EE)' }}>
            <span className="text-white text-sm font-bold">Galácticos Capital — Dossiê do Cliente</span>
            <span className="text-white/70 text-[10px]">1 página</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-4">
            {blocos.map(([t, v]) => (
              <div key={t} className="rounded-lg p-2" style={{ backgroundColor: '#f9f9fb' }}>
                <p className="text-[10px] uppercase font-bold" style={{ color: '#6b6b8a' }}>{t}</p>
                <p className="text-[12px] mt-0.5" style={{ color: '#160F41' }}>{v}</p>
              </div>
            ))}
          </div>
          <p className="px-4 pb-3 text-[10px]" style={{ color: '#9ca3af' }}>Gerado pelo motor de templates da casa.</p>
        </div>
      }
    />
  );
}

// ── FLUXO DE CAIXA (cliente) ────────────────────────────────────────────────
export function MockupFluxoCaixa() {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
  const dados = meses.map((m, i) => ({ m, entradas: 180 + i * 3, saidas: 130 + (i % 2 ? 18 : 8) }));
  return (
    <MockupModulo
      grafico={
        <div className="space-y-3">
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
        </div>
      }
    />
  );
}
