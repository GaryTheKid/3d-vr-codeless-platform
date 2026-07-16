// ═══════════════════════════════════════════════════════════════
//  Agent 编排器:Ask / Plan / Agent 三模式(类 Cursor)
//
//  流程(接入 LLM 后):
//   用户消息 ─→ Planner(轻量调用:判复杂度 + 选技能 + 出计划)
//     ├─ Ask 模式 ──→ 只解释,不动场景(无工具)
//     ├─ 简单任务 ──→ Executor 工具循环直接执行
//     └─ 复杂任务/Plan 模式 ─→ 展示计划 → 老师确认 → Executor 分步执行
//
//  Executor = Claude 工具循环:每次 tool_use 由本地 tools.js 执行,
//  结果回传,直到模型 end_turn。
//
//  离线回退:未配置 API Key 时用关键词规则(原演示逻辑)。
// ═══════════════════════════════════════════════════════════════
import { state } from '../core/state.js';
import { sleep, toast } from '../core/utils.js';
import { hasLLM, callClaude, MODELS, BUDGETS, estimateCost } from './llm.js';
import { buildContextMessage } from './context.js';
import { toolDefsForAPI, execTool, toolCallLabel } from './tools/index.js';
import { skillCatalogForLLM, skillPrompts } from './skills/index.js';
import { assetCatalogForLLM } from '../assets/registry.js';
import { scenarioCatalogForLLM, SCENARIOS } from '../labs/scenarios.js';
import { setMainColor, COLOR_WORDS } from '../scene/manager.js';
import { emit, on } from '../core/events.js';
import { logEvent, summarize, summarizeToolInput } from './logger.js';
import { record as recordHistory, beginTentative, commitTentative } from '../core/history.js';
import { refreshPlaySnapshot } from '../core/play-reset.js';
import { L, isEN } from '../core/i18n.js';

export const agent = {
  mode: 'agent',            // 'ask' | 'plan' | 'agent'
  model: 'claude-sonnet-5',
  effort: 'auto',           // 'auto' | 'low' | 'medium' | 'high'(auto = 预设组合,类 Cursor)
  budget: 'auto',           // 'auto' | 'high' | 'max' 输出 token 预算(放大 max_tokens 防截断)
  busy: false,
  history: [],              // 跨轮对话记忆 [{role:'user'|'assistant', content:string}]
};

const MAX_TOOL_ITERATIONS = 20;   // 代码生成路径可能需要"写→报错→修"迭代,给足轮次
const HISTORY_KEEP = 12;

// 当前模型是否为"深思考"模型(如 Fable 5:恒开自适应思考)
function isDeepThinker() {
  return !!MODELS.find(m => m.id === agent.model)?.deepThinker;
}

// ── 流水线进度(report_progress 工具广播的最新阶段)──
// 用于打字指示器上方的灰字状态("阶段 2/5 · 语义本体"),让长思考不再是黑盒
let lastProgress = null;
on('agent-progress', p => { lastProgress = p; });
function progressLabel() {
  if (lastProgress?.title) {
    const no = lastProgress.total ? `${lastProgress.stage}/${lastProgress.total}` : `${lastProgress.stage}`;
    return L(`阶段 ${no} · ${lastProgress.title}`, `Stage ${no} · ${lastProgress.title}`);
  }
  return L('正在推演下一步工具调用…', 'Working out the next tool calls…');
}

// ── 各阶段思考深度与 token 预算 ──
// stage: 'planner' | 'executor' | 'ask';complexity: planner 判定的任务复杂度
// · effort='auto'(预设组合):规划只需吐 JSON → low 省钱;执行/答疑 → medium;
//   深思考模型(Fable)执行阶段放开到 high,把空间留给模型自己推理;
//   simple 任务(加个对象/改颜色)执行降档到 low/medium,直接砍掉大部分思考时间
// · 用户手动选低/中/高:所有阶段统一用该档(预算是用户自己的事)
// · 思考 token 计入 max_tokens,所以 effort 越高、模型思考越深,预算要跟着放大
function callBudget(stage, complexity = null) {
  const deep = isDeepThinker();
  let effort;
  if (agent.effort === 'auto') {
    if (stage === 'planner') effort = 'low';
    else if (stage === 'executor' && complexity === 'simple') effort = deep ? 'medium' : 'low';
    else effort = deep ? 'high' : 'medium';
  } else {
    effort = agent.effort;
  }
  // 基线调高(尤其 executor):思考 token 计入 max_tokens,复杂场景给不够就会被静默截断。
  // 调大上限不额外计费(只按实际生成付费),所以宁可给足。
  const base = { planner: 4096, ask: 4096, executor: 12288 }[stage];
  const mult = { low: 1, medium: 1.5, high: 2.5 }[effort] * (deep ? 1.5 : 1);
  const budgetMult = BUDGETS.find(b => b.id === agent.budget)?.mult ?? 1;
  return { effort, maxTokens: Math.round(base * mult * budgetMult) };
}

