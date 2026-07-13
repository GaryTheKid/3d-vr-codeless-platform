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
export const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1.5, 0);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI / 2 + 0.05;

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
