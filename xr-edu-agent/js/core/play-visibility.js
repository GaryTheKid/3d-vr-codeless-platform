// ═══════════════════════════════════════════════════════════════
//  运行模式下的"学生不该看到"规则:
//  · 导览路线(add_path,role ≠ content)是老师的设计辅助线 → 运行/导出时隐藏;
//    箭头(add_arrow)默认保留 —— 它们常是教学内容本身(提示/受力方向)
//  · 隐藏/恢复都推迟到事件队列尾(rAF):保证 play-reset 的快照先于隐藏发生、
//    还原先于恢复发生,与监听器注册顺序解耦
//  · 学生视角 PiP 预览同样复用 isRouteHiddenForStudent 判定
// ═══════════════════════════════════════════════════════════════
import { sceneRoot } from './three-setup.js';
import { state } from './state.js';
import { on } from './events.js';

// 该对象在"学生眼中"是否应当隐藏(运行模式 / PiP 预览 / 导出播放器同一规则)
export function isRouteHiddenForStudent(o) {
  return o.userData.guideKind === 'path' && o.userData.guideRole !== 'content';
}

const hidden = new Set();

function hideRoutes() {
  if (!state.playMode) return;
  for (const o of sceneRoot.children) {
    if (o.visible && isRouteHiddenForStudent(o)) { o.visible = false; hidden.add(o); }
  }
}

function showRoutes() {
  for (const o of hidden) o.visible = true;
  hidden.clear();
}

on('play-mode-changed', v => {
  // rAF 推迟:进入时等 play-reset 先拍快照,退出时等它先还原
  requestAnimationFrame(() => { if (v) hideRoutes(); else showRoutes(); });
});
// 运行中 AI 新画的路线也即时隐藏
on('hierarchy-changed', () => { if (state.playMode) requestAnimationFrame(hideRoutes); });
