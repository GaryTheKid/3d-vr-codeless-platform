# TODO — Future Roadmap

> Reminder list: items below are aligned but **not yet implemented**, ordered by rough priority.

---

# ★ Near-term priority (aligned 2026-07-07) — ✔ A–F all shipped (A–E same day, F on 07-08); see per-item checkmarks and AGENTS.md

> **Why this batch exists (background for new sessions)**
>
> This project is a “VR teaching-scene creation platform for teachers without a programming background,” three-pane UI: left = asset library / scene hierarchy (with natural-language Inspector), center = Unity SceneView–like 3D viewport, right = Ask/Plan/Agent three-mode AI teaching assistant. Stack: React page shell + native ES Modules + Three.js 0.160 (CDN), no build step; LLM only via AStone Claude China proxy (Messages API compatible); keys in local `api-keys.txt` or tester browsers. Models: Sonnet 5 / Opus 4.8 / Fable 5, plus a “thinking depth” tier (Auto / Low / Medium / High).
>
> **Related upgrades already done in prior rounds (prerequisites of this batch — do not rebuild)**:
> 1. **Fixed Fable 5 “Planner returned no JSON”**: root cause was that this generation (Fable/Mythos/Sonnet-5/Opus-4.8) always enables adaptive thinking, and **thinking tokens count toward max_tokens**; too-small budgets get eaten by thinking → silent truncation. Mitigations: generous max_tokens + planner uses `effort:'low'`. Never send `thinking:{type:enabled|disabled}` to these models (400); depth only via `output_config.effort`.
> 2. **Thinking-depth tiers**: `EFFORTS` (auto/low/medium/high) in `llm.js`; `deepThinker` marks always-thinking models (Fable) in `MODELS`. `callBudget(stage)` in `orchestrator.js` computes per-stage `{effort,maxTokens}` from tier + model; Auto = preset mix (planner low, executor/ask medium, deepThinker executor at high with budget×1.5). `cotGuidance()` strips stepwise CoT scaffolding from prompts for deepThinker so it does not fight built-in thinking.
> 3. **AI code sandbox (the biggest capability upgrade)**: platform output looked far less polished than “Cursor + Fable hand-rolled demos”; root cause was only coarse tools like add_asset — the model **had no channel to write code that invents new objects**. Added: `js/agent/sandbox.js` (toolbox T: THREE/mat/mesh/bond/group/attachLabel/makePanel/toast/say + runBuilderCode/compileUpdate/compileClick, new Function isolation); tools `create_custom_object` (write Three.js code to invent objects; may attach `userData.customUpdate(dt,t,obj)` per-frame + `userData.customClick(obj)` click) and `set_behavior` (add behavior code to any object). Runtime hooks: `loop.js` runs customUpdate (auto-disable after ~1s continuous errors); `viewport.js` click runs customClick. NL Inspector (`hierarchy.js`) has a “🧠 Custom logic” component card showing `behaviorDesc` with toggle. New premium skills `custom-modeling`, `experiment-logic`. Quality bar written into system prompt; tool-loop cap 14→20.
>
> **Trigger scenarios for this batch**: iterating a “biosphere energy flow” lab with Fable 5 across multiple rounds (“pipes misaligned” → rebuild, “add energy values to panels” → iterate) surfaced a cluster of issues; A–E below are the postmortem. **Suggested order: A (light up the problem) → B (fix the feel) → C (fix generation quality) → D/E (interaction architecture)**. Each item can be its own conversation; read `AGENTS.md` for module responsibilities before starting.

## A. Observability: logging system + token usage capture

**Background**: During multi-round biosphere iteration, round 3 “I want energy values on every consumer-level panel” hung — the plan card showed **"Understand requirements and plan the scene / Build and configure objects & interactions / Self-check the scene and add teaching panels"** (these three lines are the **hard-coded fallback plan** in `orchestrator.js` `runPlanner` when planner JSON parse fails — not a real model plan), and the executor phase showed **no tool cards at all and immediately replied “Done.”** (the empty-output fallback `if (!finalText) ui.addMsg('ai', L('完成。','Done.'))` at the end of `runExecutor`). I.e. “this turn the model produced neither text nor tool calls.”

**Root-cause hypotheses (by likelihood)**:
1. **Most likely: a single call’s thinking ate the output budget**. After several turns context grew (history + full scene JSON + confirmed plan); Fable thinks first — if thinking runs long, `max_tokens` is spent on thinking and body/tool calls are truncated. **There was no check for `stop_reason==='max_tokens'`, so truncation was silent and surfaced as “Done.”**.
2. Context growth across turns: each `runExecutor` turn carries `history.slice(-HISTORY_KEEP=12)` plus assistant/tool_result accumulated in the tool loop; each history entry is a long summary, plus full scene JSON every turn → tokens and latency climb (also explains “slower / more stuck later”).
3. Occasional planner JSON parse failure hitting the same fallback as #1.

**Critical gap**: `parseSSE` (`message_delta` branch in `js/agent/llm.js`, ~line 108) **only kept `stop_reason` and dropped `usage`** (input/output/thinking tokens). So there was no way to tell whether truncation happened.

