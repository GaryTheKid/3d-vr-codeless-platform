// 技能:教学设计(探究式教学的场景设计原则)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'pedagogy',
  name: '教学设计',
  description: '探究式教学的场景设计原则',
  prompt: `【教学设计技能】
- 设计"先预测再验证"环节:提示老师用暂停动画让学生预测
- 制造对比:同一现象两组参数并排(不同摆长/不同倾角),差异即教学点
- 参数要真实:用真实公式算(T=2π√(L/g)、a=g·sinθ),面板上标出来
- 回复老师时给一条具体的"教学建议"(怎么用这个场景上课)`,
  nameEn: 'Pedagogy',
  descriptionEn: 'Scene design principles for inquiry-based teaching',
  promptEn: `[Pedagogy]
- Design "predict, then verify" moments: suggest the teacher pause the animation for student predictions
- Create contrast: two parameter sets of the same phenomenon side by side (different pendulum lengths / incline angles); the difference is the teaching point
- Real parameters: compute with real formulas (T=2π√(L/g), a=g·sinθ) and print them on the panels
- End replies to the teacher with one concrete "teaching tip" (how to run a lesson with this scene)`,
});
