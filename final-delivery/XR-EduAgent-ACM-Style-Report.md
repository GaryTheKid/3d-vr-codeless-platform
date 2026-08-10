# XR EduAgent: An Aha-First Multimodal Course Authoring Agent for Non-Programmer Teachers

> **Document type.** ACM-style *course project report* (not a formal ACM submission).  
> **Audience for this file.** A writing agent (or human) who must produce a polished paper / presentation narrative **without reading the codebase**, without missing system details, and with enough pedagogy + engineering history to tell a progress story.  
> **Sources consolidated.** `/general/**`, `/assets-recyclable/**`, `/experiment-study/**`, `/logs/**`, plus a structure skim of `xr-edu-agent/`, `server.py`, `pre-built-samples/`.  
> **Study status.** Preliminary usability study **N = 6 (complete)**. Detailed scores, TLX/Likert, and interview coding live in [`N6-Study-Analysis.md`](./N6-Study-Analysis.md) — **prefer that file for Results numbers** (this report’s §6–7 still contain an older n=3 snapshot).

---

## How to use this file (writing agent instructions)

Produce a paper that follows a conventional ACM IMWUT / CHI / L@S-like skeleton:

1. **Abstract**
2. **Introduction**
3. **Related Work**
4. **System Design** (include development progress / failure stories — this is a course project, progress matters)
5. **Study Design**
6. **Results**
7. **Analysis / Discussion**
8. **Limitations & Future Work**
9. **Conclusion / Summary**

Tone: technical but readable; honest about early failures; do **not** over-claim statistical significance with n=3. Prefer concrete contracts (`covers[]`, `installsAha[]`, `buildStatus`) over vague “AI generates a course.” Live demo URL: `https://garythekid.github.io/3d-vr-codeless-platform/`. Repo workspace: `GaryTheKid/Demo`.

Canonical paths when citing artifacts:

| Artifact | Path |
|----------|------|
| Agent master guide | `/Agent.md` |
| Engineering docs | `/general/` |
| Design lessons | `/assets-recyclable/` |
| Study protocol + data | `/experiment-study/` |
| App code | `/xr-edu-agent/js/` |
| Sample courses | `/pre-built-samples/` |
| Local server | `/server.py`, `/services/docling_service.py` |
| Dev logs | `/logs/*.jsonl` |

---

## Abstract (draft)

Teachers without coding skills still struggle to turn a PDF into an interactive multimodal lesson. Large language models make it easy to rewrite source text into polished slides—but that often produces a “PPT machine”: content dumping without transferable insight. We present **XR EduAgent**, a no-build browser platform where a teacher uploads teaching material (or opens a sample course) and an agent compiles a **Learning Outline** of reading, 2D H5 interactives, quizzes, and 3D/VR scenes. The pipeline is **aha-first**: it distills 2–5 transferable insights (“aha keys”), builds a machine-checkable knowledge graph, then fills sections under install contracts (`covers[]`, `installsAha[]`) with a scaffold → construct → transfer pedagogy. Teachers refine via chat tools, Unity-like direct manipulation, and natural-language component cards on 3D objects; learners study with a Socratic companion. We report the system architecture (20 skills, 40 tools, serial VR fills, `.xrcourse` persistence) and a preliminary remote usability study (**n = 3 of ≤6 planned**) using five domain sample courses. Participants showed large pre→post MCQ gains on blank-baseline quizzes, high satisfaction (S1–S3 mean ≈ 6.6/7), and qualitative themes that 3D/quiz help learning while reading sections feel thin and 3D fidelity still needs trust. We also document development failures (thinking-token truncation, multi-section scene races, GitHub Pages figure portability) as engineering lessons.

**Keywords.** Learning agents; course generation; knowledge graphs; XR education; human–AI co-authoring; usability study.

---

## 1. Introduction

### 1.1 Problem

Authoring interactive educational experiences—especially those involving 3D/VR—normally requires specialist tools and programming. Generative AI lowers the barrier to producing *text and images*, but default LLM behavior for “make a course from this PDF” is to **repackage information**: tidy sections, bullet lists, and decorative visuals that do not force students through misconception confrontation or transfer. Early demos in this project looked impressive (e.g., a solar-system scene) yet “did not pedagogically make sense”—the inciting incident that reframed the product from *Cursor for VR scenes* into *an agent that installs transferable keys*.

### 1.2 Goal

Build a browser platform for **teachers with zero coding background** that:

1. **Authors** a multimodal course from teaching PDFs (or chat), grounded in pedagogical structure—not page order.
2. **Refines** via natural language + direct manipulation + NL inspection of 3D object capabilities.
3. **Delivers** a learner experience with reading / H5 / quiz / 3D sections and an AI learning companion.

### 1.3 Contributions (course-project scale)

1. **Aha-first course compilation pipeline** — STEP-0 aha keys → knowledge graph → outline with install contracts → modality-matched section fill (reading / H5 / quiz parallel; VR serial).
2. **Agent architecture for weak-model reliability** — Planner → confirm → Executor with progressive skill disclosure (20 skills), thick tool descriptions (40 tools), thinking-budget governance, context lock, and structural refusals (`requested_by_teacher`).
3. **One-live-scene VR isolation model** — per-section snapshots (`section.vr.scene`), ownership stamps, empty-overwrite guards, content-signature dedup, SNAPSHOT-SAFE geometry rules.
4. **Dual-track 3D creation** — sandboxed Three.js code for creative objects + deterministic parametric builders for rooms/stairs/paths/panels where correctness matters.
5. **Preliminary usability evidence** — remote study protocol, five subject packs, instruments (pre/post, NASA-TLX, Likert, interview), and **n = 3** completed sessions (target ≤6).
6. **Operational lessons** — from silent truncation and scene races to GitHub Pages figure embedding (`embed_sample_images.py` / `sample-asset:` tokens).

