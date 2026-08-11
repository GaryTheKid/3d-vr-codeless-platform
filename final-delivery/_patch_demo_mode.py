# -*- coding: utf-8 -*-
"""Patch agent-pipeline.html with interactive Demo Mode."""
from pathlib import Path

path = Path(r"E:\创业\XR+AI\Demo\agent-pipeline.html")
html = path.read_text(encoding="utf-8")

CSS = r"""
/* ── Demo mode ── */
.btn.demo-on {
  background: linear-gradient(135deg,#2563eb,#7c3aed); color:#fff; border-color:transparent;
  box-shadow: 0 0 0 1px rgba(91,157,255,.35), 0 8px 24px rgba(91,157,255,.25);
}
.node.demo-hl {
  border-color: #38bdf8 !important;
  box-shadow: 0 0 0 2px rgba(56,189,248,.45), 0 0 28px rgba(56,189,248,.28), var(--shadow) !important;
  animation: demoPulse 1.6s ease-in-out infinite;
  z-index: 4;
}
.node.demo-dim { opacity: .28; filter: grayscale(.35); }
@keyframes demoPulse {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
.edge-path.demo-flow {
  stroke: #38bdf8;
  stroke-width: 2.4;
  stroke-dasharray: 8 10;
  opacity: 1;
  animation: dashFlow 0.85s linear infinite;
  filter: drop-shadow(0 0 4px rgba(56,189,248,.55));
}
@keyframes dashFlow {
  to { stroke-dashoffset: -36; }
}
.edge-label.demo-flow { fill: #7dd3fc; }
.marker-demo path { fill: #38bdf8; }

.call-pop {
  position: absolute; top: -10px; right: -8px; z-index: 8;
  display: flex; flex-direction: column; gap: 4px; align-items: flex-end;
  pointer-events: none; min-width: 0;
}
.call-chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: linear-gradient(135deg, rgba(15,23,42,.95), rgba(30,41,59,.95));
  border: 1px solid rgba(56,189,248,.55);
  color: #e0f2fe; font-size: 10px; font-weight: 600;
  padding: 3px 8px 3px 5px; border-radius: 999px;
  box-shadow: 0 6px 18px rgba(0,0,0,.45), 0 0 12px rgba(56,189,248,.25);
  white-space: nowrap; max-width: 180px;
  animation: chipPop .45s cubic-bezier(.2,1.4,.3,1) both;
}
.call-chip .ci {
  width: 16px; height: 16px; border-radius: 5px; display: grid; place-items: center;
  font-size: 10px; background: rgba(56,189,248,.18);
}
.call-chip.skill .ci { background: rgba(167,139,250,.22); }
.call-chip.tool .ci { background: rgba(62,207,142,.22); }
.call-chip .cn { overflow: hidden; text-overflow: ellipsis; }
@keyframes chipPop {
  0% { opacity: 0; transform: translateY(8px) scale(.85); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes chipOut {
  to { opacity: 0; transform: translateY(-10px) scale(.9); }
}
.call-chip.out { animation: chipOut .35s ease forwards; }

#demo-dock {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%) translateY(120%);
  width: min(720px, calc(100vw - 380px)); z-index: 40;
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
#demo-dock .controls { display:flex; gap:6px; margin-top:10px; justify-content:flex-end; }
body.demo-running .hint { opacity: 0; pointer-events: none; }
"""

if "/* ── Demo mode ── */" not in html:
    html = html.replace(".edge-label.hl { fill: #93c5fd; }\n</style>",
                        ".edge-label.hl { fill: #93c5fd; }\n" + CSS + "\n</style>")

html = html.replace(
    """    <button class="btn" id="btn-expand">Expand all</button>
    <button class="btn" id="btn-collapse">Collapse all</button>
    <button class="btn" id="btn-lang">中文</button>
  </nav>
</header>""",
    """    <button class="btn" id="btn-demo">▶ Demo</button>
    <button class="btn" id="btn-expand">Expand all</button>
    <button class="btn" id="btn-collapse">Collapse all</button>
    <button class="btn" id="btn-lang">中文</button>
  </nav>
</header>
<div id="demo-dock">
  <div class="row">
    <span class="step" id="demo-step">STEP 1/1</span>
    <div style="flex:1;min-width:0">
      <h3 id="demo-title">Demo</h3>
      <p id="demo-blurb"></p>
      <div class="bar"><i id="demo-bar"></i></div>
      <div class="controls">
        <button class="btn" id="demo-prev">◀ Prev</button>
        <button class="btn" id="demo-pause">Pause</button>
        <button class="btn" id="demo-next">Next ▶</button>
        <button class="btn" id="demo-stop">Stop</button>
      </div>
    </div>
  </div>
</div>"""
)

