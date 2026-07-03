// --- Sidebar de navegação ---
// Identidade visual Galácticos Capital: fundo #160F41, gradiente azul→rosa nos itens ativos.
// Rodapé: avatar do usuário logado + botão sair.
// Recolhível (modo só-ícones): estado auto-contido + persistência em localStorage.
// Como o <main> do MainLayout usa flex-1, ele reflowa sozinho quando a largura
// da sidebar muda — não há offset manual a sincronizar.

import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingUp, Calculator, Layers, Gauge, UserCircle,
  PiggyBank, BarChart2, BarChart3, LineChart, Briefcase, Scale, Sparkles, Clock,
  CreditCard, MessageCircle, ListTodo, Target, Activity, FileText, ScrollText,
  Wallet, HardHat, Contact, Upload, Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../state/AuthContext';

// Chave de persistência da preferência de recolhimento.
const STORAGE_KEY = 'sidebar_recolhida';
const LARGURA_EXPANDIDA = 220;
const LARGURA_RECOLHIDA = 64;

type Marcador = 'novo' | 'construcao';
interface AbaConfig {
  path: string;
  label: string;
  icon: React.ReactNode;
  marcador?: Marcador;   // 🆕 novo · 🔧 em construção (ponto discreto)
}
interface Grupo { titulo: string; itens: AbaConfig[]; }

const GRUPOS: Grupo[] = [
  { titulo: 'Empresa', itens: [
    { path: 'visao-geral', label: 'Visão Geral',        icon: <LayoutDashboard size={16} /> },
    { path: 'resultados',  label: 'Resultados',          icon: <BarChart3 size={16} />, marcador: 'novo' },
    { path: 'simulador',   label: 'Simulador',           icon: <Calculator size={16} /> },
    { path: 'poupanca',    label: 'AUM & Performance',    icon: <PiggyBank size={16} /> },
    { path: 'gestores',    label: 'Gestores',            icon: <Users size={16} /> },
    { path: 'capacidade',  label: 'Capacidade',          icon: <Gauge size={16} /> },
    { path: 'cenarios',    label: 'Cenários',            icon: <Layers size={16} /> },
    { path: 'carteira',    label: 'Carteira',            icon: <Briefcase size={16} />, marcador: 'novo' },
    { path: 'projecao',    label: 'Projeção',            icon: <TrendingUp size={16} />, marcador: 'novo' },
    { path: 'juridico',    label: 'Jurídico',            icon: <Scale size={16} />, marcador: 'novo' },
    { path: 'servicos-demanda',   label: 'Serviços sob Demanda', icon: <Sparkles size={16} />, marcador: 'novo' },
    { path: 'apontamento-horas',  label: 'Apontamento de Horas', icon: <Clock size={16} />, marcador: 'novo' },
    { path: 'automacao-bancaria', label: 'Automação Bancária',   icon: <CreditCard size={16} />, marcador: 'novo' },
    { path: 'agente-whatsapp',    label: 'Agente WhatsApp',      icon: <MessageCircle size={16} />, marcador: 'novo' },
    { path: 'tarefas',     label: 'Tarefas',             icon: <ListTodo size={16} />, marcador: 'novo' },
  ]},
  { titulo: 'Cliente 360', itens: [
    { path: 'perfil',      label: 'Perfil',              icon: <UserCircle size={16} /> },
    { path: 'planejamento-financeiro', label: 'Planejamento Financeiro', icon: <Target size={16} />, marcador: 'novo' },
    { path: 'patrimonio',  label: 'Patrimônio',          icon: <BarChart2 size={16} /> },
    { path: 'evolucao',    label: 'Evolução',            icon: <LineChart size={16} />, marcador: 'construcao' },
    { path: 'saude-cliente',   label: 'Saúde do Cliente',   icon: <Activity size={16} />, marcador: 'novo' },
    { path: 'dossie-cliente',  label: 'Dossiê do Cliente',  icon: <FileText size={16} />, marcador: 'novo' },
    { path: 'contrato-vivo',   label: 'Contrato Vivo',      icon: <ScrollText size={16} />, marcador: 'novo' },
    { path: 'gestao-obra',     label: 'Gestão de Obra',     icon: <HardHat size={16} />, marcador: 'novo' },
    { path: 'fluxo-caixa',     label: 'Fluxo de Caixa',     icon: <Wallet size={16} />, marcador: 'novo' },
  ]},
];

const GRUPO_SISTEMA: Grupo = { titulo: 'Sistema', itens: [
  { path: 'colaboradores',  label: 'Colaboradores/Folha', icon: <Contact size={16} /> },
  { path: 'upload',         label: 'Upload',              icon: <Upload size={16} /> },
  { path: 'configuracoes',  label: 'Configurações',       icon: <Settings size={16} /> },
]};

// Cores das badges por role
const ROLE_BADGE: Record<string, { bg: string; label: string }> = {
  admin:         { bg: '#7c3aed', label: 'Admin' },
  gestor:        { bg: '#2563eb', label: 'Gestor' },
  visualizador:  { bg: '#6b7280', label: 'Visualizador' },
};

// Layout do item de menu — muda só o espaçamento conforme recolhido/expandido.
// No modo recolhido o ícone é centralizado (sem label, sem padding lateral).
function navLinkClass(isActive: boolean, recolhida: boolean) {
  const espaco = recolhida ? 'justify-center px-0 py-2.5' : 'gap-3 px-5 py-2.5';
  return isActive
    ? `border-l-gradient flex items-center ${espaco} text-white font-medium transition-colors`
    : `flex items-center ${espaco} transition-colors border-l-3 border-transparent`;
}

