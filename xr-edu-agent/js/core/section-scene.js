// ═══════════════════════════════════════════════════════════════
//  Per-section 3D scene snapshot — each VR outline section owns its
//  own Three.js graph so pipeline fills don't overwrite each other.
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { sceneRoot, camera, orbit, resize, sanitizeOrbitCamera, resetOrbitCamera } from './three-setup.js';
import { state } from './state.js';
import { emit } from './events.js';
import { clearScene } from '../scene/manager.js';
import { syncPanelSpec, ensurePanelVisuals, isUsablePanelData } from '../panels/panel3d.js';
import { runBuilderCode, compileUpdate, compileClick, compileHandler } from '../agent/sandbox.js';
import { findAssetSkill } from '../assets/registry.js';
import { ensureStudentRig } from '../scene/student-rig.js';
import { findSection, updateSection, getActiveSection, setActiveSection, getOutline } from './outline.js';
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

/** Drop entries no remaining object references (they are pure payload). */
function pruneUnreferenced(json) {
  const usedGeo = new Set();
  const usedMat = new Set();
  const walk = node => {
    if (!node) return;
    if (node.geometry) usedGeo.add(node.geometry);
    if (Array.isArray(node.material)) node.material.forEach(m => usedMat.add(m));
    else if (node.material) usedMat.add(node.material);
    (node.children || []).forEach(walk);
  };
  walk(json.object);

  const out = { ...json };
  if (json.geometries) out.geometries = json.geometries.filter(g => usedGeo.has(g.uuid));
  if (json.materials) out.materials = json.materials.filter(m => usedMat.has(m.uuid));

  if (json.textures) {
    const texIds = new Set(json.textures.map(t => t.uuid));
    const usedTex = new Set();
    for (const m of out.materials || []) {
      for (const v of Object.values(m)) {
        if (typeof v === 'string' && texIds.has(v)) usedTex.add(v);
      }
    }
    out.textures = json.textures.filter(t => usedTex.has(t.uuid));
    if (json.images) {
      const usedImg = new Set(out.textures.map(t => t.image).filter(Boolean));
      out.images = json.images.filter(im => usedImg.has(im.uuid));
    }
  }
  return out;
}

/**
 * Strip payload that restore regenerates anyway:
 *  · top-level objects with builderCode — reviveObject re-runs the code and
 *    throws the deserialized mesh away
 *  · panel materials — rehydratePanel rebuilds the canvas texture from panelSpec
 * Panel canvases serialize as PNG data URLs and were the main reason saving a
 * course full of 3D sections blew the localStorage quota.
 */
export function slimSnapshot(json) {
  if (!json?.object) return json;
  const slim = (node, topLevel) => {
    const ud = node.userData || {};
    if (topLevel && ud.builderCode) {
      return {
        uuid: node.uuid,
        type: 'Object3D',
        name: node.name,
        matrix: node.matrix,
        ...(node.layers != null ? { layers: node.layers } : {}),
        ...(node.visible != null ? { visible: node.visible } : {}),
        userData: node.userData,
      };
    }
    const out = { ...node };
    if (ud.panelSpec) delete out.material;
    if (node.children) out.children = node.children.map(c => slim(c, false));
    return out;
  };
  const object = {
    ...json.object,
    children: (json.object.children || []).map(c => slim(c, true)),
  };
  return pruneUnreferenced({ ...json, object });
}

/** Capture live sceneRoot → Three.js ObjectLoader JSON (no outline/KG). */
export function captureSceneGraph() {
  sceneRoot.traverse(o => {
    if (isUsablePanelData(o.userData?.panelData)) {
      try { syncPanelSpec(o); }
      catch (e) { console.warn('[section-scene] syncPanelSpec failed', e); }
    } else if (o.userData?.panelData && o.userData?.panelSpec) {
      // Zombie panelData from an older save — drop before serialize
      delete o.userData.panelData;
    }
  });
  // Never persist a broken root transform into section snapshots
  sceneRoot.position.set(0, 0, 0);
  sceneRoot.rotation.set(0, 0, 0);
  sceneRoot.scale.set(1, 1, 1);
  const restore = stripUserData(sceneRoot);
  try {
    const json = slimSnapshot(sceneRoot.toJSON());
    // Belt-and-suspenders: never persist zombie panelData into section snapshots
    const scrub = node => {
      if (node?.userData?.panelData) delete node.userData.panelData;
      for (const c of node?.children || []) scrub(c);
    };
    scrub(json?.object);
    return json;
  } finally {
    restore();
  }
}

