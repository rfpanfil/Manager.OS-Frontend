// File: components/modals/ScheduleOSModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { Role, OSStatus, Priority, PlantMaintenancePlan } from '../../types';
import Modal from './Modal';
import { addDays, isWeekend, isBefore, startOfDay } from 'date-fns';
import { 
  CheckSquare, Square, Calendar, User, AlertCircle, 
  Layers, ListFilter, ChevronDown, ChevronRight, MinusSquare
} from 'lucide-react';

interface ScheduleOSModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getFrequencyLabel = (days: number): string => {
  if (days === 1) return 'DIÁRIO';
  if (days === 7) return 'SEMANAL';
  if (days === 15) return 'QUINZENAL';
  if (days === 30) return 'MENSAL';
  if (days === 90) return 'TRIMESTRAL';
  if (days === 180) return 'SEMESTRAL';
  if (days === 365) return 'ANUAL';
  return `${days} DIAS`;
};

// 🔥 CORREÇÃO: Helper para traduzir a criticidade do texto para a Prioridade da OS
const mapCriticalityToPriority = (crit: string | undefined): Priority => {
    if (!crit) return Priority.MEDIUM;
    const c = crit.toUpperCase().trim();
    
    if (c.includes('MUITO ALTO') || c.includes('URGENTE') || c === 'CRÍTICA') return Priority.URGENT;
    if (c.includes('ALTO') || c.includes('ALTA')) return Priority.HIGH;
    if (c.includes('MÉDIO') || c.includes('MEDIO') || c.includes('MÉDIA') || c.includes('MEDIA')) return Priority.MEDIUM;
    if (c.includes('BAIXO') || c.includes('BAIXA')) return Priority.LOW;
    
    return Priority.MEDIUM;
};

