// ═══════════════════════════════════════════════════════════════
//  Lock top-bar chrome while the full course pipeline is running
//  (save / download / share / settings / project folder)
// ═══════════════════════════════════════════════════════════════
import { on } from '../core/events.js';
import { toast } from '../core/utils.js';
import { L, t } from '../core/i18n.js';
import { closeProjectsOverlay } from './projects.js';
import { closeSettingsOverlay } from './settings.js';

const CHROME_IDS = [
  'btn-save',
  'btn-download',
  'btn-share',
  'btn-settings',
  'btn-projects-folder',
];

let locked = false;

export function isCourseChromeLocked() {
  return locked;
}

function restoreTitles() {
  for (const id of CHROME_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  }
}

export function setCourseChromeLocked(next) {
  locked = !!next;
  document.body.classList.toggle('course-pipeline-busy', locked);
  for (const id of CHROME_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.disabled = locked;
    el.classList.toggle('is-pipeline-locked', locked);
    el.setAttribute('aria-disabled', locked ? 'true' : 'false');
    if (locked) {
      el.title = L('课程生成中,请稍候', 'Course is generating — please wait');
    }
  }
  if (!locked) restoreTitles();
  if (locked) {
    try { closeProjectsOverlay(); } catch { /* ignore */ }
    try { closeSettingsOverlay(); } catch { /* ignore */ }
  }
}

function guardClick(e) {
  if (!locked) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  toast(L('课程生成中,暂不可用', 'Unavailable while the course is generating'));
}

for (const id of CHROME_IDS) {
  document.getElementById(id)?.addEventListener('click', guardClick, true);
}

on('course-pipeline-start', () => setCourseChromeLocked(true));
on('course-pipeline-done', () => setCourseChromeLocked(false));
on('course-pipeline-error', () => setCourseChromeLocked(false));
