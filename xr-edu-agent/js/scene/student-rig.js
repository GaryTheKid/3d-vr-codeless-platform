// ═══════════════════════════════════════════════════════════════
//  学生视角代表物(类 Unity 的 Camera Gizmo + 玩家 Capsule):
//  · 场景里一个可选中、可拖动/旋转的系统对象「学生视角」,代表学生进 VR 后的
//    出生点与初始朝向 —— 老师像摆普通对象一样把它拖到最佳观察位即可
//  · 视觉随移动方式自适应(configure_locomotion 联动):
//      static(定点观察)→ 只显示一个小视锥棱台(相机),表示"学生站在这里看"
//      teleport/smooth(可走动)→ 白色胶囊(学生身体)+ 视锥,表示出生点
//  · 仅编辑模式可见(userData.editorOnly);进 VR / 导出播放器按它的
//    位置与朝向出生(loop.js sessionstart / exporter cfg.spawn)
//  · userData.system = true:清空场景/一键模板时保留,不可删除
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { renderer, sceneRoot } from '../core/three-setup.js';
import { state, assignOid } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { locomotion, LEDGE_DROP } from '../core/locomotion.js';
import { resolveMove, groundHeightAt } from '../core/collision.js';
import { L } from '../core/i18n.js';

const EYE_HEIGHT = 1.6;      // 视锥顶点高度(米,近似成人/头显眼高)
const FRUSTUM_LEN = 1.3;     // 视锥长度
const FRUSTUM_W = 0.62;      // 远端半宽(≈ 50° 水平视角)
const FRUSTUM_H = 0.46;      // 远端半高

function buildFrustum() {
  const g = new THREE.Group();
  g.name = 'view-frustum';
  const apex = new THREE.Vector3(0, EYE_HEIGHT, 0);
  const corners = [
    new THREE.Vector3(-FRUSTUM_W, EYE_HEIGHT + FRUSTUM_H, -FRUSTUM_LEN),
    new THREE.Vector3(FRUSTUM_W, EYE_HEIGHT + FRUSTUM_H, -FRUSTUM_LEN),
    new THREE.Vector3(FRUSTUM_W, EYE_HEIGHT - FRUSTUM_H, -FRUSTUM_LEN),
    new THREE.Vector3(-FRUSTUM_W, EYE_HEIGHT - FRUSTUM_H, -FRUSTUM_LEN),
  ];
  // 半透明棱台体(给射线选中用)
  const geo = new THREE.BufferGeometry();
  const v = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    v.push(apex.x, apex.y, apex.z, a.x, a.y, a.z, b.x, b.y, b.z);
  }
  v.push(corners[0].x, corners[0].y, corners[0].z, corners[1].x, corners[1].y, corners[1].z, corners[2].x, corners[2].y, corners[2].z);
  v.push(corners[0].x, corners[0].y, corners[0].z, corners[2].x, corners[2].y, corners[2].z, corners[3].x, corners[3].y, corners[3].z);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  const solid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false,
  }));
  g.add(solid);
  // 视野边界线(Unity 风格白色线框)
  const pts = [];
  for (const c of corners) pts.push(apex, c);
  for (let i = 0; i < 4; i++) pts.push(corners[i], corners[(i + 1) % 4]);
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
  );
  g.add(lines);
  // 小棱锥"相机头"(定点观察模式下的主体)
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.26, 4),
    new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.4, metalness: 0.2 })
  );
  head.rotation.x = -Math.PI / 2;
  head.rotation.y = Math.PI / 4;
  head.position.set(0, EYE_HEIGHT, -0.12);
  g.add(head);
  return g;
}

function buildCapsule() {
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 1.0, 4, 14),
    new THREE.MeshStandardMaterial({ color: 0xf2f4f8, transparent: true, opacity: 0.55, roughness: 0.5 })
  );
  capsule.name = 'player-capsule';
  capsule.position.y = 0.72;   // 底部贴地(半径 0.22 + 半长 0.5)
  return capsule;
}

