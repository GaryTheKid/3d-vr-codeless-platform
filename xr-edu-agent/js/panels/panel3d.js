// ═══════════════════════════════════════════════════════════════
//  3D 教学面板系统:Canvas 贴图 → 平面网格
//  · makePanel   生成一块面板(静态 lines 或 live 实时刷新)
//  · attachLabel 挂在对象头顶(自动抵消缩放)
//  · addFreePanel 独立可拖动面板(进入场景层级)
//  · 文字按 measureText 自动加宽,避免「键 …… 值」左右重叠
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { sceneRoot } from '../core/three-setup.js';
import { state, assignOid } from '../core/state.js';
import { emit } from '../core/events.js';
import { L } from '../core/i18n.js';
import { resolvePanelPosition, nextLabelLocalOffset } from './panel-layout.js';

const PANEL_FONT = '"Segoe UI", "Microsoft YaHei", sans-serif';
// 桌面 3D 可读性:字号偏大;画布宽度按内容再加宽(宁大勿挤)
export const PANEL_CANVAS_W_MIN = 768;
export const PANEL_CANVAS_W_MAX = 1600;
export const PANEL_LINE_H = 76;
export const PANEL_TITLE_BLOCK = 104;
export const PANEL_BASE_H = 72;
export const PANEL_TITLE_PX = 56;
export const PANEL_BODY_PX = 46;
export const PANEL_VALUE_PX = 48;
export const PANEL_PAD_X = 40;
export const PANEL_KV_GAP = 56;
/** World-width defaults (meters) — prefer large panels over cramped text */
export const DEFAULT_LABEL_WIDTH = 3.2;
export const DEFAULT_PANEL_WIDTH = 4.2;
export const PANEL_WORLD_W_MAX = 7.5;

// Back-compat export used by older call sites
export const PANEL_CANVAS_W = PANEL_CANVAS_W_MIN;

function panelCanvasHeight(title, lineCount) {
  return PANEL_BASE_H + (title ? PANEL_TITLE_BLOCK : 0) + Math.max(lineCount, 1) * PANEL_LINE_H;
}

function measureCtx() {
  if (!measureCtx._c) {
    measureCtx._c = document.createElement('canvas').getContext('2d');
  }
  return measureCtx._c;
}

function lineTextWidth(ctx, line) {
  if (typeof line === 'string') {
    ctx.font = `${PANEL_BODY_PX}px ${PANEL_FONT}`;
    return ctx.measureText(line).width;
  }
  ctx.font = `${PANEL_BODY_PX}px ${PANEL_FONT}`;
  const kw = ctx.measureText(String(line.k ?? '')).width;
  ctx.font = `bold ${PANEL_VALUE_PX}px Consolas, "Microsoft YaHei", monospace`;
  const vw = ctx.measureText(String(line.v ?? '')).width;
  return { kw, vw, combined: kw + PANEL_KV_GAP + vw };
}

/** Canvas pixel width needed so title / rows don't collide. */
export function computePanelCanvasWidth(title, lines = []) {
  const ctx = measureCtx();
  let need = PANEL_CANVAS_W_MIN;
  if (title) {
    ctx.font = `bold ${PANEL_TITLE_PX}px ${PANEL_FONT}`;
    need = Math.max(need, ctx.measureText(String(title)).width + PANEL_PAD_X * 2 + 24);
  }
  for (const line of lines) {
    const m = lineTextWidth(ctx, line);
    if (typeof m === 'number') {
      need = Math.max(need, m + PANEL_PAD_X * 2);
    } else {
      // key left + value right needs full combined span
      need = Math.max(need, m.combined + PANEL_PAD_X * 2);
      // also room for "k: v" single-line fallback
      ctx.font = `${PANEL_BODY_PX}px ${PANEL_FONT}`;
      const joined = ctx.measureText(`${line.k}: ${line.v}`).width;
      need = Math.max(need, joined + PANEL_PAD_X * 2);
    }
  }
  return Math.min(PANEL_CANVAS_W_MAX, Math.ceil(need / 32) * 32);
}

