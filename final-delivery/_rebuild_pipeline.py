# -*- coding: utf-8 -*-
"""Rebuild agent-pipeline.html with polish pass."""
from pathlib import Path

ROOT = Path(r"E:\创业\XR+AI\Demo")
src = (ROOT / "agent-pipeline.html").read_text(encoding="utf-8")

def extract_block(start_marker, end_marker):
    a = src.index(start_marker)
    b = src.index(end_marker, a)
    return src[a:b]

# Only data tables — not old layout/runtime helpers
GROUP = extract_block("const GROUP = {", "/** @type {Array<object>} */").rstrip() + "\n\n"
NODES = extract_block("const NODES = [", "/** Orthogonal edges only").rstrip() + "\n\n"
EDGES = extract_block("const EDGES = [", "const byId = ").rstrip() + "\n\n"
SKILLS = extract_block("// ── Real skill / tool catalogs", "/**\n * Demo rounds")
# SKILLS starts with comment through NODE_CALLS end — trim trailing whitespace
# Actually marker includes through Demo rounds start; extract_block ends at Demo rounds
SKILLS = src[src.index("// ── Real skill / tool catalogs"): src.index("/**\n * Demo rounds")].rstrip() + "\n\n"

DATA = GROUP + "/** @type {Array<object>} */\n" + NODES + EDGES + SKILLS

# Fix pedagogy edge inside EDGES in DATA
DATA = DATA.replace(
    "{ from:'pedagogy-core', to:'kg', label:{zh:'agentic search → 匹配 combo', en:'agentic search → best combo'} },",
    "{ from:'pedagogy-core', to:'authoring', label:{zh:'注入 pattern×action', en:'inject pattern×action'} },",
)

HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Pipeline Visualizer · XR EduAgent</title>
<style>
:root {
  --bg: #0b0e14;
  --panel: #121722;
  --panel-2: #182030;
  --border: #2a3448;
  --text: #e8eef8;
  --muted: #8b97ad;
  --dim: #5c6a84;
  --accent: #5b9dff;
  --green: #3ecf8e;
  --purple: #a78bfa;
  --pink: #f472b6;
  --amber: #fbbf24;
  --cyan: #22d3ee;
  --orange: #fb923c;
  --red: #f87171;
  --shadow: 0 10px 40px rgba(0,0,0,.35);
  --radius: 14px;
  --font: "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --nw: 300px;
}
* { box-sizing: border-box; }
html, body { margin:0; height:100%; background:var(--bg); color:var(--text); font-family:var(--font); }
body { display:flex; flex-direction:column; overflow:hidden; }

