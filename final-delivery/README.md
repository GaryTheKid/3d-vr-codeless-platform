# Final delivery — paper / presentation sources

| File | Role |
|------|------|
| [`XR-EduAgent-ACM-Style-Report.md`](./XR-EduAgent-ACM-Style-Report.md) | ACM-style course report source (system + study narrative) for the writing agent |
| [`N6-Study-Analysis.md`](./N6-Study-Analysis.md) | **N=6 full analysis** — learning gain, TLX/Likert, interview themes/quotes |
| [`_analysis_raw.json`](./_analysis_raw.json) | Machine-readable per-participant scores (MCQ auto; SA draft before manual adj.) |
| [`_analyze_study.py`](./_analyze_study.py) | Reproducible scoring script |

## Demo / presentation — agent pipeline visualizer

Open the **root** file (not this folder):

**[`../agent-pipeline.html`](../agent-pipeline.html)**

- Double-click it, or run `python server.py` from the repo root and visit `http://localhost:8000/agent-pipeline.html`
- Figma-style: drag to pan · scroll to zoom · no scrollbars · graph centered
- Expand overlays in place (overlapped nodes fade); lane tags follow columns horizontally only
- **▶ Demo**: pick route (create / modify / ask / full) · Prev/Next · Autoplay off by default · skill/tool popups keep playing on the current step
- Spine: Input → Turn → Context → Modes → Route → Authoring (Pedagogy Core above) → Outline → sections → Wrap-up

Skills/tools catalogs (same art style): [`../agent-skills.html`](../agent-skills.html) · [`../agent-tools.html`](../agent-tools.html).

Demo talk slides (intro / problem / study / close): [`../demo-talk-slides.html`](../demo-talk-slides.html) — ←→ / Space / click · `F` fullscreen.

Upstream docs: `/general/`, `/assets-recyclable/`, `/experiment-study/`, `/Agent.md`.
