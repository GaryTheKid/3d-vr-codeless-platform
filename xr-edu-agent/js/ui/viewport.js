// ═══════════════════════════════════════════════════════════════
//  视口交互:点选 / 拖放 / 工具栏 / 快捷键 / 浮动属性检查器
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { renderer, camera, sceneRoot, tctrl, orbit, grid, vpEl } from '../core/three-setup.js';
import { state, setPlayMode } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { toast, escapeHtml } from '../core/utils.js';
import { select, deselect, removeObject, addAsset, selBox, getMainColor, setMainColor, findObject } from '../scene/manager.js';
import { dispatchInteraction, getSemanticHandler, isInteractable } from '../core/interaction.js';
import { setHover } from '../core/highlight.js';
import { locomotion } from '../core/locomotion.js';
import { record } from '../core/history.js';
import { findAssetSkill } from '../assets/registry.js';
import { t } from '../core/i18n.js';
import { animDesc, ACTION_DESC } from './hierarchy.js';
import { updatePanelContent } from '../panels/panel3d.js';

// ── 点选 / PC Interactor(鼠标 → 语义交互事件)──
// 运行模式(▶):单击可交互对象 = 触发交互;按住拖动带 onGrab 的对象 = grab/drag/release;Alt+单击 = 强制选中
// 编辑模式(默认):所有对象点击一律 = 选中编辑(可交互对象与普通对象无差别)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let downPos = null;
let grabbing = null;         // 鼠标抓住的对象
let orbitWasEnabled = true;  // 抓取前的相机控制状态(尊重"视角锁定")

function setPointer(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

// skipEditorOnly:运行模式下学生化身等编辑器对象点击穿透(Alt+点击仍可选中)
function hitTopObject(skipEditorOnly = false) {
  const hits = raycaster.intersectObjects(sceneRoot.children, true);
  for (const h of hits) {
    let top = h.object;
    while (top.parent && top.parent !== sceneRoot) top = top.parent;
    if (skipEditorOnly && top.userData.editorOnly) continue;
    return { obj: top, point: h.point };
  }
  return null;
}

// 结束抓取:恢复相机控制(无论指针在哪松开都能兜底,防止 orbit 永久卡死)
function endGrab(pointerId) {
  if (!grabbing) return;
  dispatchInteraction(grabbing, 'release', {});
  grabbing = null;
  orbit.enabled = orbitWasEnabled;
  if (pointerId != null) {
    try { renderer.domElement.releasePointerCapture(pointerId); } catch { /* 已释放 */ }
  }
}

renderer.domElement.addEventListener('pointerdown', e => {
  downPos = { x: e.clientX, y: e.clientY };
  if (!state.playMode || tctrl.dragging || e.altKey || e.button !== 0) return;
  // 命中可抓取对象 → 进入抓取(临时接管相机旋转)
  setPointer(e);
  const hit = hitTopObject(true);
  if (hit && getSemanticHandler(hit.obj, 'grab')) {
    grabbing = hit.obj;
    orbitWasEnabled = orbit.enabled;
    orbit.enabled = false;
    // 捕获指针:即使拖出画布,pointerup/pointercancel 仍会在本元素触发
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* 不支持则忽略 */ }
    dispatchInteraction(hit.obj, 'grab', { point: hit.point });
  }
});

// pointermove:抓取拖动;否则运行模式下做 hover 反馈(可交互对象发光 + 手型光标)
let lastHoverCheck = 0;
renderer.domElement.addEventListener('pointermove', e => {
  if (grabbing) {
    setPointer(e);
    const point = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
    if (point) dispatchInteraction(grabbing, 'drag', { point });
    return;
  }
  if (!state.playMode) return;
  const now = performance.now();
  if (now - lastHoverCheck < 60) return;   // 节流:hover 射线每 60ms 一次
  lastHoverCheck = now;
  setPointer(e);
  const hit = hitTopObject(true);
  const target = hit && isInteractable(hit.obj) ? hit.obj : null;
  setHover(target);
  renderer.domElement.style.cursor = target ? 'pointer' : '';
});
on('play-mode-changed', v => { if (!v) { setHover(null); renderer.domElement.style.cursor = ''; } });

renderer.domElement.addEventListener('pointercancel', e => { endGrab(e.pointerId); downPos = null; });
// 兜底:窗口任意位置松开都恢复(防御旧浏览器不支持 pointer capture)
window.addEventListener('pointerup', () => { if (grabbing) endGrab(null); });

