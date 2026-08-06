// ═══════════════════════════════════════════════════════════════
//  Uploaded teaching document (Docling → markdown + images)
//  Held in memory for Agent context; cleared via clearUploadedDoc().
// ═══════════════════════════════════════════════════════════════
import { L, isEN } from '../core/i18n.js';
import { escapeHtml } from '../core/utils.js';
import { callClaude, hasLLM, MODELS } from './llm.js';

/** @type {null | {
 *   jobId: string,
 *   filename: string,
 *   markdown: string,
 *   markdownUrl: string,
 *   images: { id: string, filename: string, url: string, width?: number, height?: number }[],
 *   charCount: number,
 *   summary?: string,
 * }} */
let uploadedDoc = null;

const MD_CONTEXT_MAX = 24000;   // chars injected into LLM context (full md stays on disk)
const SUMMARY_SRC_MAX = 12000;  // chars sent to LLM for the chat summary

export function getUploadedDoc() {
  return uploadedDoc;
}

export function setUploadedDoc(doc) {
  uploadedDoc = doc;
  return uploadedDoc;
}

export function clearUploadedDoc() {
  uploadedDoc = null;
}

/**
 * Deep-ish snapshot so the course pipeline cannot be poisoned if the teacher
 * uploads another PDF mid-run (or if the live slot is cleared).
 */
export function snapshotUploadedDoc(doc = uploadedDoc) {
  if (!doc) return null;
  return {
    jobId: String(doc.jobId || ''),
    filename: String(doc.filename || ''),
    markdown: String(doc.markdown || ''),
    markdownUrl: String(doc.markdownUrl || ''),
    charCount: doc.charCount || (doc.markdown || '').length,
    summary: doc.summary != null ? String(doc.summary) : '',
    images: Array.isArray(doc.images)
      ? doc.images.map(im => ({ ...im, concepts: Array.isArray(im.concepts) ? [...im.concepts] : [], anchor: im.anchor ? { ...im.anchor } : undefined }))
      : [],
  };
}

/** Compact block for buildContextMessage — Agent reads this each turn while a doc is attached. */
export function uploadedDocContextBlock() {
  if (!uploadedDoc) return '';
  const d = uploadedDoc;
  let md = d.markdown || '';
  let truncated = false;
  if (md.length > MD_CONTEXT_MAX) {
    md = md.slice(0, MD_CONTEXT_MAX) + '\n\n…[truncated]';
    truncated = true;
  }
  const ped = (d.images || []).filter(im => {
    const r = String(im.relevance || '').toLowerCase();
    if (r === 'decorative' || r === 'noise') return false;
    if (im.pedagogical === false) return false;
    return true;
  });
  const showImgs = ped.length ? ped : (d.images || []);
  const imgLines = showImgs.map((im, i) => {
    const bits = [
      `${i + 1}. ${im.id} → ${im.url}`,
      im.width ? `(${im.width}×${im.height})` : '',
      im.relevance ? `relevance=${im.relevance}` : '',
      im.anchor?.order != null ? `order=${im.anchor.order}` : '',
      im.anchor?.nearHeading ? `near="${im.anchor.nearHeading}"` : '',
      im.purpose ? `purpose: ${im.purpose}` : '',
      im.visualSummary ? `visual: ${String(im.visualSummary).slice(0, 180)}` : '',
      (im.concepts || []).length ? `concepts: ${(im.concepts || []).join(', ')}` : '',
    ].filter(Boolean);
    return '  ' + bits.join(' · ');
  }).join('\n') || '  (none)';

  const summaryBlock = d.summary
    ? (isEN()
      ? `\nteacher-facing summary:\n${d.summary}\n`
      : `\n给老师看的摘要:\n${d.summary}\n`)
    : '';

  const imgCountNote = ped.length && ped.length !== (d.images || []).length
    ? (isEN()
      ? `pedagogical ${ped.length}/${d.images.length} (decorative filtered)`
      : `教学图 ${ped.length}/${d.images.length}(已滤装饰图)`)
    : String(d.images?.length || 0);

  if (isEN()) {
    return `

[Uploaded teaching material — use this as the lesson source]
filename: ${d.filename}
jobId: ${d.jobId}
images (${imgCountNote}):
${imgLines}${summaryBlock}
markdown${truncated ? ' (truncated for context; full file at ' + d.markdownUrl + ')' : ''}:
---
${md}
---
SOURCE LOCK: this jobId is the ONLY teaching source in this session. Ignore any earlier PDF or chat topic.
HARD REQUIREMENT: when building a course, use the Knowledge Graph / Outline pipeline (not ad-hoc single-scene dumps). Prefer pedagogical figures with purpose/visualSummary — ignore decorative logos/icons.
Guidance: build from text AND figure meaning (tables/diagrams). Do not invent facts that contradict the text.`;
  }
  return `

[老师上传的教学材料 — 请以此为备课依据]
文件名: ${d.filename}
jobId: ${d.jobId}
图片(${imgCountNote}):
${imgLines}${summaryBlock}
Markdown${truncated ? '（上下文已截断;完整文件见 ' + d.markdownUrl + '）' : ''}:
---
${md}
---
来源锁定:本会话只认这个 jobId 的材料,忽略此前任何 PDF/对话主题。
硬性要求:备课走知识图谱→大纲→分节填充流水线。优先有教学意义、带 purpose/visualSummary 的插图;忽略装饰性 logo/图标。
用法:结合正文与插图语义搭建课程。不要编造与原文矛盾的内容。`;
}

