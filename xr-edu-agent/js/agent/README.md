# js/agent — 智能体目录说明与维护规约

本目录是整个产品的"大脑"。**任何人(包括 AI 助手)改动 agent / skills / tools 后,必须按本文最后一节同步更新可视化数据**,否则 `agent-viewer*.html` 展示的架构就是过期的。

## 目录结构

```
js/agent/
├── orchestrator.js           编排器:runTurn 主入口,Planner → 确认 → Executor 工具循环
├── context.js                上下文构建:场景 JSON / 大场景摘要索引 + 相关性预取 / 选中即上下文(高细节块)
├── llm.js                    Anthropic API 封装:流式、thinking、prompt caching、计价
├── sandbox.js                AI 生成代码的沙盒:T 工具箱(玩家感知 playerPos/distToPlayer/overlaps、传送 teleportStudent、碰撞开关 setSolid、世界内临时提示 notify)、编译 update/click/grab 处理器
├── logger.js                 结构化日志
├── skills/                   🧠 技能库(一个技能一个模块,注册表写法)
│   ├── index.js              应用侧入口:import 各技能 → AGENT_SKILLS / skillCatalogForLLM / skillPrompts
│   ├── manifest.js           文件清单(仅技能库页面用,与 index.js 的 import 保持一致)
│   └── *.js                  每个技能 (globalThis.XR_AGENT_SKILLS ??= []).push({id,name,description,prompt})
├── tools/                    🔧 工具库(按职能分组)
│   ├── index.js              聚合:TOOLS / toolDefsForAPI / execTool / toolCallLabel
│   ├── shared.js             ok/fail 返回助手
│   ├── build-tools.js        创建类:add_asset / create_custom_object / set_behavior / build_template / clear_scene
│   ├── edit-tools.js         修改类:update_object / remove_object / select_object
│   ├── panel-tools.js        面板类:attach_label / add_panel / update_panel / add_quiz_panel
│   ├── query-tools.js        查询类:get_scene / find_objects / get_object_detail
│   ├── env-tools.js          环境类:set_environment / configure_locomotion / set_student_view
│   └── space-tools.js        空间引导类:add_arrow / add_path / build_room / build_stairs(确定性几何图元,不让模型手写)
├── agent-map.js              📊 工作流有向图 + 工具目录(可视化数据源,需手动维护;JSON 字面量包一层赋值)
├── agent-viewer.html         🧭 可视化·工作流页(SVG 有向图,左键拖拽平移,点节点看详情)
├── agent-viewer-skills.html  🧭 可视化·技能库页(直接加载 skills/ 的注册表脚本,自动同步)
├── agent-viewer-tools.html   🧭 可视化·工具库页(读 agent-map.js 的 tools 目录)
├── agent-viewer.css / agent-viewer-common.js   三页共用样式与脚本
└── README.md                 本文件
```

**打开可视化:纯本地,直接双击任意 `agent-viewer*.html` 即可**(不需要启动服务器)。为此所有数据源都是"普通脚本"而非 JSON/ES Module:`file://` 下浏览器禁止 fetch 和模块导入,所以 `agent-map.js` 与 `skills/*.js` 都写成往 `globalThis` 赋值/注册的形式,同一份文件应用端照常 import。

**可视化是中英双语的**:页面右上角 EN/中 按钮切换(localStorage `xr_viewer_lang` 持久化,刷新生效)。数据侧的双语约定:
- `agent-map.js` 里所有文案字段(节点 title/desc/uses、边 label、工具 group/summary)一律写成 `{"zh":"…","en":"…"}` 对象;
- 技能文件里英文版写在 `nameEn / descriptionEn / promptEn` 字段(与中文就地共存;运行时发给 LLM 的仍是中文 `prompt`,英文字段目前仅供查看器阅读);
- 查看器对缺失的英文字段回退中文,但**不要依赖回退**——见下方规约。

## 技能(skills/)的设计取舍

参考了 Anthropic《Lessons from building Claude Code: How we use skills》的方法论,但按本项目实际做了判断,**没有照搬**:

