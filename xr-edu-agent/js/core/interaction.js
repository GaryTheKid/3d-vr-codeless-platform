// ═══════════════════════════════════════════════════════════════
//  设备无关的语义交互层(借鉴 Unity XRI 的 Interactor/Interactable 分离)
//
//  AI / 内容层只写"语义事件"回调(挂在 obj.userData 上),不关心设备:
//    · onActivate(obj, detail)   "按下扳机/点击"(customClick 是它的旧别名)
//    · onGrab(obj, detail)       抓起(PC 按住拖动开始 / VR 手柄 grip)
//    · onDrag(obj, detail)       拖动中,detail.point 是目标世界坐标
//    · onRelease(obj, detail)    放开
//  设备映射(Interactor)是平台代码,一次写好、所有对象共享:
//    · PC:鼠标点击 → activate;按住可抓对象拖动 → grab/drag/release(viewport.js 调用)
//    · WebXR:控制器射线 + 扳机 → activate;grip 抓住 → grab,移动 → drag,松开 → release
//  实验模板的 expAction 也从这里统一分发(chem/eng 状态机),VR 里同样可点
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { renderer, scene, camera, sceneRoot, ground } from './three-setup.js';
import { toast } from './utils.js';
import { L } from './i18n.js';
import { chemLab, handleChemAction } from '../labs/chem-oxygen.js';
import { engLab, handleEngAction } from '../labs/english-cafe.js';
import { locomotion, teleportTo } from './locomotion.js';
import { setHover, flash } from './highlight.js';

// ── 语义事件查询 / 分发 ──

// 取对象上某语义事件的处理器(activate 兼容旧的 customClick)
export function getSemanticHandler(obj, evt) {
  const ud = obj.userData;
  if (evt === 'activate') return ud.onActivate || ud.customClick;
  return ud['on' + evt[0].toUpperCase() + evt.slice(1)];   // onGrab / onDrag / onRelease
}

// 对象是否"可交互"(任一语义事件或实验动作)
export function isInteractable(obj) {
  const ud = obj.userData;
  return !!(ud.expAction || getSemanticHandler(obj, 'activate') || getSemanticHandler(obj, 'grab') || getSemanticHandler(obj, 'drag'));
}

// 分发语义事件;返回 true 表示已被消费(调用方不应再当作"选中"处理)
export function dispatchInteraction(obj, evt, detail = {}) {
  const ud = obj.userData;
  if (evt === 'activate' && ud.expAction) {
    if (chemLab.active) { flash(obj); handleChemAction(ud.expAction); return true; }
    if (engLab.active) { flash(obj); handleEngAction(ud.expAction); return true; }
  }
  const h = getSemanticHandler(obj, evt);
  if (!h) return false;
  if (evt === 'activate') flash(obj);   // 平台级点击反馈:所有可交互对象统一闪烁
  try { h(obj, detail); }
  catch (err) { toast(L(`⚠ 交互脚本出错:${err.message}`, `⚠ Interaction script error: ${err.message}`)); }
  return true;
}

// ── WebXR Interactor(控制器射线 + 扳机/grip)──
const raycaster = new THREE.Raycaster();
const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// 控制器的挂载空间:locomotion 靠平移/旋转 scene 移动学生(相机无父节点、不受影响),
// 但控制器必须在场景图里才能渲染激光线;playerSpace 每帧抵消 scene 变换,
// 让控制器的 matrixWorld 始终等于 XR 原始位姿(与头显同一坐标系)
const playerSpace = new THREE.Group();
playerSpace.name = 'PlayerSpace';
scene.add(playerSpace);

function syncPlayerSpace() {
  // scene 世界变换 W = T(S)·R(θ) → playerSpace 局部需为 W⁻¹ = T(R(−θ)·(−S))·R(−θ)
  playerSpace.rotation.y = -scene.rotation.y;
  playerSpace.position.copy(scene.position).negate().applyAxisAngle(Y_AXIS, -scene.rotation.y);
}

function topLevel(o) {
  while (o.parent && o.parent !== sceneRoot) o = o.parent;
  return o;
}

// 控制器射线命中的顶层场景对象(顺带返回命中点;编辑器专用对象如学生视角不参与)
function xrHit(controller) {
  _mat.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_mat);
  const hits = raycaster.intersectObjects(sceneRoot.children, true);
  for (const h of hits) {
    const top = topLevel(h.object);
    if (top.userData.editorOnly) continue;
    return { obj: top, point: h.point };
  }
  return null;
}

const controllers = [];

export function setupXRInteraction() {
  for (const i of [0, 1]) {
    const c = renderer.xr.getController(i);
    playerSpace.add(c);
    controllers.push(c);
    // 激光指示线(仅 XR 会话中可见)
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.6 })
    );
    line.scale.z = 6;
    c.add(line);

    // 扳机 = activate;teleport 模式下指向地面则瞬移
    c.addEventListener('selectstart', () => {
      const hit = xrHit(c);
      if (hit && dispatchInteraction(hit.obj, 'activate', { point: hit.point })) return;
      if (locomotion.mode === 'teleport') {
        raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
        _mat.identity().extractRotation(c.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_mat);
        // 地面之外也可指向楼梯/二层地板等可踩表面(teleportTo 内部做碰撞与高度判定)
        const g = raycaster.intersectObjects([ground, sceneRoot], true);
        if (g.length) teleportTo(g[0].point);
      }
    });
    // grip = grab / release;抓住期间每帧 drag(见 updateXRInteraction)
    c.addEventListener('squeezestart', () => {
      const hit = xrHit(c);
      if (hit && getSemanticHandler(hit.obj, 'grab')) {
        c.userData.grabbed = hit.obj;
        dispatchInteraction(hit.obj, 'grab', { point: hit.point });
      }
    });
    c.addEventListener('squeezeend', () => {
      if (c.userData.grabbed) {
        dispatchInteraction(c.userData.grabbed, 'release', {});
        c.userData.grabbed = null;
      }
    });
  }
}

// 每帧:同步控制器坐标空间 + 抓住的对象跟随控制器(drag 语义)+ 射线 hover 反馈
export function updateXRInteraction() {
  if (!renderer.xr.isPresenting) return;
  syncPlayerSpace();
  let hoverTarget = null;
  for (const c of controllers) {
    if (c.userData.grabbed) {
      c.getWorldPosition(_pos);
      dispatchInteraction(c.userData.grabbed, 'drag', { point: _pos.clone() });
    }
    if (!hoverTarget) {
      const hit = xrHit(c);
      if (hit && isInteractable(hit.obj)) hoverTarget = hit.obj;
    }
  }
  setHover(hoverTarget);
}
