// ═══════════════════════════════════════════════════════════════
//  AI 代码沙盒:让模型像在 Cursor 里那样直接写 Three.js 代码
//  (参考 MIT LLMR:LLM 写代码 → 运行时编译执行,突破预制工具的表达力天花板)
//
//  · runBuilderCode(code)          执行"构建代码",必须 return Object3D
//  · compileUpdate(code)           编译每帧行为 (dt, t, obj) => void
//  · compileClick(code)            编译点击行为 (obj) => void
//  · 代码里可用 T(工具箱)与 THREE;沙盒 = new Function 作用域隔离,
//    仅适用于本地原型(正式产品需 Worker/iframe 级隔离,见 /general/overview.md roadmap)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { mat, mesh, bond, at, toast } from '../core/utils.js';
import { attachLabel, makePanel } from '../panels/panel3d.js';
import { emit } from '../core/events.js';
import { renderer, camera, sceneRoot } from '../core/three-setup.js';
import { state } from '../core/state.js';
import { studentContentPos, locomotion, forceTeleport } from '../core/locomotion.js';
import { getStudentSpawn, teleportRig } from '../scene/student-rig.js';
import { L } from '../core/i18n.js';

// 刷屏保险丝:AI 生成的 customUpdate 每秒跑 ~60 次,若模型忘写 latch(闩锁),
// 条件满足时会每帧调 say/toast 把聊天区刷爆。这里兜底:同一条消息 5s 内只放行一次
const _recentMsgs = new Map();   // msg → 上次放行时间戳(ms)
function throttled(fn, windowMs = 5000) {
  return msg => {
    const now = performance.now();
    const key = String(msg);
    if (now - (_recentMsgs.get(key) || -Infinity) < windowMs) return;
    _recentMsgs.set(key, now);
    if (_recentMsgs.size > 100) _recentMsgs.delete(_recentMsgs.keys().next().value);
    fn(msg);
  };
}