# Insert catalog + demo engine before `let selected`
DEMO_JS = r"""
// ── Real skill / tool catalogs (subset used by demo popups; names match codebase) ──
const SKILL_CAT = {
  'course-pipeline': { icon:'🧭', zh:'备课流水线', en:'Course Pipeline' },
  'course-outline': { icon:'📋', zh:'课程大纲', en:'Course Outline' },
  'course-reading': { icon:'📖', zh:'阅读节', en:'Reading Section' },
  'course-h5': { icon:'🖱️', zh:'H5 交互节', en:'H5 Interactive Section' },
  'course-quiz': { icon:'✅', zh:'测验节', en:'Quiz Section' },
  'course-live-edit': { icon:'✏️', zh:'对话改课', en:'Live Course Edit' },
  'pedagogy': { icon:'📚', zh:'教学设计', en:'Pedagogy' },
  'scene-organization': { icon:'🏗️', zh:'场景组织', en:'Scene Organization' },
  'object-creation': { icon:'🧱', zh:'对象创建', en:'Object Creation' },
  'custom-modeling': { icon:'🎨', zh:'精细建模', en:'Detailed Modeling' },
  'experiment-logic': { icon:'⚗️', zh:'实验逻辑', en:'Experiment Logic' },
  'interaction-design': { icon:'👆', zh:'交互设计', en:'Interaction Design' },
  'animation': { icon:'🌀', zh:'动画配置', en:'Animation Setup' },
  'ui-panel': { icon:'🪧', zh:'教学面板', en:'Teaching Panels' },
  'validation': { icon:'✔️', zh:'结果校验', en:'Result Validation' },
  'locomotion': { icon:'🚶', zh:'学生移动', en:'Student Locomotion' },
  'xr-design': { icon:'🥽', zh:'XR 体验', en:'XR Experience' },
  'view-navigation': { icon:'🔭', zh:'视角与导览', en:'View & Navigation' },
  'room-design': { icon:'🏠', zh:'室内场景', en:'Room Design' },
  'debugging': { icon:'🩹', zh:'排障与修复', en:'Debugging & Repair' },
};
const TOOL_CAT = {
  'course_tag_figures': { icon:'🖼️', zh:'course_tag_figures', en:'course_tag_figures' },
  'course_build_outline_from_doc': { icon:'🕸', zh:'course_build_outline_from_doc', en:'course_build_outline_from_doc' },
  'course_fill_section': { icon:'🧩', zh:'course_fill_section', en:'course_fill_section' },
  'course_kg_digest': { icon:'📎', zh:'course_kg_digest', en:'course_kg_digest' },
  'course_enrich_reading_images': { icon:'🎨', zh:'course_enrich_reading_images', en:'course_enrich_reading_images' },
  'course_generate_image': { icon:'🖼️', zh:'course_generate_image', en:'course_generate_image' },
  'outline_get': { icon:'📋', zh:'outline_get', en:'outline_get' },
  'outline_set_active': { icon:'👉', zh:'outline_set_active', en:'outline_set_active' },
  'outline_add_section': { icon:'＋', zh:'outline_add_section', en:'outline_add_section' },
  'outline_add_chapter': { icon:'＋', zh:'outline_add_chapter', en:'outline_add_chapter' },
  'outline_update_section': { icon:'✎', zh:'outline_update_section', en:'outline_update_section' },
  'outline_remove_section': { icon:'🗑', zh:'outline_remove_section', en:'outline_remove_section' },
  'reading_set_chunks': { icon:'📖', zh:'reading_set_chunks', en:'reading_set_chunks' },
  'h5_set_content': { icon:'🖱️', zh:'h5_set_content', en:'h5_set_content' },
  'quiz_set_items': { icon:'✅', zh:'quiz_set_items', en:'quiz_set_items' },
  'add_asset': { icon:'📦', zh:'add_asset', en:'add_asset' },
  'create_custom_object': { icon:'🧬', zh:'create_custom_object', en:'create_custom_object' },
  'set_behavior': { icon:'⚙️', zh:'set_behavior', en:'set_behavior' },
  'update_object': { icon:'🔧', zh:'update_object', en:'update_object' },
  'add_panel': { icon:'🪧', zh:'add_panel', en:'add_panel' },
  'update_panel': { icon:'🪧', zh:'update_panel', en:'update_panel' },
  'add_quiz_panel': { icon:'❓', zh:'add_quiz_panel', en:'add_quiz_panel' },
  'get_scene': { icon:'🔍', zh:'get_scene', en:'get_scene' },
  'find_objects': { icon:'🔎', zh:'find_objects', en:'find_objects' },
  'report_progress': { icon:'📶', zh:'report_progress', en:'report_progress' },
  'build_room': { icon:'🏠', zh:'build_room', en:'build_room' },
  'build_stairs': { icon:'🪜', zh:'build_stairs', en:'build_stairs' },
  'add_path': { icon:'〰', zh:'add_path', en:'add_path' },
  'add_arrow': { icon:'➤', zh:'add_arrow', en:'add_arrow' },
  'configure_locomotion': { icon:'🚶', zh:'configure_locomotion', en:'configure_locomotion' },
  'set_student_view': { icon:'👁', zh:'set_student_view', en:'set_student_view' },
};

/** Per-node real skills/tools that may fire in that step (empty = no popup). */
const NODE_CALLS = {
  'input-trigger': { skills:[], tools:[] },
  'in-prompt': { skills:[], tools:[] },
  'in-material': { skills:[], tools:[] },
  'in-combo': { skills:[], tools:[] },
  'turn': { skills:[], tools:[] },
  'context': { skills:[], tools:['outline_get','course_kg_digest','get_scene'] },
  'modes': { skills:[], tools:[] },
  'mode-ask': { skills:[], tools:[] },
  'mode-agent': { skills:['course-pipeline','course-outline','pedagogy','scene-organization'], tools:['report_progress'] },
  'mode-plan': { skills:['course-pipeline','debugging','validation'], tools:[] },
  'agent-analyze': { skills:['course-pipeline','course-live-edit','course-outline'], tools:['outline_get'] },
  'route-new': { skills:['course-pipeline','course-outline','pedagogy'], tools:['course_tag_figures','course_build_outline_from_doc'] },
  'route-mod': { skills:['course-live-edit','course-outline'], tools:['outline_update_section','outline_add_section','outline_remove_section'] },
  'route-plan': { skills:['course-pipeline','validation'], tools:[] },
  'route-ask': { skills:[], tools:[] },
  'authoring': { skills:['course-pipeline','course-outline','pedagogy'], tools:['course_tag_figures','course_build_outline_from_doc'] },
  'aha': { skills:['course-pipeline','pedagogy'], tools:['course_build_outline_from_doc'] },
  'kg': { skills:['course-pipeline','pedagogy','course-outline'], tools:['course_build_outline_from_doc','course_kg_digest'] },
  'pedagogy-core': { skills:['pedagogy'], tools:[] },
  'author-outline': { skills:['course-outline','course-pipeline'], tools:['course_build_outline_from_doc','outline_get'] },
  'outline': { skills:['course-outline','course-live-edit'], tools:['outline_get','outline_set_active'] },
  'sec-reading': { skills:['course-reading','pedagogy'], tools:['course_fill_section','reading_set_chunks'] },
  'rd-purpose': { skills:['course-reading','pedagogy'], tools:[] },
  'rd-crud': { skills:['course-outline'], tools:['outline_add_section','outline_remove_section'] },
  'rd-mod': { skills:['course-reading'], tools:['reading_set_chunks','course_enrich_reading_images'] },
  'rd-pipe': { skills:['course-reading'], tools:['course_fill_section','reading_set_chunks'] },
  'rd-planner': { skills:['course-reading','pedagogy'], tools:[] },
  'rd-skills': { skills:['course-reading','pedagogy'], tools:[] },
  'rd-tools': { skills:[], tools:['reading_set_chunks','course_enrich_reading_images','course_generate_image'] },
  'sec-h5': { skills:['course-h5','interaction-design'], tools:['course_fill_section','h5_set_content'] },
  'h5-purpose': { skills:['course-h5','pedagogy'], tools:[] },
  'h5-crud': { skills:['course-outline'], tools:['outline_add_section','outline_remove_section'] },
  'h5-mod': { skills:['course-h5','interaction-design'], tools:['h5_set_content'] },
  'h5-pipe': { skills:['course-h5','interaction-design'], tools:['course_fill_section','h5_set_content'] },
  'h5-planner': { skills:['course-h5','interaction-design'], tools:[] },
  'h5-skills': { skills:['course-h5','interaction-design'], tools:[] },
  'h5-tools': { skills:[], tools:['h5_set_content'] },
  'sec-3d': { skills:['scene-organization','object-creation','custom-modeling','experiment-logic'], tools:['course_fill_section','create_custom_object','add_asset'] },
  'vr-purpose': { skills:['pedagogy','experiment-logic'], tools:[] },
  'vr-crud': { skills:['course-outline'], tools:['outline_add_section','outline_set_active'] },
  'vr-mod': { skills:['course-live-edit','object-creation','custom-modeling'], tools:['update_object','create_custom_object','set_behavior'] },
  'vr-pipe': { skills:['scene-organization','object-creation','custom-modeling','ui-panel','validation'], tools:['course_fill_section','create_custom_object','add_panel','get_scene'] },
  'vr-iso': { skills:[], tools:[] },
  'vr-planner': { skills:['scene-organization','pedagogy','experiment-logic'], tools:['report_progress'] },
  'vr-skills': { skills:['scene-organization','object-creation','custom-modeling','experiment-logic','interaction-design','ui-panel','animation','validation','locomotion','room-design'], tools:[] },
  'vr-tools': { skills:[], tools:['add_asset','create_custom_object','set_behavior','update_object','add_panel','add_quiz_panel','get_scene','find_objects','build_room','build_stairs','add_path','add_arrow','configure_locomotion','set_student_view','report_progress'] },
  'vr-dual': { skills:['custom-modeling','object-creation','room-design'], tools:['create_custom_object','build_room','build_stairs','add_path'] },
  'vr-panel': { skills:['ui-panel'], tools:['add_panel','update_panel','add_quiz_panel'] },
  'vr-dedup': { skills:['validation','debugging'], tools:['get_scene'] },
  'vr-snap': { skills:[], tools:[] },
  'sec-quiz': { skills:['course-quiz','pedagogy'], tools:['course_fill_section','quiz_set_items'] },
  'qz-purpose': { skills:['course-quiz','pedagogy'], tools:[] },
  'qz-crud': { skills:['course-outline'], tools:['outline_add_section','outline_remove_section'] },
  'qz-mod': { skills:['course-quiz'], tools:['quiz_set_items'] },
  'qz-pipe': { skills:['course-quiz'], tools:['course_fill_section','quiz_set_items'] },
  'qz-planner': { skills:['course-quiz','pedagogy'], tools:[] },
  'qz-skills': { skills:['course-quiz'], tools:[] },
  'qz-tools': { skills:[], tools:['quiz_set_items'] },
  'wrap': { skills:['validation'], tools:['get_scene','report_progress'] },
};

/**
 * Demo rounds in execution order for a "Build from this" new-outline story.
 * Each round highlights a set of nodes; expand lists which expandable parents to open.
 */
const DEMO_ROUNDS = [
  {
    id: 'r1',
    expand: ['input-trigger'],
    nodes: ['input-trigger','in-material','in-combo'],
    title: { zh:'① 输入触发', en:'① Input trigger' },
    blurb: { zh:'老师上传 PDF，并点击「据此备课」。材料与指令组合进入管线。', en:'Teacher uploads a PDF and clicks “Build from this”. Material + prompt combo starts the pipeline.' },
  },
  {
    id: 'r2',
    expand: ['input-trigger'],
    nodes: ['turn'],
    title: { zh:'② 一轮编排', en:'② Turn orchestration' },
    blurb: { zh:'runTurn：加锁、重置进度卡与统计、写下 turn_start 日志，然后进入上下文构建。', en:'runTurn: busy-lock, reset progress/stats, log turn_start, then build context.' },
  },
  {
    id: 'r3',
    expand: [],
    nodes: ['context'],
    title: { zh:'③ 构建输入上下文', en:'③ Build input context' },
    blurb: { zh:'锁定本轮上下文：用户输入 + Outline 树 + 当前节场景/内容 + 材料 + KG 摘要。', en:'Lock this turn’s context: user input + outline tree + active section + material + KG digest.' },
  },
  {
    id: 'r4',
    expand: ['modes'],
    nodes: ['modes','mode-agent'],
    title: { zh:'④ 模式分流 → Agent', en:'④ Mode route → Agent' },
    blurb: { zh:'备课属于可改写任务，进入 Agent 模式（技能路由 + 工具循环），而非只读 Ask。', en:'Authoring is a mutating task → Agent mode (skill routing + tool loop), not read-only Ask.' },
  },
  {
    id: 'r5',
    expand: ['agent-analyze'],
    nodes: ['agent-analyze','route-new'],
    title: { zh:'⑤ 任务分析 → 新建大纲', en:'⑤ Task analysis → New outline' },
    blurb: { zh:'分析意图：首次从材料生成整课 → 新建 Learning Outline 路径。', en:'Classify intent: first-time full course from material → New Learning Outline path.' },
  },
  {
    id: 'r6',
    expand: ['authoring'],
    nodes: ['authoring','aha','pedagogy-core','kg'],
    title: { zh:'⑥ Aha + Pedagogy Core → KG', en:'⑥ Aha + Pedagogy Core → KG' },
    blurb: { zh:'蒸馏顿悟点；Pedagogy Core 做 agentic search 匹配 pattern×action；写入可校验知识图谱。', en:'Distill aha keys; Pedagogy Core runs agentic search for pattern×action; write a checkable KG.' },
  },
  {
    id: 'r7',
    expand: ['authoring'],
    nodes: ['author-outline','outline'],
    title: { zh:'⑦ 写出学习大纲骨架', en:'⑦ Write Learning Outline skeleton' },
    blurb: { zh:'生成章/节树，绑定 covers[] / installsAha[]，四种节类型就位。', en:'Generate chapter/section tree with covers[] / installsAha[]; four section types ready.' },
  },
  {
    id: 'r8',
    expand: ['outline','sec-reading','rd-pipe'],
    nodes: ['sec-reading','rd-pipe','rd-planner','rd-skills','rd-tools'],
    title: { zh:'⑧ 阅读节子管线', en:'⑧ Reading sub-pipeline' },
    blurb: { zh:'Scaffold：节 Planner → 加载 course-reading → reading_set_chunks / 配图。', en:'Scaffold: section Planner → load course-reading → reading_set_chunks / figures.' },
  },
  {
    id: 'r9',
    expand: ['outline','sec-h5','h5-pipe'],
    nodes: ['sec-h5','h5-pipe','h5-planner','h5-skills','h5-tools'],
    title: { zh:'⑨ H5 交互子管线', en:'⑨ H5 interactive sub-pipeline' },
    blurb: { zh:'Construct：选 interactionKind → course-h5 → h5_set_content（禁止静态传单）。', en:'Construct: pick interactionKind → course-h5 → h5_set_content (no static flyers).' },
  },
  {
    id: 'r10',
    expand: ['outline','sec-3d','vr-pipe'],
    nodes: ['sec-3d','vr-pipe','vr-iso','vr-planner','vr-skills','vr-tools','vr-dual','vr-panel'],
    title: { zh:'⑩ 3D 子管线（重点）', en:'⑩ 3D sub-pipeline (focus)' },
    blurb: { zh:'隔离填充 → 技能暴露 → 双轨建造/面板工具循环 → 快照落盘。串行，防串景。', en:'Isolated fill → skill disclosure → dual-track build/panel tool loop → snapshot. Serial, no scene bleed.' },
  },
  {
    id: 'r11',
    expand: ['outline','sec-quiz','qz-pipe'],
    nodes: ['sec-quiz','qz-pipe','qz-planner','qz-skills','qz-tools'],
    title: { zh:'⑪ 测验节子管线', en:'⑪ Quiz sub-pipeline' },
    blurb: { zh:'Transfer：迁移题面 + misconception 干扰项 → quiz_set_items。', en:'Transfer: re-skinned items + misconception distractors → quiz_set_items.' },
  },
  {
    id: 'r12',
    expand: ['outline'],
    nodes: ['wrap'],
    title: { zh:'⑫ 收尾 Wrap-up', en:'⑫ Wrap-up' },
    blurb: { zh:'所有支路汇合：自检、历史、Keep/Undo、开发日志 turn_end，解锁 busy。', en:'All branches converge: self-check, history, Keep/Undo, turn_end logs, release busy.' },
  },
];

// ── Demo runtime ──
let demo = {
  on: false,
  paused: false,
  idx: 0,
  timer: null,
  popTimers: [],
  hl: new Set(),
};

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
  if (!demo.on || demo.paused) return;
  document.querySelectorAll('.node.demo-hl').forEach(el => {
    const id = el.dataset.nid;
    const calls = nodeCalls(id);
    if (!calls.length) return;
    const host = el.querySelector('.call-pop');
    if (!host) return;

    const tick = () => {
      if (!demo.on || demo.paused || !el.isConnected) return;
      const pick = calls[Math.floor(Math.random() * calls.length)];
      const meta = callLabel(pick.kind, pick.id);
      const chip = document.createElement('div');
      chip.className = 'call-chip ' + pick.kind;
      chip.innerHTML = `<span class="ci">${meta.icon}</span><span class="cn">${esc(meta.name)}</span>`;
      host.appendChild(chip);
      while (host.children.length > 2) host.firstChild.remove();
      const life = 1600 + Math.random() * 1200;
      const tOut = setTimeout(() => {
        chip.classList.add('out');
        setTimeout(() => chip.remove(), 360);
      }, life);
      demo.popTimers.push(tOut);
      const next = 500 + Math.random() * 1500;
      const tNext = setTimeout(tick, next);
      demo.popTimers.push(tNext);
    };
    const t0 = setTimeout(tick, 200 + Math.random() * 400);
    demo.popTimers.push(t0);
  });
}

function applyDemoRound(i, { autoAdvance = true } = {}) {
  const round = DEMO_ROUNDS[i];
  if (!round) return;
  demo.idx = i;
  // Expand only what this round needs (+ ancestors)
  expanded.clear();
  for (const id of round.expand) {
    expanded.add(id);
    let p = byId[id]?.parent;
    while (p) { expanded.add(p); p = byId[p]?.parent; }
  }
  // Also expand ancestors of highlighted nodes
  for (const id of round.nodes) {
    let p = byId[id]?.parent;
    while (p) { expanded.add(p); p = byId[p]?.parent; }
  }
  demo.hl = new Set(round.nodes);
  selected = round.nodes[0] || selected;
  render();
  showDetail(selected);
  scrollDemoIntoView(round.nodes);

  // Dock
  const dock = document.getElementById('demo-dock');
  dock.classList.add('show');
  document.getElementById('demo-step').textContent = `STEP ${i + 1}/${DEMO_ROUNDS.length}`;
  document.getElementById('demo-title').textContent = T(round.title);
  document.getElementById('demo-blurb').textContent = T(round.blurb);
  document.getElementById('demo-bar').style.width = `${((i + 1) / DEMO_ROUNDS.length) * 100}%`;
  document.getElementById('demo-pause').textContent = demo.paused ? VL('继续', 'Resume') : VL('暂停', 'Pause');

  schedulePops();

  clearTimeout(demo.timer);
  if (demo.on && !demo.paused && autoAdvance) {
    const dur = 4200;
    demo.timer = setTimeout(() => {
      if (demo.idx + 1 < DEMO_ROUNDS.length) applyDemoRound(demo.idx + 1);
      else stopDemo(false);
    }, dur);
  }
}

function scrollDemoIntoView(ids) {
  const wrap = document.getElementById('canvas-wrap');
  const first = ids.map(id => document.querySelector(`.node[data-nid="${id}"]`)).find(Boolean);
  if (!first) return;
  const r = first.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const cx = r.left + r.width / 2 - wr.left + wrap.scrollLeft;
  const cy = r.top + r.height / 2 - wr.top + wrap.scrollTop;
  wrap.scrollTo({
    left: Math.max(0, cx - wr.width / 2),
    top: Math.max(0, cy - wr.height / 2.4),
    behavior: 'smooth',
  });
}

function startDemo() {
  demo.on = true;
  demo.paused = false;
  document.body.classList.add('demo-running');
  document.getElementById('btn-demo').classList.add('demo-on');
  document.getElementById('btn-demo').textContent = VL('● 演示中', '● Demo on');
  applyDemoRound(0);
}

function stopDemo(collapse = true) {
  demo.on = false;
  demo.paused = false;
  clearTimeout(demo.timer);
  clearPopTimers();
  demo.hl = new Set();
  document.body.classList.remove('demo-running');
  document.getElementById('btn-demo').classList.remove('demo-on');
  document.getElementById('btn-demo').textContent = VL('▶ 演示', '▶ Demo');
  document.getElementById('demo-dock').classList.remove('show');
  if (collapse) expanded.clear();
  render();
  showDetail(selected);
}

function togglePause() {
  if (!demo.on) return;
  demo.paused = !demo.paused;
  document.getElementById('demo-pause').textContent = demo.paused ? VL('继续', 'Resume') : VL('暂停', 'Pause');
  if (demo.paused) {
    clearTimeout(demo.timer);
    clearPopTimers();
  } else {
    schedulePops();
    demo.timer = setTimeout(() => {
      if (demo.idx + 1 < DEMO_ROUNDS.length) applyDemoRound(demo.idx + 1);
      else stopDemo(false);
    }, 3000);
  }
}

"""

