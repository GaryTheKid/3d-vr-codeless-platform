# 02 · Outline Generation Pipeline — material → Aha Keys → KG → Outline → fan-out fill

> Feature: 「据此备课 / Build from this」turns an uploaded document into a complete
> course: knowledge graph + chaptered outline + every section filled.
> This is the pedagogical heart of the product.
> Portable deep-dive of the aha/KG contract: `/assets-recyclable/aha-keys-and-knowledge-graph.md`.

## Code map

| Piece | Path |
|-------|------|
| Whole pipeline (`runCoursePipeline` + all fill*) | `xr-edu-agent/js/agent/course-pipeline.js` |
| KG store / schema / digest | `xr-edu-agent/js/core/knowledge-graph.js` |
| Outline model (chapters/sections/buildStatus) | `xr-edu-agent/js/core/outline.js` |
| Agent tool wrappers (`course_*`) | `xr-edu-agent/js/agent/tools/course-pipeline-tools.js` |
| Guiding skills | `xr-edu-agent/js/agent/skills/course-pipeline.js`, `course-outline.js` |
| UI entry | `xr-edu-agent/js/ui/chat.js` (「据此备课」→ `runCoursePipeline({ui, doc})`) |

## Stages (numbers match `runCoursePipeline`)

```
① enrichDocImages        figure tags (doc 01)
② extractKgAndOutlinePlan   ★ ONE Claude JSON call: STEP-0 ahaKeys → nodes/edges → chapters
③ applyKgAndOutline         normalize + store KG + build outline + install fallbacks
④ fillSection × N           per-section sub-agents
     Wave 1: reading / h5 / quiz — parallel (mapPool ≤3)
     Wave 2: vr — strictly SERIAL (one live scene; see doc 04)
```

### ② The planning call (`extractKgAndOutlinePlan`)

- Input: first 18k chars of markdown + pedagogical figures (id/relevance/purpose/
  visualSummary/nearHeading) + UI language + study flags + SOURCE LOCK (jobId+filename).
- System prompt structure: **STEP-0 aha keys first** ("2–5 transferable insights"),
  then nodes/edges (must include prerequisites an aha depends on; must extract nodes
  from core figures' visualSummary), then chapters/sections with `covers[]` +
  `installsAha[]` + modality pick by spatiality (vr only for intrinsically spatial).
- Output JSON: `{ courseTitle, courseGoal, level, anchorExample, ahaKeys[], nodes[],
  edges[], chapters[{sections[{title,type,purpose,role,covers,installsAha,sourceHint,figureIds}]}] }`.
- Runs through `llmJSON` (retry ×3 with growing budget; `extractJSON` strips fences →
  brace-scan → truncated-JSON repair).

### ③ Bind & guard (`applyKgAndOutline`)

1. `emptyKnowledgeGraph(plan)` normalizes (empty-insight ahas dropped; dirty ids filtered).
2. `setKnowledgeGraph(kg)` → `state.knowledgeGraph`, persisted in `cfg.knowledgeGraph`.
3. Outline built via `createChapter/createSection`; `installsAha` filtered to real aha ids.
4. **Orphan-aha fallback**: unassigned aha → best vr/h5 sharing nodeIds → any reading → first section.
5. **Course minimum**: ≥1 reading and ≥1 quiz are guaranteed (inserted if missing).
6. `setOutline(outline)`; emits `course-pipeline-outline-ready`.

### ④ Section fill (`fillSection` → per-type fillers)

Each filler receives `sectionContext(section, doc, kg, board)`:

```js
{
  source: { jobId, filename, note },          // SOURCE LOCK
  section: { id,title,type,purpose,role,sourceHint,covers,figureIds,installsAha },
  coveredNodes,                                // resolved KG nodes with mastery
  ahaKeys,                                     // ≤4, each with mustInstall flag
  kgDigest,                                    // compact text digest
  peerBoard,                                   // beats claimed by already-filled sections
  images,                                      // ≤6 matched pedagogical figures
  markdown slice                               // per-section window, not always the first 18k
}
```

Fillers (details: doc 03 for reading/h5/quiz, doc 04 for vr) mark
`buildStatus: 'done' | 'error'` per section — this drives the outline's colored
rings and the Start-Learning gate (`isCourseBuildComplete`).

## Status & UI wiring

- Section rings: pending / spinning / green ✓ / red error (`outline.js` render + `style.css`).
- VR build-status updates are **silent** (`{silent:true}`) — a non-silent outline event
  mid-fill once re-synced the live scene and wiped in-progress builds (see doc 04).
- `ensureDocCourseMinimum` also runs after ordinary agent turns (safety net; seeded
  sections are stamped `done` so they don't block the green gate).

## Agent-tool path (what a chat model uses instead of the UI button)

```
course_tag_figures → course_build_outline_from_doc → outline_get → course_fill_section(id) per section
```

Guided by the `course-pipeline` / `course-outline` skills, which explicitly tell
weaker models to call these deterministic tools rather than hand-writing outline JSON.
`course_build_outline_from_doc` overwrites the existing tree — its description warns
to confirm with the teacher first.

## Invariants to preserve when changing this pipeline

1. STEP-0 order (aha → KG → outline) — reversing it regresses to content dumping.
2. Every `covers[]` id ∈ nodes; every `installsAha[]` id ∈ ahaKeys; every aha installed ≥1×.
3. SOURCE LOCK text in the planning user message (prevents cross-PDF bleed).
4. ≥1 reading + ≥1 quiz per course.
5. VR fills stay serial; reading/h5/quiz may parallelize (outline-writes only).
6. All teacher-facing strings follow **UI language**, not material language.