renderer.domElement.addEventListener('pointerup', e => {
  if (grabbing) {
    endGrab(e.pointerId);
    downPos = null;
    return;
  }
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 5 || tctrl.dragging) return; // 是拖动视角,不是点选
  setPointer(e);
  const hit = hitTopObject(state.playMode && !e.altKey);
  if (hit) {
    // 运行模式:点击 = 触发交互(Alt+点击强制选中);编辑模式:点击一律选中
    if (state.playMode && !e.altKey && dispatchInteraction(hit.obj, 'activate', { point: hit.point })) return;
    select(hit.obj, e.shiftKey);   // Shift+点击 = 多选(类 Unity;选中即 AI 上下文)
    hintPlayModeOnce(hit.obj);
  } else if (!e.shiftKey) {
    deselect();
  }
});

// 编辑模式下首次点中可交互对象时提示一次(不刷屏)
let playHintShown = false;
function hintPlayModeOnce(obj) {
  if (state.playMode || playHintShown || !isInteractable(obj)) return;
  playHintShown = true;
  toast(t('vp.editHint'));
}

// ── HTML5 拖放:资源 → 视口 ──
const dropHint = document.getElementById('drop-hint');
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

vpEl.addEventListener('dragover', e => { e.preventDefault(); dropHint.classList.remove('hidden'); });
vpEl.addEventListener('dragleave', () => dropHint.classList.add('hidden'));
vpEl.addEventListener('drop', e => {
  e.preventDefault();
  dropHint.classList.add('hidden');
  const id = e.dataTransfer.getData('asset-id');
  if (!id) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, hit);
  record();
  const obj = addAsset(id, hit || undefined);
  if (obj) select(obj);
});

// ── 工具栏 & 快捷键 ──
document.querySelectorAll('.vt-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => setGizmoMode(btn.dataset.mode));
});

function setGizmoMode(mode) {
  tctrl.setMode(mode);
  document.querySelectorAll('.vt-btn[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
}

function focusSelected() {
  if (!state.selected) return;
  orbit.target.copy(state.selected.position);
}
document.getElementById('vt-focus').addEventListener('click', focusSelected);

const gridBtn = document.getElementById('vt-grid');
gridBtn.classList.add('active');
gridBtn.addEventListener('click', () => {
  grid.visible = !grid.visible;
  gridBtn.classList.toggle('active', grid.visible);
});

// ▶ 运行/编辑 模式切换(类 Unity Play):默认编辑模式(静态、点击=选中)
const playBtn = document.getElementById('vt-play');
playBtn.addEventListener('click', () => {
  setPlayMode(!state.playMode);
  toast(state.playMode ? t('vp.playOn') : t('vp.playOff'));
});
on('play-mode-changed', v => {
  playBtn.classList.toggle('active', v);
  playBtn.querySelector('span').textContent = v ? t('vt.playing') : t('vt.play');
});

// 运行模式底部提示条:可走动课显示 WASD 驾驶说明
const playHint = document.getElementById('play-hint');
function syncPlayHint() {
  const show = state.playMode && locomotion.mode !== 'static';
  playHint.classList.toggle('hidden', !show);
  if (show) playHint.textContent = t('vp.driveHint');
}
on('play-mode-changed', syncPlayHint);
on('locomotion-changed', syncPlayHint);

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  // 运行模式下 WASD 归学生化身驾驶(student-rig),不切换 gizmo
  const gizmoKeysActive = !state.playMode;
  switch (e.key.toLowerCase()) {
    case 'w': if (gizmoKeysActive) setGizmoMode('translate'); break;
    case 'e': if (gizmoKeysActive) setGizmoMode('rotate'); break;
    case 'r': if (gizmoKeysActive) setGizmoMode('scale'); break;
    case 'f': focusSelected(); break;
    case 'delete': case 'backspace':
      if (state.selection.length) {
        record();
        for (const o of state.selection.slice()) removeObject(o);
        toast(t('vp.deleted'));
      }
      break;
    case 'escape': deselect(); break;
  }
});

// ── 浮动属性检查器 ──
const insp = {
  panel: document.getElementById('inspector'),
  icon: document.getElementById('insp-icon'),
  name: document.getElementById('insp-name'),
  px: document.getElementById('insp-px'), py: document.getElementById('insp-py'), pz: document.getElementById('insp-pz'),
  scale: document.getElementById('insp-scale'), scaleVal: document.getElementById('insp-scale-val'),
  color: document.getElementById('insp-color'),
  spin: document.getElementById('insp-spin'),
  textSec: document.getElementById('insp-text-sec'), textEdit: document.getElementById('insp-text-edit'),
  purposeSec: document.getElementById('insp-purpose-sec'), purpose: document.getElementById('insp-purpose'),
  animSec: document.getElementById('insp-anim-sec'), animDesc: document.getElementById('insp-anim-desc'),
  interSec: document.getElementById('insp-inter-sec'), inter: document.getElementById('insp-inter'),
  aiInput: document.getElementById('insp-ai-input'), aiSend: document.getElementById('insp-ai-send'),
};

