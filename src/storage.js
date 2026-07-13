const DB_NAME = 'showtime-workspaces';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';
const LAST_WORKSPACE_KEY = 'showtime:last-workspace';
const PREFS_KEY = 'showtime:preferences';

function hasIndexedDB() {
  return typeof indexedDB !== 'undefined';
}

function openDatabase() {
  if (!hasIndexedDB()) return Promise.reject(new Error('当前环境不支持 IndexedDB'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('name', 'name');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本地工作区数据库'));
  });
}

async function transact(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本地工作区操作失败'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('本地工作区事务失败'));
  });
}

export async function saveWorkspace(workspace) {
  const record = typeof structuredClone === 'function' ? structuredClone(workspace) : JSON.parse(JSON.stringify(workspace));
  record.updatedAt = new Date().toISOString();
  await transact('readwrite', (store) => store.put(record));
  try { localStorage.setItem(LAST_WORKSPACE_KEY, record.id); } catch {}
  return record;
}

export function loadWorkspace(id) {
  return transact('readonly', (store) => store.get(id));
}

export async function listWorkspaces() {
  const records = await transact('readonly', (store) => store.getAll());
  return records
    .map(({ id, name, description, topic, updatedAt, createdAt, source, layers }) => ({
      id, name, description, topic, updatedAt, createdAt, source, layerCount: layers?.length || 0,
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function deleteWorkspace(id) {
  await transact('readwrite', (store) => store.delete(id));
  try {
    if (localStorage.getItem(LAST_WORKSPACE_KEY) === id) localStorage.removeItem(LAST_WORKSPACE_KEY);
  } catch {}
}

export async function loadLastWorkspace() {
  let id = '';
  try { id = localStorage.getItem(LAST_WORKSPACE_KEY) || ''; } catch {}
  if (id) {
    const workspace = await loadWorkspace(id);
    if (workspace) return workspace;
  }
  const recent = await listWorkspaces();
  return recent[0] ? loadWorkspace(recent[0].id) : null;
}

export function readPreferences() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}

export function writePreferences(preferences) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)); } catch {}
}

export function createAutosaver(options = {}) {
  let timer = null;
  let pending = null;
  const delay = options.delay || 700;
  const flush = async () => {
    clearTimeout(timer);
    timer = null;
    const workspace = pending;
    pending = null;
    if (!workspace) return null;
    try {
      const result = await saveWorkspace(workspace);
      options.onSaved?.(result);
      return result;
    } catch (error) {
      options.onError?.(error);
      return null;
    }
  };
  return {
    schedule(workspace) {
      pending = workspace;
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    cancel() {
      clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
