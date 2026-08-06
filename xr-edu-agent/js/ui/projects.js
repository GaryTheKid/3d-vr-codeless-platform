// ═══════════════════════════════════════════════════════════════
//  项目弹层:浏览/新建/打开/重命名/删除 + HTML 导入 + 顶栏保存
//  数据层在 core/projects.js;左上角 📁 打开自定义遮罩(非原生 dialog)
// ═══════════════════════════════════════════════════════════════
import { on } from '../core/events.js';
import { toast, escapeHtml } from '../core/utils.js';
import { t, L } from '../core/i18n.js';
import { clearScene } from '../scene/manager.js';
import {
  listProjects, currentProjectId, getProject, saveToProject,
  openProject, deleteProject, renameProject, copyProject, importCourseFile,
  downloadCoursePackage,
  storageMode, connectedFolderName, folderStorageSupported,
  connectProjectsFolder, disconnectProjectsFolder, initProjectStorage,
  stashWorkingDraft, isWorkingDraft, setCurrentProject,
} from '../core/projects.js';
import { listSampleCourses, openSampleCourse, sampleSubjectLabel } from '../core/samples.js';
import { setOutline, createDefaultOutline } from '../core/outline.js';
import { resetVrSceneBinding } from '../core/section-scene.js';
import { resetOrbitCamera } from '../core/three-setup.js';

const listEl = document.getElementById('project-list');
const emptyEl = document.getElementById('project-empty');
const samplesEl = document.getElementById('proj-samples');
const sampleListEl = document.getElementById('sample-list');
const tabName = document.getElementById('scene-tab-name');
const storageNote = document.getElementById('proj-storage-note');
const folderBtn = document.getElementById('btn-proj-folder');
const overlay = document.getElementById('projects-overlay');

