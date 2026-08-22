import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useQueryClient } from '@tanstack/react-query';
import { Role, OS } from '../../types';
import Modal from './Modal';
import { User, RefreshCw } from 'lucide-react';

interface BulkReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOSIds: string[];
  visibleOSList: OS[];
}

const BulkReassignModal: React.FC<BulkReassignModalProps> = ({ isOpen, onClose, selectedOSIds, visibleOSList }) => {
  const { users, patchOS } = useData();
  const queryClient = useQueryClient();

  const [technicianId, setTechnicianId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // We should ideally restrict users to those assigned to the plants of the selected OSs.
  // For simplicity, we get the unique plants from the selected OSs.
  const selectedPlants = useMemo(() => {
    const plants = new Set<string>();
    selectedOSIds.forEach(id => {
      const os = visibleOSList.find(o => o.id === id);
      if (os && os.plantId) plants.add(os.plantId);
    });
    return Array.from(plants);
  }, [selectedOSIds, visibleOSList]);

  const availableTechnicians = useMemo(() => {
    return users.filter(u => u.role === Role.TECHNICIAN && selectedPlants.some(p => u.plantIds?.includes(p)));
  }, [users, selectedPlants]);

  const availableSupervisors = useMemo(() => {
    return users.filter(u => u.role === Role.SUPERVISOR && selectedPlants.some(p => u.plantIds?.includes(p)));
  }, [users, selectedPlants]);

  const availableAssistants = useMemo(() => {
    return users.filter(u => u.role === Role.ASSISTANT && selectedPlants.some(p => u.plantIds?.includes(p)));
  }, [users, selectedPlants]);

  const handleReassign = async () => {
    if (!technicianId && !supervisorId && !assistantId) {
      alert('Selecione pelo menos um colaborador para reatribuir.');
      return;
    }

    if (!confirm(`Tem certeza que deseja reatribuir ${selectedOSIds.length} OS(s)?`)) return;

    setIsProcessing(true);
    
    try {
      const updates: any = {};
      // Se não selecionar, passamos undefined para o patchOS ignorar ou definimos como o valor atual?
      // O usuário quer reatribuir. Se ele escolher um tecnico, altera o tecnico.
      if (technicianId) updates.technicianId = technicianId === 'REMOVE' ? null : technicianId;
      if (supervisorId) updates.supervisorId = supervisorId === 'REMOVE' ? null : supervisorId;
      if (assistantId) updates.assistantId = assistantId === 'REMOVE' ? null : assistantId;

      await Promise.all(selectedOSIds.map(id => patchOS(id, updates)));

      queryClient.invalidateQueries({ queryKey: ['osList'] });
      alert(`✅ ${selectedOSIds.length} OS(s) reatribuídas com sucesso!`);
      onClose();
    } catch (e: any) {
      console.error(e);
      alert('Erro ao reatribuir OSs. Verifique o console.');
    } finally {
      setIsProcessing(false);
    }
  };

  const inputClasses = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all";

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Reatribuir OSs em Lote" 
      footer={
        <div className="flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
           <button 
             onClick={handleReassign} 
             disabled={isProcessing} 
             className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
           >
             {isProcessing ? 'Processando...' : <><RefreshCw size={16} /> Reatribuir</>}
           </button>
        </div>
      }
    >
      <div className="space-y-4 p-2">
        <div className="bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 p-3 rounded-lg text-sm border border-purple-200 dark:border-purple-800/50 mb-4">
          Você selecionou <strong>{selectedOSIds.length}</strong> OS(s) para reatribuição. Preencha apenas os campos que deseja alterar.
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Novo Técnico</label>
            <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select value={technicianId} onChange={e => setTechnicianId(e.target.value)} className={`${inputClasses} pl-9`}>
                    <option value="">-- Manter atual --</option>
                    <option value="REMOVE">-- Remover Técnico --</option>
                    {availableTechnicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Novo Supervisor</label>
            <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} className={`${inputClasses} pl-9`}>
                    <option value="">-- Manter atual --</option>
                    <option value="REMOVE">-- Remover Supervisor --</option>
                    {availableSupervisors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Novo Auxiliar</label>
            <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select value={assistantId} onChange={e => setAssistantId(e.target.value)} className={`${inputClasses} pl-9`}>
                    <option value="">-- Manter atual --</option>
                    <option value="REMOVE">-- Remover Auxiliar --</option>
                    {availableAssistants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
        </div>
      </div>
    </Modal>
  );
};

export default BulkReassignModal;
