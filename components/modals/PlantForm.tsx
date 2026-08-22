// File: components/modals/PlantForm.tsx
// Componente para criação e edição de Usinas.

import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { useData } from '../../contexts/DataContext';
import { Plant, Role, SubPlant } from '../../types';
import { ChevronDown, ChevronRight, Trash2, Plus, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Plant;
  presetClient?: string;
}

const PlantForm: React.FC<Props> = ({ isOpen, onClose, initialData, presetClient }) => {
  const { addPlant, updatePlant, users } = useData();
  
  const [formData, setFormData] = useState<Partial<Plant>>({
    client: presetClient || '', name: '', stringCount: 0, trackerCount: 0,
    assets: [], subPlants: []
  });
  
  const [subPlants, setSubPlants] = useState<SubPlant[]>([]);
  const [expandedSubPlant, setExpandedSubPlant] = useState<string | null>(null);

  const [stdInverters, setStdInverters] = useState(0);
  const [stdStrings, setStdStrings] = useState(0);
  const [stdTrackers, setStdTrackers] = useState(0);

  const [assignments, setAssignments] = useState({ 
      coordinatorId: '', supervisorIds: [] as string[], technicianIds: [] as string[], assistantIds: [] as string[] 
  });
  const [newAsset, setNewAsset] = useState('');
  const [activeTab, setActiveTab] = useState<'DATA' | 'TEAM'>('DATA');
  
  const clientUsers = useMemo(() => users.filter(u => u.role === Role.CLIENT), [users]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      // Garante carregamento correto
      const loadedSubPlants = (initialData.subPlants || []).map(sp => ({
          ...sp,
          inverterStartIndex: sp.inverterStartIndex !== undefined ? sp.inverterStartIndex : 1
      }));
      setSubPlants(loadedSubPlants);
      
      if (loadedSubPlants.length > 0) {
          setStdInverters(loadedSubPlants[0].inverterCount || 0);
          setStdStrings(loadedSubPlants[0].stringsPerInverter || 0);
          setStdTrackers(loadedSubPlants[0].trackersPerInverter || 0);
      }

      setAssignments({
        coordinatorId: initialData.coordinatorId || '',
        supervisorIds: initialData.supervisorIds || [],
        technicianIds: initialData.technicianIds || [],
        assistantIds: initialData.assistantIds || []
      });
    } else {
      setFormData(prev => ({ ...prev, client: presetClient || '' }));
    }
  }, [initialData, presetClient]);

  // ✅ Cálculo automático dos totais (substitui o botão)
  useEffect(() => {
      const totalStrings = subPlants.reduce((acc, sp) => acc + (sp.inverterCount * sp.stringsPerInverter), 0);
      const totalTrackers = subPlants.reduce((acc, sp) => acc + (sp.inverterCount * sp.trackersPerInverter), 0);

      setFormData(prev => ({
          ...prev,
          stringCount: totalStrings,
          trackerCount: totalTrackers
      }));
  }, [subPlants]);

  const addSubPlant = () => {
      if (!formData.name) {
          alert("Por favor, preencha o Nome da Usina antes de adicionar subusinas.");
          return;
      }

      const nextNum = subPlants.length + 1;
      
      // ✅ CORREÇÃO: Sempre inicia em 1 por padrão
      const nextStart = 1;

      const newSub: SubPlant = {
          id: crypto.randomUUID(),
          name: `${formData.name} ${nextNum}`,
          inverterCount: stdInverters,
          inverterStartIndex: nextStart, 
          stringsPerInverter: stdStrings,
          trackersPerInverter: stdTrackers
      };
      
      setSubPlants([...subPlants, newSub]);
      setExpandedSubPlant(newSub.id);
  };

  const updateSubPlant = (id: string, field: keyof SubPlant, value: any) => {
      setSubPlants(prev => prev.map(sp => sp.id === id ? { ...sp, [field]: value } : sp));
  };

  const removeSubPlant = (id: string) => {
      setSubPlants(prev => prev.filter(sp => sp.id !== id));
  };

  const renameAllSubPlants = () => {
      if (!formData.name) return;
      if (confirm(`Renomear todas as subusinas para o padrão "${formData.name} 1", "${formData.name} 2", etc?`)) {
          setSubPlants(prev => prev.map((sp, idx) => ({
              ...sp,
              name: `${formData.name} ${idx + 1}`
          })));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subPlants.length > 0 && !formData.name) {
        alert("O Nome da Usina é obrigatório.");
        return;
    }

    const payload = { ...formData, subPlants } as Plant;
    
    if (initialData?.id) {
        await updatePlant(payload, assignments);
    } else {
        await addPlant(payload, assignments);
    }
    onClose();
  };

  const toggleAssignment = (field: keyof typeof assignments, userId: string) => {
    if (field === 'coordinatorId') {
        setAssignments(prev => ({ ...prev, coordinatorId: userId }));
    } else {
        setAssignments(prev => {
            const list = prev[field] as string[];
            return {
                ...prev,
                [field]: list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId]
            };
        });
    }
  };

  const inputClass = "w-full p-2.5 border border-gray-400 rounded text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 outline-none placeholder-gray-500 font-bold";
  const innerLabelClass = "block text-xs font-extrabold text-gray-900 mb-1 uppercase tracking-wide";
  const cardClass = "bg-gray-50 p-4 rounded-lg border border-gray-300";
  const cardTitleClass = "font-extrabold text-sm text-gray-900 mb-3 border-b border-gray-300 pb-2 uppercase";
  const topoLabelClass = "text-[11px] font-extrabold text-gray-900 uppercase block mb-0.5";
  const topoInputClass = "w-full p-1.5 text-sm font-bold text-gray-900 border border-gray-400 rounded bg-white focus:ring-1 focus:ring-blue-600 outline-none";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Usina' : 'Nova Usina'}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[80vh]">
            
            <div className="flex border-b border-gray-300 mb-4 shrink-0 bg-gray-50 rounded-t-lg">
                <button type="button" onClick={() => setActiveTab('DATA')} className={`flex-1 py-3 font-bold text-sm transition-colors ${activeTab === 'DATA' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>Dados da Usina</button>
                <button type="button" onClick={() => setActiveTab('TEAM')} className={`flex-1 py-3 font-bold text-sm transition-colors ${activeTab === 'TEAM' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>Equipe Técnica</button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
                {activeTab === 'DATA' && (
                    <div className="space-y-4">
                        
                        <div className={cardClass}>
                            <h4 className={cardTitleClass}>Informações Básicas</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className={innerLabelClass}>Nome da Usina *</label>
                                    <div className="flex gap-2">
                                        <input required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} placeholder="Ex: UFV Sol Poente" />
                                        {subPlants.length > 0 && (
                                            <button type="button" onClick={renameAllSubPlants} className="bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300 border border-gray-300" title="Renomear subusinas padrão"><RefreshCw size={18} /></button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className={innerLabelClass}>Cliente / Proprietário</label>
                                    <select required value={formData.client || ''} onChange={e => setFormData({...formData, client: e.target.value})} className={inputClass}>
                                        <option value="">Selecione um cliente...</option>
                                        {clientUsers.map(client => (<option key={client.id} value={client.name}>{client.name} (@{client.username})</option>))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* TOPOLOGIA */}
                        <div className={cardClass}>
                            <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2">
                                <h4 className="font-extrabold text-sm text-gray-900 uppercase m-0">Topologia (Subusinas & Inversores)</h4>
                                <button type="button" onClick={addSubPlant} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 font-bold flex items-center gap-1 shadow-sm"><Plus size={14}/> Subusina</button>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg mb-3 border border-blue-200 grid grid-cols-3 gap-3">
                                <div className="col-span-3 text-[11px] font-extrabold text-blue-900 uppercase tracking-wide">Padrão para novas adições:</div>
                                <div><label className={topoLabelClass}>Inv/Sub</label><input type="number" min={0} value={stdInverters} onChange={e => setStdInverters(Number(e.target.value))} className={topoInputClass} /></div>
                                <div><label className={topoLabelClass}>Str/Inv</label><input type="number" min={0} value={stdStrings} onChange={e => setStdStrings(Number(e.target.value))} className={topoInputClass} /></div>
                                <div><label className={topoLabelClass}>Trk/Inv</label><input type="number" min={0} value={stdTrackers} onChange={e => setStdTrackers(Number(e.target.value))} className={topoInputClass} /></div>
                            </div>

                            <div className="space-y-2">
                                {subPlants.map((sp, index) => {
                                    const isExpanded = expandedSubPlant === sp.id;
                                    return (
                                        <div key={sp.id} className="border border-gray-400 rounded bg-white overflow-hidden shadow-sm">
                                            <div className={`p-2.5 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => setExpandedSubPlant(isExpanded ? null : sp.id)}>
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronDown size={18} className="text-gray-700"/> : <ChevronRight size={18} className="text-gray-700"/>}
                                                    <span className="font-extrabold text-sm text-gray-900">{sp.name}</span>
                                                    <span className="text-xs font-bold text-gray-600 bg-gray-300 px-2 py-0.5 rounded">({sp.inverterCount} Inv)</span>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); removeSubPlant(sp.id); }} className="text-red-600 p-1.5 hover:bg-red-100 rounded transition-colors"><Trash2 size={16}/></button>
                                            </div>
                                            
                                            {isExpanded && (
                                                <div className="p-3 bg-white grid grid-cols-2 gap-3 border-t border-gray-300 animate-fadeIn">
                                                    <div className="col-span-2">
                                                        <label className={innerLabelClass}>Nome da Subusina</label>
                                                        <input value={sp.name} onChange={e => updateSubPlant(sp.id, 'name', e.target.value)} className={inputClass} />
                                                    </div>
                                                    <div>
                                                        <label className={innerLabelClass}>Qtd. Inversores</label>
                                                        <input type="number" value={sp.inverterCount} onChange={e => updateSubPlant(sp.id, 'inverterCount', Number(e.target.value))} className={inputClass} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-extrabold text-blue-800 mb-1 uppercase">Início Numeração</label>
                                                        <input type="number" value={sp.inverterStartIndex || 1} onChange={e => updateSubPlant(sp.id, 'inverterStartIndex', Number(e.target.value))} className={`${inputClass} border-blue-400 bg-blue-50 text-blue-900`} />
                                                        <p className="text-[10px] text-gray-500 mt-1">Ex: 5 gera INV...5, INV...6</p>
                                                    </div>
                                                    <div className="col-span-2 flex gap-4 bg-gray-50 p-2 rounded border border-gray-200">
                                                        <div className="flex-1"><label className={innerLabelClass}>Strings/Inv</label><input type="number" value={sp.stringsPerInverter} onChange={e => updateSubPlant(sp.id, 'stringsPerInverter', Number(e.target.value))} className={inputClass} /></div>
                                                        <div className="flex-1"><label className={innerLabelClass}>Trackers/Inv</label><input type="number" value={sp.trackersPerInverter} onChange={e => updateSubPlant(sp.id, 'trackersPerInverter', Number(e.target.value))} className={inputClass} /></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {subPlants.length === 0 && <p className="text-sm text-gray-500 italic text-center py-4 border border-dashed border-gray-300 rounded">Nenhuma subusina adicionada.</p>}
                            </div>

                            {/* TOTAIS AUTOMÁTICOS (SEM BOTÃO) */}
                            <div className="mt-4 pt-3 border-t border-gray-300 bg-gray-200 p-3 rounded flex justify-between">
                                <div className="text-sm text-gray-900">
                                    Total Strings: <strong className="text-blue-800 text-lg">{formData.stringCount}</strong>
                                </div>
                                <div className="text-sm text-gray-900">
                                    Total Trackers: <strong className="text-blue-800 text-lg">{formData.trackerCount}</strong>
                                </div>
                            </div>
                        </div>

                        <div className={cardClass}>
                            <h4 className={cardTitleClass}>Ativos Gerais</h4>
                            <div className="flex gap-2 mb-3">
                                <input value={newAsset} onChange={e => setNewAsset(e.target.value)} placeholder="Novo ativo..." className={inputClass} 
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newAsset.trim()) { setFormData(prev => ({ ...prev, assets: [...(prev.assets || []), newAsset.trim()] })); setNewAsset(''); } } }}
                                />
                                <button type="button" onClick={() => { if(newAsset) { setFormData(prev => ({...prev, assets: [...(prev.assets||[]), newAsset]})); setNewAsset(''); } }} className="px-4 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-sm text-lg">+</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.assets?.map((asset, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-900 rounded-md text-sm flex items-center gap-2 font-bold shadow-sm">
                                        {asset} <button type="button" onClick={() => setFormData(prev => ({...prev, assets: prev.assets?.filter((_, idx) => idx !== i)}))} className="text-red-500 hover:text-red-700 font-bold ml-1 text-lg leading-none">×</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'TEAM' && (
                    <div className="space-y-4">
                        <div className={cardClass}>
                            <h4 className={cardTitleClass}>Coordenador Responsável</h4>
                            <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                {users.filter(u => u.role === Role.COORDINATOR).map(u => (
                                    <label key={u.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded border border-transparent hover:border-gray-200 transition-colors">
                                        <input type="radio" name="coordinator" checked={assignments.coordinatorId === u.id} onChange={() => toggleAssignment('coordinatorId', u.id)} className="text-blue-600 w-4 h-4 border-gray-400 focus:ring-blue-500" />
                                        <span className="text-sm text-gray-900 font-bold">{u.name}</span>
                                        <span className="text-xs text-gray-600 font-medium">@{u.username}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        {[ { title: 'Supervisores', role: Role.SUPERVISOR, key: 'supervisorIds', list: assignments.supervisorIds }, { title: 'Técnicos', role: Role.TECHNICIAN, key: 'technicianIds', list: assignments.technicianIds }, { title: 'Auxiliares', role: Role.ASSISTANT, key: 'assistantIds', list: assignments.assistantIds } ].map(group => (
                            <div key={group.key} className={cardClass}>
                                <h4 className={cardTitleClass}>{group.title}</h4>
                                <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                    {users.filter(u => u.role === group.role).map(u => (
                                        <label key={u.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded border border-transparent hover:border-gray-200 transition-colors">
                                            <input type="checkbox" checked={(group.list as string[]).includes(u.id)} onChange={() => toggleAssignment(group.key as any, u.id)} className="text-blue-600 w-4 h-4 border-gray-400 rounded focus:ring-blue-500" />
                                            <span className="text-sm text-gray-900 font-medium">{u.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-gray-300 mt-auto flex justify-end gap-3 shrink-0 bg-white p-3 rounded-b-xl">
                <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-900 font-bold transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-transform transform active:scale-95">Salvar Usina</button>
            </div>
        </form>
    </Modal>
  );
};

export default PlantForm;