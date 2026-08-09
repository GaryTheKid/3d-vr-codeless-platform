// ═══════════════════════════════════════════════════════════════
//  动画循环 + WebXR 会话管理
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { renderer, scene, camera, sceneRoot, orbit, resize, tctrl, grid } from './three-setup.js';
import { clock } from './three-setup.js';
import { state, setPlayMode } from './state.js';
import { toast } from './utils.js';
import { L, t } from './i18n.js';
import { on } from './events.js';
import { selBox, extraBoxes, deselect } from '../scene/manager.js';
import { drawPanel } from '../panels/panel3d.js';
import { chemLabUpdate } from '../labs/chem-oxygen.js';
import { engLabUpdate } from '../labs/english-cafe.js';
import { setupXRInteraction, updateXRInteraction } from './interaction.js';
import { updateLocomotion, updatePCWalk, resetLocomotionPose, locomotion } from './locomotion.js';
import { getStudentSpawn, getStudentEye, getStudentRig, updateRigDrive, rigDriveActive } from '../scene/student-rig.js';
import { isRouteHiddenForStudent } from './play-visibility.js';
import { updateRoomUIVisibility } from './room-ui-visibility.js';
import { studyFlag } from './study-test-flags.js';

const _camQuat = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();
let panelRedrawTimer = 0;

// ── 学生相机(PiP + 桌面 VR 预览共用)──
const studentCam = new THREE.PerspectiveCamera(60, 4 / 3, 0.1, 200);
const pipFrame = document.getElementById('cam-preview-frame');
const _pipSize = new THREE.Vector2();
const _pipHidden = [];
let orbitWasOn = true;   // 进 VR 预览前 orbit 是否开着,退出时还原

// ── 真 VR 会话时的 PC 镜像(头显投屏效果)──
// 用独立第二渲染器(独立画布 + 独立 GL 上下文),不再"渲染头显后临时关 renderer.xr
// 再渲一遍到页面画布"——那种切换会与 three 内部的 XR framebuffer 绑定/视口状态打架,
// 部分环境下 PC 画布黑屏。两个渲染器共享同一份场景图(各自上传 GPU 资源,无需同步);
// 镜像限 30fps + pixelRatio 1,控制双倍渲染的开销。
const mirrorCam = new THREE.PerspectiveCamera(70, 4 / 3, 0.1, 500);
const _mirrorScale = new THREE.Vector3();
let mirror = null;        // { r: WebGLRenderer, canvas }(懒创建,不进 VR 不占第二个 GL 上下文)
let mirrorTimer = 1;
function ensureMirror() {
  if (mirror) return mirror;
  const canvas = document.createElement('canvas');
  canvas.id = 'vr-mirror';
  // 无 z-index + 插为首个子元素:定位元素天然盖住静态的主画布,又不遮住工具栏等后续定位元素
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;background:#0a0c10;';
  const host = renderer.domElement.parentElement;
  host.insertBefore(canvas, host.firstChild);
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
  if (mirrorTimer < 1 / 30) return;   // 旁观画面 30fps 足够;跳过的帧保留上一帧画面不闪
  mirrorTimer = 0;
  const host = m.canvas.parentElement;
  const w = host.clientWidth || 2, h = host.clientHeight || 2;
  if (m.canvas.width !== w || m.canvas.height !== h) m.r.setSize(w, h, false);
  renderer.xr.getCamera().matrixWorld.decompose(mirrorCam.position, mirrorCam.quaternion, _mirrorScale);
  mirrorCam.aspect = w / h;
  mirrorCam.updateProjectionMatrix();
  m.r.render(scene, mirrorCam);
}
function hideMirror() { if (mirror) mirror.canvas.style.display = 'none'; }

// 桌面 VR 预览下手柄激光(模拟 XR 控制器射线;真 immersive 会话用 interaction.js 的控制器)
const previewRays = new THREE.Group();
previewRays.name = 'vr-preview-rays';
previewRays.visible = false;
scene.add(previewRays);
function makePreviewRay(xSign) {
  const g = new THREE.Group();
  const hand = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xddeeff })
  );
  hand.position.set(xSign * 0.22, -0.28, -0.18);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.75 })
  );
  line.position.copy(hand.position);
  line.scale.z = 5;
  g.add(hand, line);
  previewRays.add(g);
}
makePreviewRay(-1);
makePreviewRay(1);

function syncPreviewRays() {
  if (!state.vrPreview || !syncStudentCam()) { previewRays.visible = false; return; }
  previewRays.visible = true;
  previewRays.position.copy(studentCam.position);
  previewRays.rotation.set(0, studentCam.rotation.y, 0);
}

/** 当前主视口用于点选/渲染的相机(VR 预览=学生眼;否则=编辑相机) */
export function getViewCamera() {
  return state.vrPreview ? studentCam : camera;
}

export function isVrPreview() {
  return !!state.vrPreview;
}

function syncVrButton() {
  const btn = document.getElementById('btn-vr');
  if (!btn) return;
  btn.textContent = state.vrPreview ? t('top.vrExit') : t('top.vr');
  btn.title = t('top.vrTitle');
  btn.classList.toggle('primary', !state.vrPreview);
}

export function enterVrPreview({ toastMsg = true } = {}) {
  // Study TEMP: keep normal orbit 3D play (see js/core/study-test-flags.js)
  if (studyFlag('disableVrPlayerController')) return;
  if (state.vrPreview) return;
  state.vrPreview = true;
  if (!state.playMode) setPlayMode(true);
  orbitWasOn = orbit.enabled;
  orbit.enabled = false;
  deselect();
  syncVrButton();
  if (toastMsg) toast(t('top.vrOn'));
}

