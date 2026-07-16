# XR EduAgent — AI-assisted VR lesson authoring

A VR classroom builder for **teachers with no coding background**: describe a lesson in natural language and the AI builds an interactive Three.js / WebXR scene.

## Quick start

```bash
# From the repo root (this README's folder)
python server.py
# Open http://localhost:8000/
```

**GitHub Pages**: root `index.html` is the entry; app code lives under `xr-edu-agent/`. See [DEPLOY.md](DEPLOY.md).

**Dev docs**: [xr-edu-agent/README.md](xr-edu-agent/README.md) · [xr-edu-agent/AGENTS.md](xr-edu-agent/AGENTS.md)

## Repo layout

```
index.html              ← GitHub Pages entry (loads xr-edu-agent/)
server.py               ← local dev server (serves the whole repo root)
xr-edu-agent/
  react-main.js         ← React bootstrap
  main.js               ← Three.js / Agent runtime entry
  style.css
  js/                   ← core code
  api-keys.txt          ← local secrets (do not commit; see .gitignore)
```

## Client playtest

1. Push to GitHub → Settings → Pages → branch `main` / folder `/ (root)`
2. Open `https://<your-username>.github.io/<repo-name>/`
3. Proxy credentials are configured by the deployer; without them, offline demo scenes still work
