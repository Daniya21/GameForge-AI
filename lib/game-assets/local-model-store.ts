"use client";

const DB_NAME = "gameforge-local-assets";
const DB_VERSION = 1;
const STORE_NAME = "models";
const LOCAL_MODEL_PREFIX = "gameforge-local://";
const MAX_GLB_BYTES = 150 * 1024 * 1024;

type StoredLocalModel = {
  id: string;
  blob: Blob;
  fileName: string;
  fileSize: number;
  mimeType: string;
  role?: string;
  prompt?: string;
  importedAt: string;
};

export type LocalModelRecord = Omit<StoredLocalModel, "blob">;

function supportsIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!supportsIndexedDb()) {
    return Promise.reject(new Error("This browser cannot store local 3D models."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the local GameForge asset library."));
  });
}

function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The local GameForge asset operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("The local GameForge asset transaction failed."));
    };
  }));
}

async function hasGlbHeader(file: File) {
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return header.length === 4 && header[0] === 0x67 && header[1] === 0x6c && header[2] === 0x54 && header[3] === 0x46;
}

export function localModelUrl(assetId: string) {
  return `${LOCAL_MODEL_PREFIX}${encodeURIComponent(assetId)}`;
}

export function localModelIdFromUrl(url: string) {
  if (!url.startsWith(LOCAL_MODEL_PREFIX)) return "";
  try {
    return decodeURIComponent(url.slice(LOCAL_MODEL_PREFIX.length));
  } catch {
    return "";
  }
}

export function isLocalModelUrl(url?: string) {
  return Boolean(url?.startsWith(LOCAL_MODEL_PREFIX));
}

export async function saveLocalGlb(
  assetId: string,
  file: File,
  metadata?: { role?: string; prompt?: string },
): Promise<LocalModelRecord> {
  if (!assetId.trim()) throw new Error("The planned asset does not have a valid ID.");
  if (!file.name.toLowerCase().endsWith(".glb")) throw new Error("Export the Tripo Studio model as a .glb file before importing it.");
  if (!file.size) throw new Error("The selected GLB file is empty.");
  if (file.size > MAX_GLB_BYTES) throw new Error("The GLB is larger than 150 MB. Optimize or simplify it in Tripo Studio before importing.");
  if (!(await hasGlbHeader(file))) throw new Error("The selected file does not appear to be a valid binary GLB model.");

  const record: StoredLocalModel = {
    id: assetId,
    blob: file,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "model/gltf-binary",
    role: metadata?.role,
    prompt: metadata?.prompt,
    importedAt: new Date().toISOString(),
  };

  await transact("readwrite", (store) => store.put(record));
  const { blob: _blob, ...summary } = record;
  return summary;
}

export async function getLocalModel(assetId: string): Promise<StoredLocalModel | null> {
  if (!assetId) return null;
  const result = await transact<StoredLocalModel | undefined>("readonly", (store) => store.get(assetId));
  return result || null;
}

export async function deleteLocalModel(assetId: string) {
  await transact("readwrite", (store) => store.delete(assetId));
}

export async function resolveGameforgeModelUrl(url: string): Promise<{ url: string; revoke: () => void }> {
  if (!isLocalModelUrl(url)) return { url, revoke: () => undefined };
  const assetId = localModelIdFromUrl(url);
  const record = await getLocalModel(assetId);
  if (!record?.blob) throw new Error("The imported Studio GLB is not available in this browser. Import it again from the 3D Asset Pipeline.");
  const objectUrl = URL.createObjectURL(record.blob);
  return { url: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
}
