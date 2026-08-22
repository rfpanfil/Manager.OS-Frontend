// File: components/modals/OSDetailModal.tsx

import React, { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from './Modal';

import { OS, Role, Priority, OSStatus } from '../../types';

import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useOffline } from '../../contexts/OfflineContext';
import { useCan } from '../hooks/useCan';

import OSExecutionModal from './OSExecutionModal';

import { generateOSReport } from '../utils/pdfGenerator';
// ✅ Importação do gerador de ZIP
import { generateOSZipPackage } from '../utils/zipService'; 
import { saveFile } from '../utils/fileSaver';

import {
  Download,
  Edit,
  Trash2,
  Play,
  Lock,
  User,
  MessageSquare,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  History,
} from 'lucide-react';

import { format, parseISO } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  os: OS;
  onEdit: () => void;
}

const OSDetailModal: React.FC<Props> = ({ isOpen, onClose, os, onEdit }) => {
  const { user } = useAuth();
  const { deleteOSBatch, addOSLog, users, plants, osList, reloadFromAPI, patchOS } = useData();
  const { isOnline, saveOfflineAction } = useOffline();
  const can = useCan();
  const queryClient = useQueryClient();

  const [newLog, setNewLog] = useState('');
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [reviewSubtasks, setReviewSubtasks] = useState<any[]>([]);

  const liveOS: OS = useMemo(() => {
    return (osList.find((item) => item.id === os.id) || os) as OS;
  }, [osList, os]);

  const getUserName = (id?: string) => users.find((u) => u.id === id)?.name || 'N/A';
  const getPlantName = (id: string) => plants.find((p) => p.id === id)?.name || id;

  const currentPlant = plants.find((p) => p.id === liveOS.plantId);
  const coordinatorName = getUserName(currentPlant?.coordinatorId || '');

  useEffect(() => {
    if (liveOS.subtasksStatus) {
      setReviewSubtasks(liveOS.subtasksStatus);
    } else {
      setReviewSubtasks([]);
    }
  }, [liveOS.subtasksStatus]);

  const formatDate = (dateStr: string) => {
    const s = (dateStr || '').trim();
    if (!s) return '-';

    if (s.includes('T')) {
        try {
        return format(parseISO(s), 'dd/MM/yyyy');
        } catch {
        return s;
        }
    }

    if (s.includes('-')) {
        const [year, month, day] = s.split('-');
        return `${day}/${month}/${year}`;
    }

    return s;
  };

  const parseUtc = (s?: string) => {
    if (!s) return null;
    const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
    return new Date(hasTz ? s : `${s}Z`);
  };

  const formatTime = (totalSeconds: number) => {
    const t = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`;
  };

  // Helpers de Histórico
  const parseSubtaskLabel = (raw: string): { n: number | null; title: string } => {
    const s = (raw || '').trim();
    const m = s.match(/^\s*(\d+)\s*([.)-])\s*(.*)\s*$/);
    if (m) {
      const n = Number(m[1]);
      const title = (m[3] || '').trim();
      return { n: Number.isFinite(n) ? n : null, title: title || s };
    }
    return { n: null, title: s };
  };

  const getSubtaskNumberByTitle = (title: string): number | null => {
    const list = Array.isArray(liveOS.subtasksStatus) ? (liveOS.subtasksStatus as any[]) : [];
    const target = (title || '').trim();

    const idx = list.findIndex((st) => {
      const stText = (st?.text || '').trim();
      const parsed = parseSubtaskLabel(stText);
      return parsed.title === target;
    });

    return idx >= 0 ? idx + 1 : null;
  };

  const executionPermission = useMemo(() => {
    if (!user) return { allowed: false, reason: 'Sem usuário logado' };

    if (liveOS.status === OSStatus.COMPLETED) return { allowed: false, reason: 'OS Finalizada' };
    if (liveOS.status === OSStatus.IN_REVIEW) return { allowed: false, reason: 'Em Revisão (Aguardando Aprovação)' };
    if (user.role === Role.ADMIN || user.role === Role.OPERATOR) return { allowed: true, reason: '' };

    // Coordenador e Supervisor da usina podem executar
    if (user.role === Role.COORDINATOR || user.role === Role.SUPERVISOR) {
      if (user.plantIds && user.plantIds.includes(liveOS.plantId)) {
        return { allowed: true, reason: '' };
      }
    }

    if (user.role === Role.ASSISTANT) {
      if (liveOS.priority === Priority.HIGH || liveOS.priority === Priority.URGENT) {
        return { allowed: false, reason: 'Auxiliar não executa Alta/Urgente' };
      }
      const isElectrical = liveOS.classification1 === 'Elétrica' || liveOS.classification2 === 'Elétrica';
      if (isElectrical) {
        return { allowed: false, reason: 'Auxiliar não executa Elétrica' };
      }
      const isAssigned = liveOS.assistantId === user.id || liveOS.technicianId === user.id;
      return { allowed: isAssigned, reason: isAssigned ? '' : 'Você não está escalado nesta OS' };
    }

    const isAssigned = liveOS.technicianId === user.id || liveOS.assistantId === user.id;
    return { allowed: isAssigned, reason: isAssigned ? '' : 'Somente a equipe escalada' };
  }, [user, liveOS, can]);

  // ✅ NOVA FUNÇÃO DE DOWNLOAD DE PACOTE (PDF + ANEXOS + VÍDEOS)
  const handleDownloadPackage = async () => {
    setIsDownloading(true);
    try {
      const helpers = { 
          getPlantName, 
          getUserName: (id: string) => getUserName(id) 
      };
      
      // Gera ZIP com estrutura de pastas
      const zipBase64 = await generateOSZipPackage(liveOS, helpers);
      
      const fileName = `Pacote_${liveOS.id}.zip`;
      await saveFile(fileName, zipBase64, 'application/zip');
      
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar pacote de download. Verifique se os arquivos ainda existem no servidor.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExecutionClick = () => {
    if (executionPermission.allowed) setShowExecutionModal(true);
    else alert(`Execução bloqueada: ${executionPermission.reason}`);
  };

  const handleReviewItem = (idx: number, action: 'APPROVE' | 'REJECT') => {
    const newSubtasks = [...reviewSubtasks];
    if (action === 'APPROVE') {
      newSubtasks[idx] = { ...newSubtasks[idx], isApproved: true, isRejected: false, rejectionReason: '' };
    } else {
      newSubtasks[idx] = { ...newSubtasks[idx], isApproved: false, isRejected: true };
    }
    setReviewSubtasks(newSubtasks);
  };

  const handleRejectionReasonChange = (idx: number, text: string) => {
    const newSubtasks = [...reviewSubtasks];
    newSubtasks[idx] = { ...newSubtasks[idx], rejectionReason: text };
    setReviewSubtasks(newSubtasks);
  };

  const handleApproveOS = async () => {
    // Validar se tem item rejeitado quando tenta aprovar
    if (reviewSubtasks.some(st => st.isRejected)) {
      if (!confirm('Você tem itens marcados como REPROVADOS. Tem certeza que deseja APROVAR a OS inteira mesmo assim?')) return;
    }
    
    if (confirm('Aprovar e Finalizar esta OS definitivamente?')) {
      try {
        if (isOnline) {
          await patchOS(liveOS.id, { status: OSStatus.COMPLETED, endDate: new Date().toISOString(), subtasksStatus: reviewSubtasks });
          await reloadFromAPI();
          queryClient.invalidateQueries({ queryKey: ['osList'] });
          alert('✅ OS Aprovada com sucesso!');
          onClose();
        } else {
          alert('Você precisa estar online para aprovar a OS.');
        }
      } catch (e) {
        alert('Erro ao aprovar OS.');
      }
    }
  };

  const handleRejectOS = async () => {
    const motivo = prompt('Motivo da reprovação:');
    if (motivo === null) return;
    if (confirm('Tem certeza que deseja REPROVAR esta OS e devolvê-la para a fila de Execução?')) {
      try {
        if (isOnline) {
          const rejectLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            authorId: user?.id || 'Sistema',
            comment: `🔴 OS REPROVADA: ${motivo || 'Sem motivo detalhado.'}`,
          };
          const updatedLogs = [...(liveOS.logs || []), rejectLog];
          // Enviando a OS de volta para "Pendente" conforme solicitado e salvando o checklist revisado
          await patchOS(liveOS.id, { status: OSStatus.PENDING, logs: updatedLogs, subtasksStatus: reviewSubtasks });
          await reloadFromAPI();
          queryClient.invalidateQueries({ queryKey: ['osList'] });
          alert('⚠️ OS Reprovada e devolvida para Pendente com sucesso!');
          onClose();
        } else {
          alert('Você precisa estar online para reprovar a OS.');
        }
      } catch (e) {
        alert('Erro ao reprovar OS.');
      }
    }
  };

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja excluir esta OS?')) {
      deleteOSBatch([liveOS.id]);
      onClose();
    }
  };

  const handleAddLog = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newLog.trim()) return;

    const log = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      authorId: user?.id || 'Sistema',
      comment: newLog,
    };

    try {
      if (isOnline) {
        await addOSLog(liveOS.id, log as any);
        await reloadFromAPI();
      } else {
        await saveOfflineAction('ADD_LOG', liveOS.id, log);
        alert('Você está offline. O comentário foi salvo e será enviado ao reconectar.');
      }
      setNewLog('');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar comentário.');
    }
  };

  const canEdit = can('os.editar');
  const canDelete = can('os.excluir');

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
            console.log("DETAIL onClose");
            if (showExecutionModal) return;
            onClose();
        }}
        title={`Detalhes da OS: ${liveOS.title}`}>
        <div className="flex flex-col h-full max-h-[85vh]">
          <div className="flex-1 overflow-y-auto space-y-6 p-2 custom-scrollbar">
            
            {/* Cabeçalho */}
            <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      liveOS.priority === 'Alta' || liveOS.priority === 'Urgente'
                        ? 'bg-red-100 text-red-800'
                        : liveOS.priority === 'Baixa'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    Prioridade: {liveOS.priority}
                  </span>

                  {isOnline ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                      <Wifi size={12} /> Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                      <WifiOff size={12} /> Offline (Modo Fila)
                    </span>
                  )}
                </div>

                <div className="flex gap-1">
                  {/* ✅ BOTÃO DOWNLOAD MODIFICADO (ZIP) */}
                  <button
                    onClick={handleDownloadPackage}
                    disabled={isDownloading}
                    className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 transition-colors flex items-center gap-1"
                    title="Baixar Pacote (Relatório + Evidências)"
                  >
                    {isDownloading ? (
                        <span className="animate-spin">⌛</span> 
                    ) : (
                        <div className="relative">
                            <Download size={20} />
                            <span className="absolute -bottom-1 -right-2 text-[8px] bg-blue-600 text-white px-1 rounded font-bold">ZIP</span>
                        </div>
                    )}
                  </button>

                  {canEdit && (
                    <button
                      onClick={onEdit}
                      className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 transition-colors"
                      title="Editar"
                    >
                      <Edit size={20} />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-300 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-300">
                Status Atual: <b className="text-gray-800 dark:text-white">{liveOS.status}</b>
              </div>
            </div>

            {/* Info Básica */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Usina</label>
                <p className="font-medium dark:text-gray-200">{getPlantName(liveOS.plantId)}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Ativo</label>
                <p className="font-medium dark:text-gray-200">{liveOS.assets.join(', ') || 'Geral'}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Data Planejada</label>
                <p className="font-semibold text-lg dark:text-white">{formatDate(liveOS.startDate)}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Classificação</label>
                <p className="font-medium dark:text-gray-200">
                  {liveOS.classification1} {liveOS.classification2 ? `/ ${liveOS.classification2}` : ''}
                </p>
              </div>
            </div>

            {/* Descrição */}
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Descrição / Instruções
              </label>
              <p className="text-sm whitespace-pre-wrap dark:text-gray-300">
                {liveOS.description || 'Sem descrição.'}
              </p>
            </div>

            {/* Equipe */}
            <div className="border-t dark:border-gray-700 pt-4">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <User size={16} /> Equipe Escalada
              </h4>

              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div>
                  <span className="block text-xs text-gray-500">Técnico</span>
                  <div className="font-medium dark:text-gray-300">{getUserName(liveOS.technicianId)}</div>
                </div>

                <div>
                  <span className="block text-xs text-gray-500">Auxiliar</span>
                  <div className="font-medium dark:text-gray-300">{getUserName(liveOS.assistantId)}</div>
                </div>

                <div>
                  <span className="block text-xs text-gray-500">Supervisor</span>
                  <div className="font-medium dark:text-gray-300">{getUserName(liveOS.supervisorId)}</div>
                </div>

                <div>
                  <span className="block text-xs text-gray-500">Coordenador</span>
                  <div className="font-medium dark:text-gray-300">{coordinatorName}</div>
                </div>
              </div>
            </div>

            {/* Botão de Iniciar Execução */}
            <div className="border-t dark:border-gray-700 pt-4">
              {liveOS.status === OSStatus.COMPLETED ? (
                <div className="w-full py-3 bg-green-100 text-green-800 rounded-lg text-center font-bold flex items-center justify-center gap-2">
                  <CheckCircle size={20} /> OS FINALIZADA
                </div>
              ) : liveOS.status === OSStatus.IN_REVIEW && can('os.revisar') ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleRejectOS}
                    className="flex-1 py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 bg-red-600 hover:bg-red-700"
                    title="Reprovar OS e devolver para Execução"
                  >
                    <XCircle size={20} /> REPROVAR OS
                  </button>
                  <button
                    onClick={handleApproveOS}
                    className="flex-1 py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 bg-green-600 hover:bg-green-700"
                    title="Aprovar e finalizar OS definitivamente"
                  >
                    <CheckCircle size={20} /> APROVAR OS
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleExecutionClick}
                  disabled={!executionPermission.allowed}
                  className={`w-full py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                    executionPermission.allowed
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-400 cursor-not-allowed opacity-70'
                  }`}
                  title={executionPermission.reason}
                >
                  {executionPermission.allowed ? (
                    <>
                      <Play size={20} /> INICIAR / CONTINUAR EXECUÇÃO
                    </>
                  ) : (
                    <>
                      <Lock size={18} /> {executionPermission.reason.toUpperCase()}
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Histórico */}
            {liveOS.executionHistory && liveOS.executionHistory.length > 0 && (
              <div className="border-t dark:border-gray-700 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <History size={16} /> Histórico de Execução
                  </h4>

                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="text-blue-600 hover:text-blue-700 text-xs font-bold uppercase"
                  >
                    {showHistory ? 'Recolher' : 'Ver Histórico'}
                  </button>
                </div>

                {showHistory && (
                  <div className="space-y-3 p-1">
                    {[...liveOS.executionHistory].reverse().map((sess: any, idx: number) => (
                      <div
                        key={sess.sessionId || idx}
                        className="bg-white dark:bg-gray-800 border-l-4 border-blue-500 shadow-sm rounded-r p-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-gray-800 dark:text-gray-200 block text-xs">
                              {sess.userName}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {parseUtc(sess.startTime)?.toLocaleTimeString()} -{' '}
                              {parseUtc(sess.endTime)?.toLocaleTimeString()}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="block font-mono text-sm font-bold text-blue-600">
                              {formatTime(sess.durationSeconds)}
                            </span>
                          </div>
                        </div>

                        {sess.completedSubtasks && sess.completedSubtasks.length > 0 && (
                          <div className="mt-1 bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-100 dark:border-green-800">
                            <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase mb-1 flex items-center gap-1">
                              <CheckCircle size={10} /> Concluído:
                            </p>

                            <ul className="text-[10px] text-gray-600 dark:text-gray-300 space-y-1">
                              {sess.completedSubtasks.map((t: string, i: number) => {
                                const parsed = parseSubtaskLabel(t);
                                const n = parsed.n ?? getSubtaskNumberByTitle(parsed.title);

                                return (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-green-700 dark:text-green-400">•</span>
                                    <span>
                                      {n ? <b className="text-blue-600">{n} - </b> : null}
                                      {parsed.title}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Checklist e Evidências */}
            {(liveOS.status === OSStatus.COMPLETED || liveOS.status === OSStatus.IN_REVIEW) && (
              <div className="border-t dark:border-gray-700 pt-4">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <CheckCircle size={16} /> Checklist & Evidências
                </h4>
                
                {reviewSubtasks && reviewSubtasks.length > 0 && (
                  <div className="mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                    <ul className="space-y-3 text-sm">
                      {reviewSubtasks.map((st: any, idx: number) => (
                        <li key={idx} className={`p-3 rounded border transition-colors ${st.isRejected ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : st.isApproved ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex items-start gap-2 flex-1">
                              {st.done ? (
                                <CheckCircle size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 mt-0.5 flex-shrink-0" />
                              )}
                              <div>
                                <span className={st.done ? 'line-through opacity-70 text-gray-700 dark:text-gray-300' : 'text-gray-800 dark:text-gray-100'}>{st.text}</span>
                                {st.comment && <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">Obs: {st.comment}</p>}
                              </div>
                            </div>
                            
                            {/* Ações de Revisão */}
                            {liveOS.status === OSStatus.IN_REVIEW && can('os.revisar') && (
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleReviewItem(idx, 'APPROVE')}
                                  className={`p-1.5 rounded transition-colors ${st.isApproved ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-green-100 hover:text-green-700'}`}
                                  title="Aprovar Item"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => handleReviewItem(idx, 'REJECT')}
                                  className={`p-1.5 rounded transition-colors ${st.isRejected ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-red-100 hover:text-red-700'}`}
                                  title="Reprovar Item"
                                >
                                  <XCircle size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Campo de Justificativa se Reprovado */}
                          {st.isRejected && liveOS.status === OSStatus.IN_REVIEW && can('os.revisar') && (
                            <div className="mt-3 ml-6">
                              <textarea
                                className="w-full bg-white dark:bg-gray-800 border border-red-300 dark:border-red-800 rounded p-2 text-xs text-gray-800 dark:text-gray-200 focus:ring-red-500 focus:border-red-500 outline-none resize-y"
                                placeholder="Descreva o que precisa ser arrumado..."
                                value={st.rejectionReason || ''}
                                onChange={(e) => handleRejectionReasonChange(idx, e.target.value)}
                              />
                            </div>
                          )}
                          
                          {/* Exibir Justificativa fixa */}
                          {st.isRejected && (liveOS.status !== OSStatus.IN_REVIEW || !can('os.revisar')) && (
                            <div className="mt-3 ml-6 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs p-2 rounded border border-red-200 dark:border-red-800">
                              <strong>Motivo da reprovação:</strong> {st.rejectionReason}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {liveOS.imageAttachments && liveOS.imageAttachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {liveOS.imageAttachments.map((img: any, idx: number) => (
                      <div key={idx} className="relative group rounded overflow-hidden border dark:border-gray-700 bg-black aspect-square">
                        <img 
                          src={img.url} 
                          alt={img.caption || `Imagem ${idx + 1}`} 
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                          onClick={() => window.open(img.url, '_blank')}
                          title="Clique para expandir"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">
                          {img.caption || 'Sem Legenda'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {(!liveOS.subtasksStatus?.length && !liveOS.imageAttachments?.length) && (
                  <p className="text-xs text-gray-400 italic">Nenhum checklist ou imagem registrados.</p>
                )}
              </div>
            )}

            {/* Logs e Comentários */}
            <div className="border-t dark:border-gray-700 pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <MessageSquare size={16} /> Comentários & Logs
                </h4>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto mb-3 bg-gray-50 dark:bg-gray-800/50 p-2 rounded border dark:border-gray-700 custom-scrollbar">
                {liveOS.logs?.map((log, i) => (
                  <div key={i} className="text-xs bg-white dark:bg-gray-700 p-2 rounded shadow-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-gray-700 dark:text-gray-200">
                        {getUserName(log.authorId)}
                      </span>
                      <span className="text-gray-400">
                        {log.timestamp ? format(parseISO(log.timestamp), 'dd/MM HH:mm') : ''}
                      </span>
                    </div>
                    <p className="dark:text-gray-300">{log.comment}</p>
                  </div>
                ))}
                {(!liveOS.logs || liveOS.logs.length === 0) && (
                  <p className="text-xs text-gray-400 italic text-center">Nenhum registro.</p>
                )}
              </div>

              <div className="flex gap-2 items-center">
                <input
                  className="flex-1 border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Adicionar comentário..."
                  value={newLog}
                  onChange={(e) => setNewLog(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLog();
                    }
                    }}

                />
                <button
                    type="button"
                    onClick={() => handleAddLog()}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                    >
                    Enviar
                    </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {showExecutionModal && <OSExecutionModal os={liveOS} onClose={(finished) => {
          setShowExecutionModal(false);
          if (finished) onClose();
      }} />}
    </>
  );
};

export default OSDetailModal;