/**
 * True when the live viewport is empty because code cleared it (loading a
 * section that has no snapshot yet), not because the teacher deleted objects.
 * Lets saveLiveSceneToSection tell an intentional wipe from an accidental one.
 */
let liveGraphClearedByCode = false;

/** Geometry / material uuids used by one snapshot subtree. */
function collectSubtreeRefs(node, geo = new Set(), mat = new Set()) {
  if (!node) return { geo, mat };
  if (node.geometry) geo.add(node.geometry);
  if (Array.isArray(node.material)) node.material.forEach(m => mat.add(m));
  else if (node.material) mat.add(node.material);
  for (const c of node.children || []) collectSubtreeRefs(c, geo, mat);
  return { geo, mat };
}

/**
 * A one-child snapshot. Geometries are filtered to that subtree because
 * ObjectLoader parses the whole geometry array up front — one unsupported
 * entry would otherwise fail every child too.
 */
function isolateChildJson(sceneJson, child) {
  const { geo, mat } = collectSubtreeRefs(child);
  return {
    ...sceneJson,
    geometries: (sceneJson.geometries || []).filter(g => geo.has(g.uuid)),
    materials: (sceneJson.materials || []).filter(m => mat.has(m.uuid)),
    object: { ...sceneJson.object, children: [child] },
  };
}

function applySnapshotTransform(obj, childJson) {
  if (Array.isArray(childJson.matrix) && childJson.matrix.length === 16) {
    new THREE.Matrix4().fromArray(childJson.matrix).decompose(obj.position, obj.quaternion, obj.scale);
  } else {
    if (Array.isArray(childJson.position)) obj.position.fromArray(childJson.position);
    if (Array.isArray(childJson.scale)) obj.scale.fromArray(childJson.scale);
  }
  const s = obj.scale;
  const sane = [s.x, s.y, s.z].every(v => Number.isFinite(v) && Math.abs(v) > 1e-4);
  if (!sane) s.set(1, 1, 1);
}

/** Last resort for a child ObjectLoader rejects: re-run the code that made it. */
function rebuildChildFromUserData(childJson) {
  const ud = childJson?.userData || {};
  let obj = null;
  if (ud.builderCode) {
    try { obj = runBuilderCode(ud.builderCode); } catch (e) {
      console.warn('[section-scene] builderCode rebuild failed:', ud.displayName, e);
    }
  }
  if (!obj && ud.assetId) {
    const def = findAssetSkill(ud.assetId);
    if (def) {
      try { obj = def.build(); } catch (e) {
        console.warn('[section-scene] asset rebuild failed:', ud.assetId, e);
      }
    }
  }
  if (!obj) return null;
  applySnapshotTransform(obj, childJson);
  if (childJson.name) obj.name = childJson.name;
  const own = { ...obj.userData };
  Object.assign(obj.userData, ud, own);
  return obj;
}

/**
 * Parse children one at a time. Generated scenes sometimes contain a geometry
 * ObjectLoader cannot read (exotic types from create_custom_object code); the
 * old all-or-nothing parse turned that into a silently empty section.
 */
export function parseSceneChildren(sceneJson) {
  const objects = [];
  const lost = [];
  for (const child of sceneJson?.object?.children || []) {
    try {
      const parsed = new THREE.ObjectLoader().parse(isolateChildJson(sceneJson, child));
      objects.push(...parsed.children);
      continue;
    } catch (e) {
      console.warn('[section-scene] object parse failed:', child?.userData?.displayName || child?.name, e);
    }
    const rebuilt = rebuildChildFromUserData(child);
    if (rebuilt) objects.push(rebuilt);
    else lost.push(child?.userData?.displayName || child?.name || child?.type || '?');
  }
  return { objects, lost };
}