### 1.4 Thesis sentence (use near end of intro)

> LLMs default to PPT machines; excellent teaching installs keys. XR EduAgent turns that difference into **enforceable data contracts** (aha / KG / install) and **engineering contracts** (deterministic tools / isolation / budgets)—neither relying on model goodwill alone.

---

## 2. Related Work (framing for the writing agent)

This is a course report—cite lightly and honestly. Suggested clusters (fill real citations when polishing):

1. **Intelligent tutoring / authoring systems** — classical ITS and teacher authoring tools; contrast: we generate *full multimodal outlines* from documents, not only adaptive quizzes.
2. **LLM agents & tool use** — ReAct-style tool loops, Anthropic skills / progressive disclosure; we adopt skill routing + tool manuals as belt-and-suspenders for weaker models.
3. **Generative 3D / XR authoring** — text-to-scene and code-gen for Three.js/Unity; we claim a HCI-adjacent piece: **NL Inspector** (select object → natural-language capability cards) vs code-level editing only.
4. **Learning sciences** — constructionism; misconception-driven design; transfer; multimedia modality principles. Our spatiality gate: VR only when the concept has intrinsic spatial structure.
5. **Document understanding for education** — PDF→structure pipelines; we use Docling locally and treat pedagogical figures as first-class syllabus sources via `visualSummary`.

**Positioning sentence.** Prior systems either excel at *chat-to-scene spectacle* or at *text course generation*; XR EduAgent targets the gap: **document-grounded, graph-checked, multi-modal courses** with teacher-in-the-loop refinement and a learn-mode companion.

---

## 3. Pedagogical & HCI Foundations

### 3.1 Excellent teacher vs PPT machine

| Dimension | PPT machine | Excellent teacher | Encoded as |
|-----------|-------------|-------------------|------------|
| Prep start | Page-order slides | 2–5 must-get insights | STEP-0 `ahaKeys` |
| Structure | Linear facts | Mental graph + breakpoints | KG `nodes`/`edges` + `covers[]` |
| Misconceptions | Ignored | Anticipated | `misconception` + quiz distractors |
| Abstraction | Write the conclusion | Student operates it out | `buildIdea` + Construct rules |
| Examples | New every slide | One running example | `anchorExample` |
| Figures | Decoration | Densest knowledge | Figure grounding |
| Assessment | Reskin numbers | Reskin story | Transfer quiz rules |
| Modality | Whatever is handy | Cognitive need | Spatiality gate |
| Completeness | Talk until done | Closed loop | ≥1 reading + ≥1 quiz; every aha installed |

### 3.2 Aha keys (schema)

Each course distills **2–5** aha keys:

```text
AhaKey = {
  id, insight,           // short, student-rehearsable
  misconception?,        // wrong intuition replaced
  whyKey?,               // why it unlocks re-skinned problems
  buildIdea?,            // manipulable experience to construct it
  nodeIds?               // optional links into KG
}
```

### 3.3 Knowledge graph as hard mid-anchor

```text
md + figures  →  KG {nodes, edges, ahaKeys, anchorExample, level}
              →  Outline {chapters[].sections[] with covers[], installsAha[]}
              →  Section fill
```

Programmatic rules (not trust):

- every `covers[]` id ∈ nodes;
- teaching order respects prerequisite edges;
- quizzes only probe taught nodes (“never use a concept never taught”);
- every aha appears in ≥1 `installsAha[]` (orphan-aha fallback assigns to best interactive section);
- core figures’ `visualSummary` must contribute nodes.

### 3.4 Scaffold → Construct → Transfer

| Stage | Section types | Rule |
|-------|---------------|------|
| Scaffold | `reading` | Name misconception → contrast → insight in student language |
| Construct | `h5` / `vr` | Predict → act → observe outcome that contradicts misconception → articulate; **never only display the conclusion** |
| Transfer | `quiz` | ≥1 item per aha in a new surface story; distractors embody the misconception |

### 3.5 Spatiality / modality economics

VR is the **costliest** modality—use only when the concept has intrinsic 3D structure/dynamics (molecular geometry, terrain, projectile paths, gear meshes). 2D parameter exploration → H5; prose → reading; mastery check → quiz. Decorative 3D is treated as a defect.

### 3.6 HCI principles baked into the agent

- **Teacher-in-control** — plan confirmation; streaming thinking; NL Inspector cards on selected 3D objects.
- **Selection = context** — multi-select pins into chat context; no separate “attach” ritual.
- **Non-destructive controls** — one toggle changes one semantic field (e.g. `anim.selfSpin`, never wholesale replace `anim`).
- **Platform owns feedback; content owns results** — hover/click flash is runtime; post-interaction outcomes are content code; semantic events `activate/grab/drag/release`.
- **Determinism by error cost** — creative objects via sandbox `T`; rooms/stairs/paths/quiz panels via parametric builders.
- **Bilingual by construction** — `t()` / `L(zh,en)`; **generated content language follows UI language**, not material language.

