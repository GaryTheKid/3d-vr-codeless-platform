// ═══════════════════════════════════════════════════════════════
//  Section workspaces: Reading / H5 / Quiz editors (non-VR center pane)
// ═══════════════════════════════════════════════════════════════
import { escapeHtml, toast } from '../core/utils.js';
import { L, t, isEN } from '../core/i18n.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import {
  getActiveSection, updateSection,
  createReadingChunk, createQuizItem, createFollowUp,
} from '../core/outline.js';
import { callClaude, hasLLM, MODELS } from '../agent/llm.js';
import { mountLearnerQuestion } from './learner-quiz.js';

let activeHostKey = '';
let learnModeFlag = false;

function isLearnerView() {
  return !!(state.learnMode || learnModeFlag);
}

function richToolbarHtml() {
  return `<div class="rich-toolbar" data-rich-toolbar>
    <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
    <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
    <select data-cmd="fontSize" title="${escapeHtml(t('ws.fontSize'))}">
      <option value="18" selected>${escapeHtml(t('ws.sizeNormal'))}</option>
      <option value="24">${escapeHtml(t('ws.sizeLarge'))}</option>
      <option value="14">${escapeHtml(t('ws.sizeSmall'))}</option>
    </select>
    <input type="color" data-cmd="foreColor" value="#e8eaed" title="${escapeHtml(t('ws.color'))}" />
    <button type="button" data-cmd="insertUnorderedList" title="List">•</button>
    <button type="button" data-cmd="formula" title="${escapeHtml(t('ws.formula'))}">∑</button>
    <button type="button" data-cmd="image" title="${escapeHtml(t('ws.image'))}">🖼</button>
  </div>`;
}

