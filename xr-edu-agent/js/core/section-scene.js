// ═══════════════════════════════════════════════════════════════
//  Per-section 3D scene snapshot — each VR outline section owns its
//  own Three.js graph so pipeline fills don't overwrite each other.
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { sceneRoot, camera, orbit, resize, sanitizeOrbitCamera, resetOrbitCamera } from './three-setup.js';
import { state } from './state.js';
import { emit } from './events.js';
import { clearScene } from '../scene/manager.js';
import { syncPanelSpec, rehydratePanel } from '../panels/panel3d.js';
import { runBuilderCode, compileUpdate, compileClick, compileHandler } from '../agent/sandbox.js';
import { ensureStudentRig } from '../scene/student-rig.js';
import { findSection, updateSection, getActiveSection, setActiveSection } from './outline.js';
import { toast } from './utils.js';
import { L } from './i18n.js';
import { stopPlayForSectionSwitch } from './play-reset.js';

/** Strip non-JSON userData temporarily (same idea as projects.serializeScene). */
function stripUserData(root) {
  const stash = [];
  root.traverse(o => {
    const ud = o.userData;
    if (!ud) return;
    const saved = {};
    for (const k of Object.keys(ud)) {
      const v = ud[k];
      const bad = typeof v === 'function'
        || k === 'panelData'
        || (v && typeof v === 'object' && (v.isObject3D || v.isTexture || v.isMaterial
          || (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement)));
      if (bad) { saved[k] = v; delete ud[k]; }
    }
    if (Object.keys(saved).length) stash.push([o, saved]);
  });
  return () => stash.forEach(([o, saved]) => Object.assign(o.userData, saved));
}

function reviveObject(old, root) {
  let obj = old;
  const ud = old.userData;
  if (ud.builderCode) {
    try {
      const built = runBuilderCode(ud.builderCode);
      built.position.copy(old.position);
      built.rotation.copy(old.rotation);
      // Guard against corrupted near-zero / NaN scales from bad snapshots
      const sx = old.scale.x, sy = old.scale.y, sz = old.scale.z;
      if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz)
        && Math.abs(sx) > 1e-4 && Math.abs(sy) > 1e-4 && Math.abs(sz) > 1e-4) {
        built.scale.copy(old.scale);
      }
      built.name = old.name;
      const own = { ...built.userData };
      Object.assign(built.userData, ud, own);
      root.remove(old);
      root.add(built);
      obj = built;
    } catch (e) {
      console.warn('[section-scene] builderCode revive failed:', ud.displayName, e);
    }
  }
  const u = obj.userData;
  try {
    if (u.updateCode) u.customUpdate = compileUpdate(u.updateCode);
    if (u.clickCode) u.customClick = compileClick(u.clickCode);
    if (u.grabCode) u.onGrab = compileHandler(u.grabCode);
    if (u.dragCode) u.onDrag = compileHandler(u.dragCode);
    if (u.releaseCode) u.onRelease = compileHandler(u.releaseCode);
  } catch (e) {
    console.warn('[section-scene] behavior compile failed:', u.displayName, e);
  }
  return obj;
}

/** Capture live sceneRoot → Three.js ObjectLoader JSON (no outline/KG). */
export function captureSceneGraph() {
  sceneRoot.traverse(o => { if (o.userData.panelData) syncPanelSpec(o); });
  // Never persist a broken root transform into section snapshots
  sceneRoot.position.set(0, 0, 0);
  sceneRoot.rotation.set(0, 0, 0);
  sceneRoot.scale.set(1, 1, 1);
  const restore = stripUserData(sceneRoot);
  try {
    return sceneRoot.toJSON();
  } finally {
    restore();
  }
}

/** Replace live scene with a stored graph. Empty/null → clear. */
export function restoreSceneGraph(sceneJson) {
  clearScene(false);
  sceneRoot.position.set(0, 0, 0);
  sceneRoot.rotation.set(0, 0, 0);
  sceneRoot.scale.set(1, 1, 1);
  if (!sceneJson) {
    ensureStudentRig();
    emit('hierarchy-changed');
    return;
  }
  try {
    const parsed = new THREE.ObjectLoader().parse(sceneJson);
    for (const child of [...parsed.children]) sceneRoot.add(child);
    for (const child of [...sceneRoot.children]) reviveObject(child, sceneRoot);
    const rigs = sceneRoot.children.filter(o => o.userData.studentRig);
    for (const extra of rigs.slice(0, -1)) sceneRoot.remove(extra);
    ensureStudentRig();
    sceneRoot.traverse(o => {
      if (o.userData.panelSpec) rehydratePanel(o);
    });
    let maxOid = 0;
    sceneRoot.traverse(o => {
      const m = /^o(\d+)$/.exec(o.userData.oid || '');
      if (m) maxOid = Math.max(maxOid, +m[1]);
    });
    state.objCounter = Math.max(state.objCounter, maxOid);
  } catch (e) {
    console.warn('[section-scene] restore failed:', e);
    clearScene(false);
    ensureStudentRig();
  }
  emit('hierarchy-changed');
}

