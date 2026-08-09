# js/agent — Agent directory & maintenance rules

This directory is the product’s “brain.” **Anyone (including AI assistants) who changes agent / skills / tools must sync the visualization data per the last section**, or `agent-viewer*.html` will show a stale architecture.

## Layout

```
js/agent/
├── orchestrator.js           Orchestrator: runTurn entry, Planner → confirm → Executor tool loop
├── context.js                Context build: Outline + scene / large-scene + selection + uploaded doc (+ planned KG)
├── doc-context.js            Docling upload mount + summary UI + context block
├── llm.js                    Proxy Claude API: stream, thinking, prompt caching, pricing
├── sandbox.js                AI code sandbox: T toolbox + compile update/click/grab handlers
├── logger.js                 Structured logging
├── pedagogy/                 📚 Teaching-design static assets (pattern library + action vocab + ref pipeline)
│   └── README.md             Edit rules + remap to vr/reading/h5/quiz
├── skills/                   🧠 Skill library (one module per skill, registry style)
│   ├── index.js              App entry: import skills → AGENT_SKILLS / skillCatalogForLLM / skillPrompts
│   ├── manifest.js           File list for the skills viewer (keep order aligned with index.js imports)
│   └── *.js                  (globalThis.XR_AGENT_SKILLS ??= []).push({id,name,description,prompt,…})
├── tools/                    🔧 Tool library (grouped by role)
│   ├── index.js              Aggregate: TOOLS / toolDefsForAPI / execTool / toolCallLabel (40 tools)
│   ├── shared.js             ok/fail helpers
│   ├── build-tools.js        Create: add_asset / create_custom_object / set_behavior / build_template / clear_scene
│   ├── edit-tools.js         Edit: update_object / remove_object / select_object
│   ├── panel-tools.js        Panels: attach_label / add_panel / update_panel / add_quiz_panel
│   ├── query-tools.js        Query: get_scene / find_objects / get_object_detail
│   ├── env-tools.js          Env: report_progress / set_environment / configure_locomotion / set_student_view
│   ├── space-tools.js        Space: add_arrow / add_path / build_room / build_stairs
│   ├── outline-tools.js      Outline: outline_* / reading_set_chunks / h5_set_content / quiz_set_items
│   └── course-pipeline-tools.js  Course: course_tag_figures / course_build_outline_from_doc / course_fill_section / …
├── agent-map.js              📊 Workflow digraph + tool catalog (**v5**; viewer data; sync manually)
├── agent-viewer.html         🧭 Workflow viewer (group `course` = pedagogy / KG / pipeline)
├── agent-viewer-skills.html  🧭 Skills viewer (loads skills/ registry scripts)
├── agent-viewer-tools.html   🧭 Tools viewer (reads agent-map.js)
├── agent-viewer.css / agent-viewer-common.js
└── README.md                 This file
```

Project docs now live at the repo root: **`/Agent.md`** (coding-agent master guide) + **`/general/`** (per-feature docs). Aha Keys / KG portable manual: **`/assets-recyclable/aha-keys-and-knowledge-graph.md`**.

**Open the viewers locally by double-clicking any `agent-viewer*.html`** (no server). Data sources are plain scripts, not JSON/ESM, because `file://` blocks fetch and module imports. The same skill files are imported as ESM by the app.

**Viewers are bilingual**: top-right EN/中 (localStorage `xr_viewer_lang`). Data rules:

- `agent-map.js` copy fields are always `{"zh":"…","en":"…"}` objects;
- Skill English mirrors live in `nameEn` / `descriptionEn` / `promptEn` (alongside Chinese). **Runtime LLM injection follows UI language**: EN UI uses `descriptionEn`/`promptEn` via `skillCatalogForLLM` / `skillPrompts`;
- Missing English falls back to Chinese in the viewer — **do not rely on fallback**.

## Skill design notes

Inspired by Anthropic’s Claude Code skills lessons, adapted for this project:

**Adopted:**

- **Description = routing rule**: Planner only sees `skillCatalogForLLM()` (id + description line). Write “when to load this,” not a feature list.
- **Progressive disclosure**: catalog (~hundreds of tokens) always visible → full prompt only for Planner-selected skills in the Executor variable system block.
- **Gotchas only**: prompts carry project-specific experience, not Three.js 101.
- **Scripts = tools/**: deterministic work lives in tool `exec`; skill prompts hold judgment.

**Not adopted:**

- Per-skill folders (`SKILL.md` + references/…) — our skills are in-browser prompt fragments; upgrade when a prompt exceeds ~1500 tokens or needs an example library.
- Long fixed step instructions — steps are generated in the Planner plan.

**Hard rule: registry style + zero deps** — only `(globalThis.XR_AGENT_SKILLS ??= []).push({...})`, **no import/export**.

**Required fields:** `{ id, name, description, prompt, nameEn, descriptionEn, promptEn }`.

## Tool conventions

Each tool: `{ name, label(input), description, input_schema, exec(input) }`

- `description` for the LLM: when / how / pitfalls;
- `exec` must `markTouched(obj)` on scene edits; return `ok(msg)` / `fail(msg)`;
- `label(input)` is the bilingual chat card (`L()`);
- New tools: add to the right group module; sync `agent-map.js`.

## Sync the viewers after every change

| You changed | Sync |
|-------------|------|
| Add/remove **skill** | ① import in `skills/index.js`; ② filename in `skills/manifest.js` (same order); ③ write `nameEn/descriptionEn/promptEn`. Check executor “common combos” in `agent-map.js` |
| Edit skill content | Update Chinese **and** English fields together |
| Add/remove **tool** | Update `agent-map.js` `tools` (+ bilingual group/summary) and tool-exec / executor tool counts |
| Change **workflow** | Update `workflow.nodes` / `edges` (bilingual title/desc/uses). New group colors → `GROUP_COLOR` / `GROUP_NAME` in `agent-viewer.html`. Current graph includes `progress` (`pipeline` group) and course-design nodes (`course` group: `pedagogy` / `knowledge-graph` / `course-pipeline`) |
| Any change | Bump `meta.updated` (+ `meta.version` on major graph changes); verify both languages in all three viewers; if product shape changed, update `/general/overview.md` |

Checklist: no dangling edges; node desc matches code; tool count = `TOOLS.length`; skills viewer lists every skill; EN mode has no leftover Chinese in bilingual data fields.
