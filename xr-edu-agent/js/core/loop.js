// ═══════════════════════════════════════════════════════════════
//  动画循环 + WebXR 会话管理
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { renderer, scene, camera, sceneRoot, orbit, resize, tctrl, grid } from './three-setup.js';
import { clock } from './three-setup.js';
import { state, setPlayMode } from './state.js';
import { toast } from './utils.js';
import { L } from './i18n.js';
import { selBox, extraBoxes } from '../scene/manager.js';
import { drawPanel } from '../panels/panel3d.js';
import { chemLabUpdate } from '../labs/chem-oxygen.js';
import { engLabUpdate } from '../labs/english-cafe.js';
import { setupXRInteraction, updateXRInteraction } from './interaction.js';
import { updateLocomotion, updatePCWalk, resetLocomotionPose, locomotion } from './locomotion.js';
import { getStudentSpawn, getStudentEye, getStudentRig, updateRigDrive, rigDriveActive } from '../scene/student-rig.js';
import { isRouteHiddenForStudent } from './play-visibility.js';
import { updateRoomUIVisibility } from './room-ui-visibility.js';

const _camQuat = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();
let panelRedrawTimer = 0;

// ── 学生相机画中画预览(类 Unity Camera Preview)──
// 选中学生视角对象 / 运行可走动课时,在视口右下角渲染学生眼中的画面。
// 相机参数固定(FOV 60°),不随代表物缩放而变 —— 缩放只是 gizmo 大小;
// 渲染前隐藏所有编辑器 UI(gizmo/选择框/网格/编辑器专用对象/导览路线),
// 这个画面要严格等于真学生眼中的样子
const studentCam = new THREE.PerspectiveCamera(60, 4 / 3, 0.1, 200);
const pipFrame = document.getElementById('cam-preview-frame');
const _pipSize = new THREE.Vector2();
const _pipHidden = [];

// 学生眼中不存在的东西:编辑器专用对象(含 rig 自身)+ 运行时隐藏的导览路线
function hideEditorUIForPiP() {
  _pipHidden.length = 0;
  const stash = o => { if (o.visible) { o.visible = false; _pipHidden.push(o); } };
  stash(tctrl);
  stash(grid);
  stash(selBox);
  extraBoxes.forEach(stash);
  for (const o of sceneRoot.children) {
    if (o.userData.editorOnly || isRouteHiddenForStudent(o)) stash(o);
  }
}
function restoreAfterPiP() {
  for (const o of _pipHidden) o.visible = true;
  _pipHidden.length = 0;
}

// 每帧同步学生相机位姿(PiP 渲染 + 运行模式面板朝向共用)
function syncStudentCam() {
  const eye = getStudentEye();
  if (!eye) return false;
  studentCam.position.set(eye.x, eye.y, eye.z);
  studentCam.rotation.set(0, eye.yaw, 0);
  return true;
}

function renderStudentPiP() {
  if (renderer.xr.isPresenting) { pipFrame.classList.add('hidden'); return; }
  const rig = getStudentRig();
  const show = rig && (state.selection.includes(rig) || (state.playMode && locomotion.mode !== 'static'));
  pipFrame.classList.toggle('hidden', !show);
  if (!show || !syncStudentCam()) return;
  const size = renderer.getSize(_pipSize);
  const w = Math.round(Math.min(size.x * 0.27, 360));
  const h = Math.round(w * 0.62);
  studentCam.aspect = w / h;
  studentCam.updateProjectionMatrix();
  hideEditorUIForPiP();
  renderer.setScissorTest(true);
  renderer.setViewport(size.x - w - 10, 36, w, h);   // 36 = 状态栏 26px + 边距 10px
  renderer.setScissor(size.x - w - 10, 36, w, h);
  renderer.render(scene, studentCam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, size.x, size.y);
  restoreAfterPiP();
  // 边框贴条与渲染区对齐(CSS 像素)
  pipFrame.style.width = w + 'px';
  pipFrame.style.height = h + 'px';
}

