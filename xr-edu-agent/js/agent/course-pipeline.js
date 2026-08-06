// ═══════════════════════════════════════════════════════════════
//  Course pipeline: PDF md → image tags → KG/MindMap → Outline →
//  per-section modality + sub-agent fill (replaces old "Build from this")
// ═══════════════════════════════════════════════════════════════
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { toast } from '../core/utils.js';
import { L, isEN } from '../core/i18n.js';
import { callClaude, hasLLM, loadApiKeys, isRetryableLLMError, hasOpenAIImages } from './llm.js';
import {
  generatePedagogyImage, buildPedagogyImagePrompt, injectImageIntoChunkHtml,
} from './openai-images.js';
import { agent } from './orchestrator.js';
import { getUploadedDoc, snapshotUploadedDoc } from './doc-context.js';
import {
  setKnowledgeGraph, knowledgeGraphDigest, nodesByIds, emptyKnowledgeGraph,
} from '../core/knowledge-graph.js';
import {
  setOutline, createChapter, createSection, createReadingChunk, createQuizItem,
  updateSection, setActiveSection, ensureOutline, getOutline, findSection,
  createFollowUp,
} from '../core/outline.js';
import { studyFlag } from '../core/study-test-flags.js';
import { TOOLS, execTool, toolCallLabel } from './tools/index.js';
import { clearScene } from '../scene/manager.js';
import { ensureStudentRig } from '../scene/student-rig.js';
import {
  beginVrSectionFill, finishVrSectionFill, ensureVrFillSceneBound,
  restoreViewerAfterVrFillTool, countTeachingObjects, unrestorableSnapshotObjects,
} from '../core/section-scene.js';

const MD_SLICE = 18000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractJSON(raw) {
  if (!raw) return null;
  let t = String(raw).trim().replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(t); } catch { /* continue */ }
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  // Truncated JSON: try light repair (close open strings/braces) for partial recovery
  if (depth > 0) {
    let repaired = t.slice(start);
    if (inStr) repaired += '"';
    repaired += '}'.repeat(depth);
    try { return JSON.parse(repaired); } catch { /* ignore */ }
  }
  return null;
}

function stage(ui, title, note, stageNum, total) {
  emit('agent-progress', { stage: stageNum, total, title, note: note || '' });
  if (ui?._pipeTyping) ui._pipeTyping.remove?.();
  if (ui?.addTyping) ui._pipeTyping = ui.addTyping(title);
}

/** Tiny logos / spacers / decorative bits — not teaching figures. */
function heuristicDecorativeImage(im) {
  const w = Number(im.width) || 0;
  const h = Number(im.height) || 0;
  const name = `${im.filename || ''} ${im.id || ''}`.toLowerCase();
  if (/logo|icon|badge|favicon|sprite|spacer|divider|button|avatar|qr.?code/.test(name)) return true;
  if (w > 0 && h > 0) {
    if (w < 96 || h < 96) return true;
    if (w * h < 16000) return true;
    if (h < 48 && w > 180) return true; // thin banner
  }
  return false;
}

export function isPedagogicalImage(im) {
  if (!im) return false;
  if (im.pedagogical === false) return false;
  const r = String(im.relevance || '').toLowerCase();
  if (r === 'decorative' || r === 'noise') return false;
  if (r === 'core' || r === 'supporting') return true;
  // Untagged: keep unless heuristic says noise
  return !heuristicDecorativeImage(im);
}

export function pedagogicalImages(doc) {
  return (doc?.images || []).filter(isPedagogicalImage);
}

async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const abs = /^https?:/i.test(url) ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    const res = await fetch(abs);
    if (!res.ok) return null;
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const media = blob.type || 'image/png';
    if (!/^image\//.test(media)) return null;
    // Cap ~1.2MB base64 payload per image
    if (bin.length > 900_000) return null;
    return { media_type: media, data: btoa(bin) };
  } catch {
    return null;
  }
}

async function llmJSON({ system, user, maxTokens = 8192, images = null, retries = 3 }) {
  await loadApiKeys();
  if (!hasLLM()) throw new Error(L('需要在线模型才能跑课程流水线', 'Online model required for the course pipeline'));

  let content;
  if (typeof user === 'string' && images?.length) {
    content = [{ type: 'text', text: user }];
    for (const im of images) {
      if (!im?.data) continue;
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: im.media_type || 'image/png', data: im.data },
      });
      content.push({ type: 'text', text: `(figure id: ${im.id || 'unknown'})` });
    }
  } else {
    content = user;
  }

  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const tok = attempt === 1 ? maxTokens : Math.min(Math.round(maxTokens * 1.35), 16000);
      const res = await callClaude({
        model: agent.model,
        system: attempt === 1
          ? system
          : `${system}\n\nIMPORTANT: Reply with ONE complete valid JSON object only. No markdown fences. Do not truncate.`,
        messages: [{ role: 'user', content }],
        maxTokens: tok,
        effort: attempt > 2 ? 'low' : 'medium',
      });
      const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const truncated = res.stop_reason === 'max_tokens';
      const obj = extractJSON(text);
      if (obj) return obj;
      lastErr = new Error(L('模型未返回可用 JSON', 'Model returned no usable JSON')
        + (truncated ? L('（输出被截断）', ' (output truncated)') : '')
        + (text ? `: ${text.slice(0, 160)}` : ''));
      if (attempt < retries) await sleep(600 * attempt * attempt);
    } catch (e) {
      lastErr = e;
      if (attempt < retries && (isRetryableLLMError(e.message) || /no usable JSON|截断|truncated/i.test(e.message))) {
        await sleep(1200 * attempt * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error(L('模型未返回可用 JSON', 'Model returned no usable JSON'));
}

async function withSectionRetries(fn, { tries = 3 } = {}) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e?.message || String(e);
      const retryable = isRetryableLLMError(msg) || /no usable JSON|truncated|截断|Overloaded|529/i.test(msg);
      if (!retryable || i === tries) throw e;
      await sleep(1500 * i * i);
    }
  }
  throw last;
}

/** Soft check: warn (don't abort) if teacher swapped the attached PDF mid-pipeline. */
function assertPipelineDocStillBound(doc) {
  const live = getUploadedDoc();
  if (!live) return;
  if (live.jobId && doc.jobId && live.jobId !== doc.jobId) {
    console.warn('[course-pipeline] live upload changed mid-run; continuing with frozen snapshot', {
      frozen: doc.jobId, live: live.jobId,
    });
  }
}

/** Step 1b — classify figures (keep teaching ones) + extract visual meaning. */
export async function enrichDocImages(doc) {
  if (!doc?.images?.length) return doc;

  // Pre-tag obvious noise so the LLM focuses on real figures
  doc.images = doc.images.map(im => {
    if (heuristicDecorativeImage(im)) {
      return {
        ...im,
        relevance: 'noise',
        pedagogical: false,
        purpose: im.purpose || L('装饰/非教学内容（图标或排版碎片）', 'Decorative / non-teaching (icon or layout fragment)'),
        concepts: im.concepts || [],
      };
    }
    return im;
  });

  const candidates = doc.images.filter(im => im.relevance !== 'noise');
  if (!candidates.length) return doc;

  const catalog = candidates.map((im, i) => ({
    id: im.id,
    order: im.order || im.anchor?.order || i + 1,
    url: im.url,
    width: im.width || null,
    height: im.height || null,
    nearHeading: im.anchor?.nearHeading || '',
    mdCharOffset: im.anchor?.mdCharOffset ?? null,
  }));

  // Vision: largest few candidates (tables/diagrams encode concepts text alone misses)
  const byArea = [...candidates].sort((a, b) => ((b.width || 400) * (b.height || 400)) - ((a.width || 400) * (a.height || 400)));
  const visionTargets = byArea.slice(0, 5);
  const visionImgs = [];
  for (const im of visionTargets) {
    const packed = await fetchImageAsBase64(im.url);
    if (packed) visionImgs.push({ id: im.id, ...packed });
  }

  const md = (doc.markdown || '').slice(0, 10000);
  const lang = isEN() ? 'English' : 'Chinese';
  const obj = await llmJSON({
    maxTokens: 5000,
    images: visionImgs.length ? visionImgs : null,
    system: `You annotate figures from a teaching PDF for course design. Reply JSON only.
Purpose/visualSummary fields in ${lang}.

Schema:
{"images":[{
  "id":"picture_01",
  "relevance":"core"|"supporting"|"decorative"|"noise",
  "purpose":"1-2 sentences: educational role for learners",
  "visualSummary":"Concrete content of the figure (e.g. table rows/columns, molecule shapes labeled, axes). Empty if decorative.",
  "anchorNote":"where it sits in the lesson flow",
  "concepts":["keyword"]
}]}

Relevance rules (critical):
- core = essential teaching graphic (concept tables, mechanism diagrams, labeled geometry charts, worked examples with structure)
- supporting = helpful but secondary photo/diagram
- decorative = logos, publisher marks, LibreTexts headers, icons, ornamental images
- noise = page chrome, tiny icons, spacers, unrelated UI chrome
Most PDFs have MANY decorative images — be strict. Prefer few core figures over many weak ones.
When you can SEE the image, visualSummary MUST capture the actual readable structure (not just "a chemistry figure").
Every input id must appear once.`,
    user: `SOURCE LOCK jobId=${doc.jobId || '(none)'} filename=${doc.filename}
Annotate ONLY these figures for THIS document (ignore any prior PDF).
Figures metadata:
${JSON.stringify(catalog, null, 1)}

Markdown excerpt:
${md}

${visionImgs.length ? `Attached ${visionImgs.length} figure image(s) for visual reading — use them to fill visualSummary accurately.` : 'No images attached; infer from metadata + markdown context.'}`,
  });

  const byId = Object.fromEntries((obj.images || []).map(x => [x.id, x]));
  doc.images = doc.images.map(im => {
    if (im.relevance === 'noise' && !byId[im.id]) return im;
    const hit = byId[im.id] || {};
    let relevance = String(hit.relevance || im.relevance || 'supporting').toLowerCase();
    if (!['core', 'supporting', 'decorative', 'noise'].includes(relevance)) relevance = 'supporting';
    if (heuristicDecorativeImage(im) && relevance === 'supporting') relevance = 'decorative';
    const pedagogical = relevance === 'core' || relevance === 'supporting';
    return {
      ...im,
      relevance,
      pedagogical,
      purpose: hit.purpose || im.purpose || (pedagogical
        ? L('支撑正文概念的插图', 'Illustration supporting the text')
        : L('装饰性图片', 'Decorative image')),
      visualSummary: hit.visualSummary || im.visualSummary || '',
      anchorNote: hit.anchorNote || im.anchorNote || '',
      concepts: Array.isArray(hit.concepts) ? hit.concepts.map(String) : (im.concepts || []),
      anchor: {
        ...(im.anchor || {}),
        order: im.order || im.anchor?.order,
        purpose: hit.purpose || im.purpose,
      },
    };
  });

  const kept = pedagogicalImages(doc).length;
  const total = doc.images.length;
  doc.imageFilterNote = L(
    `插图筛选:保留 ${kept}/${total} 张有教学意义的图`,
    `Figure filter: kept ${kept}/${total} pedagogical images`
  );
  return doc;
}

