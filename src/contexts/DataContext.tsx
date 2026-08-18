// File: /contexts/DataContext.tsx
//
// Contexto global para gerenciamento de estado da aplicação.
//
// ✅ Correções deste patch:
// 1) addOS e addOSBatch agora RESPEITAM o 'subtasksStatus' vindo do formulário.
//    (Antes estava subtasksStatus: [], o que apagava o checklist ao salvar).
// 2) Mantém as correções anteriores de Ping e Arrays de Planos.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';

import {
  OS,
  User,
  Plant,
  Notification,
  OSLog,
  ImageAttachment,
  Role,
  TaskTemplate,
  PlantMaintenancePlan,
} from '../types';

import { API_BASE } from '../components/utils/config';

interface AssignmentsDTO {
  coordinatorId: string | null;
  supervisorIds: string[];
  technicianIds: string[];
  assistantIds: string[];
}

type AnyRecord = Record<string, any>;

interface DataContextType {
  users: User[];
  plants: Plant[];
  osList: OS[];
  notifications: Notification[];
  taskTemplates: TaskTemplate[];
  maintenancePlans: Record<string, PlantMaintenancePlan[]>;

  setAuthHeaders: (h: Record<string, string>) => void;

  reloadFromAPI: () => Promise<void>;
  clearData: () => void;
  loadUserData: () => Promise<void>;

  addUser: (user: Omit<User, 'id'>) => Promise<User>;
  updateUser: (user: User) => Promise<User>;
  deleteUser: (id: string) => Promise<void>;

  addPlant: (plant: Omit<Plant, 'id'>, assignments?: AssignmentsDTO) => Promise<Plant>;
  updatePlant: (plant: Plant, assignments?: AssignmentsDTO) => Promise<void>;
  deletePlant: (id: string) => Promise<void>;

  addOS: (osData: Omit<OS, 'id' | 'title' | 'createdAt' | 'updatedAt' | 'logs' | 'imageAttachments'>) => Promise<void>;
  addOSBatch: (osDataList: any[]) => Promise<void>;
  updateOS: (os: OS) => Promise<void>;
  patchOS: (osId: string, updates: Partial<OS>) => Promise<void>;
  deleteOSBatch: (ids: string[]) => Promise<void>;

  addOSLog: (osId: string, log: Omit<OSLog, 'id' | 'timestamp'>) => void;

  addOSAttachment: (osId: string, attachment: Omit<ImageAttachment, 'id' | 'uploadedAt'>) => Promise<void>;
  uploadOSAttachments: (osId: string, files: File[], caption: string) => Promise<void>;
  deleteOSAttachment: (osId: string, attachmentId: string) => Promise<void>;

  markNotificationAsRead: (notificationId: string) => void;

  filterOSForUser: (u: User) => OS[];

  fetchTaskTemplates: (category?: string) => Promise<void>;
  fetchPlantPlan: (plantId: string) => Promise<PlantMaintenancePlan[] | null>;
  initializePlantPlan: (plantId: string, mode: string, customTasks?: any[]) => Promise<void>;
  updatePlantTask: (taskId: string, data: Partial<PlantMaintenancePlan>) => Promise<void>;
  createPlantTask: (plantId: string, data: any) => Promise<void>;
  deletePlantTask: (taskId: string) => Promise<void>;

  addTemplate: (data: any) => Promise<void>;
  updateTemplate: (id: string, data: any) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// LocalStorage helper com fallback
// -----------------------------------------------------------------------------
function useLocalStorageState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: React.SetStateAction<T>) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch (error) {
          console.warn(`[LocalStorage] Falha ao salvar '${key}': limite excedido.`);
        }
        return next;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}

