// File: components/modals/DownloadModal.tsx
// Este componente renderiza um modal para filtrar e baixar relatórios de Ordens de Serviço em formato ZIP contendo PDFs individuais.
// ATUALIZAÇÃO: Filtro de "Usina" agora respeita as permissões do usuário (Cliente só vê suas usinas).

import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Role, Priority, OSStatus } from '../../types';
import { generateOSReport } from '../utils/pdfGenerator';
import { Download } from 'lucide-react';
import JSZip from 'jszip';
import { saveFile } from '../utils/fileSaver';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialStatus?: string; 
}

const DownloadModal: React.FC<Props> = ({ isOpen, onClose, initialStatus }) => {
  const { osList, plants, users } = useData();
  const { user } = useAuth();

  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(initialStatus || '');
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(''); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
      if (initialStatus) setSelectedStatus(initialStatus);
  }, [initialStatus]);

  const getPlantName = (id: string) => plants.find(p => p.id === id)?.name || id;
  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'N/A';

  const availablePlants = useMemo(() => {
      if (!user) return [];
      if (user.role === Role.ADMIN || user.role === Role.OPERATOR) return plants;
      return plants.filter(p => user.plantIds?.includes(p.id));
  }, [plants, user]);

  const technicians = useMemo(() => {
    return users.filter(u => {
      if (u.role !== Role.TECHNICIAN && u.role !== Role.ASSISTANT) return false;
      if (selectedPlant) return u.plantIds?.includes(selectedPlant);
      return true;
    });
  }, [users, selectedPlant]);

  // ✅ LISTA DE ATIVOS CONDICIONAL (Depende de Status e Usina)
  const availableAssets = useMemo(() => {
      let sourceList = osList;

      // Filtra primeiro pela Usina
      if (selectedPlant) {
          sourceList = sourceList.filter(os => os.plantId === selectedPlant);
      }

      // Filtra também pelo Status selecionado (para mostrar apenas ativos relevantes)
      if (selectedStatus) {
          sourceList = sourceList.filter(os => os.status === selectedStatus);
      }

      // Extrai ativos únicos
      const assets = new Set<string>();
      sourceList.forEach(os => {
          os.assets?.forEach(a => assets.add(a));
      });
      return Array.from(assets).sort();
  }, [osList, selectedPlant, selectedStatus]); // Adicionei selectedStatus na dependência

  const filteredData = useMemo(() => {
    return osList.filter(os => {
      const isAllowed = user?.role === Role.ADMIN || user?.role === Role.OPERATOR || 
                        (user?.plantIds?.includes(os.plantId));
      
      if (!isAllowed) return false;

      if (selectedPlant && os.plantId !== selectedPlant) return false;
      if (selectedPriority && os.priority !== selectedPriority) return false;
      if (selectedStatus && os.status !== selectedStatus) return false;
      if (selectedTechnician && os.technicianId !== selectedTechnician) return false;
      if (selectedAsset && !os.assets?.includes(selectedAsset)) return false; 
      if (startDate && os.startDate < startDate) return false;
      if (endDate && os.startDate > endDate) return false;
      
      return true;
    });
  }, [osList, selectedPlant, selectedPriority, selectedStatus, selectedTechnician, selectedAsset, startDate, endDate, user]);

  const handleDownloadZip = async () => {
    if (filteredData.length === 0) {
      alert("Nenhuma OS encontrada com os filtros selecionados.");
      return;
    }

    setIsGenerating(true);
    try {
      const zip = new JSZip();
      const folderName = `Relatorio_OS_${new Date().toISOString().split('T')[0]}`;
      const folder = zip.folder(folderName);

      const helpers = { getPlantName, getUserName };

      // 1. Gera cada PDF e adiciona ao arquivo ZIP
      for (const os of filteredData) {
        // Gera o PDF (passando false para não baixar automaticamente)
        const doc = await generateOSReport([os], `Relatório - ${os.id}`, helpers, false);
        
        // Cria um nome de arquivo seguro
        const safeId = os.id;
        const safeDate = os.startDate.split('T')[0];
        const safePlant = getPlantName(os.plantId).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
        const safeAsset = (os.assets?.[0] || 'Geral').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
        
        const fileName = `${safeId}-${safeDate}-${safePlant}-${safeAsset}.pdf`;
        
        // Adiciona ao zip como Blob (o JSZip lida bem com isso internamente)
        const pdfBlob = doc.output('blob');
        folder?.file(fileName, pdfBlob);
      }

      // 2. 🔥 O PULO DO GATO: Gera o ZIP final como BASE64
      // O Android precisa de base64 para gravar no disco via plugin
      const zipBase64 = await zip.generateAsync({ type: "base64" });
      
      // 3. Chama o helper universal para salvar
      await saveFile(`${folderName}.zip`, zipBase64, 'application/zip');
      
      onClose();
    } catch (error) {
      console.error("Erro ao gerar ZIP:", error);
      alert("Erro ao gerar o relatório.");
    } finally {
      setIsGenerating(false);
    }
  };

  const inputClass = "w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Baixar Relatórios (PDF)">
      <div className="space-y-4 p-1">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-700 text-xs text-yellow-800 dark:text-yellow-200">
          Selecione os filtros abaixo para gerar um arquivo ZIP contendo os relatórios individuais.
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Usina</label>
            <select value={selectedPlant} onChange={e => setSelectedPlant(e.target.value)} className={inputClass}>
              <option value="">Todas as permitidas</option>
              {availablePlants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Técnico</label>
            <select value={selectedTechnician} onChange={e => setSelectedTechnician(e.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {Object.values(OSStatus).map(s => (
                  // ✅ CORREÇÃO VISUAL: Troca "Em Progresso" por "Em Execução" apenas na exibição
                  <option key={s} value={s}>
                      {s === 'Em Progresso' ? 'Em Execução' : s}
                  </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Ativo</label>
            <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {availableAssets.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="label block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Prioridade</label>
                <select value={selectedPriority} onChange={e => setSelectedPriority(e.target.value)} className={inputClass}>
                <option value="">Todas</option>
                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t dark:border-gray-700">
          <div>
            <label className="label block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">De</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="label block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Até</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-blue-800 dark:text-blue-200">
          <strong>Resumo:</strong> {filteredData.length} Ordens de Serviço encontradas.
        </div>

        <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded text-gray-800 dark:text-white font-medium">Cancelar</button>
          <button 
            onClick={handleDownloadZip} 
            disabled={isGenerating || filteredData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow disabled:opacity-50"
          >
            {isGenerating ? 'Gerando...' : <><Download size={18} /> Baixar ZIP</>}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadModal;