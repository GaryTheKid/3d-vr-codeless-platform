# 01 · Material Processing — PDF/Word → markdown + tagged figures

> Feature: teacher clicks 📎, uploads a document, and the material becomes
> agent-usable context (markdown + figure list with pedagogy tags).
> **Local-server-only**: there is no client-side parser; GitHub Pages cannot convert uploads.

## Code map

| Piece | Path |
|-------|------|
| HTTP server + all endpoints | `server.py` (repo root) |
| Docling conversion service | `services/docling_service.py` |
| Client upload + doc state + summary UI | `xr-edu-agent/js/agent/doc-context.js` |
| Upload button wiring, progress, errors | `xr-edu-agent/js/ui/chat.js` (~415–653) |
| Figure tagging (`enrichDocImages`) | `xr-edu-agent/js/agent/course-pipeline.js` (~73–314) |
| Tool wrapper `course_tag_figures` | `xr-edu-agent/js/agent/tools/course-pipeline-tools.js` |
| Context injection | `xr-edu-agent/js/agent/context.js` (appends `uploadedDocContextBlock()`) |

## Flow

```
📎 → handleDocUpload(file)                       [chat.js]
  → convertDocumentFile(file)                    [doc-context.js]
      File → base64 (chunked btoa) → POST /__doc/convert
  → server.py::_convert_document
      validate ext/size(≤40MB) → job_id = YYYYMMDD-HHMMSS-<8hex>
      → uploads/<jobId>/source.<ext>
      → DoclingService.convert_document
  → JSON { jobId, filename, markdown, markdownUrl, images[], charCount }
  → setUploadedDoc(...)   (in-memory singleton; lost on refresh)
  → doc bar (「据此备课」/remove) + LLM summary card (if hasLLM)
  → every agent turn: buildContextMessage() appends the doc block
  → 「据此备课」/ course tools → enrichDocImages → planning pipeline (doc 02)
```

## server.py endpoints

| Method / path | Role |
|---------------|------|
| `GET /*` | Static from repo root, `Cache-Control: no-store` |
| `POST /__doc/convert` | Docling convert (below) |
| `POST /__llm/{sonnet\|opus\|fable5\|messages}` | LLM proxy: `sk-ant…` → api.anthropic.com (fable5 aliased to opus-5); else AStone proxy. Streams. |
| `POST /__openai/images/generations` | OpenAI Images proxy (gpt-image; retries without `response_format` if rejected) |
| `POST /__log` | Append line to `logs/<session>.jsonl` |
| `POST /__export` | Write exported player HTML under `download/` |

Port: `PORT` env or 8000, binds **localhost only**. `server.py` does **not** read
`api-keys.txt` — keys are parsed in the browser (`llm.js parseApiKeysFile`, supports
`KEY=VALUE`, `Test API:` block → Anthropic key, `GPT API:` block → OpenAI key, and
bare keys classified by prefix `sk-ant-`/`cpx-`/`sk-`).

## Docling service

- Lazy converter init; `torch.compile` disabled (crashed on Chinese-locale Windows);
  OCR off unless `DOCLING_OCR=1`; `generate_picture_images=True`; page_batch=1.
- Extracts every `PictureItem` → `uploads/<jobId>/images/picture_NN.png`.
- `export_to_markdown(REFERENCED)`, then rewrites `![](…)` links to `/uploads/<jobId>/images/…`
  (gallery-append fallback if the markdown has no image slots — can mis-associate figures).
- `_attach_md_anchors`: each image gets `mdCharOffset` + `nearHeading`.

### On-disk job layout

```
uploads/<jobId>/          # gitignored; no meta.json — metadata lives in the HTTP response only
  source.pdf
  content.md
  images/picture_01.png …
```

## Client doc object

```js
{
  jobId, filename, markdown, markdownUrl,
  images: [{ id:'picture_01', filename, url, order, width?, height?,
             anchor:{ kind, order, mdCharOffset, nearHeading? },
             // added later by enrichDocImages:
             relevance, pedagogical, purpose, visualSummary, anchorNote, concepts[] }],
  charCount, summary?, imageFilterNote?
}
```

- `snapshotUploadedDoc()` deep-clones before a pipeline run so mid-run re-upload can't poison it.
- Context caps: markdown 24k chars in context (12k for summary source). Full text stays on disk at `markdownUrl`.

## Figure tagging (`enrichDocImages`)

1. Heuristic noise filter (`heuristicDecorativeImage`): name matches
   `logo|icon|badge|favicon|sprite|spacer|divider|button|avatar|qr.?code`, or w/h < 96,
   or area < 16000, or thin banner (h<48 && w>180) → `relevance:'noise'`.
2. Remaining figures go to a Claude vision call (up to 5 largest as base64, skip >~900KB)
   → per-figure `{ relevance: core|supporting|decorative|noise, purpose, visualSummary, concepts[] }`.
3. `pedagogical = relevance ∈ {core, supporting}`; only pedagogical figures reach planning.

**visualSummary matters**: the planner is required to extract KG nodes from core figures'
visualSummary (dense tables often hold the real syllabus) — see doc 02.

## Failure modes

| Failure | Behavior |
|---------|----------|
| Docling not installed | HTTP 503 → chat error + "run install_requirements.py" tip |
| Static host (Pages) | 404/405/HTML response → explicit "no Docling backend" error |
| Oversized file | 400 (>40MB; base64 adds ~33% in transit) |
| `course_tag_figures` via agent tool | Tags a **snapshot** — pipeline path mirrors tags back; ad-hoc turns may still see untagged images |
| Refresh | `uploadedDoc` memory lost; files remain under `uploads/` but are not reattached |
