// ═══════════════════════════════════════════════════════════════
//  学生 Locomotion(移动)运行时模块 —— 与语义交互层同一哲学:
//  设备差异收敛到平台层,AI 只做"意图级"参数配置(configure_locomotion 工具 /
//  层级面板「XR 会话管理器」组件卡)。
//
//  参数(locomotion):
//    · mode: 'static' | 'teleport' | 'smooth'
//        static   固定观察点(单摆/分子结构等观察类场景)
//        teleport 扳机指地瞬移(舒适防眩晕,探索类场景默认)
//        smooth   摇杆平滑移动(漫游类场景;对晕动敏感者慎用)
//    · allowedRadius: 活动半径(米,以场景内容原点为中心;0 = 不限制)
//    · turnMode: 'snap' | 'smooth'(XR 右摇杆转向:45° 跳转 / 连续旋转)
//
//  实现:WebXR 下学生头显始终在 local-floor 原点附近,"移动学生"= 反向
//  平移/旋转 scene(与 setupXR 的出生点前推同一机制)。
//  坐标约定:世界点 w = R(scene.rotation.y) · q(内容坐标) + S(scene.position)
//  PC 下方向键平移编辑相机,用于老师预览学生走动路线(不占用 WASD 手柄快捷键)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { renderer, scene, camera, orbit, ground, sceneRoot } from './three-setup.js';
import { toast } from './utils.js';
import { emit } from './events.js';
import { pointBlocked, segmentBlocked, resolveMove, groundHeightAt } from './collision.js';
import { L } from './i18n.js';

export const locomotion = {
  mode: 'static',
  allowedRadius: 0,
  turnMode: 'snap',
};

const SMOOTH_SPEED = 2.2;       // m/s
const SNAP_ANGLE = Math.PI / 4;
const SMOOTH_TURN_SPEED = 1.6;  // rad/s
export const LEDGE_DROP = 0.6;  // 悬崖保护:连续移动不允许跨越超过此高差的跌落(楼梯 0.25/级不受影响)
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _head = new THREE.Vector3();
const _right = new THREE.Vector3();

// 世界坐标 → 场景内容坐标:q = R⁻¹ · (w − S)
function worldToContent(w) {
  return w.clone().sub(scene.position).applyAxisAngle(Y_AXIS, -scene.rotation.y);
}

// 把"学生站到内容点 q"换算成 scene 平移:S = −R · q(学生恒在世界原点)
// q.y = 脚底高度(楼梯/二层地板):世界 y 不参与旋转,直接反向平移
function standAt(q) {
  const s = q.clone().applyAxisAngle(Y_AXIS, scene.rotation.y).negate();
  scene.position.x = s.x;
  scene.position.z = s.z;
  scene.position.y = -(q.y || 0);
}

// 活动范围限制(内容坐标系,以场景原点为中心)
function clampToArea(q) {
  if (locomotion.allowedRadius > 0) {
    const r = Math.hypot(q.x, q.z);
    if (r > locomotion.allowedRadius) {
      const s = locomotion.allowedRadius / r;
      q.x *= s; q.z *= s;
    }
  }
  q.y = 0;
  return q;
}

// XR 会话中学生恒在世界原点 → 其内容坐标 = worldToContent(原点)
// (返回值的 y = 脚底高度:站在楼梯/二层时 > 0)
const _origin = new THREE.Vector3();
export function studentContentPos() {
  return worldToContent(_origin.set(0, 0, 0));
}

// 瞬移到世界坐标点(XR 扳机指地/指可行走面时由 interaction.js 调用)
export function teleportTo(point) {
  if (locomotion.mode === 'static') return;
  const q = clampToArea(worldToContent(point));
  const cur = studentContentPos();
  const feet = Math.max(0, cur.y);
  // 碰撞:落点在实心体内 / 传送线穿墙(必须从门走)→ 本次瞬移无效
  if (pointBlocked(q.x, q.z, feet) || segmentBlocked(cur.x, cur.z, q.x, q.z, feet)) return;
  q.y = groundHeightAt(q.x, q.z, feet);   // 楼梯/二层地板:落点跟随可踩表面高度
  standAt(q);
}

// 强制传送(电梯按钮/剧情跳转用,不做碰撞检查;y = 目标脚底高度,如二层地板顶面)
const _tp = new THREE.Vector3();
export function forceTeleport(x, z, y = 0) {
  standAt(_tp.set(x, y, z));
}

// 绕学生站立点(世界原点)旋转世界 = 学生原地转身
// w' = Rot(a)·(R·q + S) → 新旋转 = R+a,新平移 = Rot(a)·S
function rotateWorldAroundPlayer(angle) {
  scene.rotation.y += angle;
  scene.position.applyAxisAngle(Y_AXIS, angle);
}

