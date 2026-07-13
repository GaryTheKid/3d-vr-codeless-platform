// ═══════════════════════════════════════════════════════════════
//  3D 教学面板系统:Canvas 贴图 → 平面网格
//  · makePanel   生成一块面板(静态 lines 或 live 实时刷新)
//  · attachLabel 挂在对象头顶(自动抵消缩放)
//  · addFreePanel 独立可拖动面板(进入场景层级)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { sceneRoot } from '../core/three-setup.js';
import { state, assignOid } from '../core/state.js';
import { emit } from '../core/events.js';
import { L } from '../core/i18n.js';

const PANEL_FONT = '"Segoe UI", "Microsoft YaHei", sans-serif';

export function drawPanel(pd) {
  const { canvas, ctx } = pd;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 28);
  ctx.fillStyle = 'rgba(14, 17, 23, 0.92)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = pd.accent;
  ctx.stroke();
  let y = 28;
  if (pd.title) {
    ctx.fillStyle = pd.accent;
    ctx.font = `bold 42px ${PANEL_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(pd.title, 36, y + 42);
    y += 72;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(w - 30, y); ctx.stroke();
    y += 8;
  }
  const lines = pd.live ? pd.live() : pd.lines;
  const centered = !pd.title && lines.length === 1;
  lines.forEach(line => {
    if (typeof line === 'string') {
      ctx.fillStyle = '#c8cfd8';
      ctx.font = `33px ${PANEL_FONT}`;
      ctx.textAlign = centered ? 'center' : 'left';
      ctx.fillText(line, centered ? w / 2 : 36, y + 44);
    } else {
      ctx.fillStyle = '#8a93a0';
      ctx.font = `33px ${PANEL_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(line.k, 36, y + 44);
      ctx.fillStyle = line.c || '#ffffff';
      ctx.font = 'bold 35px Consolas, "Microsoft YaHei", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(line.v, w - 36, y + 44);
    }
    y += 58;
  });
  pd.tex.needsUpdate = true;
}

// 面板类型:'live' 实时数据面板(内容由 live() 代码每 0.15s 驱动,不可直接编辑文字)
//          'static' 静态内容面板(title/lines 就是内容本身,可在检查器直接编辑)
export const panelKind = mesh => (mesh.userData.panelData?.live ? 'live' : 'static');

// 更新静态面板的文字内容(检查器直接编辑 / AI update_panel 工具共用):
// 行数变化时重算画布高度与平面网格,保持字号与宽度不变
export function updatePanelContent(mesh, { title, lines }) {
  const pd = mesh.userData.panelData;
  if (!pd || pd.live) return;
  if (title !== undefined) pd.title = title;
  if (lines !== undefined) pd.lines = lines;
  const lineCount = Math.max(pd.lines.length, 1);
  const newH = 56 + (pd.title ? 80 : 0) + lineCount * 58;
  if (newH !== pd.canvas.height) {
    pd.canvas.height = newH;
    // WebGL2 的贴图存储尺寸不可变:画布尺寸变了必须重建纹理并换到材质上,
    // 否则 GPU 上残留旧画面(表现为"新旧两块面板叠在一起、清空不生效")
    pd.tex.dispose();
    pd.tex = new THREE.CanvasTexture(pd.canvas);
    pd.tex.anisotropy = 4;
    mesh.material.map = pd.tex;
    mesh.material.needsUpdate = true;
    const width = mesh.geometry.parameters.width;
    const panelH = width * newH / pd.canvas.width;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(width, panelH);
    mesh.userData.panelH = panelH;
  }
  syncPanelSpec(mesh);
  drawPanel(pd);
}

// panelSpec:面板内容的 JSON 安全镜像,存在 mesh.userData 里随场景序列化
// (保存项目 / 导出 HTML 后可据此重建可编辑的面板,而不是只剩一张烤死的贴图)
export function syncPanelSpec(mesh) {
  const pd = mesh.userData.panelData;
  if (!pd) return;
  mesh.userData.panelSpec = {
    title: pd.title,
    lines: pd.live ? pd.live() : pd.lines,   // live 面板存当前快照
    accent: pd.accent,
    width: mesh.geometry.parameters.width,
    live: !!pd.live,
  };
}

// 从序列化的 panelSpec 重建 panelData(项目载入 / HTML 导入后调用):
// live 面板的驱动代码无法还原,降级为"静态快照"(spec.live 保留供 UI 标注)
export function rehydratePanel(mesh) {
  const spec = mesh.userData.panelSpec;
  if (!spec || mesh.userData.panelData) return;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 56 + (spec.title ? 80 : 0) + Math.max(spec.lines.length, 1) * 58;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const pd = { canvas, ctx, tex, title: spec.title, lines: spec.lines, accent: spec.accent, live: null };
  drawPanel(pd);
  const width = spec.width || 2;
  const panelH = width * canvas.height / canvas.width;
  if (mesh.geometry) mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(width, panelH);
  if (mesh.material?.map) mesh.material.map.dispose();
  mesh.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  mesh.renderOrder = 10;
  mesh.userData.panelData = pd;
  mesh.userData.panelH = panelH;
}

// 生成一块 3D 面板;live 传入函数则每 150ms 重绘一次(实时参数)
export function makePanel({ title = '', lines = [], width = 2, accent = '#4a9eff', live = null, billboard = true }) {
  const canvas = document.createElement('canvas');
  const lineCount = Math.max((live ? live() : lines).length, 1);
  canvas.width = 640;
  canvas.height = 56 + (title ? 80 : 0) + lineCount * 58;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const pd = { canvas, ctx, tex, title, lines, accent, live };
  drawPanel(pd);
  const panelH = width * canvas.height / canvas.width;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, panelH),
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
export function attachLabel(obj, opts) {
  const s = obj.scale.x || 1;
  const panel = makePanel(opts);
  const box = new THREE.Box3().setFromObject(obj);
  const topWorld = box.max.y - obj.position.y;
  panel.position.y = (topWorld + (opts.gap ?? 0.5) + panel.userData.panelH / 2) / s;
  panel.scale.setScalar(1 / s);
  obj.add(panel);
  return panel;
}

// 独立的可拖动面板(作为场景对象,可用移动手柄摆放)
export function addFreePanel(opts, pos) {
  const g = new THREE.Group();
  g.add(makePanel(opts));
  g.position.set(pos.x, pos.y ?? 2, pos.z);
  assignOid(g);
  g.userData.icon = '📋';
  const fallback = L('面板', 'Panel');
  g.userData.displayName = opts.name || (opts.title || fallback).replace(/[^\u4e00-\u9fa5\w ··]/g, '').trim() || `${fallback} ${state.objCounter}`;
  sceneRoot.add(g);
  emit('hierarchy-changed');
  return g;
}
