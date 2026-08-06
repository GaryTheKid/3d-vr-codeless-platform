// ═══════════════════════════════════════════════════════════════
//  Outline / Reading / H5 / Quiz tools — Agent can edit course structure
//  & non-VR section content (persisted on cfg.outline)
// ═══════════════════════════════════════════════════════════════
import { L } from '../../core/i18n.js';
import {
  getOutline, getActiveSection, setActiveSection, findSection,
  updateCourse, updateChapter, updateSection, addChapter, addSection, removeSection,
  createReadingChunk, createQuizItem, createFollowUp, SECTION_TYPES,
} from '../../core/outline.js';
import { ok, fail } from './shared.js';

function requireSection(section_id) {
  const id = section_id || getOutline().activeSectionId;
  const hit = findSection(id);
  if (!hit) return { err: fail(L(`找不到小节 ${id || '(none)'}`, `Section not found: ${id || '(none)'}`)) };
  return { id, ...hit };
}

/** A section nobody has authored yet — safe to reuse instead of adding another. */
function isBlankSection(s) {
  if (!s) return false;
  if (s.buildStatus === 'done') return false;
  const kids = s.vr?.scene?.object?.children?.length || 0;
  return !(s.reading?.chunks?.length)
    && !(s.quiz?.items?.length)
    && !(s.h5?.html || '').trim()
    && kids <= 1;
}