**To do**:
- [x] **Capture usage and stop_reason** ✔ Done: `parseSSE` now collects usage from `message_start`/`message_delta`; `callClaude` returns `{content, stop_reason, usage}`; `orchestrator.js` `llmCall()` wraps unified logging (logEvent 'llm_call': stage/model/effort/maxTokens/duration/usage/stop_reason).
- [x] **Truncation warning / self-heal** ✔ Done: planner on `max_tokens` auto-retries once with budget×2; executor on truncation gives a teacher-readable tip (“thinking exceeded budget… try lowering thinking depth”) instead of silent “Done.”; empty output also logs 'empty_output'.
- [x] **Structured logging** ✔ Done: `js/agent/logger.js` + `server.py` (replaces static server; zero-dependency Python — no Node on this machine so Node was not used). `python server.py` serves the page; POST `/__log` writes `logs/*.jsonl` keyed by server start time (one file per session); unavailable endpoint falls back to in-memory buffer (console `__xrExportLog()` export). Events logged: turn_start/planner_result (raw output + whether fallback)/llm_call (usage+stop_reason)/tool_call (input summary; code logs length only / result / duration)/truncation/turn_error/turn_end.

## B. Visible reasoning + lower effort on simple tasks (fix “average ~5 minutes thinking per project, only …”)

**Background**: Users reported “average thinking time about 5 minutes per project — a bit long,” and wanted to **partially see the model’s thinking/reasoning** like Cursor, instead of only a “…” typing indicator.

**Technical facts**: For this adaptive-thinking generation (Fable/Sonnet-5), `thinking.display` **defaults to `'omitted'`** (thinking blocks exist but content is empty string). `parseSSE` **already receives `thinking_delta` and `signature_delta`** (~lines 96–97, added to keep signature across multi-round tool calls), but with display omitted, thinking is always empty and nothing was wired to the UI. This generation **never returns raw CoT**, but a **summary** is available.

**To do**:
- [x] **Stream reasoning summaries** ✔ Done: `callClaude` with `onThinking` streams the model’s reasoning summary live (thinking_delta); `chat.js` adds `startThinkingBlock()` — pale dashed box “🧠 Thinking…” with streaming typewriter; collapses to “View reasoning” after body starts (expandable). Wired into runExecutor/runAsk. ⚠ Pitfall: this API **rejects** `output_config.thinking_display` (400 Extra inputs are not permitted) — removed; when display is omitted, thinking content is empty and the block is not rendered (graceful degrade).
- [x] **Fragment attribution** ✔ Mostly done: each tool-loop round opens its own thinking block so fragments sit above the matching tool card (not embedded in the plan card — good enough).
- [x] **Demote simple tasks** ✔ Done: `callBudget(stage, complexity)`; under Auto, when planner says `simple`, executor drops to low (deepThinker to medium), cutting most thinking time.

## C. Object granularity governance (fix “giant monoliths”)

**Background (the generation-quality issue most worth fixing)**: When Fable built the biosphere, it stuffed **the entire system (terrain + four trophic levels + all energy flows + pipes + particle animation) into one `create_custom_object`** (logs show main scene as single object o15, then o24 after repair). Consequences:
- Teachers wanting one local change can only ask AI to **rewrite the whole object** — the “pipes misaligned” case **deleted o15 and rebuilt o24**, minutes lost and high risk.
- In hierarchy it is an **indecomposable black box**, losing the platform’s core value of “inspectable, fine-tunable.”
- User requirement is clear: **moderate granularity — not too large, not too small — exactly one logical entity** (examples: a hydrogen tank, an atom, an ecological niche).

**To do**:
- [x] **Rule: one object = one logical entity** ✔ Done: good/bad examples written into `scene-organization` (granularity hard rule) and `custom-modeling` skills, and into `create_custom_object` tool docs (works even if skill not loaded): one call builds one logical entity; systems = multiple calls + a controller.
- [x] **Shared-state carrier for cross-object linkage** ✔ Done: `experiment-logic` skill adds “controller pattern” — create a controller object holding shared userData first; entity objects drive themselves via `obj.parent.getObjectByName('controllerName')`; no ad-hoc per-object state silos.
- [x] **Fix say() spam bug** ✔ Done (belt and suspenders): ① prompt layer: `experiment-logic` skill + `create_custom_object`/`set_behavior` tool docs require latch (edge-trigger once; clear flag on reset); ② runtime fallback: `sandbox.js` `T.say`/`T.toast` 5s same-text dedupe throttle so even forgotten latch cannot spam.

## D. PC ↔ WebXR interaction abstraction (advance with §2)

**Background**: User asked how to unify PC (mouse click/drag) and VR (stick select, grip) interaction, referencing Unity XR Interaction Toolkit. Also a minor UI issue: the platform **deliberately did not split Scene/Play modes like Unity** (goal: stay light; lower teacher cognitive load), with the side effect that **interactive objects only fire interaction on click and cannot be selected for Transform** (see `viewport.js`: hits on `expAction`/`customClick` objects run the interaction and `return`, never reaching select). User’s proposal (**adopted**): when an interactable is selected, besides Transform, add a ▶ play button to preview its trigger logic. User also noted most interactions today are “make a separate button/joystick object that remotes a unit,” and more complex interactions must translate from PC to WebXR.

**To do**:
- [x] ~~**Do not introduce Scene/Play dual mode**~~ ⚠ Overturned by §G (2026-07-08): after real use, decided to introduce explicit play/edit dual mode (reuse ▶); Alt+click select and component-card ▶ manual preview remain.
- [x] **Device-agnostic semantic interaction events** ✔ Done: added `js/core/interaction.js` — semantic events `onActivate` (customClick is its legacy alias; smooth compat) / `onGrab` / `onDrag` / `onRelease`; `dispatchInteraction()` unified dispatch (includes expAction state machine). PC Interactor (viewport.js): click→activate, hold-drag→grab/drag/release; XR Interactor (interaction.js): controller ray+trigger→activate, grip→grab, with laser line. `set_behavior` adds grab_code/drag_code/release_code ((obj,detail) signature; detail.point world coords). onSelect (hover) still TODO when needed.
- [x] **Layered placement** ✔ Done: mapping layer is platform code (interaction.js + viewport.js, shared by all objects); new `interaction-design` skill (AI only writes semantic events; attach interactions on the operated object itself; forbid remote-control button objects; forbid mouse/controller code).

