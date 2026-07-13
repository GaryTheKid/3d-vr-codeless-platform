// ═══════════════════════════════════════════════════════════════
//  左栏「📁 项目」Tab:项目列表(新建/打开/重命名/删除)+ HTML 导入入口
//  数据层在 core/projects.js;顶栏「💾 保存」也落到当前项目
//  可选:连接本地文件夹(.xrscene)替代 localStorage —— File System Access API
// ═══════════════════════════════════════════════════════════════
import { on } from '../core/events.js';
import { toast, escapeHtml } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { clearScene } from '../scene/manager.js';
import {
  listProjects, currentProjectId, getProject, saveToProject,
  openProject, deleteProject, renameProject, copyProject, importHTMLFile,
  storageMode, connectedFolderName, folderStorageSupported,
  connectProjectsFolder, disconnectProjectsFolder, initProjectStorage,
} from '../core/projects.js';

const listEl = document.getElementById('project-list');
const emptyEl = document.getElementById('project-empty');
const tabName = document.getElementById('scene-tab-name');
const storageNote = document.getElementById('proj-storage-note');
const folderBtn = document.getElementById('btn-proj-folder');

function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function updateStorageUI() {
  const mode = storageMode();
  const fname = connectedFolderName();
  if (mode === 'folder' && fname) {
    storageNote.textContent = t('proj.storageFolder', { name: fname });
    folderBtn.textContent = t('proj.disconnectFolder');
    folderBtn.title = t('proj.disconnectFolder');
  } else {
    storageNote.textContent = t('proj.storageBrowser');
    folderBtn.textContent = t('proj.connectFolder');
    folderBtn.title = t('proj.connectFolderTitle');
  }
  if (!folderStorageSupported()) folderBtn.classList.add('hidden');
}

export function renderProjects() {
  updateStorageUI();
  const projects = listProjects().sort((a, b) => b.updatedAt - a.updatedAt);
  const cur = currentProjectId();
  emptyEl.classList.toggle('hidden', projects.length > 0);
  listEl.innerHTML = '';
  for (const p of projects) {
    const li = document.createElement('li');
    li.className = 'proj-item' + (p.id === cur ? ' current' : '');
    li.title = t('proj.open');
    li.innerHTML = `
      <div class="proj-main">
        <span class="proj-name">${escapeHtml(p.name)}</span>
        ${p.id === cur ? `<span class="proj-badge">${t('proj.current')}</span>` : ''}
        <div class="proj-meta">${t('proj.objects', { n: p.objects ?? 0 })} · ${fmtTime(p.updatedAt)}</div>
      </div>
      <div class="proj-btns">
        <button class="mini-btn" data-act="copy" title="${t('proj.copy')}">📄</button>
        <button class="mini-btn" data-act="rename" title="${t('proj.rename')}">✏️</button>
        <button class="mini-btn danger" data-act="del" title="${t('proj.delete')}">✕</button>
      </div>`;
    li.addEventListener('click', e => {
      if (e.target.closest('.mini-btn')) return;
      if (p.id === currentProjectId()) { openProject(p.id); return; }
      if (confirm(t('proj.openConfirm', { name: p.name }))) openProject(p.id);
    });
    li.querySelector('[data-act="copy"]').addEventListener('click', async () => {
      const dup = await copyProject(p.id);
      if (dup) toast(t('proj.copied', { name: dup.name }));
    });
    li.querySelector('[data-act="rename"]').addEventListener('click', async () => {
      const name = prompt(t('proj.renamePrompt'), p.name);
      if (!name?.trim()) return;
      await renameProject(p.id, name.trim());
      if (p.id === currentProjectId()) tabName.textContent = name.trim();
    });
    li.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (confirm(t('proj.deleteConfirm', { name: p.name }))) {
        await deleteProject(p.id);
        toast(t('proj.deleted', { name: p.name }));
      }
    });
    listEl.appendChild(li);
  }
}

on('projects-changed', renderProjects);
initProjectStorage().then(renderProjects);

folderBtn.addEventListener('click', async () => {
  if (storageMode() === 'folder') {
    if (!confirm(t('proj.folderDisconnectConfirm'))) return;
    await disconnectProjectsFolder();
    toast(t('proj.storageBrowser'));
    return;
  }
  if (!folderStorageSupported()) {
    toast(t('proj.folderUnsupported'));
    return;
  }
  try {
    const name = await connectProjectsFolder();
    toast(t('proj.folderConnected', { name }));
  } catch (e) {
    if (e.message === 'UNSUPPORTED') toast(t('proj.folderUnsupported'));
    else if (e.message === 'DENIED') toast(t('proj.folderDenied'));
    else toast(t('proj.saveFailed', { err: e.message }));
  }
});

document.getElementById('btn-proj-new').addEventListener('click', async () => {
  if (!confirm(t('proj.newEmptyNote'))) return;
  const name = prompt(t('proj.newNamePrompt'), t('proj.defaultName'));
  if (!name?.trim()) return;
  clearScene();
  const proj = await saveToProject(null, name.trim());
  if (proj) {
    tabName.textContent = proj.name;
    toast(t('proj.created', { name: proj.name }));
  }
});

export async function saveCurrent() {
  const cur = currentProjectId();
  const existing = cur && getProject(cur);
  const name = existing?.name
    || prompt(t('proj.newNamePrompt'), tabName.textContent.trim() || t('proj.defaultName'))?.trim();
  if (!name) return;
  const proj = await saveToProject(existing ? cur : null, name);
  if (proj) {
    tabName.textContent = proj.name;
    toast(t('proj.saved', { name: proj.name }));
  }
}
document.getElementById('btn-save').addEventListener('click', saveCurrent);

const fileInput = document.getElementById('proj-import-file');
document.getElementById('btn-proj-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) await importHTMLFile(file);
});
