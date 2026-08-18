// File: App.tsx
import React, { useEffect } from 'react';
import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';

import Login from './components/Login';
import Dashboard from './components/Dashboard';

// Importando as páginas
import Board from './components/Board';
import Calendar from './components/Calendar';
import Schedule52Weeks from './components/Schedule52Weeks';
import MaintenancePlans from './components/MaintenancePlans';

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
         <Route path="kanban" element={<Board />} />
         <Route path="calendar" element={<Calendar />} />
         <Route path="schedule" element={<Schedule52Weeks />} />
         <Route path="plans" element={<MaintenancePlans />} />
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
  );
};

export default App;