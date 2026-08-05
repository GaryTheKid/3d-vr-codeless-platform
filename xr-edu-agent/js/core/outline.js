// ═══════════════════════════════════════════════════════════════
//  Learning Outline: Chapter → Section (course design tree)
//  Persisted on ProjectData.cfg.outline; mirrored on state for UI/Agent.
// ═══════════════════════════════════════════════════════════════
import { state } from './state.js';
import { emit } from './events.js';
import { L, isEN } from './i18n.js';
import { studyFlag } from './study-test-flags.js';

export const SECTION_TYPES = ['vr', 'reading', 'h5', 'quiz'];

/** Stock titles created under ZH UI — remap when UI language differs so EN default isn't stuck in Chinese. */
const STOCK_TITLE_PAIRS = [
  ['未命名课程', 'Untitled course'],
  ['我的第一节VR课', 'My First VR Lesson'],
  ['第 1 章', 'Chapter 1'],
  ['默认章节', 'Default chapter'],
  ['VR 场景', 'VR Scene'],
  ['在 3D/VR 中搭建与演练', 'Build and practice in 3D/VR'],
  ['新小节', 'New section'],
  ['新章节', 'New chapter'],
];

export function localizeStockTitle(text) {
  if (!text) return text;
  const s = String(text).trim();
  for (const [zh, en] of STOCK_TITLE_PAIRS) {
    if (isEN() && s === zh) return en;
    if (!isEN() && s === en) return zh;
  }
  // "第 N 章" / "Chapter N"
  if (isEN()) {
    const m = /^第\s*(\d+)\s*章$/.exec(s);
    if (m) return `Chapter ${m[1]}`;
  } else {
    const m = /^Chapter\s+(\d+)$/i.exec(s);
    if (m) return `第 ${m[1]} 章`;
  }
  return text;
}

export const SECTION_TYPE_META = {
  // Study TEMP: icon/label for vr sections read as "3D Scene" when VR player is off
  vr:      { icon: studyFlag('disableVrPlayerController') ? '🧊' : '🥽', labelKey: 'outline.type.vr' },
  reading: { icon: '📖', labelKey: 'outline.type.reading' },
  h5:      { icon: '🖥', labelKey: 'outline.type.h5' },
  quiz:    { icon: '❓', labelKey: 'outline.type.quiz' },
};

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function emptySectionPayload(type) {
  switch (type) {
    case 'reading':
      return { chunks: [] };
    case 'h5':
      return { prompt: '', html: '', status: 'idle', followUp: null };
    case 'quiz':
      return { items: [] };
    case 'vr':
    default:
      return {};
  }
}

function normalizeQuizKind(type) {
  const s = String(type || '').trim().toLowerCase();
  if (!s) return 'mcq';
  if (s === 'short' || s === 'short_answer' || s === 'short-answer' || s === 'sa'
    || s === 'fill' || s === 'fill_blank' || s === 'fill-blank' || s.includes('short')) {
    return 'short';
  }
  return 'mcq';
}

export function createFollowUp(partial = {}) {
  return {
    enabled: partial.enabled !== false,
    type: normalizeQuizKind(partial.type),
    question: partial.question || '',
    options: Array.isArray(partial.options) ? partial.options.map(String) : ['', '', '', ''],
    answer: partial.answer != null ? String(partial.answer) : '',
    explanation: partial.explanation || '',
  };
}

export function createReadingChunk(partial = {}) {
  return {
    id: partial.id || uid('chk_'),
    title: partial.title || '',
    html: partial.html || '',
    followUp: partial.followUp ? createFollowUp(partial.followUp) : null,
    imagePrompt: partial.imagePrompt || '',
  };
}

export function createQuizItem(partial = {}) {
  return {
    id: partial.id || uid('q_'),
    type: normalizeQuizKind(partial.type),
    question: partial.question || '',
    options: Array.isArray(partial.options) ? partial.options.map(String) : ['', '', '', ''],
    answer: partial.answer != null ? String(partial.answer) : '',
    explanation: partial.explanation || '',
  };
}