export default [
  {
    name: 'outline_get',
    label: () => L('📋 读取学习大纲', '📋 Read learning outline'),
    description: '读取当前课程 Learning Outline(章→节树、课程标题/目标、当前活动节及 reading/h5/quiz 内容摘要)。改大纲或备课前先调一次。',
    input_schema: { type: 'object', properties: {}, required: [] },
    exec() {
      const o = getOutline();
      const active = getActiveSection(o);
      return ok(L('已读取大纲', 'Outline loaded'), {
        course: o.course,
        activeSectionId: o.activeSectionId,
        chapters: o.chapters.map(ch => ({
          id: ch.id, title: ch.title, summary: ch.summary,
          sections: ch.sections.map(s => ({
            id: s.id, title: s.title, type: s.type, purpose: s.purpose, summary: s.summary,
            readingChunks: s.reading?.chunks?.length || 0,
            h5Status: s.h5?.status || 'idle',
            quizItems: s.quiz?.items?.length || 0,
          })),
        })),
        active: active ? {
          chapterId: active.chapter.id,
          section: {
            id: active.section.id,
            title: active.section.title,
            type: active.section.type,
            purpose: active.section.purpose,
            reading: active.section.reading,
            h5: active.section.h5,
            quiz: active.section.quiz,
          },
        } : null,
      });
    },
  },
  {
    name: 'outline_set_active',
    label: inp => L(`📋 切换到小节 ${inp.section_id || ''}`, `📋 Activate section ${inp.section_id || ''}`),
    description: '切换当前活动小节(会切换中心工作区:vr=3D, reading/h5/quiz=对应编辑器)。',
    input_schema: {
      type: 'object',
      properties: { section_id: { type: 'string', description: '小节 id' } },
      required: ['section_id'],
    },
    exec(inp) {
      if (!setActiveSection(String(inp.section_id))) return fail(L('小节不存在', 'Section not found'));
      return ok(L(`已切换到 ${inp.section_id}`, `Switched to ${inp.section_id}`));
    },
  },
  {
    name: 'outline_update_course',
    label: () => L('📋 更新课程信息', '📋 Update course'),
    description: '更新课程标题/目标/节奏备注。',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        goal: { type: 'string' },
        paceNote: { type: 'string' },
      },
    },
    exec(inp) {
      updateCourse({
        ...(inp.title != null ? { title: String(inp.title) } : {}),
        ...(inp.goal != null ? { goal: String(inp.goal) } : {}),
        ...(inp.paceNote != null ? { paceNote: String(inp.paceNote) } : {}),
      });
      return ok(L('课程信息已更新', 'Course info updated'));
    },
  },
  {
    name: 'outline_update_chapter',
    label: inp => L(`📋 更新章 ${inp.chapter_id || ''}`, `📋 Update chapter ${inp.chapter_id || ''}`),
    description: '更新章节标题或摘要。',
    input_schema: {
      type: 'object',
      properties: {
        chapter_id: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
      },
      required: ['chapter_id'],
    },
    exec(inp) {
      const ch = updateChapter(String(inp.chapter_id), {
        ...(inp.title != null ? { title: String(inp.title) } : {}),
        ...(inp.summary != null ? { summary: String(inp.summary) } : {}),
      });
      return ch ? ok(L('章节已更新', 'Chapter updated')) : fail(L('章节不存在', 'Chapter not found'));
    },
  },
  {
    name: 'outline_update_section',
    label: inp => L(`📋 更新节 ${inp.section_id || ''}`, `📋 Update section ${inp.section_id || ''}`),
    description: '更新小节标题/目的/类型(vr|reading|h5|quiz)/摘要。改类型会切换工作区形态。',
    input_schema: {
      type: 'object',
      properties: {
        section_id: { type: 'string', description: '省略则用当前活动节' },
        title: { type: 'string' },
        purpose: { type: 'string' },
        summary: { type: 'string' },
        type: { type: 'string', enum: SECTION_TYPES },
      },
    },
    exec(inp) {
      const { id, err } = requireSection(inp.section_id);
      if (err) return err;
      if (inp.type && !SECTION_TYPES.includes(inp.type)) return fail(L('非法 type', 'Invalid type'));
      updateSection(id, {
        ...(inp.title != null ? { title: String(inp.title) } : {}),
        ...(inp.purpose != null ? { purpose: String(inp.purpose) } : {}),
        ...(inp.summary != null ? { summary: String(inp.summary) } : {}),
        ...(inp.type ? { type: inp.type } : {}),
      });
      return ok(L('小节已更新', 'Section updated'));
    },
  },
  {
    name: 'outline_add_chapter',
    label: () => L('📋 新增章', '📋 Add chapter'),
    description: '新增一章(默认带一个空 VR 节)。⚠ 只有老师明确要求「加一章」时才可调用;改现有内容不要新增章。requested_by_teacher 必须原样引用老师提出该要求的原话。',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        requested_by_teacher: {
          type: 'string',
          description: 'Quote the teacher words that asked for a NEW chapter. Leave out if they did not ask.',
        },
      },
      required: ['requested_by_teacher'],
    },
    exec(inp) {
      if (!String(inp.requested_by_teacher || '').trim()) {
        return fail(L(
          '老师没有要求新增章。改内容请用 outline_update_* 或对应内容工具。',
          'The teacher did not ask for a new chapter. Edit existing content with outline_update_* or the content tools.'
        ));
      }
      const chapters = getOutline().chapters;
      const tail = chapters[chapters.length - 1];
      if (tail && tail.sections.length && tail.sections.every(isBlankSection)) {
        return fail(L(
          `上一章「${tail.title}」还全是空节,请先填满或改用它(${tail.id}),不要再加新章。`,
          `The last chapter "${tail.title}" is still all-blank — fill or reuse it (${tail.id}) instead of adding another.`
        ));
      }
      const ch = addChapter({
        title: inp.title ? String(inp.title) : undefined,
        summary: inp.summary ? String(inp.summary) : '',
      });
      return ok(L(`已添加章 ${ch.id}`, `Added chapter ${ch.id}`), { chapter_id: ch.id, section_id: ch.sections[0]?.id });
    },
  },
  {
    name: 'outline_add_section',
    label: inp => L(`📋 新增节(${inp.type || 'vr'})`, `📋 Add section (${inp.type || 'vr'})`),
    description: '在指定章下新增空小节。⚠ 只有老师明确要求「加一节」时才可调用——修改/重做已有小节请用 outline_update_section + 内容工具,不要新增。新节不会抢走当前活动节。type=vr|reading|h5|quiz。',
    input_schema: {
      type: 'object',
      properties: {
        chapter_id: { type: 'string' },
        title: { type: 'string' },
        type: { type: 'string', enum: SECTION_TYPES },
        purpose: { type: 'string' },
        requested_by_teacher: {
          type: 'string',
          description: 'Quote the teacher words that asked for a NEW section. Leave out if they did not ask.',
        },
      },
      required: ['chapter_id', 'requested_by_teacher'],
    },
    exec(inp) {
      if (!String(inp.requested_by_teacher || '').trim()) {
        return fail(L(
          '老师没有要求新增小节。要改已有小节请用 outline_update_section / reading_set_chunks / h5_set_content / quiz_set_items / 3D 场景工具。',
          'The teacher did not ask for a new section. To change an existing one use outline_update_section / reading_set_chunks / h5_set_content / quiz_set_items / the 3D scene tools.'
        ));
      }
      const type = SECTION_TYPES.includes(inp.type) ? inp.type : 'vr';
      const ch = getOutline().chapters.find(c => c.id === String(inp.chapter_id));
      if (!ch) return fail(L('章节不存在', 'Chapter not found'));
      const spare = ch.sections.find(s => s.type === type && isBlankSection(s));
      if (spare) {
        return fail(L(
          `本章已有一个空的 ${type} 节「${spare.title}」(${spare.id}),请直接填它,不要再加。`,
          `This chapter already has a blank ${type} section "${spare.title}" (${spare.id}) — fill that one instead of adding another.`
        ));
      }
      // activate:false — a new blank section must not swap the teacher's 3D viewport
      const sec = addSection(String(inp.chapter_id), {
        type,
        title: inp.title ? String(inp.title) : undefined,
        purpose: inp.purpose ? String(inp.purpose) : '',
      }, { activate: false });
      return sec ? ok(L(`已添加节 ${sec.id}`, `Added section ${sec.id}`), { section_id: sec.id, type: sec.type }) : fail(L('章节不存在', 'Chapter not found'));
    },
  },
  {
    name: 'outline_remove_section',
    label: inp => L(`📋 删除空节 ${inp.section_id || ''}`, `📋 Remove blank section ${inp.section_id || ''}`),
    description: '删除一个还没有内容的小节(清理误加的空节)。已填过内容的小节不会被删除。',
    input_schema: {
      type: 'object',
      properties: { section_id: { type: 'string' } },
      required: ['section_id'],
    },
    exec(inp) {
      const hit = findSection(String(inp.section_id));
      if (!hit) return fail(L('小节不存在', 'Section not found'));
      if (!isBlankSection(hit.section)) {
        return fail(L(
          `「${hit.section.title}」已有内容,不能用此工具删除,请让老师在大纲里手动删。`,
          `"${hit.section.title}" already has content — ask the teacher to delete it from the outline instead.`
        ));
      }
      return removeSection(String(inp.section_id))
        ? ok(L(`已删除空节 ${inp.section_id}`, `Removed blank section ${inp.section_id}`))
        : fail(L('无法删除(课程至少要保留一个小节)', 'Cannot remove — the course needs at least one section'));
    },
  },
  {
    name: 'reading_set_chunks',
    label: () => L('📖 写入阅读知识块', '📖 Set reading chunks'),
    description: '覆盖某 reading 节的知识块列表。每块:{id?, title, html(富文本HTML), followUp?:{type:mcq|short, question, options[], answer, explanation}}。用于备课阅读内容。',
    input_schema: {
      type: 'object',
      properties: {
        section_id: { type: 'string' },
        chunks: { type: 'array', items: { type: 'object' } },
      },
      required: ['chunks'],
    },
    exec(inp) {
      const { id, section, err } = requireSection(inp.section_id);
      if (err) return err;
      if (section.type !== 'reading') return fail(L('当前节不是 reading,请先改 type 或换节', 'Current section is not reading; change type or switch section first'));
      const chunks = (inp.chunks || []).map(c => createReadingChunk({
        ...c,
        followUp: c.followUp ? createFollowUp(c.followUp) : null,
      }));
      updateSection(id, { reading: { chunks }, buildStatus: chunks.length ? 'done' : section.buildStatus });
      return ok(L(`已写入 ${chunks.length} 个知识块`, `Wrote ${chunks.length} reading chunks`));
    },
  },
  {
    name: 'h5_set_content',
    label: () => L('🖥 写入 H5 内容', '🖥 Set H5 content'),
    description: '写入 h5 节的 prompt、html(完整/片段 HTML)、可选 followUp 测验。Agent 可直接生成交互 HTML 填入。',
    input_schema: {
      type: 'object',
      properties: {
        section_id: { type: 'string' },
        prompt: { type: 'string' },
        html: { type: 'string' },
        followUp: { type: 'object' },
      },
    },
    exec(inp) {
      const { id, section, err } = requireSection(inp.section_id);
      if (err) return err;
      if (section.type !== 'h5') return fail(L('当前节不是 h5', 'Current section is not h5'));
      const patch = { h5: { ...section.h5 } };
      if (inp.prompt != null) patch.h5.prompt = String(inp.prompt);
      if (inp.html != null) {
        patch.h5.html = String(inp.html);
        patch.h5.status = 'ready';
      }
      if (inp.followUp === null) patch.h5.followUp = null;
      else if (inp.followUp) patch.h5.followUp = createFollowUp(inp.followUp);
      if (patch.h5.status === 'ready') patch.buildStatus = 'done';
      updateSection(id, patch);
      return ok(L('H5 内容已更新', 'H5 content updated'));
    },
  },
  {
    name: 'quiz_set_items',
    label: () => L('❓ 写入测验题', '❓ Set quiz items'),
    description: '覆盖 quiz 节的题目列表。每题:{id?, type:mcq|short, question, options[](选择题), answer, explanation}。适合章末测验。',
    input_schema: {
      type: 'object',
      properties: {
        section_id: { type: 'string' },
        items: { type: 'array', items: { type: 'object' } },
      },
      required: ['items'],
    },
    exec(inp) {
      const { id, section, err } = requireSection(inp.section_id);
      if (err) return err;
      if (section.type !== 'quiz') return fail(L('当前节不是 quiz', 'Current section is not quiz'));
      const items = (inp.items || []).map(createQuizItem);
      updateSection(id, { quiz: { items }, buildStatus: items.length ? 'done' : section.buildStatus });
      return ok(L(`已写入 ${items.length} 道题`, `Wrote ${items.length} quiz items`));
    },
  },
];