## E. Student locomotion controller (PC + XR; under §2)

**Background**: User asked how to design the student’s controller — student XR pose is currently **static** (`loop.js` `setupXR` only pushes the world 5 m forward on sessionstart; no locomotion), but some scenes need walking. Asked whether student movement needs separate PC/XR skills.

**Same philosophy as D: device differences converge in the platform runtime; AI only does intent-level config.**

**To do**:
- [x] Student navigation as a **virtual object** ✔ Done: under “🥽 XR Session Manager”, new “🚶 Student locomotion” component card (toggle static↔teleport; NL edit for mode/radius/turn) + “🎮 Interaction” explainer card.
- [x] **PC + XR dual endpoint** ✔ Done: added `js/core/locomotion.js`. XR: trigger-to-ground teleport / left stick smooth move + right stick snap-turn 45° (or smooth rotate), implemented as inverse translate/rotate of scene (same mechanism as spawn forward push); PC: arrow-key walk preview (WASD reserved for gizmo shortcuts to avoid conflict).
- [x] **Parameterized config** ✔ Done: `locomotion {mode: static|teleport|smooth, allowedRadius (activity radius; anti-wander), turnMode: snap|smooth}`; new tool `configure_locomotion` (tool docs include lesson-type heuristics: observation→static, exploration→teleport) + new `locomotion` skill (when to enable walking; insist on an activity radius); scene JSON carries `studentLocomotion` so the model can read current config.

## F. Large-scene LLM friendliness: layered context + Prompt Caching (aligned 2026-07-08; ✔ shipped)

**Background**: Discussion of “how to keep Agents editable on giant scenes.” User initially proposed “run a retrieval Agent each turn for semantic search and inject only relevant objects” (agentic RAG); review settled on a three-layer plan — a prepended retrieval Agent has three problems: spatial/global requests (“align them” / “too crowded”) don’t recall from semantic search, adds an LLM call every turn, and the retriever doesn’t know what the executor needs.

**Plan (three layers + two disciplines)**:
- [x] **① Resident summary**: when object count > `FULL_JSON_MAX` (20), enter “large-scene mode”; `buildContextMessage()` no longer sends full JSON, but a one-line-per-object index grouped by category (oid/name/position/interaction flags/first 30 chars of description) + global state, preserving global awareness; small scenes still full JSON (zero regression)
- [x] **② Pull on demand (pull over push)**: new tools `find_objects` (keyword semantic match + optional spatial filter) and `get_object_detail(oid)`; `get_scene` auto-degrades to summary on large scenes. The in-execution model pulls detail itself — better than guessing ahead
- [x] **③ Cheap prefetch (no LLM)**: `searchObjects()` pure-JS scoring — selection +5, working set (created/modified by tools in last 3 turns; `state.touched` records turn) +4~+2, Chinese bi-char n-gram hits on oid/name/tags/description; top-8 auto-attaches full params (behavior code stripped to avoid token blowups), saving tool round-trips
- [x] **Description freshness discipline**: `update_object` gains a `description` field; `set_behavior`/`update_object` docs require “changing behavior must sync-update description — it is the retrieval index; stale descriptions make later turns find the wrong object” (classic RAG death: stale index)
- [x] **Prompt caching**: system split into stable block (`cache_control: ephemeral`, tools defs cached with it) + variable block (this turn’s skill prompts); inside executor tool loop the cache breakpoint slides to the latest message; from round 2, history + scene context + prior tool results all hit cache reads (0.1× price). `estimateCost` already priced cache read/write separately; UI spend display stays accurate

**Still not done (needs later demand)**: logical grouping nodes (sceneRoot is still flat; summary uses AssetSkill categories as a stopgap — 500+ objects need real group hierarchy), embedding retrieval (currently n-gram lexical; after an embedding API, upgrade `searchObjects` internals with the same interface), history compression of old turns.

---

## G. Play/edit dual mode + inspector upgrade (aligned 2026-07-08; ✔ shipped)

**Background**: Item D originally “deliberately no Scene/Play dual mode” (Alt+click select). Real use still made editing interactables awkward. After user postmortem, introduce explicit dual mode and reuse the viewport ▶ button.

- [x] **Play/edit mode**: `state.playMode` (default false = edit) + `setPlayMode()`. Edit = fully static, every click selects; play = animations run + semantic interactions live (Alt+click still selects). ▶ upgraded from “animation toggle” to mode switch (animPlaying becomes a sub-switch; “Animation player” card can pause alone while playing); entering XR auto-switches to play; AI gains set_environment {play_mode}; first edit-mode click on an interactable toasts once
- [x] **Inspector (viewport top-right) four new sections**: 📖 Purpose (from behaviorDesc / AssetSkill description), 🔁 Animation (anim params or code-driven, including disabled state), 🖱 Interaction & links (interaction style + scan getObjectByName in behavior code into **bidirectional** reference chips: → read/control, ← referenced; chip click emits 'focus-object' → hierarchy tab + select + scroll + flash), 💬 Object-level AI command input (emit 'agent-request' → chat.js temporarily 📌 the object for runTurn with full params + behavior-code context; restore after turn)

**Leftover**: link chips depend on getObjectByName lexical scan — if AI cross-references via other means (e.g. walk children looking for userData marks), they are missed — future: let AI declare dependency lists on set_behavior (userData.dependsOn).

