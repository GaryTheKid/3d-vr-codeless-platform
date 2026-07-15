// ═══════════════════════════════════════════════════════════════
//  单文件 HTML 导出:把当前场景打包成"学生播放器"
//
//  策略(双轨还原,保真度最高):
//  · 几何/材质/贴图:sceneRoot.toJSON()(Canvas 面板贴图自动烘焙成 dataURL 图片)
//  · 行为:userData 里的代码字符串(builderCode/updateCode/clickCode/...)原样嵌入,
//    播放器里用同款 T 工具箱重新编译;含 builderCode 的对象整体重建(连 live 面板、
//    构建时闭包里挂的 customUpdate/customClick 都能复活),失败则回退到序列化网格
//  · 播放器 = 蒸馏版运行时(动画switch/语义交互/XR控制器/locomotion/面板),无编辑 UI,
//    永远处于"运行模式";Three.js 走 CDN importmap(与编辑器同版本)
//
//  已知边界:内置实验模板(制氧/英语点餐)的状态机逻辑在 labs 模块里,不随导出——
//  其 expAction 对象点击时提示"请在编辑器中体验";live 面板若来自模板也会变静态图。
//  AI 生成的自定义实验(代码都在 userData)则完整可玩。
//
//  落盘:优先 POST /__export(server.py 写入项目 download/ 目录),
//  端点不可用(静态服务器)则降级为浏览器下载。
//
//  可回导:HTML 里内嵌 <script type="application/json" id="xr-scene-source">
//  数据块(magic + version + 场景 JSON),编辑器「📥 导入 HTML」据此校验并还原——
//  既是普通浏览器可直接打开的网页,又是本系统可读写的项目文件。
// ═══════════════════════════════════════════════════════════════
import { sceneRoot } from '../core/three-setup.js';
import { toast } from '../core/utils.js';
import { t, L, isEN } from '../core/i18n.js';
import { serializeScene } from '../core/projects.js';
import { getStudentSpawn } from '../scene/student-rig.js';

function sceneName() {
  const raw = document.getElementById('scene-tab-name')?.textContent.trim() || 'VR课';
  return raw.replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || 'VR课';
}

export async function exportScene() {
  if (!sceneRoot.children.length) { toast(t('export.empty')); return; }
  const data = serializeScene(sceneName());
  const cfg = {
    name: data.name,
    locomotion: data.cfg.locomotion,
    spawn: getStudentSpawn(),   // 学生出生点(「学生视角」代表物的位置与朝向)
    msgs: {
      builtin: L('这个内置实验的完整交互请在 XR EduAgent 编辑器中体验', 'Open this scene in the XR EduAgent editor for the full built-in experiment'),
      updErr: L('某个对象的自定义动画出错,已自动停用', 'A custom animation errored and was disabled'),
      scriptErr: L('交互脚本出错:', 'Interaction script error: '),
    },
  };
  const html = buildHTML(data, cfg);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const filename = `${cfg.name}-${stamp}.html`;

  // 优先:server.py 写入项目 download/ 目录
  try {
    const res = await fetch('/__export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: filename, html }),
    });
    if (res.ok) {
      const info = await res.json();
      toast(t('export.done', { path: info.path }));
      return;
    }
  } catch { /* 静态服务器没有该端点 → 浏览器下载 */ }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(t('export.browser'));
}

// ── 播放器 HTML 模板 ──
function buildHTML(data, cfg) {
  // 嵌入 <script> 的 JSON 必须转义 </script,防止提前闭合标签
  const esc = s => s.replace(/<\/script/gi, '<\\/script');
  const sceneStr = esc(JSON.stringify(data.scene));
  const cfgStr = esc(JSON.stringify(cfg));
  const sourceStr = esc(JSON.stringify(data));
  return `<!DOCTYPE html>
<html lang="${isEN() ? 'en' : 'zh-CN'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cfg.name} — XR EduAgent ${L('导出', 'Export')}</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #0a0c10; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }
  canvas { display: block; }
  #badge { position: fixed; top: 10px; left: 12px; color: #8a93a0; font-size: 12px; z-index: 5; user-select: none; }
  #badge b { color: #c8cfd8; }
  #toasts { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; }
  .toast { background: rgba(20,23,28,0.94); color: #e6eaf0; border: 1px solid #2b3644; border-radius: 8px; padding: 8px 16px; font-size: 13px; max-width: 80vw; transition: opacity 0.4s; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>
</head>
<body>
<div id="badge"><b>${cfg.name}</b> · ${L('XR EduAgent 导出 · 点击对象即可交互,戴上头显点 ENTER VR', 'Exported by XR EduAgent · Click objects to interact, or put on a headset and press ENTER VR')}</div>
<div id="toasts"></div>
<script type="application/json" id="xr-scene-source">${sourceStr}</script>
<script>
window.__SCENE = ${sceneStr};
window.__CFG = ${cfgStr};
</script>
<script type="module">
${PLAYER_SRC}
</script>
</body>
</html>`;
}

