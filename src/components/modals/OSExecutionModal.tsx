// File: components/modals/OSExecutionModal.tsx
//
// Modal de execução de OS:
// - Start / Pause / Finalizar
// - Checklist
// - Upload de fotos (online ou offline)
// - Exclusão de fotos (online ou offline)
//
// ✅ Correções deste patch (importantes):
// 1) Parar de usar navigator.onLine como verdade absoluta.
//    - Agora usa isOnline (online real) vindo do OfflineContext.
//    - Evita tentar apagar no servidor quando o backend está unreachable, e evita o alerta errado.
// 2) Ao deletar offline, enfileira DELETE_IMAGE com metadados { attachmentId, url, fileName, caption }.
//    - Isso melhora o match no sync (caso id mude ou venha diferente no servidor).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';


import Modal from './Modal';

import { OS, SubtaskItem, OSStatus, ImageAttachment } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';

import {
  Camera,
  CheckCircle,
  CheckSquare,
  History,
  Lock,
  Pause,
  Play,
  Square,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import { API_BASE } from '../utils/config';

interface Props {
  os: OS;
  onClose: () => void;
}

const OSExecutionModal: React.FC<Props> = ({ os, onClose }) => {
  const { uploadOSAttachments, deleteOSAttachment, osList, reloadFromAPI, patchOS } = useData();
  const { user } = useAuth();

  // ✅ isOnline = online REAL (device + ping backend OK), não apenas "tem internet"
  const { isOnline, saveOfflineAction } = useOffline();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pega sempre a OS mais atual do estado global
  const liveOS: OS = useMemo(() => {
    const found = osList.find((o) => o.id === os.id);
    return (found || os) as OS;
  }, [osList, os]);

  const [subtasks, setSubtasks] = useState<SubtaskItem[]>(liveOS.subtasksStatus || []);
  const [isRunning, setIsRunning] = useState(false);
  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [lockerName, setLockerName] = useState('');
  const [elapsedSession, setElapsedSession] = useState(0);

  const [showHistory, setShowHistory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Helpers -------------------------------------------------------------------



  const resolveAssetUrl = (u?: string) => {
    if (!u) return '';
    if (u.startsWith('blob:')) return u;
    if (u.startsWith('data:')) return u; // base64
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return `${API_BASE}${u.startsWith('/') ? u : `/${u}`}`;
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Falha ao ler imagem'));
      r.onloadend = () => resolve(String(r.result || ''));
      r.readAsDataURL(blob);
    });

  const uploadFiles = async (files: File[], caption: string) => {
    // Preview leve: blob URLs (não é base64)
    const previews = files.map((f) => ({
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(f),
      fileName: f.name,
      caption,
      uploadedBy: user?.name,
      uploadedAt: new Date().toISOString(),
    }));

    // 🔥 CORREÇÃO DA DUPLICIDADE 🔥
    // Só atualizamos o estado local com o preview se estivermos OFFLINE.
    // Se estivermos ONLINE, esperamos o servidor devolver a lista oficial atualizada.
    if (!isOnline) {
      patchOS(liveOS.id, {
        imageAttachments: [...previews, ...(liveOS.imageAttachments || [])] as any,
      });
    }

    if (isOnline) {
      // Online: Envia e deixa o reloadFromAPI atualizar a tela depois
      await uploadOSAttachments(liveOS.id, files, caption);
      return;
    }

    // Offline: mantém a lógica de fila e base64
    for (const f of files) {
      const dataUrl = await blobToDataUrl(f);
      await saveOfflineAction('UPLOAD_IMAGE', liveOS.id, {
        attachment: {
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: dataUrl,
          fileName: f.name,
          caption,
          uploadedBy: user?.name,
          uploadedAt: new Date().toISOString(),
        },
      });
    }
  };


  const parseUtc = (s?: string) => {
    if (!s) return null;
    try {
      // Só considera TZ se terminar com Z/z ou +/-HH:MM
      const hasTZ = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
      return new Date(hasTZ ? s : `${s}Z`);
    } catch {
      return null;
    }
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

  const apiCall = async (path: string, method: 'GET' | 'POST' | 'PUT' = 'POST', body?: any) => {
    const url = path.startsWith('http')
      ? path
      : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

    const token = localStorage.getItem('token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || '',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Erro ${res.status}`);
    }

    return res.json();
  };

  // Estado de trava / execução -------------------------------------------------

  // 1) Trava / execução: NÃO mexe em subtasks (pra não resetar quando muda imageAttachments)
  useEffect(() => {
    if (!liveOS) return;

    if (liveOS.currentExecutorId && liveOS.currentExecutorId !== user?.id) {
      setIsLockedByOther(true);
      setLockerName('Outro usuário');
      setIsRunning(false);
      setElapsedSession(0);
      return;
    }

    setIsLockedByOther(false);
    setLockerName('');
    setIsRunning(liveOS.currentExecutorId === user?.id);
  }, [liveOS.currentExecutorId, user?.id]);

  // 2) Só sincroniza subtasks do "estado global" quando NÃO está executando
  // (ou quando troca de OS, ou quando chegou um subtasksStatus novo do backend enquanto parado)
  useEffect(() => {
    if (!isRunning) {
      setSubtasks(liveOS.subtasksStatus || []);
    }
  }, [isRunning, liveOS.id, liveOS.subtasksStatus]);



  // Timer: calcula com base em executionStart ---------------------------------

  useEffect(() => {
    let interval: number | undefined;

    if (isRunning && liveOS.executionStart) {
      const start = parseUtc(liveOS.executionStart)?.getTime();
      if (start) {
        const tick = () => setElapsedSession(Math.max(0, Math.floor((Date.now() - start) / 1000)));
        tick();
        interval = window.setInterval(tick, 1000);
      }
    }

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRunning, liveOS.executionStart]);

  // Ações ---------------------------------------------------------------------

  const handleStart = async () => {
    // ✅ IMPORTANTE: Start precisa de online real (trava no servidor)
    if (!isOnline) {
      alert('Backend offline/unreachable. Conecte no servidor para INICIAR a execução.');
      return;
    }

    try {
      await apiCall(`/api/os/${liveOS.id}/start`, 'POST');
      setIsRunning(true);
      await reloadFromAPI();
    } catch (e: any) {
      alert(e?.message || 'Erro ao iniciar.');
      if ((e?.message || '').includes('Bloqueado')) onClose();
    }
  };

  const handlePause = async (finished = false) => {
    const now = new Date();
    const currentSessionSeconds = Math.max(0, Math.floor(elapsedSession || 0));
    const clientEndTime = now.toISOString();

    // (opcional mas recomendado) normaliza IDs antes de enviar
    const normalizedSubtasks = (subtasks || []).map((st: any, idx: number) => ({
      ...st,
      id: Number.isFinite(st?.id) ? st.id : idx + 1,
    }));

    const payload = {
      subtasksStatus: normalizedSubtasks,
      finished,
      clientEndTime,
      durationSeconds: currentSessionSeconds,
    };

    // ✅ ONLINE REAL: NÃO dar patchOS antes do /pause
    if (isOnline) {
      try {
        await apiCall(`/api/os/${liveOS.id}/pause`, 'POST', payload);
        setIsRunning(false);
        setElapsedSession(0);
        await reloadFromAPI();
        onClose();
        return;
      } catch (e) {
        console.log('Falha no pause online, salvando offline...', e);
        // cai para o fluxo offline abaixo
      }
    }

    // ✅ OFFLINE (ou falhou online): agora sim atualiza local e enfileira
    const newTotalTime = (liveOS.executionTimeSeconds || 0) + currentSessionSeconds;

    patchOS(liveOS.id, {
      currentExecutorId: null,
      executionStart: null,
      executionTimeSeconds: newTotalTime,
      status: finished ? OSStatus.IN_REVIEW : OSStatus.IN_PROGRESS,
      updatedAt: clientEndTime,
      subtasksStatus: normalizedSubtasks as any,
    });

    try {
      await saveOfflineAction('UPDATE_STATUS', liveOS.id, payload);
      setIsRunning(false);
      setElapsedSession(0);
      alert(`Sem conexão com o servidor. Tempo de ${formatTime(currentSessionSeconds)} salvo no DISPOSITIVO.`);
      onClose();
    } catch {
      alert('Erro crítico ao salvar offline.');
    }
  };


  const handleCheck = (i: number) => {
    if (!isRunning) return alert('Inicie a execução.');
    const n = [...subtasks];
    n[i] = { ...n[i], done: !n[i]?.done };
    setSubtasks(n);
  };

  const handleCommentChange = (i: number, t: string) => {
    if (!isRunning) return;
    const n = [...subtasks];
    n[i] = { ...n[i], comment: t };
    setSubtasks(n);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx?: number) => {
    if (!isRunning) return alert('Inicie a execução para anexar fotos.');
    if (!e.target.files?.length) return;

    setIsUploading(true);
    const files = Array.from(e.target.files);
    const caption = idx !== undefined ? `Item ${idx + 1}` : 'Foto Geral';

    try {
      await uploadFiles(files, caption);

      if (isOnline) await reloadFromAPI();
      else alert('Sem conexão com o servidor. Fotos salvas no DISPOSITIVO.');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar imagens.');
    } finally {
      e.target.value = '';
      setIsUploading(false);
    }
  };

  const handleTakePhoto = async (idx?: number) => {
    if (!isRunning) return alert('Inicie a execução para anexar fotos.');

    setIsUploading(true);
    const caption = idx !== undefined ? `Item ${idx + 1}` : 'Foto Geral';

    try {
      const photo = await CapCamera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 70,
        width: 1600,
      });

      if (!photo.webPath) throw new Error('Camera não retornou webPath');

      const blob = await (await fetch(photo.webPath)).blob();
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

      await uploadFiles([file], caption);
      if (isOnline) await reloadFromAPI();
      else alert('Sem conexão com o servidor. Foto salva no DISPOSITIVO.');
    } catch (err) {
      console.error(err);
      alert('Erro ao capturar/enviar foto.');
    } finally {
      setIsUploading(false);
    }
  };



  const handleDeletePhoto = async (attId: string) => {
    if (!isRunning) return;
    if (!confirm('Apagar anexo?')) return;

    // ✅ Captura metadados ANTES de remover do estado (para a fila offline)
    const att = (liveOS.imageAttachments || []).find((a: any) => a.id === attId);

    // Remove local imediatamente
    const newAttachments = (liveOS.imageAttachments || []).filter((a: any) => a.id !== attId);
    patchOS(liveOS.id, { imageAttachments: newAttachments as any });

    // ✅ OFFLINE REAL: nunca tenta servidor; só enfileira e sai (sem alerta “Erro ao apagar no servidor”)
    if (!isOnline) {
      await saveOfflineAction('DELETE_IMAGE', liveOS.id, {
        attachmentId: attId,
        url: att?.url,
        fileName: att?.fileName,
        caption: att?.caption,
      });
      return;
    }

    // ONLINE REAL: apaga no servidor
    try {
      await deleteOSAttachment(liveOS.id, attId);
      await reloadFromAPI();
    } catch (e) {
      // Aqui é erro real do servidor (não é offline)
      alert('Erro ao apagar no servidor.');
      await reloadFromAPI();
    }
  };

  // Seletores de imagens -------------------------------------------------------

  const getImagesForItem = (i: number) =>
    (liveOS.imageAttachments || []).filter((img: any) => img.caption === `Item ${i + 1}`);

  const getGeneralImages = () =>
    (liveOS.imageAttachments || []).filter((img: any) => img.caption === 'Foto Geral');

  const hasIT = (t: string) => {
    const up = (t || '').toUpperCase();
    return up.includes('IT_') || up.includes('INSTRUÇÃO');
  };

  // Render: Bloqueio -----------------------------------------------------------

  if (isLockedByOther) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Execução Bloqueada">
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Lock className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">OS em andamento</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Esta OS está sendo executada por {lockerName || 'outra pessoa'} no momento.
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold"
          >
            Voltar
          </button>
        </div>
      </Modal>
    );
  }

  // Render: Principal ----------------------------------------------------------
  // Extrai número do próprio texto (ex.: "3) Algo", "3 - Algo", "3. Algo").
  // Retorna { n, title } onde title vem sem o prefixo numérico.
  const parseSubtaskLabel = (raw: string): { n: number | null; title: string } => {
    const s = (raw || '').trim();

    // Aceita: "3) ", "3 - ", "3. ", "3)Algo", etc.
    const m = s.match(/^\s*(\d+)\s*([.)-])\s*(.*)\s*$/);
    if (m) {
      const n = Number(m[1]);
      const title = (m[3] || '').trim();
      return { n: Number.isFinite(n) ? n : null, title: title || s };
    }

    return { n: null, title: s };
  };

  // Se não tiver número no texto, tenta achar pelo título comparando com a lista atual de subtarefas.
  const getSubtaskNumberByTitle = (title: string): number | null => {
    const list = (subtasks || liveOS.subtasksStatus || []) as any[];
    const target = (title || '').trim();

    const idx = list.findIndex((st) => {
      const stText = (st?.text || '').trim();
      // Também normaliza caso a própria subtarefa tenha vindo com "N) ..." por algum motivo
      const parsed = parseSubtaskLabel(stText);
      return parsed.title === target;
    });

    return idx >= 0 ? idx + 1 : null;
  };


  return (
    <Modal
      isOpen={true}
      onClose={() => {
        if (!isRunning) onClose();
        else alert('Pause a execução antes de sair!');
      }}
      title={`Execução: ${liveOS.title}`}
    >
      <div className="flex flex-col h-[85vh]">
        {/* Header Timer */}
        <div
          className={`${
            isRunning ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'
          } border rounded-lg p-2 mb-2 flex justify-between items-center shadow-inner`}
        >
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-lg flex items-center justify-center gap-2"
            >
              <Play size={20} />
              INICIAR / CONTINUAR EXECUÇÃO
            </button>
          ) : (
            <div className="flex justify-between w-full text-white px-2">
              <div>
                <div className="text-[10px] text-gray-400 uppercase">Sessão</div>
                <div className="text-2xl font-mono font-bold">{formatTime(elapsedSession)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 uppercase">Total</div>
                <div className="text-lg font-mono text-gray-300">
                  {formatTime((liveOS.executionTimeSeconds || 0) + elapsedSession)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botão histórico */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-blue-600 text-sm flex items-center gap-1 hover:underline"
          >
            <History size={16} />
            {showHistory ? 'Voltar para Checklist' : 'Ver Histórico'}
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {showHistory ? (
            <div className="space-y-2">
              {(liveOS.executionHistory || [])
                .slice()
                .reverse()
                .map((h: any, i: number) => (
                  <div
                    key={h.sessionId || i}
                    className="bg-white dark:bg-gray-800 p-3 border-l-4 border-blue-500 shadow flex flex-col"
                  >
                    <div className="flex justify-between">
                      <div>
                        <span className="font-bold block text-gray-800 dark:text-gray-200">
                          {h.userName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {parseUtc(h.startTime)?.toLocaleTimeString()} -{' '}
                          {parseUtc(h.endTime)?.toLocaleTimeString()}
                        </span>
                      </div>
                      <span className="font-mono text-blue-600 font-bold">
                        {formatTime(h.durationSeconds)}
                      </span>
                    </div>

                    {h.completedSubtasks && h.completedSubtasks.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 border-t pt-1 border-gray-200 dark:border-gray-700">
                        <strong>Itens concluídos:</strong>

                        <ul className="mt-1 space-y-1">
                          {h.completedSubtasks.map((t: string, k: number) => {
                            const parsed = parseSubtaskLabel(t);
                            const n = parsed.n ?? getSubtaskNumberByTitle(parsed.title);

                            return (
                              <li key={k} className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                  <CheckCircle size={14} />
                                  Feita
                                </span>

                                {n ? <span className="text-blue-600 font-bold">{n} -</span> : null}
                                <span>{parsed.title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div
              className={`space-y-4 ${!isRunning ? 'opacity-50 pointer-events-none grayscale' : ''}`}
            >
              {/* Checklist */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex gap-2 items-center">
                  <CheckSquare size={16} />
                  Checklist
                </h4>

                {subtasks.map((item, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded border mb-3 transition-colors ${
                      item.done
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2 flex-1 cursor-pointer" onClick={() => handleCheck(i)}>
                        <div className={item.done ? 'text-green-600' : 'text-gray-400'}>
                          {item.done ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>

                        <span
                          className={`text-sm ${
                            item.done
                              ? 'line-through text-gray-500'
                              : 'text-gray-800 dark:text-gray-100'
                          }`}
                        >
                          <span className="text-blue-500 font-bold mr-2">{i + 1}</span>
                          {item.text}
                          {hasIT(item.text) && (
                            <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1 rounded">
                              IT
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex gap-1">
                        {/* Galeria */}
                        <label
                          className={`p-1 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 ${
                            isUploading ? 'opacity-50 pointer-events-none' : ''
                          }`}
                          title="Selecionar da galeria"
                        >
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={(e) => handlePhotoUpload(e, i)}
                            disabled={isUploading}
                          />
                          <UploadCloud className="text-gray-400 w-5 h-5" />
                        </label>

                        {/* Câmera */}
                        <button
                          type="button"
                          onClick={() => handleTakePhoto(i)}
                          disabled={isUploading}
                          className="p-1 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                          title="Tirar foto agora"
                        >
                          <Camera className="text-gray-400 w-5 h-5" />
                        </button>

                      </div>
                    </div>

                    <textarea
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm text-gray-800 dark:text-gray-200 outline-none resize-y min-h-[60px]"
                      placeholder="Observação..."
                      value={item.comment || ''}
                      onChange={(e) => handleCommentChange(i, e.target.value)}
                    />

                    {/* Fotos do item */}
                    {getImagesForItem(i).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getImagesForItem(i).map((img: any) => (
                          <div key={img.id} className="relative w-16 h-16 group">
                            <img
                              src={resolveAssetUrl(img.url)}
                              className="w-full h-full object-cover rounded border border-gray-300 dark:border-gray-600"
                            />
                            <button
                              onClick={() => handleDeletePhoto(img.id)}
                              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow z-10"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Fotos gerais */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
                <h5 className="text-sm font-bold text-gray-500 uppercase mb-3 flex gap-2 items-center">
                  <Camera size={16} />
                  Fotos Gerais
                  {!isOnline && (
                    <span className="text-xs text-amber-600 font-medium">(Offline: sync pendente)</span>
                  )}
                </h5>

                <div className="flex flex-wrap gap-2">
                  {getGeneralImages().map((img: any) => (
                    <div key={img.id} className="relative w-20 h-20 group">
                      <img
                        src={resolveAssetUrl(img.url)}
                        className="w-full h-full object-cover rounded border border-gray-300 dark:border-gray-600 shadow-sm"
                      />
                      <button
                        onClick={() => handleDeletePhoto(img.id)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1.5 shadow"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {/* Galeria */}
                  <label
                    className={`w-20 h-20 flex items-center justify-center bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-500 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 ${
                      isUploading ? 'opacity-50 pointer-events-none' : ''
                    }`}
                    title="Selecionar da galeria"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={(e) => handlePhotoUpload(e)}
                      disabled={isUploading}
                    />
                    <UploadCloud className="text-gray-400 dark:text-gray-300" />
                  </label>

                  {/* Câmera */}
                  <button
                    type="button"
                    onClick={() => handleTakePhoto(undefined)}
                    disabled={isUploading}
                    className="w-20 h-20 flex items-center justify-center bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-500 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                    title="Tirar foto agora"
                  >
                    <Camera className="text-gray-400 dark:text-gray-300" />
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isRunning && !showHistory && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 bg-white dark:bg-gray-800 p-2">
            <button
              onClick={() => handlePause(false)}
              className="bg-amber-500 hover:bg-amber-600 text-white flex-1 py-3 rounded font-bold flex justify-center gap-2 shadow-md"
            >
              <Pause size={18} />
              Salvar (Pausar)
            </button>

            <button
              onClick={() => {
                if (subtasks.some((t) => !t.done) && !confirm('Finalizar com itens pendentes?')) return;
                handlePause(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white flex-1 py-3 rounded font-bold flex justify-center gap-2 shadow-md"
            >
              <CheckCircle size={18} />
              Finalizar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default OSExecutionModal;