// 本轮(一次用户请求)累计的思考用时与花费,turn 结束后展示给老师
let turnStats = null;
let turnMutated = false;   // 本轮是否改动了场景(决定是否弹 Keep/撤销 卡)
function resetTurnStats() { turnStats = { calls: 0, ms: 0, inTok: 0, outTok: 0, cost: 0 }; turnMutated = false; }

// ── LLM 调用包装:计时 + 结构化日志(usage/stop_reason 是排查空输出的命门)+ 用量累计 ──
async function llmCall(stage, params) {
  const t0 = performance.now();
  try {
    const res = await callClaude(params);
    const ms = Math.round(performance.now() - t0);
    logEvent('llm_call', {
      stage, model: params.model, effort: params.effort, maxTokens: params.maxTokens,
      ms, stop_reason: res.stop_reason, usage: res.usage || null,
      blocks: res.content?.map(b => b.type),
    });
    if (turnStats) {
      const u = res.usage || {};
      turnStats.calls++;
      turnStats.ms += ms;
      turnStats.inTok += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      turnStats.outTok += u.output_tokens || 0;
      turnStats.cost += estimateCost(params.model, u);
    }
    return res;
  } catch (err) {
    logEvent('llm_error', { stage, model: params.model, ms: Math.round(performance.now() - t0), error: err.message });
    throw err;
  }
}

// 提示词侧的 CoT 引导:普通模型给"先推演再动手"的脚手架;
// 深思考模型自带充分内部推理,降低我们的引导权重,避免跟模型自己的思考打架
function cotGuidance() {
  if (isDeepThinker()) return '';
  return isEN()
    ? '\n- Before calling tools, silently plan: overall layout → object list → animation params → teaching panels'
    : '\n- 动手前先在心里推演一遍:整体布局 → 对象清单 → 动画参数 → 教学面板,想清楚再开始调用工具';
}

// ── Prompt caching ──
// Anthropic 缓存层级:tools → system → messages,断点标在哪、就缓存到哪。
// · system 稳定部分标断点 → 工具定义(很大,含资源目录)+ 基础提示词全部命中缓存(读价 0.1×)
// · 变化部分(本轮技能提示)放稳定块之后,不破坏前缀
function cachedSystem(stable, variable = '') {
  const blocks = [{ type: 'text', text: stable, cache_control: { type: 'ephemeral' } }];
  if (variable) blocks.push({ type: 'text', text: variable });
  return blocks;
}

// 工具循环内:把消息断点移到最新一条消息的末块(前缀=history+场景上下文+此前的工具结果,
// 循环第 2 轮起全部命中缓存;断点最多 4 个,故旧断点先清掉)
function setMsgCacheBreakpoint(messages) {
  for (const m of messages) {
    if (Array.isArray(m.content)) m.content.forEach(b => delete b.cache_control);
  }
  const last = messages[messages.length - 1];
  if (!Array.isArray(last.content)) last.content = [{ type: 'text', text: last.content }];
  last.content[last.content.length - 1].cache_control = { type: 'ephemeral' };
}

// ── 系统提示(整段随界面语言切换;语言切换会整页刷新,故在调用时求值)──
function langRule() {
  return isEN()
    ? 'LANGUAGE LOCK: Reply in English only. Name objects and write all panel / label / progress titles in English. Use <b>bold</b> for emphasis; no code or jargon in chat. In chat, refer to objects by display name (e.g. "Sun"), never by oid like o1 — oids are for tool calls only.'
    : '语言锁定:回复必须用中文。对象命名与面板/标注/进度标题也用中文。可以用 <b>加粗</b> 强调;聊天里不要出现代码或技术术语。提到对象时用显示名称(如「太阳」),绝不要用 o1/o2 —— oid 只用于工具调用。';
}

