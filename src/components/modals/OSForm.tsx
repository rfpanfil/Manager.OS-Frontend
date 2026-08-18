// File: components/modals/OSForm.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { OS, OSStatus, Priority, Role } from '../../types';
import Modal from './Modal';

// --- SEARCHABLE SELECT ---
interface Option { label: string; value: string; }
interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
    options, value, onChange, placeholder, disabled, 
    isOpen, onToggle, onClose 
}) => {
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selectedLabel = options.find(o => o.value === value)?.label || '';
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node) && isOpen) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const filteredOptions = options.filter(o => normalize(o.label).includes(normalize(search)));

    return (
        <div className="relative" ref={wrapperRef}>
            <div 
                className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white flex justify-between items-center cursor-pointer ${disabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white'}`}
                onClick={() => !disabled && onToggle()}
            >
                <span className={!selectedLabel ? 'text-gray-400' : ''}>{selectedLabel || placeholder || 'Selecione...'}</span>
                <span className="text-xs text-gray-500">▼</span>
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                    <input 
                        type="text" 
                        className="w-full p-2 border-b dark:border-gray-600 text-sm focus:outline-none dark:bg-gray-700 dark:text-white"
                        placeholder="Buscar..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                    />
                    {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                        <div 
                            key={opt.value} 
                            className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-sm dark:text-gray-200"
                            onClick={() => { onChange(opt.value); onClose(); setSearch(''); }}
                        >
                            {opt.label}
                        </div>
                    )) : <div className="p-2 text-xs text-gray-400 text-center">Nenhum resultado</div>}
                </div>
            )}
        </div>
    );
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialData?: OS | null;
}

