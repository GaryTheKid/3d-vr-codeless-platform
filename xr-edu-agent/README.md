# XR EduAgent — AI-assisted multimodal lesson authoring

A classroom builder for **teachers with no coding background**: natural language (and uploaded materials) author a **Learning Outline** — chapters and sections that can be **3D/VR scenes**, **reading**, **2D H5 interactives**, or **quizzes**. The original product was VR-scene-only; see [EVOLUTION.md](./EVOLUTION.md) for the full diff.

## Quick start

```bash
# Recommended: run from the repo root (same layout as GitHub Pages; entry = /index.html)
python server.py

# The old xr-edu-agent/server.py path is deprecated; use the root server.py

# Any static server also works (logs fall back to an in-browser buffer; console __xrExportLog() to export)
npx serve .
python -m http.server 8000
```

Open `http://localhost:8000/` (root `index.html`). **Must be served over http** (ES modules + WebXR) — double-clicking `index.html` will not work.

**Enable real AI (optional):** copy `api-keys.example.txt` to `api-keys.txt` and set
`CLAUDE_PROXY_API_KEY`.
The app only talks to the AStone Learning China proxy — never Anthropic directly. Without a key it still runs: built-in keyword rules simulate the Agent for sample scenes.

**VR preview:** only meaningful on a **VR section**; with Quest Link to a PC, in Chrome/Edge click top-right **🥽 Enter VR preview**.

**UI language:** top bar **EN/中** toggles Simplified Chinese / English (full-page reload; UI, templates, labs, and Agent language all follow). After switch, you can ask the AI to translate in-scene text too.

## UI (three panes, Cursor-like)

| Area | Role |
|------|------|
| **Left · Outline** | Default tab: course title / chapters / sections (`vr` · `reading` · `h5` · `quiz`); grey ✎ edits names & purpose; 📁 opens the projects overlay |
| **Left · Assets** | Categorized STEM teaching assets; drag into the viewport or double-click (**VR sections**) |
| **Left · Hierarchy** | All scene objects; ▸ expands **NL components**; **selection is context** |
| **Center · Workspace** | **VR section** → Unity-like 3D viewport (Play/Edit, gizmos, Student View, PiP). **Reading / H5 / Quiz** → dedicated editors (transform toolbar & Enter VR hidden) |
| **Right · AI** | **Ask** / **Plan** / **Agent**; Sonnet / Opus / Fable + thinking effort; 📎 upload PDF/Word for Docling → md + images in context |

## What the AI can do

- **Course structure**: read/update Learning Outline (`outline_*` tools); fill reading chunks / H5 / quiz items
- **Read the scene**: every turn carries scene state; large scenes use summary + prefetch
- **One-shot VR lessons**: e.g. oxygen prep lab → apparatus + steps + failure branches
- **Code what the library lacks**: `create_custom_object` writes Three.js
- **Walkable spatial classrooms**: rooms / stairs / guide paths via deterministic tools
- **Materials**: attach uploaded docs; (planned) Knowledge Graph → pattern strategy → parallel section fill — see EVOLUTION.md & agent-map v5

## Sample scenes (offline-capable)

Solar system · Oxygen prep · Cafe English · Chemistry lab · DNA helix · Pendulum · Polyhedra · Inclined planes

## Project layout (see AGENTS.md for detail)

```
index.html                  GitHub Pages / local entry (repo root; loads xr-edu-agent/)
server.py                   Local dev server (repo root)
xr-edu-agent/
  EVOLUTION.md              Diffs vs the original pure 3D/VR product
  react-main.js / main.js
  js/ui/                    Outline + section workspaces + chat / viewport…
  js/core/outline.js        Learning Outline model
  js/agent/                 Orchestrator + skills/ + tools/ (+ outline-tools)
  js/agent/pedagogy/        Pattern library + action vocab (static)
  js/agent/agent-viewer*.html
  TODO.md / AGENTS.md
```

## Save / Download / Import

- **💾 Save**: browser project library (📁 overlay); Chrome/Edge can use an on-disk folder for `.xrscene`
- **⬇ Download**: single HTML student player (VR/scene content; Outline payloads ride in project cfg)
- **📥 Import**: from Projects overlay

## Deploy for playtest

See repo-root [DEPLOY.md](../DEPLOY.md).

## Docs

- [EVOLUTION.md](./EVOLUTION.md) — **what changed since pure 3D/VR**
- [AGENTS.md](./AGENTS.md) — maintainer map for coding agents
- [js/agent/README.md](./js/agent/README.md) — sync agent-map / viewers after Agent changes
- Double-click `js/agent/agent-viewer.html` for the **v5** workflow graph

## Current limits

- LLM only via AStone Claude proxy; GitHub Pages cannot safely embed a shared proxy key
- Projects default to localStorage; Share is a stub
- Course-from-PDF **Knowledge Graph + pattern pipeline** not coded yet (assets + architecture only)
- Offline NL component parsing is limited; English cafe = mic volume only