/** Steps 2–3 — MindMap/KG + Outline plan; grounded in text AND pedagogical figures. */
export async function extractKgAndOutlinePlan(doc) {
  const md = (doc.markdown || '').slice(0, MD_SLICE);
  const imgs = pedagogicalImages(doc).map(im => ({
    id: im.id,
    relevance: im.relevance,
    purpose: im.purpose,
    visualSummary: im.visualSummary || '',
    concepts: im.concepts,
    nearHeading: im.anchor?.nearHeading,
  }));
  const noVrPlayer = studyFlag('disableVrPlayerController');
  const lang = isEN() ? 'English' : 'Chinese';
  const obj = await llmJSON({
    maxTokens: 12000,
    system: `You are a MASTER teacher and instructional designer. From teaching material, FIRST distill the "aha keys", THEN build a Knowledge Graph (mind map), THEN a Learning Outline that walks that graph and installs every aha key.
Reply with ONE JSON object only. All teacher-facing strings in ${lang}.

STEP 0 — AHA KEYS (think this BEFORE anything else):
Ask yourself: "If I teach this so well that students solve ANY re-skinned problem of this type for full marks, what are the 2–5 deep insights they must GET?" These are transferable keys, not facts to memorize.
Worked example — a projectile-motion handout's aha keys are:
 ① Any motion can be DECOMPOSED into component motions (here x & y) that are COMPLETELY INDEPENDENT of each other.
 ② The curved trajectory is nothing mysterious — it is just those independent horizontal & vertical motions recombined.
 ③ The a–v–x–t relations in ONE direction must be solid first, otherwise even a single decomposed axis is confusing.
A student who owns these three solves every projectile variant (cliff, cannon, angled launch), no matter how the surface story changes.

Schema:
{
  "courseTitle": string,
  "courseGoal": string,
  "level": "elementary"|"middle"|"high",
  "anchorExample": "one running example that threads the course",
  "ahaKeys": [{"id":"aha1","insight":"ONE sentence a student could repeat, in student language","whyKey":"why owning this solves any re-skinned problem of this type","misconception":"the common wrong intuition it replaces","buildIdea":"a concrete manipulable 3D/2D experience through which the student CONSTRUCTS this insight themselves (constructionism)","nodeIds":["n1"]}],
  "nodes": [{"id":"n1","kind":"concept|subconcept|principle|skill|equation|perk|example","label":string,"mastery":"what student must answer correctly after the course","fromFigure":"picture_id or empty"}],
  "edges": [{"from":"n1","to":"n2","relation":"prerequisite"}],
  "chapters": [{
    "title": string,
    "summary": string,
    "sections": [{
      "title": string,
      "type": "reading"|"h5"|"quiz"|"vr",
      "purpose": string,
      "role": "opening"|"development"|"application"|"consolidation",
      "covers": ["n1"],
      "installsAha": ["aha1"],
      "sourceHint": "which part of the PDF / which figure this section should teach",
      "figureIds": ["picture_01"]
    }]
  }]
}

Rules:
- ahaKeys: 2–5. insight = short & repeatable. buildIdea = the student MANIPULATES something and the insight emerges (predict → act → observe → articulate), never "read a statement of it".
- AHA INSTALL RULE (critical): every ahaKey MUST appear in installsAha[] of ≥1 section. The PRIMARY installer of an aha should be a vr or h5 section where the student constructs it interactively (e.g. aha ① above → a 3D scene where x-motion and y-motion run as separate markers alongside the combined curved flight, each component toggleable). reading may prepare or reinforce an aha, but may be its only installer ONLY for purely verbal material. quiz sections should list the ahaKeys they verify in installsAha too.
- nodes = ALL key perks students must master. Dense but not fluff. Include prerequisite nodes an aha depends on (e.g. aha ③ → nodes for a, v, x, t relations) even if the source treats them as assumed.
- FIGURE GROUNDING (critical): Pedagogical figures (especially relevance=core) often encode the densest knowledge (tables of geometries, labeled mechanisms). You MUST extract nodes from visualSummary of core figures — do not rely on prose alone. Example: a VSEPR geometry table → nodes for AX6/octahedral, AX5E/square pyramidal, etc.
- edges = learning order (must learn from before to).
- Outline MUST walk the graph in a teachable order (respect edges).
- Sections that teach figure-heavy content should set figureIds[] and sourceHint naming that figure.
- MUST include ≥1 reading AND ≥1 quiz in the whole course (even for short PDFs).
- Modality pick (spatiality):
  · vr = concept has intrinsic 3D/spatial dynamics (molecules, VSEPR shapes, orbits, tissue invasion…) — and aha keys whose buildIdea is spatial
  · h5 = 2D parameter / diagram / matching / condition-change interaction helps
  · reading = prose / definitions / background
  · quiz = check mastery of covered nodes (prefer chapter end)
${noVrPlayer ? '- STUDY: treat "vr" as interactive 3D orbit scene (no VR headset player). Still use type "vr" when spatial.' : ''}
- Every node id in covers[] must exist in nodes[]; every aha id in installsAha[] must exist in ahaKeys[]. Prefer 4–10 sections total for short handouts; more only if material is long.
- Ignore decorative/noise figures (they are already filtered out of the Images list).`,
    user: `SOURCE LOCK (critical):
jobId: ${doc.jobId || '(none)'}
filename: ${doc.filename}
You MUST build the course EXCLUSIVELY from THIS document's markdown + figures below.
Do NOT reuse topics, aha keys, nodes, or outline ideas from any prior PDF / chat / session.
The projectile-motion bullets in the system prompt are ONLY a shape example for ahaKeys — invent a projectile course ONLY if THIS markdown is actually about projectile motion.

Pedagogical figures (decorative noise already removed):
${JSON.stringify(imgs, null, 1)}

Markdown:
${md}`,
  });
  return obj;
}

