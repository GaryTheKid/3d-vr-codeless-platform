# TODO — 未来路线图

> 提醒清单:以下为已对齐但**暂不实现**的功能,按大致优先级排列。

---

# ★ 近期优先(2026-07-07 对话对齐)— ✔ A–F 已全部实施(A–E 同日,F 于 07-08),详见各条勾选与 AGENTS.md

> **这一批为什么存在(背景,给新会话看)**
>
> 本项目是"给没有编程背景的老师用的 VR 教学场景创作平台",三栏 UI:左=资源库/场景层级(含自然语言 Inspector)、中=类 Unity SceneView 的 3D 视口、右=Ask/Plan/Agent 三模式的 AI 助教。技术栈:纯前端无构建、ES Modules + Three.js 0.160(CDN)+ Anthropic Messages API 浏览器直连,密钥放本地 `api-keys.txt`。模型可选 Sonnet 5 / Opus 4.8 / Fable 5,外加"思考深度"档位(Auto/低/中/高)。
>
> **前几轮已经做完的关键升级(本批的前提,别重复造)**:
> 1. **修了 Fable 5 的"Planner 未返回 JSON"**:根因是 Fable/Mythos/Sonnet-5/Opus-4.8 这代模型恒开 adaptive thinking,**思考 token 计入 max_tokens**,预算太小会被思考吃光→输出被静默截断。对策:max_tokens 给足 + planner 用 `effort:'low'`。禁止对这些模型发 `thinking:{type:enabled|disabled}`(会 400),深度只能用 `output_config.effort`。
> 2. **思考深度档位**:`llm.js` 里 `EFFORTS`(auto/low/medium/high),`MODELS` 里 `deepThinker` 标记恒开思考的模型(Fable)。`orchestrator.js` 的 `callBudget(stage)` 按档位+模型算各阶段 {effort,maxTokens};Auto=预设组合(planner low、executor/ask medium、deepThinker 执行放 high 且预算×1.5)。`cotGuidance()` 对 deepThinker 撤掉提示词里的分步 CoT 脚手架,避免和模型自带思考打架。
> 3. **AI 代码沙盒(最重要的能力升级)**:发现平台产出远不如"Cursor+Fable 手搓 demo"精致,根因是原来只有 add_asset 等粗粒度工具,模型**没有写代码造新物体的通道**。已新增:`js/agent/sandbox.js`(工具箱 T:THREE/mat/mesh/bond/group/attachLabel/makePanel/toast/say + runBuilderCode/compileUpdate/compileClick,new Function 隔离);工具 `create_custom_object`(写 Three.js 代码现场造对象,可挂 `userData.customUpdate(dt,t,obj)` 每帧行为 + `userData.customClick(obj)` 点击交互)与 `set_behavior`(给任意对象补写行为代码)。运行时钩子:`loop.js` 执行 customUpdate(连续报错~1s 自动停用),`viewport.js` 点击执行 customClick。NL Inspector(`hierarchy.js`)有"🧠 自定义逻辑"组件卡展示 `behaviorDesc` 并可开关。新增高端技能 `custom-modeling`、`experiment-logic`。质量标准写进系统提示,工具循环上限 14→20。
>
> **本批的触发场景**:用 Fable 5 做"生物生态圈能量流动"实验,多轮迭代("管道没对齐"→重造、"面板加能量值"→迭代)后发现一串问题,下面 A–E 就是复盘结论。**建议实施顺序:A(照亮问题)→ B(治体感)→ C(治生成质量)→ D/E(交互架构升级)**。每项可开独立对话解决;开始前先读 `AGENTS.md` 了解模块职责。

## A. 可观测性:日志系统 + Token 用量捕获

**背景**:多轮迭代生态圈时,第 3 轮"我想在每一级消费者面板上加能量值"出现卡死——计划卡显示的是 **"理解需求并规划场景 / 搭建并配置对象与交互 / 自检场景并补充教学面板"**(这三句是 `orchestrator.js` `runPlanner` 里 **planner 解析 JSON 失败时的兜底计划**硬编码文本,不是模型真规划的),执行阶段**一个工具卡都没有、直接回"完成。"**(这是 `runExecutor` 末尾 `if (!finalText) ui.addMsg('ai','完成。')` 的空产出兜底)。即"模型这一轮既没输出文本也没调用工具"。

