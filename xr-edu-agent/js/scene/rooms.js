// ═══════════════════════════════════════════════════════════════
//  房间壳构建器:地板 + 四面墙(可开门洞/窗带)+ 可选天花板
//  "室内体验"(教室/密室/餐厅…)的确定性基座 —— 壳由这里保证工整,
//  室内陈设由 Agent 用资源库/自定义对象往里摆
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';

const WALL_T = 0.12;         // 墙厚
const DOOR_W = 1.3, DOOR_H = 2.15;
const WIN_SILL = 1.0, WIN_TOP = 2.1;   // 窗带下沿/上沿

function m(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...opts });
}
function box(w, h, d, material) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  b.castShadow = b.receiveShadow = true;
  return b;
}

// 一面墙(局部坐标:沿 X 展开、贴 z=0),可带门洞或窗带
function wallSection(len, height, material, glassMat, { door = false, window: win = false } = {}) {
  const g = new THREE.Group();
  if (door) {
    // 窄墙(小卫生间等)自动收窄门洞而不是放弃开门 —— 房间绝不允许全封闭
    const dw = Math.min(DOOR_W, Math.max(0.7, len - 0.5));
    const side = (len - dw) / 2;
    const l = box(side, height, WALL_T, material); l.position.x = -(dw + side) / 2;
    const r = box(side, height, WALL_T, material); r.position.x = (dw + side) / 2;
    const lintel = box(dw, height - DOOR_H, WALL_T, material);
    lintel.position.y = DOOR_H + (height - DOOR_H) / 2 - height / 2;
    g.add(l, r, lintel);
  } else if (win && len > 2 && height > WIN_TOP + 0.2) {
    const bottom = box(len, WIN_SILL, WALL_T, material); bottom.position.y = WIN_SILL / 2 - height / 2;
    const top = box(len, height - WIN_TOP, WALL_T, material); top.position.y = WIN_TOP + (height - WIN_TOP) / 2 - height / 2;
    const glassH = WIN_TOP - WIN_SILL;
    const pillarW = 0.35;
    const pl = box(pillarW, glassH, WALL_T, material); pl.position.set(-(len - pillarW) / 2, WIN_SILL + glassH / 2 - height / 2, 0);
    const pr = box(pillarW, glassH, WALL_T, material); pr.position.set((len - pillarW) / 2, WIN_SILL + glassH / 2 - height / 2, 0);
    const glass = box(len - pillarW * 2, glassH, WALL_T * 0.4, glassMat);
    glass.position.y = WIN_SILL + glassH / 2 - height / 2;
    glass.castShadow = false;
    g.add(bottom, top, pl, pr, glass);
  } else {
    g.add(box(len, height, WALL_T, material));
  }
  return g;
}

