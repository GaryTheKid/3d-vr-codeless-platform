// ═══════════════════════════════════════════════════════════════
//  面板类工具:3D 教学面板与标注
//  attach_label / add_panel / update_panel / add_quiz_panel
// ═══════════════════════════════════════════════════════════════
import { sceneRoot } from '../../core/three-setup.js';
import { findObject } from '../../scene/manager.js';
import { attachLabel, addFreePanel, updatePanelContent } from '../../panels/panel3d.js';
import { resolvePanelPosition } from '../../panels/panel-layout.js';
import { markTouched, assignOid } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { L, isEN } from '../../core/i18n.js';
import { runBuilderCode } from '../sandbox.js';
import { ok, fail } from './shared.js';
import * as THREE from 'three';

const parseLines = lines => lines.map(l => l.includes('|') ? { k: l.split('|')[0], v: l.split('|')[1] } : l);

export default [
  {
    name: 'attach_label',
    label: inp => L(`给 ${inp.ref} 挂标注面板`, `Attach label to ${inp.ref}`),
    description: 'Attach a billboard label above an object (always faces the student). Prefer ONE label per object; platform auto-staggers extras sideways.',
    input_schema: {
      type: 'object',
      properties: {
        ref: { type: 'string' },
        title: { type: 'string', description: 'Optional title' },
        lines: { type: 'array', items: { type: 'string' }, description: 'Content lines; key|value as "key|value"' },
        accent: { type: 'string', description: 'Border color #rrggbb, default #4a9eff' },
        width: { type: 'number', description: 'Panel width (m), default 3.2' },
      },
      required: ['ref', 'lines'],
    },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(L(`找不到对象 ${inp.ref}`, `Object not found: ${inp.ref}`));
      attachLabel(obj, { title: inp.title || '', lines: parseLines(inp.lines), accent: inp.accent || '#4a9eff', width: inp.width || 3.2, gap: 0.35 });
      markTouched(obj);
      emit('hierarchy-changed');
      return ok(L(`已给 ${obj.userData.displayName} 挂标注`, `Attached label to ${obj.userData.displayName}`));
    },
  },
  {
    name: 'add_panel',
    label: inp => L(`放置面板「${inp.title}」`, `Place panel "${inp.title}"`),
    description: `Place a free-standing 3D teaching panel (task / legend / knowledge).
LAYOUT: Prefer flanks (x≈±6) or behind the model (negative z). Do NOT stack panels at the origin / default front camera cone — the runtime auto-nudges overlapping positions, but still choose sensible slots. Prefer ≤2 free panels; put object-specific text on attach_label instead of duplicating free panels in front of the diorama.`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name in hierarchy' },
        title: { type: 'string' },
        lines: { type: 'array', items: { type: 'string' }, description: 'Lines; key|value as "key|value"' },
        x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
        accent: { type: 'string' }, width: { type: 'number' },
        role: { type: 'string', description: 'task | info | legend — affects auto-slot preference' },
      },
      required: ['title', 'lines', 'x', 'z'],
    },
    exec(inp) {
      const role = ['task', 'quiz', 'legend', 'info'].includes(inp.role) ? inp.role : 'info';
      const g = addFreePanel(
        { name: inp.name, title: inp.title, lines: parseLines(inp.lines), accent: inp.accent || '#4a9eff', width: inp.width || 4.2, role },
        { x: inp.x, y: inp.y ?? 2.8, z: inp.z }
      );
      markTouched(g);
      return ok(L(
        `已放置面板 ${g.userData.displayName}(oid=${g.userData.oid})`,
        `Placed panel ${g.userData.displayName} (oid=${g.userData.oid})`
      ));
    },
  },
  {
    name: 'update_panel',
    label: inp => L(`更新 ${inp.ref} 的面板文字`, `Update panel text of ${inp.ref}`),
    description: 'Update text on an existing panel/label without rebuilding. Prefer this over delete+re-add.',
    input_schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Object oid or display name' },
        title: { type: 'string', description: 'New title; empty string clears; omit = keep' },
        lines: { type: 'array', items: { type: 'string' }, description: 'New lines; omit = keep' },
        panel_index: { type: 'number', description: 'Which panel on the object (0-based)' },
      },
      required: ['ref'],
    },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(L(`找不到对象 ${inp.ref}`, `Object not found: ${inp.ref}`));
      const meshes = [];
      obj.traverse(c => { if (c.userData.panelData) meshes.push(c); });
      if (!meshes.length) return fail(L(`${obj.userData.displayName} 上没有面板`, `No panel on ${obj.userData.displayName}`));
      const mesh = meshes[inp.panel_index || 0];
      if (!mesh) return fail(L(`面板序号超出范围(共 ${meshes.length} 块)`, `Panel index out of range (${meshes.length} panels)`));
      if (mesh.userData.panelData.live) {
        return fail(L('这是实时数据面板(live 函数驱动),请用 set_behavior 修改其显示逻辑',
          'This is a live data panel — update it via set_behavior'));
      }
      const upd = {};
      if (inp.title !== undefined) upd.title = inp.title;
      if (inp.lines) upd.lines = parseLines(inp.lines);
      updatePanelContent(mesh, upd);
      markTouched(obj);
      emit('selection-changed');
      return ok(L(`已更新 ${obj.userData.displayName} 的面板文字`, `Updated panel text on ${obj.userData.displayName}`));
    },
  },
  {
    name: 'add_quiz_panel',
    label: inp => L(`放置选择题面板「${inp.question || ''}」`, `Place quiz panel "${inp.question || ''}"`),
    description: 'Place ONE clickable MCQ card: question on top, option buttons in a vertical list below (large readable text). LAYOUT: flank only (x≈±7, y≈5 high — options stack downward; never low/near ground), never in front of the diorama. Prefer a single quiz per section.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name' },
        question: { type: 'string', description: 'Stem (one short line)' },
        options: { type: 'array', items: { type: 'string' }, description: '2–4 options' },
        correct: { type: 'number', description: 'Correct option index (0-based)' },
        correct_feedback: { type: 'string' },
        wrong_feedback: { type: 'string' },
        x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
        accent: { type: 'string' },
      },
      required: ['question', 'options', 'correct', 'x', 'z'],
    },
    exec(inp) {
      if (!Array.isArray(inp.options) || inp.options.length < 2) {
        return fail(L('options 至少 2 个', 'options needs at least 2 items'));
      }
      if (inp.correct < 0 || inp.correct >= inp.options.length) {
        return fail(L('correct 下标越界', 'correct index out of range'));
      }
      const letters = 'ABCDEFGH';
      const spec = {
        question: inp.question,
        options: inp.options.map((opt, i) => `${letters[i] || (i + 1)}. ${opt}`),
        correct: inp.correct,
        okMsg: inp.correct_feedback || (isEN() ? 'Correct! Well done' : '答对了,真棒!'),
        noMsg: inp.wrong_feedback || (isEN() ? 'Not quite — try again' : '不对哦,再想想'),
        accent: inp.accent || '#4a9eff',
        hint: isEN() ? 'Tap an option below' : '点击下方选项作答',
      };
      // Single vertical card: wide question + stacked option panels (readable in orbit view)
      const code = `const spec = ${JSON.stringify(spec)};
const g = T.group();
const W = 3.8;
const gap = 0.12;
const q = T.makePanel({ title: spec.question, lines: [spec.hint], width: W, accent: spec.accent });
const qH = q.userData.panelH || 1.15;
q.position.set(0, 0, 0);
g.add(q);
let cursor = -qH / 2 - gap;
spec.options.forEach((opt, i) => {
  const btn = T.makePanel({ lines: [opt], width: W, accent: '#9aa3af' });
  const bH = btn.userData.panelH || 0.72;
  cursor -= bH / 2;
  btn.position.set(0, cursor, 0.04);
  cursor -= bH / 2 + gap;
  btn.userData.optIndex = i;
  g.add(btn);
});
g.userData.quiz = { correct: spec.correct, done: false, tries: 0 };
g.userData.onActivate = (obj, detail) => {
  if (obj.userData.quiz.done || !detail || !detail.point) return;
  let best = null, bd = 1e9;
  obj.traverse(c => {
    if (c.userData.optIndex === undefined) return;
    const wp = c.getWorldPosition(new T.THREE.Vector3());
    const d = wp.distanceTo(detail.point);
    if (d < bd) { bd = d; best = c; }
  });
  if (!best || bd > 2.2) return;
  obj.userData.quiz.tries += 1;
  const hit = best;
  hit.scale.setScalar(1.12);
  setTimeout(() => hit.scale.setScalar(1), 220);
  if (hit.userData.optIndex === obj.userData.quiz.correct) {
    obj.userData.quiz.done = true;
    T.notify('✅ ' + spec.okMsg, { at: obj });
  } else {
    T.notify('❌ ' + spec.noMsg, { at: obj });
  }
};
return g;`;
      let g;
      try { g = runBuilderCode(code); }
      catch (e) {
        return fail(L(`选择题面板构建失败:${e.message}`, `Quiz panel build failed: ${e.message}`));
      }
      const pos = resolvePanelPosition(
        { x: inp.x, y: inp.y ?? 5.0, z: inp.z },
        { role: 'quiz' }
      );
      g.position.set(pos.x, pos.y, pos.z);
      assignOid(g);
      g.userData.builderCode = code;
      g.userData.icon = '❓';
      g.userData.displayName = inp.name || inp.question.slice(0, 12);
      g.userData.behaviorDesc = L(
        `选择题:「${inp.question}」,答对后 userData.quiz.done=true(可被其他对象读作解锁条件)`,
        `Quiz: "${inp.question}"; on correct answer userData.quiz.done=true (readable by other objects as an unlock condition)`);
      sceneRoot.add(g);
      // Options stack downward from the group origin — lift so the card clears the ground
      g.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g);
      if (Number.isFinite(box.min.y) && box.min.y < 0.45) {
        g.position.y += 0.45 - box.min.y;
      }
      markTouched(g);
      emit('hierarchy-changed');
      return ok(L(
        `已放置选择题面板 ${g.userData.displayName}(oid=${g.userData.oid},${inp.options.length} 个选项,正确=第 ${inp.correct + 1} 个)`,
        `Placed quiz panel ${g.userData.displayName} (oid=${g.userData.oid}, ${inp.options.length} options, correct=#${inp.correct + 1})`
      ));
    },
  },
];