function applyEditorFontSize(editor, px) {
  const size = `${Math.max(10, Math.min(48, Number(px) || 18))}px`;
  editor.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
    editor.style.fontSize = size;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.fontSize = size;
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.addRange(r);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function bindRichToolbar(toolbar, editor) {
  if (!toolbar || !editor) return;
  toolbar.addEventListener('mousedown', e => e.preventDefault()); // keep selection
  toolbar.addEventListener('click', e => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    editor.focus();
    if (cmd === 'formula') {
      const latex = prompt(t('ws.formulaPrompt'), 'E = mc^2');
      if (!latex) return;
      document.execCommand('insertHTML', false,
        `<span class="ws-formula" contenteditable="false">\\(${escapeHtml(latex)}\\)</span>&nbsp;`);
      return;
    }
    if (cmd === 'image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          editor.focus();
          document.execCommand('insertHTML', false,
            `<img class="ws-inline-img" src="${reader.result}" alt="" />`);
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    if (cmd === 'fontSize') {
      applyEditorFontSize(editor, btn.value);
      return;
    }
    if (cmd === 'foreColor') {
      document.execCommand('foreColor', false, btn.value);
      return;
    }
    document.execCommand(cmd, false, null);
  });
  toolbar.querySelector('[data-cmd="fontSize"]')?.addEventListener('change', e => {
    applyEditorFontSize(editor, e.target.value);
  });
  toolbar.querySelector('[data-cmd="foreColor"]')?.addEventListener('input', e => {
    editor.focus();
    document.execCommand('foreColor', false, e.target.value);
  });
}

function followUpEditorHtml(fu, prefix) {
  const f = fu || createFollowUp({ enabled: false, question: '' });
  const enabled = !!fu;
  return `<div class="ws-followup" data-followup="${prefix}">
    <button type="button" class="ws-followup-btn ${enabled ? 'is-on' : ''}" data-fu="toggle">
      ${enabled ? '✓ ' : '+ '}${escapeHtml(t('ws.followUp'))}
    </button>
    <input type="checkbox" class="hidden" data-fu="enabled" ${enabled ? 'checked' : ''}/>
    <div class="ws-followup-body ${enabled ? '' : 'hidden'}">
      <select data-fu="type">
        <option value="mcq" ${f.type === 'mcq' ? 'selected' : ''}>${escapeHtml(t('ws.qMcq'))}</option>
        <option value="short" ${f.type === 'short' ? 'selected' : ''}>${escapeHtml(t('ws.qShort'))}</option>
      </select>
      <textarea data-fu="question" rows="2" placeholder="${escapeHtml(t('ws.questionPh'))}">${escapeHtml(f.question || '')}</textarea>
      <div class="ws-fu-options ${f.type === 'short' ? 'hidden' : ''}" data-fu="opts-wrap">
        ${(f.options || ['', '', '', '']).slice(0, 4).map((o, i) =>
          `<input data-fu="opt" data-i="${i}" value="${escapeHtml(o)}" placeholder="${escapeHtml(t('ws.optionPh', { n: i + 1 }))}" />`
        ).join('')}
      </div>
      <input data-fu="answer" value="${escapeHtml(f.answer || '')}" placeholder="${escapeHtml(t('ws.answerPh'))}" />
      <textarea data-fu="explanation" rows="2" placeholder="${escapeHtml(t('ws.explainPh'))}">${escapeHtml(f.explanation || '')}</textarea>
    </div>
  </div>`;
}

function readFollowUp(root) {
  const en = root.querySelector('[data-fu="enabled"]')?.checked;
  if (!en) return null;
  const type = root.querySelector('[data-fu="type"]')?.value === 'short' ? 'short' : 'mcq';
  const options = [...root.querySelectorAll('[data-fu="opt"]')].map(i => i.value);
  return createFollowUp({
    enabled: true,
    type,
    question: root.querySelector('[data-fu="question"]')?.value || '',
    options,
    answer: root.querySelector('[data-fu="answer"]')?.value || '',
    explanation: root.querySelector('[data-fu="explanation"]')?.value || '',
  });
}

function wireFollowUp(root, onChange) {
  const body = root.querySelector('.ws-followup-body');
  const checkbox = root.querySelector('[data-fu="enabled"]');
  const btn = root.querySelector('[data-fu="toggle"]');
  const syncUi = () => {
    const enabled = checkbox.checked;
    body.classList.toggle('hidden', !enabled);
    btn.classList.toggle('is-on', enabled);
    btn.textContent = `${enabled ? '✓ ' : '+ '}${t('ws.followUp')}`;
    const type = root.querySelector('[data-fu="type"]').value;
    root.querySelector('[data-fu="opts-wrap"]')?.classList.toggle('hidden', type === 'short');
  };
  btn?.addEventListener('click', () => {
    checkbox.checked = !checkbox.checked;
    syncUi();
    onChange();
  });
  root.addEventListener('change', e => {
    if (e.target === checkbox) return;
    syncUi();
    onChange();
  });
  root.addEventListener('input', () => onChange());
}

function persistReading(sectionId, root) {
  const cards = [...root.querySelectorAll('[data-chunk-id]')];
  const chunks = cards.map(card => createReadingChunk({
    id: card.dataset.chunkId,
    title: card.querySelector('[data-field="chunk-title"]')?.value || '',
    html: card.querySelector('[data-field="chunk-html"]')?.innerHTML || '',
    followUp: readFollowUp(card.querySelector('[data-followup]')),
  }));
  updateSection(sectionId, { reading: { chunks } }, { silent: true });
}

function renderReading(root, hit) {
  if (isLearnerView()) {
    renderReadingLearner(root, hit);
    return;
  }
  const sec = hit.section;
  const chunks = sec.reading?.chunks?.length
    ? sec.reading.chunks
    : [createReadingChunk({ title: L('知识点 1', 'Chunk 1') })];
  if (!sec.reading.chunks?.length) {
    updateSection(sec.id, { reading: { chunks } }, { silent: true });
  }

  root.innerHTML = `
    <div class="ws-head">
      <div class="ws-badge">${escapeHtml(t('outline.type.reading'))}</div>
      <h2>${escapeHtml(sec.title)}</h2>
      <p class="ws-purpose">${escapeHtml(sec.purpose || t('outline.purposePh'))}</p>
    </div>
    <div class="ws-chunks" id="ws-chunk-list"></div>
    <button type="button" class="mini-btn primary" id="ws-add-chunk">${escapeHtml(t('ws.addChunk'))}</button>`;

  const list = root.querySelector('#ws-chunk-list');
  chunks.forEach((chk, idx) => {
    const card = document.createElement('div');
    card.className = 'ws-chunk-card';
    card.dataset.chunkId = chk.id;
    card.innerHTML = `
      <div class="ws-chunk-bar">
        <span class="ws-chunk-idx">#${idx + 1}</span>
        <input class="ws-chunk-title" data-field="chunk-title" value="${escapeHtml(chk.title || '')}" placeholder="${escapeHtml(t('ws.chunkTitlePh'))}" />
        <button type="button" class="mini-btn" data-act="up" title="↑">↑</button>
        <button type="button" class="mini-btn" data-act="down" title="↓">↓</button>
        <button type="button" class="mini-btn danger" data-act="del">✕</button>
      </div>
      ${richToolbarHtml()}
      <div class="ws-editor" data-field="chunk-html" contenteditable="true">${chk.html || ''}</div>
      ${followUpEditorHtml(chk.followUp, chk.id)}`;
    list.appendChild(card);
    bindRichToolbar(card.querySelector('[data-rich-toolbar]'), card.querySelector('[data-field="chunk-html"]'));
    wireFollowUp(card.querySelector('[data-followup]'), () => persistReading(sec.id, root));
    card.querySelector('[data-field="chunk-html"]').addEventListener('input', () => persistReading(sec.id, root));
    card.querySelector('[data-field="chunk-title"]').addEventListener('input', () => persistReading(sec.id, root));
    card.querySelector('[data-act="del"]').addEventListener('click', () => {
      const next = chunks.filter(c => c.id !== chk.id);
      activeHostKey = '';
      updateSection(sec.id, { reading: { chunks: next.length ? next : [createReadingChunk()] } }, { silent: true });
      renderReading(root, getActiveSection());
    });
    card.querySelector('[data-act="up"]').addEventListener('click', () => {
      if (idx <= 0) return;
      const arr = [...chunks];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      activeHostKey = '';
      updateSection(sec.id, { reading: { chunks: arr } }, { silent: true });
      renderReading(root, getActiveSection());
    });
    card.querySelector('[data-act="down"]').addEventListener('click', () => {
      if (idx >= chunks.length - 1) return;
      const arr = [...chunks];
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      activeHostKey = '';
      updateSection(sec.id, { reading: { chunks: arr } }, { silent: true });
      renderReading(root, getActiveSection());
    });
  });

  root.querySelector('#ws-add-chunk').addEventListener('click', () => {
    const arr = [...(getActiveSection()?.section.reading.chunks || chunks), createReadingChunk({ title: L(`知识点 ${chunks.length + 1}`, `Chunk ${chunks.length + 1}`) })];
    activeHostKey = '';
    updateSection(sec.id, { reading: { chunks: arr } }, { silent: true });
    renderReading(root, getActiveSection());
  });
}

async function generateH5Html(prompt, purpose, title) {
  const modelId = document.getElementById('model-select')?.value || MODELS[0]?.id;
  const system = isEN()
    ? `You generate ONE self-contained educational HTML5 interactive (no markdown fences). Inline CSS/JS only. Language must match the website UI (${isEN() ? 'English' : 'Chinese'}).
HARD: meaningful learning interaction — process steps, condition sliders that change a viz, timeline scrub, predict-then-reveal. Ban: PDF image + simple label-reveal color buttons.`
    : '你生成一段可独立运行的教学用 HTML5 交互(不要 markdown 围栏)。只用内联 CSS/JS。输出语言必须跟网站界面语言一致。硬性:必须是过程/条件变化类有意义交互,禁止「PDF 插图+彩钮只弹出说明」。';
  const user = isEN()
    ? `Create an interactive H5 learning widget (process / cause-effect / parameter change).\nSection title: ${title}\nPurpose: ${purpose || '(none)'}\nTeacher prompt:\n${prompt}\nReturn ONLY HTML starting with <div or <html. No static flyer with 3 label buttons.`
    : `请做一个可交互的 H5 学习小部件(过程演示/条件变化/参数反馈)。\n小节标题: ${title}\n目的: ${purpose || '(无)'}\n老师提示词:\n${prompt}\n只返回 HTML,以 <div 或 <html 开头。禁止静态插图+简单点选标签。`;
  const res = await callClaude({
    model: modelId,
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: 4000,
    effort: 'low',
  });
  let text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  text = text.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '');
  return text;
}