/** Default agent task after a successful upload. */
export function defaultDocAgentTask() {
  const name = uploadedDoc?.filename || L('文档', 'document');
  const n = uploadedDoc?.images?.length || 0;
  return L(
    `我刚上传了教学材料「${name}」(已转成 Markdown,含 ${n} 张图)。请阅读上下文里的材料,规划并搭建完整课程:①用 reading_set_chunks 写至少一节阅读(核心概念/背景);②用 quiz_set_items 写至少一节测验;③在 3D 场景节用合适对象/面板/交互呈现关键机制。即使材料很短,阅读+测验也不可省略。材料里的图可参考构图,场景对象仍用平台工具创建。`,
    `I just uploaded teaching material "${name}" (converted to Markdown with ${n} image(s)). Read the material in context, then plan and build a full lesson: (1) at least one reading section via reading_set_chunks (core concepts/background); (2) at least one quiz section via quiz_set_items; (3) a 3D scene section with suitable objects/panels/interactions. Even if the PDF is very short, reading + quiz are mandatory. Use figures as composition reference; still create scene objects with platform tools.`
  );
}

/** Pull H1/H2 headings + a short lead paragraph from markdown (no LLM). */
export function extractDocOutline(markdown = '') {
  const lines = String(markdown).split(/\r?\n/);
  const headings = [];
  let lead = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const hm = line.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      headings.push({ level: hm[1].length, text: hm[2].replace(/[#*_`]/g, '').trim() });
      continue;
    }
    if (!lead && !line.startsWith('!') && !line.startsWith('<!--') && !line.startsWith('|') && !line.startsWith('-') && !line.startsWith('*')) {
      lead = line.replace(/[*_`#]/g, '').trim();
      if (lead.length > 220) lead = lead.slice(0, 220) + '…';
    }
  }
  // Prefer unique top headings; cap for UI
  const seen = new Set();
  const unique = [];
  for (const h of headings) {
    const key = h.text.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(h);
    if (unique.length >= 10) break;
  }
  return { headings: unique, lead };
}

/** Clamp summary text for the compact chat card; full text opens in overlay. */
function clampSummaryText(text, max = 280) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= max) return s.endsWith('…') || s.endsWith('...') ? s : s + '…';
  return s.slice(0, max).replace(/\s+\S*$/, '').trimEnd() + '…';
}

/** Immediate HTML card for chat (outline + meta). LLM narrative filled in later if available. */
export function formatDocSummaryHtml(doc, { narrative = '' } = {}) {
  if (!doc) return '';
  const n = doc.images?.length || 0;
  const { headings, lead } = extractDocOutline(doc.markdown || '');
  const title = headings[0]?.text || doc.filename;
  const outline = headings.slice(headings[0] ? 1 : 0)
    .map(h => `<li class="doc-sum-h${h.level}">${escapeHtml(h.text)}</li>`)
    .join('');
  const thumbs = (doc.images || []).slice(0, 4).map(im =>
    `<a class="doc-sum-thumb" href="${escapeHtml(im.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(im.url)}" alt="${escapeHtml(im.id)}" /></a>`
  ).join('');

  const fullNarrative = (narrative || doc.summary || '').trim();
  const previewText = fullNarrative
    ? clampSummaryText(fullNarrative)
    : (lead ? clampSummaryText(lead) : '');

  const narrativeBlock = previewText
    ? `<div class="doc-sum-narrative">${escapeHtml(previewText)}</div>`
    : '';

  return `<div class="doc-summary-card" role="button" tabindex="0" title="${escapeHtml(L('点击查看完整摘要', 'Click to view full summary'))}" data-doc-sum="1">
  <div class="doc-sum-head">📄 ${escapeHtml(L('教学材料摘要', 'Teaching material summary'))}<span class="doc-sum-expand-hint">${escapeHtml(L('点击展开', 'Click to expand'))}</span></div>
  <div class="doc-sum-title">${escapeHtml(title)}</div>
  <div class="doc-sum-meta">${escapeHtml(doc.filename)} · ${(doc.charCount || 0).toLocaleString()} ${escapeHtml(L('字', 'chars'))} · ${n} ${escapeHtml(L('图', 'images'))}</div>
  ${narrativeBlock}
  ${outline ? `<ul class="doc-sum-outline">${outline}</ul>` : ''}
  ${thumbs ? `<div class="doc-sum-thumbs">${thumbs}</div>` : ''}
  <div class="doc-sum-more">…</div>
  <div class="doc-sum-foot">${escapeHtml(L('材料已挂入 Agent 上下文。点「据此备课」将跑:插图标注 → 知识图谱 → 大纲 → 分节填充。', 'Attached to agent context. “Build from this” runs: figure tags → knowledge graph → outline → section fill.'))}</div>
</div>`;
}

/** Full scrollable body for the summary overlay. */
export function formatDocSummaryFullHtml(doc) {
  if (!doc) return '';
  const n = doc.images?.length || 0;
  const { headings, lead } = extractDocOutline(doc.markdown || '');
  const title = headings[0]?.text || doc.filename;
  const outline = headings.map(h =>
    `<li class="doc-sum-h${h.level}">${escapeHtml(h.text)}</li>`
  ).join('');
  const narrative = (doc.summary || '').trim();
  const thumbs = (doc.images || []).map(im =>
    `<a class="doc-sum-thumb" href="${escapeHtml(im.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(im.url)}" alt="${escapeHtml(im.id)}" /></a>`
  ).join('');

  return `
  <div class="doc-sum-full-meta">${escapeHtml(doc.filename)} · ${(doc.charCount || 0).toLocaleString()} ${escapeHtml(L('字', 'chars'))} · ${n} ${escapeHtml(L('图', 'images'))}</div>
  <h2 class="doc-sum-full-title">${escapeHtml(title)}</h2>
  ${narrative ? `<div class="doc-sum-full-narrative">${escapeHtml(narrative)}</div>` : ''}
  ${!narrative && lead ? `<p class="doc-sum-full-narrative">${escapeHtml(lead)}</p>` : ''}
  ${outline ? `<div class="doc-sum-full-sec">${escapeHtml(L('大纲', 'Outline'))}</div><ul class="doc-sum-outline">${outline}</ul>` : ''}
  ${thumbs ? `<div class="doc-sum-full-sec">${escapeHtml(L('配图', 'Figures'))}</div><div class="doc-sum-thumbs doc-sum-thumbs-lg">${thumbs}</div>` : ''}
`;
}

/**
 * Ask the LLM for a short teaching-oriented summary of the uploaded markdown.
 * @param {object} doc
 * @param {{ model?: string }} [opts]
 * @returns {Promise<string>} plain text summary (empty string on failure / offline)
 */
export async function summarizeDocWithLLM(doc, { model } = {}) {
  if (!doc?.markdown || !hasLLM()) return '';
  const modelId = model || MODELS[0]?.id;
  if (!modelId) return '';
  let src = doc.markdown;
  if (src.length > SUMMARY_SRC_MAX) src = src.slice(0, SUMMARY_SRC_MAX) + '\n…[truncated]';

  const system = isEN()
    ? 'You summarize teaching documents for a VR lesson authoring tool. ALWAYS write in English — match the website UI language, NOT the source document language. Be concrete and concise. No tools. No markdown fences.'
    : '你在为 VR 备课工具总结教学文档。必须始终使用中文输出——跟网站界面语言一致,不要跟上传材料的语种走。具体、简洁。不要调用工具。不要输出代码围栏。';
  const user = isEN()
    ? `The website UI language is English. Summarize this teaching material for a teacher in 4–7 short bullet lines IN ENGLISH ONLY (even if the source text is Chinese or mixed):\n- topic / goal\n- core concepts students should learn\n- suggested VR scene beats (2–4)\n- note any figures worth referencing\nDocument:\n\n${src}`
    : `网站界面语言是中文。请用中文(即使原文是英文或中英混排)用 4–7 条短要点为老师总结这份教学材料:\n- 主题/目标\n- 学生应掌握的核心知识点\n- 建议的 VR 课呈现节奏(2–4 拍)\n- 值得参考的图示(如有)\n文档如下:\n\n${src}`;

  const res = await callClaude({
    model: modelId,
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: 700,
    effort: 'low',
  });
  const text = (res.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
  if (uploadedDoc && uploadedDoc.jobId === doc.jobId) {
    uploadedDoc.summary = text;
  }
  return text;
}

/** Upload a File to POST /__doc/convert (base64 JSON). Requires local python server.py (not GitHub Pages). */
export async function convertDocumentFile(file, { onProgress } = {}) {
  if (!file) throw new Error(L('未选择文件', 'No file selected'));
  onProgress?.(L('正在读取文件…', 'Reading file…'));
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked base64 to avoid call-stack limits on large files
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const data_b64 = btoa(bin);
  onProgress?.(L('正在解析文档(Docling)…', 'Parsing document (Docling)…'));
  let res;
  try {
    res = await fetch('/__doc/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, data_b64 }),
    });
  } catch (e) {
    throw new Error(L(
      `无法连接文档转换服务(${e.message || 'network'})。PDF 上传需要本地 python server.py(含 Docling),GitHub Pages 静态托管不支持。`,
      `Cannot reach the document converter (${e.message || 'network'}). PDF upload needs local python server.py (with Docling); GitHub Pages static hosting cannot run it.`
    ));
  }
  const raw = await res.text();
  // GitHub Pages / static hosts: POST often → 405/404 HTML, not our JSON API
  if (res.status === 405 || res.status === 404 || /^\s*</.test(raw)) {
    throw new Error(L(
      '文档转换不可用(HTTP ' + res.status + ')。GitHub Pages 是静态站,没有 Docling 后端。请在本机仓库根目录运行 python server.py 后打开 http://localhost:8000/ 再上传 PDF。',
      `Document conversion unavailable (HTTP ${res.status}). GitHub Pages is static-only and has no Docling backend. Run python server.py from the repo root and open http://localhost:8000/ to upload PDFs.`
    ));
  }
  let data;
  try { data = JSON.parse(raw); }
  catch {
    throw new Error(L(
      '服务器返回了无效响应(非 JSON)。请确认用 python server.py 打开本站,而不是纯静态托管。',
      'Server returned a non-JSON response. Open the app via python server.py, not a static host alone.'
    ));
  }
  if (!res.ok || !data.ok) {
    throw new Error(data?.error || L(`转换失败 (HTTP ${res.status})`, `Conversion failed (HTTP ${res.status})`));
  }
  return setUploadedDoc({
    jobId: data.jobId,
    filename: data.filename || file.name,
    markdown: data.markdown || '',
    markdownUrl: data.markdownUrl || '',
    images: data.images || [],
    charCount: data.charCount || (data.markdown || '').length,
  });
}