export function applyKgAndOutline(plan, doc) {
  const kg = emptyKnowledgeGraph({
    level: plan.level,
    anchorExample: plan.anchorExample,
    courseTitle: plan.courseTitle,
    courseGoal: plan.courseGoal,
    nodes: plan.nodes,
    edges: plan.edges,
    ahaKeys: plan.ahaKeys,
    sourceFilename: doc.filename,
    updatedAt: Date.now(),
  });
  setKnowledgeGraph(kg);
  const ahaIds = new Set((kg.ahaKeys || []).map(a => a.id));

  const chapters = (plan.chapters || []).map((ch, ci) => createChapter({
    title: ch.title || L(`第 ${ci + 1} 章`, `Chapter ${ci + 1}`),
    summary: ch.summary || '',
    sections: (ch.sections || []).map(s => createSection({
      title: s.title || L('新小节', 'New section'),
      type: ['reading', 'h5', 'quiz', 'vr'].includes(s.type) ? s.type : 'reading',
      purpose: s.purpose || '',
      summary: s.sourceHint || '',
      covers: s.covers || [],
      role: s.role || '',
      sourceHint: s.sourceHint || '',
      figureIds: Array.isArray(s.figureIds) ? s.figureIds.map(String) : [],
      installsAha: (Array.isArray(s.installsAha) ? s.installsAha.map(String) : []).filter(id => ahaIds.has(id)),
      buildStatus: 'pending',
    })),
  })).filter(ch => ch.sections.length);

  // AHA INSTALL fallback: any aha the model forgot to assign → attach to the best
  // interactive section sharing its nodes (vr/h5 preferred), else the first section.
  if (kg.ahaKeys?.length && chapters.length) {
    const allSecs = chapters.flatMap(c => c.sections);
    const installed = new Set(allSecs.flatMap(s => s.installsAha));
    for (const aha of kg.ahaKeys) {
      if (installed.has(aha.id)) continue;
      const nodeSet = new Set(aha.nodeIds || []);
      const byNodes = t => allSecs.find(s => s.type === t && s.covers.some(id => nodeSet.has(id)));
      const target = byNodes('vr') || byNodes('h5') || byNodes('reading')
        || allSecs.find(s => s.type === 'vr' || s.type === 'h5') || allSecs[0];
      if (target) target.installsAha.push(aha.id);
    }
  }

  // Guarantee reading + quiz exist
  if (!chapters.length) {
    chapters.push(createChapter({
      title: L('第 1 章', 'Chapter 1'),
      sections: [
        createSection({ type: 'reading', title: L('阅读材料', 'Reading'), buildStatus: 'pending', covers: kg.nodes.slice(0, 3).map(n => n.id) }),
        createSection({ type: 'quiz', title: L('测验', 'Quiz'), buildStatus: 'pending', covers: kg.nodes.map(n => n.id) }),
      ],
    }));
  } else {
    const allSec = chapters.flatMap(c => c.sections);
    if (!allSec.some(s => s.type === 'reading')) {
      chapters[0].sections.unshift(createSection({
        type: 'reading', title: L('阅读材料', 'Reading'), buildStatus: 'pending',
        covers: kg.nodes.slice(0, 4).map(n => n.id),
        purpose: L('梳理核心概念', 'Cover core concepts'),
      }));
    }
    if (!allSec.some(s => s.type === 'quiz')) {
      chapters[chapters.length - 1].sections.push(createSection({
        type: 'quiz', title: L('综合测验', 'Quiz'), buildStatus: 'pending',
        covers: kg.nodes.map(n => n.id),
        purpose: L('检查全部必会知识点', 'Check all must-master perks'),
      }));
    }
  }

  const outline = {
    version: 1,
    course: {
      title: plan.courseTitle || doc.filename?.replace(/\.[^.]+$/, '') || L('未命名课程', 'Untitled course'),
      goal: plan.courseGoal || '',
      paceNote: L('由知识图谱自动生成的学习大纲', 'Learning outline generated from the knowledge graph'),
    },
    progress: { completedSectionIds: [] },
    chapters,
    activeSectionId: chapters[0].sections[0].id,
  };
  setOutline(outline);
  emit('course-pipeline-outline-ready', outline);
  return { kg, outline };
}

function sectionContext(section, doc, kg, board = null) {
  const covered = nodesByIds(section.covers || [], kg);
  const figureIds = new Set((section.figureIds || []).map(String));
  const imgs = pedagogicalImages(doc)
    .filter(im => {
      if (figureIds.size && figureIds.has(im.id)) return true;
      const concepts = (im.concepts || []).map(c => String(c).toLowerCase());
      const vs = `${im.visualSummary || ''} ${im.purpose || ''}`.toLowerCase();
      return covered.some(n => {
        const lab = n.label.toLowerCase();
        return concepts.some(c => lab.includes(c) || c.includes(lab))
          || vs.includes(lab)
          || (im.purpose && im.purpose.includes(n.label));
      });
    })
    .slice(0, 6);
  // Always include section-bound figures even if concept match failed
  for (const id of figureIds) {
    const im = (doc.images || []).find(x => x.id === id);
    if (im && isPedagogicalImage(im) && !imgs.some(x => x.id === id)) imgs.unshift(im);
  }
  const claimed = board?.snapshot?.() || [];
  // Aha keys this section must install (assigned) or touches (shared nodes)
  const installIds = new Set((section.installsAha || []).map(String));
  const coverSet = new Set(section.covers || []);
  const ahaKeys = (kg.ahaKeys || [])
    .filter(a => installIds.has(a.id) || (a.nodeIds || []).some(id => coverSet.has(id)))
    .slice(0, 4)
    .map(a => ({
      id: a.id,
      insight: a.insight,
      whyKey: a.whyKey,
      misconception: a.misconception,
      buildIdea: a.buildIdea,
      mustInstall: installIds.has(a.id),
    }));
  return {
    source: {
      jobId: doc.jobId || '',
      filename: doc.filename || '',
      note: 'Teach ONLY this source document. Ignore any prior PDF/session.',
    },
    section: {
      id: section.id,
      title: section.title,
      type: section.type,
      purpose: section.purpose,
      role: section.role,
      sourceHint: section.sourceHint,
      covers: section.covers,
      figureIds: [...figureIds],
      installsAha: [...installIds],
    },
    coveredNodes: covered,
    ahaKeys,
    kgDigest: knowledgeGraphDigest(kg, { maxNodes: 24 }),
    /** Other sections already filled — avoid duplicating their teaching beats */
    peerBoard: claimed,
    images: imgs.slice(0, 6).map(im => ({
      id: im.id, url: im.url, purpose: im.purpose,
      visualSummary: im.visualSummary || '',
      relevance: im.relevance,
      anchor: im.anchor, concepts: im.concepts,
    })),
    markdownSlice: sectionMarkdownSlice(doc, section, covered),
  };
}

/**
 * Source window centred on this section's own material.
 * Every section used to get the same first 8000 chars, which pushed sub-agents
 * (especially 3D ones) toward building the same scene twice.
 */
function sectionMarkdownSlice(doc, section, covered, size = 8000) {
  const md = doc.markdown || '';
  if (md.length <= size) return md;
  const hay = md.toLowerCase();
  const needles = [section.sourceHint, section.title, ...covered.map(n => n.label)]
    .filter(Boolean)
    .map(s => String(s).trim())
    .filter(s => s.length >= 2);
  const hits = [];
  for (const nd of needles) {
    const i = hay.indexOf(nd.toLowerCase());
    if (i >= 0) hits.push(i);
  }
  if (!hits.length) return md.slice(0, size);
  // Densest region: the hit with the most other hits inside one window
  let anchor = hits[0];
  let bestCount = -1;
  for (const h of hits) {
    const n = hits.filter(x => Math.abs(x - h) < size).length;
    if (n > bestCount) { bestCount = n; anchor = h; }
  }
  const start = Math.max(0, Math.min(md.length - size, anchor - Math.floor(size * 0.2)));
  return md.slice(start, start + size);
}

/** Teaching-object names inside a saved VR snapshot (peer de-dup + duplicate detection). */
function vrSceneObjectNames(sceneJson) {
  const kids = sceneJson?.object?.children || [];
  const out = [];
  for (const c of kids) {
    const ud = c.userData || {};
    if (ud.system || ud.studentRig) continue;
    const n = ud.displayName || c.name || ud.panelTitle || c.type || '';
    if (n) out.push(String(n).trim().slice(0, 40));
  }
  return out;
}

/** Comments, whitespace and literal numbers removed — near-identical builds collide. */
function normalizeBuilderCode(code) {
  return String(code)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/[\d.]+/g, '#')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * Fingerprint of what a section actually contains. Built from generator code
 * and panel text rather than display names, which the model varies freely
 * while building the very same scene.
 */
function vrSceneSignature(sceneJson) {
  const parts = [];
  for (const c of sceneJson?.object?.children || []) {
    const ud = c.userData || {};
    if (ud.system || ud.studentRig) continue;
    if (ud.builderCode) parts.push(`c:${normalizeBuilderCode(ud.builderCode)}`);
    else if (ud.panelSpec) {
      parts.push(`p:${ud.panelSpec.title || ''}|${(ud.panelSpec.lines || []).join('/')}`.toLowerCase());
    } else {
      const n = (ud.displayName || c.name || c.type || '').toLowerCase().replace(/\s*\d+\s*$/, '').trim();
      if (n) parts.push(`n:${n}`);
    }
  }
  if (parts.length < 2) return '';
  return parts.sort().join('||');
}

/** What the other 3D sections already contain, so the next one can stay distinct. */
function peerVrScenes(sectionId) {
  const rows = [];
  for (const ch of getOutline().chapters || []) {
    for (const s of ch.sections || []) {
      if (s.type !== 'vr' || s.id === sectionId || !s.vr?.scene) continue;
      const objects = vrSceneObjectNames(s.vr.scene).slice(0, 10);
      if (objects.length) rows.push({ title: s.title, objects });
    }
  }
  return rows;
}

function findDuplicateVrSection(sectionId, sig) {
  if (!sig) return null;
  for (const ch of getOutline().chapters || []) {
    for (const s of ch.sections || []) {
      if (s.type !== 'vr' || s.id === sectionId || !s.vr?.scene) continue;
      if (vrSceneSignature(s.vr.scene) === sig) return s;
    }
  }
  return null;
}

