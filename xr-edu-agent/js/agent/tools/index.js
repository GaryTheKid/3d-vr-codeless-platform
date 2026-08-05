// ═══════════════════════════════════════════════════════════════
//  Agent 工具集聚合:LLM 通过 Anthropic tool-use 调用这些工具改场景
//  · 每个工具 {name, label(input), description, input_schema, exec(input)}
//    - name/description/input_schema 发给 LLM(description 写"何时用"+ 坑)
//    - exec 本地执行(改场景的必须调 markTouched,保住大场景工作集预取)
//    - label 聊天工具卡上的用户可读双语标签(与工具定义就地共存)
//  · 按职能分组:build / edit / panel / query / env / space / outline(学习大纲与非 VR 节内容)
//  · 新增工具:在对应分组模块加对象即可(此文件与 orchestrator 无需改动);
//    记得同步更新 agent-map.js 的工具目录与工作流节点引用
// ═══════════════════════════════════════════════════════════════
import buildTools from './build-tools.js';
import editTools from './edit-tools.js';
import panelTools from './panel-tools.js';
import queryTools from './query-tools.js';
import envTools from './env-tools.js';
import spaceTools from './space-tools.js';
import outlineTools from './outline-tools.js';
import coursePipelineTools from './course-pipeline-tools.js';

export const TOOLS = [
  ...buildTools, ...editTools, ...panelTools, ...queryTools,
  ...envTools, ...spaceTools, ...outlineTools, ...coursePipelineTools,
];

// Anthropic API 需要的工具定义(去掉 exec/label)
export function toolDefsForAPI() {
  return TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
}

export async function execTool(name, input) {
  const t = TOOLS.find(x => x.name === name);
  if (!t) return { ok: false, msg: `未知工具 ${name}` };
  try {
    const out = await Promise.resolve(t.exec(input || {}));
    return out;
  } catch (e) {
    return { ok: false, msg: `执行出错: ${e.message}` };
  }
}

// 工具调用的用户可读描述(显示在聊天工具卡片上)
export function toolCallLabel(name, input) {
  const t = TOOLS.find(x => x.name === name);
  try { return t?.label?.(input || {}) ?? name; }
  catch { return name; }
}
