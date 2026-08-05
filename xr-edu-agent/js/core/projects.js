// ═══════════════════════════════════════════════════════════════
//  项目管理:本地项目库(localStorage)+ 场景序列化/还原 + HTML 导入
//
//  · 数据格式(ProjectData,同时也是导出 HTML 内嵌数据块的格式):
//      { magic:'XR-EDU-SCENE', version:1, name, scene:<sceneRoot.toJSON()>, cfg:{locomotion} }
//  · 保存:剥离 userData 里不可序列化的值(函数/THREE 对象)→ toJSON;
//    面板文字靠 panelSpec(JSON 安全镜像)随场景走,载入后重建可编辑面板
//  · 载入:ObjectLoader 解析 → 面板 rehydrate → 行为代码重新编译
//    (builderCode 对象整体重建,live 面板降级为静态快照 —— 与导出播放器同一套边界)
//  · 导入校验门:文件大小上限 / 魔数+版本 / 结构形状校验 / 用户确认(含代码风险提示)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { sceneRoot, resetOrbitCamera } from './three-setup.js';
import { state } from './state.js';
import { emit } from './events.js';
import { toast } from './utils.js';
import { t } from './i18n.js';
import { clearScene } from '../scene/manager.js';
import { syncPanelSpec, rehydratePanel } from '../panels/panel3d.js';
import { runBuilderCode, compileUpdate, compileClick, compileHandler } from '../agent/sandbox.js';
import { locomotion, configureLocomotion } from './locomotion.js';
import { ensureStudentRig } from '../scene/student-rig.js';
import * as projectFs from './project-fs.js';
import { getOutline, setOutline, normalizeOutline } from './outline.js';
import { setKnowledgeGraph, clearKnowledgeGraph } from './knowledge-graph.js';
import { resetVrSceneBinding, getLiveVrSectionId, saveLiveSceneToSection } from './section-scene.js';

export const SCENE_MAGIC = 'XR-EDU-SCENE';
export const SCENE_VERSION = 1;
/** Auto-stash slot for the course that would otherwise be wiped by open/new/import. */
export const WORKING_DRAFT_ID = '__working_draft__';
const LS_KEY = 'xr-projects';
const LS_CURRENT = 'xr-current-project';
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

let useFolder = false;
let folderCache = [];

export function storageMode() { return useFolder ? 'folder' : 'localStorage'; }
export function folderStorageSupported() { return projectFs.fsSupported(); }
export function connectedFolderName() { return useFolder ? projectFs.getConnectedFolderName() : null; }

/** 启动时尝试重连上次授权的项目文件夹 */
export async function initProjectStorage() {
  if (!projectFs.fsSupported()) return false;
  if (await projectFs.tryReconnectFolder()) {
    useFolder = true;
    await refreshFolderCache();
    return true;
  }
  return false;
}

async function refreshFolderCache() {
  folderCache = await projectFs.listFolderProjects();
  emit('projects-changed');
}

export async function connectProjectsFolder() {
  const name = await projectFs.connectFolder();
  useFolder = true;
  await refreshFolderCache();
  return name;
}

export async function disconnectProjectsFolder() {
  await projectFs.disconnectFolder();
  useFolder = false;
  folderCache = [];
  setCurrentProject(null);
  emit('projects-changed');
}

