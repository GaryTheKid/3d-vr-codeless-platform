# Deploy to GitHub Pages (client playtest)

This prototype does **not** need to be bundled into a single `index.html`. The repo is ~**0.8 MB** of source — a normal static site: `index.html` + ES Modules + Three.js from a CDN. GitHub Pages serving those files over HTTPS is essentially the same experience as local `python server.py`.

## Why not merge into one index.html?

| Approach | Pros | Cons |
|----------|------|------|
| **Multi-file (recommended)** | Easy to maintain / diff, parallel cacheable loads, matches local dev | First visit ~30+ small requests (fast under HTTP/2) |
| **Single-file bundle** | One HTML file | Needs Webpack/Vite, 2–5 MB+, rebuild on every change, harder to debug |

The **single-file HTML player for students** is already produced by the editor’s **⬇ Download** button. The teacher **authoring app** is better left multi-file.

## One-shot deploy

### 1. Create a GitHub repo and push

```bash
# From the repo root (Demo/, the folder that contains index.html)
git add .
git commit -m "Initial prototype for client play-testing"
git push origin main
```

**Never commit** `xr-edu-agent/api-keys.txt` (listed in the root `.gitignore`).

### 2. Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` / **Folder**: `/ (root)`
4. After save, open: `https://YOUR_ORG.github.io/YOUR_REPO/` (root `index.html` is the home page)

Root already has `index.html` and `.nojekyll`. App code lives under `xr-edu-agent/` — you do **not** need to move everything to root.

Keep `pre-built-samples/` at the repo root: it holds the ready-made `.xrcourse` packages the Projects panel lists, fetched only when a participant opens one. To add or replace a sample, drop the `.xrcourse` in that folder and run `python pre-built-samples/build_manifest.py`.

PDF figures for those samples live in `pre-built-samples/assets/<course-id>/` (referenced from course HTML as `sample-asset:…` and rewritten to real URLs on open — this keeps GitHub project-page base paths correct). To refresh figures from the study PDFs:

```bash
python pre-built-samples/embed_pdf_images.py
python pre-built-samples/build_manifest.py
``` If the package still references local Docling paths (`/uploads/...` or `localhost`), run `python pre-built-samples/embed_sample_images.py` first so reading/H5 figures become self-contained data URIs (required for GitHub Pages).

### 3. Client tips

- **Browser**: Chrome or Edge (recommended: WebXR + local project folder)
- **Start here**: **📁 Projects** → **Sample courses** — five finished courses (Physics / Chemistry / Biology / Geoscience / Mechanical) open in one click, no PDF conversion and no AI key needed
- **AI**: configured by the deployer; the playtest UI has no Key settings button
- **No Key**: offline demo still works (keyword rules build sample scenes)
- **Saving projects**:
  - Default: browser localStorage (simple; clearing site data loses projects)
  - Recommended: Left **📁 Projects** → **📂 Choose project folder** → projects as on-disk `.xrscene` files
- **VR**: Quest Link + Chrome/Edge → **🥽 Enter VR preview**
- **Export for students**: **⬇ Download** → single HTML (needs network once for the Three.js CDN)

### 4. Features unavailable on GitHub Pages

| Feature | Local `server.py` | GitHub Pages |
|---------|-------------------|--------------|
| Static page / 3D / VR | ✅ | ✅ |
| AI Agent (key configured) | ✅ | ✅ |
| PDF/Word upload (`POST /__doc/convert` + Docling) | ✅ | ❌ (static host → HTTP 405; open a **sample course** instead, or run local `server.py`) |
| OpenAI image proxy (`/__openai/…`) | ✅ | ❌ (needs `server.py` or your own proxy) |
| Structured logs `logs/*.jsonl` | ✅ | ❌ (memory fallback) |
| Export write to `download/` | ✅ | ❌ (browser download) |
| Auto-load `api-keys.txt` | ✅ | ❌ (deployer proxy auth) |

## Does GitHub limit 3D performance?

**Mostly no.** GitHub Pages is only a **static CDN** — it does not render 3D:

- **FPS / WebGL / animation**: 100% on the client GPU and browser; host location irrelevant
- **Bandwidth**: free accounts soft-cap ~**100 GB/month** (plenty for a playtest); beyond that may throttle, not delete the repo
- **Repo size**: keep under 1 GB; this prototype is under 1 MB
- **Single-file size**: keep under 100 MB; this repo has no large assets
- **First-load latency**: mainly **Three.js on jsDelivr CDN** (~600 KB) plus ~30 JS modules; later visits are fast once cached
- **Concurrency**: Pages has no hard “simultaneous users” cap; heavy traffic may be slower but does not change single-client 3D perf

What actually matters: **client GPU, Quest standalone vs Link, scene complexity (object/poly count)** — not GitHub.

## Local project folder (implemented)

Left **📁 Projects** → **📂 Choose project folder**:

1. Browser prompts for permission (Chrome/Edge File System Access API)
2. Pick a directory, e.g. `Documents/XR-EduAgent-Projects/`
3. Each save writes `{project-name}.xrscene` JSON
4. After reload, the browser re-requests access to the same folder (handle in IndexedDB)

Better than localStorage for long-term teacher use: backup, cloud sync, version control. Safari/Firefox lack the API — the button is hidden and localStorage remains.

## Private / backend production (future)

For server-side logs, a managed API proxy, or user accounts, deploy on your own VPS / Cloudflare Pages + Workers — not public GitHub Pages. **Never** put secrets in a public repo.
