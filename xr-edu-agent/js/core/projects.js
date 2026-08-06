// ═══════════════════════════════════════════════════════════════
//  Projects + course packages (.xrcourse)
//
//  Canonical single-file format (download / folder / HTML embed):
//    {
//      magic: 'XR-EDU-COURSE',   // legacy 'XR-EDU-SCENE' still loads
//      version: 1,
//      kind: 'course',
//      name: string,
//      exportedAt: number,
//      scene: <THREE.ObjectLoader JSON of live/active viewport>,
//      cfg: {
//        locomotion: { mode, allowedRadius, turnMode },
//        outline: { version, course, chapters[], progress, activeSectionId },
//          // each section carries type-specific payload:
//          //   reading.chunks[] | h5.{html,prompt} | quiz.items[] | vr.{scene,camera}
//        knowledgeGraph: { nodes, edges, ahaKeys, ... } | null,
//      }
//    }
//  · Save flushes the live VR section into outline before serialize
//  · Load restores outline + KG + all section contents, then binds active VR
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { sceneRoot, resetOrbitCamera } from './three-setup.js';
import { state } from './state.js';
import { emit } from './events.js';
import { toast } from './utils.js';
import { t, L } from './i18n.js';
import { clearScene } from '../scene/manager.js';
import { syncPanelSpec, ensurePanelVisuals } from '../panels/panel3d.js';
import { runBuilderCode, compileUpdate, compileClick, compileHandler } from '../agent/sandbox.js';
import { locomotion, configureLocomotion } from './locomotion.js';
import { ensureStudentRig } from '../scene/student-rig.js';
import * as projectFs from './project-fs.js';
import { getOutline, setOutline, normalizeOutline } from './outline.js';
import { rewriteSampleAssetsInOutline } from './sample-assets.js';
import { setKnowledgeGraph, clearKnowledgeGraph } from './knowledge-graph.js';
import {
  resetVrSceneBinding, getLiveVrSectionId, saveLiveSceneToSection,
  syncLiveVrSceneWithOutline, parseSceneChildren, slimSnapshot,
} from './section-scene.js';

/** @deprecated Prefer COURSE_MAGIC for new packages; still accepted on import. */
export const SCENE_MAGIC = 'XR-EDU-SCENE';
export const COURSE_MAGIC = 'XR-EDU-COURSE';
export const SCENE_VERSION = 1;
export const COURSE_VERSION = 1;
export const COURSE_FILE_EXT = '.xrcourse';

function isKnownMagic(magic) {
  return magic === COURSE_MAGIC || magic === SCENE_MAGIC;
}
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
function isQuotaError(e) {
  return e?.name === 'QuotaExceededError'
    || e?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || /quota/i.test(e?.message || '');
}

/**
 * localStorage holds every project in one key, so a few 3D-heavy courses fill
 * it. On overflow drop what is recoverable — the auto-stash draft first, then
 * the oldest projects — and keep the save the teacher just asked for.
 */
function writeProjects(list, { keepId = null } = {}) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    emit('projects-changed');
    return;
  } catch (e) {
    if (!isQuotaError(e)) throw e;
  }

  const evictable = () => list
    .filter(p => p.id !== keepId)
    .sort((a, b) => (a.id === WORKING_DRAFT_ID ? -1 : b.id === WORKING_DRAFT_ID ? 1 : (a.updatedAt || 0) - (b.updatedAt || 0)));

  const dropped = [];
  let pool = [...list];
  while (true) {
    const victim = evictable().find(p => pool.includes(p));
    if (!victim) break;
    pool = pool.filter(p => p !== victim);
    dropped.push(victim.name || victim.id);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(pool));
      list.length = 0;
      list.push(...pool);
      emit('projects-changed');
      toast(t('proj.quotaEvicted', { names: dropped.join(', ') }));
      return;
    } catch (e) {
      if (!isQuotaError(e)) throw e;
    }
  }
  throw new Error(t('proj.quotaFull'));
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

/** Flush live VR edits into the active section, then build a course package. */
/**
 * @param {{slim?: boolean}} [opts]  slim=false keeps panel textures and
 *   code-built meshes in the JSON — the standalone HTML export needs them
 *   because its player has no panelSpec rehydration.
 */