---

## 4. System Design

### 4.1 High-level architecture

```
PDF/Word ──Docling (local)──► markdown + figures
                               │  figure tagging (heuristics + vision LLM)
                               ▼
            ★ Planning call: Aha Keys → Knowledge Graph → Outline
                               │  covers[] / installsAha[] contracts
                               ▼
     Fan-out fill:  reading | h5 | quiz  (parallel, concurrency ≤ 3)
                    vr (SERIAL — one live scene graph)
                               ▼
     Outline green rings ──all done──► ▶ Start Learning
                               ▼
     Learn mode: learner views + Socratic companion + graded questions
                               ▼
     Persist: .xrcourse · samples · optional HTML 3D player export
```

**Stack.** No build step. React 18.3.1 (CDN + HTM) shell + native ES modules + Three.js 0.160 + Claude via local/AStone proxy. Python `server.py` adds Docling conversion, LLM/image proxies, and JSONL logging. Deploys to GitHub Pages as static assets; Docling / Anthropic-direct / gpt-image require the local server.

**Module map (`xr-edu-agent/js/`):**

| Layer | Modules |
|-------|---------|
| Agent brain | `agent/orchestrator.js`, `llm.js`, `context.js`, `logger.js` |
| Skills & tools | `agent/skills/*` (20), `agent/tools/*` (40), `agent-map.js` |
| Course pipeline | `agent/course-pipeline.js`, `core/knowledge-graph.js`, `core/outline.js` |
| Material ingest | `agent/doc-context.js` + root `server.py`, `services/docling_service.py` |
| 3D runtime | `core/three-setup.js`, `core/section-scene.js`, `scene/*`, `panels/panel3d.js`, `agent/sandbox.js`, `assets/*` |
| Learn mode | `ui/learn-mode.js`, `ui/learner-quiz.js`, companion branch in orchestrator |
| Persistence | `core/projects.js`, `project-fs.js`, `samples.js`, `sample-assets.js`, `export/exporter.js` |
| UI shell | `ui/react-app.js`, chat/outline/viewport/library/projects/kg-viewer/settings |

### 4.2 Core data model (`.xrcourse`)

```js
{
  magic: 'XR-EDU-COURSE',  // legacy 'XR-EDU-SCENE' still imports
  version: 1,
  kind: 'course',
  name, exportedAt,
  scene,                   // live viewport convenience snapshot
  cfg: {
    locomotion: { mode, allowedRadius, turnMode },
    outline: {
      course: { title, goal },
      chapters: [{
        title,
        sections: [{
          id, title,
          type: 'vr' | 'reading' | 'h5' | 'quiz',
          purpose, role,
          covers: [nodeId],
          installsAha: [ahaId],
          buildStatus: 'idle' | 'building' | 'done' | 'error',
          // payloads:
          vr: { scene /*ObjectLoader JSON*/, camera },
          reading: { chunks: [{ id, title, html, imagePrompt?, followUp? }] },
          h5: { prompt, html, status, followUp?, interactionKind? },
          quiz: { items: [{ id, type:'mcq'|'short', question, options?, answer, explanation }] }
        }]
      }],
      progress,            // completedSectionIds exists but is dormant
      activeSectionId
    },
    knowledgeGraph: { nodes, edges, ahaKeys, anchorExample, level, … } | null
  }
}
```

Scene objects persist their contract in `userData`: `oid`, `assetId`, `builderCode`, `*Code` strings (recompiled; runtime functions never persist), `panelSpec` (JSON mirror of live panel), `vrSectionOwner`, `solid`, `anim` (incl. `selfSpin`), `behaviorDesc` (retrieval index), `quiz`, system/studentRig flags.

### 4.3 Material processing (Docling)

**Local-only path** (GitHub Pages cannot convert uploads):

```
📎 upload → base64 → POST /__doc/convert
  → validate (ext, size ≤ 40MB)
  → jobId = YYYYMMDD-HHMMSS-<8hex>
  → Docling → markdown + images under uploads/<jobId>/
  → client uploadedDoc { jobId, filename, markdown, images[], charCount }
  → enrichDocImages → 「据此备课」 / course pipeline
```

**Figure tagging.** Heuristic noise filter (logos, tiny/thin) → vision LLM on up to ~5 largest → `relevance ∈ {core, supporting, decorative, noise}`; pedagogical = core|supporting. Planner must extract KG nodes from core figures’ `visualSummary`.

**SOURCE LOCK.** Planning and fill prompts include `jobId` + `filename` so mid-run uploads cannot silently retarget the course.

**Server endpoints (local):** static files; `/__doc/convert`; `/__llm/{sonnet|opus|fable5|messages}`; `/__openai/images/generations`; `/__log`; `/__export`.

### 4.4 Outline pipeline (pedagogical heart)

`runCoursePipeline` stages:

1. `enrichDocImages` — tag figures  
2–3. **One planning LLM call** (`extractKgAndOutlinePlan`) produces aha keys, nodes/edges, and chapter/section plan (UI may show two progress stages; it is still one planning JSON)  
4. `applyKgAndOutline` — normalize, orphan-aha fallback, enforce ≥1 reading + ≥1 quiz  
5. `fillSection` fan-out — non-VR parallel (≤3); VR serial  