/** Grow world width when canvas grew so glyphs stay readable in 3D. */
export function fitPanelWorldWidth(requestedWidth, canvasW) {
  const base = Math.max(requestedWidth || DEFAULT_PANEL_WIDTH, 1.2);
  const scale = canvasW / PANEL_CANVAS_W_MIN;
  // If content needed a wider canvas, enlarge the plane (cap for scene fit)
  const grown = scale > 1.05 ? base * Math.min(scale, 1.85) : base;
  return Math.min(PANEL_WORLD_W_MAX, Math.round(grown * 20) / 20);
}

function kvWouldOverlap(canvasW, kw, vw) {
  return PANEL_PAD_X + kw + PANEL_KV_GAP + vw + PANEL_PAD_X > canvasW;
}

export function drawPanel(pd) {
  const { canvas, ctx } = pd;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, 32);
  ctx.fillStyle = 'rgba(14, 17, 23, 0.92)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = pd.accent;
  ctx.stroke();
  let y = 36;
  if (pd.title) {
    ctx.fillStyle = pd.accent;
    ctx.font = `bold ${PANEL_TITLE_PX}px ${PANEL_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(pd.title, PANEL_PAD_X, y + PANEL_TITLE_PX);
    y += 92;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(34, y); ctx.lineTo(w - 34, y); ctx.stroke();
    y += 10;
  }
  const lines = (typeof pd.live === 'function' ? pd.live() : pd.lines) || [];
  const centered = !pd.title && lines.length === 1;
  lines.forEach(line => {
    if (line == null) return;
    if (typeof line === 'string') {
      ctx.fillStyle = '#c8cfd8';
      ctx.font = `${PANEL_BODY_PX}px ${PANEL_FONT}`;
      ctx.textAlign = centered ? 'center' : 'left';
      ctx.fillText(line, centered ? w / 2 : PANEL_PAD_X, y + 56);
    } else {
      const key = String(line.k ?? '');
      const val = String(line.v ?? '');
      ctx.font = `${PANEL_BODY_PX}px ${PANEL_FONT}`;
      const kw = ctx.measureText(key).width;
      ctx.font = `bold ${PANEL_VALUE_PX}px Consolas, "Microsoft YaHei", monospace`;
      const vw = ctx.measureText(val).width;
      if (kvWouldOverlap(w, kw, vw)) {
        // Still tight → single left-aligned "key: value" (never overlap)
        ctx.fillStyle = line.c || '#ffffff';
        ctx.font = `${PANEL_BODY_PX}px ${PANEL_FONT}`;
        ctx.textAlign = 'left';
        ctx.fillText(`${key}: ${val}`, PANEL_PAD_X, y + 56);
      } else {
        ctx.fillStyle = '#8a93a0';
        ctx.font = `${PANEL_BODY_PX}px ${PANEL_FONT}`;
        ctx.textAlign = 'left';
        ctx.fillText(key, PANEL_PAD_X, y + 56);
        ctx.fillStyle = line.c || '#ffffff';
        ctx.font = `bold ${PANEL_VALUE_PX}px Consolas, "Microsoft YaHei", monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(val, w - PANEL_PAD_X, y + 56);
      }
    }
    y += PANEL_LINE_H;
  });
  pd.tex.needsUpdate = true;
}

// 面板类型:'live' 实时数据面板(内容由 live() 代码每 0.15s 驱动,不可直接编辑文字)
//          'static' 静态内容面板(title/lines 就是内容本身,可在检查器直接编辑)
export const panelKind = mesh => (mesh.userData.panelData?.live ? 'live' : 'static');

function resizePanelMesh(mesh, pd, worldWidth) {
  const newH = pd.canvas.height;
  const newW = pd.canvas.width;
  pd.tex.dispose();
  pd.tex = new THREE.CanvasTexture(pd.canvas);
  pd.tex.anisotropy = 4;
  mesh.material.map = pd.tex;
  mesh.material.needsUpdate = true;
  const width = fitPanelWorldWidth(worldWidth, newW);
  const panelH = width * newH / newW;
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(width, panelH);
  mesh.userData.panelH = panelH;
}

