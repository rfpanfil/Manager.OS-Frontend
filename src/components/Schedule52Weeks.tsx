// File: components/Schedule52Weeks.tsx
import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { OS, Role, Priority } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import Modal from './modals/Modal';
import ScheduleOSModal from './modals/ScheduleOSModal'; 
import { DashboardContextType } from './Dashboard';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react'; // ✅ Ícones novos

const Schedule52Weeks: React.FC = () => {
  const { filteredOSList, searchTerm, openModal } = useOutletContext<DashboardContextType>();
  
  const onCardClick = (os: OS) => openModal('OS_DETAIL', { os });

  const { plants, users, filterOSForUser, deleteOSBatch } = useData();
  const { user } = useAuth();

  // Estados de Filtro
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState('');

  // ✅ NOVO: Estado para controlar visibilidade dos filtros no mobile
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [moreInfoModal, setMoreInfoModal] = useState<{ isOpen: boolean; title: string; items: OS[] }>({
      isOpen: false, title: '', items: []
  });

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedOSIds, setSelectedOSIds] = useState<string[]>([]);
   
  const canManage = user?.role === Role.ADMIN || user?.role === Role.OPERATOR;
  const years = [2024, 2025, 2026, 2027];

  // --- LÓGICAS DE FILTRO E MEMO (Mantidas idênticas) ---
  const availablePlants = useMemo(() => {
      const filtered = plants.filter(plant => {
          if (!user) return false;
          if ([Role.ADMIN, Role.OPERATOR].includes(user.role)) return true;
          return user.plantIds?.includes(plant.id);
      });
      return filtered.sort((a,b) => a.name.localeCompare(b.name));
  }, [plants, user]);

  const availableUsers = useMemo(() => {
      if (!user) return [];
      if ([Role.ADMIN, Role.OPERATOR].includes(user.role)) return users;
      const myPlantIds = user.plantIds || [];
      return users.filter(targetUser => {
          const targetPlants = targetUser.plantIds || [];
          return targetPlants.some(pId => myPlantIds.includes(pId));
      }).sort((a,b) => a.name.localeCompare(b.name));
  }, [users, user]);

  const availableClients = useMemo(() => {
      const clients = new Set(availablePlants.map(p => p.client || 'Indefinido'));
      return Array.from(clients).sort();
  }, [availablePlants]);

  const uniqueAssets = useMemo(() => {
    const assetsSet = new Set<string>();
    filteredOSList.forEach(os => {
      if (os.assets && os.assets.length > 0) {
        os.assets.forEach(a => assetsSet.add(a));
      }
      if ((os as any).assetName) {
        assetsSet.add((os as any).assetName);
      }
    });
    return Array.from(assetsSet).sort();
  }, [filteredOSList]);

  const visibleOS = useMemo(() => {
    let list = user ? filterOSForUser(user) : filteredOSList;
    list = list.filter(os => {
        const date = new Date(os.startDate);
        if (date.getFullYear() !== selectedYear) return false;
        
        const plant = plants.find(p => p.id === os.plantId);
        if (selectedClient && plant?.client !== selectedClient) return false;
        if (selectedPlant && os.plantId !== selectedPlant) return false;
        if (!availablePlants.find(p => p.id === os.plantId)) return false;
        if (selectedPriority && os.priority !== selectedPriority) return false;
        if (selectedAsset) {
            const hasAsset = (os.assets && os.assets.includes(selectedAsset)) || 
                             ((os as any).assetName === selectedAsset);
            if (!hasAsset) return false;
        }
        if (selectedTechnician && os.technicianId !== selectedTechnician) return false;
        return true;
    });
    return list;
  }, [filteredOSList, user, selectedYear, selectedClient, selectedPlant, selectedPriority, selectedAsset, selectedTechnician, plants, availablePlants, filterOSForUser]);

  const weeks = useMemo(() => {
    const weeksArray = [];
    const startDate = new Date(selectedYear, 0, 1);
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); 
    const firstMonday = new Date(startDate.setDate(diff));

    for (let i = 0; i < 52; i++) {
      const start = new Date(firstMonday);
      start.setDate(firstMonday.getDate() + (i * 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      weeksArray.push({ weekNumber: i + 1, start, end });
    }
    return weeksArray;
  }, [selectedYear]);

  const osByWeek = useMemo(() => {
    const grouped: Record<number, OS[]> = {};
    visibleOS.forEach(os => {
        const date = new Date(os.startDate);
        const startOfYear = new Date(selectedYear, 0, 1);
        const pastDays = (date.getTime() - startOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
        if (weekNum >= 1 && weekNum <= 52) {
            if (!grouped[weekNum]) grouped[weekNum] = [];
            grouped[weekNum].push(os);
        }
    });
    return grouped;
  }, [visibleOS, selectedYear]);

  const toggleSelection = (id: string) => {
      setSelectedOSIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
      if (selectedOSIds.length === visibleOS.length && visibleOS.length > 0) {
          setSelectedOSIds([]); 
      } else {
          setSelectedOSIds(visibleOS.map(os => os.id)); 
      }
  };

  const handleDeleteSelected = async () => {
      if (!confirm(`Excluir ${selectedOSIds.length} OSs selecionadas?`)) return;
      await deleteOSBatch(selectedOSIds);
      setSelectedOSIds([]);
      setIsSelectionMode(false);
  };
   
  const handleShowMore = (weekNum: number, items: OS[]) => {
      if (isSelectionMode) return; 
      setMoreInfoModal({
          isOpen: true,
          title: `Semana ${weekNum} - ${items.length} OSs`,
          items: items
      });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgente': return 'bg-red-500 hover:bg-red-600';
      case 'Alta': return 'bg-orange-500 hover:bg-orange-600';
      case 'Média': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'Baixa': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  const getPlantName = (plantId: string) => {
    return plants.find(p => p.id === plantId)?.name || plantId;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const selectClass = "text-sm border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white py-1.5 px-3 w-full lg:w-auto";

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      
      {/* 1. BARRA DE FILTROS (MODIFICADA PARA RESPONSIVIDADE) */}
      <div className="flex-none p-4 pb-0 bg-gray-50 dark:bg-gray-900 z-10">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border-b dark:border-gray-700">
            
            {/* Cabeçalho do Filtro + Botões de Ação */}
            <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
                
                {/* Botão Toggle Mobile */}
                <button 
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className="lg:hidden flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg w-full sm:w-auto justify-center"
                >
                    <Filter className="w-4 h-4" />
                    Filtros
                    {isFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {/* Texto Desktop */}
                <span className="hidden lg:block text-sm font-bold text-gray-700 dark:text-gray-300 mr-2">
                    Filtros:
                </span>

                {/* Botões de Ação (Sempre visíveis ou adaptados) */}
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                    {canManage && (
                        <>
                            {isSelectionMode ? (
                                <div className="flex gap-2 animate-fadeIn items-center w-full justify-end">
                                    <label className="flex items-center space-x-2 cursor-pointer bg-blue-50 dark:bg-slate-700 px-3 py-1.5 rounded border dark:border-gray-600">
                                        <input type="checkbox" checked={selectedOSIds.length === visibleOS.length && visibleOS.length > 0} onChange={handleSelectAll} className="rounded text-blue-600 w-4 h-4" />
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Todos</span>
                                    </label>
                                    <button onClick={handleDeleteSelected} disabled={selectedOSIds.length === 0} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded shadow-sm hover:bg-red-700 disabled:bg-gray-400">
                                        🗑️
                                    </button>
                                    <button onClick={() => setIsSelectionMode(false)} className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-200 rounded shadow-sm hover:bg-gray-300">
                                        X
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => setIsSelectionMode(true)} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded shadow-sm hover:bg-blue-700 flex items-center gap-2">
                                    ✏️ <span className="hidden sm:inline">Gerenciar</span>
                                </button>
                            )}
                            <button onClick={() => setIsSchedulerOpen(true)} className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded shadow-sm hover:bg-green-700 flex items-center gap-2">
                                + <span className="hidden sm:inline">Agendar</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Container dos Selects (Colapsável no Mobile) */}
            <div className={`
                flex-col lg:flex-row flex-wrap gap-3 items-center
                ${isFiltersOpen ? 'flex mt-3 border-t pt-3 dark:border-gray-700' : 'hidden'} 
                lg:flex lg:mt-0 lg:border-none lg:pt-0
            `}>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={selectClass}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                <select value={selectedClient} onChange={e => { setSelectedClient(e.target.value); setSelectedPlant(''); }} className={selectClass}><option value="">Todos Clientes</option>{availableClients.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select value={selectedPlant} onChange={e => setSelectedPlant(e.target.value)} className={selectClass} disabled={!selectedClient && plants.length > 20}><option value="">Todas Usinas</option>{availablePlants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <select value={selectedPriority} onChange={e => setSelectedPriority(e.target.value)} className={selectClass}><option value="">Todas Prioridades</option>{Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}</select>
                <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)} className={selectClass}><option value="">Todos Ativos</option>{uniqueAssets.map(a => <option key={a} value={a}>{a}</option>)}</select>
                <select value={selectedTechnician} onChange={e => setSelectedTechnician(e.target.value)} className={selectClass}><option value="">Todos Técnicos</option>{availableUsers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>

        </div>
      </div>

      {/* 2. ÁREA DE ROLAGEM */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pb-10">
            {weeks.map(w => {
                const items = osByWeek[w.weekNumber] || [];
                const visibleLimit = 3;
                const visibleItems = items.slice(0, visibleLimit);
                const hiddenCount = items.length - visibleLimit;

                return (
                    <div key={w.weekNumber} className={`border dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-2 min-h-[160px] flex flex-col shadow-sm transition-colors ${isSelectionMode ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer' : ''}`}>
                        <div className="text-sm text-center text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 mb-2 pb-1">
                            <span className="font-bold block">SEM {w.weekNumber}</span> 
                            <span className="text-xs opacity-75">{formatDate(w.start)} - {formatDate(w.end)}</span>
                        </div>
                        
                        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                            {visibleItems.map(os => {
                                const isSelected = selectedOSIds.includes(os.id);
                                return (
                                    <div 
                                        key={os.id} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            isSelectionMode ? toggleSelection(os.id) : onCardClick(os);
                                        }}
                                        className={`text-xs px-2 py-1.5 rounded text-white cursor-pointer truncate flex flex-col justify-center shadow-sm transition-all ${
                                            isSelectionMode && isSelected ? 'ring-2 ring-red-500 bg-red-500 scale-95' : 
                                            getPriorityColor(os.priority)
                                        }`}
                                        title={`${getPlantName(os.plantId)} - ${os.activity}`}
                                    >
                                        <span className="font-bold truncate text-xs">{getPlantName(os.plantId)}</span>
                                        <span className="truncate opacity-90 text-[11px]">{os.activity}</span>
                                    </div>
                                );
                            })}

                            {hiddenCount > 0 && (
                                <div 
                                    className="mt-auto text-xs text-center text-blue-600 dark:text-blue-400 font-bold cursor-pointer bg-blue-50 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600 rounded py-1 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleShowMore(w.weekNumber, items);
                                    }}
                                >
                                    + {hiddenCount} mais...
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
      </div>

      {/* MODAL VER MAIS (MANTIDO IGUAL) */}
      {moreInfoModal.isOpen && (
          <Modal 
            isOpen={true} 
            onClose={() => setMoreInfoModal({ ...moreInfoModal, isOpen: false })} 
            title={moreInfoModal.title}
            footer={<button onClick={() => setMoreInfoModal({ ...moreInfoModal, isOpen: false })} className="btn-secondary">Fechar</button>}
          >
              <div className="space-y-3 max-h-[60vh] overflow-y-auto p-2">
                  {moreInfoModal.items.map(os => (
                      <div 
                        key={os.id} 
                        onClick={() => {
                            setMoreInfoModal({ ...moreInfoModal, isOpen: false });
                            onCardClick(os);
                        }}
                        className={`p-3 rounded-lg text-white cursor-pointer hover:opacity-90 shadow-sm flex justify-between items-center ${getPriorityColor(os.priority)}`}
                      >
                          <div className="flex flex-col overflow-hidden">
                             <span className="font-bold text-sm">{getPlantName(os.plantId)}</span>
                             <span className="text-xs truncate">{os.activity}</span>
                          </div>
                          <span className="text-sm bg-black/20 px-2 py-1 rounded whitespace-nowrap ml-3">{formatDate(new Date(os.startDate))}</span>
                      </div>
                  ))}
              </div>
          </Modal>
      )}

      <ScheduleOSModal 
        isOpen={isSchedulerOpen}
        onClose={() => setIsSchedulerOpen(false)}
      />

    </div>
  );
};

export default Schedule52Weeks;