function dismissSettingsPopover() {
  const el = document.getElementById('settings-overlay');
  if (!el || el.classList.contains('hidden')) return;
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function openProjectsOverlay() {
  if (!overlay) return;
  if (document.body.classList.contains('course-pipeline-busy')) {
    toast(L('课程生成中,暂不可用', 'Unavailable while the course is generating'));
    return;
  }
  dismissSettingsPopover();
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  renderProjects();
}

export function closeProjectsOverlay() {
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
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
  else folderBtn.classList.remove('hidden');
}

/**
 * Ready-made courses from pre-built-samples/. Opening one loads it straight
 * into the workspace; the multi-MB package is never copied into the project
 * library (that is what fills the localStorage quota).
 */
async function renderSamples() {
  if (!samplesEl || !sampleListEl) return;
  const samples = await listSampleCourses();
  samplesEl.classList.toggle('hidden', samples.length === 0);
  if (!samples.length) return;
  sampleListEl.innerHTML = '';
  for (const s of samples) {
    const li = document.createElement('li');
    li.className = 'proj-item sample';
    li.title = t('proj.sampleOpenTitle');
    const meta = [sampleSubjectLabel(s), t('proj.sections', { n: s.sections ?? 0 })]
      .filter(Boolean).join(' · ');
    li.innerHTML = `
      <div class="proj-main">
        <span class="proj-name">${escapeHtml(s.title || s.id)}</span>
        <span class="proj-badge sample">${t('proj.sampleBadge')}</span>
        <div class="proj-meta">${escapeHtml(meta)}</div>
      </div>`;
    li.addEventListener('click', async () => {
      if (!confirm(t('proj.sampleOpenConfirm', { name: s.title || s.id }))) return;
      li.classList.add('loading');
      try {
        // A full localStorage must not stand between a participant and a sample
        try { await stashWorkingDraft(); }
        catch (e) { console.warn('[projects] could not stash before opening a sample', e); }
        const info = await openSampleCourse(s.id);
        // Not a library entry — clear "current" so Save asks for a new name
        // instead of overwriting whatever project was open before.
        setCurrentProject(null);
        tabName.textContent = info.name;
        toast(t('proj.sampleOpened', { name: info.name, sections: info.sections }));
        closeProjectsOverlay();
      } catch (e) {
        toast(t('proj.sampleFailed', { err: e.message || String(e) }));
      } finally {
        li.classList.remove('loading');
      }
    });
    sampleListEl.appendChild(li);
  }
}

export function renderProjects() {
  updateStorageUI();
  renderSamples();
  const projects = listProjects().sort((a, b) => {
    // Working draft always pins to top
    if (isWorkingDraft(a.id) && !isWorkingDraft(b.id)) return -1;
    if (!isWorkingDraft(a.id) && isWorkingDraft(b.id)) return 1;
    return b.updatedAt - a.updatedAt;
  });
  const cur = currentProjectId();
  emptyEl.classList.toggle('hidden', projects.length > 0);
  listEl.innerHTML = '';
  for (const p of projects) {
    const li = document.createElement('li');
    const draft = isWorkingDraft(p.id);
    li.className = 'proj-item' + (p.id === cur ? ' current' : '') + (draft ? ' draft' : '');
    li.title = t('proj.open');
    li.innerHTML = `
      <div class="proj-main">
        <span class="proj-name">${escapeHtml(p.name)}</span>
        ${draft ? `<span class="proj-badge draft">${t('proj.workingDraftBadge')}</span>` : ''}
        ${p.id === cur ? `<span class="proj-badge">${t('proj.current')}</span>` : ''}
        <div class="proj-meta">${t('proj.objects', { n: p.objects ?? 0 })} · ${fmtTime(p.updatedAt)}</div>
      </div>
      <div class="proj-btns">
        <button class="mini-btn" data-act="copy" title="${t('proj.copy')}">📄</button>
        <button class="mini-btn" data-act="rename" title="${t('proj.rename')}" ${draft ? 'disabled' : ''}>✏️</button>
        <button class="mini-btn danger" data-act="del" title="${t('proj.delete')}">✕</button>
      </div>`;
    li.addEventListener('click', async e => {
      if (e.target.closest('.mini-btn')) return;
      if (p.id === currentProjectId()) {
        openProject(p.id);
        closeProjectsOverlay();
        return;
      }
      if (!confirm(t('proj.openConfirm', { name: p.name }))) return;
      await stashWorkingDraft({ skipIfTargetId: p.id });
      openProject(p.id);
      closeProjectsOverlay();
    });
    li.querySelector('[data-act="copy"]').addEventListener('click', async () => {
      const dup = await copyProject(p.id);
      if (dup) toast(t('proj.copied', { name: dup.name }));
    });
    li.querySelector('[data-act="rename"]').addEventListener('click', async () => {
      if (draft) return;
      const name = prompt(t('proj.renamePrompt'), p.name);
      if (!name?.trim()) return;
      await renameProject(p.id, name.trim());
      if (p.id === currentProjectId()) tabName.textContent = name.trim();
    });
    li.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (!confirm(t('proj.deleteConfirm', { name: p.name }))) return;
      await deleteProject(p.id);
      toast(t('proj.deleted', { name: p.name }));
    });
    listEl.appendChild(li);
  }
}

on('projects-changed', renderProjects);
initProjectStorage().then(renderProjects);

document.getElementById('btn-projects-folder')?.addEventListener('click', openProjectsOverlay);
document.getElementById('btn-projects-close')?.addEventListener('click', closeProjectsOverlay);
document.getElementById('projects-overlay-backdrop')?.addEventListener('click', closeProjectsOverlay);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) closeProjectsOverlay();
});

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
  await stashWorkingDraft();
  resetVrSceneBinding();
  resetOrbitCamera(null);
  clearScene();
  setOutline(createDefaultOutline(name.trim()));
  const proj = await saveToProject(null, name.trim());
  if (proj) {
    tabName.textContent = proj.name;
    toast(t('proj.created', { name: proj.name }));
    closeProjectsOverlay();
  }
});

export async function saveCurrent() {
  if (document.body.classList.contains('course-pipeline-busy')) {
    toast(L('课程生成中,暂不可用', 'Unavailable while the course is generating'));
    return;
  }
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

document.getElementById('btn-proj-download')?.addEventListener('click', () => {
  if (document.body.classList.contains('course-pipeline-busy')) {
    toast(L('课程生成中,暂不可用', 'Unavailable while the course is generating'));
    return;
  }
  const name = tabName.textContent.trim() || t('proj.defaultName');
  try {
    const data = downloadCoursePackage(name);
    toast(t('proj.downloadCourseOk', { name: data.name || name }));
  } catch (e) {
    toast(t('proj.saveFailed', { err: e.message || String(e) }));
  }
});

const fileInput = document.getElementById('proj-import-file');
document.getElementById('btn-proj-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) {
    await stashWorkingDraft();
    await importCourseFile(file);
    closeProjectsOverlay();
  }
});
