// 技能:对话式改课(就地修改已生成的小节,不动课程结构)
// ⚠ 注册表写法 + 零依赖,不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'course-live-edit',
  name: '对话改课',
  description: '老师在聊天里说「改这一节 / 这段不好 / 3D 再加点东西 / 换个例子」时加载(改已有内容,不是建课)',
  prompt: `【对话改课技能】
- 默认动作是"就地改",不是"新建"。老师说改/重做/优化/补充,一律作用在他正在看的那一节
- 先 outline_get 确认 activeSectionId 与该节 type,再按 type 动手:
  · vr → 直接用 3D 场景工具改现有对象(edit_object / set_behavior / add_panel…);要整节重做才用 course_fill_section
  · reading → reading_set_chunks(注意是整体覆盖:先读回原 chunks,改完再整体写回,别丢内容)
  · h5 → h5_set_content;quiz → quiz_set_items(同样是覆盖语义)
- 禁止:为了放新内容而 outline_add_section / outline_add_chapter。空节会污染老师的大纲,而且新节会让 3D 工作区显示空场景
- 老师明确要求加节/加章时,才调 outline_add_*,并在 requested_by_teacher 填老师原话;加完立刻把内容填进去,不要留空壳
- 误加的空节用 outline_remove_section 清掉
- 3D 节改完不用手动保存快照,系统会自动写回该节;但不要在一次回复里同时改多个 vr 节(共享同一个视口)
- 改完用一句话说明"改了哪一节的什么",方便老师核对`,
  nameEn: 'Live Course Edit',
  descriptionEn: 'Load when the teacher asks to change/redo/extend an EXISTING section in chat (editing, not authoring a new course)',
  promptEn: `[Live Course Edit]
- Default action is EDIT IN PLACE, never "create new". Change / redo / improve / extend always applies to the section the teacher is looking at
- Call outline_get first to confirm activeSectionId and its type, then act by type:
  · vr → edit the existing objects with the 3D scene tools (edit_object / set_behavior / add_panel…); only use course_fill_section for a full rebuild of that section
  · reading → reading_set_chunks (it OVERWRITES: read the current chunks back, edit, write the whole list again — do not drop content)
  · h5 → h5_set_content; quiz → quiz_set_items (same overwrite semantics)
- Forbidden: calling outline_add_section / outline_add_chapter as a place to put a rewrite. Blank sections pollute the teacher's outline, and a new section makes the 3D workspace show an empty scene
- Only when the teacher explicitly asks for a new section/chapter: call outline_add_* with their words in requested_by_teacher, then fill it immediately — never leave a shell
- Clean up an accidental blank section with outline_remove_section
- 3D edits are snapshotted back into the section automatically; do not edit two vr sections in one reply (they share one viewport)
- Finish with one sentence naming which section changed and what changed`,
});