**Planning output (conceptual JSON):**

```js
{ courseTitle, courseGoal, level, anchorExample,
  ahaKeys[], nodes[], edges[],
  chapters: [{ sections: [{
    title, type, purpose, role, covers, installsAha, sourceHint, figureIds
  }]}] }
```

Robustness: `llmJSON` with retries, fence-strip, brace-scan, truncate repair. Teacher-facing strings follow UI language.

**Section fill context** carries SOURCE LOCK, covered nodes, aha keys (mustInstall), peer board (for VR distinctness), ≤6 pedagogical images, and a markdown slice.

### 4.5 Section modalities

**Reading.** 4–10 chunks of semantic HTML; inject PDF figures when available; optional gpt-image (local OpenAI key) with soft ≥1 image attempt; sparse follow-up questions for companion/quiz reuse.

**H5.** Plan interaction kind → generate sandboxed `srcdoc` HTML → interactivity retries (static flyer = failure) → auto-height messaging. Kinds include process / condition / matching / explore / predict.

**Quiz.** 2–5 items, ≥1 short answer; AHA TRANSFER rules; misconception distractors; only covered nodes. Learner grading: MCQ local; short answers via LLM `{ok, feedback}` without revealing full keys; wrong answers emit companion tip events.

**VR.** Tool-loop sub-agent (~10 tools) under fill pin. Hard prompt blocks: AHA CONSTRUCTION from `buildIdea`; DISTINCTNESS vs peer scenes; SNAPSHOT-SAFE geometry (ban EdgesGeometry / WireframeGeometry / TextGeometry—use `material.wireframe`); PANEL LAYOUT; LANGUAGE LOCK; ≥2 teaching objects + ≥1 panel.

### 4.6 Agent stack (Planner → Executor)

```
runTurn(text)
  offline → keyword demo rules
  buildContextMessage ONCE (context lock for the whole turn)
  ask / learn → runAsk (no tools)
  else → runPlanner → {intent, complexity, skills[2–4], plan}
       chat → Ask
       simple → Executor
       complex → plan confirm → Executor
  Executor: all tools available + selected skill prompts; ≤20 tool rounds
  after successful mutating tools → persistLiveVrEdit()
```

**Models (proxy product names):** `claude-sonnet-5` (default), `claude-opus-4-8`, `claude-fable-5` (deepThinker). Via AStone `cpx-…` or local Anthropic proxy—not raw public SKUs.

**Thinking-budget trap (report this).** Adaptive thinking tokens count toward `max_tokens`. Small budgets produce silent truncation → “Planner returned no JSON” / bare “Done.” with no visible error. Fix: capture `usage`/`stop_reason`; planner effort low with ≥3072 tokens; executor ≥8192; auto ×2 retry on `max_tokens`; never send `thinking:{type:…}` to this model generation.

**Skills (20)** — registry entries `{id, description→Planner route, prompt→Executor inject}`. Progressive disclosure: only 2–4 selected prompts enter the executor. Catalog includes scene-organization, object-creation, custom-modeling, experiment-logic, animation, ui-panel, pedagogy, validation, interaction-design, locomotion, xr-design, view-navigation, room-design, debugging, course-outline/reading/h5/quiz/pipeline/live-edit.

**Tools (40)** — groups: build, edit, panel, query, env, space, outline, course. Structural guards: `requested_by_teacher` for adding chapters/sections; refuse blank sections; new sections do not auto-activate (protect live VR); content setters stamp `buildStatus:'done'`; system objects protected.

**Large-scene context.** ≤20 objects full JSON; else one-line index + pull tools + cheap lexical prefetch (selection/recency/n-gram). `behaviorDesc` is the retrieval index—must stay in sync when behavior changes.

### 4.7 One live scene graph (VR isolation)

**Invariant.** Exactly one live Three.js `sceneRoot`. Each VR section stores ObjectLoader JSON in `section.vr.scene`. VR fills are strictly serial.

**Fill lifecycle (simplified):**

```
beginVrSectionFill(id)
  save prior section → pin fillingVrSectionId
  clearScene + ensureStudentRig
  section.vr.scene = null   // do NOT persist empty begin snapshot
runVrToolLoop
  ensureVrFillSceneBound (NEVER restore another section mid-fill)
  execTool → stamp vrSectionOwner → save live
finishVrSectionFill(id)
  drop foreign owners → captureSceneGraph → unpin
```

**Section switch.** `saveLiveSceneToSection(A)` then `loadSectionScene(B)` with recovery: ObjectLoader → per-child salvage → `reviveObject(builderCode)` → panel rehydrate → oid realign. Empty live must not overwrite a non-empty saved section. One bad object must not blank the section.

**Dual-track creation.** Sandbox API `T` exposes meshes/materials/panels/toast/player distance/collision helpers in page context (`new Function`; Worker isolation is future work). Parametric builders own doors/stairs/step heights/panel layout.

**Slim snapshots.** For localStorage fit: store builder husks + `panelSpec`; drop non-JSON panel canvas textures; prune unreferenced; QuotaExceeded → evict draft/oldest.

### 4.8 Learn mode