function baseSystem() {
  if (isEN()) {
    return `You are "XR EduAgent" — a VR lesson-building assistant for K-12 teachers with no coding background.
You work inside a Three.js / WebXR 3D editor.

Rules:
1. Decide the teaching intent (subject / grade / concept) first; you are building a lesson, not a pile of models.
2. Asset choice: if a preset template is a close match → build_template; if the library has a fit → add_asset; otherwise → create_custom_object and write Three.js code. Prefer quality over crude primitives.
3. Quality bar = the built-in oxygen-prep lab: refined models + step-by-step interaction + intentional failure branches + live data panels.
4. ${langRule()}
5. Read [current scene JSON] before editing; use oid in tool calls; use display names in chat.
6. After building, give one concrete teaching tip the teacher can use tomorrow.`;
  }
  return `你是「XR EduAgent」——面向中小学老师的 VR 教学场景搭建助教。
用户是没有编程背景的老师;你在一个基于 Three.js/WebXR 的 3D 编辑器里工作。

原则:
1. 先想清楚教学意图(学科/学段/知识点),再动手;搭的不是"模型堆",是"一节课"。
2. 资源选型:需求与预置模板高度吻合 → build_template;资源库有合适资源 → add_asset;两者都没有或不够精致 → create_custom_object 直接写 Three.js 代码现场造。你有完整的编程能力,不要因为没有现成资源就用简陋几何将就。
3. 质量标准对标内置的"制取氧气"实验:精细的模型(车削玻璃器皿/弯管/粒子效果)+ 分步点击交互 + 故意设计的考点错误分支 + 实时数据面板。老师要的是能直接上课的作品。
4. ${langRule()}
5. 修改前先看清 [当前场景状态 JSON];工具调用里引用对象用它的 oid,给老师的文字里用显示名称。
6. 每次搭建完,给老师一条具体可操作的教学建议。`;
}

function plannerSystem() {
  if (isEN()) {
    return cachedSystem(`${baseSystem()}

You are the Planner. Analyze the teacher's latest request and output JSON only (no other text):
{
 "intent": "one sentence: what the teacher wants",
 "complexity": "chat" | "simple" | "complex",
 "skills": ["skill-id", ...],
 "plan": ["step 1", "step 2", ...]
}

Rules:
- chat: question / small talk / explanation only — no scene edits
- simple: 1–2 tool calls (add one object / recolor / delete / toggle anim)
- complex: whole-scene build or refactor (≥3 steps)

Available skills (pick 2–4 when needed; empty for chat):
${skillCatalogForLLM()}

Available templates:
${scenarioCatalogForLLM()}

Write intent and every plan step in plain English the teacher can read. complex → 3–6 steps, simple → 1–2, chat → [].

For complex plans, follow this pipeline (also the execution roadmap):
- Build: ① ontology — object list & relationships (who controls whom / who interacts / shared state) ② scene build (static geometry & layout) ③ interactions & animation ④ verification (self-check + walk the interaction path)
- Repair: ① layered diagnosis (env→data→driver→deps) ② fix ③ immunize ④ verifiable acceptance action
Trim/merge stages if needed, but keep the order.`);
  }
  return cachedSystem(`${baseSystem()}

你现在是 Planner(规划层)。分析老师的最新请求,只输出 JSON(不要输出其它内容):
{
 "intent": "一句话概括老师想要什么",
 "complexity": "chat" | "simple" | "complex",
 "skills": ["技能id", ...],
 "plan": ["步骤1", "步骤2", ...]
}

判定标准:
- chat: 提问/闲聊/请求解释,不需要改场景
- simple: 1~2 个工具调用能完成(加一个对象/改颜色/删除/开关动画)
- complex: 需要搭建或改造整个场景(≥3 步)

可选技能(按需挑 2~4 个,chat 可为空):
${skillCatalogForLLM()}

可用场景模板:
${scenarioCatalogForLLM()}

plan 用老师能看懂的中文短句。complex 时 3~6 步,simple 时 1~2 步,chat 时空数组。

complex 任务的 plan 按标准流水线组织步骤(这也是后续执行的路线图):
- 搭建类:① 语义本体——列对象清单与关系(谁控制谁/谁和谁交互/共享什么状态)② 搭建场景(静态几何与布局)③ 加交互与动画 ④ 核验(自检场景 + 逐条走通交互链路)
- 修复类:① 分层排查定位病灶(环境→数据→驱动→依赖)② 修复 ③ 免疫加固(防复发)④ 给老师可验证的验收动作
可按任务裁剪合并,但顺序不要乱(先想清对象与关系,再动手;先搭静态,再加行为)。`);
}

