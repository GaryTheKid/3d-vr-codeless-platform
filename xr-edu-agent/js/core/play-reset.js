// ═══════════════════════════════════════════════════════════════
//  运行模式重置(类 Unity Play Mode):
//  ▶ 进入运行模式 → 深度快照整个场景;⏹ 停止 → 还原到运行前状态。
//  运行期间的动画位移、学生交互改的状态、代码 spawn 的实例全部回滚。
//
//  快照内容(比 history.js 的撤销快照更深,覆盖"运行会改的一切"):
//  · 每个节点(整棵子树)的 transform / visible / 子节点列表(捕获 spawn/删除)
//  · 每个 Mesh 的材质颜色与透明度(交互代码常改这两项)
//  · userData 里所有 JSON 安全值的深拷贝(step 状态机 / latch 闩锁 / anim.angle…);
//    函数与 THREE 对象(customUpdate/panelData 等)保持原引用不动
//  · 根级子对象列表(运行中 spawn 到场景根的对象停止时移除,被删的恢复)
//
//  边界:Agent 在运行模式中改了场景 → 该轮结束时 orchestrator 调
//  refreshPlaySnapshot() 把基线更新为最新状态,否则停止运行会把 AI 的成果一起回滚。
// ═══════════════════════════════════════════════════════════════
import { sceneRoot } from './three-setup.js';
import { state, setPlayMode } from './state.js';
import { on, emit } from './events.js';
import { deselect, selBox } from '../scene/manager.js';
import { toast } from './utils.js';
import { L } from './i18n.js';
import { chemLab } from '../labs/chem-oxygen.js';
import { engLab } from '../labs/english-cafe.js';

let snap = null;

// userData 值是否 JSON 安全(可深拷贝、可安全回滚)
function jsonSafe(v, depth = 0) {
  if (v === null || v === undefined) return true;
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (t !== 'object' || depth > 6) return false;
  if (v.isObject3D || v.isTexture || v.isMaterial || v.isColor || v.isBufferGeometry
    || (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement)) return false;
  const vals = Array.isArray(v) ? v : Object.values(v);
  return vals.every(x => jsonSafe(x, depth + 1));
}

function captureNode(o) {
  const ud = o.userData;
  const safe = {};
  for (const k of Object.keys(ud)) {
    if (!jsonSafe(ud[k])) continue;
    try { safe[k] = JSON.parse(JSON.stringify(ud[k] ?? null)); }
    catch { /* 循环引用等极端情况:该键不参与回滚 */ }
  }
  const n = {
    o,
    pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone(),
    visible: o.visible,
    children: o.children.slice(),
    ud: safe,
  };
  if (o.isMesh && o.material) {
    n.mat = {
      color: o.material.color ? o.material.color.getHex() : null,
      opacity: o.material.opacity,
      emissive: o.material.emissive ? o.material.emissive.getHex() : null,
    };
  }
  return n;
}

// 内置实验的模块级状态机(chemLab/engLab)也随运行推进,一并快照 JSON 安全字段
function captureLab(lab) {
  const s = {};
  for (const k of Object.keys(lab)) if (jsonSafe(lab[k])) s[k] = JSON.parse(JSON.stringify(lab[k] ?? null));
  return s;
}
function restoreLab(lab, s) {
  for (const [k, v] of Object.entries(s)) lab[k] = JSON.parse(JSON.stringify(v));
}

function capture() {
  const nodes = [];
  sceneRoot.traverse(o => { if (o !== sceneRoot) nodes.push(captureNode(o)); });
  snap = { rootChildren: sceneRoot.children.slice(), nodes, chem: captureLab(chemLab), eng: captureLab(engLab) };
}

function restoreNode(n) {
  const o = n.o;
  o.position.copy(n.pos); o.quaternion.copy(n.quat); o.scale.copy(n.scale);
  o.visible = n.visible;
  // 子节点列表回滚(移除运行中 spawn 的,恢复运行中被删的)
  const cur = o.children, want = n.children;
  if (cur.length !== want.length || cur.some((c, i) => c !== want[i])) {
    for (const c of cur.slice()) o.remove(c);
    for (const c of want) o.add(c);
  }
  // userData:回滚 JSON 安全值,删除运行中新增的 JSON 安全键;函数/THREE 引用不动
  const ud = o.userData;
  for (const k of Object.keys(ud)) {
    if (!(k in n.ud) && jsonSafe(ud[k])) delete ud[k];
  }
  for (const [k, v] of Object.entries(n.ud)) ud[k] = JSON.parse(JSON.stringify(v));
  if (n.mat && o.material) {
    if (n.mat.color !== null && o.material.color) o.material.color.setHex(n.mat.color);
    if (n.mat.opacity !== undefined) o.material.opacity = n.mat.opacity;
    if (n.mat.emissive !== null && o.material.emissive) o.material.emissive.setHex(n.mat.emissive);
  }
}

function restore(opts = {}) {
  if (!snap) return;
  // 根级对象列表回滚(先做,子树才完整)
  for (const c of sceneRoot.children.slice()) sceneRoot.remove(c);
  for (const c of snap.rootChildren) sceneRoot.add(c);
  for (const n of snap.nodes) restoreNode(n);
  restoreLab(chemLab, snap.chem);
  restoreLab(engLab, snap.eng);
  // 运行中触发的瞬态特效(气泡/倒吸水珠在 scene 级 fx 层,不在 sceneRoot 快照范围)统一熄灭
  if (chemLab.fx) chemLab.fx.children.forEach(c => { c.visible = false; });
  chemLab.bubbles.forEach(b => { b.active = false; });
  snap = null;
  // 选中对象可能已被回滚移除或移回原位(选中即上下文,一并清理)
  if (state.selected && !state.selected.parent) deselect();
  else if (state.selected) selBox.setFromObject(state.selected);
  state.selection = state.selection.filter(o => sceneRoot.children.includes(o));
  state.contextPins = [...state.selection];
  emit('hierarchy-changed');
  emit('context-changed');
  if (!opts.silent) {
    toast(L('⏹ 场景已还原到运行前的状态', '⏹ Scene restored to its pre-play state'));
  }
}

// Agent 在运行模式中改完场景后调用:把回滚基线更新为最新状态,
// 避免老师停止运行时把 AI 刚搭的内容一起回滚掉
export function refreshPlaySnapshot() {
  if (state.playMode) capture();
}

/** Exit ▶ Play before swapping VR sections (silent restore — section sync will load the target). */
let silentRestoreOnce = false;
export function stopPlayForSectionSwitch() {
  if (!state.playMode) return false;
  silentRestoreOnce = true;
  setPlayMode(false);
  return true;
}

on('play-mode-changed', v => {
  if (v) {
    capture();
    return;
  }
  const silent = silentRestoreOnce;
  silentRestoreOnce = false;
  restore({ silent });
});
