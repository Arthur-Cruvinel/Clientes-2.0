// --- App principal ---
// React Router com lazy loading para cada feature.
// Rota /login é pública; demais rotas exigem autenticação via PrivateRoute.

import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './features/auth/LoginPage';
import { PrivateRoute } from './features/auth/PrivateRoute';

// Lazy loading: cada aba carrega sob demanda
const VisaoGeral   = lazy(() => import('./features/visao-geral/VisaoGeral').then(m => ({ default: m.VisaoGeral })));
const Gestores     = lazy(() => import('./features/gestores/Gestores').then(m => ({ default: m.Gestores })));
const Projecao     = lazy(() => import('./features/projecao/Projecao').then(m => ({ default: m.Projecao })));
const Simulador    = lazy(() => import('./features/simulador/Simulador').then(m => ({ default: m.Simulador })));
const Cenarios     = lazy(() => import('./features/cenarios/Cenarios').then(m => ({ default: m.Cenarios })));
const Pipeline     = lazy(() => import('./features/pipeline/Pipeline').then(m => ({ default: m.Pipeline })));
const Capacidade   = lazy(() => import('./features/capacidade/Capacidade').then(m => ({ default: m.Capacidade })));
const Matriz       = lazy(() => import('./features/matriz/Matriz').then(m => ({ default: m.Matriz })));
const Risco        = lazy(() => import('./features/risco/Risco').then(m => ({ default: m.Risco })));
const Perfil       = lazy(() => import('./features/perfil/Perfil').then(m => ({ default: m.Perfil })));
const Poupanca     = lazy(() => import('./features/poupanca/Poupanca').then(m => ({ default: m.Poupanca })));
const Patrimonio   = lazy(() => import('./features/patrimonio/Patrimonio'));
const Evolucao     = lazy(() => import('./features/evolucao/Evolucao').then(m => ({ default: m.Evolucao })));
const Patrimonial  = lazy(() => import('./features/patrimonial/Patrimonial').then(m => ({ default: m.Patrimonial })));

// [NOVO] Central de Importação com 3 abas (wrapper sobre UploadImport + ImportPoupanca + GerenciarDados)
const UploadCentral = lazy(() => import('./features/upload/Upload').then(m => ({ default: m.Upload })));
const Configuracoes = lazy(() => import('./features/configuracoes/Configuracoes').then(m => ({ default: m.Configuracoes })));

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* Rota pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rotas protegidas */}
          <Route element={<PrivateRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<Navigate to="visao-geral" replace />} />
              <Route path="visao-geral"  element={<VisaoGeral />} />
              <Route path="gestores"     element={<Gestores />} />
              <Route path="projecao"     element={<Projecao />} />
              <Route path="simulador"    element={<Simulador />} />
              <Route path="cenarios"     element={<Cenarios />} />
              <Route path="pipeline"     element={<Pipeline />} />
              <Route path="capacidade"   element={<Capacidade />} />
              <Route path="matriz"       element={<Matriz />} />
              <Route path="risco"        element={<Risco />} />
              <Route path="perfil"       element={<Perfil />} />
              <Route path="poupanca"     element={<Poupanca />} />
              <Route path="patrimonio"   element={<Patrimonio />} />
              <Route path="evolucao"     element={<Evolucao />} />
              <Route path="patrimonial"  element={<Patrimonial />} />
              <Route path="upload" element={<UploadCentral />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="*" element={<Navigate to="visao-geral" replace />} />
            </Route>
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
