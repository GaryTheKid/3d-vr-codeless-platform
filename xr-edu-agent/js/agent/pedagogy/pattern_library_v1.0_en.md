# Teaching Pattern Library v1.0 (EN, tailored for the PDF-to-Course product)

> **Purpose**: skeleton source for the section agent's "teaching-logic mind map" step. A pattern is an ORDERED sequence of slots that encodes how a good teacher sequences a section — the missing ingredient when generation is prompt-only ("content dumping").
> **Product context**: learner drops a PDF → agent generates a continuous multimodal course: section text explanations + interactive 3D visualizations + 2D HTML interactives + generated images + quizzes, self-paced with an AI companion.
> **Companion asset**: teaching-action vocabulary (`action_vocab_master_v2_en.json` + 3 learner-level views).
> **Status**: v1.0 freeze candidate · versioned static asset

---

## 0. Three iron rules (engineering MUST follow)

1. **The action vocabulary is NOT a standalone block-type picker.** An action (vocabulary leaf) may only be selected through a pattern slot. Never implement "each knowledge block picks one type from the vocabulary" — that reproduces unordered content dumping with prettier labels.
2. **The pattern library is a replaceable asset, not ground truth.** v1.0 was derived from the instructional-design literature + expert authoring and has **not yet been validated against a real-course corpus**. Do not hardcode pattern ids or slot structures into business logic; implement everything as config-read, hot-swappable by version.
3. **(Future · reserved) Corpus-validation loop.** Once enough generated-and-reviewed course sections accumulate (target ≥100 quality-confirmed sections; the CN teacher-side product's teacher-reviewed corpus also feeds this), annotate each section with its pattern (or two-pattern chain) and require ≥90% coverage; add/repair patterns where it fails → v1.x. At runtime, `pattern_miss_log` (see §5, P00) continuously feeds this loop. Engineering only needs to ship: the log table + version-switchable library files.

---

## 1. Index: two-dimensional lookup

Step 1a of the pipeline classifies each section as `(knowledge_type, section_role)` — primary type + optional secondary. Step 1b looks up candidate patterns below.

### 1.1 Knowledge types (7, aligned to Anderson & Krathwohl 2001)

| id | Name | Test question | Examples |
|---|---|---|---|
| K1 | Concept | Is this section mainly answering "what is X"? | chemical equilibrium, metaphor, function, feudalism |
| K2 | Principle / law | "Why / under what conditions does it hold"? | Le Chatelier, grammar rules, Newton's laws |
| K3 | Procedure / skill | "How to do it"? | solution procedures, lab technique, reading strategies |
| K4 | Facts / narrative | "What happened / what is there"? | historical events, literary facts, geography facts |
| K5 | Interpretation / appreciation | "Read it well and judge its quality"? | poetry appreciation, close reading, graph reading |
| K6 | Creation / expression | "Produce the learner's own artifact"? | essays, speeches, designs, code artifacts |
| K7 | Integrated application | "Use multiple knowledge points on a complex problem"? | industrial process design, capstone problems |

### 1.2 Section roles (4, from the document blueprint's role card)

`opening / development / application / consolidation`

### 1.3 Lookup matrix (candidates = primary-type row × role column)

| K \ role | opening | development | application | consolidation |
|---|---|---|---|---|
| K1 concept | P01, P21 | P01, P02, P03, P04 | P02 (discrimination) | P03, P22 |
| K2 principle | P05, P21 | P05, P06, P04 | P07, P10 | P22 |
| K3 skill | P08, P21 | P08, P09, P10 | P09, P10 | P22 |
| K4 facts | P11, P21, P23 | P11, P12, P23 | P23 | P12, P22 |
| K5 interpretation | P14, P13 | P13, P14, P15 | P15, P14 (comparison) | P22 |
| K6 creation | P16 (deconstruction first) | P16, P17 | P16, P17, P18 | P16 (publishing) |
| K7 integration | P21 | P20 | P19, P20, P18, P23 | P19, P22 |

Low classification confidence, or no candidate fits → P00 free skeleton (§5).

## 2. Composition rule (locked: Rule C)

- One section = **1 primary pattern**, optionally **+1 secondary pattern**. No more.
- The junction must be at a slot boundary; the secondary pattern attaches as a whole block at the primary's `compose.append_point` — no interleaving.
- The primary pattern carries the section's core knowledge type; the secondary serves the secondary type.
- Critic checks: both segments valid + junction legal + total load within the level's capacity.
- Frequent chains are candidates for new compound patterns, surfaced by pattern_miss_log + analytics, confirmed by a human.

## 3. Slot-function families (18, shared ids with the vocabulary's top level)

hook · activate · concept · explain · procedure · demonstrate · analyze · represent · practice · apply · discuss · remediate · assess · reflect · extend · metacog · **aesthetic** · **create**

**Join rule**: a slot's `function` = one of these ids; a slot's `moves_from` = vocabulary id prefixes (may be sub-family level, e.g. `hook.life_scene`). When instantiating a slot, the agent picks actions only from `moves_from`, filtered by learner level (`stage_availability`) and subject bias.

## 3b. Interaction-affinity enum (this product's toolbox)

| id | Meaning | Cost |
|---|---|---|
| interactive_3d | 3D scene: spatial manipulation, simulation, character/camera control | highest |
| interactive_2d | 2D HTML/JS interactive: sliders, graphs, drag-drop, step players | medium |
| generated_image | Static generated diagram/illustration | low (default visual fallback) |
| quiz_mcq / quiz_fill_blank / quiz_short_answer | Auto-graded question blocks | low |
| ai_dialogue | AI-companion dialogue / role-play block | medium |

`interaction_affinity` on slots and vocabulary leaves is a **hint** for the interaction-planning pass, never binding. Dimensionality (3D vs 2D vs image) is decided there by the **spatiality test** (see pipeline doc §3a): 3D only when the concept has intrinsic 3D structure or spatial dynamics.

## 3c. Self-paced (solo learner) adaptations

This product has no classroom. Social moves are NOT dropped — they remap onto the AI companion:

| Classroom move | Solo adaptation |
|---|---|
| peer discussion / Think-Pair-Share / debate | companion plays the peer / opponent (ai_dialogue) |
| teacher demonstration / think-aloud | narrated worked-example playback; step-revealed 2D animation; guided 3D walkthrough |
| peer review of drafts | companion critiques learner's draft against the rubric + learner critiques an AI-generated flawed peer draft |
| oral checks, peer checklists | companion dialogue with rubric-based feedback |
| choral / read-aloud | self-record + playback, or companion-led reading |

Vocabulary nodes needing adaptation carry a `self_study_note` field.

## 4. Pattern schema

```json
{
  "pattern_id": "P0x",
  "name": "...",
  "applicable": { "knowledge_type": ["K1"], "section_role": ["opening","development"] },
  "slots": [ {
      "slot_id": "S1",
      "function": "hook",
      "required": true,
      "moves_from": ["hook.life_scene", "hook.phenomenon"],
      "constraints": ["..."],
      "load_units": 1,
      "interaction_affinity": []
  } ],
  "sequencing_rules": ["S1<S2<S3", "S4 optional"],
  "compose": { "may_append": ["P05"], "append_point": "after S4" }
}
```

Tables in §5–§12 map 1:1 onto this schema — a coding agent can transpile them to JSON directly.

---

## 5. P00 Free skeleton (mandatory engineering fallback)

**Trigger** (either): step-1a classification confidence < threshold; or all candidates (incl. two-pattern chains) rejected by the critic ≥2 consecutive times.

**Behavior**: the agent composes its own slot sequence, but every slot must still declare `function` (§3 enum) + `moves_from` (vocabulary scope) + `load_units`; output is still standard slot-structured JSON; still passes the critic (pattern-conformance check waived).

**Mandatory logging**: every trigger writes `pattern_miss_log(section_id, classification, tried_patterns, reject_reasons, final_skeleton)`. This feeds iron rule 3. Never skip.

---

## 6. K1 Concept patterns

### P01 First introduction of an abstract concept
K1 × [opening, development] · Anchors: Gagné's Nine Events (1985); 5E (Bybee et al. 2006)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 anchor hook | hook | ✓ | hook.life_scene, hook.phenomenon, hook.question | prefer the document blueprint's running anchor example; introduce NO new terms | 1 | — |
| S2 activate prior knowledge | activate | ✓ | activate.recall, activate.connect | only content from the role card's "assumed known" list | 1 | — |
| S3 conflict → new concept | concept | ✓ | concept.define, concept.example, hook.conflict | the new concept must emerge from S1 anchor + S2 prior knowledge; core new term first appears here | 2 | interactive_3d, interactive_2d |
| S4 discrimination & extension | concept | ✗ | concept.discriminate, concept.example | extension examples from the secondary example pool | 1 | — |
| S5 setup for next section | extend | ✗ | extend.core, reflect.core | content from the role card's "sets up next" | 0.5 | — |

Order: S1<S2<S3; S4/S5 omissible, never earlier · compose: may_append [P05, P02] after S4

### P02 Concept discrimination
K1 × [development, application] · Anchors: variation theory (Marton & Pang 2006)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 juxtaposed recall | activate | ✓ | activate.recall | all confusable concepts must be already learned | 0.5 | — |
| S2 contrastive analysis | analyze | ✓ | analyze.compare, concept.discriminate | differences must land on decidable features; no vague "similar but different" | 1.5 | — |
| S3 discrimination practice | practice | ✓ | practice.core (error-spotting / matching) | items must cover every feature raised in S2 | 1 | quiz_mcq, quiz_fill_blank |
| S4 criterion takeaway | reflect | ✗ | reflect.core | output one reusable decision criterion | 0.5 | — |

Order: S1<S2<S3 · compose: none

### P03 Building a concept system
K1 × [development, consolidation] · Anchors: advance organizers (Ausubel 1968); concept mapping (Novak & Gowin 1984)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 recall member concepts | activate | ✓ | activate.recall (keyword web) | all members already learned; no new concepts in this pattern | 1 | — |
| S2 build the framework | represent | ✓ | concept.structure, represent.convert (table→diagram) | framework dimension (super/subordinate, parallel, dual) declared explicitly | 1.5 | interactive_2d, generated_image |
| S3 classify members in | analyze | ✓ | analyze.classify | every member placed, incl. boundary cases | 1 | — |
| S4 completion check | assess | ✗ | assess.core, practice.core (structure fill-in) | checks target framework gaps only | 0.5 | quiz_fill_blank |

Order: S1<S2<S3 · compose: none

### P04 Misconception repair
K1/K2 × [development] · Anchors: conceptual change (Posner et al. 1982); Chi (2005)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 elicit the misconception | assess | ✓ | assess.core (quick poll / pre-test), hook.conflict | the wrong idea must surface first; never open with "a common mistake is…" | 1 | quiz_mcq |
| S2 conflicting evidence | analyze | ✓ | hook.phenomenon (surprising demo / anomalous data), analyze.evidence | evidence must hit the elicited misconception directly | 1.5 | interactive_3d, interactive_2d |
| S3 concept reconstruction | remediate | ✓ | remediate.core, concept.define | new explanation must also explain why the old idea looked right | 1.5 | — |
| S4 consolidation | practice | ✓ | practice.core (error-spotting / right-wrong contrast) | items pit old vs new conception | 1 | quiz_mcq |

Order: strict S1<S2<S3<S4 · compose: none

---

## 7. K2 Principle patterns

### P05 Phenomenon-first induction (POE)
K2 × [opening, development] · Anchors: Predict-Observe-Explain (White & Gunstone 1992)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 observe the phenomenon | analyze | ✓ | analyze.controlled_experiment, hook.phenomenon, demonstrate.core | prefer the running anchor example; learner predicts BEFORE observing | 1.5 | interactive_3d, interactive_2d (high) |
| S2 learner induction | analyze | ✓ | analyze.classify (rule induction / find the pattern), discuss.core | the learner states the rule first; content must not reveal the answer early | 1 | ai_dialogue |
| S3 formalize & name | concept | ✓ | concept.define, explain.core (conditions & scope) | naming comes AFTER induction; applicability conditions stated | 1 | — |
| S4 variation application | practice | ✓ | practice.core (variation problems) | ≥1 variation swaps the surface context (secondary example pool) | 1 | quiz_mcq, quiz_short_answer |
| S5 exceptions & boundary | remediate | ✗ | analyze.classify (exception handling), remediate.core | mention only; no new principle | 0.5 | — |

Order: strict S1<S2<S3<S4 · compose: may_append [P07] after S4

### P06 Deductive derivation
K2 (formula/theorem/model) × [development] · Anchors: Rosenshine (2012) small steps; cognitive load (Sweller 1988)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 driving question | hook | ✓ | hook.question (proof motivation / modeling), hook.formal | must answer "why derive this at all" | 0.5 | — |
| S2 step-by-step derivation | explain | ✓ | explain.core (derivation skeleton / reasoning thread), demonstrate.core | every step carries its justification; no merged jumps | 2 | — |
| S3 meaning of the result | represent | ✓ | represent.convert (symbols→words), explain.core (cross-representation) | translate the result into words and/or a picture | 1 | interactive_2d, generated_image |
| S4 boundary conditions | explain | ✓ | explain.core (conditions & scope / assumptions) | list ≥1 failure case explicitly | 0.5 | — |
| S5 immediate drill | practice | ✗ | practice.core (proof completion) | derivation-chain fill-ins only | 1 | quiz_fill_blank |

Order: S1<S2<S3<S4 · compose: may_append [P07] after S4

### P07 Principle application training
K2 × [application] · Anchors: worked examples (Renkl 2014); gradual release (Rosenshine 2012)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 principle recall | activate | ✓ | activate.recall (theorem toolbox) | ≤10% of section length | 0.5 | — |
| S2 worked example | demonstrate | ✓ | demonstrate.core (full worked example / think-aloud / two-solutions contrast) | must externalize "why this principle at this step" | 1.5 | — |
| S3 guided practice | practice | ✓ | practice.core (gradual release / structure fill-in) | isomorphic to S2, only data/context changed | 1 | quiz_fill_blank |
| S4 independent variation | practice | ✓ | practice.core (variation / independent) | ≥1 far variation (structure changes too) | 1 | quiz_mcq, quiz_short_answer |
| S5 method debrief | metacog | ✗ | metacog.core (strategy choice / how to check) | — | 0.5 | — |

Order: strict S1<S2<S3<S4 (I-do → we-do → you-do is inviolable) · compose: none

---

## 8. K3 Procedure/skill patterns

### P08 Skill demonstration training
K3 × [development] · Anchors: cognitive apprenticeship (Collins, Brown & Newman 1989)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 skill positioning | activate | ✓ | activate.connect (goal preview), activate.recall (skill checklist) | one sentence on WHEN this skill is used | 0.5 | — |
| S2 decomposed demonstration | demonstrate | ✓ | demonstrate.core, procedure.core (checklist / algorithm steps) | steps numbered; error-prone steps flagged | 1.5 | interactive_3d, interactive_2d |
| S3 imitation | practice | ✓ | practice.core (gradual release / verbalized practice) | step hints visible on first attempt | 1 | quiz_fill_blank |
| S4 fade to fluency | practice | ✓ | practice.core (independent / timed) | hints removed progressively; final round zero hints | 1 | quiz_mcq |
| S5 step repair | remediate | ✗ | remediate.core (step-gap repair) | only errors exposed in S3/S4 | 0.5 | — |

Order: strict S1<S2<S3<S4 · compose: none

### P09 Strategy instruction (making thinking visible)
K3 (reading/problem-reading/solution strategies) × [development, application] · Anchors: reciprocal teaching (Palincsar & Brown 1984); SRL (Zimmerman 2002)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 need for the strategy | hook | ✓ | hook.formal (tricky past problem), hook.question | create the need: "where do you get stuck without it" | 0.5 | — |
| S2 name the strategy | explain | ✓ | explain.core (step walkthrough), metacog.core | strategy gets a NAME + trigger conditions ("when to use") | 1 | — |
| S3 think-aloud modeling | demonstrate | ✓ | demonstrate.core (think-aloud) | model the THINKING, not the calculating | 1.5 | ai_dialogue |
| S4 learner application | practice | ✓ | practice.core, apply.core (near transfer) | application material ≠ modeling material | 1 | quiz_short_answer |
| S5 metacognitive debrief | metacog | ✓ | metacog.core (plan-monitor-evaluate / strategy choice) | must answer "when does this strategy NOT apply" | 0.5 | — |

Order: S1<S2<S3<S4<S5 · compose: none

### P10 Experiment / hands-on inquiry
K2/K3 × [development, application] · Anchors: inquiry cycle (NRC 2000)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 pose the question | hook | ✓ | hook.question (research-type) | answerable by THIS experiment | 0.5 | — |
| S2 hypothesis | analyze | ✓ | hook.hypothesis | falsifiable | 0.5 | — |
| S3 design the procedure | procedure | ✓ | procedure.core (protocol / modeling workflow), analyze.controlled_experiment | control variables declared | 1 | — |
| S4 observe & record | analyze | ✓ | analyze.evidence (trend reading) | recording format (table/graph) pre-given | 1 | interactive_3d (virtual lab, high), interactive_2d |
| S5 conclusion & error | analyze | ✓ | analyze.evidence (CER / uncertainty) | conclusion answers S2; ≥1 error source named | 1 | — |
| S6 reflect & transfer | reflect | ✗ | reflect.core | — | 0.5 | — |

Order: strict S1<S2<S3<S4<S5 · compose: none

---

## 9. K4 Facts/narrative patterns

### P11 Narrative immersion
K4 × [opening, development] · Anchors: anchored instruction (CTGV 1990); historical empathy (Endacott & Brooks 2013)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 scene entry | hook | ✓ | hook.media, hook.life_scene | open with a concrete person/scene/object; never an era overview | 1 | ai_dialogue, interactive_3d |
| S2 thread mapping | represent | ✓ | activate.recall (timeline), represent.advanced (flowchart) | timeline OR causal chain as the spine | 1 | interactive_2d, generated_image |
| S3 causal analysis | analyze | ✓ | analyze.evidence (causal attribution / CER) | separate immediate vs root causes; evidence from S1/S2 material | 1.5 | — |
| S4 multi-perspective dialogue | discuss | ✓ | discuss.core (role-play discussion / mini-debate) | ≥2 stances; no single-right-answer phrasing; companion plays counterpart | 1 | ai_dialogue |
| S5 significance | reflect | ✓ | reflect.core (cognitive change) | answer "what does this mean today" | 0.5 | — |

Order: S1<S2<S3; S4/S5 after S3 · compose: may_append [P12] after S5

### P12 Structured memorization
K4 × [development, consolidation] · Anchors: retrieval practice (Roediger & Karpicke 2006); organized encoding (Bower et al. 1969)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 present the material | explain | ✓ | explain.core (visual walkthrough / picture-first) | ≤20% of section; presentation is already structured | 1 | generated_image |
| S2 organizing framework | represent | ✓ | represent.convert (table→diagram), activate (timeline) | framework type declared (timeline/table/map/tree) | 1 | interactive_2d, generated_image |
| S3 associative encoding | explain | ✓ | explain.core (analogy), activate.recall (mnemonic — elementary) | every fact gets ≥1 hook (analogy/mnemonic/location) | 1 | — |
| S4 retrieval practice | practice | ✓ | practice.core (spaced review / timed) | closed-book retrieval, not re-reading; ≥2 spaced rounds | 1 | quiz_fill_blank, quiz_mcq |
| S5 exit self-test | assess | ✗ | assess.core (exit ticket / self-checklist) | — | 0.5 | quiz_mcq |

Order: S1<S2<S3<S4 · compose: none

---

## 10. K5 Interpretation/appreciation patterns

### P13 Close reading
K5 × [development, application] · Anchors: close reading; comprehension strategy instruction (Duke & Pearson 2002)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 first impression | aesthetic | ✓ | aesthetic.perceive (first silent read / tone capture) | overall impressions only; NO analytical terms yet | 0.5 | — |
| S2 focal analysis | aesthetic | ✓ | aesthetic.form (rhetoric/syntax/structure), analyze.evidence | ≤3 focal points, each quoting the text | 1.5 | — |
| S3 theme distillation | aesthetic | ✓ | aesthetic.meaning (emotion & theme) | theme must be supported by S2 evidence; no label-slapping | 1 | — |
| S4 transfer expression | create | ✗ | create.draft (sentence imitation / fragment sketch) | imitate the device analyzed in S2 | 1 | quiz_short_answer |
| S5 deepening dialogue | discuss | ✗ | discuss.core (Socratic questioning) | companion as questioner | 0.5 | ai_dialogue |

Order: strict S1<S2<S3 (perception before analysis) · compose: none

### P14 Aesthetic appreciation (poetry / literature / art)
K5 × [opening, development, application] · Anchors: aesthetic reading (Rosenblatt 1978)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 read-aloud immersion | aesthetic | ✓ | aesthetic.perceive (oral reading / media immersion / imagery visualization) | **iron rule: feeling first** — no analytical terms in this slot | 1 | interactive_2d, generated_image (imagery), ai_dialogue |
| S2 imagery & device unpacking | aesthetic | ✓ | aesthetic.form (imagery / diction / prosody) | each point loops back to S1's felt response ("why did it feel that way") | 1.5 | — |
| S3 emotion & theme | aesthetic | ✓ | aesthetic.meaning (author-and-era reading / artistic mood) | background material enters ONLY here, never earlier | 1 | — |
| S4 comparative appreciation | aesthetic | ✗ | aesthetic.compare (same-theme / style / degraded-rewrite contrast) | ≤2 comparison objects | 1 | — |
| S5 creative transfer | create | ✗ | create.draft (imitation / rewriting) | — | 1 | quiz_short_answer |

Order: strict S1<S2<S3 (stronger than P13: no background before S1) · compose: none

### P15 Graph / image / data reading
K5/K3 × [development, application] · Anchors: multimedia learning (Mayer 2009); Curcio (1987) read-the-data / between / beyond

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 representation literacy | represent | ✓ | represent.convert (graph→words), represent.advanced | axes/legend/units BEFORE content (read the data) | 0.5 | interactive_2d |
| S2 feature extraction | analyze | ✓ | analyze.evidence (trend reading) | trends, extremes, inflections one by one (read between) | 1 | interactive_2d |
| S3 meaning mapping | represent | ✓ | represent.convert (context→model / graph→words) | graph features must land on subject meaning (read beyond) | 1 | — |
| S4 variation reading | practice | ✓ | practice.core (variation), remediate.core (graph-reading pitfalls) | ≥1 classic misreading trap item | 1 | quiz_mcq |

Order: strict S1<S2<S3<S4 · compose: none

---

## 11. K6 Creation/expression patterns

### P16 Writing / creation guidance
K6 × [development, application, consolidation] · Anchors: cognitive process of writing (Flower & Hayes 1981); genre pedagogy (Martin & Rose 2008)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 mentor-text deconstruction | create | ✓ | create.deconstruct (model text / reverse outline / sentence appreciation) | deconstruction dimensions = this task's evaluation rubric | 1 | — |
| S2 ideation | create | ✓ | create.ideate (prompt analysis / brainstorm / material map) | output: 1-sentence thesis + ≥3 candidate materials | 1 | interactive_2d (idea map) |
| S3 outlining | create | ✓ | create.draft (outline build) | each outline segment labeled with its function (echoing S1) | 1 | quiz_fill_blank |
| S4 drafting | create | ✓ | create.draft (fragment sketch / opening-closing / picture-prompt — elementary) | level decides grain: elementary fragments, middle full piece, high timed full piece | 1.5 | quiz_short_answer |
| S5 review & revise | create | ✓ | create.revise (self-checklist / peer review) | rubric = S1 dimensions, closing the loop; solo mode: companion critique + AI peer draft | 1 | ai_dialogue |
| S6 publish | create | ✗ | create.revise (publish & showcase) | — | 0.5 | — |

Order: S1<S2<S3<S4<S5 · compose: none · Note: a section may run only S1-S3 (ideation session) or S4-S5 (drafting session), decided by the document blueprint role card — truncation must be contiguous.

### P17 Argumentation
K6/K5 × [development, application] · Anchors: Toulmin (1958); Kuhn (1991)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 contestable question | hook | ✓ | hook.conflict | genuinely two-sided; no fake controversy | 0.5 | — |
| S2 map both sides | analyze | ✓ | analyze.compare, discuss.core (debate prep) | ≥2 reasons per side | 1 | — |
| S3 evidence appraisal | analyze | ✓ | analyze.evidence (CER) | annotate claim / evidence / warrant | 1.5 | — |
| S4 position statement | discuss | ✓ | discuss.core (structured speech / mini-debate), create.draft | must cite S3-appraised evidence; companion argues the other side | 1 | ai_dialogue |
| S5 debrief | reflect | ✗ | reflect.core | must answer: "the other side's strongest point?" | 0.5 | — |

Order: S1<S2<S3<S4 · compose: none

### P18 Project making
K6/K7 × [application] · Anchors: Gold Standard PBL (Larmer & Mergendoller 2015); design thinking

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 understand the brief | apply | ✓ | apply.core (scenario task / engineering constraints) | constraints + success criteria explicit | 1 | — |
| S2 design alternatives | procedure | ✓ | procedure.core (modeling workflow), analyze.model | ≥2 alternatives + selection rationale | 1.5 | — |
| S3 build | apply | ✓ | apply.core (project slice) | sliced to per-section completable grain | 1.5 | interactive_3d, interactive_2d |
| S4 showcase & critique | discuss | ✓ | discuss.core (showcase / peer critique), assess.core (rubric) | rubric shown at S1 already; companion as critique partner | 1 | ai_dialogue |
| S5 iterate & reflect | reflect | ✓ | reflect.core (method takeaway / transfer plan) | — | 0.5 | — |

Order: S1<S2<S3<S4<S5, may span sections (blueprint splits) · compose: none

---

## 12. K7 Integration + role-driven generic patterns

### P19 Contextualized integrated application
K7 × [application, consolidation] · Anchors: anchored instruction (CTGV 1990); situated cognition (Brown, Collins & Duguid 1989)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 authentic scenario task | apply | ✓ | apply.core (scenario / decision / mini-inquiry task) | prefer the running anchor example's real setting | 1 | ai_dialogue, interactive_3d |
| S2 problem decomposition | metacog | ✓ | metacog.core (task reading), analyze.classify | decomposition maps explicitly onto learned knowledge points | 1 | — |
| S3 multi-point solution | apply | ✓ | apply.core (problem solving / engineering constraints / open modeling) | ≥2 knowledge points of this chapter invoked; process externalized | 2 | interactive_3d, interactive_2d |
| S4 outcome & reflection | reflect | ✓ | reflect.core, discuss.core (showcase) | must answer "which methods survive a scenario swap" | 1 | — |

Order: S1<S2<S3<S4 · compose: none

### P20 Complex-problem deconstruction training
K7 × [development, application] · exam-oriented · Anchors: schema training (Sweller & Cooper 1985)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 present & read the problem | metacog | ✓ | metacog.core (problem reading), hook.formal | output: givens list + goal + obstacle | 1 | — |
| S2 deconstruction demo | demonstrate | ✓ | demonstrate.core (annotated example / think-aloud) | externalize "which signal triggers which method" | 1.5 | — |
| S3 sub-problem mapping | activate | ✓ | activate.recall (method menu), analyze.compare | each sub-problem tagged with its knowledge point | 1 | — |
| S4 integrated solving | practice | ✓ | practice.core (interleaved mixed / timed) | ≥1 isomorph + ≥1 variation | 1.5 | quiz_short_answer, quiz_mcq |
| S5 takeaway | metacog | ✓ | metacog.core (error log / method takeaway) | distill into "signal → method" cards | 0.5 | — |

Order: S1<S2<S3<S4<S5 · compose: none

### P21 Unit opening / driving question
role=opening (K-agnostic, chapter-first section) · Anchors: driving questions (Krajcik & Blumenfeld 2006); Ausubel (1968)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 big scenario | hook | ✓ | hook.media, hook.life_scene, hook.phenomenon | first appearance of the running anchor example | 1 | interactive_3d, ai_dialogue |
| S2 driving question | hook | ✓ | hook.question (driving question) | spans the chapter; NOT answered in this section | 0.5 | — |
| S3 chapter map preview | represent | ✓ | represent.advanced (flowchart), concept.structure | matches the chapter mind map; section level only | 0.5 | interactive_2d, generated_image |
| S4 goals & rubric preview | explain | ✗ | activate.connect (goal preview), assess.core (rubric) | — | 0.5 | — |

Order: S1<S2<S3 · compose: none

### P22 Review & consolidation
role=consolidation (K-agnostic) · Anchors: retrieval practice (Roediger & Karpicke 2006); interleaving (Rohrer & Taylor 2007)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 retrieval activation | activate | ✓ | activate.recall (keyword web / diagnostic pre-test) | closed-book retrieval BEFORE seeing the map | 1 | quiz_mcq |
| S2 structured synthesis | represent | ✓ | represent.convert (table→diagram), reflect.core (structure summary) | learner completes the structure; never fully given | 1 | interactive_2d |
| S3 comprehensive check | assess | ✓ | assess.core (formative quiz), practice.core (interleaved / spaced) | covers all core points; item order interleaved, not section order | 1.5 | quiz_mcq, quiz_fill_blank |
| S4 gap repair | remediate | ✓ | remediate.core (error-example unpacking) | only errors actually exposed in S3 | 1 | — |
| S5 transfer preview | extend | ✗ | extend.core (next-topic preview) | — | 0.5 | — |

Order: S1<S2<S3<S4 · compose: none

### P23 Scenario role-play dialogue
K4/K5/K7 × [development, application] · ai_dialogue-heavy · Anchors: role-play learning (van Ments 1989); historical empathy (Endacott & Brooks 2013)

| Slot | function | Req | moves_from | Constraints | Load | Affinity |
|---|---|---|---|---|---|---|
| S1 scene setting | hook | ✓ | hook.media, hook.life_scene | time/place/characters/conflict all four present | 0.5 | ai_dialogue, interactive_3d |
| S2 role & mission | apply | ✓ | apply.core (decision task), discuss.core (role-play) | the learner's role has REAL decision power, not spectator | 1 | ai_dialogue |
| S3 dialogue & decisions | discuss | ✓ | discuss.core (role-play / Socratic questioning) | companion stays in character; dilemma choices at key beats | 1.5 | ai_dialogue (mandatory) |
| S4 de-role debrief | reflect | ✓ | reflect.core (cognitive change), discuss.core (critique protocol) | explicit de-roling: separate the character's view from established facts | 1 | — |

Order: strict S1<S2<S3<S4 (S4 never skipped — prevent immersion without exit) · compose: none

---

## 13. Versioning & maintenance

- This file = v1.0 freeze candidate. Pattern changes ship as new versions; no hot-editing single patterns.
- Iteration signals (priority order): pattern_miss_log clusters > learner analytics (block drop-off, interaction abandonment, quiz failure clusters) > expert proposals. The CN teacher-side product's teacher_edits corpus is an additional cross-product validation source.
- Subject/level differences never enter this file — they live in the vocabulary's stage/subject tags (and future subject profiles). Patterns stay subject-agnostic.
