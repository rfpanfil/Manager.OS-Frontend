// File: components/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, LogOut, ChevronLeft, ChevronRight,
  CalendarDays, Factory, ClipboardList, ShieldCheck, Monitor, 
  UserCheck, Eye, Wrench, HelpingHand, Briefcase, Activity, User
} from 'lucide-react';
import { Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useCan } from './hooks/useCan';

interface SidebarProps {
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  setModalConfig: (config: any) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen,
  setMobileOpen,
  isCollapsed,
  setIsCollapsed,
  setModalConfig
}) => {
  const { user, token, logout, switchCompany } = useAuth();
  const can = useCan();
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([]);
  const [cargos, setCargos] = useState<{id: string, nome: string}[]>([]);

  useEffect(() => {
    if (user?.is_superadmin && token) {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001';
      fetch(`${API_BASE}/api/empresas/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(async res => {
          if (!res.ok) throw new Error('Falha ao buscar empresas');
          return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setCompanies(data);
      })
      .catch(console.error);
    }

    if (token) {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001';
      fetch(`${API_BASE}/api/users/cargos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(async res => {
          if (!res.ok) throw new Error('Falha ao buscar cargos');
          return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
            const uniqueCargos = Array.from(new Map(data.map(item => [item.nome, item])).values());
            setCargos(uniqueCargos);
        }
      })
      .catch(console.error);
    }
  }, [user, token]);

  const menuItems = [
    { path: '/kanban', label: 'Painel Kanban', icon: LayoutDashboard, permission: 'kanban.acessar' },
    { path: '/calendar', label: 'Calendário', icon: Calendar, permission: 'calendario.acessar' },
    { path: '/schedule', label: 'Cronograma 52 Semanas', icon: CalendarDays, permission: 'cronograma.acessar' },
    { path: '/plans', label: 'Planos de Manutenção', icon: ClipboardList, permission: 'planos.visualizar' },
  ].filter(item => can(item.permission));

  if (user?.is_superadmin) {
      menuItems.push({ path: '/admin/empresas', label: 'Empresas', icon: Briefcase });
      menuItems.push({ path: '/admin/permissoes', label: 'Permissões', icon: ShieldCheck });
      menuItems.push({ path: '/admin/auditoria', label: 'Auditoria', icon: Activity });
  }

  // Fallbacks de ícones para nomes conhecidos
  const getRoleIcon = (roleName: string) => {
    const lower = roleName.toLowerCase();
    if (lower.includes('admin')) return ShieldCheck;
    if (lower.includes('opera')) return Monitor;
    if (lower.includes('coord')) return UserCheck;
    if (lower.includes('super')) return Eye;
    if (lower.includes('tec') || lower.includes('téc')) return Wrench;
    if (lower.includes('auxil')) return HelpingHand;
    if (lower.includes('client')) return Briefcase;
    return User; // Ícone padrão
  };

  const visibleRoleButtons = cargos.map(c => ({
      role: c.nome,
      label: c.nome.charAt(0).toUpperCase() + c.nome.slice(1),
      icon: getRoleIcon(c.nome)
  }));

  const handleOpenUserRole = (roleFilter: string, label: string) => {
    setModalConfig({ type: 'MANAGE_USERS', data: { roleFilter, label } });
    setMobileOpen(false);
  };

  const handleOpenPlants = () => {
    setModalConfig({ type: 'MANAGE_PLANTS', data: null });
    setMobileOpen(false);
  };

  const canViewTeam = can('usuarios.visualizar');
  const canViewPlants = can('usinas.visualizar');

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`
        fixed lg:static inset-y-0 left-0 z-30
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transition-all duration-300 ease-in-out flex flex-col
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {!isCollapsed && (
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent truncate">loop.OS Manager</span>
          )}
          {isCollapsed && <span className="mx-auto text-xl font-bold text-blue-600">L</span>}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hidden lg:block">
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 lg:hidden">
            <ChevronLeft size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {user?.is_superadmin && !isCollapsed && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                <label className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-2 block">Visualizando Empresa</label>
                <select 
                    className="w-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-sm rounded p-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={user.company_id || ''}
                    onChange={(e) => switchCompany(e.target.value)}
                >
                    <option value="" disabled>Selecione uma empresa...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
          )}
          
          {!isCollapsed && <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Operação</div>}
          {menuItems.map((item) => {
            if (item.label === 'Empresas' && !isCollapsed) {
                return (
                    <React.Fragment key="admin-title">
                        <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">Administração</div>
                        <NavLink
                            to={item.path}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => `
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                            ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
                            `}
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    </React.Fragment>
                );
            }

            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </NavLink>
            );
          })}

          <div className="my-4 border-t border-gray-200 dark:border-gray-700" />

          {canViewTeam && (
            <>
              {!isCollapsed && <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Equipes</div>}
              {visibleRoleButtons.map((roleItem) => (
                <button
                  key={roleItem.role}
                  onClick={() => handleOpenUserRole(roleItem.role, roleItem.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? roleItem.label : undefined}
                >
                  <roleItem.icon size={20} />
                  {!isCollapsed && <span className="font-medium text-sm">{roleItem.label}</span>}
                </button>
              ))}
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            </>
          )}

          {canViewPlants && (
            <>
              {!isCollapsed && <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">Usinas</div>}
              <button
                onClick={handleOpenPlants}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? "Usinas" : undefined}
              >
                <Factory size={20} />
                {!isCollapsed && <span className="font-medium">Usinas</span>}
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.role || 'Visitante'}</p>
              </div>
            )}
            <button onClick={logout} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Sair">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;