header {
  display:flex; align-items:center; gap:16px; padding:12px 18px;
  border-bottom:1px solid var(--border); background:linear-gradient(180deg,#141a26,#10151f);
  z-index:5; flex:0 0 auto;
}
header h1 { margin:0; font-size:16px; font-weight:700; letter-spacing:.2px; white-space:nowrap; }
header .sub { color:var(--muted); font-size:12px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tabs { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
.tab {
  border:1px solid var(--border); background:var(--panel); color:var(--muted);
  border-radius:999px; padding:6px 12px; font-size:12px; cursor:pointer; text-decoration:none;
}
.tab:hover { color:var(--text); border-color:#3d4b66; }
.tab.active { color:#fff; background:linear-gradient(135deg,#3b82f6,#6366f1); border-color:transparent; }
.btn {
  border:1px solid var(--border); background:var(--panel-2); color:var(--text);
  border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer;
}
.btn:hover { border-color:var(--accent); color:#fff; }
.btn.on {
  background: linear-gradient(135deg,#2563eb,#7c3aed); color:#fff; border-color:transparent;
}

main { flex:1; display:grid; grid-template-columns: 1fr 340px; min-height:0; }
#canvas-wrap {
  position:relative; overflow:hidden; background:
    radial-gradient(1200px 600px at 10% -10%, rgba(91,157,255,.08), transparent 55%),
    radial-gradient(900px 500px at 90% 110%, rgba(167,139,250,.07), transparent 50%),
    linear-gradient(180deg, #0c1018 0%, #0b0e14 100%);
  cursor: grab;
}
#canvas-wrap.panning { cursor: grabbing; }
#stage {
  position:absolute; left:0; top:0;
  transform-origin: 0 0;
  will-change: transform;
}
#wires { position:absolute; inset:0; pointer-events:none; overflow:visible; }
#nodes { position:relative; }

#lane-bar {
  position:absolute; left:0; right:0; top:0; height:36px; z-index:6;
  pointer-events:none; overflow:hidden;
  background: linear-gradient(180deg, rgba(11,14,20,.92), rgba(11,14,20,.35) 70%, transparent);
}
#lane-bar .lane-tag {
  position:absolute; top:10px;
  font-size:11px; font-weight:700; letter-spacing:.08em;
  text-transform:uppercase; color:var(--dim); white-space:nowrap;
}

.node {
  position:absolute; width:var(--nw); border-radius:var(--radius);
  background:linear-gradient(180deg, #1a2233, #151c2b);
  border:1px solid var(--border); box-shadow:var(--shadow);
  padding:14px 14px 12px; cursor:pointer; user-select:none;
  transition: border-color .15s, box-shadow .15s, opacity .2s;
  z-index: 2;
}
.node:hover { border-color:#4a5d80; }
.node.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(91,157,255,.35), 0 12px 36px rgba(91,157,255,.18);
}
.node.ghosted {
  opacity: .18; filter: grayscale(.4);
  pointer-events: none;
  z-index: 1;
}
.node .accent {
  position:absolute; left:0; top:12px; bottom:12px; width:4px; border-radius:0 4px 4px 0;
}
.node .top { display:flex; gap:10px; align-items:flex-start; }
.node .icon {
  width:32px; height:32px; border-radius:9px; display:grid; place-items:center;
  background:rgba(255,255,255,.04); font-size:16px; flex:0 0 auto;
}
.node .title { font-size:14px; font-weight:700; line-height:1.25; }
.node .id { font-size:10px; color:var(--dim); margin-top:2px; font-family:ui-monospace, Consolas, monospace; }
.node .badge {
  display:inline-flex; align-items:center; gap:4px; margin-top:8px;
  font-size:11px; color:var(--muted); background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.05); border-radius:999px; padding:2px 9px;
}
.node .chev {
  margin-left:auto; color:var(--dim); font-size:12px; transition: transform .15s;
}
.node.expandable .chev { display:inline-block; }
.node:not(.expandable) .chev { display:none; }
.node.expanded .chev { transform: rotate(90deg); color:var(--accent); }
.node .summary {
  margin-top:8px; font-size:12px; color:var(--muted); line-height:1.4;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
}
.node.child-node {
  width:280px; background:linear-gradient(180deg, #161e2d, #121926);
  border-style:dashed; z-index: 5;
}
.node.wrap {
  background:linear-gradient(180deg, rgba(62,207,142,.10), #151c2b);
}
.node.external {
  background:linear-gradient(180deg, rgba(232,121,249,.12), #1a1524);
  border-style:dashed; border-color:#a21caf88;
}

#detail {
  border-left:1px solid var(--border); background:var(--panel);
  padding:16px; overflow:auto;
}
#detail .ph { color:var(--dim); font-size:13px; line-height:1.6; margin-top:30%; text-align:center; }
.d-head { display:flex; gap:10px; align-items:center; margin-bottom:8px; }
.d-head .ic {
  width:36px; height:36px; border-radius:10px; display:grid; place-items:center;
  background:rgba(255,255,255,.05); font-size:18px;
}
.d-head h2 { margin:0; font-size:16px; }
.d-file { font-size:11px; color:var(--dim); font-family:ui-monospace, Consolas, monospace; margin:6px 0 14px; word-break:break-all; }
.d-sec { margin-bottom:14px; }
.d-sec h3 { margin:0 0 6px; font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
.d-sec p, .d-sec li { font-size:13px; line-height:1.55; color:var(--text); margin:0; }
.d-sec ul { margin:0; padding-left:18px; }
.chip {
  display:inline-block; margin:0 6px 6px 0; padding:4px 8px; border-radius:999px;
  border:1px solid var(--border); background:var(--panel-2); font-size:11px; cursor:pointer; color:var(--muted);
}
.chip:hover { color:#fff; border-color:var(--accent); }
.tag {
  display:inline-block; font-size:10px; padding:2px 7px; border-radius:999px;
  border:1px solid transparent; margin-right:4px;
}
.hint {
  position:absolute; left:14px; bottom:12px; z-index:3;
  font-size:11px; color:var(--dim); background:rgba(10,14,22,.75);
  border:1px solid var(--border); border-radius:8px; padding:6px 10px; backdrop-filter: blur(6px);
  max-width: min(420px, 70%);
}

.edge-path { fill:none; stroke:#334155; stroke-width:1.6; opacity:.85; }
.edge-path.hl { stroke: var(--accent); stroke-width:2.2; opacity:1; }
.edge-label {
  fill: var(--dim); font-size:10px; paint-order: stroke; stroke: #0b0e14; stroke-width:3px;
}
.edge-label.hl { fill: #93c5fd; }

.btn.demo-on {
  background: linear-gradient(135deg,#2563eb,#7c3aed); color:#fff; border-color:transparent;
  box-shadow: 0 0 0 1px rgba(91,157,255,.35), 0 8px 24px rgba(91,157,255,.25);
}
.node.demo-hl {
  border-color: #38bdf8 !important;
  box-shadow: 0 0 0 2px rgba(56,189,248,.45), 0 0 28px rgba(56,189,248,.28), var(--shadow) !important;
  animation: demoPulse 1.6s ease-in-out infinite;
  z-index: 6;
  opacity: 1 !important; filter: none !important; pointer-events: auto;
}
.node.demo-dim { opacity: .28; filter: grayscale(.35); }
@keyframes demoPulse {
  0%,100% { box-shadow: 0 0 0 2px rgba(56,189,248,.45), 0 0 18px rgba(56,189,248,.22), var(--shadow); }
  50% { box-shadow: 0 0 0 3px rgba(56,189,248,.7), 0 0 36px rgba(56,189,248,.4), var(--shadow); }
}
.edge-path.demo-flow {
  stroke: #38bdf8; stroke-width: 2.4; stroke-dasharray: 8 10; opacity: 1;
  animation: dashFlow 0.85s linear infinite;
  filter: drop-shadow(0 0 4px rgba(56,189,248,.55));
}
@keyframes dashFlow { to { stroke-dashoffset: -36; } }
.edge-label.demo-flow { fill: #7dd3fc; }
.marker-demo path { fill: #38bdf8; }

.call-pop {
  position: absolute; top: -14px; right: -10px; z-index: 12;
  display: flex; flex-direction: column; gap: 6px; align-items: flex-end;
  pointer-events: none; min-width: 0;
}
.call-chip {
  display: flex; flex-direction: column; gap: 4px;
  background: linear-gradient(135deg, rgba(15,23,42,.97), rgba(30,41,59,.97));
  border: 1px solid rgba(56,189,248,.55);
  color: #e0f2fe;
  padding: 8px 12px 8px 10px; border-radius: 12px;
  box-shadow: 0 8px 22px rgba(0,0,0,.5), 0 0 14px rgba(56,189,248,.22);
  white-space: nowrap; max-width: 240px; min-width: 148px;
  animation: chipPop .45s cubic-bezier(.2,1.4,.3,1) both;
}
.call-chip .ct {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800; letter-spacing: .04em;
  color: #f8fafc;
}
.call-chip .ct .ti {
  width: 18px; height: 18px; border-radius: 5px; display: grid; place-items: center;
  font-size: 11px; background: rgba(255,255,255,.08);
}
.call-chip.skill .ct .ti { background: rgba(167,139,250,.28); }
.call-chip.tool .ct .ti { background: rgba(62,207,142,.28); }
.call-chip.skill { border-color: rgba(167,139,250,.55); }
.call-chip.tool { border-color: rgba(62,207,142,.55); }
.call-chip .cb {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: #cbd5e1;
}
.call-chip .cb .ci {
  width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center;
  font-size: 12px; background: rgba(56,189,248,.16);
}
.call-chip.skill .cb .ci { background: rgba(167,139,250,.22); }
.call-chip.tool .cb .ci { background: rgba(62,207,142,.22); }
.call-chip .cn { overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
@keyframes chipPop {
  0% { opacity: 0; transform: translateY(8px) scale(.85); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes chipOut { to { opacity: 0; transform: translateY(-10px) scale(.9); } }
.call-chip.out { animation: chipOut .35s ease forwards; }

#demo-dock {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%) translateY(120%);
  width: min(780px, calc(100vw - 380px)); z-index: 40;
  background: linear-gradient(180deg, rgba(18,24,38,.96), rgba(12,16,26,.98));
  border: 1px solid rgba(56,189,248,.35);
  border-radius: 16px; padding: 14px 16px 12px;
  box-shadow: 0 20px 50px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04) inset;
  backdrop-filter: blur(10px);
  transition: transform .35s cubic-bezier(.2,.9,.2,1), opacity .25s;
  opacity: 0; pointer-events: none;
}
#demo-dock.show { transform: translateX(-50%) translateY(0); opacity: 1; pointer-events: auto; }
#demo-dock .row { display: flex; gap: 12px; align-items: flex-start; }
#demo-dock .step {
  flex: 0 0 auto; font-size: 11px; font-weight: 800; letter-spacing: .06em;
  color: #7dd3fc; background: rgba(56,189,248,.12); border: 1px solid rgba(56,189,248,.3);
  border-radius: 999px; padding: 4px 10px; margin-top: 2px;
}
#demo-dock h3 { margin: 0 0 4px; font-size: 15px; }
#demo-dock p { margin: 0; font-size: 12.5px; color: var(--muted); line-height: 1.5; }
#demo-dock .bar {
  margin-top: 10px; height: 3px; background: #1e293b; border-radius: 99px; overflow: hidden;
}
#demo-dock .bar > i {
  display: block; height: 100%; width: 0%;
  background: linear-gradient(90deg,#38bdf8,#a78bfa,#34d399);
  transition: width .35s ease;
}
#demo-dock .controls { display:flex; gap:6px; margin-top:10px; justify-content:flex-end; flex-wrap:wrap; align-items:center; }
#demo-dock .route-row {
  display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;
}
#demo-dock select {
  background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
  border-radius: 8px; padding: 5px 8px; font-size: 12px; max-width: 100%;
}
body.demo-running .hint { opacity: 0; pointer-events: none; }
</style>
</head>
<body>
<header>
  <h1>Agent Pipeline</h1>
  <div class="sub" id="subtitle">XR EduAgent · turn orchestration → modes → outline / section sub-pipelines → wrap-up</div>
  <nav class="tabs">
    <a class="tab active" href="agent-pipeline.html">Pipeline</a>
    <a class="tab" href="agent-skills.html">Skills</a>
    <a class="tab" href="agent-tools.html">Tools</a>
    <button class="btn" id="btn-demo">▶ Demo</button>
    <button class="btn" id="btn-expand">Expand all</button>
    <button class="btn" id="btn-collapse">Collapse all</button>
    <button class="btn" id="btn-lang">中文</button>
  </nav>
</header>
<div id="demo-dock">
  <div class="route-row">
    <label for="demo-route" style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.04em;text-transform:uppercase">Route</label>
    <select id="demo-route">
      <option value="create">Create a new learning experience</option>
      <option value="modify">Modify a section</option>
      <option value="ask">Inquiry and brainstorming</option>
      <option value="full">Full demo (expand every child)</option>
    </select>
  </div>
  <div class="row">
    <span class="step" id="demo-step">STEP 1/1</span>
    <div style="flex:1;min-width:0">
      <h3 id="demo-title">Demo</h3>
      <p id="demo-blurb"></p>
      <div class="bar"><i id="demo-bar"></i></div>
      <div class="controls">
        <button class="btn" id="demo-autoplay">Autoplay: Off</button>
        <button class="btn" id="demo-prev">◀ Prev</button>
        <button class="btn" id="demo-next">Next ▶</button>
        <button class="btn" id="demo-stop">Stop</button>
      </div>
    </div>
  </div>
</div>
<main>
  <div id="canvas-wrap">
    <div id="lane-bar"></div>
    <div id="stage">
      <svg id="wires"></svg>
      <div id="nodes"></div>
    </div>
    <div class="hint" id="hint">Drag to pan · Scroll to zoom · Click ▸ to expand (overlays; overlapped nodes fade) · Click a node for details</div>
  </div>
  <aside id="detail"><div class="ph" id="detail-ph">Click a node to inspect this pipeline step.</div></aside>
</main>
<script>
const LANG_KEY = 'xr_pipeline_lang';
let lang = localStorage.getItem(LANG_KEY) || 'en';
const T = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.en || v.zh || '';
};
const VL = (zh, en) => lang === 'zh' ? zh : en;

''' + DATA + r'''

const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
const expanded = new Set();
let ghosted = new Set();
let selected = 'input-trigger';

// Camera (Figma-style): pan + zoom, no scrollbars
const cam = { x: 0, y: 0, k: 1 };
let didCenter = false;

function isVisible(n) {
  if (!n) return false;
  if (n.id === 'pedagogy-core') return true;
  if (!n.parent) return true;
  let p = n.parent;
  while (p) {
    if (!expanded.has(p)) return false;
    p = byId[p]?.parent;
  }
  return true;
}
function visibleNodes() { return NODES.filter(isVisible); }

function ancestorsOf(id) {
  const out = [];
  let p = byId[id]?.parent;
  while (p) { out.push(p); p = byId[p]?.parent; }
  return out;
}
function isDescendant(id, ancestor) {
  return ancestorsOf(id).includes(ancestor);
}

function layout() {
  const NW = 300, NH = 108, CW = 280, CH = 90;
  const COL_W = 360, PAD_X = 80, PAD_Y = 40;
  const CHILD_INDENT = 28, CHILD_GAP = 14;
  const SPINE_Y = 240; // room for Pedagogy Core above authoring
  const SEC_GAP = 168;

  const COL = {
    'input-trigger': 0, 'turn': 1, 'context': 2, 'modes': 3,
    'agent-analyze': 4, 'authoring': 5, 'outline': 6,
    'sec-reading': 7, 'sec-h5': 7, 'sec-3d': 7, 'sec-quiz': 7,
    'wrap': 8,
  };
  const spine = ['input-trigger','turn','context','modes','agent-analyze','authoring','outline'];
  const sections = ['sec-reading','sec-h5','sec-3d','sec-quiz'];

  const pos = {};

  function placeChildren(parentId) {
    const n = byId[parentId];
    if (!n?.children || !expanded.has(parentId)) return;
    // Outline children live in the section column (fixed), not stacked under outline
    if (parentId === 'outline') return;
    const pp = pos[parentId];
    if (!pp) return;
    let y = pp.y + pp.h + CHILD_GAP;
    for (const cid of n.children) {
      if (!isVisible(byId[cid])) continue;
      const child = byId[cid];
      const w = child.kind === 'child' ? CW : NW;
      const h = child.kind === 'child' ? CH : NH;
      pos[cid] = { x: pp.x + CHILD_INDENT, y, w, h, overlay: true };
      y += h + CHILD_GAP;
      placeChildren(cid);
      // after nested expand, continue from below nested stack without pushing siblings of parent
      // nested children overlay — keep sibling y based on immediate child only
      if (child.children && expanded.has(cid)) {
        // y already advanced by this child's own box; nested overlays sit on top of later siblings
      }
    }
  }

  for (const id of spine) {
    const x = PAD_X + COL[id] * COL_W;
    pos[id] = { x, y: SPINE_Y, w: NW, h: NH, overlay: false };
  }

  // Pedagogy Core: directly above Course authoring, same X
  pos['pedagogy-core'] = {
    x: pos.authoring.x,
    y: SPINE_Y - NH - 72,
    w: NW, h: NH, overlay: false
  };

  // Sections: fixed vertical slots (never squeezed by expand)
  const secX = PAD_X + 7 * COL_W;
  sections.forEach((id, i) => {
    if (!isVisible(byId[id])) return;
    pos[id] = { x: secX, y: SPINE_Y + i * SEC_GAP, w: NW, h: NH, overlay: false };
  });

  // Wrap: mid of section stack
  const secYs = sections.filter(id => pos[id]).map(id => pos[id].y);
  const wrapY = secYs.length
    ? (Math.min(...secYs) + Math.max(...secYs) + NH) / 2 - NH / 2
    : SPINE_Y;
  pos.wrap = { x: PAD_X + 8 * COL_W, y: wrapY, w: NW, h: NH, overlay: false };

  // Overlay children for all expanded trees (except outline→sections)
  for (const id of [...spine, ...sections]) {
    if (expanded.has(id)) placeChildren(id);
  }
  // nested expandable under sections (rd-pipe etc.)
  for (const id of Object.keys(pos)) {
    if (expanded.has(id) && byId[id]?.children) placeChildren(id);
  }

  // Ghost: non-overlay nodes overlapped by overlay children
  ghosted = new Set();
  const boxes = Object.entries(pos).map(([id, p]) => ({ id, ...p }));
  const overlays = boxes.filter(b => b.overlay);
  const bases = boxes.filter(b => !b.overlay);
  function overlap(a, b) {
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }
  for (const base of bases) {
    if (base.id === 'pedagogy-core') continue;
    for (const ov of overlays) {
      // don't ghost ancestors of the overlay
      if (isDescendant(ov.id, base.id) || ancestorsOf(ov.id).includes(base.id)) continue;
      if (ov.id === base.id) continue;
      if (overlap(base, ov)) ghosted.add(base.id);
    }
  }

  let maxX = 0, maxY = 0, minY = Infinity;
  for (const p of Object.values(pos)) {
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
    minY = Math.min(minY, p.y);
  }
  const width = maxX + PAD_X + 80;
  const height = Math.max(maxY + 120, SPINE_Y + 4 * SEC_GAP + 200);
  return { pos, width, height, COL_W, PAD_X, NW };
}

function orthogonalPath(a, b, lane = 0) {
  const x1 = a.x + a.w, y1 = a.y + a.h / 2;
  const x2 = b.x, y2 = b.y + b.h / 2;
  const mid = x1 + Math.max(40, (x2 - x1) / 2) + lane * 12;
  return { d: `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`, lx: mid + 6, ly: (y1 + y2) / 2 };
}
function backPath(a, b) {
  const x1 = a.x + a.w / 2, y1 = a.y;
  const x2 = b.x + b.w / 2, y2 = b.y;
  const top = Math.min(y1, y2) - 40;
  return { d: `M ${x1} ${y1} L ${x1} ${top} L ${x2} ${top} L ${x2} ${y2}`, lx: (x1 + x2) / 2, ly: top - 6 };
}
function downPath(a, b) {
  const x1 = a.x + a.w / 2, y1 = a.y + a.h;
  const x2 = b.x + b.w / 2, y2 = b.y;
  const mid = (y1 + y2) / 2;
  return { d: `M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`, lx: x1 + 10, ly: mid - 4 };
}

// ── Demo routes ──
function R(id, expand, nodes, title, blurb) {
  return { id, expand, nodes, title, blurb };
}

const DEMO_ROUTES = {
  create: {
    name: { zh: '创建新的学习体验', en: 'Create a new learning experience' },
    rounds: [
      R('c1', [], ['input-trigger'],
        { zh:'① 输入触发（折叠）', en:'① Input trigger (collapsed)' },
        { zh:'老师准备开始备课——先看到输入触发入口，尚未展开。', en:'Teacher is about to author — see the Input Trigger closed.' }),
      R('c2', ['input-trigger'], ['input-trigger','in-material','in-combo'],
        { zh:'② 展开输入源', en:'② Expand input sources' },
        { zh:'展开：上传 PDF +「据此备课」组合进入管线。', en:'Expand: PDF upload + “Build from this” combo enters the pipeline.' }),
      R('c3', ['input-trigger'], ['turn'],
        { zh:'③ 一轮编排', en:'③ Turn orchestration' },
        { zh:'runTurn：加锁、重置进度、turn_start 日志。', en:'runTurn: busy-lock, reset progress, turn_start log.' }),
      R('c4', [], ['context'],
        { zh:'④ 构建输入上下文', en:'④ Build input context' },
        { zh:'锁定本轮：用户输入 + Outline + 当前节 + 材料 + KG 摘要。', en:'Lock context: input + outline + active section + material + KG digest.' }),
      R('c5', [], ['modes'],
        { zh:'⑤ 三种模式（折叠）', en:'⑤ Three modes (collapsed)' },
        { zh:'到达模式分流口——Ask / Agent / Plan。', en:'Arrive at mode fork — Ask / Agent / Plan.' }),
      R('c6', ['modes'], ['modes','mode-agent'],
        { zh:'⑥ 展开 → Agent 模式', en:'⑥ Expand → Agent mode' },
        { zh:'备课是可改写任务，进入 Agent（技能路由 + 工具循环）。', en:'Authoring mutates the course → Agent mode (skills + tool loop).' }),
      R('c7', [], ['agent-analyze'],
        { zh:'⑦ 任务分析（折叠）', en:'⑦ Task analysis (collapsed)' },
        { zh:'Agent 分析本轮意图与路由。', en:'Agent classifies intent and routing.' }),
      R('c8', ['agent-analyze'], ['agent-analyze','route-new'],
        { zh:'⑧ 展开 → 新建大纲', en:'⑧ Expand → New outline' },
        { zh:'首次从材料生成整课 → 新建 Learning Outline 路径。', en:'First-time full course from material → New Learning Outline path.' }),
      R('c9', [], ['authoring','pedagogy-core'],
        { zh:'⑨ 课程创作 + Pedagogy Core', en:'⑨ Course authoring + Pedagogy Core' },
        { zh:'Pedagogy Core 在创作管线正上方，单向注入 pattern×action。', en:'Pedagogy Core sits above authoring and injects pattern×action downward.' }),
      R('c10', ['authoring'], ['authoring','aha','kg','author-outline','pedagogy-core'],
        { zh:'⑩ 展开创作：Aha → KG → 骨架', en:'⑩ Expand authoring: Aha → KG → skeleton' },
        { zh:'蒸馏顿悟点；agentic search 匹配教学组合；写出大纲骨架。', en:'Distill aha keys; agentic search for teaching combo; write outline skeleton.' }),
      R('c11', ['authoring'], ['outline'],
        { zh:'⑪ 学习大纲（折叠）', en:'⑪ Learning Outline (collapsed)' },
        { zh:'大纲树就位——四类节尚未展开。', en:'Outline tree ready — section types still collapsed.' }),
      R('c12', ['authoring','outline'], ['outline','sec-reading','sec-h5','sec-3d','sec-quiz'],
        { zh:'⑫ 展开大纲 → 四类节', en:'⑫ Expand outline → four section types' },
        { zh:'阅读 / H5 / 3D / 测验 扇出。', en:'Reading / H5 / 3D / Quiz fan out.' }),
      R('c13', ['authoring','outline','sec-reading'], ['sec-reading'],
        { zh:'⑬ 阅读节（折叠）', en:'⑬ Reading section (collapsed)' },
        { zh:'Scaffold 路径入口。', en:'Scaffold path entry.' }),
      R('c14', ['authoring','outline','sec-reading','rd-pipe'], ['sec-reading','rd-pipe','rd-planner','rd-skills','rd-tools'],
        { zh:'⑭ 展开阅读子管线', en:'⑭ Expand reading sub-pipeline' },
        { zh:'Planner → course-reading → reading_set_chunks / 配图。', en:'Planner → course-reading → reading_set_chunks / figures.' }),
      R('c15', ['authoring','outline','sec-h5','h5-pipe'], ['sec-h5','h5-pipe','h5-planner','h5-skills','h5-tools'],
        { zh:'⑮ H5 交互子管线', en:'⑮ H5 interactive sub-pipeline' },
        { zh:'Construct：interactionKind → h5_set_content（禁止静态传单）。', en:'Construct: interactionKind → h5_set_content (no static flyers).' }),
      R('c16', ['authoring','outline','sec-3d','vr-pipe'], ['sec-3d','vr-pipe','vr-iso','vr-planner','vr-skills','vr-tools','vr-dual','vr-panel'],
        { zh:'⑯ 3D 子管线（重点）', en:'⑯ 3D sub-pipeline (focus)' },
        { zh:'隔离填充 → 技能暴露 → 双轨建造/面板 → 快照。串行防串景。', en:'Isolated fill → skills → dual-track build/panels → snapshot. Serial, no bleed.' }),
      R('c17', ['authoring','outline','sec-quiz','qz-pipe'], ['sec-quiz','qz-pipe','qz-planner','qz-skills','qz-tools'],
        { zh:'⑰ 测验节子管线', en:'⑰ Quiz sub-pipeline' },
        { zh:'Transfer：迁移题 + misconception 干扰项 → quiz_set_items。', en:'Transfer: re-skinned items + misconception distractors → quiz_set_items.' }),
      R('c18', ['authoring','outline'], ['wrap'],
        { zh:'⑱ 收尾 Wrap-up', en:'⑱ Wrap-up' },
        { zh:'自检、历史、Keep/Undo、turn_end，解锁 busy。', en:'Self-check, history, Keep/Undo, turn_end, release busy.' }),
    ],
  },
  modify: {
    name: { zh: '修改某一节', en: 'Modify a section' },
    rounds: [
      R('m1', [], ['input-trigger'],
        { zh:'① 输入触发（折叠）', en:'① Input trigger (collapsed)' },
        { zh:'老师用自然语言要求改某一节。', en:'Teacher asks in natural language to change a section.' }),
      R('m2', ['input-trigger'], ['input-trigger','in-prompt'],
        { zh:'② 展开 → 自然语言指令', en:'② Expand → NL prompt' },
        { zh:'例如：「把 3D 节里的齿轮再大一点」。', en:'e.g. “Make the gear in the 3D section larger.”' }),
      R('m3', ['input-trigger'], ['turn'],
        { zh:'③ 一轮编排', en:'③ Turn orchestration' },
        { zh:'runTurn 加锁并开始本轮修改。', en:'runTurn locks and starts this edit turn.' }),
      R('m4', [], ['context'],
        { zh:'④ 构建上下文', en:'④ Build context' },
        { zh:'拉取当前 Outline、活动节场景与 KG 摘要。', en:'Load outline, active section scene, KG digest.' }),
      R('m5', [], ['modes'],
        { zh:'⑤ 模式（折叠）', en:'⑤ Modes (collapsed)' },
        { zh:'修改属于可写任务。', en:'Edits are mutating work.' }),
      R('m6', ['modes'], ['modes','mode-agent'],
        { zh:'⑥ 展开 → Agent', en:'⑥ Expand → Agent' },
        { zh:'进入 Agent 模式执行改课工具循环。', en:'Enter Agent mode for the live-edit tool loop.' }),
      R('m7', [], ['agent-analyze'],
        { zh:'⑦ 任务分析（折叠）', en:'⑦ Task analysis (collapsed)' },
        { zh:'识别为「修改已有内容」。', en:'Classify as modification of existing content.' }),
      R('m8', ['agent-analyze'], ['agent-analyze','route-mod'],
        { zh:'⑧ 展开 → 修改路由', en:'⑧ Expand → Modify route' },
        { zh:'跳过完整 Aha→KG 引导，直达大纲/节。', en:'Skip full Aha→KG bootstrap; go to outline/section.' }),
      R('m9', ['agent-analyze'], ['outline'],
        { zh:'⑨ 学习大纲（折叠）', en:'⑨ Learning Outline (collapsed)' },
        { zh:'修改路径直接连到大纲。', en:'Modify path connects straight to the outline.' }),
      R('m10', ['agent-analyze','outline'], ['outline','sec-3d'],
        { zh:'⑩ 展开大纲 → 目标节', en:'⑩ Expand outline → target section' },
        { zh:'定位到要改的 3D 节（示例）。', en:'Locate the 3D section to edit (example).' }),
      R('m11', ['agent-analyze','outline','sec-3d'], ['sec-3d','vr-mod'],
        { zh:'⑪ 展开节 → 修改场景', en:'⑪ Expand section → modify scene' },
        { zh:'course-live-edit + 场景工具：update_object / set_behavior…', en:'course-live-edit + scene tools: update_object / set_behavior…' }),
      R('m12', ['agent-analyze','outline'], ['wrap'],
        { zh:'⑫ 收尾', en:'⑫ Wrap-up' },
        { zh:'校验、历史、Keep/Undo、解锁。', en:'Validate, history, Keep/Undo, unlock.' }),
    ],
  },
  ask: {
    name: { zh: '探究与头脑风暴', en: 'Inquiry and brainstorming' },
    rounds: [
      R('a1', [], ['input-trigger'],
        { zh:'① 输入触发（折叠）', en:'① Input trigger (collapsed)' },
        { zh:'老师或学生提出探究性问题。', en:'Teacher or learner asks an inquiry question.' }),
      R('a2', ['input-trigger'], ['input-trigger','in-prompt'],
        { zh:'② 展开 → 自然语言', en:'② Expand → natural language' },
        { zh:'例如：「这节课的顿悟点还可以怎么设计？」', en:'e.g. “How else could we design the aha keys for this lesson?”' }),
      R('a3', ['input-trigger'], ['turn'],
        { zh:'③ 一轮编排', en:'③ Turn orchestration' },
        { zh:'runTurn 启动只读问答轮。', en:'runTurn starts a read-oriented turn.' }),
      R('a4', [], ['context'],
        { zh:'④ 构建上下文', en:'④ Build context' },
        { zh:'附带大纲与材料摘要，供解释与建议。', en:'Attach outline/material digest for explanation & advice.' }),
      R('a5', [], ['modes'],
        { zh:'⑤ 模式（折叠）', en:'⑤ Modes (collapsed)' },
        { zh:'探究不改课——走向 Ask。', en:'Inquiry does not mutate — head to Ask.' }),
      R('a6', ['modes'], ['modes','mode-ask'],
        { zh:'⑥ 展开 → Ask 模式（终点）', en:'⑥ Expand → Ask mode (end)' },
        { zh:'单次 LLM、无工具定义：解释 / 答疑 / 头脑风暴。演示在此停止。', en:'Single LLM call, no tools: explain / answer / brainstorm. Demo stops here.' }),
    ],
  },
  full: {
    name: { zh: '完整演示（逐步展开全部子节点）', en: 'Full demo (expand every child)' },
    rounds: [], // filled below
  },
};

// Build FULL demo: for each expandable on the create spine, collapsed highlight then expand+all descendants
(function buildFull() {
  const expandables = [
    'input-trigger','modes','agent-analyze','authoring','outline',
    'sec-reading','rd-pipe','sec-h5','h5-pipe','sec-3d','vr-pipe','sec-quiz','qz-pipe'
  ];
  const rounds = [];
  let n = 1;
  const push = (expand, nodes, title, blurb) => {
    rounds.push(R('f'+n, expand, nodes, title, blurb));
    n++;
  };
  push([], ['input-trigger'],
    { zh:`① 输入触发（折叠）`, en:`① Input trigger (collapsed)` },
    { zh:'完整演示：每个可展开节点先折叠高亮，再展开并高亮全部子节点。', en:'Full demo: each expandable is highlighted collapsed, then expanded with all children highlighted.' });
  push(['input-trigger'], ['input-trigger',...(byId['input-trigger'].children||[])],
    { zh:`② 展开输入触发 · 全部子节点`, en:`② Expand Input Trigger · all children` },
    { zh:'高亮全部输入源子节点。', en:'Highlight every input-source child.' });
  push(['input-trigger'], ['turn'],
    { zh:`③ 一轮编排`, en:`③ Turn orchestration` },
    { zh:'runTurn。', en:'runTurn.' });
  push(['input-trigger'], ['context'],
    { zh:`④ 构建上下文`, en:`④ Build context` },
    { zh:'锁定本轮上下文。', en:'Lock turn context.' });
  push(['input-trigger'], ['modes'],
    { zh:`⑤ 模式（折叠）`, en:`⑤ Modes (collapsed)` },
    { zh:'Ask / Agent / Plan。', en:'Ask / Agent / Plan.' });
  push(['input-trigger','modes'], ['modes',...(byId.modes.children||[])],
    { zh:`⑥ 展开模式 · 全部子节点`, en:`⑥ Expand Modes · all children` },
    { zh:'Ask、Agent、Plan 全部高亮。', en:'Highlight Ask, Agent, and Plan.' });
  push(['input-trigger','modes'], ['agent-analyze'],
    { zh:`⑦ 任务分析（折叠）`, en:`⑦ Task analysis (collapsed)` },
    { zh:'路由入口。', en:'Routing entry.' });
  push(['input-trigger','modes','agent-analyze'], ['agent-analyze',...(byId['agent-analyze'].children||[])],
    { zh:`⑧ 展开任务分析 · 全部路由`, en:`⑧ Expand analysis · all routes` },
    { zh:'新建 / 修改 / Plan / Ask 路由全显。', en:'Show New / Modify / Plan / Ask routes.' });
  push(['input-trigger','modes','agent-analyze'], ['authoring','pedagogy-core'],
    { zh:`⑨ 课程创作 + Pedagogy Core`, en:`⑨ Authoring + Pedagogy Core` },
    { zh:'Pedagogy Core 正上方单向箭头。', en:'Pedagogy Core above with a single down arrow.' });
  push(['input-trigger','modes','agent-analyze','authoring'], ['authoring','pedagogy-core',...(byId.authoring.children||[])],
    { zh:`⑩ 展开创作 · 全部子节点`, en:`⑩ Expand authoring · all children` },
    { zh:'Aha、KG、大纲骨架全部高亮。', en:'Highlight Aha, KG, outline skeleton.' });
  push(['input-trigger','modes','agent-analyze','authoring'], ['outline'],
    { zh:`⑪ 学习大纲（折叠）`, en:`⑪ Outline (collapsed)` },
    { zh:'四类节入口。', en:'Four section types.' });
  push(['input-trigger','modes','agent-analyze','authoring','outline'], ['outline','sec-reading','sec-h5','sec-3d','sec-quiz'],
    { zh:`⑫ 展开大纲 · 四类节`, en:`⑫ Expand outline · four sections` },
    { zh:'阅读 / H5 / 3D / 测验。', en:'Reading / H5 / 3D / Quiz.' });

  function sectionFull(secId, pipeId, labelZh, labelEn) {
    const base = ['input-trigger','modes','agent-analyze','authoring','outline'];
    push([...base], [secId],
      { zh:`${labelZh}（折叠）`, en:`${labelEn} (collapsed)` },
      { zh:'先高亮父节。', en:'Highlight the section parent first.' });
    const secKids = byId[secId].children || [];
    push([...base, secId], [secId, ...secKids],
      { zh:`展开${labelZh} · 全部子节点`, en:`Expand ${labelEn} · all children` },
      { zh:'含目的 / CRUD / 修改 / 子管线入口。', en:'Purpose / CRUD / modify / sub-pipeline entry.' });
    push([...base, secId, pipeId], [pipeId, ...(byId[pipeId].children||[])],
      { zh:`展开${labelZh}子管线 · 全部子节点`, en:`Expand ${labelEn} sub-pipeline · all children` },
      { zh:'Planner / Skills / Tools（及 3D 额外步骤）全部高亮。', en:'Highlight Planner / Skills / Tools (and extra 3D steps).' });
  }
  sectionFull('sec-reading','rd-pipe','阅读节','Reading');
  sectionFull('sec-h5','h5-pipe','H5 节','H5');
  sectionFull('sec-3d','vr-pipe','3D 节','3D');
  sectionFull('sec-quiz','qz-pipe','测验节','Quiz');
  push(['input-trigger','modes','agent-analyze','authoring','outline'], ['wrap'],
    { zh:'收尾 Wrap-up', en:'Wrap-up' },
    { zh:'所有支路汇合。', en:'All branches converge.' });
  // renumber titles prefix
  DEMO_ROUTES.full.rounds = rounds.map((r, i) => ({
    ...r,
    title: {
      zh: r.title.zh.replace(/^① |^② |^③ |^④ |^⑤ |^⑥ |^⑦ |^⑧ |^⑨ |^⑩ |^⑪ |^⑫ |^⑬ |^⑭ |^⑮ |^⑯ |^⑰ |^⑱ /, '') ,
      en: r.title.en.replace(/^① |^② |^③ |^④ |^⑤ |^⑥ |^⑦ |^⑧ |^⑨ |^⑩ |^⑪ |^⑫ |^⑬ |^⑭ |^⑮ |^⑯ |^⑰ |^⑱ /, ''),
    }
  }));
  DEMO_ROUTES.full.rounds = rounds.map((r, i) => {
    const num = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳','㉑','㉒','㉓','㉔','㉕','㉖','㉗','㉘','㉙','㉚'][i] || String(i+1);
    const strip = (s) => s.replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚\d]+[.\s]*/, '');
    return {
      ...r,
      title: { zh: `${num} ${strip(r.title.zh)}`, en: `${num} ${strip(r.title.en)}` },
    };
  });
})();

let demo = {
  on: false,
  autoplay: false,
  route: 'create',
  idx: 0,
  timer: null,
  popTimers: [],
  hl: new Set(),
};

function currentRounds() {
  return DEMO_ROUTES[demo.route]?.rounds || DEMO_ROUTES.create.rounds;
}

function callLabel(kind, id) {
  const cat = kind === 'skill' ? SKILL_CAT : TOOL_CAT;
  const item = cat[id];
  if (!item) return { icon: kind === 'skill' ? '🧠' : '🔧', name: id };
  return { icon: item.icon, name: lang === 'zh' ? item.zh : item.en };
}
function nodeCalls(id) {
  const c = NODE_CALLS[id] || { skills: [], tools: [] };
  return [
    ...c.skills.map(s => ({ kind: 'skill', id: s })),
    ...c.tools.map(t => ({ kind: 'tool', id: t })),
  ];
}
function clearPopTimers() {
  demo.popTimers.forEach(t => clearTimeout(t));
  demo.popTimers = [];
}
function schedulePops() {
  clearPopTimers();
  if (!demo.on) return;
  document.querySelectorAll('.node.demo-hl').forEach(el => {
    const id = el.dataset.nid;
    const calls = nodeCalls(id);
    if (!calls.length) return;
    const host = el.querySelector('.call-pop');
    if (!host) return;
    const tick = () => {
      if (!demo.on || !el.isConnected) return;
      const pick = calls[Math.floor(Math.random() * calls.length)];
      const meta = callLabel(pick.kind, pick.id);
      const chip = document.createElement('div');
      chip.className = 'call-chip ' + pick.kind;
      const titleIcon = pick.kind === 'skill' ? '🧠' : '🔧';
      const titleText = pick.kind === 'skill' ? 'LOAD SKILL' : 'TOOL EXEC';
      chip.innerHTML = `
        <div class="ct"><span class="ti">${titleIcon}</span><span>${titleText}</span></div>
        <div class="cb"><span class="ci">${meta.icon}</span><span class="cn">${esc(meta.name)}</span></div>`;
      host.appendChild(chip);
      while (host.children.length > 2) host.firstChild.remove();
      const life = 1800 + Math.random() * 1200;
      const tOut = setTimeout(() => {
        chip.classList.add('out');
        setTimeout(() => chip.remove(), 360);
      }, life);
      demo.popTimers.push(tOut);
      const next = 500 + Math.random() * 1500;
      demo.popTimers.push(setTimeout(tick, next));
    };
    demo.popTimers.push(setTimeout(tick, 200 + Math.random() * 400));
  });
}

function applyCam() {
  const stage = document.getElementById('stage');
  stage.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`;
  updateLaneBar();
}

function updateLaneBar() {
  const bar = document.getElementById('lane-bar');
  if (!bar) return;
  const lanes = lang === 'zh'
    ? ['输入','编排','上下文','模式','路由','创作','大纲','分节','收尾']
    : ['Input','Turn','Context','Modes','Route','Author','Outline','Sections','Wrap'];
  const COL_W = 360, PAD_X = 80, NW = 300;
  bar.innerHTML = '';
  lanes.forEach((name, i) => {
    const lab = document.createElement('div');
    lab.className = 'lane-tag';
    lab.textContent = name;
    // horizontal follow only — screen X = worldX * k + cam.x
    const worldX = PAD_X + i * COL_W + NW / 2;
    const screenX = worldX * cam.k + cam.x;
    lab.style.left = screenX + 'px';
    lab.style.transform = 'translateX(-50%)';
    bar.appendChild(lab);
  });
}

function centerView(layoutBox) {
  const wrap = document.getElementById('canvas-wrap');
  const wr = wrap.getBoundingClientRect();
  const { width, height } = layoutBox || layout();
  const pad = 40;
  const k = Math.min(1, (wr.width - pad * 2) / width, (wr.height - pad * 2) / height);
  cam.k = Math.max(0.35, Math.min(1.2, k));
  cam.x = (wr.width - width * cam.k) / 2;
  cam.y = (wr.height - height * cam.k) / 2;
  applyCam();
  didCenter = true;
}

function focusNodes(ids) {
  const wrap = document.getElementById('canvas-wrap');
  const wr = wrap.getBoundingClientRect();
  const { pos } = layout();
  const boxes = ids.map(id => pos[id]).filter(Boolean);
  if (!boxes.length) return;
  const minX = Math.min(...boxes.map(b => b.x));
  const maxX = Math.max(...boxes.map(b => b.x + b.w));
  const minY = Math.min(...boxes.map(b => b.y));
  const maxY = Math.max(...boxes.map(b => b.y + b.h));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  cam.x = wr.width / 2 - cx * cam.k;
  cam.y = wr.height / 2.3 - cy * cam.k;
  applyCam();
}

function applyDemoRound(i, { fromAuto = false } = {}) {
  const rounds = currentRounds();
  const round = rounds[i];
  if (!round) return;
  demo.idx = i;
  expanded.clear();
  for (const id of round.expand) {
    expanded.add(id);
    let p = byId[id]?.parent;
    while (p) { expanded.add(p); p = byId[p]?.parent; }
  }
  for (const id of round.nodes) {
    let p = byId[id]?.parent;
    while (p) { expanded.add(p); p = byId[p]?.parent; }
  }
  demo.hl = new Set(round.nodes);
  selected = round.nodes[0] || selected;
  render();
  showDetail(selected);
  focusNodes(round.nodes);

  const dock = document.getElementById('demo-dock');
  dock.classList.add('show');
  document.getElementById('demo-step').textContent = `STEP ${i + 1}/${rounds.length}`;
  document.getElementById('demo-title').textContent = T(round.title);
  document.getElementById('demo-blurb').textContent = T(round.blurb);
  document.getElementById('demo-bar').style.width = `${((i + 1) / rounds.length) * 100}%`;
  syncAutoplayBtn();

  schedulePops();

  clearTimeout(demo.timer);
  if (demo.on && demo.autoplay) {
    demo.timer = setTimeout(() => {
      if (demo.idx + 1 < rounds.length) applyDemoRound(demo.idx + 1, { fromAuto: true });
      else { demo.autoplay = false; syncAutoplayBtn(); }
    }, 4200);
  }
}

function syncAutoplayBtn() {
  const b = document.getElementById('demo-autoplay');
  b.textContent = demo.autoplay ? VL('自动播放: 开', 'Autoplay: On') : VL('自动播放: 关', 'Autoplay: Off');
  b.classList.toggle('on', demo.autoplay);
}

function startDemo() {
  demo.on = true;
  demo.autoplay = false;
  demo.route = document.getElementById('demo-route').value || 'create';
  document.body.classList.add('demo-running');
  document.getElementById('btn-demo').classList.add('demo-on');
  document.getElementById('btn-demo').textContent = VL('● 演示中', '● Demo on');
  applyDemoRound(0);
}
function stopDemo(collapse = true) {
  demo.on = false;
  demo.autoplay = false;
  clearTimeout(demo.timer);
  clearPopTimers();
  demo.hl = new Set();
  document.body.classList.remove('demo-running');
  document.getElementById('btn-demo').classList.remove('demo-on');
  document.getElementById('btn-demo').textContent = VL('▶ 演示', '▶ Demo');
  document.getElementById('demo-dock').classList.remove('show');
  syncAutoplayBtn();
  if (collapse) expanded.clear();
  render();
  showDetail(selected);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function render() {
  const box = layout();
  const { pos, width, height } = box;
  const stage = document.getElementById('stage');
  const nodesEl = document.getElementById('nodes');
  const svg = document.getElementById('wires');
  stage.style.width = width + 'px';
  stage.style.height = height + 'px';
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.innerHTML = '';
  nodesEl.innerHTML = '';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#475569"/>
    </marker>
    <marker id="arr-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#5b9dff"/>
    </marker>
    <marker id="arr-demo" class="marker-demo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#38bdf8"/>
    </marker>`;
  svg.appendChild(defs);

  let laneN = 0;
  const edgeEls = [];
  EDGES.forEach(ed => {
    const aN = byId[ed.from], bN = byId[ed.to];
    if (!isVisible(aN) || !isVisible(bN)) return;
    const a = pos[ed.from], b = pos[ed.to];
    if (!a || !b) return;
    let path;
    if (ed.from === 'pedagogy-core' && ed.to === 'authoring') path = downPath(a, b);
    else if (ed.back) path = backPath(a, b);
    else path = orthogonalPath(a, b, (laneN++ % 3) - 1);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path.d);
    p.setAttribute('class', 'edge-path');
    p.setAttribute('marker-end', 'url(#arr)');
    p.dataset.from = ed.from;
    p.dataset.to = ed.to;
    svg.appendChild(p);
    let t = null;
    const label = T(ed.label);
    if (label) {
      t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', path.lx);
      t.setAttribute('y', path.ly);
      t.setAttribute('class', 'edge-label');
      t.textContent = label;
      svg.appendChild(t);
    }
    edgeEls.push({ ed, p, t });
  });

  visibleNodes().forEach(n => {
    const p = pos[n.id];
    if (!p) return;
    const el = document.createElement('div');
    const isHl = demo.on && demo.hl.has(n.id);
    const isDim = demo.on && !isHl;
    const isGhost = ghosted.has(n.id) && !isHl;
    el.dataset.nid = n.id;
    el.className = 'node'
      + (n.kind === 'expandable' ? ' expandable' : '')
      + (n.kind === 'child' ? ' child-node' : '')
      + (n.kind === 'external' ? ' external' : '')
      + (expanded.has(n.id) ? ' expanded' : '')
      + (n.id === 'wrap' ? ' wrap' : '')
      + (selected === n.id && !demo.on ? ' selected' : '')
      + (isHl ? ' demo-hl' : '')
      + (isDim ? ' demo-dim' : '')
      + (isGhost ? ' ghosted' : '');
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.width = p.w + 'px';
    if (p.overlay) el.style.zIndex = '5';
    const g = GROUP[n.group] || { color:'#5b9dff', name:{en:n.group, zh:n.group} };
    el.innerHTML = `
      <div class="call-pop" aria-hidden="true"></div>
      <div class="accent" style="background:${g.color}"></div>
      <div class="top">
        <div class="icon">${n.icon}</div>
        <div style="min-width:0;flex:1">
          <div class="title">${esc(T(n.title))}</div>
          <div class="id">${esc(n.id)}</div>
        </div>
        <span class="chev">▸</span>
      </div>
      <div class="badge"><span style="width:6px;height:6px;border-radius:50%;background:${g.color};display:inline-block"></span>${esc(T(g.name))}${n.kind==='expandable' ? (expanded.has(n.id) ? ' · −' : ' · +') : ''}</div>
      <div class="summary">${esc(T(n.summary || n.desc))}</div>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (n.kind === 'expandable') {
        if (expanded.has(n.id)) expanded.delete(n.id);
        else expanded.add(n.id);
      }
      selected = n.id;
      render();
      showDetail(n.id);
    });
    nodesEl.appendChild(el);
  });

  edgeEls.forEach(({ ed, p, t }) => {
    const selHl = !demo.on && (ed.from === selected || ed.to === selected);
    const fromHl = demo.on && demo.hl.has(ed.from);
    p.classList.toggle('hl', selHl);
    p.classList.toggle('demo-flow', !!fromHl);
    p.setAttribute('marker-end', fromHl ? 'url(#arr-demo)' : (selHl ? 'url(#arr-hl)' : 'url(#arr)'));
    t?.classList.toggle('hl', selHl || fromHl);
    t?.classList.toggle('demo-flow', !!fromHl);
  });

  applyCam();
  if (!didCenter) centerView(box);

  if (demo.on) {
    clearTimeout(demo._popKick);
    demo._popKick = setTimeout(schedulePops, 40);
  }
}

function showDetail(id) {
  const n = byId[id];
  if (!n) return;
  const g = GROUP[n.group] || { color:'#5b9dff', name:{en:n.group} };
  const kids = (n.children || []).map(cid => byId[cid]).filter(Boolean);
  const parent = n.parent ? byId[n.parent] : null;
  const inbound = EDGES.filter(e => e.to === id && isVisible(byId[e.from]));
  const outbound = EDGES.filter(e => e.from === id && isVisible(byId[e.to]));
  const chip = (list, dir) => list.length ? list.map(e => {
    const other = dir === 'in' ? e.from : e.to;
    const lb = T(e.label);
    return `<span class="chip" data-nav="${other}">${esc(T(byId[other].title))}${lb ? ' · ' + esc(lb) : ''}</span>`;
  }).join('') : `<span style="color:var(--dim);font-size:12px">${VL('无','None')}</span>`;

  document.getElementById('detail').innerHTML = `
    <div class="d-head"><div class="ic">${n.icon}</div><div>
      <h2>${esc(T(n.title))}</h2>
      <span class="tag" style="color:${g.color};border-color:${g.color}55;background:${g.color}22">${esc(T(g.name))}</span>
      ${n.kind==='expandable' ? `<span class="tag" style="color:var(--amber);border-color:#fbbf2444;background:#fbbf2418">${VL('可展开','Expandable')}</span>` : ''}
      ${n.kind==='child' ? `<span class="tag" style="color:var(--muted);border-color:var(--border)">${VL('子节点','Child')}</span>` : ''}
      ${n.kind==='external' ? `<span class="tag" style="color:#e879f9;border-color:#e879f955;background:#e879f918">${VL('外部库','External lib')}</span>` : ''}
    </div></div>
    <div class="d-file">${esc(n.file || '')}</div>
    <div class="d-sec"><h3>${VL('这一步做什么','What this step does')}</h3><p>${esc(T(n.desc))}</p></div>
    ${parent ? `<div class="d-sec"><h3>${VL('父节点','Parent')}</h3><span class="chip" data-nav="${parent.id}">${esc(T(parent.title))}</span></div>` : ''}
    ${kids.length ? `<div class="d-sec"><h3>${VL('子节点（展开可见）','Children (visible when expanded)')}</h3>${kids.map(k => `<span class="chip" data-nav="${k.id}">${esc(T(k.title))}</span>`).join('')}</div>` : ''}
    <div class="d-sec"><h3>${VL('上游','Upstream')}</h3>${chip(inbound,'in')}</div>
    <div class="d-sec"><h3>${VL('下游','Downstream')}</h3>${chip(outbound,'out')}</div>`;
  document.getElementById('detail').querySelectorAll('[data-nav]').forEach(c => {
    c.addEventListener('click', () => {
      const tid = c.dataset.nav;
      let p = byId[tid]?.parent;
      while (p) { expanded.add(p); p = byId[p]?.parent; }
      selected = tid;
      render();
      showDetail(tid);
    });
  });
}

// Pan + zoom
const wrap = document.getElementById('canvas-wrap');
let pan = null, moved = 0;
wrap.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (e.target.closest('.node')) return;
  pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
  moved = 0;
});
window.addEventListener('mousemove', e => {
  if (!pan) return;
  const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
  moved = Math.max(moved, Math.abs(dx), Math.abs(dy));
  if (moved > 2) {
    wrap.classList.add('panning');
    cam.x = pan.cx + dx;
    cam.y = pan.cy + dy;
    applyCam();
  }
});
window.addEventListener('mouseup', () => { pan = null; wrap.classList.remove('panning'); });

wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const wr = wrap.getBoundingClientRect();
  const mx = e.clientX - wr.left;
  const my = e.clientY - wr.top;
  const worldX = (mx - cam.x) / cam.k;
  const worldY = (my - cam.y) / cam.k;
  const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
  const next = Math.min(2.2, Math.max(0.25, cam.k * factor));
  cam.x = mx - worldX * next;
  cam.y = my - worldY * next;
  cam.k = next;
  applyCam();
}, { passive: false });

window.addEventListener('resize', () => {
  if (!demo.on) centerView();
  else applyCam();
});

document.getElementById('btn-expand').onclick = () => {
  NODES.filter(n => n.kind === 'expandable').forEach(n => expanded.add(n.id));
  render(); showDetail(selected);
};
document.getElementById('btn-collapse').onclick = () => {
  expanded.clear();
  render(); showDetail(selected);
};
document.getElementById('btn-lang').onclick = () => {
  lang = lang === 'en' ? 'zh' : 'en';
  localStorage.setItem(LANG_KEY, lang);
  document.getElementById('btn-lang').textContent = lang === 'en' ? '中文' : 'EN';
  document.getElementById('subtitle').textContent = VL(
    'XR EduAgent · 一轮编排 → 模式 → 大纲/分节子管线 → 收尾',
    'XR EduAgent · turn orchestration → modes → outline / section sub-pipelines → wrap-up'
  );
  document.getElementById('hint').textContent = VL(
    '拖拽平移 · 滚轮缩放 · 点击 ▸ 展开（重叠节点变透明，不挤位）· 点击节点看详情',
    'Drag to pan · Scroll to zoom · Click ▸ to expand (overlays; overlapped nodes fade) · Click a node for details'
  );
  // refresh route option labels
  const sel = document.getElementById('demo-route');
  const map = [
    ['create', VL('创建新的学习体验', 'Create a new learning experience')],
    ['modify', VL('修改某一节', 'Modify a section')],
    ['ask', VL('探究与头脑风暴', 'Inquiry and brainstorming')],
    ['full', VL('完整演示（逐步展开全部子节点）', 'Full demo (expand every child)')],
  ];
  [...sel.options].forEach((opt, i) => { opt.textContent = map[i][1]; });
  document.getElementById('btn-demo').textContent = demo.on
    ? VL('● 演示中', '● Demo on') : VL('▶ 演示', '▶ Demo');
  syncAutoplayBtn();
  render();
  showDetail(selected);
  if (demo.on) applyDemoRound(demo.idx);
};

document.getElementById('btn-lang').textContent = lang === 'en' ? '中文' : 'EN';

document.getElementById('btn-demo').onclick = () => {
  if (demo.on) stopDemo();
  else startDemo();
};
document.getElementById('demo-stop').onclick = () => stopDemo();
document.getElementById('demo-autoplay').onclick = () => {
  if (!demo.on) return;
  demo.autoplay = !demo.autoplay;
  syncAutoplayBtn();
  clearTimeout(demo.timer);
  if (demo.autoplay) {
    const rounds = currentRounds();
    demo.timer = setTimeout(() => {
      if (demo.idx + 1 < rounds.length) applyDemoRound(demo.idx + 1, { fromAuto: true });
      else { demo.autoplay = false; syncAutoplayBtn(); }
    }, 4200);
  }
  // pops keep running either way
};
document.getElementById('demo-next').onclick = () => {
  if (!demo.on) return;
  clearTimeout(demo.timer);
  const rounds = currentRounds();
  if (demo.idx + 1 < rounds.length) applyDemoRound(demo.idx + 1);
};
document.getElementById('demo-prev').onclick = () => {
  if (!demo.on) return;
  clearTimeout(demo.timer);
  applyDemoRound(Math.max(0, demo.idx - 1));
};
document.getElementById('demo-route').onchange = () => {
  if (!demo.on) return;
  demo.route = document.getElementById('demo-route').value;
  clearTimeout(demo.timer);
  applyDemoRound(0);
};

// Fix pedagogy node detail text slightly via runtime: edge now to authoring
const pc = byId['pedagogy-core'];
if (pc) {
  pc.desc = {
    zh: '独立外部知识库：30+ 教学设计模式、200+ 教学动作与实时指导手册。仅一条向下箭头接入「课程创作管线」——在构建 KG / 选型大纲或某一节时做 agentic search，注入最匹配的 pattern×action。',
    en: 'Independent external library: 30+ teaching-design patterns, 200+ actions, realtime guidance. A single down-arrow into Course authoring — agentic search injects the best pattern×action when building the KG / fitting outline or a section.',
  };
  pc.summary = {
    zh: '正上方 · 单向注入创作管线',
    en: 'Directly above · single inject into authoring',
  };
}

render();
showDetail(selected);
</script>
</body>
</html>
'''

out = ROOT / "agent-pipeline.html"
out.write_text(HTML, encoding="utf-8")
print("wrote", out, "bytes", out.stat().st_size)
# sanity
text = out.read_text(encoding="utf-8")
checks = [
  "pedagogy-core', to:'authoring'",
  "Autoplay: Off",
  "demo-route",
  "LOAD SKILL",
  "ghosted",
  "centerView",
  "Inquiry and brainstorming",
  "Full demo",
  "lane-bar",
  "wheel",
]
for c in checks:
  print(c, c in text)
