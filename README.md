# XR EduAgent — AI course builder for teachers (PDF → multimodal course)

A browser-based learning agent: a teacher uploads teaching material (or just
chats), and the AI authors a complete course — **Learning Outline** with
**3D/VR scenes, readings, 2D interactives (H5), and quizzes** — that students
then play through in learn mode, guided by an AI learning companion.

Built as a pure frontend (no build step): React shell + Three.js/WebXR +
Claude (via proxy), with a small Python server for local dev (Docling PDF
parsing, logging, image-generation proxy).

## Quick start

```bash
# From this folder
python server.py
# Open http://localhost:8000/
```

Optional AI keys: copy `xr-edu-agent/api-keys.example.txt` to
`xr-edu-agent/api-keys.txt` (gitignored) and fill in your proxy key.
Without keys the app still runs offline sample scenes.

## How this repo is organized

```
Agent.md              ← START HERE for AI coding agents: full project map + how to navigate docs
general/              ← the documentation tree Agent.md navigates
  technical-stack/    ←   per-feature engineering docs (material processing, outline pipeline,
                          reading/H5/quiz tools, 3D generation, skills & tools, learn mode, …)
  theories/           ←   the pedagogy & HCI principles that drove the design
  ui-design/          ←   layout and visual language
assets-recyclable/    ← portable gold: lessons, pain log, aha-keys manual, reusable prompts —
                        for building the NEXT education agent
xr-edu-agent/         ← the application code (js/agent, js/core, js/ui, js/scene, …)
pre-built-samples/    ← ready-made sample courses (+ their figure assets)
experiment-study/     ← user-study materials (run sheet, learning materials)
server.py             ← local dev server (static + Docling + LLM/image proxies + logs)
services/             ← document-processing service (PDF/Word → markdown + images)
index.html            ← entry (also the GitHub Pages entry)
```

## Working on this project with a coding agent

Point your agent at **[Agent.md](./Agent.md)**. It explains the whole system
(architecture, data model, pipelines) and links the right doc in `general/`
for any ask/add/change task, so the agent can execute without re-exploring
the codebase. Human-oriented context lives in the same docs — this README is
just the short version.

## Deploying for playtests

Push to GitHub → Settings → Pages → branch `main`, folder `/ (root)`.
Details (secrets, cache behavior, what breaks on static hosting):
[general/technical-stack/08-deployment-and-server.md](./general/technical-stack/08-deployment-and-server.md).