marker = "let selected = 'input-trigger';"
if "const DEMO_ROUNDS" not in html:
    html = html.replace(marker, DEMO_JS + "\n" + marker)

# Patch render: marker for demo flow + node classes + call-pop + data-nid
old_defs = """    <marker id="arr-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#5b9dff"/>
    </marker>`;"""
new_defs = """    <marker id="arr-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#5b9dff"/>
    </marker>
    <marker id="arr-demo" class="marker-demo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#38bdf8"/>
    </marker>`;"""
html = html.replace(old_defs, new_defs)

old_edge_hl = """  // highlight edges for selection
  edgeEls.forEach(({ ed, p, t }) => {
    const hl = ed.from === selected || ed.to === selected;
    p.classList.toggle('hl', hl);
    p.setAttribute('marker-end', hl ? 'url(#arr-hl)' : 'url(#arr)');
    t?.classList.toggle('hl', hl);
  });"""

new_edge_hl = """  // highlight edges for selection OR demo flow (dashed moving wires to next steps)
  edgeEls.forEach(({ ed, p, t }) => {
    const selHl = ed.from === selected || ed.to === selected;
    const demoFlow = demo.on && demo.hl.has(ed.from) && (
      demo.hl.has(ed.to) || DEMO_ROUNDS[demo.idx]?.nodes.includes(ed.to) === false && isNextStepEdge(ed)
    );
    // Flow: from any highlighted node to its outbound next-step targets (including non-hl next spine)
    const fromHl = demo.on && demo.hl.has(ed.from);
    p.classList.toggle('hl', !fromHl && selHl);
    p.classList.toggle('demo-flow', !!fromHl);
    p.setAttribute('marker-end', fromHl ? 'url(#arr-demo)' : (selHl ? 'url(#arr-hl)' : 'url(#arr)'));
    t?.classList.toggle('hl', selHl || fromHl);
    t?.classList.toggle('demo-flow', !!fromHl);
  });"""