/** Dynamic shared board: completed section digests for parallel/serial sub-agents. */
function createSectionBoard() {
  const rows = [];
  return {
    publish(section, extra = {}) {
      rows.push({
        id: section.id,
        title: section.title,
        type: section.type,
        covers: [...(section.covers || [])],
        purpose: section.purpose || '',
        ...extra,
        at: Date.now(),
      });
    },
    snapshot() {
      return rows.map(r => ({
        id: r.id, title: r.title, type: r.type,
        covers: r.covers, purpose: r.purpose,
        note: r.note || '',
      }));
    },
  };
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fillSection(section, doc, kg, ui, { board = null, activate = false } = {}) {
  // VR: silent status update — a noisy outline-changed → sync mid-pipeline was
  // restoring empty snapshots and wiping the 2nd/3rd 3D section builds.
  const silentStatus = section.type === 'vr';
  updateSection(section.id, { buildStatus: 'running' }, { silent: silentStatus });
  // Avoid stealing the teacher's view during parallel fills; VR bind is handled inside fillVrSection
  if (activate) setActiveSection(section.id);
  emit('course-pipeline-section', {
    sectionId: section.id,
    title: section.title,
    type: section.type,
    status: 'running',
  });
  const ctx = sectionContext(section, doc, kg, board);
  try {
    await withSectionRetries(async () => {
      if (section.type === 'reading') await fillReadingSection(section, ctx);
      else if (section.type === 'quiz') await fillQuizSection(section, ctx);
      else if (section.type === 'h5') await fillH5Section(section, ctx);
      else if (section.type === 'vr') await fillVrSection(section, ctx, ui);
      else updateSection(section.id, { buildStatus: 'done' });
    }, { tries: section.type === 'vr' || section.type === 'h5' ? 3 : 2 });
    board?.publish(section, {
      note: section.type === 'reading'
        ? L(`阅读块 ${(findSection(section.id)?.section?.reading?.chunks || []).length} 个`, `${(findSection(section.id)?.section?.reading?.chunks || []).length} reading chunks`)
        : section.type === 'quiz'
          ? L(`测验 ${(findSection(section.id)?.section?.quiz?.items || []).length} 题`, `${(findSection(section.id)?.section?.quiz?.items || []).length} quiz items`)
          : section.type === 'h5'
            ? L('H5 交互已生成', 'H5 interactive ready')
            : L(
              `3D 对象: ${vrSceneObjectNames(findSection(section.id)?.section?.vr?.scene).join('、') || '—'}`,
              `3D objects: ${vrSceneObjectNames(findSection(section.id)?.section?.vr?.scene).join(', ') || '—'}`
            ),
    });
    emit('course-pipeline-section', {
      sectionId: section.id,
      title: section.title,
      type: section.type,
      status: 'done',
    });
  } catch (e) {
    updateSection(section.id, { buildStatus: 'error' });
    emit('course-pipeline-section', {
      sectionId: section.id,
      title: section.title,
      type: section.type,
      status: 'error',
      error: e.message,
    });
    throw e;
  }
}

async function fillReadingSection(section, ctx) {
  const lang = isEN() ? 'English' : 'Chinese';
  await loadApiKeys();
  const canImg = hasOpenAIImages();
  const obj = await llmJSON({
    maxTokens: 8000,
    system: isEN()
      ? `Fill ONE reading section as JSON only. Language: ${lang} for all student-facing text.
{"chunks":[{"title":string,"html":"short semantic HTML (1 idea only)","imagePrompt":"optional English visual brief for a textbook diagram, or empty","followUp":{"enabled":true,"type":"mcq"|"short","question":string,"options":["a","b","c","d"]|null,"answer":string,"explanation":string}|null}]}
Rules:
- ONE chunk = ONE single knowledge perk (definition, fact, or micro-skill). Keep each chunk SHORT (2–5 sentences or a tight list). Prefer MANY small chunks over few long ones (aim 4–10 when source allows).
- At least one followUp every 1–2 chunks (mcq or short). Prefer short for conceptual checks.
- AHA KEYS (if ctx.ahaKeys present): build chunks TOWARD those insights — name the misconception, contrast it with the correct view, and end the section with the insight stated in student language. followUps for aha chunks must re-skin the context (new surface story) so answering proves the student owns the KEY, not the example.
- Teach ONLY covered nodes. Faithful to source. No scripts.
- Do NOT re-teach concepts already listed in peerBoard (other sections). Cross-link briefly if needed.
- imagePrompt: ${canImg
    ? 'Prefer ≥1 concrete imagePrompt in this section (diagram / structure / process). Soft rule — not every chunk needs one. Leave empty only for pure abstract definitions.'
    : 'Always leave imagePrompt empty (no image API configured).'}`
      : `填写一节阅读内容,只输出 JSON。学生可见文案语言: ${lang}。
{"chunks":[{"title":string,"html":"短语义 HTML(只讲一个点)","imagePrompt":"可选英文示意图提示,无则空串","followUp":{"enabled":true,"type":"mcq"|"short","question":string,"options":["a","b","c","d"]|null,"answer":string,"explanation":string}|null}]}
规则:
- 每个知识块只讲一个要点(定义/事实/微技能),短小(2–5 句或紧凑列表)。宁多勿长(材料允许时 4–10 块)。
- 每 1–2 个知识块至少配 1 个 followUp(选择题或简答),概念检查优先简答。
- 顿悟点(若 ctx.ahaKeys 存在):知识块要层层铺向这些 insight——先点出常见误解(misconception),对比正确图景,最后用学生语言把 insight 说破。对应 followUp 必须换情境出题(换故事外壳),答对才说明学生掌握的是"钥匙"而非例题。
- 只教 covers 节点;忠实原文;无脚本。
- 勿重复 peerBoard 里其它节已教过的内容。
- imagePrompt: ${canImg
    ? '本节尽量至少给 1 个具体示意图提示(画什么、标什么);软性要求,不必每块都有。纯抽象定义可空。'
    : '一律留空(未配置图片 API)。'}`,
    user: JSON.stringify(ctx, null, 1),
  });
  let chunks = (obj.chunks || []).map(c => createReadingChunk({
    title: c.title || '',
    html: c.html || `<p>${c.title || ''}</p>`,
    followUp: c.followUp ? createFollowUp(c.followUp) : null,
    imagePrompt: c.imagePrompt || '',
  }));
  if (!chunks.length) {
    chunks.push(createReadingChunk({
      title: section.title,
      html: `<p>${ctx.coveredNodes.map(n => n.label).join(' · ') || section.purpose}</p>`,
    }));
  }
  // Ensure ≥1 follow-up every 1–2 chunks for study
  chunks = chunks.map((chk, i) => {
    if (chk.followUp?.question) return chk;
    const isLast = i === chunks.length - 1;
    const pairNeeds = (i % 2 === 1) || chunks.length === 1
      || (isLast && !(chunks[i - 1]?.followUp?.question));
    if (!pairNeeds) return chk;
    const label = ctx.coveredNodes[i % Math.max(1, ctx.coveredNodes.length)]?.label || section.title;
    return createReadingChunk({
      id: chk.id,
      title: chk.title,
      html: chk.html,
      imagePrompt: chk.imagePrompt || '',
      followUp: createFollowUp({
        enabled: true,
        type: 'short',
        question: isEN()
          ? `In your own words, what is the key idea of “${chk.title || label}”?`
          : `用自己的话简述「${chk.title || label}」的核心要点是什么？`,
        answer: label,
        explanation: isEN()
          ? 'Name the concept and one distinguishing detail.'
          : '说出概念名，并补一句区分性说明。',
      }),
    });
  });

  // 1) Extracted source figures (Docling) — deterministic, no API needed
  chunks = injectSourceFiguresIntoChunks(chunks, ctx);

  // 2) Generated pedagogical images (gpt-image) into remaining chunks
  if (canImg) {
    chunks = await enrichReadingChunksWithImages(chunks, ctx);
  } else {
    warnNoImageKeyOnce();
  }

  updateSection(section.id, { reading: { chunks }, buildStatus: 'done' });
}

let warnedNoImgKey = false;
function warnNoImageKeyOnce() {
  if (warnedNoImgKey) return;
  warnedNoImgKey = true;
  toast(L(
    '未检测到 GPT API 密钥,阅读节不会生成插图(api-keys.txt 配置 GPT API 后可用)',
    'No GPT API key detected — reading sections will have no generated images (set GPT API in api-keys.txt)'
  ));
}

/**
 * Deterministically place extracted source figures into the most relevant chunks.
 * The fill LLM only sees figure URLs as metadata and almost never embeds them —
 * so the actual injection happens here, in code.
 */
function injectSourceFiguresIntoChunks(chunks, ctx) {
  const figs = (ctx.images || []).filter(im => im?.url);
  if (!figs.length || !chunks.length) return chunks;
  const MAX_SRC_FIGS = 3;
  const out = chunks.map(c => createReadingChunk(c));
  const usedChunk = new Set();
  let placed = 0;
  for (const im of figs) {
    if (placed >= MAX_SRC_FIGS) break;
    const keys = [
      ...(im.concepts || []),
      ...String(im.visualSummary || '').split(/\s+/).filter(w => w.length > 3).slice(0, 12),
    ].map(s => String(s).toLowerCase()).filter(Boolean);
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < out.length; i++) {
      if (usedChunk.has(i) || /<img\b/i.test(out[i].html || '')) continue;
      const hay = `${out[i].title || ''} ${String(out[i].html || '').replace(/<[^>]+>/g, ' ')}`.toLowerCase();
      let score = 0;
      for (const k of keys) if (hay.includes(k)) score++;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    // Core figures land even without a text match; supporting ones need one
    if (best < 0 && String(im.relevance || '').toLowerCase() === 'core') {
      best = out.findIndex((c, i) => !usedChunk.has(i) && !/<img\b/i.test(c.html || ''));
    }
    if (best < 0) continue;
    const caption = String(im.visualSummary || im.purpose || '').slice(0, 140);
    out[best] = createReadingChunk({
      ...out[best],
      html: injectImageIntoChunkHtml(out[best].html || '', {
        dataUrl: im.url,
        alt: caption || im.id,
        caption,
      }),
    });
    usedChunk.add(best);
    placed += 1;
  }
  return out;
}

/**
 * Cap image gens per section. Soft guarantee: try ≥1 image when OpenAI is configured
 * (do not hard-fail the section if gen fails).
 */
export async function enrichReadingChunksWithImages(chunks, ctx) {
  const MAX_IMGS = 4;
  let list = chunks.map(c => createReadingChunk(c));
  const hasAnyPrompt = list.some(c => String(c.imagePrompt || '').trim());
  if (!hasAnyPrompt && list.length) {
    // Soft seed so image gen is actually attempted at least once.
    // Prefer visualizing an aha insight over a plain concept diagram.
    let seedIdx = list.findIndex(c => c.title || c.html);
    if (seedIdx < 0) seedIdx = 0;
    const aha = ctx.ahaKeys?.[0];
    const concept = ctx.coveredNodes?.[0]?.label || list[seedIdx].title || sectionTitleFallback(ctx);
    list[seedIdx] = createReadingChunk({
      ...list[seedIdx],
      imagePrompt: aha?.insight
        ? `Educational diagram that makes this insight visually obvious to a student: ${String(aha.insight).slice(0, 200)}. Contrast with the misconception: ${String(aha.misconception || '').slice(0, 120)}`
        : `Clear educational diagram illustrating “${concept}” for students`,
    });
  }

  let made = 0;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const chk = list[i];
    let html = chk.html || '';
    const wants = String(chk.imagePrompt || '').trim();
    if (wants && made < MAX_IMGS && !/<img\b/i.test(html)) {
      const ok = await tryInjectReadingImage(chk, wants, ctx, i);
      if (ok) {
        html = ok;
        made += 1;
      }
    }
    out.push(createReadingChunk({
      id: chk.id,
      title: chk.title,
      html,
      followUp: chk.followUp,
      imagePrompt: chk.imagePrompt || '',
    }));
  }

  // Soft guarantee: if the section still has NO image at all (neither generated
  // nor source figure), force one attempt on the first chunk without an <img>
  if (made === 0 && out.length && !out.some(c => /<img\b/i.test(c.html || ''))) {
    const i = out.findIndex(c => !/<img\b/i.test(c.html || '')) ;
    if (i >= 0) {
      const chk = out[i];
      const concept = ctx.coveredNodes?.[0]?.label || chk.title || sectionTitleFallback(ctx);
      const wants = String(chk.imagePrompt || '').trim()
        || `educational textbook diagram for ${concept}`;
      const html = await tryInjectReadingImage(chk, wants, ctx, i);
      if (html) {
        out[i] = createReadingChunk({ ...chk, html, imagePrompt: wants });
      }
    }
  }
  return out;
}

