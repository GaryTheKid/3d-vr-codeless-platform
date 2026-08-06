// ═══════════════════════════════════════════════════════════════
//  右栏聊天 UI:消息流 / 工具卡片 / 模式切换(Ask·Plan·Agent)/
//  模型选择 / 上下文芯片(选中即上下文)/ 计划确认卡 / 快捷指令
// ═══════════════════════════════════════════════════════════════
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { escapeHtml, toast } from '../core/utils.js';
import { removeFromSelection, clearScene } from '../scene/manager.js';
import { ensureStudentRig } from '../scene/student-rig.js';
import { L, t } from '../core/i18n.js';
import { MODELS, EFFORTS, BUDGETS, hasLLM } from '../agent/llm.js';
import { agent, runTurn } from '../agent/orchestrator.js';
import { undo as historyUndo } from '../core/history.js';
import {
  convertDocumentFile, getUploadedDoc, clearUploadedDoc, snapshotUploadedDoc,
  formatDocSummaryHtml, formatDocSummaryFullHtml, summarizeDocWithLLM,
} from '../agent/doc-context.js';
import { getKnowledgeGraph, clearKnowledgeGraph } from '../core/knowledge-graph.js';
import { setOutline, createDefaultOutline } from '../core/outline.js';
import { resetVrSceneBinding } from '../core/section-scene.js';
import { resetOrbitCamera } from '../core/three-setup.js';
import { renderOutline } from './outline.js';
import { runCoursePipeline } from '../agent/course-pipeline.js';

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatFoot = document.querySelector('.chat-foot');

// ── 基础渲染 ──
export function addMsg(role, html) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const learn = state.learnMode;
  const roleName = role === 'user'
    ? (learn ? L('你(学生)', 'You (Student)') : L('你(李老师)', 'You (Teacher)'))
    : (learn ? L('学习助教', 'Learning companion') : L('AI 助教', 'AI Assistant'));
  const badge = role === 'user' ? (learn ? '🎓' : '👩‍🏫') : (learn ? '📘' : '✨');
  div.innerHTML = `<div class="msg-role"><span class="role-badge">${badge}</span>${roleName}</div><div class="msg-body">${html}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function addToolCard(text, running = false) {
  const div = document.createElement('div');
  div.className = 'tool-card' + (running ? ' running' : '');
  div.innerHTML = `<span class="tc-check">${running ? '◌' : '✓'}</span><span>${escapeHtml(text)}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function finishToolCard(card, text, ok = true) {
  card.classList.remove('running');
  if (!ok) card.classList.add('error');
  card.innerHTML = `<span class="tc-check">${ok ? '✓' : '✕'}</span><span>${escapeHtml(text)}</span>`;
}

// 打字指示器:可选灰字状态行(类 Cursor 的步骤提示,如「阶段 2/5 · 语义本体」)显示在三个点上方
function addTyping(label = '') {
  const div = document.createElement('div');
  div.className = 'typing-wrap';
  div.innerHTML = '<div class="typing-label"></div><div class="typing"><i></i><i></i><i></i></div>';
  const labelEl = div.querySelector('.typing-label');
  const setLabel = t => {
    labelEl.textContent = t || '';
    labelEl.style.display = t ? '' : 'none';
  };
  setLabel(label);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return { remove: () => div.remove(), setLabel };
}

