// --- LoginPage ---
// Tela de login centralizada com identidade visual Galácticos Capital.

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../state/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await login(email, senha);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-disabled') {
        setErro('Usuário desativado. Contate o administrador.');
      } else {
        setErro('E-mail ou senha incorretos.');
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ backgroundColor: '#160F41' }}
    >
      <div
        className="bg-white shadow-2xl"
        style={{ width: 400, borderRadius: 16, padding: 40 }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center">
          <img
            src="/logo-galaticos-header.svg"
            alt="Galácticos Capital"
            style={{ height: 40, objectFit: 'contain' }}
          />
          <h1
            className="mt-4 font-semibold"
            style={{ fontSize: 18, color: '#160F41' }}
          >
            Galácticos CFO
          </h1>
          <p className="text-sm" style={{ color: '#6b6b8a' }}>
            Plataforma de Gestão Patrimonial
          </p>
        </div>

        {/* Divider */}
        <div
          className="mt-6 mb-6"
          style={{ borderTop: '1px solid #e5e7eb' }}
        />

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
              style={{ color: '#374151' }}
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="senha"
              className="block text-sm font-medium mb-1"
              style={{ color: '#374151' }}
            >
              Senha
            </label>
            <div className="relative">
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Mensagem de erro */}
          {erro && (
            <p className="text-sm text-red-600 text-center">{erro}</p>
          )}

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={carregando}
            className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #0065FF, #D000BB)',
            }}
          >
            {carregando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Rodapé */}
        <p
          className="text-center mt-6"
          style={{ fontSize: 12, color: '#94a3b8' }}
        >
          &copy; 2026 Galácticos Capital &mdash; Uso interno
        </p>
      </div>
    </div>
  );
}