export function exitVrPreview({ toastMsg = true } = {}) {
  if (!state.vrPreview) return;
  state.vrPreview = false;
  previewRays.visible = false;
  orbit.enabled = orbitWasOn;
  syncVrButton();
  if (toastMsg) toast(t('top.vrOff'));
}

export function toggleVrPreview() {
  if (state.vrPreview) exitVrPreview();
  else enterVrPreview();
}

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
  // VR 预览时主视口已经是学生眼,不再叠小窗;真 XR 会话也不叠
  if (renderer.xr.isPresenting || state.vrPreview) { pipFrame.classList.add('hidden'); return; }
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

    // 3D 面板:始终面向「当前主视口观看者」+ 实时数据重绘(~7fps 足够)
    // 桌面 VR 预览 → 学生眼;真 XR → 头显(camera);其余(含编辑/仅运行)→ 编辑相机
    panelRedrawTimer += dt;
    const doRedraw = panelRedrawTimer > 0.15;
    if (doRedraw) panelRedrawTimer = 0;
    const faceStudent = state.vrPreview && !renderer.xr.isPresenting && syncStudentCam();
    (faceStudent ? studentCam : camera).getWorldQuaternion(_camQuat);
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
    syncPreviewRays();

    if (state.vrPreview && !renderer.xr.isPresenting && syncStudentCam()) {
      // 桌面 VR 预览:整视口渲染学生第一人称(隐藏编辑器 UI / 代表物 / 路线)
      const size = renderer.getSize(_pipSize);
      studentCam.aspect = size.x / Math.max(size.y, 1);
      studentCam.updateProjectionMatrix();
      hideEditorUIForPiP();
      renderer.setViewport(0, 0, size.x, size.y);
      renderer.render(scene, studentCam);
      restoreAfterPiP();
    } else if (renderer.xr.isPresenting) {
      // 真 VR 会话:头显画面 + 第二渲染器把头显位姿的画面渲到镜像画布(投屏效果——
      // 学生真实所见,含手柄射线/瞬移落点环;编辑器 UI 双端都不出现)
      hideEditorUIForPiP();
      renderer.render(scene, camera);   // 头显(XR framebuffer)
      renderMirror(dt);                 // PC 镜像(独立画布/GL 上下文,30fps)
      restoreAfterPiP();
      pipFrame.classList.add('hidden');
    } else {
      renderer.render(scene, camera);
      renderStudentPiP();   // 学生相机画中画(主画面之后叠加渲染)
    }
  });
}

// ── WebXR + 桌面 VR 预览 ──
// 顶栏「进入 VR 预览」= 桌面第一人称(学生眼中所见 + 模拟手柄射线)。
// 不再从编辑器直接拉起 immersive-vr(会把页面画布整屏变黑);真头显仍可在导出播放器里体验。
// 若已有 immersive 会话(扩展入口),仍按学生出生点摆世界。
export function setupXR() {
  renderer.xr.addEventListener('sessionstart', () => {
    exitVrPreview({ toastMsg: false });   // 真头显优先,退出桌面预览
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
    hideMirror();
    resetLocomotionPose();
    // 退出 VR 后 XR 改过 renderer 的尺寸/pixelRatio,不重置桌面画面会被上下压缩变形;
    // 等一帧让浏览器把 canvas 尺寸恢复后再重算相机 aspect 与画布
    requestAnimationFrame(() => resize());
  });
  setupXRInteraction();   // 控制器射线:扳机=activate/瞬移,grip=抓取(语义交互层)

  // 隐藏 three.js 默认 VRButton;顶栏按钮改为桌面第一人称预览
  const vrButton = VRButton.createButton(renderer);
  vrButton.style.display = 'none';
  vrButton.classList.add('xr-force-hidden');
  document.body.appendChild(vrButton);
  // three.js may flip display later — keep a MutationObserver-lite poll via CSS !important

  const btn = document.getElementById('btn-vr');
  btn?.addEventListener('click', e => {
    if (studyFlag('disableVrPlayerController')) {
      toast(L('试学模式:当前为普通 3D 场景(VR 玩家已暂时关闭)', 'Study mode: normal 3D scene (VR player temporarily off)'));
      return;
    }
    // 普通点击 = 桌面学生第一人称预览;Shift+点击 = 真 immersive 头显会话(若设备支持)
    if (e.shiftKey) {
      if (!navigator.xr) {
        toast(L('🥽 当前浏览器不支持 WebXR', '🥽 This browser does not support WebXR'));
        return;
      }
      navigator.xr.isSessionSupported('immersive-vr').then(ok => {
        if (ok) vrButton.click();
        else toast(L('🥽 当前设备不支持 WebXR VR 会话(需 VR 头显)',
          '🥽 This device does not support WebXR VR sessions (headset required)'));
      });
      return;
    }
    toggleVrPreview();
  });

  syncVrButton();
  // ▶ 运行 → 桌面学生第一人称(试学 TEMP 关闭:见 study-test-flags.disableVrPlayerController)
  on('play-mode-changed', v => {
    if (!v) exitVrPreview({ toastMsg: false });
    else if (!renderer.xr.isPresenting && !studyFlag('disableVrPlayerController')) {
      enterVrPreview({ toastMsg: false });
    }
  });

  // Study TEMP: hide Enter VR chrome (restore by flipping the flag)
  if (studyFlag('disableVrPlayerController') && btn) {
    btn.classList.add('study-hide-vr');
    btn.style.display = 'none';
  }
}
