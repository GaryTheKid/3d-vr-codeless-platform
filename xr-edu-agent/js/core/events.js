// ═══════════════════════════════════════════════════════════════
//  轻量事件总线:模块间解耦通信
//  事件约定:
//   'hierarchy-changed'    场景对象增删改 → 层级面板重绘
//   'selection-changed'    选中对象变化 → 检查器/层级/状态栏刷新
//   'transform-changed'    手柄拖动中 → 检查器数值刷新
//   'anim-toggled'         全局动画时钟开关(播放器组件卡同步)
//   'play-mode-changed'    运行/编辑模式切换 → 工具栏 ▶ 按钮同步
//   'context-changed'      对话上下文引用变化 → 聊天区 pin 刷新
//   'focus-object'(obj)    在左侧层级面板中定位并闪烁高亮该对象
//   'agent-request'({obj,text}) 检查器发出的对象级 AI 指令 → chat.js 执行
//   'agent-say'(html)      实验/对话系统在聊天区主动发言
// ═══════════════════════════════════════════════════════════════
const listeners = {};

export function on(evt, fn) {
  (listeners[evt] ??= []).push(fn);
}

export function emit(evt, data) {
  (listeners[evt] || []).forEach(f => f(data));
}
