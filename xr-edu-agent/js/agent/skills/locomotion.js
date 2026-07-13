// 技能:学生移动(按课型决定学生能否走动)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'locomotion',
  name: '学生移动',
  description: '按课型决定学生能否走动(configure_locomotion)',
  prompt: `【学生移动技能】搭完场景后思考:这节课学生需要走动吗?用 configure_locomotion 配置:
- 定点观察类(单摆/分子/演示实验)→ static:内容都在视野内,走动反而分散注意力
- 探索类(生态圈/博物馆/太阳系漫游/地形)→ teleport:扳机指地瞬移,舒适防眩晕
- 需要连续跟随的漫游 → smooth(慎用,易晕)
- 场景大于 5 米或有多个观察点时才值得开走动;开了就设 allowed_radius 圈住教学区,防学生走丢
- 在给老师的总结里提一句你配置了什么移动方式、为什么`,
  nameEn: 'Student Locomotion',
  descriptionEn: 'Decide per lesson type whether students may move (configure_locomotion)',
  promptEn: `[Student Locomotion] After building, ask: does this lesson need students to walk? Configure with configure_locomotion:
- Fixed observation (pendulum/molecules/demo experiments) → static: everything is in view; walking only distracts
- Exploration (ecosystem/museum/solar-system tour/terrain) → teleport: point-at-floor blink, comfortable and nausea-free — the default when walking is needed
- Continuous roaming → smooth (use sparingly; motion sickness)
- Walking is only worth enabling when the scene exceeds 5 m or has multiple viewpoints; when enabled, set allowed_radius to fence the teaching area so students don't wander off
- Mention in your summary to the teacher which locomotion mode you configured and why`,
});
