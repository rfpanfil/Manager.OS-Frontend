// File: App.tsx
import React, { useEffect } from 'react';
import './style.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useCan } from './components/hooks/useCan';
import { OfflineProvider } from './contexts/OfflineContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Importando as páginas
import Board from './pages/Board';
import Calendar from './pages/Calendar';
import Schedule52Weeks from './pages/Schedule52Weeks';
import MaintenancePlans from './pages/MaintenancePlans';
import AdminPermissoes from './pages/AdminPermissoes';
import Empresas from './pages/Empresas';
import Auditoria from './pages/Auditoria';

const ProtectedRoute = ({ children, requiredPermission, requireSuperadmin = false }: { children: React.ReactNode, requiredPermission?: string, requireSuperadmin?: boolean }) => {
  const can = useCan();
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (requireSuperadmin && !user.is_superadmin) {
      return (
          <div className="flex items-center justify-center h-full">
              <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-bold text-red-600 mb-2">Acesso Negado</h2>
                  <p className="text-gray-600 dark:text-gray-400">Apenas administradores podem acessar esta página.</p>
              </div>
          </div>
      );
  }

  if (requiredPermission && !can(requiredPermission)) {
      return (
          <div className="flex items-center justify-center h-full">
              <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-bold text-red-600 mb-2">Acesso Negado</h2>
                  <p className="text-gray-600 dark:text-gray-400">Você não tem permissão para acessar esta página.</p>
              </div>
          </div>
      );
  }
  
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />

      {/* Rota Pai (Layout do Dashboard) */}
      <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" replace />}>
         {/* Redirecionamento padrão: / -> /kanban */}
         <Route index element={<Navigate to="kanban" replace />} />
         
         {/* Rotas Filhas (Renderizadas dentro do Outlet do Dashboard) */}
         <Route path="kanban" element={<ProtectedRoute requiredPermission="kanban.acessar"><Board /></ProtectedRoute>} />
         <Route path="calendar" element={<ProtectedRoute requiredPermission="calendario.acessar"><Calendar /></ProtectedRoute>} />
         <Route path="schedule" element={<ProtectedRoute requiredPermission="cronograma.acessar"><Schedule52Weeks /></ProtectedRoute>} />
         <Route path="plans" element={<ProtectedRoute requiredPermission="planos.visualizar"><MaintenancePlans /></ProtectedRoute>} />
         <Route path="admin/permissoes" element={<ProtectedRoute requireSuperadmin={true}><AdminPermissoes /></ProtectedRoute>} />
         <Route path="admin/empresas" element={<ProtectedRoute requireSuperadmin={true}><Empresas /></ProtectedRoute>} />
         <Route path="admin/auditoria" element={<ProtectedRoute requireSuperadmin={true}><Auditoria /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    const hasCleaned = localStorage.getItem('HAS_CLEANED_GHOSTS_V1');
    if (!hasCleaned) {
      console.warn("🧹 Executando Limpeza Nuclear de Dados Fantasmas...");
      localStorage.clear();
      if (window.indexedDB) {
        const req = window.indexedDB.deleteDatabase('loopos-offline-db');
        req.onsuccess = () => console.log("✅ Banco Offline deletado com sucesso.");
        req.onerror = () => console.log("⚠️ Erro ao deletar banco offline.");
      }
      localStorage.setItem('HAS_CLEANED_GHOSTS_V1', 'true');
      alert("O sistema realizou uma limpeza de segurança. Por favor, faça login novamente.");
      window.location.reload();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DataProvider>
        <AuthProvider>
          <OfflineProvider>
            <BrowserRouter>
              <div className="min-h-screen text-gray-800 dark:text-gray-200">
                <AppContent />
              </div>
            </BrowserRouter>
          </OfflineProvider>
        </AuthProvider>
      </DataProvider>
    </QueryClientProvider>
  );
};

export default App;