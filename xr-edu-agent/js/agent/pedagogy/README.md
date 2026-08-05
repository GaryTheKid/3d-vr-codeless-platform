# Pedagogy assets (static)

Versioned instructional-design assets shared with (adapted from) a sibling PDF-to-course product. **Business code should only read these files as config** — do not hardcode pattern ids or slot trees.

| File | Role | Edit rule |
|------|------|-----------|
| `pattern_library_v1.0_en.md` | 24 teaching patterns (P00–P23); lookup by knowledge type × section role | Version bump to change |
| `action_vocab_master_v2_en.json` | Global teaching-action vocabulary (source of truth) | **Only** this file is hand-edited |
| `action_vocab_elementary_en.json` | Elementary view | Regenerated from master — never hand-edit |
| `action_vocab_middle_en.json` | Middle-school view | Regenerated from master — never hand-edit |
| `action_vocab_high_en.json` | High / advanced view | Regenerated from master — never hand-edit |
| `pdf_course_pipeline_v1.0_en.md` | Reference pipeline (sibling product) | Read for design; our remap is in `EVOLUTION.md` |

**Iron rules**

1. Actions are selected **only** through a pattern slot’s `moves_from` (× learner level × subject bias). Never use the vocabulary as a free “block type picker.”
2. Our section-type remap: `interactive_3d` → `vr`, `interactive_2d` → `h5`, prose → `reading`, `quiz_*` → `quiz` / follow-up.
3. Runtime wiring (KG → Outline → pattern pick → fill) is **planned**; see agent-map v5 nodes `knowledge-graph` / `course-pipeline` and repo `EVOLUTION.md`.
