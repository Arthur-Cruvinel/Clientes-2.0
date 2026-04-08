// --- PrivateRoute ---
// Redireciona para /login se o usuário não estiver autenticado.

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';

export function PrivateRoute() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  return <Outlet />;
}
