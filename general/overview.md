# Overview — what XR EduAgent is and how it works

> One file to load the full mental model. Details live in the per-feature docs
> (`technical-stack/`), principles in `theories/`, visuals in `ui-design/`.

## What it is

A browser-based **learning agent platform for teachers with zero coding background**:

1. **Author**: teacher uploads a PDF/Word (or just chats) → the agent builds a
   complete course — a Learning Outline whose sections are 3D/VR scenes, readings,
   2D interactives (H5), and quizzes — grounded in a knowledge graph and 2–5
   "aha keys" (transferable insights) distilled from the material.
2. **Refine**: teacher edits by chat (agent tools), by direct manipulation (Unity-like
   viewport, gizmos), or by natural-language component cards on any 3D object.
3. **Learn**: students play the course in learn mode with an AI learning companion
   (Socratic chat, short-answer grading, wrong-answer tips).

Stack: pure frontend, **no build step** — React 18 (CDN+HTM) shell + native ES
modules + Three.js 0.160 + Claude via proxy. A small Python `server.py` adds local
Docling parsing, LLM/image proxies, logging. Deploys to GitHub Pages as-is.

## The one-diagram version

```
PDF/Word ──Docling──► markdown + figures
                         │  figure tagging (vision LLM)
                         ▼
         ★ Planning call: Aha Keys → Knowledge Graph → Outline
                         │  (covers[] / installsAha[] contracts)
                         ▼
     Fan-out section fill:  reading | h5 | quiz  (parallel ≤3)
                            vr (serial, tool-loop sub-agent per section)
                         ▼
     Outline with green rings ──all done──► ▶ Start Learning
                         ▼
     Learn mode: learner views + AI companion + graded questions
                         ▼
     Persist: .xrcourse (localStorage / folder / file) · samples · export player
```

## Runtime architecture (who owns what)

| Layer | Modules (under `xr-edu-agent/js/`) | Doc |
|-------|-----------------------------------|-----|
| Agent brain | `agent/orchestrator.js` (Planner→confirm→Executor), `agent/llm.js`, `agent/context.js`, `agent/logger.js` | [05](./technical-stack/05-skills-and-tools.md) |
| Skills (20) & tools (40) | `agent/skills/*`, `agent/tools/*`, `agent/agent-map.js` + viewers | [05](./technical-stack/05-skills-and-tools.md) |
| Course pipeline | `agent/course-pipeline.js` (+ `core/knowledge-graph.js`) | [02](./technical-stack/02-outline-pipeline.md) |
| Material ingest | `agent/doc-context.js`, root `server.py`, `services/docling_service.py` | [01](./technical-stack/01-material-processing.md) |
| 3D runtime | `core/three-setup.js`, `scene/*`, `core/{loop,collision,locomotion,play-reset,section-scene}.js`, `panels/panel3d.js`, `agent/sandbox.js`, `assets/*` | [04](./technical-stack/04-3d-generation.md) |
| Outline & sections | `core/outline.js`, `ui/section-workspaces.js`, `ui/learner-quiz.js` | [03](./technical-stack/03-reading-h5-quiz-tools.md) |
| Learn mode | `ui/learn-mode.js` + companion branch in orchestrator | [06](./technical-stack/06-learn-mode-and-companion.md) |
| Persistence | `core/projects.js`, `core/project-fs.js`, `core/samples.js`, `core/sample-assets.js`, `export/exporter.js` | [07](./technical-stack/07-persistence-projects-samples.md) |
| UI shell | `ui/react-app.js`, `ui/{chat,outline,hierarchy,viewport,library,projects,kg-viewer,settings}.js`, `style.css`, `core/i18n.js` | [ui-design/](./ui-design/layout.md) |

## Core data model

```js
// The whole product state serializes into ONE package (.xrcourse):
{
  magic:'XR-EDU-COURSE', version:1, name, scene /*live viewport*/,
  cfg: {
    outline: { course:{title,goal}, chapters:[{ title, sections:[{
        id, title, type:'vr'|'reading'|'h5'|'quiz', purpose, role,
        covers:[nodeId], installsAha:[ahaId], buildStatus,
        vr:{scene,camera} | reading:{chunks} | h5:{html,…} | quiz:{items} }]}],
      progress, activeSectionId },
    knowledgeGraph: { nodes, edges, ahaKeys, anchorExample, level, … },
    locomotion: { mode, allowedRadius, turnMode },
  }
}
```

Scene objects carry their contract in `userData` (oid, builderCode, panelSpec,
vrSectionOwner, solid, anim…) — full table in [doc 04](./technical-stack/04-3d-generation.md).

## History in one paragraph

Started (2026-07) as a pure "Cursor for VR teaching scenes" (chat → Three.js scene).
Key inflections: the *pedagogical-sense* complaint → interactive panels & experiment
state machines; the *Cursor gap* → AI code sandbox + deterministic tools; Anthropic
skill methodology → skills/tools registries + self-documenting viewers; Docling
ingest (2026-08-04) → document-grounded courses; the KG-first pipeline replacement
(2026-08-05) → aha keys/KG/outline contracts + learn mode + companion; then a week
of 3D multi-section isolation hardening + GitHub Pages content ops for a usability
study. Full war stories: `/assets-recyclable/pain-log.md`.

## Open roadmap (carried from the old TODO)

- Pattern-lookup engine wiring pedagogy `pattern_library` into section fill (v1 uses
  spatiality heuristics in prompts); Critic-vs-KG pass (used-but-never-taught check).
- Learner mastery tracking (`progress.completedSectionIds` is dormant; no aha-level runtime measurement).
- TTS/STT; sandbox Worker isolation; asset reuse/retrieval loop ("new assets become
  AssetSkills"); real 3D model import (FBX/GLB); accounts/community/cloud save;
  public-beta proxy auth (shared key can't be hidden on Pages).
