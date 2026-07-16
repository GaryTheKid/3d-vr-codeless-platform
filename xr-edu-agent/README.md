# XR EduAgent — AI-assisted VR lesson authoring

A VR classroom builder for **teachers with no coding background**: like Cursor for code, but natural language “writes” a lesson that runs in a VR headset.

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

**VR preview:** with Quest Link to a PC, in Chrome/Edge click top-right **🥽 Enter VR preview**.

**UI language:** top bar **EN/中** toggles Simplified Chinese / English (full-page reload; UI, templates, labs, and Agent language all follow). After switch, you can ask the AI to translate in-scene text too.

## UI (three panes, Cursor-like)

| Area | Role |
|------|------|
| **Left · Projects** | Browser-local project library: new (empty scene) / copy / rename / delete; click a card to open (current = blue); top **💾 Save** writes the current project; **📥 Import HTML** reloads a previously downloaded scene (format + safety checks) |
| **Left · Assets** | Categorized STEM teaching assets; drag into the viewport or double-click |
| **Left · Hierarchy** | All scene objects; ▸ expands **NL components** (anim / interact / panel, toggle & edit); bottom foldout = virtual objects (camera, lights, lab controllers); **selection is context** — selected objects (Shift multi-select) enter the AI context automatically |
| **Center · Viewport** | Unity-like Scene view: pick (Shift multi-select transforms as a group), gizmos (W/E/R), focus (F), delete (Del); **▶ Play / Edit** — Edit is fully static (click = select); Play runs anim + student interaction, WASD drives the student avatar, stop restores the scene (entering VR forces Play); 🧍 **Student View** proxy sets spawn & facing; PiP lower-right shows what students see; inspector shows purpose / anim / links plus a per-object AI command box |
| **Right · AI** | **Ask** (Q&A only) / **Plan** (confirm then run) / **Agent** (act); Sonnet / Opus / Fable + thinking effort (**Auto** preset or Low/Med/High) |

## What the AI can do

- **Read the scene**: every turn carries scene state; large scenes (>20 objects) use summary index + relevance prefetch; AI pulls detail with search tools
- **One-shot whole lessons**: e.g. oxygen prep lab → apparatus + steps + failure branches
- **Code what the library lacks**: `create_custom_object` writes Three.js for fine models and custom interaction (state machines + check-point branches)
- **Walkable spatial classrooms**: rooms / multi-floor + stairs / guide paths via deterministic tools; conditional unlocks, quiz panels, temporary tips
- **One-line edits**: “make Earth larger”, “fix the verify step”
- **Plan confirmation**: complex work shows a step plan before execution
- **Skill-routed execution**: domain skills load per task (layout / panels / animation / validation / debugging…)

## Sample scenes (offline-capable)

Solar system · Oxygen prep (incl. “douse lamp first → suck-back explosion” branch) · Cafe English ordering (NPC + mic) · Chemistry lab · DNA helix · Pendulum compare · Polyhedra · Inclined planes

## Project layout (see AGENTS.md for detail)

```
index.html                  GitHub Pages / local entry (repo root; loads xr-edu-agent/)
server.py                   Local dev server (repo root)
xr-edu-agent/
  react-main.js             React createRoot + deferred runtime load
  main.js                   Three.js / Agent runtime wiring
  style.css
  js/ui/react-app.js        React shell (TopBar / LeftPanel / Viewport / RightPanel)
  js/core/                  Scene, state, events, render loop
  js/assets/                Asset builders + AssetSkill registry
  js/panels/                3D teaching panels
  js/labs/                  Chem / English / scenario templates
  js/scene/                 Scene object managers
  js/ui/                    Projects / library / hierarchy / viewport / chat
  js/agent/                 LLM / orchestrator + skills/ + tools/
  api-keys.txt              Local secrets (do not commit)
  TODO.md / AGENTS.md
```

## Save / Download / Import

- **💾 Save**: browser project library (left **📁 Projects**); Chrome/Edge users can **📂 Choose project folder** for on-disk `.xrscene` files
- **⬇ Download**: export a **single HTML** student player (`python server.py` also writes `download/`; on Pages, browser download). Students open it, click/drag, arrow-walk, or ENTER VR. Custom models/anim/interaction ship with the file; built-in lab state machines need the editor. CDN Three.js needs network on first open
- **📥 Import**: exported HTML embeds scene JSON; import from **📁 Projects** (size/format/structure checks + code-risk confirm)

## Deploy for playtest

See repo-root [DEPLOY.md](../DEPLOY.md): root `index.html` + GitHub Pages **root**.

## Current limits

- LLM only via AStone Claude proxy; GitHub Pages cannot safely embed a shared proxy key — use per-user keys, short-lived tokens, or a login session
- Projects default to localStorage (clearing site data loses them; use ⬇ Download for important work); Share is a stub; no user accounts / DB
- English cafe detects mic volume only — no STT/TTS yet
- Offline NL component parsing only understands numbers and color words; with LLM, the model understands freer language