export function createSection(partial = {}) {
  const type = SECTION_TYPES.includes(partial.type) ? partial.type : 'vr';
  const readingIn = partial.reading || {};
  // migrate legacy reading shape
  let chunks = Array.isArray(readingIn.chunks) ? readingIn.chunks.map(createReadingChunk) : [];
  if (!chunks.length && (readingIn.markdownSnippet || readingIn.html)) {
    chunks = [createReadingChunk({ html: readingIn.html || `<p>${String(readingIn.markdownSnippet || '')}</p>` })];
  }
  const h5In = partial.h5 || {};
  const quizIn = partial.quiz || {};
  return {
    id: partial.id || uid('sec_'),
    title: partial.title || L('新小节', 'New section'),
    type,
    summary: partial.summary || '',
    purpose: partial.purpose || '',
    vr: { ...(partial.vr || {}) },
    reading: { chunks },
    h5: {
      prompt: h5In.prompt || '',
      html: h5In.html || '',
      status: h5In.status || 'idle',
      followUp: h5In.followUp ? createFollowUp(h5In.followUp) : null,
    },
    quiz: {
      items: Array.isArray(quizIn.items) ? quizIn.items.map(createQuizItem) : [],
    },
    // KG binding + build fan-out status (course-pipeline)
    covers: Array.isArray(partial.covers) ? partial.covers.map(String) : [],
    role: partial.role || '',
    sourceHint: partial.sourceHint || '',
    figureIds: Array.isArray(partial.figureIds) ? partial.figureIds.map(String) : [],
    installsAha: Array.isArray(partial.installsAha) ? partial.installsAha.map(String) : [],
    buildStatus: partial.buildStatus || 'idle', // idle | pending | running | done | error
  };
}

export function createChapter(partial = {}) {
  const sections = (partial.sections || []).map(s => createSection(s));
  if (!sections.length) sections.push(createSection({ type: 'vr', title: L('VR 场景', 'VR Scene') }));
  return {
    id: partial.id || uid('ch_'),
    title: partial.title || L('第 1 章', 'Chapter 1'),
    summary: partial.summary || '',
    sections,
  };
}

/** Default outline for new / legacy projects. */
export function createDefaultOutline(courseTitle = '') {
  const ch = createChapter({
    title: L('第 1 章', 'Chapter 1'),
    summary: L('默认章节', 'Default chapter'),
    sections: [createSection({ type: 'vr', title: L('VR 场景', 'VR Scene'), purpose: L('在 3D/VR 中搭建与演练', 'Build and practice in 3D/VR') })],
  });
  const title = localizeStockTitle(courseTitle) || L('未命名课程', 'Untitled course');
  return {
    version: 1,
    course: {
      title,
      goal: '',
      paceNote: '',
    },
    progress: { completedSectionIds: [] },
    chapters: [ch],
    activeSectionId: ch.sections[0].id,
  };
}

/** Normalize / migrate arbitrary stored outline → valid shape. */
export function normalizeOutline(raw, courseTitle = '') {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.chapters) || !raw.chapters.length) {
    return createDefaultOutline(courseTitle);
  }
  const chapters = raw.chapters.map(ch => {
    const c = createChapter(ch);
    c.title = localizeStockTitle(c.title);
    c.summary = localizeStockTitle(c.summary);
    for (const s of c.sections) {
      s.title = localizeStockTitle(s.title);
      s.purpose = localizeStockTitle(s.purpose);
    }
    return c;
  });
  let activeSectionId = raw.activeSectionId || null;
  const allIds = new Set(chapters.flatMap(c => c.sections.map(s => s.id)));
  if (!activeSectionId || !allIds.has(activeSectionId)) {
    activeSectionId = chapters[0].sections[0]?.id || null;
  }
  return {
    version: 1,
    course: {
      title: localizeStockTitle(raw.course?.title || courseTitle) || L('未命名课程', 'Untitled course'),
      goal: raw.course?.goal || '',
      paceNote: raw.course?.paceNote || '',
    },
    progress: {
      completedSectionIds: Array.isArray(raw.progress?.completedSectionIds)
        ? raw.progress.completedSectionIds.filter(id => allIds.has(id))
        : [],
    },
    chapters,
    activeSectionId,
  };
}

export function getOutline() {
  if (!state.outline) state.outline = createDefaultOutline();
  return state.outline;
}

export function setOutline(outline, { silent = false } = {}) {
  state.outline = normalizeOutline(outline, outline?.course?.title);
  if (!silent) emit('outline-changed', state.outline);
  return state.outline;
}

