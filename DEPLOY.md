# Deploy to GitHub Pages (client playtest)

The entry is the **repo-root** `index.html`; app code lives under `xr-edu-agent/`. Point GitHub Pages at **root** — you do not need to flatten everything into the root.

## One-shot deploy

```bash
# From the repo root (Demo/)
git add .
git commit -m "Deploy: root index.html for GitHub Pages"
git push origin main
```

1. GitHub repo → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` / **Folder**: `/ (root)`
4. Open: `https://YOUR_ORG.github.io/YOUR_REPO/` (not `/YOUR_REPO/xr-edu-agent/`)

Already at root:

- `index.html` — loads React/HTM and `xr-edu-agent/react-main.js`
- `.nojekyll` — disables Jekyll

## Local development (same layout as Pages)

```bash
python server.py    # run from the repo root
# → http://localhost:8000/
```

**Do not** run the old `xr-edu-agent/server.py` alone (deprecated; redirect note only).

## Secrets

- `xr-edu-agent/api-keys.txt` is gitignored and must not be committed
- The app only calls `https://astonelearning.com/api/v1/claude/{sonnet|opus|fable5}` — never Anthropic directly
- The public playtest UI has no API-key settings button; credentials are configured by the deployer
- Locally: copy `xr-edu-agent/api-keys.example.txt` to `api-keys.txt` and set `CLAUDE_PROXY_API_KEY`

### Important security limits

GitHub Pages is a public static front end. Putting a shared proxy key in JS, HTML, a GitHub Secret, or a build artifact **cannot** keep it private — testers can read `x-api-key` in DevTools Network. Removing the settings button does not change that.

For “open and use” without exposing a shared key, the proxy must do one of:

1. Login on `astonelearning.com`, then authenticate with an HttpOnly session cookie;
2. A backend that issues short-lived, rate-limited, origin-bound tokens;
3. Per-tester revocable / rate-limited `cpx-…` keys.

The proxy must also allow CORS `OPTIONS` / `POST` and the `x-api-key` header from the GitHub Pages origin.

## Server features unavailable on GitHub Pages

| Feature | Root `python server.py` | GitHub Pages |
|---------|-------------------------|--------------|
| Static pages / 3D / VR | ✅ | ✅ |
| AI (with key configured) | ✅ | ✅ |
| Logs `logs/*.jsonl` | ✅ | ❌ |
| Export write to `download/` | ✅ | ❌ (browser download) |

More detail (performance, client tips) is in [xr-edu-agent/DEPLOY.md](xr-edu-agent/DEPLOY.md).
