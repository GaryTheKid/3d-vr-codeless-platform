// ═══════════════════════════════════════════════════════════════
//  资源构建器:每个函数返回一个 Object3D(已含默认高度/动画)
//  纯几何构建,不涉及场景管理;被 registry.js 引用
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { mat, mesh, bond, at } from '../core/utils.js';
import { makePanel } from '../panels/panel3d.js';
import { L } from '../core/i18n.js';

// ── 教学标注 ──
export function buildInfoPanel() {
  const g = new THREE.Group();
  const p = makePanel({
    title: L('📋 参数面板', '📋 Info Panel'), width: 2.2,
    lines: [
      { k: L('参数 A', 'Param A'), v: '1.00' },
      { k: L('参数 B', 'Param B'), v: '42' },
      L('可挂在实验旁显示数据', 'Place beside an experiment to show data'),
    ],
  });
  p.position.y = 2;
  g.add(p);
  return g;
}

export function buildTaskBoard() {
  const g = new THREE.Group();
  const p = makePanel({
    title: L('🎯 探究任务', '🎯 Inquiry Tasks'), accent: '#f0a848', width: 2.4,
    lines: L(
      ['1. 观察现象,记录数据', '2. 提出你的猜想', '3. 动手验证'],
      ['1. Observe and record data', '2. Make your hypothesis', '3. Test it yourself']),
  });
  p.position.y = 2;
  g.add(p);
  return g;
}

// ── 数学几何体(透明面 + 棱线 + 顶点)──
export const MATH_SOLIDS = [
  { id: 'msCube',    icon: '🟦', name: L('正方体', 'Cube'),          F: 6,  color: 0x4a9eff, geo: () => new THREE.BoxGeometry(1.7, 1.7, 1.7) },
  { id: 'msTetra',   icon: '🔻', name: L('正四面体', 'Tetrahedron'),  F: 4,  color: 0x3fb96f, geo: () => new THREE.TetrahedronGeometry(1.3) },
  { id: 'msOcta',    icon: '💠', name: L('正八面体', 'Octahedron'),   F: 8,  color: 0xf0a848, geo: () => new THREE.OctahedronGeometry(1.2) },
  { id: 'msPrism',   icon: '📏', name: L('三棱柱', 'Triangular Prism'), F: 5, color: 0xa878f0, geo: () => new THREE.CylinderGeometry(1.05, 1.05, 1.7, 3) },
  { id: 'msPyramid', icon: '⛰', name: L('四棱锥', 'Square Pyramid'), F: 5,  color: 0xe5748b, geo: () => new THREE.ConeGeometry(1.15, 1.6, 4) },
  { id: 'msIcosa',   icon: '⚽', name: L('正二十面体', 'Icosahedron'), F: 20, color: 0x48c8f0, geo: () => new THREE.IcosahedronGeometry(1.2) },
];

export function buildMathSolid(def) {
  const g = new THREE.Group();
  const geo = def.geo();
  // 半透明面
  const faces = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: def.color, transparent: true, opacity: 0.22, roughness: 0.2, metalness: 0,
    side: THREE.DoubleSide, depthWrite: false,
  }));
  faces.renderOrder = 1;
  // 棱线描边
  const eg = new THREE.EdgesGeometry(geo, 1);
  const edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  g.add(faces, edges);
  // 顶点小球:从棱线端点去重提取(避开圆柱/圆锥端面三角扇的中心点)
  const pos = eg.attributes.position;
  const seen = new Set();
  const vGeo = new THREE.SphereGeometry(0.075, 12, 10);
  const vMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map(n => n.toFixed(3)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const dot = new THREE.Mesh(vGeo, vMat);
    dot.position.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    g.add(dot);
  }
  g.userData.vef = { V: seen.size, E: pos.count / 2, F: def.F };
  g.position.y = 1.6;
  g.userData.anim = { type: 'spin', speed: 0.45 };
  return g;
}

