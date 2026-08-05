// ═══════════════════════════════════════════════════════════════
//  Learner-facing MCQ / short-answer widgets (learning mode)
//  Wrong answers → learning companion chat tip (via event)
// ═══════════════════════════════════════════════════════════════
import { escapeHtml } from '../core/utils.js';
import { L, t, isEN } from '../core/i18n.js';
import { emit } from '../core/events.js';
import { callClaude, hasLLM, MODELS } from '../agent/llm.js';

function normalizeAnswerKey(ans) {
  return String(ans ?? '').trim().toLowerCase();
}

/** MCQ answer may be "0"/"1" or the option text. */
export function isMcqCorrect(item, chosenIndex) {
  const ans = String(item.answer ?? '').trim();
  if (/^\d+$/.test(ans)) return Number(ans) === chosenIndex;
  const opt = (item.options || [])[chosenIndex];
  return normalizeAnswerKey(opt) === normalizeAnswerKey(ans);
}

function companionTip(html) {
  emit('learner-companion-tip', html);
}

function tipWrongMcq(item, chosenIndex) {
  const chosen = (item.options || [])[chosenIndex] || '';
  const expl = item.explanation
    ? escapeHtml(item.explanation)
    : escapeHtml(L('再想想这道题考查的核心概念。', 'Think again about the key idea this question is testing.'));
  companionTip(L(
    `这道选择题选错了。<br><b>你选了：</b>${escapeHtml(chosen)}<br><br>${expl}<br><br>要不要我用一个小提示帮你排除干扰项？`,
    `That choice isn't right.<br><b>You picked:</b> ${escapeHtml(chosen)}<br><br>${expl}<br><br>Want a hint to rule out distractors?`
  ));
}

function tipWrongShort(item, studentText, feedback) {
  companionTip(L(
    `简答还不太完整。<br><b>你的回答：</b>${escapeHtml(studentText)}<br><br>${escapeHtml(feedback)}<br><br>请根据提示再改一改，然后重新提交。`,
    `Your short answer isn't quite there yet.<br><b>You wrote:</b> ${escapeHtml(studentText)}<br><br>${escapeHtml(feedback)}<br><br>Revise using the hint, then submit again.`
  ));
}

async function evalShortAnswer(item, studentText) {
  const key = String(item.answer || '').trim();
  const text = String(studentText || '').trim();
  if (!text) {
    return { ok: false, feedback: L('请先写下你的答案。', 'Please write an answer first.') };
  }
  // Fast path: exact / near-exact match without LLM
  if (key && (normalizeAnswerKey(text) === normalizeAnswerKey(key)
    || normalizeAnswerKey(text).includes(normalizeAnswerKey(key))
    || normalizeAnswerKey(key).includes(normalizeAnswerKey(text)))) {
    return { ok: true, feedback: item.explanation || L('很好！', 'Nice!') };
  }
  if (!hasLLM()) {
    const ok = key ? normalizeAnswerKey(text).includes(normalizeAnswerKey(key).slice(0, Math.min(8, key.length))) : false;
    return {
      ok,
      feedback: ok
        ? (item.explanation || L('通过。', 'Looks good.'))
        : L(`参考要点：${key || '（无）'}。请再补充关键概念后重试。`,
          `Key idea: ${key || '(none)'}. Add the missing concept and try again.`),
    };
  }
  const modelId = document.getElementById('model-select')?.value || MODELS[0]?.id;
  const lang = isEN() ? 'English' : 'Chinese';
  try {
    const res = await callClaude({
      model: modelId,
      system: `You grade a short student answer for a lesson. Reply JSON only: {"ok":boolean,"feedback":"1-3 sentences in ${lang}"}.
ok=true only if the answer covers the essential idea (paraphrase OK). If incomplete/wrong, give a hint — do NOT reveal the full model answer verbatim.`,
      messages: [{
        role: 'user',
        content: JSON.stringify({
          question: item.question,
          expectedKey: key,
          explanation: item.explanation || '',
          studentAnswer: text,
        }),
      }],
      maxTokens: 400,
      effort: 'low',
    });
    const raw = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const m = raw.match(/\{[\s\S]*\}/);
    const obj = m ? JSON.parse(m[0]) : { ok: false, feedback: raw.slice(0, 240) };
    return {
      ok: !!obj.ok,
      feedback: String(obj.feedback || (obj.ok ? L('很好！', 'Nice!') : L('再想想关键概念。', 'Revisit the key concept.'))),
    };
  } catch (e) {
    return {
      ok: false,
      feedback: L(`评阅暂时失败：${e.message || e}。请稍后再试。`, `Grading failed: ${e.message || e}. Try again.`),
    };
  }
}

