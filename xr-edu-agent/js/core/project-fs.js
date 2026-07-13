// ═══════════════════════════════════════════════════════════════
//  项目文件夹存储(File System Access API)

const DB_NAME = 'xr-edu-project-fs';
const DB_VER = 1;
const HANDLE_KEY = 'projects-dir';
export const FILE_EXT = '.xrscene';
const SCENE_MAGIC = 'XR-EDU-SCENE';

let dirHandle = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadPersistedHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export function fsSupported() {
  return typeof window.showDirectoryPicker === 'function';
}

export function getConnectedFolderName() {
  return dirHandle?.name || null;
}

export function isFolderConnected() {
  return !!dirHandle;
}

async function ensurePermission(handle, mode = 'readwrite') {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

// 文件名安全化(保留中文/字母/数字,其余变连字符)
export function safeFilename(name, id) {
  const base = (name || 'project').trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'project';
  return `${base}${FILE_EXT}`;
}

// 若重名则追加 (1)(2)…
async function fileExists(dir, name) {
  try { await dir.getFileHandle(name); return true; }
  catch (e) { if (e.name === 'NotFoundError') return false; throw e; }
}

async function uniqueName(dir, baseName, skipFilename = null) {
  let candidate = safeFilename(baseName, '');
  if (skipFilename === candidate || !(await fileExists(dir, candidate))) return candidate;
  const stem = baseName.trim().slice(0, 80) || 'project';
  let n = 1;
  while (n < 200) {
    candidate = `${stem} (${n})${FILE_EXT}`;
    if (skipFilename === candidate || !(await fileExists(dir, candidate))) return candidate;
    n++;
  }
  return `project-${Date.now()}${FILE_EXT}`;
}

export async function connectFolder() {
  if (!fsSupported()) throw new Error('UNSUPPORTED');
  const picked = await window.showDirectoryPicker({ mode: 'readwrite' });
  if (!(await ensurePermission(picked))) throw new Error('DENIED');
  dirHandle = picked;
  await persistHandle(picked);
  return picked.name;
}

export async function tryReconnectFolder() {
  if (!fsSupported()) return false;
  try {
    const handle = await loadPersistedHandle();
    if (!handle) return false;
    if (!(await ensurePermission(handle))) return false;
    dirHandle = handle;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectFolder() {
  dirHandle = null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readFileEntry(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  const data = JSON.parse(text);
  if (data.magic !== SCENE_MAGIC) throw new Error('bad magic');
  const meta = data._file || {};
  return {
    id: meta.id || handle.name,
    name: data.name || handle.name.replace(/\.xrscene$/i, ''),
    createdAt: meta.createdAt || file.lastModified,
    updatedAt: meta.updatedAt || file.lastModified,
    objects: meta.objects ?? (data.scene?.object?.children?.length || 0),
    data,
    _handle: handle,
    _filename: handle.name,
  };
}

export async function listFolderProjects() {
  if (!dirHandle) return [];
  const out = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== 'file' || !name.toLowerCase().endsWith(FILE_EXT)) continue;
    try {
      out.push(await readFileEntry(handle));
    } catch (e) {
      console.warn('[project-fs] skip', name, e);
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getFolderProject(id) {
  const all = await listFolderProjects();
  return all.find(p => p.id === id) || null;
}

export async function writeFolderProject(proj) {
  if (!dirHandle) throw new Error('NO_FOLDER');
  const payload = {
    ...proj.data,
    _file: {
      id: proj.id,
      createdAt: proj.createdAt,
      updatedAt: proj.updatedAt,
      objects: proj.objects,
    },
  };
  const json = JSON.stringify(payload);
  let filename = proj._filename;
  if (!filename) filename = await uniqueName(dirHandle, proj.name);
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(json);
  await writable.close();
  proj._filename = filename;
  proj._handle = fh;
  return proj;
}

export async function deleteFolderProject(proj) {
  if (!dirHandle || !proj._filename) return;
  await dirHandle.removeEntry(proj._filename);
}

export async function renameFolderProject(proj, newName) {
  if (!dirHandle) return proj;
  const newFilename = await uniqueName(dirHandle, newName, proj._filename);
  if (newFilename === proj._filename) {
    proj.name = newName;
    if (proj.data) proj.data.name = newName;
    return writeFolderProject(proj);
  }
  // 写新文件 + 删旧文件
  const oldFile = proj._filename;
  proj._filename = newFilename;
  proj.name = newName;
  if (proj.data) proj.data.name = newName;
  await writeFolderProject(proj);
  if (oldFile && oldFile !== newFilename) {
    try { await dirHandle.removeEntry(oldFile); } catch { /* ignore */ }
  }
  return proj;
}

// 复制 = 新 id + 新文件名
export async function copyFolderProject(src) {
  const all = await listFolderProjects();
  const base = src.name.replace(/ \(\d+\)$/, '');
  const used = new Set(all.map(p => p.name));
  let n = 1;
  while (used.has(`${base} (${n})`)) n++;
  const name = `${base} (${n})`;
  const now = Date.now();
  const dup = {
    id: 'p' + now.toString(36),
    name,
    createdAt: now,
    updatedAt: now,
    objects: src.objects,
    data: JSON.parse(JSON.stringify(src.data)),
    _filename: null,
    _handle: null,
  };
  if (dup.data) dup.data.name = name;
  return writeFolderProject(dup);
}