function sectionTitleFallback(ctx) {
  return ctx?.section?.title || 'key concept';
}

async function tryInjectReadingImage(chk, wants, ctx, i) {
  try {
    const concept = ctx.coveredNodes?.[i % Math.max(1, ctx.coveredNodes?.length || 1)]?.label
      || chk.title
      || sectionTitleFallback(ctx);
    const prompt = buildPedagogyImagePrompt({
      title: chk.title,
      concept,
      htmlHint: wants.length > 40 ? wants : `${wants}. ${chk.html || ''}`,
      lang: isEN() ? 'en' : 'zh',
    });
    const img = await generatePedagogyImage(prompt, { size: '1024x1024' });
    if (!img?.dataUrl) return null;
    return injectImageIntoChunkHtml(chk.html || '', {
      dataUrl: img.dataUrl,
      alt: chk.title || concept,
      caption: chk.title || concept,
    });
  } catch (e) {
    console.warn('[reading-img]', e.message || e);
    warnImageGenFailedOnce(e);
    return null;
  }
}

let warnedImgGenFail = false;
function warnImageGenFailedOnce(e) {
  if (warnedImgGenFail) return;
  warnedImgGenFail = true;
  toast(L(
    `插图生成失败:${String(e?.message || e).slice(0, 120)}`,
    `Image generation failed: ${String(e?.message || e).slice(0, 120)}`
  ));
}

async function fillQuizSection(section, ctx) {
  const lang = isEN() ? 'English' : 'Chinese';
  const obj = await llmJSON({
    maxTokens: 6000,
    system: isEN()
      ? `Design a quiz for covered KG nodes. JSON only. All text in ${lang}.
{"items":[{"type":"mcq"|"short","question":string,"options":["a","b","c","d"],"answer":"0-based index or short key","explanation":string}]}
2–5 items. Include at least one short. Probe mastery statements. No trivia outside the nodes.
AHA TRANSFER (if ctx.ahaKeys present): for EACH aha key, include ≥1 item set in a NEW surface context never used in the material (change the cover story, keep the structure). A student who owns the key solves it; one who memorized the example fails. Distractors should embody the listed misconception.`
      : `为 covers 节点出测验,只输出 JSON。文案语言: ${lang}。
{"items":[{"type":"mcq"|"short","question":string,"options":["a","b","c","d"],"answer":"0 起下标或简答要点","explanation":string}]}
2–5 题;至少 1 道简答;紧扣 mastery;勿超纲。
顿悟迁移(若 ctx.ahaKeys 存在):每个 aha key 至少配 1 题,且必须换全新情境(换故事外壳、保留结构)——掌握钥匙的学生能做对,只背例题的做不对;错误选项要体现 misconception。`,
    user: JSON.stringify(ctx, null, 1),
  });
  const items = (obj.items || []).map(it => createQuizItem(it));
  if (!items.length) {
    items.push(createQuizItem({
      type: 'short',
      question: L(`简述本课最重要的一个概念`, `Briefly state one key concept from this lesson`),
      answer: ctx.coveredNodes[0]?.label || '',
    }));
  }
  updateSection(section.id, { quiz: { items }, buildStatus: 'done' });
}

async function generateH5HtmlBody(prompt, section, ctx) {
  const lang = isEN() ? 'English' : 'Chinese';
  const figures = (ctx.images || []).map(im => ({
    ...im,
    // Absolute URL so <img src> works inside srcdoc iframes
    url: absolutizeMediaUrl(im.url),
  }));
  const res = await callClaude({
    model: agent.model,
    system: `You generate ONE self-contained educational HTML5 interactive. Return ONLY HTML (start with <div). Inline CSS/JS only. Language: ${lang}.
HARD rules:
- Meaningful interaction: process steps, slider/condition→viz change, matching with feedback, or predict-then-reveal.
- Ban: static PDF screenshot + label-reveal buttons only.
- If Figures are provided, embed at least one with a full absolute <img src="…"> URL from the list (do not invent paths).
- Keep scripts complete and closed. No external CDN scripts. No markdown fences.`,
    messages: [{
      role: 'user',
      content: `Section: ${section.title}\nPurpose: ${section.purpose || ''}\nCovered: ${JSON.stringify(ctx.coveredNodes)}\nFigures: ${JSON.stringify(figures)}\nBrief:\n${prompt}\n\nReturn HTML only.`,
    }],
    maxTokens: 4500,
    effort: 'low',
  });
  let text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  text = text.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '');
  if (!/<\w/.test(text)) throw new Error(L('H5 HTML 生成失败', 'H5 HTML generation failed'));
  return absolutizeH5Html(text);
}