// ── 天文 ──
export function buildSun() {
  const g = new THREE.Group();
  const core = mesh(new THREE.SphereGeometry(1.5, 40, 30), mat(0xffa726, { emissive: 0xff8f00, emissiveIntensity: 0.9, roughness: 1 }));
  const glow = new THREE.PointLight(0xffb74d, 30, 25);
  g.add(core, glow);
  g.position.y = 2.2;
  g.userData.anim = { type: 'spin', speed: 0.25 };
  return g;
}

export function buildPlanet(r, color, patch) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(r, 32, 24), mat(color)));
  if (patch) { // 简易"大陆"贴块
    for (let i = 0; i < 7; i++) {
      const p = mesh(new THREE.SphereGeometry(r * 0.32, 10, 8), mat(patch, { roughness: 0.9 }));
      p.position.setFromSphericalCoords(r * 0.92, Math.random() * Math.PI, Math.random() * Math.PI * 2);
      p.scale.z = 0.35;
      p.lookAt(0, 0, 0);
      g.add(p);
    }
  }
  g.position.y = r + 0.9;
  g.userData.anim = { type: 'spin', speed: 0.5 };
  return g;
}

export function buildSaturn() {
  const g = buildPlanet(0.8, 0xd8b26e);
  const ring = mesh(new THREE.RingGeometry(1.1, 1.7, 48), new THREE.MeshStandardMaterial({ color: 0xc8b89a, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
  ring.rotation.x = Math.PI / 2.25;
  g.add(ring);
  return g;
}

export function buildRocket() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.8, 24), mat(0xe8eaf0));
  body.position.y = 1.2;
  const nose = mesh(new THREE.ConeGeometry(0.35, 0.7, 24), mat(0xe5534b));
  nose.position.y = 2.45;
  const flame = mesh(new THREE.ConeGeometry(0.28, 0.6, 16), mat(0xffa726, { emissive: 0xff6f00, emissiveIntensity: 1 }));
  flame.position.y = 0.05; flame.rotation.x = Math.PI;
  g.add(body, nose, flame);
  for (let i = 0; i < 3; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.08, 0.55, 0.45), mat(0xe5534b));
    const a = i * Math.PI * 2 / 3;
    fin.position.set(Math.cos(a) * 0.42, 0.55, Math.sin(a) * 0.42);
    fin.rotation.y = -a;
    g.add(fin);
  }
  g.userData.anim = { type: 'float', speed: 1.2, base: 0 };
  return g;
}

// ── 化学 ──
export function atomBall(r, color, x, y, z) {
  const b = mesh(new THREE.SphereGeometry(r, 24, 18), mat(color, { roughness: 0.35 }));
  b.position.set(x, y, z);
  return b;
}

export function buildWater() {
  const g = new THREE.Group();
  const O = atomBall(0.55, 0xe5534b, 0, 0, 0);
  const h1 = new THREE.Vector3(-0.75, 0.55, 0), h2 = new THREE.Vector3(0.75, 0.55, 0);
  g.add(O, atomBall(0.34, 0xf2f4f8, h1.x, h1.y, h1.z), atomBall(0.34, 0xf2f4f8, h2.x, h2.y, h2.z));
  g.add(bond(new THREE.Vector3(0, 0, 0), h1), bond(new THREE.Vector3(0, 0, 0), h2));
  g.position.y = 1.6;
  g.userData.anim = { type: 'spin', speed: 0.4 };
  return g;
}

export function buildCO2() {
  const g = new THREE.Group();
  const o1 = new THREE.Vector3(-1.1, 0, 0), o2 = new THREE.Vector3(1.1, 0, 0);
  g.add(atomBall(0.45, 0x3a3f47, 0, 0, 0), atomBall(0.5, 0xe5534b, o1.x, 0, 0), atomBall(0.5, 0xe5534b, o2.x, 0, 0));
  g.add(bond(new THREE.Vector3(0, 0, 0.12), o1.clone().setZ(0.12)), bond(new THREE.Vector3(0, 0, -0.12), o1.clone().setZ(-0.12)));
  g.add(bond(new THREE.Vector3(0, 0, 0.12), o2.clone().setZ(0.12)), bond(new THREE.Vector3(0, 0, -0.12), o2.clone().setZ(-0.12)));
  g.position.y = 1.6;
  g.userData.anim = { type: 'spin', speed: 0.4 };
  return g;
}

