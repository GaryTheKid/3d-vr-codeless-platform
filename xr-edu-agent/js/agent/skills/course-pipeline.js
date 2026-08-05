// 技能:备课流水线(材料→KG→大纲→分节填充)
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'course-pipeline',
  name: '备课流水线',
  description: '老师要「据此备课 / 从 PDF 生成整课 / 批量填节」时加载',
  prompt: `【备课流水线技能】
标准顺序(确定性工具,弱模型也按此调):
1. course_tag_figures
2. course_build_outline_from_doc
3. outline_get 核对章节与 type
4. 对每个小节 course_fill_section(section_id)——可按节类型并行意图,但 VR 节各自独立场景快照,互不覆盖
- 聊天里「据此备课」按钮会跑完整流水线;对话中用上述工具逐步执行即可
- reading 有图密钥时会软性尝试 ≥1 张 gpt-image;失败不阻断节完成
- 不要 clear_scene 串改其它 VR 节;切换大纲节时平台自动换场景`,
  nameEn: 'Course Pipeline',
  descriptionEn: 'Load for “build from this PDF / generate whole course / batch-fill sections”',
  promptEn: `[Course Pipeline]
Canonical tool order (deterministic — weak models follow this):
1. course_tag_figures
2. course_build_outline_from_doc
3. outline_get to verify chapters/types
4. course_fill_section(section_id) per section — VR sections each own an isolated scene snapshot
- The “Build from this” button runs the full pipeline; in chat, call the tools step-by-step
- Reading soft-tries ≥1 gpt-image when keyed; image failure must not block the section
- Do not clear_scene across VR sections; outline switches restore each section’s graph`,
});
