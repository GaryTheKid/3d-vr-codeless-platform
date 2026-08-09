# Agent.md — Master guide for AI coding agents

> You are working on **XR EduAgent**: a no-build browser app where teachers author
> multimodal courses (3D/VR · reading · H5 · quiz) by chatting with an agent, and
> students learn them with an AI companion. This file tells you (a) what the system
> is, (b) where every piece of documentation lives, and (c) the rules that keep you
> from breaking things other agents broke before.

---

## 1. Load the mental model (read in this order)

1. **[general/overview.md](./general/overview.md)** — what the product is, the
   end-to-end pipeline diagram, runtime architecture table, core data model,
   project history, open roadmap. *Read this first, always.*
2. The **feature doc** matching your task (§2 below).
3. If your task touches pedagogy/UX decisions: [general/theories/](./general/theories/)
   — `pedagogical-foundations.md` (aha keys, KG-first, scaffold/construct/transfer,
   spatiality test) and `hci-design-principles.md` (NL inspector, selection-is-context,
   non-destructive controls, determinism-where-correctness-matters).

## 2. Task router — which doc to read for which ask

| Your task touches… | Read | Code home |
|--------------------|------|-----------|
| Upload/parse PDFs, Docling, server endpoints, figure tagging | [technical-stack/01-material-processing.md](./general/technical-stack/01-material-processing.md) | `server.py`, `services/`, `js/agent/doc-context.js` |
| Course generation, aha keys, knowledge graph, outline, fan-out fill | [technical-stack/02-outline-pipeline.md](./general/technical-stack/02-outline-pipeline.md) | `js/agent/course-pipeline.js`, `js/core/knowledge-graph.js`, `js/core/outline.js` |
| Reading chunks, H5 interactives, quiz items, grading | [technical-stack/03-reading-h5-quiz-tools.md](./general/technical-stack/03-reading-h5-quiz-tools.md) | `js/ui/section-workspaces.js`, `js/ui/learner-quiz.js` |
| **Anything 3D**: scene generation, snapshots, panels, sandbox, section switching | [technical-stack/04-3d-generation.md](./general/technical-stack/04-3d-generation.md) ← most important doc | `js/core/section-scene.js`, `js/agent/sandbox.js`, `js/panels/panel3d.js`, `js/scene/*` |
| Agent behavior, skills, tools, prompts, models, budgets, logging | [technical-stack/05-skills-and-tools.md](./general/technical-stack/05-skills-and-tools.md) | `js/agent/orchestrator.js`, `js/agent/skills/`, `js/agent/tools/`, `js/agent/llm.js` |
| Learn mode, learning companion, study flags | [technical-stack/06-learn-mode-and-companion.md](./general/technical-stack/06-learn-mode-and-companion.md) | `js/ui/learn-mode.js`, `js/core/study-test-flags.js` |
| Saving/loading, .xrcourse, samples, working draft, figure-URL portability | [technical-stack/07-persistence-projects-samples.md](./general/technical-stack/07-persistence-projects-samples.md) | `js/core/projects.js`, `js/core/samples.js`, `pre-built-samples/` |
| Running locally, GitHub Pages, secrets, deploy debugging | [technical-stack/08-deployment-and-server.md](./general/technical-stack/08-deployment-and-server.md) | `server.py`, root `index.html`, `.github/` |
| UI regions, adding chrome, mode switching | [ui-design/layout.md](./general/ui-design/layout.md) | `js/ui/react-app.js`, `js/ui/*` |
| Colors, typography, i18n, icon conventions | [ui-design/visual-language.md](./general/ui-design/visual-language.md) | `style.css`, `js/core/i18n.js` |

Also available: `/assets-recyclable/` — portable lessons from building this product
(pain log with root causes, golden design features, the aha/KG portable manual,
reusable prompt rules). Consult `pain-log.md` when a bug feels familiar; consult
`recyclable-skills-and-prompts.md` before writing new agent prompts.

## 3. Hard rules (violating these has broken production before)

1. **No build step.** Native ES modules + CDN importmaps. Never introduce npm/bundlers.
   Serve over http (`python server.py` from repo root).
2. **One live scene graph.** VR sections snapshot into `section.vr.scene`; fills are
   serial; never restore/save during an active fill except through the section-scene
   API. Read doc 04 before touching anything 3D.
