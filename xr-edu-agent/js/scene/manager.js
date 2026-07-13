// ═══════════════════════════════════════════════════════════════
//  场景对象管理:增删清空 / 选中高亮 / 颜色工具 / 按 oid 查找
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { scene, sceneRoot, tctrl } from '../core/three-setup.js';
import { state, assignOid } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { findAssetSkill } from '../assets/registry.js';
import { toast } from '../core/utils.js';
import { t } from '../core/i18n.js';

// ── 选中高亮框 ──
// 只统计"可见"网格的包围盒:学生视角等对象有隐藏部件(定点模式藏起胶囊),
// 不能让隐形部分撑大选择框/带偏中心
function boxFromVisible(box, obj) {
  obj.updateWorldMatrix(true, true);
  box.makeEmpty();
  const walk = o => {
    if (!o.visible) return;
    if (o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(_b);
    }
    for (const c of o.children) walk(c);
  };
  walk(obj);
  return box;
}
const _b = new THREE.Box3();
const _selB = new THREE.Box3();
export const selBox = new THREE.Box3Helper(_selB, 0x4a9eff);
selBox.setFromObject = obj => boxFromVisible(_selB, obj);
selBox.visible = false;
scene.add(selBox);

// 多选的次级高亮框(主选中用 selBox,其余用暗色框);导出给学生视角 PiP 渲染时隐藏
export const extraBoxes = [];
function syncExtraBoxes() {
  const others = state.selection.filter(o => o !== state.selected);
  while (extraBoxes.length < others.length) {
    const h = new THREE.Box3Helper(new THREE.Box3(), 0x2a5a8f);
    scene.add(h);
    extraBoxes.push(h);
  }
  extraBoxes.forEach((h, i) => {
    if (i < others.length) { boxFromVisible(h.box, others[i]); h.visible = true; }
    else h.visible = false;
  });
}
on('transform-changed', syncExtraBoxes);

// 由 labs 注册的清理钩子(clearScene 时调用)
const disposeHooks = [];
export function onSceneClear(fn) { disposeHooks.push(fn); }

export function addAsset(id, pos = null, silent = false) {
  const def = findAssetSkill(id);
  if (!def) return null;
  const obj = def.build();
  assignOid(obj);
  obj.userData.assetId = id;
  obj.userData.icon = def.icon;
  obj.userData.displayName = `${def.name} ${state.objCounter}`;
  if (pos) { obj.position.x = pos.x; obj.position.z = pos.z; }
  else { obj.position.x = (Math.random() - 0.5) * 6; obj.position.z = (Math.random() - 0.5) * 6; }
  if (obj.userData.anim?.type === 'float') obj.userData.anim.base = obj.position.y;
  sceneRoot.add(obj);
  emit('hierarchy-changed');
  if (!silent) toast(t('assets.added', { name: obj.userData.displayName }));
  return obj;
}

export function removeObject(obj) {
  // 系统对象(学生视角等)不可删除:它代表隐藏系统层级里的学生相机
  if (obj.userData.system) { toast(t('scene.systemObj')); return; }
  if (state.selection.includes(obj)) removeFromSelection(obj);   // 触发 selection-changed,检查器同步收起/切换
  state.touched.delete(obj.userData.oid);
  sceneRoot.remove(obj);
  emit('hierarchy-changed');
  emit('context-changed');
}

// keepSystem=true(默认):清空时保留系统对象(学生视角),模板/清空不会抹掉出生点
export function clearScene(keepSystem = true) {
  deselect();
  disposeHooks.forEach(fn => fn());
  state.touched.clear();
  for (const o of sceneRoot.children.slice()) {
    if (keepSystem && o.userData.system) continue;
    sceneRoot.remove(o);
  }
  emit('hierarchy-changed');
  emit('context-changed');
}

// 选中即上下文:选中集合直接镜像到 AI 对话上下文(取代旧的 📌 手动置顶)
function syncSelectionContext() {
  state.contextPins = [...state.selection];
  emit('context-changed');
}

// select(obj, additive):additive=true(Shift 点击)= 加入/移出多选集合,类 Unity
export function select(obj, additive = false) {
  if (additive && state.selection.length) {
    if (state.selection.includes(obj)) {
      state.selection = state.selection.filter(o => o !== obj);
      state.selected = state.selection[state.selection.length - 1] || null;
    } else {
      state.selection = [...state.selection, obj];
      state.selected = obj;
    }
  } else {
    state.selection = [obj];
    state.selected = obj;
  }
  if (state.selected) {
    tctrl.attach(state.selected);
    selBox.visible = true;
    selBox.setFromObject(state.selected);
  } else {
    tctrl.detach();
    selBox.visible = false;
  }
  syncExtraBoxes();
  syncSelectionContext();
  emit('selection-changed');
  emit('hierarchy-changed');
}

// 从多选集合移出单个对象(上下文芯片 ✕ / 删除对象时用)
export function removeFromSelection(obj, silent = false) {
  state.selection = state.selection.filter(o => o !== obj);
  if (state.selected === obj) {
    state.selected = state.selection[state.selection.length - 1] || null;
    if (state.selected) { tctrl.attach(state.selected); selBox.setFromObject(state.selected); }
    else { tctrl.detach(); selBox.visible = false; }
  }
  syncExtraBoxes();
  syncSelectionContext();
  if (!silent) { emit('selection-changed'); emit('hierarchy-changed'); }
}

export function deselect() {
  state.selected = null;
  state.selection = [];
  tctrl.detach();
  selBox.visible = false;
  syncExtraBoxes();
  syncSelectionContext();
  emit('selection-changed');
  emit('hierarchy-changed');
}

// 按 oid / 名称 查找场景对象(Agent 工具用)
export function findObject(ref) {
  if (!ref) return null;
  return sceneRoot.children.find(o =>
    o.userData.oid === ref || o.userData.displayName === ref
  ) || sceneRoot.children.find(o => o.userData.displayName?.includes(ref)) || null;
}

// ── 颜色工具 ──
export function getMainColor(obj) {
  let c = new THREE.Color(0x4a9eff);
  obj.traverse(o => { if (o.isMesh && c.equals(new THREE.Color(0x4a9eff))) c = o.material.color.clone(); });
  return c;
}

export function setMainColor(obj, hex) {
  obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(hex); } });
}

export const COLOR_WORDS = {
  '红': 0xe5534b, '蓝': 0x4a9eff, '绿': 0x3fb96f, '黄': 0xf0c840, '紫': 0xa878f0, '橙': 0xf0a848, '白': 0xf2f4f8, '粉': 0xf08cb4,
  'red': 0xe5534b, 'blue': 0x4a9eff, 'green': 0x3fb96f, 'yellow': 0xf0c840, 'purple': 0xa878f0, 'orange': 0xf0a848, 'white': 0xf2f4f8, 'pink': 0xf08cb4,
};