function renderReadingLearner(root, hit) {
  const sec = hit.section;
  const chunks = sec.reading?.chunks?.length ? sec.reading.chunks : [];
  root.innerHTML = `
    <div class="ws-head">
      <div class="ws-badge">${escapeHtml(t('outline.type.reading'))}</div>
      <h2>${escapeHtml(sec.title)}</h2>
      <p class="ws-purpose">${escapeHtml(sec.purpose || '')}</p>
    </div>
    <div class="ws-chunks learner-chunks" id="ws-chunk-list"></div>`;
  const list = root.querySelector('#ws-chunk-list');
  if (!chunks.length) {
    list.innerHTML = `<div class="ws-empty">${escapeHtml(L('本节暂无阅读内容', 'No reading content yet'))}</div>`;
    return;
  }
  chunks.forEach((chk, idx) => {
    const card = document.createElement('div');
    card.className = 'ws-chunk-card learner-chunk';
    card.innerHTML = `
      <div class="learner-chunk-title"><span class="ws-chunk-idx">#${idx + 1}</span> ${escapeHtml(chk.title || '')}</div>
      <div class="ws-editor learner-html">${chk.html || ''}</div>
      <div class="learner-fu-host" data-fu-host></div>`;
    list.appendChild(card);
    if (chk.followUp?.enabled !== false && chk.followUp?.question) {
      const host = card.querySelector('[data-fu-host]');
      const label = document.createElement('div');
      label.className = 'learner-fu-label';
      label.textContent = t('learn.followUp');
      host.appendChild(label);
      mountLearnerQuestion(host, chk.followUp, { id: chk.id });
    }
  });
}

