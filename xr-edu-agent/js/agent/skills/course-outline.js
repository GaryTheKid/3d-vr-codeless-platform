// 技能:课程大纲(Learning Outline 结构与选型)
// ⚠ 注册表写法 + 零依赖,不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'course-outline',
  name: '课程大纲',
  description: '从材料建课、改章→节树、选型 reading/h5/quiz/vr、绑 covers 时加载',
  prompt: `【课程大纲技能】
- 先 outline_get / course_kg_digest 摸清现状;从材料新建课用 course_tag_figures → course_build_outline_from_doc(会覆盖大纲,先征得老师同意)
- 顿悟点优先:排大纲前先自问「把这份材料教到学生换任何题面都能满分,需要装进 2–5 个什么 aha 洞见?」(例:抛体运动 → ①运动可分解为完全独立的 x/y 分运动 ②曲线轨迹只是分运动的合成 ③单方向 a-v-x-t 关系必须先扎实)。每个 aha 必须有小节负责"安装",首选 vr/h5 让学生动手建构出来(建构主义),reading 只做铺垫
- 手工改树:outline_update_* / outline_add_*;测验节放章末;每节目的写清「学什么」
- 选型:空间/系统/过程可操作 → vr;概念梳理 → reading;条件/匹配/过程 2D 交互 → h5;掌握检查 → quiz(aha 题必须换情境考)
- covers[] 必须对齐 KG 节点,禁止教未出现在图谱的内容
- 弱模型优先调确定性工具,不要手写整棵大纲 JSON`,
  nameEn: 'Course Outline',
  descriptionEn: 'Load when building/editing Learning Outline (chapters→sections, types, covers) from material',
  promptEn: `[Course Outline]
- Start with outline_get / course_kg_digest; new course from material: course_tag_figures → course_build_outline_from_doc (overwrites outline — confirm with teacher first)
- AHA-FIRST: before laying out chapters ask "which 2–5 transferable insights must students GET so they solve ANY re-skinned problem?" (e.g. projectile motion → ① motion decomposes into fully independent x/y components ② the curve is just those components recombined ③ single-axis a-v-x-t relations must be solid first). Every aha needs an installer section — prefer vr/h5 where students CONSTRUCT it hands-on (constructionism); reading only prepares
- Hand edits: outline_update_* / outline_add_*; put quiz at chapter end; purpose = what students learn
- Type pick: spatial/system/process → vr; concept prose → reading; 2D condition/match/process → h5; mastery check → quiz (aha items must re-skin the context)
- covers[] must map to KG nodes; never teach off-graph content
- Weaker models: prefer these tools over free-form outline JSON`,
});
