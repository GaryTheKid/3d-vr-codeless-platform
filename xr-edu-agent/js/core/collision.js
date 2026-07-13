// ═══════════════════════════════════════════════════════════════
//  轻量玩家碰撞(XZ 平面 AABB + 高度感知):防穿墙 + 楼梯/多层楼支撑
//  · 标记方式:对象(或其任意祖先)userData.solid = true → 其下所有网格视为实心
//    build_room 的墙体 / build_stairs 的台阶自动带 solid;AI 自定义对象可自行标记
//  · 碰撞盒在"场景内容坐标系"计算(XR 里 scene 会被平移/旋转,内容坐标不受影响)
//  · 拦挡判定相对玩家脚底高度 feetY:只有落在 [feetY+STEP_UP, feetY+BODY_H]
//    身体带内的实心体才算墙;低于 STEP_UP 的实心体是"可踩上去的台阶/地板"
//  · groundHeightAt 采样脚下地面高度 → 楼梯上下 / 二层地板行走
//  · resolveMove 支持贴墙滑动;segmentBlocked 供瞬移做"视线不穿墙"判定
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { sceneRoot } from './three-setup.js';
import { on } from './events.js';

const PLAYER_R = 0.28;        // 玩家胶囊半径(米),碰撞盒按它外扩
const STEP_UP = 0.45;         // 可直接跨上的最大高差(台阶/楼梯)
const BODY_H = 1.75;          // 玩家身体高度带

let boxes = [];               // { minX, minZ, maxX, maxZ, minY, maxY }(内容坐标,XZ 已外扩)
let dirty = true;
on('hierarchy-changed', () => { dirty = true; });
on('transform-changed', () => { dirty = true; });

const _b = new THREE.Box3();
const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();

// 最近的显式标记生效:solid=false 可在 solid 组内豁免个别部件(如楼梯扶手)
function isSolid(mesh) {
  for (let o = mesh; o && o !== sceneRoot; o = o.parent) {
    if (o.userData.solid === false) return false;
    if (o.userData.solid) return true;
  }
  return false;
}

function rebuild() {
  dirty = false;
  boxes = [];
  sceneRoot.updateWorldMatrix(true, true);
  _inv.copy(sceneRoot.matrixWorld).invert();
  sceneRoot.traverse(o => {
    if (!o.isMesh || !o.geometry || !isSolid(o)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _m.multiplyMatrices(_inv, o.matrixWorld);
    _b.copy(o.geometry.boundingBox).applyMatrix4(_m);
    boxes.push({
      minX: _b.min.x - PLAYER_R, maxX: _b.max.x + PLAYER_R,
      minZ: _b.min.z - PLAYER_R, maxZ: _b.max.z + PLAYER_R,
      minY: _b.min.y, maxY: _b.max.y,
    });
  });
}

// 该盒对脚底在 feetY 的玩家是否构成"墙"(顶面高于可跨高度且底面低于头顶)
function wallsFor(b, feetY) {
  return b.maxY > feetY + STEP_UP && b.minY < feetY + BODY_H;
}

export function hasColliders() {
  if (dirty) rebuild();
  return boxes.length > 0;
}

// 点 (x,z) 对脚底高度 feetY 的玩家是否被实心体拦挡
export function pointBlocked(x, z, feetY = 0) {
  if (dirty) rebuild();
  for (const b of boxes) {
    if (!wallsFor(b, feetY)) continue;
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
  }
  return false;
}

// 采样 (x,z) 处玩家的站立高度:所有顶面 ≤ feetY+STEP_UP 的实心体里取最高;没有则回到地面 0
// (楼梯 = 一串矮台阶盒,逐级采样上升;走出二层边缘 = 采样回落)
export function groundHeightAt(x, z, feetY = 0) {
  if (dirty) rebuild();
  let h = 0;
  for (const b of boxes) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
    if (b.maxY <= feetY + STEP_UP && b.maxY > h) h = b.maxY;
  }
  return h;
}

// 2D 线段是否穿过任一"墙"级实心盒(slab 法;瞬移"不能隔墙传送"用)
function segHitsBox(x1, z1, x2, z2, b) {
  const dx = x2 - x1, dz = z2 - z1;
  let tmin = 0, tmax = 1;
  for (const [d, p, lo, hi] of [[dx, x1, b.minX, b.maxX], [dz, z1, b.minZ, b.maxZ]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
    } else {
      let t1 = (lo - p) / d, t2 = (hi - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export function segmentBlocked(x1, z1, x2, z2, feetY = 0) {
  if (dirty) rebuild();
  for (const b of boxes) {
    if (!wallsFor(b, feetY)) continue;
    if (segHitsBox(x1, z1, x2, z2, b)) return true;
  }
  return false;
}

// 连续移动的落点解算:目标可达 → 到达;撞墙 → 尝试沿 X / Z 轴滑动;都不行 → 原地
export function resolveMove(fromX, fromZ, toX, toZ, feetY = 0) {
  if (dirty) rebuild();
  if (!boxes.length) return { x: toX, z: toZ };
  if (!pointBlocked(toX, toZ, feetY)) return { x: toX, z: toZ };
  if (!pointBlocked(toX, fromZ, feetY)) return { x: toX, z: fromZ };
  if (!pointBlocked(fromX, toZ, feetY)) return { x: fromX, z: toZ };
  return { x: fromX, z: fromZ };
}
