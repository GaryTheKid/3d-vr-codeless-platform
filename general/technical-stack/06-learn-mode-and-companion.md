# 06 · Learn Mode & Learning Companion — the student-facing product

> Feature: Start Learning flips the same app into a learner experience: authoring
> chrome stripped, sections rendered read-only/interactive, and the right rail
> becomes a Socratic AI learning companion.

## Code map

| Piece | Path |
|-------|------|
| Enter/exit + gating + stash | `xr-edu-agent/js/ui/learn-mode.js` |
| Learner rendering per section | `xr-edu-agent/js/ui/section-workspaces.js` |
| Question widgets + grading | `xr-edu-agent/js/ui/learner-quiz.js` |
| Companion chat (Ask-mode lock) | `xr-edu-agent/js/agent/orchestrator.js` (`askSystem` learn branch) |
| Learner context | `xr-edu-agent/js/agent/context.js` (`buildLearningContextMessage`) |
| Gate | `xr-edu-agent/js/core/outline.js` (`isCourseBuildComplete`) |
| Study flags | `xr-edu-agent/js/core/study-test-flags.js` |

## State machine

```
[Authoring] --all sections buildStatus==='done'--> [Ready: green ▶ Start Learning]
    click → enterLearnMode()
      gate: isCourseBuildComplete() else toast
      stash authoring chat/history/mode
      state.learnMode = true; agent.mode locked to 'ask'; history cleared
      body.learn-mode (CSS strips authoring chrome)
      welcome companion message; emit('learn-mode-changed')
[Learn] outline navigation → syncWorkspace → learner render / VR snapshot restore
    click Exit → restore stash, authoring chrome back
```

Key facts:

- **The green gate is build completion, not learner progress.**
  `progress.completedSectionIds` exists in the outline schema but is currently
  dormant (initialized, never written). Progression is free navigation.
- In learn mode the orchestrator always runs **Ask** (no tools) with
  `buildLearningContextMessage` — student-facing exhibit info only (no oids, no
  behavior code, no speeds).

## The learning companion

- Socratic tutor persona in `askSystem()` learn branch: guides with questions,
  relates answers to the current section, never dumps solutions.
- Can emit `[[draw:…]]` markers → `tutorDrawDiagram` generates a gpt-image diagram
  inline (learner Ask only).
- Wrong answers in quizzes/followUps emit `learner-companion-tip` → templated
  encouraging tip appears in companion chat (no extra LLM call) and joins its history.

## Learner-side LLM usage (complete list)

| Use | Mechanism |
|-----|-----------|
| Companion chat | `runAsk`, no tools |
| Short-answer grading | `evalShortAnswer`: normalize → LLM `{ok, feedback}` (hint, never the full key) → substring fallback |
| Companion diagrams | gpt-image on `[[draw:…]]` |

Everything else (pipeline, scene tools, plan/agent modes) is teacher-only.

## VR sections in learn mode

Study flag `disableVrPlayerController: true` (current study default): Play = orbit
camera + click interactions; no WASD capsule, no Enter VR button; outline labels the
type "3D Scene". The full VR player stack (student rig, locomotion, collision,
XR session) remains in the codebase, gated off. 3D quiz panels grade locally and
set `userData.quiz.done` for unlock chains.

**Study-flag convention**: anything "just for this study/test round" goes through
`STUDY_TEST_FLAGS` in `js/core/study-test-flags.js` instead of deleting the old code
path, and is listed here:

| Flag | Study default | Effect |
|------|---------------|--------|
| `disableVrPlayerController` | `true` | Orbit-only play; hide VR player/rig/Enter VR |

## Export player (related but separate)

`js/export/exporter.js` downloads a single-file HTML **3D player** (distilled
runtime: animations, semantic interactions, XR, locomotion, panels; scene JSON
embedded and re-importable). It does **not** package reading/H5/quiz/companion —
full-course sharing happens via `.xrcourse` packages (doc 07).
