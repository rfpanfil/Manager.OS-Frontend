// File: services/offlineDb.ts
//
// Banco offline (IndexedDB via idb) para:
// - cache de OS ("os-data")
// - fila de sincronização ("sync-queue")
//
// IMPORTANTE:
// - A "sync-queue" guarda ações offline para serem replayadas quando voltar online.
// - O type inclui DELETE_IMAGE para permitir exclusão offline e sync posterior.

import { openDB, DBSchema } from 'idb';
import { OS } from '../types';

export type OfflineQueueActionType =
  | 'ADD_LOG'
  | 'UPDATE_STATUS'
  | 'UPLOAD_IMAGE'
  | 'DELETE_IMAGE';

export interface OfflineQueueItem {
  id?: number;
  type: OfflineQueueActionType;
  osId: string;
  payload: any;
  timestamp: number;
}

interface LoopOSDB extends DBSchema {
  'os-data': {
    key: string;
    value: OS;
  };
  'sync-queue': {
    key: number;
    value: OfflineQueueItem;
    indexes: { 'by-os': string };
  };
}

const DB_NAME = 'loopos-offline-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB<LoopOSDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Store de cache de OS
      if (!db.objectStoreNames.contains('os-data')) {
        db.createObjectStore('os-data', { keyPath: 'id' });
      }

      // Store da fila de sincronização
      if (!db.objectStoreNames.contains('sync-queue')) {
        const store = db.createObjectStore('sync-queue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-os', 'osId');
      }
    },
  });
};

export const cacheOSData = async (os: OS) => {
  const db = await initDB();
  await db.put('os-data', os);
};

export const addToQueue = async (
  type: OfflineQueueActionType,
  osId: string,
  payload: any
) => {
  const db = await initDB();
  await db.add('sync-queue', {
    type,
    osId,
    payload,
    timestamp: Date.now(),
  });
};

export const getQueue = async () => {
  const db = await initDB();
  return db.getAll('sync-queue');
};

export const removeFromQueue = async (id: number) => {
  const db = await initDB();
  await db.delete('sync-queue', id);
};
