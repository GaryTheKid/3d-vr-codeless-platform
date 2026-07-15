// ═══════════════════════════════════════════════════════════════
//  Agent 技能注册表(轻量版技能化执行)—— 一个技能一个模块
//  · 每个技能 = 一段领域提示词 {id, name, description, prompt}
//  · 渐进暴露:Planner 只看目录(id + description,即"路由规则"),
//    选中的技能才把完整 prompt 注入 Executor 的系统提示
//  · description 写"什么情况下该加载它",不是功能介绍;
//    prompt 写模型不知道的经验与坑(Gotchas),不写常识
//  · ⚠ 技能模块用"注册表写法"(往 globalThis.XR_AGENT_SKILLS push,零依赖、
//    无 import/export)——这样 agent-viewer-skills.html 双击(file://)也能把
//    同一份文件当普通 <script> 加载,单一数据源。本文件按顺序 import 触发注册
//  · 新增技能:建同名模块 → 这里加 import → manifest.js 加文件名 →
//    检查 agent-map.js…(见 js/agent/README.md 维护规约)
// ═══════════════════════════════════════════════════════════════
import './scene-organization.js';
import './object-creation.js';
import './custom-modeling.js';
import './experiment-logic.js';
import './animation.js';
import './ui-panel.js';
import './pedagogy.js';
import './validation.js';
import './interaction-design.js';
import './locomotion.js';
import './xr-design.js';
import './view-navigation.js';
import './room-design.js';
import './debugging.js';

export const AGENT_SKILLS = globalThis.XR_AGENT_SKILLS ?? [];

// Planner 用的技能目录(紧凑,description 即路由规则)
export function skillCatalogForLLM() {
  return AGENT_SKILLS.map(s => `- ${s.id}: ${s.description}`).join('\n');
}

// 按 id 取技能提示词(注入 Executor 系统提示的变化块)
export function skillPrompts(ids) {
  return AGENT_SKILLS
    .filter(s => ids.includes(s.id))
    .map(s => s.prompt)
    .join('\n\n');
}
