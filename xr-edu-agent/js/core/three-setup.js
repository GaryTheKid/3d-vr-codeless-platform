// ═══════════════════════════════════════════════════════════════
//  Three.js 基础场景:渲染器 / 相机 / 灯光 / 地面 / 相机控制 / 变换手柄
//  这里只做"硬件层"初始化,不涉及业务逻辑
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export const vpEl = document.getElementById('viewport');

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c10);
scene.fog = new THREE.Fog(0x0a0c10, 40, 90);

export const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
camera.position.set(9, 7, 12);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
vpEl.appendChild(renderer.domElement);

// 灯光
scene.add(new THREE.HemisphereLight(0x8fb4dd, 0x1c2028, 0.75));
export const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(8, 14, 6);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -25; dirLight.shadow.camera.right = 25;
dirLight.shadow.camera.top = 25; dirLight.shadow.camera.bottom = -25;
scene.add(dirLight);

// 地面 + 网格
export const ground = new THREE.Mesh(
  new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 0.95 })
);
ground.receiveShadow = true;
scene.add(ground);

export const grid = new THREE.GridHelper(60, 60, 0x2b3644, 0x1c222c);
grid.position.y = 0.001;
scene.add(grid);

// 场景对象都挂到 sceneRoot 下,便于层级管理
export const sceneRoot = new THREE.Group();
sceneRoot.name = 'SceneRoot';
scene.add(sceneRoot);

// 相机控制
// 注意:three@0.160 OrbitControls 用 (devicePixelRatio|0) 归一化滚轮;
// 浏览器缩小页面时 DPR 可能 <1 → 截成 0 → 除零 → 一格飞出场景。
// 因此关掉内置 zoom,自管滚轮(手感接近默认,但 DPR 安全)。
export const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1.5, 0);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI / 2 + 0.05;
orbit.minDistance = 1.5;
orbit.maxDistance = 60;
orbit.enableZoom = false; // custom wheel below — avoids three@0.160 DPR|0 divide-by-zero

/**
 * Match stock OrbitControls feel (~5% per typical mouse notch), but:
 * - never divide by (devicePixelRatio|0) when DPR < 1
 * - clamp per-event delta so trackpads can't dump huge jumps
 */
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!orbit.enabled) return;
  const dir = Math.sign(e.deltaY);
  if (!dir) return;
  const offset = camera.position.clone().sub(orbit.target);
  let dist = offset.length();
  if (!Number.isFinite(dist) || dist < 1e-4) {
    resetOrbitCamera(null);
    return;
  }
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const capped = Math.min(100, Math.abs(e.deltaY));
  const normalized = capped / (100 * dpr);
  const factor = Math.pow(0.95, Math.max(0.05, normalized)); // zoomSpeed ≈ 1
  const next = dir > 0 ? dist / factor : dist * factor; // scroll down = zoom out
  const clamped = Math.min(orbit.maxDistance, Math.max(orbit.minDistance, next));
  offset.multiplyScalar(clamped / dist);
  camera.position.copy(orbit.target).add(offset);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  orbit.update();
}, { passive: false });

/** Reset broken / NaN camera — do not fight normal orbit zoom. */
export function sanitizeOrbitCamera() {
  const dist = camera.position.distanceTo(orbit.target);
  if (!Number.isFinite(dist) || !Number.isFinite(camera.position.x) || dist < 0.05) {
    camera.position.set(9, 7, 12);
    orbit.target.set(0, 1.5, 0);
    camera.up.set(0, 1, 0);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    orbit.update();
  }
}

/** Soft framing used when switching VR sections — never carry extreme dolly across sections. */
export function resetOrbitCamera(defaults = null) {
  const d = defaults || { position: [9, 7, 12], target: [0, 1.5, 0] };
  camera.position.fromArray(d.position);
  orbit.target.fromArray(d.target);
  camera.up.set(0, 1, 0);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  orbit.update();
}

// 变换 Gizmo(移动/旋转/缩放)
export const tctrl = new TransformControls(camera, renderer.domElement);
tctrl.setSize(0.9);
tctrl.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; });
scene.add(tctrl);

export const clock = new THREE.Clock();

// 导出 resize:窗口尺寸变化、面板拖拽调宽、退出 VR 后都要重算相机 aspect 与画布尺寸
// (退出 WebXR 会话后 renderer 的 pixelRatio/尺寸会被 XR 改动,不重置画面会上下压缩变形)
export function resize() {
  const w = vpEl.clientWidth, h = vpEl.clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();