// 会话结束时复位世界姿态(setupXR 已复位 position,这里补 rotation)
export function resetLocomotionPose() {
  scene.rotation.y = 0;
  if (teleMarker) teleMarker.visible = false;
  wasAiming = false;
  aimValid = false;
}

// ── Unity XRI 风格摇杆瞬移:前推摇杆瞄准(落点指示环),松开瞬移 ──
const AIM_PUSH = 0.5;               // 摇杆前推超过此值进入瞄准
const teleRaycaster = new THREE.Raycaster();
const _aimMat = new THREE.Matrix4();
const _aimQ = new THREE.Vector3();  // 最新瞄准落点(内容坐标,y=脚底高度)
let teleMarker = null;
let wasAiming = false;
let aimValid = false;

function ensureTeleMarker() {
  if (teleMarker) return teleMarker;
  teleMarker = new THREE.Group();
  teleMarker.name = 'teleport-marker';
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.035, 12, 40).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.9, depthTest: false })
  );
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.45, depthTest: false })
  );
  ring.renderOrder = 999;
  dot.renderOrder = 999;
  teleMarker.add(ring, dot);
  teleMarker.visible = false;
  scene.add(teleMarker);   // 挂 scene(内容坐标)而非 sceneRoot:不参与序列化/层级
  return teleMarker;
}

// 从控制器射线算瞄准落点:命中可站表面 → 环贴地显示;有效蓝色 / 无效红色
function aimTeleport(controller) {
  const m = ensureTeleMarker();
  _aimMat.identity().extractRotation(controller.matrixWorld);
  teleRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  teleRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(_aimMat);
  const hits = teleRaycaster.intersectObjects([ground, sceneRoot], true);
  let hit = null;
  for (const h of hits) {
    let top = h.object;
    while (top.parent && top.parent !== sceneRoot && top.parent !== scene) top = top.parent;
    if (top.userData?.editorOnly) continue;   // 学生代表物等编辑器对象不可作为落点
    hit = h;
    break;
  }
  if (!hit) { m.visible = false; aimValid = false; return; }
  const q = clampToArea(worldToContent(hit.point));
  const cur = studentContentPos();
  const feet = Math.max(0, cur.y);
  aimValid = !pointBlocked(q.x, q.z, feet) && !segmentBlocked(cur.x, cur.z, q.x, q.z, feet);
  q.y = groundHeightAt(q.x, q.z, feet);
  _aimQ.copy(q);
  m.position.set(q.x, q.y + 0.02, q.z);
  m.visible = true;
  const color = aimValid ? 0x4a9eff : 0xe5534b;
  m.children.forEach(c => c.material.color.setHex(color));
}

// 每帧:XR 摇杆瞬移瞄准 / 平滑移动 / 转向(loop.js 调用)
export function updateLocomotion(dt) {
  if (!renderer.xr.isPresenting || locomotion.mode === 'static') {
    if (teleMarker) teleMarker.visible = false;
    wasAiming = false;
    return;
  }
  const session = renderer.xr.getSession();
  if (!session) return;
  let aimingNow = false;
  let idx = -1;
  for (const src of session.inputSources) {
    idx++;
    const axes = src.gamepad?.axes;
    if (!axes || axes.length < 4) continue;
    const ax = axes[2], ay = axes[3];   // 标准映射:摇杆在 axes[2/3]
    // 瞬移模式:摇杆前推 = 瞄准(显示落点环);由松开动作触发传送(见循环尾)
    const aimingThis = locomotion.mode === 'teleport' && ay < -AIM_PUSH;
    if (aimingThis && !aimingNow) {
      aimingNow = true;
      aimTeleport(renderer.xr.getController(idx));
    }
    // 平滑移动(左手摇杆,按头显朝向)
    if (locomotion.mode === 'smooth' && src.handedness === 'left' && (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15)) {
      renderer.xr.getCamera().getWorldDirection(_head);
      _head.y = 0; _head.normalize();
      _right.set(-_head.z, 0, _head.x);
      const moveWorld = new THREE.Vector3()
        .addScaledVector(_head, -ay * SMOOTH_SPEED * dt)
        .addScaledVector(_right, ax * SMOOTH_SPEED * dt);
      // 学生在世界原点,目标世界点 = moveWorld → 换算成内容坐标后限位落点
      const q = clampToArea(worldToContent(moveWorld));
      const cur = studentContentPos();
      const feet = Math.max(0, cur.y);
      const slid = resolveMove(cur.x, cur.z, q.x, q.z, feet);   // 撞墙 → 贴墙滑动
      q.x = slid.x; q.z = slid.z;
      q.y = groundHeightAt(q.x, q.z, feet);   // 楼梯逐级上升 / 走出边缘回落
      if (feet - q.y > LEDGE_DROP) continue;  // 悬崖保护:平滑移动不允许走出 >0.6 米的跌落边缘
      standAt(q);
    }
    // 转向:瞬移模式双手摇杆左右皆可(前推瞄准中不转);平滑模式右手(左手是移动)
    const canTurn = locomotion.mode === 'teleport' ? !aimingThis : src.handedness === 'right';
    if (canTurn) {
      if (Math.abs(ax) > 0.6) {
        if (locomotion.turnMode === 'snap') {
          if (!src._turned) { src._turned = true; rotateWorldAroundPlayer(ax > 0 ? SNAP_ANGLE : -SNAP_ANGLE); }
        } else {
          rotateWorldAroundPlayer((ax > 0 ? 1 : -1) * SMOOTH_TURN_SPEED * dt);
        }
      } else {
        src._turned = false;
      }
    }
  }
  // 松开前推 → 落点有效则瞬移(Unity XRI 的 release-to-teleport)
  if (!aimingNow) {
    if (wasAiming && aimValid) standAt(_aimQ);
    if (teleMarker) teleMarker.visible = false;
  }
  wasAiming = aimingNow;
}