const DEFAULT_CAM = {
  position: [9, 7, 12],
  target: [0, 1.5, 0],
};

const CAM_DIST_MIN = 3;
const CAM_DIST_MAX = 36;

function clampCameraState(cam) {
  const c = cam && Array.isArray(cam.position) && Array.isArray(cam.target)
    ? { position: [...cam.position], target: [...cam.target] }
    : { ...DEFAULT_CAM, position: [...DEFAULT_CAM.position], target: [...DEFAULT_CAM.target] };
  const pos = new THREE.Vector3().fromArray(c.position);
  const tgt = new THREE.Vector3().fromArray(c.target);
  let dist = pos.distanceTo(tgt);
  if (!Number.isFinite(dist) || dist < 0.05) {
    return { position: [...DEFAULT_CAM.position], target: [...DEFAULT_CAM.target] };
  }
  if (dist < CAM_DIST_MIN || dist > CAM_DIST_MAX) {
    const dir = pos.clone().sub(tgt);
    if (dir.lengthSq() < 1e-8) dir.set(9, 7, 12);
    dir.normalize();
    const d = Math.min(CAM_DIST_MAX, Math.max(CAM_DIST_MIN, dist));
    pos.copy(tgt).addScaledVector(dir, d);
    c.position = pos.toArray();
  }
  return c;
}

export function captureCameraState() {
  return clampCameraState({
    position: camera.position.toArray(),
    target: orbit.target.toArray(),
  });
}

export function restoreCameraState(cam) {
  const c = clampCameraState(cam);
  // Perspective zoom must stay 1 — OrbitControls uses dolly (position), not camera.zoom.
  // Restoring a bad zoom was collapsing the whole view into a speck.
  resetOrbitCamera(c);
  sanitizeOrbitCamera();
  requestAnimationFrame(() => resize());
}

/** Persist current live scene onto a VR section (silent). */
export function saveLiveSceneToSection(sectionId, { includeCamera = true } = {}) {
  const hit = findSection(sectionId);
  if (!hit || hit.section.type !== 'vr') return false;
  const scene = captureSceneGraph();
  const patch = {
    ...(hit.section.vr || {}),
    scene,
    note: hit.section.vr?.note || '',
    savedAt: Date.now(),
  };
  if (includeCamera) patch.camera = captureCameraState();
  updateSection(sectionId, { vr: patch }, { silent: true });
  return true;
}

/** Load a VR section's stored scene into the viewport. */
export function loadSectionScene(sectionId) {
  const hit = findSection(sectionId);
  if (!hit || hit.section.type !== 'vr') return false;
  restoreSceneGraph(hit.section.vr?.scene || null);
  restoreCameraState(hit.section.vr?.camera || null);
  return true;
}

/** Which VR section's graph is currently bound to the live viewport. */
let liveVrSectionId = null;
/** Section id currently being filled by the course pipeline (if any). */
let fillingVrSectionId = null;
let fillLockToastAt = 0;

export function getLiveVrSectionId() {
  return liveVrSectionId;
}

export function getFillingVrSectionId() {
  return fillingVrSectionId;
}

/** Drop live/fill binding without writing (call before loadProject / new empty). */
export function resetVrSceneBinding() {
  liveVrSectionId = null;
  fillingVrSectionId = null;
  fillLockToastAt = 0;
}

/**
 * Keep live Three.js graph in sync with the active outline section.
 * While a VR section is generating, refuse to swap the live graph to another
 * VR section (preview-during-gen caused camera/scene corruption).
 */