// -----------------------------------------------------------------------------
// Helpers de normalização
// -----------------------------------------------------------------------------
const normalizePlant = (p: any): Plant => {
  const rawSubPlants = Array.isArray(p?.subPlants) ? p.subPlants : [];
  const normalizedSubPlants = rawSubPlants.map((sp: any) => ({
    id: sp.id || crypto.randomUUID(),
    name: sp.name || 'Subusina',
    inverterCount: Number(sp.inverterCount) || 0,
    inverterStartIndex: sp.inverterStartIndex !== undefined ? Number(sp.inverterStartIndex) : 1,
    trackersPerInverter: Number(sp.trackersPerInverter) || 0,
    stringsPerInverter: Number(sp.stringsPerInverter) || 0,
  }));

  return {
    ...p,
    coordinatorId: p?.coordinatorId ?? null,
    supervisorIds: Array.isArray(p?.supervisorIds) ? p.supervisorIds : [],
    technicianIds: Array.isArray(p?.technicianIds) ? p.technicianIds : [],
    assistantIds: Array.isArray(p?.assistantIds) ? p.assistantIds : [],
    subPlants: normalizedSubPlants,
    assets: Array.isArray(p?.assets) ? p.assets : [],
  };
};

const normalizeOS = (o: any): OS => ({
  ...o,
  assistantId: o.assistantId || '',
  subPlantId: o.subPlantId || '',
  inverterId: o.inverterId || '',
  logs: Array.isArray(o.logs) ? o.logs : [],
  imageAttachments: Array.isArray(o.imageAttachments) ? o.imageAttachments : [],
  subtasksStatus: Array.isArray(o.subtasksStatus) ? o.subtasksStatus : [],
  executionHistory: Array.isArray(o.executionHistory) ? o.executionHistory : [],
});

