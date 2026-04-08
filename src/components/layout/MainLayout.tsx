// --- Layout principal do dashboard ---
// Tema claro com sidebar escura.

import { Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div
        className="animate-spin rounded-full h-8 w-8 border-b-2"
        style={{ borderColor: '#0065FF' }}
      />
    </div>
  );
}

export function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
          <Suspense fallback={<LoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