Gate: `isCourseBuildComplete` — **all sections** `buildStatus === 'done'` (not learner progress). Entering learn mode stashes authoring chat, locks agent to Ask (companion), clears history, applies `body.learn-mode` chrome stripping. Companion is Socratic; may emit `[[draw:…]]` for diagrams; receives wrong-answer tips. Study flag `STUDY_TEST_FLAGS.disableVrPlayerController: true` currently forces orbit-only 3D play (desktop VR player / Enter VR hidden for the study)—full VR stack remains in code.

### 4.9 Persistence, samples, deploy

**Storage tiers.** (1) `localStorage` project library (~5MB, slim); (2) working draft auto-stash; (3) Chromium File System Access folder of `.xrcourse` files; (4) import with size/magic/schema gates + AI-code risk confirm.

**Five sample courses** (`pre-built-samples/manifest.json`): Bio-Virus, Chem-VSEPR, Geo-Terrain, Mecha-Gear, Phys-Projectile Motion. Opened from Projects → Sample courses; packages are fetched on demand (not copied into the library).

**Figure portability (GitHub Pages lesson).** Exported courses originally referenced `/uploads/<jobId>/images/picture_XX.png` and even `http://localhost:8000/...`—fine locally, broken on Pages (`uploads/` is gitignored). Fix paths: embed as data URIs (`embed_sample_images.py`) and/or externalize to `pre-built-samples/assets/<course-id>/` with `sample-asset:` tokens rewritten at load (`rewriteSampleAssetsInOutline`). Sample fetches use `cache: 'no-cache'` to avoid pinning stale packs.

**Capability matrix:**

| Capability | Local `server.py` | GitHub Pages |
|------------|-------------------|--------------|
| App + 3D + samples | ✅ | ✅ |
| AI via AStone (`cpx`) | ✅ | ✅ |
| AI via Anthropic direct | ✅ proxy | ❌ |
| Docling PDF upload | ✅ | ❌ |
| gpt-image | ✅ | ❌ |
| JSONL logs | ✅ | limited / in-memory |

### 4.10 UI shell (brief)

Cursor-like three-pane layout: Outline / Assets / Hierarchy | Viewport + section workspaces | Chat. Three orthogonal mode axes: (1) section type (VR viewport vs reading/H5/quiz overlay; WebGL never unmounts); (2) Edit vs Play with deep snapshot rollback; (3) Author vs Learn. Visual language: dark tokens, accent for interactive, green for done, purple for AI; bilingual toggle reloads with stash.

---

## 5. Development Progress & Experience (reportable engineering narrative)

This section is intentionally *not* hidden—progress and failures are part of the course deliverable. Chronology roughly 2026-07 → 2026-08.

### 5.1 Inciting incident — pedagogy over spectacle

First demos (mini solar system, etc.) looked great but failed the litmus test: strip the visuals, and no teaching strategy remained. That produced the excellent-teacher vs PPT-machine framing and eventually aha keys / `buildIdea`.

### 5.2 The “Cursor gap” — affordances, not IQ

The same model that built rich scenes inside Cursor produced coarse polyhedra via in-product `add_asset`. Root cause: **channel expressiveness**. Response: sandboxed Three.js code path (`create_custom_object` + `builderCode` revive) **and** deterministic builders for structurally correct rooms/stairs/paths.

### 5.3 Silent failures — thinking budgets & observability

Logs and chat showed Planner “no JSON” and Executor “Done.” with no tools—often `max_tokens` truncation from adaptive thinking, with usage dropped in streaming. Lesson: **observability before tuning**. Structured JSONL (`turn_start/end`, `llm_call` with `stop_reason`/`usage`, `tool_call`, `truncation`) became mandatory. Surviving `/logs` sessions show early `Failed to fetch` / provider `Overloaded` errors during pipeline bring-up (Aug 4–5), plus a large successful authoring log (~177KB) covering cancer-invasion rebuilds, virus H5, VSEPR duplicate-3D debugging, Zion/terrain fixes, and gear interaction bugs.

### 5.4 User-forced KG-first rewrite

Outline quality collapsed under material→outline. User direction: replace the old pipeline rather than layer compatibility. Result: aha → KG → outline contracts with programmatic validation—**data contracts beat model conscience**.

### 5.5 Multi-VR isolation war (hardest engineering arc)

Symptoms: only the first VR section filled; later sections duplicated the first demo under new titles; strong models emptied outlines by inventing non-serializable geometry; chat edits wiped green rings. Fixes: fill pins, `vrSectionOwner`, empty-overwrite guards, peer-board distinctness + content signatures, CRITICAL REBUILD, silent outline updates during fill, structural tool scoping (`requested_by_teacher`), panelSpec mirrors (truthy zombie `panelData` caused white panels after reload).

### 5.6 Deploy / content ops

GitHub Pages “fixed then broken” image bugs traced to deploy lag + aggressive caching + localhost upload URLs. Operational rule: verify which binary is live; see-to-believe media QA; never trust alt-text that a figure is a VSEPR table when it is a logo.

### 5.7 Portable meta-lessons

1. Observability before prompt tuning.  
2. Data contracts > model goodwill.  
3. Every shared mutable singleton (live scene, camera, storage, fetch cache) births a bug class.  
4. Users often invent the right pipeline—engineers make it checkable.  
5. After batch fixes, prove *only intended units* changed.

---

## 6. Study Design

### 6.1 Goals & scope

Informal **course-project** usability study (not IRB-heavy PhD protocol). Measure whether the *produced learning experience* (sample courses on the public demo) is understandable, satisfying, and associated with learning-gain signal on a domain quiz—plus qualitative feedback for iteration.

