// File: contexts/OfflineContext.tsx
//
// Contexto Offline Completo & Robusto (Versão Final Restaurada)
// ==========================================================
// Gerencia a fila de sincronização (IndexedDB) e detecta conectividade.
//
// FUNCIONALIDADES:
// 1. Detecta "Online Real" (Navigator + Ping no Backend).
// 2. Processa fila de ações (Uploads, Deletes, Status, Logs).
// 3. Otimização Inteligente:
//    - Cancela Upload se a imagem for deletada antes de subir.
//    - Remove itens "podres" (Erro 404) para evitar loop infinito (Anti-Zumbi).
//    - Normaliza URLs para evitar erros de comparação.
//
// ==========================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { initDB, addToQueue, getQueue, removeFromQueue } from '../services/offlineDb';
import { useData } from './DataContext';
import { API_BASE } from '../components/utils/config';

// Tipos de ação suportados na fila offline
type OfflineActionType = 'ADD_LOG' | 'UPDATE_STATUS' | 'UPLOAD_IMAGE' | 'DELETE_IMAGE';

interface OfflineContextType {
  isOnline: boolean;        // True apenas se dispositivo E backend estiverem OK
  deviceOnline: boolean;    // Estado do adaptador de rede (Wi-Fi/4G)
  backendOnline: boolean;   // Estado de resposta do servidor (Ping)
  queueLength: number;      // Itens pendentes na fila
  saveOfflineAction: (type: OfflineActionType, osId: string, payload: any) => Promise<void>;
  forceSync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType>({} as OfflineContextType);
export const useOffline = () => useContext(OfflineContext);

// --- HELPERS ---

// Normaliza URL para comparação (remove query params e espaços)
function normalizeUrl(u?: string): string {
  if (!u) return '';
  return u.trim().split('?')[0];
}

// Extrai nome do arquivo da URL
function extractFilenameFromUrl(u?: string): string {
  const nu = normalizeUrl(u);
  if (!nu) return '';
  const parts = nu.split('/');
  return parts[parts.length - 1] || '';
}

// Cria chave única para identificar deleções na fila
function makeDeleteKey(osId: string, value: string): string {
  return `${osId}::${value}`;
}

// Fetch com timeout para evitar que requisições presas travem a fila
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(id);
  }
}

