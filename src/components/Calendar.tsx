// File: components/Calendar.tsx
import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { OS, Priority, Role } from '../types'; 
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import Modal from './modals/Modal';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, FileText, Filter, ChevronDown, ChevronUp } from 'lucide-react'; // ✅ Ícones
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateOSReport } from './utils/pdfGenerator';
import { saveFile } from './utils/fileSaver';
import { DashboardContextType } from './Dashboard'; 

interface DayInfo {
  date: Date;
  isCurrentMonth: boolean;
  dayNumber: number;
}

const Calendar: React.FC = () => {
  const { filteredOSList: osList, openModal } = useOutletContext<DashboardContextType>();
  
  const onCardClick = (os: OS) => openModal('OS_DETAIL', { os });

  const { plants, users } = useData();
  const { user } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  
  // ✅ NOVO: Estado para visibilidade dos filtros
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Filtros
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState('');

  // Relatório
  const [reportStartDate, setReportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [moreInfoModal, setMoreInfoModal] = useState<{ isOpen: boolean; title: string; items: OS[] }>({
      isOpen: false, title: '', items: []
  });

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
    osList.forEach(os => {
        if ((os as any).assetName) assetsSet.add((os as any).assetName);
        if (os.assets && os.assets.length > 0) os.assets.forEach(a => assetsSet.add(a));
    });
    return Array.from(assetsSet).sort();
  }, [osList]);

  const getPlantName = (id: string) => plants.find(p => p.id === id)?.name || id;
  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'N/A';

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days: DayInfo[] = [];

    const startDay = start.getDay(); 
    const prevMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0).getDate();

    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(start.getFullYear(), start.getMonth() - 1, prevMonthEnd - i),
        isCurrentMonth: false,
        dayNumber: prevMonthEnd - i
      });
    }

    for (let i = 1; i <= end.getDate(); i++) {
      days.push({
        date: new Date(start.getFullYear(), start.getMonth(), i),
        isCurrentMonth: true,
        dayNumber: i
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(start.getFullYear(), start.getMonth() + 1, i),
        isCurrentMonth: false,
        dayNumber: i
      });
    }

    return days;
  }, [currentDate]);

  const filteredOS = useMemo(() => {
    return osList.filter(os => {
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
  }, [osList, selectedClient, selectedPlant, selectedPriority, selectedAsset, selectedTechnician, plants, availablePlants]);

  const getDayOS = (date: Date) => {
    return filteredOS.filter(os => {
        const osDate = parseISO(os.startDate.split('T')[0]);
        return isSameDay(osDate, date);
    });
  };

  const getPriorityColor = (priority: string) => {
      switch (priority) {
          case Priority.URGENT: return 'bg-red-500 border-red-700';
          case Priority.HIGH: return 'bg-orange-500 border-orange-700';
          case Priority.MEDIUM: return 'bg-yellow-500 border-yellow-700 text-black'; 
          case Priority.LOW: return 'bg-green-500 border-green-700';
          default: return 'bg-blue-500 border-blue-700';
      }
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDownloadReport = async (type: 'summary' | 'complete') => {
    const reportData = filteredOS.filter(os => {
      const osDate = new Date(os.startDate);
      const start = parseISO(reportStartDate);
      const end = parseISO(reportEndDate);
      end.setHours(23, 59, 59, 999);
      return isWithinInterval(osDate, { start, end });
    });

    if (reportData.length === 0) {
      alert("Nenhuma OS encontrada para os filtros e período selecionados.");
      return;
    }

    if (type === 'complete') {
        setIsGeneratingPDF(true);
        try {
            const doc = await generateOSReport(
                reportData, 
                "Relatório Completo de Manutenção",
                { getPlantName, getUserName } as any,
                false 
            );
            const pdfBase64 = doc.output('datauristring').split(',')[1];
            await saveFile(`Relatorio_Completo_${reportStartDate}.pdf`, pdfBase64, 'application/pdf');
        } catch (e) {
            console.error(e);
            alert("Erro ao gerar PDF.");
        } finally {
            setIsGeneratingPDF(false);
        }
    } else {
        try {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text("Relatório Resumido de Manutenção", 14, 15);
            doc.setFontSize(10);
            const periodo = `Período: ${format(parseISO(reportStartDate), 'dd/MM/yyyy')} a ${format(parseISO(reportEndDate), 'dd/MM/yyyy')}`;
            doc.text(periodo, 14, 22);
            doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 27);

            const head = [['Data', 'OS ID', 'Usina', 'Ativo', 'Tarefa', 'Técnico', 'Status']];
            const body = reportData.map(os => {
                const assetName = (os as any).assetName || (os.assets && os.assets.length > 0 ? os.assets.join(', ') : 'Geral');
                return [
                    format(new Date(os.startDate), 'dd/MM/yyyy'),
                    os.id,
                    getPlantName(os.plantId),
                    assetName,
                    os.activity,
                    getUserName(os.technicianId || ''),
                    os.status
                ];
            });

            autoTable(doc, {
                startY: 35,
                head: head,
                body: body,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 'auto' },
                    5: { cellWidth: 25 },
                    6: { cellWidth: 20 }
                }
            });
            const pdfBase64 = doc.output('datauristring').split(',')[1];
            await saveFile(`Resumo_${reportStartDate}.pdf`, pdfBase64, 'application/pdf');
        } catch (e) {
            console.error(e);
            alert("Erro ao gerar resumo.");
        }
    }
  };

  const selectClass = "text-sm border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white py-1 px-2 w-full lg:w-auto";

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden">
      
      {/* 1. BARRA DE FILTROS */}
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm m-4 mb-2">
        {/* Toggle Mobile */}
        <div className="flex justify-between items-center lg:hidden mb-2">
            <span className="font-bold text-gray-700 dark:text-gray-300">Filtros</span>
            <button 
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded"
            >
                {isFiltersOpen ? 'Ocultar' : 'Mostrar'} 
                {isFiltersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
        </div>

        {/* Container dos Selects */}
        <div className={`
            flex flex-wrap gap-2 items-center
            ${isFiltersOpen ? 'flex flex-col items-stretch' : 'hidden'} 
            lg:flex lg:flex-row lg:items-center
        `}>
            <span className="hidden lg:flex text-sm font-bold text-gray-700 dark:text-gray-300 mr-2 items-center">
                <Filter className="w-4 h-4 mr-1" /> Filtros:
            </span>
            <select value={selectedClient} onChange={e => { setSelectedClient(e.target.value); setSelectedPlant(''); }} className={selectClass}>
                <option value="">Todos Clientes</option>
                {availableClients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={selectedPlant} onChange={e => setSelectedPlant(e.target.value)} className={selectClass} disabled={!selectedClient && plants.length > 20}>
                <option value="">Todas Usinas</option>
                {availablePlants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={selectedPriority} onChange={e => setSelectedPriority(e.target.value)} className={selectClass}>
                <option value="">Todas Prioridades</option>
                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)} className={selectClass}>
                <option value="">Todos Ativos</option>
                {uniqueAssets.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={selectedTechnician} onChange={e => setSelectedTechnician(e.target.value)} className={selectClass}>
                <option value="">Todos Técnicos</option>
                {availableUsers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
        </div>
      </div>

      {/* 2. BARRA DE NAVEGAÇÃO E RELATÓRIOS */}
      <div className="bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 p-3 m-4 mt-0 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
        {/* ... (Resto do cabeçalho igual) ... */}
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"><ChevronLeft className="w-5 h-5" /></button>
                <span className="font-bold text-lg text-gray-800 dark:text-gray-200 w-40 text-center capitalize">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</span>
                <button onClick={handleNextMonth} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"><ChevronRight className="w-5 h-5" /></button>
                <button onClick={() => setCurrentDate(new Date())} className="text-xs text-blue-600 hover:underline ml-2">Hoje</button>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="flex flex-col md:flex-row items-center gap-2 text-sm">
                <span className="font-medium text-gray-600 dark:text-gray-400">Relatório de:</span>
                <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className={selectClass} />
                <span className="text-gray-400">até</span>
                <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className={selectClass} />
             </div>
             <div className="h-8 w-px bg-gray-300 mx-2 hidden md:block"></div>
             
             <button onClick={() => handleDownloadReport('summary')} className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs hover:bg-gray-50 transition-colors">
                <FileText className="w-4 h-4" /> Baixar relatório resumido
             </button>
             
             <button 
                onClick={() => handleDownloadReport('complete')} 
                disabled={isGeneratingPDF}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {isGeneratingPDF ? (
                    <span className="animate-pulse">Gerando...</span>
                ) : (
                    <>
                        <Download className="w-4 h-4" /> Baixar relatório completo
                    </>
                )}
             </button>
        </div>
      </div>

      {/* Grid do Calendário (Com rolagem liberada) */}
      <div className="flex-1 p-4 pt-0 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-7 gap-1 h-full min-h-[800px]">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center font-bold text-gray-500 py-2 bg-gray-200 dark:bg-gray-700 rounded-t sticky top-0 z-10 shadow-sm">{d}</div>
          ))}
          
          {daysInMonth.map((day, idx) => {
            const dayOS = getDayOS(day.date);
            const isToday = isSameDay(day.date, new Date());
            
            return (
              <div 
                key={idx} 
                className={`
                    border dark:border-gray-700 rounded p-1 flex flex-col relative overflow-hidden transition-colors min-h-[100px]
                    ${day.isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-900 opacity-50'}
                    ${isToday ? 'ring-2 ring-blue-500' : ''}
                `}
              >
                <span className={`text-xs font-bold mb-1 ml-1 ${isToday ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}>{day.dayNumber}</span>
                
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                    {dayOS.slice(0, 3).map(os => (
                        <div 
                            key={os.id} 
                            onClick={() => onCardClick(os)}
                            className={`text-[10px] p-1 rounded text-white cursor-pointer truncate border-l-4 shadow-sm hover:opacity-80 ${getPriorityColor(os.priority)}`}
                            title={`${os.title} - ${plants.find(p => p.id === os.plantId)?.name}`}
                        >
                            {os.activity || os.title}
                        </div>
                    ))}
                    {dayOS.length > 3 && (
                        <button 
                            onClick={() => setMoreInfoModal({ isOpen: true, items: dayOS, title: `OSs do dia ${day.dayNumber}` })}
                            className="text-[10px] w-full text-center text-blue-600 dark:text-blue-400 hover:underline font-bold"
                        >
                            + {dayOS.length - 3} mais
                        </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Modal Ver Mais (Mantido) */}
      {moreInfoModal.isOpen && (
          <Modal isOpen={true} onClose={() => setMoreInfoModal({ ...moreInfoModal, isOpen: false })} title={moreInfoModal.title} footer={<button onClick={() => setMoreInfoModal({ ...moreInfoModal, isOpen: false })} className="btn-secondary">Fechar</button>}>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto p-1">
                  {moreInfoModal.items.map(os => (
                      <div key={os.id} onClick={() => { setMoreInfoModal({ ...moreInfoModal, isOpen: false }); onCardClick(os); }} className={`p-3 rounded-lg text-white cursor-pointer hover:opacity-90 shadow-sm flex justify-between items-center ${getPriorityColor(os.priority)}`}>
                          <div className="flex flex-col overflow-hidden">
                             <span className="font-bold text-sm">{(os as any).assetName || (os.assets[0] || 'Geral')}</span>
                             <span className="text-xs truncate">{os.activity}</span>
                          </div>
                          <span className="text-xs bg-black/20 px-2 py-0.5 rounded whitespace-nowrap ml-2">{new Date(os.startDate).toLocaleDateString()}</span>
                      </div>
                  ))}
              </div>
          </Modal>
      )}
    </div>
  );
};

export default Calendar;