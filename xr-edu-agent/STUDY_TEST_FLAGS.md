# Study-test temporary flags (revertible)

This file tracks features **temporarily disabled or altered for the current study / playtest**.
They are **not** permanent product decisions.

Code source of truth: `js/core/study-test-flags.js` (`STUDY_TEST_FLAGS`).

When chat asks for something “just for this study / this test round”, prefer adding a flag here + in that JS file instead of deleting the old path.

---

## Active flags

| Flag | Default (study) | What it does | How to restore |
|------|-----------------|--------------|----------------|
| `disableVrPlayerController` | `true` | ▶ Play = normal orbit 3D view (animations + click interactions). No auto desktop VR preview, no student capsule / WASD player controller, hide top-bar Enter VR. | Set `disableVrPlayerController: false` in `js/core/study-test-flags.js`, hard-refresh. |

### Related code (kept, gated by the flag)

- `js/core/loop.js` — auto `enterVrPreview` on play; `#btn-vr` handler
- `js/scene/student-rig.js` — student capsule / frustum gizmo
- `js/ui/hierarchy.js` — XR Session / Locomotion virtual nodes
- `js/ui/viewport.js` — play drive hint (WASD)

### Course pipeline (replaces legacy single-turn Build)

**Build from this** now runs `js/agent/course-pipeline.js`:

1. Tag figures (purpose + positional anchors)
2. Extract Knowledge Graph / mind map
3. Build Learning Outline walking the graph (`covers[]`)
4. Fan-out section sub-agents (reading / h5 / quiz / vr) with Outline status rings

Legacy ad-hoc `runTurn(defaultDocAgentTask)` is no longer the Build path.

---

## Always-on rules for imports

- Pipeline-enforced: **≥1 reading** and **≥1 quiz** section in the generated outline (even for short PDFs).

---

## History / notes

- 2026-08 — Study round: VR player controller temporarily off.
- 2026-08 — Replaced Build-from-this with KG → Outline → section fan-out pipeline.
