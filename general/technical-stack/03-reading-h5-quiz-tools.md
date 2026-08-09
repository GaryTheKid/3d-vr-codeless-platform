# 03 · Reading / H5 / Quiz Section Tools

> Feature: the three non-3D section types — how they're generated, edited, rendered
> for learners, and graded.

## Code map

| Piece | Path |
|-------|------|
| Fillers (`fillReadingSection` / `fillH5Section` / `fillQuizSection`) | `xr-edu-agent/js/agent/course-pipeline.js` (~748–1183) |
| Editors + learner rendering | `xr-edu-agent/js/ui/section-workspaces.js` |
| Learner question widget + grading | `xr-edu-agent/js/ui/learner-quiz.js` |
| Data shapes / factories | `xr-edu-agent/js/core/outline.js` (`createReadingChunk`, `createQuizItem`) |
| Direct agent tools | `reading_set_chunks` / `h5_set_content` / `quiz_set_items` in `js/agent/tools/outline-tools.js` |
| Generated diagrams | `xr-edu-agent/js/agent/openai-images.js` (gpt-image via `/__openai` proxy) |

## Data shapes

```js
// reading
section.reading = { chunks: [{ id, title, html, imagePrompt?,
  followUp: null | { enabled, type:'mcq'|'short', question, options[], answer, explanation } }] }

// h5
section.h5 = { prompt, html, status:'idle'|'ready'|…, followUp,
               interactionKind?: 'process'|'condition'|'matching'|'explore'|'predict' }

// quiz
section.quiz = { items: [{ id, type:'mcq'|'short', question, options[], answer, explanation }] }
```

All three setters (tool or pipeline) stamp `buildStatus:'done'` when content lands —
this feeds the outline rings and the Start-Learning gate.

## Reading

**Generation** (`fillReadingSection`):
1. LLM JSON → 4–10 small chunks; aha rule: build toward the insight, name the
   misconception, followUps must re-skin the context.
2. Sparse followUps → synthetic short-answer ones added.
3. `injectSourceFiguresIntoChunks` — PDF figures matched into chunk HTML
   (`<figure class="ws-pedagogy-fig">` + `sample-asset:`/absolute URLs).
4. `enrichReadingChunksWithImages` — optional gpt-image diagrams (≤4/section, soft ≥1;
   prompt seeded from `imagePrompt` or the first aha's insight+misconception).
   Failure never blocks the section.

**Editing**: contenteditable chunk editor with rich-text toolbar + followUp editor.
**Learner**: read-only HTML; followUps mount via `mountLearnerQuestion`.

## H5 (2D interactive)

**Generation** (`fillH5Section`): plan JSON first (no HTML), then
`generateH5HtmlBody`, then interactivity/truncation retries; final fallback is a
simple select/tip widget. Construct rule: student manipulates → outcome contradicts
the misconception; never just display the conclusion.

**Display**: sandboxed iframe (`sandbox="allow-scripts allow-same-origin"`), content
via `srcdoc` (`wrapH5Srcdoc`). **Auto-height**: the wrapper posts
`{type:'xr-h5-height'}` messages (ResizeObserver inside), clamped 120–6000px —
no inner scrolling. Media URLs resolved by `resolveAppMediaUrl` (handles
`sample-asset:` tokens and GitHub-Pages base paths).

## Quiz

**Generation** (`fillQuizSection`): 2–5 items, ≥1 short answer; **AHA TRANSFER** —
≥1 item per relevant aha in a brand-new surface story; distractors embody the
misconception; only probe covered KG nodes.

**Grading** (`learner-quiz.js`, shared by quiz items and reading/H5 followUps):

| Type | Path |
|------|------|
| MCQ | Local: index/text match; lock choice; wrong → tip event |
| Short | Normalize/near match → else **LLM grade** (`callClaude`, JSON `{ok, feedback}`; hint without revealing the answer) → else substring fallback |

Wrong answers emit `learner-companion-tip` → the learning companion chat shows an
encouraging tip (template text, no extra LLM call).

## Invariants

1. H5 must be genuinely interactive — "static flyer" HTML is treated as failure
   (retry ladder + `course-h5` skill enforce this).
2. FollowUps prefer short-answer (they grade transfer, not recognition).
3. Reading images: PDF figures first, generated images second, none is acceptable.
4. Everything user-visible bilingual-ready; generation language = UI language.
5. Content setters must keep `buildStatus` accurate — the green gate depends on it.
