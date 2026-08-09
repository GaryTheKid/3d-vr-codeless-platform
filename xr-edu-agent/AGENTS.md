# AGENTS.md — pointer

All project documentation moved to the **repo root**:

- **`/Agent.md`** — master guide for AI coding agents (mental model, task router, hard rules, extension recipes)
- **`/general/`** — per-feature engineering docs, theories, UI design
- **`/assets-recyclable/`** — portable lessons, pain log, aha-keys manual, reusable prompts

Read `/Agent.md` first. The only doc that stays code-adjacent is
`js/agent/README.md` (agent-map / viewer sync rules — mandatory after any
skills/tools/workflow change).

Quick invariants (full list in `/Agent.md` §3): no build step; one live scene graph
(VR fills serial); JSON-safe persistence only; structural agent writes need
`requested_by_teacher`; bilingual user-visible copy; sync `agent-map.js`;
generous thinking budgets (check `stop_reason`); never commit `api-keys.txt`.
