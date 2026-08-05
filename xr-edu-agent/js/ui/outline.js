// ═══════════════════════════════════════════════════════════════
//  Learning Outline panel: Chapter → Section tree + workspace switch
// ═══════════════════════════════════════════════════════════════
import { on } from '../core/events.js';
import { escapeHtml, toast } from '../core/utils.js';
import { L, t } from '../core/i18n.js';
import {
  ensureOutline, getOutline, getActiveSection, setActiveSection,
  addChapter, addSection, updateChapter, updateSection, updateCourse,
  removeChapter, removeSection, SECTION_TYPES, SECTION_TYPE_META,
} from '../core/outline.js';
import { studyFlag } from '../core/study-test-flags.js';
import { renderActiveWorkspace } from './section-workspaces.js';
import { resize } from '../core/three-setup.js';
import { syncLiveVrSceneWithOutline } from '../core/section-scene.js';
import { kgEntryButtonHtml, bindKgEntryButton } from './kg-viewer.js';

const treeEl = document.getElementById('outline-tree');
const emptyEl = document.getElementById('outline-empty');
const courseMetaEl = document.getElementById('outline-course-meta');
const viewportEl = document.getElementById('viewport');
const vpToolbar = document.getElementById('vp-toolbar');
const statusbar = document.getElementById('statusbar');
const WS = {
  reading: document.getElementById('ws-reading'),
  h5: document.getElementById('ws-h5'),
  quiz: document.getElementById('ws-quiz'),
};

function typeLabel(type) {
  const meta = SECTION_TYPE_META[type] || SECTION_TYPE_META.vr;
  // Study TEMP: show "3D Scene" instead of "3D / VR" while VR player is off
  const labelKey = (type === 'vr' && studyFlag('disableVrPlayerController'))
    ? 'outline.type.vrStudy'
    : meta.labelKey;
  return `${meta.icon} ${t(labelKey)}`;
}

function beginInlineEdit(el) {
  if (!el) return;
  el.contentEditable = 'true';
  el.classList.add('is-editing');
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function endInlineEdit(el) {
  if (!el) return;
  el.contentEditable = 'false';
  el.classList.remove('is-editing');
}

export function syncWorkspace() {
  const hit = getActiveSection();
  const type = hit?.section?.type || 'vr';
  const isVr = type === 'vr';

  document.body.classList.toggle('ws-mode-non-vr', !isVr);
  // Keep the WebGL canvas in the layout (do NOT display:none). Hiding it zeroes
  // clientWidth/Height and causes a black screen when switching back to 3D.
  // Non-VR workspace panels sit above with an opaque background.
  viewportEl?.classList.remove('hidden');
  vpToolbar?.classList.toggle('hidden', !isVr);
  statusbar?.classList.toggle('hidden', !isVr);

  const btnVr = document.getElementById('btn-vr');
  btnVr?.classList.toggle('hidden', !isVr);
  // three.js VRButton may re-show itself — keep forced-hidden when non-VR
  document.querySelectorAll('.VRButton, #VRButton').forEach(el => {
    el.style.display = 'none';
    el.classList.add('xr-force-hidden');
  });

  // Assets / Hierarchy only relevant for VR scene sections
  document.querySelectorAll('.ptab[data-panel="assets"], .ptab[data-panel="hierarchy"]').forEach(el => {
    el.classList.toggle('hidden', !isVr);
  });
  if (!isVr) {
    const activeTab = document.querySelector('.ptab.active');
    if (activeTab && activeTab.dataset.panel !== 'outline') {
      document.querySelector('.ptab[data-panel="outline"]')?.click();
    }
  }

  for (const [k, el] of Object.entries(WS)) {
    if (!el) continue;
    el.classList.toggle('hidden', isVr || k !== type);
  }
  renderActiveWorkspace(hit);

  // Each VR section owns its own scene graph — swap on outline change
  syncLiveVrSceneWithOutline();

  if (isVr) {
    requestAnimationFrame(() => {
      resize();
      requestAnimationFrame(() => resize());
    });
  }
}

function renderCourseMeta() {
  const o = getOutline();
  if (!courseMetaEl) return;
  courseMetaEl.innerHTML = `
    <div class="outline-course-top">
      ${kgEntryButtonHtml()}
    </div>
    <div class="outline-edit-row">
      <div class="outline-course-title" data-field="course-title" title="${escapeHtml(t('outline.editCourseTitle'))}">${escapeHtml(o.course.title || '')}</div>
      <button type="button" class="outline-pen" data-act="edit-course-title" title="${escapeHtml(t('outline.editCourseTitle'))}" aria-label="${escapeHtml(t('outline.editCourseTitle'))}">✎</button>
    </div>
    <div class="outline-edit-row outline-edit-row-goal">
      <div class="outline-course-goal" data-field="course-goal" data-placeholder="${escapeHtml(t('outline.courseGoalPh'))}">${escapeHtml(o.course.goal || '')}</div>
      <button type="button" class="outline-pen" data-act="edit-course-goal" title="${escapeHtml(t('outline.editCourseGoal'))}" aria-label="${escapeHtml(t('outline.editCourseGoal'))}">✎</button>
    </div>`;

  bindKgEntryButton(courseMetaEl);

  const titleEl = courseMetaEl.querySelector('[data-field="course-title"]');
  const goalEl = courseMetaEl.querySelector('[data-field="course-goal"]');
  const bindEdit = (btnAct, el, commit) => {
    courseMetaEl.querySelector(`[data-act="${btnAct}"]`).addEventListener('click', e => {
      e.stopPropagation();
      beginInlineEdit(el);
    });
    el.addEventListener('blur', () => { endInlineEdit(el); commit(); });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); el.blur(); }
    });
  };
  bindEdit('edit-course-title', titleEl, () => {
    const title = titleEl.textContent.trim() || L('未命名课程', 'Untitled course');
    updateCourse({ title });
    const tab = document.getElementById('scene-tab-name');
    if (tab) tab.textContent = title;
  });
  bindEdit('edit-course-goal', goalEl, () => {
    updateCourse({ goal: goalEl.textContent.trim() });
  });
}

