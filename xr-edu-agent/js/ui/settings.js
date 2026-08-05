// ═══════════════════════════════════════════════════════════════
//  Settings popover (⚙): same pattern as projects folder overlay —
//  fixed near-button panel, independent of #main layout
// ═══════════════════════════════════════════════════════════════
import { lang, setLang, t, applyDomI18n, L } from '../core/i18n.js';
import { serializeScene } from '../core/projects.js';
import { toast } from '../core/utils.js';

const LANG_STASH_KEY = 'xr-lang-stash';
const FONT_KEY = 'xr-ui-font';

const overlay = document.getElementById('settings-overlay');
const gearBtn = document.getElementById('btn-settings');

function dismissProjectsPopover() {
  const el = document.getElementById('projects-overlay');
  if (!el || el.classList.contains('hidden')) return;
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
}

export function getUiFontScale() {
  const v = localStorage.getItem(FONT_KEY);
  return v === 'sm' || v === 'lg' ? v : 'md';
}

export function applyUiFontScale(scale = getUiFontScale()) {
  const s = scale === 'sm' || scale === 'lg' ? scale : 'md';
  document.documentElement.dataset.uiFont = s;
  document.documentElement.setAttribute('data-ui-font', s);
  localStorage.setItem(FONT_KEY, s);
  syncFontSeg();
}

function syncLangSeg() {
  document.querySelectorAll('#settings-lang-seg .settings-seg-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.lang === lang);
  });
}

function syncFontSeg() {
  const cur = getUiFontScale();
  document.querySelectorAll('#settings-font-seg .settings-seg-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.font === cur);
  });
}

export function openSettingsOverlay() {
  if (!overlay) return;
  if (document.body.classList.contains('course-pipeline-busy')) {
    toast(L('课程生成中,暂不可用', 'Unavailable while the course is generating'));
    return;
  }
  dismissProjectsPopover();
  syncLangSeg();
  syncFontSeg();
  applyDomI18n(overlay);
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

export function closeSettingsOverlay() {
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function switchLanguage(next) {
  if (!next || next === lang) {
    closeSettingsOverlay();
    return;
  }
  try {
    const name = document.getElementById('scene-tab-name')?.textContent?.trim() || 'scene';
    localStorage.setItem(LANG_STASH_KEY, JSON.stringify(serializeScene(name)));
  } catch (e) {
    console.warn('[lang] scene stash failed', e);
    localStorage.removeItem(LANG_STASH_KEY);
    if (!confirm(L(
      '场景太大,切换语言后无法自动恢复当前场景(建议先保存到项目)。仍要切换吗?',
      'The scene is too large to restore automatically after switching (save it as a project first). Switch anyway?'
    ))) return;
  }
  setLang(next);
}

gearBtn?.addEventListener('click', e => {
  e.stopPropagation();
  if (overlay && !overlay.classList.contains('hidden')) closeSettingsOverlay();
  else openSettingsOverlay();
});
document.getElementById('btn-settings-close')?.addEventListener('click', closeSettingsOverlay);
document.getElementById('settings-overlay-backdrop')?.addEventListener('click', closeSettingsOverlay);

document.getElementById('settings-lang-seg')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-lang]');
  if (!btn) return;
  switchLanguage(btn.dataset.lang);
});

document.getElementById('settings-font-seg')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-font]');
  if (!btn) return;
  applyUiFontScale(btn.dataset.font);
  toast(t('settings.fontApplied'));
});

applyUiFontScale();