/**
 * Names of snapshot objects that cannot be read back and cannot be rebuilt
 * from their generator code — i.e. content that would vanish on restore.
 */
export function unrestorableSnapshotObjects(sceneJson) {
  if (!sceneJson) return [];
  try {
    new THREE.ObjectLoader().parse(sceneJson);
    return [];
  } catch { /* probe per object below */ }
  const bad = [];
  for (const child of sceneJson?.object?.children || []) {
    try {
      new THREE.ObjectLoader().parse(isolateChildJson(sceneJson, child));
    } catch {
      const ud = child.userData || {};
      if (!ud.builderCode && !ud.assetId) bad.push(ud.displayName || child.name || child.type || '?');
    }
  }
  return bad;
}

/** Replace live scene with a stored graph. Empty/null → clear. */
export function restoreSceneGraph(sceneJson) {
  liveGraphClearedByCode = !sceneJson;
  clearScene(false);
  sceneRoot.position.set(0, 0, 0);
  sceneRoot.rotation.set(0, 0, 0);
  sceneRoot.scale.set(1, 1, 1);
  if (!sceneJson) {
    ensureStudentRig();
    emit('hierarchy-changed');
    return;
  }
  let objects;
  let lost = [];
  try {
    objects = [...new THREE.ObjectLoader().parse(sceneJson).children];
  } catch (e) {
    console.warn('[section-scene] scene parse failed — recovering object by object:', e);
    const salvaged = parseSceneChildren(sceneJson);
    objects = salvaged.objects;
    lost = salvaged.lost;
  }
  try {
    for (const child of objects) sceneRoot.add(child);
    for (const child of [...sceneRoot.children]) reviveObject(child, sceneRoot);
    const rigs = sceneRoot.children.filter(o => o.userData.studentRig);
    for (const extra of rigs.slice(0, -1)) sceneRoot.remove(extra);
    ensureStudentRig();
    // Repair panels one-by-one (zombie panelData from JSON must not abort the rest)
    ensurePanelVisuals(sceneRoot);
    let maxOid = 0;
    sceneRoot.traverse(o => {
      const m = /^o(\d+)$/.exec(o.userData.oid || '');
      if (m) maxOid = Math.max(maxOid, +m[1]);
    });
    state.objCounter = Math.max(state.objCounter, maxOid);
  } catch (e) {
    console.warn('[section-scene] restore failed:', e);
    liveGraphClearedByCode = true;
    clearScene(false);
    ensureStudentRig();
  }
  if (lost.length) {
    toast(L(
      `${lost.length} 个 3D 对象无法还原(${lost.slice(0, 3).join('、')})`,
      `${lost.length} 3D object(s) could not be restored (${lost.slice(0, 3).join(', ')})`
    ));
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
export function saveLiveSceneToSection(sectionId, { includeCamera = true, allowEmpty = false } = {}) {
  const hit = findSection(sectionId);
  if (!hit || hit.section.type !== 'vr') return false;
  // Refuse to erase a filled section with a viewport that code emptied.
  // Deleting objects by hand still saves — that clears liveGraphClearedByCode.
  if (countTeachingObjects() > 0) liveGraphClearedByCode = false;
  if (!allowEmpty && liveGraphClearedByCode && countTeachingObjects() === 0) {
    const prevKids = hit.section.vr?.scene?.object?.children?.length || 0;
    if (prevKids > 1) {
      console.warn('[section-scene] blocked empty overwrite of', sectionId);
      return false;
    }
  }
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
  liveGraphClearedByCode = false;
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
  if (state.playMode && liveVrSectionId && liveVrSectionId !== nextId && !fillingVrSectionId) {
    stopPlayForSectionSwitch();
    toast(L('已退出运行模式并切换小节', 'Exited play mode and switched section'));
  }

  if (fillingVrSectionId) {
    // HARD PIN during fill: never restore/swap graphs. Outline "running" updates
    // used to call sync → restore an empty begin-snapshot → wipe the 2nd/3rd VR build.
    liveVrSectionId = fillingVrSectionId;
    if (nextId && nextId !== fillingVrSectionId) {
      const now = Date.now();
      if (now - fillLockToastAt > 2500) {
        fillLockToastAt = now;
        toast(L(
          '3D 小节生成中,请稍候再切换其他 3D 预览(避免场景串扰)',
          'A 3D section is generating — wait before previewing another 3D section'
        ));
      }
      const curId = getActiveSection()?.section?.id;
      if (curId !== fillingVrSectionId) {
        setActiveSection(fillingVrSectionId);
      }
    }
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
  // During an active fill of this section: never restore from disk.
  // beginVrSectionFill used to persist an EMPTY snapshot; restoring it mid-loop
  // wiped every object the 2nd/3rd VR sub-agent had just created.
  if (fillingVrSectionId === sectionId) {
    liveVrSectionId = sectionId;
    return;
  }
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
/** Tag whatever this fill just created, so no other section can inherit it. */
function stampFillOwnership(sectionId) {
  for (const o of sceneRoot.children) {
    if (o.userData?.system || o.userData?.studentRig) continue;
    if (!o.userData.vrSectionOwner) o.userData.vrSectionOwner = sectionId;
  }
}

export function restoreViewerAfterVrFillTool(fillSectionId) {
  if (!fillSectionId) return;
  // Always pin + save during fill — even if sync briefly stole the binding
  if (fillingVrSectionId === fillSectionId) {
    liveVrSectionId = fillSectionId;
    stampFillOwnership(fillSectionId);
  }
  if (liveVrSectionId === fillSectionId) {
    saveLiveSceneToSection(fillSectionId, { includeCamera: false });
  }
}

/**
 * Begin an isolated VR fill: bind section, clear live graph.
 * Does NOT persist an empty snapshot (that used to poison later restores).
 */
export function beginVrSectionFill(sectionId) {
  if (liveVrSectionId && liveVrSectionId !== sectionId) {
    saveLiveSceneToSection(liveVrSectionId);
  }
  fillingVrSectionId = sectionId;
  liveVrSectionId = sectionId;
  liveGraphClearedByCode = true;
  clearScene(false);
  ensureStudentRig();
  resetOrbitCamera(null);
  // Clear any prior snapshot for this section without writing a blank graph
  const hit = findSection(sectionId);
  updateSection(sectionId, {
    vr: {
      ...(hit?.section?.vr || {}),
      scene: null,
      camera: null,
      note: '',
      savedAt: 0,
    },
  }, { silent: true });
  // Keep outline highlight on the section being built (avoids sync fighting)
  try {
    if (getActiveSection()?.section?.id !== sectionId) {
      setActiveSection(sectionId);
    }
  } catch { /* ignore */ }
  emit('hierarchy-changed');
}

/** After tools finish building, snapshot into the section. */
export function finishVrSectionFill(sectionId, note = '') {
  // Capture the LIVE fill graph — do not restore-from-disk first
  if (fillingVrSectionId === sectionId || liveVrSectionId === sectionId) {
    liveVrSectionId = sectionId;
  } else {
    ensureVrFillSceneBound(sectionId);
  }
  // Isolation guarantee: a section ships only what its own fill created
  stampFillOwnership(sectionId);
  const foreign = sceneRoot.children.filter(o =>
    o.userData?.vrSectionOwner && o.userData.vrSectionOwner !== sectionId
    && !o.userData.system && !o.userData.studentRig);
  if (foreign.length) {
    console.warn('[section-scene] dropping', foreign.length, 'object(s) owned by another section');
    for (const o of foreign) sceneRoot.remove(o);
  }
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
  }, { silent: true });
  fillingVrSectionId = null;

  // Notify UI without going through the dangerous sync-before-unpin path
  emit('outline-changed', getOutline());
  emit('section-content-changed', { sectionId, section: findSection(sectionId)?.section });

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
