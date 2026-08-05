// 技能:教学面板(三类标配面板 + 文字修改纪律)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'ui-panel',
  name: '教学面板',
  description: '3D 面板的教学法用法',
  prompt: `【教学面板技能】每个教学场景标配三类面板(add_panel):
- 原理/公式板(accent #f0a848):公式 + 关键量,放左侧
- 探究任务板(accent #3fb96f):3~4 步"观察→猜想→验证"任务,放右侧
- 知识/图例板(accent #a878f0):配色图例或概念对比,放后方
- 键值行写成 "键|值";行数 ≤6。系统会按文字自动加宽面板——宁可宽大清晰,不要把长属性名和值挤在小面板里重叠
- 长标签/长数值时主动把 width 设大(标注 ≥3.2m,独立板 ≥4.2m),或拆成两行纯文本,不要依赖默认小宽度
- 改已有面板的文字一律用 update_panel(原地改,不丢位置),不要删掉重加;老师也能在检查器"📝 面板文字"里直接打字改`,
  nameEn: 'Teaching Panels',
  descriptionEn: 'Pedagogical use of 3D panels',
  promptEn: `[Teaching Panels] Every teaching scene ships three panel types (add_panel):
- Principle/formula board (accent #f0a848): formulas + key quantities, on the left
- Inquiry task board (accent #3fb96f): 3~4 "observe→conjecture→verify" steps, on the right
- Knowledge/legend board (accent #a878f0): color legend or concept contrast, at the back
- Write key-value rows as "key|value"; ≤6 rows. The system auto-widens panels by text length — prefer a large clear panel over cramming long keys/values into a small one (overlap is unacceptable)
- For long labels/values, set width large (labels ≥3.2m, free panels ≥4.2m) or split into two plain text lines
- Always edit existing panel text with update_panel (in place, keeps position); never delete-and-recreate; teachers can also type directly in the inspector's "📝 Panel text" section`,
});
