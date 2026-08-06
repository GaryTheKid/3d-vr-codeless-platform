// Agent 工作流有向图 + 工具目录(agent-viewer*.html 的数据源)
// ⚠ 内容保持 JSON 字面量,仅外面包了一层赋值——这样可视化页在 file:// 下
//   当普通 <script> 加载即可拿到数据(file:// 禁 fetch,.json 无法读取)
// ⚠ 文案字段一律写成 {"zh":"…","en":"…"} 双语对象(查看器按语言开关取值);
//   新增节点/工具必须同时给中英文。维护规约见 js/agent/README.md
globalThis.XR_AGENT_MAP =
{
  "meta": {
    "version": 5,
    "updated": "2026-08-05",
    "note": "Agent 工作流有向图 + 工具目录(v5: 教学设计资产 pedagogy/ + 已落地材料→KG→大纲→分节填充流水线 + Outline/Docling/非VR工作区/大纲与 course_* 工具 + 课程技能)。相对最初纯 3D/VR 产品的差异见 EVOLUTION.md。全部文案 zh/en。维护见 js/agent/README.md。"
  },

  "workflow": {
    "entry": "input",
    "nodes": [
      {
        "id": "input",
        "icon": "⌨️",
        "col": 0,
        "group": "input",
        "title": { "zh": "老师发送输入", "en": "Teacher sends input" },
        "desc": {
          "zh": "一轮对话的起点。输入入口:① 右栏聊天;② 快捷 chips;③ 检查器对象级 AI;④ 计划确认卡反馈;⑤ 📎「据此备课」;⑥ 学习大纲改结构;⑦(规划)材料→KG→大纲备课流水线。汇到 chat.js → runTurn。",
          "en": "Start of a turn. Entries: ① chat; ② chips; ③ inspector AI; ④ plan-card feedback; ⑤ “Build from this”; ⑥ Outline edits; ⑦ (planned) material→KG→outline pipeline. All → chat.js → runTurn."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/ui/chat.js"
      },
      {
        "id": "doc-ingest",
        "icon": "📄",
        "col": 0,
        "group": "input",
        "title": { "zh": "文档上传 Docling", "en": "Document ingest (Docling)" },
        "desc": {
          "zh": "📎 上传 PDF/Word/PPT → POST /__doc/convert → Markdown + 抽图。doc-context.js 挂载;摘要语言跟 UI。材料本身不改课——规划路径:先过知识图谱,再写 Outline / 填内容。",
          "en": "📎 Upload PDF/Word/PPT → POST /__doc/convert → Markdown + images. Held in doc-context.js; summary follows UI language. Material alone does not build the course — planned path: Knowledge Graph first, then Outline / content fill."
        },
        "uses": {
          "skills": [],
          "tools": [
            { "zh": "(HTTP /__doc/convert;非 Agent 工具协议)", "en": "(HTTP /__doc/convert; not the Agent tool protocol)" }
          ]
        },
        "file": "js/agent/doc-context.js + server.py + services/docling_service.py"
      },
      {
        "id": "pedagogy",
        "icon": "📚",
        "col": 1,
        "group": "course",
        "title": { "zh": "教学设计资产 Pedagogy", "en": "Pedagogy assets" },
        "desc": {
          "zh": "静态只读资产(js/agent/pedagogy/):pattern_library_v1.0_en.md(24 模式 P00–P23,按 K1–K7×节角色查表);action_vocab_master_v2_en.json(唯一可编辑源,18 功能族)+ 三学段视图(生成物勿手改);pdf_course_pipeline_v1.0_en.md(另一产品参考流水线)。铁律:动作只能经 pattern slot 的 moves_from 选取,禁止当块类型点菜。本产品 remap:interactive_3d→vr / interactive_2d→h5 / 文本→reading / quiz_*→quiz 或 follow-up。",
          "en": "Versioned read-only assets under js/agent/pedagogy/: pattern_library_v1.0_en.md (24 patterns P00–P23, lookup by K1–K7 × section role); action_vocab_master_v2_en.json (sole editable source, 18 families) + 3 level views (generated — never hand-edit); pdf_course_pipeline_v1.0_en.md (reference pipeline from sibling product). Iron rule: actions only via pattern slot moves_from — never a free block-type picker. Remap here: interactive_3d→vr / interactive_2d→h5 / prose→reading / quiz_*→quiz section or follow-up."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/agent/pedagogy/* + EVOLUTION.md"
      },
      {
        "id": "knowledge-graph",
        "icon": "🕸",
        "col": 1,
        "group": "course",
        "title": { "zh": "知识图谱 / 思维导图", "en": "Knowledge Graph / MindMap" },
        "desc": {
          "zh": "【已落地】从文档+用户意图抽出概念/原理/技能节点与依赖边、贯穿主例、学段。经 course_build_outline_from_doc / extractKgAndOutlinePlan 写入 state.knowledgeGraph 与项目 cfg;后续大纲 covers[] 与分节填充必须对齐 KG。",
          "en": "[Shipped] Mines concept/principle/skill nodes + edges, anchor example, learner level from doc + intent via course_build_outline_from_doc / extractKgAndOutlinePlan into state.knowledgeGraph + project cfg. Outline covers[] and section fill must align to the KG."
        },
        "uses": {
          "skills": [{ "zh": "course-outline / course-pipeline", "en": "course-outline / course-pipeline" }],
          "tools": [
            { "zh": "course_tag_figures / course_build_outline_from_doc / course_kg_digest", "en": "course_tag_figures / course_build_outline_from_doc / course_kg_digest" }
          ]
        },
        "file": "js/core/knowledge-graph.js + js/agent/course-pipeline.js"
      },
      {
        "id": "course-pipeline",
        "icon": "🧭",
        "col": 1,
        "group": "course",
        "title": { "zh": "备课流水线", "en": "Course authoring pipeline" },
        "desc": {
          "zh": "【已落地】raw→Docling md →① course_tag_figures →②③ course_build_outline_from_doc(KG+Outline) →④ 逐节 course_fill_section / runCoursePipeline(阅读+gpt-image 软性≥1图;H5 自适应高度;测验;VR 每节独立场景快照)。技能 course-pipeline / course-outline / course-reading / course-h5 / course-quiz 引导弱模型调工具。",
          "en": "[Shipped] raw→Docling md →① course_tag_figures →②③ course_build_outline_from_doc (KG+Outline) →④ per-section course_fill_section / runCoursePipeline (reading + soft ≥1 gpt-image; auto-height H5; quiz; isolated VR scene per section). Skills course-pipeline / course-outline / course-reading / course-h5 / course-quiz guide weaker models to tools."
        },
        "uses": {
          "skills": [
            { "zh": "course-pipeline + course-outline + course-reading / course-h5 / course-quiz", "en": "course-pipeline + course-outline + course-reading / course-h5 / course-quiz" }
          ],
          "tools": [
            { "zh": "course_* + outline_* / reading_set_chunks / h5_set_content / quiz_set_items + 场景工具", "en": "course_* + outline_* / reading_set_chunks / h5_set_content / quiz_set_items + scene tools" }
          ]
        },
        "file": "js/agent/course-pipeline.js + js/agent/tools/course-pipeline-tools.js"
      },
      {
        "id": "turn",
        "icon": "🎬",
        "col": 1,
        "group": "orchestrate",
        "title": { "zh": "一轮编排开始 runTurn", "en": "Turn orchestration starts (runTurn)" },
        "desc": {
          "zh": "编排器主入口:busy 加锁防并发;state.ctxTurn++(工作集轮次,近 3 轮被工具创建/修改的对象会自动进大场景预取);resetTurnStats() 清零本轮 token/花费统计;清空 lastProgress 并 emit('agent-turn-start') 让聊天区重置流水线进度卡;logEvent('turn_start') 落结构化日志。然后按 hasLLM() 分流:已配置代理密钥走 LLM 路径,否则走离线关键词规则。",
          "en": "Main orchestrator entry: takes the busy lock against concurrent turns; increments state.ctxTurn (working-set round — objects created/modified by tools in the last 3 rounds are auto-prefetched in large-scene mode); resetTurnStats() zeroes this turn's token/cost stats; clears lastProgress and emits 'agent-turn-start' so chat resets the pipeline progress card; logEvent('turn_start') writes a structured log. Then routes by hasLLM(): a configured proxy key takes the LLM path, otherwise the offline keyword-rule path."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/agent/orchestrator.js#runTurn"
      },
      {
        "id": "offline",
        "icon": "🔌",
        "col": 2,
        "group": "offline",
        "title": { "zh": "离线路径 runOffline", "en": "Offline path (runOffline)" },
        "desc": {
          "zh": "无 API Key 时的关键词规则回退(演示模式)。三级尝试:① tryObjectCommand——句中含指代词(它/this/selected…)且有选中对象时,按关键词直接改对象(COLOR_WORDS 换色/放大缩小/加自转,先抓暂存快照、确认改动后才提交撤销栈);② SCENARIOS 正则匹配——命中则播放该模板的 steps 计划动画并 run() 生成场景;③ 都不命中则回自我介绍(列出全部离线技能)。回复文案随界面语言双语。",
          "en": "Keyword-rule fallback when no API key is configured (demo mode). Three attempts: ① tryObjectCommand — when the sentence contains a deictic word (it/this/selected…) and an object is selected, edits the object directly by keywords (COLOR_WORDS recolor / scale / add self-spin; grabs a tentative snapshot first and only commits to the undo stack once confirmed); ② SCENARIOS regex match — on hit, plays that template's step-plan animation and run()s the scene; ③ otherwise replies with a self-introduction listing all offline abilities. Copy follows the UI language."
        },
        "uses": {
          "skills": [],
          "tools": [
            { "zh": "(不走工具协议,直接调 SCENARIOS.run / setMainColor 等平台函数)", "en": "(Bypasses the tool protocol; calls platform functions like SCENARIOS.run / setMainColor directly)" }
          ]
        },
        "file": "js/agent/orchestrator.js#runOffline"
      },
      {
        "id": "outline",
        "icon": "📋",
        "col": 2,
        "group": "context",
        "title": { "zh": "学习大纲 Outline", "en": "Learning Outline" },
        "desc": {
          "zh": "【已落地】Chapter→Section;类型 vr|reading|h5|quiz。左栏大纲 Tab:课程/章/节/目的灰色 ✎ 与选中分离。vr=3D;reading/h5/quiz=中心工作区。非 VR 隐藏变换工具栏与顶栏 VR。工具:outline_* / reading_set_chunks / h5_set_content / quiz_set_items。规划中由 KG 驱动生成并绑 covers[]。",
          "en": "[Shipped] Chapter→Section; types vr|reading|h5|quiz. Outline tab: grey ✎ for course/chapter/section/purpose vs select. vr=3D; reading/h5/quiz=center editors. Non-VR hides gizmos & VR button. Tools: outline_* / reading_set_chunks / h5_set_content / quiz_set_items. Planned: KG-driven generation with covers[]."
        },
        "uses": {
          "skills": [],
          "tools": [
            { "zh": "outline_get / outline_set_active / outline_update_* / outline_add_* / reading_set_chunks / h5_set_content / quiz_set_items", "en": "outline_get / outline_set_active / outline_update_* / outline_add_* / reading_set_chunks / h5_set_content / quiz_set_items" }
          ]
        },
        "file": "js/core/outline.js + js/ui/outline.js + js/ui/section-workspaces.js + js/agent/tools/outline-tools.js"
      },
      {
        "id": "context",
        "icon": "🧩",
        "col": 2,
        "group": "context",
        "title": { "zh": "构建输入上下文", "en": "Build the input context" },
        "desc": {
          "zh": "buildContextMessage(userText)。组成(v5):① Outline 全局树+当前节;② 选中对象高细节;③ 场景 JSON/大场景摘要;④ 全局状态;⑤ 上传文档块;⑥(规划)知识图谱摘要+coverage。上下文锁定:runTurn 开头构建一次整轮复用。",
          "en": "buildContextMessage(userText). Parts (v5): ① Outline tree + active section; ② pinned selection; ③ scene JSON / large-scene summary; ④ global state; ⑤ uploaded doc block; ⑥ (planned) KG digest + coverage. Context lock: built once at runTurn start."
        },
        "uses": {
          "skills": [],
          "tools": [
            { "zh": "(大场景模式会引导后续用 find_objects / get_object_detail)", "en": "(Large-scene mode steers later find_objects / get_object_detail)" }
          ]
        },
        "file": "js/agent/context.js#buildContextMessage"
      },
      {
        "id": "mode",
        "icon": "🚦",
        "col": 3,
        "group": "orchestrate",
        "title": { "zh": "模式路由 Ask / Plan / Agent", "en": "Mode routing: Ask / Plan / Agent" },
        "desc": {
          "zh": "按右栏模式栏的选择分流:Ask 模式 → 直接进只读问答(不出计划、不调工具);Plan / Agent 模式 → 先跑 Planner 出计划。Plan 与 Agent 的区别在后面:Plan 模式任何复杂度都要老师确认计划,Agent 模式只有 complex 任务才确认、simple 直接执行。",
          "en": "Routes by the mode bar in the right panel: Ask mode → straight to read-only Q&A (no plan, no tools); Plan / Agent mode → run the Planner first. Plan vs Agent differs downstream: Plan mode requires teacher confirmation at any complexity; Agent mode only confirms complex tasks — simple ones execute directly."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/agent/orchestrator.js#runTurn"
      },
      {
        "id": "ask",
        "icon": "💬",
        "col": 4,
        "group": "llm",
        "title": { "zh": "只读问答 runAsk", "en": "Read-only Q&A (runAsk)" },
        "desc": {
          "zh": "单次 LLM 调用,不带工具定义——模型只能解释、答疑、给建议,物理上改不了场景。系统提示 = BASE_SYSTEM(含 LANG_RULE 语言规则);消息 = 近 12 轮 history + 本轮上下文消息。流式渲染:思考摘要进可折叠的思考区块(startThinkingBlock),正文进流式消息;等待时打字区显示灰字「正在思考…」。complexity=chat 的闲聊也走这里。",
          "en": "A single LLM call with no tool definitions — the model can only explain, answer and advise; it physically cannot modify the scene. System prompt = BASE_SYSTEM (with the LANG_RULE language rule); messages = last 12 history turns + this turn's context message. Streaming render: thinking summaries go into a collapsible thinking block (startThinkingBlock), body text into a streaming message; while waiting, typing shows grey status 'Thinking…'. complexity=chat small talk also lands here."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/agent/orchestrator.js#runAsk"
      },
      {
        "id": "planner",
        "icon": "🗺️",
        "col": 4,
        "group": "llm",
        "title": { "zh": "规划 runPlanner", "en": "Planning (runPlanner)" },
        "desc": {
          "zh": "小型 LLM 调用(effort 固定 low,预算小),输出严格 JSON:{intent 一句话意图, complexity: chat|simple|complex, skills: [技能id], plan: [步骤]}。这是技能路由发生的地方:系统提示里只给技能目录(id + description 一行,即\"路由规则\"),模型按任务挑 1~4 个技能——渐进暴露的第一层,完整技能 prompt 此时不进上下文(排障类需求会路由到 debugging)。complex 任务的 plan 须按标准流水线组织:搭建类 = 语义本体(对象清单与关系)→搭建场景→加交互与动画→核验;修复类 = 分层排查→修复→免疫加固→验收。聊天打字区显示灰字「正在拆解任务、挑选技能…」。可靠性:stop_reason=max_tokens 时预算×2 重试;JSON 解析失败退化为 complex 兜底计划。",
          "en": "A small LLM call (effort fixed to low, small budget) outputting strict JSON: {intent one-liner, complexity: chat|simple|complex, skills: [skill ids], plan: [steps]}. This is where skill routing happens: the system prompt carries only the skill catalog (one id + description line per skill — the 'routing rule'), and the model picks 1–4 skills — the first layer of progressive disclosure; full skill prompts don't enter context yet (bug-fix requests route to debugging). Complex plans must follow the standard pipeline: build = ontology (object list & relationships) → scene build → interactions & animation → verification; repair = layered diagnosis → fix → immunize → acceptance. Chat typing shows grey status 'Breaking down the task & picking skills…'. Reliability: on max_tokens retries with budget ×2; JSON parse failure degrades to a complex fallback plan."
        },
        "uses": {
          "skills": [
            { "zh": "读取全部技能的目录行(skillCatalogForLLM),按 description 路由挑选", "en": "Reads every skill's catalog line (skillCatalogForLLM) and routes by description" }
          ],
          "tools": [
            { "zh": "读取模板目录(scenarioCatalogForLLM),不执行", "en": "Reads the template catalog (scenarioCatalogForLLM); does not execute" }
          ]
        },
        "file": "js/agent/orchestrator.js#runPlanner"
      },
      {
        "id": "plan-confirm",
        "icon": "✅",
        "col": 5,
        "group": "ui",
        "title": { "zh": "计划确认卡", "en": "Plan confirmation card" },
        "desc": {
          "zh": "complexity=complex 或 Plan 模式时,把 Planner 的 intent + 分步 plan + 将加载的技能 id 渲染成确认卡,等老师点「确认执行」或「取消」。取消则本轮结束并提示可换说法;确认才进入执行。这是人机协作的安全闸——复杂改动先让老师看到 AI 打算做什么。",
          "en": "When complexity=complex or in Plan mode, renders the Planner's intent + step plan + skill ids to load as a confirmation card and waits for the teacher to Confirm or Cancel. Cancel ends the turn with a hint to rephrase; Confirm proceeds to execution. This is the human-in-the-loop safety gate — before a complex change, the teacher sees what the AI intends to do."
        },
        "uses": {
          "skills": [
            { "zh": "展示 Planner 选中的技能 id 列表", "en": "Displays the list of skill ids the Planner selected" }
          ],
          "tools": []
        },
        "file": "js/ui/chat.js#showPlanConfirm"
      },
      {
        "id": "executor",
        "icon": "⚙️",
        "col": 6,
        "group": "llm",
        "title": { "zh": "执行器工具循环 runExecutor", "en": "Executor tool loop (runExecutor)" },
        "desc": {
          "zh": "核心执行阶段:带全部 40 个工具定义的多轮 tool-use 循环(上限 20 轮)。系统提示分两块做 Prompt Caching:稳定块 = BASE_SYSTEM + 资源/模板目录(标 cache_control: ephemeral);变化块 = Planner 选中技能的完整 prompt(skillPrompts)。复杂任务(≥3 步)按流水线推进——每进入新阶段先调 report_progress(语义本体→搭建场景→加交互→核验;修复类:排查→修复→免疫→验收);打字三个点上方同步显示灰字阶段状态(类 Cursor)。循环内:流式思考/正文/tool_use → 本地执行 → tool_result 回填 → 缓存断点滑动(第 2 轮起 0.1× 价)。report_progress 零副作用,不触发场景快照/Keep 卡。质量纪律:validation 引导 get_scene 自检;排障任务带 debugging;max_tokens 给可读截断提示。结束时 emit('agent-progress-end') 把进度卡末阶段标完成。备课自文档时优先 course_* / outline_* 确定性工具(弱模型友好);对齐 Learning Outline 当前节 type;每个 VR 节独立场景快照。",
          "en": "Core execution: multi-round tool-use with all 40 tools (≤20 rounds). Prompt caching: stable = BASE_SYSTEM + catalogs; variable = selected skill prompts. Complex tasks call report_progress per pipeline stage. When authoring from an uploaded doc, prefer deterministic course_* / outline_* tools (weaker-model friendly); align with active Outline section type; each VR section owns an isolated scene snapshot."
        },
        "uses": {
          "skills": [
            { "zh": "Planner 选中的技能完整 prompt 注入变化块(常见:scene-organization + object-creation + pedagogy;课程备课 + course-pipeline / course-outline / course-reading|h5|quiz;精细建模 + custom-modeling;交互实验 + experiment-logic + interaction-design;室内 + room-design;导览 + view-navigation;收尾 validation / locomotion;排障 + debugging)", "en": "Full prompts of selected skills in the variable block (common: scene-organization + object-creation + pedagogy; course-pipeline / course-outline / course-reading|h5|quiz for authoring; custom-modeling; experiment-logic + interaction-design; room-design; view-navigation; validation / locomotion; debugging)" }
          ],
          "tools": [
            { "zh": "全部 40 个工具;复杂任务每阶段开头调 report_progress 汇报流水线进度", "en": "all 40 tools; complex tasks call report_progress at the start of each pipeline stage" }
          ]
        },
        "file": "js/agent/orchestrator.js#runExecutor"
      },
      {
        "id": "tool-exec",
        "icon": "🔧",
        "col": 7,
        "group": "tools",
        "title": { "zh": "工具执行 execTool", "en": "Tool execution (execTool)" },
        "desc": {
          "zh": "本地执行模型发起的 tool_use:tools/index.js 按 name 分发到八个分组模块(build/edit/panel/query/env/space/outline/course),exec(input) 可异步(course_* 填充);改场景的工具都会 markTouched(obj) 并 emit 事件刷 UI。普通工具在聊天区渲染工具卡;report_progress 不渲染工具卡(改走流水线进度节点)。结果 {ok, msg} 作为 tool_result 回填;异常捕获成 fail——模型自行改参重试。",
          "en": "Executes tool_use locally: tools/index.js dispatches by name to eight modules (build/edit/panel/query/env/space/outline/course); exec(input) may be async (course_* fills); scene-mutating tools call markTouched(obj) and emit UI events. Normal tools render a chat tool card; report_progress skips the card (routes to the pipeline-progress node instead). {ok, msg} feeds back as tool_result; exceptions become fail messages for the model to retry."
        },
        "uses": {
          "skills": [],
          "tools": [
            { "zh": "创建类 build-tools:add_asset / create_custom_object / set_behavior / build_template / clear_scene", "en": "Build group build-tools: add_asset / create_custom_object / set_behavior / build_template / clear_scene" },
            { "zh": "修改类 edit-tools:update_object / remove_object / select_object", "en": "Edit group edit-tools: update_object / remove_object / select_object" },
            { "zh": "面板类 panel-tools:attach_label / add_panel / update_panel / add_quiz_panel", "en": "Panel group panel-tools: attach_label / add_panel / update_panel / add_quiz_panel" },
            { "zh": "查询类 query-tools:get_scene / find_objects / get_object_detail", "en": "Query group query-tools: get_scene / find_objects / get_object_detail" },
            { "zh": "环境类 env-tools:report_progress / set_environment / configure_locomotion / set_student_view", "en": "Environment group env-tools: report_progress / set_environment / configure_locomotion / set_student_view" },
            { "zh": "空间引导类 space-tools:add_arrow / add_path / build_room / build_stairs", "en": "Space & guidance group space-tools: add_arrow / add_path / build_room / build_stairs" },
            { "zh": "大纲类 outline-tools:outline_get / outline_set_active / outline_update_* / outline_add_* / reading_set_chunks / h5_set_content / quiz_set_items", "en": "Outline group outline-tools: outline_get / outline_set_active / outline_update_* / outline_add_* / reading_set_chunks / h5_set_content / quiz_set_items" },
            { "zh": "备课类 course-pipeline-tools:course_tag_figures / course_build_outline_from_doc / course_fill_section / course_kg_digest / course_enrich_reading_images / course_generate_image", "en": "Course group course-pipeline-tools: course_tag_figures / course_build_outline_from_doc / course_fill_section / course_kg_digest / course_enrich_reading_images / course_generate_image" }
          ]
        },
        "file": "js/agent/tools/index.js#execTool"
      },
      {
        "id": "progress",
        "icon": "🧩",
        "col": 7,
        "group": "pipeline",
        "title": { "zh": "流水线进度 UI", "en": "Pipeline progress UI" },
        "desc": {
          "zh": "复杂任务执行中的可视进度层(类 Cursor 的步骤状态)。report_progress 工具 emit('agent-progress'):chat.js 渲染「🧩 执行流水线」进度卡(已完成阶段打勾、当前阶段高亮 + note);同时 lastProgress 更新 → 打字指示器上方灰字显示「阶段 2/4 · 语义本体」。标准阶段:搭建类 = 语义本体(列对象与关系:谁控制谁/谁和谁交互)→搭建场景→加交互与动画→核验;修复类 = 分层排查→修复→免疫加固→验收。简单任务(1~2 工具)不调、不渲染进度卡。轮末 agent-progress-end 封口;下一轮 agent-turn-start 重置。",
          "en": "Visible progress layer during complex execution (Cursor-like step status). report_progress emits 'agent-progress': chat.js renders a '🧩 Pipeline' card (done stages checkmarked, current stage highlighted + note); lastProgress also drives the grey line above the typing dots ('Stage 2/4 · Ontology'). Standard stages: build = ontology (object list & relationships: who controls whom / who interacts) → scene build → interactions & animation → verification; repair = layered diagnosis → fix → immunize → acceptance. Simple tasks (1–2 tools) skip this. Sealed by agent-progress-end; reset on next agent-turn-start."
        },
        "uses": {
          "skills": [
            { "zh": "(不直接加载技能;阶段划分来自 Planner 的流水线 plan + Executor 提示词纪律)", "en": "(Does not load skills directly; stages come from the Planner's pipeline plan + Executor prompt discipline)" }
          ],
          "tools": [
            { "zh": "report_progress:{stage,total,title,note} — 零副作用,只广播事件刷新 UI", "en": "report_progress:{stage,total,title,note} — zero side effects; only emits events to refresh the UI" }
          ]
        },
        "file": "js/ui/chat.js + js/agent/tools/env-tools.js#report_progress"
      },
      {
        "id": "reply",
        "icon": "📨",
        "col": 8,
        "group": "output",
        "title": { "zh": "流式回复与统计", "en": "Streamed reply & stats" },
        "desc": {
          "zh": "模型不再发起工具调用后,最终正文以流式消息渲染进聊天区;思考摘要区块自动折叠为「查看推理过程」。等待模型时打字区显示三跳动点 + 上方灰字状态行(规划/流水线阶段/思考中)。回复语言由 LANG_RULE 跟随界面语言。轮末如有 LLM 调用,显示本轮统计条(调用次数/输入输出 token/缓存读写/估算花费)。",
          "en": "Once tool calls stop, the final body streams into chat; the thinking block auto-collapses to 'View reasoning'. While waiting, typing shows three bouncing dots plus a grey status line above (planning / pipeline stage / thinking). Reply language follows LANG_RULE (UI language). If the turn made LLM calls, a stats bar renders (calls / in-out tokens / cache / estimated cost)."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/ui/chat.js"
      },
      {
        "id": "post",
        "icon": "🧾",
        "col": 9,
        "group": "output",
        "title": { "zh": "收尾:历史 / 撤销 / 日志", "en": "Wrap-up: history / undo / logs" },
        "desc": {
          "zh": "runTurn 收尾:① agent.history 追加本轮 user + assistant(去 HTML 标签,后续轮次只带近 12 条);② 本轮改过场景(turnMutated,不含纯 report_progress)则弹「保留 / 撤销」卡——老师可一键回滚整轮(history.js 快照),未点选就开始下一轮视为保留;③ 运行模式中改了场景则 refreshPlaySnapshot() 更新停止运行的回滚基线;④ logEvent('turn_end');busy 解锁。",
          "en": "runTurn wrap-up: ① append user + assistant to agent.history (HTML stripped; later turns keep last 12); ② if the turn mutated the scene (turnMutated; pure report_progress alone does not count), show Keep / Undo — teacher can roll back the whole turn (history.js snapshot); starting the next turn without choosing counts as Keep; ③ if play mode is on and the turn mutated, refreshPlaySnapshot() updates the stop-play baseline; ④ logEvent('turn_end'); release busy."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/agent/orchestrator.js#runTurn"
      }
    ],

    "edges": [
      { "from": "input", "to": "turn", "label": "" },
      { "from": "doc-ingest", "to": "turn", "label": { "zh": "据此备课 / 发指令", "en": "Build from this / typed ask" } },
      { "from": "doc-ingest", "to": "context", "label": { "zh": "材料挂载(md+图+摘要)", "en": "Material attached (md+imgs+summary)" } },
      { "from": "doc-ingest", "to": "knowledge-graph", "label": { "zh": "规划:先抽图谱", "en": "Planned: mine KG first" } },
      { "from": "pedagogy", "to": "course-pipeline", "label": { "zh": "pattern + vocab", "en": "pattern + vocab" } },
      { "from": "pedagogy", "to": "knowledge-graph", "label": { "zh": "学段/K 类型参考", "en": "level / K-type hints" } },
      { "from": "knowledge-graph", "to": "course-pipeline", "label": { "zh": "硬锚点", "en": "Hard anchor" } },
      { "from": "knowledge-graph", "to": "outline", "label": { "zh": "规划:驱动大纲", "en": "Planned: drive outline" } },
      { "from": "knowledge-graph", "to": "context", "label": { "zh": "规划:注入上下文", "en": "Planned: inject context" } },
      { "from": "course-pipeline", "to": "outline", "label": { "zh": "规划:写骨架+选型", "en": "Planned: skeleton + strategy" } },
      { "from": "outline", "to": "context", "label": { "zh": "全局树 + 当前节", "en": "Global tree + active section" } },
      { "from": "turn", "to": "offline", "label": { "zh": "无 API Key(离线演示)", "en": "No API key (offline demo)" } },
      { "from": "turn", "to": "context", "label": { "zh": "已接入 LLM", "en": "LLM configured" } },
      { "from": "context", "to": "mode", "label": "" },
      { "from": "mode", "to": "ask", "label": { "zh": "Ask 模式", "en": "Ask mode" } },
      { "from": "mode", "to": "planner", "label": { "zh": "Plan / Agent 模式", "en": "Plan / Agent mode" } },
      { "from": "planner", "to": "ask", "label": { "zh": "complexity = chat(闲聊)", "en": "complexity = chat (small talk)" } },
      { "from": "planner", "to": "plan-confirm", "label": { "zh": "complex 或 Plan 模式", "en": "complex, or Plan mode" } },
      { "from": "planner", "to": "executor", "label": { "zh": "simple 且 Agent 模式(免确认)", "en": "simple in Agent mode (no confirmation)" } },
      { "from": "plan-confirm", "to": "executor", "label": { "zh": "老师确认执行", "en": "Teacher confirms" } },
      { "from": "plan-confirm", "to": "post", "label": { "zh": "老师取消", "en": "Teacher cancels" } },
      { "from": "executor", "to": "tool-exec", "label": { "zh": "模型发起 tool_use", "en": "Model issues tool_use" } },
      { "from": "tool-exec", "to": "progress", "label": { "zh": "report_progress(进新阶段)", "en": "report_progress (new stage)" } },
      { "from": "progress", "to": "executor", "label": { "zh": "进度卡更新,继续循环", "en": "Progress card updated, continue loop" } },
      { "from": "tool-exec", "to": "executor", "label": { "zh": "其他工具 tool_result 回填(≤20 轮)", "en": "Other tool_result fed back (≤20 rounds)" } },
      { "from": "executor", "to": "reply", "label": { "zh": "无更多工具调用 / 截断", "en": "No more tool calls / truncated" } },
      { "from": "ask", "to": "reply", "label": "" },
      { "from": "offline", "to": "post", "label": "" },
      { "from": "reply", "to": "post", "label": "" }
    ]
  },

  "tools": [
    { "name": "add_asset", "group": { "zh": "创建 build", "en": "Build" }, "file": "js/agent/tools/build-tools.js",
      "summary": { "zh": "从资源库添加对象(可带位置/缩放/颜色/动画);资源目录随 registry.js 自动注入工具说明。", "en": "Adds an object from the asset library (optional position/scale/color/animation); the asset catalog is auto-injected into the tool description from registry.js." } },
    { "name": "create_custom_object", "group": { "zh": "创建 build", "en": "Build" }, "file": "js/agent/tools/build-tools.js",
      "summary": { "zh": "【最强工具】AI 直接写 Three.js 代码现场造对象(T 工具箱沙盒执行);说明里带颗粒度铁律与 say latch 纪律。", "en": "[Most powerful tool] The AI writes Three.js code to build objects on the spot (sandboxed via the T toolbox); its description carries the granularity rule and the say-latch discipline." } },
    { "name": "set_behavior", "group": { "zh": "创建 build", "en": "Build" }, "file": "js/agent/tools/build-tools.js",
      "summary": { "zh": "给已有对象编写/覆盖行为代码(每帧 update / 语义事件 click·grab·drag·release);改行为必须同步更新 description(检索索引)。", "en": "Writes/overwrites behavior code on an existing object (per-frame update / semantic events click·grab·drag·release); changing behavior must also update the description (the retrieval index)." } },
    { "name": "build_template", "group": { "zh": "创建 build", "en": "Build" }, "file": "js/agent/tools/build-tools.js",
      "summary": { "zh": "一键生成预置教学模板(SCENARIOS,先清空场景);需求高度吻合时优先用,质量最高。", "en": "One-click builds a preset teaching template (SCENARIOS; clears the scene first); prefer it when the request closely matches — highest quality." } },
    { "name": "clear_scene", "group": { "zh": "创建 build", "en": "Build" }, "file": "js/agent/tools/build-tools.js",
      "summary": { "zh": "清空场景全部对象。", "en": "Removes every object from the scene." } },
    { "name": "update_object", "group": { "zh": "修改 edit", "en": "Edit" }, "file": "js/agent/tools/edit-tools.js",
      "summary": { "zh": "移动/缩放/换色/改名/设动画;含义变化时同步传 description 保持索引不过期。", "en": "Move/scale/recolor/rename/set animation; pass description too when the object's meaning changes, keeping the index fresh." } },
    { "name": "remove_object", "group": { "zh": "修改 edit", "en": "Edit" }, "file": "js/agent/tools/edit-tools.js",
      "summary": { "zh": "按 oid/名称删除一个对象。", "en": "Deletes one object by oid/name." } },
    { "name": "select_object", "group": { "zh": "修改 edit", "en": "Edit" }, "file": "js/agent/tools/edit-tools.js",
      "summary": { "zh": "视口选中并高亮对象(向老师展示「我说的是这个」)。", "en": "Selects and highlights an object in the viewport ('this is the one I mean')." } },
    { "name": "attach_label", "group": { "zh": "面板 panel", "en": "Panel" }, "file": "js/agent/tools/panel-tools.js",
      "summary": { "zh": "给对象头顶挂标注面板(billboard 面向学生);「键|值」行渲染为参数行。", "en": "Attaches an overhead label panel (billboard facing students); 'key|value' lines render as parameter rows." } },
    { "name": "add_panel", "group": { "zh": "面板 panel", "en": "Panel" }, "file": "js/agent/tools/panel-tools.js",
      "summary": { "zh": "放置独立 3D 教学面板(公式/任务/图例板,可拖动)。", "en": "Places a standalone 3D teaching panel (formula/task/legend board; draggable)." } },
    { "name": "update_panel", "group": { "zh": "面板 panel", "en": "Panel" }, "file": "js/agent/tools/panel-tools.js",
      "summary": { "zh": "原地改面板文字(不重建对象,不丢位置);live 实时面板拒改,引导用 set_behavior。", "en": "Edits panel text in place (no rebuild, keeps position); refuses live data panels and points to set_behavior instead." } },
    { "name": "add_quiz_panel", "group": { "zh": "面板 panel", "en": "Panel" }, "file": "js/agent/tools/panel-tools.js",
      "summary": { "zh": "可点击作答的选择题面板(问题+选项按钮,PC/VR 皆可选,即时对错反馈);答对后 userData.quiz.done=true,可被其他对象读作\"答对才解锁\"的条件。", "en": "A clickable multiple-choice quiz panel (question + option buttons, works on PC and in VR, instant right/wrong feedback); after a correct answer userData.quiz.done=true, readable by other objects as an 'answer-to-unlock' condition." } },
    { "name": "get_scene", "group": { "zh": "查询 query", "en": "Query" }, "file": "js/agent/tools/query-tools.js",
      "summary": { "zh": "重读场景状态自检;小场景全量 JSON,大场景自动降级为摘要索引。", "en": "Re-reads scene state for self-checks; full JSON for small scenes, auto-degrades to the summary index for large ones." } },
    { "name": "find_objects", "group": { "zh": "查询 query", "en": "Query" }, "file": "js/agent/tools/query-tools.js",
      "summary": { "zh": "关键词语义检索 + 可选空间过滤,返回完整参数;大场景模式的主要查找手段。", "en": "Keyword semantic search + optional spatial filter, returns full params; the primary lookup in large-scene mode." } },
    { "name": "get_object_detail", "group": { "zh": "查询 query", "en": "Query" }, "file": "js/agent/tools/query-tools.js",
      "summary": { "zh": "按 oid 读单个对象完整参数与行为代码(改之前先看清现状)。", "en": "Reads one object's full params and behavior code by oid (look before you edit)." } },
    { "name": "report_progress", "group": { "zh": "环境 env", "en": "Environment" }, "file": "js/agent/tools/env-tools.js",
      "summary": { "zh": "零副作用的进度汇报:执行器每进入流水线新阶段(语义本体→搭建→交互→核验)先调它,聊天区渲染流水线进度卡并更新打字指示器上方的灰字状态。", "en": "Zero-side-effect progress report: the executor calls it on entering each pipeline stage (ontology → build → interaction → verification); the chat renders a pipeline progress card and updates the grey status line above the typing indicator." } },
    { "name": "set_environment", "group": { "zh": "环境 env", "en": "Environment" }, "file": "js/agent/tools/env-tools.js",
      "summary": { "zh": "运行/编辑模式、动画时钟、主光源、网格、视角锁定等全局开关。", "en": "Global switches: play/edit mode, animation clock, main light, grid, camera lock." } },
    { "name": "configure_locomotion", "group": { "zh": "环境 env", "en": "Environment" }, "file": "js/agent/tools/env-tools.js",
      "summary": { "zh": "配置学生 VR 移动方式(static/teleport/smooth + 活动半径 + 转向);说明里带课型判据。", "en": "Configures student VR locomotion (static/teleport/smooth + allowed radius + turn mode); the description carries per-lesson-type criteria." } },
    { "name": "set_student_view", "group": { "zh": "环境 env", "en": "Environment" }, "file": "js/agent/tools/env-tools.js",
      "summary": { "zh": "设置学生出生点与初始朝向(移动场景里的「学生视角」代表物,look_at 自动算朝向);说明里带最佳观察距离经验法则。", "en": "Sets the student spawn point & initial facing (moves the in-scene 'Student View' proxy; look_at auto-computes the yaw); the description carries viewing-distance rules of thumb." } },
    { "name": "add_arrow", "group": { "zh": "空间引导 space", "en": "Space & Guidance" }, "file": "js/agent/tools/space-tools.js",
      "summary": { "zh": "确定性几何箭头(from→to,可拱起为弧);role 区分场景内容 / 教学引导,不再让模型手写箭头代码。", "en": "Deterministic geometric arrow (from→to, optionally arced); role distinguishes scene content vs teaching guidance — no more hand-written arrow code from the model." } },
    { "name": "add_path", "group": { "zh": "空间引导 space", "en": "Space & Guidance" }, "file": "js/agent/tools/space-tools.js",
      "summary": { "zh": "经过一串路径点的平滑曲线(实线/虚线/圆点 + 方向小箭头 + 起终点标记 + 可闭合):导览路线、运动轨迹、轨道皆用它;role≠content 的引导线在运行模式/导出播放器中自动对学生隐藏。", "en": "A smooth curve through waypoints (solid/dashed/dots + direction cones + start/end markers + optional closed loop): tour routes, motion trajectories and orbits all use it; guide-role paths (role≠content) are auto-hidden from students in play mode and exported players." } },
    { "name": "build_room", "group": { "zh": "空间引导 space", "en": "Space & Guidance" }, "file": "js/agent/tools/space-tools.js",
      "summary": { "zh": "房间壳生成器(地板+四墙+门洞/窗带/可选天花板):教室/密室/餐厅等室内体验的第一步;每间强制有门(密室锁门=门洞上放门对象);y>0 可整体抬到二层;房间内面板享受平台级可见性规则(外→隐藏/内→顶层);说明里带户型拼合与陈设不出墙次序。", "en": "Room-shell generator (floor + four walls + doorway/window band/optional ceiling): step one of any in-room experience (classroom/escape room/restaurant); every room is guaranteed a doorway (a locked escape room = a door object in the opening); y>0 lifts the whole room to an upper floor; panels inside rooms get the platform visibility rule (hidden from outside / top-rendered inside); its description carries floor-plan tiling & keep-furniture-inside rules." } },
    { "name": "build_stairs", "group": { "zh": "空间引导 space", "en": "Space & Guidance" }, "file": "js/agent/tools/space-tools.js",
      "summary": { "zh": "直跑楼梯生成器(实心台阶 ≤0.25 米/级 + 顶部缓步平台与护栏):多层楼之间的物理通道;平台尽头须对齐二层门洞(说明里有对接公式);瞬移/平滑移动/WASD 都能逐级上下;电梯场景则用按钮 + T.teleportStudent 模式。", "en": "Straight-run staircase generator (solid steps ≤0.25 m each + a top landing with guard rails): the physical link between floors; the landing edge must dock to the upper-floor doorway (docking formula in the description); teleport/smooth/WASD all climb it step by step; for elevators use a button + T.teleportStudent instead." } },
    { "name": "outline_get", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "读取课程大纲树 + 当前节 reading/h5/quiz 内容摘要。改大纲前先调。", "en": "Reads the course outline tree + active section reading/h5/quiz summary. Call before editing the outline." } },
    { "name": "outline_set_active", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "切换活动小节(同时切换中心工作区类型)。", "en": "Activates a section (and swaps the center workspace type)." } },
    { "name": "outline_update_course", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "更新课程标题/目标/节奏备注。", "en": "Updates course title / goal / pace note." } },
    { "name": "outline_update_chapter", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "更新章节标题或摘要。", "en": "Updates a chapter title or summary." } },
    { "name": "outline_update_section", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "更新小节标题/目的/类型(vr|reading|h5|quiz)/摘要。", "en": "Updates section title / purpose / type (vr|reading|h5|quiz) / summary." } },
    { "name": "outline_add_chapter", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "新增一章(默认带一个 VR 节);需老师明确要求(requested_by_teacher),上一章全空时拒绝。", "en": "Adds a chapter (default one VR section); requires an explicit teacher request and refuses when the last chapter is still blank." } },
    { "name": "outline_add_section", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "在指定章下新增小节;需老师明确要求,已有同型空节时拒绝,且不抢活动节。", "en": "Adds a section under a chapter; requires an explicit teacher request, refuses when a blank section of that type exists, and never steals the active section." } },
    { "name": "outline_remove_section", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "删除尚无内容的空小节(清理误加);有内容的节拒绝删除。", "en": "Removes a blank section (cleanup); refuses sections that already have content." } },
    { "name": "reading_set_chunks", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "覆盖 reading 节知识块(富文本 HTML + 可选追问测验)。", "en": "Overwrites reading-section knowledge chunks (rich HTML + optional follow-up quiz)." } },
    { "name": "h5_set_content", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "写入 h5 节的 prompt/HTML/追问;Agent 可直接生成交互 HTML。", "en": "Writes h5 section prompt/HTML/follow-up; Agent can supply interactive HTML directly." } },
    { "name": "quiz_set_items", "group": { "zh": "大纲 outline", "en": "Outline" }, "file": "js/agent/tools/outline-tools.js",
      "summary": { "zh": "覆盖 quiz 节题目列表(选择题/简答)。", "en": "Overwrites quiz-section items (MCQ / short answer)." } },
    { "name": "course_tag_figures", "group": { "zh": "备课 course", "en": "Course" }, "file": "js/agent/tools/course-pipeline-tools.js",
      "summary": { "zh": "标注上传材料插图的教学用途与 visualSummary。", "en": "Tags uploaded figures for pedagogy + visualSummary." } },
    { "name": "course_build_outline_from_doc", "group": { "zh": "备课 course", "en": "Course" }, "file": "js/agent/tools/course-pipeline-tools.js",
      "summary": { "zh": "从材料抽取 KG 并生成 Learning Outline(会覆盖大纲树)。", "en": "Extracts KG and builds Learning Outline from the doc (overwrites outline)." } },
    { "name": "course_fill_section", "group": { "zh": "备课 course", "en": "Course" }, "file": "js/agent/tools/course-pipeline-tools.js",
      "summary": { "zh": "按节类型自动填充 reading/h5/quiz/vr(VR 独立场景快照)。", "en": "Auto-fills reading/h5/quiz/vr by section type (isolated VR scenes)." } },
    { "name": "course_kg_digest", "group": { "zh": "备课 course", "en": "Course" }, "file": "js/agent/tools/course-pipeline-tools.js",
      "summary": { "zh": "读取当前知识图谱紧凑摘要。", "en": "Returns a compact knowledge-graph digest." } },
    { "name": "course_enrich_reading_images", "group": { "zh": "备课 course", "en": "Course" }, "file": "js/agent/tools/course-pipeline-tools.js",
      "summary": { "zh": "对 reading 节调用 gpt-image-2 软性补示意图。", "en": "Soft-enriches a reading section with gpt-image-2 diagrams." } },
    { "name": "course_generate_image", "group": { "zh": "备课 course", "en": "Course" }, "file": "js/agent/tools/course-pipeline-tools.js",
      "summary": { "zh": "生成一张教学插图,可选写入某 reading chunk。", "en": "Generates one pedagogy image; optionally injects into a reading chunk." } }
  ]
};
