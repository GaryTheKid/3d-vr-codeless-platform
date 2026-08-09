# Recyclable Skills & Prompts — 可直接抄走的规则库

> 从本项目 skills / tools / system prompts / 管线代码中提炼的**可移植规则**。
> 按用途分组；每条给出「规则原文（可直接进 prompt）+ 为什么」。
> 配套阅读：[golden-features.md](./golden-features.md)（设计层）、[pain-log.md](./pain-log.md)（每条规则背后的血泪）。

---

## 一、课程规划类（Planner / 规划 LLM）

### 1.1 STEP-0 顿悟点优先

```text
FIRST distill the "aha keys", THEN build a Knowledge Graph, THEN a Learning
Outline that walks that graph and installs every aha key.
Ask: "If students solve ANY re-skinned problem of this type for full marks,
what 2–5 deep insights must they GET?" Transferable keys, not facts.
```
**为什么**：不前置这一步，LLM 必然退化为按页序改写教材（PPT 机器）。

### 1.2 安装规则（Install Rule）

```text
AHA INSTALL RULE: every ahaKey MUST appear in installsAha[] of ≥1 section.
PRIMARY installer should be an interactive section (vr/h5/sim).
reading may prepare/reinforce; quiz lists the ahas it verifies.
```
**为什么**：没有安装契约，顿悟点就停在规划文档里，不会变成体验。配套程序侧兜底：孤儿 aha 自动挂到共享节点最多的交互节。

### 1.3 Source Lock（防串课）

```text
SOURCE LOCK: jobId: <id> / filename: <name>.
Build EXCLUSIVELY from THIS document. Do NOT reuse aha keys / nodes /
outline ideas from any prior material or chat. The worked example in the
system prompt is ONLY a shape example.
```
**为什么**：换材料后模型仍会复用上一份的课程结构（真实发生）；shape example 若不声明，会被当成内容照抄。

### 1.4 图 grounding

```text
FIGURE GROUNDING: pedagogical figures (especially relevance=core) often
encode the densest knowledge. You MUST extract nodes from the
visualSummary of core figures — do not rely on prose alone.
```

### 1.5 空间性检验（模态选择）

```text
Modality pick: vr = concept has intrinsic 3D/spatial dynamics — and aha
keys whose buildIdea is spatial; h5 = 2D parameter/diagram/matching
interaction helps; reading = prose/definitions; quiz = mastery check.
VR is the COSTLIEST tool — never use it for content a flat image teaches equally well.
```

---

## 二、内容生成类（分节填充）

### 2.1 Construct 规则（交互节）

```text
The CENTERPIECE must let the student CONSTRUCT the insight via manipulation
(use buildIdea as the seed). Pattern: predict → act → observe an outcome
that contradicts the misconception → articulate. Do NOT merely display the
conclusion. Decorations never replace the aha centerpiece.
```

### 2.2 Transfer 规则（测验）

```text
For EACH aha key, include ≥1 item in a NEW surface context never used in
the material (change the cover story, keep the structure). A student who
owns the key solves it; one who memorized the example fails.
Distractors should embody the listed misconception.
```

### 2.3 Peer 差异化（多节同管线）

```text
This course has multiple 3D sections. You only teach THIS section's
covers[]. Protagonist objects, geometry, layout, and interactions must all
differ from other sections. Objects listed in [Peer 3D scenes] are
FORBIDDEN to rebuild — never copy the same demo or arrangement, even if
conceptually related.
```
**为什么**：各节独立生成时必然撞车；prompt 差异化 + 程序侧内容签名去重要**同时**上。

### 2.4 序列化安全（凡是产物要过 JSON 的场合）

```text
SNAPSHOT-SAFE GEOMETRY: only use constructor-parameter geometries that
survive JSON serialization (Box/Sphere/Cylinder/Cone/Torus/Plane...).
Never create geometry via callback/function arguments; never store
functions, DOM nodes, or engine objects in persisted fields.
```
**为什么**：一个不可序列化对象会带崩整个场景加载（Opus 空场景事故）。

---

## 三、3D/代码生成类（AI 写代码的场合）

### 3.1 粒度硬规则

```text
One create_custom_object call builds exactly ONE logical entity (a hydrogen
tank, an atom, one trophic level). Systems = multiple calls + a controller
object holding shared state. Never build the whole system as one object.
```

### 3.2 Controller 模式

```text
Cross-object shared state lives on ONE controller object's userData;
entity objects read it via getObjectByName('controllerName'). No per-object
state silos.
```

### 3.3 锁存（latch）规则

```text
Conditional say/toast/notify inside per-frame update code MUST latch:
trigger once on edge, set a flag, clear the flag on reset. Never fire every frame.
```
**为什么**：每帧触发的提示会刷屏；运行时同文 5s 去重只是兜底，根治靠这条。

### 3.4 描述即索引

