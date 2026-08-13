# Keyi — CS6180 final delivery

**Keyi** is a pedagogy-first multimodal learning-experience builder: material → Aha keys → knowledge graph → outline → Reading / H5 / 3D / Quiz.

## Paper & demo video

| Artifact | What | Link / path |
|----------|------|-------------|
| Paper (PDF) | Course report (ACM-style) | [`CS6180_GenAI_FinalProject_3D_Codeless_Learning.pdf`](./CS6180_GenAI_FinalProject_3D_Codeless_Learning.pdf) |
| Demo video | Full walkthrough | [`DemoVideoURL.md`](./DemoVideoURL.md) · local copy: [`6180FinalVideoDemo.mp4`](./6180FinalVideoDemo.mp4) |

## Codebase

For code and technical detail, go to the **repo root** and read [`../../README.md`](../../README.md) and [`../../Agent.md`](../../Agent.md).

## Agent pipeline visualizer

File: [`../../agent-pipeline.html`](../../agent-pipeline.html) (repo root).

Open by **double-click** locally (or from repo root: `python server.py` → `/agent-pipeline.html`). Drag to pan, scroll to zoom, click **▸** to expand, **▶ Demo** to walk the pipeline. Skills / Tools: [`../../agent-skills.html`](../../agent-skills.html), [`../../agent-tools.html`](../../agent-tools.html).

## Supplementary — coverage-contract audit

The paper claims every section declares `covers[]` / `installsAha[]` against the knowledge graph. [`audit_coverage_contracts.py`](./audit_coverage_contracts.py) is the short check: it walks the five sample `.xrcourse` packs and reports pass rates (covers ids in KG nodes, installsAha ids in aha keys, every aha installed ≥1×, reading+quiz present, interactive installer share).

```bash
python audit_coverage_contracts.py
```

This is an **as-shipped** structural audit of saved packages, not a learner study and not a content-quality judge. Unknown `installsAha` ids are dropped and orphan ahas are patched at bind time (`applyKgAndOutline`), so those two rates on saved files are post-repair. `covers[]` is not filtered — dangling covers would show here.