export function ensureOutline(courseTitle = '') {
  if (!state.outline) {
    const name = localizeStockTitle(courseTitle) || L('未命名课程', 'Untitled course');
    setOutline(createDefaultOutline(name));
  } else {
    // Soft-localize stock titles when UI language flipped / wrong language leaked in
    const o = state.outline;
    o.course.title = localizeStockTitle(o.course.title);
    for (const ch of o.chapters) {
      ch.title = localizeStockTitle(ch.title);
      for (const s of ch.sections) {
        s.title = localizeStockTitle(s.title);
        s.purpose = localizeStockTitle(s.purpose);
      }
    }
  }
  return state.outline;
}

export function findSection(sectionId, outline = getOutline()) {
  for (const ch of outline.chapters) {
    const sec = ch.sections.find(s => s.id === sectionId);
    if (sec) return { chapter: ch, section: sec };
  }
  return null;
}

export function getActiveSection(outline = getOutline()) {
  return findSection(outline.activeSectionId, outline);
}

/** True when every section finished the course pipeline (buildStatus === done). */
export function isCourseBuildComplete(outline = getOutline()) {
  const secs = outline.chapters.flatMap(c => c.sections);
  if (!secs.length) return false;
  return secs.every(s => s.buildStatus === 'done');
}

export function setActiveSection(sectionId) {
  const outline = getOutline();
  const hit = findSection(sectionId, outline);
  if (!hit) return false;
  outline.activeSectionId = sectionId;
  emit('outline-changed', outline);
  return true;
}

export function addChapter(partial = {}) {
  const outline = getOutline();
  const ch = createChapter({
    title: partial.title || L(`第 ${outline.chapters.length + 1} 章`, `Chapter ${outline.chapters.length + 1}`),
    ...partial,
  });
  outline.chapters.push(ch);
  emit('outline-changed', outline);
  return ch;
}

export function addSection(chapterId, partial = {}) {
  const outline = getOutline();
  const ch = outline.chapters.find(c => c.id === chapterId);
  if (!ch) return null;
  const sec = createSection(partial);
  ch.sections.push(sec);
  outline.activeSectionId = sec.id;
  emit('outline-changed', outline);
  return sec;
}

export function updateChapter(chapterId, patch, { silent = false } = {}) {
  const outline = getOutline();
  const ch = outline.chapters.find(c => c.id === chapterId);
  if (!ch) return null;
  if (patch.title != null) ch.title = String(patch.title);
  if (patch.summary != null) ch.summary = String(patch.summary);
  if (!silent) emit('outline-changed', outline);
  return ch;
}

export function updateCourse(patch, { silent = false } = {}) {
  const outline = getOutline();
  if (patch.title != null) outline.course.title = String(patch.title);
  if (patch.goal != null) outline.course.goal = String(patch.goal);
  if (patch.paceNote != null) outline.course.paceNote = String(patch.paceNote);
  if (!silent) emit('outline-changed', outline);
  return outline.course;
}

export function updateSection(sectionId, patch, { silent = false } = {}) {
  const hit = findSection(sectionId);
  if (!hit) return null;
  const sec = hit.section;
  if (patch.title != null) sec.title = String(patch.title);
  if (patch.summary != null) sec.summary = String(patch.summary);
  if (patch.purpose != null) sec.purpose = String(patch.purpose);
  if (patch.type != null && SECTION_TYPES.includes(patch.type)) {
    sec.type = patch.type;
  }
  if (patch.reading) {
    if (Array.isArray(patch.reading.chunks)) {
      sec.reading.chunks = patch.reading.chunks.map(createReadingChunk);
    } else {
      Object.assign(sec.reading, patch.reading);
    }
  }
  if (patch.h5) {
    Object.assign(sec.h5, patch.h5);
    if (patch.h5.followUp === null) sec.h5.followUp = null;
    else if (patch.h5.followUp) sec.h5.followUp = createFollowUp(patch.h5.followUp);
  }
  if (patch.quiz) {
    if (Array.isArray(patch.quiz.items)) {
      sec.quiz.items = patch.quiz.items.map(createQuizItem);
    } else {
      Object.assign(sec.quiz, patch.quiz);
    }
  }
  if (patch.vr) {
    if (!sec.vr) sec.vr = {};
    Object.assign(sec.vr, patch.vr);
  }
  if (patch.covers) sec.covers = Array.isArray(patch.covers) ? patch.covers.map(String) : [];
  if (patch.role != null) sec.role = String(patch.role);
  if (patch.sourceHint != null) sec.sourceHint = String(patch.sourceHint);
  if (patch.figureIds != null) sec.figureIds = Array.isArray(patch.figureIds) ? patch.figureIds.map(String) : [];
  if (patch.buildStatus != null) sec.buildStatus = String(patch.buildStatus);
  if (!silent) emit('outline-changed', getOutline());
  else emit('section-content-changed', { sectionId, section: sec, chapter: hit.chapter });
  return sec;
}