3. **Serialization safety.** Nothing non-JSON-safe persists: functions/canvas/THREE
   refs get stripped or mirrored (`panelData → panelSpec`). New geometry in AI-code
   prompts must stay SNAPSHOT-SAFE (no Edges/Wireframe/TextGeometry).
4. **Structural agent writes need teacher intent** (`requested_by_teacher`), never
   auto-activate new sections, never add blank sections.
5. **Bilingual everything** user-visible (`t()` / `L(zh,en)` / `data-i18n`);
   generated-content language follows UI language, not material language.
6. **Sync the agent map**: any skills/tools/workflow change must update
   `js/agent/agent-map.js` (+ `skills/manifest.js`, EN fields) — rules in
   `xr-edu-agent/js/agent/README.md`.
7. **Thinking budgets**: planner effort low & ≥3072 tokens, executor ≥8192; check
   `stop_reason` before assuming a model "did nothing". Never send
   `thinking:{type:…}` to this model generation.
8. **Prompt-cache discipline**: the stable system block (base + tool defs + asset
   catalog) is the cache prefix — don't edit casually; variable content appends after.
9. **Secrets**: `api-keys.txt` is gitignored; never commit keys; app only calls
   Anthropic via the local proxy or AStone.
10. **Study flags, not deletions**: temporary study behavior goes through
    `STUDY_TEST_FLAGS` (`js/core/study-test-flags.js`), keeping the normal path alive.
11. **Non-destructive UI controls**: one control changes only its own semantic field
    (see `anim.selfSpin` history).
12. **Verify like a pessimist**: after batch content edits, diff-verify only intended
    units changed; after "it broke on GitHub", first diff live files vs local.

## 4. Common extension recipes

| Want to… | Do |
|----------|-----|
| Add a prefab asset | Builder in `js/assets/builders.js` → register AssetSkill in `registry.js` (description/prompt matter — the LLM picks by them). Library UI + `add_asset` pick it up automatically |
| Add an agent tool | Append `{name,label(L()),description,input_schema,exec}` to the right group file in `js/agent/tools/`; exec calls `markTouched(obj)` if it mutates the scene; sync agent-map |
| Add an agent skill | New registry-style file in `js/agent/skills/` (zero-dep, bilingual fields) → import in `index.js` → add to `manifest.js`; description = Planner routing rule |
| Add a section type | Extend `core/outline.js` factories + `section-workspaces.js` editor/learner views + pipeline filler + type routing in orchestrator baseSystem — expect a day, read docs 02/03 first |
| Change 3D generation prompts | `fillVrSection` in `course-pipeline.js`; keep AHA CONSTRUCTION / DISTINCTNESS / SNAPSHOT-SAFE / PANEL LAYOUT blocks |
| Add a sample course | Author in-app → save `.xrcourse` into `pre-built-samples/` → externalize figures (`embed_pdf_images.py` pattern, `sample-asset:` tokens) → `python pre-built-samples/build_manifest.py` |
| Debug "model did nothing / weird output" | `logs/*.jsonl` → find `llm_call` events → check `stop_reason`/usage first (truncation), then planner_result fallback flag |

## 5. Repo map (top level)

```
Agent.md · README.md          this guide + human quick-start
general/                      docs tree (overview / technical-stack / theories / ui-design)
assets-recyclable/            portable lessons & reusable patterns (not project docs)
xr-edu-agent/                 ALL app code (js/agent, js/core, js/ui, js/scene, js/panels,
                              js/assets, js/export, js/labs, style.css, api-keys.txt)
  js/agent/README.md          code-adjacent maintenance rules for agent-map/viewers
  js/agent/pedagogy/          versioned pedagogy assets (pattern library, action vocab)
server.py · services/         local dev server + Docling document service
pre-built-samples/            sample .xrcourse packages + figure assets + build scripts
experiment-study/             usability-study materials (RA run sheet, source PDFs)
uploads/ · logs/ · download/  runtime artifacts (gitignored)
index.html                    entry (local + GitHub Pages)
```

## 6. Verification before you're done

- Hard-refresh the app locally (`python server.py`) — no build means errors surface
  at import time in the console.
- If you touched 3D: test the A→B→A section-switch cycle, save, reload, and reopen —
  the historical regression suite in doc 04 §known-fragile.
- If you touched agent skills/tools: open `js/agent/agent-viewer*.html` and confirm
  the map still matches.
- If you touched anything deployed: push to BOTH repos and verify the Pages action
  (doc 08 checklist).