// 对象当前是否在自转(spin 动画 / orbit 自带自转 / 其他动画叠加了 selfSpin)
function isSelfSpinning(ud) {
  const a = ud.anim;
  if (!a) return false;
  if (a.type === 'spin') return true;
  if (a.type === 'orbit') return a.selfSpin !== false;
  return !!a.selfSpin;
}

// ── 描述派生:用途 / 动画 / 交互与联动(静态文本,不可直接编辑;要改就用下方 AI 指令)──

function purposeText(obj) {
  const ud = obj.userData;
  if (ud.behaviorDesc) return ud.behaviorDesc;
  const skill = ud.assetId ? findAssetSkill(ud.assetId) : null;
  if (skill) return skill.description;
  if (ud.panelData || ud.icon === '📋') return t('insp.purposePanel');
  if (ud.expAction) return ACTION_DESC[ud.expAction] || t('insp.purposeExp');
  return ud.custom ? t('insp.purposeCustom') : t('insp.purposeBuiltin');
}

function animText(obj) {
  const ud = obj.userData;
  const parts = [];
  const a = ud.anim || ud.savedAnim;
  if (a) parts.push(animDesc(a) + (ud.anim ? '' : t('insp.disabled')));
  if (ud.customUpdate || ud.savedCustomUpdate) parts.push(t('insp.customFrame') + (ud.customUpdate ? '' : t('insp.disabled')));
  return parts.join(';');
}

// 对象身份词:THREE.name 与显示名都算(控制器模式代码里 getObjectByName 用的是 THREE.name)
const idNames = o => [o.name, o.userData.displayName].filter(Boolean);
const allCode = o => ['builderCode', 'updateCode', 'clickCode', 'grabCode', 'dragCode', 'releaseCode']
  .map(k => o.userData[k] || '').join('\n');