// -----------------------------------------------------------------------------
// Fetch com timeout
// -----------------------------------------------------------------------------
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

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useLocalStorageState<Notification[]>('notifications', []);
  const [users, setUsers] = useLocalStorageState<User[]>('users', []);
  const [plants, setPlants] = useLocalStorageState<Plant[]>('plants', []);
  const [osList, setOsList] = useLocalStorageState<OS[]>('osList', []);

  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [maintenancePlans, setMaintenancePlans] = useState<Record<string, PlantMaintenancePlan[]>>({});

  const headersRef = useRef<Record<string, string>>({});
  const osListRef = useRef<OS[]>(osList);
  useEffect(() => { osListRef.current = osList; }, [osList]);
  const plantsRef = useRef<Plant[]>(plants);
  useEffect(() => { plantsRef.current = plants; }, [plants]);

  const pingCacheRef = useRef<{ ok: boolean; at: number }>({ ok: false, at: 0 });

  const pingBackend = useCallback(
    async (force = false): Promise<boolean> => {
      if (!navigator.onLine) {
        pingCacheRef.current = { ok: false, at: Date.now() };
        return false;
      }
      const now = Date.now();
      const ageMs = now - (pingCacheRef.current.at || 0);
      if (!force && ageMs < 5000) return pingCacheRef.current.ok;

      try {
        const safePath = `/api/os?_ping=${now}`;
        const url = `${API_BASE}${safePath}`;
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          ...headersRef.current,
        };

        const res = await fetchWithTimeout(url, { method: 'GET', headers }, 3000);
        const ok = res.ok;
        pingCacheRef.current = { ok, at: now };
        return ok;
      } catch {
        pingCacheRef.current = { ok: false, at: now };
        return false;
      }
    },
    []
  );

  const api = useCallback((path: string, init?: RequestInit) => {
    const safePath = path.startsWith('/') ? path : `/${path}`;
    const url = safePath.startsWith('http') ? safePath : `${API_BASE}${safePath}`;
    const defaultHeaders: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const headers = { ...defaultHeaders, ...(init?.headers || {}), ...headersRef.current };
    return fetch(url, { ...init, headers });
  }, []);

  const setAuthHeaders = useCallback((h: Record<string, string>) => {
    headersRef.current = { ...headersRef.current, ...h };
  }, []);

  const loadUserData = useCallback(async () => { return; }, []);

  const clearData = useCallback(() => {
    setUsers([]);
    setPlants([]);
    setOsList([]);
    setNotifications([]);
    setTaskTemplates([]);
    setMaintenancePlans({});
  }, [setNotifications, setOsList, setPlants, setUsers]);

  const toArray = (x: any): any[] => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);

  const reloadFromAPI = useCallback(async () => {
    const ok = await pingBackend(false);
    if (!ok) {
      console.warn('⚠️ reloadFromAPI abortado: backend offline.');
      return;
    }

    try {
      const [u, p, o, n] = await Promise.all([
        api('/api/users').then((r) => (r.ok ? r.json() : [])),
        api('/api/plants').then((r) => (r.ok ? r.json() : [])),
        api('/api/os').then((r) => (r.ok ? r.json() : [])),
        api('/api/notifications').then((r) => (r.ok ? r.json() : [])),
      ]);

      const U = toArray(u);
      const P = toArray(p).map(normalizePlant);
      const rawO = toArray(o);
      const N = toArray(n);

      if (U.length) setUsers(U);
      if (P.length) setPlants(P);

      setOsList((currentLocalList) => {
        if (rawO.length === 0 && currentLocalList.length > 0) return currentLocalList;
        const currentMap = new Map(currentLocalList.map((item) => [item.id, item]));
        const merged = rawO.map((apiItem) => {
          const normalized = normalizeOS(apiItem);
          const localItem = currentMap.get(apiItem.id);
          if (localItem) {
            if (!normalized.assistantId && localItem.assistantId) normalized.assistantId = localItem.assistantId;
            if (!normalized.subPlantId && localItem.subPlantId) normalized.subPlantId = localItem.subPlantId;
            if (!normalized.inverterId && localItem.inverterId) normalized.inverterId = localItem.inverterId;
            if ((normalized.imageAttachments || []).length === 0 && (localItem.imageAttachments || []).length > 0) {
              normalized.imageAttachments = localItem.imageAttachments;
            }
            if ((normalized.executionHistory || []).length === 0 && (localItem.executionHistory || []).length > 0) {
              normalized.executionHistory = localItem.executionHistory;
            }
          }
          return normalized;
        });
        return merged;
      });

      setNotifications((currentNotifs) => {
        const apiNotifs = N as Notification[];
        const combined = [...currentNotifs, ...apiNotifs].reduce((acc, curr) => {
          if (!acc.find((x) => x.id === curr.id)) acc.push(curr);
          return acc;
        }, [] as Notification[]);
        return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });
    } catch (err) {
      console.error('❌ Erro em reloadFromAPI:', err);
    }
  }, [api, pingBackend, setNotifications, setOsList, setPlants, setUsers]);

  const mergeSubPlantData = (savedPlant: any, localPlant: Partial<Plant>) => {
    if (!savedPlant?.subPlants || !localPlant?.subPlants) return savedPlant;
    savedPlant.subPlants = savedPlant.subPlants.map((sp: any) => {
      const original = localPlant.subPlants!.find(
        (osp: any) => osp.id === sp.id || (osp.name === sp.name && osp.inverterCount === sp.inverterCount)
      );
      if (original && sp.inverterStartIndex === undefined && original.inverterStartIndex !== undefined) {
        sp.inverterStartIndex = original.inverterStartIndex;
      }
      return sp;
    });
    return savedPlant;
  };

  const mergeOSData = (savedOS: OS, localOS: OS) => {
    if (!savedOS.assistantId && localOS.assistantId) savedOS.assistantId = localOS.assistantId;
    if (!savedOS.subPlantId && localOS.subPlantId) savedOS.subPlantId = localOS.subPlantId;
    if (!savedOS.inverterId && localOS.inverterId) savedOS.inverterId = localOS.inverterId;
    return savedOS;
  };

  const pushNotification = useCallback(async (userId: string, message: string) => {
      if (!userId) return;
      const notif: Notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        message,
        read: false,
        timestamp: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);
      try {
        const ok = await pingBackend(false);
        if (!ok) return;
        await api('/api/notifications', { method: 'POST', body: JSON.stringify(notif) });
      } catch (e) {
        console.error('Falha ao salvar notificação no backend (mantida local)', e);
      }
    }, [api, pingBackend, setNotifications]
  );

  // ---------------------------------------------------------------------------
  // Maintenance/Templates
  // ---------------------------------------------------------------------------
  const fetchTaskTemplates = useCallback(async (category?: string) => {
      let url = '/api/maintenance/templates';
      if (category) url += `?asset_category=${encodeURIComponent(category)}`;
      try {
        const res = await api(url);
        if (res.ok) setTaskTemplates(await res.json());
      } catch (e) { console.error(e); }
    }, [api]
  );

  const fetchPlantPlan = useCallback(async (plantId: string): Promise<PlantMaintenancePlan[] | null> => {
      try {
        const res = await api(`/api/maintenance/plant-plans/${plantId}`);
        if (res.ok) {
          const data = (await res.json()) as PlantMaintenancePlan[];
          setMaintenancePlans((prev) => ({ ...prev, [plantId]: data }));
          return data;
        }
        return null;
      } catch (e) {
        console.error("Erro ao buscar planos:", e);
        return null;
      }
    }, [api]
  );

  const initializePlantPlan = useCallback(async (plantId: string, mode: string, customTasks: any[] = []) => {
      const ok = await pingBackend(false);
      if (!ok) return;
      await api(`/api/maintenance/plant-plans/${plantId}/init`, {
        method: 'POST',
        body: JSON.stringify({ mode, custom_tasks: customTasks }),
      });
      await fetchPlantPlan(plantId);
      await reloadFromAPI();
    }, [api, fetchPlantPlan, pingBackend, reloadFromAPI]
  );

  const updatePlantTask = useCallback(async (taskId: string, data: Partial<PlantMaintenancePlan>) => {
      const ok = await pingBackend(false);
      if (!ok) return;
      await api(`/api/maintenance/plant-plans/${taskId}`, { method: 'PUT', body: JSON.stringify(data) });
    }, [api, pingBackend]
  );

  const createPlantTask = useCallback(async (plantId: string, data: any) => {
      const ok = await pingBackend(false);
      if (!ok) return;
      await api(`/api/maintenance/plant-plans/${plantId}`, { method: 'POST', body: JSON.stringify(data) });
      await fetchPlantPlan(plantId);
    }, [api, fetchPlantPlan, pingBackend]
  );

  const deletePlantTask = useCallback(async (taskId: string) => {
      const ok = await pingBackend(false);
      if (!ok) return;
      const res = await api(`/api/maintenance/plant-plans/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao deletar tarefa.');
    }, [api, pingBackend]
  );

  const addTemplate = useCallback(async (data: any) => {
      const ok = await pingBackend(false);
      if (!ok) return;
      await api('/api/maintenance/templates', { method: 'POST', body: JSON.stringify(data) });
      await fetchTaskTemplates();
    }, [api, fetchTaskTemplates, pingBackend]
  );

  const updateTemplate = useCallback(async (id: string, data: any) => {
      const ok = await pingBackend(false);
      if (!ok) return;
      await api(`/api/maintenance/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      await fetchTaskTemplates();
    }, [api, fetchTaskTemplates, pingBackend]
  );

  const deleteTemplate = useCallback(async (id: string) => {
      const ok = await pingBackend(false);
      if (!ok) return;
      await api(`/api/maintenance/templates/${id}`, { method: 'DELETE' });
      await fetchTaskTemplates();
    }, [api, fetchTaskTemplates, pingBackend]
  );

  // ---------------------------------------------------------------------------
  // Filtro de OS
  // ---------------------------------------------------------------------------
  const filterOSForUser = useCallback((u: User): OS[] => {
      if ([Role.ADMIN, Role.OPERATOR].includes(u.role)) return osList;
      if (u.role === Role.TECHNICIAN || u.role === Role.ASSISTANT) {
        return osList.filter((o) => o.technicianId === u.id || o.assistantId === u.id);
      }
      if ([Role.CLIENT, Role.COORDINATOR, Role.SUPERVISOR].includes(u.role)) {
        const norm = u.name.trim().toLowerCase();
        return osList.filter((o) => {
          const p = plantsRef.current.find((pl) => pl.id === o.plantId);
          return (
            (p && u.plantIds && u.plantIds.includes(p.id)) ||
            (p && u.role === Role.CLIENT && (p as any).client?.trim?.().toLowerCase?.() === norm)
          );
        });
      }
      return [];
    }, [osList]
  );

  // ---------------------------------------------------------------------------
  // CRUD Users
  // ---------------------------------------------------------------------------
  const addUser = useCallback(async (u: Omit<User, 'id'>) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const res = await api('/api/users', { method: 'POST', body: JSON.stringify(u) });
      if (!res.ok) throw new Error('Erro ao criar usuário');
      const saved = (await res.json()) as User;
      setUsers((prev) => [...prev, saved]);
      return saved;
    }, [api, pingBackend, setUsers]
  );

  const updateUser = useCallback(async (u: User) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const res = await api(`/api/users/${u.id}`, { method: 'PUT', body: JSON.stringify(u) });
      if (!res.ok) throw new Error('Erro ao atualizar');
      const saved = (await res.json()) as User;
      setUsers((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      return saved;
    }, [api, pingBackend, setUsers]
  );

  const deleteUser = useCallback(async (id: string) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      await api(`/api/users/${id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((x) => x.id !== id));
    }, [api, pingBackend, setUsers]
  );

  // ---------------------------------------------------------------------------
  // CRUD Plants
  // ---------------------------------------------------------------------------
  const addPlant = useCallback(async (plant: Omit<Plant, 'id'>, assignments?: AssignmentsDTO) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const payload = { ...plant, ...(assignments || {}) };
      const res = await api('/api/plants', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Erro ao criar usina');
      let saved = await res.json();
      saved = mergeSubPlantData(saved, plant);
      const normalized = normalizePlant(saved);
      setPlants((prev) => [...prev, normalized]);
      return normalized;
    }, [api, pingBackend, setPlants]
  );

  const updatePlant = useCallback(async (plant: Plant, assignments?: AssignmentsDTO) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const payload = { ...plant, ...(assignments || {}) };
      const res = await api(`/api/plants/${plant.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Erro ao atualizar usina');
      let saved = await res.json();
      saved = mergeSubPlantData(saved, plant);
      const normalized = normalizePlant(saved);
      setPlants((prev) => prev.map((p) => (p.id === normalized.id ? normalized : p)));
    }, [api, pingBackend, setPlants]
  );

  const deletePlant = useCallback(async (id: string) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      await api(`/api/plants/${id}`, { method: 'DELETE' });
      setPlants((prev) => prev.filter((p) => p.id !== id));
    }, [api, pingBackend, setPlants]
  );

  // ---------------------------------------------------------------------------
  // CRUD OS (🔥 CORREÇÃO CRÍTICA AQUI 🔥)
  // ---------------------------------------------------------------------------
  const addOS = useCallback(async (osData: any) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const now = new Date().toISOString();
      const nextIdNumber = (osListRef.current.length > 0
          ? Math.max(...osListRef.current.map((os) => parseInt((os.id || '').replace(/\D/g, ''), 10) || 0))
          : 0) + 1;
      const newId = `OS${String(nextIdNumber).padStart(4, '0')}`;
      
      const payload: OS = {
        ...osData,
        id: newId,
        title: `${newId} - ${osData.activity}`,
        createdAt: now,
        updatedAt: now,
        attachmentsEnabled: true,
        logs: [],
        imageAttachments: [],
        // ✅ CORREÇÃO: Usa o checklist do form se existir, senão array vazio
        subtasksStatus: osData.subtasksStatus || [], 
        executionHistory: [],
        assistantId: osData.assistantId || '',
        subPlantId: osData.subPlantId || '',
        inverterId: osData.inverterId || '',
      };
      
      try {
        const res = await api('/api/os', { method: 'POST', body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('Erro ao criar OS');
        let saved = (await res.json()) as OS;
        saved = mergeOSData(saved, payload);
        setOsList((prev) => [saved, ...prev]);
        if (saved.technicianId) pushNotification(saved.technicianId, `Nova OS atribuída: ${saved.title}`);
        if (saved.assistantId) pushNotification(saved.assistantId, `Você foi definido como Auxiliar na OS: ${saved.title}`);
      } catch (e) { console.error(e); }
    }, [api, pingBackend, pushNotification, setOsList]
  );

  const addOSBatch = useCallback(async (osDataList: any[]) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const now = new Date().toISOString();
      const nextIdNumber = (osListRef.current.length > 0
          ? Math.max(...osListRef.current.map((os) => parseInt((os.id || '').replace(/\D/g, ''), 10) || 0))
          : 0) + 1;
      const batchPayload = osDataList.map((osData, index) => {
        const newId = `OS${String(nextIdNumber + index).padStart(4, '0')}`;
        return {
          ...osData,
          id: newId,
          title: `${newId} - ${osData.activity}`,
          createdAt: now,
          updatedAt: now,
          logs: [],
          imageAttachments: [],
          // ✅ CORREÇÃO TAMBÉM NO BATCH
          subtasksStatus: osData.subtasksStatus || [],
          executionHistory: [],
          assistantId: osData.assistantId || '',
        };
      });
      try {
        const res = await api('/api/os/batch', { method: 'POST', body: JSON.stringify(batchPayload) });
        if (!res.ok) throw new Error('Erro ao criar lote');
        await reloadFromAPI();
        batchPayload.forEach((os: any) => {
          if (os.technicianId) pushNotification(os.technicianId, `Nova OS atribuída: ${os.title}`);
        });
      } catch (e) {
        console.error('Erro Batch:', e);
        alert('Erro ao criar lote de OS.');
      }
    }, [api, pingBackend, pushNotification, reloadFromAPI]
  );

  const updateOS = useCallback(async (updatedOS: OS) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const oldOS = osListRef.current.find((o) => o.id === updatedOS.id);
      const hasTechChanged = !!oldOS && oldOS.technicianId !== updatedOS.technicianId;
      const hasAssistantChanged = !!oldOS && oldOS.assistantId !== updatedOS.assistantId;
      const res = await api(`/api/os/${updatedOS.id}`, { method: 'PUT', body: JSON.stringify(updatedOS) });
      if (!res.ok) throw new Error('Erro ao atualizar OS');
      let saved = (await res.json()) as OS;
      saved = mergeOSData(saved, updatedOS);
      setOsList((prev) => prev.map((os) => (os.id === saved.id ? saved : os)));
      if (hasTechChanged && saved.technicianId) pushNotification(saved.technicianId, `Você foi atribuído à OS: ${saved.title}`);
      if (hasAssistantChanged && saved.assistantId) pushNotification(saved.assistantId, `Você foi definido como Auxiliar na OS: ${saved.title}`);
    }, [api, pingBackend, pushNotification, setOsList]
  );

  const patchOS = useCallback(async (osId: string, updates: Partial<OS>) => {
      const updatedAt = new Date().toISOString();
      setOsList((prev) => prev.map((os) => (os.id === osId ? { ...os, ...updates, updatedAt } : os)));
      const ok = await pingBackend(false);
      if (!ok) {
        console.warn(`⚠️ patchOS: pulando PUT (backend offline). osId=${osId}`);
        return;
      }
      try {
        const currentOS = osListRef.current.find((o) => o.id === osId);
        if (!currentOS) return;
        const mergedOS = { ...currentOS, ...updates, updatedAt };
        await api(`/api/os/${osId}`, { method: 'PUT', body: JSON.stringify(mergedOS) });
      } catch (e) { console.error('Erro patchOS', e); }
    }, [api, pingBackend, setOsList]
  );

  const deleteOSBatch = useCallback(async (ids: string[]) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      await api('/api/os/batch', { method: 'DELETE', body: JSON.stringify(ids) });
      setOsList((prev) => prev.filter((os) => !ids.includes(os.id)));
    }, [api, pingBackend, setOsList]
  );

  const addOSLog = useCallback((osId: string, log: Omit<OSLog, 'id' | 'timestamp'>) => {
      const newLog: OSLog = { ...(log as AnyRecord), id: `log-${Date.now()}`, timestamp: new Date().toISOString() } as OSLog;
      setOsList((prev) => prev.map((os) => (os.id === osId ? { ...os, logs: [newLog, ...(os.logs || [])] } : os)));
    }, [setOsList]
  );

  const addOSAttachment = useCallback(async (osId: string, att: Omit<ImageAttachment, 'id' | 'uploadedAt'>) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const newAtt: ImageAttachment = { ...(att as AnyRecord), id: `img-${Date.now()}`, uploadedAt: new Date().toISOString() } as ImageAttachment;
      const freshListRes = await api('/api/os');
      if (!freshListRes.ok) throw new Error('Falha ao buscar OS list');
      const freshList = (await freshListRes.json()) as OS[];
      const currentOS = freshList.find((o) => o.id === osId);
      if (!currentOS) throw new Error('OS não encontrada no backend');
      const payload = { ...currentOS, imageAttachments: [newAtt, ...(currentOS.imageAttachments || [])], updatedAt: new Date().toISOString() };
      const res = await api(`/api/os/${osId}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Falha no upload');
      const savedOS = (await res.json()) as OS;
      setOsList((prev) => prev.map((os) => (os.id === osId ? savedOS : os)));
    }, [api, pingBackend, setOsList]
  );

  const uploadOSAttachments = useCallback(async (osId: string, files: File[], caption: string) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      const fd = new FormData();
      for (const f of files) fd.append('files', f, f.name);
      fd.append('caption', caption || 'Foto Geral');
      const token = localStorage.getItem('token');
      let userId = '';
      try {
        const u = localStorage.getItem('currentUser');
        if (u) userId = JSON.parse(u).id;
      } catch {}
      const headers: Record<string, string> = { Accept: 'application/json', 'x-user-id': userId || '', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const url = `${API_BASE}/api/os/${osId}/attachments`;
      const res = await fetch(url, { method: 'POST', headers, body: fd });
      if (!res.ok) throw new Error(await res.text());
      const savedOS = (await res.json()) as OS;
      setOsList((prev) => prev.map((o) => (o.id === osId ? savedOS : o)));
    }, [pingBackend, setOsList]
  );

  const deleteOSAttachment = useCallback(async (osId: string, attId: string) => {
      const ok = await pingBackend(false);
      if (!ok) throw new Error('Backend offline/unreachable');
      setOsList((prev) => prev.map((os) => os.id === osId ? { ...os, imageAttachments: (os.imageAttachments || []).filter((a) => a.id !== attId) } : os));
      const currentOS = osListRef.current.find((o) => o.id === osId);
      if (!currentOS) return;
      const newAttachments = (currentOS.imageAttachments || []).filter((a) => a.id !== attId);
      await api(`/api/os/${osId}`, { method: 'PUT', body: JSON.stringify({ ...currentOS, imageAttachments: newAttachments }) });
    }, [api, pingBackend, setOsList]
  );

  const markNotificationAsRead = useCallback((id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      pingBackend(false).then((ok) => {
        if (!ok) return;
        api(`/api/notifications/${id}/read`, { method: 'PUT' }).catch((e) => console.error(e));
      });
    }, [api, pingBackend, setNotifications]
  );

  const value = useMemo<DataContextType>(() => ({
      users, plants, osList, notifications, taskTemplates, maintenancePlans,
      setAuthHeaders, reloadFromAPI, clearData, loadUserData,
      addUser, updateUser, deleteUser,
      addPlant, updatePlant, deletePlant,
      addOS, addOSBatch, updateOS, patchOS, deleteOSBatch,
      addOSLog, addOSAttachment, uploadOSAttachments, deleteOSAttachment,
      markNotificationAsRead, filterOSForUser,
      fetchTaskTemplates, fetchPlantPlan, initializePlantPlan, updatePlantTask, createPlantTask, deletePlantTask,
      addTemplate, updateTemplate, deleteTemplate,
    }), [users, plants, osList, notifications, taskTemplates, maintenancePlans, setAuthHeaders, reloadFromAPI, clearData, loadUserData, addUser, updateUser, deleteUser, addPlant, updatePlant, deletePlant, addOS, addOSBatch, updateOS, patchOS, deleteOSBatch, addOSLog, addOSAttachment, deleteOSAttachment, markNotificationAsRead, filterOSForUser, fetchTaskTemplates, fetchPlantPlan, initializePlantPlan, updatePlantTask, createPlantTask, deletePlantTask, addTemplate, updateTemplate, deleteTemplate]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
};

export default DataContext;