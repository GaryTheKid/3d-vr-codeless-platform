// ═══════════════════════════════════════════════════════════════
//  面板类工具:3D 教学面板与标注
//  attach_label / add_panel / update_panel / add_quiz_panel
// ═══════════════════════════════════════════════════════════════
import { sceneRoot } from '../../core/three-setup.js';
import { findObject } from '../../scene/manager.js';
import { attachLabel, addFreePanel, updatePanelContent } from '../../panels/panel3d.js';
import { markTouched, assignOid } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { L, isEN } from '../../core/i18n.js';
import { runBuilderCode } from '../sandbox.js';
import { ok, fail } from './shared.js';

// "键|值" 文本行 → 面板键值行对象
const parseLines = lines => lines.map(l => l.includes('|') ? { k: l.split('|')[0], v: l.split('|')[1] } : l);

export default [
  {
    name: 'attach_label',
    label: inp => L(`给 ${inp.ref} 挂标注面板`, `Attach label to ${inp.ref}`),
    description: '给对象头顶挂一块标注面板(始终面向学生)。',
    input_schema: {
      type: 'object',
      properties: {
        ref: { type: 'string' },
        title: { type: 'string', description: '可选标题' },
        lines: { type: 'array', items: { type: 'string' }, description: '内容行(纯文本);键值对写成 "键|值"' },
        accent: { type: 'string', description: '边框色 #rrggbb,默认 #4a9eff' },
        width: { type: 'number', description: '面板宽度(米),默认 1.6' },
      },
      required: ['ref', 'lines'],
    },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(`找不到对象 ${inp.ref}`);
      attachLabel(obj, { title: inp.title || '', lines: parseLines(inp.lines), accent: inp.accent || '#4a9eff', width: inp.width || 1.6, gap: 0.35 });
      markTouched(obj);
      emit('hierarchy-changed');
      return ok(`已给 ${obj.userData.displayName} 挂标注`);
    },
  },
  {
    name: 'add_panel',
    label: inp => L(`放置面板「${inp.title}」`, `Place panel "${inp.title}"`),
    description: '在场景中放置一块独立的 3D 教学面板(公式板/任务板/知识板等,可被老师拖动)。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '层级里的显示名' },
        title: { type: 'string' },
        lines: { type: 'array', items: { type: 'string' }, description: '内容行;键值对写成 "键|值"' },
        x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
        accent: { type: 'string' }, width: { type: 'number' },
      },
      required: ['title', 'lines', 'x', 'z'],
    },
    exec(inp) {
      const g = addFreePanel(
        { name: inp.name, title: inp.title, lines: parseLines(inp.lines), accent: inp.accent || '#4a9eff', width: inp.width || 2.4 },
        { x: inp.x, y: inp.y ?? 2.8, z: inp.z }
      );
      markTouched(g);
      return ok(`已放置面板 ${g.userData.displayName}(oid=${g.userData.oid})`);
    },
  },
  {
    name: 'update_panel',
    label: inp => L(`更新 ${inp.ref} 的面板文字`, `Update panel text of ${inp.ref}`),
    description: '只修改已有面板/标注的文字内容,不重建对象(改面板文字时优先用它,不要删了重加)。ref 为面板对象或挂着标注的对象;同一对象有多块面板时用 panel_index 指定(0 起)。实时数据面板(live)由代码驱动,本工具改不了,需用 set_behavior 改逻辑。',
    input_schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: '对象 oid 或显示名' },
        title: { type: 'string', description: '新标题;留空字符串=去掉标题;不传=不改' },
        lines: { type: 'array', items: { type: 'string' }, description: '新内容行;键值对写成 "键|值";不传=不改' },
        panel_index: { type: 'number', description: '对象上第几块面板(0 起,默认 0)' },
      },
      required: ['ref'],
    },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(`找不到对象 ${inp.ref}`);
      const meshes = [];
      obj.traverse(c => { if (c.userData.panelData) meshes.push(c); });
      if (!meshes.length) return fail(`${obj.userData.displayName} 上没有面板`);
      const mesh = meshes[inp.panel_index || 0];
      if (!mesh) return fail(`面板序号超出范围(共 ${meshes.length} 块)`);
      if (mesh.userData.panelData.live) return fail('这是实时数据面板(live 函数驱动),请用 set_behavior 修改其显示逻辑');
      const upd = {};
      if (inp.title !== undefined) upd.title = inp.title;
      if (inp.lines) upd.lines = parseLines(inp.lines);
      updatePanelContent(mesh, upd);
      markTouched(obj);
      emit('selection-changed');   // 检查器同步刷新面板文字编辑区
      return ok(`已更新 ${obj.userData.displayName} 的面板文字`);
    },
  },
  {
    name: 'add_quiz_panel',
    label: inp => L(`放置选择题面板「${inp.question || ''}」`, `Place quiz panel "${inp.question || ''}"`),
    description: `放置一块"可点击作答"的选择题面板:问题 + 2~4 个选项按钮,学生(PC 点击 / VR 扳机)选择后立即得到对/错反馈。
- 这是深度学习交互的标准件:检查理解(quiz)、剧情分支、密室答题解锁都用它,不要手写选择题代码
- 答对后面板记入 userData.quiz.done = true:其他对象的行为代码可用 getObjectByName 找到它并读这个标志做"答对才解锁"(见 interaction-design 技能的条件解锁模式)
- correct 是正确选项下标(0 起);feedback 不填有默认对/错提示
- 面板始终面向学生;需要多题时每题一块,错开摆放`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '显示名,如「第1题」' },
        question: { type: 'string', description: '题干(一行,尽量短)' },
        options: { type: 'array', items: { type: 'string' }, description: '选项文字(2~4 个,每个 ≤8 字)' },
        correct: { type: 'number', description: '正确选项下标(0 起)' },
        correct_feedback: { type: 'string', description: '答对提示(可选)' },
        wrong_feedback: { type: 'string', description: '答错提示(可选)' },
        x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
        accent: { type: 'string', description: '边框色 #rrggbb' },
      },
      required: ['question', 'options', 'correct', 'x', 'z'],
    },
    exec(inp) {
      if (!Array.isArray(inp.options) || inp.options.length < 2) return fail('options 至少 2 个');
      if (inp.correct < 0 || inp.correct >= inp.options.length) return fail('correct 下标越界');
      const spec = {
        question: inp.question,
        options: inp.options,
        correct: inp.correct,
        okMsg: inp.correct_feedback || (isEN() ? 'Correct! Well done' : '答对了,真棒!'),
        noMsg: inp.wrong_feedback || (isEN() ? 'Not quite — try again' : '不对哦,再想想'),
        accent: inp.accent || '#4a9eff',
      };
      // builderCode 模式:交互闭包在构建代码里,保存/导出后照常复活
      const code = `const spec = ${JSON.stringify(spec)};
const g = T.group();
const q = T.makePanel({ title: spec.question, lines: [''], width: 2.4, accent: spec.accent });
q.position.y = 1.0;
g.add(q);
const w = 1.0, gap = 0.12;
const total = spec.options.length * w + (spec.options.length - 1) * gap;
spec.options.forEach((opt, i) => {
  const btn = T.makePanel({ lines: [opt], width: w, accent: '#8a93a0' });
  btn.position.set(-total / 2 + w / 2 + i * (w + gap), 0.3, 0.03);
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
  if (!best || bd > 1.4) return;
  obj.userData.quiz.tries += 1;
  const hit = best;
  hit.scale.setScalar(1.18);
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
      catch (e) { return fail(`选择题面板构建失败:${e.message}`); }
      g.position.set(inp.x, inp.y ?? 1.2, inp.z);
      assignOid(g);
      g.userData.builderCode = code;
      g.userData.icon = '❓';
      g.userData.displayName = inp.name || inp.question.slice(0, 12);
      g.userData.behaviorDesc = L(
        `选择题:「${inp.question}」,答对后 userData.quiz.done=true(可被其他对象读作解锁条件)`,
        `Quiz: "${inp.question}"; on correct answer userData.quiz.done=true (readable by other objects as an unlock condition)`);
      sceneRoot.add(g);
      markTouched(g);
      emit('hierarchy-changed');
      return ok(`已放置选择题面板 ${g.userData.displayName}(oid=${g.userData.oid},${inp.options.length} 个选项,正确=第 ${inp.correct + 1} 个)`);
    },
  },
];