# Simpler: flow any edge where from is highlighted (wires leaving current exec set)
new_edge_hl = """  // selection highlight OR demo flowing dashed wires out of active nodes
  edgeEls.forEach(({ ed, p, t }) => {
    const selHl = !demo.on && (ed.from === selected || ed.to === selected);
    const fromHl = demo.on && demo.hl.has(ed.from);
    p.classList.toggle('hl', selHl);
    p.classList.toggle('demo-flow', !!fromHl);
    p.setAttribute('marker-end', fromHl ? 'url(#arr-demo)' : (selHl ? 'url(#arr-hl)' : 'url(#arr)'));
    t?.classList.toggle('hl', selHl || fromHl);
    t?.classList.toggle('demo-flow', !!fromHl);
  });"""

html = html.replace(old_edge_hl, new_edge_hl)

old_node_cls = """    el.className = 'node'
      + (n.kind === 'expandable' ? ' expandable' : '')
      + (n.kind === 'child' ? ' child-node' : '')
      + (n.kind === 'external' ? ' external' : '')
      + (expanded.has(n.id) ? ' expanded' : '')
      + (n.id === 'wrap' ? ' wrap' : '')
      + (selected === n.id ? ' selected' : '');
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.width = p.w + 'px';
    const g = GROUP[n.group] || { color:'#5b9dff', name:{en:n.group, zh:n.group} };
    el.innerHTML = `
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
      <div class="summary">${esc(T(n.summary || n.desc))}</div>`;"""

