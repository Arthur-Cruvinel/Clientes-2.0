// --- App principal ---
// React Router com lazy loading para cada feature.
// Rota /login é pública; demais rotas exigem autenticação via PrivateRoute.

import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './features/auth/LoginPage';
import { PrivateRoute } from './features/auth/PrivateRoute';
// Vitrine 360 — módulos placeholder (componentes triviais, import direto).
import {
  Resultados, Carteira, Juridico, ServicosDemanda, ApontamentoHoras, AutomacaoBancaria,
  AgenteWhatsapp, Tarefas, PlanejamentoFinanceiro, SaudeCliente, DossieCliente, ContratoVivo, FluxoCaixa, GestaoObra, Documentos,
  FluxoCaixaEmpresa, Processos,
} from './features/vitrine/modulos';

// Lazy loading: cada aba carrega sob demanda
const VisaoGeral   = lazy(() => import('./features/visao-geral/VisaoGeral').then(m => ({ default: m.VisaoGeral })));
const Gestores     = lazy(() => import('./features/gestores/Gestores').then(m => ({ default: m.Gestores })));
const Projecao     = lazy(() => import('./features/projecao/Projecao').then(m => ({ default: m.Projecao })));
const Simulador    = lazy(() => import('./features/simulador/Simulador').then(m => ({ default: m.Simulador })));
const Cenarios     = lazy(() => import('./features/cenarios/Cenarios').then(m => ({ default: m.Cenarios })));
const Capacidade   = lazy(() => import('./features/capacidade/Capacidade').then(m => ({ default: m.Capacidade })));
const Perfil       = lazy(() => import('./features/perfil/Perfil').then(m => ({ default: m.Perfil })));
const Poupanca     = lazy(() => import('./features/poupanca/Poupanca').then(m => ({ default: m.Poupanca })));
const Patrimonio   = lazy(() => import('./features/patrimonio/Patrimonio'));
const Evolucao     = lazy(() => import('./features/evolucao/Evolucao').then(m => ({ default: m.Evolucao })));
const Colaboradores = lazy(() => import('./features/colaboradores/ColaboradoresVisao').then(m => ({ default: m.ColaboradoresVisao })));

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
              {/* EMPRESA */}
              <Route path="visao-geral"  element={<VisaoGeral />} />
              <Route path="resultados"   element={<Resultados />} />
              <Route path="simulador"    element={<Simulador />} />
              <Route path="poupanca"     element={<Poupanca />} />
              <Route path="gestores"     element={<Gestores />} />
              <Route path="capacidade"   element={<Capacidade />} />
              <Route path="cenarios"     element={<Cenarios />} />
              <Route path="carteira"     element={<Carteira />} />
              <Route path="projecao"     element={<Projecao />} />
              <Route path="juridico"     element={<Juridico />} />
              <Route path="servicos-demanda"    element={<ServicosDemanda />} />
              <Route path="apontamento-horas"   element={<ApontamentoHoras />} />
              <Route path="automacao-bancaria"  element={<AutomacaoBancaria />} />
              <Route path="fluxo-caixa-empresa" element={<FluxoCaixaEmpresa />} />
              <Route path="agente-whatsapp"     element={<AgenteWhatsapp />} />
              <Route path="processos"    element={<Processos />} />
              <Route path="tarefas"      element={<Tarefas />} />
              {/* CLIENTE 360 */}
              <Route path="perfil"       element={<Perfil />} />
              <Route path="planejamento-financeiro" element={<PlanejamentoFinanceiro />} />
              <Route path="patrimonio"   element={<Patrimonio />} />
              <Route path="evolucao"     element={<Evolucao />} />
              <Route path="saude-cliente"   element={<SaudeCliente />} />
              <Route path="dossie-cliente"  element={<DossieCliente />} />
              <Route path="contrato-vivo"   element={<ContratoVivo />} />
              <Route path="gestao-obra"     element={<GestaoObra />} />
              <Route path="documentos"      element={<Documentos />} />
              <Route path="fluxo-caixa"     element={<FluxoCaixa />} />
              {/* SISTEMA */}
              <Route path="colaboradores"  element={<Colaboradores />} />
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
