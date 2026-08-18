// File: components/Header.tsx
// Este componente renderiza o cabeçalho superior da aplicação, visível no Dashboard.

import React from 'react';
import { Menu, Search, Plus, Bell, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import { Role } from '../types';

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onMenuClick: () => void;
  toggleSidebar: () => void;
  onNewOSClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  searchTerm, 
  setSearchTerm, 
  onMenuClick, 
  onNewOSClick 
}) => {
  const { user, logout } = useAuth();

  // ✅ Bloqueia permissão para Técnicos e Auxiliares
  const isAllowedToCreate = user?.role !== Role.TECHNICIAN && user?.role !== Role.ASSISTANT;

  return (
    <header className="h-16 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between px-4 z-10 shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>
        
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar OSs (ID, título, técnico, usina...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        {/* ✅ AQUI: Renderiza apenas se tiver permissão e função */}
        {onNewOSClick && isAllowedToCreate && (
          <button
            onClick={onNewOSClick}
            className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Nova OS</span>
          </button>
        )}

        <NotificationBell />
        
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Sair"
          >
            <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;