// opts: { width, depth, height, wallColor, floorColor, doorWall: n|s|e|w, windows, ceiling }
export function buildRoom({
  width = 10, depth = 8, height = 3,
  wallColor = 0xd9d2c4, floorColor = 0x8a7460,
  doorWall = 's', windows = true, ceiling = false,
} = {}) {
  const g = new THREE.Group();
  const wallMat = m(wallColor);
  const glassMat = m(0xbfe3ff, { transparent: true, opacity: 0.28, roughness: 0.08 });

  // 房间必须有入口:非法/缺省的 doorWall 一律回退到 s(密室的"锁门"是门洞上放门对象,不是砌死)
  if (!['s', 'n', 'e', 'w'].includes(doorWall)) doorWall = 's';
  // 房间边界(局部坐标),供"房间内 UI 可见性"等运行时逻辑判定内外
  g.userData.roomBounds = { w: width, d: depth, h: height };

  const floor = box(width, 0.1, depth, m(floorColor, { roughness: 0.7 }));
  floor.position.y = 0.07;   // 底面抬离地面 0.02,避免与全局地面共面 z-fighting
  floor.userData.solid = true;   // 可踩表面:房间抬高建二层时学生能站上去
  g.add(floor);

  // 四面墙:s(+Z 面向内)/ n(−Z)/ e(+X)/ w(−X)
  const defs = [
    { key: 's', len: width, pos: [0, 0, depth / 2 - WALL_T / 2], rotY: 0 },
    { key: 'n', len: width, pos: [0, 0, -depth / 2 + WALL_T / 2], rotY: 0 },
    { key: 'e', len: depth, pos: [width / 2 - WALL_T / 2, 0, 0], rotY: Math.PI / 2 },
    { key: 'w', len: depth, pos: [-width / 2 + WALL_T / 2, 0, 0], rotY: Math.PI / 2 },
  ];
  for (const d of defs) {
    const isDoor = d.key === doorWall;
    const w = wallSection(d.len - WALL_T * 2, height, wallMat, glassMat, { door: isDoor, window: windows && !isDoor });
    w.position.set(d.pos[0], height / 2 + 0.12, d.pos[2]);
    w.rotation.y = d.rotY;
    w.userData.solid = true;   // 墙体实心:学生瞬移/平滑移动/WASD 撞墙被拦(门洞可通过)
    g.add(w);
  }

  if (ceiling) {
    const c = box(width, 0.08, depth, m(0xe8e4da, { roughness: 0.95 }));
    c.position.y = height + 0.16;
    c.castShadow = false;   // 不挡全局主光,免得室内一片死黑
    c.userData.solid = true;   // 兼作上一层的可踩楼板
    g.add(c);
    // 室内补光,模拟顶灯
    const lamp = new THREE.PointLight(0xfff2dd, 18, Math.max(width, depth) * 1.4, 1.6);
    lamp.position.y = height - 0.3;
    g.add(lamp);
  }
  return g;
}

// ── 直跑楼梯:一串矮台阶盒(每级 ≤0.25 米,碰撞系统可逐级踩上)──
// 局部坐标:起步台阶贴 z=0,沿 −Z 方向爬升到 rise 高;两侧可选简易扶手
// 顶部自带缓步平台(landing)+ 平台两侧实心护栏:平台顶面 = rise,
// 与二层地板(层高 + 0.12)之间只差一步可跨高度,视觉与行走都能顺滑对接
// opts: { rise 总高, run 总进深, width 梯宽, color, rails 扶手, landing 平台进深(0=不要) }
export function buildStairs({
  rise = 3, run = 3.6, width = 1.4, color = 0x9a8a74, rails = true, landing = 1.2,
} = {}) {
  const g = new THREE.Group();
  const stepMat = m(color, { roughness: 0.8 });
  const steps = Math.max(2, Math.ceil(rise / 0.25));   // 每级 ≤0.25 米(< 碰撞可跨高度 0.45)
  const stepH = rise / steps;
  const stepD = run / steps;
  for (let i = 0; i < steps; i++) {
    // 实心楼梯(台阶从地面砌到踏面),侧面看是整块,不会从台阶下钻过去
    const h = stepH * (i + 1);
    const s = box(width, h, stepD, stepMat);
    s.position.set(0, h / 2, -(i + 0.5) * stepD);
    g.add(s);
  }
  if (landing > 0) {
    const plat = box(width, 0.12, landing, stepMat);
    plat.position.set(0, rise - 0.06, -(run + landing / 2));
    g.add(plat);
    // 平台两侧实心护栏(防止上到顶后从侧面走空坠落);尽头开放,正对二层门洞/楼板
    const guardMat = m(0x5a5148, { roughness: 0.6, metalness: 0.2 });
    for (const side of [-1, 1]) {
      const guard = box(0.07, 0.95, landing, guardMat);
      guard.position.set(side * (width / 2 + 0.035), rise + 0.475, -(run + landing / 2));
      g.add(guard);
    }
  }
  if (rails) {
    const railMat = m(0x5a5148, { roughness: 0.5, metalness: 0.3 });
    for (const side of [-1, 1]) {
      const rail = box(0.06, 0.9, Math.hypot(rise, run) + 0.3, railMat);
      rail.position.set(side * (width / 2 + 0.03), rise / 2 + 0.55, -run / 2);
      rail.rotation.x = -Math.atan2(rise, run);
      rail.userData.solid = false;   // 扶手不参与碰撞(斜盒的 AABB 会挡住整段楼梯)
      g.add(rail);
    }
  }
  g.userData.solid = true;
  return g;
}
