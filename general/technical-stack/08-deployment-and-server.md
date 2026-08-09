# 08 · Deployment & Server — local dev, GitHub Pages, secrets

## Local development

```bash
# From the repo root — the ONLY supported way (xr-edu-agent/server.py is deprecated)
python server.py           # → http://localhost:8000/
```

Serves the whole repo statically **plus**: `/__doc/convert` (Docling),
`/__llm/*` (LLM proxy — required for `sk-ant` Test API keys), `/__openai/images/*`
(gpt-image proxy), `/__log` (jsonl logs), `/__export` (player HTML to `download/`).
Any static server also works, minus all of those. Must be http (ES modules) —
double-clicking `index.html` won't run.

Docling deps: `python install_requirements.py` (GPU torch preferred, CPU fallback).

## Secrets (`xr-edu-agent/api-keys.txt`, gitignored)

| Entry | Meaning |
|-------|---------|
| `LLM_PROVIDER=anthropic\|astone` | Provider pick (auto: Test API present → anthropic) |
| `Test API:` + `sk-ant-…` line | Anthropic key (needs local server proxy) |
| `CLAUDE_PROXY_API_KEY=cpx-…` | AStone China proxy key (works on static hosting) |
| `GPT API:` + `sk-…` line / `OPENAI_API_KEY=` | OpenAI Images (reading diagrams, companion draws) |

The app never calls Anthropic directly from page JS; a baked-in playtest `cpx` key
exists as fallback in `llm.js`. **Public static hosting cannot hide any shared key**
— testers can read request headers. Long-term options: proxy login sessions,
short-lived tokens, or per-tester revocable keys.

## GitHub Pages deployment

- Entry is repo-root `index.html` (importmap: React/HTM/Three from CDN) + `.nojekyll`.
- Settings → Pages → Deploy from a branch → `main` / `/ (root)`.
- **Two repos exist**: this workspace pushes to `GaryTheKid/Demo`; the live site
  `garythekid.github.io/3d-vr-codeless-platform` deploys from the identically-synced
  `3d-vr-codeless-platform` repo. Push to BOTH when deploying.

### What works where

| Capability | Local `server.py` | GitHub Pages |
|-----------|-------------------|--------------|
| App + 3D/VR + samples | ✅ | ✅ |
| AI via AStone (`cpx`) | ✅ | ✅ |
| AI via Anthropic (`sk-ant`) | ✅ (proxy) | ❌ |
| Doc upload / Docling | ✅ | ❌ (explicit error) |
| gpt-image generation | ✅ (proxy) | ❌ |
| Logs / export-to-folder | ✅ | in-memory / browser download |

### Deploy checklist & known traps (earned the hard way — pain-log P22)

1. After pushing, verify the **"pages build and deployment"** action went green —
   deploys DO fail (including platform-wide GitHub outages); the site silently stays
   on the previous build.
2. When someone reports "it broke again": first cache-bust-diff the live files
   against local (`?v=<ts>`), then check the Actions run, then GitHub status —
   only then suspect code.
3. Browser caching: sample packages are fetched with `no-cache` (ETag revalidation).
   Never reintroduce `force-cache` — it pins users to the first version they ever saw.
4. One hard refresh (Ctrl+Shift+F5) after a deploy flushes the 10-min JS cache.
5. If Pages was accidentally **Unpublished**: Settings → Pages → re-select branch
   (may need switching Source to GitHub Actions and back, or repo visibility toggle,
   to un-grey Save), then wait for the deploy run.

### Performance & limits on Pages

Pages is a static CDN — 3D perf is 100% client GPU; what matters is scene
complexity, not hosting. Soft limits: ~100GB/month bandwidth, repo <1GB (this repo
is ~1MB of source + a few MB of samples). First load pulls Three.js (~600KB) + ~30
modules from CDN; cached afterwards. Keep the authoring app multi-file (no bundler);
the single-file artifact is the student export player, not the app.

### Refreshing sample courses for deploy

```bash
python pre-built-samples/embed_pdf_images.py    # PDF figures → assets/ + sample-asset: tokens
python pre-built-samples/build_manifest.py      # recount manifest
```

## Study-test flags

Temporary study/playtest behavior goes through `STUDY_TEST_FLAGS`
(`xr-edu-agent/js/core/study-test-flags.js`) — never delete the normal path.
Current: `disableVrPlayerController: true` (orbit-only play; see doc 06).
User-study materials live in `experiment-study/` (RA run sheet + per-course
learning materials, quizzes, rubrics).
