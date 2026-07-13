// 技能:动画配置(五种动画类型的物理正确用法)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'animation',
  name: '动画配置',
  description: '五种动画类型的物理正确用法',
  prompt: `【动画技能】anim 类型:
- spin{speed}: 自转,常用 0.3~0.8 rad/s
- orbit{cx,cz,radius,speed}: 公转,离中心越远 speed 应越小(开普勒直觉)
- swing{speed,amplitude}: 单摆,物理正确做法 speed=ω=√(9.8/L),L=2.1×scale
- float{speed}: 悬浮;bounce{speed}: 弹簧
- 移除动画传 anim:{"type":"none"}`,
  nameEn: 'Animation Setup',
  descriptionEn: 'Physically correct usage of the five animation types',
  promptEn: `[Animation] anim types:
- spin{speed}: self-rotation, typically 0.3~0.8 rad/s
- orbit{cx,cz,radius,speed}: revolution; farther from the center → lower speed (Kepler intuition)
- swing{speed,amplitude}: pendulum; the physically correct way is speed=ω=√(9.8/L), L=2.1×scale
- float{speed}: hover; bounce{speed}: spring
- Remove an animation by passing anim:{"type":"none"}`,
});