new_node_cls = """    const isHl = demo.on && demo.hl.has(n.id);
    const isDim = demo.on && !isHl;
    el.dataset.nid = n.id;
    el.className = 'node'
      + (n.kind === 'expandable' ? ' expandable' : '')
      + (n.kind === 'child' ? ' child-node' : '')
      + (n.kind === 'external' ? ' external' : '')
      + (expanded.has(n.id) ? ' expanded' : '')
      + (n.id === 'wrap' ? ' wrap' : '')
      + (selected === n.id && !demo.on ? ' selected' : '')
      + (isHl ? ' demo-hl' : '')
      + (isDim ? ' demo-dim' : '');
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.width = p.w + 'px';
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
      <div class="summary">${esc(T(n.summary || n.desc))}</div>`;"""

if "el.dataset.nid = n.id;" not in html:
    html = html.replace(old_node_cls, new_node_cls)

# After nodes appended, reschedule pops if demo on
html = html.replace(
    """  document.getElementById('legend').innerHTML = Object.entries(GROUP).map(([k,v]) =>
    `<span><i style="background:${v.color}"></i>${esc(T(v.name))}</span>`).join('');
}""",
    """  document.getElementById('legend').innerHTML = Object.entries(GROUP).map(([k,v]) =>
    `<span><i style="background:${v.color}"></i>${esc(T(v.name))}</span>`).join('');

  if (demo.on) {
    // rebind pop hosts after DOM rebuild
    clearTimeout(demo._popKick);
    demo._popKick = setTimeout(schedulePops, 40);
  }
}"""
)

