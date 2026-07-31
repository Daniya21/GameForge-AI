"use client";

const DB_NAME = "gameforge-local-audio";
const DB_VERSION = 1;
const STORE = "audio";
const PREFIX = "gameforge-audio://";

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.reject(new Error("This browser cannot store generated audio."));
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open GameForge audio storage."));
  });
}

function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Audio storage operation failed."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Audio storage transaction failed.")); };
  }));
}

export function localAudioUrl(id: string) { return `${PREFIX}${encodeURIComponent(id)}`; }
export function isLocalAudioUrl(value?: string) { return Boolean(value?.startsWith(PREFIX)); }
function idFromUrl(value: string) { try { return decodeURIComponent(value.slice(PREFIX.length)); } catch { return ""; } }

export async function saveLocalAudio(id: string, blob: Blob) {
  if (!blob.size) throw new Error("The generated audio file is empty.");
  if (blob.size > 32 * 1024 * 1024) throw new Error("The generated audio file is too large.");
  await transaction("readwrite", (store) => store.put({ id, blob, mimeType: blob.type || "audio/mpeg", storedAt: new Date().toISOString() }));
  return localAudioUrl(id);
}

export async function resolveGameforgeAudioUrl(value: string): Promise<{ url: string; revoke: () => void }> {
  if (!isLocalAudioUrl(value)) return { url: value, revoke: () => undefined };
  const record = await transaction<{ blob?: Blob } | undefined>("readonly", (store) => store.get(idFromUrl(value)));
  if (!record?.blob) throw new Error("The generated audio is not available in this browser.");
  const url = URL.createObjectURL(record.blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