// 稳定部分(缓存前缀)与本轮技能提示(变化部分)分块,前者标缓存断点
function executorSystem(skillIds) {
  const stable = isEN()
    ? `${baseSystem()}

You are the Executor. Complete the build/edits via tool calls:
- Follow the plan step by step; you may issue multiple independent tool calls in one message${cotGuidance()}
- For complex tasks (≥3 steps), advance stage by stage and call report_progress {stage,total,title,note} at each new stage (the teacher sees a progress card). title/note MUST be English. Standard stages: ontology → scene build → interactions & animation → verification. Repair: diagnose → fix → immunize → acceptance. Skip for simple tasks
- After a complex build, self-check with get_scene once
- Large scenes only have a summary index in context — use find_objects / get_object_detail before editing; do not guess
- The editor defaults to Edit mode (static; click = select). After shipping anim/interaction, remind the teacher to press ▶ Play (or set_environment {play_mode:true} if they ask to try immediately)
- When finished, write a short English summary of what you did + one teaching tip. Never end in Chinese when the UI is English`
    : `${baseSystem()}

你现在是 Executor(执行层),通过工具调用完成搭建/修改。做法:
- 按计划一步步调用工具;一条消息里可以并行发多个独立的工具调用${cotGuidance()}
- 复杂任务(≥3 步)按流水线推进,每进入一个新阶段先调用 report_progress {stage,total,title,note}(老师会看到进度卡);title/note 必须用中文。标准阶段:语义本体(对象清单与关系)→ 搭建场景 → 加交互与动画 → 核验。修复类任务:分层排查 → 修复 → 免疫加固 → 验收。简单任务不用调
- 复杂搭建完成后用 get_scene 自检一次
- 场景很大时上下文里只有摘要索引:改对象前先用 find_objects / get_object_detail 查清现状,不要凭索引猜
- 编辑器默认处于"编辑模式"(全静态,点击=选中);搭好含动画/交互的场景后,提醒老师点视口工具栏的 ▶ 运行按钮体验效果(或在老师明确想立即体验时用 set_environment {play_mode:true} 帮 ta 打开)
- 全部完成后,用一段中文总结你做了什么 + 一条教学建议。界面为中文时不要用英文收尾`;
  return cachedSystem(stable, skillIds?.length ? skillPrompts(skillIds) : '');
}

function askSystem() {
  const body = isEN()
    ? `${baseSystem()}

You are in Ask mode: explain, advise, and answer only — no scene edits (no tools).
You may explain objects / lab logic / teaching uses, or help outline a plan.
If the teacher needs scene changes, tell them to switch to Agent mode (above the input box).

[Asset library]
${assetCatalogForLLM()}`
    : `${baseSystem()}

你现在是 Ask 模式:只解释、答疑、给建议,不执行任何修改(没有工具可用)。
可以讲解场景里的对象/实验逻辑/教学用法,或帮老师构思方案。
如果老师的请求需要动手改场景,提示 ta 切换到 Agent 模式(输入框上方可切换)。

[资源库清单]
${assetCatalogForLLM()}`;
  return cachedSystem(body);
}