export function serializeScene(name, { slim = true } = {}) {
  const liveId = getLiveVrSectionId();
  if (liveId) {
    try { saveLiveSceneToSection(liveId); } catch (e) {
      console.warn('[project] flush live VR before serialize failed:', e);
    }
  }
  // 面板内容镜像刷新(直接改过 pd.lines 的代码路径也能存到最新内容)
  sceneRoot.traverse(o => { if (o.userData.panelData) syncPanelSpec(o); });
  const restore = stripUserData(sceneRoot);
  let scene;
  try {
    const full = sceneRoot.toJSON();
    scene = slim ? slimSnapshot(full) : full;
  } finally { restore(); }
  const outline = getOutline();
  return {
    magic: COURSE_MAGIC,
    version: COURSE_VERSION,
    kind: 'course',
    name: name || outline?.course?.title || L('未命名课程', 'Untitled course'),
    exportedAt: Date.now(),
    scene,
    cfg: {
      locomotion: {
        mode: locomotion.mode,
        allowedRadius: locomotion.allowedRadius,
        turnMode: locomotion.turnMode,
      },
      outline,
      knowledgeGraph: state.knowledgeGraph || null,
    },
  };
}

/** Alias — serializeScene already emits the course package. */
export function serializeCourse(name) {
  return serializeScene(name);
}