# Wire buttons at end
old_end = """document.getElementById('btn-lang').textContent = lang === 'en' ? '中文' : 'EN';
render();
showDetail(selected);
</script>"""

new_end = """document.getElementById('btn-lang').textContent = lang === 'en' ? '中文' : 'EN';

document.getElementById('btn-demo').onclick = () => {
  if (demo.on) stopDemo();
  else startDemo();
};
document.getElementById('demo-stop').onclick = () => stopDemo();
document.getElementById('demo-pause').onclick = () => togglePause();
document.getElementById('demo-next').onclick = () => {
  if (!demo.on) return;
  clearTimeout(demo.timer);
  if (demo.idx + 1 < DEMO_ROUNDS.length) applyDemoRound(demo.idx + 1, { autoAdvance: !demo.paused });
  else stopDemo(false);
};
document.getElementById('demo-prev').onclick = () => {
  if (!demo.on) return;
  clearTimeout(demo.timer);
  applyDemoRound(Math.max(0, demo.idx - 1), { autoAdvance: !demo.paused });
};

// Keep demo button label bilingual on lang switch
const _langBtn = document.getElementById('btn-lang');
const _prevLang = _langBtn.onclick;
_langBtn.onclick = () => {
  _prevLang && _prevLang();
  document.getElementById('btn-demo').textContent = demo.on
    ? VL('● 演示中', '● Demo on')
    : VL('▶ 演示', '▶ Demo');
  if (demo.on) applyDemoRound(demo.idx, { autoAdvance: !demo.paused });
};

render();
showDetail(selected);
</script>"""

html = html.replace(old_end, new_end)

# Fix lang button double-binding issue - the original assigns onclick, we wrapped it.
# Also update btn-lang handler to refresh demo dock text - already handled.

path.write_text(html, encoding="utf-8")
print("patched", path, "bytes", path.stat().st_size)
# sanity
for needle in ["DEMO_ROUNDS", "btn-demo", "demo-flow", "schedulePops", "NODE_CALLS"]:
    print(needle, needle in html)
