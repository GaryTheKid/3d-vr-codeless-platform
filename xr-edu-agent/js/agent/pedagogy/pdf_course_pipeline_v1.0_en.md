# PDF-to-Course Generation Pipeline v1.0 (EN)

> **Product**: a learner drops a PDF in; the agent generates a continuous multimodal course — section-by-section text explanations + interactive 3D visualizations + 2D HTML interactives + generated images + quizzes — self-paced, with an AI companion.
> **Audience of this doc**: engineers and their coding agents.
> **Lineage**: adapted from the CN teacher-side section-generation pipeline v1.0. The pattern library and action vocabulary are shared pedagogy assets across both products (see §6 for the diff table).
> **Why this exists**: the original no-code 3D authoring platform failed with educators not because of coding skill but because independently DESIGNING a 3D learning experience requires instructional-design expertise. This pipeline moves that expertise into the pattern library + planning passes, so 3D (and everything else) is generated with sound teaching logic instead of hand-designed.

---

## 1. Companion static assets (shipped with this doc)

| File | Content | Nature |
|---|---|---|
| `pattern_library_v1.0_en.md` | Teaching pattern library: 24 patterns (P00 fallback + P01-P23), full schemas | Versioned static asset, hot-swappable, never hardcode |
| `action_vocab_master_v2_en.json` | Global teaching-action vocabulary (single source of truth, 363 leaves, 18 families) | The ONLY editable source, in version control |
| `action_vocab_elementary_en.json` | Elementary level view (205 leaves) | Generated from master — **never hand-edit** |
| `action_vocab_middle_en.json` | Middle-school level view (216 leaves) | Generated from master — **never hand-edit** |
| `action_vocab_high_en.json` | High-school/advanced level view (260 leaves) | Generated from master — **never hand-edit** |

**Join rule**: a pattern slot's `function` = one of the vocabulary's 18 family ids; slot `moves_from` = vocabulary id prefixes. Slot instantiation may only pick actions inside `moves_from` × current learner level (`stage_availability`) × subject bias.

**Iron rule**: the vocabulary is NOT a standalone block-type picker. Actions are selected only through pattern slots.

**Learner level**: inferred from the source document (readability, notation density, curriculum markers). For post-secondary/professional material, use the `high` tier defaults.

---

## 2. Pipeline

```
PDF-to-Course Pipeline v1.0
│
├── 0 · Document Blueprint (document-analysis agent, produced BEFORE section fan-out,
│        passed down to every section agent)
│   ├── Structure mining: chapter/section tree from the PDF (headings, logical segmentation)
│   ├── Light knowledge graph: concepts/principles/skills per section (soft reference, not a hard dependency)
│   ├── Running anchor example: ONE example mined from (or fitted to) the document that can
│   │    thread through the chapter; per-section usage plan
│   ├── Secondary example pool (from the document + generated analogs)
│   ├── Per-section role card: section role (opening/development/application/consolidation)
│   │    / assumed-known list / what this section sets up for the next
│   ├── Chapter-level interaction ledger: interaction types already allocated (dedup across sections)
│   └── Chapter-level interaction budget: ≤ N heavy interactions per section
│        (heavy = interactive_3d, rich interactive_2d, ai_dialogue role-play)
│
├── 1 · Teaching-logic mind map (section agent, DECISION step, structured CoT / forced JSON schema)
│   ├── Input: section source text + document blueprint + light knowledge graph
│   ├── 1a · Classify: knowledge type K1-K7 (primary + optional secondary) × section role
│   ├── 1b · Look up: candidate patterns via pattern_library §1.3 matrix
│   │        Composition rule C: 1 primary pattern + at most 1 secondary, junction at slot boundary
│   ├── 1c · Instantiate: fill slots one by one
│   │        action scope = slot moves_from × level stage_availability × subject bias
│   │        each slot outputs: chosen action + concrete teaching content + prerequisites + load_units
│   ├── 1d · Critic pass (single cheap check, NOT multi-agent):
│   │        slots complete? / order conforms to pattern? / any concept used-but-never-taught?
│   │        / Σ load_units within level capacity / content faithful to the source PDF (no fact drift)
│   ├── Fallback · P00 free skeleton: low classification confidence OR critic rejects ≥2 times
│   │        still slot-structured JSON + still critic-checked; MUST write pattern_miss_log
│   └── Output: structured JSON mind map
│            (per node: function-family tag / content / prerequisites / load estimate)
│
├── 2 · Mind map → content blocks (deterministic transform, NO second free generation)
│   ├── Mapping rule: one slot = one content block; leaves = paragraphs within the block
│   └── Purpose: prevent drift re-entering; rewriting limited to phrasing polish,
│        never add/remove teaching points
│
├── 3 · Interaction planning + generation (3D / 2D / image / companion dialogue)
│   ├── 3a · Section-level single-pass planning (ONE call plans the whole section;
│   │        no per-block agent panels)
│   │   ├── Input: all content blocks of the section + chapter ledger + budget
│   │   ├── Value rubric: ICAP upgrade test (Chi & Wylie 2014 — the interaction must lift the
│   │   │    activity from Passive/Active to Constructive/Interactive)
│   │   │    + first-introduction-of-a-core-abstraction + chapter-section-block placement fit
│   │   ├── SPATIALITY TEST (dimensionality decision, this product's key addition):
│   │   │    interactive_3d ONLY if the concept has intrinsic 3D structure or spatial dynamics
│   │   │      (molecular geometry, forces & motion, anatomy, astronomy, solid geometry,
│   │   │       vector fields, terrain, mechanisms);
│   │   │    else interactive_2d if a parameter/relationship manipulation helps;
│   │   │    else generated_image if a static visual suffices;
│   │   │    else no visual. NEVER use 3D as decoration — it is the costliest tool.
│   │   ├── Cost dimension: tool registry carries cost metadata, table lookup, no LLM scoring
│   │   ├── Hints: interaction_affinity on vocabulary leaves and pattern slots (non-binding)
│   │   └── Output: whole-section allocation plan + per-block reasons (write to tool_selection_log)
│   ├── 3b · Devil's-advocate recheck: ONLY when verdict is "build" AND cost is high
│   │        (interactive_3d, rich ai_dialogue role-play)
│   │        Launch policy: run single judge first, measure against human spot-review
│   │        acceptance; enable 3b only if agreement is insufficient
│   ├── 3c · Parallel generation of interaction blocks (built-in tools + prompts:
│   │        3D scene generator / 2D HTML generator / image generator / dialogue script)
│   └── 3d · Every interaction block emits a MANUAL (content / purpose / expected outcome
│        / what state the learner is in afterwards), written back to section-agent context
│        (downstream steps read only the manual, never the artifact itself — token economy)
│
├── 4 · Quiz design (lightweight, single agent, no multi-agent scoring)
│   ├── Input: all content blocks + interaction manuals
│   └── Output: quiz blocks (quiz_mcq / quiz_fill_blank / quiz_short_answer), including items
│        that probe what the learner should have discovered IN the interactions
│        ("after manipulating pressure in the 3D scene, what happened to equilibrium?")
│
└── 5 · Acceptance & telemetry (launch requirement)
    ├── A/B: old single-prompt generation vs this pipeline on the same source PDFs
    ├── Core metrics (no teacher in the loop — learner analytics instead):
    │    per-block drop-off / completion, interaction engagement depth (time, actions taken),
    │    quiz correctness downstream of each interaction, section restart rate
    ├── Pipeline health: P00 trigger rate, critic rejection rate,
    │    3a verdict vs human spot-review agreement
    └── Human spot-review queue: sample N sections/week for expert rating (pedagogy quality 1-5)
```

