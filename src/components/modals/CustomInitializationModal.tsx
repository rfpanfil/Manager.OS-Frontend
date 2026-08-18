// File: components/modals/CustomInitializationModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { useData } from '../../contexts/DataContext';
import { TaskTemplate } from '../../types';
import { STANDARD_ASSETS } from '../../constants';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    plantId: string;
    onSuccess: () => void;
}

const CustomInitializationModal: React.FC<Props> = ({ isOpen, onClose, plantId, onSuccess }) => {
    const { taskTemplates, fetchTaskTemplates, initializePlantPlan } = useData();
    const [draftTasks, setDraftTasks] = useState<Partial<TaskTemplate>[]>([]);
    const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    
    const [editingId, setEditingId] = useState<string | null>(null); 
    const [tempTask, setTempTask] = useState<Partial<TaskTemplate>>({});
    const [selectedAsset, setSelectedAsset] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            fetchTaskTemplates().then(() => {
                const initialData = JSON.parse(JSON.stringify(taskTemplates)).map((t: any, i: number) => ({
                    ...t,
                    _tempId: t.id || `temp-${i}`,
                    subtasks: t.subtasks || []
                }));
                setDraftTasks(initialData);
                setExpandedAssets(new Set());
            });
        }
    }, [isOpen]);

    // Lista combinada para o filtro e inicialização dos grupos
    const uniqueAssets = useMemo(() => {
        const fromDraft = draftTasks.map(t => t.asset_category || 'Geral');
        const combined = new Set([...STANDARD_ASSETS, ...fromDraft]);
        return Array.from(combined).sort();
    }, [draftTasks]);

    // ✅ CORREÇÃO: Agrupamento agora inclui ativos vazios
    const groupedTasks = useMemo(() => {
        const groups: Record<string, Partial<TaskTemplate>[]> = {};
        
        // 1. Se não houver filtro, inicializa TODOS os ativos como grupos vazios
        // Se houver filtro, inicializa apenas o selecionado
        const assetsToInitialize = selectedAsset ? [selectedAsset] : uniqueAssets;
        
        assetsToInitialize.forEach(asset => {
            groups[asset] = [];
        });

        // 2. Distribui as tarefas nos grupos
        const filtered = selectedAsset ? draftTasks.filter(t => t.asset_category === selectedAsset) : draftTasks;

        filtered.forEach(task => {
            const asset = task.asset_category || 'Geral';
            // Garante que o grupo exista (caso seja um ativo novo criado agora)
            if (!groups[asset]) groups[asset] = [];
            groups[asset].push(task);
        });

        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key];
            return acc;
        }, {} as Record<string, Partial<TaskTemplate>[]>);
    }, [draftTasks, selectedAsset, uniqueAssets]);

    const toggleGroup = (asset: string) => {
        setExpandedAssets(prev => {
            const next = new Set(prev);
            next.has(asset) ? next.delete(asset) : next.add(asset);
            return next;
        });
    };

    const handleAddAssetGroup = () => {
        const name = prompt("Nome do novo Ativo (Ex: Jardinagem):");
        if (!name) return;
        
        const newTask: any = {
            _tempId: `new-${Date.now()}`,
            asset_category: name,
            title: "Nova Tarefa Inicial",
            task_type: "Preventiva",
            criticality: "Médio",
            frequency_days: 30,
            estimated_duration_minutes: 60,
            subtasks: ["Verificar condições gerais"]
        };

        setDraftTasks(prev => [newTask, ...prev]);
        setExpandedAssets(prev => new Set(prev).add(name));
        setEditingId(newTask._tempId);
        setTempTask(newTask);
    };

    const handleAddTaskToGroup = (assetName: string) => {
        const newTask: any = {
            _tempId: `new-${Date.now()}`,
            asset_category: assetName,
            title: "Nova Tarefa",
            task_type: "Preventiva",
            criticality: "Médio",
            frequency_days: 30,
            estimated_duration_minutes: 30,
            subtasks: []
        };
        setDraftTasks(prev => [newTask, ...prev]);
        setExpandedAssets(prev => new Set(prev).add(assetName));
        setEditingId(newTask._tempId);
        setTempTask(newTask);
    };

    const handleRemoveTask = (taskToRemove: any) => {
        if(confirm("Remover esta tarefa da lista de importação?")) {
            setDraftTasks(prev => prev.filter(t => (t as any)._tempId !== taskToRemove._tempId));
        }
    };

    const handleEdit = (task: any) => {
        setTempTask(JSON.parse(JSON.stringify(task))); 
        setEditingId(task._tempId);
    };

    const handleSaveEdit = () => {
        setDraftTasks(prev => prev.map((t: any) => 
            t._tempId === editingId ? { ...tempTask, _tempId: editingId } : t
        ));
        setEditingId(null);
        setTempTask({});
    };

    const addSubtask = () => setTempTask(prev => ({ ...prev, subtasks: [...(prev.subtasks || []), ""] }));
    const updateSubtask = (i: number, val: string) => {
        const newSubs = [...(tempTask.subtasks || [])];
        newSubs[i] = val;
        setTempTask({ ...tempTask, subtasks: newSubs });
    };
    const removeSubtask = (i: number) => {
        const newSubs = (tempTask.subtasks || []).filter((_, idx) => idx !== i);
        setTempTask({ ...tempTask, subtasks: newSubs });
    };

    const handleFinalize = async () => {
        if (!confirm(`Confirmar a criação de ${draftTasks.length} tarefas neste plano customizado?`)) return;
        
        setIsLoading(true);
        const cleanTasks = draftTasks.map(({ _tempId, ...rest }: any) => rest);
        
        await initializePlantPlan(plantId, 'CUSTOM_LIST', cleanTasks);
        setIsLoading(false);
        onSuccess();
        onClose();
    };

    const inputClass = "w-full border p-1.5 rounded text-xs bg-white dark:bg-gray-600 dark:text-white dark:border-gray-500 focus:ring-1 focus:ring-blue-500";
    const labelClass = "text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold mb-0.5 block";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editor de Plano Customizado">
            <div className="flex flex-col h-[85vh]">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded mb-3 text-sm text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex justify-between items-center shrink-0">
                    <span>Edite os ativos e tarefas antes de importar para a usina.</span>
                    <div className="w-1/3">
                         <select className={inputClass} value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
                            <option value="">Todos os Ativos</option>
                            {uniqueAssets.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
                    {Object.entries(groupedTasks).map(([asset, tasks]) => {
                        const isExpanded = expandedAssets.has(asset) || (selectedAsset === asset);
                        return (
                            <div key={asset} className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm transition-all">
                                <div 
                                    className="bg-gray-100 dark:bg-gray-700 p-3 flex justify-between items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors sticky top-0 z-10"
                                    onClick={() => toggleGroup(asset)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500 text-xs transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                        <h4 className="font-bold text-gray-800 dark:text-white text-sm">{asset} <span className="font-normal text-gray-500 text-xs ml-1">({tasks.length})</span></h4>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleAddTaskToGroup(asset); }}
                                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded shadow-sm"
                                    >
                                        + Tarefa
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="p-2 space-y-2 bg-gray-50 dark:bg-gray-800/50">
                                        {tasks.map((task: any) => (
                                            <div key={task._tempId} className={`p-3 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 transition-all ${editingId === task._tempId ? 'ring-2 ring-blue-400 shadow-lg' : 'hover:border-blue-300'}`}>
                                                {editingId === task._tempId ? (
                                                    <div className="space-y-3 animate-fadeIn">
                                                        <div className="grid grid-cols-12 gap-3">
                                                            <div className="col-span-8"><label className={labelClass}>Título</label><input className={inputClass} value={tempTask.title} onChange={e => setTempTask({...tempTask, title: e.target.value})} autoFocus /></div>
                                                            <div className="col-span-4"><label className={labelClass}>Ativo</label><input className={inputClass} value={tempTask.asset_category} onChange={e => setTempTask({...tempTask, asset_category: e.target.value})} /></div>
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            <div><label className={labelClass}>Freq (Dias)</label><input type="number" className={inputClass} value={tempTask.frequency_days} onChange={e => setTempTask({...tempTask, frequency_days: Number(e.target.value)})} /></div>
                                                            <div><label className={labelClass}>Duração (Min)</label><input type="number" className={inputClass} value={tempTask.estimated_duration_minutes} onChange={e => setTempTask({...tempTask, estimated_duration_minutes: Number(e.target.value)})} /></div>
                                                            <div className="col-span-2"><label className={labelClass}>Criticidade</label><select className={inputClass} value={tempTask.criticality} onChange={e => setTempTask({...tempTask, criticality: e.target.value})}><option>Baixo</option><option>Médio</option><option>Alto</option><option>Muito alto</option></select></div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div><label className={labelClass}>Classif. 1</label><input className={inputClass} value={tempTask.classification1 || ''} onChange={e => setTempTask({...tempTask, classification1: e.target.value})} /></div>
                                                            <div><label className={labelClass}>Classif. 2</label><input className={inputClass} value={tempTask.classification2 || ''} onChange={e => setTempTask({...tempTask, classification2: e.target.value})} /></div>
                                                        </div>
                                                        <div className="bg-gray-100 dark:bg-gray-600/50 p-2 rounded">
                                                            <div className="flex justify-between items-center mb-1"><label className={labelClass}>Subtarefas ({tempTask.subtasks?.length})</label><button onClick={addSubtask} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200">+ Item</button></div>
                                                            <div className="max-h-32 overflow-y-auto space-y-1">
                                                                {tempTask.subtasks?.map((st, i) => (<div key={i} className="flex gap-1"><input className={inputClass} value={st} onChange={e => updateSubtask(i, e.target.value)} /><button onClick={() => removeSubtask(i)} className="text-red-500 hover:bg-red-100 px-2 rounded">×</button></div>))}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-600">
                                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700">Cancelar</button>
                                                            <button onClick={handleSaveEdit} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded shadow">Salvar Edição</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1 cursor-pointer" onClick={() => handleEdit(task)}>
                                                            <div className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-1">{task.title}</div>
                                                            <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                                                                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">📅 {task.frequency_days} dias</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-white ${task.criticality === 'Alto' ? 'bg-orange-500' : 'bg-green-500'}`}>{task.criticality}</span>
                                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded border">⏱ {task.estimated_duration_minutes} min</span>
                                                                {(task.subtasks?.length || 0) > 0 && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">📋 {task.subtasks.length} itens</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 ml-2">
                                                            <button onClick={() => handleEdit(task)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Editar">✏️</button>
                                                            <button onClick={() => handleRemoveTask(task)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Remover">🗑️</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {tasks.length === 0 && <div className="text-center text-xs text-gray-400 p-4 italic border-2 border-dashed border-gray-300 rounded">Nenhuma tarefa neste grupo.<br/><span className="text-[10px]">Clique em "+ Tarefa" para adicionar.</span></div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="border-t dark:border-gray-700 pt-4 flex justify-end gap-3 mt-auto shrink-0 bg-white dark:bg-gray-800">
                    <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded text-gray-800">Cancelar</button>
                    <button onClick={handleFinalize} disabled={isLoading || draftTasks.length === 0} className="px-6 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded font-bold shadow disabled:opacity-50 flex items-center gap-2">
                        {isLoading ? 'Salvando...' : (<><span>💾</span> Concluir e Importar ({draftTasks.length} tarefas)</>)}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CustomInitializationModal;