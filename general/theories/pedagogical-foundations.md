# Pedagogical Foundations — the theories that drove the design

> Why this system generates courses the way it does. Every mechanism in
> `general/technical-stack/` traces back to one of the principles here.
> Portable deep-dives live in `/assets-recyclable/` (aha manual, teacher-gap analysis).

## 1. The core thesis

LLMs default to **content dumping**: rewriting source material into pretty
sections. This system's entire pipeline exists to force a different behavior —
**teach toward transferable insights** ("aha keys"). The design stack:

```
Aha Keys (why teach)  →  Knowledge Graph (what + in which order)
    →  Outline with install contracts (who teaches which key)
        →  Modality-matched section fill (how each key gets installed)
```

## 2. Aha-first design (顿悟点优先)

An **aha key** is a transferable insight a student can repeat in their own
words and apply to any re-skinned problem. Planning starts by distilling 2–5
of them from the material (STEP-0 of the planning prompt), each with:

- `insight` — the one-sentence key
- `misconception` — the wrong intuition it replaces
- `whyKey` — why owning it solves any surface variant
- `buildIdea` — a manipulable experience through which the student *constructs* it

Everything downstream is contract-checked against these (see
`/assets-recyclable/aha-keys-and-knowledge-graph.md` for the full portable manual).

## 3. Knowledge Graph as a hard anchor

Between raw material and outline sits a validated graph:
`nodes` (concepts/skills/equations/perks with mastery statements) +
`edges` (prerequisite order) + `anchorExample` (one running example threading
the course). Rules the pipeline enforces programmatically, not by trust:

- every section's `covers[]` must reference existing nodes;
- teaching order must respect prerequisite edges;
- quizzes may only probe taught nodes ("never use a concept that was never taught");
- dense figures (tables, mechanism diagrams) must contribute nodes — prose alone under-extracts.

## 4. Constructionism: Scaffold → Construct → Transfer

Each aha key travels a three-stage journey mapped to section types:

| Stage | Section type | Rule |
|-------|-------------|------|
| Scaffold | reading | Name the misconception, contrast the correct view, end with the insight in student language |
| Construct | h5 / vr | Student predicts → acts → observes an outcome contradicting the misconception → articulates. **Never just display the conclusion** |
| Transfer | quiz | ≥1 item per aha in a brand-new surface story; distractors embody the misconception |

The install contract (`section.installsAha[]`) guarantees every key has a
primary installer, preferably interactive.

## 5. The spatiality test (modality economics)

**VR/3D is the costliest modality** — used only when a concept has intrinsic
3D structure or spatial dynamics (molecular geometry, terrain, orbits, tissue
invasion). 2D parameter interaction → H5; prose/definitions → reading;
mastery checks → quiz. A 3D scene that teaches no better than a flat image is
decoration, and decoration is treated as a defect.

## 6. Pattern library & action vocabulary (static assets, partially wired)

`xr-edu-agent/js/agent/pedagogy/` holds a versioned pattern library
(24 teaching patterns indexed by knowledge type K1–K7 × section role) and an
action vocabulary (18 slot families). Iron rules:

1. Actions are picked only through a pattern slot's `moves_from` — the
   vocabulary is never a free "block type picker" (that reproduces content
   dumping with prettier labels).
2. The library is a replaceable, versioned config asset — business code never
   hardcodes pattern ids.
3. v1 of the shipped pipeline approximates pattern selection with spatiality
   heuristics inside the planning prompt; the full pattern-lookup engine and
   the Critic-vs-KG pass remain open roadmap items.

## 7. Misconception-driven teaching

Misconceptions are first-class data, not prose: they appear in the aha
schema, in reading prompts (name → contrast → resolve), in construct prompts
(the manipulation outcome must *contradict* the misconception), and in quiz
prompts (distractors = the misconception). This is the single most effective
lever we found for making generated content feel "taught by a teacher" rather
than "summarized by a model".

## 8. Self-paced adaptation

There is no classroom. Social/discussion moves remap onto the AI learning
companion (learner-side chat during learn mode), and follow-up questions
after reading chunks / H5 widgets act as the "teacher checking in". Progress
is self-paced through the outline with per-section completion tracking.

## 9. What is deliberately NOT here

- **No learner mastery model** — whether an aha actually "installed" is not
  measured at runtime; content design carries the burden. (Known gap; a
  future product should close the loop.)
- **No spaced repetition** — the construct/transfer loop targets conceptual
  insight, not memorization-type skills.
- **No classroom orchestration** — single learner, single device.