// --- PROVIDER ---

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { reloadFromAPI } = useData();

  // Estados de Conectividade
  const [deviceOnline, setDeviceOnline] = useState<boolean>(navigator.onLine);
  const [backendOnline, setBackendOnline] = useState<boolean>(false); // Começa false até confirmar
  const [queueLength, setQueueLength] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Cache para não "spamar" ping
  const pingCacheRef = useRef<{ ok: boolean; at: number }>({ ok: false, at: 0 });

  // ---------------------------------------------------------------------------
  // 1. PING BACKEND (Verifica se o servidor está vivo)
  // ---------------------------------------------------------------------------
  const pingBackend = useCallback(async (force = false): Promise<boolean> => {
    if (!navigator.onLine) {
      setBackendOnline(false);
      pingCacheRef.current = { ok: false, at: Date.now() };
      return false;
    }

    const now = Date.now();
    const ageMs = now - (pingCacheRef.current.at || 0);

    // Se pingou há menos de 3s, usa cache (exceto se forçado)
    if (!force && ageMs < 3000) return pingCacheRef.current.ok;

    try {
      // Usa parâmetro _ping para o backend responder rápido (se otimizado)
      const url = `${API_BASE}/api/os?_ping=${now}`;
      
      const res = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        },
        3000 // Timeout de 3s (equilíbrio entre rede móvel lenta e UX)
      );

      const ok = res.ok;
      pingCacheRef.current = { ok, at: now };
      setBackendOnline(ok);
      return ok;
    } catch (e) {
      // Falha de rede ou timeout
      pingCacheRef.current = { ok: false, at: now };
      setBackendOnline(false);
      return false;
    }
  }, []);

  const isOnline = deviceOnline && backendOnline;

  // ---------------------------------------------------------------------------
  // 2. SYNC API CALL (Wrapper para chamadas da fila)
  // ---------------------------------------------------------------------------
  const syncApiCall = useCallback(async (path: string, method: 'GET' | 'POST' | 'PUT', body?: any) => {
    const token = localStorage.getItem('token');
    let userId = '';
    try {
      const u = localStorage.getItem('currentUser');
      if (u) userId = JSON.parse(u).id;
    } catch {}

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

    const res = await fetchWithTimeout(
      url,
      { method, headers, body: body ? JSON.stringify(body) : undefined },
      10000 // Timeout generoso (10s) para uploads/puts pesados
    );

    // 🔥 TRATAMENTO CRÍTICO: 404 (Not Found)
    // Se a OS não existe mais no servidor, lançamos erro específico
    // para remover o item da fila e evitar loop infinito.
    if (res.status === 404) {
        throw new Error("404_NOT_FOUND");
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Server Error ${res.status}: ${txt}`);
    }

    return res.json();
  }, []);

  // ---------------------------------------------------------------------------
  // 3. PROCESSADOR DA FILA (O Coração do Sync)
  // ---------------------------------------------------------------------------
  const processQueue = useCallback(async () => {
    if (isSyncing) return;
    if (!navigator.onLine) return;

    // Verifica conectividade real antes de começar
    const ok = await pingBackend(false);
    if (!ok) return;

    const rawQueue = await getQueue();
    if (!rawQueue.length) return;

    // Ordena por timestamp para garantir ordem cronológica dos fatos
    const queue = [...rawQueue].sort((a: any, b: any) => {
      const ta = a.timestamp || 0;
      const tb = b.timestamp || 0;
      if (ta !== tb) return ta - tb;
      return (a.id || 0) - (b.id || 0);
    });

    setIsSyncing(true);
    console.log(`🔄 [SYNC] Iniciando processamento de ${queue.length} itens...`);

    let processedCount = 0;

    try {
      // A. PRÉ-PROCESSAMENTO: Identifica deleções para cancelar uploads inúteis
      // (Isso economiza dados e evita erros de "delete não encontrou arquivo")
      const deletedKeys = new Set<string>();

      for (const item of queue) {
        if (item.type === 'DELETE_IMAGE') {
          const p = item.payload || {};
          const attachmentId = (p.attachmentId || p.id || '').toString();
          const url = normalizeUrl(p.url);
          const fileName = (p.fileName || '').toString();
          const filenameFromUrl = extractFilenameFromUrl(p.url);

          if (attachmentId) deletedKeys.add(makeDeleteKey(item.osId, `id:${attachmentId}`));
          if (url) deletedKeys.add(makeDeleteKey(item.osId, `url:${url}`));
          if (fileName) deletedKeys.add(makeDeleteKey(item.osId, `fileName:${fileName}`));
          if (filenameFromUrl) deletedKeys.add(makeDeleteKey(item.osId, `filename:${filenameFromUrl}`));
        }
      }

      // B. LOOP DE PROCESSAMENTO
      for (const item of queue) {
        if (!navigator.onLine) break;

        // Verifica backend a cada item para parar rápido se cair
        const stillOk = await pingBackend(false);
        if (!stillOk) break;

        if (!item.id) continue;

        try {
            // --- CASO 1: UPDATE_STATUS (Pausar/Finalizar) ---
            if (item.type === 'UPDATE_STATUS') {
                await syncApiCall(`/api/os/${item.osId}/pause`, 'POST', item.payload);
            } 
            
            // --- CASO 2: ADD_LOG (Comentários) ---
            else if (item.type === 'ADD_LOG') {
                const logData = item.payload;
                
                // Busca OS atual para não sobrescrever outros dados
                const currentOS = await syncApiCall(`/api/os/${item.osId}?_t=${Date.now()}`, 'GET');
                
                if (currentOS) {
                    const currentLogs = Array.isArray(currentOS.logs) ? currentOS.logs : [];
                    
                    // Verifica duplicidade (caso já tenha sincronizado parcialmente)
                    const exists = currentLogs.some((l: any) => l.id === logData.id || (l.timestamp === logData.timestamp && l.comment === logData.comment));
                    
                    if (!exists) {
                        const newLogs = [logData, ...currentLogs];
                        const payloadOS = { 
                            ...currentOS, 
                            logs: newLogs, 
                            updatedAt: new Date().toISOString() 
                        };
                        await syncApiCall(`/api/os/${item.osId}`, 'PUT', payloadOS);
                        console.log(`📝 [SYNC] Log adicionado à OS ${item.osId}`);
                    }
                }
            }

            // --- CASO 3: UPLOAD_IMAGE ---
            else if (item.type === 'UPLOAD_IMAGE') {
                const attachment = item.payload?.attachment || item.payload;
                const attId = (attachment?.id || '').toString();
                const attUrl = normalizeUrl(attachment?.url);
                const attFileName = (attachment?.fileName || '').toString();
                const attFilenameFromUrl = extractFilenameFromUrl(attachment?.url);

                // Verifica se esta imagem está marcada para deleção
                const isMarkedDeleted =
                    (attId && deletedKeys.has(makeDeleteKey(item.osId, `id:${attId}`))) ||
                    (attUrl && deletedKeys.has(makeDeleteKey(item.osId, `url:${attUrl}`))) ||
                    (attFileName && deletedKeys.has(makeDeleteKey(item.osId, `fileName:${attFileName}`))) ||
                    (attFilenameFromUrl && deletedKeys.has(makeDeleteKey(item.osId, `filename:${attFilenameFromUrl}`)));

                if (isMarkedDeleted) {
                    console.log(`🧹 [SYNC] Cancelando upload (foi deletada offline): ${attFileName}`);
                    await removeFromQueue(item.id); // Remove da fila sem enviar
                    processedCount++;
                    continue;
                }

                if (!attachment?.url) {
                    await removeFromQueue(item.id);
                    processedCount++;
                    continue;
                }

                const currentOS = await syncApiCall(`/api/os/${item.osId}?_t=${Date.now()}`, 'GET');
                if (!currentOS) break; // Se falhou GET, para tudo

                const newAtt = {
                    ...attachment,
                    id: attachment.id || `img-${Date.now()}`,
                    uploadedAt: new Date().toISOString(),
                };

                const payloadOS = {
                    ...currentOS,
                    imageAttachments: [newAtt, ...(currentOS.imageAttachments || [])],
                    updatedAt: new Date().toISOString(),
                };

                await syncApiCall(`/api/os/${item.osId}`, 'PUT', payloadOS);
            }

            // --- CASO 4: DELETE_IMAGE ---
            else if (item.type === 'DELETE_IMAGE') {
                const p = item.payload || {};
                const wantedId = (p.attachmentId || p.id || '').toString();
                const wantedUrl = normalizeUrl(p.url);
                const wantedFileName = (p.fileName || '').toString();
                const wantedFilenameFromUrl = extractFilenameFromUrl(p.url);

                const currentOS = await syncApiCall(`/api/os/${item.osId}?_t=${Date.now()}`, 'GET');
                if (!currentOS) break;

                const before = Array.isArray(currentOS.imageAttachments) ? currentOS.imageAttachments : [];

                // Filtra removendo match por qualquer critério (ID, URL, Nome)
                const after = before.filter((a: any) => {
                    const aId = (a?.id || '').toString();
                    const aUrl = normalizeUrl(a?.url);
                    const aFileName = (a?.fileName || '').toString();
                    const aFilenameFromUrl = extractFilenameFromUrl(a?.url);

                    const matchById = wantedId && aId === wantedId;
                    const matchByUrl = wantedUrl && aUrl === wantedUrl;
                    const matchByFileName = wantedFileName && aFileName === wantedFileName;
                    const matchByFilenameFromUrl = wantedFilenameFromUrl && aFilenameFromUrl === wantedFilenameFromUrl;

                    return !(matchById || matchByUrl || matchByFileName || matchByFilenameFromUrl);
                });

                if (after.length !== before.length) {
                    const payloadOS = {
                        ...currentOS,
                        imageAttachments: after,
                        updatedAt: new Date().toISOString(),
                    };
                    await syncApiCall(`/api/os/${item.osId}`, 'PUT', payloadOS);
                    console.log(`🗑️ [SYNC] Imagem deletada: ${before.length} -> ${after.length}`);
                } else {
                    console.log(`⚠️ [SYNC] Imagem para deletar não encontrada (já removida?): ${wantedId || wantedFileName}`);
                }
            }

            // --- SUCESSO DO ITEM ---
            await removeFromQueue(item.id);
            processedCount++;

        } catch (err: any) {
            // 🔥 TRATAMENTO DE ERRO CRÍTICO (LOOP 404 - ANTI-ZUMBI)
            if (err.message === "404_NOT_FOUND" || (err.message && err.message.includes("404"))) {
                console.warn(`🛑 [SYNC] OS ${item.osId} não existe mais no servidor. Removendo ação órfã da fila.`);
                await removeFromQueue(item.id); // Remove item "podre"
                processedCount++;
            } else {
                console.error(`❌ [SYNC] Erro temporário no item ${item.id}:`, err);
                // Não remove da fila, mantém para próxima tentativa (erro de rede/500)
                setBackendOnline(false);
            }
        }
      }

      // C. FINALIZAÇÃO
      const remaining = await getQueue();
      setQueueLength(remaining.length);

      if (processedCount > 0) {
        await reloadFromAPI();
        console.log(`✅ [SYNC] Ciclo concluído. Processados: ${processedCount}. Restantes: ${remaining.length}`);
      }

    } catch (error) {
      console.error('❌ [SYNC] Falha fatal no ciclo:', error);
      setBackendOnline(false);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, pingBackend, reloadFromAPI, syncApiCall]);

  // ---------------------------------------------------------------------------
  // 4. EFEITOS E INIT
  // ---------------------------------------------------------------------------
  
  // Heartbeat (Monitoramento periódico)
  useEffect(() => {
    const heartbeat = setInterval(async () => {
      setDeviceOnline(navigator.onLine);
      if (navigator.onLine) await pingBackend(false);

      const q = await getQueue();
      setQueueLength(q.length);

      if (navigator.onLine && !isSyncing) {
        const ok = await pingBackend(false);
        if (ok && q.length > 0) processQueue();
      }
    }, 8000); // 8 segundos

    return () => clearInterval(heartbeat);
  }, [isSyncing, pingBackend, processQueue]);

  // Inicialização e Listeners
  useEffect(() => {
    initDB().then(async () => {
      const q = await getQueue();
      setQueueLength(q.length);
      if (navigator.onLine) {
        const ok = await pingBackend(true);
        if (ok && q.length > 0) setTimeout(processQueue, 1000);
      }
    });

    const handleOnline = async () => {
      setDeviceOnline(true);
      const ok = await pingBackend(true);
      if (ok) setTimeout(processQueue, 1500);
    };

    const handleOffline = () => {
      setDeviceOnline(false);
      setBackendOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pingBackend, processQueue]);

  // Função exposta para salvar ação
  const saveOfflineAction = useCallback(async (type: OfflineActionType, osId: string, payload: any) => {
    // Otimização: Se for deletar e houver upload pendente, cancela o upload imediatamente
    if (type === 'DELETE_IMAGE') {
        const q = await getQueue();
        const pendingUpload = q.find(i => i.type === 'UPLOAD_IMAGE' && i.payload.attachment?.id === payload.attachmentId);
        
        if (pendingUpload && pendingUpload.id) {
            console.log(`⚡ [OFFLINE] Cancelando upload pendente (delete imediato)`);
            await removeFromQueue(pendingUpload.id);
            setQueueLength((await getQueue()).length);
            return;
        }
    }
    
    await addToQueue(type, osId, payload);
    const q = await getQueue();
    setQueueLength(q.length);
  }, []);

  const forceSync = useCallback(async () => {
    if (!navigator.onLine) return;
    const ok = await pingBackend(true);
    if (!ok) return;
    await processQueue();
  }, [pingBackend, processQueue]);

  const value = useMemo(
    () => ({
      isOnline,
      deviceOnline,
      backendOnline,
      queueLength,
      saveOfflineAction,
      forceSync,
    }),
    [isOnline, deviceOnline, backendOnline, queueLength, saveOfflineAction, forceSync]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
};