// ── 配置入口(Agent 工具 / NL Inspector 组件卡共用)──
const MODE_LABEL = {
  static: L('固定观察点', 'fixed viewpoint'),
  teleport: L('瞬移(指地传送)', 'teleport (point at floor)'),
  smooth: L('摇杆平滑移动', 'smooth stick movement'),
};

export function configureLocomotion({ mode, allowedRadius, turnMode } = {}, silent = false) {
  const done = [];
  if (mode && MODE_LABEL[mode]) { locomotion.mode = mode; done.push(L(`移动方式=${MODE_LABEL[mode]}`, `mode=${MODE_LABEL[mode]}`)); }
  if (allowedRadius !== undefined) { locomotion.allowedRadius = Math.max(0, +allowedRadius || 0); done.push(L(`活动半径=${locomotion.allowedRadius || '不限'}`, `radius=${locomotion.allowedRadius || 'unlimited'}`)); }
  if (turnMode === 'snap' || turnMode === 'smooth') { locomotion.turnMode = turnMode; done.push(L(`转向=${turnMode === 'snap' ? '45°跳转' : '平滑'}`, `turn=${turnMode}`)); }
  if (done.length && !silent) toast(L(`🚶 学生移动已配置:${done.join(',')}`, `🚶 Student locomotion set: ${done.join(', ')}`));
  if (done.length) emit('locomotion-changed');   // 学生视角代表物据此切换 胶囊/棱台 形态
  return done;
}

export function locomotionDesc() {
  return locomotion.mode === 'static'
    ? L('固定观察点:学生出生后停在原地,不可走动', 'Fixed viewpoint: students stay where they spawn and cannot walk')
    : L(`${MODE_LABEL[locomotion.mode]};活动范围 ${locomotion.allowedRadius > 0 ? `半径 ${locomotion.allowedRadius} 米` : '不限'};转向 ${locomotion.turnMode === 'snap' ? '45° 跳转(防眩晕)' : '平滑旋转'}`,
      `${MODE_LABEL[locomotion.mode]}; range ${locomotion.allowedRadius > 0 ? `${locomotion.allowedRadius} m radius` : 'unlimited'}; turning ${locomotion.turnMode === 'snap' ? '45° snap (comfort)' : 'smooth'}`);
}

// ── PC 侧:方向键行走预览 ──
const keysDown = new Set();
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key.startsWith('Arrow')) { keysDown.add(e.key); e.preventDefault(); }
});
window.addEventListener('keyup', e => keysDown.delete(e.key));

export function updatePCWalk(dt) {
  if (renderer.xr.isPresenting || keysDown.size === 0) return;
  camera.getWorldDirection(_head);
  _head.y = 0; _head.normalize();
  _right.set(-_head.z, 0, _head.x);
  const move = new THREE.Vector3();
  if (keysDown.has('ArrowUp')) move.add(_head);
  if (keysDown.has('ArrowDown')) move.addScaledVector(_head, -1);
  if (keysDown.has('ArrowLeft')) move.addScaledVector(_right, -1);
  if (keysDown.has('ArrowRight')) move.add(_right);
  if (move.lengthSq() === 0) return;
  move.normalize().multiplyScalar(SMOOTH_SPEED * 2 * dt);
  camera.position.add(move);
  orbit.target.add(move);
}
