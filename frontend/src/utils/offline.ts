// OPSBOARD — Offline draft storage via IndexedDB
// Handles local drafts when network is unavailable.
// Sync state is always explicit — never pretend local = confirmed.

import { LocalDraftIncident, LocalDraftOperation } from '../types'

const DB_NAME = 'opsboard_offline'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('draft_incidents')) {
        db.createObjectStore('draft_incidents', { keyPath: 'localId' })
      }
      if (!db.objectStoreNames.contains('draft_operations')) {
        db.createObjectStore('draft_operations', { keyPath: 'localId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function put<T>(store: string, item: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function remove(store: string, key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Draft Incidents ──────────────────────────────────────────────────────────

export const draftIncidents = {
  save: (draft: LocalDraftIncident) => put('draft_incidents', draft),
  getAll: () => getAll<LocalDraftIncident>('draft_incidents'),
  delete: (localId: string) => remove('draft_incidents', localId),
}

// ─── Draft Operations ─────────────────────────────────────────────────────────

export const draftOperations = {
  save: (draft: LocalDraftOperation) => put('draft_operations', draft),
  getAll: () => getAll<LocalDraftOperation>('draft_operations'),
  delete: (localId: string) => remove('draft_operations', localId),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function isOnline(): boolean {
  return navigator.onLine
}
