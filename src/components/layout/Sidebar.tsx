// --- Sidebar de navegação ---
// Identidade visual Galácticos Capital: fundo #160F41, gradiente azul→rosa nos itens ativos.
// Rodapé: avatar do usuário logado + botão sair.

import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingUp, Calculator, Layers,
  GitBranch, Gauge, Grid3X3, ShieldAlert, UserCircle,
  PiggyBank, BarChart2, LineChart, Landmark, Upload, Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../state/AuthContext';

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

function navLinkClass(isActive: boolean) {
  return isActive
    ? 'border-l-gradient flex items-center gap-3 px-5 py-2.5 text-white font-medium transition-colors'
    : 'flex items-center gap-3 px-5 py-2.5 transition-colors border-l-3 border-transparent';
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

  // Iniciais do nome (até 2 letras)
  const iniciais = usuario?.nome
    ? usuario.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const badge = ROLE_BADGE[usuario?.role ?? ''] ?? ROLE_BADGE.visualizador;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside
      className="flex flex-col min-h-screen"
      style={{ width: 220, backgroundColor: '#160F41' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center">
        <img
          src="/logo-galaticos-header.svg"
          alt="Galácticos Capital"
          style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
        />
      </div>

      {/* Navegação */}
      <nav className="flex-1 py-2 space-y-0.5">
        {ABAS.map((aba) => (
          <NavLink
            key={aba.path}
            to={aba.path}
            className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => navLinkStyle(isActive)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span style={{ opacity: 0.7 }}>{aba.icon}</span>
            {aba.label}
          </NavLink>
        ))}

        {/* Divisor — funções administrativas abaixo */}
        <div className="mx-5 my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }} />

        {ABAS_ADMIN.map((aba) => (
          <NavLink
            key={aba.path}
            to={aba.path}
            className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => navLinkStyle(isActive)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span style={{ opacity: 0.7 }}>{aba.icon}</span>
            {aba.label}
          </NavLink>
        ))}
      </nav>

      {/* Rodapé — perfil do usuário */}
      <div
        className="px-4 py-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className="flex items-center gap-3">
          {/* Avatar com iniciais */}
          <div
            className="flex items-center justify-center rounded-full text-white font-semibold shrink-0"
            style={{
              width: 32,
              height: 32,
              fontSize: 12,
              background: 'linear-gradient(135deg, #0065FF, #D000BB)',
            }}
          >
            {iniciais}
          </div>

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
        </div>

        {/* Badge de role */}
        <span
          className="inline-block mt-2 px-2 py-0.5 rounded-full text-white font-medium"
          style={{ fontSize: 10, backgroundColor: badge.bg }}
        >
          {badge.label}
        </span>

        {/* Botão Sair */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mt-3 w-full text-left transition-colors"
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    </aside>
  );
}
