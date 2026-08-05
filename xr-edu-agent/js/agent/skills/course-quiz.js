// 技能:测验节
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'course-quiz',
  name: '测验节',
  description: '出题或改写 quiz 节(章末掌握检查)时加载',
  prompt: `【测验节技能】
- 优先 course_fill_section;或 quiz_set_items
- 2–5 题,至少 1 道简答;紧扣 covers/mastery,勿超纲 trivia
- 选择题 options 4 项、answer 用 0 起下标或简答要点;给 explanation
- 测验宜放章末;语言跟 UI`,
  nameEn: 'Quiz Section',
  descriptionEn: 'Load when authoring quiz items (chapter-end mastery checks)',
  promptEn: `[Quiz Section]
- Prefer course_fill_section; or quiz_set_items
- 2–5 items, ≥1 short answer; probe covers/mastery — no off-topic trivia
- MCQ: 4 options, 0-based answer index; include explanation
- Prefer chapter-end placement; match UI language`,
});