export function renderOutline() {
  ensureOutline(document.getElementById('scene-tab-name')?.textContent?.trim() || '');
  const outline = getOutline();
  renderCourseMeta();
  if (!treeEl) return;
  treeEl.innerHTML = '';
  const has = outline.chapters.some(c => c.sections.length);
  emptyEl?.classList.toggle('hidden', has);

  for (const ch of outline.chapters) {
    const chLi = document.createElement('li');
    chLi.className = 'outline-chapter';
    chLi.dataset.chapterId = ch.id;
    chLi.innerHTML = `
      <div class="outline-chapter-row">
        <div class="outline-edit-row outline-edit-row-grow">
          <span class="outline-chapter-title" data-field="ch-title">${escapeHtml(ch.title)}</span>
          <button type="button" class="outline-pen" data-act="edit-ch" title="${escapeHtml(t('outline.editChapter'))}">✎</button>
        </div>
        <span class="outline-row-actions">
          <button type="button" class="mini-btn" data-act="add-sec" title="${escapeHtml(t('outline.addSection'))}">＋</button>
          <button type="button" class="mini-btn danger" data-act="del-ch" title="${escapeHtml(t('outline.delChapter'))}">✕</button>
        </span>
      </div>
      <ul class="outline-sections"></ul>`;
    const titleSpan = chLi.querySelector('[data-field="ch-title"]');
    chLi.querySelector('[data-act="edit-ch"]').addEventListener('click', e => {
      e.stopPropagation();
      beginInlineEdit(titleSpan);
    });
    titleSpan.addEventListener('blur', () => {
      endInlineEdit(titleSpan);
      updateChapter(ch.id, { title: titleSpan.textContent.trim() || ch.title });
    });
    titleSpan.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); titleSpan.blur(); }
    });
    chLi.querySelector('[data-act="add-sec"]').addEventListener('click', e => {
      e.stopPropagation();
      addSection(ch.id, { type: 'vr', title: L('新小节', 'New section') });
      toast(t('outline.sectionAdded'));
    });
    chLi.querySelector('[data-act="del-ch"]').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(t('outline.delChapterConfirm', { name: ch.title }))) return;
      if (!removeChapter(ch.id)) toast(t('outline.keepOne'));
    });

    const secUl = chLi.querySelector('.outline-sections');
    for (const sec of ch.sections) {
      const secLi = document.createElement('li');
      const active = sec.id === outline.activeSectionId;
      secLi.className = 'outline-section'
        + (active ? ' active' : '')
        + (sec.buildStatus ? ` build-${sec.buildStatus}` : '');
      secLi.dataset.sectionId = sec.id;
      const opts = SECTION_TYPES.map(ty =>
        `<option value="${ty}" ${ty === sec.type ? 'selected' : ''}>${escapeHtml(typeLabel(ty))}</option>`
      ).join('');
      const purposeText = sec.purpose || '';
      const statusRing = sec.buildStatus && sec.buildStatus !== 'idle'
        ? `<span class="sec-build-ring ${escapeHtml(sec.buildStatus)}" title="${escapeHtml(sec.buildStatus)}" aria-hidden="true"></span>`
        : '';
      secLi.innerHTML = `
        <div class="outline-section-hit" data-act="select-sec">
          ${statusRing}
          <div class="outline-section-main">
            <span class="outline-section-title" data-field="sec-title">${escapeHtml(sec.title)}</span>
            <button type="button" class="outline-pen" data-act="edit-sec-title" title="${escapeHtml(t('outline.editSection'))}">✎</button>
            <select class="outline-type-select" title="${escapeHtml(t('outline.changeType'))}">${opts}</select>
          </div>
          <div class="outline-purpose-row">
            <div class="outline-section-purpose" data-field="sec-purpose" data-placeholder="${escapeHtml(t('outline.purposePh'))}">${escapeHtml(purposeText)}</div>
            <button type="button" class="outline-pen outline-pen-purpose" data-act="edit-purpose" title="${escapeHtml(t('outline.editPurpose'))}">✎</button>
          </div>
        </div>
        <div class="outline-row-actions">
          <button type="button" class="mini-btn danger" data-act="del-sec" title="${escapeHtml(t('outline.delSection'))}">✕</button>
        </div>`;

      secLi.querySelector('[data-act="select-sec"]').addEventListener('click', e => {
        if (e.target.closest('button, select, .is-editing')) return;
        setActiveSection(sec.id);
      });

      const secTitle = secLi.querySelector('[data-field="sec-title"]');
      secLi.querySelector('[data-act="edit-sec-title"]').addEventListener('click', e => {
        e.stopPropagation();
        beginInlineEdit(secTitle);
      });
      secTitle.addEventListener('blur', () => {
        endInlineEdit(secTitle);
        updateSection(sec.id, { title: secTitle.textContent.trim() || sec.title });
      });
      secTitle.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); secTitle.blur(); }
      });

      const purposeEl = secLi.querySelector('[data-field="sec-purpose"]');
      secLi.querySelector('[data-act="edit-purpose"]').addEventListener('click', e => {
        e.stopPropagation();
        beginInlineEdit(purposeEl);
      });
      purposeEl.addEventListener('blur', () => {
        endInlineEdit(purposeEl);
        updateSection(sec.id, { purpose: purposeEl.textContent.trim() });
      });
      purposeEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); purposeEl.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); purposeEl.blur(); }
      });

      secLi.querySelector('.outline-type-select').addEventListener('change', e => {
        e.stopPropagation();
        updateSection(sec.id, { type: e.target.value });
        setActiveSection(sec.id);
      });
      secLi.querySelector('[data-act="del-sec"]').addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(t('outline.delSectionConfirm', { name: sec.title }))) return;
        if (!removeSection(sec.id)) toast(t('outline.keepOne'));
      });
      secUl.appendChild(secLi);
    }
    treeEl.appendChild(chLi);
  }
  syncWorkspace();
}

document.getElementById('btn-outline-add-chapter')?.addEventListener('click', () => {
  const ch = addChapter();
  setActiveSection(ch.sections[0].id);
  toast(t('outline.chapterAdded'));
});

document.getElementById('btn-outline-add-section')?.addEventListener('click', () => {
  const outline = getOutline();
  const hit = getActiveSection(outline);
  const chId = hit?.chapter?.id || outline.chapters[0]?.id;
  if (!chId) { addChapter(); return; }
  addSection(chId, { type: 'reading', title: L('新小节', 'New section') });
  toast(t('outline.sectionAdded'));
});

on('outline-changed', renderOutline);
on('section-content-changed', () => renderActiveWorkspace());
on('course-pipeline-outline-ready', renderOutline);
on('course-pipeline-section', () => renderOutline());
on('knowledge-graph-changed', () => renderOutline());

ensureOutline(document.getElementById('scene-tab-name')?.textContent?.trim() || '');
renderOutline();