export function syncLiveVrSceneWithOutline() {
  const hit = getActiveSection();
  const nextId = hit?.section?.type === 'vr' ? hit.section.id : null;

  // Leaving the bound VR section (or switching VR↔VR) while ▶ Play is on:
  // stop play first so play-reset restores the *current* section, then swap.
  // Otherwise restore() later would paste section A's snapshot onto B permanently.
  if (state.playMode && liveVrSectionId && liveVrSectionId !== nextId) {
    stopPlayForSectionSwitch();
    toast(L('已退出运行模式并切换小节', 'Exited play mode and switched section'));
  }

  if (fillingVrSectionId) {
    // Allow leaving to reading/h5/quiz UI, but keep fill graph bound underneath
    if (nextId && nextId !== fillingVrSectionId) {
      const now = Date.now();
      if (now - fillLockToastAt > 2500) {
        fillLockToastAt = now;
        toast(L(
          '3D 小节生成中,请稍候再切换其他 3D 预览(避免场景串扰)',
          'A 3D section is generating — wait before previewing another 3D section'
        ));
      }
      // Revert outline highlight to the section still bound in the viewport
      // (avoid re-emitting if already correct — setActiveSection always emits)
      const curId = getActiveSection()?.section?.id;
      if (curId !== fillingVrSectionId) {
        setActiveSection(fillingVrSectionId);
      }
      return;
    }
    if (!nextId) {
      // Non-VR workspace: snapshot fill progress, keep liveVrSectionId = fill
      if (liveVrSectionId === fillingVrSectionId) {
        saveLiveSceneToSection(fillingVrSectionId, { includeCamera: false });
      }
      return;
    }
    // nextId === filling — already bound
    return;
  }

  if (liveVrSectionId && liveVrSectionId !== nextId) {
    saveLiveSceneToSection(liveVrSectionId);
  }

  if (nextId && nextId !== liveVrSectionId) {
    loadSectionScene(nextId);
    liveVrSectionId = nextId;
  } else if (!nextId) {
    // Non-VR workspace: keep last graph under the panels
  } else {
    liveVrSectionId = nextId;
  }
  sanitizeOrbitCamera();
}

/**
 * Before mutating tools during a VR fill: re-bind the fill section's graph.
 * Camera is NOT carried from the teacher's preview — always use section default.
 */
export function ensureVrFillSceneBound(sectionId) {
  if (!sectionId) return;
  if (liveVrSectionId === sectionId) return;
  if (liveVrSectionId && liveVrSectionId !== sectionId) {
    // Save outgoing section's objects only; don't let preview camera pollute fill
    saveLiveSceneToSection(liveVrSectionId, {
      includeCamera: liveVrSectionId !== fillingVrSectionId,
    });
  }
  const hit = findSection(sectionId);
  restoreSceneGraph(hit?.section?.vr?.scene || null);
  resetOrbitCamera(hit?.section?.vr?.camera ? clampCameraState(hit.section.vr.camera) : null);
  liveVrSectionId = sectionId;
  requestAnimationFrame(() => resize());
}

/**
 * After a fill tool: persist scene (not teacher preview camera), stay on fill graph.
 * Teacher cannot swap to other VR previews during fill (see syncLiveVrSceneWithOutline).
 */
export function restoreViewerAfterVrFillTool(fillSectionId) {
  if (!fillSectionId) return;
  if (liveVrSectionId === fillSectionId) {
    saveLiveSceneToSection(fillSectionId, { includeCamera: false });
  }
}

/**
 * Begin an isolated VR fill: bind section, clear live graph.
 */
export function beginVrSectionFill(sectionId) {
  if (liveVrSectionId && liveVrSectionId !== sectionId) {
    saveLiveSceneToSection(liveVrSectionId);
  }
  fillingVrSectionId = sectionId;
  liveVrSectionId = sectionId;
  clearScene(false);
  ensureStudentRig();
  resetOrbitCamera(null);
  saveLiveSceneToSection(sectionId, { includeCamera: true });
  emit('hierarchy-changed');
}

/** After tools finish building, snapshot into the section. */
export function finishVrSectionFill(sectionId, note = '') {
  ensureVrFillSceneBound(sectionId);
  const scene = captureSceneGraph();
  const cameraState = captureCameraState();
  const hit = findSection(sectionId);
  updateSection(sectionId, {
    vr: {
      ...(hit?.section?.vr || {}),
      scene,
      camera: cameraState,
      note: note || hit?.section?.vr?.note || '',
      savedAt: Date.now(),
    },
    buildStatus: 'done',
  });
  fillingVrSectionId = null;

  const active = getActiveSection();
  const wantId = active?.section?.type === 'vr' ? active.section.id : null;
  if (wantId && wantId !== sectionId) {
    loadSectionScene(wantId);
    liveVrSectionId = wantId;
  } else {
    liveVrSectionId = sectionId;
  }
  emit('hierarchy-changed');
}

/** Non-system teaching objects currently in the live scene (excludes student rig). */
export function countTeachingObjects() {
  let n = 0;
  for (const o of sceneRoot.children) {
    if (o.userData?.system || o.userData?.studentRig) continue;
    n += 1;
  }
  return n;
}
