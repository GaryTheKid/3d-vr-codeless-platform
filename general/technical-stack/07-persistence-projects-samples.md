# 07 · Persistence — Projects, .xrcourse Packages, Samples

> Feature: saving/loading courses (localStorage + on-disk folder), the `.xrcourse`
> single-file format, the working draft, and the built-in sample-course catalog.

## Code map

| Piece | Path |
|-------|------|
| Project CRUD + serialize/load + quota | `xr-edu-agent/js/core/projects.js` |
| Optional on-disk folder storage | `xr-edu-agent/js/core/project-fs.js` |
| Sample catalog + open | `xr-edu-agent/js/core/samples.js` |
| Figure-URL portability | `xr-edu-agent/js/core/sample-assets.js` |
| Projects overlay UI | `xr-edu-agent/js/ui/projects.js` |
| Sample data | `pre-built-samples/` (manifest.json + *.xrcourse + assets/ + build scripts) |

## The `.xrcourse` package (canonical format)

```js
{
  magic: 'XR-EDU-COURSE',       // legacy 'XR-EDU-SCENE' still imports
  version: 1, kind: 'course', name, exportedAt,
  scene,                        // live viewport JSON (convenience/legacy)
  cfg: {
    locomotion: { mode, allowedRadius, turnMode },
    outline: { version, course, chapters[], progress, activeSectionId },
      // sections carry their payloads: reading.chunks / h5.{html,prompt} /
      // quiz.items / vr.{scene,camera}  ← EVERY VR section's graph lives here
    knowledgeGraph: { nodes, edges, ahaKeys, … } | null,
  }
}
```

`serializeScene` (save path): flush live VR section → syncPanelSpec → stripUserData →
`toJSON` → **slimSnapshot** (see doc 04). Export player uses `{slim:false}`.

`loadSceneData` (every load path — sample open, project open, draft restore, file
import): validate → normalize outline → **`rewriteSampleAssetsInOutline`** (fix figure
URLs) → restore active VR scene with per-object salvage → revive builderCode →
`ensurePanelVisuals` → set outline/KG → bind live VR section.

## Storage tiers

| Tier | Mechanism | Notes |
|------|-----------|-------|
| localStorage `xr-projects` | Default library | ~5MB quota → slim snapshots + **eviction**: on QuotaExceeded, drop working draft/oldest projects, retry, then error |
| Working draft | `WORKING_DRAFT_ID='__working_draft__'` | Auto-stashed before open/new/import/sample; pinned with "Draft" badge |
| On-disk folder | `project-fs.js` (Chromium FS Access API) | `.xrcourse` files in a user-chosen folder |
| Download/import | `.xrcourse` file or export-player HTML (embeds `#xr-scene-source`) | Import gates: ≤25MB, magic+version, schema validation, user confirm incl. AI-code risk |

## Sample courses (`pre-built-samples/`)

- `manifest.json` lists courses (id/file/title/subject/sections/chapters);
  regenerate counts with `python pre-built-samples/build_manifest.py`.
- Five samples: Bio-Virus, Chem-VSEPR, Geo-Terrain, Mecha-Gear, Phys-Projectile Motion
  (sources in `experiment-study/learning materials/`).
- UI: projects overlay shows "Sample courses" (fetched catalog) above "My projects";
  opening fetches the package (`cache:'no-cache'` — **never** `force-cache`, it pins
  stale packages forever) and loads it without copying into the library; the current
  course is stashed as working draft first.

### Figure URL portability (`sample-assets.js`)

Sample HTML references figures as **`sample-asset:<course-id>/<file>` tokens**;
binary files live in `pre-built-samples/assets/<course-id>/`. On ANY course load,
`rewriteSampleAssetsInOutline` resolves tokens against the current deployment base
(works on localhost AND GitHub project pages) and **re-bases absolute asset URLs from
a different origin** (course saved on localhost → opened on Pages, and vice versa).
Regression history: pain-log P22.

Maintenance scripts in `pre-built-samples/`: `embed_pdf_images.py` (extract PDF
figures → assets + inject tokens), `scrub_panel_data.py` (strip zombie panelData
from packages), `build_manifest.py`.

## Invariants

1. Any new course-load path MUST go through `loadSceneData` (that's where figure-URL
   rewriting and panel repair live).
2. Never store canvas textures / functions in packages — JSON-safe mirrors only.
3. Keep import validation gates (size/magic/schema/confirm).
4. Sample packages must stay < ~1–2MB each (slimmed) or Pages loading degrades.