// ── 播放器运行时(蒸馏自 three-setup/loop/interaction/locomotion/panel3d/sandbox,
//    注意:此模板内不要用反引号与 \${,它整体位于模板字符串中)──
const PLAYER_SRC = String.raw`
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CFG = window.__CFG;
const LOCO = CFG.locomotion || { mode: 'static', allowedRadius: 0, turnMode: 'snap' };
const MSG = CFG.msgs || {};

// ═══ 基础场景 ═══
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c10);
scene.fog = new THREE.Fog(0x0a0c10, 40, 90);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(9, 7, 12);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
scene.add(new THREE.HemisphereLight(0x8fb4dd, 0x1c2028, 0.75));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(8, 14, 6);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -25; dirLight.shadow.camera.right = 25;
dirLight.shadow.camera.top = 25; dirLight.shadow.camera.bottom = -25;
scene.add(dirLight);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 0.95 })
);
ground.receiveShadow = true;
scene.add(ground);
const orbitCtl = new OrbitControls(camera, renderer.domElement);
orbitCtl.target.set(0, 1.5, 0);
orbitCtl.enableDamping = true;
orbitCtl.dampingFactor = 0.08;
orbitCtl.maxPolarAngle = Math.PI / 2 + 0.05;
const clock = new THREE.Clock();

// ═══ Toast(同文 5s 去重,防 AI 行为代码刷屏)═══
const toastBox = document.getElementById('toasts');
const _recent = new Map();
function toast(msg) {
  msg = String(msg).replace(/<[^>]+>/g, '');
  const now = performance.now();
  if (now - (_recent.get(msg) || -1e9) < 5000) return;
  _recent.set(msg, now);
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  toastBox.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; }, 2600);
  setTimeout(() => el.remove(), 3100);
}

// ═══ 3D 积木 + 面板(与编辑器同一套 API,AI 生成代码依赖它们)═══
function mat(color, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.08 }, opts || {})); }
function mesh(geo, material) { const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true; return m; }
function bond(p1, p2, radius, color) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const m = mesh(new THREE.CylinderGeometry(radius || 0.07, radius || 0.07, dir.length(), 10), mat(color || 0xcfd6e0));
  m.position.copy(p1).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}
function at(obj, y) { obj.position.y = y; return obj; }
const PANEL_FONT = '"Segoe UI", "Microsoft YaHei", sans-serif';
function drawPanel(pd) {
  const canvas = pd.canvas, ctx = pd.ctx, w = canvas.width, h = canvas.height;
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
    ctx.font = 'bold 42px ' + PANEL_FONT;
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
      ctx.font = '33px ' + PANEL_FONT;
      ctx.textAlign = centered ? 'center' : 'left';
      ctx.fillText(line, centered ? w / 2 : 36, y + 44);
    } else {
      ctx.fillStyle = '#8a93a0';
      ctx.font = '33px ' + PANEL_FONT;
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
function makePanel(opts) {
  opts = opts || {};
  const title = opts.title || '', lines = opts.lines || [], width = opts.width || 2;
  const accent = opts.accent || '#4a9eff', live = opts.live || null;
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
  m.userData.isBillboard = opts.billboard !== false;
  m.userData.panelH = panelH;
  return m;
}
function attachLabel(obj, opts) {
  const s = obj.scale.x || 1;
  const panel = makePanel(opts);
  const box = new THREE.Box3().setFromObject(obj);
  const topWorld = box.max.y - obj.position.y;
  panel.position.y = (topWorld + (opts.gap === undefined ? 0.5 : opts.gap) + panel.userData.panelH / 2) / s;
  panel.scale.setScalar(1 / s);
  obj.add(panel);
  return panel;
}
const T = {
  THREE, mat, mesh, bond, at, group: () => new THREE.Group(), attachLabel, makePanel, toast, say: toast,
  // 玩家感知助手(与编辑器同 API):近接触发 / 投放判定 / 传送 / 世界内提示
  playerPos: () => {
    if (renderer.xr.isPresenting) return worldToContent(new THREE.Vector3(0, 0, 0));
    return new THREE.Vector3(camera.position.x, 0, camera.position.z);
  },
  distToPlayer: obj => {
    const p = T.playerPos();
    const w = obj.getWorldPosition(new THREE.Vector3());
    return Math.hypot(w.x - p.x, w.z - p.z);
  },
  overlaps: (a, b, margin) => {
    const ba = new THREE.Box3().setFromObject(a).expandByScalar(margin || 0);
    return ba.intersectsBox(new THREE.Box3().setFromObject(b));
  },
  teleportStudent: (x, z, y) => {
    if (renderer.xr.isPresenting) { standAt(new THREE.Vector3(x, y || 0, z)); return; }
    // 非 XR:直接把观察相机搬过去(保持当前视线方向)
    const dx = x - camera.position.x, dz = z - camera.position.z;
    camera.position.x += dx; camera.position.z += dz;
    camera.position.y += (y || 0) + 1.6 - camera.position.y;
    orbitCtl.target.x += dx; orbitCtl.target.z += dz;
    orbitCtl.target.y = (y || 0) + 1.4;
  },
  setSolid: (obj, on) => {
    obj.userData.solid = on !== false;
    rebuildSolids();
  },
  notify: (text, opts) => {
    opts = opts || {};
    const str = String(text);
    const lines = [];
    for (const seg of str.split('\n')) {
      for (let i = 0; i < seg.length || i === 0; i += 16) lines.push(seg.slice(i, i + 16));
    }
    const panel = makePanel({ title: opts.title || '', lines, width: 1.6, accent: opts.accent || '#f0c840' });
    const g = new THREE.Group();
    g.add(panel);
    const at_ = opts.at;
    if (at_ && at_.isObject3D) {
      const box = new THREE.Box3().setFromObject(at_);
      const p = at_.getWorldPosition(new THREE.Vector3());
      g.position.set(p.x, (isFinite(box.max.y) ? box.max.y : p.y + 1.5) + 0.5, p.z);
    } else if (at_ && at_.x !== undefined) {
      g.position.set(at_.x, at_.y === undefined ? 1.8 : at_.y, at_.z);
    } else {
      const p = T.playerPos();
      g.position.set(p.x, (p.y || 0) + 1.6, p.z);
    }
    sceneRoot.add(g);
    const dur = (opts.duration || Math.min(10, Math.max(2.5, 1.5 + str.length * 0.09))) * 1000;
    setTimeout(() => { if (g.parent) g.parent.remove(g); }, dur);
    return g;
  },
};

// ═══ 场景还原:序列化网格兜底 + builderCode 整体重建(复活 live 面板与构建期闭包)═══
const sceneRoot = new THREE.ObjectLoader().parse(window.__SCENE);
scene.add(sceneRoot);
function compileUpdate(c) { const f = new Function('dt', 't', 'obj', 'T', 'THREE', "'use strict';\n" + c); return (dt, t, o) => f(dt, t, o, T, THREE); }
function compileClick(c) { const f = new Function('obj', 'T', 'THREE', "'use strict';\n" + c); return o => f(o, T, THREE); }
function compileHandler(c) { const f = new Function('obj', 'detail', 'T', 'THREE', "'use strict';\n" + c); return (o, d) => f(o, d || {}, T, THREE); }
for (const old of [...sceneRoot.children]) {
  let obj = old;
  const ud = old.userData;
  if (ud.editorOnly) { sceneRoot.remove(old); continue; }   // 编辑器专用对象(学生视角代表物)不进播放器
  // 导览路线(非内容)是老师的设计辅助线,学生不该看到
  if (ud.guideKind === 'path' && ud.guideRole !== 'content') { sceneRoot.remove(old); continue; }
  if (ud.builderCode) {
    try {
      const built = new Function('T', 'THREE', "'use strict';\n" + ud.builderCode)(T, THREE);
      if (built && built.isObject3D) {
        built.position.copy(old.position);
        built.rotation.copy(old.rotation);
        built.scale.copy(old.scale);
        built.name = old.name;
        const own = Object.assign({}, built.userData);   // 构建代码挂的函数优先保留
        Object.assign(built.userData, ud, own);
        sceneRoot.remove(old);
        sceneRoot.add(built);
        obj = built;
      }
    } catch (e) { console.warn('[export] 重建失败,使用序列化网格兜底:', ud.displayName, e); }
  }
  const u = obj.userData;
  try {
    if (u.updateCode) u.customUpdate = compileUpdate(u.updateCode);
    if (u.clickCode) u.customClick = compileClick(u.clickCode);
    if (u.grabCode) u.onGrab = compileHandler(u.grabCode);
    if (u.dragCode) u.onDrag = compileHandler(u.dragCode);
    if (u.releaseCode) u.onRelease = compileHandler(u.releaseCode);
  } catch (e) { console.warn('[export] 行为编译失败:', u.displayName, e); }
}

// ═══ 实心碰撞盒(userData.solid;高度感知:楼梯/二层可踩,墙按脚底高度拦挡)═══
let solidBoxes = [];
function rebuildSolids() {
  const R = 0.28, b = new THREE.Box3();
  solidBoxes = [];
  sceneRoot.updateWorldMatrix(true, true);
  sceneRoot.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    let solid = false;
    for (let p = o; p && p !== sceneRoot; p = p.parent) {
      if (p.userData.solid === false) { solid = false; break; }
      if (p.userData.solid) { solid = true; break; }
    }
    if (!solid) return;
    b.setFromObject(o);
    solidBoxes.push({ minX: b.min.x - R, maxX: b.max.x + R, minZ: b.min.z - R, maxZ: b.max.z + R, minY: b.min.y, maxY: b.max.y });
  });
}
rebuildSolids();
const STEP_UP = 0.45, BODY_H = 1.75;
function wallsFor(b, feetY) { return b.maxY > feetY + STEP_UP && b.minY < feetY + BODY_H; }
function pointBlocked(x, z, feetY) {
  feetY = feetY || 0;
  for (const b of solidBoxes) {
    if (!wallsFor(b, feetY)) continue;
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
  }
  return false;
}
function groundHeightAt(x, z, feetY) {
  feetY = feetY || 0;
  let h = 0;
  for (const b of solidBoxes) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
    if (b.maxY <= feetY + STEP_UP && b.maxY > h) h = b.maxY;
  }
  return h;
}
function segBlocked(x1, z1, x2, z2, feetY) {
  feetY = feetY || 0;
  for (const b of solidBoxes) {
    if (!wallsFor(b, feetY)) continue;
    const dx = x2 - x1, dz = z2 - z1;
    let tmin = 0, tmax = 1, miss = false;
    for (const seg of [[dx, x1, b.minX, b.maxX], [dz, z1, b.minZ, b.maxZ]]) {
      const d = seg[0], p = seg[1], lo = seg[2], hi = seg[3];
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { miss = true; break; } }
      else {
        let t1 = (lo - p) / d, t2 = (hi - p) / d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) { miss = true; break; }
      }
    }
    if (!miss) return true;
  }
  return false;
}
function resolveMove(fx, fz, tx, tz, feetY) {
  if (!solidBoxes.length || !pointBlocked(tx, tz, feetY)) return { x: tx, z: tz };
  if (!pointBlocked(tx, fz, feetY)) return { x: tx, z: fz };
  if (!pointBlocked(fx, tz, feetY)) return { x: fx, z: tz };
  return { x: fx, z: fz };
}

// ═══ 语义交互分发(蒸馏自 interaction.js;内置实验状态机不随导出)═══
function getH(obj, evt) {
  const u = obj.userData;
  if (evt === 'activate') return u.onActivate || u.customClick;
  return u['on' + evt[0].toUpperCase() + evt.slice(1)];
}
function isInteractable(obj) {
  return !!(obj.userData.expAction || getH(obj, 'activate') || getH(obj, 'grab') || getH(obj, 'drag'));
}
// ═══ 平台级交互反馈:hover 发光 + 点击闪烁(与编辑器同逻辑)═══
let hovered = null;
const _glowSaved = new Map();
function applyGlow(obj, hex, intensity) {
  obj.traverse(o => {
    const m = o.material;
    if (!o.isMesh || !m || !m.emissive) return;
    if (!_glowSaved.has(m)) _glowSaved.set(m, { hex: m.emissive.getHex(), i: m.emissiveIntensity });
    m.emissive.setHex(hex);
    m.emissiveIntensity = intensity;
  });
}
function clearGlow(obj) {
  obj.traverse(o => {
    const m = o.material;
    if (!o.isMesh || !m || !_glowSaved.has(m)) return;
    const s = _glowSaved.get(m);
    m.emissive.setHex(s.hex);
    m.emissiveIntensity = s.i;
    _glowSaved.delete(m);
  });
}
function setHover(obj) {
  if (obj === hovered) return;
  if (hovered) clearGlow(hovered);
  hovered = obj;
  if (hovered) applyGlow(hovered, 0x3d7dd6, 0.45);
}
function flash(obj) {
  if (hovered === obj) clearGlow(obj);
  applyGlow(obj, 0x8fc4ff, 1.2);
  setTimeout(() => {
    clearGlow(obj);
    if (hovered === obj) applyGlow(obj, 0x3d7dd6, 0.45);
  }, 160);
}
function dispatch(obj, evt, detail) {
  if (evt === 'activate' && obj.userData.expAction && !getH(obj, 'activate')) {
    flash(obj);
    toast(MSG.builtin || 'Open this scene in the XR EduAgent editor for the full experiment');
    return true;
  }
  const h = getH(obj, evt);
  if (!h) return false;
  if (evt === 'activate') flash(obj);
  try { h(obj, detail || {}); } catch (e) { toast((MSG.scriptErr || 'Script error: ') + e.message); }
  return true;
}
function topLevel(o) { while (o.parent && o.parent !== sceneRoot) o = o.parent; return o; }

// ═══ PC Interactor:点击=activate,按住可抓对象拖动=grab/drag/release ═══
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let downPos = null, grabbing = null;
function setPointer(e) {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}
function hitTop() {
  const hits = raycaster.intersectObjects(sceneRoot.children, true);
  return hits.length ? { obj: topLevel(hits[0].object), point: hits[0].point } : null;
}
renderer.domElement.addEventListener('pointerdown', e => {
  downPos = { x: e.clientX, y: e.clientY };
  if (e.button !== 0) return;
  setPointer(e);
  const hit = hitTop();
  if (hit && getH(hit.obj, 'grab')) {
    grabbing = hit.obj;
    orbitCtl.enabled = false;
    dispatch(hit.obj, 'grab', { point: hit.point });
  }
});
let lastHover = 0;
renderer.domElement.addEventListener('pointermove', e => {
  if (grabbing) {
    setPointer(e);
    const p = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
    if (p) dispatch(grabbing, 'drag', { point: p });
    return;
  }
  const now = performance.now();
  if (now - lastHover < 60) return;
  lastHover = now;
  setPointer(e);
  const hit = hitTop();
  const target = hit && isInteractable(hit.obj) ? hit.obj : null;
  setHover(target);
  renderer.domElement.style.cursor = target ? 'pointer' : '';
});
addEventListener('pointerup', e => {
  if (grabbing) {
    dispatch(grabbing, 'release', {});
    grabbing = null;
    orbitCtl.enabled = true;
    downPos = null;
    return;
  }
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 5) return;
  setPointer(e);
  const hit = hitTop();
  if (hit) dispatch(hit.obj, 'activate', { point: hit.point });
});

// ═══ XR Interactor + Locomotion(蒸馏自 interaction.js / locomotion.js)═══
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _head = new THREE.Vector3();
const _right = new THREE.Vector3();
const playerSpace = new THREE.Group();
scene.add(playerSpace);
function syncPlayerSpace() {
  playerSpace.rotation.y = -scene.rotation.y;
  playerSpace.position.copy(scene.position).negate().applyAxisAngle(Y_AXIS, -scene.rotation.y);
}
function worldToContent(w) { return w.clone().sub(scene.position).applyAxisAngle(Y_AXIS, -scene.rotation.y); }
function standAt(q) {
  const s = q.clone().applyAxisAngle(Y_AXIS, scene.rotation.y).negate();
  scene.position.x = s.x;
  scene.position.z = s.z;
  scene.position.y = -(q.y || 0);   // q.y = 脚底高度(楼梯/二层)
}
function clampToArea(q) {
  if (LOCO.allowedRadius > 0) {
    const r = Math.hypot(q.x, q.z);
    if (r > LOCO.allowedRadius) { const s = LOCO.allowedRadius / r; q.x *= s; q.z *= s; }
  }
  q.y = 0;
  return q;
}
function rotateWorld(angle) {
  scene.rotation.y += angle;
  scene.position.applyAxisAngle(Y_AXIS, angle);
}
function xrHit(c) {
  _mat4.identity().extractRotation(c.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_mat4);
  const hits = raycaster.intersectObjects(sceneRoot.children, true);
  return hits.length ? { obj: topLevel(hits[0].object), point: hits[0].point } : null;
}
const controllers = [];
for (const i of [0, 1]) {
  const c = renderer.xr.getController(i);
  playerSpace.add(c);
  controllers.push(c);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.6 })
  );
  line.scale.z = 6;
  c.add(line);
  c.addEventListener('selectstart', () => {
    const hit = xrHit(c);
    if (hit && dispatch(hit.obj, 'activate', { point: hit.point })) return;
    if (LOCO.mode === 'teleport' || LOCO.mode === 'smooth') {
      raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
      _mat4.identity().extractRotation(c.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_mat4);
      // 地面之外也可指向楼梯/二层地板等可踩表面
      const g = raycaster.intersectObjects([ground, sceneRoot], true);
      if (g.length && LOCO.mode === 'teleport') {
        const q = clampToArea(worldToContent(g[0].point));
        const cur = worldToContent(new THREE.Vector3(0, 0, 0));
        const feet = Math.max(0, cur.y);
        // 碰撞:落点在实心体内 / 传送线穿墙 → 无效(必须从门洞走)
        if (!pointBlocked(q.x, q.z, feet) && !segBlocked(cur.x, cur.z, q.x, q.z, feet)) {
          q.y = groundHeightAt(q.x, q.z, feet);
          standAt(q);
        }
      }
    }
  });
  c.addEventListener('squeezestart', () => {
    const hit = xrHit(c);
    if (hit && getH(hit.obj, 'grab')) { c.userData.grabbed = hit.obj; dispatch(hit.obj, 'grab', { point: hit.point }); }
  });
  c.addEventListener('squeezeend', () => {
    if (c.userData.grabbed) { dispatch(c.userData.grabbed, 'release', {}); c.userData.grabbed = null; }
  });
}
renderer.xr.addEventListener('sessionstart', () => {
  const sp = CFG.spawn;
  if (sp) {
    scene.rotation.y = -sp.yaw;
    const c = Math.cos(-sp.yaw), s = Math.sin(-sp.yaw);
    scene.position.set(-(sp.x * c + sp.z * s), -(sp.y || 0), -(-sp.x * s + sp.z * c));
  } else {
    scene.position.set(0, 0, -5);
  }
});
renderer.xr.addEventListener('sessionend', () => { scene.position.set(0, 0, 0); scene.rotation.y = 0; teleMarker.visible = false; wasAiming = false; if (mirror) mirror.canvas.style.display = 'none'; });
// Unity XRI 风格摇杆瞬移:前推摇杆瞄准(落点环:蓝=可去/红=不可),松开瞬移
const teleMarker = new THREE.Group();
{
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.035, 12, 40).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.9, depthTest: false })
  );
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.45, depthTest: false })
  );
  ring.renderOrder = 999; dot.renderOrder = 999;
  teleMarker.add(ring, dot);
  teleMarker.visible = false;
  scene.add(teleMarker);
}
const _aimQ = new THREE.Vector3();
let wasAiming = false, aimValid = false;
function aimTeleport(c) {
  _mat4.identity().extractRotation(c.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_mat4);
  const hits = raycaster.intersectObjects([ground, sceneRoot], true);
  if (!hits.length) { teleMarker.visible = false; aimValid = false; return; }
  const q = clampToArea(worldToContent(hits[0].point));
  const cur = worldToContent(new THREE.Vector3(0, 0, 0));
  const feet = Math.max(0, cur.y);
  aimValid = !pointBlocked(q.x, q.z, feet) && !segBlocked(cur.x, cur.z, q.x, q.z, feet);
  q.y = groundHeightAt(q.x, q.z, feet);
  _aimQ.copy(q);
  teleMarker.position.set(q.x, q.y + 0.02, q.z);
  teleMarker.visible = true;
  const color = aimValid ? 0x4a9eff : 0xe5534b;
  teleMarker.children.forEach(m => m.material.color.setHex(color));
}
function updateLocomotion(dt) {
  if (!renderer.xr.isPresenting || LOCO.mode === 'static') { teleMarker.visible = false; wasAiming = false; return; }
  const session = renderer.xr.getSession();
  if (!session) return;
  let aimingNow = false;
  let idx = -1;
  for (const src of session.inputSources) {
    idx++;
    const axes = src.gamepad && src.gamepad.axes;
    if (!axes || axes.length < 4) continue;
    const ax = axes[2], ay = axes[3];
    // 瞬移模式:前推摇杆瞄准,松开传送(循环尾统一处理)
    const aimingThis = LOCO.mode === 'teleport' && ay < -0.5;
    if (aimingThis && !aimingNow) { aimingNow = true; aimTeleport(renderer.xr.getController(idx)); }
    if (LOCO.mode === 'smooth' && src.handedness === 'left' && (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15)) {
      renderer.xr.getCamera().getWorldDirection(_head);
      _head.y = 0; _head.normalize();
      _right.set(-_head.z, 0, _head.x);
      const move = new THREE.Vector3().addScaledVector(_head, -ay * 2.2 * dt).addScaledVector(_right, ax * 2.2 * dt);
      const q = clampToArea(worldToContent(move));
      const cur = worldToContent(new THREE.Vector3(0, 0, 0));
      const feet = Math.max(0, cur.y);
      const slid = resolveMove(cur.x, cur.z, q.x, q.z, feet);   // 撞墙贴墙滑动
      q.x = slid.x; q.z = slid.z;
      q.y = groundHeightAt(q.x, q.z, feet);   // 楼梯逐级上升 / 走出边缘回落
      if (feet - q.y <= 0.6) standAt(q);      // 悬崖保护:平滑移动不走出 >0.6 米跌落沿
    }
    // 转向:瞬移模式双手左右皆可(瞄准中不转);平滑模式右手(左手是移动)
    const canTurn = LOCO.mode === 'teleport' ? !aimingThis : src.handedness === 'right';
    if (canTurn) {
      if (Math.abs(ax) > 0.6) {
        if (LOCO.turnMode === 'snap') {
          if (!src._turned) { src._turned = true; rotateWorld(ax > 0 ? Math.PI / 4 : -Math.PI / 4); }
        } else {
          rotateWorld((ax > 0 ? 1 : -1) * 1.6 * dt);
        }
      } else {
        src._turned = false;
      }
    }
  }
  if (!aimingNow) {
    if (wasAiming && aimValid) standAt(_aimQ);
    teleMarker.visible = false;
  }
  wasAiming = aimingNow;
}
// PC 方向键行走
const keysDown = new Set();
addEventListener('keydown', e => { if (e.key.startsWith('Arrow')) { keysDown.add(e.key); e.preventDefault(); } });
addEventListener('keyup', e => keysDown.delete(e.key));
function updatePCWalk(dt) {
  if (renderer.xr.isPresenting || !keysDown.size) return;
  camera.getWorldDirection(_head);
  _head.y = 0; _head.normalize();
  _right.set(-_head.z, 0, _head.x);
  const move = new THREE.Vector3();
  if (keysDown.has('ArrowUp')) move.add(_head);
  if (keysDown.has('ArrowDown')) move.addScaledVector(_head, -1);
  if (keysDown.has('ArrowLeft')) move.addScaledVector(_right, -1);
  if (keysDown.has('ArrowRight')) move.add(_right);
  if (!move.lengthSq()) return;
  move.normalize().multiplyScalar(4.4 * dt);
  camera.position.add(move);
  orbitCtl.target.add(move);
}

// ═══ 房间内 UI 面板可见性(与编辑器 room-ui-visibility.js 同规则)═══
// 观看者在房间外 → 该房间内面板隐藏(面板常伸出墙外被切一半);在房间内 → 面板顶层渲染不被遮挡
const _ruvViewer = new THREE.Vector3();
const _ruvP = new THREE.Vector3();
const _ruvLocal = new THREE.Vector3();
const ruvTouched = new Map();
let ruvTimer = 0;
function ruvInside(room, p) {
  const b = room.userData.roomBounds;
  _ruvLocal.copy(p);
  room.worldToLocal(_ruvLocal);
  return Math.abs(_ruvLocal.x) < b.w / 2 && Math.abs(_ruvLocal.z) < b.d / 2 && _ruvLocal.y > -0.5 && _ruvLocal.y < b.h + 0.6;
}
function ruvApply(mesh, mode) {
  const prev = ruvTouched.get(mesh);
  if (mode === 'normal') {
    if (prev) {
      mesh.visible = prev.visible;
      if (mesh.material) mesh.material.depthTest = prev.depthTest;
      mesh.renderOrder = prev.renderOrder;
      ruvTouched.delete(mesh);
    }
    return;
  }
  if (!prev) ruvTouched.set(mesh, { visible: mesh.visible, depthTest: mesh.material ? mesh.material.depthTest : true, renderOrder: mesh.renderOrder });
  if (mode === 'hide') mesh.visible = false;
  else {
    mesh.visible = ruvTouched.get(mesh).visible;
    if (mesh.material) mesh.material.depthTest = false;
    mesh.renderOrder = 1000;
  }
}
function updateRoomUI(dt) {
  ruvTimer += dt;
  if (ruvTimer < 0.2) return;
  ruvTimer = 0;
  const rooms = sceneRoot.children.filter(o => o.visible && o.userData.roomBounds);
  if (!rooms.length) return;
  (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldPosition(_ruvViewer);
  const viewerIn = rooms.filter(r => ruvInside(r, _ruvViewer));
  const seen = new Set();
  sceneRoot.traverse(o => {
    if (!o.userData.panelData && !o.userData.isBillboard) return;
    seen.add(o);
    o.getWorldPosition(_ruvP);
    const room = rooms.find(r => ruvInside(r, _ruvP));
    if (!room) ruvApply(o, 'normal');
    else if (viewerIn.indexOf(room) >= 0) ruvApply(o, 'top');
    else ruvApply(o, 'hide');
  });
  ruvTouched.forEach((v, mesh) => { if (!seen.has(mesh)) ruvTouched.delete(mesh); });
}

// ═══ 主循环(蒸馏自 loop.js:面板朝向/live 重绘/动画 switch/customUpdate 保险丝)═══
const _camQuat = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();
// VR 会话时 PC 镜像:独立第二渲染器(独立画布/GL 上下文,共享场景图),
// 避免"临时关 renderer.xr 再渲到页面画布"与 XR framebuffer 状态打架导致黑屏;30fps + pixelRatio 1 控开销
const mirrorCam = new THREE.PerspectiveCamera(70, 4 / 3, 0.1, 500);
const _mirrorScale = new THREE.Vector3();
let mirror = null;
let mirrorTimer = 1;
function ensureMirror() {
  if (mirror) return mirror;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none;background:#0a0c10;';
  document.body.insertBefore(canvas, document.body.firstChild);
  const r = new THREE.WebGLRenderer({ canvas, antialias: false });
  r.setPixelRatio(1);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  mirror = { r, canvas };
  return mirror;
}
function renderMirror(dt) {
  const m = ensureMirror();
  if (m.canvas.style.display !== 'block') { m.canvas.style.display = 'block'; mirrorTimer = 1; }
  mirrorTimer += dt;
  if (mirrorTimer < 1 / 30) return;
  mirrorTimer = 0;
  const w = innerWidth || 2, h = innerHeight || 2;
  if (m.canvas.width !== w || m.canvas.height !== h) m.r.setSize(w, h, false);
  renderer.xr.getCamera().matrixWorld.decompose(mirrorCam.position, mirrorCam.quaternion, _mirrorScale);
  mirrorCam.aspect = w / h;
  mirrorCam.updateProjectionMatrix();
  m.r.render(scene, mirrorCam);
}
let panelTimer = 0;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;
  panelTimer += dt;
  const doRedraw = panelTimer > 0.15;
  if (doRedraw) panelTimer = 0;
  camera.getWorldQuaternion(_camQuat);
  sceneRoot.traverse(o => {
    if (o.userData.isBillboard) {
      o.parent.getWorldQuaternion(_parentQuat);
      o.quaternion.copy(_parentQuat.invert()).multiply(_camQuat);
    }
    if (doRedraw && o.userData.panelData && o.userData.panelData.live) drawPanel(o.userData.panelData);
  });
  sceneRoot.children.forEach(obj => {
    if (obj.userData.customUpdate) {
      try { obj.userData.customUpdate(dt, t, obj); obj.userData._updErr = 0; }
      catch (e) {
        obj.userData._updErr = (obj.userData._updErr || 0) + 1;
        if (obj.userData._updErr > 60) { delete obj.userData.customUpdate; toast(MSG.updErr || 'A custom animation errored and was disabled'); }
      }
    }
    const anim = obj.userData.anim;
    if (!anim) return;
    switch (anim.type) {
      case 'spin':
        obj.rotation.y += dt * anim.speed;
        break;
      case 'orbit': {
        anim.angle = (anim.angle || 0) + dt * anim.speed;
        obj.position.x = anim.cx + Math.cos(anim.angle) * anim.radius;
        obj.position.z = anim.cz + Math.sin(anim.angle) * anim.radius;
        if (anim.selfSpin !== false) obj.rotation.y += dt * 0.8;
        break;
      }
      case 'swing': {
        const pivot = obj.children.find(c => c.userData.isSwingPivot);
        if (pivot) pivot.rotation.z = Math.sin(t * anim.speed) * anim.amplitude;
        break;
      }
      case 'float':
        obj.position.y = (anim.base === undefined ? 1 : anim.base) + Math.sin(t * anim.speed) * 0.3 + 0.35;
        break;
      case 'bounce': {
        const w = obj.children.find(c => c.userData.isSpringWeight);
        const s = 1 + Math.sin(t * anim.speed) * 0.18;
        if (obj.userData.springCoil) obj.userData.springCoil.scale.y = s;
        if (w) w.position.y = 1.8 * s + 0.2;
        break;
      }
      case 'ramp': {
        const ball = obj.children.find(c => c.userData.isRampBall);
        if (ball) {
          const phase = (t * anim.speed * 0.45) % 1;
          ball.position.set(-1.1 + phase * 2.55, 1.65 - phase * 1.35, 0);
          ball.rotation.z = -phase * 8;
        }
        break;
      }
    }
    if (anim.selfSpin && anim.type !== 'spin' && anim.type !== 'orbit') obj.rotation.y += dt * (anim.spinSpeed || 0.6);
  });
  updateLocomotion(dt);
  updatePCWalk(dt);
  updateRoomUI(dt);   // 房间内 UI 面板:外→隐藏 / 内→顶层渲染
  if (renderer.xr.isPresenting) {
    syncPlayerSpace();
    // 抓住的对象跟随控制器 + 射线 hover 反馈
    let hv = null;
    for (const c of controllers) {
      if (c.userData.grabbed) {
        c.getWorldPosition(_pos);
        dispatch(c.userData.grabbed, 'drag', { point: _pos.clone() });
      }
      if (!hv) {
        const hit = xrHit(c);
        if (hit && isInteractable(hit.obj)) hv = hit.obj;
      }
    }
    setHover(hv);
    // 头显渲染 + 第二渲染器镜像到 PC(像头显投屏:学生真实所见,含手柄射线/瞬移环)
    renderer.render(scene, camera);
    renderMirror(dt);
  } else {
    orbitCtl.update();
    renderer.render(scene, camera);
  }
});
`;
