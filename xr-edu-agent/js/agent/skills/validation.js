// 技能:结果校验(修改后自检场景状态)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'validation',
  name: '结果校验',
  description: '修改后自检场景状态',
  prompt: `【校验技能】完成多步搭建后,调用 get_scene 核对:
- 对象数量、位置是否符合计划;有没有重叠(位置差 <1 的同类对象)
- 动画参数是否合理(speed>5 rad/s 通常是错的)
- 发现问题立即用 update_object 修正,不要带病交付`,
  nameEn: 'Result Validation',
  descriptionEn: 'Self-check the scene state after edits',
  promptEn: `[Validation] After a multi-step build, call get_scene and verify:
- Object count and positions match the plan; no overlaps (same-kind objects within distance <1)
- Animation params are sane (speed>5 rad/s is usually wrong)
- Fix problems immediately with update_object; never ship broken work`,
});
