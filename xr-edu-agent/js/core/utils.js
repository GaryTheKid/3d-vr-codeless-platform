// ═══════════════════════════════════════════════════════════════
//  通用工具:Toast 提示 / 延时 / HTML 转义 / 3D 积木函数
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';

export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; }, 2200);
  setTimeout(() => el.remove(), 2700);
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── 3D 积木函数 ──
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, ...opts });
}

export function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// 连接两点的圆柱(用于化学键、DNA 骨架)
export function bond(p1, p2, radius = 0.07, color = 0xcfd6e0) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const m = mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat(color));
  m.position.copy(p1).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

// 设置对象高度的简写
export function at(obj, y) { obj.position.y = y; return obj; }