**Addenda (same day, user feedback)**:
- [x] **Non-destructive UI control principle**: inspector “self-spin” checkbox previously replaced `anim` wholesale (one check killed a planet’s orbit). Fix: introduce `anim.selfSpin` — orbit includes spin by default, set false to turn off alone; other anims set true to add spin; only pure spin adds/removes whole anim. Offline “spin” command fixed likewise. Principle written into AGENTS.md: a single UI control only changes its own logic
- [x] **Direct panel-text editing**: inspector adds “📝 Panel text” (before description sections) — for each panel in the object subtree, title + content-line inputs; type-to-redraw 3D panel (line-count changes auto-resize canvas/mesh via `updatePanelContent()`); live panels tip to use AI. Companion tool `update_panel` (AI in-place text edit without delete+readd); detailed context includes current panel text; ui-panel skill gains matching rules

## H. Single-file HTML export (⬇ download button; aligned 2026-07-08; ✔ shipped)

- [x] Top bar “⬇ Download” → `js/export/exporter.js`: export self-contained HTML student player; prefer POST `/__export` (server.py writes project `download/` dir, auto-created); static servers fall back to browser download
- [x] **Dual-track restore**: ① `sceneRoot.toJSON()` serializes geometry/materials/textures (canvas panels auto-bake dataURL; strip functions/THREE refs from userData before export, restore after); ② objects with `builderCode` **re-run builder code** in the player for whole rebuild — so customUpdate/customClick and live panels hung in build-time closures revive; fall back to serialized meshes on failure
- [x] Player = distilled runtime (~450 lines, inlined in export HTML): animation switch (incl. selfSpin) / semantic interaction dispatch / PC+XR Interactor / teleport+smooth locomotion (allowedRadius/snap turn) / panel billboard+live redraw / T toolbox recompiles behavior code / customUpdate fuse; Three.js via CDN importmap (first open needs network)

**Known boundaries**: built-in lab experiments (oxygen / English café) keep state machines in module code and do not export (expAction click tips back to editor experience); template live panels become static images after export; builderCode rebuild drops later attach_label annotations and 📝 text edits (rebuild prioritizes behavior). Future production: export via backend pack (labs modules + inline Three.js for full offline).

## I. Panel typing + project management + HTML import + CN/EN bilingual (aligned 2026-07-09; ✔ shipped)

- [x] **Panel typing live/static + texture rebuild fix**: `panel3d.js` adds `panelKind(mesh)` (live = code-driven realtime data / static = pure static text). Inspector “📝 Panel text” branches: static panels edit title+lines directly; live shows badge + current data snapshot (read-only) + “use AI to change logic” tip. Root-cause fix: WebGL2 texture storage size is immutable — when line count changes canvas height, old texture remained (“two panels stacked; clear does nothing”) — `updatePanelContent` now disposes old CanvasTexture/geometry and rebuilds when canvas height changes
- [x] **Project management**: `js/core/projects.js` (data layer: localStorage project CRUD + serializeScene/loadSceneData; panelSpec JSON mirror rides with scene and rehydrates on load; builderCode rebuild + behavior recompile; live panels degrade to static snapshots) + `js/ui/projects.js` (first left-rail tab “📁 Projects”: new/open/rename/delete); top-bar “💾 Save” saves into current project
- [x] **HTML importer**: export HTML embeds `<script type="application/json" id="xr-scene-source">` scene block (format `{magic:'XR-EDU-SCENE',version,name,scene,cfg}`); exported files can re-enter the editor. Safety gates: file size ≤25MB / magic+version / shape validation (validateSceneData) / pre-import user confirm (includes “scene may contain AI behavior code” risk tip). Decision: keep HTML rather than invent a format (browser-openable value > parse complexity)
- [x] **CN/EN bilingual**: `js/core/i18n.js` — `t(key,vars)` dict (UI chrome) + `L(zh,en)` inline bilingual (templates/labs/component descriptions and other content) + declarative `data-i18n/-title/-ph` DOM; top-bar EN/中 button; switch = localStorage persist + full-page reload (much copy evaluates at module load; reload is cleanest). Coverage: UI/inspector/hierarchy cards/chat/toast/8 scene templates/two interactive labs/asset library/Agent system prompt (LANG_RULE steers reply + generated-content language)/offline commands (English keywords). Existing 3D object names and panel text are user content — language switch does not rewrite them

## J. Agent directory refactor + workflow visualization (aligned 2026-07-12; ✔ shipped)

