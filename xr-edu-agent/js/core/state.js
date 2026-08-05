// ═══════════════════════════════════════════════════════════════
//  全局共享状态(单一数据源)
//  各模块 import { state } 读写;避免散落的全局变量
// ═══════════════════════════════════════════════════════════════
import { emit } from './events.js';

export const state = {
  selected: null,      // 主选中对象(Object3D | null;多选时=最后点的那个,gizmo 挂它)
  selection: [],       // 全部选中对象(Shift 多选;选中即加入 AI 对话上下文)
  objCounter: 0,       // 对象计数器(用于命名与 oid)
  playMode: false,     // 运行模式(类 Unity Play):开=动画播放+学生交互生效;关=编辑模式,点击一律选中
  vrPreview: false,    // 桌面 VR 预览:主视口切学生第一人称(含模拟手柄射线);非 immersive 会话
  animPlaying: false,  // 全局动画时钟开关(playMode 的子开关:运行中老师仍可单独暂停动画)
  contextPins: [],     // 已加入对话上下文的场景对象(= selection 的镜像,选中即上下文)
  ctxTurn: 0,          // 对话轮次计数(orchestrator 每轮 +1,工作集判定用)
  touched: new Map(),  // oid → 最后被创建/修改的轮次("工作集":近几轮碰过的对象在大场景里优先进上下文)
  outline: null,       // Learning Outline (Chapter→Section); see core/outline.js
  knowledgeGraph: null, // MindMap / KG hard-anchor; see core/knowledge-graph.js
  learnMode: false,    // 学生学习模式:精简 UI + Ask 学习助教;退出时还原备课态
  coursePipelineBusy: false, // true while PDF→KG→Outline→section fan-out runs
  /** jobId of the teaching doc this authoring session is bound to (null = none) */
  activeDocJobId: null,
};

// 切换 运行/编辑 模式(工具栏 ▶ 按钮 / XR 进入 / AI 工具共用入口)
// 运行模式 = 动画播放 + 学生交互生效;编辑模式 = 全静态,点击对象一律选中
export function setPlayMode(v) {
  if (state.playMode === v) return;
  state.playMode = v;
  state.animPlaying = v;   // 联动动画时钟(运行中仍可用"动画播放器"单独暂停)
  emit('anim-toggled', v);
  emit('play-mode-changed', v);
}

// 给场景对象分配稳定 ID(Agent 工具调用时用它定位对象)
export function assignOid(obj) {
  state.objCounter++;
  obj.userData.oid = 'o' + state.objCounter;
  return obj;
}

// 记录对象在本轮被创建/修改(工具 exec 里调用)
export function markTouched(obj) {
  if (obj?.userData?.oid) state.touched.set(obj.userData.oid, state.ctxTurn);
}