function safeCourseFilename(name) {
  const base = String(name || 'course')
    .replace(/\.(xrcourse|xrscene|html|htm)$/i, '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'course';
  return `${base}${COURSE_FILE_EXT}`;
}

/** Download current course as a single `.xrcourse` JSON file. */
export function downloadCoursePackage(name) {
  const data = serializeCourse(name);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeCourseFilename(data.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return data;
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
  validateCourseData(data);
  resetVrSceneBinding();
  resetOrbitCamera(null);

  const outlineRaw = data.cfg?.outline ?? data.outline;
  const kgRaw = data.cfg?.knowledgeGraph ?? data.knowledgeGraph;
  const loco = data.cfg?.locomotion ?? data.locomotion;
  const outline = normalizeOutline(outlineRaw, data.name || '');
  // Fix figure URLs no matter where the course came from (sample open,
  // saved project, working-draft restore, .xrcourse import): raw
  // sample-asset: tokens and asset URLs from another origin both resolve
  // against THIS deployment, or images break after any version/origin mix.
  rewriteSampleAssetsInOutline(outline);

  // Prefer active VR section snapshot when present; else top-level scene
  const activeId = outline.activeSectionId;
  let activeVrScene = null;
  for (const ch of outline.chapters || []) {
    const sec = (ch.sections || []).find(s => s.id === activeId);
    if (sec?.type === 'vr' && sec.vr?.scene) {
      activeVrScene = sec.vr.scene;
      break;
    }
  }
  const sceneJson = activeVrScene || data.scene;
  if (!sceneJson?.object) {
    throw new Error(t('proj.importBadSchema', { detail: 'missing scene' }));
  }

  // One object ObjectLoader cannot read must not fail the whole course import
  let loaded;
  try {
    loaded = [...new THREE.ObjectLoader().parse(sceneJson).children];
  } catch (e) {
    console.warn('[projects] scene parse failed — recovering object by object:', e);
    loaded = parseSceneChildren(sceneJson).objects;
  }
  clearScene(false);   // 载入项目 = 整体替换,系统对象也由项目数据接管
  let hadLive = false;
  for (const child of loaded) sceneRoot.add(child);
  for (const child of [...sceneRoot.children]) reviveObject(child, sceneRoot);
  // 学生视角代表物:多个只留一个(旧数据叠加时),没有则补建
  const rigs = sceneRoot.children.filter(o => o.userData.studentRig);
  for (const extra of rigs.slice(0, -1)) sceneRoot.remove(extra);
  ensureStudentRig();
  sceneRoot.traverse(o => {
    if (o.userData.panelSpec?.live) hadLive = true;
  });
  ensurePanelVisuals(sceneRoot);               // rebuild canvas panels (live → static snapshot)
  // oid 计数器对齐,避免新对象与载入对象撞号
  let maxOid = 0;
  sceneRoot.traverse(o => {
    const m = /^o(\d+)$/.exec(o.userData.oid || '');
    if (m) maxOid = Math.max(maxOid, +m[1]);
  });
  state.objCounter = Math.max(state.objCounter, maxOid);
  if (loco) configureLocomotion(loco, true);

  // Populate learning outline + ALL section contents (reading/h5/quiz/vr)
  setOutline(outline, { silent: false });
  if (kgRaw) setKnowledgeGraph(kgRaw, { silent: true });
  else clearKnowledgeGraph();

  // Bind live viewport to the active outline VR section (if any)
  try { syncLiveVrSceneWithOutline(); } catch (e) {
    console.warn('[project] sync VR after load:', e);
  }

  emit('hierarchy-changed');
  if (hadLive) toast(t('proj.liveDegrade'));
}

/** Alias for clarity in call sites. */
export function loadCourseData(data) {
  return loadSceneData(data);
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
  try { writeProjects(list, { keepId: proj.id }); }
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

// ── Import: .xrcourse / .xrscene JSON, or HTML with embedded course block ──
// 导出 HTML 内嵌 <script type="application/json" id="xr-scene-source">…</script>
export function extractSceneFromHTML(html) {
  const m = html.match(/<script\s+type="application\/json"\s+id="xr-scene-source"\s*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(t('proj.importNotOurs'));
  let data;
  try { data = JSON.parse(m[1]); }
  catch { throw new Error(t('proj.importBadSchema', { detail: 'JSON parse error' })); }
  validateCourseData(data);
  return data;
}

/** @deprecated use validateCourseData */
export function validateSceneData(data) {
  return validateCourseData(data);
}

function outlineHasVrScene(outline) {
  for (const ch of outline?.chapters || []) {
    for (const s of ch.sections || []) {
      if (s?.type === 'vr' && s.vr?.scene?.object) return true;
    }
  }
  return false;
}

export function validateCourseData(data) {
  const bad = detail => { throw new Error(t('proj.importBadSchema', { detail })); };
  if (!data || typeof data !== 'object') bad('not an object');
  if (!isKnownMagic(data.magic)) throw new Error(t('proj.importNotOurs'));
  if (data.version !== COURSE_VERSION && data.version !== SCENE_VERSION) {
    bad(`version ${data.version}`);
  }
  if (typeof data.name !== 'string') bad('name');

  const outline = data.cfg?.outline ?? data.outline;
  const hasOutline = !!(outline && Array.isArray(outline.chapters));
  const s = data.scene;
  const hasTopScene = !!(s?.object && s.object.type === 'Group' && Array.isArray(s.object.children));
  const hasSectionVr = outlineHasVrScene(outline);

  if (!hasTopScene && !hasSectionVr && !hasOutline) {
    bad('missing course outline / scene');
  }
  if (hasTopScene && s.object.children.length > 500) bad('too many objects');
  if (hasOutline) {
    let nSec = 0;
    for (const ch of outline.chapters) nSec += (ch.sections || []).length;
    if (nSec > 200) bad('too many sections');
  }
  return true;
}

function countCourseObjects(data) {
  const s = data.scene?.object?.children;
  if (Array.isArray(s)) return s.length;
  let n = 0;
  const outline = data.cfg?.outline ?? data.outline;
  for (const ch of outline?.chapters || []) {
    for (const sec of ch.sections || []) {
      n += sec.vr?.scene?.object?.children?.length || 0;
    }
  }
  return n;
}

function countCourseSections(data) {
  const outline = data.cfg?.outline ?? data.outline;
  if (!outline?.chapters) return 0;
  return outline.chapters.reduce((n, c) => n + (c.sections?.length || 0), 0);
}

/** Parse .xrcourse / .xrscene JSON or exported HTML into validated course data. */
export function parseCourseFileText(text, filename = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error(t('proj.importBadSchema', { detail: 'empty file' }));
  const looksHtml = /\.html?$/i.test(filename) || /^<!DOCTYPE|^<html[\s>]/i.test(trimmed);
  if (looksHtml) return extractSceneFromHTML(trimmed);
  let data;
  try { data = JSON.parse(trimmed); }
  catch { throw new Error(t('proj.importBadSchema', { detail: 'JSON parse error' })); }
  validateCourseData(data);
  return data;
}

/**
 * Import a course package (.xrcourse / .xrscene / exported HTML).
 * Replaces the current course after confirm; saves into the project library.
 */
export async function importCourseFile(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) { toast(t('proj.importTooBig')); return; }
  let data;
  try { data = parseCourseFileText(await file.text(), file.name); }
  catch (e) { toast(t('proj.importBad', { err: e.message })); return; }
  const n = countCourseObjects(data);
  const nSec = countCourseSections(data);
  const name = data.name || t('proj.defaultName');
  if (!confirm(t('proj.importCourseConfirm', { name, n, sections: nSec }))) return;
  try {
    loadCourseData(data);
  } catch (e) { toast(t('proj.importBad', { err: e.message })); return; }
  const proj = await saveToProject(null, name);
  if (proj) document.getElementById('scene-tab-name').textContent = proj.name;
  toast(t('proj.importCourseOk', { name, sections: nSec, n }));
}

/** @deprecated use importCourseFile */
export async function importHTMLFile(file) {
  return importCourseFile(file);
}
