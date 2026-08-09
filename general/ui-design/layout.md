# UI Layout — regions, owners, mode switching

> Cursor-like three-pane shell. React (CDN + HTM, no build) renders the declarative
> chrome once; imperative controller modules bind to stable DOM ids afterwards.
> **The DOM ids/classes are a compatibility contract** — renaming them breaks controllers.

## Bootstrap chain

```
/index.html (importmap: react/react-dom/htm/three CDN)
  → xr-edu-agent/react-main.js  (flushSync render <App/>)
    → js/ui/react-app.js        (TopBar/LeftPanel/Viewport/RightPanel/overlays)
      App.useEffect → dynamic import('../../main.js')   ← only after DOM ids exist
        → main.js: import UI controllers (side-effect binding) → startLoop/setupXR
          → loadApiKeys → welcome + default scene
```

## Region map

| Region | DOM | Owner module | Content |
|--------|-----|--------------|---------|
| Top bar | `#topbar` | `react-app.js` + `ui/projects.js`/`settings.js`/`main.js` | 📁 projects, save, download, share, EN/中, font size, VR |
| Left · Outline (default tab) | `#panel-outline` | `ui/outline.js` | Course → chapters → sections tree; ✎ pens; build-status rings; KG entry; ▶ Start Learning |
| Left · Assets | `#panel-assets` | `ui/library.js` | Draggable STEM prefab catalog (VR sections only) |
| Left · Hierarchy | `#panel-hierarchy` | `ui/hierarchy.js` | Scene objects + natural-language component cards; selection = context |
| Center · 3D viewport | `#viewport` | `ui/viewport.js`, `core/three-setup.js`, `core/loop.js` | Edit/Play, gizmos, PiP student view, XR |
| Center · workspaces | `#ws-reading` / `#ws-h5` / `#ws-quiz` | `ui/section-workspaces.js` | Editors (author) / learner views (learn mode) — overlaid above the always-mounted WebGL canvas |
| Right · chat | `#right-panel` | `ui/chat.js` + `agent/orchestrator.js` | Ask/Plan/Agent modes, model+effort pickers, plan cards, tool cards, thinking blocks, doc bar |
| Overlays | `#projects-overlay`, `#kg-overlay`, settings popover | `ui/projects.js`, `ui/kg-viewer.js`, `ui/settings.js` | Library+samples, knowledge graph, settings |

## Mode switching

Three orthogonal mode axes:

1. **Section type** (`outline.js syncWorkspace`): vr → 3D viewport visible; reading/
   h5/quiz → workspace panel overlays it. Non-VR adds `body.ws-mode-non-vr` (hides
   transform toolbar, Enter VR, inspector chrome). The WebGL canvas never unmounts
   (unmount/remount caused black-screen resize bugs).
2. **Edit / Play** (`state.playMode`, ▶): edit = fully static, click selects;
   play = animations + semantic interactions, deep snapshot on enter, restore on stop.
3. **Author / Learn** (`state.learnMode`, `ui/learn-mode.js`): `body.learn-mode`
   strips authoring chrome; right rail becomes the learning companion (Ask locked);
   workspaces render learner views. Gated by all-sections-green.

## Chat UI anatomy (`ui/chat.js`)

Streaming message handles; collapsible 🧠 thinking blocks (one per tool round);
plan-confirm card; tool cards with bilingual labels; context chips = current
selection (✕ deselects); turn stats (time + cost); doc bar with 「据此备课」.

## Layout conventions when adding UI

- New chrome goes into `react-app.js` (declarative, stable id) + a controller module
  that binds by id; never `document.createElement` chrome ad hoc in controllers.
- All copy bilingual: `data-i18n` for static DOM, `t()`/`L()` in JS.
- Overlays: single shared pattern — fixed backdrop + centered panel + Esc/✕ close.
- Settings/gear popovers anchor to the trigger button, not the viewport center.
