// ═══════════════════════════════════════════════════════════════
//  右栏聊天 UI:消息流 / 工具卡片 / 模式切换(Ask·Plan·Agent)/
//  模型选择 / 上下文芯片(选中即上下文)/ 计划确认卡 / 快捷指令
// ═══════════════════════════════════════════════════════════════
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { escapeHtml, toast } from '../core/utils.js';
import { removeFromSelection } from '../scene/manager.js';
import { L } from '../core/i18n.js';
import { MODELS, EFFORTS, BUDGETS, hasLLM } from '../agent/llm.js';
import { agent, runTurn } from '../agent/orchestrator.js';
import { undo as historyUndo } from '../core/history.js';

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatFoot = document.querySelector('.chat-foot');

// ── 基础渲染 ──
export function addMsg(role, html) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const roleName = role === 'user' ? L('你(李老师)', 'You (Teacher)') : L('AI 助教', 'AI Assistant');
  const badge = role === 'user' ? '👩‍🏫' : '✨';
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

function addTyping() {
  const div = document.createElement('div');
  div.className = 'typing';
  div.innerHTML = '<i></i><i></i><i></i>';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
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
