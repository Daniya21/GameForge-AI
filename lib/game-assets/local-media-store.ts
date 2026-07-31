"use client";

const DB_NAME = "gameforge-local-media";
const DB_VERSION = 1;
const STORE_NAME = "media";
const MEDIA_PREFIX = "gameforge-media://";
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;

export type LocalMediaRecord = {
  id: string;
  blob: Blob;
  mimeType: string;
  byteSize: number;
  label?: string;
  role?: string;
  storedAt: string;
};

const pendingWrites = new Map<string, Promise<void>>();

function supportsIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!supportsIndexedDb()) {
    return Promise.reject(new Error("This browser cannot store generated GameForge images."));
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
    request.onerror = () => reject(request.error || new Error("Could not open the GameForge image library."));
  });
}

function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The GameForge image operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("The GameForge image transaction failed."));
    };
  }));
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\r\n]+)$/i.exec(dataUrl);
  if (!match) throw new Error("Only PNG, JPEG, and WebP image data can be stored.");
  const mimeType = match[1].toLowerCase();
  const binary = window.atob(match[2].replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (!bytes.byteLength) throw new Error("The generated image is empty.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("The generated image is too large to store locally.");
  return { blob: new Blob([bytes], { type: mimeType }), mimeType, byteSize: bytes.byteLength };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Could not read the stored GameForge image."));
    reader.readAsDataURL(blob);
  });
}

export function projectMediaUrl(mediaId: string) {
  return `${MEDIA_PREFIX}${encodeURIComponent(mediaId)}`;
}

export function projectMediaIdFromUrl(value: string) {
  if (!value.startsWith(MEDIA_PREFIX)) return "";
  try {
    return decodeURIComponent(value.slice(MEDIA_PREFIX.length));
  } catch {
    return "";
  }
}

export function isProjectMediaUrl(value?: string | null) {
  return Boolean(value?.startsWith(MEDIA_PREFIX));
}

export function queueProjectMediaDataUrl(
  mediaId: string,
  dataUrl: string,
  metadata?: { label?: string; role?: string },
) {
  if (!mediaId || !dataUrl) return Promise.resolve();
  const existing = pendingWrites.get(mediaId);
  if (existing) return existing;

  const promise = (async () => {
    const parsed = parseDataUrl(dataUrl);
    const record: LocalMediaRecord = {
      id: mediaId,
      ...parsed,
      label: metadata?.label,
      role: metadata?.role,
      storedAt: new Date().toISOString(),
    };
    await transact("readwrite", (store) => store.put(record));
  })();

  pendingWrites.set(mediaId, promise);
  void promise.finally(() => pendingWrites.delete(mediaId));
  return promise;
}

export async function getProjectMedia(mediaId: string): Promise<LocalMediaRecord | null> {
  const pending = pendingWrites.get(mediaId);
  if (pending) {
    try {
      await pending;
    } catch {
      return null;
    }
  }
  if (!mediaId) return null;
  const record = await transact<LocalMediaRecord | undefined>("readonly", (store) => store.get(mediaId));
  return record || null;
}

export async function resolveProjectMediaDataUrl(value?: string | null): Promise<string> {
  if (!value) return "";
  if (/^data:image\/(png|jpeg|webp);base64,/i.test(value)) return value;
  if (!isProjectMediaUrl(value)) return "";
  const record = await getProjectMedia(projectMediaIdFromUrl(value));
  return record?.blob ? blobToDataUrl(record.blob) : "";
}

export async function deleteProjectMedia(value: string) {
  const mediaId = isProjectMediaUrl(value) ? projectMediaIdFromUrl(value) : value;
  if (!mediaId) return;
  await transact("readwrite", (store) => store.delete(mediaId));
}