// ── 项目库(localStorage 或 本地文件夹)──
export function listProjects() {
  if (useFolder) return [...folderCache];
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function writeProjects(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  emit('projects-changed');
}
export function currentProjectId() { return localStorage.getItem(LS_CURRENT) || null; }
export function setCurrentProject(id) {
  if (id) localStorage.setItem(LS_CURRENT, id);
  else localStorage.removeItem(LS_CURRENT);
  emit('projects-changed');
}
export function getProject(id) {
  if (useFolder) return folderCache.find(p => p.id === id) || null;
  return listProjects().find(p => p.id === id) || null;
}

// ── 场景 → ProjectData ──
// userData 里不可 JSON 序列化的值(函数/THREE 对象/canvas)先剥离、序列化后原样恢复
export function stripUserData(root) {
  const stash = [];
  root.traverse(o => {
    const ud = o.userData;
    const saved = {};
    for (const k of Object.keys(ud)) {
      const v = ud[k];
      const bad = typeof v === 'function'
        || k === 'panelData'
        || (v && typeof v === 'object' && (v.isObject3D || v.isTexture || v.isMaterial || (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement)));
      if (bad) { saved[k] = v; delete ud[k]; }
    }
    if (Object.keys(saved).length) stash.push([o, saved]);
  });
  return () => stash.forEach(([o, saved]) => Object.assign(o.userData, saved));
}

export function serializeScene(name) {
  // 面板内容镜像刷新(直接改过 pd.lines 的代码路径也能存到最新内容)
  sceneRoot.traverse(o => { if (o.userData.panelData) syncPanelSpec(o); });
  const restore = stripUserData(sceneRoot);
  let scene;
  try { scene = sceneRoot.toJSON(); }
  finally { restore(); }
  return {
    magic: SCENE_MAGIC,
    version: SCENE_VERSION,
    name,
    scene,
    cfg: {
      locomotion: { mode: locomotion.mode, allowedRadius: locomotion.allowedRadius, turnMode: locomotion.turnMode },
      outline: getOutline(),
      knowledgeGraph: state.knowledgeGraph || null,
    },
  };
}

// ── ProjectData → 场景 ──
// 行为复活(与导出播放器同一策略):builderCode 对象整体重建 → 失败用序列化网格兜底;
// 代码字符串重新编译回 userData 函数
function reviveObject(old, root) {
  let obj = old;
  const ud = old.userData;
  if (ud.builderCode) {
    try {
      const built = runBuilderCode(ud.builderCode);
      built.position.copy(old.position);
      built.rotation.copy(old.rotation);
      built.scale.copy(old.scale);
      built.name = old.name;
      const own = { ...built.userData };            // 构建代码闭包里挂的函数优先保留
      Object.assign(built.userData, ud, own);
      root.remove(old);
      root.add(built);
      obj = built;
    } catch (e) { console.warn('[project] builderCode 重建失败,使用序列化网格:', ud.displayName, e); }
  }
  const u = obj.userData;
  try {
    if (u.updateCode) u.customUpdate = compileUpdate(u.updateCode);
    if (u.clickCode) u.customClick = compileClick(u.clickCode);
    if (u.grabCode) u.onGrab = compileHandler(u.grabCode);
    if (u.dragCode) u.onDrag = compileHandler(u.dragCode);
    if (u.releaseCode) u.onRelease = compileHandler(u.releaseCode);
  } catch (e) { console.warn('[project] 行为编译失败:', u.displayName, e); }
  return obj;
}

export function loadSceneData(data) {
  resetVrSceneBinding();
  resetOrbitCamera(null);
  const parsed = new THREE.ObjectLoader().parse(data.scene);
  clearScene(false);   // 载入项目 = 整体替换,系统对象也由项目数据接管
  let hadLive = false;
  for (const child of [...parsed.children]) sceneRoot.add(child);
  for (const child of [...sceneRoot.children]) reviveObject(child, sceneRoot);
  // 学生视角代表物:多个只留一个(旧数据叠加时),没有则补建
  const rigs = sceneRoot.children.filter(o => o.userData.studentRig);
  for (const extra of rigs.slice(0, -1)) sceneRoot.remove(extra);
  ensureStudentRig();
  sceneRoot.traverse(o => {
    if (o.userData.panelSpec) {
      if (o.userData.panelSpec.live) hadLive = true;
      rehydratePanel(o);                       // live 面板降级为静态快照
    }
  });
  // oid 计数器对齐,避免新对象与载入对象撞号
  let maxOid = 0;
  sceneRoot.traverse(o => {
    const m = /^o(\d+)$/.exec(o.userData.oid || '');
    if (m) maxOid = Math.max(maxOid, +m[1]);
  });
  state.objCounter = Math.max(state.objCounter, maxOid);
  if (data.cfg?.locomotion) configureLocomotion(data.cfg.locomotion, true);
  setOutline(normalizeOutline(data.cfg?.outline, data.name || ''), { silent: false });
  if (data.cfg?.knowledgeGraph) setKnowledgeGraph(data.cfg.knowledgeGraph, { silent: true });
  else clearKnowledgeGraph();
  emit('hierarchy-changed');
  if (hadLive) toast(t('proj.liveDegrade'));
}

// ── 项目 CRUD ──
export async function saveToProject(id, name) {
  const data = serializeScene(name);
  const now = Date.now();
  const objects = sceneRoot.children.length;

  if (useFolder) {
    let proj = id ? folderCache.find(p => p.id === id) : null;
    if (!proj) {
      proj = { id: id || 'p' + now.toString(36), createdAt: now, _filename: null, _handle: null };
      folderCache.push(proj);
    }
    proj.name = name;
    proj.updatedAt = now;
    proj.objects = objects;
    proj.data = data;
    try {
      await projectFs.writeFolderProject(proj);
      setCurrentProject(proj.id);
      emit('projects-changed');
      return proj;
    } catch (e) {
      toast(t('proj.saveFailed', { err: e.message }));
      return null;
    }
  }

  const list = listProjects();
  let proj = list.find(p => p.id === id);
  if (!proj) {
    proj = { id: id || 'p' + now.toString(36), createdAt: now };
    list.push(proj);
  }
  proj.name = name;
  proj.updatedAt = now;
  proj.objects = objects;
  proj.data = data;
  try { writeProjects(list); }
  catch (e) { toast(t('proj.saveFailed', { err: e.message })); return null; }
  setCurrentProject(proj.id);
  return proj;
}

/** True if this id is the auto-stash working draft. */
export function isWorkingDraft(id) {
  return id === WORKING_DRAFT_ID;
}

/**
 * Snapshot the current course into the fixed working-draft slot so open/new/import
 * cannot wipe in-progress generation. Skipped when the target is the draft itself.
 */
export async function stashWorkingDraft({ skipIfTargetId } = {}) {
  if (skipIfTargetId && skipIfTargetId === WORKING_DRAFT_ID) return null;
  const liveId = getLiveVrSectionId();
  if (liveId) saveLiveSceneToSection(liveId);
  const name = t('proj.workingDraftName');
  const prevCurrent = currentProjectId();
  const proj = await saveToProject(WORKING_DRAFT_ID, name);
  // Keep "current" pointing at whatever the user was editing until open/new finishes
  if (prevCurrent && prevCurrent !== WORKING_DRAFT_ID) setCurrentProject(prevCurrent);
  return proj;
}

export async function deleteProject(id) {
  if (useFolder) {
    const proj = folderCache.find(p => p.id === id);
    if (proj) {
      try { await projectFs.deleteFolderProject(proj); }
      catch (e) { toast(t('proj.saveFailed', { err: e.message })); return; }
    }
    folderCache = folderCache.filter(p => p.id !== id);
    if (currentProjectId() === id) setCurrentProject(null);
    emit('projects-changed');
    return;
  }
  writeProjects(listProjects().filter(p => p.id !== id));
  if (currentProjectId() === id) setCurrentProject(null);
}

export async function copyProject(id) {
  if (useFolder) {
    const src = folderCache.find(p => p.id === id);
    if (!src) return null;
    try {
      const dup = await projectFs.copyFolderProject(src);
      folderCache.push(dup);
      emit('projects-changed');
      return dup;
    } catch (e) {
      toast(t('proj.saveFailed', { err: e.message }));
      return null;
    }
  }

  const list = listProjects();
  const src = list.find(p => p.id === id);
  if (!src) return null;
  const base = src.name.replace(/ \(\d+\)$/, '');
  const used = new Set(list.map(p => p.name));
  let n = 1;
  while (used.has(`${base} (${n})`)) n++;
  const name = `${base} (${n})`;
  const now = Date.now();
  const dup = {
    ...JSON.parse(JSON.stringify(src)),
    id: 'p' + now.toString(36),
    name,
    createdAt: now,
    updatedAt: now,
  };
  if (dup.data) dup.data.name = name;
  list.push(dup);
  try { writeProjects(list); }
  catch (e) { toast(t('proj.saveFailed', { err: e.message })); return null; }
  return dup;
}

export async function renameProject(id, name) {
  if (useFolder) {
    const proj = folderCache.find(p => p.id === id);
    if (!proj) return;
    try {
      await projectFs.renameFolderProject(proj, name);
      emit('projects-changed');
    } catch (e) {
      toast(t('proj.saveFailed', { err: e.message }));
    }
    return;
  }
  const list = listProjects();
  const p = list.find(x => x.id === id);
  if (!p) return;
  p.name = name;
  if (p.data) p.data.name = name;
  writeProjects(list);
}

export function openProject(id) {
  const p = getProject(id);
  if (!p?.data) return false;
  try {
    loadSceneData(p.data);
    setCurrentProject(id);
    document.getElementById('scene-tab-name').textContent = p.name;
    toast(t('proj.loaded', { name: p.name }));
    return true;
  } catch (e) {
    toast(t('proj.loadFailed', { err: e.message }));
    return false;
  }
}

// ── HTML 导入(带校验门)──
// 导出 HTML 内嵌 <script type="application/json" id="xr-scene-source">…</script>
export function extractSceneFromHTML(html) {
  const m = html.match(/<script\s+type="application\/json"\s+id="xr-scene-source"\s*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(t('proj.importNotOurs'));
  let data;
  try { data = JSON.parse(m[1]); }
  catch { throw new Error(t('proj.importBadSchema', { detail: 'JSON parse error' })); }
  validateSceneData(data);
  return data;
}

export function validateSceneData(data) {
  const bad = detail => { throw new Error(t('proj.importBadSchema', { detail })); };
  if (!data || typeof data !== 'object') bad('not an object');
  if (data.magic !== SCENE_MAGIC) throw new Error(t('proj.importNotOurs'));
  if (data.version !== SCENE_VERSION) bad(`version ${data.version}`);
  if (typeof data.name !== 'string') bad('name');
  const s = data.scene;
  if (!s?.object || s.object.type !== 'Group') bad('scene root');
  if (!Array.isArray(s.object.children)) bad('scene children');
  if (s.object.children.length > 500) bad('too many objects');
  return true;
}

export async function importHTMLFile(file) {
  if (file.size > MAX_IMPORT_BYTES) { toast(t('proj.importTooBig')); return; }
  let data;
  try { data = extractSceneFromHTML(await file.text()); }
  catch (e) { toast(t('proj.importBad', { err: e.message })); return; }
  const n = data.scene.object.children.length;
  const name = data.name || t('proj.defaultName');
  // 场景可能携带 AI 生成的行为代码(载入即编译执行)→ 明确请用户确认
  if (!confirm(t('proj.importConfirm', { name, n }))) return;
  try {
    loadSceneData(data);
  } catch (e) { toast(t('proj.importBad', { err: e.message })); return; }
  const proj = await saveToProject(null, name);
  if (proj) document.getElementById('scene-tab-name').textContent = proj.name;
  toast(t('proj.importOk', { name, n }));
}