// ── Planner 调用 ──
// ctxMsg:轮初锁定的场景上下文(见 runTurn 的"上下文锁定")
async function runPlanner(userText, ctxMsg) {
  const params = {
    model: agent.model,
    system: plannerSystem(),
    messages: [
      ...agent.history.slice(-HISTORY_KEEP),
      { role: 'user', content: `${ctxMsg}\n\n[老师的最新请求]\n${userText}` },
    ],
    // Fable 5 等模型默认开自适应思考,思考 token 计入 max_tokens。
    // 规划只需 JSON,Auto 档用低 effort 省思考开销,同时给足 token 避免输出被思考吃光而截断。
    ...callBudget('planner'),
  };
  let res = await llmCall('planner', params);
  // 截断自愈:思考吃光预算 → JSON 被静默截断,是"兜底计划/完成。"类卡死的头号根因
  if (res.stop_reason === 'max_tokens') {
    logEvent('truncation_retry', { stage: 'planner', maxTokens: params.maxTokens });
    res = await llmCall('planner', { ...params, maxTokens: Math.round(params.maxTokens * 2) });
  }
  // 合并所有文本块(有的模型会分多块),再提取 JSON
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const obj = extractJSON(text);
  logEvent('planner_result', {
    raw: summarize(text, 600), parsed: !!obj, fallback: !obj,
    ...(obj ? { intent: obj.intent, complexity: obj.complexity, skills: obj.skills } : {}),
  });
  if (!obj) {
    // 兜底:解析失败也不硬崩,退化成"复杂任务"让老师确认计划后由 Executor 兜住
    console.warn('[Planner] 无法解析 JSON,使用兜底计划。原始输出:', text);
    return {
      intent: userText.slice(0, 40), complexity: 'complex', skills: [],
      plan: L(['理解需求并规划场景', '搭建并配置对象与交互', '自检场景并补充教学面板'],
        ['Understand the request and plan the scene', 'Build and configure objects & interactions', 'Self-check and add teaching panels']),
      _fallback: true,
    };
  }
  return obj;
}

// 从模型输出里稳健地抽取 JSON:剥代码围栏 → 直接 parse → 花括号配对扫描
function extractJSON(raw) {
  if (!raw) return null;
  let t = raw.trim().replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(t); } catch { /* 继续尝试 */ }
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;  // 花括号未闭合 = 被截断
}