// 注入给 AI 代码的工具箱(与内置资源构建函数用的是同一套积木)
export const T = {
  THREE,
  mat,          // mat(color, opts) → MeshStandardMaterial(可传 transparent/opacity/roughness/metalness/emissive 等)
  mesh,         // mesh(geometry, material) → 带阴影的 Mesh
  bond,         // bond(p1, p2, radius, color) → 连接两点的圆柱
  at,           // at(obj, y) 设高度并返回对象
  group: () => new THREE.Group(),
  attachLabel,  // attachLabel(obj, {title, lines, live, accent, width, gap}) 头顶标注;live:()=>行数组 每0.15s刷新
  makePanel,    // makePanel({title, lines, live, width, accent}) 生成面板 Mesh,自行 add 到组合体里
  toast: throttled(toast),                              // toast(msg) 给学生的即时提示气泡(防刷屏节流)
  say: throttled(html => emit('agent-say', html)),      // AI 助教在聊天区发言(实验复盘/引导,防刷屏节流)

  // ── 玩家感知助手(近接触发 / 投放判定等交互逻辑用)──
  // playerPos():学生的地面位置(内容坐标 Vector3,y=脚底高度,楼上时 >0)
  //   VR 会话 → 头显真实站位;PC 运行(可走动课)→ WASD 驱动的胶囊;否则 → 编辑相机脚下
  playerPos: () => {
    if (renderer.xr.isPresenting) return studentContentPos();
    if (state.playMode && locomotion.mode !== 'static') {
      const sp = getStudentSpawn();
      if (sp) return new THREE.Vector3(sp.x, sp.y || 0, sp.z);
    }
    return new THREE.Vector3(camera.position.x, 0, camera.position.z);
  },
  // distToPlayer(obj):对象(世界位置,忽略 y)到学生的水平距离(米)
  distToPlayer: obj => {
    const p = T.playerPos();
    const w = obj.getWorldPosition(new THREE.Vector3());
    return Math.hypot(w.x - p.x, w.z - p.z);
  },
  // overlaps(a, b, margin):两个对象的包围盒是否相交(margin 为外扩米数;投放进容器判定用)
  overlaps: (a, b, margin = 0) => {
    const ba = new THREE.Box3().setFromObject(a).expandByScalar(margin);
    const bb = new THREE.Box3().setFromObject(b);
    return ba.intersectsBox(bb);
  },

  // teleportStudent(x, z, y=0):把学生直接送到某点(电梯按钮/剧情跳转;y=目标脚底高度)
  //   VR 会话 → 平移世界;PC 运行 → 移动学生胶囊;编辑模式无学生,静默忽略
  teleportStudent: (x, z, y = 0) => {
    if (renderer.xr.isPresenting) { forceTeleport(x, z, y); return; }
    if (state.playMode && locomotion.mode !== 'static') teleportRig(x, z, y);
  },

  // setSolid(obj, on):运行时改碰撞实心标记(密室开门=T.setSolid(door,false) 后门就能穿过)
  setSolid: (obj, on = true) => {
    obj.userData.solid = !!on;
    emit('hierarchy-changed');   // 触发碰撞盒重建
  },

  // notify(text, opts):在场景里弹一块临时提示面板,数秒后自动消失(时长随文字长度)
  //   opts.at = 依附对象(悬在其头顶)或 {x,y,z};不传 = 出现在学生面前 2 米
  //   opts.duration = 秒(可选);opts.accent = 边框色;opts.title = 标题
  //   这是"世界内 UI":VR 学生也能看到(区别于 T.toast 的屏幕角标)
  notify: (text, opts = {}) => {
    const str = String(text);
    const chunk = 16;
    const lines = [];
    for (const seg of str.split('\n')) {
      for (let i = 0; i < seg.length || i === 0; i += chunk) lines.push(seg.slice(i, i + chunk));
    }
    const panel = makePanel({ title: opts.title || '', lines, width: opts.width || 3.2, accent: opts.accent || '#f0c840' });
    const g = new THREE.Group();
    g.add(panel);
    g.userData.transient = true;
    g.userData.icon = '💬';
    g.userData.displayName = L('临时提示', 'Notice');
    const at_ = opts.at;
    if (at_ && at_.isObject3D) {
      const box = new THREE.Box3().setFromObject(at_);
      const p = at_.getWorldPosition(new THREE.Vector3());
      g.position.set(p.x, (isFinite(box.max.y) ? box.max.y : p.y + 1.5) + 0.5, p.z);
    } else if (at_ && at_.x !== undefined) {
      g.position.set(at_.x, at_.y ?? 1.8, at_.z);
    } else {
      const p = T.playerPos();
      const eyeYaw = renderer.xr.isPresenting ? 0 : (getStudentSpawn()?.yaw ?? 0);
      g.position.set(p.x - Math.sin(eyeYaw) * 2, (p.y || 0) + 1.6, p.z - Math.cos(eyeYaw) * 2);
    }
    sceneRoot.add(g);
    const dur = (opts.duration ?? Math.min(10, Math.max(2.5, 1.5 + str.length * 0.09))) * 1000;
    setTimeout(() => { if (g.parent) g.parent.remove(g); }, dur);
    return g;
  },
};

// 执行构建代码:函数体,可用 (T, THREE),必须 return 一个 THREE.Object3D
export function runBuilderCode(code) {
  const fn = new Function('T', 'THREE', `'use strict';\n${code}`);
  const obj = fn(T, THREE);
  if (!obj?.isObject3D) throw new Error('构建代码必须 return 一个 THREE.Object3D(Group 或 Mesh)');
  return obj;
}

// 编译每帧行为代码 → (dt, t, obj) => void
export function compileUpdate(code) {
  const fn = new Function('dt', 't', 'obj', 'T', 'THREE', `'use strict';\n${code}`);
  return (dt, t, obj) => fn(dt, t, obj, T, THREE);
}

// 编译点击行为代码 → (obj) => void
export function compileClick(code) {
  const fn = new Function('obj', 'T', 'THREE', `'use strict';\n${code}`);
  return obj => fn(obj, T, THREE);
}

// 编译语义交互事件代码(grab/drag/release)→ (obj, detail) => void
// detail.point 是世界坐标(THREE.Vector3,drag 时为拖动目标点)
export function compileHandler(code) {
  const fn = new Function('obj', 'detail', 'T', 'THREE', `'use strict';\n${code}`);
  return (obj, detail) => fn(obj, detail || {}, T, THREE);
}