// 流式消息句柄:append() 增量追加(带光标),done() 定稿
function startStreamMsg() {
  const div = addMsg('ai', '');
  const body = div.querySelector('.msg-body');
  let buf = '';
  let closed = false;
  return {
    append(t) {
      if (closed) return;
      buf += t;
      body.innerHTML = buf + '<span class="stream-cursor">▍</span>';
      chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    done() {
      closed = true;
      body.innerHTML = buf;
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return buf;
    },
    /** Replace the finalized body (e.g. to strip control markers post-stream). */
    setFinalHtml(html) {
      buf = html;
      body.innerHTML = html;
    },
    get text() { return buf; },
    remove() { div.remove(); },
  };
}

// 思考区块句柄:流式展示模型的推理摘要(浅灰/小字/可折叠,与正文视觉分离)
// append() 增量追加;done() 定稿并自动收起(点头部可再展开查看)
function startThinkingBlock() {
  const div = document.createElement('div');
  div.className = 'think-block';
  div.innerHTML = `<div class="think-head"><span class="think-icon">🧠</span><span class="think-label">${L('思考中…', 'Thinking…')}</span><span class="think-caret">▾</span></div><div class="think-body"></div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  const body = div.querySelector('.think-body');
  const label = div.querySelector('.think-label');
  const caret = div.querySelector('.think-caret');
  let buf = '';
  let closed = false;
  div.querySelector('.think-head').addEventListener('click', () => {
    if (!closed) return;   // 流式中保持展开
    const open = div.classList.toggle('open');
    caret.textContent = open ? '▾' : '▸';
  });
  return {
    append(t) {
      if (closed) return;
      buf += t;
      body.textContent = buf;
      body.scrollTop = body.scrollHeight;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    done() {
      if (closed) return buf;
      closed = true;
      if (!buf.trim()) { div.remove(); return buf; }
      label.textContent = L('查看推理过程', 'View reasoning');
      caret.textContent = '▸';
      div.classList.add('done');
      div.classList.remove('open');
      return buf;
    },
    get text() { return buf; },
  };
}

// 本轮用量小结:思考用时 + token + 预估花费(小字、右对齐、不抢正文)
function addTurnStats({ ms, inTok, outTok, cost, calls }) {
  const div = document.createElement('div');
  div.className = 'turn-stats';
  const secs = ms >= 10000 ? Math.round(ms / 1000) : (ms / 1000).toFixed(1);
  const tok = inTok + outTok;
  const tokStr = tok >= 1000 ? (tok / 1000).toFixed(1) + 'k' : String(tok);
  const costStr = cost >= 0.01 ? cost.toFixed(3) : cost.toFixed(4);
  div.textContent = L(`🧠 思考 ${secs}s · ${tokStr} tokens · $${costStr}`, `🧠 Thought ${secs}s · ${tokStr} tokens · $${costStr}`);
  div.title = L(
    `${calls} 次模型调用 · 输入 ${inTok.toLocaleString()} / 输出 ${outTok.toLocaleString()} tokens · 预估花费 $${cost.toFixed(5)}(按模型公开价粗算,仅供参考)`,
    `${calls} model call(s) · in ${inTok.toLocaleString()} / out ${outTok.toLocaleString()} tokens · est. cost $${cost.toFixed(5)} (rough, based on public pricing)`);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

// Keep / 撤销 卡:一轮改动结束后询问保留还是撤销(类 Cursor)。
// 未点选就开始下一轮 → 默认保留(finalizePendingKeep 自动收尾)。
let pendingKeep = null;
function finalizePendingKeep() {
  if (pendingKeep) { pendingKeep.keep(); pendingKeep = null; }
}
function showKeepUndo() {
  finalizePendingKeep();   // 同时只保留一张待决卡
  const div = document.createElement('div');
  div.className = 'keep-card';
  div.innerHTML = `
    <span class="keep-msg">${L('✅ 本轮改动已应用', '✅ Changes applied')}</span>
    <span class="keep-actions">
      <button class="mini-btn" data-act="undo">${L('↩ 撤销本轮', '↩ Undo this turn')}</button>
      <button class="mini-btn primary" data-act="keep">${L('保留', 'Keep')}</button>
    </span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  const seal = txt => { div.querySelector('.keep-actions').innerHTML = `<span class="keep-result">${txt}</span>`; pendingKeep = null; };
  div.querySelector('[data-act="undo"]').addEventListener('click', () => { historyUndo(); seal(L('↩ 已撤销本轮改动', '↩ Turn undone')); });
  div.querySelector('[data-act="keep"]').addEventListener('click', () => seal(L('✅ 已保留', '✅ Kept')));
  pendingKeep = { keep: () => seal(L('✅ 已保留', '✅ Kept')) };
}

// 计划确认卡:返回 Promise<boolean>
function showPlanConfirm(intent, plan, skills) {
  return new Promise(resolve => {
    const div = document.createElement('div');
    div.className = 'plan-card';
    div.innerHTML = `
      <div class="plan-head">${L('📋 执行计划', '📋 Plan')} <span class="plan-intent">${escapeHtml(intent || '')}</span></div>
      <ol class="plan-steps">${plan.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
      ${skills.length ? `<div class="plan-skills">${L('将加载技能:', 'Skills to load: ')}${skills.map(s => `<code>${escapeHtml(s)}</code>`).join(' ')}</div>` : ''}
      <div class="plan-actions">
        <button class="mini-btn primary" data-act="ok">${L('✔ 确认执行', '✔ Run it')}</button>
        <button class="mini-btn" data-act="cancel">${L('取消', 'Cancel')}</button>
      </div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    div.querySelector('[data-act="ok"]').addEventListener('click', () => { seal(true); });
    div.querySelector('[data-act="cancel"]').addEventListener('click', () => { seal(false); });
    function seal(v) {
      div.querySelector('.plan-actions').innerHTML =
        `<span class="plan-result">${v ? L('✔ 已确认,开始执行…', '✔ Confirmed, running…') : L('✕ 已取消', '✕ Cancelled')}</span>`;
      resolve(v);
    }
  });
}

// ── 流水线进度卡:执行器每进入新阶段调用 report_progress 工具 → 这里追加一行 ──
// 一轮一张卡(首个进度事件时创建);上一阶段自动标记完成,当前阶段高亮
let pipeCard = null;
function sealPipeCard() {
  if (!pipeCard) return;
  pipeCard.ul.querySelectorAll('li.current').forEach(li => { li.classList.remove('current'); li.classList.add('done'); });
}
on('agent-turn-start', () => { sealPipeCard(); pipeCard = null; });
on('agent-progress-end', sealPipeCard);
on('agent-progress', p => {
  if (!pipeCard || !pipeCard.div.isConnected) {
    const div = document.createElement('div');
    div.className = 'pipeline-card';
    div.innerHTML = `<div class="pipe-head">🧩 ${L('执行流水线', 'Pipeline')}</div><ul class="pipe-steps"></ul>`;
    chatMessages.appendChild(div);
    pipeCard = { div, ul: div.querySelector('.pipe-steps') };
  }
  sealPipeCard();
  const li = document.createElement('li');
  li.className = 'current';
  const no = p.total ? `${p.stage}/${p.total}` : `${p.stage}`;
  li.innerHTML = `<span class="pipe-no">${escapeHtml(no)}</span><span class="pipe-title">${escapeHtml(p.title)}</span>`
    + (p.note ? `<span class="pipe-note">${escapeHtml(p.note)}</span>` : '');
  pipeCard.ul.appendChild(li);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ── Course pipeline: per-section sub-agent progress card ──
let sectionFillCard = null;
function ensureSectionFillCard(plan = null) {
  if (sectionFillCard?.div?.isConnected) return sectionFillCard;
  const div = document.createElement('div');
  div.className = 'section-fill-card';
  const total = plan?.total ?? '…';
  const para = plan?.parallel ?? '…';
  const vr = plan?.sequentialVr ?? '…';
  div.innerHTML = `
    <div class="sec-fill-head">
      <span>🤖 ${L('小节子 Agent', 'Section sub-agents')}</span>
      <span class="sec-fill-meta">${escapeHtml(L(
        `共 ${total} · 并行 ${para} · 3D 串行 ${vr}`,
        `${total} total · ${para} parallel · ${vr} 3D serial`
      ))}</span>
    </div>
    <ul class="sec-fill-list"></ul>`;
  chatMessages.appendChild(div);
  sectionFillCard = { div, ul: div.querySelector('.sec-fill-list'), rows: new Map() };
  return sectionFillCard;
}
function typeIcon(type) {
  return ({ reading: '📖', h5: '🖥', quiz: '❓', vr: '🧊' })[type] || '◌';
}
on('course-pipeline-start', () => { sectionFillCard = null; });
on('course-pipeline-fill-plan', plan => {
  ensureSectionFillCard(plan);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
on('course-pipeline-section', ev => {
  const card = ensureSectionFillCard();
  const id = ev.sectionId;
  let li = card.rows.get(id);
  if (!li) {
    li = document.createElement('li');
    li.dataset.sectionId = id;
    card.ul.appendChild(li);
    card.rows.set(id, li);
  }
  const st = ev.status || 'running';
  li.className = st;
  const title = ev.title || id;
  const err = ev.error ? `<span class="sf-err">${escapeHtml(ev.error)}</span>` : '';
  const ico = st === 'done' ? '✓' : st === 'error' ? '⚠' : '◌';
  li.innerHTML = `<span class="sf-ico">${ico}</span><span class="sf-type">${escapeHtml(ev.type || '')}</span>`
    + `<span class="sf-title">${typeIcon(ev.type)} ${escapeHtml(title)}</span>${err}`;
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
on('course-pipeline-done', () => {
  if (!sectionFillCard) return;
  sectionFillCard.div.querySelectorAll('li.running').forEach(li => {
    li.classList.remove('running');
    li.classList.add('done');
  });
});

const ui = { addMsg, addToolCard, finishToolCard, addTyping, showPlanConfirm, startStreamMsg, startThinkingBlock, addTurnStats, showKeepUndo };

// 实验/对话系统的主动播报(炸试管复盘等)
on('agent-say', html => addMsg('ai', html));

// 系统级自动任务(切语言后的整场景翻译等):以普通用户消息形式走完整 Agent 流程
on('agent-task', text => {
  if (agent.busy) { toast(L('AI 正忙,请稍后再试', 'The AI is busy — try again shortly')); return; }
  finalizePendingKeep();
  addMsg('user', escapeHtml(text));
  runTurn(text, ui);
});

// 检查器里针对选中对象下的指令:对象本就处于选中态(选中即上下文,携带完整参数+行为代码)
on('agent-request', ({ obj, text }) => {
  if (agent.busy) { toast(L('AI 正在处理上一条请求,请稍候再发', 'The AI is still working on the previous request — try again shortly')); return; }
  finalizePendingKeep();
  addMsg('user', `<span class="obj-tag">${obj.userData.icon || '🧊'} ${escapeHtml(obj.userData.displayName)}</span> ${escapeHtml(text)}`);
  const fullText = L(
    `[老师在属性检查器中选中了「${obj.userData.displayName}」(${obj.userData.oid}),并针对它下达指令;不要动其他无关对象]\n${text}`,
    `[The teacher selected "${obj.userData.displayName}" (${obj.userData.oid}) in the inspector and is giving an instruction about it; do not touch unrelated objects]\n${text}`);
  runTurn(fullText, ui);
});

// ── 模式切换 ──
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.learnMode && btn.dataset.mode !== 'ask') {
      toast(L('学习模式只能使用 Ask 学习助教', 'Learning mode only supports the Ask learning companion'));
      return;
    }
    agent.mode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));
    const tip = L(
      { ask: 'Ask:只答疑解释,不改场景', plan: 'Plan:先出计划,确认后才执行', agent: 'Agent:直接执行(复杂任务仍会先请你确认计划)' },
      { ask: 'Ask: explains only, never edits the scene', plan: 'Plan: shows a plan first, runs after you confirm', agent: 'Agent: acts directly (complex tasks still ask for confirmation)' });
    toast(L(`已切换到 ${btn.textContent.trim()} 模式 — ${tip[agent.mode]}`, `Switched to ${btn.textContent.trim()} mode — ${tip[agent.mode]}`));
  });
});

// ── 模型 + 思考深度 + 输出预算选择 ──
const modelSelect = document.getElementById('model-select');
const effortSelect = document.getElementById('effort-select');
const budgetSelect = document.getElementById('budget-select');
export function renderModelOptions() {
  modelSelect.innerHTML = '';
  effortSelect.innerHTML = '';
  budgetSelect.innerHTML = '';
  if (hasLLM()) {
    MODELS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      opt.title = m.note;
      modelSelect.appendChild(opt);
    });
    modelSelect.value = agent.model;
    EFFORTS.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.label;
      opt.title = e.note;
      effortSelect.appendChild(opt);
    });
    effortSelect.value = agent.effort;
    effortSelect.classList.remove('hidden');
    BUDGETS.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.label;
      opt.title = b.note;
      budgetSelect.appendChild(opt);
    });
    budgetSelect.value = agent.budget;
    budgetSelect.classList.remove('hidden');
    chatFoot.textContent = L('LLM 已连接 · Agent 可读取场景并调用工具修改;📌 层级面板中的对象可加入上下文',
      'LLM connected · the agent reads the scene and edits via tools; 📌 pin hierarchy objects into context');
  } else {
    const opt = document.createElement('option');
    opt.textContent = L('离线演示模式(未配置代理密钥)', 'Offline demo mode (no proxy key)');
    modelSelect.appendChild(opt);
    effortSelect.classList.add('hidden');
    budgetSelect.classList.add('hidden');
    chatFoot.textContent = L('离线演示模式 · 可体验内置场景生成',
      'Offline demo mode · built-in scene generation is available');
  }
}
modelSelect.addEventListener('change', () => {
  const m = MODELS.find(x => x.id === modelSelect.value);
  if (m) { agent.model = m.id; toast(L(`模型已切换:${m.label}`, `Model switched: ${m.label}`)); }
});
effortSelect.addEventListener('change', () => {
  const e = EFFORTS.find(x => x.id === effortSelect.value);
  if (e) { agent.effort = e.id; toast(L(`思考深度:${e.label.replace('思考 ', '')} — ${e.note}`, `Thinking effort: ${e.label} — ${e.note}`)); }
});
budgetSelect.addEventListener('change', () => {
  const b = BUDGETS.find(x => x.id === budgetSelect.value);
  if (b) { agent.budget = b.id; toast(L(`输出预算:${b.label.replace('预算 ', '')} — ${b.note}`, `Output budget: ${b.label} — ${b.note}`)); }
});

// ── 上下文芯片(= 当前选中的对象;选中即上下文,✕ = 取消选中)──
const ctxBar = document.getElementById('context-pins');
function renderContextPins() {
  ctxBar.innerHTML = '';
  if (!state.contextPins.length) { ctxBar.classList.add('hidden'); return; }
  ctxBar.classList.remove('hidden');
  const label = document.createElement('span');
  label.className = 'ctx-label';
  label.textContent = L('选中(上下文):', 'Selected (context):');
  ctxBar.appendChild(label);
  state.contextPins.forEach(obj => {
    const chip = document.createElement('span');
    chip.className = 'ctx-chip';
    chip.innerHTML = `${obj.userData.icon || '🧊'} ${escapeHtml(obj.userData.displayName)} <b>✕</b>`;
    chip.title = L('点击取消选中(同时移出上下文)', 'Click to deselect (removes from context)');
    chip.addEventListener('click', () => removeFromSelection(obj));
    ctxBar.appendChild(chip);
  });
}
on('context-changed', renderContextPins);

// ── 教学文档挂载条(Docling → md+图;注入 buildContextMessage)──
const docBar = document.getElementById('doc-context-bar');
const chatAttach = document.getElementById('chat-attach');
const chatDocFile = document.getElementById('chat-doc-file');

function renderDocBar() {
  const doc = getUploadedDoc();
  if (!doc || !docBar) { docBar?.classList.add('hidden'); return; }
  docBar.classList.remove('hidden');
  const n = doc.images?.length || 0;
  docBar.innerHTML = `
    <span class="doc-bar-label">${escapeHtml(t('chat.docBarLabel'))}</span>
    <span class="doc-bar-name" title="${escapeHtml(doc.filename)}">📄 ${escapeHtml(doc.filename)}</span>
    <span class="doc-bar-meta">${n} ${L('图', 'img')} · ${(doc.charCount || 0).toLocaleString()} ${L('字', 'chars')}</span>
    <span class="doc-bar-actions">
      <button type="button" class="mini-btn primary" data-act="build">${escapeHtml(t('chat.docBuild'))}</button>
      <button type="button" class="mini-btn" data-act="clear">${escapeHtml(t('chat.docClear'))}</button>
    </span>`;
  docBar.querySelector('[data-act="clear"]').addEventListener('click', () => {
    clearUploadedDoc();
    state.activeDocJobId = null;
    // Drop prior agent memory so Ask/Agent can't keep teaching the removed PDF
    agent.history = [];
    agent.currentSkills = [];
    renderDocBar();
    toast(L('已移除教学材料', 'Teaching material removed'));
  });
  docBar.querySelector('[data-act="build"]').addEventListener('click', async () => {
    if (agent.busy || state.coursePipelineBusy) {
      toast(L('AI 正忙,请稍后再试', 'The AI is busy — try again shortly'));
      return;
    }
    if (state.learnMode) {
      toast(t('chat.docBuildLearnBlock'));
      return;
    }
    if (!hasLLM()) {
      toast(L('课程流水线需要在线模型', 'Course pipeline needs an online model'));
      return;
    }
    const live = getUploadedDoc();
    if (!live?.markdown || !live.jobId) {
      toast(L('请先上传教学材料', 'Upload teaching material first'));
      return;
    }
    // Always start a clean authoring session bound ONLY to this jobId
    const docChanged = state.activeDocJobId && state.activeDocJobId !== live.jobId;
    if (hasExistingCourseWork() || docChanged) {
      if (!confirm(t('chat.docBuildWipeConfirm'))) return;
      resetCourseSessionForRebuild({ keepDoc: true });
      toast(t('chat.docBuildWiped'));
    } else {
      // Even on a "fresh" outline, drop any residual chat memory before pipeline
      agent.history = [];
      agent.currentSkills = [];
    }
    finalizePendingKeep();
    state.activeDocJobId = live.jobId;
    const snap = snapshotUploadedDoc(live);
    const name = snap.filename || L('材料', 'material');
    addMsg('user', escapeHtml(L(
      `据此备课「${name}」(job ${snap.jobId}):跑完整流水线(插图标注 → 知识图谱 → 学习大纲 → 分节填充)`,
      `Build from "${name}" (job ${snap.jobId}): full pipeline (figure tags → knowledge graph → outline → section fill)`
    )));
    const typing = addTyping(L('课程流水线运行中…', 'Course pipeline running…'));
    try {
      await runCoursePipeline({ ui, doc: snap });
      renderOutline();
    } catch (err) {
      addMsg('ai', `<span style="color:var(--danger)">${escapeHtml(L('流水线失败', 'Pipeline failed'))}: ${escapeHtml(err.message || String(err))}</span>`);
    } finally {
      typing.remove();
      renderDocBar();
    }
  });
}

/** True when rebuilding would destroy prior chapters / KG / filled sections / chat memory. */
function hasExistingCourseWork() {
  const kg = getKnowledgeGraph();
  if (kg?.nodes?.length) return true;
  if ((agent.history || []).length) return true;
  const outline = state.outline;
  if (!outline?.chapters?.length) return false;
  const sections = outline.chapters.flatMap(c => c.sections || []);
  if (outline.chapters.length > 1 || sections.length > 1) return true;
  if (outline.course?.goal) return true;
  for (const s of sections) {
    if (s.buildStatus === 'done' || s.buildStatus === 'error' || s.buildStatus === 'running') return true;
    if (s.reading?.chunks?.some(c => c.html || c.title)) return true;
    if (s.quiz?.items?.length) return true;
    if (s.h5?.html) return true;
    if (s.vr?.scene) return true;
    if ((s.covers || []).length) return true;
    if ((s.installsAha || []).length) return true;
  }
  return false;
}

/**
 * Wipe outline / KG / 3D / agent history / chat.
 * @param {{ keepDoc?: boolean }} opts  keepDoc=true leaves the current uploaded PDF attached
 */
function resetCourseSessionForRebuild({ keepDoc = true } = {}) {
  sectionFillCard = null;
  agent.history = [];
  agent.currentSkills = [];
  clearKnowledgeGraph();
  if (!keepDoc) {
    clearUploadedDoc();
    state.activeDocJobId = null;
  }
  const docName = getUploadedDoc()?.filename?.replace(/\.[^.]+$/, '') || '';
  setOutline(createDefaultOutline(docName || L('未命名课程', 'Untitled course')));
  resetVrSceneBinding();
  resetOrbitCamera(null);
  clearScene(false);
  ensureStudentRig();
  if (chatMessages) chatMessages.innerHTML = '';
  renderOutline();
  renderDocBar();
}

async function handleDocUpload(file) {
  if (!file) return;
  if (agent.busy || state.coursePipelineBusy) {
    toast(L('AI 正忙,请稍后再试', 'The AI is busy — try again shortly'));
    if (chatDocFile) chatDocFile.value = '';
    return;
  }
  if (state.learnMode) {
    toast(t('chat.docBuildLearnBlock'));
    if (chatDocFile) chatDocFile.value = '';
    return;
  }

  // Replacing a prior PDF / course → wipe session FIRST so old context cannot leak
  const replacing = !!(getUploadedDoc() || hasExistingCourseWork() || state.activeDocJobId);
  if (replacing) {
    if (!confirm(t('chat.docReplaceConfirm'))) {
      if (chatDocFile) chatDocFile.value = '';
      return;
    }
    finalizePendingKeep();
    resetCourseSessionForRebuild({ keepDoc: false });
  }

  chatAttach.disabled = true;
  const typing = addTyping(t('chat.docUploading'));
  try {
    const doc = await convertDocumentFile(file, {
      onProgress: msg => typing.setLabel(msg),
    });
    // Bind session to THIS parse only; history must stay empty
    agent.history = [];
    agent.currentSkills = [];
    state.activeDocJobId = doc.jobId;
    typing.setLabel(L('正在生成材料摘要…', 'Writing a material summary…'));
    renderDocBar();

    const msgEl = addMsg('ai', formatDocSummaryHtml(doc));
    toast(replacing ? t('chat.docSessionReset') : t('chat.docReady'));

    if (hasLLM()) {
      try {
        // Guard: if teacher uploaded again while we summarized, abandon stale summary
        const narrative = await summarizeDocWithLLM(doc, { model: agent.model });
        if (narrative && msgEl?.isConnected && getUploadedDoc()?.jobId === doc.jobId) {
          const body = msgEl.querySelector('.msg-body');
          if (body) body.innerHTML = formatDocSummaryHtml(getUploadedDoc() || doc, { narrative });
        }
      } catch (sumErr) {
        console.warn('[doc-summary]', sumErr);
        if (msgEl?.isConnected) {
          const foot = msgEl.querySelector('.doc-sum-foot');
          if (foot) {
            foot.textContent = L(
              '材料已挂入上下文(智能摘要暂不可用,已显示大纲)。点「据此备课」可开建。',
              'Attached to context (smart summary unavailable; outline shown). Click “Build from this” to start.'
            );
          }
        }
      }
    }
    typing.remove();
  } catch (err) {
    typing.remove();
    const msg = String(err?.message || err);
    const needServer = /Failed to fetch|NetworkError|503|405|404|not installed|Docling|GitHub Pages|server\.py|非 JSON|non-JSON|invalid response|无法连接|Cannot reach/i.test(msg);
    addMsg('ai', `<span style="color:var(--danger)">${escapeHtml(t('chat.docFail'))}: ${escapeHtml(msg)}</span>`
      + (needServer ? `<br><small>${escapeHtml(t('chat.docNeedServer'))}</small>` : ''));
    toast(t('chat.docFail'));
  } finally {
    chatAttach.disabled = false;
    if (chatDocFile) chatDocFile.value = '';
  }
}

chatAttach?.addEventListener('click', () => chatDocFile?.click());
chatDocFile?.addEventListener('change', () => {
  const file = chatDocFile.files?.[0];
  if (file) handleDocUpload(file);
});

// 摘要卡 → 大弹层浏览全文
const docSumOverlay = document.getElementById('doc-summary-overlay');
const docSumBody = document.getElementById('doc-summary-overlay-body');
function openDocSummaryOverlay() {
  const doc = getUploadedDoc();
  if (!doc || !docSumOverlay || !docSumBody) return;
  docSumBody.innerHTML = formatDocSummaryFullHtml(doc);
  docSumOverlay.classList.remove('hidden');
  docSumOverlay.setAttribute('aria-hidden', 'false');
  docSumBody.scrollTop = 0;
}
function closeDocSummaryOverlay() {
  if (!docSumOverlay) return;
  docSumOverlay.classList.add('hidden');
  docSumOverlay.setAttribute('aria-hidden', 'true');
}
chatMessages?.addEventListener('click', e => {
  if (e.target.closest('a.doc-sum-thumb')) return; // 配图仍可单独打开
  const card = e.target.closest('.doc-summary-card');
  if (card) openDocSummaryOverlay();
});
chatMessages?.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest?.('.doc-summary-card');
  if (!card) return;
  e.preventDefault();
  openDocSummaryOverlay();
});
document.getElementById('btn-doc-summary-close')?.addEventListener('click', closeDocSummaryOverlay);
document.getElementById('doc-summary-overlay-backdrop')?.addEventListener('click', closeDocSummaryOverlay);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && docSumOverlay && !docSumOverlay.classList.contains('hidden')) {
    closeDocSummaryOverlay();
  }
});

// ── 发送 ──
function send() {
  const text = chatInput.value;
  if (!text.trim() || agent.busy) return;
  finalizePendingKeep();   // 上一轮未点选 → 默认保留
  addMsg('user', escapeHtml(text));
  chatInput.value = '';
  chatInput.classList.remove('expanded');
  runTurn(text, ui);
}
document.getElementById('chat-send').addEventListener('click', send);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

// 聚焦时输入框变大(类 Cursor);失焦后若已清空则恢复原大小,有草稿则保持展开
chatInput.addEventListener('focus', () => chatInput.classList.add('expanded'));
chatInput.addEventListener('blur', () => { if (!chatInput.value.trim()) chatInput.classList.remove('expanded'); });

// ── 快捷指令 chips ──
const CHIPS = L([
  { label: '🌞 创建太阳系', text: '帮我创建一个太阳系模型,让行星转起来' },
  { label: '⚗️ 制取氧气', text: '做高锰酸钾加热制取氧气的分步实验' },
  { label: '🛠 帮我改实验', text: '帮我改一下:验满前应该先把集气瓶取出来翻转,木条要对着瓶口才对' },
  { label: '🍔 英语点餐', text: '创建一个餐厅英语点餐对话场景,我要对着数字人练口语' },
  { label: '🧪 化学实验室', text: '搭建一个化学实验室,要有分子模型' },
  { label: '🧬 DNA 结构', text: '展示 DNA 双螺旋结构' },
  { label: '⚖️ 单摆实验', text: '演示单摆运动,不同摆长做对比,带实时参数面板' },
  { label: '📐 几何课堂', text: '生成多面体几何课堂,要能看到顶点和棱线' },
  { label: '🛝 斜面实验', text: '做一个斜面滚球对比实验' },
  { label: '🗑 清空场景', text: '清空场景' },
], [
  { label: '🌞 Solar system', text: 'Create a solar system model and make the planets orbit' },
  { label: '⚗️ Oxygen lab', text: 'Build the step-by-step KMnO₄ heating experiment to prepare oxygen' },
  { label: '🛠 Fix my lab', text: 'Fix this: before the verify step the bottle should be taken out and flipped, and the splint should point at the bottle mouth' },
  { label: '🍔 Cafe English', text: 'Create a restaurant English ordering scene — I want to practice speaking with the digital waiter' },
  { label: '🧪 Chemistry lab', text: 'Build a chemistry lab with molecule models' },
  { label: '🧬 DNA structure', text: 'Show the DNA double helix structure' },
  { label: '⚖️ Pendulum lab', text: 'Demonstrate pendulum motion with different lengths side by side and live parameter panels' },
  { label: '📐 Geometry class', text: 'Generate a polyhedron geometry class where vertices and edges are visible' },
  { label: '🛝 Ramp lab', text: 'Make a ramp rolling-ball comparison experiment' },
  { label: '🗑 Clear scene', text: 'Clear the scene' },
]);
const chipsEl = document.getElementById('chat-chips');
CHIPS.forEach(c => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = c.label;
  b.addEventListener('click', () => {
    if (agent.busy) return;
    finalizePendingKeep();
    addMsg('user', escapeHtml(c.text));
    runTurn(c.text, ui);
  });
  chipsEl.appendChild(b);
});