function applyCanvasSize(pd, title, lines) {
  const lineCount = Math.max(lines.length, 1);
  const canvasW = computePanelCanvasWidth(title, lines);
  const canvasH = panelCanvasHeight(title, lineCount);
  const changed = pd.canvas.width !== canvasW || pd.canvas.height !== canvasH;
  pd.canvas.width = canvasW;
  pd.canvas.height = canvasH;
  return changed;
}

// 更新静态面板的文字内容(检查器直接编辑 / AI update_panel 工具共用):
// 行数/字宽变化时重算画布与平面,避免键值重叠
export function updatePanelContent(mesh, { title, lines }) {
  const pd = mesh.userData.panelData;
  if (!pd || pd.live) return;
  if (title !== undefined) pd.title = title;
  if (lines !== undefined) pd.lines = lines;
  const prevWorld = mesh.geometry.parameters.width;
  const changed = applyCanvasSize(pd, pd.title, pd.lines);
  if (changed) resizePanelMesh(mesh, pd, prevWorld);
  syncPanelSpec(mesh);
  drawPanel(pd);
}

/**
 * True only for a panelData that can actually draw (real canvas + texture).
 * JSON round-trips leave a zombie `{ canvas:{}, tex:{uuid…} }` that is truthy
 * but useless — treating it as live used to skip rehydrate and left white planes
 * after section switches (slimSnapshot strips the PNG material).
 */
export function isUsablePanelData(pd) {
  return !!(pd
    && typeof HTMLCanvasElement !== 'undefined'
    && pd.canvas instanceof HTMLCanvasElement
    && pd.ctx
    && pd.tex
    && (pd.tex.isTexture || pd.tex.isCanvasTexture));
}

