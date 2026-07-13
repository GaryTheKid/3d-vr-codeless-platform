// 技能:XR 体验(VR 视角下的尺度与舒适度)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'xr-design',
  name: 'XR 体验',
  description: 'VR 视角下的尺度与舒适度',
  prompt: `【XR 体验技能】
- 学生身高视角约 1.6m,核心内容放 y 0.8~2.5 之间最舒适
- 面板文字在 VR 中要够大:width ≥2 的面板放在距学生 3~5m 处
- 避免让学生仰头超过 30°:高处对象(y>4)只放次要信息`,
  nameEn: 'XR Experience',
  descriptionEn: 'Scale and comfort from the VR point of view',
  promptEn: `[XR Experience]
- Student eye height is ≈1.6m; core content is most comfortable at y 0.8~2.5
- Panel text must be big in VR: width ≥2 panels placed 3~5m from the student
- Never make students look up more than 30°: high objects (y>4) carry secondary info only`,
});