---

## 3. Data landing points

```sql
-- P00 fallback log (runtime feed for pattern-library iteration; mandatory)
pattern_miss_log (
  id, section_id, classify_output,
  tried_patterns, reject_reasons,
  final_free_skeleton,
  created_at
)

-- Interaction planning decisions
tool_selection_log (
  id, section_id, block_id, verdict,          -- build / skip
  tool_type,                                   -- interactive_3d / interactive_2d / generated_image / ai_dialogue / quiz_*
  rubric_scores,                               -- ICAP / first-intro / placement / spatiality
  cost_estimate, reason, created_at
)

-- Learner analytics (metric source for §2 step 5)
block_event_log (
  id, learner_id, course_id, block_id, event,  -- enter / complete / abandon / restart / interact_action
  payload, created_at
)
```

---

## 4. Asset maintenance rules

1. Pattern library and vocabulary are versioned static assets; business code only reads config. Upgrade = swap file + bump version.
2. Vocabulary edits happen ONLY on `action_vocab_master_v2_en.json`; the three level views are regenerated by script, never hand-edited.
3. **(Future · reserved) Corpus-validation loop**: v1 patterns are literature-derived + expert-authored, NOT yet corpus-validated. When ≥100 quality-confirmed sections exist (this product's spot-reviewed sections + the CN teacher-side product's teacher-approved sections both count), run the annotation → ≥90% coverage check → v1.x. Engineering only ships: pattern_miss_log table + version-switchable asset files.
4. `subject_bias` tags only high-confidence items; everything else is `general`. Refinement happens on master only.
5. `self_study_note` fields mark classroom-social moves and their solo adaptations (companion-as-peer etc.) — the renderer and dialogue engine must honor them, not silently drop the moves.

---

## 5. Deliberately out of scope for v1 (do not build yet)

1. Subject profile overlay files (the vocabulary's stage/subject tags are sufficient for v1).
2. Learner-model personalization of pattern choice (needs analytics volume first).
3. Cross-document courses (multiple PDFs merged into one course).
4. Educator-facing editing UI for generated courses (this product is learner-first; revisit later).

---

## 6. Diff vs the CN teacher-side pipeline (for the team maintaining both)

| Dimension | Teacher-side (CN) | This product (EN) |
|---|---|---|
| Content source | teacher's lesson-plan input + curriculum KB | learner-uploaded PDF (structure & anchor examples mined from it) |
| Blueprint producer | chapter agent (from teacher-approved structure) | document-analysis agent (step 0) |
| Interaction toolbox | H5 animation, digital human, quiz ×3 | interactive_3d, interactive_2d, generated_image, ai_dialogue, quiz ×3 |
| Extra 3a rubric | — | spatiality test (3D worthiness gate) |
| Social moves | real classroom (discussion, peer review) | AI companion adaptations (self_study_note) |
| Acceptance metric | teacher_edits (block reorder count, edit rate) | learner analytics (drop-off, engagement, quiz outcomes) + expert spot-review |
| Quality reviewer | the teacher (final approval step) | automated critic + sampled human review |
| Level dimension | school stage (primary/junior/senior, CN K12) | learner level inferred from document (elementary/middle/high+, high tier covers post-secondary) |
| Shared, unchanged | pattern library structure (24 patterns), 18 slot-function families, vocabulary tree & ids, composition rule C, P00 + pattern_miss_log, pipeline steps 1-4 skeleton | same |

Keep the shared assets structurally in sync: a pattern fixed in one product should be reviewed for the other; the id spaces are intentionally identical.