**采纳的:**
- **Description 即路由规则**:Planner 只看 `skillCatalogForLLM()`(每技能一行 id + description)来挑技能,description 要写"什么情况下该加载它",不是功能清单。写完自测:只给模型看这一行,它能不能在对的任务里想起加载它。
- **渐进暴露(Context Engineering)**:目录(~几百 token)人人可见 → 完整 prompt 只有被 Planner 选中才注入 Executor 系统提示的"变化块"。这正是文章说的 SKILL.md 导航页思想,只是载体是 JS 模块。
- **只写 Gotchas,不写常识**:prompt 里写的是模型不知道的项目经验(say 必须加 latch、swing 的 ω=√(9.8/L)、颗粒度铁律、VR 段数 ≤32),不解释什么是 Three.js。
- **"尽量用脚本"**:在本架构里"脚本"就是 **tools/**——可复用的确定性能力沉淀在工具的 `exec` 里(参数解析、oid 分配、markTouched、事件广播),技能 prompt 只负责经验与判断。Instructions(skills)与 Scripts(tools)各司其职。

**不采纳的(及原因):**
- **每技能一个文件夹(SKILL.md + references/scripts/examples/assets)**:那套结构服务于"能读文件系统的 agent"(Claude Code)。我们的技能是浏览器里的提示词片段,没有运行时文件扫描,也无构建步骤;单技能 prompt 都控制在几百 token,还没到需要二级 references 的体量。**何时升级**:当某个技能的 prompt 超过 ~1500 token、或需要携带示例代码库时,再给该技能建子目录并让 prompt 里引导模型用工具按需拉取。
- **长篇分步 Instructions**:文章也反对。我们的分步流程本来就在 Planner 的 plan 里动态生成,不写死在技能里。

**技能模块的硬性约束:注册表写法 + 零依赖**——只写 `(globalThis.XR_AGENT_SKILLS ??= []).push({...})`,**不写任何 import/export**。这样同一份文件既能被 `index.js` 当 ES Module import(应用运行时),又能被 `agent-viewer-skills.html` 在 `file://` 下当普通 `<script>` 加载(可视化),单一数据源、零同步成本。

**技能字段(中文为运行时正文,英文为查看器镜像,缺一不可)**:`{ id, name, description, prompt, nameEn, descriptionEn, promptEn }`。

## 工具(tools/)的规约

每个工具对象:`{ name, label(input), description, input_schema, exec(input) }`
- `description` 发给 LLM:写清**何时用 + 怎么用 + 坑**(如 update_panel 拒改 live 面板、set_behavior 必须同步 description);
- `exec` 本地执行:**改场景的必须调 `markTouched(obj)`**(维护大场景工作集预取),并 emit 对应事件刷 UI;返回 `ok(msg)` / `fail(msg)`,fail 的 msg 要能指导模型修正重试;
- `label(input)` 是聊天工具卡上的双语标签(用 `L()`),与工具定义就地共存;
- 新增工具:放进对应分组模块的数组即可,`index.js` 和 orchestrator 无需改动。

## ⚠ 更新可视化的规约(每次改动后必做)

`agent-viewer*.html` 三个页面本身通常**不用改**(它们只是渲染器);要维护的是数据:

| 你改了什么 | 需要同步什么 |
|---|---|
| 新增/删除 **技能**(skills/*.js) | ① `skills/index.js` 加/删 import;② `skills/manifest.js` 加/删文件名(两处顺序保持一致);③ **新技能必须同时写英文字段 `nameEn/descriptionEn/promptEn`**(查看器英文版靠它)。技能内容本身零同步——技能库页直接加载这些文件。另检查 `agent-map.js` 中 executor 节点 `uses.skills` 的"常见组合"举例是否还成立 |
| 修改技能内容(description/prompt) | **中英文字段一起改**(prompt 变了 promptEn 同步翻译),其余零同步,技能库页自动生效 |
| 新增/删除 **工具**(tools/*.js) | 更新 `agent-map.js` 的 `tools` 数组(name/group/file/summary,**group 和 summary 必须是 {zh,en} 双语对象**)+ `tool-exec` 节点 `uses.tools` 的分组清单 + executor 节点里的工具总数 |
| 改 **工作流**(orchestrator/context/llm 的路由、新增阶段) | 更新 `agent-map.js` 的 `workflow.nodes` / `workflow.edges`:节点含 id/icon/col(布局列)/group(图例色)/title/desc/uses/file,**title/desc/uses 各条目均为 {zh,en} 双语对象**;边含 from/to/label(条件,{zh,en} 或空串)。新增分组色需在 agent-viewer.html 的 `GROUP_COLOR` 与中英两套 `GROUP_NAME` 里各补一行(唯一需要动页面的情形) |
| 任何改动 | 顺手更新 `agent-map.js` 的 `meta.updated` 日期;双击打开三个页面,**中英两种语言各验证一遍**(右上角 EN/中 切换) |

校验清单:① 图上没有悬空边(from/to 都存在);② 每个节点的 desc 与代码实际行为一致;③ 工具目录数量 = `TOOLS.length`;④ 技能库页能列出全部技能(证明技能模块仍是零依赖注册表写法,且 manifest 与文件一致);⑤ 切到英文后没有残留中文(所有 zh/en 字段成对、技能三个 *En 字段齐全)。
