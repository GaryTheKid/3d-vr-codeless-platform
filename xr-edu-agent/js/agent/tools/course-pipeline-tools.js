// ═══════════════════════════════════════════════════════════════
//  Course pipeline tools — deterministic KG / outline / section fill
//  so weaker LLMs can still deliver reading / H5 / quiz / VR content.
//  (Dynamic-import course-pipeline to avoid circular deps with tools/index.)
// ═══════════════════════════════════════════════════════════════
import { L } from '../../core/i18n.js';
import { state } from '../../core/state.js';
import { getUploadedDoc, snapshotUploadedDoc } from '../doc-context.js';
import {
  findSection, getOutline, getActiveSection,
  createReadingChunk, updateSection,
} from '../../core/outline.js';
import { knowledgeGraphDigest } from '../../core/knowledge-graph.js';
import { hasOpenAIImages, loadApiKeys } from '../llm.js';
import {
  generatePedagogyImage, buildPedagogyImagePrompt, injectImageIntoChunkHtml,
} from '../openai-images.js';
import { ok, fail } from './shared.js';

function requireDoc() {
  const doc = snapshotUploadedDoc(getUploadedDoc());
  if (!doc?.markdown) {
    return { err: fail(L('请先上传教学材料(PDF/Word 等)', 'Upload teaching material first (PDF/Word/…)')) };
  }
  if (doc.jobId) state.activeDocJobId = doc.jobId;
  return { doc };
}

async function pipeline() {
  return import('../course-pipeline.js');
}