Target sample size: **n ≤ 6**. Completed at write-up: **n = 3**.

### 6.2 System under test

Public build: `https://garythekid.github.io/3d-vr-codeless-platform/`.  
Sessions use **pre-built sample courses** matched to the assigned learning pack (PDF conversion is local-only; samples avoid that dependency for remote participants). Desktop Chrome/Edge; Zoom screen share + cloud recording.

### 6.3 Materials (5 packs)

| # | Domain | Sample course | Pre/post quiz | Rubric |
|---|--------|---------------|---------------|--------|
| 1 | Biology | Bio-Virus | `virus_quiz.html` | `virus_grading_rubric.html` |
| 2 | Chemistry | Chem-VSEPR | `vsepr_quiz.html` | `vsepr_grading_rubric.html` |
| 3 | Geoscience | Geo-Terrain | `terrain_quiz.html` | `terrain_grading_rubric.html` |
| 4 | Mechanical | Mecha-Gear | `gears_quiz.html` | `gears_grading_rubric.html` |
| 5 | Physics | Phys-Projectile Motion | `projectile_quiz.html` | `projectile_grading_rubric.html` |

Each quiz: **15 MCQ + 5 short answers** (SA scored 0–3) = **/30**. Same instrument for pre and post. Source PDFs live under `experiment-study/learning materials/`.

### 6.4 Protocol (RA run sheet summary)

1. Start Zoom + enable cloud recording  
2. Greet; explain AI teaching-tool tryout (~60–90 min)  
3. Randomly assign one pack (no self-select)  
4–5. Pre-test → download `.txt` answers  
6. Open system → Projects → matching **sample** → Start Learning  
7. Watch full course; log learn start/end; confirm every section opened  
8–9. Post-test (same quiz, fresh tab) → download answers  
10. Experience questionnaire (`questionnaire.html`) → download  
11. Semi-structured interview (5–10 min)  
12. Casual wrap-up; save recording  
13. Zoom portal → transcript → send to study lead  

Full step list: `experiment-study/RA-run-sheet.md`.

### 6.5 Instruments

1. **Domain pre/post quiz** (pack-specific HTML, downloadable answer sheet).  
2. **Questionnaire** (`questionnaire.html`): demographics; raw NASA-TLX (6× 0–100: mental, physical, temporal, performance, effort, frustration); 11 Likert items 1–7 (S1–S3 satisfaction/reuse/recommend; A1–A4 authoring wait/outline/trust; L1–L4 modality learning); open best/worst.  
3. **Semi-structured interview** (tool understanding, waiting, which modality helped, confusion, depth, study/teach willingness, one fix).  
4. **Optional timing log** (learn start→end; generation time N/A when using samples).

### 6.6 Analysis plan (lightweight)

- Per participant: pack, pre/post MCQ & estimated total, gain.  
- Aggregate means for TLX (note Performance polarity: 0=did great in UI wording—flip when averaging “load”).  
- S1–S3 and full Likert means.  
- 4–6 interview themes with short quotes.  
- No heavy inferential stats at n=3.

### 6.7 Participants completed so far (n = 3)

| ID | Pack | Self-reported material | Role / field | AI use |
|----|------|------------------------|--------------|--------|
| P1-Kai | #2 Chem-VSEPR | VSEPR Theory: Predicting Molecular Shape | Working/other, CS, age 24 | Weekly+ |
| P2-Shiv | #4 Mecha-Gear | Gears and More Gears: Building Drive Trains | Grad, Data Science, 24 | Weekly+ |
| P3-Charan | #5 Projectile | Projectile Motion: Two Independent Motions… | Grad, CS, 24 | Weekly+ |

Unused packs so far: #1 Virus, #3 Terrain. Remaining slots: up to **3 more** toward n≤6.

---

## 7. Results (n = 3; update when n grows)

> Writing agent: treat numbers below as **preliminary**. When new `experiment-study/Data/P*` folders arrive, recompute tables and change “n = 3” → “n = x (x≤6)”.

### 7.1 Learning-gain signal (quiz)

All three participants left the **pre-test blank** (unfamiliar domain / instructed not to guess)—**pre MCQ 0/15**, SA 0 → **pre total 0/30**.

| ID | Post MCQ | Post SA (rubric estimate) | Post /30 | Gain |
|----|----------|---------------------------|----------|------|
| Kai (VSEPR) | 15/15 | ~13/15 | ~28 | +28 |
| Shiv (Gears) | 15/15 | ~15/15 | ~30 | +30 |
| Charan (Projectile) | 15/15 | ~15/15 | ~30 | +30 |

**Mean MCQ:** pre 0.0 → post 15.0. **Mean estimated total gain:** ≈ +29.3 /30.

**Caveat (must state).** Blank pretests create a floor effect; gains show “could answer after the course,” not a controlled knowledge delta against a non-blank baseline. Still useful as a coarse learning-experience check for a course project.

### 7.2 NASA-TLX (0–100, as recorded)

| | Mental | Phys | Temp | Perf* | Effort | Frust | Raw mean |
|--|--------|------|------|-------|--------|-------|----------|
| Kai | 75 | 10 | 30 | 10 | 50 | 75 | 41.7 |
| Shiv | 80 | 65 | 15 | 90 | 70 | 30 | 58.3 |
| Charan | 75 | 60 | 10 | 80 | 70 | 20 | 52.5 |
| **Mean** | **76.7** | **45.0** | **18.3** | **60.0** | **63.3** | **41.7** | **50.8** |