function navLinkStyle(isActive: boolean) {
  return {
    fontSize: 13,
    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
    backgroundColor: isActive ? 'rgba(0,101,255,0.10)' : undefined,
  };
}

function handleMouseEnter(e: React.MouseEvent<HTMLAnchorElement>) {
  const link = e.currentTarget;
  if (!link.classList.contains('border-l-gradient')) {
    link.style.backgroundColor = '#2d2860';
    link.style.color = '#ffffff';
  }
}

function handleMouseLeave(e: React.MouseEvent<HTMLAnchorElement>) {
  const link = e.currentTarget;
  if (!link.classList.contains('border-l-gradient')) {
    link.style.backgroundColor = '';
    link.style.color = 'rgba(255,255,255,0.7)';
  }
}

export function Sidebar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  // Preferência de recolhimento — restaurada do localStorage no carregamento.
  const [recolhida, setRecolhida] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(recolhida)); }
    catch { /* localStorage indisponível (modo privado / quota) — ignora */ }
  }, [recolhida]);

  // Iniciais do nome (até 2 letras)
  const iniciais = usuario?.nome
    ? usuario.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const badge = ROLE_BADGE[usuario?.role ?? ''] ?? ROLE_BADGE.visualizador;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function renderNavLink(aba: AbaConfig) {
    return (
      <NavLink
        key={aba.path}
        to={aba.path}
        title={recolhida ? aba.label : undefined}
        className={({ isActive }) => navLinkClass(isActive, recolhida)}
        style={({ isActive }) => navLinkStyle(isActive)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span style={{ opacity: 0.7 }}>{aba.icon}</span>
        {!recolhida && <span className="flex-1 truncate">{aba.label}</span>}
        {!recolhida && aba.marcador && (
          <span
            title={aba.marcador === 'construcao' ? 'Em construção' : 'Novo'}
            style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0,
              background: aba.marcador === 'construcao' ? '#f59e0b' : '#0065FF' }}
          />
        )}
      </NavLink>
    );
  }

  return (
    <aside
      className="flex flex-col h-screen overflow-hidden"
      style={{
        width: recolhida ? LARGURA_RECOLHIDA : LARGURA_EXPANDIDA,
        backgroundColor: '#160F41',
        transition: 'width 200ms ease',
      }}
    >
      {/* Logo — wordmark quando expandido, marca em gradiente quando recolhido */}
      <div className={`py-5 flex items-center ${recolhida ? 'justify-center px-0' : 'px-5'}`}>
        {recolhida ? (
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #0065FF, #D000BB)' }}
          >
            <LayoutDashboard size={18} color="#ffffff" />
          </div>
        ) : (
          <img
            src="/logo-galaticos-header.svg"
            alt="Galácticos Capital"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
        )}
      </div>

      {/* Navegação — scroll em telas pequenas */}
      <nav
        className="flex-1 overflow-y-auto py-2 space-y-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}
      >
        {GRUPOS.map(grupo => (
          <div key={grupo.titulo}>
            {recolhida
              ? <div className="mx-3 my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }} />
              : <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{grupo.titulo}</p>}
            {grupo.itens.map(renderNavLink)}
          </div>
        ))}

        {/* SISTEMA — grupo discreto no rodapé da navegação */}
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          {!recolhida && <p className="px-5 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{GRUPO_SISTEMA.titulo}</p>}
          {GRUPO_SISTEMA.itens.map(renderNavLink)}
        </div>
      </nav>

      {/* Rodapé — perfil do usuário + recolher (fixo na parte inferior) */}
      <div
        className="px-4 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className={`flex items-center ${recolhida ? 'justify-center' : 'gap-3'}`}>
          {/* Avatar com iniciais */}
          <div
            className="flex items-center justify-center rounded-full text-white font-semibold shrink-0"
            title={recolhida ? usuario?.nome ?? undefined : undefined}
            style={{
              width: 32,
              height: 32,
              fontSize: 12,
              background: 'linear-gradient(135deg, #0065FF, #D000BB)',
            }}
          >
            {iniciais}
          </div>

          {!recolhida && (
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate leading-tight">
                {usuario?.nome ?? '—'}
              </p>
              <p
                className="truncate leading-tight"
                style={{ fontSize: 11, color: '#94a3b8' }}
              >
                {usuario?.email ?? ''}
              </p>
            </div>
          )}
        </div>

        {/* Badge de role — oculto no modo recolhido */}
        {!recolhida && (
          <span
            className="inline-block mt-2 px-2 py-0.5 rounded-full text-white font-medium"
            style={{ fontSize: 10, backgroundColor: badge.bg }}
          >
            {badge.label}
          </span>
        )}

        {/* Botão Sair */}
        <button
          onClick={handleLogout}
          title={recolhida ? 'Sair' : undefined}
          className={`flex items-center gap-2 mt-3 w-full transition-colors ${recolhida ? 'justify-center' : 'text-left'}`}
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
        >
          <LogOut size={14} />
          {!recolhida && 'Sair'}
        </button>

        {/* Botão recolher/expandir */}
        <button
          onClick={() => setRecolhida(v => !v)}
          title={recolhida ? 'Expandir menu' : 'Recolher menu'}
          className={`flex items-center gap-2 mt-3 w-full transition-colors ${recolhida ? 'justify-center' : 'text-left'}`}
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
        >
          {recolhida ? <ChevronRight size={16} /> : <><ChevronLeft size={14} /> Recolher</>}
        </button>
      </div>
    </aside>
  );
}
