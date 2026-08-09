# Visual Language — theme tokens, typography, i18n

## Theme (Cursor-style dark, `xr-edu-agent/style.css`)

```css
:root {
  --bg-0: #0d0f13;   /* page          */
  --bg-1: #14171c;   /* panel surface */
  --bg-2: #1b1f26;   /* raised        */
  --bg-3: #232830;   /* hover/input   */
  --border: #2b313b;
  --text-0: #e8eaed; --text-1: #9aa3af; --text-2: #5f6875;
  --accent: #4a9eff; --accent-soft: rgba(74,158,255,.14);
  --green: #3fb96f;  --purple: #a878f0;  --danger: #e5534b;
  --radius: 8px;
  --font: "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}
```

Usage rules:

- Surfaces stack bg-0 → bg-3; separation by 1px `--border`, not shadows.
- Accent blue = interactive/focus; green = success/build-done rings/save state;
  purple = AI/agent flourishes; danger red = destructive + error rings.
- Radius 6–8px everywhere; no pill buttons except chips.
- Semantic section colors: vr/reading/h5/quiz badges each have a hue used in the
  outline tree and workspace headers — keep them consistent when adding section types.
- Learn mode: authoring chrome hidden via `body.learn-mode` CSS, right panel gets an
  accent border (companion emphasis).

## Typography & density

- Font scale via `html[data-ui-font="sm|md|lg"]` (settings); chrome scales with
  `zoom`, WebGL canvas unaffected.
- Chat and editors use the same `--font`; code/JSON in `monospace` blocks.
- In-3D text (canvas panels): panel titles ~28px bold on 512px-wide canvas, body
  lines ~22px — prompt rules keep generated text short enough not to overlap.

## i18n

- Default **English**; Chinese if `localStorage['xr-lang']==='zh'`. Toggle = top bar
  EN/中 → persist + full page reload (module-load-time strings), scene stashed to
  `xr-lang-stash` and auto-restored after reload (+ offer to AI-translate scene text).
- Three mechanisms: `t(key)` dict (UI chrome), `L(zh,en)` inline (content copy),
  `data-i18n/-title/-ph` (static DOM).
- **Generated content follows UI language, never material language**; orchestrator
  system prompts are fully language-locked per turn.
- Every new user-visible string must ship both languages (missing EN falls back to ZH
  in viewers, but don't rely on it).

## Iconography & affordances

- Emoji-as-icon system (📁 🧠 ▶ 🥽 ✎ …) — no icon font. Grey ✎ pens mark the ONLY
  click targets for renaming (avoids misclick-select ambiguity).
- Build-status rings on outline sections: hollow (pending) / spinner (running) /
  filled green ✓ (done) / red (error) — the same signal gates ▶ Start Learning.
- Tool cards in chat show bilingual `label(input)` summaries, not raw JSON.
