// 技能:H5 交互节
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'course-h5',
  name: 'H5 交互节',
  description: '设计或生成 h5 节 2D 交互(过程/条件/匹配等)时加载',
  prompt: `【H5 交互节技能】
- 优先 course_fill_section 生成完整交互;或 h5_set_content 写入 prompt/html/followUp
- 必须有真交互(过程步骤、滑条→可视化、配对反馈、预测-揭晓);禁止静态截图+「点亮标签」
- 每个 H5 配短答 followUp 检验学习;语言跟 UI
- HTML 自包含(内联 CSS/JS);高度由平台自适应,勿写死 iframe 滚动`,
  nameEn: 'H5 Interactive Section',
  descriptionEn: 'Load when designing/generating h5 2D interactives (process/condition/matching/…)',
  promptEn: `[H5 Interactive]
- Prefer course_fill_section; or h5_set_content for prompt/html/followUp
- Real interaction required (steps, slider→viz, matching feedback, predict-reveal); ban static flyer + label toggles
- Always add a short-answer followUp; match UI language
- Self-contained HTML (inline CSS/JS); platform auto-sizes height — do not force inner scroll`,
});
