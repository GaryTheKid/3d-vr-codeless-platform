// 技能:对象创建(资源选型顺序)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'object-creation',
  name: '对象创建',
  description: '资源选型:何时用资源库、何时写代码现场造',
  prompt: `【对象创建技能】选型顺序:
1. 需求与预置模板高度吻合 → build_template(再微调)
2. 资源库有合适资源 → add_asset(改 color/scale 可扮演不同角色,如 earth 换色当水星)
3. 资源库没有、或预制件不够精致 → create_custom_object 写代码造,不要用简陋几何将就
- 添加后给关键对象 attach_label 挂名称标签,老师和学生都靠标签认对象`,
  nameEn: 'Object Creation',
  descriptionEn: 'Asset sourcing: when to use the library vs. write code on the spot',
  promptEn: `[Object Creation] Sourcing order:
1. Request closely matches a preset template → build_template (then fine-tune)
2. The asset library has a fit → add_asset (color/scale changes can recast roles, e.g. recolored earth as Mercury)
3. Nothing fits, or prefabs aren't refined enough → create_custom_object and write code; never settle for crude primitives
- After adding, attach_label the key objects; teachers and students identify objects by their labels`,
});