export function startLoop() {
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    // 3D 面板:始终面向"观看者"+ 实时数据重绘(~7fps 足够)
    // 编辑模式 → 面向编辑相机;运行模式(PC)→ 面向学生相机(这才是学生真实所见,
    // PiP 里的面板因此也是正的);XR 会话 → camera 本身就是头显位姿
    panelRedrawTimer += dt;
    const doRedraw = panelRedrawTimer > 0.15;
    if (doRedraw) panelRedrawTimer = 0;
    const useStudentView = state.playMode && !renderer.xr.isPresenting && syncStudentCam();
    (useStudentView ? studentCam : camera).getWorldQuaternion(_camQuat);
    sceneRoot.traverse(o => {
      if (o.userData.isBillboard) {
        o.parent.getWorldQuaternion(_parentQuat);
        o.quaternion.copy(_parentQuat.invert()).multiply(_camQuat);
      }
      if (doRedraw && o.userData.panelData?.live) drawPanel(o.userData.panelData);
    });

    if (state.animPlaying) {
      sceneRoot.children.forEach(obj => {
        // AI 编写的自定义每帧行为(报错持续 ~1s 自动停用,避免刷屏卡死)
        if (obj.userData.customUpdate) {
          try {
            obj.userData.customUpdate(dt, t, obj);
            obj.userData._updErr = 0;
          } catch (e) {
            if (!obj.userData._updErr) console.warn(`[customUpdate] ${obj.userData.displayName}:`, e);
            obj.userData._updErr = (obj.userData._updErr || 0) + 1;
            if (obj.userData._updErr > 60) {
              delete obj.userData.customUpdate;
              toast(L(`⚠ 「${obj.userData.displayName}」的自定义动画出错,已自动停用`,
                `⚠ Custom animation of "${obj.userData.displayName}" errored and was disabled`));
            }
          }
          if (obj === state.selected) selBox.setFromObject(obj);
        }
        const anim = obj.userData.anim;
        if (!anim) return;
        switch (anim.type) {
          case 'spin':
            obj.rotation.y += dt * anim.speed;
            break;
          case 'orbit': {
            anim.angle = (anim.angle ?? 0) + dt * anim.speed;
            obj.position.x = anim.cx + Math.cos(anim.angle) * anim.radius;
            obj.position.z = anim.cz + Math.sin(anim.angle) * anim.radius;
            if (anim.selfSpin !== false) obj.rotation.y += dt * 0.8;   // 公转自带自转,可单独关(检查器勾选框)
            break;
          }
          case 'swing': {
            const pivot = obj.children.find(c => c.userData.isSwingPivot);
            if (pivot) pivot.rotation.z = Math.sin(t * anim.speed) * anim.amplitude;
            break;
          }
          case 'float':
            obj.position.y = (anim.base ?? 1) + Math.sin(t * anim.speed) * 0.3 + 0.35;
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
        // 叠加自转:在任意主动画之上附加的 selfSpin(spin/orbit 自身已含旋转,不重复)
        if (anim.selfSpin && anim.type !== 'spin' && anim.type !== 'orbit') obj.rotation.y += dt * (anim.spinSpeed ?? 0.6);
        if (obj === state.selected) selBox.setFromObject(obj);
      });
      chemLabUpdate(dt, t);
      engLabUpdate(dt, t);
    }
    // 学生移动(XR 摇杆/瞬移、PC 方向键预览)与 XR 抓取拖动
    updateLocomotion(dt);
    // 运行模式的 PC 试玩:WASD 驱动学生胶囊(←→ 转向);此时方向键不再平移编辑相机
    if (!updateRigDrive(dt)) updatePCWalk(dt);
    if (rigDriveActive() && state.selected?.userData.studentRig) selBox.setFromObject(state.selected);
    updateXRInteraction();
    // 房间内 UI 面板可见性:观看者在房间外→隐藏该房间的面板;在房间内→面板顶层渲染不被遮挡
    updateRoomUIVisibility(dt);
    orbit.update();
    renderer.render(scene, camera);
    renderStudentPiP();   // 学生相机画中画(主画面之后叠加渲染)
  });
}

// ── WebXR ──
// 进入 VR 时按「学生视角」代表物摆放世界:学生出生在老师拖好的位置、面向老师定好的方向
// 数学:学生恒在世界原点 → scene.rotation.y = −yaw,scene.position = −R(−yaw)·spawn
export function setupXR() {
  renderer.xr.addEventListener('sessionstart', () => {
    const sp = getStudentSpawn();
    if (sp) {
      scene.rotation.y = -sp.yaw;
      const cos = Math.cos(-sp.yaw), sin = Math.sin(-sp.yaw);
      // sp.y = 出生脚底高度(二层/台上出生时整个世界下沉)
      scene.position.set(-(sp.x * cos + sp.z * sin), -(sp.y || 0), -(-sp.x * sin + sp.z * cos));
    } else {
      scene.position.set(0, 0, -5);   // 无代表物时退回旧行为:出生在场景边缘
    }
    setPlayMode(true);   // 学生进 VR = 一定是"上课",自动进入运行模式(动画+交互生效)
  });
  renderer.xr.addEventListener('sessionend', () => {
    scene.position.set(0, 0, 0);
    resetLocomotionPose();
    // 退出 VR 后 XR 改过 renderer 的尺寸/pixelRatio,不重置桌面画面会被上下压缩变形;
    // 等一帧让浏览器把 canvas 尺寸恢复后再重算相机 aspect 与画布
    requestAnimationFrame(() => resize());
  });
  setupXRInteraction();   // 控制器射线:扳机=activate/瞬移,grip=抓取(语义交互层)

  const vrButton = VRButton.createButton(renderer);
  vrButton.style.display = 'none';
  document.body.appendChild(vrButton);
  document.getElementById('btn-vr').addEventListener('click', () => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(ok => {
        if (ok) vrButton.click();
        else toast(L('🥽 当前设备不支持 WebXR VR 会话(需 VR 头显),但场景已具备 VR 能力',
          '🥽 This device does not support WebXR VR sessions (headset required), but the scene is VR-ready'));
      });
    } else {
      toast(L('🥽 当前浏览器不支持 WebXR,正式版中学生可通过头显进入此场景',
        '🥽 This browser does not support WebXR; students can enter this scene with a headset'));
    }
  });
}
