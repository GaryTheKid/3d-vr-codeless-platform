# HCI / Agent-Design Principles — the interaction theories behind the product

> The pedagogy doc covers *what gets taught*; this covers *how teachers and
> the agent share control*. These principles are enforced across the codebase
> and should survive any refactor.

## 1. Teacher-in-control, agent-as-collaborator

The product serves **teachers with zero coding background**. Every agent
capability is designed so the teacher can see, understand, and override:

- **Natural-language Inspector** — clicking any 3D object shows its behavior
  as natural-language component cards (what it is / animation / interactions
  / cross-references), readable and editable by a non-programmer. Our 2026-07
  literature check found no prior art for "click a 3D object → NL abstraction
  of its functions → read & edit" (closest: LLMR, DreamCodeVR — both stay at
  the code level). This is the product's research-grade novelty.
- **Plan confirmation** — complex tasks show a plan card the teacher approves
  before execution.
- **Visible reasoning** — model thinking streams live (collapsible), so long
  waits are transparent rather than a black box.

## 2. Selection is context (multimodal deixis)

Whatever the teacher selects in the 3D scene *is* the agent's context —
pointing replaces describing ("Put-That-There" lineage, Bolt 1980; recent
validations: GazePointAR CHI'24, ASSISTVR TVCG'24, ISMAR'25). Multi-select
mirrors into context pins; a context chip's ✕ deselects. No separate "attach
to chat" step exists or should be added.

## 3. Non-destructive controls

A single UI control changes only its own semantics. Historical bug that
created this rule: a "self-spin" checkbox replaced the whole `anim` object
and silently killed a planet's orbit. Now spin is `anim.selfSpin`, a field —
never a wholesale replacement. Apply the same review to any new toggle.

## 4. Platform owns feedback; content owns results

- Hover glow, click flash, panel billboarding, in-room panel visibility —
  **platform runtime** (one implementation, consistent everywhere).
- What happens *after* an interaction (geometry changes, panel text, notify) —
  **content code** (AI-generated, per object).
- Device differences (PC mouse vs XR controller) converge in the platform's
  semantic-event layer (`activate/grab/drag/release`); AI code never binds
  raw input. This is what keeps one authored lesson working on desktop, in
  the exported player, and in VR.

## 5. Determinism where correctness matters

Two generation channels, chosen by consequence-of-error:

- **LLM-written code** (sandbox `T`) for creative objects — errors are local
  and visible.
- **Parametric builders** (rooms, stairs, paths, quiz panels) for structural
  correctness — doors always exist, steps stay ≤0.25 m, rails prevent falls.
  The model passes parameters; it never hand-writes this geometry.

## 6. Play/Edit duality with rollback

Edit mode is fully static (every click selects); Play runs animations and
interactions. Entering play deep-snapshots the scene; stopping restores it —
student interactions and spawned objects roll back like a game engine. The
agent editing mid-play refreshes the rollback baseline at end of turn.
(Note: we *first* rejected dual mode to reduce teacher cognitive load, then
reversed after real usage — recorded in `/assets-recyclable/pain-log.md` P8.)

## 7. Progressive disclosure for the agent itself

Skills are routed by description (Planner picks 2–3), and only selected
skill prompts enter the Executor. Tool descriptions carry hard rules so they
hold even when no skill was selected. Context scales down gracefully: small
scenes send full JSON; large scenes send a summary index + on-demand pull
tools + free lexical prefetch.

## 8. Trust boundaries

- The app never calls Anthropic directly — only the AStone China proxy
  (`https://astonelearning.com/api/v1/claude/*`); keys live in gitignored
  `api-keys.txt`.
- AI-written behavior code runs in a `new Function` sandbox (prototype-level
  isolation only — a Worker/iframe upgrade is acknowledged tech debt).
- Imports (`.xrcourse` / HTML) pass size, magic, schema validation and an
  explicit user confirm that mentions embedded AI code risk.

## 9. Bilingual by construction

Every user-visible string is bilingual (ZH/EN) via `t(key)` dictionaries,
`L(zh, en)` inline pairs, or `data-i18n` attributes. Generated-content
language follows the **UI language**, never the material language. Agent
system prompts are language-locked per turn.