export function removeChapter(chapterId) {
  const outline = getOutline();
  if (outline.chapters.length <= 1) return false;
  const idx = outline.chapters.findIndex(c => c.id === chapterId);
  if (idx < 0) return false;
  const removed = outline.chapters.splice(idx, 1)[0];
  if (removed.sections.some(s => s.id === outline.activeSectionId)) {
    outline.activeSectionId = outline.chapters[0].sections[0]?.id || null;
  }
  emit('outline-changed', outline);
  return true;
}

export function removeSection(sectionId) {
  const outline = getOutline();
  for (const ch of outline.chapters) {
    const idx = ch.sections.findIndex(s => s.id === sectionId);
    if (idx < 0) continue;
    if (ch.sections.length <= 1 && outline.chapters.length <= 1) return false;
    ch.sections.splice(idx, 1);
    if (!ch.sections.length) {
      // drop empty chapter if others remain
      const ci = outline.chapters.indexOf(ch);
      if (outline.chapters.length > 1) outline.chapters.splice(ci, 1);
      else ch.sections.push(createSection({ type: 'vr', title: L('VR 场景', 'VR Scene') }));
    }
    if (outline.activeSectionId === sectionId) {
      outline.activeSectionId = outline.chapters[0].sections[0]?.id || null;
    }
    emit('outline-changed', outline);
    return true;
  }
  return false;
}

/** Compact tree for Agent global context (no heavy payloads). */
export function outlineGlobalForAgent(outline = getOutline()) {
  return {
    course: { ...outline.course },
    progress: { ...outline.progress },
    activeSectionId: outline.activeSectionId,
    chapters: outline.chapters.map(ch => ({
      id: ch.id,
      title: ch.title,
      summary: ch.summary,
      sections: ch.sections.map(s => ({
        id: s.id,
        title: s.title,
        type: s.type,
        summary: s.summary,
        purpose: s.purpose,
      })),
    })),
  };
}

/** Detailed active chapter+section for Agent dynamic context. */
export function outlineActiveForAgent(outline = getOutline()) {
  const hit = getActiveSection(outline);
  if (!hit) return null;
  const { chapter, section } = hit;
  const detail = {
    chapter: { id: chapter.id, title: chapter.title, summary: chapter.summary },
    section: {
      id: section.id,
      title: section.title,
      type: section.type,
      summary: section.summary,
      purpose: section.purpose,
    },
  };
  if (section.type === 'reading') detail.section.reading = section.reading;
  if (section.type === 'h5') detail.section.h5 = section.h5;
  if (section.type === 'quiz') detail.section.quiz = section.quiz;
  if (section.type === 'vr') {
    detail.section.vr = {
      note: 'This section owns an isolated 3D scene snapshot + camera (vr.scene / vr.camera). Switching Outline VR sections swaps graph and view.',
      hasScene: !!(section.vr?.scene),
      savedAt: section.vr?.savedAt || null,
      sceneNote: section.vr?.note || '',
    };
  }
  return detail;
}

/** Plain-text block injected into buildContextMessage. */
export function outlineContextBlock() {
  const outline = ensureOutline();
  const global = outlineGlobalForAgent(outline);
  const active = outlineActiveForAgent(outline);
  return `

[Learning Outline — course structure]
${JSON.stringify(global, null, 1)}

[Active chapter / section — focus edits here unless the teacher asks otherwise]
${JSON.stringify(active, null, 1)}`;
}

