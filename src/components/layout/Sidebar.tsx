// --- Sidebar de navegação ---
// Identidade visual Galácticos Capital: fundo #160F41, gradiente azul→rosa nos itens ativos.
// Rodapé: avatar do usuário logado + botão sair.
// Recolhível (modo só-ícones): estado auto-contido + persistência em localStorage.
// Como o <main> do MainLayout usa flex-1, ele reflowa sozinho quando a largura
// da sidebar muda — não há offset manual a sincronizar.

import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingUp, Calculator, Layers,
  GitBranch, Gauge, Grid3X3, ShieldAlert, UserCircle,
  PiggyBank, BarChart2, LineChart, Landmark, Upload, Settings,
  LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../state/AuthContext';

// Chave de persistência da preferência de recolhimento.
const STORAGE_KEY = 'sidebar_recolhida';
const LARGURA_EXPANDIDA = 220;
const LARGURA_RECOLHIDA = 64;

interface AbaConfig {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const ABAS: AbaConfig[] = [
  { path: 'visao-geral',  label: 'Visão Geral',  icon: <LayoutDashboard size={16} /> },
  { path: 'gestores',     label: 'Gestores',      icon: <Users size={16} /> },
  { path: 'projecao',     label: 'Projeção',      icon: <TrendingUp size={16} /> },
  { path: 'simulador',    label: 'Simulador',     icon: <Calculator size={16} /> },
  { path: 'cenarios',     label: 'Cenários',      icon: <Layers size={16} /> },
  { path: 'pipeline',     label: 'Pipeline',      icon: <GitBranch size={16} /> },
  { path: 'capacidade',   label: 'Capacidade',    icon: <Gauge size={16} /> },
  { path: 'matriz',       label: 'Matriz',        icon: <Grid3X3 size={16} /> },
  { path: 'risco',        label: 'Risco',         icon: <ShieldAlert size={16} /> },
  { path: 'perfil',       label: 'Perfil',        icon: <UserCircle size={16} /> },
  { path: 'poupanca',     label: 'AUM & Performance', icon: <PiggyBank size={16} /> },
  { path: 'patrimonio',   label: 'Patrimônio',    icon: <BarChart2 size={16} /> },
  { path: 'evolucao',     label: 'Evolução',      icon: <LineChart size={16} /> },
  { path: 'patrimonial',  label: 'Patrimonial',   icon: <Landmark size={16} /> },
];

const ABA_UPLOAD: AbaConfig = { path: 'upload', label: 'Upload', icon: <Upload size={16} /> };
const ABA_CONFIG: AbaConfig = { path: 'configuracoes', label: 'Configurações', icon: <Settings size={16} /> };
const ABAS_ADMIN = [ABA_UPLOAD, ABA_CONFIG];

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
        {!recolhida && aba.label}
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
        {ABAS.map(renderNavLink)}

        {/* Divisor — funções administrativas abaixo */}
        <div className="mx-5 my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }} />

        {ABAS_ADMIN.map(renderNavLink)}
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
