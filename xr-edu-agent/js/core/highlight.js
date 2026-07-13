// ═══════════════════════════════════════════════════════════════
//  平台级交互反馈(所有可交互对象免费获得,AI 不需要也不应该自己写):
//  · hover(鼠标悬停 / XR 射线指向)→ 淡蓝自发光描边感
//  · activate(点击 / 扳机)→ 短促高亮闪烁后回落
//  实现:临时改 MeshStandardMaterial 的 emissive/emissiveIntensity,
//  离开/结束时恢复原值(不动 MeshBasicMaterial —— 面板贴图类不参与)
// ═══════════════════════════════════════════════════════════════

const HOVER_COLOR = 0x3d7dd6;
const FLASH_COLOR = 0x8fc4ff;

let hovered = null;                 // 当前 hover 的顶层对象
const saved = new Map();            // material → { hex, intensity }

function applyGlow(obj, colorHex, intensity) {
  obj.traverse(o => {
    const m = o.material;
    if (!o.isMesh || !m || !m.emissive) return;
    if (!saved.has(m)) saved.set(m, { hex: m.emissive.getHex(), intensity: m.emissiveIntensity });
    m.emissive.setHex(colorHex);
    m.emissiveIntensity = intensity;
  });
}

function clearGlow(obj) {
  obj.traverse(o => {
    const m = o.material;
    if (!o.isMesh || !m || !saved.has(m)) return;
    const s = saved.get(m);
    m.emissive.setHex(s.hex);
    m.emissiveIntensity = s.intensity;
    saved.delete(m);
  });
}

// hover 目标切换(传 null = 清除);返回当前 hover 对象
export function setHover(obj) {
  if (obj === hovered) return hovered;
  if (hovered) clearGlow(hovered);
  hovered = obj;
  if (hovered) applyGlow(hovered, HOVER_COLOR, 0.45);
  return hovered;
}

// 点击/扳机触发成功后的闪烁反馈(结束后若仍在 hover 恢复 hover 态)
export function flash(obj) {
  if (hovered === obj) clearGlow(obj);   // 先清掉 hover 记录,避免恢复值被闪烁值污染
  applyGlow(obj, FLASH_COLOR, 1.2);
  setTimeout(() => {
    clearGlow(obj);
    if (hovered === obj) applyGlow(obj, HOVER_COLOR, 0.45);
  }, 160);
}