/** Wrap H5 HTML so the iframe can report content height (no inner scroll). */
function wrapH5Srcdoc(html) {
  const raw = String(html || '').trim();
  const resizeScript = `<script>(function(){
  function postH(){
    try{
      var h=Math.max(document.body?document.body.scrollHeight:0,document.documentElement?document.documentElement.scrollHeight:0,120);
      parent.postMessage({type:'xr-h5-height',h:h},'*');
    }catch(e){}
  }
  if(window.ResizeObserver&&document.body){new ResizeObserver(postH).observe(document.body);}
  window.addEventListener('load',postH);
  document.addEventListener(' DomContentLoaded',postH);
  setTimeout(postH,40);setTimeout(postH,200);setTimeout(postH,800);
})();<\/script>`.replace(' DomContentLoaded', 'DOMContentLoaded');
  const baseCss = `html,body{margin:0;padding:0;overflow-x:hidden;overflow-y:auto;background:#fff;height:auto!important}
body{box-sizing:border-box;min-height:0;padding:8px}
img,canvas,svg,video{max-width:100%;height:auto}
button,input,select,textarea{font:inherit}`;
  if (/<html[\s>]/i.test(raw)) {
    let out = raw;
    if (!/<meta\s+charset/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1><meta charset="utf-8">`);
    }
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `<style>${baseCss}</style></head>`);
    } else {
      out = out.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8"><style>${baseCss}</style></head>`);
    }
    if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${resizeScript}</body>`);
    return `${out}${resizeScript}`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>${raw}${resizeScript}</body></html>`;
}

/** Size iframe to content height (postMessage + same-origin measure). */
function bindH5AutoHeight(frame) {
  if (!frame || frame.dataset.h5FitBound) return;
  frame.dataset.h5FitBound = '1';
  const apply = (h) => {
    const n = Math.min(Math.max(Number(h) || 0, 120), 6000);
    frame.style.height = `${n}px`;
  };
  const measure = () => {
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(
        doc.body.scrollHeight || 0,
        doc.documentElement?.scrollHeight || 0,
        120,
      );
      apply(h);
    } catch { /* ignore */ }
  };
  const onMsg = (ev) => {
    if (ev.source !== frame.contentWindow) return;
    const d = ev.data;
    if (d && d.type === 'xr-h5-height' && d.h) apply(d.h);
  };
  window.addEventListener('message', onMsg);
  frame.addEventListener('load', () => {
    measure();
    try {
      const doc = frame.contentDocument;
      if (doc?.body && window.ResizeObserver) {
        const ro = new ResizeObserver(() => measure());
        ro.observe(doc.body);
      }
      doc?.querySelectorAll?.('img')?.forEach?.(img => {
        if (!img.complete) img.addEventListener('load', measure);
      });
    } catch { /* ignore */ }
    setTimeout(measure, 100);
    setTimeout(measure, 400);
  });
}