// 代码里 getObjectByName('…') 引用到的名字集合
function codeRefs(o) {
  const s = new Set();
  for (const m of allCode(o).matchAll(/getObjectByName\(\s*['"`]([^'"`]+)['"`]/g)) s.add(m[1]);
  return s;
}

const refChip = o =>
  `<span class="insp-ref" data-oid="${o.userData.oid}" title="${t('insp.refChipTitle')}">${o.userData.icon || '🧊'} ${escapeHtml(o.userData.displayName)}</span>`;

// 交互与联动的富文本:本体交互方式 + 依赖谁(→)+ 被谁引用(←)
function interactionHTML(obj) {
  const ud = obj.userData;
  const lines = [];
  const act = ud.expAction || ud.savedExpAction;
  if (act) lines.push(escapeHtml(ACTION_DESC[act] || t('insp.actDefault')) + (ud.expAction ? '' : t('insp.disabled')));
  if (ud.customClick || ud.onActivate || ud.savedCustomClick) lines.push(t('insp.clickTrigger'));
  if (ud.onGrab || ud.onDrag) lines.push(t('insp.grabbable'));

  const myRefs = codeRefs(obj);
  const outChips = [], inChips = [];
  for (const other of sceneRoot.children) {
    if (other === obj) continue;
    if (idNames(other).some(n => myRefs.has(n))) outChips.push(refChip(other));
    const names = idNames(obj);
    if (names.length && [...codeRefs(other)].some(n => names.includes(n))) inChips.push(refChip(other));
  }
  if (outChips.length) lines.push(`${t('insp.refOut')}${outChips.join(' ')}`);
  if (inChips.length) lines.push(`${t('insp.refIn')}${inChips.join(' ')}`);
  return lines.join('<br>');
}

// ── 面板文字直接编辑区 ──
// 面板分两类,检查器区别对待:
//   静态内容面板(static):title/lines 就是内容 → 标题+内容输入框,打字即重绘 3D 面板
//   实时数据面板(live):内容由 live() 代码每 0.15s 驱动 → 只读预览,改显示逻辑走 AI 指令
// 内容行格式与 AI 工具一致:一行一条,"键|值" 显示为左右对齐的键值对
const fmtLine = l => typeof l === 'string' ? l : `${l.k}|${l.v}`;
function renderPanelTextEditors(sel) {
  const meshes = [];
  sel.traverse(c => { if (c.userData.panelData) meshes.push(c); });
  insp.textSec.classList.toggle('hidden', !meshes.length);
  insp.textEdit.innerHTML = '';
  for (const mesh of meshes) {
    const pd = mesh.userData.panelData;
    const box = document.createElement('div');
    box.className = 'insp-panel-box';
    if (pd.live) {
      box.classList.add('live');
      const badge = document.createElement('div');
      badge.className = 'insp-panel-badge';
      badge.innerHTML = `📊 ${escapeHtml(pd.title || t('panel.untitled'))} · <b>${t('panel.liveBadge')}</b>`;
      const preview = document.createElement('div');
      preview.className = 'insp-panel-preview';
      preview.textContent = pd.live().map(fmtLine).join('\n');
      const note = document.createElement('div');
      note.className = 'insp-panel-note';
      note.textContent = t('panel.liveNote');
      box.append(badge, preview, note);
      insp.textEdit.appendChild(box);
      continue;
    }
    const titleIn = document.createElement('input');
    titleIn.type = 'text';
    titleIn.className = 'insp-panel-title';
    titleIn.placeholder = t('panel.titlePlaceholder');
    titleIn.value = pd.title || '';
    const linesTa = document.createElement('textarea');
    linesTa.className = 'insp-panel-lines';
    linesTa.rows = Math.min(6, Math.max(2, pd.lines.length));
    linesTa.title = t('panel.linesTip');
    linesTa.value = pd.lines.map(fmtLine).join('\n');
    const apply = () => {
      const lines = linesTa.value.split('\n').map(l => {
        const i = l.indexOf('|');
        return i >= 0 ? { k: l.slice(0, i), v: l.slice(i + 1) } : l;
      });
      updatePanelContent(mesh, { title: titleIn.value.trim(), lines });
    };
    titleIn.addEventListener('input', apply);
    linesTa.addEventListener('input', apply);
    box.append(titleIn, linesTa);
    insp.textEdit.appendChild(box);
  }
}

export function refreshInspector(full) {
  const sel = state.selected;
  if (!sel) return;
  insp.panel.classList.remove('hidden');
  insp.px.value = sel.position.x.toFixed(1);
  insp.py.value = sel.position.y.toFixed(1);
  insp.pz.value = sel.position.z.toFixed(1);
  insp.scale.value = sel.scale.x;
  insp.scaleVal.textContent = sel.scale.x.toFixed(1) + '×';
  if (full) {
    insp.icon.textContent = sel.userData.icon || '🧊';
    insp.name.value = sel.userData.displayName;
    insp.spin.checked = isSelfSpinning(sel.userData);
    insp.color.value = '#' + getMainColor(sel).getHexString();
    // 面板文字直接编辑(仅含面板的对象显示,置于描述区之前)
    renderPanelTextEditors(sel);
    // 描述区:无内容的段落整体隐藏,保持面板紧凑
    insp.purpose.textContent = purposeText(sel);
    const at = animText(sel);
    insp.animSec.classList.toggle('hidden', !at);
    insp.animDesc.textContent = at;
    const ih = interactionHTML(sel);
    insp.interSec.classList.toggle('hidden', !ih);
    insp.inter.innerHTML = ih;
    insp.inter.querySelectorAll('.insp-ref').forEach(chip => {
      chip.addEventListener('click', () => {
        const target = findObject(chip.dataset.oid);
        if (target) emit('focus-object', target);
      });
    });
  }
  selBox.setFromObject(sel);
}

on('selection-changed', () => {
  if (state.selection.length > 1) {
    // 多选:不弹属性面板(类 Unity),状态栏显示数量;所有选中对象已进 AI 上下文
    insp.panel.classList.add('hidden');
    document.getElementById('st-selected').textContent = t('st.multiSelected', { n: state.selection.length });
  } else if (state.selected) {
    refreshInspector(true);
    document.getElementById('st-selected').textContent = t('st.selected', { name: state.selected.userData.displayName });
  } else {
    insp.panel.classList.add('hidden');
    document.getElementById('st-selected').textContent = t('st.noSelection');
  }
});
on('transform-changed', () => refreshInspector(false));
tctrl.addEventListener('objectChange', () => refreshInspector(false));
// 拖动手柄前存一份快照(整段拖动算一步,可整体撤销)
tctrl.addEventListener('mouseDown', () => record());

// ── 多选联动变换(类 Unity):gizmo 挂在主选中对象上,增量同步到其余选中对象 ──
// 平移=同步位移;旋转=绕主对象为轴心旋转位置+姿态;缩放=以主对象为中心等比缩放
let groupPrev = null;
tctrl.addEventListener('mouseDown', () => {
  const p = state.selected;
  groupPrev = (state.selection.length > 1 && p)
    ? { pos: p.position.clone(), quat: p.quaternion.clone(), scale: p.scale.clone() }
    : null;
});
tctrl.addEventListener('mouseUp', () => { groupPrev = null; });
tctrl.addEventListener('objectChange', () => {
  if (!groupPrev || state.selection.length < 2 || !state.selected) return;
  const p = state.selected;
  const others = state.selection.filter(o => o !== p);
  const mode = tctrl.mode || (tctrl.getMode && tctrl.getMode());
  if (mode === 'translate') {
    const d = p.position.clone().sub(groupPrev.pos);
    for (const o of others) o.position.add(d);
  } else if (mode === 'rotate') {
    const dq = p.quaternion.clone().multiply(groupPrev.quat.clone().invert());
    for (const o of others) {
      o.position.sub(p.position).applyQuaternion(dq).add(p.position);
      o.quaternion.premultiply(dq);
    }
  } else if (mode === 'scale') {
    const r = groupPrev.scale.x ? p.scale.x / groupPrev.scale.x : 1;
    for (const o of others) {
      o.scale.multiplyScalar(r);
      o.position.sub(p.position).multiplyScalar(r).add(p.position);
    }
  }
  groupPrev = { pos: p.position.clone(), quat: p.quaternion.clone(), scale: p.scale.clone() };
  emit('transform-changed');   // 次级选择框/碰撞盒跟随
});
// 进入检查器任一字段编辑前存一份快照(在字段间 Tab 切换不会重复记录)
insp.panel.addEventListener('focusin', e => { if (!insp.panel.contains(e.relatedTarget)) record(); });

insp.name.addEventListener('change', () => {
  if (state.selected) { state.selected.userData.displayName = insp.name.value; emit('hierarchy-changed'); }
});
[insp.px, insp.py, insp.pz].forEach((el, i) => el.addEventListener('input', () => {
  if (!state.selected) return;
  state.selected.position.setComponent(i, parseFloat(el.value) || 0);
  selBox.setFromObject(state.selected);
}));
insp.scale.addEventListener('input', () => {
  if (!state.selected) return;
  const s = parseFloat(insp.scale.value);
  state.selected.scale.setScalar(s);
  insp.scaleVal.textContent = s.toFixed(1) + '×';
  selBox.setFromObject(state.selected);
});
insp.color.addEventListener('input', () => { if (state.selected) setMainColor(state.selected, insp.color.value); });
// 自转勾选框【非破坏原则】:只增删"自转"这一个行为,绝不替换/删除对象已有的其他动画。
// 无动画 → 建 spin;orbit 自带自转 → 用 selfSpin:false 单独关掉;其他动画 → selfSpin:true 叠加自转
insp.spin.addEventListener('change', () => {
  if (!state.selected) return;
  const ud = state.selected.userData;
  const a = ud.anim;
  if (insp.spin.checked) {
    if (!a) ud.anim = { type: 'spin', speed: 0.6 };
    else if (a.type === 'orbit') delete a.selfSpin;   // 恢复公转自带的自转
    else if (a.type !== 'spin') a.selfSpin = true;    // 在原动画之上叠加自转
  } else if (a) {
    if (a.type === 'spin') delete ud.anim;            // spin 本身就是"自转",整个移除
    else if (a.type === 'orbit') a.selfSpin = false;  // 只关自转,公转保留
    else delete a.selfSpin;
  }
  emit('hierarchy-changed');
});
document.getElementById('insp-delete').addEventListener('click', () => {
  if (state.selected) { record(); removeObject(state.selected); toast(t('vp.deleted')); }
});

// ── 检查器内的 AI 指令:针对当前选中对象直接下修改指令(chat.js 监听并带强上下文执行)──
function sendInspectorAI() {
  const text = insp.aiInput.value.trim();
  if (!text || !state.selected) return;
  insp.aiInput.value = '';
  emit('agent-request', { obj: state.selected, text });
}
insp.aiSend.addEventListener('click', sendInspectorAI);
insp.aiInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInspectorAI(); }
  e.stopPropagation();   // 防止 W/E/R/Del 等视口快捷键在输入时被触发
});
