// ═══════════════════════════════════════════════════════════════
//  Learn mode: student view — Outline + workspace + Ask learning agent
//  Caches authoring chat/history; restores on exit.
// ═══════════════════════════════════════════════════════════════
import { state } from '../core/state.js';
import { emit, on } from '../core/events.js';
import { L, t, applyDomI18n } from '../core/i18n.js';
import { toast } from '../core/utils.js';
import { isCourseBuildComplete } from '../core/outline.js';
import { agent } from '../agent/orchestrator.js';
import { addMsg } from './chat.js';

let stash = null;

function setModeButtons(mode) {
  document.querySelectorAll('#mode-bar .mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
}

export function syncLearnButton() {
  const btn = document.getElementById('btn-start-learn');
  if (!btn) return;
  const learning = state.learnMode;
  const ready = learning || isCourseBuildComplete();
  btn.disabled = !ready;
  btn.setAttribute('aria-disabled', ready ? 'false' : 'true');
  btn.classList.toggle('is-disabled', !ready);
  btn.classList.toggle('is-exit', learning);
  btn.textContent = learning ? t('learn.exit') : t('learn.start');
  btn.title = ready ? '' : t('learn.needCourse');
}

function welcomeLearning() {
  const title = state.outline?.course?.title || L('本课', 'this lesson');
  addMsg('ai', L(
    `你好 👋 我是你的 <b>学习助教</b>。<br><br>
正在学习：<b>${title}</b>。<br>
左侧可切换章节；中间是本课内容。选择题可点选（绿对红错）；简答先写再提交，我会帮你评阅。<br>
答错时我会在这里解释原因并给提示——有不懂的尽管问我。<br><br>
准备好了就从当前小节开始吧！`,
    `Hi 👋 I'm your <b>learning companion</b>.<br><br>
You're studying: <b>${title}</b>.<br>
Use the outline on the left; the center pane is your lesson. MCQs are clickable (green=right, red=wrong). Short answers: write, then submit — I'll grade them.<br>
When you miss one, I'll explain here and offer a hint. Ask anytime you're stuck.<br><br>
Ready when you are!`
  ));
}

export function enterLearnMode() {
  if (state.learnMode) return;
  if (!isCourseBuildComplete()) {
    toast(t('learn.needCourse'));
    syncLearnButton();
    return;
  }
  const chatMessages = document.getElementById('chat-messages');
  stash = {
    history: agent.history.slice(),
    mode: agent.mode,
    chatHtml: chatMessages?.innerHTML || '',
    foot: document.querySelector('.chat-foot')?.innerHTML || '',
  };

  state.learnMode = true;
  agent.mode = 'ask';
  agent.history = [];
  setModeButtons('ask');

  if (chatMessages) chatMessages.innerHTML = '';
  document.body.classList.add('learn-mode');

  const titleEl = document.querySelector('.chat-title');
  if (titleEl) titleEl.innerHTML = t('learn.agentTitle');

  const input = document.getElementById('chat-input');
  if (input) {
    input.dataset.authorPh = input.placeholder;
    input.placeholder = t('learn.inputPh');
  }

  syncLearnButton();
  welcomeLearning();
  emit('learn-mode-changed', true);
  toast(t('learn.entered'));
}

export function exitLearnMode() {
  if (!state.learnMode) return;
  state.learnMode = false;
  document.body.classList.remove('learn-mode');

  if (stash) {
    agent.history = stash.history;
    agent.mode = stash.mode || 'agent';
    setModeButtons(agent.mode);
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = stash.chatHtml;
    const foot = document.querySelector('.chat-foot');
    if (foot && stash.foot) foot.innerHTML = stash.foot;
    stash = null;
  }

  const titleEl = document.querySelector('.chat-title');
  if (titleEl) {
    titleEl.setAttribute('data-i18n', 'chat.title');
    applyDomI18n(titleEl.parentElement || document);
    titleEl.innerHTML = t('chat.title');
  }

  const input = document.getElementById('chat-input');
  if (input && input.dataset.authorPh) {
    input.placeholder = input.dataset.authorPh;
    delete input.dataset.authorPh;
  }

  syncLearnButton();
  emit('learn-mode-changed', false);
  toast(t('learn.exited'));
}

export function toggleLearnMode() {
  if (state.learnMode) exitLearnMode();
  else enterLearnMode();
}

document.getElementById('btn-start-learn')?.addEventListener('click', toggleLearnMode);
on('course-pipeline-done', syncLearnButton);
on('course-pipeline-section', syncLearnButton);
on('course-pipeline-outline-ready', syncLearnButton);
on('outline-changed', syncLearnButton);
on('learner-companion-tip', (html) => {
  if (!state.learnMode || !html) return;
  addMsg('ai', html);
  try {
    const plain = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    agent.history.push({ role: 'assistant', content: plain.slice(0, 800) });
  } catch { /* ignore */ }
});
syncLearnButton();