export function buildMethane() {
  const g = new THREE.Group();
  g.add(atomBall(0.5, 0x3a3f47, 0, 0, 0));
  const t = 1.05 / Math.sqrt(3);
  [[t, t, t], [-t, -t, t], [-t, t, -t], [t, -t, -t]].forEach(([x, y, z]) => {
    g.add(atomBall(0.32, 0xf2f4f8, x, y, z));
    g.add(bond(new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, y, z)));
  });
  g.position.y = 1.7;
  g.userData.anim = { type: 'spin', speed: 0.4 };
  return g;
}

export function buildBeaker() {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.28, roughness: 0.1 });
  const glass = mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.3, 32, 1, true), glassMat);
  glass.material.side = THREE.DoubleSide;
  glass.position.y = 0.65;
  const liquid = mesh(new THREE.CylinderGeometry(0.48, 0.45, 0.55, 32), mat(0x48c8f0, { transparent: true, opacity: 0.85, emissive: 0x1580a8, emissiveIntensity: 0.25 }));
  liquid.position.y = 0.32;
  const bottom = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 32), glassMat);
  bottom.position.y = 0.02;
  g.add(glass, liquid, bottom);
  return g;
}

export function buildFlask() {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xd8f0d8, transparent: true, opacity: 0.3, roughness: 0.1, side: THREE.DoubleSide });
  const body = mesh(new THREE.ConeGeometry(0.62, 1.1, 32, 1, true), glassMat);
  body.position.y = 0.55;
  const neck = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 20, 1, true), glassMat);
  neck.position.y = 1.3;
  const liquid = mesh(new THREE.ConeGeometry(0.52, 0.5, 32), mat(0x8de08d, { transparent: true, opacity: 0.85, emissive: 0x2a8a2a, emissiveIntensity: 0.2 }));
  liquid.position.y = 0.28;
  g.add(body, neck, liquid);
  return g;
}

export function buildAtom() {
  const g = new THREE.Group();
  g.add(atomBall(0.4, 0xf0a848, 0, 0, 0));
  for (let i = 0; i < 3; i++) {
    const orbitRing = mesh(new THREE.TorusGeometry(1.15, 0.02, 8, 60), mat(0x4a9eff, { emissive: 0x2a6acc, emissiveIntensity: 0.6 }));
    orbitRing.rotation.set(Math.PI / 2 * (i === 0 ? 1 : 0.4), i * Math.PI / 3, i * Math.PI / 4);
    const e = atomBall(0.09, 0x48c8f0, 1.15, 0, 0);
    e.material.emissive = new THREE.Color(0x1580c8);
    e.material.emissiveIntensity = 1;
    orbitRing.add(e);
    g.add(orbitRing);
  }
  g.position.y = 1.8;
  g.userData.anim = { type: 'spin', speed: 1.1 };
  return g;
}

// ── 物理 ──
export function buildPendulum() {
  const g = new THREE.Group();
  const frame = mesh(new THREE.BoxGeometry(0.15, 3, 0.15), mat(0x8a6d4a));
  frame.position.set(-1.2, 1.5, 0);
  const beam = mesh(new THREE.BoxGeometry(2.6, 0.15, 0.15), mat(0x8a6d4a));
  beam.position.set(0, 3, 0);
  // 摆的旋转轴(pivot),摆绳与摆锤都挂在下面
  const pivot = new THREE.Group();
  pivot.position.set(0.5, 3, 0);
  const rope = mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 8), mat(0xcfd6e0));
  rope.position.y = -1.05;
  const bob = mesh(new THREE.SphereGeometry(0.32, 24, 18), mat(0xf0c840, { metalness: 0.7, roughness: 0.25 }));
  bob.position.y = -2.15;
  pivot.add(rope, bob);
  pivot.userData.isSwingPivot = true;
  g.add(frame, beam, pivot);
  g.userData.anim = { type: 'swing', speed: 1.6, amplitude: 0.6 };
  return g;
}

