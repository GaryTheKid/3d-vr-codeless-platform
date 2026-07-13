// ═══════════════════════════════════════════════════════════════
//  可拖拽的左右面板宽度(类 IDE)
//  · 改浏览器窗口大小时面板宽度保持不变(中间视口伸缩);老师可拖拽面板
//    内侧边缘手柄手动调宽,宽度存 localStorage,刷新后保留
//  · 拖动时实时重算视口画布(否则 3D 画面比例会变形)
// ═══════════════════════════════════════════════════════════════
import { resize } from '../core/three-setup.js';

const LIMITS = { left: { min: 190, max: 460 }, right: { min: 260, max: 560 } };
const KEY = 'xr-panel-widths';

const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');

// 恢复上次的宽度
function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved.left) leftPanel.style.width = clamp('left', saved.left) + 'px';
    if (saved.right) rightPanel.style.width = clamp('right', saved.right) + 'px';
  } catch { /* 忽略损坏的缓存 */ }
}
function clamp(side, px) {
  return Math.max(LIMITS[side].min, Math.min(LIMITS[side].max, px));
}
function saveWidths() {
  localStorage.setItem(KEY, JSON.stringify({
    left: parseInt(leftPanel.style.width) || leftPanel.offsetWidth,
    right: parseInt(rightPanel.style.width) || rightPanel.offsetWidth,
  }));
}

function makeDraggable(handleId, panel, side) {
  const handle = document.getElementById(handleId);
  if (!handle) return;
  let startX = 0, startW = 0, rafPending = false;

  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = panel.offsetWidth;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    document.body.classList.add('resizing-cols');
  });

  handle.addEventListener('pointermove', e => {
    if (!handle.hasPointerCapture?.(e.pointerId)) return;
    // 左面板:向右拖变宽;右面板:向左拖变宽
    const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
    panel.style.width = clamp(side, startW + delta) + 'px';
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => { rafPending = false; resize(); });
    }
  });

  const end = e => {
    if (!handle.classList.contains('dragging')) return;
    handle.classList.remove('dragging');
    document.body.classList.remove('resizing-cols');
    try { handle.releasePointerCapture(e.pointerId); } catch { /* 已释放 */ }
    resize();
    saveWidths();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

loadWidths();
// 恢复宽度后视口宽度已变,必须重算画布,否则 canvas 保持旧尺寸溢出盖住右侧面板
resize();
requestAnimationFrame(resize);
makeDraggable('resizer-left', leftPanel, 'left');
makeDraggable('resizer-right', rightPanel, 'right');