\*Performance slider is reverse-worded (0 = did great). Kai’s low Perf is consistent with “did well”; Shiv/Charan’s high Perf may indicate polarity confusion—report cautiously; optionally present adjusted means with Perf flipped.

**Pattern.** Mental demand high (~77); temporal demand low (~18)—waiting was acceptable; frustration mixed (Kai 75 vs others 20–30).

### 7.3 Satisfaction Likert (1–7)

| | S1 satisfaction | S2 reuse | S3 recommend | S1–S3 mean | All 11 mean |
|--|-----------------|----------|--------------|------------|-------------|
| Kai | 6 | 7 | 7 | 6.67 | 6.00 |
| Shiv | 7 | 6 | 7 | 6.67 | 6.09 |
| Charan | 6 | 6 | 7 | 6.33 | 6.00 |
| **Mean** | **6.33** | **6.33** | **7.00** | **6.56** | **6.03** |

Notable softer scores: Charan **a2 (wait acceptable) = 4**; Kai **a3/a4 = 5** (outline clarity / trust middling).

### 7.4 Open questionnaire text

- **Kai — best:** “3D. It makes abstract concepts easier to understand…” · **worst:** concern whether AI “truly understand[s] real-word physics or chemistry rules” in the virtual world.  
- **Shiv — best:** organized interactive learning · **worst:** generation sometimes “not conveying the proper information.”  
- **Charan — best:** “2D and 3D visualizations made concepts click faster” · **worst:** “reading sections were too short… two or three lines.”

### 7.5 Interview themes & quotes

1. **Tool understood as auto course builder** — “builds a whole course by itself… with an AI guide” (Shiv); “describe… in natural language… interactive learning experience” (Kai).  
2. **Waiting acceptable** — “pretty normal and acceptable” (Kai); “small wait… pretty reasonable” (Charan).  
3. **What helped most** — 3D for abstract concepts (Kai); quiz for self-check (Shiv); 2D/3D viz over reading (Charan).  
4. **Pain points** — thin reading (Kai, Charan); half-broken 3D shakes trust (Shiv); session glitches (play button no-op / wrong in-course quiz answers — Kai).  
5. **Depth** — “about right but leaning lighter” (Charan); “a little basic” (Shiv).  
6. **One fix** — improve AI tutor conversational teaching (Kai); fix 3D rendering trust (Shiv); more text for harder topics (Charan).  
7. **Willingness** — all would use for studying; teaching needs more control / beefed-up reading.

### 7.6 Development logs (not participant sessions)

`/logs` contains a handful of JSONL authoring sessions. Across them: early **Failed to fetch** / **Overloaded** failures during bring-up; later a large successful pipeline log. Spot check found many `tool_use` / `end_turn` stop reasons and **no `max_tokens` truncations** in the surviving files—consistent with budget fixes landing before the densest log. Useful in the paper as *engineering progress evidence*, not as study outcome data.

---

## 8. Analysis / Discussion

### 8.1 What the preliminary evidence supports

Even with **n = 3**, convergent signals appear:

- Participants can articulate the product value proposition after one session.  
- Multimodal construct (esp. 3D / quiz) is perceived as the learning engine; satisfaction and recommend scores are high.  
- Domain quizzes become answerable after the sample course (with blank-pre caveat).  
- Temporal load is low—generation/load waiting is not the primary complaint when using samples.

### 8.2 What the evidence challenges

- **Reading as scaffold is under-delivered** in generated samples (2–3 lines)—conflicts with Scaffold stage ambitions.  
- **Trust in physical/chemical fidelity** of AI 3D remains fragile; half-broken scenes are not “cosmetic”—they undermine the constructivist loop.  
- **Companion/tutor** is desired beyond tip-on-wrong-answer (Kai).  
- **NASA-TLX Performance polarity** needs clearer UI or RA instruction before claiming workload profiles.

### 8.3 Design implications (map themes → backlog)

| Finding | Implication |
|---------|-------------|
| Thin reading | Raise minimum chunk length / require misconception naming explicitly in fill prompts; verify in sample rebuilds |
| 3D trust | Harden fill distinctness + runtime smoke tests; surface “scene health” to teachers |
| Tutor request | Expand learn-mode companion toward guided explanation (still Socratic) |
| High mental demand | Possibly expected for new domains; reduce chrome confusion separately from content difficulty |
| Pages figure bugs | Keep embed/externalize pipeline in the release checklist |

### 8.4 Connecting back to the thesis

The study exercises the **learner half** of the thesis (install keys via multimodal sections). The **authoring half** (aha→KG→outline teacher loop) is evidenced mainly by system design + development logs/samples, not by these three sessions (which opened samples). Future participants or a small teacher-facing study should cover authoring explicitly.

---

## 9. Limitations & Future Work

### 9.1 Limitations

- Course project; **n = 3** of ≤6; no control group; blank pretest floor effect.  
- Study used **samples**, not live Docling generation—external validity for upload→build waiting differs.  
- Desktop orbit 3D (study flag); not headset VR.  
- No runtime mastery model; `progress.completedSectionIds` dormant.  
- Pattern library / Critic-vs-KG only partially wired (v1 uses spatiality heuristics).  
- Sandbox is page-context `new Function`, not Worker-isolated.  
- Pages cannot hide shared proxy keys; Docling/gpt-image/local Anthropic unavailable on static host.  
- Short-answer scores above are rubric *estimates* pending double-coding.

