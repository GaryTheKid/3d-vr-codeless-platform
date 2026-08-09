# Golden Features — 全项目挖出的独有金点子

> 这些不是「功能列表」，而是**踩过坑之后才长出来的设计**。每条都写清：它解决什么、为什么普通做法不行、可迁移的核心。
> 出处：真实开发聊天史（2026-07 → 2026-08）+ git 提交史 + 源码。

---

## 一、教学设计层（让内容「有教学目的」）

### 1. Aha Keys：先蒸馏顿悟点，再做一切

**解决什么**：LLM 直接从教材生成课程 → 得到「知识点堆砌 + 好看外壳」，学生换个题面就不会。

**设计**：规划 LLM 的 STEP-0 强制先回答「学生要能解任何换皮题，必须装进脑子的 2–5 个洞见是什么？」每个 aha 带 `insight / misconception / whyKey / buildIdea`，然后**倒逼**知识图谱和大纲围绕它展开。

**可迁移核心**：aha 是**数据契约**不是一句 prompt 修辞——它有 schema、有校验（每个 aha 必须有安装节）、有下游消费协议（阅读铺垫 / 交互建构 / 测验换皮验证）。完整手册见 [aha-keys-and-knowledge-graph.md](./aha-keys-and-knowledge-graph.md)。

### 2. Knowledge Graph 硬锚点：卡在「材料 → 大纲」中间

**解决什么**：材料直接变大纲时，LLM 会漏子内容、顺序错乱、后面章节使用没教过的概念。

**设计**：`材料 md → KG（nodes+edges+ahaKeys）→ 大纲（每节 covers[] 绑节点）→ 分节填充`。图谱是硬数据：`covers[]` 里的 id 必须存在于 nodes、边是先修顺序、测验只能考图谱内的点（"never use a concept that was never taught"）。

**可迁移核心**：在任何「长材料 → 结构化课程」的管线里，**中间插一个可校验的图数据结构**，把「模型自觉对齐」变成「程序校验对齐」。

### 3. Scaffold → Construct → Transfer 三段式 + 空间性检验

**解决什么**：模态选择随缘（什么都做成 3D，或什么都是文本）。

**设计**：每个 aha 的旅程 = 阅读铺垫（点破误解）→ 交互建构（buildIdea：predict → act → observe → articulate，禁止直接展示结论）→ 测验迁移（换故事外壳，干扰项体现 misconception）。**VR 是最贵的工具**：只有概念本身有内在空间结构（分子几何、地形、轨道）才用 3D；2D 参数交互给 H5；纯语言给阅读。

**可迁移核心**：模态跟着 `buildIdea` 的空间性走，不跟着「炫酷程度」走。

### 4. 教学图 grounding：图比正文密

**解决什么**：教材里的表格图（如 VSEPR 几何总表）往往承载最密的知识，纯文本抽取会漏掉。

**设计**：图先过滤（logo/装饰启发式 + LLM 打 relevance）→ 核心图生成 `visualSummary` → 规划 prompt 硬性要求「必须从 core 图的 visualSummary 抽节点」。

---

## 二、Agent 工程层（让弱模型也稳定）

### 5. 「Cursor 差距」的答案：AI 代码沙盒 + 确定性工具双轨

**背景**（2026-07-06 的关键发现）：同一个模型，在 Cursor 里能徒手写出精致的高锰酸钾实验场景，在我们产品里只能摆几个多面体。**差距不在模型，在通道**——产品只给了 `add_asset` 这类粗粒度工具，模型没有「写代码发明新物体」的通道。

**设计**：
- **创造性走代码**：`create_custom_object` 让模型写 Three.js 代码（沙盒 `T` 工具箱 + `new Function` 隔离），`builderCode` 存进 `userData`，存档/导出时**重跑 builder 代码**复活整个对象（双轨还原）。
- **确定性走参数化工具**：房间、楼梯、箭头、路径这类「有几何正确性要求」的东西绝不让模型手写——`build_room / build_stairs / add_path` 是确定性 builder，门永远有、台阶永远 ≤0.25m、栏杆永远防坠落。

**可迁移核心**：**给模型开代码通道解决创造力上限，用确定性工具锁住正确性下限。**分界线 = 「错了会不会伤害用户体验的结构性正确性」。

### 6. Skills 作为路由 + 渐进式披露（Anthropic 方法论落地版）