function bindPanelMaterial(mesh, pd) {
  if (!mesh?.isMesh || !pd?.tex) return;
  if (mesh.material?.map === pd.tex) {
    pd.tex.needsUpdate = true;
    return;
  }
  const prev = mesh.material;
  if (prev?.map && prev.map !== pd.tex) {
    try { prev.map.dispose(); } catch { /* already disposed */ }
  }
  if (prev && typeof prev.dispose === 'function') {
    try { prev.dispose(); } catch { /* ignore */ }
  }
  mesh.material = new THREE.MeshBasicMaterial({
    map: pd.tex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
  mesh.renderOrder = 10;
}

// panelSpec:面板内容的 JSON 安全镜像,存在 mesh.userData 里随场景序列化
export function syncPanelSpec(mesh) {
  const pd = mesh.userData.panelData;
  if (!isUsablePanelData(pd)) return;
  let lines = pd.lines || [];
  if (typeof pd.live === 'function') {
    try { lines = pd.live() || lines; }
    catch (e) { console.warn('[panel3d] live() failed during sync', e); }
  }
  mesh.userData.panelSpec = {
    title: pd.title,
    lines,
    accent: pd.accent,
    width: mesh.geometry?.parameters?.width || DEFAULT_PANEL_WIDTH,
    live: typeof pd.live === 'function',
  };
}

/**
 * Rebuild (or repair) a panel mesh from panelSpec.
 * Always safe to call after ObjectLoader / section restore.
 */
export function rehydratePanel(mesh) {
  const spec = mesh.userData.panelSpec;
  if (!spec) return false;

  // Healthy panel from makePanel / builderCode — just re-bind + redraw
  if (isUsablePanelData(mesh.userData.panelData)) {
    bindPanelMaterial(mesh, mesh.userData.panelData);
    try { drawPanel(mesh.userData.panelData); }
    catch (e) { console.warn('[panel3d] redraw failed', spec.title, e); }
    return true;
  }

  // Drop zombie panelData left by JSON serialization
  delete mesh.userData.panelData;

  try {
    const canvas = document.createElement('canvas');
    const lines = Array.isArray(spec.lines) ? spec.lines.filter(l => l != null) : [];
    canvas.width = computePanelCanvasWidth(spec.title, lines);
    canvas.height = panelCanvasHeight(spec.title, Math.max(lines.length, 1));
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const pd = {
      canvas, ctx, tex,
      title: spec.title || '',
      lines,
      accent: spec.accent || '#4a9eff',
      live: null,
    };
    drawPanel(pd);
    const width = fitPanelWorldWidth(spec.width || DEFAULT_PANEL_WIDTH, canvas.width);
    const panelH = width * canvas.height / canvas.width;
    if (mesh.geometry) {
      try { mesh.geometry.dispose(); } catch { /* ignore */ }
    }
    mesh.geometry = new THREE.PlaneGeometry(width, panelH);
    bindPanelMaterial(mesh, pd);
    mesh.userData.panelData = pd;
    mesh.userData.panelH = panelH;
    mesh.userData.isBillboard = mesh.userData.isBillboard !== false;
    return true;
  } catch (e) {
    console.warn('[panel3d] rehydrate failed:', spec.title, e);
    return false;
  }
}

/** After loading a scene graph: repair every panel that has panelSpec. */
export function ensurePanelVisuals(root) {
  if (!root) return;
  root.traverse(o => {
    if (o.userData?.panelSpec) rehydratePanel(o);
  });
}

// 生成一块 3D 面板;live 传入函数则每 150ms 重绘一次(实时参数)
export function makePanel({ title = '', lines = [], width = DEFAULT_PANEL_WIDTH, accent = '#4a9eff', live = null, billboard = true }) {
  const resolvedLines = live ? live() : lines;
  const canvas = document.createElement('canvas');
  const lineCount = Math.max(resolvedLines.length, 1);
  canvas.width = computePanelCanvasWidth(title, resolvedLines);
  canvas.height = panelCanvasHeight(title, lineCount);
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const pd = { canvas, ctx, tex, title, lines, accent, live };
  drawPanel(pd);
  const worldW = fitPanelWorldWidth(width, canvas.width);
  const panelH = worldW * canvas.height / canvas.width;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, panelH),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  m.renderOrder = 10;
  m.userData.panelData = pd;
  m.userData.isBillboard = billboard;
  m.userData.panelH = panelH;
  syncPanelSpec(m);
  return m;
}

// 把标注面板挂到对象头顶(自动抵消对象缩放,保持面板世界尺寸恒定)
// 多块标注时左右错开,避免叠在同一视线里
export function attachLabel(obj, opts) {
  const s = obj.scale.x || 1;
  const panel = makePanel({ width: DEFAULT_LABEL_WIDTH, ...opts });
  const box = new THREE.Box3().setFromObject(obj);
  const topWorld = box.max.y - obj.position.y;
  const off = nextLabelLocalOffset(obj);
  panel.position.y = (topWorld + (opts.gap ?? 0.5) + panel.userData.panelH / 2) / s + off.y;
  panel.position.x = (opts.offsetX ?? off.x) / s;
  panel.scale.setScalar(1 / s);
  obj.add(panel);
  return panel;
}

// 独立的可拖动面板(作为场景对象,可用移动手柄摆放)
// 自动避让默认正面视角与其他自由面板,避免叠成一坨
export function addFreePanel(opts, pos) {
  const resolved = resolvePanelPosition(
    { x: pos?.x, y: pos?.y, z: pos?.z },
    { role: opts?.role || 'info' }
  );
  const g = new THREE.Group();
  g.add(makePanel({ width: DEFAULT_PANEL_WIDTH, ...opts }));
  g.position.set(resolved.x, resolved.y, resolved.z);
  assignOid(g);
  g.userData.icon = '📋';
  g.userData.panelRole = opts?.role || 'info';
  const fallback = L('面板', 'Panel');
  g.userData.displayName = opts.name || (opts.title || fallback).replace(/[^\u4e00-\u9fa5\w ··]/g, '').trim() || `${fallback} ${state.objCounter}`;
  sceneRoot.add(g);
  emit('hierarchy-changed');
  return g;
}