### 9.2 Future work

- Finish n≤6; optionally add teacher-authoring sessions.  
- Wire pattern-lookup engine + Critic-vs-KG (used-but-never-taught).  
- Learner mastery / aha-level measurement.  
- Beef up reading scaffolds; conversational tutor improvements.  
- Sandbox Worker isolation; FBX/GLB import; asset-reuse loop (new assets → AssetSkills).  
- Accounts / cloud save / community; production proxy auth.  
- TTS/STT; richer export than 3D-only HTML player.

---

## 10. Conclusion

XR EduAgent attacks a concrete failure mode of LLM course generation: **pretty content dumps**. By forcing STEP-0 aha distillation, a checkable knowledge graph, and scaffold→construct→transfer section contracts—and by surrounding the agent with progressive skills, thick tools, and a hard one-live-scene VR model—the system aims to compile teaching materials into experiences that install transferable keys. A preliminary remote study (**n = 3 of ≤6**) suggests learners find the multimodal courses satisfying and answerable after study, while pointing clearly at thin reading and 3D trust as next engineering targets. The portable claim is methodological: **pedagogy and stability both become contracts**, not prompts alone.

---

## Appendix A — Sample courses (for figures / demo script)

| id | Title (short) | Subject | §§ |
|----|---------------|---------|----|
| `bio-virus` | Viruses: Structure, Classification & What It Means to Be Alive | Biology | 7 |
| `chem-vsepr` | VSEPR Theory: Predicting Molecular Shape | Chemistry | 7 |
| `geo-terrain` | Weathering, Erosion, and Change: The Geologic Story of Zion | Geoscience | 6 |
| `mecha-gear` | Gears and More Gears: Building Drive Trains | Mechanical | 7 |
| `phys-projectile` | Projectile Motion: Two Independent Motions in One Flight | Physics | 8 |

Demo path: Projects → Sample courses → Start Learning.

---

## Appendix B — Contract cheat-sheet (do not omit from System Design)

| Contract | Meaning |
|----------|---------|
| `ahaKeys[]` | 2–5 transferable insights with misconception + buildIdea |
| `covers[]` | Section teaches these KG node ids |
| `installsAha[]` | Section is primary/secondary installer for these aha ids |
| `buildStatus` | idle/building/done/error → green rings / Start Learning gate |
| SOURCE LOCK | `jobId`+`filename` frozen for a pipeline run |
| STEP-0 order | aha → KG → outline (never reverse) |
| VR serial fill | one live `sceneRoot`; per-section `vr.scene` snapshots |
| `vrSectionOwner` | isolation stamp on objects during fill |
| `panelSpec` | JSON-safe mirror of live panel visuals |
| `anim.selfSpin` | example of non-destructive control field |
| `sample-asset:` | portable figure token for Pages-safe samples |
| `requested_by_teacher` | structural outline edits require explicit intent |
| `isCourseBuildComplete` | all sections done (learn-mode gate) |

---

## Appendix C — File index for the writing agent

**Must-read origins (already digested above):**

- `general/overview.md`  
- `general/theories/pedagogical-foundations.md`  
- `general/theories/hci-design-principles.md`  
- `general/technical-stack/01` … `08`  
- `general/ui-design/layout.md`, `visual-language.md`  
- `assets-recyclable/golden-features.md`  
- `assets-recyclable/pain-log.md`  
- `assets-recyclable/aha-keys-and-knowledge-graph.md`  
- `assets-recyclable/average-vs-excellent-teacher.md`  
- `assets-recyclable/recyclable-skills-and-prompts.md`  
- `experiment-study/RA-run-sheet.md`, `questionnaire.html`, `Data/P1-*`…`P3-*`  
- `Agent.md` hard rules  

**Code homes if a detail must be verified:** `course-pipeline.js`, `orchestrator.js`, `section-scene.js`, `samples.js`, `study-test-flags.js`, `skills/manifest.js`, `tools/index.js`.

---

## Appendix D — Suggested figure list for the polished paper / slides

1. End-to-end pipeline diagram (PDF → aha/KG/outline → fill → learn).  
2. Aha → KG → section install contracts schematic.  
3. UI screenshot: three-pane authoring + outline green rings.  
4. Learner view: reading / H5 / quiz / 3D.  
5. NL Inspector / component cards on a selected object.  
6. Study protocol timeline.  
7. Results: pre/post bars; Likert means; optional TLX radar.  
8. “Pain → fix” timeline (Cursor gap, truncation, VR isolation, Pages figures).

---

## Appendix E — Update checklist when n increases

- [ ] Add rows to participant table  
- [ ] Rescore pre/post with rubrics; update means  
- [ ] Merge new questionnaire TLX/Likert  
- [ ] Add 1–2 quotes per new interview theme  
- [ ] Change all “n = 3” → “n = x (of ≤6 planned)”  
- [ ] Note newly used packs (Virus / Terrain still open as of n=3)

---

*End of consolidated ACM-style report source. Keep this file as the single source of truth for paper/presentation writing under `/final-delivery/`.*