export default [
  {
    name: 'course_tag_figures',
    label: () => L('🖼 标注材料插图', '🖼 Tag material figures'),
    description: '对已上传材料的插图做教学用途标注(core/supporting/decorative/noise + visualSummary)。备课流水线第①步。改大纲前建议先跑。',
    input_schema: { type: 'object', properties: {}, required: [] },
    async exec() {
      const { doc, err } = requireDoc();
      if (err) return err;
      try {
        const { enrichDocImages, pedagogicalImages } = await pipeline();
        await enrichDocImages(doc);
        const ped = pedagogicalImages(doc);
        return ok(L(
          `已标注 ${doc.images?.length || 0} 张图,其中教学相关 ${ped.length} 张`,
          `Tagged ${doc.images?.length || 0} figures (${ped.length} pedagogical)`,
        ), {
          total: doc.images?.length || 0,
          pedagogical: ped.length,
          note: doc.imageFilterNote || '',
        });
      } catch (e) {
        return fail(e.message || String(e));
      }
    },
  },
  {
    name: 'course_build_outline_from_doc',
    label: () => L('🕸 从材料生成 KG+大纲', '🕸 Build KG + outline from doc'),
    description: '从上传材料抽取知识图谱并生成 Learning Outline(章→节,type=reading|h5|quiz|vr,绑 covers[])。备课流水线②③步。会覆盖当前大纲树——确认老师意图后再调。',
    input_schema: { type: 'object', properties: {}, required: [] },
    async exec() {
      const { doc, err } = requireDoc();
      if (err) return err;
      try {
        const { enrichDocImages, extractKgAndOutlinePlan, applyKgAndOutline } = await pipeline();
        if (!doc.images?.some(im => im.relevance || im.purpose)) {
          await enrichDocImages(doc);
        }
        const plan = await extractKgAndOutlinePlan(doc);
        const { kg, outline } = applyKgAndOutline(plan, doc);
        const nSec = outline.chapters.reduce((n, c) => n + c.sections.length, 0);
        return ok(L(
          `已生成 KG(${kg.nodes.length} 节点)与大纲(${nSec} 小节)`,
          `Built KG (${kg.nodes.length} nodes) and outline (${nSec} sections)`,
        ), {
          nodes: kg.nodes.length,
          edges: kg.edges.length,
          sections: nSec,
          courseTitle: outline.course?.title,
        });
      } catch (e) {
        return fail(e.message || String(e));
      }
    },
  },
  {
    name: 'course_fill_section',
    label: inp => L(
      `✎ 填充小节 ${inp.section_id || '(active)'}`,
      `✎ Fill section ${inp.section_id || '(active)'}`,
    ),
    description: '按节类型自动填充内容:reading→知识块(+可选 gpt-image 示意图);h5→交互 HTML;quiz→题目;vr→独立 3D 场景快照(与其它 VR 节互不覆盖)。传入 section_id,省略则用当前活动节。需要已有大纲与材料。',
    input_schema: {
      type: 'object',
      properties: {
        section_id: { type: 'string', description: '小节 id;省略=当前活动节' },
      },
      required: [],
    },
    async exec(inp) {
      const { err: docErr } = requireDoc();
      if (docErr) return docErr;
      const id = String(inp.section_id || getOutline().activeSectionId || '');
      const hit = findSection(id);
      if (!hit) return fail(L(`找不到小节 ${id || '(none)'}`, `Section not found: ${id || '(none)'}`));
      if (state.coursePipelineBusy) {
        return fail(L('课程流水线正忙,请稍后再试', 'Course pipeline is busy; try again shortly'));
      }
      try {
        const { fillSectionById } = await pipeline();
        await fillSectionById(id, null);
        const again = findSection(id);
        return ok(L(
          `小节「${again?.section?.title || id}」(${again?.section?.type}) 已填充`,
          `Section "${again?.section?.title || id}" (${again?.section?.type}) filled`,
        ), {
          section_id: id,
          type: again?.section?.type,
          buildStatus: again?.section?.buildStatus,
        });
      } catch (e) {
        return fail(e.message || String(e));
      }
    },
  },
  {
    name: 'course_kg_digest',
    label: () => L('🕸 读取知识图谱摘要', '🕸 Read KG digest'),
    description: '读取当前知识图谱紧凑摘要(节点/边/课程目标)。写大纲或填节前可用来对齐 covers。',
    input_schema: { type: 'object', properties: {}, required: [] },
    exec() {
      const kg = state.knowledgeGraph;
      if (!kg?.nodes?.length) {
        return fail(L('尚无知识图谱——先 course_build_outline_from_doc 或跑备课流水线', 'No knowledge graph yet — call course_build_outline_from_doc first'));
      }
      return ok(L('已读取 KG 摘要', 'KG digest ready'), {
        digest: knowledgeGraphDigest(kg),
        nodes: kg.nodes.length,
        edges: kg.edges?.length || 0,
      });
    },
  },
  {
    name: 'course_enrich_reading_images',
    label: () => L('🖼 为阅读节补示意图', '🖼 Enrich reading with images'),
    description: '对 reading 节已有知识块调用 gpt-image-2 注入教学示意图(软性:尽量至少 1 张;失败不阻断)。需配置 GPT API / OPENAI_API_KEY 且经 server.py 打开。',
    input_schema: {
      type: 'object',
      properties: {
        section_id: { type: 'string', description: 'reading 小节 id;省略=当前活动节' },
      },
      required: [],
    },
    async exec(inp) {
      await loadApiKeys();
      if (!hasOpenAIImages()) {
        return fail(L(
          '未配置 OpenAI 图片密钥(api-keys.txt 中 GPT API: 或 OPENAI_API_KEY=)',
          'No OpenAI image key (GPT API: or OPENAI_API_KEY= in api-keys.txt)',
        ));
      }
      const id = String(inp.section_id || getOutline().activeSectionId || '');
      const hit = findSection(id);
      if (!hit) return fail(L(`找不到小节 ${id || '(none)'}`, `Section not found: ${id || '(none)'}`));
      if (hit.section.type !== 'reading') {
        return fail(L('当前节不是 reading', 'Section is not reading'));
      }
      const chunks = hit.section.reading?.chunks || [];
      if (!chunks.length) return fail(L('该节尚无知识块', 'Section has no reading chunks yet'));
      try {
        const { enrichReadingChunksWithImages } = await pipeline();
        const ctx = {
          section: { id: hit.section.id, title: hit.section.title },
          coveredNodes: (hit.section.covers || []).map(cid => ({ id: cid, label: cid })),
        };
        const enriched = await enrichReadingChunksWithImages(chunks, ctx);
        updateSection(id, { reading: { chunks: enriched } });
        const imgs = enriched.filter(c => /<img\b/i.test(c.html || '')).length;
        return ok(L(`已处理阅读图,含图知识块 ${imgs} 个`, `Reading images done; ${imgs} chunk(s) with images`), {
          section_id: id,
          withImages: imgs,
        });
      } catch (e) {
        return fail(e.message || String(e));
      }
    },
  },
  {
    name: 'course_generate_image',
    label: () => L('🖼 生成一张教学插图', '🖼 Generate one pedagogy image'),
    description: '用 gpt-image-2 生成一张教材风示意图,返回 data URL。可选写入当前 reading 节某个 chunk(chunk_index)。不强制写入。',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '英文或中文示意图描述' },
        concept: { type: 'string' },
        section_id: { type: 'string' },
        chunk_index: { type: 'number', description: '若提供则注入到该 reading chunk' },
      },
      required: ['prompt'],
    },
    async exec(inp) {
      await loadApiKeys();
      if (!hasOpenAIImages()) {
        return fail(L('未配置 OpenAI 图片密钥', 'No OpenAI image key configured'));
      }
      try {
        const prompt = buildPedagogyImagePrompt({
          title: inp.concept || '',
          concept: inp.concept || inp.prompt,
          htmlHint: inp.prompt,
        });
        const img = await generatePedagogyImage(prompt, { size: '1024x1024' });
        if (!img?.dataUrl) return fail(L('图片生成无结果', 'Image generation returned empty'));
        const sid = inp.section_id || getActiveSection()?.section?.id;
        if (sid != null && inp.chunk_index != null) {
          const hit = findSection(sid);
          if (hit?.section?.type === 'reading') {
            const chunks = [...(hit.section.reading?.chunks || [])].map(createReadingChunk);
            const i = Math.max(0, Math.min(chunks.length - 1, Number(inp.chunk_index) | 0));
            if (chunks[i]) {
              chunks[i] = createReadingChunk({
                ...chunks[i],
                html: injectImageIntoChunkHtml(chunks[i].html || '', {
                  dataUrl: img.dataUrl,
                  alt: inp.concept || chunks[i].title,
                  caption: inp.concept || chunks[i].title,
                }),
              });
              updateSection(sid, { reading: { chunks } });
            }
          }
        }
        return ok(L('教学插图已生成', 'Pedagogy image generated'), {
          dataUrlPreview: `${img.dataUrl.slice(0, 48)}…`,
          revisedPrompt: img.revisedPrompt || '',
        });
      } catch (e) {
        return fail(e.message || String(e));
      }
    },
  },
];