let rig = null;

// 定点模式下棱台几何中心化后,眼点(棱台顶点)在局部 +Z 的偏移
const APEX_OFF = FRUSTUM_LEN / 2;

// 视觉状态同步:
//   移动方式 → 胶囊显隐(定点课只留视锥棱台,包围盒/选择框也不含隐藏胶囊)
//   定点模式 → 棱台几何中心移到对象原点(旋转中心=棱台正中,不再是脚下半空),
//              rig 整体抬到眼高;可走动模式 → 原点回到脚底
//   运行模式 → PC 上保持可见(它就是可被 WASD 驱动的"学生化身");
//              真·VR 会话中隐藏(学生不该看到自己的代表物)
function syncVisual() {
  if (!rig) return;
  const walkable = locomotion.mode !== 'static';
  const capsule = rig.children.find(c => c.name === 'player-capsule');
  if (capsule) capsule.visible = walkable;
  const frustum = rig.children.find(c => c.name === 'view-frustum');
  const wasStatic = rig.userData.staticPose === true;
  if (!walkable) {
    if (frustum) frustum.position.set(0, -EYE_HEIGHT, APEX_OFF);
    if (!wasStatic) rig.position.y += EYE_HEIGHT;
  } else {
    if (frustum) frustum.position.set(0, 0, 0);
    if (wasStatic) rig.position.y = Math.max(0, rig.position.y - EYE_HEIGHT);
  }
  rig.userData.staticPose = !walkable;
  rig.userData.behaviorDesc = walkable
    ? L('学生出生点与初始朝向(可走动课):拖动/旋转它设置学生进 VR 的起始位置与视线方向;运行模式下可用 WASD 移动、←→ 转向', 'Student spawn point & facing (walkable lesson): drag/rotate to set where students start in VR; in play mode drive it with WASD and turn with ←/→')
    : L('学生观察点(定点课):拖动/旋转它设置学生在 VR 里站的位置与视线方向', 'Student viewpoint (stationary lesson): drag/rotate to set where students stand in VR and where they look');
  rig.visible = !renderer.xr.isPresenting;
}

// 确保场景里有且只有一个学生视角对象(启动 / 载入项目后调用)
export function ensureStudentRig() {
  const found = sceneRoot.children.find(o => o.userData.studentRig);
  if (found) { rig = found; syncVisual(); return rig; }
  rig = new THREE.Group();
  assignOid(rig);
  rig.userData.studentRig = true;
  rig.userData.system = true;       // 清空场景保留、不可删除
  rig.userData.editorOnly = true;   // 导出播放器中不渲染
  rig.userData.icon = '🧍';
  rig.userData.displayName = L('学生视角', 'Student View');
  rig.add(buildCapsule());
  rig.add(buildFrustum());
  rig.position.set(0, 0, 6);        // 默认站在场景边缘朝向中心
  rig.rotation.y = 0;               // 朝 -Z(场景中心方向)
  sceneRoot.add(rig);
  syncVisual();
  emit('hierarchy-changed');
  return rig;
}

// 载入旧项目后:场景里可能有序列化回来的 rig(找回引用),没有则补建
export function getStudentRig() {
  rig = sceneRoot.children.find(o => o.userData.studentRig) || null;
  return rig || ensureStudentRig();
}

// 出生点参数(loop.js 进 VR / exporter 导出用):内容坐标 + 朝向 yaw + 脚底高度 y
// 定点模式下 rig 原点在眼高、眼点沿局部 +Z 偏移 APEX_OFF,这里换算回"站立点"
export function getStudentSpawn() {
  const r = sceneRoot.children.find(o => o.userData.studentRig);
  if (!r) return null;
  if (r.userData.staticPose) {
    return {
      x: r.position.x + Math.sin(r.rotation.y) * APEX_OFF,
      z: r.position.z + Math.cos(r.rotation.y) * APEX_OFF,
      y: Math.max(0, r.position.y - EYE_HEIGHT),
      yaw: r.rotation.y,
    };
  }
  return { x: r.position.x, z: r.position.z, y: Math.max(0, r.position.y), yaw: r.rotation.y };
}