function escapeHtmlLite(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Rough markdown → HTML for emergency reading seed (no full MD engine). */
function markdownToReadingHtml(md, maxChars = 2800) {
  const src = String(md || '').trim().slice(0, maxChars);
  if (!src) return `<p>${escapeHtmlLite(L('（请根据上传材料填写阅读内容）', '(Fill reading content from the uploaded material)'))}</p>`;
  const blocks = src.split(/\n{2,}/).slice(0, 12);
  return blocks.map(block => {
    const line = block.trim();
    if (!line) return '';
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      const tag = h[1].length === 1 ? 'h2' : 'h3';
      return `<${tag}>${escapeHtmlLite(h[2])}</${tag}>`;
    }
    return `<p>${escapeHtmlLite(line.replace(/\n/g, ' '))}</p>`;
  }).filter(Boolean).join('\n') || `<p>${escapeHtmlLite(src.slice(0, 400))}</p>`;
}

function topicHintFromMarkdown(md, filename = '') {
  const m = String(md || '').match(/^#\s+(.+)$/m);
  if (m) return m[1].trim().slice(0, 80);
  const base = String(filename || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return base || L('本课主题', 'this lesson topic');
}

/**
 * HARD guarantee for imported teaching materials:
 * at least one reading + one quiz section (and one 3D/vr section) in chapter 1.
 * @param {{ seedIfEmpty?: boolean, markdown?: string, filename?: string, silent?: boolean }} [opts]
 */
export function ensureDocCourseMinimum(opts = {}) {
  const outline = ensureOutline();
  const ch = outline.chapters[0];
  if (!ch) return null;

  const findType = type => ch.sections.find(s => s.type === type);
  let vr = findType('vr');
  let reading = findType('reading');
  let quiz = findType('quiz');
  let changed = false;

  const sceneTitle = studyFlag('disableVrPlayerController')
    ? L('3D 场景', '3D Scene')
    : L('VR 场景', 'VR Scene');
  const scenePurpose = studyFlag('disableVrPlayerController')
    ? L('在 3D 场景中观察与交互', 'Observe and interact in the 3D scene')
    : L('在 3D/VR 中搭建与演练', 'Build and practice in 3D/VR');

  if (!vr) {
    vr = createSection({ type: 'vr', title: sceneTitle, purpose: scenePurpose });
    ch.sections.unshift(vr);
    changed = true;
  }
  if (!reading) {
    reading = createSection({
      type: 'reading',
      title: L('阅读材料', 'Reading'),
      purpose: L('梳理上传材料中的核心概念', 'Cover core concepts from the uploaded material'),
    });
    const vrIdx = ch.sections.indexOf(vr);
    ch.sections.splice(vrIdx + 1, 0, reading);
    changed = true;
  }
  if (!quiz) {
    quiz = createSection({
      type: 'quiz',
      title: L('测验', 'Quiz'),
      purpose: L('检查对本课核心概念的理解', 'Check understanding of core concepts'),
    });
    ch.sections.push(quiz);
    changed = true;
  }

  if (opts.seedIfEmpty) {
    const md = opts.markdown || '';
    const topic = topicHintFromMarkdown(md, opts.filename);
    if (!reading.reading.chunks?.length) {
      reading.reading.chunks = [createReadingChunk({
        title: L('背景与核心概念', 'Background & core concepts'),
        html: markdownToReadingHtml(md),
      })];
      changed = true;
    }
    if (!quiz.quiz.items?.length) {
      quiz.quiz.items = [
        createQuizItem({
          type: 'mcq',
          question: L(`关于「${topic}」，下列哪一项最符合材料要点？`, `Which statement best matches the material on "${topic}"?`),
          options: isEN()
            ? ['It matches a key idea from the reading', 'It contradicts the reading', 'It is unrelated', 'Not enough information']
            : ['符合阅读材料中的关键要点', '与阅读材料矛盾', '与材料无关', '材料未涉及'],
          answer: '0',
          explanation: L('请回到阅读节核对原文后再作答。', 'Return to the reading section and check the source before answering.'),
        }),
        createQuizItem({
          type: 'short',
          question: L(`用自己的话简述「${topic}」中最重要的一个概念。`, `In your own words, briefly state one key concept from "${topic}".`),
          answer: '',
          explanation: L('开放作答：能点出材料中的核心术语或机制即可。', 'Open response: naming a core term or mechanism from the material is enough.'),
        }),
      ];
      changed = true;
    }
  }

  if (changed && !opts.silent) emit('outline-changed', outline);
  return { outline, reading, quiz, vr, changed };
}
