// ═══════════════════════════════════════════════════════════════
//  房间内 UI 面板的可见性规则(用户 2026-07-12 指定,除非明确要求否则不移除):
//  · 面板往往比房间墙大/伸出墙外,在房间外看会被墙切一半 → 观看者在房间外时,
//    该房间内的所有 UI 面板整体隐藏(眼不见为净)
//  · 观看者在房间内时,该房间的面板提到最顶层渲染(depthTest 关 + renderOrder 高),
//    永远不被墙体/家具挡住
//  · "观看者" = XR 头显 > 运行模式学生眼 > 编辑相机;一律用世界坐标判定
//  · 房间识别:build_room 在 group.userData.roomBounds 存 {w,d,h}(局部坐标半空间测试,
//    房间被旋转/搬动照样正确);面板识别:mesh.userData.panelData(含 attachLabel 标签)
//  · 导出播放器内嵌同款逻辑(exporter.js PLAYER_SRC)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { renderer, camera, sceneRoot } from './three-setup.js';
import { state } from './state.js';
import { getStudentEye } from '../scene/student-rig.js';

const _viewer = new THREE.Vector3();
const _p = new THREE.Vector3();
const _local = new THREE.Vector3();
let timer = 0;

// 被本模块改过状态的面板:mesh → { visible, depthTest, renderOrder }
const touched = new Map();

function viewerPos(out) {
  if (renderer.xr.isPresenting) return camera.getWorldPosition(out);
  if (state.vrPreview || state.playMode) {
    const eye = getStudentEye();
    if (eye) return out.set(eye.x, eye.y, eye.z);
  }
  return out.copy(camera.position);
}

// point(世界坐标)是否在 room 内(转局部坐标做盒测试;y 放宽到楼板下 0.5)
function insideRoom(room, point) {
  const b = room.userData.roomBounds;
  _local.copy(point);
  room.worldToLocal(_local);
  return Math.abs(_local.x) < b.w / 2 && Math.abs(_local.z) < b.d / 2 &&
    _local.y > -0.5 && _local.y < b.h + 0.6;
}

function remember(mesh) {
  if (!touched.has(mesh)) {
    touched.set(mesh, {
      visible: mesh.visible,
      depthTest: mesh.material?.depthTest ?? true,
      renderOrder: mesh.renderOrder,
    });
  }
}

function apply(mesh, mode) {
  // mode: 'hide' | 'top' | 'normal'
  const prev = touched.get(mesh);
  if (mode === 'normal') {
    if (prev) {
      mesh.visible = prev.visible;
      if (mesh.material) mesh.material.depthTest = prev.depthTest;
      mesh.renderOrder = prev.renderOrder;
      touched.delete(mesh);
    }
    return;
  }
  remember(mesh);
  if (mode === 'hide') {
    mesh.visible = false;
  } else {   // top:顶层渲染,不被墙/家具遮挡
    mesh.visible = touched.get(mesh).visible;
    if (mesh.material) mesh.material.depthTest = false;
    mesh.renderOrder = 1000;
  }
}

export function updateRoomUIVisibility(dt) {
  timer += dt;
  if (timer < 0.2) return;
  timer = 0;

  const rooms = sceneRoot.children.filter(o => o.visible && o.userData.roomBounds);
  if (!rooms.length) {
    if (touched.size) for (const mesh of [...touched.keys()]) apply(mesh, 'normal');
    return;
  }

  viewerPos(_viewer);
  const viewerIn = rooms.filter(r => insideRoom(r, _viewer));

  const seen = new Set();
  sceneRoot.traverse(o => {
    if (!o.userData.panelData) return;
    seen.add(o);
    o.getWorldPosition(_p);
    const room = rooms.find(r => insideRoom(r, _p));
    if (!room) apply(o, 'normal');
    else if (viewerIn.includes(room)) apply(o, 'top');
    else apply(o, 'hide');
  });
  // 面板被删除/移出场景后清理残留记录
  for (const mesh of [...touched.keys()]) {
    if (!seen.has(mesh)) touched.delete(mesh);
  }
}
