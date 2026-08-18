// File: components/Dashboard.tsx
import React, { useState, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { OS } from '../types';
import { Plus } from 'lucide-react'; // ✅ Importar ícone Plus

// Componentes de Layout
import Sidebar from './Sidebar';
import Header from './Header';

// Modais
import OSDetailModal from './modals/OSDetailModal';
import OSForm from './modals/OSForm';
import UserForm from './modals/UserForm';
import PlantForm from './modals/PlantForm';
import DownloadModal from './modals/DownloadModal';
import ScheduleOSModal from './modals/ScheduleOSModal';
import ManagementModal, { ManagementModalConfig } from './modals/ManagementModal';

export interface DashboardContextType {
  filteredOSList: OS[];
  searchTerm: string;
  openModal: (type: DashboardModalConfig['type'], data?: any) => void;
}

export interface DashboardModalConfig {
  type: 'OS_DETAIL' | 'OS_FORM' | 'MANAGE_USERS' | 'MANAGE_PLANTS' | 'USER_FORM' | 'PLANT_FORM' | 'DOWNLOAD_FILTER' | 'SCHEDULE_RECURRENCE';
  data?: any;
}

const Dashboard: React.FC = () => {
  const { osList, plants, users } = useData();
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<DashboardModalConfig | null>(null);

  const filteredOSList = useMemo(() => {
    if (!searchTerm.trim()) return osList;
    const lowerTerm = searchTerm.toLowerCase();

    return osList.filter(os => {
        const plantName = plants.find(p => p.id === os.plantId)?.name.toLowerCase() || '';
        const techName = users.find(u => u.id === os.technicianId)?.name.toLowerCase() || '';
        const osTitle = os.title.toLowerCase();
        const osId = os.id.toLowerCase();
        const osDesc = os.description?.toLowerCase() || '';
        const assetsStr = os.assets 
            ? os.assets.join(' ').toLowerCase() 
            : ((os as any).assetName || '').toLowerCase();

        return (
            osTitle.includes(lowerTerm) ||
            osId.includes(lowerTerm) ||
            plantName.includes(lowerTerm) ||
            techName.includes(lowerTerm) ||
            osDesc.includes(lowerTerm) ||
            assetsStr.includes(lowerTerm)
        );
    });
  }, [osList, searchTerm, plants, users]);

  const closeModal = () => setModalConfig(null);
  
  const handleOpenModal = (type: DashboardModalConfig['type'], data?: any) => {
    setModalConfig({ type, data });
  };

  const contextValue: DashboardContextType = {
    filteredOSList,
    searchTerm,
    openModal: handleOpenModal
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <Sidebar
        isMobileOpen={isMobileOpen}
        setMobileOpen={setIsMobileOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        setModalConfig={setModalConfig} 
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Header 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onMenuClick={() => setIsMobileOpen(true)}
          onNewOSClick={() => setModalConfig({ type: 'OS_FORM' })}
        />

        <main className="flex-1 overflow-hidden relative p-0 sm:p-2">
            <Outlet context={contextValue} />
            
            {/* ✅ BOTÃO FLUTUANTE PARA MOBILE (FAB) */}
            <button
              className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-transform active:scale-95"
              onClick={() => setModalConfig({ type: 'OS_FORM' })}
              title="Nova Ordem de Serviço"
            >
              <Plus size={28} />
            </button>
        </main>
      </div>

      {/* --- MODAIS GLOBAIS --- */}
      {modalConfig?.type === 'OS_DETAIL' && (
        <OSDetailModal
          isOpen={true}
          os={modalConfig.data.os}
          onClose={closeModal}
          onEdit={() => setModalConfig({ type: 'OS_FORM', data: { os: modalConfig.data.os } })}
        />
      )}

      {modalConfig?.type === 'OS_FORM' && (
        <OSForm
          isOpen={true}
          initialData={modalConfig.data?.os}
          onClose={closeModal}
        />
      )}

      {modalConfig?.type === 'SCHEDULE_RECURRENCE' && (
        <ScheduleOSModal
          isOpen={true}
          onClose={closeModal}
        />
      )}

      {(modalConfig?.type === 'MANAGE_USERS' || modalConfig?.type === 'MANAGE_PLANTS') && (
        <ManagementModal
          isOpen={true}
          onClose={closeModal}
          config={modalConfig as unknown as ManagementModalConfig} 
          onOpenUserForm={(userToEdit, roleToSet) => setModalConfig({ 
              type: 'USER_FORM', 
              data: { user: userToEdit, role: roleToSet, parentConfig: modalConfig } 
          })}
          onOpenPlantForm={(plantToEdit) => setModalConfig({ 
              type: 'PLANT_FORM', 
              data: { plant: plantToEdit, parentConfig: modalConfig } 
          })}
        />
      )}

      {modalConfig?.type === 'USER_FORM' && (
        <UserForm
          isOpen={true}
          user={modalConfig.data?.user}
          role={modalConfig.data?.role} 
          onClose={() => modalConfig.data?.parentConfig ? setModalConfig(modalConfig.data.parentConfig) : closeModal()}
        />
      )}

      {modalConfig?.type === 'PLANT_FORM' && (
        <PlantForm
          isOpen={true}
          initialData={modalConfig.data?.plant}
          onClose={() => modalConfig.data?.parentConfig ? setModalConfig(modalConfig.data.parentConfig) : closeModal()}
        />
      )}

      {modalConfig?.type === 'DOWNLOAD_FILTER' && (
        <DownloadModal 
            isOpen={true} 
            onClose={closeModal}
            initialStatus={modalConfig.data?.status}
        />
      )}
    </div>
  );
};

export default Dashboard;