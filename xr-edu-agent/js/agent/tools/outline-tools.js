// ═══════════════════════════════════════════════════════════════
//  Outline / Reading / H5 / Quiz tools — Agent can edit course structure
//  & non-VR section content (persisted on cfg.outline)
// ═══════════════════════════════════════════════════════════════
import { L } from '../../core/i18n.js';
import {
  getOutline, getActiveSection, setActiveSection, findSection,
  updateCourse, updateChapter, updateSection, addChapter, addSection,
  createReadingChunk, createQuizItem, createFollowUp, SECTION_TYPES,
} from '../../core/outline.js';
import { ok, fail } from './shared.js';

function requireSection(section_id) {
  const id = section_id || getOutline().activeSectionId;
  const hit = findSection(id);
  if (!hit) return { err: fail(L(`找不到小节 ${id || '(none)'}`, `Section not found: ${id || '(none)'}`)) };
  return { id, ...hit };
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
    description: '新增一章(默认带一个 VR 节)。建议章名说清主题。',
    input_schema: {
      type: 'object',
      properties: { title: { type: 'string' }, summary: { type: 'string' } },
    },
    exec(inp) {
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
    description: '在指定章下新增小节。测验节建议加在章末。type=vr|reading|h5|quiz。',
    input_schema: {
      type: 'object',
      properties: {
        chapter_id: { type: 'string' },
        title: { type: 'string' },
        type: { type: 'string', enum: SECTION_TYPES },
        purpose: { type: 'string' },
      },
      required: ['chapter_id'],
    },
    exec(inp) {
      const type = SECTION_TYPES.includes(inp.type) ? inp.type : 'vr';
      const sec = addSection(String(inp.chapter_id), {
        type,
        title: inp.title ? String(inp.title) : undefined,
        purpose: inp.purpose ? String(inp.purpose) : '',
      });
      return sec ? ok(L(`已添加节 ${sec.id}`, `Added section ${sec.id}`), { section_id: sec.id, type: sec.type }) : fail(L('章节不存在', 'Chapter not found'));
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
      updateSection(id, { reading: { chunks } });
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
      updateSection(id, { quiz: { items } });
      return ok(L(`已写入 ${items.length} 道题`, `Wrote ${items.length} quiz items`));
    },
  },
];
