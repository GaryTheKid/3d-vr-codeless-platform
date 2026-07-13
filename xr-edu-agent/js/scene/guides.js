// ═══════════════════════════════════════════════════════════════
//  引导图元构建器:箭头 / 路线(轨迹·线条)—— 确定性几何,不需要模型写代码
//  · 双重用途:既可以是场景内容(轨迹演示/几何示意),也可以是教学引导
//    (提示箭头/导览路线);用途语义存 userData.guideRole,便于检索与讲解
//  · 全部返回"底部贴地、以自身中心为原点"的 Group,老师可像普通对象一样拖动
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';

const V3 = ({ x = 0, y = 0, z = 0 } = {}) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

function guideMat(color, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.35, roughness: 0.45,
    ...(opacity < 1 ? { transparent: true, opacity } : {}),
  });
}

// 沿切线方向的小圆锥(箭头尖/方向标)
function cone(pos, dir, radius, height, material) {
  const c = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 12), material);
  c.position.copy(pos);
  c.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  return c;
}

// 两点间的圆柱段(虚线段用)
function seg(p1, p2, radius, material) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 8), material);
  m.position.copy(p1).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  return m;
}

// ── 箭头:from → to(可选拱起弧度)──
export function buildArrow({ from, to, color = 0xf0c840, width = 0.06, curveHeight = 0 } = {}) {
  const p1 = V3(from), p2 = V3(to);
  const mid = p1.clone().add(p2).multiplyScalar(0.5);
  mid.y = 0;                                   // 组原点落在两点中点的地面投影
  const a = p1.clone().sub(mid), b = p2.clone().sub(mid);
  const g = new THREE.Group();
  const material = guideMat(color);
  const tipH = Math.max(0.14, width * 4);
  const curve = curveHeight > 0
    ? new THREE.QuadraticBezierCurve3(a, a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, curveHeight, 0)), b)
    : new THREE.LineCurve3(a, b);
  // 箭杆截到 ~93%,给箭头尖留位置(极短箭头也至少留 5% 杆身)
  const shaftEnd = Math.max(0.05, 1 - tipH / Math.max(curve.getLength(), 0.001) * 0.6);
  const pts = [];
  for (let i = 0; i <= 24; i++) pts.push(curve.getPointAt(Math.min(1, i / 24 * shaftEnd)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, width, 8), material));
  g.add(cone(curve.getPointAt(1), curve.getTangentAt(1), width * 2.4, tipH, material));
  g.position.copy(mid);
  return g;
}

// ── 路线/轨迹:经过一串路径点的曲线 ──
// style: solid 实线管 | dashed 虚线段 | dots 圆点串
// showDirection: 沿途方向小箭头;markWaypoints: 起点绿/终点红/途经黄的路径点标记
export function buildPath({
  points = [], color = 0x4fd6ff, width = 0.05, style = 'solid',
  showDirection = false, markWaypoints = false, closed = false, defaultY = 0.05,
} = {}) {
  const pts = points.map(p => new THREE.Vector3(p.x ?? 0, p.y ?? defaultY, p.z ?? 0));
  // 组原点 = 路径点质心的地面投影
  const center = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  center.y = 0;
  const local = pts.map(p => p.clone().sub(center));
  const curve = new THREE.CatmullRomCurve3(local, closed, 'catmullrom', 0.35);
  const material = guideMat(color);
  const g = new THREE.Group();
  const len = curve.getLength();

  if (style === 'solid') {
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(32, local.length * 10), width, 8, closed), material));
  } else if (style === 'dashed') {
    const dash = 0.32, gap = 0.18, n = Math.max(1, Math.floor(len / (dash + gap)));
    for (let i = 0; i < n; i++) {
      const t0 = i * (dash + gap) / len, t1 = Math.min(1, t0 + dash / len);
      g.add(seg(curve.getPointAt(t0), curve.getPointAt(t1), width, material));
    }
  } else if (style === 'dots') {
    const step = 0.4, n = Math.max(2, Math.floor(len / step));
    const geo = new THREE.SphereGeometry(width * 1.6, 10, 8);
    for (let i = 0; i <= n; i++) {
      const d = new THREE.Mesh(geo, material);
      d.position.copy(curve.getPointAt(i / n));
      g.add(d);
    }
  }

  if (showDirection) {
    const every = 1.4, n = Math.max(1, Math.floor(len / every));
    for (let i = 1; i <= n; i++) {
      const t = Math.min(0.99, i / (n + 1));
      g.add(cone(curve.getPointAt(t).add(new THREE.Vector3(0, width * 0.5, 0)), curve.getTangentAt(t), width * 2.2, Math.max(0.12, width * 4), material));
    }
  }
  if (markWaypoints) {
    local.forEach((p, i) => {
      const isStart = i === 0, isEnd = !closed && i === local.length - 1;
      const c = isStart ? 0x3fb96f : isEnd ? 0xe5534b : 0xf0c840;
      const m = new THREE.Mesh(new THREE.SphereGeometry(isStart || isEnd ? 0.11 : 0.075, 12, 10), guideMat(c));
      m.position.copy(p).y += 0.02;
      g.add(m);
    });
  }
  g.position.copy(center);
  return g;
}