const ScheduleOSModal: React.FC<ScheduleOSModalProps> = ({ isOpen, onClose }) => {
  const { 
    plants, 
    users, 
    addOSBatch, 
    maintenancePlans, 
    fetchPlantPlan 
  } = useData();

  const [plantId, setPlantId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Estado para controlar quais ativos estão expandidos
  const [expandedAssets, setExpandedAssets] = useState<string[]>([]);

  useEffect(() => {
    if (plantId && !maintenancePlans[plantId]) {
      fetchPlantPlan(plantId);
    }
  }, [plantId, maintenancePlans, fetchPlantPlan]);

  const rawPlanList = useMemo(() => {
    if (!plantId) return [];
    return maintenancePlans[plantId] || [];
  }, [plantId, maintenancePlans]);

  const groupedPlan = useMemo(() => {
    const groups: Record<string, PlantMaintenancePlan[]> = {};
    rawPlanList.forEach(task => {
      if (!task.active) return; 
      const category = task.asset_category || 'Geral';
      if (!groups[category]) groups[category] = [];
      groups[category].push(task);
    });
    return groups;
  }, [rawPlanList]);

  const availableTechnicians = useMemo(() => {
    if (!plantId) return [];
    return users.filter(u => 
      u.role === Role.TECHNICIAN && 
      u.plantIds && 
      u.plantIds.includes(plantId)
    );
  }, [plantId, users]);

  // Ao carregar, seleciona tudo, mas NÃO expande nada (expandedAssets inicia vazio)
  useEffect(() => {
    if (rawPlanList.length > 0) {
      setSelectedTaskIds(rawPlanList.filter(t => t.active).map(t => t.id));
      setExpandedAssets([]); // Garante que comece recolhido ao trocar de usina
    } else {
      setSelectedTaskIds([]);
      setExpandedAssets([]);
    }
  }, [rawPlanList]);

  // --- LÓGICA DE UI ---

  // Expande/Recolhe um grupo de ativos
  const toggleExpand = (category: string) => {
    setExpandedAssets(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  // Seleciona/Desmarca todas as tarefas de uma Categoria Específica
  const toggleCategoryTasks = (categoryTasks: PlantMaintenancePlan[]) => {
    const allIds = categoryTasks.map(t => t.id);
    const allSelected = allIds.every(id => selectedTaskIds.includes(id));

    if (allSelected) {
      // Desmarcar todos dessa categoria
      setSelectedTaskIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      // Marcar todos dessa categoria (mantendo os outros já selecionados)
      const newIds = allIds.filter(id => !selectedTaskIds.includes(id));
      setSelectedTaskIds(prev => [...prev, ...newIds]);
    }
  };

  const toggleAll = () => {
    const activeTasks = rawPlanList.filter(t => t.active);
    if (selectedTaskIds.length === activeTasks.length) {
      setSelectedTaskIds([]); 
    } else {
      setSelectedTaskIds(activeTasks.map(t => t.id));
    }
  };

  const generateDates = (frequencyDays: number, start: Date, end: Date): Date[] => {
    const dates: Date[] = [];
    let current = startOfDay(start);
    const endLimit = startOfDay(end);
    const safeFreq = frequencyDays > 0 ? frequencyDays : 30; 

    while (isBefore(current, endLimit) || current.getTime() === endLimit.getTime()) {
      if (!isWeekend(current)) {
        dates.push(new Date(current));
      }
      current = addDays(current, safeFreq);
    }
    return dates;
  };

  const handleGenerate = async () => {
    if (!plantId || !startDate || !endDate) {
      alert("Selecione a Usina e o Período.");
      return;
    }
    if (selectedTaskIds.length === 0) {
      alert("Selecione pelo menos uma tarefa.");
      return;
    }

    setIsGenerating(true);
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Ajuste de fuso horário
    const startObj = new Date(start.valueOf() + start.getTimezoneOffset() * 60000);
    const endObj = new Date(end.valueOf() + end.getTimezoneOffset() * 60000);

    const batchOS: any[] = [];

    rawPlanList.forEach(task => {
      if (selectedTaskIds.includes(task.id) && task.active) {
        const taskDates = generateDates(task.frequency_days, startObj, endObj);
        
        // 🔥 CORREÇÃO: Obtém a prioridade correta baseada na criticidade do plano
        const correctPriority = mapCriticalityToPriority(task.criticality);

        taskDates.forEach(date => {
          batchOS.push({
            plantId,
            technicianId: technicianId || undefined,
            supervisorId: users.find(u => u.id === technicianId)?.supervisorId || undefined,
            status: OSStatus.PENDING,
            priority: correctPriority, // ✅ Agora usa a variável calculada, não 'MEDIUM' fixo
            startDate: date.toISOString(),
            activity: task.title,
            description: `Plano de Manutenção: ${task.asset_category} - ${task.title}`,
            assets: [task.asset_category],
            maintenancePlanId: task.id,
            attachmentsEnabled: true,
            subtasksStatus: task.subtasks?.map((stText, idx) => ({
              id: idx,
              text: stText,
              done: false
            })) || []
          });
        });
      }
    });

    if (batchOS.length === 0) {
      alert("Nenhuma data válida gerada no período (fins de semana ignorados).");
      setIsGenerating(false);
      return;
    }

    if (confirm(`Gerar ${batchOS.length} Ordens de Serviço?`)) {
      await addOSBatch(batchOS);
      onClose();
    }
    setIsGenerating(false);
  };

  const inputClasses = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all";

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Agendamento - Plano de Manutenção" 
      footer={
        <div className="flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
           <button 
             onClick={handleGenerate} 
             disabled={isGenerating} 
             className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
           >
             {isGenerating ? 'Processando...' : 'Gerar Cronograma'}
           </button>
        </div>
      }
    >
      <div className="space-y-6 p-1">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usina / Planta</label>
                <select 
                  value={plantId} 
                  onChange={e => {
                    setPlantId(e.target.value);
                    setTechnicianId('');
                  }} 
                  className={inputClasses}
                >
                    <option value="">Selecione a Usina...</option>
                    {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Técnico Responsável</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select value={technicianId} onChange={e => setTechnicianId(e.target.value)} className={`${inputClasses} pl-9`}>
                        <option value="">Sem técnico definido</option>
                        {availableTechnicians.length > 0 ? (
                          availableTechnicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                        ) : (
                          <option value="" disabled>Nenhum técnico disponível</option>
                        )}
                    </select>
                </div>
            </div>
        </div>

        {/* LISTA DE ATIVOS - ESTILO ACORDEÃO */}
        <div className="border dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm flex flex-col h-[400px]">
            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 border-b dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-500" />
                    Ativos e Tarefas ({rawPlanList.filter(t => t.active).length})
                </h4>
                <button 
                  onClick={toggleAll} 
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  {rawPlanList.length > 0 && selectedTaskIds.length === rawPlanList.filter(t => t.active).length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
            </div>
            
            <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar flex-1">
                {rawPlanList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
                      <ListFilter className="w-8 h-8 opacity-20" />
                      {plantId ? "Nenhum plano ativo encontrado." : "Selecione uma usina."}
                    </div>
                ) : (
                    Object.entries(groupedPlan).map(([category, tasks]) => {
                        const isExpanded = expandedAssets.includes(category);
                        const selectedCount = tasks.filter(t => selectedTaskIds.includes(t.id)).length;
                        const allSelected = selectedCount === tasks.length;
                        const someSelected = selectedCount > 0 && !allSelected;

                        return (
                            <div key={category} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                {/* CABEÇALHO DO ATIVO (CLICÁVEL PARA EXPANDIR) */}
                                <div 
                                    className={`px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                                        isExpanded ? 'bg-slate-100 dark:bg-slate-700' : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    {/* Ícone de Expansão */}
                                    <div onClick={(e) => { e.stopPropagation(); toggleExpand(category); }} className="p-1 hover:bg-black/5 rounded">
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                    </div>
                                    
                                    {/* Checkbox do Grupo (Ativo) */}
                                    <div onClick={(e) => { e.stopPropagation(); toggleCategoryTasks(tasks); }}>
                                        {allSelected ? (
                                            <CheckSquare className="w-5 h-5 text-blue-600" />
                                        ) : someSelected ? (
                                            <MinusSquare className="w-5 h-5 text-blue-600" />
                                        ) : (
                                            <Square className="w-5 h-5 text-slate-300" />
                                        )}
                                    </div>

                                    <span 
                                        className="font-bold text-sm text-slate-700 dark:text-slate-200 flex-1 select-none"
                                        onClick={() => toggleExpand(category)}
                                    >
                                        {category}
                                    </span>
                                    
                                    <span className="text-xs text-slate-400 select-none">
                                        {selectedCount}/{tasks.length} selecionados
                                    </span>
                                </div>

                                {/* LISTA DE TAREFAS (SÓ MOSTRA SE EXPANDIDO) */}
                                {isExpanded && (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                                        {tasks.map(task => {
                                            const isSelected = selectedTaskIds.includes(task.id);
                                            return (
                                                <div 
                                                    key={task.id} 
                                                    onClick={() => toggleTask(task.id)} 
                                                    className="flex items-center gap-3 px-3 py-2 pl-10 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                                    )}
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-sm truncate ${isSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
                                                                {task.title}
                                                            </span>
                                                            <div className="flex items-center">
                                                                <span className={`text-[10px] uppercase font-bold px-1.5 rounded ml-2 ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                                                    {getFrequencyLabel(task.frequency_days)}
                                                                </span>
                                                                {/* Indicador visual de criticidade */}
                                                                {(task.criticality?.toUpperCase().includes('ALTO') || task.criticality?.toUpperCase().includes('URGENTE')) && (
                                                                    <span className="text-[10px] uppercase font-bold px-1.5 rounded ml-1 bg-red-100 text-red-600 border border-red-200">
                                                                        {task.criticality}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>

        {/* PERÍODO */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Período de Agendamento</h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Início</label>
                    <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputClasses} pl-9`} /></div>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Fim</label>
                    <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputClasses} pl-9`} /></div>
                </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Fins de semana ignorados.</p>
        </div>

      </div>
    </Modal>
  );
};

export default ScheduleOSModal;