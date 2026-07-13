# AGENTS.md — 给 AI Agent 的项目说明书

> 本文件面向维护/扩展此项目的 AI 编码代理。人类请先读 README.md。

## 项目是什么

XR EduAgent:纯前端(无构建步骤)的 VR 教学场景创作平台。老师用自然语言指挥内置 Agent 在 Three.js/WebXR 场景里搭建交互式课程。技术栈:原生 ES Modules + Three.js 0.160(importmap CDN)+ Anthropic Messages API(浏览器直连)。

运行:`python server.py`(静态伺服 + `/__log` 结构化日志端点,logs/*.jsonl 一次会话一份;`/__export` 导出端点写 download/);也可用任意静态服务器(日志降级为内存缓冲、导出降级为浏览器下载)。无 npm 依赖、无打包。

## 架构总览

```
main.js                     入口:import 各 UI 模块(副作用注册)→ startLoop/setupXR → loadApiKeys → 欢迎语 + 默认场景;语言切换不丢场景(切换前 serializeScene 寄存 localStorage 'xr-lang-stash',刷新后优先还原寄存场景而非示例太阳系;还原后弹窗询问是否让 AI 把场景内文字翻译成新语言——确认则 emit 'agent-task' 走完整 Agent 流程)
server.py                   本地开发服务器:静态伺服 + POST /__log 日志端点 + POST /__export(单文件 HTML 场景写入 download/)(零依赖 Python)
js/export/exporter.js       ⬇ 下载按钮:导出单文件 HTML 学生播放器。双轨还原:sceneRoot.toJSON() 序列化几何/材质(canvas 面板烘焙成 dataURL)兜底 + 含 builderCode 的对象在播放器里重跑构建代码整体重建(复活 live 面板与构建期闭包);行为代码字符串用同款 T 工具箱重编译(T 含 playerPos/distToPlayer/overlaps/teleportStudent/setSolid/notify)。播放器=蒸馏版运行时(动画/语义交互(hover 发光+点击闪烁)/XR控制器/locomotion(solid 碰撞:瞬移不穿墙、平滑贴墙滑、脚底高度采样上楼梯、悬崖保护)/面板/房间内 UI 可见性规则(updateRoomUI,与 room-ui-visibility.js 同规则),无编辑 UI,恒运行模式)。editorOnly 对象与 role≠content 的导览路线不进播放器。导出 HTML 还内嵌 `<script type="application/json" id="xr-scene-source">` 场景数据块(projects.js 的 ProjectData 格式)→ 文件可被「📥 导入 HTML」导回编辑器。⚠ PLAYER_SRC 模板里禁用反引号与插值符(它整体是模板字符串);内置 labs 实验的状态机不随导出(expAction 点击提示回编辑器)
js/core/
  three-setup.js            单例:scene/camera/renderer/orbit/tctrl/sceneRoot/dirLight/grid/clock。所有场景对象挂 sceneRoot
  state.js                  可变共享状态 { selected(主选中,gizmo 挂它), selection(多选数组), objCounter, playMode, animPlaying, contextPins(= selection 镜像,"选中即上下文"), ctxTurn, touched };setPlayMode(v) 切换运行/编辑模式(联动 animPlaying,emit 'play-mode-changed');assignOid() 给对象发稳定 id(userData.oid);markTouched(obj) 记录对象被工具创建/修改的轮次(大场景"工作集"预取用)
  events.js                 事件总线 on/emit。核心事件:hierarchy-changed / selection-changed / transform-changed / anim-toggled / play-mode-changed / context-changed / focus-object(层级定位闪烁)/ agent-request(检查器对象级 AI 指令)/ agent-say
  loop.js                   渲染循环(动画驱动 + 面板 billboard/重绘 + labs update + locomotion/XR 交互 update + 学生化身 WASD 驱动)与 WebXR 会话;面板 billboard 的朝向目标:编辑模式=编辑相机,运行模式(PC)=学生相机(学生真实所见),XR=头显;renderStudentPiP() 学生相机画中画(选中学生视角或运行可走动课时,scissor 在视口右下角渲染学生眼中画面;渲染前隐藏全部编辑器 UI——gizmo/选择框/网格/editorOnly 对象/导览路线,画面严格=学生所见;相机 FOV 60° 不随代表物缩放——类 Unity Camera Preview)
  collision.js              轻量玩家碰撞(XZ AABB + 高度感知):userData.solid 的对象(含祖先标记,solid=false 可豁免个别部件如楼梯扶手)生成带 minY/maxY 的碰撞盒(内容坐标系,XR 里 scene 变换不影响);拦挡判定相对玩家脚底高度 feetY(顶面 ≤ feetY+0.45 的是可踩台阶而非墙);groundHeightAt(x,z,feetY) 采样站立高度→楼梯逐级上下/二层地板行走;pointBlocked/segmentBlocked(瞬移不能隔墙传送)/resolveMove(贴墙滑动);build_room 的墙/地板与 build_stairs 的台阶自动 solid
  play-visibility.js        运行模式可见性规则:role≠content 的导览路线(add_path)在进入运行模式后对学生隐藏、退出恢复(rAF 推迟保证与 play-reset 快照顺序解耦);isRouteHiddenForStudent(o) 同时供 PiP 预览与导出复用
  room-ui-visibility.js     房间内 UI 面板可见性(用户指定规则,勿擅自移除):面板常伸出墙外被切一半 → 观看者(XR 头显>运行模式学生眼>编辑相机)在房间外时该房间内所有面板隐藏;在房间内时面板 depthTest 关+renderOrder 1000 顶层渲染永不被挡。房间识别=build_room 的 userData.roomBounds{w,d,h}(局部坐标盒测试,房间搬动/旋转照常);面板识别=userData.panelData;0.2s 节流,导出播放器同款(updateRoomUI)
  highlight.js              平台级交互反馈:setHover(obj)(悬停淡蓝自发光)/flash(obj)(activate 闪烁);PC hover 在 viewport.js pointermove 节流射线,XR hover 在 interaction.js 每帧控制器射线;dispatchInteraction 里 activate 成功统一 flash——AI/内容层不需要也不应该自己写 hover 代码
  interaction.js            ★ 设备无关语义交互层(类 Unity XRI):语义事件 activate/grab/drag/release;dispatchInteraction 统一分发(expAction 状态机 + customClick + onGrab 等);PC Interactor 在 viewport.js,XR Interactor(控制器射线+扳机/grip)在此
  locomotion.js             学生移动运行时:mode static|teleport|smooth、allowedRadius、turnMode snap|smooth;XR 靠反向平移/旋转 scene(standAt 含 y——脚底高度,上楼=世界下沉),PC 方向键预览;瞬移/平滑移动均过 collision.js(落点在实心体内或传送线穿墙→无效/贴墙滑动;落点 y 跟随 groundHeightAt 可踩表面,瞬移可指向楼梯/二层地板);悬崖保护 LEDGE_DROP=0.6:平滑移动/WASD 不允许走出 >0.6 米跌落沿(楼梯 0.25/级不受影响,瞬移仍可跨越——二层围挡由 room-design 技能的防坠落铁律负责);studentContentPos() 学生的内容坐标(y=脚底高度);forceTeleport(x,z,y) 电梯按钮/剧情传送用;configureLocomotion() 是工具与 NL Inspector 的共用配置入口(配置变更 emit 'locomotion-changed',学生视角代表物据此切形态)
  play-reset.js             运行模式重置(类 Unity):进运行模式深度快照整个场景(全子树 transform/visible/子节点列表/材质色/userData 的 JSON 安全值深拷贝),停止时还原——动画位移/交互改的状态/spawn 的实例全部回滚;refreshPlaySnapshot() 供 orchestrator 在"运行中 Agent 改了场景"的轮末更新回滚基线
  utils.js                  toast/sleep/escapeHtml + 3D 积木(mat/mesh/bond/at)
  i18n.js                   中英双语:t(key,vars) 字典查询(UI 骨架)/ L(zh,en) 内联双语(模板/labs/组件描述等内容文案)/ applyDomI18n()(data-i18n / -title / -ph)/ setLang()(localStorage 持久化 + 整页刷新——大量文案在模块加载期求值,刷新最干净)。isEN() 供条件逻辑(如英文界面下英语对话面板不再显示中文翻译行、Agent 系统提示 LANG_RULE)
  projects.js               ★ 项目库(localStorage)+ 场景序列化/还原 + HTML 导入:ProjectData = {magic:'XR-EDU-SCENE',version,name,scene:toJSON(),cfg:{locomotion}}(与导出 HTML 内嵌数据块同格式);serializeScene()(stripUserData 剥函数/THREE 引用后 toJSON,panelSpec 镜像随场景走)/ loadSceneData()(ObjectLoader → builderCode 对象重跑构建代码整体重建 → 行为代码重编译 → rehydratePanel,live 面板降级静态快照,oid 计数器对齐)/ saveToProject/openProject/copyProject(深拷贝副本,名字追加 (1)(2)…取最小未占用序号)/deleteProject/renameProject / importHTMLFile(安全门:≤25MB / 魔数+版本 / 结构形状校验 / 用户确认含代码风险提示)
js/assets/
  builders.js               纯几何构建函数(buildSun/buildPendulum/...);MATH_SOLIDS 定义
  registry.js               ★ ASSET_SKILLS:AssetSkill 数据结构(见下);findAssetSkill/assetsByCategory/assetCatalogForLLM
js/panels/panel3d.js        Canvas 贴图 3D 面板:makePanel({title,lines,live,accent,width}) / attachLabel(obj,opts) / addFreePanel(opts,pos) / updatePanelContent(mesh,{title,lines})(原地改文字,行数变了自动重算画布与网格;检查器直编与 update_panel 工具共用;⚠ WebGL2 贴图尺寸不可变,画布高度变化时必须 dispose 旧 CanvasTexture/geometry 并重建,否则旧画面残留)。live 函数每 0.15s 重绘。panelKind(mesh)='live'|'static'(live 面板检查器只读,static 可直编);syncPanelSpec/rehydratePanel 维护 userData.panelSpec(JSON 安全镜像,供项目保存/HTML 导出还原面板;live 面板还原后降级为静态快照)
js/scene/manager.js         addAsset(id,pos,silent) / removeObject(userData.system 对象拒删)/ clearScene(keepSystem=true 默认保留系统对象;触发 onSceneClear 钩子)/ select(obj,additive)(additive=Shift 多选,选中集合镜像进 contextPins)/ removeFromSelection / deselect / findObject(oid或名称) / get/setMainColor / COLOR_WORDS / selBox(只统计可见网格的包围盒——隐藏部件不撑大选择框)+ 多选次级高亮框
js/scene/student-rig.js     学生视角代表物(🧍 系统对象,类 Unity 相机 Gizmo):胶囊(可走动课)+ 视锥棱台(视野示意),可像普通对象一样拖动/旋转;定点模式(static)下棱台几何中心移到对象原点(旋转中心=棱台正中)、rig 整体抬到眼高(userData.staticPose 标记,getStudentSpawn/getStudentEye 换算回站立点/眼点);PC 上编辑/运行模式都可见(运行模式=可驾驶的学生化身),真·VR 会话中隐藏;运行模式点击穿透靠 hitTopObject/xrHit 过滤 editorOnly(Alt+点击仍可选中);userData.editorOnly 导出时剔除;进 VR / 导出播放器按它的位置与朝向出生(scene.rotation.y=−yaw,position=−R·spawn − y);ensureStudentRig/getStudentSpawn(含脚底高度 y)/getStudentEye(PiP 相机与运行模式面板朝向用)/setStudentView(look_at 自动算 yaw)/teleportRig(电梯传送 PC 侧);updateRigDrive(dt) 运行模式 PC 试玩(WASD 移动+←→转向,过碰撞,脚底高度随 groundHeightAt 上下楼梯,停止运行由 play-reset 复位);随 locomotion-changed 切换 胶囊+视锥/仅视锥 形态
js/scene/guides.js          引导图元构建器:buildArrow(from→to,curveHeight 拱弧)/ buildPath(路径点平滑曲线,solid|dashed|dots + 方向小箭头 + 起终点标记 + closed);add_arrow/add_path 工具的几何后端(路线的运行时隐藏见 core/play-visibility.js)
js/scene/rooms.js           房间壳构建器 buildRoom({width,depth,height,doorWall,windows,ceiling},默认 10×8):地板+四墙(门洞/窗带)+可选天花板与顶灯;强制有门(非法 doorWall 回退 s,窄墙自动收窄门洞——房间绝不封闭);地板底面抬 0.02 防与全局地面 z-fighting;userData.roomBounds 存 {w,d,h}(房间内 UI 可见性判定用);墙/地板/天花板 userData.solid=true(碰撞+可踩;天花板兼作上层楼板);buildStairs({rise,run,width,rails,landing}):直跑实心楼梯(每级 ≤0.25 米,顶部缓步平台+两侧实心护栏,平台顶面=rise 与二层地板差一步;扶手 solid=false 豁免);build_room/build_stairs 工具的几何后端
js/labs/
  chem-oxygen.js            制氧实验:chemLab 状态机(check→load→heat→collect→choose→[takeout]→verify→done/fail)、buildOxygenLab(v2)、handleChemAction、chemLabUpdate(每帧)。v2=修正版(取瓶翻转)
  english-cafe.js           英语点餐:engLab 状态机(talk/listen/think/done)、麦克风音量触发(mic)、buildEnglishCafe、engLabUpdate
  scenarios.js              SCENARIOS:预置场景模板 {id,name,match正则,steps,reply,run}。离线模式靠 match,LLM 模式作为 build_template 工具
js/ui/
  library.js                左栏资源库渲染(拖拽 dataTransfer 'asset-id' / 双击)+ 三 Tab 切换(项目/资源库/层级)
  projects.js               左栏「📁 项目」Tab UI:项目卡片即按钮(描边风格,hover 变色,当前项目蓝色高亮;点卡片=打开,小按钮=复制副本/重命名/删除)+ HTML 导入入口;「➕ 新建项目」从空场景开始(clearScene 保留学生视角);顶栏「💾 保存」也在此接管(saveCurrent:有当前项目直接存,没有引导创建)
  hierarchy.js              ★ 场景层级 + 自然语言组件 Inspector:getObjectComponents(obj) 从 userData 派生组件卡(触发器卡带 ▶ 手动预览按钮 onPlay);getVirtualObjects() 定义虚拟对象(相机/灯光/时钟/XR 会话管理器含 locomotion 组件卡/实验控制器);行点击=选中(Shift 多选,选中即上下文,已无 📌 按钮);导出 animDesc/ACTION_DESC(检查器复用);监听 'focus-object' 切页+选中+滚动+闪烁定位对象
  viewport.js               PC Interactor + 运行/编辑双模式(类 Unity Play):▶ 按钮切 playMode,默认编辑模式(全静态,点击一律=选中,Shift+点击=多选);运行模式下单击=dispatchInteraction('activate')、hover 可交互对象=highlight.js 发光+手型光标、按住拖动带 onGrab 的对象=grab/drag/release(Alt+点击仍强制选中;editorOnly 对象点击穿透)。多选联动变换(类 Unity):gizmo 挂主选中对象,objectChange 时把增量同步到其余选中对象(平移=同位移;旋转=绕主对象转位置+姿态;缩放=以主对象为中心等比)。拖放落点、工具栏(W/E/R/F/Del;运行模式 WASD 让位给学生化身驾驶)、运行提示条 #play-hint(可走动课显示 WASD 说明)、浮动检查器(仅单选显示;基础属性 + 📝面板文字直编区(打字即重绘,live 面板只给提示)+ 📖用途/🔁动画/🖱交互与联动三个只读描述区——联动区扫描行为代码里的 getObjectByName 生成可点击对象芯片(双向:→读取/控制、←被引用),点击 emit 'focus-object' 定位层级——+ 对象级 AI 指令输入框,emit 'agent-request';"自转"勾选框走 selfSpin 非破坏语义)
  chat.js                   聊天 UI:消息/工具卡/typing/流式消息句柄(startStreamMsg)/思考区块(startThinkingBlock:流式推理摘要,可折叠)/计划确认卡(showPlanConfirm)/模式栏/模型选择/上下文芯片(= 当前选中集合,✕=取消选中)/快捷 chips;监听 'agent-request'(检查器对象级指令:对象因选中已在上下文,直接 runTurn)与 'agent-task'(系统级自动任务,如切语言后的整场景翻译)
js/agent/
  llm.js                    MODELS(claude-sonnet-5/claude-opus-4-8/claude-fable-5;deepThinker 标记恒开思考的模型)、EFFORTS(auto/low/medium/high 思考深度档位)、loadApiKeys()(fetch api-keys.txt,KEY=VALUE)、hasLLM()、callClaude({model,system,messages,tools,onText,onThinking,effort,maxTokens})——带 anthropic-dangerous-direct-browser-access 头;传 onText 则走 SSE 流式(parseSSE 重组 content,含 tool_use 的 input_json_delta 拼装 + thinking 块的 signature 保留 + usage 捕获);传 onThinking 则实时回传模型流式吐出的推理摘要(thinking_delta,并自动 +1024 maxTokens;display 为 omitted 时内容为空则不渲染);⚠ 本 API 不接受 output_config.thinking_display 字段(传了会 400),深度只能用 output_config.effort;返回 { content, stop_reason, usage }
  logger.js                 结构化日志:logEvent(type,data) 带时间戳 POST 到 /__log(server.py 落盘 logs/*.jsonl);端点不可用自动降级内存缓冲(__xrExportLog() 导出);summarize/summarizeToolInput 防代码刷爆日志
  context.js                ★ LLMR 式场景序列化 + 分层上下文:sceneToJSON()(对象+实验状态+studentLocomotion)、objectToJSON(obj,detailed)、pinnedContextBlock()(当前选中对象的高细节块——"选中即上下文",Put-That-There 一脉的多模态指代)、buildContextMessage(userText)。对象数 ≤ FULL_JSON_MAX(20)发全量 JSON;超过进"大场景模式"= sceneSummary() 分类分组索引 + searchObjects() 纯 JS 相关性预取(选中/工作集/中文双字 n-gram 命中,top-8 附全参数但剥行为代码)+ 提示模型用 find_objects/get_object_detail 拉细节
  tools/                    ★ Agent 工具库(按职能分组,index.js 聚合):build-tools(add_asset/create_custom_object(AI 写 Three.js 代码现场造对象;工具说明含颗粒度铁律与 say latch 要求)/set_behavior(update/click + 语义事件 grab/drag/release 行为代码;改行为必须同步更新 description——它是大场景检索索引)/build_template/clear_scene)、edit-tools(update_object/remove_object/select_object)、panel-tools(attach_label/add_panel/update_panel(原地改面板文字,live 面板拒改)/add_quiz_panel(可点击作答的选择题面板,builderCode 模式生成,答对后 userData.quiz.done=true 可作解锁条件))、query-tools(get_scene(大场景自动降级为摘要)/find_objects(关键词+空间检索)/get_object_detail)、env-tools(set_environment/configure_locomotion/set_student_view(设学生出生点与朝向,look_at 自动算 yaw))、space-tools(add_arrow/add_path(role≠content 运行/导出中对学生隐藏)/build_room(y>0 建二层)/build_stairs——确定性几何图元:箭头/路线·轨迹/房间壳/楼梯,不让模型手写这些代码;构建器在 js/scene/guides.js 与 rooms.js)。每个 {name,label(聊天卡双语标签,就地共存),description,input_schema,exec};改场景的 exec 里调 markTouched;index.js 出 toolDefsForAPI()/execTool()/toolCallLabel()
  sandbox.js                AI 代码沙盒:工具箱 T(THREE/mat/mesh/bond/group/attachLabel/makePanel/toast/say;say/toast 带 5s 同文去重节流防刷屏;玩家感知助手 playerPos()(y=脚底高度)/distToPlayer(obj)/overlaps(a,b,margin)——近接触发/投放判定的钥匙;teleportStudent(x,z,y) 电梯/剧情传送(XR=平移世界,PC 运行=移动胶囊);setSolid(obj,on) 运行时改碰撞(密室开门);notify(text,{at,title,accent,duration}) 世界内临时提示面板(自动消失,VR 学生可见)——全部导出播放器同款)+ runBuilderCode(必须 return Object3D)/compileUpdate/compileClick/compileHandler(grab/drag/release,(obj,detail) 签名)(new Function 隔离,仅原型级安全,升级见 TODO)
  skills/                   AGENT_SKILLS 技能库(一技能一模块,⚠ 注册表写法+零依赖:(globalThis.XR_AGENT_SKILLS??=[]).push({...}),无 import/export——同一份文件应用侧被 index.js import、可视化页在 file:// 下当普通 <script> 加载):{id,name,description,prompt}(scene-organization/object-creation/custom-modeling/experiment-logic/animation/ui-panel/pedagogy/validation/interaction-design/locomotion/xr-design/view-navigation(出生点·最佳观察角·导览路线)/room-design(教室·密室·餐厅等室内体验));description 是 Planner 的路由规则,选中后 skillPrompts(ids) 注入 Executor(渐进暴露);manifest.js 是可视化页用的文件清单(与 index.js import 顺序一致)
  agent-map.js              工作流有向图(nodes/edges,含每节点技能/工具引用)+ 工具目录;可视化页数据源(JSON 字面量包一层 globalThis 赋值以便 file:// 加载),⚠ 文案字段一律 {zh,en} 双语对象;改 agent/tools 后需手动同步(规约见 js/agent/README.md)
  agent-viewer*.html        可视化三页(纯本地,直接双击打开;右上角 EN/中 切换语言,localStorage 持久化):agent-viewer.html 工作流 SVG 图(左键拖拽平移,点节点看详情)/ -skills.html 技能库(加载 skills/ 注册表脚本自动同步,英文取技能的 nameEn/descriptionEn/promptEn)/ -tools.html 工具库(读 agent-map.js);共用 agent-viewer.css/-common.js
  orchestrator.js           ★ 编排器:agent{mode,model,effort,busy,history};runTurn(text,ui) 主入口(每轮 state.ctxTurn++;上下文锁定:buildContextMessage 只在轮初构建一次,Planner/Ask/Executor 全程复用同一份——老师中途切 playMode/换选中不会让 Agent 的初始上下文漂移)。LLM 路径:runPlanner(JSON:{intent,complexity,skills,plan};stop_reason=max_tokens 时预算×2 重试一次)→ chat→runAsk / simple→runExecutor / complex或Plan模式→ui.showPlanConfirm→runExecutor(工具循环,最多20轮;截断时给老师可读提示)。callBudget(stage,complexity) 按 effort 档位+模型算各阶段 {effort,maxTokens}(auto=预设组合:planner low、executor/ask medium、deepThinker 执行放 high 且预算×1.5、simple 任务执行降档提速);llmCall() 包装计时+logEvent(usage/stop_reason);cotGuidance() 对 deepThinker 撤掉提示词 CoT 脚手架。Prompt caching:cachedSystem(stable,variable) 把 system 稳定块标 cache_control(连带 tools 一起缓存),executor 技能提示放变化块;setMsgCacheBreakpoint() 在工具循环内把消息断点滑到最新一条(第2轮起 history+上下文+工具结果全命中缓存读)。离线路径 runOffline(关键词规则)
```

★ = 扩展时最常改的文件。

## 关键数据结构

**AssetSkill**(registry.js):
```js
{ id, name, icon, category,
  description,   // 自然语言:这是什么(人和 LLM 共用)
  prompt,        // 提示词组件:何时用/教学上怎么用(注入 LLM)
  tags: [],      // 搜索关键词
  code: { module, symbol },   // 代码位置(未来社区分发用)
  size: { footprint: [w,h,d], tris },
  build: () => THREE.Object3D }
```

**场景对象约定**(全部存 obj.userData):
- `oid` 稳定 id(Agent 用它引用对象);`assetId` 来源资源;`displayName`/`icon`
- `anim` 动画 `{type: spin|orbit|swing|float|bounce|ramp, speed, radius?, cx?, cz?, amplitude?, base?, selfSpin?}`;停用时移到 `savedAnim`。selfSpin:orbit 自带自转、置 false 单独关;其他类型置 true 叠加自转——检查器"自转"勾选框只动这一个字段,**绝不整体替换 anim**(非破坏原则:UI 单项控件只改自己那一项逻辑)
- `expAction` 学生可点击的实验动作(tube/lamp/duct/bottle/splint/npc);停用时移到 `savedExpAction`
- `customUpdate(dt,t,obj)` AI 写的每帧行为(loop.js 执行,连续报错 ~1s 自动停用);`customClick(obj)` AI 写的点击交互(= activate 语义事件的旧别名;interaction.js 分发,优先级低于 expAction、高于选中);停用时移到 `savedCustomUpdate/savedCustomClick`
- 语义交互事件(设备无关,interaction.js 分发,PC/XR Interactor 自动映射):`onActivate(obj,detail)`(点击/扳机)、`onGrab/onDrag/onRelease(obj,detail)`(PC 按住拖动 / XR grip);detail.point 是世界坐标
- `custom` 标记代码生成的对象;`behaviorDesc` 给老师看的行为描述(NL Inspector 显示);`builderCode/updateCode/clickCode/grabCode/dragCode/releaseCode` 原始代码(📌 pin 后进入上下文,供模型自查/改写)
- `compDesc` 老师在 NL Inspector 里写的自定义组件描述
- `panelData` 面板 canvas 数据(含 live 函数,不可序列化);`panelSpec` 其 JSON 安全镜像(随场景序列化,载入后 rehydrate);`isBillboard` 面板朝向相机

## 常见扩展任务的做法

- **加新资源**:builders.js 写构建函数 → registry.js 注册 AssetSkill(description/prompt 认真写,LLM 靠它选型)。资源库 UI 与 add_asset 工具自动生效
- **加新场景模板**:scenarios.js 增加 SCENARIOS 项(match 正则勿与现有冲突,run 里先 clearScene)。离线关键词与 build_template 自动生效
- **加新 Agent 工具**:在 js/agent/tools/ 对应分组模块的数组里增加 {name,label(L() 双语),description,input_schema,exec}。无需改 index.js 与 orchestrator;需同步 agent-map.js 工具目录(见 js/agent/README.md)
- **加新 Agent 技能**:js/agent/skills/ 建同名模块(注册表写法:globalThis.XR_AGENT_SKILLS push,零依赖无 import/export;字段含中文 name/description/prompt + 英文 nameEn/descriptionEn/promptEn,缺英文查看器英文版会回退中文)→ index.js 加 import → manifest.js 加文件名;Planner 自动可选,技能库页自动同步
- **加新 LLM 厂商**:llm.js MODELS 加条目(provider 字段),callClaude 里按 provider 分发;api-keys.txt 加对应 KEY
- **加新虚拟对象/组件卡**:hierarchy.js getVirtualObjects() 里 push;组件 {id,icon,title,desc,toggled?,onToggle?,onEdit?}(onEdit 返回 true 表示已解析应用)

## 注意事项 / 坑

- 模块间禁止循环 import 业务函数;跨模块通知一律走 events.js(如 labs 想在聊天区发言 → emit('agent-say', html))
- 场景对象只能挂在 sceneRoot 直接子级(层级/射线选择按此假设);特效层(chemLab.fx)挂 scene 不进层级
- clearScene 会触发 onSceneClear 钩子;新 lab 必须注册钩子清理自己的状态与特效
- 面板文字是 Canvas 绘制,改内容后必须 drawPanel(pd) 或使用 live 函数
- attachLabel 会按父对象 scale 反向缩放,先 scale 再 attachLabel
- 中文正则匹配注意单字误伤(历史 bug:「摆」字导致几何课堂误入单摆场景)
- 模型思考(adaptive thinking):Fable 5 / Mythos 5 恒开、且**思考 token 计入 max_tokens**——max_tokens 给太小会被思考吃光,导致"无文本无工具调用"或 JSON 被截断(历史 bug:Fable 报"Planner 未返回 JSON"/只回"完成。")。对策:max_tokens 给足(规划≥3072、执行≥8192),规划用 effort:'low';禁止对这些模型发 thinking:{type:'enabled'|'disabled'}(会 400),深度只能用 output_config.effort。流式回传时 thinking 块要连 signature 原样带回
- Planner JSON 解析走 extractJSON(剥代码围栏→直接 parse→花括号配对扫描);解析失败不硬崩,退化成 complex 兜底计划
- api-keys.txt 在 .gitignore 中;不要把密钥写进任何被提交的文件
- 修改后无需构建,刷新浏览器即可;但必须经 http 伺服(ES modules);排查 AI 行为问题优先用 python server.py 跑,翻 logs/*.jsonl(llm_call 事件里有 usage 与 stop_reason,"完成。/空输出"先看是不是 max_tokens 截断)
- AI 生成的 customUpdate 里条件触发 T.say/T.toast 必须 latch(边沿触发一次);沙盒虽有 5s 同文节流兜底,但根治靠提示词(experiment-logic 技能)
- 交互一律走语义事件(interaction.js),别在对象代码里绑鼠标/手柄;交互只在**运行模式**(playMode,▶ 按钮)分发——编辑模式下点击一律=选中,层级组件卡的 ▶ 预览按钮不受模式限制;进 XR 会话自动切运行模式;AI 可用 set_environment {play_mode} 切换
- hover 发光/点击闪烁是平台级反馈(highlight.js),AI/内容代码不要再写自己的 hover 逻辑;"结果反馈"(交互后的几何/面板变化、toast)仍由内容代码负责
- 房间内 UI 面板的显隐是平台级规则(room-ui-visibility.js:观看者在房间外→隐藏该房间面板,在房间内→面板顶层渲染):用户明确要求的行为,除非用户明确要求否则不要移除;内容代码不要自己写面板遮挡逻辑
- 挡学生走动的实体(墙/栅栏)标 `userData.solid = true`(祖先标记对子树生效,`solid = false` 可豁免个别部件如楼梯扶手);拦挡判定相对玩家脚底高度——顶面 ≤ 脚底+0.45m 的实心体是"可踩台阶"(groundHeightAt 采样,楼梯/二层地板由此可走),更高的才是墙;编辑器与导出播放器都生效;运行时改 solid 用 T.setSolid(触发碰撞盒重建)
- 大场景(对象数 > context.js 的 FULL_JSON_MAX)上下文自动切换为"摘要索引+预取"模式:behaviorDesc 是检索索引,任何改行为的工具调用必须同步更新 description,否则后续轮次会检索错对象;加新的改场景工具时记得在 exec 里调 markTouched(obj)
- Prompt caching 依赖前缀稳定:BASE_SYSTEM/工具定义/资源目录属于缓存前缀,改动它们会使所有缓存失效(功能不受影响,只是当轮多花缓存写费用);system 的变化内容(技能提示等)只能追加在稳定块之后
- 对象颗粒度:一个对象=一个逻辑实体;系统类场景拆多对象+控制器对象持共享状态(scene-organization/experiment-logic 技能有正反例)
- **所有用户可见文案必须双语**:静态 DOM 用 data-i18n(+ i18n.js DICT 加键),JS 里 UI 骨架文案用 t()、内容型文案(模板/labs/描述/toast)用 L(zh,en)。L/t 在模块加载期求值即可(切换语言=整页刷新);LLM-facing 文本(工具 description/技能 prompt/上下文序列化)保持中文不碍事——系统提示 LANG_RULE 已按界面语言控制模型的回复与生成内容语言
- userData 里凡是函数/THREE 对象/canvas 都是不可序列化的:保存/导出前 stripUserData 剥离,需要随场景走的状态要另存 JSON 安全镜像(参考 panelData→panelSpec 模式)

## 路线图

见 TODO.md(TTS/STT、XR 交互控制对象、可点击编辑的 UI 面板、自定义技能、用户系统与社区、多 Agent 协作、用量追踪)。