/**
 * Mount interactive quiz/follow-up into hostEl.
 * @param {HTMLElement} hostEl
 * @param {{ type, question, options?, answer, explanation }} item
 * @param {{ id?: string }} [opts]
 */
export function mountLearnerQuestion(hostEl, item, opts = {}) {
  if (!hostEl || !item?.question) return;
  const type = item.type === 'short' ? 'short' : 'mcq';
  const wrap = document.createElement('div');
  wrap.className = 'learner-q';
  wrap.dataset.qid = opts.id || '';

  const qHtml = `<div class="learner-q-stem">${escapeHtml(item.question)}</div>`;
  if (type === 'mcq') {
    const optsHtml = (item.options || []).map((o, i) => {
      if (!String(o || '').trim()) return '';
      return `<button type="button" class="learner-opt" data-i="${i}">${escapeHtml(o)}</button>`;
    }).join('');
    wrap.innerHTML = `${qHtml}<div class="learner-opts">${optsHtml}</div><div class="learner-feedback" hidden></div>`;
    const fb = wrap.querySelector('.learner-feedback');
    wrap.querySelectorAll('.learner-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (wrap.classList.contains('is-locked')) return;
        const i = Number(btn.dataset.i);
        const correct = isMcqCorrect(item, i);
        wrap.querySelectorAll('.learner-opt').forEach(b => {
          b.disabled = true;
          const bi = Number(b.dataset.i);
          if (isMcqCorrect(item, bi)) b.classList.add('is-correct');
        });
        btn.classList.add(correct ? 'is-correct' : 'is-wrong');
        wrap.classList.add('is-locked', correct ? 'is-ok' : 'is-bad');
        if (correct) {
          fb.hidden = false;
          fb.className = 'learner-feedback is-ok';
          fb.textContent = item.explanation || t('learn.correct');
        } else {
          fb.hidden = false;
          fb.className = 'learner-feedback is-bad';
          fb.textContent = item.explanation || t('learn.incorrect');
          tipWrongMcq(item, i);
        }
      });
    });
  } else {
    wrap.innerHTML = `${qHtml}
      <textarea class="learner-short-input" rows="3" placeholder="${escapeHtml(t('learn.shortPh'))}"></textarea>
      <div class="learner-short-actions">
        <button type="button" class="mini-btn primary learner-short-submit">${escapeHtml(t('learn.submit'))}</button>
        <span class="learner-feedback" hidden></span>
      </div>`;
    const input = wrap.querySelector('.learner-short-input');
    const submit = wrap.querySelector('.learner-short-submit');
    const fb = wrap.querySelector('.learner-feedback');
    const run = async () => {
      if (submit.disabled) return;
      submit.disabled = true;
      submit.textContent = t('learn.checking');
      fb.hidden = false;
      fb.className = 'learner-feedback';
      fb.textContent = t('learn.checking');
      const result = await evalShortAnswer(item, input.value);
      if (result.ok) {
        wrap.classList.add('is-locked', 'is-ok');
        input.disabled = true;
        fb.className = 'learner-feedback is-ok';
        fb.textContent = result.feedback || t('learn.correct');
        submit.textContent = t('learn.submit');
      } else {
        wrap.classList.add('is-bad');
        fb.className = 'learner-feedback is-bad';
        fb.textContent = result.feedback || t('learn.incorrect');
        tipWrongShort(item, input.value, result.feedback || '');
        submit.disabled = false;
        submit.textContent = t('learn.resubmit');
        input.focus();
      }
    };
    submit.addEventListener('click', run);
  }
  hostEl.appendChild(wrap);
}