export function buildRamp() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(3, 0); shape.lineTo(0, 1.6); shape.lineTo(0, 0);
  const ramp = mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false }), mat(0x5a8ac8));
  ramp.position.set(-1.5, 0, -0.7);
  const ball = mesh(new THREE.SphereGeometry(0.3, 24, 18), mat(0xe5534b, { metalness: 0.5, roughness: 0.3 }));
  ball.position.set(-1.1, 1.65, 0);
  ball.userData.isRampBall = true;
  g.add(ramp, ball);
  g.userData.anim = { type: 'ramp', speed: 1 };
  return g;
}

export function buildSpring() {
  const pts = [];
  const coils = 8, r = 0.4, h = 1.8;
  for (let i = 0; i <= coils * 24; i++) {
    const t = i / (coils * 24);
    pts.push(new THREE.Vector3(Math.cos(t * coils * Math.PI * 2) * r, t * h, Math.sin(t * coils * Math.PI * 2) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.Group();
  const coil = mesh(new THREE.TubeGeometry(curve, 240, 0.05, 8), mat(0x9aa8b8, { metalness: 0.8, roughness: 0.3 }));
  const weight = mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), mat(0xf0a848));
  weight.position.y = h + 0.2;
  weight.userData.isSpringWeight = true;
  g.add(coil, weight);
  g.userData.anim = { type: 'bounce', speed: 2.2 };
  g.userData.springCoil = coil;
  return g;
}

export function buildMagnet() {
  const g = new THREE.Group();
  const arc = mesh(new THREE.TorusGeometry(0.7, 0.24, 14, 40, Math.PI), mat(0xc23a3a));
  arc.rotation.z = Math.PI;
  arc.position.y = 1.1;
  const legN = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 14), mat(0xc23a3a));
  legN.position.set(-0.7, 0.75, 0);
  const legS = legN.clone(); legS.position.x = 0.7;
  const tipN = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 14), mat(0xe8eaf0));
  tipN.position.set(-0.7, 0.24, 0);
  const tipS = tipN.clone(); tipS.position.x = 0.7;
  g.add(arc, legN, legS, tipN, tipS);
  return g;
}

export function buildLever() {
  const g = new THREE.Group();
  const fulcrum = mesh(new THREE.ConeGeometry(0.45, 0.9, 4), mat(0x8a6d4a));
  fulcrum.position.y = 0.45;
  const plank = mesh(new THREE.BoxGeometry(4, 0.12, 0.6), mat(0xc8a878));
  plank.position.y = 0.95;
  plank.rotation.z = 0.12;
  const w1 = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(0x4a9eff));
  w1.position.set(-1.7, 1.4, 0);
  const w2 = mesh(new THREE.SphereGeometry(0.22, 18, 14), mat(0xe5534b));
  w2.position.set(1.75, 0.95, 0);
  g.add(fulcrum, plank, w1, w2);
  return g;
}

// ── 生物 ──
export function buildDNA() {
  const g = new THREE.Group();
  const turns = 2.2, height = 3.2, steps = 44, R = 0.6;
  const colors = [0x4a9eff, 0xf0a848, 0x3fb96f, 0xe5534b];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const y = t * height;
    const p1 = new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
    const p2 = new THREE.Vector3(-Math.cos(a) * R, y, -Math.sin(a) * R);
    g.add(atomBall(0.09, 0xd8dde5, p1.x, p1.y, p1.z));
    g.add(atomBall(0.09, 0xd8dde5, p2.x, p2.y, p2.z));
    if (i % 3 === 0) {
      const c = colors[(i / 3) % 4 | 0];
      const mid = p1.clone().lerp(p2, 0.5);
      g.add(bond(p1, mid, 0.05, c), bond(mid, p2, 0.05, colors[((i / 3) + 2) % 4 | 0]));
    }
  }
  g.position.y = 0.4;
  g.userData.anim = { type: 'spin', speed: 0.45 };
  return g;
}