function setH5FrameHtml(frame, html) {
  bindH5AutoHeight(frame);
  frame.srcdoc = wrapH5Srcdoc(absolutizeH5Media(html));
}

/** Resolve a site-relative path under the app base (GitHub project pages ≠ domain root). */
function resolveAppMediaUrl(src) {
  const s = String(src || '').trim();
  if (!s || /^(https?:|data:|blob:|about:|#)/i.test(s)) return s;
  if (/^sample-asset:/i.test(s)) {
    // Lazy import avoided — samples.js already rewrote these on open; keep a local fallback
    try {
      const base = new URL('../../../pre-built-samples/assets/', import.meta.url);
      const rel = s.replace(/^sample-asset:/i, '').split('/').map(encodeURIComponent).join('/');
      return new URL(rel, base).href;
    } catch { /* fall through */ }
  }
  // Strip a leading slash so URL() keeps the repo base path on GitHub Pages
  const rel = s.replace(/^\.\//, '').replace(/^\//, '');
  return new URL(rel, new URL('.', window.location.href)).href;
}

/** Make relative / doc-image URLs work inside srcdoc iframes. */
function absolutizeH5Media(html) {
  return String(html || '')
    .replace(/(<img\b[^>]*?\bsrc=["'])(?!https?:|data:|blob:)([^"']+)/gi, (_, pre, src) => {
      return `${pre}${resolveAppMediaUrl(src)}`;
    })
    .replace(/(url\(\s*['"]?)(?!https?:|data:|blob:)([^'")]+)/gi, (m, pre, src) => {
      if (/^(#|about:)/i.test(src)) return m;
      return `${pre}${resolveAppMediaUrl(src)}`;
    });
}

function renderH5(root, hit) {
  if (isLearnerView()) {
    renderH5Learner(root, hit);
    return;
  }
  const sec = hit.section;
  const h5 = sec.h5 || { prompt: '', html: '', status: 'idle', followUp: null };
  root.innerHTML = `
    <div class="ws-head">
      <div class="ws-badge">${escapeHtml(t('outline.type.h5'))}</div>
      <h2>${escapeHtml(sec.title)}</h2>
      <p class="ws-purpose">${escapeHtml(sec.purpose || t('outline.purposePh'))}</p>
    </div>
    <label class="ws-label">${escapeHtml(t('ws.h5Prompt'))}</label>
    <textarea id="ws-h5-prompt" rows="4" placeholder="${escapeHtml(t('ws.h5PromptPh'))}">${escapeHtml(h5.prompt || '')}</textarea>
    <div class="ws-actions">
      <button type="button" class="mini-btn primary" id="ws-h5-gen">${escapeHtml(t('ws.h5Generate'))}</button>
      <span class="ws-status" id="ws-h5-status">${escapeHtml(h5.status === 'ready' ? t('ws.h5Ready') : '')}</span>
    </div>
    <div class="ws-h5-frame-wrap">
      <iframe id="ws-h5-frame" class="ws-h5-frame" sandbox="allow-scripts allow-same-origin" title="H5"></iframe>
    </div>
    ${followUpEditorHtml(h5.followUp, 'h5')}`;

  const frame = root.querySelector('#ws-h5-frame');
  setH5FrameHtml(
    frame,
    h5.html || `<div style="font-family:sans-serif;color:#888;padding:24px">${escapeHtml(t('ws.h5Empty'))}</div>`,
  );

  const persist = () => {
    updateSection(sec.id, {
      h5: {
        prompt: root.querySelector('#ws-h5-prompt').value,
        html: h5.html,
        status: h5.status,
        followUp: readFollowUp(root.querySelector('[data-followup]')),
      },
    }, { silent: true });
  };
  root.querySelector('#ws-h5-prompt').addEventListener('input', persist);
  wireFollowUp(root.querySelector('[data-followup]'), persist);

  root.querySelector('#ws-h5-gen').addEventListener('click', async () => {
    const prompt = root.querySelector('#ws-h5-prompt').value.trim();
    if (!prompt) { toast(t('ws.h5NeedPrompt')); return; }
    if (!hasLLM()) { toast(t('ws.h5NeedLlm')); return; }
    const statusEl = root.querySelector('#ws-h5-status');
    statusEl.textContent = t('ws.h5Generating');
    try {
      const html = await generateH5Html(prompt, sec.purpose, sec.title);
      h5.html = html;
      h5.status = 'ready';
      h5.prompt = prompt;
      setH5FrameHtml(frame, html);
      statusEl.textContent = t('ws.h5Ready');
      persist();
      toast(t('ws.h5Done'));
    } catch (e) {
      h5.status = 'error';
      statusEl.textContent = String(e.message || e);
      toast(t('ws.h5Fail'));
    }
  });
}

function renderH5Learner(root, hit) {
  const sec = hit.section;
  const h5 = sec.h5 || { prompt: '', html: '', status: 'idle', followUp: null };
  root.innerHTML = `
    <div class="ws-head">
      <div class="ws-badge">${escapeHtml(t('outline.type.h5'))}</div>
      <h2>${escapeHtml(sec.title)}</h2>
      <p class="ws-purpose">${escapeHtml(sec.purpose || '')}</p>
    </div>
    <div class="ws-h5-frame-wrap">
      <iframe id="ws-h5-frame" class="ws-h5-frame" sandbox="allow-scripts allow-same-origin" title="H5"></iframe>
    </div>
    <div class="learner-fu-host" data-fu-host></div>`;
  const frame = root.querySelector('#ws-h5-frame');
  setH5FrameHtml(
    frame,
    h5.html || `<div style="font-family:sans-serif;color:#888;padding:24px">${escapeHtml(t('ws.h5Empty'))}</div>`,
  );
  if (h5.followUp?.enabled !== false && h5.followUp?.question) {
    const host = root.querySelector('[data-fu-host]');
    const label = document.createElement('div');
    label.className = 'learner-fu-label';
    label.textContent = t('learn.followUp');
    host.appendChild(label);
    mountLearnerQuestion(host, h5.followUp, { id: `${sec.id}_h5` });
  }
}

function persistQuiz(sectionId, root) {
  const cards = [...root.querySelectorAll('[data-quiz-id]')];
  const items = cards.map(card => createQuizItem({
    id: card.dataset.quizId,
    type: card.querySelector('[data-q="type"]')?.value === 'short' ? 'short' : 'mcq',
    question: card.querySelector('[data-q="question"]')?.value || '',
    options: [...card.querySelectorAll('[data-q="opt"]')].map(i => i.value),
    answer: card.querySelector('[data-q="answer"]')?.value || '',
    explanation: card.querySelector('[data-q="explanation"]')?.value || '',
  }));
  updateSection(sectionId, { quiz: { items } }, { silent: true });
}

function renderQuiz(root, hit) {
  if (isLearnerView()) {
    renderQuizLearner(root, hit);
    return;
  }
  const sec = hit.section;
  const items = sec.quiz?.items?.length ? sec.quiz.items : [];
  root.innerHTML = `
    <div class="ws-head">
      <div class="ws-badge">${escapeHtml(t('outline.type.quiz'))}</div>
      <h2>${escapeHtml(sec.title)}</h2>
      <p class="ws-purpose">${escapeHtml(sec.purpose || t('ws.quizHint'))}</p>
    </div>
    <div id="ws-quiz-list"></div>
    <div class="ws-actions">
      <button type="button" class="mini-btn primary" id="ws-add-mcq">${escapeHtml(t('ws.addMcq'))}</button>
      <button type="button" class="mini-btn primary" id="ws-add-short">${escapeHtml(t('ws.addShort'))}</button>
    </div>`;

  const list = root.querySelector('#ws-quiz-list');
  if (!items.length) {
    list.innerHTML = `<div class="ws-empty">${escapeHtml(t('ws.quizEmpty'))}</div>`;
  }
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'ws-quiz-card';
    card.dataset.quizId = item.id;
    card.innerHTML = `
      <div class="ws-chunk-bar">
        <span class="ws-chunk-idx">Q${idx + 1}</span>
        <select data-q="type">
          <option value="mcq" ${item.type === 'mcq' ? 'selected' : ''}>${escapeHtml(t('ws.qMcq'))}</option>
          <option value="short" ${item.type === 'short' ? 'selected' : ''}>${escapeHtml(t('ws.qShort'))}</option>
        </select>
        <button type="button" class="mini-btn danger" data-act="del">✕</button>
      </div>
      <textarea data-q="question" rows="2" placeholder="${escapeHtml(t('ws.questionPh'))}">${escapeHtml(item.question || '')}</textarea>
      <div class="ws-fu-options ${item.type === 'short' ? 'hidden' : ''}" data-opts>
        ${(item.options || ['', '', '', '']).slice(0, 4).map((o, i) =>
          `<input data-q="opt" value="${escapeHtml(o)}" placeholder="${escapeHtml(t('ws.optionPh', { n: i + 1 }))}" />`
        ).join('')}
      </div>
      <input data-q="answer" value="${escapeHtml(item.answer || '')}" placeholder="${escapeHtml(t('ws.answerPh'))}" />
      <textarea data-q="explanation" rows="2" placeholder="${escapeHtml(t('ws.explainPh'))}">${escapeHtml(item.explanation || '')}</textarea>`;
    list.appendChild(card);
    const save = () => persistQuiz(sec.id, root);
    card.addEventListener('input', save);
    card.querySelector('[data-q="type"]').addEventListener('change', e => {
      card.querySelector('[data-opts]')?.classList.toggle('hidden', e.target.value === 'short');
      save();
    });
    card.querySelector('[data-act="del"]').addEventListener('click', () => {
      const next = items.filter(x => x.id !== item.id);
      activeHostKey = '';
      updateSection(sec.id, { quiz: { items: next } }, { silent: true });
      renderQuiz(root, getActiveSection());
    });
  });

  root.querySelector('#ws-add-mcq').addEventListener('click', () => {
    const arr = [...(getActiveSection()?.section.quiz.items || items), createQuizItem({ type: 'mcq' })];
    activeHostKey = '';
    updateSection(sec.id, { quiz: { items: arr } }, { silent: true });
    renderQuiz(root, getActiveSection());
  });
  root.querySelector('#ws-add-short').addEventListener('click', () => {
    const arr = [...(getActiveSection()?.section.quiz.items || items), createQuizItem({ type: 'short' })];
    activeHostKey = '';
    updateSection(sec.id, { quiz: { items: arr } }, { silent: true });
    renderQuiz(root, getActiveSection());
  });
}

function renderQuizLearner(root, hit) {
  const sec = hit.section;
  const items = sec.quiz?.items?.length ? sec.quiz.items : [];
  root.innerHTML = `
    <div class="ws-head">
      <div class="ws-badge">${escapeHtml(t('outline.type.quiz'))}</div>
      <h2>${escapeHtml(sec.title)}</h2>
      <p class="ws-purpose">${escapeHtml(sec.purpose || '')}</p>
    </div>
    <div id="ws-quiz-list" class="learner-quiz-list"></div>`;
  const list = root.querySelector('#ws-quiz-list');
  if (!items.length) {
    list.innerHTML = `<div class="ws-empty">${escapeHtml(t('ws.quizEmpty'))}</div>`;
    return;
  }
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'ws-quiz-card learner-quiz-card';
    card.innerHTML = `<div class="ws-chunk-idx">Q${idx + 1}</div><div data-q-host></div>`;
    list.appendChild(card);
    mountLearnerQuestion(card.querySelector('[data-q-host]'), item, { id: item.id });
  });
}

/** Paint the visible non-VR workspace for the active section. */
export function renderActiveWorkspace(hit = getActiveSection()) {
  if (!hit || hit.section.type === 'vr') {
    activeHostKey = '';
    return;
  }
  const type = hit.section.type;
  const rootId = type === 'reading' ? 'ws-reading-root' : type === 'h5' ? 'ws-h5-root' : 'ws-quiz-root';
  const root = document.getElementById(rootId);
  if (!root) return;
  const learner = isLearnerView() ? 'L' : 'A';
  const key = `${hit.section.id}:${type}:${learner}`;
  // Always re-render on outline switch; section-content-changed also calls us —
  // skip rebuild if user is mid-typing in same section (host key same + focus inside)
  if (key === activeHostKey && root.contains(document.activeElement) && !isLearnerView()) return;
  activeHostKey = key;
  if (type === 'reading') renderReading(root, hit);
  else if (type === 'h5') renderH5(root, hit);
  else if (type === 'quiz') renderQuiz(root, hit);
}

on('learn-mode-changed', (on) => {
  learnModeFlag = !!on;
  activeHostKey = '';
  renderActiveWorkspace();
});