- [x] **skills/ directory**: `skills.js` split into `js/agent/skills/` (one skill per module + index.js registry). Methodology adapted from Anthropic Skill article (adopted: description-as-routing, progressive disclosure, Gotchas only, “scripts”=tools; not adopted: one SKILL.md folder per skill — browsers lack file scanning, per-skill size not there yet; upgrade criteria in js/agent/README.md). Hard constraint: skill modules are zero-dep pure data (viewer imports them for display)
- [x] **tools/ directory**: `tools.js` split into `js/agent/tools/` (build/edit/panel/query/env five groups + index.js aggregate); chat-card bilingual `label(input)` colocated with tool defs instead of a central switch; new tools = append objects to a group array
- [x] **agent-map.js**: workflow digraph (12 nodes / 17 edges; each node has title/desc/loaded skills/used tools/code location/upstreams-downstreams) + catalog of 16 tools (was agent-map.json; wrapped as JSON literal + globalThis assignment so file:// pure-local viewing works)
- [x] **agent-viewer three pages (pure local; double-click; no server)**: agent-viewer.html workflow SVG (left-drag pan, click node for right-rail details, highlight up/downstream edges) / agent-viewer-skills.html skill library (loads skills/ registry scripts directly; zero sync cost) / agent-viewer-tools.html tool library (reads agent-map.js) + search; shared agent-viewer.css/-common.js. Skills switched to “registry style” for this (globalThis.XR_AGENT_SKILLS push; zero deps; no import/export; app and viewer share the same files) + skills/manifest.js file list
- [x] **Viewer CN/EN bilingual**: top-right EN/中 (localStorage persist + reload); agent-map.js copy becomes {zh,en} bilingual objects; skill files gain nameEn/descriptionEn/promptEn English mirrors (runtime: EN UI injects En skill fields via skillCatalogForLLM/skillPrompts; orchestrator system prompts are fully language-locked); maintenance rules (new skills/tools must ship English) in js/agent/README.md
- [x] **js/agent/README.md**: directory notes + article adoption decisions + “sync what you change” viewer maintenance conventions

## K. Context lock + play reset + student view / guides / room tools (aligned 2026-07-12; ✔ shipped)

- [x] **Context lock**: `buildContextMessage` built once at `runTurn` start and reused for the whole Planner/Ask/Executor turn — teacher mid-execution playMode/selection changes no longer drift context (tool results stay live so the model still sees its own edits); agent-map.js context node description synced
- [x] **Play-mode reset (Unity-like)**: added `js/core/play-reset.js` — on enter play, deep snapshot (full subtree transform/visible/child lists/material colors/JSON-safe userData); on stop, full restore: animation offsets, student-interaction mutations, code-spawned instances roll back. Edge case: Agent edits scene while playing → end-of-turn `refreshPlaySnapshot()` refreshes rollback baseline so stop does not wipe AI work
- [x] **Student-view rig**: added `js/scene/student-rig.js` — in-scene 🧍 system object (non-deletable; kept by clear/templates; edit-mode visible): static lessons (locomotion=static) show frustum only (camera); walkable lessons show white capsule+frustum (Unity-like); drag/rotate like a normal object to set student spawn and facing; VR (`loop.js` sessionstart) and export player (write cfg.spawn) both spawn from it; `set_student_view` tool (look_at auto-computes facing) + context globalState exposes studentSpawn
- [x] **Arrow / path tools**: added `js/scene/guides.js` + `tools/space-tools.js` — `add_arrow` (from→to, optional arc) / `add_path` (smoothed points: solid/dashed/dots, direction ticks, start/end markers, closable track); role distinguishes scene content vs teaching guides — these primitives no longer hand-written by the model
- [x] **Room-shell tool**: added `js/scene/rooms.js` + `build_room` tool (floor + four walls + door cut / window bands / optional ceiling + ceiling light) — deterministic base for classroom / escape room / restaurant indoor experiences
- [x] **New bilingual skills**: `view-navigation` (spawn & best viewing-distance heuristics, three-step guide-route design, guide-primitive color discipline) / `room-design` (indoor-lesson fixed order: shell → wall furnishings → locomotion & spawn → escape-room controller pattern); agent-map.js tool catalog 16→20; README/AGENTS.md synced
- [x] **English UI gaps filled**: EFFORTS/BUDGETS (thinking-depth / output-budget dropdowns) labels/notes switched to L() bilingual

## L. Experience polish: collision / PC walkthrough / PiP / interaction feedback / multi-select as context (2026-07-12 batch 2; ✔ shipped)

- [x] **Player collision system**: added `js/core/collision.js` (2D XZ AABB, content space) — `userData.solid` objects (ancestor marks apply to subtree) get boxes in the player body-height band (0.2~1.9m); `build_room` walls auto-solid; teleport (landing inside solid / line through wall = invalid; must use doorways), smooth move (wall-slide), and WASD drive all go through collision; same in export player (collectSolids + pointBlocked/segBlocked/resolveMove)
- [x] **Play-mode PC walkthrough**: in walkable play, WASD moves student capsule + ←→ turn (`student-rig.js updateRigDrive`; arrow keys yield; W/E/R gizmo shortcuts disabled in play); viewport bottom #play-hint tip bar; stop play resets pose via play-reset (Unity-like)
- [x] **Student-camera picture-in-picture (Unity Camera Preview–like)**: when student-view object is selected or a walkable lesson is in play, bottom-right scissor shows student eye view (`loop.js renderStudentPiP`); camera fixed eye height 1.6m / FOV 60°; **scaling the rig does not change framing** (scale is just gizmo size)
- [x] **Student-view fixes**: no longer disappears in play (on PC, play = drivable avatar; click-through via hitTopObject/xrHit filtering editorOnly; Alt+click still selects; hide only in true VR sessions); selection box counts visible meshes only (hidden capsule in static lessons no longer inflates AABB / bias center)
- [x] **Platform interaction feedback**: added `js/core/highlight.js` — hover (PC throttled mouse ray + XR controller ray) pale-blue emissive + pointer cursor; successful activate flashes uniformly (in dispatchInteraction); same in export player; interaction-design skill states “hover feedback is platform-owned; AI only writes result feedback”
- [x] **Player-awareness sandbox helpers**: `T.playerPos()` (VR = HMD stand / PC play = capsule / else = camera), `T.distToPlayer(obj)`, `T.overlaps(a,b,margin)`; interaction-design skill gains game-loop pattern library (proximity collect / drop-score / controller scoreboard / timer) for Pac-Man–style, sorting games, etc.
- [x] **Indoor design upgrades**: room-design skill adds “multi-room floorplan” chapter (sketch plan first, differentiate sizes, doors face corridor, same-class furniture variants, shared-wall gaps); view-navigation adds “routes never pierce walls; pass doorways point-by-point” hard rule; build_room docs synced
- [x] **Reply with names, not oids**: LANG_RULE + principle 5 state “always use display names in chat; oid only for tool calls”
- [x] **Shift multi-select + selection is context**: `state.selection` multi-select set (secondary dark highlight boxes); multi-select does not open inspector (Unity-like); Del bulk-deletes; hierarchy 📌 button removed — `contextPins` becomes a mirror of selection (“selection is context”); context-chip ✕ = deselect. Related research: Bolt’s “Put-That-There” (1980) multimodal deixis lineage; recent LLM validations include GazePointAR (CHI’24, gaze+point resolve pronouns), ASSISTVR (TVCG’24, voice+ray multi-object selection beats ray alone), “Revisiting Put-That-There” (ISMAR’25, point/gaze events as direct LLM context fields) — “3D deictic select → LLM context” has published support as a contrasting experimental arm design basis
- [x] **Language switch keeps the scene**: serializeScene to localStorage('xr-lang-stash') before switch; auto-restore after reload (in-scene text stays original language; toast that AI can translate); on quota overrun, fall back to a confirm dialog
- [ ] **craft-customized-tool (recorded; not yet)**: when complex gameplay (§9 class) makes the model “rewrite the same logic repeatedly,” let Agent define a temporary tool (name+schema+JS impl), register it into the tool table for the turn, optionally cache to localStorage as a user tool library. Prerequisite: tool impl needs Worker-level sandbox (see tech debt); shares “gets richer with use” design with §5 “new assets become AssetSkills.” For now “controller object + player-awareness helpers + game pattern library” covers most need — ship when a real bottleneck appears

## M. Student-view fidelity + multi-floor + conditional unlock + interactive UI + project-mgmt polish (2026-07-12 batch 3; ✔ shipped)

- [x] **PiP image = true student view**: renderStudentPiP hides all editor UI before render (TransformControls gizmo / selection boxes / multi-select boxes / grid / editorOnly objects / guide routes) and restores after; no more blue wireframes or transform handles
- [x] **Static frustum rotation pivot fix**: in static mode, frustum geometric center moves to rig origin (userData.staticPose mark; on locomotion switch auto-convert y and child offsets); getStudentSpawn/getStudentEye convert back to stand/eye points
- [x] **Play-mode panels face the student**: loop.js billboard target in play (PC) is student camera (getStudentEye); edit still faces editor camera; XR = HMD — panels in PiP are upright
- [x] **After language switch, offer scene translate**: after stashed scene restores, confirm; on agree emit('agent-task') so Agent uses update_object/update_panel to translate all object names/panel text (chat.js gains 'agent-task' system auto-task entry; input naturally locks while busy)
- [x] **Hide guide routes in play**: added js/core/play-visibility.js — add_path routes with role≠content hide from students in play and restore on exit (rAF decouples from play-reset snapshot order); export player strips them; PiP same rule; arrows kept (teaching content); add_path docs + view-navigation skill updated
- [x] **room-design floorplan realism**: skill adds “shared-wall mating” hard rule (adjacent room center distance = sum of half-widths; outer outline forms rectangle/L; never a straight single-file row) + a 3-bed/2-bath reference floorplan coordinate template (12×9, corridor through)
- [x] **Multi-floor (research conclusion: old collision was 2D body-band filter with y always 0 — second floors unreachable → upgraded)**: collision.js becomes height-aware (boxes with minY/maxY; blocking relative to foot feetY; top ≤feet+0.45 is steppable ledge) + groundHeightAt samples standing height; locomotion standAt includes y (upstairs = world sinks); teleport can target stairs/second floors; WASD drive synced; new tool build_stairs (solid steps ≤0.25m/step + rail solid=false exempt); build_room gains y (second floor) + floor/ceiling solid (steppable floors); “elevator” = button + T.teleportStudent(x,z,floorHeight) pattern (no moving cabin); export player fully matched
- [x] **Conditional unlock / quest chains**: interaction-design skill adds pattern ⑤ (gate object solid + locked look; condition sources = quiz.done / collect counts / interaction flags; controller polls + latch unlock: T.setSolid(door,false)+anim+T.notify; stage chains = unlock lights next-stage clue); new sandbox helper T.setSolid (runtime collision change + box rebuild)
- [x] **Generable / interactive UI**: ① open T.notify(text,{at,title,accent,duration}) in-world temporary tip panels (auto-dismiss; duration scales with text length; VR-visible; preferred over corner T.toast); ② new tool add_quiz_panel multiple-choice panel (question + 2–4 option buttons; PC click / VR trigger answer; instant right/wrong feedback + notify; builderCode generation → save/export revive; correct sets userData.quiz.done=true as unlock condition). Slider / text-input 3D UI deferred (VR text needs virtual keyboard; see §3)
- [x] **Multi-select linked transforms (Unity-like)**: gizmo on primary selection; objectChange deltas sync to other selected (translate same / rotate about primary / scale about primary); mouseDown snapshot for whole-gesture undo
- [x] **New project = empty scene**: btn-proj-new confirms then clearScene (keeps student view) then creates project
- [x] **Project copy**: copyProject deep-copies; name gets (1)(2)… (smallest free suffix); 📄 button on cards
- [x] **Project-mgmt UI refactor**: cards are buttons (outline style, hover recolor, current project blue highlight); click card = open (📂 open button removed); small buttons = copy/rename/delete
- [x] **Lit review: LLM+3D engines (baseline risk for experiments)**: multiple top-venue papers already exist; see “Research memo” below

## N. Room experience polish: doors / size / z-fighting / stair docking / room UI visibility / fall prevention (2026-07-12 batch 4; ✔ shipped)

- [x] **Rooms always have doors**: buildRoom illegal/missing doorWall always falls back to s (tool schema drops 'none'; exec falls back and tells the model in the result); narrow walls (small bathrooms) auto-narrow doorway (0.7~1.3 m) instead of skipping the door; “escape-room locked door” = solid door object over doorway unlocked by interaction (skill/tool docs state this)
- [x] **z-fighting**: room floor underside lifted 0.02 (no longer coplanar with global ground); custom-modeling skill adds “horizontal thin faces never coplanar; lift underside ≥0.02”
- [x] **Larger default rooms**: buildRoom default 8×6→10×8; room-design size standards raised overall (classroom 10×8, living room 6×5+, bathrooms also ≥2.5×2.5 — “rooms look smaller in VR than the numbers suggest; prefer large”); reference floorplan scaled to 15×11
- [x] **Furniture stay-inside hard rule**: room-design skill adds — furniture center-to-wall distance ≥ half-width + 0.2 m; pre-place mental check by w/2, d/2; post-place batch self-check and update_object if out of bounds; build_room docs synced
- [x] **Stair ↔ second-floor docking**: buildStairs top has a built-in landing (landing default 1.2 m; top = rise; 0.12 one-step up onto second floor) + solid side rails; tool docs include docking formulas (when face=n, start z = z0+d/2+run+landing; x aligns to doorway centerline) and “landing end vs doorway error ≤0.3” self-check
- [x] **In-room UI visibility (user-specified rule — do not remove unilaterally)**: added js/core/room-ui-visibility.js — viewer (XR HMD > play-mode student eye > editor camera) outside room → hide all panels in that room (fixes panels clipped half-through walls); inside → depthTest off + renderOrder 1000 top-layer never occluded; room id = buildRoom userData.roomBounds local box test (move/rotate still works); panel id = userData.panelData; 0.2s throttle; export player same via updateRoomUI
- [x] **Multi-floor fall prevention (belt and suspenders)**: ① runtime ledge protection LEDGE_DROP=0.6 — XR smooth move and PC WASD drive cannot step off a drop >0.6 m (stairs 0.25/step unaffected); same in editor and export player; ② room-design skill “fall-prevention hard rule” — every student-reachable second-floor area must be walled/railed; second-floor doors open only onto stair landings / railed corridors, never into empty air

### Research memo: published LLM + 3D engine work (retrieved 2026-07-12)

> User concern: using a “native Unity-style editor” control may draw reviewer pushback that “others already did LLM + traditional engines.” Retrieval conclusion: **there is a mature line of work — do not claim “first LLM-driven 3D engine”; but no paper covers the combination of “zero-coding teachers + pedagogy skills + VR student endpoint + selection-as-context”**, so positioning should differentiate.

- **LLMR** (Microsoft, CHI 2024, Best Paper Honorable Mention): Planner/Scene Analyzer/Skill Library/Builder/Inspector multi-GPT orchestration; Roslyn live-compiles C# in Unity; 4× lower error rate than bare GPT-4; N=11 usability study — closest architecture to this project (sandbox.js header comment cites it)
- **DreamCodeVR** (UCL, IEEE VR 2024): in-VR speech → C# → Roslyn hot compile for non-programmers to change running apps
- **Ostaad / “How People Prompt GenAI to Create Interactive VR Scenes”** (DIS 2024): WoZ elicitation (N=22) + embodied conversational programming agent; users expect agents to understand pointing and other embodied deixis — **demand-side evidence for “selection is context”**
- **VRCopilot** (Michigan, UIST 2024): in-VR human–AI co-creation of 3D layouts; wireframe intermediate representation improves user agency — experimental design (manual/scaffolded/automatic) worth borrowing
- **agentAR** (UIST 2025): tool-augmented LLM agent end-to-end creates AR apps (N=12)
- **SceneCraft** (ICML 2024): LLM agents write Blender Python to render hundred-asset scenes (scene graph → constraints → GPT-V visual feedback iteration + library learning) — representative “AI-powered Blender”
- **Holodeck** (AI2, CVPR 2024) / **Holodeck 2.0** (2025): language-guided Embodied AI 3D environments (LLM spatial constraints + solver placement); 3D-GPT (2024/2025): multi-agent procedural modeling
- **MUSE** (2026 preprint): memory-grounded multi-agent scene editing (Architect/Sculptor/Inspector); emphasizes “incremental edits that do not break unrelated content” — same concern as this project’s “non-destructive principle / context lock”
- **Vibe Coding XR** (Google, 2026): XR Blocks + Gemini XR-prototype vibe-coding workflow
- **Positioning advice**: ① contribution is not “can LLM edit 3D scenes” (already shown by LLMR et al.), but a **teacher/pedagogy-specific agent platform** (teaching skill library; classroom-concept tools for student view / guides / rooms; exportable student player) and **HCI mechanisms** (selection-as-context, non-destructive component cards, play/edit reset); ② avoid “bare Unity” as control (strawman critique); stronger controls are “LLMR-style general agent (no pedagogy skills / no selection context)” vs this system, or ablation (remove skill library / remove selection-as-context); ③ cite the full line above for lineage

## 1. Voice (TTS / STT)
- [ ] Integrate STT (speech recognition) + TTS (speech synthesis); enable audio-related objects
- [ ] Upgrade English café scene: truly understand student English → LLM generates reply → TTS playback, with avatar lip-sync / gesture sync
- [ ] Teachers can also command the Agent by voice

## 2. XR interaction control objects
> Concrete design was elaborated under near-term items §D (interaction abstraction) and §E (student locomotion); both landed 2026-07-07 (interaction.js / locomotion.js / configure_locomotion tool / XR Session Manager component cards).
- [x] Student **navigation** (teleport/smooth/static) and **interaction** (ray select/grab) are configurable ✔
- [x] Presented and edited as component cards in the natural-language Inspector ✔
- [ ] Remaining enhancements: grab distance limits, onSelect (hover highlight) semantic event, allowedArea as arbitrary polygons (currently circular radius)

## 3. Customizable / adaptive UI panels
- [ ] Click a 3D panel (e.g. live lab data board) → open an editor to change panel data/logic directly
- [ ] Also change via natural language: “make this panel show a temperature curve”
- [ ] Bind panel content to data sources (lab state-machine variables) as a configurable mapping

## 4. Custom skill system
- [ ] Users can filter, extract, and load their own skills for subject-specific scene/object/interaction generation
- [ ] Skill editor: name/description/prompt + optional tool allowlist
- [ ] Skill import/export format (JSON/Markdown) to prepare for community sharing

## 5. Asset reuse evaluation & asset retrieval
- [ ] **Reuse vs create decision layer**: when the user asks to create something, Agent first searches existing assets (personal library → community → built-in), scores match, then chooses “reuse as-is / reuse + tweak / create new,” explaining the choice in the plan
  - Retrieval basis: AssetSkill name/description/prompt/tags (semantic match; embeddings later)
  - Newly generated assets auto-wrap as AssetSkill into the user asset library — a positive “gets richer with use” loop
  - Objects from create_custom_object already store builderCode in userData; becoming AssetSkill only needs packaging + persistence
- [ ] **Asset search tool**: when the user asks “does the library have XX?”, Agent calls search_assets and returns a match list (with description and teaching usage); fuzzy/semantic search; left-rail search box upgrades to the same retrieval logic

## 6. User database & community
- [ ] User accounts: projects, assets (AssetSkill already shaped for DB tables), publish-state management
- [ ] Community: share/get skills, assets, scene templates, teaching ideas
- [ ] Cloud save and “share with students” links (the two top-bar buttons are currently placeholders)

## 7. Multi-agent collaboration
- [ ] Agent division of labor: expensive models (Fable/Opus) for planning & core decisions only; cheap models (Haiku) for execution work — lower cost
- [ ] Parallel execution: multiple executor Agents own different scene regions / subtasks
- [ ] Reviewer Agent: after build, automatic scene quality assessment (aesthetic/pedagogy/performance)

## 8. Usage tracking
- [ ] Token usage stats panel (usage already captured with §A and written to llm_call log events — UI display remaining)
- [ ] Per-project / per-day spend stats and budget alerts

## 9. Real 3D model import pipeline (FBX/GLB; aligned 2026-07-08)
> Status: the platform has no Loaders; objects come from only two sources (builders.js procedural geometry + AI sandbox live code). Goal: teachers can import real models (e.g. a textured ~100k-tri human anatomy FBX) that automatically become Agent-usable assets. Architecturally natural: AssetSkill only requires `build: () => Object3D` — imported models fit the same shell.

- [ ] **Format strategy: accept FBX at the door; unify on GLB internally**. FBXLoader is shaky on materials/embedded textures and units are cm; importmap already points at `three/addons/`, so FBXLoader/GLTFLoader/GLTFExporter can import directly. Client flow: FBXLoader read → normalize → GLTFExporter → GLB in IndexedDB (only way assets survive refresh without a backend); with a backend, switch to offline conversion (Blender/FBX2glTF) + Draco/meshopt + KTX2
- [ ] **Import normalization** (new `js/assets/importer.js` — the pitfall-heavy step):
  1. Units & ground: FBX is often cm (×0.01); compute AABB; translate so min.y=0 and horizontally center (platform convention: y=0 is ground)
  2. Materials unify to MeshStandardMaterial (FBX often gives Phong, mismatched with existing PBR lighting); textures capped at 2048²
  3. Wrap in a group then assignOid (hierarchy/ray assume “scene object = direct child of sceneRoot”; imported models have deep internal trees)
  4. Dynamically register AssetSkill: footprint from AABB, tris via traverse sum; description/prompt via teacher dialog or Agent auto-generation — library UI and add_asset pick up automatically after register
- [ ] **Performance**: 100k triangles is fine on PC; Quest standalone whole-scene budget ~200k–500k — a single “hero model” is acceptable. Per-triangle raycast will hitch: attach simplified colliders (AABB/convex hull) on imports and raycast only those; optional meshopt reduce / THREE.LOD two LODs
- [ ] **Skeletal animation subsystem** (real human models usually bring skinned mesh + AnimationClip, parallel to the existing parametric anim system): store clips in userData, build AnimationMixer, mixer.update(dt) in loop.js; NL Inspector gets a “🎬 Animation clips” card (Walk/Idle switch); new tool play_animation so Agent can command (“make this person walk”)
- [ ] **LLM friendliness (ties to §F)**: on import, traverse named child nodes (anatomy models often have Heart/Femur semantic names) and list them in the object description; `findObject` supports `oid/childName` addressing — so “paint the heart red” has a handle

## Tech debt / corrections
- [x] LLM calls switched to streaming; replies type out character by character ✔ Done
- [x] LLM switched from Anthropic official direct connect to AStone China proxy; models routed by sonnet/opus/fable5 path ✔
- [ ] Public-beta proxy auth upgrade: GitHub Pages cannot hide a shared cpx key; formal trials need login + HttpOnly session, short-lived quota tokens, or per-tester revocable keys
- [ ] AI code sandbox isolation upgrade: new Function → Worker/iframe sandbox + API allowlist (production security requirement)
- [ ] Scene serialize save/load (.xrscene format) to support undo/redo
- [ ] NL Inspector edit path plugs into LLM understanding (offline today only parses numbers/color words)
- [ ] Unit tests: tools.js exec and context.js serialization
