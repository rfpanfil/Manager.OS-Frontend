// File: components/modals/StandardLibraryModal.tsx
import React, { useEffect, useState, useMemo } from 'react';
import Modal from './Modal';
import { useData } from '../../contexts/DataContext';
import { TaskTemplate } from '../../types';
import { Trash2, Edit, ChevronDown, ChevronRight, Save, Plus } from 'lucide-react';

const STANDARD_ASSETS = ["Inversores", "Transformadores", "Ar Condicionado", "Estruturas", "Monitoramento", "Limpeza", "Jardinagem", "Cercamento", "Drenagem", "Vias de Acesso", "Edificações"];

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const StandardLibraryModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { fetchTaskTemplates, taskTemplates, addTemplate, updateTemplate, deleteTemplate } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<TaskTemplate>>({});
    
    // Inicia recolhido
    const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

    // Estilo padrão (Tailwind)
    const inputClass = "w-full p-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none";

    useEffect(() => {
        if (isOpen) fetchTaskTemplates();
    }, [isOpen]);

    const groupedTasks = useMemo(() => {
        const groups: Record<string, TaskTemplate[]> = {};
        taskTemplates.forEach(t => {
            const asset = t.asset_category || 'Outros';
            if (!groups[asset]) groups[asset] = [];
            groups[asset].push(t);
        });
        return groups;
    }, [taskTemplates]);

    const toggleAsset = (asset: string) => {
        setExpandedAssets(prev => {
            const next = new Set(prev);
            if (next.has(asset)) next.delete(asset); else next.add(asset);
            return next;
        });
    };

    const handleSave = async () => {
        if (!editingItem.title || !editingItem.asset_category) {
            alert("Preencha título e categoria");
            return;
        }
        
        const dataToSave = {
            ...editingItem,
            estimated_duration_minutes: Number(editingItem.estimated_duration_minutes || 0),
            planned_downtime_minutes: Number(editingItem.planned_downtime_minutes || 0),
            frequency_days: Number(editingItem.frequency_days || 30)
        } as TaskTemplate;

        if (editingItem.id) {
            await updateTemplate(editingItem.id, dataToSave);
        } else {
            await addTemplate(dataToSave);
        }
        setIsEditing(false);
        setEditingItem({});
        fetchTaskTemplates();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Excluir modelo?")) {
            await deleteTemplate(id);
            fetchTaskTemplates();
        }
    };

    // ✅ FUNCIONALIDADE SOLICITADA: EXCLUIR ATIVO INTEIRO
    const handleDeleteAsset = async (asset: string) => {
        if (confirm(`ATENÇÃO: Tem certeza que deseja excluir o ativo "${asset}" e TODAS as suas tarefas da biblioteca? Esta ação não pode ser desfeita.`)) {
            const tasksToDelete = taskTemplates.filter(t => t.asset_category === asset);
            
            if (tasksToDelete.length === 0) {
                alert("Nenhuma tarefa encontrada para este ativo.");
                return;
            }

            for (const t of tasksToDelete) {
                await deleteTemplate(t.id);
            }
            
            fetchTaskTemplates();
            if (expandedAssets.has(asset)) {
                const next = new Set(expandedAssets);
                next.delete(asset);
                setExpandedAssets(next);
            }
        }
    };

    const handleNew = () => {
        setEditingItem({ 
            plan_code: 'STD', 
            frequency_days: 30, 
            estimated_duration_minutes: 30,
            planned_downtime_minutes: 0,
            subtasks: [],
            asset_category: '', // Deixa vazio para forçar criar/digitar grupo
            criticality: 'Média',
            task_type: 'Preventiva'
        });
        setIsEditing(true);
    };

    // Helpers de Subtarefas
    const addSubtask = () => setEditingItem({ ...editingItem, subtasks: [...(editingItem.subtasks || []), ''] });
    const updateSubtask = (i: number, val: string) => {
        const sub = [...(editingItem.subtasks || [])];
        sub[i] = val;
        setEditingItem({ ...editingItem, subtasks: sub });
    };
    const removeSubtask = (i: number) => {
        const sub = [...(editingItem.subtasks || [])];
        sub.splice(i, 1);
        setEditingItem({ ...editingItem, subtasks: sub });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Biblioteca Padrão de Manutenção">
            <div className="flex flex-col h-[70vh]">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar modelo..."
                        className="p-2 border rounded w-64 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    {/* ✅ BOTÃO RESTAURADO: NOVO GRUPO DE ATIVOS */}
                    <button onClick={handleNew} className="bg-green-600 text-white px-2 py-1.5 rounded flex items-center gap-0.5 font-bold hover:bg-green-700">
                        <Plus size={18} /> Novo Grupo de Ativos
                    </button>
                </div>

                {isEditing ? (
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded space-y-4">
                        <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white">{editingItem.id ? 'Editar Modelo' : 'Novo Grupo / Tarefa'}</h3>
                        
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Ativo (Categoria)</label>
                            <input list="assets-list" value={editingItem.asset_category || ''} onChange={e => setEditingItem({...editingItem, asset_category: e.target.value})} className={inputClass} placeholder="Selecione ou digite um novo ativo..." />
                            <datalist id="assets-list">{STANDARD_ASSETS.map(a => <option key={a} value={a} />)}</datalist>
                        </div>

                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Título da Tarefa</label>
                            <input value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className={inputClass} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Tipo</label>
                                <select value={editingItem.task_type || 'Preventiva'} onChange={e => setEditingItem({...editingItem, task_type: e.target.value})} className={inputClass}>
                                    <option>Preventiva</option><option>Corretiva</option><option>Preditiva</option><option>Inspeção</option>
                                    <option>Limpeza</option><option>Projeto</option><option>Acompanhamento de Serviço</option><option>Coleta de dados</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Freq. (Dias)</label>
                                <input type="number" value={editingItem.frequency_days} onChange={e => setEditingItem({...editingItem, frequency_days: Number(e.target.value)})} className={inputClass} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Duração (Min)</label>
                                <input type="number" value={editingItem.estimated_duration_minutes} onChange={e => setEditingItem({...editingItem, estimated_duration_minutes: Number(e.target.value)})} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-red-600 dark:text-red-400">Inatividade (Min)</label>
                                <input type="number" value={editingItem.planned_downtime_minutes || 0} onChange={e => setEditingItem({...editingItem, planned_downtime_minutes: Number(e.target.value)})} className={inputClass} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Criticidade</label>
                                <select value={editingItem.criticality || 'Média'} onChange={e => setEditingItem({...editingItem, criticality: e.target.value})} className={inputClass}>
                                    <option>Baixa</option><option>Média</option><option>Alta</option><option>Urgente</option>
                                </select>
                            </div>
                            <div><label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Classificação 1</label><input value={editingItem.classification1 || ''} onChange={e => setEditingItem({...editingItem, classification1: e.target.value})} className={inputClass} /></div>
                        </div>

                        <div><label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Classificação 2</label><input value={editingItem.classification2 || ''} onChange={e => setEditingItem({...editingItem, classification2: e.target.value})} className={inputClass} /></div>

                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">Checklist Modelo</label>
                                <button onClick={addSubtask} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200">+ Item</button>
                            </div>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {editingItem.subtasks?.map((sub, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input value={sub} onChange={e => updateSubtask(i, e.target.value)} className={inputClass} />
                                        <button onClick={() => removeSubtask(i)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-white">Cancelar</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded font-bold flex items-center gap-2"><Save size={16}/> Salvar</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {Object.entries(groupedTasks)
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([asset, tasks]) => {
                                const isExpanded = expandedAssets.has(asset);
                                const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));
                                if (searchTerm && filteredTasks.length === 0) return null;

                                return (
                                    <div key={asset} className="border dark:border-gray-700 rounded bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                                        <div 
                                            className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                                            onClick={() => toggleAsset(asset)}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <ChevronDown size={18} className="text-gray-500"/> : <ChevronRight size={18} className="text-gray-500"/>}
                                                <h4 className="font-bold text-gray-800 dark:text-gray-200">{asset}</h4>
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{tasks.length}</span>
                                            </div>
                                            
                                            {/* ✅ BOTÃO EXCLUIR ATIVO (ÚNICA ADIÇÃO NO LIST ITEM) */}
                                            <div className="flex items-center" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => handleDeleteAsset(asset)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                                    title={`Excluir ativo ${asset} e todas suas tarefas`}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {filteredTasks.map(task => (
                                                    <div key={task.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 flex justify-between items-start group">
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-gray-800 dark:text-gray-200">{task.title}</div>
                                                            <div className="text-xs text-gray-500 flex gap-3 mt-1">
                                                                <span>{task.task_type}</span>
                                                                <span>{task.frequency_days} dias</span>
                                                                <span>{task.estimated_duration_minutes} min</span>
                                                                {task.planned_downtime_minutes ? <span className="text-red-500 font-bold">Inativ: {task.planned_downtime_minutes} min</span> : null}
                                                            </div>
                                                            <div className="text-xs text-gray-400 truncate max-w-md">
                                                                {task.subtasks?.length > 0 ? `📋 ${task.subtasks.length} itens no checklist` : 'Sem checklist'}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => {setEditingItem(task); setIsEditing(true);}} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded">✏️</button>
                                                            <button onClick={() => handleDelete(task.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">🗑️</button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {filteredTasks.length === 0 && <div className="text-center text-xs text-gray-400 p-2 italic">Nenhuma tarefa encontrada.</div>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default StandardLibraryModal;