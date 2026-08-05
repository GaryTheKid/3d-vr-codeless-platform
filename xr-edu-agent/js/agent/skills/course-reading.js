// 技能:阅读节填充
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'course-reading',
  name: '阅读节',
  description: '填充或改写 reading 节知识块、追问、教学插图时加载',
  prompt: `【阅读节技能】
- 优先 course_fill_section(section_id) 一键生成;或 reading_set_chunks 手写块
- 一块=一个知识点,短 HTML;每 1–2 块配 followUp(简答优先)
- 有 GPT API 时:填完后可用 course_enrich_reading_images;或 course_generate_image 补一张图(软性,不强制每块都有)
- 文案语言跟平台 UI;忠实上传材料,勿编造`,
  nameEn: 'Reading Section',
  descriptionEn: 'Load when filling/editing reading chunks, follow-ups, or pedagogy images',
  promptEn: `[Reading Section]
- Prefer course_fill_section(section_id); or reading_set_chunks for hand edits
- One chunk = one idea, short HTML; follow-up every 1–2 chunks (short answer preferred)
- If GPT API configured: course_enrich_reading_images after fill, or course_generate_image (soft — not every chunk)
- Match UI language; stay faithful to the uploaded material`,
});
