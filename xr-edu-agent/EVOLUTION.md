# EVOLUTION — From pure 3D/VR scene builder to multimodal course authoring

> **中文摘要**：本项目最初是「老师用自然语言搭 VR/3D 教学场景」的纯视口产品。之后逐步加上 **Learning Outline（章→节）**、**非 VR 节类型（阅读 / H5 / 测验）**、**文档上传（Docling）**、**大纲级 Agent 工具**，以及（规划中）**教学设计资产 + 知识图谱硬锚点 + 备课流水线**。本文记录相对「第一代纯 3D/VR」的全部产品与架构差异，供人与 Agent 对齐上下文。可视化：`js/agent/agent-viewer.html`（agent-map **v5**）。

---

## 0. Baseline: the first 3D/VR product

What the product **was** at the VR-first stage:

| Dimension | Original |
|-----------|----------|
| Core job | Build an interactive **Three.js / WebXR scene** by chat |
| Center pane | Always the **3D viewport** (gizmos, Play/Edit, Student View, VR enter) |
| Left rail | Projects · Assets · Hierarchy |
| Agent tools | Scene-only: build / edit / panel / query / env / space (~23 tools) |
| Context | Scene JSON (+ large-scene summary) + selection-as-context |
| “Lesson” | Implicitly = the scene itself (no chapter/section tree) |
| Materials | No PDF/Word ingest pipeline |
| Pedagogy | Soft guidance via skills (`pedagogy`, labs) — **no pattern library / action vocab** |

If a feature below is not listed here, it did not exist in that baseline.

---

## 1. Product shape diffs (teacher-facing)

### 1.1 Learning Outline (shipped)

- Two-level tree: **Course → Chapter → Section**
- Section **types**: `vr` | `reading` | `h5` | `quiz` (VR is now **one** section type, not the whole product)
- Left rail default tab: **Outline** (Projects overlay via 📁)
- Editable **course title**, **chapter name**, **section title**, **section purpose** with grey ✎ pens (edit ≠ select)
- Persisted on `ProjectData.cfg.outline`

### 1.2 Non-VR workspaces (shipped)

| Type | Center workspace | Content model |
|------|------------------|---------------|
| `vr` | Existing 3D viewport | Shared project scene |
| `reading` | Chunk editor | Ordered knowledge chunks: rich HTML (size/color/list/formula/image) + optional follow-up quiz |
| `h5` | Prompt → generate HTML | `prompt` / `html` / `status` + optional follow-up |
| `quiz` | Exam-style list | MCQ / short-answer items (prefer chapter end) |

When active section is non-VR: hide transform toolbar, status bar, Enter VR, inspector chrome (`body.ws-mode-non-vr`).

### 1.3 Document upload (shipped)

- Chat 📎 → Docling (`POST /__doc/convert`) → Markdown + images
- Summary card (UI language) + expandable overlay
- Attach to Agent context; does **not** alone rewrite the course
- “Build from this” / free-form ask still enter `runTurn`

### 1.4 Pedagogy assets (shipped as static files; runtime wiring planned)

Under `js/agent/pedagogy/` (copied from sibling learning-agent product):

| File | Role |
|------|------|
| `pattern_library_v1.0_en.md` | 24 teaching patterns (P00–P23); lookup by knowledge type K1–K7 × section role |
| `action_vocab_master_v2_en.json` | Sole editable action vocabulary (18 families) |
| `action_vocab_{elementary,middle,high}_en.json` | Generated level views — **never hand-edit** |
| `pdf_course_pipeline_v1.0_en.md` | Reference pipeline from the other product |

**Iron rules we keep**: actions only through pattern slots (`moves_from`); vocabulary is not a free block-type picker.

**Remap to our section types**:

| Sibling toolbox | Ours |
|-----------------|------|
| `interactive_3d` | `vr` |
| `interactive_2d` | `h5` |
| prose / explain | `reading` chunks |
| `quiz_*` | `quiz` section and/or per-chunk follow-up |
| `ai_dialogue` | follow-up / future companion (not a section type yet) |

### 1.5 Planned: Knowledge Graph hard anchor + authoring pipeline

Not coded yet; architecture locked (see agent-map nodes `knowledge-graph`, `course-pipeline`):

```
raw → Docling md → ① KG/MindMap → ② Outline skeleton → ③ pattern+slot per section
                 → ④ parallel section fill (fan-out, isolated context) → ⑤ Critic vs KG
```

Why: reduce strategy misalignment and missed sub-content when converting arbitrary materials into a full Outline.

---

## 2. Agent / architecture diffs

| Area | Baseline (3D/VR) | Now (v5) |
|------|------------------|----------|
| Tools | ~23 scene tools | **33** (+10 outline tools) |
| Tool groups | build/edit/panel/query/env/space | + **outline** |
| System prompt | Scene quality / Three.js | + Outline section-type routing (`reading_set_chunks` / `h5_set_content` / `quiz_set_items` / scene tools for `vr`) |
| Context | Scene + selection | + Outline tree + active section detail + uploaded doc (+ planned KG) |
| Workflow map | Scene-centric digraph | + `doc-ingest` / `outline` / `pedagogy` / `knowledge-graph` / `course-pipeline` |
| Skills | Unchanged registry | Still scene-oriented; course-design skills TBD when pipeline ships |
| Viewer | agent-map v≤3 | **v5**; new group color `course` |

### Outline tools (new)

`outline_get` · `outline_set_active` · `outline_update_course` · `outline_update_chapter` · `outline_update_section` · `outline_add_chapter` · `outline_add_section` · `reading_set_chunks` · `h5_set_content` · `quiz_set_items`

---

## 3. What stayed the same (do not regress)

- Pure frontend, no build step; Three.js / WebXR scene stack
- Ask / Plan / Agent orchestration, prompt caching, skills progressive disclosure
- Scene tools, sandbox `T`, export single-file player, projects library
- Spatiality discipline for 3D: **VR remains the costliest tool** — only when the concept has intrinsic spatial structure (same idea as the sibling pipeline’s spatiality test)

---

## 4. Doc & viewer index

| Doc | Purpose |
|-----|---------|
| [README.md](./README.md) | Human quick start (updated for Outline / multimodal) |
| [AGENTS.md](./AGENTS.md) | Agent maintainer map |
| [TODO.md](./TODO.md) | Roadmap including KG pipeline |
| [js/agent/README.md](./js/agent/README.md) | Sync rules for viewers / tools / skills |
| [js/agent/pedagogy/](./js/agent/pedagogy/) | Pattern library + vocab + reference pipeline |
| **This file** | Diffs vs first 3D/VR product |
| `js/agent/agent-viewer*.html` | Live workflow / tools / skills maps |

---

## 5. Changelog of divergence (by theme, not commit)

1. **Outline model + UI** — course is a tree; VR is a section type  
2. **Reading / H5 / Quiz editors** — multimodal authoring in the center pane  
3. **Non-VR chrome policy** — hide gizmos / VR enter when not in a VR section  
4. **Docling ingest** — materials enter context as md + images + summary  
5. **Outline Agent tools + system prompt alignment**  
6. **Pedagogy static assets landed** (config-only until pipeline wires them)  
7. **Planned KG → strategy → fan-out fill** (agent-map v5 documents the target graph)

When implementing the planned pipeline, update this file’s §1.5 from “planned” to “shipped” and bump agent-map `meta.version`.
