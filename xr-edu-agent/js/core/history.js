// ═══════════════════════════════════════════════════════════════
//  撤销 / 重做(快照式,类 Cursor 的 Undo/Redo + Keep)
//
//  · 每次"用户级操作"发生前调用 record() 存一份场景快照;undo/redo 在
//    快照间来回切换。保留最近 CAP 步(≥ 用户要求的 5 步)。
//  · 快照持有对象**引用**(removeObject/clearScene 不 dispose 几何),所以
//    被删的对象能原样恢复、AI 现场造的自定义对象及其行为代码也能还原。
//  · 覆盖:对象增删、位移/缩放/旋转、颜色、动画开关、自定义行为开关、
//    全局环境(灯光/网格/播放/视角锁)。实验(chem/eng)内部状态机不纳入
//    (labs 有独立 dispose 钩子),属已知边界。
// ═══════════════════════════════════════════════════════════════
import { sceneRoot, dirLight, grid } from './three-setup.js';
import { state } from './state.js';
import { emit } from './events.js';
import { select, deselect } from '../scene/manager.js';
import { toast } from './utils.js';
import { L } from './i18n.js';

const CAP = 30;               // 保留步数上限(远多于要求的 5 步)
const undoStack = [];         // 过去的状态快照
const redoStack = [];         // 撤销后可重做的状态快照
let suspended = false;        // 恢复过程中禁止再记录

const setOrDel = (ud, key, val) => { if (val !== undefined) ud[key] = val; else delete ud[key]; };

function captureColors(o) {
  const colors = [];
  o.traverse(c => { if (c.isMesh && c.material?.color) colors.push([c.uuid, c.material.color.getHex()]); });
  return colors;
}

function captureObj(o) {
  const ud = o.userData;
  return {
    obj: o,
    pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone(),
    visible: o.visible,
    colors: captureColors(o),
    displayName: ud.displayName,
    anim: ud.anim ? JSON.parse(JSON.stringify(ud.anim)) : undefined,
    savedAnim: ud.savedAnim ? JSON.parse(JSON.stringify(ud.savedAnim)) : undefined,
    // 行为函数存活在对象上,这里只记"启用/停用"这一对引用
    b: {
      customUpdate: ud.customUpdate, savedCustomUpdate: ud.savedCustomUpdate,
      customClick: ud.customClick, savedCustomClick: ud.savedCustomClick,
      onGrab: ud.onGrab, onDrag: ud.onDrag, onRelease: ud.onRelease,
    },
  };
}

function snapshot() {
  return {
    children: sceneRoot.children.map(captureObj),
    // 注:不纳入 orbit.enabled —— gizmo 拖动时它被临时置 false,存进快照会导致撤销后相机冻结;
    //     视角锁定是临时操作偏好,由"视角控制器"开关独立管理,不参与撤销/重做
    env: { light: dirLight.visible, grid: grid.visible, anim: state.animPlaying },
    selectedOid: state.selected?.userData.oid || null,
  };
}

function restore(snap) {
  suspended = true;
  deselect();
  while (sceneRoot.children.length) sceneRoot.remove(sceneRoot.children[0]);
  for (const c of snap.children) {
    const o = c.obj, ud = o.userData;
    o.position.copy(c.pos); o.quaternion.copy(c.quat); o.scale.copy(c.scale);
    o.visible = c.visible;
    ud.displayName = c.displayName;
    const cmap = new Map(c.colors);
    o.traverse(m => { if (m.isMesh && cmap.has(m.uuid)) m.material.color.setHex(cmap.get(m.uuid)); });
    setOrDel(ud, 'anim', c.anim); setOrDel(ud, 'savedAnim', c.savedAnim);
    setOrDel(ud, 'customUpdate', c.b.customUpdate); setOrDel(ud, 'savedCustomUpdate', c.b.savedCustomUpdate);
    setOrDel(ud, 'customClick', c.b.customClick); setOrDel(ud, 'savedCustomClick', c.b.savedCustomClick);
    setOrDel(ud, 'onGrab', c.b.onGrab); setOrDel(ud, 'onDrag', c.b.onDrag); setOrDel(ud, 'onRelease', c.b.onRelease);
    sceneRoot.add(o);
  }
  dirLight.visible = snap.env.light;
  grid.visible = snap.env.grid;
  state.animPlaying = snap.env.anim;
  // 清理已不在场景里的对象的 📌 上下文引用
  state.contextPins = state.contextPins.filter(o => sceneRoot.children.includes(o));
  suspended = false;
  const sel = snap.selectedOid && sceneRoot.children.find(o => o.userData.oid === snap.selectedOid);
  if (sel) select(sel);
  emit('anim-toggled', state.animPlaying);
  emit('hierarchy-changed');
  emit('context-changed');
  updateButtons();
}

function pushSnapshot(snap) {
  if (suspended) return;
  undoStack.push(snap);
  if (undoStack.length > CAP) undoStack.shift();
  redoStack.length = 0;
  updateButtons();
}

// 在一次"用户级操作"发生前调用:存下当前状态,清空重做栈
export function record() { if (!suspended) pushSnapshot(snapshot()); }

// 无法在改动前判断是否真会改动时:先 beginTentative() 抓一份,确认改了再 commitTentative()
export function beginTentative() { return snapshot(); }
export function commitTentative(snap) { pushSnapshot(snap); }

export function undo() {
  if (!undoStack.length) { toast(L('没有可撤销的操作', 'Nothing to undo')); return false; }
  redoStack.push(snapshot());
  restore(undoStack.pop());
  toast(L('↩ 已撤销', '↩ Undone'));
  return true;
}

export function redo() {
  if (!redoStack.length) { toast(L('没有可重做的操作', 'Nothing to redo')); return false; }
  undoStack.push(snapshot());
  restore(redoStack.pop());
  toast(L('↪ 已重做', '↪ Redone'));
  return true;
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }

// ── 工具栏按钮 + 键盘快捷键 ──
const undoBtn = document.getElementById('vt-undo');
const redoBtn = document.getElementById('vt-redo');
function updateButtons() {
  if (undoBtn) undoBtn.disabled = !undoStack.length;
  if (redoBtn) redoBtn.disabled = !redoStack.length;
}
undoBtn?.addEventListener('click', undo);
redoBtn?.addEventListener('click', redo);
updateButtons();

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const meta = e.ctrlKey || e.metaKey;
  if (!meta) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
});