// 学生眼睛的世界位姿(PiP 相机 / 面板朝向用):定点模式眼点在棱台顶点,可走动在头顶
export function getStudentEye() {
  const r = sceneRoot.children.find(o => o.userData.studentRig);
  if (!r) return null;
  if (r.userData.staticPose) {
    return {
      x: r.position.x + Math.sin(r.rotation.y) * APEX_OFF,
      y: r.position.y,
      z: r.position.z + Math.cos(r.rotation.y) * APEX_OFF,
      yaw: r.rotation.y,
    };
  }
  return { x: r.position.x, y: r.position.y + EYE_HEIGHT, z: r.position.z, yaw: r.rotation.y };
}

// 移动/旋转学生视角(set_student_view 工具用);lookAt 传 {x,z} 时自动算朝向
export function setStudentView({ x, z, yaw, lookAt } = {}) {
  const r = getStudentRig();
  if (x !== undefined) r.position.x = x;
  if (z !== undefined) r.position.z = z;
  if (lookAt) {
    r.rotation.y = Math.atan2(-(lookAt.x - r.position.x), -(lookAt.z - r.position.z));
  } else if (yaw !== undefined) {
    r.rotation.y = yaw;
  }
  emit('hierarchy-changed');
  return r;
}

// ── 运行模式 PC 试玩:WASD 驱动胶囊 + ←→ 转向(类 Unity Play,停止运行后由 play-reset 复位)──
const keys = new Set();
const DRIVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowleft', 'arrowright']);
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (DRIVE_KEYS.has(k)) keys.add(k);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// 强制移动学生化身(电梯/剧情传送的 PC 侧;y = 目标脚底高度)
export function teleportRig(x, z, y = 0) {
  const r = getStudentRig();
  if (!r) return;
  r.position.set(x, y, z);
  emit('transform-changed');
}

// 是否处于"胶囊可驾驶"状态(运行模式 + 可走动课 + 非 VR 会话)
export function rigDriveActive() {
  return state.playMode && locomotion.mode !== 'static' && !renderer.xr.isPresenting;
}

const MOVE_SPEED = 2.6;   // m/s
const TURN_SPEED = 2.0;   // rad/s
export function updateRigDrive(dt) {
  if (!rigDriveActive() || !rig) return false;
  if (keys.has('arrowleft')) rig.rotation.y += TURN_SPEED * dt;
  if (keys.has('arrowright')) rig.rotation.y -= TURN_SPEED * dt;
  let f = 0, s = 0;
  if (keys.has('w')) f += 1;
  if (keys.has('s')) f -= 1;
  if (keys.has('a')) s -= 1;
  if (keys.has('d')) s += 1;
  if (f || s) {
    const len = Math.hypot(f, s), yaw = rig.rotation.y;
    const dx = (Math.sin(yaw) * -f + Math.cos(yaw) * s) / len * MOVE_SPEED * dt;
    const dz = (Math.cos(yaw) * -f - Math.sin(yaw) * s) / len * MOVE_SPEED * dt;
    // 碰撞:撞墙时沿墙滑动(solid 对象阻挡);脚底高度跟随楼梯/二层地板
    const feet = rig.position.y;
    const to = resolveMove(rig.position.x, rig.position.z, rig.position.x + dx, rig.position.z + dz, feet);
    const gh = groundHeightAt(to.x, to.z, feet);
    if (feet - gh <= LEDGE_DROP) {   // 悬崖保护:不允许走出 >0.6 米的跌落边缘
      rig.position.x = to.x;
      rig.position.z = to.z;
      rig.position.y = gh;
    }
  }
  return true;
}

on('locomotion-changed', syncVisual);
on('play-mode-changed', syncVisual);
renderer.xr.addEventListener('sessionstart', syncVisual);
renderer.xr.addEventListener('sessionend', syncVisual);
ensureStudentRig();