**设计**：每个 skill = `{id, description(给 Planner 路由用), prompt(给 Executor 注入)}`；Planner 按 description 选 2-3 个 skill，只有被选中的 prompt 才进 Executor 上下文（progressive disclosure，省 token 且不互相干扰）。skill 内容 = 领域最佳实践 + 好/坏例子 + 硬规则（如实验逻辑的 controller 模式、say() 必须锁存）。

**为什么对弱模型重要**：强模型自带判断，弱模型靠 skill 里的显式步骤（「先 outline_get 摸清现状 → 再 course_tag_figures → 再 course_build_outline_from_doc」）也能走对路。**工具描述本身也是 prompt**——把硬规则写进 tool description，即使 skill 没被选中也生效（双保险）。

### 7. Thinking 预算治理（新一代模型最大的坑）

**发现**：Fable/Sonnet-5 这代模型 adaptive thinking 永远开启，且 **thinking tokens 计入 max_tokens**。预算太小 → thinking 吃光预算 → 正文/工具调用被静默截断 → 表现为「Planner 未返回 JSON」「只回一句 Done.」——完全没有报错。

**设计**：
- `parseSSE` 必须捕获 `usage` + `stop_reason`（否则截断不可见）；
- planner 用 `effort:'low'` + 大 max_tokens（≥3072），executor ≥8192；
- `stop_reason==='max_tokens'` → planner 自动预算×2 重试，executor 给用户可读提示；
- 深思考模型（deepThinker）剥掉 prompt 里的 CoT 脚手架（别跟内置 thinking 打架）；
- 按「模型 × 任务复杂度」计算每阶段 `{effort, maxTokens}`（简单任务自动降档提速）。

**可迁移核心**：**任何 agent 产品第一优先级是可观测性**——usage/stop_reason/工具调用日志（`logs/*.jsonl`），没有它们，上面所有问题都表现为「模型今天怪怪的」。

### 8. 大场景上下文三层法（agentic RAG 的正确打开方式）

**设计**：对象数 ≤20 → 全量 JSON；超过 → ① 常驻摘要（每对象一行索引）+ ② 模型按需拉取（`find_objects`/`get_object_detail` 工具，pull over push）+ ③ 零成本预取（纯 JS 打分：选中+5 / 最近被工具碰过+4 / n-gram 命中，top-8 附全参数）。**description 就是检索索引**：改行为必须同步改 description，否则后续轮次检索错对象（经典 RAG 死法：索引过期）。

**否决的方案**：前置一个「检索 Agent」每轮语义搜索再注入——空间性/全局性请求（“把它们对齐”）召不回、每轮多一次 LLM 调用、检索者不知道执行者要什么。

### 9. Prompt caching 纪律

**设计**：system 拆成稳定块（BASE_SYSTEM + 工具定义 + 资产目录，打 `cache_control`）+ 可变块（本轮 skill prompts 只能追加在稳定块后）；工具循环里缓存断点滑动到最新消息 → 第 2 轮起历史+上下文+工具结果全部 cache read（0.1× 价格）。**改稳定块 = 全缓存失效**，所以基础 prompt 的改动要攒着一起上。

### 10. 上下文锁（context lock）

**设计**：`buildContextMessage` 在 turn 开始构建一次、整轮复用——老师在执行中途切 play 模式/改选中，不会让 Agent 的上下文漂移（工具结果仍然实时，模型看得到自己的修改）。

---

## 三、3D 生成与修改稳定化（最难啃的骨头）

> 详细症状史见 [pain-log.md](./pain-log.md) 2026-08-06 部分。这里只沉淀最终形态。

### 11. 每节独立场景快照 + 所有权印章

**解决什么**：多个 3D 节共享一个 live 场景 → 第二节生成时把第一节洗掉 / 空快照覆盖好快照 / A 节对象漏进 B 节。

**设计**：每个 VR 节在 `section.vr.scene` 存自己的 Three.js JSON 快照；填充期间 live 场景硬 pin 到该节（`fillingVrSectionId`）；每个生成对象打 `userData.vrSectionOwner = sectionId`，完成时过滤掉异主对象；空场景保存有守卫（`liveGraphClearedByCode` 区分「模型故意清空」和「意外洗掉」）。

### 12. 内容签名去重 + 关键重建重试

**解决什么**：一门课 3 个 3D 节，2 个长得一模一样（A A B），显示名不同但内容相同。