export function buildCell() {
  const g = new THREE.Group();
  const membrane = mesh(new THREE.SphereGeometry(1.3, 32, 24), new THREE.MeshStandardMaterial({ color: 0xf0c8d8, transparent: true, opacity: 0.35, roughness: 0.4 }));
  const nucleus = mesh(new THREE.SphereGeometry(0.5, 24, 18), mat(0xa855a8));
  for (let i = 0; i < 8; i++) {
    const org = mesh(new THREE.CapsuleGeometry(0.09, 0.25, 6, 10), mat(0x3fb96f));
    org.position.setFromSphericalCoords(0.65 + Math.random() * 0.45, Math.random() * Math.PI, Math.random() * Math.PI * 2);
    org.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    g.add(org);
  }
  g.add(membrane, nucleus);
  g.position.y = 1.6;
  g.userData.anim = { type: 'spin', speed: 0.25 };
  return g;
}

export function buildTree() {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 12), mat(0x7a5230));
  trunk.position.y = 0.8;
  g.add(trunk);
  const leafMat = mat(0x2f9e50, { roughness: 0.85 });
  [[0, 2.1, 0, 1], [-0.5, 1.7, 0.3, 0.7], [0.5, 1.8, -0.3, 0.75]].forEach(([x, y, z, s]) => {
    const leaf = mesh(new THREE.IcosahedronGeometry(0.75 * s, 1), leafMat);
    leaf.position.set(x, y, z);
    g.add(leaf);
  });
  return g;
}

// ── 教室环境 ──
export function buildDesk() {
  const g = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(1.6, 0.09, 0.9), mat(0xc8a878));
  top.position.y = 1;
  g.add(top);
  [[-0.7, -0.36], [0.7, -0.36], [-0.7, 0.36], [0.7, 0.36]].forEach(([x, z]) => {
    const leg = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 10), mat(0x5a6270));
    leg.position.set(x, 0.5, z);
    g.add(leg);
  });
  return g;
}

export function buildWhiteboard() {
  const g = new THREE.Group();
  const board = mesh(new THREE.BoxGeometry(3, 1.7, 0.08), mat(0xf2f4f8, { roughness: 0.2 }));
  board.position.y = 1.9;
  const frame = mesh(new THREE.BoxGeometry(3.15, 1.85, 0.06), mat(0x5a6270));
  frame.position.set(0, 1.9, -0.02);
  [[-1.4], [1.4]].forEach(([x]) => {
    const leg = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), mat(0x5a6270));
    leg.position.set(x, 0.55, 0);
    g.add(leg);
  });
  g.add(frame, board);
  return g;
}

export function buildGlobe() {
  const g = new THREE.Group();
  const stand = mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.12, 24), mat(0x8a6d4a));
  stand.position.y = 0.06;
  const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), mat(0x9aa8b8, { metalness: 0.7 }));
  pole.position.y = 0.7; pole.rotation.z = 0.4;
  const globe = buildPlanet(0.55, 0x3d7bd4, 0x2a9d5c);
  globe.position.set(0, 1, 0);
  g.add(stand, pole, globe);
  g.userData.anim = { type: 'spin', speed: 0.6 };
  return g;
}

// ── 基础形状(参数化)──
export function buildBasic(kind) {
  switch (kind) {
    case 'cube':     return at(mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mat(0x4a9eff)), 0.7);
    case 'sphere':   return at(mesh(new THREE.SphereGeometry(0.8, 32, 24), mat(0xa878f0)), 0.8);
    case 'cylinder': return at(mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 32), mat(0x3fb96f)), 0.8);
    case 'cone':     return at(mesh(new THREE.ConeGeometry(0.8, 1.6, 32), mat(0xf0a848)), 0.8);
    case 'torus':    return at(mesh(new THREE.TorusGeometry(0.7, 0.26, 18, 40), mat(0xe5748b)), 1);
    case 'pyramid':  return at(mesh(new THREE.ConeGeometry(1, 1.5, 4), mat(0x48c8f0)), 0.75);
  }
}