// ── Executor 工具循环(文本流式输出 + 推理摘要可见)──
async function runExecutor(userText, plan, ui, complexity = null, ctxMsg = '') {
  const messages = [
    ...agent.history.slice(-HISTORY_KEEP),
    {
      role: 'user',
      content: `${ctxMsg}\n\n[老师的最新请求]\n${userText}`
        + (plan?.length ? `\n\n[已确认的执行计划]\n${plan.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : ''),
    },
  ];
  let finalText = '';
  const budget = callBudget('executor', complexity);

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    // 每轮:先显示打字点(上方灰字 = 当前流水线阶段,类 Cursor 的步骤状态);
    // 推理摘要先到→思考区块,首个正文 token 到达→流式消息
    const typing = ui.addTyping(progressLabel());
    let sm = null;
    let tb = null;   // 思考区块(每轮独立,思考片段归属本轮的工具/文本)
    let res;
    // 工具循环第 2 轮起,history+场景上下文+已产生的工具结果全部命中缓存(断点滑动到最新消息)
    setMsgCacheBreakpoint(messages);
    try {
      res = await llmCall('executor', {
        model: agent.model,
        system: executorSystem(agent.currentSkills),
        messages,
        tools: toolDefsForAPI(),
        ...budget,
        onThinking: t => {
          if (sm) return;                        // 正文已开始,后续思考不再展示
          if (!tb) { typing.remove(); tb = ui.startThinkingBlock(); }
          tb.append(t);
        },
        onText: t => {
          if (!sm) { tb?.done(); typing.remove(); sm = ui.startStreamMsg(); }
          sm.append(t);
        },
      });
    } catch (err) {
      tb?.done();
      typing.remove();
      sm?.done();
      throw err;
    }
    tb?.done();
    typing.remove();
    if (sm) {
      const streamed = sm.done();
      if (streamed.trim()) finalText = streamed;
    }
    // 截断预警:整段输出被思考吃光时,给老师可读提示而不是静默"完成。"
    if (res.stop_reason === 'max_tokens') {
      logEvent('truncation', { stage: 'executor', iter, maxTokens: budget.maxTokens });
      ui.addMsg('ai', L('⚠ 这一步思考消耗超出了 token 预算,输出被截断了。可以再说一次你的需求(我会继续),或把「思考深度」调低后重试。',
        '⚠ This step ran out of token budget and the output was truncated. Repeat your request (I will continue) or lower the thinking effort and retry.'));
      break;
    }
    const toolUses = res.content.filter(b => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !toolUses.length) break;

    messages.push({ role: 'assistant', content: res.content });
    // 首次真正改动场景前存一份快照,整轮 Agent 改动可作为一步整体撤销
    // (report_progress 是零副作用的进度汇报,不算改动,不触发快照/Keep 卡)
    if (toolUses.some(tu => tu.name !== 'report_progress')) {
      if (!turnMutated) recordHistory();
      turnMutated = true;
    }
    const results = [];
    for (const tu of toolUses) {
      const isProgress = tu.name === 'report_progress';
      // 进度汇报不渲染工具卡(exec 广播事件 → chat.js 画流水线进度卡,避免重复展示)
      const card = isProgress ? null : ui.addToolCard(toolCallLabel(tu.name, tu.input), true);
      if (!isProgress) await sleep(120);
      const t0 = performance.now();
      const r = execTool(tu.name, tu.input);
      logEvent('tool_call', { name: tu.name, input: summarizeToolInput(tu.input), ok: r.ok, msg: summarize(r.msg), ms: Math.round(performance.now() - t0) });
      if (card) ui.finishToolCard(card, `${toolCallLabel(tu.name, tu.input)}${r.ok ? '' : ' ⚠ ' + r.msg}`, r.ok);
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: r.msg, is_error: !r.ok });
    }
    messages.push({ role: 'user', content: results });
  }
  emit('agent-progress-end');   // 收尾:进度卡上最后一个阶段标记为完成
  if (!finalText) {
    logEvent('empty_output', { stage: 'executor' });
    finalText = L('完成。', 'Done.');
    ui.addMsg('ai', finalText);
  }
  return finalText;
}

// ── Ask 调用(流式输出 + 推理摘要可见)──
async function runAsk(userText, ui, ctxMsg) {
  const typing = ui.addTyping(L('正在思考…', 'Thinking…'));
  let sm = null;
  let tb = null;
  try {
    await llmCall('ask', {
      model: agent.model,
      system: askSystem(),
      messages: [
        ...agent.history.slice(-HISTORY_KEEP),
        { role: 'user', content: `${ctxMsg}\n\n[老师的问题]\n${userText}` },
      ],
      ...callBudget('ask'),
      onThinking: t => {
        if (sm) return;
        if (!tb) { typing.remove(); tb = ui.startThinkingBlock(); }
        tb.append(t);
      },
      onText: t => {
        if (!sm) { tb?.done(); typing.remove(); sm = ui.startStreamMsg(); }
        sm.append(t);
      },
    });
  } finally {
    tb?.done();
    typing.remove();
  }
  if (!sm) { const r = L('(无回复)', '(no reply)'); ui.addMsg('ai', r); return r; }
  return sm.done();
}

// ═══════════ 主入口:处理一条用户消息 ═══════════
// ui 回调由 chat.js 提供:{ addMsg, addToolCard, finishToolCard, addTyping, showPlanConfirm, startStreamMsg }
export async function runTurn(userText, ui) {
  if (agent.busy || !userText.trim()) return;
  agent.busy = true;
  state.ctxTurn++;   // 工作集轮次:本轮被工具创建/修改的对象,近几轮内自动进大场景上下文
  resetTurnStats();
  lastProgress = null;
  emit('agent-turn-start');   // chat.js 据此重置流水线进度卡
  logEvent('turn_start', { mode: agent.mode, model: agent.model, effort: agent.effort, input: summarize(userText, 300) });
  try {
    if (!hasLLM()) {
      await runOffline(userText, ui);
      if (turnMutated) refreshPlaySnapshot();
      if (turnMutated && ui.showKeepUndo) ui.showKeepUndo();
      agent.busy = false;
      return;
    }

    // 上下文锁定:一轮(Planner→确认→Executor 全程)只在开始时构建一次场景上下文。
    // 期间老师切运行模式/换选中对象不会改变 Agent 看到的初始状态,避免执行到一半
    // 上下文漂移(工具结果仍反映实时场景,模型照样能感知自己造成的变化)
    const ctxMsg = buildContextMessage(userText);

    // runAsk / runExecutor 内部自带流式渲染,这里只兜底错误与取消提示
    let finalReply = '';
    try {
      if (agent.mode === 'ask') {
        finalReply = await runAsk(userText, ui, ctxMsg);
      } else {
        // Planner:判复杂度 + 选技能 + 出计划(CoT 的第一跳)
        const typing = ui.addTyping(L('正在拆解任务、挑选技能…', 'Breaking down the task & picking skills…'));
        let p;
        try { p = await runPlanner(userText, ctxMsg); }
        finally { typing.remove(); }
        agent.currentSkills = p.skills || [];

        if (p.complexity === 'chat') {
          finalReply = await runAsk(userText, ui, ctxMsg);
        } else if (p.complexity === 'complex' || agent.mode === 'plan') {
          // 展示计划 → 等老师确认
          const confirmed = await ui.showPlanConfirm(p.intent, p.plan || [], p.skills || []);
          if (!confirmed) {
            finalReply = L('好的,已取消。你可以换个说法告诉我想怎么调整这个计划。',
              'Okay, cancelled. Tell me how you would like to adjust the plan.');
            ui.addMsg('ai', finalReply);
          } else {
            finalReply = await runExecutor(userText, p.plan, ui, p.complexity, ctxMsg);
          }
        } else {
          finalReply = await runExecutor(userText, p.plan, ui, p.complexity, ctxMsg);
        }
      }
    } catch (err) {
      logEvent('turn_error', { error: err.message });
      finalReply = L(`⚠ 调用模型出错了:${err.message}\n\n检查 api-keys.txt 里的密钥是否有效;删掉密钥可回到离线演示模式。`,
        `⚠ Model call failed: ${err.message}\n\nCheck that the key in api-keys.txt is valid; remove it to fall back to offline demo mode.`);
      ui.addMsg('ai', finalReply);
    }
    // Agent 在运行模式中改了场景 → 更新运行回滚基线,防止停止运行时把本轮成果回滚掉
    if (turnMutated) refreshPlaySnapshot();
    logEvent('turn_end', { reply: summarize(finalReply.replace(/<[^>]+>/g, ''), 300), stats: turnStats });
    if (turnStats?.calls && ui.addTurnStats) ui.addTurnStats(turnStats);
    // 本轮改了场景 → 弹 Keep/撤销 卡(未点保留就开始下一轮则默认保留)
    if (turnMutated && ui.showKeepUndo) ui.showKeepUndo();
    agent.history.push({ role: 'user', content: userText });
    agent.history.push({ role: 'assistant', content: finalReply.replace(/<[^>]+>/g, '') });
  } finally {
    agent.busy = false;
  }
}

// ═══════════ 离线回退(关键词规则,原演示逻辑)═══════════
function tryObjectCommand(text) {
  const sel = state.selected;
  if (!sel) return null;
  const name = sel.userData.displayName;
  const lower = text.toLowerCase();
  for (const [word, hex] of Object.entries(COLOR_WORDS)) {
    if (lower.includes(word) && /颜色|变成|改成|换成|色|color|make|paint|turn/i.test(text)) {
      setMainColor(sel, hex);
      emit('selection-changed');
      return {
        steps: [L(`修改「${name}」的材质颜色`, `Change the color of "${name}"`)],
        reply: L(`好的,已经把「<b>${name}</b>」变成${word}色了 🎨 还需要调整其他属性吗?`, `Done — "<b>${name}</b>" is now ${word} 🎨 Anything else to adjust?`),
      };
    }
  }
  if (/大一点|放大|变大|bigger|larger|scale up|enlarge/i.test(text)) {
    sel.scale.multiplyScalar(1.5);
    emit('selection-changed');
    return {
      steps: [L(`将「${name}」放大 1.5 倍`, `Scale "${name}" up 1.5×`)],
      reply: L(`已将「<b>${name}</b>」放大 1.5 倍 🔍 你也可以按 R 键用缩放手柄自由调整。`, `Scaled "<b>${name}</b>" up 1.5× 🔍 You can also press R to use the scale gizmo.`),
    };
  }
  if (/小一点|缩小|变小|smaller|shrink|scale down/i.test(text)) {
    sel.scale.multiplyScalar(0.67);
    emit('selection-changed');
    return {
      steps: [L(`将「${name}」缩小至 67%`, `Scale "${name}" down to 67%`)],
      reply: L(`已将「<b>${name}</b>」缩小了 🔍`, `Scaled "<b>${name}</b>" down 🔍`),
    };
  }
  if (/转起来|旋转|自转|spin|rotate/i.test(text)) {
    // 非破坏:已有其他动画(如公转)时叠加自转,不替换原动画
    const a = sel.userData.anim;
    if (!a) sel.userData.anim = { type: 'spin', speed: 0.8 };
    else if (a.type !== 'spin') a.selfSpin = true;
    emit('hierarchy-changed');
    return {
      steps: [L(`为「${name}」添加自转动画`, `Add a spin animation to "${name}"`)],
      reply: L(`「<b>${name}</b>」已经转起来了 ▶ 在层级面板里也可以随时开关自转。`, `"<b>${name}</b>" is spinning now ▶ You can toggle it any time in the hierarchy.`),
    };
  }
  if (/停|别动|静止|stop|freeze|still/i.test(text)) {
    delete sel.userData.anim;
    emit('hierarchy-changed');
    return {
      steps: [L(`移除「${name}」的动画`, `Remove the animation of "${name}"`)],
      reply: L(`「<b>${name}</b>」已停止运动 ⏸`, `"<b>${name}</b>" has stopped ⏸`),
    };
  }
  return null;
}

// 离线打字机:HTML 标签整体追加(避免闪现残缺标签),文本按小块流出
async function streamHtmlReply(ui, html) {
  const sm = ui.startStreamMsg();
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [html];
  for (const tok of tokens) {
    if (tok.startsWith('<')) { sm.append(tok); continue; }
    for (let i = 0; i < tok.length; i += 3) {
      sm.append(tok.slice(i, i + 3));
      await sleep(12);
    }
  }
  return sm.done();
}

async function runOffline(text, ui) {
  const typing = ui.addTyping();
  await sleep(500 + Math.random() * 400);
  typing.remove();

  // 意图判断:句子里出现"它/这个/选中"等指代词时优先视为对象指令。
  // 对象指令在检测时就会改场景,故先抓一份暂存快照,确认改了再提交到撤销栈
  const tentative = beginTentative();
  const refersToObject = /它|这个|那个|选中|\bit\b|\bthis\b|\bthat\b|selected/i.test(text);
  let objCmd = refersToObject ? tryObjectCommand(text) : null;
  const scenario = objCmd ? null : SCENARIOS.find(s => s.match.test(text));
  if (!objCmd && !scenario) objCmd = tryObjectCommand(text);
  const plan = objCmd || scenario;

  if (plan) {
    commitTentative(tentative);
    turnMutated = true;
    for (const step of plan.steps) {
      const card = ui.addToolCard(step, true);
      await sleep(350 + Math.random() * 350);
      ui.finishToolCard(card, step, true);
    }
    if (scenario) scenario.run();
    await sleep(250);
    await streamHtmlReply(ui, plan.reply);
    if (!state.playMode) toast(L('🛠 当前是编辑模式,点工具栏 ▶ 运行 查看动画与交互',
      '🛠 You are in Edit mode — press ▶ Play in the toolbar to see animations & interactions'));
  } else {
    await streamHtmlReply(ui, L(
      '我是你的 <b>VR 课堂搭建助教</b>(当前为<b>离线演示模式</b>)✨\n\n目前离线技能:\n· 🌞 "创建一个太阳系模型"\n· ⚗️ "做高锰酸钾制取氧气实验"(分步操作 + 错误分支)\n· 🍔 "创建餐厅英语点餐对话"(数字人 + 麦克风互动)\n· 🧪 "搭建一个化学实验室"\n· 🧬 "展示 DNA 双螺旋结构"\n· ⚖️ "演示单摆运动"\n· 📐 "生成多面体几何课堂"\n· 🛝 "做一个斜面滚球实验"\n\n发现场景有问题,可以直接说 <b>"帮我改…"</b>。\n\n选中对象后还可以说:"把它变成红色"、"放大一点"、"让它转起来"。',
      'I am your <b>VR lesson-building assistant</b> (currently in <b>offline demo mode</b>) ✨\n\nOffline skills:\n· 🌞 "Create a solar system model"\n· ⚗️ "Build the oxygen preparation experiment" (step-by-step + failure branch)\n· 🍔 "Create a restaurant English ordering dialogue" (digital human + microphone)\n· 🧪 "Build a chemistry lab"\n· 🧬 "Show the DNA double helix"\n· ⚖️ "Demonstrate pendulum motion"\n· 📐 "Generate a polyhedron geometry class"\n· 🛝 "Make a ramp rolling-ball experiment"\n\nSpotted a problem? Just say <b>"Fix this: …"</b>.\n\nWith an object selected you can also say: "make it red", "bigger", "make it spin".'));
  }
}