const OSForm: React.FC<Props> = ({ isOpen, onClose, initialData }) => {
    const { addOS, updateOS, users, plants, maintenancePlans, fetchPlantPlan } = useData();
    const { user } = useAuth();

    const [formData, setFormData] = useState<Partial<OS>>({
        title: '', description: '', status: OSStatus.PENDING, priority: Priority.MEDIUM,
        plantId: '', technicianId: '', supervisorId: '', assistantId: '', 
        assets: [], activity: ''
    });

    const [selectedAssetCategory, setSelectedAssetCategory] = useState<string>('');
    const [activeField, setActiveField] = useState<string | null>(null);
    
    const handleToggleDropdown = (fieldId: string) => setActiveField(prev => prev === fieldId ? null : fieldId);
    const closeDropdowns = () => setActiveField(null);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
            if (initialData.assets && initialData.assets.length > 0) {
                setSelectedAssetCategory(initialData.assets[0]);
            }
        } else {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            setFormData(prev => ({ ...prev, startDate: `${year}-${month}-${day}` }));
        }
    }, [initialData]);

    // Carrega planos ao selecionar Usina
    useEffect(() => {
        if (formData.plantId) {
            fetchPlantPlan(formData.plantId);
        }
    }, [formData.plantId, fetchPlantPlan]);

    const getPlantTasks = (plantId?: string): any[] => {
        if (!plantId) return [];
        const raw = maintenancePlans[plantId];
        const list = raw as unknown as any[]; 
        return Array.isArray(list) ? list : [];
    };

    const plantOptions = useMemo(() => {
        let filtered = plants;
        if (user?.role === Role.CLIENT) {
            filtered = plants.filter(p => user.plantIds?.includes(p.id) || p.client === user.name);
        }
        return filtered.map(p => ({ label: p.name, value: p.id }));
    }, [plants, user]);

    const currentPlant = useMemo(() => plants.find(p => p.id === formData.plantId), [plants, formData.plantId]);

    const { availableTechs, availableSups, availableCoords, availableAssistants } = useMemo(() => {
        if (!currentPlant) return { availableTechs: [], availableSups: [], availableCoords: null, availableAssistants: [] };
        return {
            availableTechs: users.filter(u => u.role === Role.TECHNICIAN && currentPlant.technicianIds?.includes(u.id)).map(u => ({ label: u.name, value: u.id })),
            availableSups: users.filter(u => u.role === Role.SUPERVISOR && currentPlant.supervisorIds?.includes(u.id)).map(u => ({ label: u.name, value: u.id })),
            availableAssistants: users.filter(u => u.role === Role.ASSISTANT && currentPlant.assistantIds?.includes(u.id)).map(u => ({ label: u.name, value: u.id })),
            availableCoords: users.find(u => u.id === currentPlant.coordinatorId)
        };
    }, [currentPlant, users]);

    const assetOptions = useMemo(() => {
        if (!currentPlant) return [];
        const physicalAssets = currentPlant.assets || [];
        const tasks = getPlantTasks(currentPlant.id);
        const planCategories = tasks.map((p: any) => p.asset_category);
        const uniqueAssets = Array.from(new Set([...physicalAssets, ...planCategories])).sort();
        return uniqueAssets.map(a => ({ label: a, value: a }));
    }, [currentPlant, maintenancePlans]); 

    const taskOptions = useMemo(() => {
        if (!currentPlant || !selectedAssetCategory) return [];
        const tasks = getPlantTasks(currentPlant.id);
        return tasks
            .filter((p: any) => p.asset_category === selectedAssetCategory)
            .map((p: any) => ({ label: p.title, value: p.title, fullPlan: p }));
    }, [currentPlant, selectedAssetCategory, maintenancePlans]);

    const handleAssetChange = (asset: string) => {
        setSelectedAssetCategory(asset);
        setFormData(prev => ({ ...prev, assets: [asset], activity: '', title: '' }));
    };

    const handleTaskChange = (taskTitle: string) => {
        const selectedPlan = taskOptions.find(t => t.value === taskTitle)?.fullPlan;
        
        let autoPriority = Priority.MEDIUM;
        if (selectedPlan?.criticality === 'Baixa') autoPriority = Priority.LOW;
        if (selectedPlan?.criticality === 'Média') autoPriority = Priority.MEDIUM;
        if (selectedPlan?.criticality === 'Alta') autoPriority = Priority.HIGH;
        if (selectedPlan?.criticality === 'Urgente') autoPriority = Priority.URGENT;

        // 🔥 CORREÇÃO CRÍTICA: Tratamento robusto de subtasks (JSON ou String)
        let rawSubtasks = selectedPlan?.subtasks;
        
        // Se vier como string do banco, tenta parsear
        if (typeof rawSubtasks === 'string') {
            try { rawSubtasks = JSON.parse(rawSubtasks); } catch { rawSubtasks = []; }
        }
        
        // Garante array
        if (!Array.isArray(rawSubtasks)) rawSubtasks = [];

        const formattedSubtasks = rawSubtasks.map((item: any, idx: number) => {
            const textValue = typeof item === 'string' ? item : (item.text || 'Item sem descrição');
            return { 
                id: idx, 
                text: textValue, 
                done: false 
            };
        });

        setFormData(prev => ({
            ...prev,
            activity: taskTitle,
            title: taskTitle,
            subtasksStatus: formattedSubtasks,
            priority: autoPriority,
            classification1: selectedPlan?.classification1,
            classification2: selectedPlan?.classification2,
            estimatedDuration: selectedPlan?.estimated_duration_minutes ? selectedPlan.estimated_duration_minutes * 60 : 0,
            plannedDowntime: selectedPlan?.planned_downtime_minutes || 0,
            maintenancePlanId: selectedPlan?.id
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.plantId) return alert("Preencha os campos obrigatórios (Usina, Ativo, Tarefa)");
        try {
            if (initialData?.id) await updateOS(formData as OS);
            else await addOS(formData as OS);
            onClose();
        } catch (error) { console.error(error); alert("Erro ao salvar OS"); }
    };

    const labelClass = "block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase";
    const inputClass = "w-full p-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}>
            <form onSubmit={handleSubmit} className="flex flex-col h-[80vh]">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Usina *</label>
                            <SearchableSelect 
                                options={plantOptions} 
                                value={formData.plantId || ''} 
                                onChange={(val) => setFormData({ ...formData, plantId: val, assets: [], activity: '', title: '' })} 
                                isOpen={activeField === 'plant'}
                                onToggle={() => handleToggleDropdown('plant')}
                                onClose={closeDropdowns}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Data Prevista</label>
                            <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className={inputClass} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Ativo / Sistema *</label>
                            <SearchableSelect 
                                options={assetOptions} 
                                value={selectedAssetCategory} 
                                onChange={handleAssetChange} 
                                disabled={!formData.plantId}
                                placeholder={!formData.plantId ? "Selecione a Usina..." : "Selecione..."}
                                isOpen={activeField === 'asset'}
                                onToggle={() => handleToggleDropdown('asset')}
                                onClose={closeDropdowns}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Tarefa (Plano) *</label>
                            <SearchableSelect 
                                options={taskOptions} 
                                value={formData.activity || ''} 
                                onChange={handleTaskChange} 
                                disabled={!selectedAssetCategory}
                                placeholder={!selectedAssetCategory ? "Selecione o Ativo..." : "Selecione..."}
                                isOpen={activeField === 'task'}
                                onToggle={() => handleToggleDropdown('task')}
                                onClose={closeDropdowns}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Status</label>
                            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={inputClass}>
                                {Object.values(OSStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Criticidade</label>
                            <select 
                                value={formData.priority} 
                                onChange={e => setFormData({...formData, priority: e.target.value as any})} 
                                className={`${inputClass} bg-gray-100 opacity-70 cursor-not-allowed`}
                                disabled 
                            >
                                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Técnico Responsável</label>
                            <SearchableSelect 
                                options={availableTechs} 
                                value={formData.technicianId || ''} 
                                onChange={v => setFormData({...formData, technicianId: v})} 
                                disabled={!formData.plantId}
                                isOpen={activeField === 'tech'}
                                onToggle={() => handleToggleDropdown('tech')}
                                onClose={closeDropdowns}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Auxiliar</label>
                            <SearchableSelect 
                                options={availableAssistants} 
                                value={formData.assistantId || ''} 
                                onChange={v => setFormData({...formData, assistantId: v})} 
                                disabled={!formData.plantId}
                                isOpen={activeField === 'assistant'}
                                onToggle={() => handleToggleDropdown('assistant')}
                                onClose={closeDropdowns}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Supervisor</label>
                            <SearchableSelect 
                                options={availableSups} 
                                value={formData.supervisorId || ''} 
                                onChange={v => setFormData({...formData, supervisorId: v})} 
                                disabled={!formData.plantId}
                                isOpen={activeField === 'sup'}
                                onToggle={() => handleToggleDropdown('sup')}
                                onClose={closeDropdowns}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Coordenador</label>
                            <input 
                                value={availableCoords ? availableCoords.name : 'Não definido na Usina'} 
                                disabled 
                                className={`${inputClass} bg-gray-100 text-gray-500 cursor-not-allowed`} 
                            />
                        </div>
                    </div>

                    <div><label className={labelClass}>Descrição Adicional</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className={`${inputClass} h-24 resize-none`} /></div>
                </div>

                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end gap-2 shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-white">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow">Salvar OS</button>
                </div>
            </form>
        </Modal>
    );
};

export default OSForm;