function absolutizeMediaUrl(url) {
  if (!url) return '';
  const s = String(url);
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (typeof window === 'undefined') {
    const path = s.startsWith('/') ? s : `/${s.replace(/^\.\//, '')}`;
    return path;
  }
  // Keep GitHub project-page base path (origin + "/uploads/…" would 404 there)
  const rel = s.replace(/^\.\//, '').replace(/^\//, '');
  return new URL(rel, new URL('.', window.location.href)).href;
}

function absolutizeH5Html(html) {
  return String(html || '')
    .replace(/(<img\b[^>]*?\bsrc=["'])(?!https?:|data:|blob:)([^"']+)/gi, (_, pre, src) => {
      return `${pre}${absolutizeMediaUrl(src)}`;
    });
}

function h5LooksInteractive(html) {
  const h = String(html || '');
  if (h.length < 40) return false;
  // Must have some control surface OR canvas drawing
  return /<(button|input|select|textarea|canvas)\b/i.test(h)
    || /\bon(?:click|input|change)\s*=/i.test(h)
    || /addEventListener\s*\(/i.test(h);
}

function h5HtmlLooksBroken(html) {
  const h = String(html || '');
  if (!h.trim()) return true;
  const openScript = (h.match(/<script\b/gi) || []).length;
  const closeScript = (h.match(/<\/script>/gi) || []).length;
  if (openScript !== closeScript) return true;
  // Truncation often ends mid-attribute / mid-tag
  if (/<(?:div|button|script|style|img)\b[^>]*$/i.test(h.trim())) return true;
  return false;
}

async function fillH5Section(section, ctx) {
  const lang = isEN() ? 'English' : 'Chinese';
  // Phase 1: compact JSON plan ONLY (no embedded HTML — avoids truncation)
  const plan = await llmJSON({
    maxTokens: 2800,
    retries: 3,
    system: isEN()
      ? `Plan a meaningful 2D H5 learning interactive. JSON only — NO html field. All strings in ${lang}.
{"prompt":"detailed generation brief for an HTML widget (what student does, what changes on screen, data/steps)","interactionKind":"process"|"condition"|"matching"|"explore"|"predict","followUp":{"enabled":true,"type":"short","question":string,"answer":string,"explanation":string}}

HARD:
- Real learning interaction (process / condition change / matching with feedback / explore). Not a flyer.
- AHA CONSTRUCTION (if ctx.ahaKeys present, especially mustInstall=true): design the widget so the student CONSTRUCTS the insight — predict first, then manipulate, then see the outcome contradict the misconception (use buildIdea as the seed). E.g. "independent x/y motions" → sliders/toggles that run each component separately and combined. Do NOT just display the conclusion.
- Use covered nodes + figure visualSummary when present (e.g. VSEPR table → interactive AXE→geometry explorer).
- followUp must be short-answer verifying learning (for aha widgets: re-skinned context probing the insight).`
      : `设计有意义的 2D H5 学习交互。只输出 JSON——不要 html 字段。文案语言: ${lang}。
{"prompt":"给 HTML 小组件的详细生成提示(学生做什么、屏幕如何变化、步骤/数据)","interactionKind":"process"|"condition"|"matching"|"explore"|"predict","followUp":{"enabled":true,"type":"short","question":string,"answer":string,"explanation":string}}

硬性:真学习交互;善用 covers 与 figure visualSummary;followUp 必须是简答。
顿悟建构(若 ctx.ahaKeys 存在,尤其 mustInstall=true):以 buildIdea 为蓝本,让学生"先预测→再操作→看到结果打脸误解",自己把 insight 建构出来(如"x/y 分运动相互独立"→分量单独/合成运行的开关滑块);禁止直接把结论写在屏幕上。followUp 换情境考这个 insight。`,
    user: JSON.stringify(ctx, null, 1),
  });

  let followUp = plan.followUp ? createFollowUp({ ...plan.followUp, type: 'short', enabled: true }) : null;
  if (!followUp?.question) {
    const label = ctx.coveredNodes[0]?.label || section.title;
    followUp = createFollowUp({
      enabled: true,
      type: 'short',
      question: isEN()
        ? `After trying the interactive, explain in 1–2 sentences what you learned about “${label}”.`
        : `试用交互后，用 1–2 句话说明你对「${label}」新理解到了什么。`,
      answer: label,
      explanation: isEN()
        ? 'Mention the core idea the widget demonstrated.'
        : '点出小组件演示的核心概念。',
    });
  }

  const prompt = plan.prompt || section.purpose || section.title;
  let html = '';
  try {
    html = await generateH5HtmlBody(prompt, section, ctx);
    if (h5HtmlLooksBroken(html) || !h5LooksInteractive(html)) {
      // One retry — truncated / static flyer HTML is a common failure mode
      html = await generateH5HtmlBody(
        `${prompt}\n\nRETRY: previous HTML was incomplete or not interactive. Return a COMPLETE self-contained widget with at least one button/slider/select that changes the view.`,
        section,
        ctx,
      );
    }
  } catch (e) {
    // Compact fallback widget so the section still completes
    const nodes = (ctx.coveredNodes || []).slice(0, 6);
    const fig = (ctx.images || []).find(im => im.url);
    const figUrl = fig ? absolutizeMediaUrl(fig.url) : '';
    html = `<div style="font-family:system-ui,sans-serif;padding:16px;max-width:640px">
<h3 style="margin:0 0 8px">${section.title}</h3>
<p style="color:#444">${section.purpose || ''}</p>
${figUrl ? `<img src="${figUrl}" alt="" style="max-width:100%;border:1px solid #ddd;border-radius:8px;margin:8px 0" />` : ''}
<label style="display:block;margin:12px 0 6px;font-weight:600">${isEN() ? 'Pick a concept, then reveal a check tip' : '选择概念后查看提示'}</label>
<select id="h5-pick" style="width:100%;padding:8px">${nodes.map(n => `<option value="${n.id}">${n.label}</option>`).join('') || '<option>—</option>'}</select>
<button id="h5-go" type="button" style="margin-top:10px;padding:8px 14px">${isEN() ? 'Show tip' : '显示提示'}</button>
<pre id="h5-out" style="margin-top:12px;padding:10px;background:#f4f4f5;white-space:pre-wrap"></pre>
<script>
const nodes=${JSON.stringify(nodes.map(n => ({ id: n.id, label: n.label, mastery: n.mastery || '' })))};
document.getElementById('h5-go').onclick=()=>{
  const id=document.getElementById('h5-pick').value;
  const n=nodes.find(x=>x.id===id)||nodes[0];
  document.getElementById('h5-out').textContent=n?(n.mastery||n.label):'';
};
<\/script></div>`;
  }

  // Final safety: still broken → use the select/tip fallback
  if (h5HtmlLooksBroken(html) || !html.trim()) {
    const nodes = (ctx.coveredNodes || []).slice(0, 6);
    html = `<div style="font-family:system-ui,sans-serif;padding:16px"><h3>${section.title}</h3>
<select id="h5-pick">${nodes.map(n => `<option>${n.label}</option>`).join('') || '<option>—</option>'}</select>
<button id="h5-go" type="button">${isEN() ? 'Show tip' : '显示提示'}</button>
<pre id="h5-out"></pre>
<script>
const tips=${JSON.stringify(nodes.map(n => n.mastery || n.label))};
document.getElementById('h5-go').onclick=()=>{
  const i=document.getElementById('h5-pick').selectedIndex;
  document.getElementById('h5-out').textContent=tips[i]||'';
};
<\/script></div>`;
  }

  updateSection(section.id, {
    h5: {
      prompt,
      html: absolutizeH5Html(html),
      status: 'ready',
      followUp,
      interactionKind: plan.interactionKind || '',
    },
    buildStatus: 'done',
  });
}

/** Mini tool-loop for one VR/3D section — isolated scene snapshot per section. */
async function fillVrSection(section, ctx, ui) {
  beginVrSectionFill(section.id);
  const toolDefs = TOOLS.filter(t =>
    !['outline_add_chapter', 'outline_add_section', 'outline_remove_section'].includes(t.name)
    && !String(t.name).startsWith('course_')
  ).map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  const lang = isEN() ? 'English' : 'Chinese';
  const sys = isEN()
    ? `You are a section sub-agent filling ONE interactive 3D scene section (section id=${section.id}).
IMPORTANT: The live scene was CLEARED for this section only. Build ONLY this section's covered nodes. Do not assume objects from other sections exist.
Study mode: orbit 3D + click interactions (no VR player/locomotion).
AHA CONSTRUCTION (highest priority if [Aha keys] present): the scene's CENTERPIECE must let the student construct that insight through manipulation, not read it. Use buildIdea as the seed. Pattern: show the components/causes as SEPARATE animated/clickable objects, plus the combined result, with click-toggles to isolate each part (e.g. "motion decomposes into independent x/y" → an x-marker sliding at constant speed, a y-marker falling with gravity, and the combined projectile tracing its curve; clicking toggles each component so the student SEES independence). Set panel text to prompt prediction BEFORE the reveal. Decorations come after the aha centerpiece, never instead of it.
DISTINCTNESS (critical): this course has several 3D sections. Yours must teach ONLY its own covered nodes, with its own centerpiece, geometry, layout and interaction. If [Peer 3D scenes] is present, treat that object list as forbidden — do not rebuild the same objects, the same demo or the same arrangement, even if the concepts are related.
Prefer create_custom_object / add_panel / attach_label / set_behavior. Wide panels (no overlapping key|value text).
LANGUAGE LOCK (critical): Platform UI language is ${lang}. ALL student-facing 3D text MUST be in ${lang}.
PANEL LAYOUT: flanks (x≈±6) or behind (z≈−5..−7); ≤2 free panels; no stacking in front of the diorama.
Quiz: use add_quiz_panel once — it is ONE vertical card (question on top, options listed below). Place it on a flank HIGH (y≈5) so the tall card does not sink into the ground. If an aha key applies, the quiz must probe it in a re-skinned context.
SNAPSHOT-SAFE GEOMETRY (critical): every section is saved and reloaded through THREE.ObjectLoader. In create_custom_object code use only core parametric geometries (Box/Sphere/Cylinder/Cone/Torus/TorusKnot/Plane/Circle/Ring/Capsule/Lathe/Extrude/Tube/Icosahedron…) or a hand-built BufferGeometry. NEVER use EdgesGeometry / WireframeGeometry / TextGeometry / example-only loaders — they cannot be reloaded and the section comes back empty. For outlines set material.wireframe = true instead.
HARD: You MUST call tools to create visible objects. An empty scene (only the student avatar) is a FAILURE. At least 2 teaching objects + 1 panel.
When done, stop with a short summary. Max ~10 tool calls.`
    : `你是小节子 Agent,只负责填充本节(id=${section.id})的交互 3D 场景。
重要:现场景已为本节清空。只建本节 covers 节点,不要假设其他节的对象还在。
差异化(硬性):本课程有多个 3D 小节。你只讲本节 covers,主角对象、几何、布局、交互都必须与其他节不同。若出现 [Peer 3D scenes],其中列出的对象一律禁止重建,不得复制同一个演示或同一种摆法,哪怕概念相关。
试学模式:轨道相机 3D + 点击交互。
顿悟建构(若有 [Aha keys],这是最高优先级):场景主角必须让学生通过"操作"自己建构出 insight,而不是读结论。以 buildIdea 为蓝本,套路:把成因/分量做成可独立动画、可点击的对象 + 合成结果,点击可单独开关(如"运动可分解为独立的 x/y 分运动"→ 匀速滑动的 x 标记、自由下落的 y 标记、再加合成的抛体划出曲线;点击开关各分量,学生亲眼看到互不影响)。面板文案先让学生"预测",再揭示。装饰物永远排在顿悟主角之后。
优先 create_custom_object / add_panel / attach_label / set_behavior。
语言锁定:全部学生可见 3D 文案用 ${lang}。
面板放侧面/后方,最多 1–2 块自由面板。
测验用 add_quiz_panel一次即可(单卡竖排:题干在上、选项列表在下),放侧面且挂高(y≈5),避免竖卡沉入地面;若涉及 aha key,题目必须换情境考察该 insight。
快照安全(硬性):每节场景要经 THREE.ObjectLoader 存取还原。create_custom_object 里只能用核心参数化几何(Box/Sphere/Cylinder/Cone/Torus/TorusKnot/Plane/Circle/Ring/Capsule/Lathe/Extrude/Tube/Icosahedron…)或手写 BufferGeometry;禁止 EdgesGeometry / WireframeGeometry / TextGeometry / examples 里的加载器——它们无法还原,会导致本节重新打开时变成空场景。要描边就用 material.wireframe = true。
硬性:必须调用工具创建可见对象。空场景(只剩学生代表物)视为失败。至少 2 个教学对象 + 1 块面板。
完成后给简短总结。最多约 10 次工具调用。`;

  const ahaBlock = ctx.ahaKeys?.length
    ? `\n[Aha keys — the insights this scene must let the student CONSTRUCT]\n${JSON.stringify(ctx.ahaKeys)}\n`
    : '';
  const peers = peerVrScenes(section.id);
  const peerVrBlock = peers.length
    ? `\n[Peer 3D scenes — already built, FORBIDDEN to repeat]\n${JSON.stringify(peers)}\n`
    : '';
  const boardBlock = ctx.peerBoard?.length
    ? `\n[Sections already filled in this course]\n${JSON.stringify(ctx.peerBoard)}\n`
    : '';
  const brief = `${ctx.kgDigest}\n\n[Section brief]\n${JSON.stringify(ctx.section)}\n[Covered nodes]\n${JSON.stringify(ctx.coveredNodes)}${ahaBlock}${peerVrBlock}${boardBlock}[Figures]\n${JSON.stringify(ctx.images)}\n[Source slice]\n${ctx.markdownSlice}\n\nBuild THIS section's 3D scene from an empty stage. Every on-scene string must be in ${lang}.`;

  await runVrToolLoop({ section, ui, sys, toolDefs, userContent: brief });

  // Empty scene is a known failure (model exits text-only, or a sync wipe). Retry once, then seed.
  if (countTeachingObjects() === 0) {
    ui?.addMsg?.('ai', L(
      `⚠ 「${section.title}」3D 场景为空,正在重试…`,
      `⚠ 3D scene for “${section.title}” was empty — retrying…`
    ));
    beginVrSectionFill(section.id);
    await runVrToolLoop({
      section,
      ui,
      sys,
      toolDefs,
      userContent: `${brief}\n\nCRITICAL RETRY: the previous attempt left the scene EMPTY (zero teaching objects). You MUST call create_custom_object / add_panel / add_asset NOW. Do not reply with text only.`,
      maxIters: 8,
    });
  }
  if (countTeachingObjects() === 0) {
    await seedMinimalVrFallback(section, ctx, ui);
  }

  finishVrSectionFill(
    section.id,
    L('本节 3D 场景已由子 Agent 生成(独立快照)', '3D scene for this section generated (isolated snapshot)')
  );

  // Post-condition: saved snapshot must contain teaching objects (not only the student rig)
  const saved = findSection(section.id)?.section?.vr?.scene;
  const savedKids = saved?.object?.children?.length || 0;
  if (countTeachingObjects() === 0 || savedKids <= 1) {
    beginVrSectionFill(section.id);
    await seedMinimalVrFallback(section, ctx, ui);
    finishVrSectionFill(
      section.id,
      L('本节 3D 场景已补种最小内容(生成结果为空)', '3D section re-seeded (previous snapshot was empty)')
    );
    return;
  }

  // A snapshot ObjectLoader cannot read back looks perfect while building and
  // empty the moment the teacher reopens the section — rebuild it now.
  const fragile = unrestorableSnapshotObjects(findSection(section.id)?.section?.vr?.scene);
  if (fragile.length) {
    ui?.addMsg?.('ai', L(
      `⚠ 「${section.title}」有 ${fragile.length} 个对象无法存档还原,正在用可保存的几何重建…`,
      `⚠ ${fragile.length} object(s) in “${section.title}” cannot survive saving — rebuilding with storable geometry…`
    ));
    beginVrSectionFill(section.id);
    await runVrToolLoop({
      section,
      ui,
      sys,
      toolDefs,
      userContent: `${brief}\n\nCRITICAL REBUILD: these objects could not be saved and reloaded: ${JSON.stringify(fragile)}. They almost certainly used EdgesGeometry / WireframeGeometry / TextGeometry or another type THREE.ObjectLoader cannot parse. Rebuild the whole scene using ONLY core parametric geometries or hand-built BufferGeometry, and use material.wireframe = true for outlines.`,
      maxIters: 8,
    });
    if (countTeachingObjects() === 0) await seedMinimalVrFallback(section, ctx, ui);
    finishVrSectionFill(
      section.id,
      L('本节 3D 场景已用可存档几何重建', '3D scene rebuilt with storable geometry')
    );
  }

  // Distinctness: an identical object set to another 3D section is a failed build
  const twin = findDuplicateVrSection(
    section.id,
    vrSceneSignature(findSection(section.id)?.section?.vr?.scene)
  );
  if (twin) {
    ui?.addMsg?.('ai', L(
      `⚠ 「${section.title}」与「${twin.title}」场景重复,正在重建…`,
      `⚠ “${section.title}” duplicated “${twin.title}” — rebuilding a distinct scene…`
    ));
    const twinObjects = vrSceneObjectNames(twin.vr?.scene).slice(0, 10);
    beginVrSectionFill(section.id);
    await runVrToolLoop({
      section,
      ui,
      sys,
      toolDefs,
      userContent: `${brief}\n\nCRITICAL REBUILD: your previous attempt produced a scene IDENTICAL to the section "${twin.title}" (objects: ${JSON.stringify(twinObjects)}). Those objects are BANNED. Build a different centerpiece with different geometry, a different interaction and a different layout, teaching only THIS section's covered nodes.`,
      maxIters: 8,
    });
    if (countTeachingObjects() === 0) await seedMinimalVrFallback(section, ctx, ui);
    finishVrSectionFill(
      section.id,
      L('本节 3D 场景已重建(避免与其他小节重复)', '3D scene rebuilt to stay distinct from other sections')
    );
  }
}

async function runVrToolLoop({ section, ui, sys, toolDefs, userContent, maxIters = 10 }) {
  const messages = [{ role: 'user', content: userContent }];
  for (let i = 0; i < maxIters; i++) {
    const res = await callClaude({
      model: agent.model,
      system: sys,
      messages,
      tools: toolDefs,
      maxTokens: 8192,
      effort: 'medium',
    });
    const blocks = res.content || [];
    const toolUses = blocks.filter(b => b.type === 'tool_use');
    const texts = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (!toolUses.length) {
      if (texts && ui?.addMsg) ui.addMsg('ai', texts.slice(0, 500));
      break;
    }
    messages.push({ role: 'assistant', content: blocks });
    const results = [];
    for (const tu of toolUses) {
      const card = ui?.addToolCard?.(toolCallLabel(tu.name, tu.input) || tu.name, true);
      let msg = '';
      let ok = false;
      try {
        ensureVrFillSceneBound(section.id);
        const out = await execTool(tu.name, tu.input || {});
        ok = !!out?.ok;
        msg = out?.msg || (ok ? 'ok' : 'fail');
        restoreViewerAfterVrFillTool(section.id);
        ui?.finishToolCard?.(card, msg, ok);
      } catch (e) {
        msg = e.message || String(e);
        try { restoreViewerAfterVrFillTool(section.id); } catch { /* ignore */ }
        ui?.finishToolCard?.(card, msg, false);
      }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: msg });
    }
    messages.push({ role: 'user', content: results });
  }
}

/** Last-resort: never leave a VR section completely empty. */
async function seedMinimalVrFallback(section, ctx, ui) {
  ensureVrFillSceneBound(section.id);
  const label = ctx.coveredNodes?.[0]?.label || section.title;
  const body = isEN()
    ? `Key idea: ${label}\n${section.purpose || ''}\n(Auto-seeded because the 3D builder returned an empty scene.)`
    : `要点: ${label}\n${section.purpose || ''}\n(因 3D 生成结果为空而自动补种。)`;
  // Vary shape/colour by section so two fallbacks never look like the same scene
  const SHAPES = [
    'new THREE.BoxGeometry(1.2, 1.2, 1.2)',
    'new THREE.IcosahedronGeometry(0.8, 0)',
    'new THREE.TorusGeometry(0.7, 0.26, 16, 40)',
    'new THREE.ConeGeometry(0.8, 1.4, 24)',
    'new THREE.CylinderGeometry(0.6, 0.6, 1.4, 24)',
  ];
  const COLORS = [0x4a9eff, 0xff9f43, 0x4ecb71, 0xc084fc, 0xf25f5c];
  let h = 0;
  for (const ch of String(section.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const geo = SHAPES[h % SHAPES.length];
  const color = COLORS[h % COLORS.length];
  try {
    await execTool('create_custom_object', {
      name: label.slice(0, 40) || 'Concept',
      icon: '📦',
      code: `const g = ${geo};
const m = new THREE.MeshStandardMaterial({ color: ${color}, roughness: 0.45, metalness: 0.1 });
const mesh = new THREE.Mesh(g, m);
mesh.position.set(0, 1.2, 0);
return mesh;`,
      x: 0, y: 0, z: 0,
    });
  } catch (e) { console.warn('[vr-fallback] object', e); }
  try {
    await execTool('add_panel', {
      title: section.title,
      lines: body.split('\n').filter(Boolean).slice(0, 8),
      x: -5.5, y: 2.2, z: 0,
      width: 3.2,
      role: 'info',
    });
  } catch (e) { console.warn('[vr-fallback] panel', e); }
  restoreViewerAfterVrFillTool(section.id);
  ui?.addMsg?.('ai', L(
    `已为「${section.title}」补种最小 3D 内容(生成结果曾为空)`,
    `Seeded a minimal 3D scene for “${section.title}” (builder returned empty)`
  ));
}

/**
 * Fill one outline section by id (reading / h5 / quiz / vr).
 * Used by course_* tools so weaker LLMs can delegate content generation.
 */
export async function fillSectionById(sectionId, ui = null) {
  const doc = getUploadedDoc();
  if (!doc?.markdown) {
    throw new Error(L('请先上传教学材料', 'Upload teaching material first'));
  }
  const hit = findSection(sectionId);
  if (!hit) throw new Error(L(`找不到小节 ${sectionId}`, `Section not found: ${sectionId}`));
  const kg = state.knowledgeGraph || emptyKnowledgeGraph({});
  await fillSection(hit.section, doc, kg, ui, { activate: true });
  return hit.section;
}

/**
 * Full pipeline entry — replaces legacy single-turn "Build from this".
 * @param {{ ui?: object, doc?: object }} opts  pass a snapshot `doc` to freeze source material for this run
 */
export async function runCoursePipeline({ ui, doc: docArg } = {}) {
  if (state.coursePipelineBusy || agent.busy) {
    throw new Error(L('流水线或 Agent 正忙', 'Pipeline or agent is busy'));
  }
  // Freeze the teaching source for this run — ignore later uploads / clears
  const doc = snapshotUploadedDoc(docArg || getUploadedDoc());
  if (!doc?.markdown) throw new Error(L('请先上传教学材料', 'Upload teaching material first'));
  if (!doc.jobId) throw new Error(L('材料缺少 jobId,请重新上传', 'Document missing jobId — please re-upload'));

  // Pipeline must not inherit prior Ask/Agent turns about another PDF
  agent.history = [];
  agent.currentSkills = [];
  state.activeDocJobId = doc.jobId;

  state.coursePipelineBusy = true;
  agent.busy = true;
  emit('agent-turn-start');
  emit('course-pipeline-start', { filename: doc.filename, jobId: doc.jobId });

  try {
    assertPipelineDocStillBound(doc);
    stage(ui, L('① 标注插图用途', '① Tag figure purposes'), `${doc.filename} · ${doc.jobId}`, 1, 4);
    await enrichDocImages(doc);
    // Mirror enrichments onto the live upload slot only if it is still the same job
    const live = getUploadedDoc();
    if (live && live.jobId === doc.jobId) {
      live.images = doc.images;
      if (doc.imageFilterNote) live.imageFilterNote = doc.imageFilterNote;
    }
    emit('course-pipeline-images', doc.images);
    if (doc.imageFilterNote) {
      ui?.addMsg?.('ai', doc.imageFilterNote);
    }

    assertPipelineDocStillBound(doc);
    stage(ui, L('② 抽取知识图谱 / 思维导图', '② Extract knowledge graph / mind map'), doc.jobId, 2, 4);
    const plan = await extractKgAndOutlinePlan(doc);

    stage(ui, L('③ 生成学习大纲', '③ Build learning outline'), '', 3, 4);
    const { kg, outline } = applyKgAndOutline(plan, doc);
    ui?.addMsg?.('ai', L(
      `已根据材料生成知识图谱(<b>${kg.nodes.length}</b> 个知识点,<b>${kg.edges.length}</b> 条学习边)与学习大纲(<b>${outline.chapters.reduce((n, c) => n + c.sections.length, 0)}</b> 小节)。开始按节填充…`,
      `Built a knowledge graph (<b>${kg.nodes.length}</b> nodes, <b>${kg.edges.length}</b> edges) and learning outline (<b>${outline.chapters.reduce((n, c) => n + c.sections.length, 0)}</b> sections). Filling section by section…`
    ));

    // Clear demo solar system once before first VR fill
    const hasVr = outline.chapters.some(c => c.sections.some(s => s.type === 'vr'));
    if (hasVr) {
      clearScene(false);
      ensureStudentRig();
    }

    stage(ui, L('④ 分节子 Agent 填充内容', '④ Section sub-agents fill content'), '', 4, 4);
    const sections = outline.chapters.flatMap(c => c.sections);
    const board = createSectionBoard();
    const nonVr = sections.filter(s => s.type !== 'vr');
    const vrSecs = sections.filter(s => s.type === 'vr');
    const PARA = Math.min(3, Math.max(1, nonVr.length));

    emit('course-pipeline-fill-plan', {
      total: sections.length,
      parallel: nonVr.length,
      sequentialVr: vrSecs.length,
      concurrency: PARA,
    });

    ui?.addMsg?.('ai', L(
      `并行填充 <b>${nonVr.length}</b> 个非 3D 小节(并发 ${PARA});随后串行填充 <b>${vrSecs.length}</b> 个 3D 小节(共享视口,互斥)。`,
      `Filling <b>${nonVr.length}</b> non-3D sections in parallel (concurrency ${PARA}); then <b>${vrSecs.length}</b> 3D sections sequentially (shared viewport mutex).`
    ));

    // Wave 1: reading / h5 / quiz — safe to parallel (outline writes only; covers[] already partitioned)
    await mapPool(nonVr, PARA, async (sec) => {
      try {
        await fillSection(sec, doc, kg, ui, { board, activate: false });
      } catch (e) {
        ui?.addMsg?.('ai', L(
          `⚠ 小节「${sec.title}」失败: ${e.message}`,
          `⚠ Section "${sec.title}" failed: ${e.message}`
        ));
      }
    });

    // Wave 2: VR — must be serial (one live Three.js graph)
    for (const sec of vrSecs) {
      try {
        await fillSection(sec, doc, kg, ui, { board, activate: false });
      } catch (e) {
        ui?.addMsg?.('ai', L(
          `⚠ 小节「${sec.title}」失败: ${e.message}`,
          `⚠ Section "${sec.title}" failed: ${e.message}`
        ));
      }
    }

    emit('agent-progress-end');
    ui?._pipeTyping?.remove?.();
    const first = getOutline().chapters[0]?.sections[0];
    if (first) setActiveSection(first.id);
    ui?.addMsg?.('ai', L(
      `课程流水线完成。请在 <b>学习大纲</b> 中点开各节查看;带 ✓ 的节已可预览。`,
      `Course pipeline finished. Open sections in the <b>Outline</b> tab; ✓ means ready to preview.`
    ));
    emit('course-pipeline-done', { outline: getOutline(), kg });
  } catch (e) {
    emit('agent-progress-end');
    ui?._pipeTyping?.remove?.();
    emit('course-pipeline-error', { error: e.message });
    throw e;
  } finally {
    state.coursePipelineBusy = false;
    agent.busy = false;
    ui?._pipeTyping?.remove?.();
    ensureOutline();
  }
}
