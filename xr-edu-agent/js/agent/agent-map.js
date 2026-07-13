// Agent 工作流有向图 + 工具目录(agent-viewer*.html 的数据源)
// ⚠ 内容保持 JSON 字面量,仅外面包了一层赋值——这样可视化页在 file:// 下
//   当普通 <script> 加载即可拿到数据(file:// 禁 fetch,.json 无法读取)
// ⚠ 文案字段一律写成 {"zh":"…","en":"…"} 双语对象(查看器按语言开关取值);
//   新增节点/工具必须同时给中英文。维护规约见 js/agent/README.md
globalThis.XR_AGENT_MAP =
{
  "meta": {
    "version": 2,
    "updated": "2026-07-12",
    "note": "Agent 工作流有向图 + 工具目录,全部文案为 zh/en 双语对象。维护方式见 js/agent/README.md;可视化页 agent-viewer*.html 纯本地,直接双击打开。技能库不在此文件里——技能页加载 skills/ 目录的注册表脚本(技能的英文版写在技能文件的 nameEn/descriptionEn/promptEn 字段),技能改动自动同步。"
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
          "zh": "一轮对话的起点。输入有四个入口:① 右栏聊天输入框(自然语言描述需求);② 快捷指令 chips(预置的示例 prompt);③ 视口检查器里的对象级 AI 指令框(emit 'agent-request';该对象因处于选中态已自动在上下文里——\"选中即上下文\",文本前会拼上对象引用);④ 计划确认卡上的修改反馈。所有入口最终都汇到 chat.js 的 send() → runTurn(text, ui)。",
          "en": "The start of a turn. Input arrives through four entries: ① the chat box in the right panel (natural-language request); ② quick-command chips (preset example prompts); ③ the per-object AI command box in the viewport inspector (emits 'agent-request'; the object is already in context because it is selected — 'selection is context' — and the text is prefixed with an object reference); ④ revision feedback on the plan-confirmation card. All entries converge into chat.js send() → runTurn(text, ui)."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/ui/chat.js"
      },
      {
        "id": "turn",
        "icon": "🎬",
        "col": 1,
        "group": "orchestrate",
        "title": { "zh": "一轮编排开始 runTurn", "en": "Turn orchestration starts (runTurn)" },
        "desc": {
          "zh": "编排器主入口:busy 加锁防并发;state.ctxTurn++(工作集轮次,近 3 轮被工具创建/修改的对象会自动进大场景预取);resetTurnStats() 清零本轮 token/花费统计;logEvent('turn_start') 落结构化日志。然后按 hasLLM() 分流:api-keys.txt 里有有效密钥走 LLM 路径,否则走离线关键词规则。",
          "en": "Main orchestrator entry: takes the busy lock against concurrent turns; increments state.ctxTurn (working-set round — objects created/modified by tools in the last 3 rounds are auto-prefetched in large-scene mode); resetTurnStats() zeroes this turn's token/cost stats; logEvent('turn_start') writes a structured log. Then routes by hasLLM(): a valid key in api-keys.txt takes the LLM path, otherwise the offline keyword-rule path."
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
        "id": "context",
        "icon": "🧩",
        "col": 2,
        "group": "context",
        "title": { "zh": "构建输入上下文", "en": "Build the input context" },
        "desc": {
          "zh": "buildContextMessage(userText):把用户 prompt 与场景状态拼成一条 user 消息。组成:① 老师当前选中对象的高细节块(选中即上下文,Shift 可多选;pinnedContextBlock,含行为代码)——参照 Put-That-There 一脉的多模态指代研究,3D 直选取代手动 📌;② 场景状态——对象数 ≤ FULL_JSON_MAX(20) 发全量 JSON(每个对象的位置/缩放/颜色/动画/交互/面板/描述),超过则进大场景模式 = 分类分组的一行式摘要索引 + searchObjects() 纯 JS 相关性预取(选中对象+近3轮工作集+与 userText 的中文双字 n-gram 命中,top-8 附全参数但剥掉行为代码);③ 全局状态(playMode/animPlaying/学生 locomotion/出生点 studentSpawn/实验状态)。上下文锁定:此消息在 runTurn 开始时构建一次,整轮(Planner→确认→Executor)复用同一份——老师中途切运行模式/换选中不会让 Agent 看到的初始状态漂移;工具结果仍反映实时场景,模型能感知自己造成的变化。",
          "en": "buildContextMessage(userText): assembles the user prompt and scene state into one user message. Parts: ① high-detail blocks for the teacher's currently selected objects (selection IS context, Shift multi-select; pinnedContextBlock, behavior code included) — direct 3D selection replaces manual 📌 pinning, following the Put-That-There lineage of multimodal-reference research; ② scene state — with ≤ FULL_JSON_MAX (20) objects, sends full JSON (each object's position/scale/color/animation/interactions/panels/description); above that, large-scene mode = a categorized one-line summary index + pure-JS relevance prefetch via searchObjects() (selected object + last-3-round working set + bigram hits against userText; top-8 with full params, behavior code stripped); ③ global state (playMode/animPlaying/student locomotion/studentSpawn/experiment state). Context locking: this message is built once at the start of runTurn and reused for the whole turn (Planner → confirmation → Executor) — the teacher toggling play mode or changing selection mid-turn cannot drift the initial state the agent saw; tool results still reflect the live scene, so the model perceives its own changes."
        },
        "uses": {
          "skills": [],
          "tools": [
            { "zh": "(大场景模式会在提示里引导模型后续用 find_objects / get_object_detail 拉细节)", "en": "(In large-scene mode the prompt steers the model to pull details later via find_objects / get_object_detail)" }
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
          "zh": "单次 LLM 调用,不带工具定义——模型只能解释、答疑、给建议,物理上改不了场景。系统提示 = BASE_SYSTEM(含 LANG_RULE 语言规则);消息 = 近 12 轮 history + 本轮上下文消息。流式渲染:思考摘要进可折叠的思考区块(startThinkingBlock),正文进流式消息。complexity=chat 的闲聊也走这里。",
          "en": "A single LLM call with no tool definitions — the model can only explain, answer and advise; it physically cannot modify the scene. System prompt = BASE_SYSTEM (with the LANG_RULE language rule); messages = last 12 history turns + this turn's context message. Streaming render: thinking summaries go into a collapsible thinking block (startThinkingBlock), body text into a streaming message. complexity=chat small talk also lands here."
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
          "zh": "小型 LLM 调用(effort 固定 low,预算小),输出严格 JSON:{intent 一句话意图, complexity: chat|simple|complex, skills: [技能id], plan: [步骤]}。这是技能路由发生的地方:系统提示里只给技能目录(id + description 一行,即\"路由规则\"),模型按任务挑 1~4 个技能——渐进暴露的第一层,完整技能 prompt 此时不进上下文。可靠性处理:stop_reason=max_tokens 时预算×2 自动重试一次;JSON 解析失败(extractJSON 三级尝试)不硬崩,退化为 complex 兜底计划。",
          "en": "A small LLM call (effort fixed to low, small budget) outputting strict JSON: {intent one-liner, complexity: chat|simple|complex, skills: [skill ids], plan: [steps]}. This is where skill routing happens: the system prompt carries only the skill catalog (one id + description line per skill — the 'routing rule'), and the model picks 1–4 skills — the first layer of progressive disclosure; full skill prompts don't enter the context yet. Reliability: on stop_reason=max_tokens, retries once with budget ×2; JSON parse failure (extractJSON's three-stage attempt) doesn't hard-fail — it degrades to a complex fallback plan."
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
          "zh": "核心执行阶段:带全部工具定义的多轮 tool-use 循环(上限 20 轮)。系统提示分两块做 Prompt Caching:稳定块 = BASE_SYSTEM + 资源/模板目录(标 cache_control: ephemeral,连带工具定义一起缓存);变化块 = Planner 选中技能的完整 prompt(skillPrompts,渐进暴露的第二层——只有被选中的技能才占上下文)。循环内:模型流式输出思考/正文/tool_use → 本地执行工具 → tool_result 回填 → setMsgCacheBreakpoint 把缓存断点滑到最新消息(第 2 轮起前缀全命中缓存读,0.1× 价)。质量纪律:validation 技能引导模型多步修改后调 get_scene 自检;stop_reason=max_tokens 时给老师可读的截断提示(不再静默\"完成。\")。预算由 callBudget(stage, complexity) 按思考深度档位+模型算出(deepThinker 执行放 high 且预算×1.5,simple 任务降档提速)。",
          "en": "The core execution stage: a multi-round tool-use loop with all tool definitions (capped at 20 rounds). The system prompt is split in two for prompt caching: a stable block = BASE_SYSTEM + asset/template catalogs (marked cache_control: ephemeral, cached together with tool definitions); a variable block = full prompts of the Planner-selected skills (skillPrompts — the second layer of progressive disclosure: only chosen skills occupy context). Inside the loop: the model streams thinking/body/tool_use → tools execute locally → tool_result feeds back → setMsgCacheBreakpoint slides the cache breakpoint to the latest message (from round 2 on, the prefix is a full cache read at 0.1× price). Quality discipline: the validation skill nudges the model to self-check with get_scene after multi-step edits; on stop_reason=max_tokens the teacher gets a readable truncation notice (no more silent 'Done.'). Budgets come from callBudget(stage, complexity) based on thinking-effort tier + model (deepThinker executes at high with ×1.5 budget; simple tasks downshift for speed)."
        },
        "uses": {
          "skills": [
            { "zh": "Planner 选中的技能完整 prompt 注入系统提示变化块(常见组合:scene-organization + object-creation + pedagogy;造精细对象加 custom-modeling;交互实验加 experiment-logic + interaction-design;室内课加 room-design;涉及学生视角/导览加 view-navigation;收尾常带 validation / locomotion)", "en": "Full prompts of Planner-selected skills injected into the variable system-prompt block (common combos: scene-organization + object-creation + pedagogy; add custom-modeling for refined builds; experiment-logic + interaction-design for interactive experiments; room-design for in-room lessons; view-navigation when student viewpoint/touring matters; often validation / locomotion at wrap-up)" }
          ],
          "tools": [
            { "zh": "全部 22 个工具的定义都发给模型,由模型按需发起 tool_use", "en": "All 22 tool definitions are sent to the model, which issues tool_use on demand" }
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
          "zh": "本地执行模型发起的 tool_use:tools/index.js 按 name 分发到六个分组模块(build/edit/panel/query/env/space),exec(input) 直接操作 Three.js 场景;改场景的工具都会 markTouched(obj)(维护大场景工作集)并 emit 事件刷新 UI。聊天区同步渲染工具卡(toolCallLabel 双语标签),执行结果 {ok, msg} 作为 tool_result 回填给模型继续推理。异常被捕获成 fail 消息——模型看到错误会自行修正参数重试(如行为代码编译失败)。",
          "en": "Executes the model's tool_use locally: tools/index.js dispatches by name to the six group modules (build/edit/panel/query/env/space); exec(input) manipulates the Three.js scene directly; scene-mutating tools call markTouched(obj) (maintains the large-scene working set) and emit events to refresh the UI. The chat renders a tool card in sync (bilingual toolCallLabel), and the {ok, msg} result feeds back to the model as tool_result to continue reasoning. Exceptions are caught into fail messages — the model sees the error, fixes its parameters and retries (e.g. behavior-code compile errors)."
        },
        "uses": {
          "skills": [],
          "tools": [
            { "zh": "创建类 build-tools:add_asset / create_custom_object / set_behavior / build_template / clear_scene", "en": "Build group build-tools: add_asset / create_custom_object / set_behavior / build_template / clear_scene" },
            { "zh": "修改类 edit-tools:update_object / remove_object / select_object", "en": "Edit group edit-tools: update_object / remove_object / select_object" },
            { "zh": "面板类 panel-tools:attach_label / add_panel / update_panel / add_quiz_panel", "en": "Panel group panel-tools: attach_label / add_panel / update_panel / add_quiz_panel" },
            { "zh": "查询类 query-tools:get_scene / find_objects / get_object_detail", "en": "Query group query-tools: get_scene / find_objects / get_object_detail" },
            { "zh": "环境类 env-tools:set_environment / configure_locomotion / set_student_view", "en": "Environment group env-tools: set_environment / configure_locomotion / set_student_view" },
            { "zh": "空间引导类 space-tools:add_arrow / add_path / build_room / build_stairs", "en": "Space & guidance group space-tools: add_arrow / add_path / build_room / build_stairs" }
          ]
        },
        "file": "js/agent/tools/index.js#execTool"
      },
      {
        "id": "reply",
        "icon": "📨",
        "col": 8,
        "group": "output",
        "title": { "zh": "流式回复与统计", "en": "Streamed reply & stats" },
        "desc": {
          "zh": "模型不再发起工具调用后,最终正文以流式消息渲染进聊天区(思考摘要区块自动折叠为\"查看推理过程\")。回复语言由系统提示的 LANG_RULE 跟随界面语言。轮末如有 LLM 调用,渲染本轮统计条(调用次数/输入输出 token/缓存读写/估算花费,estimateCost 按缓存分价)。",
          "en": "Once the model stops issuing tool calls, the final body streams into the chat (the thinking block auto-collapses into 'View reasoning'). Reply language follows the system prompt's LANG_RULE, which tracks the UI language. If the turn made LLM calls, a stats bar renders (call count / input & output tokens / cache reads & writes / estimated cost — estimateCost prices cache tiers separately)."
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
          "zh": "runTurn 收尾:① agent.history 追加本轮 user + assistant(去 HTML 标签,后续轮次只带近 12 条);② 本轮改过场景(turnMutated)则弹「保留 / 撤销」卡——老师不满意可一键回滚整轮改动(history.js 快照),未点选就开始下一轮视为保留;③ 若当前处于运行模式且本轮改了场景,refreshPlaySnapshot() 更新\"停止运行\"的回滚基线(防止老师停止运行时把 AI 本轮成果一起还原);④ logEvent('turn_end') 落日志(回复摘要 + 统计);busy 解锁。",
          "en": "runTurn wrap-up: ① appends this turn's user + assistant to agent.history (HTML stripped; later turns carry only the last 12 entries); ② if the turn mutated the scene (turnMutated), shows the Keep / Undo card — the teacher can roll back the whole turn in one click (history.js snapshot); starting the next turn without choosing counts as Keep; ③ if play mode is on and the turn mutated the scene, refreshPlaySnapshot() refreshes the stop-play rollback baseline (so stopping play won't also revert the AI's work from this turn); ④ logEvent('turn_end') (reply summary + stats); releases the busy lock."
        },
        "uses": { "skills": [], "tools": [] },
        "file": "js/agent/orchestrator.js#runTurn"
      }
    ],

    "edges": [
      { "from": "input", "to": "turn", "label": "" },
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
      { "from": "tool-exec", "to": "executor", "label": { "zh": "tool_result 回填,继续循环(≤20 轮)", "en": "tool_result fed back, loop continues (≤20 rounds)" } },
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
      "summary": { "zh": "直跑楼梯生成器(实心台阶 ≤0.25 米/级 + 顶部缓步平台与护栏):多层楼之间的物理通道;平台尽头须对齐二层门洞(说明里有对接公式);瞬移/平滑移动/WASD 都能逐级上下;电梯场景则用按钮 + T.teleportStudent 模式。", "en": "Straight-run staircase generator (solid steps ≤0.25 m each + a top landing with guard rails): the physical link between floors; the landing edge must dock to the upper-floor doorway (docking formula in the description); teleport/smooth/WASD all climb it step by step; for elevators use a button + T.teleportStudent instead." } }
  ]
};