```text
When set_behavior/update changes what an object does, you MUST update its
description in the same call — descriptions are the retrieval index for
large scenes; stale descriptions make later turns find the wrong object.
```

### 3.5 平台/内容职责分界

```text
Interactions go ONLY through semantic events (activate/grab/drag/release).
Never bind mouse/controller input in object code. Hover glow and click
flash are platform feedback — write only RESULT feedback in content code.
```

---

## 四、Agent 编排类

### 4.1 Skill 的正确形状（Anthropic 方法论落地）

- `description` = **给 Planner 的路由规则**（什么时候选我），不是给人看的简介;
- `prompt` = 被选中后注入 Executor 的**领域最佳实践**：显式步骤 + 好/坏例子 + 硬规则 + Gotchas；
- 渐进披露：只注入被选中的 skill（2-3 个），不全量灌;
- **硬规则同时写进工具 description**（skill 没被选中也生效——双保险）;
- 给弱模型的 skill 要有**显式工具调用顺序**（「先 A 再 B 再 C」），强模型可以只给原则。

### 4.2 结构性写操作的权限门禁

```text
Structural tools (add/remove chapter/section) require
requested_by_teacher=true. If the teacher asked to modify content, edit IN
PLACE — never restructure, never add blank placeholder sections.
```
**为什么**：agent 好心「顺手加节」会破坏课程完整性门禁（绿点/保存），用户视角是灾难。

### 4.3 Thinking 预算表（这一代 Claude 系模型）

| 阶段 | effort | max_tokens 底线 | 备注 |
|------|--------|----------------|------|
| Planner（出 JSON） | low | ≥3072 | thinking 计入 max_tokens，预算小会静默截断 |
| Executor（工具循环） | medium（简单任务降 low） | ≥8192 | deepThinker 模型 ×1.5 |
| 截断处理 | — | — | `stop_reason==='max_tokens'` → planner 预算×2 重试一次；executor 给用户可读提示 |
| 深思考模型 | 只用 output_config.effort | — | 不发 `thinking:{type:...}`（400）；剥掉 prompt 里的 CoT 脚手架 |

### 4.4 JSON 输出的防御性解析

```
strip ```json fences → JSON.parse → 失败则大括号配对扫描提取首个完整对象
→ 还失败且深度>0 则轻量修复（补引号补括号）→ 都失败走 fallback 而非崩溃
```

### 4.5 Prompt caching 纪律

- 稳定块（base system + 工具定义 + 资产目录）打 cache_control，可变内容只允许**追加在稳定块之后**;
- 工具循环内缓存断点滑到最新消息，第 2 轮起全部 cache read;
- 改稳定块 = 全缓存失效 → 基础 prompt 改动攒批上。

### 4.6 上下文锁

一轮的上下文在 turn 开始构建一次、整轮复用；执行中途的用户操作（切模式/改选中）不得漂移 agent 初始上下文——工具结果保持实时即可。

---

## 五、持久化与状态类

### 5.1 JSON-safe 镜像模式

任何不可序列化状态（canvas、live 函数、引擎对象）都配一个 JSON-safe 镜像字段（如 `panelData → panelSpec`），**存镜像，载入重建本体**。判断「本体是否可用」必须结构校验（canvas 是真 HTMLCanvas？），**truthy 检查会被序列化僵尸骗过**。

### 5.2 双轨还原

产物既存序列化快照（快），又存生成代码（`builderCode`，稳）；加载时快照失败 → 重跑代码重建 → 再失败丢弃单个对象并告知，**永不整体失败**。

### 5.3 配额预算式序列化

面向 localStorage（5MB）设计格式：能重建的不入库（builderCode 桩替代整棵子树、spec 替代纹理）；写入失败 → 驱逐最老条目重试 → 再失败才报错。

### 5.4 隔离与所有权

多个生成任务写同一共享结构（live 场景）时：任务期间硬 pin 绑定 + 每个产物打所有者印章（`vrSectionOwner`）+ 完成时过滤异主对象 + 空产物拒绝覆盖非空存档。

---

## 六、验证与运维类

- **眼见为实**：图文匹配、场景内容，必须用视觉手段验证，元数据（alt/文件名/数量）都会骗人。
- **只改目标验证**：批量修改脚本跑完必须 diff 证明「被点名的单元变了，其余 byte 级不变」。
- **线上版本确认**：用户报「又坏了」→ 先 diff 线上文件 vs 本地（cache-bust），再查部署状态（Pages deploy 可能失败/延迟/平台故障），最后才查代码。
- **fetch 缓存策略显式化**：`force-cache` 会把用户钉死在第一次缓存的资源上；对会更新的静态资产用 `no-cache`（ETag 304 依然便宜）。
- **结构化日志先行**：每次 LLM 调用记 `{stage, model, effort, maxTokens, duration, usage, stop_reason}`；每次工具调用记输入摘要（代码只记长度）。没有这个，一切「时好时坏」不可调。
