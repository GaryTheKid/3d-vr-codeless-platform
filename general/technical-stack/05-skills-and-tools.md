# 05 · Skills & Tools — how the agent stays reliable, even on weaker models

> Feature: the orchestration layer — Planner → confirm → Executor tool loop, the
> 20-skill registry, the 40-tool library, and the specific mechanisms that keep
> output quality stable regardless of model tier.

## Code map

| Piece | Path |
|-------|------|
| Orchestrator (`runTurn`, budgets, caching) | `xr-edu-agent/js/agent/orchestrator.js` |
| LLM client (providers, streaming, retry, pricing) | `xr-edu-agent/js/agent/llm.js` |
| Skills registry (20 skills) | `xr-edu-agent/js/agent/skills/` (+ `index.js`, `manifest.js`) |
| Tools (40, 8 groups) | `xr-edu-agent/js/agent/tools/` (+ `index.js`) |
| Context assembly | `xr-edu-agent/js/agent/context.js` |
| Structured logging | `xr-edu-agent/js/agent/logger.js` → `logs/*.jsonl` |
| Self-documenting map + viewers | `xr-edu-agent/js/agent/agent-map.js`, `agent-viewer*.html` |

## Orchestration flow

```
runTurn(text)
  offline? → keyword rules
  context locked ONCE (buildContextMessage) for the whole turn
  mode ask / learn → runAsk (no tools)
  else → runPlanner (low effort, JSON {intent, complexity, skills[2–4], plan})
       chat → runAsk
       simple + agent-mode → runExecutor directly
       complex or plan-mode → showPlanConfirm → runExecutor
  runExecutor: all 40 tools + skillPrompts(selected); ≤20 tool rounds
    after each successful non-progress tool → persistLiveVrEdit()
  post-turn: history keep 12; ensureDocCourseMinimum if doc uploaded
```

## Models & providers (`llm.js`)

| Model | Route (AStone proxy endpoint) | deepThinker |
|-------|-------------------------------|-------------|
| `claude-sonnet-5` | `sonnet` | no |
| `claude-opus-4-8` | `opus` | no |
| `claude-fable-5` | `fable5` (Anthropic direct aliases to opus-5) | **yes** |

Providers: `anthropic` (Test API `sk-ant`, needs `server.py` `/__llm` proxy) or
`astone` (`cpx-` key, direct or via proxy). Streaming SSE captures text, thinking
deltas + signatures, **usage and stop_reason** (critical — see below). Retries ×5 on
429/5xx/overload with quadratic backoff. Prices per model feed `estimateCost`
(cache write 1.25×, cache read 0.1×).

### Thinking-budget governance (the #1 model-behavior trap)

This model generation always enables adaptive thinking and **thinking tokens count
toward max_tokens**. Under-budgeting silently truncates output ("Planner returned no
JSON", bare "Done."). Rules baked into `callBudget()`:
planner = effort low, ≥3072 tokens; executor ≥8192 (deepThinker ×1.5); truncation →
planner auto-retry with ×2 budget, executor shows a teacher-readable tip;
`cotGuidance()` is stripped for deepThinkers (don't fight built-in thinking);
never send `thinking:{type:…}` to these models (400).

## Skills (20) — the mechanism

- Registry style: each file does `(globalThis.XR_AGENT_SKILLS ??= []).push({id, name,
  description, prompt, nameEn, descriptionEn, promptEn})` — zero imports, so the
  skills viewer can load the same files under `file://`.
- **description = Planner routing rule**; **prompt = Executor injection** (progressive
  disclosure: only the 2–4 selected skills' prompts enter the executor system).
- Catalog: scene-organization, object-creation, custom-modeling, experiment-logic,
  animation, ui-panel, pedagogy, validation, interaction-design, locomotion,
  xr-design, view-navigation, room-design, debugging, course-outline, course-reading,
  course-h5, course-quiz, course-pipeline, course-live-edit.
- Adding a skill: new file in `skills/` (registry style, bilingual fields) → import in
  `index.js` → filename into `manifest.js` → sync `agent-map.js`.

## Tools (40, 8 groups) — the mechanism

Groups: build / edit / panel / query / env / space / outline / course.
Each tool = `{name, label(L bilingual), description, input_schema, exec}`; adding one
= append to a group array (index.js aggregates automatically) + sync agent-map.
Scene-mutating execs call `markTouched(obj)` (feeds working-set prefetch).

Notable guards:

| Guard | Where | Why |
|-------|-------|-----|
| `requested_by_teacher` required | `outline_add_chapter` / `outline_add_section` | Agent must quote the teacher before structural writes |
| Blank-section refusal | same + `outline_remove_section` (only deletes blanks) | Stops phantom empty sections |
| New sections don't auto-activate | `outline_add_section` (`activate:false`) | Activation used to swap the live 3D scene mid-edit |
| `buildStatus:'done'` stamping | `reading_set_chunks` / `h5_set_content` / `quiz_set_items` | Keeps the green gate truthful |
| Live-panel refusal | `update_panel` | Live panels are code-driven; text edit would be lost |
| System-object protection | `remove_object` / `clearScene(keepSystem)` | Student rig etc. survive |

## How quality stays stable on weaker models (the actual mechanisms)

There is **no per-model skill gating** — all models see the same catalog. The
stabilizers are:

1. **Deterministic thick tools**: `course_*` pipelines and parametric builders do the
   hard part; skills tell weaker models to *call them in a fixed order* instead of
   authoring free-form JSON/HTML/scene graphs ("弱模型优先调确定性工具" in
   `course-outline` skill).
2. **Tool descriptions as procedure manuals**: numeric recipes (room sizes, panel
   x≈±7, orbit speeds), forbidden patterns, and ordering rules live in descriptions —
   active even when no skill was selected.
3. **JSON robustness**: `llmJSON` retries with growing budgets; `extractJSON` does
   fence-strip → parse → brace-scan → truncation repair; planner failure falls back
   to a generic complex plan instead of crashing.
4. **Structural refusals** (table above) make destructive mistakes impossible rather
   than unlikely.
5. **Post-turn backstops**: `persistLiveVrEdit`, `ensureDocCourseMinimum`.
6. **Context compression** (doc: `context.js`): ≤20 objects → full scene JSON; more →
   one-line-per-object summary + `find_objects`/`get_object_detail` pull + free
   lexical prefetch (selection / recent working set / n-gram, top-8, code stripped).
7. **Prompt caching**: stable system block (base + tools + asset catalog) under
   `cache_control`; skill prompts appended after; message breakpoint slides through
   the tool loop. Don't edit the stable block casually — it invalidates all caches.

## Observability

`logEvent` → `logs/<session>.jsonl` via `POST /__log` (in-memory fallback +
`__xrExportLog()`): `turn_start/end`, `llm_call` (stage/model/effort/maxTokens/
duration/usage/stop_reason), `planner_result` (incl. fallback flag), `tool_call`
(input summarized; code logged by length), `truncation`, `empty_output`.
**Debug "model acting weird" from these logs first** — it's almost always budget,
truncation, or context growth.

## Maintenance rule (hard)

Any change to skills / tools / workflow **must** sync `agent-map.js` (+ manifest,
+ EN fields) or the three `agent-viewer*.html` pages show a stale architecture.
See `xr-edu-agent/js/agent/README.md`.