**设计**：场景签名用**内容**算（builderCode 结构 + 面板文本指纹），不用显示名；生成完对比 peer 签名，撞了 → 带着「CRITICAL REBUILD：以下对象禁止重建」的指令重试；prompt 里注入 peer 场景清单（differentiation 规则：主角、几何、布局、交互都必须不同）。

### 13. 快照瘦身 + JSON-safe 镜像模式

**解决什么**：localStorage 5MB 配额爆掉（`QuotaExceededError`）；canvas 纹理、live 函数序列化后变成「僵尸对象」。

**设计**：
- `slimSnapshot`：有 `builderCode` 的对象只存代码桩（加载时重跑 builder），面板材质/纹理不入库（加载时从 `panelSpec` 重画）；
- **镜像模式**：任何不可序列化状态（canvas 面板 `panelData`、live 函数）都配一个 JSON-safe 镜像（`panelSpec`），存镜像、载入时重建本体——这是贯穿全项目的模式；
- 配额兜底：写入失败 → 驱逐最老项目重试。

### 14. 逐对象恢复 + builderCode 兜底

**解决什么**：一个对象的非法几何（如模型写了 `ExtrudeGeometry` 带函数参数）让整个 `ObjectLoader.parse` 抛异常 → 整节 3D 白屏。

**设计**：解析失败时降级为逐对象解析，坏对象若有 `builderCode` 就重跑代码重建，实在不行丢弃该对象并告知用户，**绝不让一个坏对象带崩整节**。同时在生成 prompt 里加 SNAPSHOT-SAFE GEOMETRY 规则（禁用不可序列化的几何写法）——修复 + 预防双管齐下。

### 15. 对象粒度治理：一个对象 = 一个逻辑实体

**解决什么**：模型把整个生态系统（地形+四营养级+能量管道+粒子动画）塞进一个 `create_custom_object` → 改一根管道 = 重写整个黑盒（分钟级 + 高风险），层级面板里不可拆解。

**设计**：粒度硬规则写进 skill + 工具文档（好例子：一个氢气罐/一个原子/一个生态位）；跨对象共享状态走 **controller 模式**（先建 controller 对象持有共享 userData，实体对象通过 `getObjectByName` 读它），禁止各对象私攒状态。

---

## 四、人机交互层（老师的控制感）

### 16. 自然语言 Inspector（研究级创新点）

点击 3D 对象 → 看到**用自然语言写的组件卡片**（这是什么 / 动画 / 交互与引用链），老师能看懂也能改。2026-07 文献检索确认：「3D 场景点选对象 → 自然语言抽象其功能 → 可读可改」这个组合**没有先例**（最接近的 LLMR/DreamCodeVR 都是代码层面）。配套原则：
- **selection is context**：选中即上下文（Put-That-There 谱系，有 CHI/UIST 文献支持做实验设计）；
- **非破坏性 UI 控件**：一个控件只改自己的语义（「自转」勾选框只碰 `anim.selfSpin`，不许整体替换 anim——历史 bug：勾一下自转，行星公转没了）。

### 17. 平台职责 vs 内容职责的铁律

hover 发光/点击闪烁 = 平台反馈（highlight.js 统一做）；内容代码只写「结果反馈」。设备差异（PC 鼠标 vs VR 手柄）收敛在平台运行时（语义事件 activate/grab/drag/release），AI 只写意图级逻辑。**AI/内容层永远不准自己绑鼠标事件、自己写 hover、自己发明面板遮挡规则。**

---

## 五、流程与验证层

### 18. Source Lock：防跨材料串课

规划 prompt 的 user 消息绑定 `jobId + filename` + 显式声明「system prompt 里的抛体例子只是形状示范」——否则换了 PDF，模型还在生成上一份材料的课（真实发生过）。管线开始时清 agent history，双保险。

### 19. 视觉验证：眼见为实

修「图文不匹配」时的教训：**图的 alt/文件名/提取顺序都会骗人，只有真的看图才可靠**。最终流程 = 逐张用视觉模型看图打标 → 对照 chunk 文本重新分配 → 缺图才用 gpt-image 生成。同理 3D 场景快照验证也不能只看对象数量。

### 20. 自文档化架构（agent-map + viewers）

`agent-map.js` 维护工作流 digraph + 工具目录，三个纯本地 HTML viewer 可视化 workflow/skills/tools；**改 agent 相关代码必须同步 map**（写进维护规则）。对快速演化的 agent 产品，这个「活文档」是新会话/新人对齐上下文最快的方式。
