import type { DailyRecord } from '../types';
import { normalizeMeals } from './storage';

const DB_NAME = 'calorie_manager_db';
const DB_VERSION = 1;
const STORE_NAME = 'daily_records';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'date' });
      }
    };
  });
}

export async function idbSaveRecord(record: DailyRecord): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetRecentRecords(days: number): Promise<DailyRecord[]> {
  const db = await openDB();
  const results: DailyRecord[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    const record = await new Promise<DailyRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(dateKey);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve((req.result as DailyRecord) ?? null);
    });
    if (record) results.push({ ...record, meals: normalizeMeals(record.meals), water: record.water ?? [] });
  }
  return results;
}

export async function idbGetRecord(date: string): Promise<DailyRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(date);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const r = req.result as DailyRecord | undefined;
      resolve(r ? { ...r, meals: normalizeMeals(r.meals), water: r.water ?? [] } : null);
    };
  });
}

export async function idbGetAllRecords(): Promise<DailyRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = (req.result as DailyRecord[]) ?? [];
      resolve(rows.map(r => ({ ...r, meals: normalizeMeals(r.meals), water: r.water ?? [] })));
    };
  });
}
