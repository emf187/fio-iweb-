const DB_NAME = 'fio-web'
const STORE = 'kv'
const PHOTO_STORE = 'photos'
const KEY = 'state'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      if (!req.result.objectStoreNames.contains(PHOTO_STORE)) req.result.createObjectStore(PHOTO_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function readDoc<T>(): Promise<T | null> {
  try {
    const db = await openDb()
    const value = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return value
  } catch {
    return null
  }
}

export async function writeDoc(doc: unknown): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(doc, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* storage is best-effort; the UI keeps working in memory */
  }
}

export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function estimateStorage(): Promise<string | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const { usage } = await navigator.storage.estimate()
    if (!usage) return null
    return usage > 1024 * 1024 ? `${(usage / 1024 / 1024).toFixed(1)} MB` : `${Math.round(usage / 1024)} KB`
  } catch {
    return null
  }
}

// ------------------------------------------------------- photo blobs (files)

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite')
      tx.objectStore(PHOTO_STORE).put(blob, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* photo storage is best-effort */
  }
}

export async function getPhoto(id: string): Promise<Blob | null> {
  try {
    const db = await openDb()
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly')
      const req = tx.objectStore(PHOTO_STORE).get(id)
      req.onsuccess = () => resolve((req.result as Blob) ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return blob
  } catch {
    return null
  }
}

export async function deletePhoto(id: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite')
      tx.objectStore(PHOTO_STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* ignore */
  }
}
