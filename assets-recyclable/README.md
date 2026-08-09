# assets-recyclable — 可复用的经验、灵感与金矿

> 这个文件夹**不是本项目的技术文档**（技术文档在 `../general/`）。
> 这里沉淀的是构建 XR EduAgent 过程中挖出的**可迁移资产**：
> 设计洞见、踩坑经验、可直接复用的 prompt/skill 模式——
> 目标是：下次再造一个教育类 learning agent 时，直接从这里起步，不用重付学费。

## 文件索引

| 文件 | 内容 | 什么时候读 |
|------|------|-----------|
| [golden-features.md](./golden-features.md) | 全项目挖出的独有金点子：Aha Keys、KG 硬锚点、3D 生成稳定化、NL Inspector、确定性工具 vs LLM 代码…… | 新项目立项 / 设计评审时 |
| [aha-keys-and-knowledge-graph.md](./aha-keys-and-knowledge-graph.md) | Aha Keys + Knowledge Graph 完整可移植手册（schema、prompt、多学科示例、校验清单）——不看源码即可在任何管线复刻 | 要在新管线里植入「顿悟点优先」时 |
| [pain-log.md](./pain-log.md) | 按时间线的真实踩坑史：症状 → 根因 → 修法 → 可迁移教训 | 新项目遇到似曾相识的 bug 时 |
| [average-vs-excellent-teacher.md](./average-vs-excellent-teacher.md) | 「PPT 机器」vs 优秀教师的差距分析，以及产品如何把这个差距写进代码 | 思考「学习产品到底在教什么」时 |
| [recyclable-skills-and-prompts.md](./recyclable-skills-and-prompts.md) | 可直接抄走的 prompt 规则 / skill 写法 / 工程纪律清单 | 写新 agent 的 system prompt 时 |

## 一句话总结这个项目教会我们什么

> **让 LLM 生成「好看的学习内容」很容易；让它生成「有教学目的的学习体验」需要把教育学写成数据契约（aha keys / KG / 安装规则），把稳定性写成工程契约（确定性工具 / 隔离快照 / 签名去重 / 预算治理）。两者都不能靠模型自觉。**