**根因假设(按可能性排序)**:
1. **最可能:单次调用 thinking 吃光输出预算**。多轮后上下文变大(history + 完整场景 JSON + 已确认计划),Fable 先思考,若这轮思考特别久,`max_tokens` 花在思考上、正文/工具调用被截断。**现在完全没检查 `stop_reason==='max_tokens'`,所以截断是静默的,表现就是"完成。"**。
2. 上下文随轮次增长:`runExecutor` 每轮带 `history.slice(-HISTORY_KEEP=12)` + 工具循环内累积的 assistant/tool_result,每条历史是很长的总结文本,加上每轮重发完整场景 JSON→token 和延迟都在涨(也解释"越到后面越慢/越易卡")。
3. planner JSON 偶发解析失败再次走兜底(与 #1 同源)。

**关键缺口**:`parseSSE`(`js/agent/llm.js` 的 `message_delta` 分支,约 108 行)**只取了 `stop_reason`,丢弃了 `usage`**(输入/输出/思考 token)。所以现在根本无法判断到底是不是被截断。

**要做**:
- [x] **捕获 usage 与 stop_reason** ✔ 已完成:`parseSSE` 现在收 `message_start`/`message_delta` 的 usage,`callClaude` 返回 `{content, stop_reason, usage}`;`orchestrator.js` 的 `llmCall()` 包装统一记录(logEvent 'llm_call':stage/model/effort/maxTokens/耗时/usage/stop_reason)。
- [x] **截断预警/自愈** ✔ 已完成:planner 遇 `max_tokens` 自动预算×2 重试一次;executor 遇截断给老师可读提示("思考消耗超出预算…可调低思考深度"),不再静默"完成。";空产出也记 'empty_output' 日志。
- [x] **结构化日志** ✔ 已完成:`js/agent/logger.js` + `server.py`(取代静态服务器,零依赖 Python,注:本机无 Node 故没用 Node 方案)。`python server.py` 伺服页面,POST `/__log` 按启动时间落 `logs/*.jsonl`(一次会话一个文件);端点不可用自动降级内存缓冲(控制台 `__xrExportLog()` 导出)。已记录:turn_start/planner_result(原始输出+是否兜底)/llm_call(usage+stop_reason)/tool_call(input 摘要,代码只记长度/结果/耗时)/truncation/turn_error/turn_end。

## B. 推理过程可见 + 简单任务降 effort(治"平均一个项目思考 ~5 分钟,只有…"的体感)

**背景**:用户反馈"平均一个项目思考时间约 5 分钟,有点长",希望能像 Cursor 那样**部分看到模型的思考/推理过程**,而不是只有一个"…"打字点。

**技术事实**:Fable/Sonnet-5 这代 adaptive thinking 模型,`thinking.display` **默认 `'omitted'`**(思考块存在但内容是空字符串)。`parseSSE` 其实**已经在收 `thinking_delta` 和 `signature_delta`**(约 96–97 行,当初为多轮工具调用保留 signature 而加),但因为 display 是 omitted,收到的 thinking 永远为空,也没往 UI 回调。这代模型**永不返回原始 CoT**,但可以拿到**摘要版**。

**要做**:
- [x] **流式显示推理摘要** ✔ 已完成:`callClaude` 传 `onThinking` 即实时回传模型流式吐出的推理摘要(thinking_delta);`chat.js` 新增 `startThinkingBlock()`——浅灰小字虚线框"🧠 思考中…"流式打字,正文开始后自动收起变"查看推理过程"(可点开)。runExecutor/runAsk 已接。⚠ 坑:本 API **不接受** `output_config.thinking_display` 字段(传了会 400 Extra inputs are not permitted),已移除;display 为 omitted 时思考内容为空、思考块不渲染(优雅降级)。
- [x] **分片归属** ✔ 基本完成:工具循环每轮独立开一个思考区块,思考片段自然出现在对应工具卡上方(未做到计划卡内嵌级别,够用)。
- [x] **简单任务降档** ✔ 已完成:`callBudget(stage, complexity)`,Auto 档下 planner 判 `simple` 时 executor 降为 low(deepThinker 降为 medium),直接砍掉大部分思考时间。

## C. 对象颗粒度治理(治"巨型单体")

**背景(最该修的生成质量问题)**:让 Fable 生成生态圈时,它把**整个系统(地形 + 四个营养级 + 所有能量流 + 管道 + 粒子动画)全塞进一个 `create_custom_object`**(记录里主场景是单个对象 o15,修复后 o24)。后果:
- 老师想改一处只能让 AI **整体重写整个对象**——"管道没对齐"那次就是**删掉整个 o15、重造 o24**,几分钟又没了,且风险高。
- 层级面板里它是**不可拆的黑盒**,失去平台"可检视、可微调"的核心价值。
- 用户明确要求:**颗粒度适中,不太大也不太小,刚好表示一个逻辑实体**(举例:储氢罐、一个原子、一个生态位)。

**要做**:
- [x] **准则:一个对象 = 一个逻辑实体** ✔ 已完成:正反例写进 `scene-organization`(颗粒度铁律)与 `custom-modeling` 技能,并直接写进 `create_custom_object` 工具说明(技能没加载也生效):一次调用只造一个逻辑实体,系统=多次调用+控制器。
- [x] **跨对象联动的共享状态载体** ✔ 已完成:`experiment-logic` 技能新增"控制器模式"——先建控制器对象持共享 userData,实体对象用 `obj.parent.getObjectByName('控制器名')` 读数据驱动自己,禁止各自为政。
- [x] **修 say() 刷屏 bug** ✔ 已完成(双保险):①提示词层:`experiment-logic` 技能 + `create_custom_object`/`set_behavior` 工具说明强制要求 latch(边沿触发一次,复位清 flag);②运行时兜底:`sandbox.js` 的 `T.say`/`T.toast` 加 5 秒同文去重节流,就算 AI 忘写 latch 也刷不了屏。

## D. PC ↔ WebXR 交互抽象层(与 §2 合并推进)

**背景**:用户问 PC(鼠标点/拖拽)与 VR(摇杆点选、握持)交互怎么统一设计,参考 Unity XR Interaction Toolkit。同时提了一个 minor UI 问题:平台**刻意不像 Unity 分 Scene/Play 两个 mode**(目标轻量、降低老师认知负担),但带来副作用——**带交互的对象鼠标点上去只触发交互、无法选中调 Transform**(现状见 `viewport.js`:命中带 `expAction`/`customClick` 的对象会执行交互并 `return`,进不了选中)。用户自己的方案(采纳):**可交互对象选中时,除展示 Transform 外,额外加一个 ▶ 播放按钮预览它的触发器逻辑**。另外用户观察到:当前交互大多是"造个按钮/摇杆独立 obj 去控制一个独立单元"的模式,未来要支持更复杂交互,且这些 PC 交互要能平移到 WebXR。

**要做**:
- [x] ~~**不引入 Scene/Play 双模式**~~ ⚠ 已被 §G 推翻(2026-07-08):实际使用后仍决定引入显式"运行/编辑"双模式(复用 ▶ 按钮),Alt+单击选中与组件卡 ▶ 手动预览按钮保留。
- [x] **设备无关的语义交互事件** ✔ 已完成:新增 `js/core/interaction.js`——语义事件 `onActivate`(customClick 即其旧别名,平滑兼容)/`onGrab`/`onDrag`/`onRelease`,`dispatchInteraction()` 统一分发(含 expAction 状态机)。PC Interactor(viewport.js):点击→activate,按住拖动→grab/drag/release;XR Interactor(interaction.js):控制器射线+扳机→activate,grip→grab,内含激光指示线。`set_behavior` 工具新增 grab_code/drag_code/release_code((obj,detail) 签名,detail.point 世界坐标)。onSelect(悬停)暂未做,需要时再加。
- [x] **分层落位** ✔ 已完成:映射层是平台代码(interaction.js + viewport.js,所有对象共享);新增 `interaction-design` 技能(要求 AI 只写语义事件、交互挂在被操作对象本体上、禁止另造按钮遥控对象、禁止写鼠标/手柄代码)。

## E. 学生 Locomotion 控制器(PC + XR,归入 §2)

**背景**:用户问怎么设计学生的 controller——目前学生 XR 位置是**静态**的(`loop.js` `setupXR` 只在 sessionstart 把世界前推 5 米,没有移动能力),但有些场景需要学生走动。问是否该给学生移动也加 PC/XR 两套 skill。

**与 D 同一套哲学:设备差异收敛到平台运行时层,AI 只做"意图级"配置。**

**要做**:
- [x] 学生导航做成**虚拟对象** ✔ 已完成:"🥽 XR 会话管理器"下新增"🚶 学生移动方式"组件卡(开关=静态↔瞬移,自然语言编辑可配模式/半径/转向)+"🎮 交互方式"说明卡。
- [x] **PC + XR 双端** ✔ 已完成:新增 `js/core/locomotion.js`。XR:扳机指地瞬移(teleport)/ 左摇杆平滑移动 + 右摇杆 snap-turn 45°(或平滑旋转),实现方式=反向平移/旋转 scene(与出生点前推同机制);PC:方向键行走预览(WASD 留给手柄快捷键,避免冲突)。
- [x] **参数化配置** ✔ 已完成:`locomotion {mode: static|teleport|smooth, allowedRadius(活动半径,防走丢), turnMode: snap|smooth}`;新工具 `configure_locomotion`(工具说明里写了课型判据:观察类→static、探索类→teleport)+ 新 `locomotion` 技能(何时开走动、开了要圈活动范围);场景 JSON 里带 `studentLocomotion`,模型可感知当前配置。

## F. 大场景 LLM 友好:分层上下文 + Prompt Caching(2026-07-08 对话对齐,✔ 已实施)

**背景**:讨论"巨型场景怎么保持 Agent 可修改"。用户最初设想"每轮先跑一个检索 Agent 做语义搜索,只注入相关对象"(agentic RAG);评审后改为三层方案——前置检索 Agent 有三个问题:空间/全局类请求(排整齐/太挤了)语义检索召回不出、每轮多一次 LLM 调用、检索者不知道执行者要什么。

**方案(三层 + 两个纪律)**:
- [x] **① 常驻摘要**:场景对象数 > `FULL_JSON_MAX`(20)时进入"大场景模式",`buildContextMessage()` 不再发全量 JSON,改发按分类分组的一行式索引(oid/名称/位置/交互标记/描述前 30 字)+ 全局状态,保住全局感知;小场景照旧全量,零回归
- [x] **② 按需拉取(pull 优先于 push)**:新工具 `find_objects`(关键词语义匹配 + 可选空间过滤)与 `get_object_detail(oid)`;`get_scene` 大场景下自动降级为摘要。执行中的模型自己拉细节,比前置猜准
- [x] **③ 廉价预取(无 LLM)**:`searchObjects()` 纯 JS 打分——选中 +5、工作集(近 3 轮被工具创建/修改,`state.touched` 记录轮次)+4~+2、oid/名称/tags/描述的中文双字 n-gram 命中加分;top-8 自动附全参数(剥掉行为代码防 token 爆炸),省工具往返
- [x] **描述实时更新纪律**:`update_object` 新增 `description` 字段;`set_behavior`/`update_object` 工具说明写明"改行为必须同步更新描述——它是检索索引,过期描述会导致后续找错对象"(RAG 最经典死法是索引过期)
- [x] **Prompt caching**:system 拆稳定块(标 `cache_control: ephemeral`,连带 tools 定义一起缓存)+ 变化块(本轮技能提示);executor 工具循环内缓存断点滑动到最新消息,第 2 轮起 history+场景上下文+已有工具结果全部命中缓存读(0.1× 价)。`estimateCost` 早已按缓存读写分价计费,UI 花费显示自动准确

**尚未做(依赖后续需求)**:逻辑分组节点(sceneRoot 目前平铺,摘要按 AssetSkill 分类分组顶着用;500+ 对象时需要真正的组层级)、embedding 检索(现为 n-gram 词法匹配,接 embedding API 后可升级 `searchObjects` 内核,接口不变)、history 老轮次摘要压缩。

---

## G. 运行/编辑双模式 + 检查器升级(2026-07-08 对话对齐,✔ 已实施)

**背景**:D 项当初"刻意不做 Scene/Play 双模式"(Alt+点击选中方案),实际用下来可交互对象的编辑体验仍别扭。用户复盘后决定引入显式双模式,复用视口 ▶ 按钮。

- [x] **运行/编辑模式**:`state.playMode`(默认 false=编辑)+ `setPlayMode()`。编辑模式=全静态、点击一律选中;运行模式=动画播放+语义交互生效(Alt+点击仍可选中)。▶ 按钮从"动画开关"升级为模式开关(animPlaying 变为其子开关,"动画播放器"组件卡可在运行中单独暂停);进 XR 会话自动切运行模式;AI 新增 set_environment {play_mode};编辑模式首次点中可交互对象 toast 提示一次
- [x] **检查器(视口右上角)四个新区**:📖 用途(behaviorDesc/AssetSkill description 派生)、🔁 动画(anim 参数或代码驱动,含停用态)、🖱 交互与联动(交互方式 + 扫描行为代码 getObjectByName 生成**双向**引用芯片:→读取/控制、←被引用;点击芯片 emit 'focus-object' → 层级面板切页+选中+滚动+闪烁)、💬 对象级 AI 指令输入(emit 'agent-request' → chat.js 临时 📌 该对象跑 runTurn,带完整参数+行为代码上下文,轮后恢复)

**遗留**:联动芯片依赖 getObjectByName 词法扫描,AI 若用其他方式跨对象引用(如遍历 children 找 userData 标记)扫不出来——未来可让 AI 在 set_behavior 时显式声明依赖列表(userData.dependsOn)。

**追加(同日,用户反馈)**:
- [x] **UI 控件非破坏原则**:检查器"自转"勾选框原来整体替换 `anim`(勾一下把行星的公转干掉了)。修复:引入 `anim.selfSpin` 附加字段——orbit 自带自转、置 false 单独关;其他动画置 true 叠加自转;只有纯 spin 时勾选框才增删整个 anim。离线"转起来"命令同步修复。原则写进 AGENTS.md:单项 UI 控件只改自己那一项逻辑
- [x] **面板文字直接编辑**:检查器新增"📝 面板文字"区(置于描述区之前)——对象子树里每块面板一组 标题+内容行 输入框,打字即重绘 3D 面板(行数变化自动重算画布/网格,`updatePanelContent()`);live 面板给提示改用 AI。配套新工具 `update_panel`(AI 原地改文字,不再删了重加),detailed 上下文里带出面板现有文字,ui-panel 技能加了对应准则

## H. 单文件 HTML 导出(⬇ 下载按钮,2026-07-08 对话对齐,✔ 已实施)

- [x] 顶栏「⬇ 下载」→ `js/export/exporter.js`:导出自包含 HTML 学生播放器,优先 POST `/__export`(server.py 写入项目 `download/` 目录,自动创建),静态服务器降级为浏览器下载
- [x] **双轨还原**:①`sceneRoot.toJSON()` 序列化几何/材质/贴图(canvas 面板自动烘焙 dataURL;导出前剥离 userData 里的函数/THREE 引用,导出后恢复);②含 `builderCode` 的对象在播放器里**重跑构建代码**整体重建——这样构建期闭包里挂的 customUpdate/customClick 和 live 面板都能复活,失败时回退到序列化网格
- [x] 播放器 = 蒸馏版运行时(约 450 行,内嵌在导出 HTML):动画 switch(含 selfSpin)/语义交互分发/PC+XR Interactor/teleport+smooth locomotion(带 allowedRadius/snap turn)/面板 billboard+live 重绘/T 工具箱重编译行为代码/customUpdate 保险丝;Three.js 走 CDN importmap(首次打开需联网)

**已知边界**:内置 labs 实验(制氧/英语点餐)的状态机在模块代码里,不随导出(expAction 点击提示回编辑器体验);模板自带的 live 面板导出后为静态图;builderCode 重建会丢掉后期 attach_label 挂上去的标注与 📝 文字编辑(重建优先保行为)。未来正式版:导出走后端打包(labs 模块 + Three.js 内联,彻底离线可用)。

## I. 面板分型 + 项目管理 + HTML 导入 + 中英双语(2026-07-09 对话对齐,✔ 已实施)

- [x] **面板分型 live/static + 纹理重建修复**:`panel3d.js` 新增 `panelKind(mesh)`(live=代码驱动实时数据 / static=纯静态文字)。检查器"📝 面板文字"区据此分流:static 面板标题+内容行直接编辑,live 面板显示徽标+当前数据快照(只读)+ "用 AI 改逻辑"提示。根因修复:WebGL2 贴图存储尺寸不可变,行数变化导致画布高度变化时旧纹理残留(表现为"两块面板叠着、清空不生效")——`updatePanelContent` 现在在画布高度变化时 dispose 旧 CanvasTexture/geometry 并重建
- [x] **项目管理**:`js/core/projects.js`(数据层:localStorage 项目库 CRUD + serializeScene/loadSceneData,panelSpec JSON 镜像随场景走、载入后 rehydrate,builderCode 对象重建+行为代码重编译,live 面板降级静态快照)+ `js/ui/projects.js`(左栏第一个 Tab「📁 项目」:新建/打开/重命名/删除);顶栏「💾 保存」落到当前项目
- [x] **HTML 导入器**:导出 HTML 内嵌 `<script type="application/json" id="xr-scene-source">` 场景数据块(格式 `{magic:'XR-EDU-SCENE',version,name,scene,cfg}`),导出文件可重新导入编辑器。安全门:文件大小 ≤25MB / 魔数+版本校验 / 结构形状校验(validateSceneData)/ 导入前用户确认(含"场景可能含 AI 行为代码"风险提示)。选型结论:沿用 HTML 而非自创格式(浏览器可直接打开的价值 > 解析复杂度)
- [x] **中英双语**:`js/core/i18n.js`——`t(key,vars)` 字典查询(UI 骨架)+ `L(zh,en)` 内联双语(模板/labs/组件描述等内容型文案)+ `data-i18n/-title/-ph` 声明式 DOM;顶栏 EN/中 按钮,切换=localStorage 持久化+整页刷新(大量文案在模块加载期求值,刷新最干净)。覆盖:UI/检查器/层级组件卡/聊天/toast/8 个场景模板/两个交互实验/资源库/Agent 系统提示(LANG_RULE 控制回复与生成内容语言)/离线命令(英文关键词)。已有 3D 对象名与面板文字属于用户内容,切换语言不追改

## J. Agent 目录重构 + 工作流可视化(2026-07-12 对话对齐,✔ 已实施)

- [x] **skills/ 目录化**:`skills.js` 拆为 `js/agent/skills/`(一技能一模块 + index.js 注册表)。方法论按 Anthropic Skill 文章做了取舍(采纳:description 即路由、渐进暴露、只写 Gotchas、"脚本"=tools;不采纳:每技能一个 SKILL.md 文件夹——浏览器无文件扫描、单技能体量未到,升级条件已写进 js/agent/README.md)。硬性约束:技能模块零依赖纯数据(viewer 直接 import 展示)
- [x] **tools/ 目录化**:`tools.js` 拆为 `js/agent/tools/`(build/edit/panel/query/env 五分组 + index.js 聚合);聊天卡双语标签 `label(input)` 从集中 switch 改为与工具定义就地共存;新增工具只需往分组数组里加对象
- [x] **agent-map.js**:工作流有向图(12 节点/17 边,每节点含 title/desc/加载的技能/使用的工具/代码位置/上下游)+ 16 个工具的目录(原为 agent-map.json,为支持 file:// 纯本地查看改为 JSON 字面量包一层 globalThis 赋值)
- [x] **agent-viewer 三页可视化(纯本地,双击即开,无需服务器)**:agent-viewer.html 工作流 SVG 图(左键拖拽平移视图、点节点右栏看详情、高亮上下游边)/ agent-viewer-skills.html 技能库(直接加载 skills/ 注册表脚本,零同步成本)/ agent-viewer-tools.html 工具库(读 agent-map.js)+ 搜索;共用 agent-viewer.css/-common.js。技能模块为此改为"注册表写法"(globalThis.XR_AGENT_SKILLS push,零依赖无 import/export,应用与可视化共用同一份文件)+ skills/manifest.js 文件清单
- [x] **查看器中英双语**:右上角 EN/中 按钮(localStorage 持久化+刷新生效);agent-map.js 全部文案改 {zh,en} 双语对象,11 个技能文件加 nameEn/descriptionEn/promptEn 英文镜像(运行时发给 LLM 的仍是中文 prompt);维护规约(新增技能/工具必须配英文)写入 js/agent/README.md
- [x] **js/agent/README.md**:目录说明 + 文章取舍决策 + "改了什么就同步什么"的可视化维护规约

## K. 上下文锁定 + 运行重置 + 学生视角/导览/房间工具(2026-07-12 对话对齐,✔ 已实施)

- [x] **上下文锁定**:`runTurn` 开始时 `buildContextMessage` 只构建一次,Planner/Ask/Executor 整轮复用同一份——老师在 Agent 执行中切运行模式/换选中不再造成上下文漂移(工具结果仍是实时的,模型能看到自己改的东西);agent-map.js 的 context 节点描述已同步
- [x] **运行模式重置(类 Unity)**:新增 `js/core/play-reset.js`——进运行模式深度快照(全子树 transform/visible/子节点列表/材质色/userData JSON 安全值),停止运行全部还原:动画位移、学生交互改的状态、代码 spawn 的实例都回滚。边界处理:Agent 在运行中改了场景 → 轮末 `refreshPlaySnapshot()` 更新回滚基线,防止停止运行时把 AI 成果一起还原
- [x] **学生视角代表物**:新增 `js/scene/student-rig.js`——场景里的 🧍 系统对象(不可删、清空/模板保留、仅编辑模式可见):定点课(locomotion=static)只显示视锥棱台(相机),可走动课显示白色胶囊+视锥(类 Unity);像普通对象一样拖动/旋转即设置学生出生点与初始朝向;进 VR(loop.js sessionstart)与导出播放器(exporter cfg.spawn)都按它出生;`set_student_view` 工具(look_at 自动算朝向)+ 上下文 globalState 暴露 studentSpawn
- [x] **箭头/路线工具**:新增 `js/scene/guides.js` + `tools/space-tools.js`——`add_arrow`(from→to,可拱弧)/`add_path`(路径点平滑曲线:实线/虚线/圆点、方向小箭头、起终点标记、可闭合成轨道);role 字段区分场景内容 vs 教学引导,这类图元不再让模型手写代码
- [x] **房间壳工具**:新增 `js/scene/rooms.js` + `build_room` 工具(地板+四墙+门洞/窗带/可选天花板+顶灯),"教室/密室/餐厅"等室内体验的确定性基座
- [x] **新技能(双语)**:`view-navigation`(出生点与最佳观察距离经验法则、导览路线设计三步、引导图元用色纪律)/`room-design`(室内课固定次序:壳→沿墙陈设→移动与出生→密室控制器模式);agent-map.js 工具目录 16→20、README/AGENTS.md 已同步
- [x] **英文版补漏**:EFFORTS/BUDGETS(思考深度/输出预算下拉框)的 label/note 改为 L() 双语

## L. 体验打磨:碰撞/PC 试玩/PiP/交互反馈/多选即上下文(2026-07-12 第二批,✔ 已实施)

- [x] **玩家碰撞系统**:新增 `js/core/collision.js`(2D XZ AABB,内容坐标系)——`userData.solid` 对象(祖先标记对子树生效)在玩家身体高度带(0.2~1.9m)生成碰撞盒;`build_room` 墙体自动 solid;瞬移(落点入实心体/传送线穿墙=无效,必须走门洞)、平滑移动(贴墙滑动)、WASD 驾驶都过碰撞;导出播放器同款(collectSolids + pointBlocked/segBlocked/resolveMove)
- [x] **运行模式 PC 试玩**:可走动课运行时,WASD 移动学生胶囊 + ←→ 转向(`student-rig.js updateRigDrive`,方向键让位、W/E/R gizmo 快捷键运行时停用);视口底部 #play-hint 操作提示条;停止运行由 play-reset 自动复位位置(类 Unity)
- [x] **学生相机画中画(类 Unity Camera Preview)**:选中学生视角对象或运行可走动课时,视口右下角 scissor 渲染学生眼中画面(`loop.js renderStudentPiP`);相机固定眼高 1.6m/FOV 60°,**缩放代表物不改变取景**(缩放只是 gizmo 大小)
- [x] **学生视角修复**:运行模式不再消失(PC 上运行=可驾驶化身,点击穿透靠 hitTopObject/xrHit 过滤 editorOnly,Alt+点击仍可选中;真 VR 会话中才隐藏);选择框只统计可见网格(定点课的隐藏胶囊不再撑大包围盒/带偏中心)
- [x] **平台级交互反馈**:新增 `js/core/highlight.js`——hover(PC 鼠标节流射线 + XR 控制器射线)淡蓝自发光 + 手型光标,activate 成功统一闪烁(dispatchInteraction 里);导出播放器同款;interaction-design 技能明确"hover 反馈平台包办,AI 只写结果反馈"
- [x] **玩家感知沙盒助手**:`T.playerPos()`(VR=头显站位/PC 运行=胶囊/否则=相机)、`T.distToPlayer(obj)`、`T.overlaps(a,b,margin)`;interaction-design 技能新增游戏化模式库(近接收集/投放判定记分/控制器记分板/计时),支撑吃豆人、垃圾分类类玩法
- [x] **室内设计升级**:room-design 技能加"多房间户型"章(先想平面图、尺寸差异化、门一律朝走廊、陈设同类不同样、共用墙留缝);view-navigation 加"路线绝不穿墙、逐点过门洞"硬规则;build_room 说明同步
- [x] **回复用名称不用 oid**:LANG_RULE + 原则 5 明确"聊天里一律用显示名,oid 只用于工具调用"
- [x] **Shift 多选 + 选中即上下文**:`state.selection` 多选集合(次级暗色高亮框),多选不弹检查器(类 Unity),Del 批量删;移除层级面板 📌 按钮——`contextPins` 变为 selection 的镜像("选中即上下文"),上下文芯片 ✕=取消选中。相关研究:Bolt "Put-That-There"(1980)开创的多模态指代一脉,近年 LLM 化验证包括 GazePointAR(CHI'24,凝视+指点消解代词)、ASSISTVR(TVCG'24,语音+射线多对象选择优于纯射线)、"Revisiting Put-That-There"(ISMAR'25,指点/注视事件直接作为 LLM 上下文字段)——"3D 直选→LLM 上下文"有已发表支撑,可作为对照实验的实验组设计依据
- [x] **切语言不丢场景**:切换前 serializeScene 寄存 localStorage('xr-lang-stash'),刷新后自动还原(场景内文字保持原语言,toast 提示可让 AI 翻译);超限额时降级为确认弹窗
- [ ] **craft-customized-tool(记录,暂不实现)**:复杂玩法(§9 类)出现"模型反复手写同类逻辑"时,让 Agent 自己定义临时工具(名称+schema+JS 实现),当轮注册进工具表、可选缓存到 localStorage 沉淀为用户工具库。前置条件:工具实现代码需要 Worker 级沙盒(见技术债);与 §5"新资产沉淀为 AssetSkill"共享"越用越丰富"的机制设计。当前用"控制器对象 + 玩家感知助手 + 游戏化模式库"顶住大部分需求,等出现真实瓶颈再上

## M. 学生视角保真 + 多层楼 + 条件解锁 + 可交互 UI + 项目管理打磨(2026-07-12 第三批,✔ 已实施)

- [x] **PiP 画面=学生真实所见**:renderStudentPiP 渲染前隐藏全部编辑器 UI(TransformControls gizmo/选择框/多选框/网格/editorOnly 对象/导览路线),渲染后恢复;不再出现蓝色线框和变换手柄
- [x] **定点棱台旋转中心修正**:static 模式下棱台几何中心移到 rig 原点(userData.staticPose 标记,切换 locomotion 时自动换算 y 与子件偏移);getStudentSpawn/getStudentEye 换算回站立点/眼点
- [x] **运行模式面板朝向学生**:loop.js 的 billboard 目标在运行模式(PC)改为学生相机(getStudentEye),编辑模式仍面向编辑相机,XR=头显——PiP 里的面板因此是正的
- [x] **切语言后询问翻译场景**:寄存场景还原后弹 confirm,同意则 emit('agent-task') 让 Agent 用 update_object/update_panel 翻译全部对象名/面板文字(chat.js 新增 'agent-task' 系统级自动任务入口,busy 期间输入自然锁定)
- [x] **运行模式隐藏导览路线**:新增 js/core/play-visibility.js——role≠content 的 add_path 路线进运行模式对学生隐藏、退出恢复(rAF 与 play-reset 快照顺序解耦);导出播放器直接剔除;PiP 同规则;箭头保留(教学内容);add_path 工具说明+view-navigation 技能已写明
- [x] **room-design 户型真实感**:技能加"共享墙拼合"硬规则(相邻房间中心距=两间半宽之和、外轮廓成矩形/L形、绝不一字排开)+ 一套 3室2卫参考户型坐标模板(12×9,走廊横贯)
- [x] **多层楼(调研结论:原碰撞为 2D 身体带过滤,y 恒 0,二层完全不可达 → 已升级)**:collision.js 改为高度感知(碰撞盒带 minY/maxY,拦挡判定相对脚底 feetY,顶面 ≤feet+0.45 的是可踩台阶)+ groundHeightAt 采样站立高度;locomotion standAt 带 y(上楼=世界下沉),瞬移可指楼梯/二层地板;WASD 驾驶同步;新工具 build_stairs(实心台阶 ≤0.25m/级+扶手 solid=false 豁免);build_room 加 y 参数(建二层)+ 地板/天花板 solid(可踩楼板);"电梯"=按钮 + T.teleportStudent(x,z,层高) 模式(不做运动轿厢);导出播放器全部同款
- [x] **条件解锁/任务链**:interaction-design 技能新增模式⑤(闸门对象 solid+锁定外观,条件源=quiz.done/收集计数/交互 flag,控制器轮询+latch 解锁:T.setSolid(门,false)+动画+T.notify;关卡链=解锁点亮下一关线索);新沙盒助手 T.setSolid(运行时改碰撞并重建盒)
- [x] **可生成/可交互 UI**:①T.notify(text,{at,title,accent,duration}) 世界内临时提示面板(自动消失、时长随文字长度、VR 可见,优先于屏幕角标 T.toast);②新工具 add_quiz_panel 选择题面板(问题+2~4 选项按钮,PC 点击/VR 扳机作答,即时对错反馈+notify;builderCode 模式生成→保存/导出可复活;答对 userData.quiz.done=true 可作解锁条件)。滑杆/文本输入型 3D UI 记为后续(VR 文本输入需虚拟键盘,见 §3)
- [x] **多选联动变换(类 Unity)**:gizmo 挂主选中对象,objectChange 增量同步其余选中对象(平移同位移/旋转绕主对象/缩放以主对象为中心),mouseDown 快照整段可撤销
- [x] **新建项目=空场景**:btn-proj-new 先 confirm 再 clearScene(保留学生视角)后建项目
- [x] **项目复制**:copyProject 深拷贝,名字追加 (1)(2)…(取最小未占用序号);卡片上 📄 按钮
- [x] **项目管理 UI 重构**:卡片即按钮(描边风格、hover 变色、当前项目蓝色高亮),点卡片=打开(去掉 📂 打开按钮),小按钮=复制/重命名/删除
- [x] **文献检索:LLM+3D 引擎(实验基线风险评估)**:该方向已有多篇顶会工作,详见下方"研究备忘"

## N. 房间体验打磨:门/尺寸/z-fighting/楼梯对接/房间 UI 可见性/防坠落(2026-07-12 第四批,✔ 已实施)

- [x] **房间强制有门**:buildRoom 非法/缺省 doorWall 一律回退 s(工具 schema 移除 'none',exec 回退并在结果里告知模型);窄墙(小卫生间)自动收窄门洞(0.7~1.3 米)而不是放弃开门;"密室锁门"=门洞上放 solid 门对象由交互解锁(技能/工具说明已写明)
- [x] **z-fighting**:房间地板底面抬高 0.02(不再与全局地面共面);custom-modeling 技能加"水平薄面绝不共面,底面抬 ≥0.02"守则
- [x] **房间整体加大**:buildRoom 默认 8×6→10×8;room-design 技能尺寸标准整体上调(教室 10×8、客厅 6×5+、卫生间也 ≥2.5×2.5,"VR 里房间比数字显小,宁大勿小"),参考户型放大到 15×11
- [x] **家具不出墙铁律**:room-design 技能新增——家具中心到墙距离 ≥ 半宽+0.2 米,摆前按 w/2、d/2 心算校验,摆完批量自查越界即 update_object 收回;build_room 工具说明同步
- [x] **楼梯与二层对接**:buildStairs 顶部自带缓步平台(landing 默认 1.2 米,顶面=rise,与二层地板差 0.12 一步跨上)+平台两侧实心护栏;工具说明写入对接公式(face=n 时起步 z = z0+d/2+run+landing、x 对齐门洞中线)与"平台末端 vs 门洞误差 ≤0.3"自查
- [x] **房间内 UI 可见性(用户指定规则,勿擅自移除)**:新增 js/core/room-ui-visibility.js——观看者(XR 头显>运行模式学生眼>编辑相机)在房间外→该房间内所有面板隐藏(面板伸出墙被切一半的问题);在房间内→面板 depthTest 关+renderOrder 1000 顶层渲染永不被挡;房间识别=buildRoom 的 userData.roomBounds 局部盒测试(搬动/旋转照常),面板识别=userData.panelData,0.2s 节流;导出播放器同款 updateRoomUI
- [x] **多层防坠落(双保险)**:①运行时悬崖保护 LEDGE_DROP=0.6——XR 平滑移动与 PC WASD 驾驶不允许走出 >0.6 米跌落沿(楼梯 0.25/级不受影响),编辑器与导出播放器同款;②room-design 技能"防坠落铁律"——二层学生可达处必须有墙/护栏围住,二层的门只开向楼梯平台/有围挡连廊,绝不开向空中

### 研究备忘:LLM + 3D 引擎已发表工作(2026-07-12 检索)

> 用户担心:以"原生 Unity 式编辑器"为对照组可能被评审质疑"已有人做过 LLM+传统引擎"。检索结论:**确实已有一条成熟的工作线,不能声称"首个 LLM 驱动 3D 引擎";但没有一篇同时覆盖"零编程教师 + 教学法技能 + VR 学生端 + 选中即上下文"的组合**,定位应打差异化。

- **LLMR**(Microsoft,CHI 2024,Best Paper 荣誉):Planner/Scene Analyzer/Skill Library/Builder/Inspector 多 GPT 编排,Unity 里 Roslyn 实时编译 C#,错误率比裸 GPT-4 低 4×,N=11 可用性研究——与本项目架构最接近(本项目 sandbox.js 头注释也标注了参考它)
- **DreamCodeVR**(UCL,IEEE VR 2024):VR 内语音→C#→Roslyn 热编译,面向无编程用户改运行中应用
- **Ostaad / "How People Prompt GenAI to Create Interactive VR Scenes"**(DIS 2024):WoZ 引出式研究(N=22)+ 具身对话式编程代理;发现用户期望代理理解指点等具身指代——**为"选中即上下文"提供了需求侧证据**
- **VRCopilot**(密歇根,UIST 2024):VR 内人机共创 3D 布局,wireframe 中间表征提升用户 agency——实验设计(manual/scaffolded/automatic 三条件)值得借鉴
- **agentAR**(UIST 2025):工具增强 LLM 代理端到端创建 AR 应用(N=12)
- **SceneCraft**(ICML 2024):LLM 代理写 Blender Python 渲染百资产场景(场景图→约束→GPT-V 视觉反馈迭代+库学习)——"AI-powered Blender"的代表
- **Holodeck**(AI2,CVPR 2024)/ **Holodeck 2.0**(2025):语言引导生成 Embodied AI 3D 环境(LLM 出空间约束+求解器摆放);3D-GPT(2024/2025):多代理程序化建模
- **MUSE**(2026 preprint):记忆接地多代理场景编辑(Architect/Sculptor/Inspector),强调"增量修改不破坏无关内容"——与本项目"非破坏原则/上下文锁定"关注点相同
- **Vibe Coding XR**(Google,2026):XR Blocks + Gemini 的 XR 原型 vibe coding 工作流
- **定位建议**:①贡献不落在"能不能用 LLM 改 3D 场景"(已被 LLMR 等证明),落在**教师/教学法特定的 agent 平台**(教学技能库、学生视角/导览/房间等课堂概念工具、导出可分发学生端)与 **HCI 机制**(选中即上下文、非破坏组件卡、运行/编辑重置);②对照组避免"裸 Unity"(会被批 strawman),更强的对照是 "LLMR 式通用 agent(无教学技能/无选中上下文)" vs 本系统,或做消融(去掉技能库/去掉选中即上下文);③引用上述全部工作说明谱系

## 1. 语音能力(TTS / STT)
- [ ] 接入 STT(语音识别)+ TTS(语音合成)服务,启用音频相关对象
- [ ] 英语点餐场景升级:真实听懂学生说的英语 → LLM 生成回应 → TTS 播放,数字人口型/动作同步
- [ ] 老师也可以用语音指挥 Agent

## 2. XR 交互控制对象
> 具体设计已细化到近期优先项 §D(交互抽象层)与 §E(学生 locomotion),两者已于 2026-07-07 落地(interaction.js / locomotion.js / configure_locomotion 工具 / XR 会话管理器组件卡)。
- [x] 学生**导航**(瞬移/平滑移动/固定点)与**交互**(射线点选/抓取)可配置 ✔
- [x] 在自然语言 Inspector 中以组件卡形式呈现与编辑 ✔
- [ ] 剩余增强:抓取距离限制、onSelect(悬停高亮)语义事件、allowedArea 支持任意多边形(现为圆形半径)

## 3. 可自定义/自适应 UI 面板
- [ ] 点击 3D 面板(如实验实时数据板)→ 弹出编辑器,直接改面板上的数据/逻辑
- [ ] 也可以用自然语言改:"把这块面板改成显示温度曲线"
- [ ] 面板内容绑定数据源(实验状态机变量)做成可配置映射

## 4. 自定义技能(Skill)体系
- [ ] 用户可筛选、提取、加载自己的技能,用于特定学科场景/对象/交互的生成
- [ ] 技能编辑器:name/description/prompt + 可选工具白名单
- [ ] 技能的导入导出格式(JSON/Markdown),为社区分享做准备

## 5. 资产复用评估与资产检索
- [ ] **复用 vs 新建的决策层**:用户要求创建某物时,Agent 先检索现有资产(个人资产库 → 社区资产 → 内置资源),评估匹配度后决定"直接复用 / 复用+微调 / 全新生成",并在计划里向用户说明选择理由
  - 检索依据:AssetSkill 的 name/description/prompt/tags(语义匹配,未来可加 embedding)
  - 新生成的资产自动封装成 AssetSkill 存入用户资产库,形成"越用越丰富"的正循环
  - create_custom_object 生成的对象已把 builderCode 存在 userData 里,沉淀为 AssetSkill 只差封装与持久化
- [ ] **资产搜索工具**:用户直接问"资产库里有没有 XX"时,Agent 调用 search_assets 工具返回匹配列表(含描述与教学用法),支持模糊/语义检索;左栏搜索框同步升级为同一套检索逻辑

## 6. 用户数据库与社区
- [ ] 用户账号:项目、资产(AssetSkill 已按数据库表设计)、发布状态管理
- [ ] 社区:分享/获取技能、资源、场景模板、教学点子
- [ ] 云端保存与"分享给学生"链接(顶栏两个按钮目前是占位)

## 7. 多 Agent 协作
- [ ] Agent 分工:贵模型(Fable/Opus)只做规划与核心决策,便宜模型(Haiku)做执行性劳动,降低成本
- [ ] 并行执行:多个执行 Agent 分别负责场景不同区域/子任务
- [ ] 评审 Agent:搭建完成后自动做场景质量评估(aesthetic/pedagogy/performance)

## 8. 用量追踪
- [ ] Token 用量统计面板(usage 已随 §A 捕获并写入日志 llm_call 事件,差 UI 展示)
- [ ] 按项目/按天的花费统计与预算提醒

## 9. 真实 3D 模型导入管线(FBX/GLB,2026-07-08 对话对齐)
> 现状:全平台没有任何 Loader,物体只有两个来源(builders.js 程序化几何 + AI 沙盒现写代码)。目标:老师能导入真实模型(如带材质的 10 万面人体解剖 FBX),且导入后自动变成 Agent 可用的资产。架构上是顺路的:AssetSkill 只要求 `build: () => Object3D`,导入模型塞同一个壳子即可。

- [ ] **格式策略:入口收 FBX,内部统一 GLB**。FBXLoader 对材质/内嵌贴图支持不稳、单位是 cm;importmap 已指向 `three/addons/`,FBXLoader/GLTFLoader/GLTFExporter 可直接 import。客户端流程:FBXLoader 读入 → 归一化 → GLTFExporter 导出 GLB 存 IndexedDB(无后端时资产活过刷新的唯一途径);有后端后改离线转换(Blender/FBX2glTF)+ Draco/meshopt + KTX2
- [ ] **导入归一化**(新建 `js/assets/importer.js`,坑最多的一步):
  1. 单位与落地:FBX 常为 cm(×0.01);算包围盒,平移使 min.y=0、水平居中(平台约定 y=0 是地面)
  2. 材质统一转 MeshStandardMaterial(FBX 常给 Phong,与现有 PBR 光照不一致);贴图限 2048²
  3. 包一层 group 再 assignOid(层级/射线假设"场景对象=sceneRoot 直接子级",导入模型内部节点树很深)
  4. 动态注册 AssetSkill:footprint 从包围盒算、tris traverse 累加;description/prompt 弹框让老师填或让 Agent 自动生成——注册后资源库 UI 与 add_asset 工具自动生效
- [ ] **性能**:100k 三角形 PC 无压力,Quest 独立端整场预算约 200k~500k,单个"主角模型"可接受。逐三角 raycast 会卡:给导入对象挂简化碰撞体(包围盒/凸包),交互层只对碰撞体 raycast;可选 meshopt 减面 / THREE.LOD 两档
- [ ] **骨骼动画子系统**(真实人体模型通常带 skinned mesh + AnimationClip,与现有参数化 anim 体系并行):clips 存 userData、建 AnimationMixer,loop.js 里 mixer.update(dt);NL Inspector 加"🎬 动画剪辑"组件卡(Walk/Idle 切换);新工具 play_animation 让 Agent 能指挥("让这个人走起来")
- [ ] **LLM 友好性(衔接 §F)**:导入时 traverse 命名子节点(解剖模型常有 Heart/Femur 等语义命名),列表写进对象描述;`findObject` 支持 `oid/子节点名` 寻址——"把心脏标红"才有抓手

## 技术债 / 修正项
- [x] LLM 调用改为流式(streaming),回复逐字显示 ✔ 已完成
- [ ] 密钥从浏览器直连改为后端代理(正式版安全要求)
- [ ] AI 代码沙盒升级隔离级别:new Function → Worker/iframe 沙箱 + API 白名单(正式版安全要求)
- [ ] 场景序列化保存/加载(.xrscene 格式),支撑撤销/重做
- [ ] NL Inspector 的编辑接入 LLM 理解(目前离线只解析数字/颜色词)
- [ ] 单元测试:tools.js 的 exec 与 context.js 的序列化
